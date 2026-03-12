// ============================================================
//  GeoOpportunity AI — Database Module v10
//  All 50 features: Teams, Referrals, Audit, Tasks, Comments,
//  Credits, Alerts, Newsletter, i18n, Affiliates, LGPD, Backup
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
  USERS:"geoop_u10",SESSION:"geoop_s10",ANALYSES:"geoop_a10",COUNT:"geoop_c10",
  PLAN:"geoop_p10",BIZ:"geoop_b10",DAILY:"geoop_d10",FAVS:"geoop_f10",
  NOTES:"geoop_n10",COMPARE:"geoop_cmp10",THEME:"geoop_th10",ONBOARD:"geoop_ob10",
  AI_KEY:"geoop_ai10",STRIPE_KEY:"geoop_sk10",TEAMS:"geoop_tm10",TASKS:"geoop_tk10",
  COMMENTS:"geoop_cm10",REFERRALS:"geoop_rf10",AUDIT:"geoop_au10",ALERTS:"geoop_al10",
  NEWSLETTER:"geoop_nl10",CREDITS:"geoop_cr10",LANG:"geoop_lg10",AFFILIATES:"geoop_af10",
  LGPD:"geoop_lgpd10",BLOG:"geoop_blog10",CALC_HISTORY:"geoop_calc10",
  WATCHZONES:"geoop_wz10",ACTIVITY:"geoop_act10",SNAPSHOTS:"geoop_snap10"
};

var PLAN_LIMITS = {
  free:{radius:1000,results:5,analysesPerDay:5,canExport:false,credits:0,name:"Free"},
  pro:{radius:5000,results:25,analysesPerDay:100,canExport:true,credits:50,name:"Pro"},
  enterprise:{radius:10000,results:50,analysesPerDay:999999,canExport:true,credits:999,name:"Enterprise"}
};

var ADMIN_EMAILS = ["admin@geo.com"];
var _fbReady=false,_fbAuth=null,_fbDB=null,_fbUser=null;

