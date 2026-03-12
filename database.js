// ============================================================
//  GeoOpportunity AI — Database Module v8
//  Firebase + localStorage + IBGE + Admin + Favorites + Compare
// ============================================================

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDqRjRv-OSVGx5SfxmiIgeR2ljTfwacg1s",
  authDomain: "projeto-prototipagem-1.firebaseapp.com",
  projectId: "projeto-prototipagem-1",
  storageBucket: "projeto-prototipagem-1.firebasestorage.app",
  messagingSenderId: "706875161441",
  appId: "1:706875161441:web:5aded7777da5f2fba42320"
};

var LS = {
  USERS: "geoop_users_v8", SESSION: "geoop_session_v8", ANALYSES: "geoop_analyses_v8",
  COUNT: "geoop_count_v8", PLAN: "geoop_plan_v8", BIZ: "geoop_biz_v8",
  DAILY: "geoop_daily_v8", FAVS: "geoop_favs_v8", NOTES: "geoop_notes_v8",
  COMPARE: "geoop_compare_v8", THEME: "geoop_theme_v8", ONBOARD: "geoop_onboard_v8",
  AI_KEY: "geoop_aikey_v8", STRIPE_KEY: "geoop_stripekey_v8"
};

var PLAN_LIMITS = {
  free: { radius: 1000, results: 5, analysesPerDay: 5, canExport: false, name: "Free" },
  pro: { radius: 5000, results: 25, analysesPerDay: 100, canExport: true, name: "Pro" },
  enterprise: { radius: 10000, results: 50, analysesPerDay: 999999, canExport: true, name: "Enterprise" }
};

var ADMIN_EMAILS = ["admin@geo.com"];

var _fbReady = false, _fbAuth = null, _fbDB = null, _fbUser = null;

function _safeEmail(u) { return (u && typeof u.email === "string") ? u.email.toLowerCase() : ""; }
function _lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; } }
function _lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }

// Firebase Init
(function() {
  try {
    if (typeof firebase !== "undefined" && firebase.initializeApp) {
      if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
      _fbAuth = firebase.auth(); _fbDB = firebase.firestore(); _fbReady = true;
      try { _fbDB.enablePersistence({ synchronizeTabs: true }).catch(function() {}); } catch(e) {}
      _fbAuth.onAuthStateChanged(function(u) { _fbUser = u || null; });
    }
  } catch(e) { _fbReady = false; }
  _seedDemoUser();
})();

function _seedDemoUser() {
  var users = _lsGet(LS.USERS, []);
  if (!Array.isArray(users)) users = [];
  var has = false, hasAdmin = false;
  for (var i = 0; i < users.length; i++) {
    if (_safeEmail(users[i]) === "demo@geo.com") has = true;
    if (_safeEmail(users[i]) === "admin@geo.com") hasAdmin = true;
  }
  if (!has) users.push({ name: "Usuario Demo", email: "demo@geo.com", password: "123456", plan: "free", uid: "demo_001" });
  if (!hasAdmin) users.push({ name: "Administrador", email: "admin@geo.com", password: "admin123", plan: "enterprise", uid: "admin_001" });
  _lsSet(LS.USERS, users);
}

function _localReg(name, email, pass) {
  var users = _lsGet(LS.USERS, []);
  for (var i = 0; i < users.length; i++) { if (_safeEmail(users[i]) === email.toLowerCase()) return { success: false, error: "Email ja cadastrado." }; }
  var u = { name: name, email: email, password: pass, plan: "free", uid: "local_" + Date.now() };
  users.push(u); _lsSet(LS.USERS, users);
  return { success: true, user: u };
}

function _localLogin(email, pass) {
  var users = _lsGet(LS.USERS, []);
  for (var i = 0; i < users.length; i++) {
    if (_safeEmail(users[i]) === email.toLowerCase() && users[i].password === pass)
      return { success: true, user: users[i] };
  }
  return { success: false, error: "Email ou senha incorretos." };
}

function _fbFallback(code) {
  return code === "auth/operation-not-allowed" || code === "auth/configuration-not-found" ||
    code === "auth/internal-error" || code === "auth/network-request-failed" || code === "auth/invalid-api-key";
}

