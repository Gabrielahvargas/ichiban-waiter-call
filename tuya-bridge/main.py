#!/usr/bin/env python3
"""
Tuya Message Service → Lovable bridge.

This tiny service runs permanently (e.g. on Railway) and consumes Tuya's
Pulsar-based Message Service. It decrypts each message, extracts Zigbee
switch click events, and forwards them to the Ichiban Waiter Calls backend
at /api/public/tuya-events.

Environment variables:
  TUYA_ACCESS_ID       - Tuya Cloud Access ID / Client ID
  TUYA_ACCESS_KEY      - Tuya Cloud Access Secret / Client Secret
  TUYA_PULSAR_REGION   - us | eu | cn | ind | sg  (default: us)
  TUYA_MQ_ENV          - prod | test              (default: prod)
  LOVABLE_ENDPOINT     - https://your-project.lovable.app
  LOVABLE_WEBHOOK_SECRET - shared HMAC secret from Cloud Secrets
  BRIDGE_LOG_LEVEL     - DEBUG | INFO | WARNING | ERROR (default: INFO)
"""

import hashlib
import hmac
import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional

import pulsar
import requests

from mq_authentication import get_authentication
from message_util import decrypt_message, message_id

MQ_ENV_PROD = "event"
MQ_ENV_TEST = "event-test"

PULSAR_SERVERS = {
    "cn": "pulsar+ssl://mqe.tuyacn.com:7285/",
    "eu": "pulsar+ssl://mqe.tuyaeu.com:7285/",
    "us": "pulsar+ssl://mqe.tuyaus.com:7285/",
    "ind": "pulsar+ssl://mqe.tuyain.com:7285/",
    "sg": "pulsar+ssl://mqe-sg.iotbing.com:7285/",
}

CLICK_NORMALIZATION = {
    "single_click": "single_click",
    "click": "single_click",
    "single": "single_click",
    "double_click": "double_click",
    "double": "double_click",
    "long_click": "long_click",
    "long": "long_click",
    "long_press": "long_click",
    "press": "long_click",
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


def normalize_click_type(raw: str) -> Optional[str]:
    return CLICK_NORMALIZATION.get(raw.lower())


def extract_switch_events(decrypted: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return [{device_id, button, click_type}] from a decrypted Tuya message."""
    events: List[Dict[str, str]] = []
    device_id = decrypted.get("devId") or decrypted.get("deviceId")
    status_list = decrypted.get("status") or []

    # Some firmware reports events in a dps map, e.g. {"1":"single_click"}.
    dps = decrypted.get("dps") or decrypted.get("dp")
    if isinstance(dps, dict):
        for code, value in dps.items():
            m = re.match(r"switch_type_(\d)", code)
            if m:
                click_type = normalize_click_type(str(value))
                if click_type:
                    events.append({
                        "device_id": str(device_id or ""),
                        "button": m.group(1),
                        "click_type": click_type,
                    })

    if isinstance(status_list, list):
        for item in status_list:
            code = item.get("code") or ""
            value = item.get("value")
            m = re.match(r"switch_type_(\d)", code)
            if m and isinstance(value, str):
                click_type = normalize_click_type(value)
                if click_type:
                    events.append({
                        "device_id": str(device_id or item.get("devId") or ""),
                        "button": m.group(1),
                        "click_type": click_type,
                    })

    return events


def sign_body(body: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def forward_event(event: Dict[str, str], endpoint: str, secret: str, timeout: int = 20) -> bool:
    """POST one switch event to the Lovable backend. Returns True on 2xx."""
    payload = {
        "device_id": event["device_id"],
        "button": int(event["button"]),
        "click_type": event["click_type"],
        "event_id": event["event_id"],
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    signature = sign_body(body, secret)
    headers = {"content-type": "application/json", "x-signature": signature}

    try:
        resp = requests.post(endpoint, data=body, headers=headers, timeout=timeout)
    except Exception as exc:
        log.warning("Network error forwarding %s: %s", event["event_id"], exc)
        return False

    if resp.status_code >= 200 and resp.status_code < 300:
        log.info("Forwarded %s button=%s click=%s -> %s", event["event_id"], event["button"], event["click_type"], resp.status_code)
        return True

    log.warning("Backend rejected %s: HTTP %s %s", event["event_id"], resp.status_code, resp.text[:200])
    return False


def build_client() -> tuple[pulsar.Client, pulsar.Consumer]:
    access_id = env("TUYA_ACCESS_ID")
    access_key = env("TUYA_ACCESS_KEY")
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
    )
    return client, consumer


def main() -> None:
    configure_logging(env("BRIDGE_LOG_LEVEL", "INFO"))
    endpoint = env("LOVABLE_ENDPOINT").rstrip("/") + "/api/public/tuya-events"
    secret = env("LOVABLE_WEBHOOK_SECRET")

    log.info("Lovable event endpoint: %s", endpoint)

    while True:
        client: Optional[pulsar.Client] = None
        consumer: Optional[pulsar.Consumer] = None
        try:
            client, consumer = build_client()
            log.info("Connected. Waiting for messages...")

            while True:
                try:
                    msg = consumer.receive(timeout_ms=1000)
                except pulsar.Timeout:
                    continue

                msg_id_str = message_id(msg.message_id())
                try:
                    decrypted = decrypt_message(msg, env("TUYA_ACCESS_KEY"))
                    log.debug("Decrypted message %s: %s", msg_id_str, decrypted[:500])
                    payload = json.loads(decrypted)
                except Exception as exc:
                    log.exception("Failed to decrypt/parse message %s: %s", msg_id_str, exc)
                    consumer.acknowledge(msg)
                    continue

                events = extract_switch_events(payload)
                if not events:
                    log.debug("No switch events in message %s", msg_id_str)
                    consumer.acknowledge(msg)
                    continue

                all_ok = True
                for idx, event in enumerate(events):
                    event["event_id"] = f"{msg_id_str}|{idx}|{event['button']}|{event['click_type']}"
                    if not forward_event(event, endpoint, secret):
                        all_ok = False

                if all_ok:
                    consumer.acknowledge_cumulative(msg)
                    log.debug("Acknowledged message %s", msg_id_str)
                else:
                    consumer.negative_acknowledge(msg)
                    log.warning("Negative acknowledge message %s; will retry", msg_id_str)

        except KeyboardInterrupt:
            log.info("Stopping on user request")
            break
        except Exception as exc:
            log.exception("Consumer loop failed: %s", exc)
        finally:
            if consumer:
                try:
                    consumer.close()
                except Exception:
                    pass
            if client:
                try:
                    client.close()
                except Exception:
                    pass

        log.info("Reconnecting in 5 seconds...")
        time.sleep(5)


if __name__ == "__main__":
    main()