// Helpers
function _se(u){return(u&&typeof u.email==="string")?u.email.toLowerCase():"";}
function _lg(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function _ls(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function _uid(){return"id_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);}

// Firebase
(function(){
  try{
    if(typeof firebase!=="undefined"&&firebase.initializeApp){
      if(!firebase.apps||firebase.apps.length===0)firebase.initializeApp(FIREBASE_CONFIG);
      _fbAuth=firebase.auth();_fbDB=firebase.firestore();_fbReady=true;
      try{_fbDB.enablePersistence({synchronizeTabs:true}).catch(function(){});}catch(e){}
      _fbAuth.onAuthStateChanged(function(u){_fbUser=u||null;});
    }
  }catch(e){_fbReady=false;}
  _seed();
})();

function _seed(){
  var users=_lg(LS.USERS,[]);if(!Array.isArray(users))users=[];
  var has=false,hasA=false;
  for(var i=0;i<users.length;i++){if(_se(users[i])==="demo@geo.com")has=true;if(_se(users[i])==="admin@geo.com")hasA=true;}
  if(!has)users.push({name:"Usuario Demo",email:"demo@geo.com",password:"123456",plan:"free",uid:"demo_001",refCode:"DEMO2024",credits:5});
  if(!hasA)users.push({name:"Administrador",email:"admin@geo.com",password:"admin123",plan:"enterprise",uid:"admin_001",refCode:"ADMIN2024",credits:999});
  _ls(LS.USERS,users);
}

// Auth local
function _localReg(name,email,pass){
  var users=_lg(LS.USERS,[]);
  for(var i=0;i<users.length;i++){if(_se(users[i])===email.toLowerCase())return{success:false,error:"Email ja cadastrado."};}
  var ref="REF"+Date.now().toString(36).toUpperCase().slice(-6);
  var u={name:name,email:email,password:pass,plan:"free",uid:_uid(),refCode:ref,credits:5,createdAt:Date.now()};
  users.push(u);_ls(LS.USERS,users);
  dbAuditLog("register",email,"Novo usuario registrado");
  return{success:true,user:u};
}
function _localLogin(email,pass){
  var users=_lg(LS.USERS,[]);
  for(var i=0;i<users.length;i++){if(_se(users[i])===email.toLowerCase()&&users[i].password===pass){dbAuditLog("login",email,"Login realizado");return{success:true,user:users[i]};}}
  return{success:false,error:"Email ou senha incorretos."};
}
function _fbFail(c){return c==="auth/operation-not-allowed"||c==="auth/configuration-not-found"||c==="auth/internal-error"||c==="auth/network-request-failed"||c==="auth/invalid-api-key";}

// Auth API
function dbRegister(n,e,p){return new Promise(function(res){if(_fbReady&&_fbAuth){try{_fbAuth.createUserWithEmailAndPassword(e,p).then(function(c){_fbUser=c.user;try{c.user.updateProfile({displayName:n});}catch(x){}_localReg(n,e,p);res({success:true,user:{name:n,email:e,uid:c.user.uid,plan:"free"}});}).catch(function(er){if(_fbFail(er.code)){res(_localReg(n,e,p));return;}var m={"auth/email-already-in-use":"Email ja cadastrado.","auth/weak-password":"Senha fraca.","auth/invalid-email":"Email invalido."};res({success:false,error:m[er.code]||er.message});});}catch(x){res(_localReg(n,e,p));}}else res(_localReg(n,e,p));});}

function dbLogin(e,p){return new Promise(function(res){if(_fbReady&&_fbAuth){try{_fbAuth.signInWithEmailAndPassword(e,p).then(function(c){_fbUser=c.user;var plan="free";if(_fbDB)_fbDB.collection("users").doc(c.user.uid).get().then(function(d){if(d.exists&&d.data().plan)plan=d.data().plan;res({success:true,user:{name:c.user.displayName||e.split("@")[0],email:c.user.email,uid:c.user.uid,plan:plan}});}).catch(function(){res({success:true,user:{name:c.user.displayName||e.split("@")[0],email:c.user.email,uid:c.user.uid,plan:"free"}});});else res({success:true,user:{name:c.user.displayName||e.split("@")[0],email:c.user.email,uid:c.user.uid,plan:"free"}});}).catch(function(er){if(_fbFail(er.code)){res(_localLogin(e,p));return;}if(er.code==="auth/user-not-found"||er.code==="auth/wrong-password"||er.code==="auth/invalid-credential"||er.code==="auth/invalid-login-credentials"){var l=_localLogin(e,p);if(l.success){res(l);return;}}res({success:false,error:"Email ou senha incorretos."});});}catch(x){res(_localLogin(e,p));}}else res(_localLogin(e,p));});}

function dbLoginGoogle(){return new Promise(function(res){if(_fbReady&&_fbAuth){var prov=new firebase.auth.GoogleAuthProvider();_fbAuth.signInWithPopup(prov).then(function(c){_fbUser=c.user;_localReg(c.user.displayName||"Google User",c.user.email,"google_"+Date.now());res({success:true,user:{name:c.user.displayName,email:c.user.email,uid:c.user.uid,plan:"free"}});}).catch(function(e){res({success:false,error:e.message||"Erro no login Google."});});}else res({success:false,error:"Firebase nao configurado."});});}

function dbLogout(){return new Promise(function(res){localStorage.removeItem(LS.SESSION);_fbUser=null;dbAuditLog("logout","","Logout");if(_fbReady&&_fbAuth)_fbAuth.signOut().then(res).catch(function(){res();});else res();});}

// Session & Plan
function dbSaveSession(u){_ls(LS.SESSION,u);if(u.plan)localStorage.setItem(LS.PLAN,u.plan);}
function dbLoadSession(){var u=_lg(LS.SESSION,null);return(u&&u.email)?u:null;}
function dbGetPlan(){return localStorage.getItem(LS.PLAN)||"free";}
function dbGetPlanLimits(){return PLAN_LIMITS[dbGetPlan()]||PLAN_LIMITS.free;}
function dbSavePlan(plan){
  localStorage.setItem(LS.PLAN,plan);var s=dbLoadSession();
  if(s){s.plan=plan;dbSaveSession(s);}
  var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(s&&_se(users[i])===_se(s))users[i].plan=plan;}_ls(LS.USERS,users);
  dbAuditLog("plan_change",s?s.email:"","Plano alterado para "+plan);
}

// Daily limits
function dbCanAnalyze(){var l=dbGetPlanLimits();if(l.analysesPerDay>=999999)return true;var d=_lg(LS.DAILY,{});var t=new Date().toISOString().slice(0,10);return d.date!==t||(d.count||0)<l.analysesPerDay;}
function dbGetDailyRemaining(){var l=dbGetPlanLimits();if(l.analysesPerDay>=999999)return 9999;var d=_lg(LS.DAILY,{});var t=new Date().toISOString().slice(0,10);return d.date!==t?l.analysesPerDay:Math.max(0,l.analysesPerDay-(d.count||0));}
function _incDaily(){var d=_lg(LS.DAILY,{});var t=new Date().toISOString().slice(0,10);if(d.date!==t)d={date:t,count:0};d.count++;_ls(LS.DAILY,d);}

// Stats
function dbGetAnalysisCount(){return parseInt(localStorage.getItem(LS.COUNT)||"0",10);}
function dbGetTotalBusinesses(){return parseInt(localStorage.getItem(LS.BIZ)||"0",10);}
function dbAddBusinesses(n){localStorage.setItem(LS.BIZ,(dbGetTotalBusinesses()+n).toString());}

// Analysis CRUD
function dbSaveAnalysis(data){return new Promise(function(res){var e=Object.assign({timestamp:Date.now()},data);localStorage.setItem(LS.COUNT,(dbGetAnalysisCount()+1).toString());_incDaily();var h=_lg(LS.ANALYSES,[]);h.unshift(e);if(h.length>300)h.length=300;_ls(LS.ANALYSES,h);dbActivityLog("analysis",data.location+" - Score "+data.score);if(_fbReady&&_fbUser&&_fbDB){try{_fbDB.collection("users").doc(_fbUser.uid).collection("analyses").add(Object.assign({},e,{createdAt:firebase.firestore.FieldValue.serverTimestamp()})).then(function(){res();}).catch(function(){res();});}catch(x){res();}}else res();});}
function dbLoadHistory(limit){if(!limit)limit=20;return new Promise(function(res){if(_fbReady&&_fbUser&&_fbDB){try{_fbDB.collection("users").doc(_fbUser.uid).collection("analyses").orderBy("createdAt","desc").limit(limit).get().then(function(snap){var r=[];snap.forEach(function(doc){r.push(Object.assign({},doc.data(),{id:doc.id}));});res(r.length>0?r:_lg(LS.ANALYSES,[]).slice(0,limit));}).catch(function(){res(_lg(LS.ANALYSES,[]).slice(0,limit));});}catch(e){res(_lg(LS.ANALYSES,[]).slice(0,limit));}}else res(_lg(LS.ANALYSES,[]).slice(0,limit));});}
function dbClearHistory(){return new Promise(function(res){localStorage.removeItem(LS.ANALYSES);localStorage.setItem(LS.COUNT,"0");localStorage.setItem(LS.BIZ,"0");dbAuditLog("clear_history","","Historico limpo");res();});}

// Export
function dbExportCSV(){return new Promise(function(res){if(!dbGetPlanLimits().canExport){res({success:false,error:"Requer plano Pro."});return;}dbLoadHistory(300).then(function(h){if(!h||!h.length){res({success:false,error:"Sem dados."});return;}var csv="Local,Estado,Segmento,Score,Negocios,Nota,Raio,Data\n";h.forEach(function(d){csv+='"'+(d.location||"")+'","'+(d.state||"")+'","'+(d.segmento||"")+'",'+d.score+','+d.total+',"'+(d.avgRating||"")+'",'+d.radius+',"'+(d.timestamp?new Date(d.timestamp).toLocaleDateString("pt-BR"):"")+"\"\n";});var b=new Blob(["\uFEFF"+csv],{type:"text/csv"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="geo_"+Date.now()+".csv";document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);},200);res({success:true});});});}

// Favorites
function dbGetFavorites(){return _lg(LS.FAVS,[]);}
function dbAddFavorite(f){var favs=dbGetFavorites();favs.unshift(Object.assign({id:Date.now()},f));_ls(LS.FAVS,favs);}
function dbRemoveFavorite(id){_ls(LS.FAVS,dbGetFavorites().filter(function(f){return f.id!==id;}));}
function dbIsFavorite(lat,lng){var f=dbGetFavorites();for(var i=0;i<f.length;i++){if(Math.abs(f[i].lat-lat)<0.001&&Math.abs(f[i].lng-lng)<0.001)return true;}return false;}

// Notes
function dbGetNotes(){return _lg(LS.NOTES,[]);}
function dbAddNote(n){var notes=dbGetNotes();notes.unshift(Object.assign({id:Date.now(),timestamp:Date.now()},n));_ls(LS.NOTES,notes);}
function dbDeleteNote(id){_ls(LS.NOTES,dbGetNotes().filter(function(x){return x.id!==id;}));}

// Compare
function dbGetCompareSlots(){return _lg(LS.COMPARE,[]);}
function dbAddCompareSlot(d){var c=dbGetCompareSlots();if(c.length>=3)c.shift();c.push(Object.assign({id:Date.now()},d));_ls(LS.COMPARE,c);}
function dbClearCompare(){_ls(LS.COMPARE,[]);}

// Theme & Settings
function dbGetTheme(){return localStorage.getItem(LS.THEME)||"dark";}
function dbSetTheme(t){localStorage.setItem(LS.THEME,t);}
function dbHasOnboarded(){return localStorage.getItem(LS.ONBOARD)==="1";}
function dbSetOnboarded(){localStorage.setItem(LS.ONBOARD,"1");}
function dbGetAIKey(){return localStorage.getItem(LS.AI_KEY)||"";}
function dbSetAIKey(k){localStorage.setItem(LS.AI_KEY,k);}
function dbGetStripeKey(){return localStorage.getItem(LS.STRIPE_KEY)||"";}
function dbSetStripeKey(k){localStorage.setItem(LS.STRIPE_KEY,k);}

// ===================== TEAMS / WORKSPACES =====================
function dbGetTeams(){return _lg(LS.TEAMS,[]);}
function dbCreateTeam(name){
  var teams=dbGetTeams(),s=dbLoadSession();if(!s)return null;
  var team={id:_uid(),name:name,owner:s.email,members:[{email:s.email,name:s.name||"",role:"admin"}],createdAt:Date.now()};
  teams.push(team);_ls(LS.TEAMS,teams);dbAuditLog("team_create",s.email,"Time criado: "+name);return team;
}
function dbJoinTeam(teamId){
  var teams=dbGetTeams(),s=dbLoadSession();if(!s)return false;
  for(var i=0;i<teams.length;i++){if(teams[i].id===teamId){var exists=false;for(var j=0;j<teams[i].members.length;j++){if(_se(teams[i].members[j])===_se(s))exists=true;}if(!exists)teams[i].members.push({email:s.email,name:s.name||"",role:"editor"});_ls(LS.TEAMS,teams);dbActivityLog("team_join",s.name+" entrou no time "+teams[i].name);return true;}}return false;
}
function dbLeaveTeam(teamId){
  var teams=dbGetTeams(),s=dbLoadSession();if(!s)return;
  for(var i=0;i<teams.length;i++){if(teams[i].id===teamId){teams[i].members=teams[i].members.filter(function(m){return _se(m)!==_se(s);});if(teams[i].members.length===0)teams.splice(i,1);break;}}_ls(LS.TEAMS,teams);
}
function dbGetMyTeams(){var teams=dbGetTeams(),s=dbLoadSession(),my=[];if(!s)return my;for(var i=0;i<teams.length;i++){for(var j=0;j<teams[i].members.length;j++){if(_se(teams[i].members[j])===_se(s))my.push(teams[i]);}}return my;}
function dbUpdateMemberRole(teamId,email,role){
  var teams=dbGetTeams();
  for(var i=0;i<teams.length;i++){if(teams[i].id===teamId){for(var j=0;j<teams[i].members.length;j++){if(_se(teams[i].members[j])===email.toLowerCase())teams[i].members[j].role=role;}}}_ls(LS.TEAMS,teams);
}
function dbRemoveTeamMember(teamId,email){
  var teams=dbGetTeams();
  for(var i=0;i<teams.length;i++){if(teams[i].id===teamId){teams[i].members=teams[i].members.filter(function(m){return _se(m)!==email.toLowerCase();});}}
  _ls(LS.TEAMS,teams);
}

// ===================== TASKS =====================
function dbGetTasks(teamId){return _lg(LS.TASKS,[]).filter(function(t){return!teamId||t.teamId===teamId;});}
function dbAddTask(task){var tasks=_lg(LS.TASKS,[]);tasks.unshift(Object.assign({id:_uid(),status:"pending",createdAt:Date.now()},task));_ls(LS.TASKS,tasks);dbActivityLog("task_add","Tarefa criada: "+task.title);}
function dbUpdateTask(id,updates){var tasks=_lg(LS.TASKS,[]);for(var i=0;i<tasks.length;i++){if(tasks[i].id===id)Object.assign(tasks[i],updates);}_ls(LS.TASKS,tasks);}
function dbDeleteTask(id){_ls(LS.TASKS,_lg(LS.TASKS,[]).filter(function(t){return t.id!==id;}));}

// ===================== COMMENTS =====================
function dbGetComments(analysisId){return _lg(LS.COMMENTS,[]).filter(function(c){return!analysisId||c.analysisId===analysisId;});}
function dbAddComment(comment){var c=_lg(LS.COMMENTS,[]);var s=dbLoadSession();c.unshift(Object.assign({id:_uid(),author:s?s.name:"Anônimo",authorEmail:s?s.email:"",createdAt:Date.now()},comment));_ls(LS.COMMENTS,c);dbActivityLog("comment","Comentário em "+comment.location);}
function dbDeleteComment(id){_ls(LS.COMMENTS,_lg(LS.COMMENTS,[]).filter(function(c){return c.id!==id;}));}

// ===================== REFERRALS =====================
function dbGetMyRefCode(){var s=dbLoadSession();if(!s)return"";var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===_se(s))return users[i].refCode||"";}return"";}
function dbApplyRefCode(code){
  var users=_lg(LS.USERS,[]),refs=_lg(LS.REFERRALS,[]),s=dbLoadSession();
  if(!s)return{success:false,error:"Faça login primeiro."};
  if(refs.some(function(r){return _se(r)=== _se(s);}))return{success:false,error:"Voce ja usou um codigo."};
  var referrer=null;
  for(var i=0;i<users.length;i++){if(users[i].refCode===code&&_se(users[i])!==_se(s))referrer=users[i];}
  if(!referrer)return{success:false,error:"Codigo invalido."};
  refs.push({email:s.email,referrer:referrer.email,code:code,date:Date.now()});_ls(LS.REFERRALS,refs);
  dbAddCredits(s.email,5);dbAddCredits(referrer.email,10);
  dbAuditLog("referral",s.email,"Usou codigo "+code+" de "+referrer.email);
  return{success:true,msg:"Voce ganhou 5 creditos!"};
}
function dbGetReferralCount(){var s=dbLoadSession();if(!s)return 0;var refs=_lg(LS.REFERRALS,[]);return refs.filter(function(r){return r.referrer===_se(s);}).length;}

