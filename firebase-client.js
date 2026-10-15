(() => {
  'use strict';
  const listeners=[];const state={user:null,admin:false,loading:true,connected:false,articles:[],sources:[],prefs:null,settings:null,lastRun:null,error:'',dataLoaded:false};
  let db,auth,functions,epoch=0,prefsTimer;
  const emit=patch=>{Object.assign(state,patch);listeners.forEach(fn=>fn({...state}));};
  const messages={
    'auth/unauthorized-domain':'請將 finsustcf.github.io 加入 Firebase Authentication 的授權網域。',
    'auth/operation-not-allowed':'請先在 Firebase Authentication 啟用 Google 登入。',
    'auth/popup-blocked':'登入視窗被瀏覽器阻擋，請允許彈出視窗後重試。',
    'permission-denied':'資料庫權限尚未設定完成，請部署 firestore.rules，並確認管理者設定。',
    'failed-precondition':'資料庫索引或後端設定尚未完成，請查看 Firebase 控制台。',
    'functions/not-found':'後端函式尚未部署，請先完成 Firebase Functions 部署。',
    'functions/unavailable':'後端暫時無法連線，請確認函式部署與地區設定。'
  };
  const friendly=e=>{const code=e?.code||'';if(code==='auth/popup-closed-by-user')return '登入視窗已關閉。';if(code.startsWith('functions/')&&e.message&&!/INTERNAL|not found|Failed to fetch/i.test(e.message))return e.message;return messages[code]||'連線未完成：'+String(e.message||code||'未知錯誤').slice(0,300);};
  const normalize=snap=>{const a=snap.data();return {...a,id:snap.id,topics:Array.isArray(a.topics)?a.topics:[],principles:Array.isArray(a.principles)?a.principles:[],facts:Array.isArray(a.facts)?a.facts:[],reviewed:a.published===true};};
  async function refresh({loadPrefs=false}={}) {
    if(!db)return;const current=epoch;const uid=state.user?.uid;emit({loading:true,error:''});
    try{
      let query=db.collection('articles');if(!state.admin)query=query.where('published','==',true);query=query.orderBy('retrievedAt','desc').limit(200);
      const jobs=[query.get(),db.collection('sources').limit(100).get()];
      if(uid&&loadPrefs)jobs.push(db.doc(`users/${uid}/preferences/workspace`).get());
      if(state.admin)jobs.push(db.doc('settings/pipeline').get(),db.collection('runs').orderBy('startedAt','desc').limit(1).get());
      const result=await Promise.all(jobs);if(current!==epoch)return;
      const patch={articles:result[0].docs.map(normalize),sources:result[1].docs.map(d=>({...d.data(),id:d.id})),loading:false,connected:true,dataLoaded:true,error:''};
      let offset=2;if(uid&&loadPrefs){const pref=result[offset++];patch.prefs=pref.exists?pref.data():{};}
      if(state.admin){const settings=result[offset++],runs=result[offset++];patch.settings=settings.exists?settings.data():null;patch.lastRun=runs.empty?null:{...runs.docs[0].data(),id:runs.docs[0].id};}
      emit(patch);
    }catch(e){if(current!==epoch)return;emit({loading:false,connected:false,error:friendly(e)});}
  }
  async function call(name,data={}) {
    if(!functions)throw Error('Firebase SDK 未載入完成。');
    try{return (await functions.httpsCallable(name,{timeout:540000})(data)).data;}catch(e){throw Error(friendly(e));}
  }
  function savePrefs(prefs) {
    clearTimeout(prefsTimer);if(!state.user||!db)return;
    const uid=state.user.uid;const payload={selected:prefs.selected||[],bookmarks:prefs.bookmarks||[],notes:prefs.notes||{},title:prefs.title||'',introduction:prefs.introduction||'',rangeFrom:prefs.rangeFrom||'',rangeTo:prefs.rangeTo||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    prefsTimer=setTimeout(async()=>{if(state.user?.uid!==uid)return;try{await db.doc(`users/${uid}/preferences/workspace`).set(payload);}catch(e){emit({error:'草稿已保存在本機，雲端同步未完成：'+friendly(e)});}},1000);
  }
  function onState(fn){listeners.push(fn);fn({...state});return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};}
  async function signIn(){if(!auth)throw Error('Firebase 登入元件尚未載入。');try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){throw Error(friendly(e));}}
  async function signOut(){clearTimeout(prefsTimer);await auth.signOut();}
  const API={state,onState,refresh,call,savePrefs,signIn,signOut,friendly};window.PlatformBackend=API;
  try{
    if(!window.firebase||!window.FIREBASE_CONFIG)throw Error('Firebase SDK 未載入，請確認網路與檔案上傳。');
    const app=firebase.initializeApp(window.FIREBASE_CONFIG);db=app.firestore();auth=app.auth();functions=app.functions(window.PLATFORM_REGION||'asia-east1');
    auth.onAuthStateChanged(async user=>{
      ++epoch;const current=epoch;clearTimeout(prefsTimer);emit({user:user?{uid:user.uid,email:user.email,displayName:user.displayName}:null,admin:false,prefs:null,settings:null,lastRun:null,loading:true,articles:[],sources:[],dataLoaded:false,error:''});
      if(user){try{const doc=await db.doc('admins/'+user.uid).get();if(current!==epoch)return;emit({admin:doc.exists&&doc.data().enabled===true});}catch(e){if(current!==epoch)return;emit({error:friendly(e)});}}
      await refresh({loadPrefs:!!user});
    });
  }catch(e){emit({loading:false,error:friendly(e)});}
})();
