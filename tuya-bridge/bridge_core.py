"""Pure logic for the Tuya -> Lovable bridge.

This module intentionally has no `pulsar` dependency so it can be unit tested
without the native Pulsar client installed.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
from typing import Any, Dict, List, Optional

log = logging.getLogger("tuya-bridge")

＿PLACEHOLDER＿

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

# bizCodes that carry device data-point reports.
PROPERTY_BIZ_CODES = {
    "devicePropertyMessage",
    "deviceStatusMessage",
    "report",
}


class PermanentRejection(Exception):
    """Backend rejected the payload in a way retrying cannot fix."""


def normalize_click_type(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    return CLICK_NORMALIZATION.get(raw.strip().lower())


def _append_event(
    events: List[Dict[str, str]],
    device_id: str,
    code: str,
    value: Any,
    event_time: Any,
) -> None:
    m = SWITCH_CODE_RE.match(str(code))
    if not m:
        return
    click_type = normalize_click_type(value)
    if click_type is None:
        log.info("Ignoring switch event with unsupported value: code=%s value=%r", code, value)
        return
    if not device_id:
        log.warning("Ignoring switch event without device id: code=%s", code)
        return
    events.append(
        {
            "device_id": device_id,
            "button": m.group(1),
            "click_type": click_type,
            "code": str(code),
            "time": str(event_time or ""),
        }
    )


def extract_switch_events(decrypted: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return [{device_id, button, click_type, code, time}] from a decrypted Tuya message.

    Supports the real Message Service envelope:
        {"bizCode": "devicePropertyMessage",
         "bizData": {"devId": "...", "properties": [{"code": "switch_type_3",
                                                      "value": "single_click",
                                                      "time": 1758000000000}]}}
    and the older flat `status` / `dps` shapes.
    """
    if not isinstance(decrypted, dict):
        return []

    events: List[Dict[str, str]] = []
    biz_code = decrypted.get("bizCode")
    biz_data = decrypted.get("bizData")

    if isinstance(biz_data, dict):
        if biz_code and biz_code not in PROPERTY_BIZ_CODES:
            log.debug("Ignoring message with bizCode=%s", biz_code)
            return []
        device_id = str(biz_data.get("devId") or biz_data.get("deviceId") or decrypted.get("devId") or "")
        properties = biz_data.get("properties")
        if isinstance(properties, list):
            for prop in properties:
                if isinstance(prop, dict):
                    _append_event(
                        events,
                        str(prop.get("devId") or device_id),
                        prop.get("code"),
                        prop.get("value"),
                        prop.get("time"),
                    )
        status = biz_data.get("status")
        if isinstance(status, list):
            for item in status:
                if isinstance(item, dict):
                    _append_event(
                        events,
                        str(item.get("devId") or device_id),
                        item.get("code"),
                        item.get("value"),
                        item.get("t") or item.get("time"),
                    )
        return events

    # Legacy / flat shapes.
    device_id = str(decrypted.get("devId") or decrypted.get("deviceId") or "")
    status = decrypted.get("status")
    if isinstance(status, list):
        for item in status:
            if isinstance(item, dict):
                _append_event(
                    events,
                    str(item.get("devId") or device_id),
                    item.get("code"),
                    item.get("value"),
                    item.get("t") or item.get("time"),
                )

    dps = decrypted.get("dps") or decrypted.get("dp")
    if isinstance(dps, dict):
        for code, value in dps.items():
            _append_event(events, device_id, code, value, decrypted.get("t"))

    return events


def build_event_id(decrypted: Dict[str, Any], event: Dict[str, str], index: int) -> str:
    """Stable idempotency key.

    Derived from the Tuya payload (not the Pulsar message id) so a redelivered
    message produces the same key and the backend deduplicates it.
    """
    biz_data = decrypted.get("bizData") if isinstance(decrypted.get("bizData"), dict) else {}
    data_id = (
        decrypted.get("dataId")
        or (biz_data or {}).get("dataId")
        or decrypted.get("id")
        or ""
    )
    base = data_id or f"{event['device_id']}|{event['time']}"
    return f"{base}|{event['code']}|{event['click_type']}|{index}"[:400]


def sign_body(body: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def forward_event(
    event: Dict[str, str],
    endpoint: str,
    secret: str,
    session: Any,
    timeout: int = 20,
) -> bool:
    """POST one switch event to the Lovable backend.

    Returns True when the backend accepted (or already had) the event.
    Raises PermanentRejection when retrying can never succeed (bad payload or
    bad signature) so the caller can drop the message instead of looping.
    Returns False for transient failures that should be retried.
    """
    payload = {
        "device_id": event["device_id"],
        "button": int(event["button"]),
        "click_type": event["click_type"],
        "event_id": event["event_id"],
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    headers = {"content-type": "application/json", "x-signature": sign_body(body, secret)}

    try:
        resp = session.post(endpoint, data=body, headers=headers, timeout=timeout)
    except Exception as exc:  # network error -> retry
        log.warning("Network error forwarding %s: %s", event["event_id"], exc)
        return False

    status = resp.status_code
    text = ""
    try:
        text = resp.text[:300]
    except Exception:
        pass

    if 200 <= status < 300:
        log.info(
            "Accepted %s device=%s button=%s click=%s -> %s %s",
            event["event_id"], event["device_id"], event["button"], event["click_type"], status, text,
        )
        return True

    if status in (400, 401, 403, 422):
        log.error(
            "REJECTED (permanent) %s device=%s button=%s click=%s -> HTTP %s %s",
            event["event_id"], event["device_id"], event["button"], event["click_type"], status, text,
        )
        raise PermanentRejection(f"HTTP {status}: {text}")

    log.warning(
        "Transient failure for %s -> HTTP %s %s (will retry)",
        event["event_id"], status, text,
    )
    return False


def process_message(
    decrypted: Dict[str, Any],
    endpoint: str,
    secret: str,
    session: Any,
) -> str:
    """Handle one decrypted Tuya message.

    Returns one of:
      "ack"   - nothing to do or everything accepted / permanently rejected
      "retry" - at least one event failed transiently; do NOT acknowledge
    """
    events = extract_switch_events(decrypted)
    if not events:
        return "ack"

    all_done = True
    for index, event in enumerate(events):
        event["event_id"] = build_event_id(decrypted, event, index)
        try:
            ok = forward_event(event, endpoint, secret, session)
        except PermanentRejection:
            continue  # logged; retrying cannot help
        if not ok:
            all_done = False

    return "ack" if all_done else "retry"
