#!/usr/bin/env python3
"""
Tuya Message Service -> Lovable bridge.

Runs permanently (e.g. on Railway), consumes Tuya's Pulsar Message Service,
decrypts each message, extracts Zigbee switch click events and forwards them
to the Ichiban Waiter Calls backend at /api/public/tuya-events.

A message is acknowledged ONLY after the backend has accepted every event it
contains (or permanently rejected it). Transient failures are negatively
acknowledged so Pulsar redelivers them after a reconnection.

Environment variables:
  TUYA_ACCESS_ID         - Tuya Cloud Access ID / Client ID
  TUYA_ACCESS_KEY        - Tuya Cloud Access Secret / Client Secret
  TUYA_PULSAR_REGION     - us | eu | cn | ind | sg  (default: us)
  TUYA_MQ_ENV            - prod | test              (default: prod)
  LOVABLE_ENDPOINT       - https://your-project.lovable.app
  LOVABLE_WEBHOOK_SECRET - shared HMAC secret (= TUYA_WEBHOOK_SECRET in Lovable)
  BRIDGE_LOG_LEVEL       - DEBUG | INFO | WARNING | ERROR (default: INFO)
"""

import json
import logging
import os
import sys
import time
from typing import Optional

import pulsar
import requests

from bridge_core import process_message
from message_util import decrypt_message, message_id
from mq_authentication import get_authentication

MQ_ENV_PROD = "event"
MQ_ENV_TEST = "event-test"

PULSAR_SERVERS = {
    "cn": "pulsar+ssl://mqe.tuyacn.com:7285/",
    "eu": "pulsar+ssl://mqe.tuyaeu.com:7285/",
    "us": "pulsar+ssl://mqe.tuyaus.com:7285/",
    "ind": "pulsar+ssl://mqe.tuyain.com:7285/",
    "sg": "pulsar+ssl://mqe-sg.iotbing.com:7285/",
}

log = logging.getLogger("tuya-bridge")


def env(key: str, default: Optional[str] = None) -> str:
    value = os.environ.get(key, default)
    if value is None:
        log.error("Missing required environment variable: %s", key)
        sys.exit(1)
    return value


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def build_client(access_id: str, access_key: str) -> tuple[pulsar.Client, pulsar.Consumer]:
    region = env("TUYA_PULSAR_REGION", "us").lower()
    mq_env = MQ_ENV_PROD if env("TUYA_MQ_ENV", "prod").lower() == "prod" else MQ_ENV_TEST
    server_url = PULSAR_SERVERS.get(region)
    if server_url is None:
        log.error("Unknown TUYA_PULSAR_REGION: %s", region)
        sys.exit(1)

    topic = f"{access_id}/out/{mq_env}"
    subscription = f"{access_id}-sub-ichiban"
    log.info("Connecting to Tuya Pulsar: %s topic=%s subscription=%s", server_url, topic, subscription)

    client = pulsar.Client(
        server_url,
        authentication=get_authentication(access_id, access_key),
        tls_allow_insecure_connection=True,
    )
    consumer = client.subscribe(
        topic,
        subscription,
        consumer_type=pulsar.ConsumerType.Failover,
        negative_ack_redelivery_delay_ms=5000,
    )
    return client, consumer


def main() -> None:
    configure_logging(env("BRIDGE_LOG_LEVEL", "INFO"))
    access_id = env("TUYA_ACCESS_ID")
    access_key = env("TUYA_ACCESS_KEY")
    endpoint = env("LOVABLE_ENDPOINT").rstrip("/") + "/api/public/tuya-events"
    secret = env("LOVABLE_WEBHOOK_SECRET")
    session = requests.Session()

    log.info("Lovable event endpoint: %s", endpoint)

    while True:
        client: Optional[pulsar.Client] = None
        consumer: Optional[pulsar.Consumer] = None
        try:
            client, consumer = build_client(access_id, access_key)
            log.info("Connected. Waiting for messages...")

            while True:
                try:
                    msg = consumer.receive(timeout_ms=1000)
                except pulsar.Timeout:
                    continue

                msg_ref = message_id(msg.message_id())
                try:
                    decrypted_raw = decrypt_message(msg, access_key)
                    log.debug("Decrypted %s: %s", msg_ref, decrypted_raw[:600])
                    payload = json.loads(decrypted_raw)
                except Exception as exc:
                    # Undecryptable/unparsable data will never succeed on retry.
                    log.error("DROPPED %s - cannot decrypt/parse: %s", msg_ref, exc)
                    consumer.acknowledge(msg)
                    continue

                try:
                    outcome = process_message(payload, endpoint, secret, session)
                except Exception as exc:
                    log.exception("Unexpected error handling %s: %s", msg_ref, exc)
                    outcome = "retry"

                if outcome == "ack":
                    consumer.acknowledge(msg)
                    log.debug("Acknowledged %s", msg_ref)
                else:
                    consumer.negative_acknowledge(msg)
                    log.warning("NOT acknowledged %s - Pulsar will redeliver it", msg_ref)

        except KeyboardInterrupt:
            log.info("Stopping on user request")
            break
        except Exception as exc:
            log.exception("Consumer loop failed: %s", exc)
        finally:
            for closable in (consumer, client):
                if closable is not None:
                    try:
                        closable.close()
                    except Exception:
                        pass

        log.info("Reconnecting in 5 seconds...")
        time.sleep(5)


if __name__ == "__main__":
    main()
