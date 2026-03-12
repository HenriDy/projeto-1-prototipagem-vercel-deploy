// ============================================================
//  GeoOpportunity AI — Database Module v7
//  Firebase + localStorage | Favorites | Notes | Trial | Share
// ============================================================

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDqRjRv-OSVGx5SfxmiIgeR2ljTfwacg1s",
  authDomain: "projeto-prototipagem-1.firebaseapp.com",
  projectId: "projeto-prototipagem-1",
  storageBucket: "projeto-prototipagem-1.firebasestorage.app",
  messagingSenderId: "706875161441",
  appId: "1:706875161441:web:5aded7777da5f2fba42320"
};

var LS_USERS="geoop_users_v7",LS_SESSION="geoop_session_v7",LS_ANALYSES="geoop_analyses_v7",
    LS_COUNT="geoop_count_v7",LS_PLAN="geoop_plan_v7",LS_BUSINESSES="geoop_biz_v7",
    LS_DAILY="geoop_daily_v7",LS_FAVORITES="geoop_favs_v7",LS_NOTES="geoop_notes_v7",
    LS_TRIAL="geoop_trial_v7",LS_ONBOARDING="geoop_onboard_v7",LS_SHARED="geoop_shared_v7";

var ADMIN_EMAILS=["admin@geo.com"];

var PLAN_LIMITS={
  free:{radius:1000,results:5,analysesPerDay:5,canExport:false,name:"Free"},
  pro:{radius:5000,results:25,analysesPerDay:100,canExport:true,name:"Pro"},
  enterprise:{radius:10000,results:50,analysesPerDay:999999,canExport:true,name:"Enterprise"}
};

var _fbReady=false,_fbAuth=null,_fbDB=null,_fbUser=null;

function _safeEmail(u){return(u&&typeof u.email==="string")?u.email.toLowerCase():"";}

// ===================== Firebase Init =====================
(function(){
  try{
    if(typeof firebase!=="undefined"&&firebase.initializeApp){
      if(FIREBASE_CONFIG.apiKey&&FIREBASE_CONFIG.apiKey.length>10){
        if(!firebase.apps||firebase.apps.length===0)firebase.initializeApp(FIREBASE_CONFIG);
        _fbAuth=firebase.auth();_fbDB=firebase.firestore();
        try{_fbDB.enablePersistence({synchronizeTabs:true}).catch(function(){});}catch(e){}
        _fbReady=true;
        _fbAuth.onAuthStateChanged(function(u){_fbUser=u||null;});
      }
    }
  }catch(e){_fbReady=false;}
  _seedDemoUser();_seedAdminUser();
})();

function _seedDemoUser(){
  var u=_getUsers();
  if(!u.some(function(x){return _safeEmail(x)==="demo@geo.com";})){
    u.push({name:"Usuario Demo",email:"demo@geo.com",password:"123456",plan:"free",uid:"demo_001"});
    localStorage.setItem(LS_USERS,JSON.stringify(u));
  }
}
function _seedAdminUser(){
  var u=_getUsers();
  if(!u.some(function(x){return _safeEmail(x)==="admin@geo.com";})){
    u.push({name:"Administrador",email:"admin@geo.com",password:"admin123",plan:"enterprise",uid:"admin_001"});
    localStorage.setItem(LS_USERS,JSON.stringify(u));
  }
}
function _getUsers(){try{var u=JSON.parse(localStorage.getItem(LS_USERS)||"[]");return Array.isArray(u)?u:[];}catch(e){return[];}}

function _isFirebaseNotConfigured(code){
  return["auth/operation-not-allowed","auth/configuration-not-found","auth/admin-restricted-operation",
    "auth/internal-error","auth/network-request-failed","auth/invalid-api-key","auth/project-not-found"].indexOf(code)>=0;
}