function dbRegister(name, email, pass) {
  return new Promise(function(resolve) {
    if (_fbReady && _fbAuth) {
      try {
        _fbAuth.createUserWithEmailAndPassword(email, pass).then(function(cred) {
          _fbUser = cred.user;
          try { cred.user.updateProfile({ displayName: name }); } catch(e) {}
          if (_fbDB) try { _fbDB.collection("users").doc(cred.user.uid).set({ name: name, email: email, plan: "free", createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function() {}); } catch(e) {}
          _localReg(name, email, pass);
          resolve({ success: true, user: { name: name, email: email, uid: cred.user.uid, plan: "free" } });
        }).catch(function(e) {
          if (_fbFallback(e.code)) { resolve(_localReg(name, email, pass)); return; }
          var m = { "auth/email-already-in-use": "Email ja cadastrado.", "auth/weak-password": "Senha muito fraca.", "auth/invalid-email": "Email invalido." };
          resolve({ success: false, error: m[e.code] || e.message });
        });
      } catch(e) { resolve(_localReg(name, email, pass)); }
    } else { resolve(_localReg(name, email, pass)); }
  });
}

function dbLogin(email, pass) {
  return new Promise(function(resolve) {
    if (_fbReady && _fbAuth) {
      try {
        _fbAuth.signInWithEmailAndPassword(email, pass).then(function(cred) {
          _fbUser = cred.user; var plan = "free";
          if (_fbDB) _fbDB.collection("users").doc(cred.user.uid).get().then(function(doc) {
            if (doc.exists && doc.data().plan) plan = doc.data().plan;
            resolve({ success: true, user: { name: cred.user.displayName || email.split("@")[0], email: cred.user.email, uid: cred.user.uid, plan: plan } });
          }).catch(function() { resolve({ success: true, user: { name: cred.user.displayName || email.split("@")[0], email: cred.user.email, uid: cred.user.uid, plan: "free" } }); });
          else resolve({ success: true, user: { name: cred.user.displayName || email.split("@")[0], email: cred.user.email, uid: cred.user.uid, plan: "free" } });
        }).catch(function(e) {
          if (_fbFallback(e.code)) { resolve(_localLogin(email, pass)); return; }
          if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential" || e.code === "auth/invalid-login-credentials") {
            var local = _localLogin(email, pass); if (local.success) { resolve(local); return; }
          }
          resolve({ success: false, error: "Email ou senha incorretos." });
        });
      } catch(e) { resolve(_localLogin(email, pass)); }
    } else { resolve(_localLogin(email, pass)); }
  });
}

function dbLogout() {
  return new Promise(function(resolve) {
    localStorage.removeItem(LS.SESSION); _fbUser = null;
    if (_fbReady && _fbAuth) _fbAuth.signOut().then(resolve).catch(function() { resolve(); });
    else resolve();
  });
}

function dbSaveSession(u) { _lsSet(LS.SESSION, u); if (u.plan) localStorage.setItem(LS.PLAN, u.plan); }
function dbLoadSession() { var u = _lsGet(LS.SESSION, null); return (u && u.email) ? u : null; }
function dbGetPlan() { return localStorage.getItem(LS.PLAN) || "free"; }
function dbGetPlanLimits() { return PLAN_LIMITS[dbGetPlan()] || PLAN_LIMITS.free; }

function dbSavePlan(plan) {
  localStorage.setItem(LS.PLAN, plan);
  var s = dbLoadSession(); if (s) { s.plan = plan; dbSaveSession(s); }
  var users = _lsGet(LS.USERS, []);
  for (var i = 0; i < users.length; i++) { if (s && _safeEmail(users[i]) === _safeEmail(s)) users[i].plan = plan; }
  _lsSet(LS.USERS, users);
  if (_fbReady && _fbUser && _fbDB) try { _fbDB.collection("users").doc(_fbUser.uid).update({ plan: plan }).catch(function() {}); } catch(e) {}
}

function dbCanAnalyze() {
  var l = dbGetPlanLimits(); if (l.analysesPerDay >= 999999) return true;
  var d = _lsGet(LS.DAILY, {}); var today = new Date().toISOString().slice(0, 10);
  return d.date !== today || (d.count || 0) < l.analysesPerDay;
}

function dbGetDailyRemaining() {
  var l = dbGetPlanLimits(); if (l.analysesPerDay >= 999999) return 9999;
  var d = _lsGet(LS.DAILY, {}); var today = new Date().toISOString().slice(0, 10);
  return d.date !== today ? l.analysesPerDay : Math.max(0, l.analysesPerDay - (d.count || 0));
}

function _incDaily() {
  var d = _lsGet(LS.DAILY, {}); var today = new Date().toISOString().slice(0, 10);
  if (d.date !== today) d = { date: today, count: 0 }; d.count++; _lsSet(LS.DAILY, d);
}