// ===================== CREDITS =====================
function dbGetCredits(){var s=dbLoadSession();if(!s)return 0;var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===_se(s))return users[i].credits||0;}return 0;}
function dbAddCredits(email,n){var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===email.toLowerCase())users[i].credits=(users[i].credits||0)+n;}_ls(LS.USERS,users);}
function dbUseCredit(){var s=dbLoadSession();if(!s)return false;var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===_se(s)){if((users[i].credits||0)>0){users[i].credits--;_ls(LS.USERS,users);return true;}}}return false;}

// ===================== AUDIT LOGS =====================
function dbAuditLog(action,email,detail){var logs=_lg(LS.AUDIT,[]);logs.unshift({action:action,email:email||"",detail:detail||"",timestamp:Date.now()});if(logs.length>500)logs.length=500;_ls(LS.AUDIT,logs);}
function dbGetAuditLogs(limit){var logs=_lg(LS.AUDIT,[]);return logs.slice(0,limit||50);}

// ===================== ACTIVITY FEED =====================
function dbActivityLog(type,detail){var acts=_lg(LS.ACTIVITY,[]);var s=dbLoadSession();acts.unshift({type:type,detail:detail,user:s?s.name:"Sistema",email:s?s.email:"",timestamp:Date.now()});if(acts.length>200)acts.length=200;_ls(LS.ACTIVITY,acts);}
function dbGetActivity(limit){return _lg(LS.ACTIVITY,[]).slice(0,limit||20);}