// ===================== Auth =====================
function _localRegister(n,e,p){
  var u=_getUsers();
  for(var i=0;i<u.length;i++){if(_safeEmail(u[i])===e.toLowerCase())return{success:false,error:"Este email ja esta cadastrado."};}
  var uid="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
  var user={name:n,email:e,password:p,plan:"free",uid:uid};
  u.push(user);localStorage.setItem(LS_USERS,JSON.stringify(u));
  return{success:true,user:user};
}
function _localLogin(e,p){
  var u=_getUsers();
  for(var i=0;i<u.length;i++){
    if(_safeEmail(u[i])===e.toLowerCase()&&u[i].password===p)return{success:true,user:u[i]};
  }
  return{success:false,error:"Email ou senha incorretos."};
}

function dbRegister(name,email,pass){
  return new Promise(function(resolve){
    if(_fbReady&&_fbAuth){
      try{
        _fbAuth.createUserWithEmailAndPassword(email,pass).then(function(cred){
          _fbUser=cred.user;
          var p;try{p=cred.user.updateProfile({displayName:name});}catch(e){p=Promise.resolve();}
          return p.then(function(){
            var ud={name:name,email:email,uid:cred.user.uid,plan:"free"};
            try{_fbDB.collection("users").doc(cred.user.uid).set({name:name,email:email,plan:"free",createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(function(){});}catch(e){}
            _localRegister(name,email,pass);
            resolve({success:true,user:ud});
          });
        }).catch(function(e){
          if(_isFirebaseNotConfigured(e.code)){resolve(_localRegister(name,email,pass));return;}
          var msgs={"auth/email-already-in-use":"Este email ja esta cadastrado.","auth/weak-password":"Senha minimo 6 caracteres.","auth/invalid-email":"Email invalido."};
          resolve({success:false,error:msgs[e.code]||e.message});
        });
      }catch(e){resolve(_localRegister(name,email,pass));}
    }else{resolve(_localRegister(name,email,pass));}
  });
}

function dbLogin(email,pass){
  return new Promise(function(resolve){
    if(_fbReady&&_fbAuth){
      try{
        _fbAuth.signInWithEmailAndPassword(email,pass).then(function(cred){
          _fbUser=cred.user;var plan="free";
          _fbDB.collection("users").doc(cred.user.uid).get().then(function(doc){
            if(doc.exists&&doc.data().plan)plan=doc.data().plan;
            resolve({success:true,user:{name:cred.user.displayName||email.split("@")[0],email:cred.user.email,uid:cred.user.uid,plan:plan}});
          }).catch(function(){
            resolve({success:true,user:{name:cred.user.displayName||email.split("@")[0],email:cred.user.email,uid:cred.user.uid,plan:"free"}});
          });
        }).catch(function(e){
          if(_isFirebaseNotConfigured(e.code)){resolve(_localLogin(email,pass));return;}
          if(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"||e.code==="auth/invalid-login-credentials"){
            var local=_localLogin(email,pass);if(local.success){resolve(local);return;}
          }
          resolve({success:false,error:"Email ou senha incorretos."});
        });
      }catch(e){resolve(_localLogin(email,pass));}
    }else{resolve(_localLogin(email,pass));}
  });
}

function dbLogout(){
  return new Promise(function(resolve){
    localStorage.removeItem(LS_SESSION);_fbUser=null;
    if(_fbReady&&_fbAuth){_fbAuth.signOut().then(resolve).catch(function(){resolve();});}
    else resolve();
  });
}

// ===================== Session =====================
function dbSaveSession(u){try{localStorage.setItem(LS_SESSION,JSON.stringify(u));if(u.plan)localStorage.setItem(LS_PLAN,u.plan);}catch(e){}}
function dbLoadSession(){try{var d=localStorage.getItem(LS_SESSION);if(!d)return null;var u=JSON.parse(d);return(u&&u.email)?u:null;}catch(e){return null;}}

// ===================== Plan =====================
function dbGetPlan(){return localStorage.getItem(LS_PLAN)||"free";}
function dbGetPlanLimits(){return PLAN_LIMITS[dbGetPlan()]||PLAN_LIMITS.free;}
function dbSavePlan(plan){
  localStorage.setItem(LS_PLAN,plan);
  var s=dbLoadSession();if(s){s.plan=plan;dbSaveSession(s);}
  if(s&&s.email){var u=_getUsers();for(var i=0;i<u.length;i++){if(_safeEmail(u[i])===s.email.toLowerCase())u[i].plan=plan;}localStorage.setItem(LS_USERS,JSON.stringify(u));}
  if(_fbReady&&_fbUser&&_fbUser.uid&&_fbDB){_fbDB.collection("users").doc(_fbUser.uid).update({plan:plan}).catch(function(){});}
}

// ===================== Daily Limits =====================
function dbCanAnalyze(){
  var l=dbGetPlanLimits();if(l.analysesPerDay>=999999)return true;
  try{var d=JSON.parse(localStorage.getItem(LS_DAILY)||"{}");var t=new Date().toISOString().slice(0,10);if(d.date!==t)return true;return(d.count||0)<l.analysesPerDay;}catch(e){return true;}
}
function dbGetDailyRemaining(){
  var l=dbGetPlanLimits();if(l.analysesPerDay>=999999)return 9999;
  try{var d=JSON.parse(localStorage.getItem(LS_DAILY)||"{}");var t=new Date().toISOString().slice(0,10);if(d.date!==t)return l.analysesPerDay;return Math.max(0,l.analysesPerDay-(d.count||0));}catch(e){return l.analysesPerDay;}
}
function _incrementDaily(){
  try{var d=JSON.parse(localStorage.getItem(LS_DAILY)||"{}");var t=new Date().toISOString().slice(0,10);if(d.date!==t)d={date:t,count:0};d.count=(d.count||0)+1;localStorage.setItem(LS_DAILY,JSON.stringify(d));}catch(e){}
}

// ===================== Stats =====================
function dbGetAnalysisCount(){return parseInt(localStorage.getItem(LS_COUNT)||"0",10);}
function dbGetTotalBusinesses(){return parseInt(localStorage.getItem(LS_BUSINESSES)||"0",10);}
function dbAddBusinesses(c){localStorage.setItem(LS_BUSINESSES,(dbGetTotalBusinesses()+c).toString());}

// ===================== Analysis CRUD =====================
function dbSaveAnalysis(data){
  return new Promise(function(resolve){
    var entry={location:data.location||"",state:data.state||"",segmento:data.segmento||"",score:data.score||0,total:data.total||0,avgRating:data.avgRating||"",radius:data.radius||0,timestamp:Date.now(),lat:data.lat||0,lng:data.lng||0};
    localStorage.setItem(LS_COUNT,(dbGetAnalysisCount()+1).toString());_incrementDaily();
    var h=[];try{h=JSON.parse(localStorage.getItem(LS_ANALYSES)||"[]");}catch(e){h=[];}
    if(!Array.isArray(h))h=[];h.unshift(entry);if(h.length>200)h.length=200;
    localStorage.setItem(LS_ANALYSES,JSON.stringify(h));
    if(_fbReady&&_fbUser&&_fbUser.uid&&_fbDB){
      try{_fbDB.collection("users").doc(_fbUser.uid).collection("analyses").add(Object.assign({},entry,{createdAt:firebase.firestore.FieldValue.serverTimestamp()})).then(function(){resolve();}).catch(function(){resolve();});}catch(e){resolve();}
    }else resolve();
  });
}

function dbLoadHistory(limit){
  if(typeof limit!=="number"||limit<1)limit=15;
  return new Promise(function(resolve){
    if(_fbReady&&_fbUser&&_fbUser.uid&&_fbDB){
      try{_fbDB.collection("users").doc(_fbUser.uid).collection("analyses").orderBy("createdAt","desc").limit(limit).get().then(function(snap){
        var r=[];snap.forEach(function(doc){var d=doc.data();r.push(Object.assign({},d,{id:doc.id}));});
        resolve(r.length>0?r:_getLocalHistory(limit));
      }).catch(function(){resolve(_getLocalHistory(limit));});}catch(e){resolve(_getLocalHistory(limit));}
    }else resolve(_getLocalHistory(limit));
  });
}
function _getLocalHistory(l){try{var h=JSON.parse(localStorage.getItem(LS_ANALYSES)||"[]");return Array.isArray(h)?h.slice(0,l):[];}catch(e){return[];}}

function dbClearHistory(){
  return new Promise(function(resolve){
    localStorage.removeItem(LS_ANALYSES);localStorage.setItem(LS_COUNT,"0");localStorage.setItem(LS_BUSINESSES,"0");
    try{var d=JSON.parse(localStorage.getItem(LS_DAILY)||"{}");d.count=0;localStorage.setItem(LS_DAILY,JSON.stringify(d));}catch(e){}
    if(_fbReady&&_fbUser&&_fbUser.uid&&_fbDB){
      _fbDB.collection("users").doc(_fbUser.uid).collection("analyses").get().then(function(snap){
        if(snap.empty){resolve();return;}var b=_fbDB.batch();snap.forEach(function(doc){b.delete(doc.ref);});return b.commit();
      }).then(function(){resolve();}).catch(function(){resolve();});
    }else resolve();
  });
}

// ===================== Favorites =====================
function dbSaveFavorite(fav){
  var favs=dbLoadFavorites();
  fav.id="fav_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  fav.timestamp=Date.now();
  favs.unshift(fav);if(favs.length>50)favs.length=50;
  localStorage.setItem(LS_FAVORITES,JSON.stringify(favs));
  return fav;
}
function dbLoadFavorites(){try{var f=JSON.parse(localStorage.getItem(LS_FAVORITES)||"[]");return Array.isArray(f)?f:[];}catch(e){return[];}}
function dbRemoveFavorite(id){
  var favs=dbLoadFavorites().filter(function(f){return f.id!==id;});
  localStorage.setItem(LS_FAVORITES,JSON.stringify(favs));
}
function dbIsFavorite(lat,lng){
  var favs=dbLoadFavorites();
  for(var i=0;i<favs.length;i++){if(Math.abs(favs[i].lat-lat)<0.001&&Math.abs(favs[i].lng-lng)<0.001)return favs[i].id;}
  return false;
}

// ===================== Notes =====================
function dbSaveNote(analysisKey,text){
  var notes=_getNotes();notes[analysisKey]={text:text,timestamp:Date.now()};
  localStorage.setItem(LS_NOTES,JSON.stringify(notes));
}
function dbGetNote(analysisKey){var notes=_getNotes();return notes[analysisKey]||null;}
function dbDeleteNote(analysisKey){var notes=_getNotes();delete notes[analysisKey];localStorage.setItem(LS_NOTES,JSON.stringify(notes));}
function _getNotes(){try{var n=JSON.parse(localStorage.getItem(LS_NOTES)||"{}");return(typeof n==="object"&&n!==null)?n:{};}catch(e){return{};}}

// ===================== Trial =====================
function dbStartTrial(){
  var trial={startDate:Date.now(),days:7,active:true};
  localStorage.setItem(LS_TRIAL,JSON.stringify(trial));
  dbSavePlan("pro");
  return trial;
}
function dbGetTrial(){try{return JSON.parse(localStorage.getItem(LS_TRIAL)||"null");}catch(e){return null;}}
function dbIsTrialActive(){
  var t=dbGetTrial();if(!t||!t.active)return false;
  var elapsed=(Date.now()-t.startDate)/(1000*60*60*24);
  if(elapsed>t.days){t.active=false;localStorage.setItem(LS_TRIAL,JSON.stringify(t));if(dbGetPlan()==="pro")dbSavePlan("free");return false;}
  return true;
}
function dbGetTrialDaysLeft(){
  var t=dbGetTrial();if(!t||!t.active)return 0;
  var left=t.days-((Date.now()-t.startDate)/(1000*60*60*24));
  return Math.max(0,Math.ceil(left));
}

// ===================== Share =====================
function dbGenerateShareId(analysisData){
  var id="share_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  var shares=_getShares();shares[id]=Object.assign({},analysisData,{sharedAt:Date.now()});
  localStorage.setItem(LS_SHARED,JSON.stringify(shares));
  return id;
}
function dbGetSharedAnalysis(id){var s=_getShares();return s[id]||null;}
function _getShares(){try{var s=JSON.parse(localStorage.getItem(LS_SHARED)||"{}");return(typeof s==="object"&&s!==null)?s:{};}catch(e){return{};}}

// ===================== Onboarding =====================
function dbHasSeenOnboarding(){return localStorage.getItem(LS_ONBOARDING)==="true";}
function dbSetOnboardingSeen(){localStorage.setItem(LS_ONBOARDING,"true");}

// ===================== Export CSV =====================
function dbExportCSV(){
  return new Promise(function(resolve){
    var l=dbGetPlanLimits();if(!l.canExport){resolve({success:false,error:"Exportacao requer plano Pro ou superior."});return;}
    dbLoadHistory(100).then(function(h){
      if(!h||h.length===0){resolve({success:false,error:"Nenhuma analise."});return;}
      var csv="Local,Estado,Segmento,Score,Negocios,Nota,Raio,Data\n";
      for(var i=0;i<h.length;i++){var r=h[i];var d=r.timestamp?new Date(r.timestamp).toLocaleDateString("pt-BR"):"";
        csv+='"'+(r.location||"")+'","'+(r.state||"")+'","'+(r.segmento||"")+'",'+(r.score||0)+','+(r.total||0)+',"'+(r.avgRating||"")+'",'+(r.radius||0)+',"'+d+'"\n';
      }
      try{var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="geoopportunity_"+Date.now()+".csv";document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},200);resolve({success:true});}
      catch(e){resolve({success:false,error:"Erro ao gerar."});}
    });
  });
}