function dbGetAnalysisCount() { return parseInt(localStorage.getItem(LS.COUNT) || "0", 10); }
function dbGetTotalBusinesses() { return parseInt(localStorage.getItem(LS.BIZ) || "0", 10); }
function dbAddBusinesses(n) { localStorage.setItem(LS.BIZ, (dbGetTotalBusinesses() + n).toString()); }

function dbSaveAnalysis(data) {
  return new Promise(function(resolve) {
    var e = { location: data.location || "", state: data.state || "", segmento: data.segmento || "", score: data.score || 0, total: data.total || 0, avgRating: data.avgRating || "", radius: data.radius || 0, timestamp: Date.now(), lat: data.lat, lng: data.lng };
    localStorage.setItem(LS.COUNT, (dbGetAnalysisCount() + 1).toString()); _incDaily();
    var h = _lsGet(LS.ANALYSES, []); if (!Array.isArray(h)) h = []; h.unshift(e); if (h.length > 200) h.length = 200; _lsSet(LS.ANALYSES, h);
    if (_fbReady && _fbUser && _fbDB) {
      try { _fbDB.collection("users").doc(_fbUser.uid).collection("analyses").add(Object.assign({}, e, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })).then(function() { resolve(); }).catch(function() { resolve(); }); }
      catch(ex) { resolve(); }
    } else resolve();
  });
}

function dbLoadHistory(limit) {
  if (!limit) limit = 20;
  return new Promise(function(resolve) {
    if (_fbReady && _fbUser && _fbDB) {
      try { _fbDB.collection("users").doc(_fbUser.uid).collection("analyses").orderBy("createdAt", "desc").limit(limit).get().then(function(snap) {
        var r = []; snap.forEach(function(doc) { var d = doc.data(); r.push(Object.assign({}, d, { id: doc.id })); });
        resolve(r.length > 0 ? r : _lsGet(LS.ANALYSES, []).slice(0, limit));
      }).catch(function() { resolve(_lsGet(LS.ANALYSES, []).slice(0, limit)); }); }
      catch(e) { resolve(_lsGet(LS.ANALYSES, []).slice(0, limit)); }
    } else resolve(_lsGet(LS.ANALYSES, []).slice(0, limit));
  });
}

function dbClearHistory() {
  return new Promise(function(resolve) {
    localStorage.removeItem(LS.ANALYSES); localStorage.setItem(LS.COUNT, "0"); localStorage.setItem(LS.BIZ, "0");
    if (_fbReady && _fbUser && _fbDB) {
      _fbDB.collection("users").doc(_fbUser.uid).collection("analyses").get().then(function(snap) {
        if (snap.empty) { resolve(); return; } var b = _fbDB.batch(); snap.forEach(function(d) { b.delete(d.ref); }); b.commit().then(resolve).catch(resolve);
      }).catch(resolve);
    } else resolve();
  });
}

function dbExportCSV() {
  return new Promise(function(resolve) {
    if (!dbGetPlanLimits().canExport) { resolve({ success: false, error: "Requer plano Pro ou superior." }); return; }
    dbLoadHistory(200).then(function(h) {
      if (!h || h.length === 0) { resolve({ success: false, error: "Nenhuma analise." }); return; }
      var csv = "Local,Estado,Segmento,Score,Negocios,Nota,Raio,Data\n";
      for (var i = 0; i < h.length; i++) {
        var d = h[i]; csv += '"' + (d.location || "") + '","' + (d.state || "") + '","' + (d.segmento || "") + '",' + (d.score || 0) + ',' + (d.total || 0) + ',"' + (d.avgRating || "") + '",' + (d.radius || 0) + ',"' + (d.timestamp ? new Date(d.timestamp).toLocaleDateString("pt-BR") : "") + '"\n';
      }
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "geoopportunity_" + Date.now() + ".csv"; document.body.appendChild(a); a.click();
      setTimeout(function() { document.body.removeChild(a); }, 200);
      resolve({ success: true });
    });
  });
}

// Favorites
function dbGetFavorites() { return _lsGet(LS.FAVS, []); }
function dbAddFavorite(f) { var favs = dbGetFavorites(); favs.unshift(Object.assign({ id: Date.now(), timestamp: Date.now() }, f)); _lsSet(LS.FAVS, favs); }
function dbRemoveFavorite(id) { var favs = dbGetFavorites(); _lsSet(LS.FAVS, favs.filter(function(f) { return f.id !== id; })); }
function dbIsFavorite(lat, lng) { var favs = dbGetFavorites(); for (var i = 0; i < favs.length; i++) { if (Math.abs(favs[i].lat - lat) < 0.001 && Math.abs(favs[i].lng - lng) < 0.001) return true; } return false; }

