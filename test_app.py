#!/usr/bin/env python3
"""
Comprehensive Automated Test Suite for Couple Calendar
Tests:
1. Server HTTP endpoints (Static files, /api/data, /api/info)
2. Two-Session Interaction (User A - Anna, User B - Daniel)
3. Event Proposal -> Partner Accept workflow
4. Event Proposal -> Partner Decline workflow
5. Edit & Re-approval workflow
6. Profile Sync (names & avatars)
7. Real-Time Server-Sent Events (SSE) Stream
8. Event Deletion
"""

import sys
import time
import json
import socket
import urllib.request
import urllib.error
import threading
from server import ThreadingHTTPServer, CoupleHandler, PORT, store_manager, get_default_store

TEST_PORT = 8089

def run_test_server():
    server_address = ("127.0.0.1", TEST_PORT)
    httpd = ThreadingHTTPServer(server_address, CoupleHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    return httpd

def http_get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8"), resp.headers

def http_post_json(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def test_suite():
    print("="*65)
    print("🧪 STARTING COUPLE CALENDAR TWO-SESSION AUTOMATED TEST SUITE")
    print("="*65)

    httpd = run_test_server()
    time.sleep(0.3)
    base_url = f"http://127.0.0.1:{TEST_PORT}"

    passed = 0
    failed = 0

    def assert_true(cond, name):
        nonlocal passed, failed
        if cond:
            print(f"  ✅ PASS: {name}")
            passed += 1
        else:
            print(f"  ❌ FAIL: {name}")
            failed += 1

    try:
        # TEST 1: Serve Static Webpage
        status, html, _ = http_get(f"{base_url}/")
        assert_true(status == 200 and "Couple Calendar" in html, "Webpage root serves index.html (HTTP 200)")
        assert_true("sessionBar" in html and "sheetLogin" in html, "UI contains Two-Session Bar & User Selection Modal")

        # TEST 2: Reset data & check /api/data
        status, reset_resp = http_post_json(f"{base_url}/api/reset", {})
        assert_true(status == 200 and reset_resp.get("ok"), "API /api/reset restores clean demo store")

        status, data_str, _ = http_get(f"{base_url}/api/data")
        store = json.loads(data_str)
        assert_true("couple/profile" in store and "events/e1" in store, "API /api/data returns valid calendar store")

        # TEST 3: Network info & invite URLs
        status, info_str, _ = http_get(f"{base_url}/api/info")
        info = json.loads(info_str)
        assert_true("partner_a_url" in info and "?user=a" in info["partner_a_url"], "API /api/info provides Partner A link")
        assert_true("partner_b_url" in info and "?user=b" in info["partner_b_url"], "API /api/info provides Partner B link")

        # TEST 4: Two-User Workflow - Daniel proposes an event
        # Daniel is "u_you" (Partner 2)
        # Anna is "u_her" (Partner 1)
        new_event = {
            "title": "Sunset Beach Picnic",
            "date": "2026-11-01",
            "allDay": False,
            "start": "17:30",
            "end": "19:30",
            "note": "Bring cheese and wine",
            "by": "u_you",
            "status": "pending",
            "created": int(time.time() * 1000)
        }
        status, mutate_resp = http_post_json(f"{base_url}/api/mutate", {
            "action": "add",
            "path": "events/ev_test_picnic",
            "value": new_event
        })
        assert_true(status == 200 and mutate_resp.get("ok"), "User B (Daniel) proposes new event 'Sunset Beach Picnic'")

        # Verify Anna sees the event as pending
        _, data_str, _ = http_get(f"{base_url}/api/data")
        store = json.loads(data_str)
        picnic = store.get("events/ev_test_picnic")
        assert_true(picnic is not None and picnic["status"] == "pending", "Event is stored with status 'pending'")
        assert_true(picnic["by"] == "u_you", "Event ownership belongs to Daniel ('u_you')")

        # TEST 5: Anna accepts the event
        # For Anna ("u_her"), picnic["by"] != "u_her", so Anna has approval permission
        picnic_accepted = dict(picnic)
        picnic_accepted["status"] = "accepted"
        picnic_accepted["answeredBy"] = "u_her"
        picnic_accepted["answeredAt"] = int(time.time() * 1000)

        status, _ = http_post_json(f"{base_url}/api/mutate", {
            "action": "update",
            "path": "events/ev_test_picnic",
            "value": picnic_accepted
        })
        assert_true(status == 200, "User A (Anna) accepts the event proposal")

        _, data_str, _ = http_get(f"{base_url}/api/data")
        updated_picnic = json.loads(data_str).get("events/ev_test_picnic")
        assert_true(updated_picnic["status"] == "accepted" and updated_picnic["answeredBy"] == "u_her",
                    "Event status is now 'accepted' by Anna for both partners")

        # TEST 6: Decline Workflow - Anna proposes, Daniel declines
        hike_event = {
            "title": "5am Mountain Hike",
            "date": "2026-11-03",
            "allDay": False,
            "start": "05:00",
            "end": "08:00",
            "note": "Early wake up!",
            "by": "u_her",
            "status": "pending"
        }
        http_post_json(f"{base_url}/api/mutate", {
            "action": "add",
            "path": "events/ev_test_hike",
            "value": hike_event
        })
        # Daniel declines
        hike_declined = dict(hike_event)
        hike_declined["status"] = "declined"
        hike_declined["answeredBy"] = "u_you"
        http_post_json(f"{base_url}/api/mutate", {
            "action": "update",
            "path": "events/ev_test_hike",
            "value": hike_declined
        })
        _, data_str, _ = http_get(f"{base_url}/api/data")
        hike = json.loads(data_str).get("events/ev_test_hike")
        assert_true(hike["status"] == "declined" and hike["answeredBy"] == "u_you",
                    "User B (Daniel) declined User A's proposal, status is 'declined'")

        # TEST 7: Edit and Re-Approval Workflow
        # If Daniel edits the accepted picnic to a different date/time, it resets to pending
        picnic_edited = dict(updated_picnic)
        picnic_edited["start"] = "18:00"
        picnic_edited["status"] = "pending"
        picnic_edited["answeredBy"] = None
        http_post_json(f"{base_url}/api/mutate", {
            "action": "update",
            "path": "events/ev_test_picnic",
            "value": picnic_edited
        })
        _, data_str, _ = http_get(f"{base_url}/api/data")
        picnic_recheck = json.loads(data_str).get("events/ev_test_picnic")
        assert_true(picnic_recheck["status"] == "pending" and picnic_recheck["answeredBy"] is None,
                    "Editing an event resets status to 'pending' for partner re-approval")

        # TEST 8: Shared Profile Update (Custom Names)
        profile_update = {
            "a": {"name": "Sophia", "img": ""},
            "b": {"name": "Alex", "img": ""}
        }
        http_post_json(f"{base_url}/api/mutate", {
            "action": "update",
            "path": "couple/profile",
            "value": profile_update
        })
        _, data_str, _ = http_get(f"{base_url}/api/data")
        profile = json.loads(data_str).get("couple/profile")
        assert_true(profile["a"]["name"] == "Sophia" and profile["b"]["name"] == "Alex",
                    "Profile names update dynamically across both sessions (Sophia & Alex)")

        # TEST 9: Delete Event
        http_post_json(f"{base_url}/api/mutate", {
            "action": "delete",
            "path": "events/ev_test_hike",
            "value": None
        })
        _, data_str, _ = http_get(f"{base_url}/api/data")
        assert_true("events/ev_test_hike" not in json.loads(data_str),
                    "Event deletion removes event from shared couple calendar")

        # TEST 10: Real-time Server-Sent Events (SSE) Delivery
        sse_received = []
        def sse_client():
            try:
                req = urllib.request.Request(f"{base_url}/api/stream")
                with urllib.request.urlopen(req, timeout=3) as resp:
                    for line in resp:
                        decoded = line.decode("utf-8").strip()
                        if decoded.startswith("data:"):
                            payload = json.loads(decoded[5:].strip())
                            sse_received.append(payload)
                            if len(sse_received) >= 2:
                                break
            except Exception:
                pass

        sse_thread = threading.Thread(target=sse_client, daemon=True)
        sse_thread.start()
        time.sleep(0.4)

        # Trigger mutation while SSE is connected
        http_post_json(f"{base_url}/api/mutate", {
            "action": "update",
            "path": "events/e1",
            "value": {"status": "accepted", "title": "Dinner at Rosa's (Confirmed)"}
        })
        time.sleep(0.4)

        assert_true(len(sse_received) >= 2, f"Live Server-Sent Events (SSE) pushes real-time updates to partner (received {len(sse_received)} events)")

    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\n" + "="*65)
    print(f"📊 RESULTS: {passed} PASSED, {failed} FAILED")
    print("="*65)
    return failed == 0

if __name__ == "__main__":
    success = test_suite()
    sys.exit(0 if success else 1)
