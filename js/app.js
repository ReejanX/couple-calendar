    (function () {
      "use strict";
      var $ = function (id) { return document.getElementById(id); };
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
      var parseYmd = function (s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
      var today = function () { return ymd(new Date()); };
      var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      var TIME_RE = /^\d{2}:\d{2}$/;
      var PK = ["a", "b"];

      var ICON = {
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
        cam: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>'
      };

      var state = {
        tab: "home", year: 0, month: 0, selected: today(),
        events: [], profile: { a: { name: "Reejan", img: "" }, b: { name: "Shreya", img: "" } }, profileExists: false,
        myId: null, evCol: null, profRef: null, memPhotoCol: null, memBoothCol: null,
        memoryPhotos: [], memoryBooths: {}, memoryMode: "dates", memoryEventId: null, memoryDraft: null, memorySelectedPhotoIds: [], memorySelectedBoothPhotoId: null,
        editingId: null, detailId: null, saving: false, draft: null
      };
      (function () { var n = new Date(); state.year = n.getFullYear(); state.month = n.getMonth(); })();

      function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
      }
      function fmtTime(t) {
        if (!t || !TIME_RE.test(t)) return "";
        var p = t.split(":").map(Number), h = p[0], m = p[1], ap = h >= 12 ? "pm" : "am";
        h = h % 12 || 12;
        return h + ":" + pad(m) + ap;
      }
      function timeText(ev) {
        if (ev.allDay || !ev.start) return "All day";
        return fmtTime(ev.start) + (ev.end ? " – " + fmtTime(ev.end) : "");
      }
      function longDate(ds) { return parseYmd(ds).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }); }
      function cmp(a, b) {
        return a.date.localeCompare(b.date) || (a.allDay === b.allDay ? 0 : (a.allDay ? -1 : 1)) ||
          (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title);
      }
      function acceptedDateMessage(ev) {
        var partner = getPartnerName();
        var title = (ev.title || "").toLowerCase();
        var pool;
        if (ev.date < today()) {
          pool = ["That was a lovely little memory together 💕", "Another sweet story for your collection 📖✨", "Hope this one still makes you smile 💗"];
        } else if (ev.date === today()) {
          pool = ["Date day is here! Go make a sweet little memory together 💕", "Today's the day—enjoy every little moment ✨", "It's finally your date day! Have the loveliest time 💗"];
        } else if (/birthday|annivers|celebrat|special/.test(title)) {
          pool = ["A little celebration with " + partner + " 🎂✨", "A special day made sweeter together 💕", "A date worth putting a little sparkle on ✨"];
        } else if (/trip|travel|flight|visit|reunion|adventure/.test(title)) {
          pool = ["Counting down to your next little adventure ✈️💕", "A new favorite story with " + partner + " is on the way 🗺️✨", "Something lovely to look forward to together 💗"];
        } else if (/movie|cinema|film|netflix/.test(title)) {
          pool = ["Movie night with " + partner + " and all the cozy vibes 🍿💕", "Snacks, a good film, and your favorite company 🍿✨", "A cozy little date is on the way 🎬💗"];
        } else if (/coffee|cafe|café|breakfast|brunch|lunch|dinner|food|restaurant|dessert|cook|bake/.test(title)) {
          pool = ["Good food and time with " + partner + "—the perfect combo 🍽️💕", "A tasty little date with your favorite person is on the way 😋✨", "Something delicious to look forward to together 💗"];
        } else if (/walk|hike|beach|park|picnic|garden|outdoor/.test(title)) {
          pool = ["A little fresh air and hand-holding with " + partner + " 🌿💕", "Wandering somewhere lovely together sounds perfect 🌼✨", "A little sunshine and your favorite company ☀️💗"];
        } else if (ev.allDay || !ev.start) {
          pool = ["A whole day together? Best kind of plan 💕", "An entire day for little moments together ✨", "All day with your favorite person sounds lovely 💗"];
        } else {
          var hour = Number(ev.start.slice(0, 2));
          if (hour < 11) pool = ["A bright little morning with " + partner + " to look forward to ☀️💕", "Morning plans with your favorite person? Lovely ✨", "A sweet start to the day together 💗"];
          else if (hour < 17) pool = ["A lovely afternoon with " + partner + " is on the way 🌷💕", "A little daytime date to look forward to ✨", "Your afternoon just got something lovely 💗"];
          else pool = ["An evening with " + partner + " to look forward to 🌙💕", "Your favorite company and a lovely night ahead ✨", "A little evening magic for two 💗"];
        }
        var key = String(ev.id || "") + "|" + ev.date + "|" + (ev.title || "");
        var hash = 0;
        for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
        return pool[(hash >>> 0) % pool.length];
      }

      /* ---------- permission rules (single source of truth) ----------
         isMine      : I am the one who proposed / last changed this date
         canAnswer   : someone ELSE asked me, and it is still pending  -> Accept / Decline
         canManage   : I asked for it (edit / cancel), or it's accepted (either of us can edit / cancel)
         Nobody can answer their own request, and nobody asked can edit or cancel it. */
      function isMine(ev) { return !!state.myId && ev.by === state.myId; }
      function canAnswer(ev) { return !!state.myId && ev.status === "pending" && ev.by !== state.myId; }
      function canManage(ev) { return !!state.myId && (ev.by === state.myId || ev.status === "accepted"); }

      function nameOf(key, fallback) { return (state.profile[key].name || "").trim() || fallback; }
      function getMyName() {
        if (state.myId === window.coupleApp.USER_A) return nameOf("a", "Reejan");
        if (state.myId === window.coupleApp.USER_B) return nameOf("b", "Shreya");
        return "";
      }
      function getPartnerName() {
        if (state.myId === window.coupleApp.USER_A) return nameOf("b", "Shreya");
        if (state.myId === window.coupleApp.USER_B) return nameOf("a", "Reejan");
        return "your partner";
      }

      function cleanP(o) {
        o = o || {};
        return {
          name: typeof o.name === "string" ? o.name : "",
          img: typeof o.img === "string" && o.img.indexOf("data:image/") === 0 ? o.img : ""
        };
      }
      function avatarNode(key, extra) {
        var p = state.profile[key] || { name: "", img: "" };
        var s = el("span", "avatar" + (extra ? " " + extra : ""));
        if (p.img) {
          var im = document.createElement("img");
          im.alt = ""; im.src = p.img;
          s.appendChild(im);
        } else { s.innerHTML = ICON.user; }
        return s;
      }

      function showSyncIndicator(message) {
        $("syncIndicatorText").textContent = message || "Syncing…";
        $("syncIndicator").hidden = false;
      }
      function hideSyncIndicator() { $("syncIndicator").hidden = true; }

      var toastTimer = null;
      function toast(msg) {
        var t = $("toast"); t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
      }

      /* Theme */
      function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem("couple_theme", theme); } catch (e) { }
        var icon = $("themeIcon");
        if (theme === "dark") {
          icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        } else {
          icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
        }
      }
      function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem("couple_theme"); } catch (e) { }
        if (!saved) saved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        applyTheme(saved);
        $("themeBtn").addEventListener("click", function () {
          var current = document.documentElement.getAttribute("data-theme") || "light";
          applyTheme(current === "dark" ? "light" : "dark");
        });
      }

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

      /* Event card */
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

      function buildTimeline(ul, groups, emptyText) {
        ul.textContent = "";
        if (!groups.length) {
          var li0 = el("li"); li0.appendChild(el("p", "empty", emptyText)); ul.appendChild(li0); return;
        }
        groups.forEach(function (g) {
          var li = el("li", "tl");
          li.appendChild(el("span", "node"));
          var d = parseYmd(g.date);
          var head = el("div", "tlhead");
          head.appendChild(el("b", "dnum", pad(d.getDate())));
          head.appendChild(el("span", "dtxt", d.toLocaleDateString("en-AU", { weekday: "long" }) + ", " + d.toLocaleDateString("en-AU", { month: "long" })));
          li.appendChild(head);
          var list = el("div", "evlist");
          if (!g.events.length) list.appendChild(el("p", "empty", emptyText));
          g.events.forEach(function (ev) { list.appendChild(evCard(ev)); });
          li.appendChild(list); ul.appendChild(li);
        });
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

      /* Calendar */
      function renderCalendar() {
        var grid = $("grid"); grid.textContent = "";
        var first = new Date(state.year, state.month, 1);
        var offset = (first.getDay() + 6) % 7;
        var dim = new Date(state.year, state.month + 1, 0).getDate();
        var rows = Math.ceil((offset + dim) / 7);
        $("monthLabel").textContent = first.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
        var byDate = {};
        state.events.forEach(function (e) {
          if (e.status === "declined") return;
          var s = byDate[e.date] || (byDate[e.date] = { acc: 0, pen: 0 });
          if (e.status === "accepted") s.acc++; else s.pen++;
        });
        var t = today();
        for (var i = 0; i < rows * 7; i++) {
          var d = new Date(state.year, state.month, 1 - offset + i);
          var ds = ymd(d), s = byDate[ds];
          var cls = "day" + (d.getMonth() !== state.month ? " out" : "") + (s ? " has" : "") + (ds === t ? " today" : "") + (ds === state.selected ? " sel" : "");
          var b = el("button", cls); b.type = "button";
          b.textContent = String(d.getDate());
          if (ds === state.selected) b.setAttribute("aria-pressed", "true");
          if (s) b.appendChild(el("span", "dot" + (s.acc ? "" : " hollow")));
          b.addEventListener("click", (function (dateStr) {
            return function () {
              state.selected = dateStr;
              var dd = parseYmd(dateStr); state.year = dd.getFullYear(); state.month = dd.getMonth();
              renderCalendar(); renderDayList();
            };
          })(ds));
          grid.appendChild(b);
        }
        var cur = new Date();
        $("todayBtn").hidden = (state.selected === t && state.year === cur.getFullYear() && state.month === cur.getMonth());
      }

      function renderDayList() {
        var evs = state.events.filter(function (e) { return e.date === state.selected; }).sort(cmp);
        buildTimeline($("dayList"), [{ date: state.selected, events: evs }], "Nothing scheduled for this day. Tap + to plan something!");
      }

      function htmlSafe(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; });
      }
      function memoryEvent(eventId) { return state.events.find(function (e) { return e.id === eventId; }); }
      function boothPhotoIds(booth) { return Array.isArray(booth && booth.photoIds) ? booth.photoIds.slice(0, 4) : []; }
      function memoryPhotoUrl(photo) { return photo && (photo.imageUrl || photo.imageData) || ""; }
      function boothPhotoUrl(booth, id) {
        var photo = state.memoryPhotos.find(function (p) { return p.id === id; });
        return memoryPhotoUrl(photo) || (booth && booth.photoSnapshots && booth.photoSnapshots[id]) || "";
      }
      function boothIsFinal(booth) {
        var count = boothPhotoIds(booth).length;
        return count >= 3 && count <= 4;
      }
      function boothStageHeight(ids, availableWidth) {
        var stageWidth = Math.min(560, Math.max(280, availableWidth || window.innerWidth - 48));
        var stripWidth = stageWidth <= 380 ? .32 : .30;
        var frameHeight = (stageWidth * stripWidth - (stageWidth <= 380 ? 12 : 18)) * .75;
        return Math.max(360, Math.ceil(95 + ids.length * (frameHeight + 6)));
      }
      function renderBoothMainCard(ids, booth, event, note, editable) {
        var heroUrl = ids[0] ? boothPhotoUrl(booth, ids[0]) : "";
        var html = '<div class="booth-memory-card"><div class="booth-card-layout"><div class="booth-collage">';
        html += heroUrl ? '<img class="booth-collage-hero" src="' + htmlSafe(heroUrl) + '" alt="Main keepsake photo">' : '<div class="booth-empty-slot booth-collage-hero">Your photo</div>';
        html += '<div class="booth-collage-thumbs">';
        for (var i = 1; i <= 3; i++) {
          var thumbUrl = ids[i] ? boothPhotoUrl(booth, ids[i]) : "";
          html += thumbUrl ? '<img src="' + htmlSafe(thumbUrl) + '" alt="Keepsake photo ' + (i + 1) + '">' : '<span class="booth-empty-thumb" aria-hidden="true"></span>';
        }
        html += '</div></div><div class="booth-card-note"' + (editable ? ' contenteditable="true" role="textbox" aria-multiline="true" aria-label="Write a note for this photo booth" data-placeholder="Write a little note to remember this day…"' : '') + '>' + (editable ? htmlSafe(note || "") : htmlSafe(note || 'A little day to remember.')) + '</div></div><div class="booth-card-footer"><span class="booth-card-title">' + htmlSafe(event.title) + '</span><span class="booth-card-date">' + htmlSafe(longDate(event.date)) + '</span></div></div>';
        return html;
      }
      function renderBoothPreview(event, booth) {
        var ids = boothPhotoIds(booth), height = boothStageHeight(ids, Math.min(560, window.innerWidth * .94));
        var html = '<button type="button" class="mem-booth-preview" data-mem="booth" data-event="' + htmlSafe(event.id) + '" aria-label="Edit photo booth for ' + htmlSafe(event.title) + '"><div class="booth-stage" style="height:' + height + 'px">' + renderBoothMainCard(ids, booth, event, booth.note, false) + '<div class="booth-strip"><div class="booth-strip-photos">';
        ids.forEach(function (id, index) {
          var photoUrl = boothPhotoUrl(booth, id);
          if (photoUrl) html += '<div class="booth-strip-item"><img class="booth-strip-photo" src="' + htmlSafe(photoUrl) + '" alt="Photo booth frame ' + (index + 1) + '"></div>';
        });
        return html + '</div><div class="booth-strip-footer"><span>' + htmlSafe(event.title) + '</span><span>' + htmlSafe(longDate(event.date)) + '</span></div></div></div></button>';
      }
      function beginBooth(eventId, selectedPhotoIds) {
        var saved = state.memoryBooths[eventId] || { eventId: eventId, photoIds: [], note: "", revision: 0, approvals: {} };
        var ids = boothPhotoIds(saved).slice();
        (selectedPhotoIds || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
        if (ids.length > 4) { toast("This booth can hold up to 4 photos. Remove a photo first."); return false; }
        state.memoryEventId = eventId;
        state.memoryDraft = { photoIds: ids, note: saved.note || "" };
        state.memorySelectedPhotoIds = [];
        state.memoryMode = "booth"; renderMemories(); return true;
      }
      function saveBoothDraft() {
        var eventId = state.memoryEventId, draft = state.memoryDraft;
        if (!eventId || !draft) return Promise.resolve();
        if (draft.photoIds.length < 3 || draft.photoIds.length > 4) { toast("Choose 3 or 4 photos for your booth."); return Promise.resolve(); }
        var isNewBooth = !state.memoryBooths[eventId];
        return window.coupleApp.updateMemoryBooth(eventId, function (current) {
          current = current || { eventId: eventId, photoIds: [], note: "", revision: 0, approvals: {} };
          var snapshots = Object.assign({}, current.photoSnapshots || {});
          draft.photoIds.forEach(function (id) { var photo = state.memoryPhotos.find(function (p) { return p.id === id; }); if (photo && memoryPhotoUrl(photo)) snapshots[id] = memoryPhotoUrl(photo); });
          var changed = JSON.stringify(Array.isArray(current.photoIds) ? current.photoIds : []) !== JSON.stringify(draft.photoIds) || (current.note || "") !== draft.note;
          if (!changed && JSON.stringify(snapshots) === JSON.stringify(current.photoSnapshots || {})) return current;
          return { eventId: eventId, photoIds: draft.photoIds.slice(), photoSnapshots: snapshots, note: draft.note.slice(0, 500), revision: (Number(current.revision) || 0) + (changed ? 1 : 0), approvals: changed ? {} : (current.approvals || {}), updatedBy: state.myId || null, updatedAt: Date.now() };
        }).then(function (saved) {
          state.memoryBooths[eventId] = saved;
          state.memoryDraft = { photoIds: boothPhotoIds(saved).slice(), note: saved.note || "" };
          toast(isNewBooth ? "Your photo booth is created and saved 💕" : "Photo booth saved 💕"); renderMemories(); return saved;
        }).catch(function () { toast("Could not save the booth. Check your connection and try again."); });
      }
      var boothDragClickUntil = 0;
      function reorderBoothPhoto(from, to) {
        var ids = state.memoryDraft && state.memoryDraft.photoIds;
        if (!ids || from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to) return;
        var moved = ids.splice(from, 1)[0]; ids.splice(to, 0, moved);
        renderMemories();
      }
      function wireBoothPhotoDrag(root) {
        var strip = root.querySelector(".booth-strip-photos"); if (!strip) return;
        var nativeFrom = -1, pointer = null;
        strip.addEventListener("dragstart", function (event) {
          var item = event.target.closest(".booth-strip-item"); if (!item) return;
          nativeFrom = Number(item.getAttribute("data-booth-index")); item.classList.add("is-dragging");
          if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(nativeFrom)); }
        });
        strip.addEventListener("dragover", function (event) { if (event.target.closest(".booth-strip-item")) event.preventDefault(); });
        strip.addEventListener("drop", function (event) {
          var item = event.target.closest(".booth-strip-item"); if (!item) return;
          event.preventDefault(); reorderBoothPhoto(nativeFrom, Number(item.getAttribute("data-booth-index"))); nativeFrom = -1;
        });
        strip.addEventListener("dragend", function () { nativeFrom = -1; strip.querySelectorAll(".is-dragging").forEach(function (item) { item.classList.remove("is-dragging"); }); });
        strip.addEventListener("pointerdown", function (event) {
          var item = event.target.closest(".booth-strip-item");
          if (!item || event.target.closest("button.booth-photo-delete")) return;
          var index = Number(item.getAttribute("data-booth-index"));
          pointer = { id: event.pointerId, from: index, to: index, x: event.clientX, y: event.clientY, dragging: false };
        });
        strip.addEventListener("pointermove", function (event) {
          if (!pointer || pointer.id !== event.pointerId) return;
          if (!pointer.dragging && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) {
            pointer.dragging = true;
            var origin = strip.querySelector('[data-booth-index="' + pointer.from + '"]'); if (origin) origin.classList.add("is-dragging");
          }
          if (!pointer.dragging) return;
          event.preventDefault();
          strip.querySelectorAll(".is-drop-target").forEach(function (item) { item.classList.remove("is-drop-target"); });
          var target = document.elementFromPoint(event.clientX, event.clientY), item = target && target.closest(".booth-strip-item");
          if (item && strip.contains(item)) { pointer.to = Number(item.getAttribute("data-booth-index")); item.classList.add("is-drop-target"); }
        });
        function finishPointer(event) {
          if (!pointer || pointer.id !== event.pointerId) return;
          var active = pointer; pointer = null;
          strip.querySelectorAll(".is-dragging,.is-drop-target").forEach(function (item) { item.classList.remove("is-dragging", "is-drop-target"); });
          if (active.dragging) { boothDragClickUntil = Date.now() + 400; reorderBoothPhoto(active.from, active.to); }
        }
        strip.addEventListener("pointerup", finishPointer);
        strip.addEventListener("pointercancel", finishPointer);
      }
      function renderMemories() {
        var root = $("memoriesContent"); if (!root) return;
        var pastDateEvents = state.events.filter(function (e) { return e.status === "accepted" && e.date < today(); }).sort(function (a, b) { return b.date.localeCompare(a.date); });
        var boothEvents = state.events.filter(function (e) { return e.status === "accepted" && boothPhotoIds(state.memoryBooths[e.id]).length > 0; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
        var acceptedDates = state.events.filter(function (e) { return e.status === "accepted"; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
        if (state.memoryMode === "dates") {
          $("memSubtitle").textContent = "Past dates are ready for more memories. Swipe through your photo booths.";
          var out = '';
          if (pastDateEvents.length) {
            out += '<h3 class="mem-section-title">Past dates · add photos</h3>';
            pastDateEvents.forEach(function (ev) {
              out += '<article class="mem-card"><div class="mem-past-date"><div><h3>' + htmlSafe(ev.title) + '</h3><p class="mem-hint">' + htmlSafe(longDate(ev.date)) + '</p></div><button class="mem-button primary" data-mem="booth" data-event="' + htmlSafe(ev.id) + '">Add photos</button></div></article>';
            });
          }
          out += '<div class="mem-card"><div class="mem-date"><div><h3>Your shared photo pile</h3><p>' + state.memoryPhotos.length + ' little moments saved so far</p></div><button class="mem-button" data-mem="pile">Open pile</button></div></div>';
          if (boothEvents.length) {
            out += '<h3 class="mem-section-title">Your photo booths</h3><div class="mem-booths-scroll">';
            boothEvents.forEach(function (ev) { out += renderBoothPreview(ev, state.memoryBooths[ev.id]); });
            out += '</div>';
          }
          if (!pastDateEvents.length && !boothEvents.length) out += '<div class="mem-card mem-empty">Your accepted dates will show up here after they happen. ✨</div>';
          root.innerHTML = out; return;
        }
        if (state.memoryMode === "pile") {
          $("memSubtitle").textContent = "A shared, happily messy pile of photos from your days together.";
          var hasBoothDraft = !!(state.memoryEventId && state.memoryDraft);
          var pile = '<div class="mem-actions"><button class="mem-button" data-mem="' + (hasBoothDraft ? 'booth-return' : 'back') + '">← ' + (hasBoothDraft ? 'Photo booth' : 'Dates') + '</button><button class="mem-button primary" type="button" data-mem="choose-pile-photos">Add photos</button>';
          if (hasBoothDraft) pile += '<button class="mem-button" data-mem="add-selected">Add selected to booth (' + state.memorySelectedPhotoIds.length + ')</button>';
          else pile += '<button class="mem-button" data-mem="create-booth" ' + (state.memorySelectedPhotoIds.length < 3 ? 'disabled' : '') + '>Create photo booth</button>';
          pile += '</div>';
          if (!state.memoryPhotos.length) pile += '<div class="mem-card mem-empty">Your photo pile is waiting for its first little moment. 📷</div>';
          else {
            var pileWidth = Math.max(200, root.clientWidth - 36), columns = Math.max(2, Math.floor((pileWidth + 12) / 112));
            var rowsVisible = Math.max(1, Math.floor((window.innerHeight * .6 - 32 + 12) / 128));
            var crowded = state.memoryPhotos.length > columns * rowsVisible;
            pile += '<div class="mem-pile' + (crowded ? ' is-crowded' : '') + '">';
            state.memoryPhotos.forEach(function (photo, i) {
              var selected = state.memorySelectedPhotoIds.indexOf(photo.id) >= 0;
              pile += '<div class="pile-item' + (selected ? ' is-selected' : '') + '" style="--tilt:' + ((i % 5) - 2) * 2 + 'deg;z-index:' + (i + 1) + '"><button type="button" class="pile-photo' + (selected ? ' is-selected' : '') + '" data-mem="toggle-photo" data-photo-id="' + htmlSafe(photo.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '" aria-label="' + (selected ? 'Deselect' : 'Select') + ' photo ' + (i + 1) + '"><img src="' + htmlSafe(memoryPhotoUrl(photo)) + '" alt="A shared memory photo"></button><button type="button" class="pile-delete"' + (selected ? '' : ' hidden') + ' data-mem="delete-photo" data-photo-id="' + htmlSafe(photo.id) + '" aria-label="Delete photo ' + (i + 1) + '" title="Delete photo">×</button></div>';
            });
            pile += '</div><p class="mem-hint">Select 3–4 photos to make your photo booth · ' + state.memorySelectedPhotoIds.length + ' selected</p>';
          }
          root.innerHTML = pile;
          return;
        }
        if (state.memoryMode === "choose-date") {
          $("memSubtitle").textContent = "Choose the date to create your photo booth for.";
          var chooseDate = '<div class="mem-actions"><button class="mem-button" data-mem="pile">← Photo pile</button></div>';
          if (!acceptedDates.length) chooseDate += '<div class="mem-card mem-empty">Accept a date first, then you can save a photo booth for it. ✨</div>';
          acceptedDates.forEach(function (ev) {
            var saved = state.memoryBooths[ev.id], count = boothPhotoIds(saved).length;
            chooseDate += '<article class="mem-card"><div class="mem-date"><div><h3>' + htmlSafe(ev.title) + '</h3><p>' + htmlSafe(longDate(ev.date)) + (count ? ' · ' + count + ' photos already' : '') + '</p></div><button class="mem-button primary" data-mem="select-event" data-event="' + htmlSafe(ev.id) + '">Create booth for this date</button></div></article>';
          });
          root.innerHTML = chooseDate; return;
        }
        var ev = memoryEvent(state.memoryEventId);
        if (!ev) { state.memoryMode = "dates"; renderMemories(); return; }
        var savedBooth = state.memoryBooths[ev.id] || { revision: 0, approvals: {} };
        var draft = state.memoryDraft || { photoIds: boothPhotoIds(savedBooth).slice(), note: savedBooth.note || "" };
        var ids = draft.photoIds;
        $("memSubtitle").textContent = htmlSafe(ev.title) + ' · ' + longDate(ev.date);
        var editor = '<div class="mem-actions"><button class="mem-button" data-mem="back">← Dates</button><button class="mem-button" data-mem="pile">Open photo pile</button></div>';
        editor += '<p class="mem-hint">Drag the frames to rearrange your photo booth.</p>';
        var stageHeight = boothStageHeight(ids, root.clientWidth);
        editor += '<div class="booth-stage" style="height:' + stageHeight + 'px">' + renderBoothMainCard(ids, savedBooth, ev, draft.note, true) + '<div class="booth-strip"><div class="booth-strip-photos">';
        ids.forEach(function (id, index) {
          var photoUrl = boothPhotoUrl(savedBooth, id);
          if (photoUrl) editor += '<div class="booth-strip-item' + (state.memorySelectedBoothPhotoId === id ? ' is-selected' : '') + '" data-booth-index="' + index + '" draggable="true"><button type="button" class="booth-photo-pick" data-mem="booth-select-photo" data-photo-id="' + htmlSafe(id) + '" aria-label="Select photo ' + (index + 1) + '"><img class="booth-strip-photo" src="' + htmlSafe(photoUrl) + '" alt="Photo booth frame ' + (index + 1) + '"></button><button type="button" class="booth-photo-delete"' + (state.memorySelectedBoothPhotoId === id ? '' : ' hidden') + ' data-mem="remove" data-index="' + index + '" aria-label="Remove photo ' + (index + 1) + ' from booth">×</button></div>';
        });
        editor += '</div><div class="booth-strip-footer"><span>' + htmlSafe(ev.title) + '</span><span>' + htmlSafe(longDate(ev.date)) + '</span></div></div></div>';
        editor += '<div class="mem-actions"><button class="mem-button" type="button" data-mem="choose-booth-photos">Add a photo</button><button class="mem-button primary" data-mem="save">Save booth</button></div>';
        if (ids.length < 3 || ids.length > 4) editor += '<p class="mem-hint">Pick ' + Math.max(0, 3 - ids.length) + ' more photo' + (3 - ids.length === 1 ? '' : 's') + ' to make your booth.</p>';
        editor += '<div class="mem-card"><strong>' + (ids.length >= 3 && ids.length <= 4 ? 'Your photo booth is ready ✨' : 'Finish your photo booth') + '</strong><p class="mem-hint">Your booth is saved and available from the Memories list.</p>';
        editor += '<div class="mem-actions">' + (ids.length >= 3 && ids.length <= 4 ? '<button class="mem-button primary" data-mem="export">Export photo booth</button>' : '<button class="mem-button" disabled>Choose 3 or 4 photos to finish</button>') + '</div></div>';
        root.innerHTML = editor;
        var noteInput = root.querySelector('.booth-card-note[contenteditable="true"]');
        noteInput.addEventListener("input", function () {
          if (!state.memoryDraft) return;
          var value = (noteInput.innerText || "").replace(/\n+$/, "").slice(0, 500);
          if (value !== noteInput.innerText.replace(/\n+$/, "")) noteInput.textContent = value;
          state.memoryDraft.note = value;
        });
        wireBoothPhotoDrag(root);
      }

      function compressedMemoryImage(file, onReady, onError) {
        readProfilePhoto(file, function (data) {
          var img = new Image();
          img.onload = function () {
            try {
              var scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
              var canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
              canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
              canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
              onReady(canvas.toDataURL("image/jpeg", 0.85));
            } catch (e) { onError("Could not prepare that photo. Try another image."); }
          };
          img.onerror = function () { onError("Could not read that photo."); };
          img.src = data;
        }, onError);
      }
      function wireMemoryUpload(input, addToBooth) {
        if (!input) return;
        input.addEventListener("change", function () {
          var files = input.files;
          if (files && files.length) uploadMemoryFiles(files, addToBooth);
          input.value = "";
        });
      }
      function uploadMemoryFiles(files, addToBooth) {
        var selected = Array.prototype.slice.call(files || []);
        var list = selected.filter(function (f) { return /^image\//i.test(f.type) || /\.(heic|heif)$/i.test(f.name || ""); });
        if (!list.length) { if (selected.length) toast("Choose a JPG, PNG, HEIC, or HEIF photo."); return; }
        if (addToBooth && state.memoryDraft && state.memoryDraft.photoIds.length + list.length > 4) { toast("A booth can hold up to 4 photos."); return; }
        var index = 0, uploaded = 0;
        showSyncIndicator("Preparing photos…");
        function next() {
          if (index >= list.length) {
            hideSyncIndicator();
            if (uploaded) { toast(uploaded === 1 ? "Photo added to your shared pile 📷" : uploaded + " photos added to your shared pile 📷"); renderMemories(); }
            return;
          }
          var file = list[index++];
          showSyncIndicator("Preparing photo " + index + " of " + list.length + "…");
          compressedMemoryImage(file, function (imageData) {
            showSyncIndicator("Saving photo " + index + " of " + list.length + "…");
            window.coupleApp.saveMemoryPhoto(imageData, state.myId).then(function (result) {
              uploaded++;
              if (addToBooth && state.memoryDraft && state.memoryDraft.photoIds.length < 4) state.memoryDraft.photoIds.push(result.id);
              next();
            }).catch(function (err) {
              hideSyncIndicator();
              console.error("Memory photo upload failed:", err);
              var code = err && err.code || "", stage = err && err.memoryStage || "Photo upload";
              var detail = (err && (err.serverResponse || err.message)) || code;
              if (err && err.message === "firebase-unavailable") toast("Firebase did not connect, so this photo was not saved to the cloud.");
              else if (code === "PERMISSION_DENIED" || code === "database/permission-denied") toast("Realtime Database blocked the photo save. Check write access under /memories.");
              else toast(stage + " failed" + (code ? " (" + code + ")" : (detail ? ": " + detail : ". Check Firebase settings.")));
            });
          }, function (message) { hideSyncIndicator(); toast(message); next(); });
        }
        next();
      }
      function removeMemoryPhotoFromPile(photoId, askFirst) {
        var photo = state.memoryPhotos.find(function (p) { return p.id === photoId; });
        if (!photo || (askFirst && !window.confirm("Delete this photo from your shared pile? This also removes it from Firebase."))) return Promise.resolve(false);
        showSyncIndicator("Removing photo…");
        var backups = Object.keys(state.memoryBooths).filter(function (id) { return boothPhotoIds(state.memoryBooths[id]).indexOf(photoId) >= 0; });
        return backups.reduce(function (chain, eventId) {
          return chain.then(function () {
            return window.coupleApp.updateMemoryBooth(eventId, function (booth) {
              if (!booth || !boothPhotoIds(booth).includes(photoId)) return booth;
              booth.photoSnapshots = Object.assign({}, booth.photoSnapshots || {});
              if (!booth.photoSnapshots[photoId]) booth.photoSnapshots[photoId] = memoryPhotoUrl(photo);
              return booth;
            }).then(function (saved) { state.memoryBooths[eventId] = saved; });
          });
        }, Promise.resolve()).then(function () {
          return state.memPhotoCol.doc(photoId).delete();
        }).then(function () {
          state.memoryPhotos = state.memoryPhotos.filter(function (p) { return p.id !== photoId; });
          state.memorySelectedPhotoIds = state.memorySelectedPhotoIds.filter(function (id) { return id !== photoId; });
          hideSyncIndicator(); if (askFirst) toast("Photo removed from your shared pile."); renderMemories(); return true;
        }).catch(function (error) {
          hideSyncIndicator(); console.error("Memory photo delete failed:", error);
          toast("Could not delete the photo. Check Firebase write access and try again.");
          return false;
        });
      }
      function deleteMemoryPhoto(photoId) { return removeMemoryPhotoFromPile(photoId, true); }
      function exportBooth() {
        var event = memoryEvent(state.memoryEventId), booth = state.memoryBooths[state.memoryEventId];
        if (!event || !boothIsFinal(booth)) { toast("Choose 3 or 4 photos for your booth first."); return; }
        var photos = boothPhotoIds(booth).map(function (id) { return boothPhotoUrl(booth, id); }).filter(Boolean);
        var canvas = document.createElement("canvas"), width = 900, pad = 54, gap = 20, top = 104, noteH = 170;
        var columns = 1, rows = photos.length;
        var photoW = width - pad * 2, photoH = photoW * .75;
        canvas.width = width; canvas.height = top + rows * photoH + (rows - 1) * gap + noteH;
        var ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, canvas.height);
        ctx.fillStyle = "#49383e"; ctx.textAlign = "center"; ctx.font = "bold 27px Georgia,serif"; ctx.fillText(event.title, width / 2, 58, width - 80);
        function drawPhoto(i) {
          if (i >= photos.length) {
            var noteY = top + rows * photoH + (rows - 1) * gap + 44;
            ctx.strokeStyle = "#eadfe2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad, noteY - 26); ctx.lineTo(width - pad, noteY - 26); ctx.stroke();
            ctx.fillStyle = "#5a454d"; ctx.textAlign = "center"; ctx.font = "italic 27px Georgia,serif";
            var words = (booth.note || "A little day to keep forever.").split(/\s+/), line = "", lines = [], maxWidth = width - pad * 2;
            words.forEach(function (word) { var test = line ? line + " " + word : word; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test; }); if (line) lines.push(line);
            lines.slice(0, 3).forEach(function (t, j) { ctx.fillText(t, width / 2, noteY + j * 38); });
            canvas.toBlob(function (blob) {
              if (!blob) { toast("Could not create the booth image."); return; }
              var file = new File([blob], "our-photo-booth.png", { type: "image/png" });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: event.title + " photo booth" }).catch(function () {});
              else { var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "our-photo-booth.png"; link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000); }
            }, "image/png");
            return;
          }
          var image = new Image(); image.onload = function () {
            var x = pad, y = top + i * (photoH + gap), targetRatio = photoW / photoH, sourceRatio = image.naturalWidth / image.naturalHeight;
            var sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
            if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
            else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
            ctx.fillStyle = "#fff"; ctx.fillRect(x - 9, y - 9, photoW + 18, photoH + 18);
            ctx.drawImage(image, sx, sy, sw, sh, x, y, photoW, photoH); drawPhoto(i + 1);
          };
          image.onerror = function () { toast("Could not load a photo for export. Try refreshing your memories."); drawPhoto(i + 1); }; image.src = photos[i];
        }
        drawPhoto(0);
      }

      function render() {
        renderGreeting();
        renderCountdown();
        renderCouple();
        renderUpcoming();
        renderCalendar();
        renderDayList();
        if (state.tab === "mem") renderMemories();
        if (state.detailId) renderDetail();
        if (!$("sheetSetup").hidden) renderSetup();
      }

      function setTab(name) {
        state.tab = name;
        $("viewHome").hidden = name !== "home";
        $("viewCal").hidden = name !== "cal";
        $("viewMemories").hidden = name !== "mem";
        $("addWrap").hidden = (name !== "cal");
        $("tabHome").setAttribute("aria-current", name === "home" ? "page" : "false");
        $("tabCal").setAttribute("aria-current", name === "cal" ? "page" : "false");
        $("tabMem").setAttribute("aria-current", name === "mem" ? "page" : "false");
        $("barTitle").textContent = name === "home" ? "Couple Calendar" : (name === "mem" ? "Memories" : "Calendar");
        if (name === "mem") renderMemories();
        window.scrollTo(0, 0);
      }

      /* Sheets */
      var SHEETS = ["sheetProfile", "sheetEvent", "sheetDetail", "sheetSetup"];
      function hideAll() { SHEETS.forEach(function (i) { $(i).hidden = true; }); $("scrim").hidden = true; }
      function closeSheets() {
        // The "who are you?" screen can't be dismissed until this phone has a locked identity.
        if (!$("sheetSetup").hidden && !window.coupleApp.isClaimed()) return;
        hideAll(); state.detailId = null; state.editingId = null; document.body.style.overflow = "";
      }
      function showSheet(id) { hideAll(); $("scrim").hidden = false; $(id).hidden = false; document.body.style.overflow = "hidden"; $(id).scrollTop = 0; }

      /* Profile sheet */
      function pfError(msg) { var e = $("pfErr"); e.textContent = msg || ""; e.hidden = !msg; }
      var heicConverterPromise = null;
      function convertHeicToJpeg(file) {
        if (!heicConverterPromise) {
          heicConverterPromise = new Promise(function (resolve, reject) {
            if (typeof window.heic2any === "function") { resolve(window.heic2any); return; }
            var script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
            script.onload = function () {
              if (typeof window.heic2any === "function") resolve(window.heic2any);
              else reject(new Error("HEIC converter unavailable"));
            };
            script.onerror = function () { reject(new Error("HEIC converter could not be loaded")); };
            document.head.appendChild(script);
          });
        }
        return heicConverterPromise.then(function (convert) {
          return convert({ blob: file, toType: "image/jpeg", quality: 0.9 });
        }).then(function (result) {
          return Array.isArray(result) ? result[0] : result;
        });
      }
      function readProfilePhoto(file, onReady, onError) {
        var isHeic = /\.(heic|heif)$/i.test(file.name || "") || /image\/(heic|heif)/i.test(file.type || "");
        var sourcePromise = isHeic ? convertHeicToJpeg(file) : Promise.resolve(file);
        sourcePromise.then(function (source) {
          var reader = new FileReader();
          reader.onload = function (evt) { onReady(evt.target.result); };
          reader.onerror = function () { onError("Could not read file from device."); };
          reader.readAsDataURL(source);
        }).catch(function () {
          onError(isHeic ? "Could not convert this HEIC photo. Try saving it as JPEG and choose it again." : "Could not read image file.");
        });
      }
      function paintPf(k) {
        var prev = $("pfPrev" + k);
        var file = $("pfFile" + k);
        prev.textContent = "";
        var p = state.draft[k], s = el("span", "avatar");
        if (p.img) { var im = document.createElement("img"); im.alt = ""; im.src = p.img; s.appendChild(im); } else { s.innerHTML = ICON.user; }
        prev.appendChild(s);
        var cam = el("span", "cam"); cam.innerHTML = ICON.cam; prev.appendChild(cam);
        prev.appendChild(file);
        $("pfRemove" + k).hidden = !p.img;
      }

      function buildProfileBlocks() {
        var wrap = $("pfBlocks"); wrap.textContent = "";
        PK.forEach(function (k) {
          var blk = el("div", "pfblock");
          var prev = el("label", "pfphoto"); prev.id = "pfPrev" + k;
          prev.setAttribute("aria-label", "Choose photo for " + (k === "a" ? "Reejan" : "Shreya"));

          var file = document.createElement("input");
          file.type = "file"; file.accept = "image/*,.heic,.heif"; file.id = "pfFile" + k;
          file.addEventListener("change", function () {
            var f = file.files && file.files[0];
            if (!f) return;
            pfError("");
            readProfilePhoto(f, function (imageData) {
              var img = new Image();
              img.onload = function () {
                try {
                  var s = Math.min(img.naturalWidth, img.naturalHeight);
                  var c = document.createElement("canvas");
                  c.width = 200; c.height = 200;
                  var ctx = c.getContext("2d");
                  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 200, 200);
                  state.draft[k].img = c.toDataURL("image/jpeg", 0.8);
                  paintPf(k);
                  toast("Photo updated! Tap Save Profile to confirm.");
                } catch (e) { pfError("Could not crop photo. Try another image."); }
              };
              img.onerror = function () { pfError("Could not read image file."); };
              img.src = imageData;
            }, pfError);
          });
          prev.appendChild(file);

          var right = el("div", "pfright");
          var fl = el("label", "flabel", k === "a" ? "Reejan" : "Shreya"); fl.setAttribute("for", "pfName" + k);
          var inp = document.createElement("input");
          inp.type = "text"; inp.id = "pfName" + k; inp.maxLength = 30; inp.placeholder = "Name"; inp.autocomplete = "off";
          inp.addEventListener("input", function () { state.draft[k].name = inp.value; });
          var rm = el("button", "linkbtn", "Remove photo"); rm.type = "button"; rm.id = "pfRemove" + k;
          rm.addEventListener("click", function () { state.draft[k].img = ""; paintPf(k); });
          right.appendChild(fl); right.appendChild(inp); right.appendChild(rm);
          blk.appendChild(prev); blk.appendChild(right);
          wrap.appendChild(blk);
        });
      }

      function openProfile() {
        if (!state.myId) return;
        state.draft = { a: { name: state.profile.a.name, img: state.profile.a.img }, b: { name: state.profile.b.name, img: state.profile.b.img } };
        PK.forEach(function (k) {
          $("pfName" + k).value = state.draft[k].name;
          paintPf(k);
        });
        pfError("");
        showSheet("sheetProfile");
      }

      async function saveProfile() {
        if (!state.profRef || state.saving) return;
        state.saving = true; $("pfSave").disabled = true; pfError("");
        var body = {};
        PK.forEach(function (k) { body[k] = { name: state.draft[k].name.trim().slice(0, 30), img: state.draft[k].img || "" }; });
        try {
          if (state.profileExists) await state.profRef.update(body); else await state.profRef.set(body);
          closeSheets(); toast("Profile saved! 💕");
        } catch (e) { pfError("Could not save. Please try again."); }
        finally { state.saving = false; $("pfSave").disabled = false; }
      }

      /* Plan / edit form */
      function fErr(msg) { var e = $("fErr"); e.textContent = msg || ""; e.hidden = !msg; }
      function syncAllDay() { $("timeRowWrapper").hidden = $("fAllDay").checked; }

      function openEvForm(ev, defaultDate) {
        if (!state.myId) return;
        if (ev && !canManage(ev)) { toast("Only the person who asked can edit this date."); return; }
        state.editingId = ev ? ev.id : null;
        $("evFormTitle").textContent = ev ? "Edit Date 💕" : "Plan a Date 💕";
        $("fTitle").value = ev ? ev.title : "";
        $("fTitle").className = "";
        $("fDate").value = ev ? ev.date : (defaultDate || state.selected || today());
        $("fDate").className = "";
        $("fAllDay").checked = ev ? !!ev.allDay : false;
        $("fStart").value = ev ? (ev.start || "") : "19:00";
        $("fEnd").value = ev ? (ev.end || "") : "21:30";
        $("fNote").value = ev ? (ev.note || "") : "";
        $("fSave").textContent = ev ? "Save & Ask Again 💕" : ("Ask " + getPartnerName() + " 💕");
        fErr(""); syncAllDay();
        showSheet("sheetEvent");
        setTimeout(function () { $("fTitle").focus(); }, 150);
      }

      $("titleChips").addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        $("fTitle").value = chip.getAttribute("data-title");
        $("fTitle").className = "";
        fErr("");
      });

      $("dateChips").addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        var d = new Date();
        if (chip.hasAttribute("data-days")) {
          d.setDate(d.getDate() + Number(chip.getAttribute("data-days")));
        } else if (chip.getAttribute("data-dayname") === "Fri") {
          var diff = (5 - d.getDay() + 7) % 7 || 7;
          d.setDate(d.getDate() + diff);
        } else if (chip.getAttribute("data-dayname") === "Sat") {
          var diff2 = (6 - d.getDay() + 7) % 7 || 7;
          d.setDate(d.getDate() + diff2);
        }
        $("fDate").value = ymd(d);
        $("fDate").className = "";
        fErr("");
      });

      $("timeChips").addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        $("fAllDay").checked = false;
        syncAllDay();
        $("fStart").value = chip.getAttribute("data-start");
        $("fEnd").value = chip.getAttribute("data-end");
      });

      async function saveEvent(e) {
        e.preventDefault();
        if (state.saving || !state.evCol || !state.myId) return;
        var title = $("fTitle").value.trim();
        var date = $("fDate").value;
        var allDay = $("fAllDay").checked;
        var start = allDay ? "" : $("fStart").value;
        var end = allDay ? "" : $("fEnd").value;
        var note = $("fNote").value.trim();

        if (!title) {
          $("fTitle").className = "invalid"; $("fTitle").focus();
          return fErr("Please give your date a name 💕");
        }
        $("fTitle").className = "";

        if (!date || !DATE_RE.test(date)) {
          $("fDate").className = "invalid"; $("fDate").focus();
          return fErr("Please pick a date for your plan");
        }
        $("fDate").className = "";

        if (!allDay && start && end && start === end) {
          return fErr("Start time and end time cannot be identical.");
        }

        if (state.editingId) {
          var existing = findEv(state.editingId);
          if (!existing || !canManage(existing)) return fErr("You can't edit this date.");
        }

        state.saving = true; $("fSave").disabled = true; fErr("");
        try {
          var f = { title: title, date: date, allDay: allDay, start: start, end: end, note: note };
          if (state.editingId) {
            // Editing re-asks your partner: you become the asker, they must accept again.
            f.by = state.myId; f.status = "pending"; f.answeredBy = null;
            await state.evCol.doc(state.editingId).update(f);
          } else {
            f.by = state.myId; f.status = "pending"; f.created = Date.now();
            await state.evCol.add(f);
          }
          var dd = parseYmd(date);
          state.selected = date; state.year = dd.getFullYear(); state.month = dd.getMonth();
          closeSheets(); setTab("home"); render();
          toast("Date invitation sent to " + getPartnerName() + "! 💕");
        } catch (err) {
          fErr("Could not save date. Please check your connection.");
        } finally { state.saving = false; $("fSave").disabled = false; }
      }

      /* Answer / cancel / detail */
      async function answer(id, status) {
        if (!state.evCol) return;
        var ev = findEv(id);
        if (!ev || !canAnswer(ev)) { toast("Only " + getPartnerName() + " can answer this one."); return; }
        try {
          await state.evCol.doc(id).update({ status: status, answeredBy: state.myId, answeredAt: Date.now() });
          closeSheets();
          toast(status === "accepted" ? "Accepted! It's a date! 💕" : "Date declined");
        } catch (e) { toast("Could not update date. Please try again."); }
      }

      async function removeEvent(id) {
        var ev = findEv(id);
        if (!ev || !canManage(ev)) { toast("You can't cancel this date."); return; }
        try {
          await state.evCol.doc(id).delete();
          closeSheets();
          toast("Date cancelled");
        } catch (e) { toast("Could not cancel that date."); }
      }

      function findEv(id) { return state.events.filter(function (e) { return e.id === id; })[0]; }

      function openDetail(id) {
        if (!state.myId) return;
        state.detailId = id;
        $("dtConfirm").hidden = true;
        renderDetail();
        if (state.detailId) showSheet("sheetDetail");
      }

      function renderDetail() {
        var ev = findEv(state.detailId);
        if (!ev) { if (!$("sheetDetail").hidden) closeSheets(); state.detailId = null; return; }

        $("dtTitle").textContent = ev.title;
        var pill = $("dtPill");
        pill.className = "pill " + ev.status;
        var banner = $("dtPersonalBanner");
        var incoming = canAnswer(ev);

        if (ev.status === "accepted") {
          pill.textContent = "Accepted 💕";
          banner.textContent = acceptedDateMessage(ev);
        } else if (ev.status === "pending") {
          if (incoming) {
            pill.textContent = "New Date Proposal 💌";
            banner.textContent = "💌 " + getPartnerName() + " wants to take you on this date!";
          } else {
            pill.textContent = "Waiting for " + getPartnerName();
            banner.textContent = "✨ You asked " + getPartnerName() + ". Waiting for them to say yes!";
          }
        } else {
          pill.textContent = "Declined";
          banner.textContent = "This date was declined.";
        }

        $("dtWhen").textContent = longDate(ev.date) + ", " + timeText(ev);
        var note = $("dtNote");
        note.textContent = ev.note || "";
        note.hidden = !ev.note;

        var manage = canManage(ev);
        if (!manage) $("dtConfirm").hidden = true;          // never leave a cancel prompt up on a date you can't cancel
        $("dtAnswer").hidden = !incoming;                   // Accept / Decline: only the person who was asked
        $("dtActions").hidden = !manage || !$("dtConfirm").hidden; // Edit / Cancel: only the asker (or both once accepted)
      }

      /* ---------- Who are you? (locks this phone) ---------- */
      var setupSel = null;
      var SETUP = [
        { uid: "u_you", card: "setupCardB", av: "setupAvB", nm: "setupNameB", sub: "setupSubB", key: "b", def: "Shreya" },
        { uid: "u_her", card: "setupCardA", av: "setupAvA", nm: "setupNameA", sub: "setupSubA", key: "a", def: "Reejan" }
      ];
      function setupErr(msg) { var e = $("setupErr"); e.textContent = msg || ""; e.hidden = !msg; }

      function renderSetup() {
        var c = window.coupleApp.getClaims();
        var status = window.coupleApp.getStatus();
        var free = 0;
        SETUP.forEach(function (s) {
          var taken = !!c[s.uid];
          if (!taken) free++;
          if (taken && setupSel === s.uid) setupSel = null;
          var card = $(s.card);
          card.className = "setup-card" + (taken ? " taken" : "") + (setupSel === s.uid ? " selected" : "");
          card.disabled = taken;
          card.querySelector(".setup-badge").textContent = taken ? "TAKEN" : "SELECTED";
          var name = nameOf(s.key, s.def);
          $(s.nm).textContent = name;
          $(s.sub).textContent = taken ? "Already chosen on another phone" : "I am " + name;
          $(s.av).innerHTML = avatarNode(s.key).innerHTML;
        });
        var msg = $("setupMsg"), btn = $("btnConfirmSetup");
        if (status !== "ok") {
          msg.textContent = "Can't reach the server right now. Check your connection and reload.";
        } else if (free === 0) {
          msg.textContent = "Both spots are already taken. This calendar is for two people only.";
        } else {
          msg.textContent = "Who is using this phone? Once you confirm, this phone is locked to you and nobody else can pick your spot.";
        }
        btn.disabled = status !== "ok" || free === 0 || !setupSel;
      }

      function showSetupModal() {
        setupSel = null;
        setupErr("");
        renderSetup();
        showSheet("sheetSetup");
      }

      SETUP.forEach(function (s) {
        $(s.card).addEventListener("click", function () {
          if ($(s.card).disabled) return;
          setupSel = s.uid; setupErr(""); renderSetup();
        });
      });
      $("btnConfirmSetup").addEventListener("click", function () {
        if (!setupSel) return;
        $("btnConfirmSetup").disabled = true; setupErr("");
        window.coupleApp.claimDevice(setupSel).catch(function (e) {
          var m = e && e.message;
          setupErr(m === "taken" ? "Sorry, that spot was just taken on another phone." : "Couldn't lock your spot. Check your connection and try again.");
          renderSetup();
        });
      });
      window.coupleApp.onClaims(function () { if (!$("sheetSetup").hidden) renderSetup(); });
      window.coupleApp.onSyncError(function (m) { toast(m); if (state.tab === "mem") renderMemories(); });

      /* Wiring */
      document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-close]")) closeSheets(); });
      $("scrim").addEventListener("click", closeSheets);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheets(); });

      $("gear").addEventListener("click", openProfile);
      $("personA").addEventListener("click", openProfile);
      $("personB").addEventListener("click", openProfile);
      $("pfSave").addEventListener("click", saveProfile);

      wireMemoryUpload($("memoryUpload"), false);
      wireMemoryUpload($("boothAddPhoto"), true);
      var pullStartY = null, pullDistance = 0, refreshRunning = false;
      var memoriesView = $("viewMemories");
      function refreshMemories() {
        if (refreshRunning) return;
        refreshRunning = true;
        showSyncIndicator("Refreshing shared memories…");
        window.coupleApp.refresh().then(function () {
          hideSyncIndicator();
          if (window.coupleApp.getSyncStatus().mode === "local") toast("Memories refreshed on this device.");
        }).catch(function (error) {
          hideSyncIndicator();
          toast(error && error.message === "firebase-unavailable" ? "Could not refresh. Firebase is offline." : "Could not refresh shared memories. Check your connection.");
        }).finally(function () { refreshRunning = false; });
      }
      memoriesView.addEventListener("touchstart", function (event) {
        if (state.tab !== "mem" || refreshRunning || window.scrollY > 0) return;
        pullStartY = event.touches[0].clientY;
        pullDistance = 0;
      }, { passive: true });
      memoriesView.addEventListener("touchmove", function (event) {
        if (pullStartY === null || state.tab !== "mem") return;
        pullDistance = Math.max(0, event.touches[0].clientY - pullStartY);
        if (pullDistance < 12) return;
        event.preventDefault();
        showSyncIndicator(pullDistance >= 64 ? "Release to refresh…" : "Pull to refresh…");
      }, { passive: false });
      memoriesView.addEventListener("touchend", function () {
        if (pullStartY === null) return;
        var shouldRefresh = pullDistance >= 64;
        pullStartY = null; pullDistance = 0;
        if (shouldRefresh) refreshMemories(); else hideSyncIndicator();
      }, { passive: true });
      memoriesView.addEventListener("touchcancel", function () { pullStartY = null; pullDistance = 0; hideSyncIndicator(); }, { passive: true });

      $("tabHome").addEventListener("click", function () { setTab("home"); });
      $("tabCal").addEventListener("click", function () { setTab("cal"); });
      $("tabMem").addEventListener("click", function () { setTab("mem"); });
      $("seeCal").addEventListener("click", function () { setTab("cal"); });
      $("memoriesContent").addEventListener("click", function (event) {
        var button = event.target.closest("[data-mem]"); if (!button) return;
        var action = button.getAttribute("data-mem"), eventId = button.getAttribute("data-event");
        if (action === "booth-select-photo" && Date.now() < boothDragClickUntil) return;
        if (action === "pile") { state.memorySelectedPhotoIds = []; state.memoryMode = "pile"; renderMemories(); }
        else if (action === "back") { state.memoryMode = "dates"; state.memoryEventId = null; state.memoryDraft = null; state.memorySelectedPhotoIds = []; renderMemories(); }
        else if (action === "booth-return") { state.memoryMode = "booth"; renderMemories(); }
        else if (action === "choose-pile-photos") $("memoryUpload").click();
        else if (action === "choose-booth-photos") $("boothAddPhoto").click();
        else if (action === "toggle-photo") {
          var photoId = button.getAttribute("data-photo-id"), selectedAt = state.memorySelectedPhotoIds.indexOf(photoId);
          if (selectedAt >= 0) state.memorySelectedPhotoIds.splice(selectedAt, 1);
          else if ((state.memoryDraft && state.memoryDraft.photoIds.indexOf(photoId) >= 0) || (state.memoryDraft ? state.memoryDraft.photoIds.length : 0) + state.memorySelectedPhotoIds.filter(function (id) { return !state.memoryDraft || state.memoryDraft.photoIds.indexOf(id) < 0; }).length < 4) state.memorySelectedPhotoIds.push(photoId);
          else { toast("A booth can hold up to 4 photos. Remove one in the booth first."); return; }
          renderMemories();
        }
        else if (action === "booth-select-photo") {
          var boothPhotoId = button.getAttribute("data-photo-id");
          state.memorySelectedBoothPhotoId = state.memorySelectedBoothPhotoId === boothPhotoId ? null : boothPhotoId;
          renderMemories();
        }
        else if (action === "add-selected") {
          var selectedIds = state.memoryDraft.photoIds.slice();
          state.memorySelectedPhotoIds.forEach(function (id) { if (selectedIds.indexOf(id) < 0) selectedIds.push(id); });
          if (selectedIds.length > 4) { toast("A booth can hold up to 4 photos."); return; }
          state.memoryDraft.photoIds = selectedIds; state.memorySelectedPhotoIds = []; state.memoryMode = "booth"; renderMemories();
        }
        else if (action === "create-booth") {
          if (state.memorySelectedPhotoIds.length < 3 || state.memorySelectedPhotoIds.length > 4) { toast("Select 3 or 4 photos first."); return; }
          state.memoryMode = "choose-date"; renderMemories();
        }
        else if (action === "select-event") {
          var photoIdsToMove = state.memorySelectedPhotoIds.slice();
          if (beginBooth(eventId, photoIdsToMove)) saveBoothDraft().then(function (saved) {
            if (!saved || !boothIsFinal(saved)) return false;
            return photoIdsToMove.reduce(function (chain, photoId) {
              return chain.then(function (ok) { return ok ? removeMemoryPhotoFromPile(photoId, false) : false; });
            }, Promise.resolve(true));
          }).then(function (removed) { if (removed) toast("Your booth is saved, and its photos are out of the pile ✨"); });
        }
        else if (action === "delete-photo") {
          deleteMemoryPhoto(button.getAttribute("data-photo-id"));
        }
        else if (action === "booth") beginBooth(eventId);
        else if (action === "move" || action === "remove") {
          var at = Number(button.getAttribute("data-index"));
          if (action === "remove") { state.memoryDraft.photoIds.splice(at, 1); state.memorySelectedBoothPhotoId = null; }
          else { var to = at + Number(button.getAttribute("data-dir")); if (to >= 0 && to < state.memoryDraft.photoIds.length) { var swap = state.memoryDraft.photoIds[at]; state.memoryDraft.photoIds[at] = state.memoryDraft.photoIds[to]; state.memoryDraft.photoIds[to] = swap; } }
          renderMemories();
        } else if (action === "save") saveBoothDraft();
        else if (action === "export") {
          if (!state.memoryDraft || state.memoryDraft.photoIds.length < 3 || state.memoryDraft.photoIds.length > 4) { toast("Choose 3 or 4 photos for your booth."); return; }
          saveBoothDraft().then(exportBooth);
        }
      });
      $("cdPlan").addEventListener("click", function (e) { e.stopPropagation(); openEvForm(null, today()); });

      function tapCountdown() { if (state.nextId) openDetail(state.nextId); else openEvForm(null, today()); }
      $("countCard").addEventListener("click", tapCountdown);
      $("countCard").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapCountdown(); } });

      $("addBtn").addEventListener("click", function () { openEvForm(null, state.selected); });
      $("fAllDay").addEventListener("change", syncAllDay);
      $("evForm").addEventListener("submit", saveEvent);
      $("prev").addEventListener("click", function () { var d = new Date(state.year, state.month - 1, 1); state.year = d.getFullYear(); state.month = d.getMonth(); renderCalendar(); });
      $("next").addEventListener("click", function () { var d = new Date(state.year, state.month + 1, 1); state.year = d.getFullYear(); state.month = d.getMonth(); renderCalendar(); });
      $("todayBtn").addEventListener("click", function () { var n = new Date(); state.year = n.getFullYear(); state.month = n.getMonth(); state.selected = ymd(n); renderCalendar(); renderDayList(); });

      $("dtAccept").addEventListener("click", function () { answer(state.detailId, "accepted"); });
      $("dtDecline").addEventListener("click", function () { answer(state.detailId, "declined"); });
      $("dtEdit").addEventListener("click", function () { var ev = findEv(state.detailId); if (ev) openEvForm(ev); });
      $("dtDelete").addEventListener("click", function () {
        var ev = findEv(state.detailId);
        if (!ev || !canManage(ev)) return;
        $("dtConfirm").hidden = false; $("dtActions").hidden = true;
      });
      $("dtDeleteNo").addEventListener("click", function () { $("dtConfirm").hidden = true; renderDetail(); });
      $("dtDeleteYes").addEventListener("click", function () { if (state.detailId) removeEvent(state.detailId); });

      buildProfileBlocks();
      setTab("home");
      initTheme();

      async function start() {
        var api = window.claude && window.claude.use ? window.claude : null;
        var db = null, user = null;
        if (api) {
          try { db = await api.use("db"); } catch (e) { db = null; }
          try { user = await api.use("user"); } catch (e) { user = null; }
        }
        if (!db) return;

        // Wait for the cloud claims, then confirm this phone's locked identity.
        try { await window.coupleApp.ready(); } catch (e) { }
        if (user) { try { state.myId = await user.id(); } catch (e) { } }

        state.evCol = db.collection("events");
        state.profRef = db.doc("couple/profile");
        state.memPhotoCol = db.collection("memories/photos");
        state.memBoothCol = db.collection("memories/booths");
        render();

        state.profRef.onSnapshot(function (snap) {
          state.profileExists = snap.exists;
          var d = snap.exists ? (snap.data() || {}) : {};
          state.profile = { a: cleanP(d.a), b: cleanP(d.b) };
          render();
        });

        state.evCol.onSnapshot(function (snap) {
          state.events = snap.docs.map(function (d) {
            var o = d.data() || {};
            return {
              id: d.id, title: typeof o.title === "string" ? o.title : "", date: typeof o.date === "string" ? o.date : "",
              allDay: !!o.allDay, start: typeof o.start === "string" ? o.start : "", end: typeof o.end === "string" ? o.end : "",
              note: typeof o.note === "string" ? o.note : "", by: typeof o.by === "string" ? o.by : null,
              status: o.status === "accepted" || o.status === "declined" ? o.status : "pending"
            };
          }).filter(function (e) { return e.title && DATE_RE.test(e.date); });
          render();
        });
        state.memPhotoCol.onSnapshot(function (snap) {
          state.memoryPhotos = snap.docs.map(function (d) { var o = d.data() || {}; return { id: d.id, imageData: typeof o.imageData === "string" ? o.imageData : "", imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : "", storagePath: o.storagePath || "", createdBy: o.createdBy || null, createdAt: Number(o.createdAt) || 0 }; }).filter(function (p) { return !!memoryPhotoUrl(p); }).sort(function (a, b) { return a.createdAt - b.createdAt; });
          if (state.tab === "mem") renderMemories();
        });
        state.memBoothCol.onSnapshot(function (snap) {
          state.memoryBooths = {};
          snap.docs.forEach(function (d) { state.memoryBooths[d.id] = d.data() || {}; });
          if (state.tab === "mem" && state.memoryMode !== "booth") renderMemories();
        });

        if (!window.coupleApp.isClaimed()) setTimeout(showSetupModal, 100);
      }

      start();
    })();