// Notes
function dbGetNotes() { return _lsGet(LS.NOTES, []); }
function dbAddNote(note) { var n = dbGetNotes(); n.unshift(Object.assign({ id: Date.now(), timestamp: Date.now() }, note)); _lsSet(LS.NOTES, n); }
function dbDeleteNote(id) { var n = dbGetNotes(); _lsSet(LS.NOTES, n.filter(function(x) { return x.id !== id; })); }

// Compare
function dbGetCompareSlots() { return _lsGet(LS.COMPARE, []); }
function dbAddCompareSlot(data) { var c = dbGetCompareSlots(); if (c.length >= 3) c.shift(); c.push(Object.assign({ id: Date.now() }, data)); _lsSet(LS.COMPARE, c); }
function dbClearCompare() { _lsSet(LS.COMPARE, []); }

// Theme
function dbGetTheme() { return localStorage.getItem(LS.THEME) || "dark"; }
function dbSetTheme(t) { localStorage.setItem(LS.THEME, t); }

// Onboarding
function dbHasOnboarded() { return localStorage.getItem(LS.ONBOARD) === "1"; }
function dbSetOnboarded() { localStorage.setItem(LS.ONBOARD, "1"); }

// AI Key
function dbGetAIKey() { return localStorage.getItem(LS.AI_KEY) || ""; }
function dbSetAIKey(k) { localStorage.setItem(LS.AI_KEY, k); }

// Stripe Key
function dbGetStripeKey() { return localStorage.getItem(LS.STRIPE_KEY) || ""; }
function dbSetStripeKey(k) { localStorage.setItem(LS.STRIPE_KEY, k); }

// Admin
function dbIsAdmin() { var s = dbLoadSession(); return s && ADMIN_EMAILS.indexOf(_safeEmail(s)) >= 0; }
function dbAdminGetUsers() { return _lsGet(LS.USERS, []); }
function dbAdminUpdatePlan(email, plan) {
  var users = _lsGet(LS.USERS, []);
  for (var i = 0; i < users.length; i++) { if (_safeEmail(users[i]) === email.toLowerCase()) users[i].plan = plan; }
  _lsSet(LS.USERS, users);
}
function dbAdminDeleteUser(email) {
  if (ADMIN_EMAILS.indexOf(email.toLowerCase()) >= 0) return false;
  var users = _lsGet(LS.USERS, []);
  _lsSet(LS.USERS, users.filter(function(u) { return _safeEmail(u) !== email.toLowerCase(); }));
  return true;
}
function dbAdminAddUser(name, email, pass, plan) {
  var users = _lsGet(LS.USERS, []);
  for (var i = 0; i < users.length; i++) { if (_safeEmail(users[i]) === email.toLowerCase()) return { success: false, error: "Email ja existe." }; }
  users.push({ name: name, email: email, password: pass, plan: plan || "free", uid: "admin_add_" + Date.now() });
  _lsSet(LS.USERS, users); return { success: true };
}
function dbAdminResetAll() { Object.keys(LS).forEach(function(k) { localStorage.removeItem(LS[k]); }); _seedDemoUser(); }

// IBGE API
function dbFetchIBGE(city, state) {
  return new Promise(function(resolve) {
    var url = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/" + encodeURIComponent(state) + "/municipios";
    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      var found = null;
      for (var i = 0; i < data.length; i++) {
        if (data[i].nome.toLowerCase().indexOf(city.toLowerCase()) >= 0) { found = data[i]; break; }
      }
      if (found) {
        var popUrl = "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-6/variaveis/9324?localidades=N6[" + found.id + "]";
        fetch(popUrl).then(function(r) { return r.json(); }).then(function(popData) {
          var pop = "N/D";
          try { var series = popData[0].resultados[0].series[0].serie; var keys = Object.keys(series); pop = series[keys[keys.length - 1]]; } catch(e) {}
          resolve({ success: true, municipio: found.nome, populacao: pop, id: found.id, microrregiao: found.microrregiao ? found.microrregiao.nome : "" });
        }).catch(function() { resolve({ success: true, municipio: found.nome, populacao: "N/D", id: found.id }); });
      } else resolve({ success: false });
    }).catch(function() { resolve({ success: false }); });
  });
}

function dbIsFirebaseReady() { return _fbReady; }

console.log("[DB] v8 loaded — " + (_fbReady ? "Firebase" : "localStorage"));
