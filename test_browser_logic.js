/**
 * Node.js Test Suite for Couple Calendar Browser Frontend Logic
 */

const assert = require("assert");

let passed = 0;
let failed = 0;

function assertTrue(cond, name) {
  if (cond) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

console.log("=".repeat(65));
console.log("🧪 RUNNING BROWSER CLIENT LOGIC & TWO-SESSION TESTS (NODE.JS)");
console.log("=".repeat(65));

// 1. Session Detection Logic
function parseUser(queryParam, sessionVal, localVal) {
  const q = (queryParam || "").toLowerCase().trim();
  if (["a", "anna", "her", "u_her", "1"].includes(q)) return "u_her";
  if (["b", "daniel", "you", "u_you", "2"].includes(q)) return "u_you";
  if (sessionVal) return sessionVal;
  if (localVal) return localVal;
  return "u_you"; // default
}

assertTrue(parseUser("a", null, null) === "u_her", "Query param ?user=a maps to Partner 1 (u_her)");
assertTrue(parseUser("anna", null, null) === "u_her", "Query param ?user=anna maps to Partner 1 (u_her)");
assertTrue(parseUser("b", null, null) === "u_you", "Query param ?user=b maps to Partner 2 (u_you)");
assertTrue(parseUser("daniel", null, null) === "u_you", "Query param ?user=daniel maps to Partner 2 (u_you)");
assertTrue(parseUser("", "u_her", "u_you") === "u_her", "SessionStorage takes precedence when query param is absent");
assertTrue(parseUser("", null, "u_her") === "u_her", "LocalStorage is used when sessionStorage is empty");

// 2. Permission and Card Display Tests
function canAnswer(ev, myId, canWrite = true) {
  return ev.status === "pending" && canWrite && (ev.by !== myId);
}

function isMine(ev, myId) {
  return Boolean(myId && ev.by === myId);
}

function waitingMessage(ev, myId, personLabel) {
  if (isMine(ev, myId)) {
    return "Waiting for your partner to accept";
  }
  return "Proposed by " + personLabel(ev.by);
}

const mockEventFromDaniel = {
  id: "ev1",
  title: "Dinner at Rosa's",
  date: "2026-10-30",
  by: "u_you",
  status: "pending"
};

// When Daniel is logged in:
assertTrue(isMine(mockEventFromDaniel, "u_you") === true, "For Daniel, isMine is true for his own event");
assertTrue(canAnswer(mockEventFromDaniel, "u_you") === false, "For Daniel, canAnswer is false (cannot accept his own event)");
assertTrue(waitingMessage(mockEventFromDaniel, "u_you", () => "Daniel") === "Waiting for your partner to accept",
           "Daniel sees 'Waiting for your partner to accept'");

// When Anna is logged in:
assertTrue(isMine(mockEventFromDaniel, "u_her") === false, "For Anna, isMine is false for Daniel's event");
assertTrue(canAnswer(mockEventFromDaniel, "u_her") === true, "For Anna, canAnswer is true (Accept/Decline buttons active!)");

// 3. Profiles mapping
function getProfiles(ids, currentUserId, profileNames) {
  const out = {};
  ids.forEach(i => {
    const isMe = (i === currentUserId);
    const name = (i === "u_her") ? profileNames.a : (i === "u_you" ? profileNames.b : "Partner");
    out[i] = { id: i, name, isMe };
  });
  return out;
}

const names = { a: "Anna", b: "Daniel" };
const profilesForDaniel = getProfiles(["u_you", "u_her"], "u_you", names);
assertTrue(profilesForDaniel["u_you"].isMe === true && profilesForDaniel["u_you"].name === "Daniel",
           "Profiles for Daniel session sets isMe: true for Daniel");
assertTrue(profilesForDaniel["u_her"].isMe === false && profilesForDaniel["u_her"].name === "Anna",
           "Profiles for Daniel session sets isMe: false for Anna");

const profilesForAnna = getProfiles(["u_you", "u_her"], "u_her", names);
assertTrue(profilesForAnna["u_her"].isMe === true && profilesForAnna["u_her"].name === "Anna",
           "Switching to Anna sets isMe: true for Anna");
assertTrue(profilesForAnna["u_you"].isMe === false && profilesForAnna["u_you"].name === "Daniel",
           "Switching to Anna sets isMe: false for Daniel");

// 4. Countdown Card Calculation
function computeCountdown(events, todayStr) {
  const accepted = events.filter(e => e.status === "accepted" && e.date >= todayStr);
  accepted.sort((a, b) => a.date.localeCompare(b.date));
  const next = accepted[0];
  if (!next) return { num: "No date yet", title: "" };
  const dToday = new Date(todayStr);
  const dNext = new Date(next.date);
  const days = Math.round((dNext - dToday) / 86400000);
  return { num: days === 0 ? "Today" : String(days), title: next.title };
}

const eventsList = [
  { title: "Declined Event", date: "2026-10-27", status: "declined" },
  { title: "Pending Event", date: "2026-10-28", status: "pending" },
  { title: "Next Date: Star Gazing", date: "2026-10-31", status: "accepted" },
  { title: "Later Date: Concert", date: "2026-11-15", status: "accepted" }
];

const cd = computeCountdown(eventsList, "2026-10-27");
assertTrue(cd.title === "Next Date: Star Gazing" && cd.num === "4",
           "Countdown skips declined and pending events, correctly tracks next accepted date (4 days)");

console.log("\n" + "=".repeat(65));
console.log(`📊 BROWSER LOGIC RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=".repeat(65));

process.exit(failed === 0 ? 0 : 1);