// ===================== WATCHZONES / ALERTS =====================
function dbGetWatchzones(){return _lg(LS.WATCHZONES,[]);}
function dbAddWatchzone(wz){var zones=dbGetWatchzones();zones.push(Object.assign({id:_uid(),createdAt:Date.now()},wz));_ls(LS.WATCHZONES,zones);}
function dbRemoveWatchzone(id){_ls(LS.WATCHZONES,dbGetWatchzones().filter(function(w){return w.id!==id;}));}

// ===================== NEWSLETTER =====================
function dbSubscribeNewsletter(email){var subs=_lg(LS.NEWSLETTER,[]);if(subs.indexOf(email.toLowerCase())<0)subs.push(email.toLowerCase());_ls(LS.NEWSLETTER,subs);return true;}
function dbGetNewsletterSubs(){return _lg(LS.NEWSLETTER,[]);}

// ===================== AFFILIATES =====================
function dbGetAffiliateLink(){var s=dbLoadSession();return s?"https://geoopportunity.com/?ref="+encodeURIComponent(dbGetMyRefCode()):"";}
function dbGetAffiliateStats(){var code=dbGetMyRefCode(),refs=_lg(LS.REFERRALS,[]);var count=refs.filter(function(r){return r.code===code;}).length;return{code:code,referrals:count,earnings:count*10};}

