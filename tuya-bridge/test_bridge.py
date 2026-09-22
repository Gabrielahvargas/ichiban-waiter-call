"""Automated tests for the Tuya -> Lovable bridge logic.

Run with:  python -m pytest tuya-bridge/test_bridge.py -v
(no Pulsar client or network access required)
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bridge_core import (  # noqa: E402
    PermanentRejection,
    build_event_id,
    extract_switch_events,
    forward_event,
    process_message,
    sign_body,
)

ENDPOINT = "https://example.lovable.app/api/public/tuya-events"
SECRET = "test-secret"
DEV_700 = "bf1234567890abcdef0700"


def table700_message(code="switch_type_3", value="single_click", data_id="dataid-700-1"):
    """Real-shaped Tuya Message Service payload for the table 700 switch."""
    return {
        "dataId": data_id,
        "devId": DEV_700,
        "productKey": "pk700",
        "bizCode": "devicePropertyMessage",
        "bizData": {
            "devId": DEV_700,
            "productKey": "pk700",
            "properties": [
                {"code": code, "value": value, "time": 1758000000000, "dpId": 3},
            ],
        },
    }


class FakeResponse:
    def __init__(self, status_code, text="ok"):
        self.status_code = status_code
        self.text = text


class FakeSession:
    """Records posts; `script` yields responses or exceptions in order."""

    def __init__(self, script=None, default=200):
        self.script = list(script or [])
        self.default = default
        self.posts = []

    def post(self, url, data=None, headers=None, timeout=None):
        self.posts.append({"url": url, "body": data, "headers": headers})
        item = self.script.pop(0) if self.script else FakeResponse(self.default)
        if isinstance(item, Exception):
            raise item
        return item


# --- 1. Real Tuya message format -------------------------------------------

def test_parses_table700_call_event():
    events = extract_switch_events(table700_message())
    assert len(events) == 1
    assert events[0]["device_id"] == DEV_700
    assert events[0]["button"] == "3"
    assert events[0]["click_type"] == "single_click"


def test_parses_table700_attend_event():
    events = extract_switch_events(table700_message(code="switch_type_4"))
    assert events[0]["button"] == "4"
    assert events[0]["click_type"] == "single_click"


def test_ignores_non_switch_properties():
    msg = table700_message()
    msg["bizData"]["properties"].append({"code": "battery_percentage", "value": 91, "time": 1})
    events = extract_switch_events(msg)
    assert [e["code"] for e in events] == ["switch_type_3"]


def test_ignores_other_biz_codes():
    msg = table700_message()
    msg["bizCode"] = "deviceOnline"
    assert extract_switch_events(msg) == []


def test_supports_legacy_status_shape():
    msg = {
        "dataId": "legacy-1",
        "devId": DEV_700,
        "status": [{"code": "switch_type_4", "value": "single_click", "t": 1}],
    }
    events = extract_switch_events(msg)
    assert events[0]["button"] == "4"


def test_double_and_long_click_normalized():
    assert extract_switch_events(table700_message(value="double_click"))[0]["click_type"] == "double_click"
    assert extract_switch_events(table700_message(value="long_press"))[0]["click_type"] == "long_click"


def test_unknown_value_ignored():
    assert extract_switch_events(table700_message(value="weird_value")) == []


def test_event_without_device_id_ignored():
    msg = table700_message()
    msg["devId"] = ""
    msg["bizData"]["devId"] = ""
    msg["bizData"]["properties"][0].pop("devId", None)
    assert extract_switch_events(msg) == []


# --- 2. Duplicates / idempotency -------------------------------------------

def test_event_id_is_stable_for_redelivered_message():
    msg = table700_message()
    e1 = extract_switch_events(msg)[0]
    e2 = extract_switch_events(json.loads(json.dumps(msg)))[0]
    assert build_event_id(msg, e1, 0) == build_event_id(msg, e2, 0)


def test_event_id_differs_between_presses():
    a = table700_message(data_id="dataid-700-1")
    b = table700_message(data_id="dataid-700-2")
    assert build_event_id(a, extract_switch_events(a)[0], 0) != build_event_id(
        b, extract_switch_events(b)[0], 0
    )


def test_duplicate_delivery_sends_same_event_id():
    msg = table700_message()
    session = FakeSession()
    assert process_message(msg, ENDPOINT, SECRET, session) == "ack"
    assert process_message(msg, ENDPOINT, SECRET, session) == "ack"
    ids = [json.loads(p["body"])["event_id"] for p in session.posts]
    assert ids[0] == ids[1]


# --- 3. Signing and payload -------------------------------------------------

def test_signature_matches_body():
    session = FakeSession()
    process_message(table700_message(), ENDPOINT, SECRET, session)
    post = session.posts[0]
    assert post["headers"]["x-signature"] == sign_body(post["body"], SECRET)
    body = json.loads(post["body"])
    assert body["device_id"] == DEV_700
    assert body["button"] == 3
    assert body["click_type"] == "single_click"


# --- 4. Acknowledgement behaviour / transient failures ----------------------

def test_network_failure_requests_retry():
    session = FakeSession(script=[ConnectionError("boom")])
    assert process_message(table700_message(), ENDPOINT, SECRET, session) == "retry"


def test_server_error_requests_retry():
    session = FakeSession(script=[FakeResponse(503, "unavailable")])
    assert process_message(table700_message(), ENDPOINT, SECRET, session) == "retry"


def test_retry_then_success_acks():
    session = FakeSession(script=[FakeResponse(503), FakeResponse(200)])
    msg = table700_message()
    assert process_message(msg, ENDPOINT, SECRET, session) == "retry"
    assert process_message(msg, ENDPOINT, SECRET, session) == "ack"
    ids = [json.loads(p["body"])["event_id"] for p in session.posts]
    assert ids[0] == ids[1]  # same key, backend deduplicates


def test_permanent_rejection_is_acked_and_logged(caplog):
    session = FakeSession(script=[FakeResponse(400, "invalid_payload")])
    with caplog.at_level("ERROR"):
        assert process_message(table700_message(), ENDPOINT, SECRET, session) == "ack"
    assert "REJECTED (permanent)" in caplog.text


def test_invalid_signature_response_is_permanent():
    session = FakeSession(script=[FakeResponse(401, "invalid_signature")])
    with pytest.raises(PermanentRejection):
        forward_event(
            {"device_id": DEV_700, "button": "3", "click_type": "single_click", "event_id": "x"},
            ENDPOINT,
            SECRET,
            session,
        )


def test_message_without_switch_events_is_acked():
    session = FakeSession()
    assert process_message({"bizCode": "deviceOnline", "bizData": {"devId": DEV_700}}, ENDPOINT, SECRET, session) == "ack"
    assert session.posts == []


def test_multiple_events_one_failing_requests_retry():
    msg = table700_message()
    msg["bizData"]["properties"].append(
        {"code": "switch_type_4", "value": "single_click", "time": 1758000000001, "dpId": 4}
    )
    session = FakeSession(script=[FakeResponse(200), FakeResponse(503)])
    assert process_message(msg, ENDPOINT, SECRET, session) == "retry"
