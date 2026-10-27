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

      var homePage = window.CoupleCalendarPages.createHomePage({
        $: $, state: state, today: today, parseYmd: parseYmd, fmtTime: fmtTime, timeText: timeText,
        cmp: cmp, acceptedDateMessage: acceptedDateMessage, PK: PK, canAnswer: canAnswer,
        getPartnerName: getPartnerName, getMyName: getMyName, avatarNode: avatarNode, el: el, pad: pad,
        buildTimeline: buildTimeline, openDetail: openDetail, answer: answer
      });
      var calendarPage = window.CoupleCalendarPages.createCalendarPage({
        $: $, state: state, el: el, today: today, ymd: ymd, parseYmd: parseYmd, cmp: cmp, buildTimeline: buildTimeline
      });
      var memoriesPage = window.CoupleCalendarPages.createMemoriesPage({
        $: $, state: state, today: today, longDate: longDate, pad: pad, toast: toast,
        showSyncIndicator: showSyncIndicator, hideSyncIndicator: hideSyncIndicator, readProfilePhoto: readProfilePhoto
      });
      var renderGreeting = homePage.renderGreeting, renderCountdown = homePage.renderCountdown;
      var renderCouple = homePage.renderCouple, renderUpcoming = homePage.renderUpcoming;
      var renderCalendar = calendarPage.renderCalendar, renderDayList = calendarPage.renderDayList;
      var boothPhotoIds = memoriesPage.boothPhotoIds, memoryPhotoUrl = memoriesPage.memoryPhotoUrl;
      var boothIsFinal = memoriesPage.boothIsFinal, renderMemories = memoriesPage.renderMemories;
      var wireMemoryUpload = memoriesPage.wireMemoryUpload, beginBooth = memoriesPage.beginBooth;
      var saveBoothDraft = memoriesPage.saveBoothDraft, removeMemoryPhotoFromPile = memoriesPage.removeMemoryPhotoFromPile;
      var deleteMemoryPhoto = memoriesPage.deleteMemoryPhoto, exportBooth = memoriesPage.exportBooth;


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

      /* Event card */
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
          g.events.forEach(function (ev) { list.appendChild(homePage.evCard(ev)); });
          li.appendChild(list); ul.appendChild(li);
        });
      }

      /* Calendar */
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
        try { sessionStorage.setItem("couple_calendar_active_tab", name); } catch (e) { }
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
      var appShell = $("app");
      function refreshSharedData() {
        if (refreshRunning) return;
        refreshRunning = true;
        showSyncIndicator("Refreshing shared plans…");
        window.coupleApp.refresh().then(function () {
          hideSyncIndicator();
          if (window.coupleApp.getSyncStatus().mode === "local") toast("Data refreshed on this device.");
        }).catch(function (error) {
          hideSyncIndicator();
          toast(error && error.message === "firebase-unavailable" ? "Could not refresh. Firebase is offline." : "Could not refresh shared data. Check your connection.");
        }).finally(function () { refreshRunning = false; });
      }
      appShell.addEventListener("touchstart", function (event) {
        if (refreshRunning || window.scrollY > 0 || !event.touches.length) return;
        if (event.target.closest("button,a,input,textarea,select,[contenteditable=\"true\"],.booth-strip-photos")) return;
        var innerScroller = event.target.closest(".mem-pile,.mem-booths-scroll");
        if (innerScroller && innerScroller.scrollTop > 0) return;
        pullStartY = event.touches[0].clientY;
        pullDistance = 0;
      }, { passive: true });
      appShell.addEventListener("touchmove", function (event) {
        if (pullStartY === null || !event.touches.length) return;
        if (window.scrollY > 0) { pullStartY = null; pullDistance = 0; hideSyncIndicator(); return; }
        pullDistance = Math.max(0, event.touches[0].clientY - pullStartY);
        if (pullDistance < 12) return;
        event.preventDefault();
        showSyncIndicator(pullDistance >= 64 ? "Release to refresh…" : "Pull to refresh…");
      }, { passive: false });
      appShell.addEventListener("touchend", function () {
        if (pullStartY === null) return;
        var shouldRefresh = pullDistance >= 64;
        pullStartY = null; pullDistance = 0;
        if (shouldRefresh) refreshSharedData(); else hideSyncIndicator();
      }, { passive: true });
      appShell.addEventListener("touchcancel", function () { pullStartY = null; pullDistance = 0; hideSyncIndicator(); }, { passive: true });

      $("tabHome").addEventListener("click", function () { setTab("home"); });
      $("tabCal").addEventListener("click", function () { setTab("cal"); });
      $("tabMem").addEventListener("click", function () { setTab("mem"); });
      $("seeCal").addEventListener("click", function () { setTab("cal"); });
      $("memoriesContent").addEventListener("click", function (event) {
        var button = event.target.closest("[data-mem]"); if (!button) return;
        var action = button.getAttribute("data-mem"), eventId = button.getAttribute("data-event");
        if (action === "booth-select-photo" && memoriesPage.isBoothDragClickSuppressed()) return;
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
      var savedTab = null;
      try { savedTab = sessionStorage.getItem("couple_calendar_active_tab"); } catch (e) { }
      setTab(savedTab === "cal" || savedTab === "mem" ? savedTab : "home");
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