// ===================== LGPD =====================
function dbHasLGPDConsent(){return localStorage.getItem(LS.LGPD)==="1";}
function dbSetLGPDConsent(){localStorage.setItem(LS.LGPD,"1");}
function dbExportUserData(){var s=dbLoadSession();if(!s)return null;return{user:s,analyses:_lg(LS.ANALYSES,[]),favorites:dbGetFavorites(),notes:dbGetNotes(),teams:dbGetMyTeams(),tasks:dbGetTasks(),comments:dbGetComments(),settings:{theme:dbGetTheme(),language:dbGetLanguage()}};}
function dbDeleteUserData(){var s=dbLoadSession();if(!s)return;Object.values(LS).forEach(function(k){localStorage.removeItem(k);});_seed();dbAuditLog("gdpr_delete",s.email,"Dados excluidos por LGPD");}

// ===================== MULTI-LANGUAGE =====================
var TRANSLATIONS={
  "pt-BR":{map:"Mapa Inteligente",dashboard:"Dashboard",premium:"Premium",teams:"Times",calc:"Calculadora",settings:"Configurações",login:"Entrar",register:"Criar conta",logout:"Sair",analyze:"Analisar",score:"Score",businesses:"Negócios",favorites:"Favoritos",notes:"Notas",compare:"Comparar",share:"Compartilhar",export_pdf:"Exportar PDF",search:"Pesquisar...",gps:"Usar minha localização",radius:"Raio",segment:"Segmento",loading:"Carregando...",no_results:"Nenhum resultado",excellent:"Excelente",moderate:"Moderado",saturated:"Saturado",virgin:"Virgem"},
  "en":{map:"Smart Map",dashboard:"Dashboard",premium:"Premium",teams:"Teams",calc:"Calculator",settings:"Settings",login:"Sign In",register:"Sign Up",logout:"Sign Out",analyze:"Analyze",score:"Score",businesses:"Businesses",favorites:"Favorites",notes:"Notes",compare:"Compare",share:"Share",export_pdf:"Export PDF",search:"Search...",gps:"Use my location",radius:"Radius",segment:"Segment",loading:"Loading...",no_results:"No results",excellent:"Excellent",moderate:"Moderate",saturated:"Saturated",virgin:"Virgin"},
  "es":{map:"Mapa Inteligente",dashboard:"Panel",premium:"Premium",teams:"Equipos",calc:"Calculadora",settings:"Configuración",login:"Iniciar sesión",register:"Registrarse",logout:"Salir",analyze:"Analizar",score:"Puntuación",businesses:"Negocios",favorites:"Favoritos",notes:"Notas",compare:"Comparar",share:"Compartir",export_pdf:"Exportar PDF",search:"Buscar...",gps:"Usar mi ubicación",radius:"Radio",segment:"Segmento",loading:"Cargando...",no_results:"Sin resultados",excellent:"Excelente",moderate:"Moderado",saturated:"Saturado",virgin:"Virgen"}
};
function dbGetLanguage(){return localStorage.getItem(LS.LANG)||"pt-BR";}
function dbSetLanguage(l){localStorage.setItem(LS.LANG,l);}
function t(key){var lang=dbGetLanguage();return(TRANSLATIONS[lang]&&TRANSLATIONS[lang][key])||key;}

