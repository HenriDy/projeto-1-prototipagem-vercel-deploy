// ============================================================
//  GeoOpportunity AI — Database Module (database.js)
//  Firebase Auth + Firestore (compat SDK via CDN)
//  All public functions return PROMISES for .then() usage
// ============================================================

// --- Firebase Config ---
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDqRjRv-OSVGx5SfxmiIgeR2ljTfwacg1s",
  authDomain: "projeto-prototipagem-1.firebaseapp.com",
  projectId: "projeto-prototipagem-1",
  storageBucket: "projeto-prototipagem-1.firebasestorage.app",
  messagingSenderId: "706875161441",
  appId: "1:706875161441:web:5aded7777da5f2fba42320"
};

// --- localStorage Keys ---
var LS_USERS      = "geoop_users_v7";
var LS_SESSION    = "geoop_session_v7";
var LS_ANALYSES   = "geoop_analyses_v7";
var LS_COUNT      = "geoop_count_v7";
var LS_PLAN       = "geoop_plan_v7";
var LS_BUSINESSES = "geoop_businesses_v7";
var LS_DAILY      = "geoop_daily_v7";

// --- Plan Limits ---
var PLAN_LIMITS = {
  free:       { radius: 1000,  results: 5,  analysesPerDay: 5,        canExport: false, name: "Free" },
  pro:        { radius: 5000,  results: 25, analysesPerDay: 100,      canExport: true,  name: "Pro" },
  enterprise: { radius: 10000, results: 50, analysesPerDay: 999999,   canExport: true,  name: "Enterprise" }
};

// --- State ---
var _fbReady = false;
var _fbAuth  = null;
var _fbDB    = null;
var _fbUser  = null;

// ===================== Helpers =====================
// Safe email getter — prevents crash on corrupted data
function _safeEmail(user) {
  if (user && typeof user.email === "string") return user.email.toLowerCase();
  return "";
}

// ===================== Firebase Init =====================
(function _initFirebase() {
  try {
    if (typeof firebase !== "undefined" && typeof firebase.initializeApp === "function") {
      if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 10) {
        if (!firebase.apps || firebase.apps.length === 0) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        _fbAuth = firebase.auth();
        _fbDB   = firebase.firestore();

        try {
          _fbDB.enablePersistence({ synchronizeTabs: true }).catch(function() {});
        } catch(e) {}

        _fbReady = true;
        console.log("[DB] Firebase inicializado");

        _fbAuth.onAuthStateChanged(function(user) {
          _fbUser = user || null;
          if (user) console.log("[DB] Auth restored:", user.email);
        });
      }
    }
  } catch (e) {
    console.warn("[DB] Firebase error:", e.message);
    _fbReady = false;
  }
  _seedDemoUser();
})();

// --- Admin Config ---
// ⚠️ COLOQUE SEU EMAIL AQUI para ter acesso ao painel admin
var ADMIN_EMAILS = ["admin@geo.com"];

