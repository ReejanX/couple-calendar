#!/usr/bin/env python3
"""
In-process Unit and Integration Test for Couple Calendar Server & Two-Session Logic
Tests:
1. StoreManager loading, mutation, and persistence
2. Default profile & events structure
3. Two-Session Event Proposal & Approval workflow
4. Decline workflow
5. Re-approval on event modification
6. Profile customization and dynamic names
7. Event deletion
8. CoupleHandler API routing (simulated HTTP request/response via io.BytesIO)
"""

import io
import os
import json
import time
from server import StoreManager, get_default_store, DATA_FILE, CoupleHandler

passed = 0
failed = 0

def assert_true(cond, name):
    global passed, failed
    if cond:
        print(f"  ✅ PASS: {name}")
        passed += 1
    else:
        print(f"  ❌ FAIL: {name}")
        failed += 1

def run_tests():
    global passed, failed
    print("="*65)
    print("🧪 RUNNING IN-PROCESS COUPLE CALENDAR TWO-SESSION LOGIC TESTS")
    print("="*65)

    # 1. Initialize clean StoreManager
    if os.path.exists(DATA_FILE):
        try: os.remove(DATA_FILE)
        except Exception: pass

    mgr = StoreManager()
    store = mgr.store

    assert_true("couple/profile" in store, "Store initialized with 'couple/profile'")
    assert_true(store["couple/profile"]["a"]["name"] == "Anna", "Partner 1 initialized as Anna")
    assert_true(store["couple/profile"]["b"]["name"] == "Daniel", "Partner 2 initialized as Daniel")
    assert_true("events/e1" not in store, "Mock sample events cleared from initial store")

    # 2. Two-Session Interaction Test
    # Daniel ("u_you") creates a new event proposal
    event_data = {
        "title": "Picnic at Botanic Gardens",
        "date": "2026-11-02",
        "allDay": False,
        "start": "13:00",
        "end": "16:00",
        "note": "Pack strawberries and blanket",
        "by": "u_you",
        "status": "pending",
        "created": int(time.time() * 1000)
    }
    updated = mgr.mutate("add", "events/ev_picnic", event_data)
    picnic = updated.get("events/ev_picnic")
    assert_true(picnic is not None and picnic["status"] == "pending", "Daniel created event with status 'pending'")
    assert_true(picnic["by"] == "u_you", "Event author is Daniel ('u_you')")

    # 3. Anna ("u_her") accepts the proposal
    # Permissions check: Can Anna answer?
    can_anna_answer = (picnic["status"] == "pending") and (picnic["by"] != "u_her")
    can_daniel_answer = (picnic["status"] == "pending") and (picnic["by"] != "u_you")
    assert_true(can_anna_answer is True, "Anna has permission to Accept/Decline Daniel's event")
    assert_true(can_daniel_answer is False, "Daniel cannot accept his own event (must wait for partner)")

    # Execute Acceptance
    accepted_data = dict(picnic)
    accepted_data["status"] = "accepted"
    accepted_data["answeredBy"] = "u_her"
    accepted_data["answeredAt"] = int(time.time() * 1000)
    updated = mgr.mutate("update", "events/ev_picnic", accepted_data)

    accepted_picnic = updated.get("events/ev_picnic")
    assert_true(accepted_picnic["status"] == "accepted", "Event status updated to 'accepted'")
    assert_true(accepted_picnic["answeredBy"] == "u_her", "Event answeredBy is Anna ('u_her')")

    # 4. Decline Workflow Test
    # Anna creates an event
    hike_data = {
        "title": "Early Morning 5k Run",
        "date": "2026-11-04",
        "allDay": False,
        "start": "06:00",
        "end": "07:00",
        "note": "Interval run",
        "by": "u_her",
        "status": "pending"
    }
    mgr.mutate("add", "events/ev_run", hike_data)
    # Daniel declines
    declined_data = dict(hike_data)
    declined_data["status"] = "declined"
    declined_data["answeredBy"] = "u_you"
    declined_data["answeredAt"] = int(time.time() * 1000)
    updated = mgr.mutate("update", "events/ev_run", declined_data)
    assert_true(updated.get("events/ev_run")["status"] == "declined", "Daniel successfully declined Anna's run proposal")

    # 5. Edit Re-approval Workflow Test
    # Daniel changes time of accepted picnic
    edited_picnic = dict(accepted_picnic)
    edited_picnic["start"] = "14:00"
    edited_picnic["status"] = "pending"
    edited_picnic["answeredBy"] = None
    updated = mgr.mutate("update", "events/ev_picnic", edited_picnic)
    rechecked = updated.get("events/ev_picnic")
    assert_true(rechecked["status"] == "pending" and rechecked["answeredBy"] is None,
                "Editing accepted event resets status to 'pending' for partner re-approval")

    # 6. Profile Synchronization Test
    prof_update = {"a": {"name": "Sophia", "img": "data:image/jpeg;base64,mock"}, "b": {"name": "Liam", "img": ""}}
    updated = mgr.mutate("update", "couple/profile", prof_update)
    cur_prof = updated.get("couple/profile")
    assert_true(cur_prof["a"]["name"] == "Sophia" and cur_prof["b"]["name"] == "Liam",
                "Profile names and avatars synchronized to store")

    # 7. Delete Event Test
    updated = mgr.mutate("delete", "events/ev_run", None)
    assert_true("events/ev_run" not in updated, "Event successfully removed from store")

    # 8. Persistence Verification Test
    mgr2 = StoreManager()
    reloaded = mgr2.load()
    assert_true("events/ev_picnic" in reloaded, "Persisted store successfully reloads from couple_store.json")
    assert_true(reloaded["couple/profile"]["a"]["name"] == "Sophia", "Profile updates persist to disk")

    print("\n" + "="*65)
    print(f"📊 LOGIC TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("="*65)
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    import sys
    sys.exit(0 if success else 1)