// ===================== FINANCIAL CALCULATOR =====================
function dbSaveCalcHistory(calc){var h=_lg(LS.CALC_HISTORY,[]);h.unshift(Object.assign({id:_uid(),timestamp:Date.now()},calc));if(h.length>50)h.length=50;_ls(LS.CALC_HISTORY,h);}
function dbGetCalcHistory(){return _lg(LS.CALC_HISTORY,[]);}

// ===================== SNAPSHOTS (temporal tracking) =====================
function dbSaveSnapshot(location,data){var snaps=_lg(LS.SNAPSHOTS,[]);snaps.push({location:location,data:data,date:new Date().toISOString().slice(0,10),timestamp:Date.now()});if(snaps.length>500)snaps.length=500;_ls(LS.SNAPSHOTS,snaps);}
function dbGetSnapshots(location){return _lg(LS.SNAPSHOTS,[]).filter(function(s){return!location||s.location===location;});}

// ===================== BACKUP =====================
function dbFullBackup(){var backup={};Object.keys(LS).forEach(function(k){try{backup[k]=localStorage.getItem(LS[k]);}catch(e){}});var blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="geo_backup_"+Date.now()+".json";document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);},200);}
function dbRestoreBackup(jsonStr){try{var data=JSON.parse(jsonStr);Object.keys(data).forEach(function(k){var lsKey=LS[k];if(lsKey&&data[k])localStorage.setItem(lsKey,data[k]);});return true;}catch(e){return false;}}

