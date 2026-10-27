(function (global) {
  "use strict";

  global.CoupleCalendarPages = global.CoupleCalendarPages || {};
  global.CoupleCalendarPages.createMemoriesPage = function (ctx) {
    var state = ctx.state, $ = ctx.$, today = ctx.today, longDate = ctx.longDate, pad = ctx.pad;
    var toast = ctx.toast, showSyncIndicator = ctx.showSyncIndicator, hideSyncIndicator = ctx.hideSyncIndicator;
    var readProfilePhoto = ctx.readProfilePhoto;

      function htmlSafe(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; });
      }
      function memoryEvent(eventId) { return state.events.find(function (e) { return e.id === eventId; }); }
      function boothEvent(boothId, booth) {
        booth = booth || state.memoryBooths[boothId] || {};
        return memoryEvent(booth.eventId || boothId) || { id: boothId, title: booth.title || "A little memory", date: booth.date || "", standalone: true };
      }
      function boothDateLabel(event) { return event.date ? longDate(event.date) : ""; }
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
        var stripHeight = 95 + ids.length * (frameHeight + 6);
        return Math.ceil(Math.max(280, stripHeight) + 18);
      }
      function renderBoothMainCard(ids, booth, event, note, editable, title) {
        var heroUrl = ids[0] ? boothPhotoUrl(booth, ids[0]) : "";
        title = title || booth.title || event.title || "A little memory";
        var thumbCount = Math.min(3, Math.max(0, ids.length - 1));
        var html = '<div class="booth-memory-card"><div class="booth-card-layout"><div class="booth-collage">';
        if (heroUrl) html += '<img class="booth-collage-hero" src="' + htmlSafe(heroUrl) + '" alt="Main keepsake photo">';
        html += '<div class="booth-collage-thumbs' + (thumbCount === 3 ? ' has-three' : '') + '">';
        for (var i = 1; i <= thumbCount; i++) {
          var thumbUrl = boothPhotoUrl(booth, ids[i]);
          if (thumbUrl) html += '<img src="' + htmlSafe(thumbUrl) + '" alt="Keepsake photo ' + (i + 1) + '">';
        }
        html += '</div></div><div class="booth-card-note"' + (editable ? ' contenteditable="true" role="textbox" aria-multiline="true" aria-label="Write a note for this photo booth" data-placeholder="Write a little note to remember this day…"' : '') + '>' + (editable ? htmlSafe(note || "") : htmlSafe(note || 'A little day to remember.')) + '</div></div><div class="booth-card-footer"><span class="booth-card-title"' + (editable ? ' contenteditable="true" role="textbox" aria-label="Photo booth title" data-booth-title' : '') + '>' + htmlSafe(title) + '</span>' + (event.date ? '<span class="booth-card-date">' + htmlSafe(boothDateLabel(event)) + '</span>' : '') + '</div></div>';
        return html;
      }
      function renderBoothPreview(event, booth) {
        var ids = boothPhotoIds(booth), stageWidth = Math.min(560, window.innerWidth * .94);
        var height = boothStageHeight(ids, stageWidth);
        var boothId = booth.boothId || booth.eventId || event.id;
        var displayTitle = booth.title || event.title;
        var html = '<button type="button" class="mem-booth-preview" data-mem="booth" data-event="' + htmlSafe(boothId) + '" aria-label="Edit photo booth for ' + htmlSafe(displayTitle) + '"><div class="booth-stage" style="height:' + height + 'px">' + renderBoothMainCard(ids, booth, event, booth.note, false, displayTitle) + '<div class="booth-strip"><div class="booth-strip-photos">';
        ids.forEach(function (id, index) {
          var photoUrl = boothPhotoUrl(booth, id);
          if (photoUrl) html += '<div class="booth-strip-item"><img class="booth-strip-photo" src="' + htmlSafe(photoUrl) + '" alt="Photo booth frame ' + (index + 1) + '"></div>';
        });
        return html + '</div><div class="booth-strip-footer"><span>' + htmlSafe(displayTitle) + '</span>' + (event.date ? '<span>' + htmlSafe(boothDateLabel(event)) + '</span>' : '') + '</div></div></div></button>';
      }
      function beginBooth(eventId, selectedPhotoIds, standalone) {
        var saved = state.memoryBooths[eventId] || { eventId: standalone ? null : eventId, boothId: eventId, title: undefined, photoIds: [], note: "", revision: 0, approvals: {} };
        var linkedEvent = memoryEvent(saved.eventId || eventId);
        var defaultTitle = saved.title || (standalone ? "A little memory" : (linkedEvent && linkedEvent.title) || "A little memory");
        var ids = boothPhotoIds(saved).slice();
        (selectedPhotoIds || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
        if (ids.length > 4) { toast("This booth can hold up to 4 photos. Remove a photo first."); return false; }
        state.memoryEventId = eventId;
        state.memoryDraft = { photoIds: ids, note: saved.note || "", eventId: saved.eventId, title: defaultTitle };
        state.memoryPendingPhotoIds = [];
        state.memorySelectedPhotoIds = [];
        state.memoryMode = "booth"; renderMemories(); return true;
      }
      function saveBoothDraft() {
        var eventId = state.memoryEventId, draft = state.memoryDraft;
        if (!eventId || !draft) return Promise.resolve();
        if (draft.photoIds.length < 3 || draft.photoIds.length > 4) { toast("Choose 3 or 4 photos for your booth."); return Promise.resolve(); }
        var isNewBooth = !state.memoryBooths[eventId] || !boothIsFinal(state.memoryBooths[eventId]);
        return window.coupleApp.updateMemoryBooth(eventId, function (current) {
          current = current || state.memoryBooths[eventId] || { boothId: eventId, eventId: draft.eventId === undefined ? eventId : draft.eventId, title: draft.title || "A little memory", photoIds: [], note: "", revision: 0, approvals: {} };
          var snapshots = Object.assign({}, current.photoSnapshots || {});
          draft.photoIds.forEach(function (id) { var photo = state.memoryPhotos.find(function (p) { return p.id === id; }); if (photo && memoryPhotoUrl(photo)) snapshots[id] = memoryPhotoUrl(photo); });
          var boothTitle = (draft.title || "A little memory").slice(0, 80);
          var changed = JSON.stringify(Array.isArray(current.photoIds) ? current.photoIds : []) !== JSON.stringify(draft.photoIds) || (current.note || "") !== draft.note || (current.title || "") !== boothTitle;
          if (!changed && JSON.stringify(snapshots) === JSON.stringify(current.photoSnapshots || {})) return current;
          return Object.assign({}, current, { boothId: eventId, eventId: current.eventId === undefined ? (draft.eventId === undefined ? eventId : draft.eventId) : current.eventId, title: boothTitle, photoIds: draft.photoIds.slice(), photoSnapshots: snapshots, note: draft.note.slice(0, 500), revision: (Number(current.revision) || 0) + (changed ? 1 : 0), approvals: changed ? {} : (current.approvals || {}), updatedBy: state.myId || null, updatedAt: Date.now() });
        }).then(function (saved) {
          state.memoryBooths[eventId] = saved;
          state.memoryDraft = { photoIds: boothPhotoIds(saved).slice(), note: saved.note || "", eventId: saved.eventId, title: saved.title || "A little memory" };
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
        var boothEntries = Object.keys(state.memoryBooths).map(function (id) { var booth = state.memoryBooths[id]; return { id: id, booth: booth, event: boothEvent(id, booth) }; }).filter(function (entry) { return boothPhotoIds(entry.booth).length > 0; }).sort(function (a, b) { return (b.event.date || "").localeCompare(a.event.date || "") || (Number(b.booth.updatedAt) || 0) - (Number(a.booth.updatedAt) || 0); });
        var acceptedDates = state.events.filter(function (e) { return e.status === "accepted"; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
        var completedDates = acceptedDates.filter(function (e) { return e.date < today(); });
        var boothDateOptions = completedDates;
        if (state.memoryMode === "dates") {
          $("memSubtitle").textContent = "Your shared photo pile and photo booths live here.";
          var out = '';
          out += '<div class="mem-card"><div class="mem-date"><div><h3>Your shared photo pile</h3><p>' + state.memoryPhotos.length + ' little moments saved so far</p></div><button class="mem-button" data-mem="pile">Open pile</button></div></div>';
          if (boothEntries.length) {
            out += '<h3 class="mem-section-title">Your photo booths</h3><div class="mem-booths-scroll">';
            boothEntries.forEach(function (entry) { entry.booth.boothId = entry.id; out += renderBoothPreview(entry.event, entry.booth); });
            out += '</div>';
          } else {
            out += '<div class="mem-card mem-empty">Add a few photos to your pile, then make a photo booth for a past date or keep it standalone until a date is ready. ✨</div>';
          }
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
        if (state.memoryMode === "choose-date" || state.memoryMode === "link-date") {
          var linkingStandalone = state.memoryMode === "link-date";
          $("memSubtitle").textContent = linkingStandalone ? "Link this photo booth to a past date." : "Choose a past date or make a standalone photo booth.";
          var chooseDate = '<div class="mem-actions"><button class="mem-button" data-mem="' + (linkingStandalone ? 'booth-return' : 'pile') + '">← ' + (linkingStandalone ? 'Photo booth' : 'Photo pile') + '</button>';
          if (!linkingStandalone) chooseDate += '<button class="mem-button primary" data-mem="create-standalone">Make a standalone photo booth</button>';
          chooseDate += '</div>';
          if (!boothDateOptions.length) chooseDate += '<div class="mem-card mem-empty">No past dates yet. You can make a standalone booth and link it to a date later. ✨</div>';
          else chooseDate += '<h3 class="mem-section-title">Choose a past date</h3>';
          boothDateOptions.forEach(function (ev) {
            var saved = state.memoryBooths[ev.id], count = boothPhotoIds(saved).length;
            chooseDate += '<article class="mem-card"><div class="mem-date"><div><h3>' + htmlSafe(ev.title) + '</h3><p>' + htmlSafe(longDate(ev.date)) + (count ? ' · ' + count + ' photos already' : '') + '</p></div><button class="mem-button primary" data-mem="' + (linkingStandalone ? 'link-booth-date' : 'select-event') + '" data-event="' + htmlSafe(ev.id) + '">' + (linkingStandalone ? 'Link to this date' : 'Create booth for this date') + '</button></div></article>';
          });
          root.innerHTML = chooseDate; return;
        }
        var ev = boothEvent(state.memoryEventId, state.memoryBooths[state.memoryEventId] || state.memoryDraft);
        if (!state.memoryEventId) { state.memoryMode = "dates"; renderMemories(); return; }
        var savedBooth = state.memoryBooths[state.memoryEventId] || { boothId: state.memoryEventId, eventId: state.memoryDraft && state.memoryDraft.eventId, title: state.memoryDraft && state.memoryDraft.title, photoIds: [], photoSnapshots: {}, revision: 0, approvals: {} };
        var draft = state.memoryDraft || { photoIds: boothPhotoIds(savedBooth).slice(), note: savedBooth.note || "" };
        var ids = draft.photoIds;
        $("memSubtitle").textContent = htmlSafe(ev.title) + (ev.date ? ' · ' + longDate(ev.date) : ' · Standalone photo booth');
        var editor = '<div class="mem-actions"><button class="mem-button" data-mem="back">← Dates</button><button class="mem-button" data-mem="pile">Open photo pile</button></div>';
        editor += '<p class="mem-hint">Drag the frames to rearrange your photo booth.</p>';
        var stageWidth = root.clientWidth, stageHeight = boothStageHeight(ids, stageWidth);
        editor += '<div class="booth-stage" style="height:' + stageHeight + 'px">' + renderBoothMainCard(ids, savedBooth, ev, draft.note, true, draft.title || ev.title) + '<div class="booth-strip"><div class="booth-strip-photos">';
        ids.forEach(function (id, index) {
          var photoUrl = boothPhotoUrl(savedBooth, id);
          if (photoUrl) editor += '<div class="booth-strip-item' + (state.memorySelectedBoothPhotoId === id ? ' is-selected' : '') + '" data-booth-index="' + index + '" draggable="true"><button type="button" class="booth-photo-pick" data-mem="booth-select-photo" data-photo-id="' + htmlSafe(id) + '" aria-label="Select photo ' + (index + 1) + '"><img class="booth-strip-photo" src="' + htmlSafe(photoUrl) + '" alt="Photo booth frame ' + (index + 1) + '"></button><button type="button" class="booth-photo-delete"' + (state.memorySelectedBoothPhotoId === id ? '' : ' hidden') + ' data-mem="remove" data-index="' + index + '" aria-label="Remove photo ' + (index + 1) + ' from booth">×</button></div>';
        });
        editor += '</div><div class="booth-strip-footer"><span>' + htmlSafe(draft.title || ev.title) + (ev.date ? '</span><span>' + htmlSafe(boothDateLabel(ev)) : '') + '</span></div></div></div>';
        editor += '<div class="mem-actions"><button class="mem-button" type="button" data-mem="choose-booth-photos">Add a photo</button>' + (!ev.date ? '<button class="mem-button" data-mem="start-link-date">Link a past date</button>' : '') + '<button class="mem-button primary" data-mem="save">Save booth</button></div>';
        if (ids.length < 3 || ids.length > 4) editor += '<p class="mem-hint">Pick ' + Math.max(0, 3 - ids.length) + ' more photo' + (3 - ids.length === 1 ? '' : 's') + ' to make your booth.</p>';
        var isSavedDraft = !!state.memoryBooths[state.memoryEventId] && JSON.stringify(boothPhotoIds(state.memoryBooths[state.memoryEventId])) === JSON.stringify(ids) && (state.memoryBooths[state.memoryEventId].note || "") === (draft.note || "") && (state.memoryBooths[state.memoryEventId].title || ev.title) === (draft.title || ev.title);
        editor += '<div class="mem-card"><strong>' + (ids.length >= 3 && ids.length <= 4 ? (isSavedDraft ? 'Your photo booth is ready ✨' : 'Your photo booth is ready to save ✨') : 'Finish your photo booth') + '</strong><p class="mem-hint">' + (isSavedDraft ? 'Your booth is saved and available from the Memories list.' : 'It will be added to Memories when you save it.') + '</p>';
        editor += '<div class="mem-actions">' + (ids.length >= 3 && ids.length <= 4 ? '<button class="mem-button primary" data-mem="export">Export photo booth</button>' : '<button class="mem-button" disabled>Choose 3 or 4 photos to finish</button>') + '</div></div>';
        root.innerHTML = editor;
        var noteInput = root.querySelector('.booth-card-note[contenteditable="true"]');
        noteInput.addEventListener("input", function () {
          if (!state.memoryDraft) return;
          var value = (noteInput.innerText || "").replace(/\n+$/, "").slice(0, 500);
          if (value !== noteInput.innerText.replace(/\n+$/, "")) noteInput.textContent = value;
          state.memoryDraft.note = value;
        });
        var titleInput = root.querySelector('[data-booth-title]');
        titleInput.addEventListener("keydown", function (event) { if (event.key === "Enter") event.preventDefault(); });
        titleInput.addEventListener("input", function () {
          if (!state.memoryDraft) return;
          var value = (titleInput.innerText || "").replace(/[\r\n]+/g, " ").slice(0, 80);
          if (value !== titleInput.innerText) titleInput.textContent = value;
          state.memoryDraft.title = value;
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
              if (addToBooth && state.memoryDraft && state.memoryDraft.photoIds.length < 4) {
                state.memoryDraft.photoIds.push(result.id);
                if (state.memoryPendingPhotoIds.indexOf(result.id) < 0) state.memoryPendingPhotoIds.push(result.id);
              }
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
        var booth = state.memoryBooths[state.memoryEventId], event = boothEvent(state.memoryEventId, booth);
        if (!boothIsFinal(booth)) { toast("Choose 3 or 4 photos for your booth first."); return; }
        var photos = boothPhotoIds(booth).map(function (id) { return boothPhotoUrl(booth, id); }).filter(Boolean);
        var canvas = document.createElement("canvas"), width = 900, pad = 54, gap = 20, top = 104, noteH = 170;
        var columns = 1, rows = photos.length;
        var photoW = width - pad * 2, photoH = photoW * .75;
        canvas.width = width; canvas.height = top + rows * photoH + (rows - 1) * gap + noteH;
        var ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, canvas.height);
        ctx.fillStyle = "#49383e"; ctx.textAlign = "center"; ctx.font = "bold 27px Georgia,serif"; ctx.fillText(booth.title || event.title, width / 2, 58, width - 80);
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
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: (booth.title || event.title) + " photo booth" }).catch(function () {});
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


    return {
      boothPhotoIds: boothPhotoIds,
      memoryPhotoUrl: memoryPhotoUrl,
      boothIsFinal: boothIsFinal,
      renderMemories: renderMemories,
      wireMemoryUpload: wireMemoryUpload,
      beginBooth: beginBooth,
      saveBoothDraft: saveBoothDraft,
      removeMemoryPhotoFromPile: removeMemoryPhotoFromPile,
      deleteMemoryPhoto: deleteMemoryPhoto,
      exportBooth: exportBooth,
      isBoothDragClickSuppressed: function () { return Date.now() < boothDragClickUntil; }
    };
  };
})(window);