// ===================== Admin =====================
function dbIsAdmin(){var s=dbLoadSession();return s&&ADMIN_EMAILS.indexOf(s.email.toLowerCase())>=0;}
function dbAdminGetUsers(){if(!dbIsAdmin())return[];return _getUsers();}
function dbAdminUpdatePlan(email,plan){
  if(!dbIsAdmin())return false;
  var u=_getUsers();for(var i=0;i<u.length;i++){if(_safeEmail(u[i])===email.toLowerCase())u[i].plan=plan;}
  localStorage.setItem(LS_USERS,JSON.stringify(u));return true;
}
function dbAdminDeleteUser(email){
  if(!dbIsAdmin()||ADMIN_EMAILS.indexOf(email.toLowerCase())>=0)return false;
  var u=_getUsers().filter(function(x){return _safeEmail(x)!==email.toLowerCase();});
  localStorage.setItem(LS_USERS,JSON.stringify(u));return true;
}
function dbAdminAddUser(name,email,pass,plan){
  if(!dbIsAdmin())return{success:false};
  var u=_getUsers();
  for(var i=0;i<u.length;i++){if(_safeEmail(u[i])===email.toLowerCase())return{success:false,error:"Email ja existe."};}
  u.push({name:name,email:email,password:pass,plan:plan||"free",uid:"admin_created_"+Date.now()});
  localStorage.setItem(LS_USERS,JSON.stringify(u));return{success:true};
}
function dbAdminResetAll(){
  if(!dbIsAdmin())return;
  var keys=Object.keys(localStorage);for(var i=0;i<keys.length;i++){if(keys[i].indexOf("geoop_")===0)localStorage.removeItem(keys[i]);}
  _seedDemoUser();_seedAdminUser();
}

function dbIsFirebaseReady(){return _fbReady;}
console.log("[DB] v7 loaded — "+(  _fbReady?"Firebase":"localStorage"));
