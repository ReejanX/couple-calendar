(function (global) {
  "use strict";

  global.CoupleCalendarPages = global.CoupleCalendarPages || {};
  global.CoupleCalendarPages.createHomePage = function (ctx) {
    var $ = ctx.$, state = ctx.state, today = ctx.today, parseYmd = ctx.parseYmd;
    var fmtTime = ctx.fmtTime, timeText = ctx.timeText, cmp = ctx.cmp, acceptedDateMessage = ctx.acceptedDateMessage;
    var PK = ctx.PK, canAnswer = ctx.canAnswer, getPartnerName = ctx.getPartnerName, getMyName = ctx.getMyName;
    var avatarNode = ctx.avatarNode, el = ctx.el, pad = ctx.pad, buildTimeline = ctx.buildTimeline;
    var openDetail = ctx.openDetail, answer = ctx.answer;

      /* Greeting & labels */
      function renderGreeting() {
        var hour = new Date().getHours();
        var timeWord = hour < 12 ? "Good morning" : (hour < 18 ? "Good afternoon" : "Good evening");
        var myName = getMyName();
        $("greetingTitle").textContent = myName ? timeWord + ", " + myName : timeWord;
        $("greetingSubtitle").textContent = state.myId ? "Your private sanctuary with " + getPartnerName() : "Your private plans together";
        $("roleA").textContent = (state.myId === window.coupleApp.USER_A) ? "You" : "Partner";
        $("roleB").textContent = (state.myId === window.coupleApp.USER_B) ? "You" : "Partner";
        if (!state.editingId) $("fSave").textContent = "Ask " + getPartnerName() + " 💕";
        $("fNoteInfo").textContent = getPartnerName() + " will see this proposal and can say yes!";
      }

      function renderCountdown() {
        var t = today();
        var next = state.events.filter(function (e) { return e.status === "accepted" && e.date >= t; }).sort(cmp)[0];
        var num = $("cdNum"), label = $("cdLabel"), title = $("cdTitle"), when = $("cdWhen"), plan = $("cdPlan");
        var eyebrow = $("cdEyebrow");
        state.nextId = next ? next.id : null;

        if (!next) {
          eyebrow.textContent = "Our Reunion";
          num.textContent = "No plans yet"; num.className = "big word";
          label.textContent = "Plan something memorable for your visit 💕";
          title.textContent = ""; when.textContent = ""; plan.hidden = false;
          return;
        }

        plan.hidden = true;
        eyebrow.textContent = "Next Reunion Date";
        var days = Math.round((parseYmd(next.date) - parseYmd(t)) / 86400000);
        if (days === 0) { num.textContent = "Today"; num.className = "big word"; label.textContent = "Enjoy every second together! 💕"; }
        else if (days === 1) { num.textContent = "Tomorrow"; num.className = "big word"; label.textContent = "Almost time! 💕"; }
        else { num.textContent = String(days); num.className = "big"; label.textContent = "days until our date"; }

        title.textContent = next.title;
        when.textContent = parseYmd(next.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) +
          (next.allDay || !next.start ? "" : ", " + fmtTime(next.start));
      }

      function renderCouple() {
        PK.forEach(function (k) {
          var holder = $(k === "a" ? "avA" : "avB");
          holder.textContent = ""; holder.appendChild(avatarNode(k));
          var n = $(k === "a" ? "nameA" : "nameB");
          var nm = (state.profile[k].name || "").trim();
          n.textContent = nm || "Add name";
          n.className = "pname";
        });
      }

      function evCard(ev) {
        var wrap = el("div", "evwrap");
        var incoming = canAnswer(ev);
        var card = el("div", "evcard " + ev.status + (incoming ? " pending-incoming" : ""));
        card.tabIndex = 0; card.setAttribute("role", "button");

        var cardHead = el("div", "evcard-header");
        var pill = el("span", "pill " + ev.status);
        if (ev.status === "accepted") pill.textContent = "Accepted 💕";
        else if (ev.status === "pending") pill.textContent = incoming ? "New Date Proposal! 💌" : "Waiting for " + getPartnerName();
        else pill.textContent = "Declined";
        cardHead.appendChild(pill);

        if (ev.status === "accepted") {
          var minis = el("div", "minis");
          minis.appendChild(avatarNode("a", "mini")); minis.appendChild(avatarNode("b", "mini"));
          cardHead.appendChild(minis);
        }
        card.appendChild(cardHead);

        var cardBody = el("div", "evcard-body");
        var main = el("div", "main");
        main.appendChild(el("div", "evtitle", ev.title));
        main.appendChild(el("div", "evtime", timeText(ev)));
        cardBody.appendChild(main);
        card.appendChild(cardBody);

        if (ev.status === "pending") {
          var msg = el("div", "evpersonal-msg" + (incoming ? "" : " waiting"));
          msg.textContent = incoming
            ? "💌 " + getPartnerName() + " wants to take you on a date!"
            : "✨ You asked " + getPartnerName() + ". Waiting for them to say yes!";
          card.appendChild(msg);
        } else if (ev.status === "accepted") {
          card.appendChild(el("div", "evpersonal-msg", acceptedDateMessage(ev)));
        }

        card.addEventListener("click", function () { openDetail(ev.id); });
        card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(ev.id); } });
        wrap.appendChild(card);

        // Accept / Decline appear ONLY for the person who was asked
        if (incoming) {
          var row = el("div", "answer");
          var yes = el("button", "btn primary grow", "Accept 💕"); yes.type = "button";
          yes.addEventListener("click", function () { answer(ev.id, "accepted"); });
          var no = el("button", "btn grow", "Decline"); no.type = "button";
          no.addEventListener("click", function () { answer(ev.id, "declined"); });
          row.appendChild(yes); row.appendChild(no); wrap.appendChild(row);
        }
        return wrap;
      }

      function renderUpcoming() {
        var t = today();
        var up = state.events.filter(function (e) { return e.date >= t && e.status !== "declined"; }).sort(cmp).slice(0, 10);
        $("planCountBadge").textContent = up.length ? (up.length + (up.length === 1 ? " date" : " dates")) : "";
        var groups = [];
        up.forEach(function (e) {
          var last = groups[groups.length - 1];
          if (last && last.date === e.date) last.events.push(e); else groups.push({ date: e.date, events: [e] });
        });
        buildTimeline($("upList"), groups, "No plans scheduled yet. Tap 'Plan a Date' to surprise " + getPartnerName() + "! 💕");
      }


    return {
      renderGreeting: renderGreeting,
      renderCountdown: renderCountdown,
      renderCouple: renderCouple,
      renderUpcoming: renderUpcoming
    };
  };
})(window);