// ===================== ADMIN =====================
function dbIsAdmin(){var s=dbLoadSession();return s&&ADMIN_EMAILS.indexOf(_se(s))>=0;}
function dbAdminGetUsers(){return _lg(LS.USERS,[]);}
function dbAdminUpdatePlan(email,plan){var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===email.toLowerCase())users[i].plan=plan;}_ls(LS.USERS,users);dbAuditLog("admin_plan",email,"Plano alterado para "+plan);}
function dbAdminDeleteUser(email){if(ADMIN_EMAILS.indexOf(email.toLowerCase())>=0)return false;_ls(LS.USERS,_lg(LS.USERS,[]).filter(function(u){return _se(u)!==email.toLowerCase();}));dbAuditLog("admin_delete","","Usuario "+email+" excluido");return true;}
function dbAdminAddUser(name,email,pass,plan){var users=_lg(LS.USERS,[]);for(var i=0;i<users.length;i++){if(_se(users[i])===email.toLowerCase())return{success:false,error:"Email ja existe."};}users.push({name:name,email:email,password:pass,plan:plan||"free",uid:_uid(),refCode:"ADM"+Date.now().toString(36).toUpperCase().slice(-4),credits:plan==="pro"?50:plan==="enterprise"?999:5,createdAt:Date.now()});_ls(LS.USERS,users);dbAuditLog("admin_add","","Usuario "+email+" adicionado");return{success:true};}
function dbAdminResetAll(){Object.values(LS).forEach(function(k){localStorage.removeItem(k);});_seed();dbAuditLog("admin_reset","","Reset total");}

// IBGE
function dbFetchIBGE(city,state){return new Promise(function(res){var url="https://servicodados.ibge.gov.br/api/v1/localidades/estados/"+encodeURIComponent(state)+"/municipios";fetch(url).then(function(r){return r.json();}).then(function(data){var found=null;for(var i=0;i<data.length;i++){if(data[i].nome.toLowerCase().indexOf(city.toLowerCase())>=0){found=data[i];break;}}if(found){var pUrl="https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-6/variaveis/9324?localidades=N6["+found.id+"]";fetch(pUrl).then(function(r){return r.json();}).then(function(pd){var pop="N/D";try{var s=pd[0].resultados[0].series[0].serie;var k=Object.keys(s);pop=s[k[k.length-1]];}catch(e){}res({success:true,municipio:found.nome,populacao:pop,id:found.id,microrregiao:found.microrregiao?found.microrregiao.nome:""});}).catch(function(){res({success:true,municipio:found.nome,populacao:"N/D",id:found.id});});}else res({success:false});}).catch(function(){res({success:false});});});}

function dbIsFirebaseReady(){return _fbReady;}
console.log("[DB] v10 loaded — "+(_fbReady?"Firebase":"localStorage"));
