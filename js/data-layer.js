    (function () {
      "use strict";

      var USER_A = "u_her";  // Reejan
      var USER_B = "u_you";  // Shreya

      function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
      function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
      function safeDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

      // Every phone/browser gets a permanent random id. A "spot" (Reejan or Shreya) is claimed by this id.
      var deviceId = safeGet("couple_device_id");
      if (!deviceId) {
        deviceId = "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        safeSet("couple_device_id", deviceId);
      }

      var myUserId = safeGet("couple_device_user");
      if (myUserId !== USER_A && myUserId !== USER_B) myUserId = null;

      var defaultStore = {
        "couple/profile": {
          a: { name: "Reejan", img: "" },
          b: { name: "Shreya", img: "" }
        },
        "couple/claims": {}
      };

      var LOCAL_KEY = "couple_calendar_store_clean_v2";
      function loadLocalStore() {
        try {
          var raw = localStorage.getItem(LOCAL_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            Object.keys(parsed).forEach(function (k) {
              if (["events/e1", "events/e2", "events/e3", "events/e4", "events/e5", "events/e6"].indexOf(k) >= 0) delete parsed[k];
            });
            return parsed;
          }
        } catch (e) { }
        return null;
      }
      function saveLocalStore(s) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch (e) { } }

      var store = loadLocalStore() || defaultStore;
      var subs = [];
      var errSubs = [];
      var lastErrAt = 0;

      function notify() { subs.forEach(function (s) { try { s(); } catch (e) { } }); }
      function emitErr(msg) {
        var now = Date.now();
        if (now - lastErrAt < 4000) return;
        lastErrAt = now;
        errSubs.forEach(function (f) { try { f(msg); } catch (e) { } });
      }

      function merge(a, b) {
        var o = Object.assign({}, a);
        Object.keys(b).forEach(function (k) {
          o[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === "object") ? merge(a[k], b[k]) : b[k];
        });
        return o;
      }

      function withTimeout(p, ms) {
        return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]);
      }
      // Wait for the server, but if the connection is down (write queued offline) don't freeze the UI.
      function settle(p) {
        return Promise.race([p, new Promise(function (res) { setTimeout(res, 8000); })]);
      }

      var channel = null;
      try {
        channel = new BroadcastChannel("couple_calendar_clean_channel");
        channel.onmessage = function (ev) {
          if (ev.data && ev.data.store) {
            store = ev.data.store;
            saveLocalStore(store);
            notifyClaims();
            notify();
          }
        };
      } catch (e) { }

      // ---- claims (who owns which spot) ----
      var claimSubs = [];
      var claimsStatus = "loading"; // loading | ok | error
      var syncMode = "local", syncMessage = "This session is saving on this device only.";
      var readyResolve;
      var readyPromise = new Promise(function (res) { readyResolve = res; });
      function claims() { return store["couple/claims"] || {}; }
      function notifyClaims() { claimSubs.forEach(function (f) { try { f(claims()); } catch (e) { } }); }
      function setStatus(s) {
        claimsStatus = s;
        if (s !== "loading") readyResolve();
        notifyClaims();
      }
      function reportFirebaseError(area, error) {
        syncMode = "error";
        var code = error && (error.code || error.message) || "unknown error";
        syncMessage = area + " failed: " + code + ". Check Firebase rules and connection.";
        console.error("Firebase " + area + " failed:", error);
        emitErr(syncMessage);
      }

      // ---- Firebase ----
      var fbDb = null;
      var isFirebaseActive = false;
      if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.firebase) {
        try {
          var config = Object.assign({}, window.FIREBASE_CONFIG);
          if (!config.databaseURL && config.projectId) {
            config.databaseURL = "https://" + config.projectId + "-default-rtdb.firebaseio.com";
          }
          if (!firebase.apps.length) firebase.initializeApp(config);
          fbDb = firebase.database();
          isFirebaseActive = true;
          syncMode = "connecting"; syncMessage = "Connecting to Firebase…";

          fbDb.ref("couple/profile").on("value", function (snap) {
            var val = snap.val();
            if (val) {
              store["couple/profile"] = val;
              saveLocalStore(store);
              notify();
            } else {
              fbDb.ref("couple/profile").set(defaultStore["couple/profile"]).catch(function (error) { reportFirebaseError("profile setup", error); });
            }
            if (val) { syncMode = "cloud"; syncMessage = "Connected to Firebase. Shared data is syncing."; }
          }, function (error) { reportFirebaseError("profile read", error); });

          fbDb.ref("couple/claims").on("value", function (snap) {
            store["couple/claims"] = snap.val() || {};
            saveLocalStore(store);
            syncMode = "cloud"; syncMessage = "Connected to Firebase. Shared data is syncing.";
            setStatus("ok");
            notify();
          }, function (error) {
            setStatus("error");
            reportFirebaseError("database read", error);
          });

          fbDb.ref("events").on("value", function (snap) {
            var val = snap.val();
            Object.keys(store).forEach(function (k) { if (k.indexOf("events/") === 0) delete store[k]; });
            if (val && Object.keys(val).length) {
              Object.keys(val).forEach(function (k) {
                if (["e1", "e2", "e3", "e4", "e5", "e6"].indexOf(k) < 0) store["events/" + k] = val[k];
                else fbDb.ref("events/" + k).remove().catch(function () { });
              });
            }
            saveLocalStore(store);
            notify();
          }, function (error) { reportFirebaseError("dates read", error); });

          fbDb.ref("memories").on("value", function (snap) {
            Object.keys(store).forEach(function (k) { if (k.indexOf("memories/") === 0) delete store[k]; });
            var memories = snap.val() || {};
            ["photos", "booths"].forEach(function (group) {
              var values = memories[group] || {};
              Object.keys(values).forEach(function (id) { store["memories/" + group + "/" + id] = values[id]; });
            });
            saveLocalStore(store);
            notify();
          }, function (error) { reportFirebaseError("memories read", error); });

          setTimeout(function () { if (claimsStatus === "loading") setStatus("error"); }, 6000);
        } catch (e) {
          console.warn("Firebase sync error:", e);
          isFirebaseActive = false;
          syncMode = "error"; syncMessage = "Firebase could not start: " + (e.code || e.message || "check configuration and network");
          setStatus("error");
        }
      } else {
        syncMode = window.FIREBASE_CONFIG ? "error" : "local";
        syncMessage = window.FIREBASE_CONFIG ? "Firebase SDK did not load. Use the hosted app or check the network." : "This session is saving on this device only.";
        setStatus("ok"); // local-only mode
      }

      function mutateSync(action, path, value) {
        if (window.FIREBASE_CONFIG && !isFirebaseActive) return Promise.reject(new Error("firebase-unavailable"));
        saveLocalStore(store);
        if (channel) { try { channel.postMessage({ type: "sync", store: store }); } catch (e) { } }
        if (isFirebaseActive && fbDb) {
          try {
            var r = fbDb.ref(path);
            var write = action === "set" || action === "add" ? r.set(value) : (action === "update" ? r.update(value) : (action === "delete" ? r.remove() : Promise.resolve()));
            return settle(write).then(function (result) { syncMode = "cloud"; syncMessage = "Connected to Firebase. Shared data is syncing."; return result; }).catch(function (error) { reportFirebaseError("database write", error); throw error; });
          } catch (e) { return Promise.reject(e); }
        }
        return Promise.resolve();
      }

      function snapD(p) {
        return { id: p.split("/").pop(), exists: p in store, data: function () { return store[p]; } };
      }

      function docRef(p) {
        return {
          get: function () { return Promise.resolve(snapD(p)); },
          set: function (o) { store[p] = o; var pr = mutateSync("set", p, o); notify(); return pr; },
          update: function (o) { store[p] = merge(store[p] || {}, o); var pr = mutateSync("update", p, o); notify(); return pr; },
          delete: function () { delete store[p]; var pr = mutateSync("delete", p, null); notify(); return pr; },
          onSnapshot: function (fn) {
            var s = function () { fn(snapD(p)); };
            subs.push(s);
            setTimeout(s, 0);
            return function () { var idx = subs.indexOf(s); if (idx >= 0) subs.splice(idx, 1); };
          }
        };
      }

      function refreshFirebaseData() {
        if (!isFirebaseActive || !fbDb) {
          return window.FIREBASE_CONFIG ? Promise.reject(new Error("firebase-unavailable")) : Promise.resolve();
        }
        var paths = ["couple/profile", "couple/claims", "events", "memories"];
        return Promise.all(paths.map(function (path) {
          return withTimeout(fbDb.ref(path).once("value"), 15000);
        })).then(function (snapshots) {
          return snapshots;
        }).catch(function (error) {
          reportFirebaseError("refresh", error);
          throw error;
        });
      }

      function updateMemoryBooth(eventId, updater) {
        var path = "memories/booths/" + eventId;
        if (isFirebaseActive && fbDb) {
          return withTimeout(fbDb.ref(path).transaction(function (current) {
            return updater(current || null);
          }, undefined, false), 15000).then(function (result) {
            if (!result.committed) throw new Error("Booth update was not committed.");
            return result.snapshot.val();
          });
        }
        var next = updater(store[path] || null);
        if (next === null) delete store[path]; else store[path] = next;
        var saved = mutateSync(next === null ? "delete" : "set", path, next);
        notify();
        return saved.then(function () { return next; });
      }

      function saveMemoryPhoto(imageData, createdBy) {
        var record = { imageData: imageData, createdBy: createdBy || null, createdAt: Date.now() };
        if (isFirebaseActive && fbDb) {
          var photoRef = fbDb.ref("memories/photos").push();
          return photoRef.set(record).then(function () {
            var id = photoRef.key;
            store["memories/photos/" + id] = record;
            saveLocalStore(store);
            syncMode = "cloud";
            syncMessage = "Connected to Firebase. Shared data is syncing.";
            notify();
            return { id: id };
          }).catch(function (err) {
            err.memoryStage = "Realtime Database photo save";
            reportFirebaseError(err.memoryStage, err);
            throw err;
          });
        }
        if (window.FIREBASE_CONFIG) return Promise.reject(new Error("firebase-unavailable"));
        return colRef("memories/photos").add(record);
      }

      function colRef(c) {
        return {
          doc: function (id) { return docRef(c + "/" + id); },
          add: function (o) {
            var newId;
            if (isFirebaseActive && fbDb) newId = fbDb.ref(c).push().key;
            else newId = "ev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
            var p = c + "/" + newId;
            store[p] = o;
            var pr = mutateSync("add", p, o);
            notify();
            return pr.then(function () { return { id: newId }; });
          },
          onSnapshot: function (fn) {
            var s = function () {
              var docs = Object.keys(store)
                .filter(function (k) { return k.indexOf(c + "/") === 0; })
                .map(function (k) { return snapD(k); });
              fn({ docs: docs });
            };
            subs.push(s);
            setTimeout(s, 0);
            return function () { var idx = subs.indexOf(s); if (idx >= 0) subs.splice(idx, 1); };
          }
        };
      }

      // ---- locked identity ----
      function setUser(id) { myUserId = id; safeSet("couple_device_user", id); }
      function dropUser() { myUserId = null; safeDel("couple_device_user"); }
      function otherOf(id) { return id === USER_A ? USER_B : USER_A; }

      // Resolves true only if this device now holds the spot. Spots are first-come, first-served and can't be taken over.
      function tryClaim(userId) {
        var c = claims();
        if (c[userId] === deviceId) return Promise.resolve(true);
        if (c[userId]) return Promise.resolve(false);                 // someone else has it
        if (c[otherOf(userId)] === deviceId) return Promise.resolve(false); // this phone already holds the other spot
        if (isFirebaseActive && fbDb) {
          return withTimeout(
            fbDb.ref("couple/claims/" + userId).transaction(function (cur) {
              if (cur === null || cur === undefined) return deviceId;
              return undefined; // abort: already taken
            }, undefined, false), 8000
          ).then(function (res) {
            return !!(res.committed && res.snapshot && res.snapshot.val() === deviceId);
          });
        }
        var upd = {}; upd[userId] = deviceId;
        store["couple/claims"] = merge(store["couple/claims"] || {}, upd);
        mutateSync("local", "", null);
        notifyClaims();
        return Promise.resolve(true);
      }

      // Called once at startup: restore, validate or migrate this phone's identity.
      function reconcile() {
        if (claimsStatus !== "ok") return Promise.resolve(); // can't verify; keep what we have
        var c = claims();
        if (!myUserId) {
          if (c[USER_A] === deviceId) setUser(USER_A);
          else if (c[USER_B] === deviceId) setUser(USER_B);
          return Promise.resolve();
        }
        if (c[myUserId] === deviceId) return Promise.resolve();
        if (!c[myUserId]) { // phone was set up before locking existed: claim it now
          return tryClaim(myUserId).then(function (ok) { if (!ok) dropUser(); }).catch(function () { });
        }
        dropUser(); // spot belongs to a different phone
        return Promise.resolve();
      }

      var userApi = {
        id: function () { return Promise.resolve(myUserId); },
        can: function () { return Promise.resolve(true); }
      };

      window.claude = {
        use: function (name) {
          if (name === "db") return Promise.resolve({ collection: colRef, doc: docRef });
          if (name === "user") return Promise.resolve(userApi);
          return Promise.resolve(null);
        }
      };

      window.coupleApp = {
        USER_A: USER_A,
        USER_B: USER_B,
        isClaimed: function () { return !!myUserId; },
        getClaims: claims,
        getSyncStatus: function () { return { mode: syncMode, message: syncMessage }; },
        getStatus: function () { return claimsStatus; },
        onClaims: function (fn) { claimSubs.push(fn); },
        onSyncError: function (fn) { errSubs.push(fn); },
        ready: function () { return readyPromise.then(reconcile); },
        updateMemoryBooth: updateMemoryBooth,
        saveMemoryPhoto: saveMemoryPhoto,
        refresh: refreshFirebaseData,
        claimDevice: function (userId) {
          if (userId !== USER_A && userId !== USER_B) return Promise.reject(new Error("invalid"));
          if (myUserId && myUserId !== userId) return Promise.reject(new Error("locked"));
          return tryClaim(userId).then(function (ok) {
            if (!ok) throw new Error("taken");
            setUser(userId);
            window.location.reload();
          });
        }
      };
    })();