// --- Seed Users (Demo + Admin) ---
function _seedDemoUser() {
  var users = [];
  try { users = JSON.parse(localStorage.getItem(LS_USERS) || "[]"); } catch(e) { users = []; }
  if (!Array.isArray(users)) users = [];
  var seeds = [
    { name: "Usuario Demo", email: "demo@geo.com", password: "123456", plan: "free", uid: "demo_001" },
    { name: "Administrador", email: "admin@geo.com", password: "admin123!!!", plan: "enterprise", uid: "admin_001" }
  ];
  for (var s = 0; s < seeds.length; s++) {
    var found = false;
    for (var i = 0; i < users.length; i++) {
      if (_safeEmail(users[i]) === seeds[s].email) { found = true; break; }
    }
    if (!found) users.push(seeds[s]);
  }
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

// ===================== Local Auth =====================
function _localRegister(name, email, pass) {
  var users = [];
  try { users = JSON.parse(localStorage.getItem(LS_USERS) || "[]"); } catch(e) { users = []; }
  if (!Array.isArray(users)) users = [];
  for (var i = 0; i < users.length; i++) {
    if (_safeEmail(users[i]) === email.toLowerCase()) {
      return { success: false, error: "Este email ja esta cadastrado." };
    }
  }
  var uid = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  var user = { name: name, email: email, password: pass, plan: "free", uid: uid };
  users.push(user);
  try { localStorage.setItem(LS_USERS, JSON.stringify(users)); } catch(e) {}
  return { success: true, user: user };
}

function _localLogin(email, pass) {
  var users = [];
  try { users = JSON.parse(localStorage.getItem(LS_USERS) || "[]"); } catch(e) { users = []; }
  if (!Array.isArray(users)) users = [];
  for (var i = 0; i < users.length; i++) {
    if (_safeEmail(users[i]) === email.toLowerCase() && users[i] && users[i].password === pass) {
      return { success: true, user: users[i] };
    }
  }
  return { success: false, error: "Email ou senha incorretos." };
}

// Check if error means Firebase Auth is not configured — should fallback to local
function _isFirebaseNotConfigured(code) {
  return code === "auth/operation-not-allowed" ||
         code === "auth/configuration-not-found" ||
         code === "auth/admin-restricted-operation" ||
         code === "auth/internal-error" ||
         code === "auth/network-request-failed" ||
         code === "auth/api-key-not-valid.-please-pass-a-valid-api-key." ||
         code === "auth/invalid-api-key" ||
         code === "auth/project-not-found";
}

// Check if error means user credentials wrong — should try local fallback
function _isCredentialError(code) {
  return code === "auth/user-not-found" ||
         code === "auth/wrong-password" ||
         code === "auth/invalid-credential" ||
         code === "auth/invalid-login-credentials";
}

// ===================== Auth (Promise-based) =====================

function dbRegister(name, email, pass) {
  return new Promise(function(resolve) {
    if (_fbReady && _fbAuth) {
      try {
        _fbAuth.createUserWithEmailAndPassword(email, pass)
          .then(function(cred) {
            _fbUser = cred.user;
            var p;
            try { p = cred.user.updateProfile({ displayName: name }); } catch(e) { p = Promise.resolve(); }
            return p.then(function() {
              var userData = { name: name, email: email, uid: cred.user.uid, plan: "free" };
              try {
                _fbDB.collection("users").doc(cred.user.uid).set({
                  name: name, email: email, plan: "free",
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(function() {});
              } catch(e) {}
              // Also save locally for offline fallback
              _localRegister(name, email, pass);
              resolve({ success: true, user: userData });
            });
          })
          .catch(function(e) {
            var code = (e && e.code) ? e.code : "";
            // Firebase not configured — fall back to local
            if (_isFirebaseNotConfigured(code)) {
              resolve(_localRegister(name, email, pass));
              return;
            }
            var msgs = {
              "auth/email-already-in-use": "Este email ja esta cadastrado.",
              "auth/weak-password": "A senha deve ter no minimo 6 caracteres.",
              "auth/invalid-email": "Email invalido."
            };
            resolve({ success: false, error: msgs[code] || e.message || "Erro ao registrar." });
          });
      } catch(syncErr) {
        // Synchronous error — fall back to local
        console.warn("[DB] Register sync error:", syncErr);
        resolve(_localRegister(name, email, pass));
      }
    } else {
      resolve(_localRegister(name, email, pass));
    }
  });
}

function dbLogin(email, pass) {
  return new Promise(function(resolve) {
    if (_fbReady && _fbAuth) {
      try {
        _fbAuth.signInWithEmailAndPassword(email, pass)
          .then(function(cred) {
            _fbUser = cred.user;
            var plan = "free";
            try {
              _fbDB.collection("users").doc(cred.user.uid).get()
                .then(function(doc) {
                  if (doc.exists && doc.data() && doc.data().plan) plan = doc.data().plan;
                  resolve({
                    success: true,
                    user: {
                      name: cred.user.displayName || email.split("@")[0],
                      email: cred.user.email, uid: cred.user.uid, plan: plan
                    }
                  });
                })
                .catch(function() {
                  resolve({
                    success: true,
                    user: {
                      name: cred.user.displayName || email.split("@")[0],
                      email: cred.user.email, uid: cred.user.uid, plan: "free"
                    }
                  });
                });
            } catch(e) {
              resolve({
                success: true,
                user: {
                  name: cred.user.displayName || email.split("@")[0],
                  email: cred.user.email, uid: cred.user.uid, plan: "free"
                }
              });
            }
          })
          .catch(function(e) {
            var code = (e && e.code) ? e.code : "";

            // Firebase not configured — fall back to local
            if (_isFirebaseNotConfigured(code)) {
              resolve(_localLogin(email, pass));
              return;
            }

            // Credential error — try local (for demo user or locally-registered users)
            if (_isCredentialError(code)) {
              var local = _localLogin(email, pass);
              if (local.success) { resolve(local); return; }
            }

            var msgs = {
              "auth/user-not-found": "Email ou senha incorretos.",
              "auth/wrong-password": "Email ou senha incorretos.",
              "auth/invalid-email": "Email invalido.",
              "auth/invalid-credential": "Email ou senha incorretos.",
              "auth/invalid-login-credentials": "Email ou senha incorretos.",
              "auth/too-many-requests": "Muitas tentativas. Aguarde."
            };
            resolve({ success: false, error: msgs[code] || "Email ou senha incorretos." });
          });
      } catch(syncErr) {
        // Synchronous error — fall back to local
        console.warn("[DB] Login sync error:", syncErr);
        resolve(_localLogin(email, pass));
      }
    } else {
      resolve(_localLogin(email, pass));
    }
  });
}

function dbLogout() {
  return new Promise(function(resolve) {
    try { localStorage.removeItem(LS_SESSION); } catch(e) {}
    _fbUser = null;
    if (_fbReady && _fbAuth) {
      try {
        _fbAuth.signOut().then(function() { resolve(); }).catch(function() { resolve(); });
      } catch(e) { resolve(); }
    } else {
      resolve();
    }
  });
}

// ===================== Session =====================

function dbSaveSession(user) {
  try {
    localStorage.setItem(LS_SESSION, JSON.stringify(user));
    if (user && user.plan) localStorage.setItem(LS_PLAN, user.plan);
  } catch(e) {}
}

function dbLoadSession() {
  try {
    var data = localStorage.getItem(LS_SESSION);
    if (!data) return null;
    var user = JSON.parse(data);
    return (user && user.email) ? user : null;
  } catch(e) { return null; }
}

// ===================== Plan =====================

function dbGetPlan() {
  try { return localStorage.getItem(LS_PLAN) || "free"; } catch(e) { return "free"; }
}

function dbGetPlanLimits() {
  return PLAN_LIMITS[dbGetPlan()] || PLAN_LIMITS.free;
}

function dbSavePlan(plan) {
  try {
    localStorage.setItem(LS_PLAN, plan);
    var session = dbLoadSession();
    if (session) { session.plan = plan; dbSaveSession(session); }
    // Update local users array
    if (session && session.email) {
      var users = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
      if (Array.isArray(users)) {
        for (var i = 0; i < users.length; i++) {
          if (_safeEmail(users[i]) === session.email.toLowerCase()) {
            users[i].plan = plan;
          }
        }
        localStorage.setItem(LS_USERS, JSON.stringify(users));
      }
    }
  } catch(e) { console.warn("[DB] savePlan error:", e); }
  // Firestore
  if (_fbReady && _fbUser && _fbUser.uid && _fbDB) {
    try {
      _fbDB.collection("users").doc(_fbUser.uid).update({ plan: plan }).catch(function() {});
    } catch(e) {}
  }
}

// ===================== Daily Limits =====================

function dbCanAnalyze() {
  var limits = dbGetPlanLimits();
  if (limits.analysesPerDay >= 999999) return true;
  try {
    var daily = JSON.parse(localStorage.getItem(LS_DAILY) || "{}");
    var today = new Date().toISOString().slice(0, 10);
    if (daily.date !== today) return true;
    return (daily.count || 0) < limits.analysesPerDay;
  } catch(e) { return true; }
}

function dbGetDailyRemaining() {
  var limits = dbGetPlanLimits();
  if (limits.analysesPerDay >= 999999) return 9999;
  try {
    var daily = JSON.parse(localStorage.getItem(LS_DAILY) || "{}");
    var today = new Date().toISOString().slice(0, 10);
    if (daily.date !== today) return limits.analysesPerDay;
    return Math.max(0, limits.analysesPerDay - (daily.count || 0));
  } catch(e) { return limits.analysesPerDay; }
}

function _incrementDaily() {
  try {
    var daily = JSON.parse(localStorage.getItem(LS_DAILY) || "{}");
    var today = new Date().toISOString().slice(0, 10);
    if (daily.date !== today) daily = { date: today, count: 0 };
    daily.count = (daily.count || 0) + 1;
    localStorage.setItem(LS_DAILY, JSON.stringify(daily));
  } catch(e) {}
}

// ===================== Stats =====================

function dbGetAnalysisCount() {
  try { return parseInt(localStorage.getItem(LS_COUNT) || "0", 10) || 0; } catch(e) { return 0; }
}

function dbGetTotalBusinesses() {
  try { return parseInt(localStorage.getItem(LS_BUSINESSES) || "0", 10) || 0; } catch(e) { return 0; }
}

function dbAddBusinesses(count) {
  try {
    var total = dbGetTotalBusinesses() + (count || 0);
    localStorage.setItem(LS_BUSINESSES, total.toString());
  } catch(e) {}
}

// ===================== Analysis CRUD (Promise-based) =====================

function dbSaveAnalysis(data) {
  return new Promise(function(resolve) {
    try {
      var entry = {
        location: data.location || "", state: data.state || "",
        segmento: data.segmento || "", score: data.score || 0,
        total: data.total || 0, avgRating: data.avgRating || "",
        radius: data.radius || 0, timestamp: Date.now()
      };

      // Increment counts
      var newCount = dbGetAnalysisCount() + 1;
      localStorage.setItem(LS_COUNT, newCount.toString());
      _incrementDaily();

      // Save to localStorage
      var history = [];
      try { history = JSON.parse(localStorage.getItem(LS_ANALYSES) || "[]"); } catch(e) { history = []; }
      if (!Array.isArray(history)) history = [];
      history.unshift(entry);
      if (history.length > 100) history.length = 100;
      localStorage.setItem(LS_ANALYSES, JSON.stringify(history));

      // Save to Firestore
      if (_fbReady && _fbUser && _fbUser.uid && _fbDB) {
        try {
          _fbDB.collection("users").doc(_fbUser.uid)
            .collection("analyses").add({
              location: entry.location, state: entry.state, segmento: entry.segmento,
              score: entry.score, total: entry.total, avgRating: entry.avgRating,
              radius: entry.radius, timestamp: entry.timestamp,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function() { resolve(); }).catch(function() { resolve(); });
        } catch(e) { resolve(); }
      } else {
        resolve();
      }
    } catch(e) {
      console.warn("[DB] saveAnalysis error:", e);
      resolve();
    }
  });
}

function dbLoadHistory(limit) {
  if (typeof limit !== "number" || limit < 1) limit = 15;
  return new Promise(function(resolve) {
    // Try Firestore first
    if (_fbReady && _fbUser && _fbUser.uid && _fbDB) {
      try {
        _fbDB.collection("users").doc(_fbUser.uid)
          .collection("analyses").orderBy("createdAt", "desc").limit(limit)
          .get()
          .then(function(snap) {
            var results = [];
            snap.forEach(function(doc) {
              var d = doc.data();
              results.push({
                location: d.location || "", state: d.state || "",
                segmento: d.segmento || "", score: d.score || 0,
                total: d.total || 0, avgRating: d.avgRating || "",
                radius: d.radius || 0, timestamp: d.timestamp || Date.now(), id: doc.id
              });
            });
            resolve(results.length > 0 ? results : _getLocalHistory(limit));
          })
          .catch(function() { resolve(_getLocalHistory(limit)); });
      } catch(e) { resolve(_getLocalHistory(limit)); }
    } else {
      resolve(_getLocalHistory(limit));
    }
  });
}

function _getLocalHistory(limit) {
  try {
    var h = JSON.parse(localStorage.getItem(LS_ANALYSES) || "[]");
    if (Array.isArray(h)) return h.slice(0, limit || 15);
  } catch(e) {}
  return [];
}

function dbClearHistory() {
  return new Promise(function(resolve) {
    try {
      localStorage.removeItem(LS_ANALYSES);
      localStorage.setItem(LS_COUNT, "0");
      localStorage.setItem(LS_BUSINESSES, "0");
      try {
        var daily = JSON.parse(localStorage.getItem(LS_DAILY) || "{}");
        daily.count = 0;
        localStorage.setItem(LS_DAILY, JSON.stringify(daily));
      } catch(e) {}
    } catch(e) {}

    if (_fbReady && _fbUser && _fbUser.uid && _fbDB) {
      try {
        _fbDB.collection("users").doc(_fbUser.uid)
          .collection("analyses").get()
          .then(function(snap) {
            if (snap.empty) { resolve(); return; }
            var batch = _fbDB.batch();
            snap.forEach(function(doc) { batch.delete(doc.ref); });
            return batch.commit();
          })
          .then(function() { resolve(); })
          .catch(function() { resolve(); });
      } catch(e) { resolve(); }
    } else {
      resolve();
    }
  });
}

// ===================== Export CSV (Promise-based) =====================

function dbExportCSV() {
  return new Promise(function(resolve) {
    var limits = dbGetPlanLimits();
    if (!limits.canExport) {
      resolve({ success: false, error: "Exportacao requer plano Pro ou superior." });
      return;
    }
    dbLoadHistory(100).then(function(history) {
      if (!history || history.length === 0) {
        resolve({ success: false, error: "Nenhuma analise para exportar." });
        return;
      }
      var csv = "Local,Estado,Segmento,Score,Negocios,Nota Media,Raio (m),Data\n";
      for (var i = 0; i < history.length; i++) {
        var h = history[i];
        var date = h.timestamp ? new Date(h.timestamp).toLocaleDateString("pt-BR") : "";
        var loc = (h.location || "").replace(/"/g, '""');
        csv += '"' + loc + '","' + (h.state || "") + '","' + (h.segmento || "") + '",'
             + (h.score || 0) + ',' + (h.total || 0) + ',"' + (h.avgRating || "") + '",'
             + (h.radius || 0) + ',"' + date + '"\n';
      }
      try {
        var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "geoopportunity_" + Date.now() + ".csv";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        resolve({ success: true });
      } catch(e) {
        resolve({ success: false, error: "Erro ao gerar arquivo." });
      }
    }).catch(function() {
      resolve({ success: false, error: "Erro ao carregar historico." });
    });
  });
}

// ===================== Status =====================

function dbIsFirebaseReady() { return _fbReady; }

// ===================== ADMIN FUNCTIONS =====================

function dbIsAdmin() {
  var session = dbLoadSession();
  if (!session) return false;
  var email = _safeEmail(session);
  if (!email) return false;
  for (var i = 0; i < ADMIN_EMAILS.length; i++) {
    if (ADMIN_EMAILS[i].toLowerCase() === email) return true;
  }
  return false;
}

function dbGetAllUsers() {
  return new Promise(function(resolve) {
    var localUsers = [];
    try { localUsers = JSON.parse(localStorage.getItem(LS_USERS) || "[]"); } catch(e) {}
    if (!Array.isArray(localUsers)) localUsers = [];
    // Normalize
    var clean = [];
    for (var i = 0; i < localUsers.length; i++) {
      var u = localUsers[i];
      if (u && u.email) {
        clean.push({
          name: u.name || u.email.split("@")[0],
          email: u.email,
          plan: u.plan || "free",
          uid: u.uid || "local_" + i,
          createdAt: u.createdAt || null
        });
      }
    }
    // Try to merge with Firestore
    if (_fbReady && _fbDB) {
      try {
        _fbDB.collection("users").get()
          .then(function(snap) {
            snap.forEach(function(doc) {
              var d = doc.data();
              if (!d.email) return;
              var exists = false;
              for (var j = 0; j < clean.length; j++) {
                if (_safeEmail(clean[j]) === d.email.toLowerCase()) {
                  clean[j].plan = d.plan || clean[j].plan;
                  clean[j].uid = doc.id;
                  if (d.createdAt && d.createdAt.toDate) clean[j].createdAt = d.createdAt.toDate().toISOString();
                  exists = true;
                  break;
                }
              }
              if (!exists) {
                clean.push({
                  name: d.name || d.email.split("@")[0],
                  email: d.email, plan: d.plan || "free", uid: doc.id,
                  createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null
                });
              }
            });
            resolve(clean);
          })
          .catch(function() { resolve(clean); });
      } catch(e) { resolve(clean); }
    } else {
      resolve(clean);
    }
  });
}

function dbAdminSetPlan(userEmail, plan) {
  return new Promise(function(resolve) {
    if (!dbIsAdmin()) { resolve({ success: false, error: "Sem permissao." }); return; }
    var targetEmail = userEmail.toLowerCase();
    // Update localStorage
    try {
      var users = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
      if (Array.isArray(users)) {
        for (var i = 0; i < users.length; i++) {
          if (_safeEmail(users[i]) === targetEmail) users[i].plan = plan;
        }
        localStorage.setItem(LS_USERS, JSON.stringify(users));
      }
    } catch(e) {}
    // Update current session if same user
    var session = dbLoadSession();
    if (session && _safeEmail(session) === targetEmail) {
      session.plan = plan;
      dbSaveSession(session);
      localStorage.setItem(LS_PLAN, plan);
    }
    // Firestore
    if (_fbReady && _fbDB) {
      try {
        _fbDB.collection("users").where("email", "==", userEmail).get()
          .then(function(snap) {
            snap.forEach(function(doc) { doc.ref.update({ plan: plan }).catch(function(){}); });
            resolve({ success: true });
          })
          .catch(function() { resolve({ success: true }); });
      } catch(e) { resolve({ success: true }); }
    } else {
      resolve({ success: true });
    }
  });
}

function dbAdminDeleteUser(userEmail) {
  return new Promise(function(resolve) {
    if (!dbIsAdmin()) { resolve({ success: false, error: "Sem permissao." }); return; }
    var targetEmail = userEmail.toLowerCase();
    // Don't allow deleting admins
    for (var a = 0; a < ADMIN_EMAILS.length; a++) {
      if (ADMIN_EMAILS[a].toLowerCase() === targetEmail) {
        resolve({ success: false, error: "Nao e possivel excluir um admin." });
        return;
      }
    }
    // Remove from localStorage
    try {
      var users = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
      var filtered = [];
      for (var i = 0; i < users.length; i++) {
        if (_safeEmail(users[i]) !== targetEmail) filtered.push(users[i]);
      }
      localStorage.setItem(LS_USERS, JSON.stringify(filtered));
    } catch(e) {}
    // Remove from Firestore
    if (_fbReady && _fbDB) {
      try {
        _fbDB.collection("users").where("email", "==", userEmail).get()
          .then(function(snap) {
            var batch = _fbDB.batch();
            snap.forEach(function(doc) { batch.delete(doc.ref); });
            return batch.commit();
          })
          .then(function() { resolve({ success: true }); })
          .catch(function() { resolve({ success: true }); });
      } catch(e) { resolve({ success: true }); }
    } else {
      resolve({ success: true });
    }
  });
}

function dbAdminAddUser(name, email, pass, plan) {
  return new Promise(function(resolve) {
    if (!dbIsAdmin()) { resolve({ success: false, error: "Sem permissao." }); return; }
    var result = _localRegister(name, email, pass);
    if (!result.success) { resolve(result); return; }
    // Set the plan
    try {
      var users = JSON.parse(localStorage.getItem(LS_USERS) || "[]");
      for (var i = 0; i < users.length; i++) {
        if (_safeEmail(users[i]) === email.toLowerCase()) users[i].plan = plan;
      }
      localStorage.setItem(LS_USERS, JSON.stringify(users));
    } catch(e) {}
    resolve({ success: true, user: { name: name, email: email, plan: plan } });
  });
}

function dbAdminGetStats() {
  return new Promise(function(resolve) {
    dbGetAllUsers().then(function(users) {
      var stats = {
        totalUsers: users.length, freeUsers: 0, proUsers: 0, enterpriseUsers: 0,
        totalAnalyses: dbGetAnalysisCount(), totalBusinesses: dbGetTotalBusinesses()
      };
      for (var i = 0; i < users.length; i++) {
        var p = users[i].plan || "free";
        if (p === "pro") stats.proUsers++;
        else if (p === "enterprise") stats.enterpriseUsers++;
        else stats.freeUsers++;
      }
      resolve(stats);
    }).catch(function() {
      resolve({ totalUsers: 0, freeUsers: 0, proUsers: 0, enterpriseUsers: 0, totalAnalyses: 0, totalBusinesses: 0 });
    });
  });
}

function dbAdminGetAllAnalyses() {
  return new Promise(function(resolve) {
    resolve(_getLocalHistory(100));
  });
}

console.log("[DB] database.js v8 carregado — " + (_fbReady ? "Firebase" : "localStorage"));
