(() => {
  'use strict';
  const listeners=[];
  const state={user:null,admin:false,loading:true,connected:false,articles:[],archives:[],sources:[],settings:null,lastRun:null,status:null,error:'',range:null,snapshot:null,insights:null};
  let db,auth,functions,epoch=0,loadId=0;
  const emit=patch=>{Object.assign(state,patch);listeners.forEach(fn=>fn({...state}));};
  const normalize=d=>({...d.data(),id:d.id});
  function friendly(e){const code=e?.code||'';if(code.startsWith('functions/')&&e.message&&!/INTERNAL|not found/i.test(e.message))return e.message;return ({'auth/unauthorized-domain':'此網站尚未加入登入授權網域。','auth/operation-not-allowed':'請先啟用管理者的 Google 登入。','auth/popup-blocked':'請允許登入視窗彈出後重試。','auth/popup-closed-by-user':'登入視窗已關閉。','permission-denied':'資料讀取權限尚未更新，請由管理者部署新版資料庫規則。','failed-precondition':'資料查詢索引仍在建立，請稍後重試。','functions/not-found':'新版後端尚未部署。'})[code]||String(e.message||'暫時無法連線，請稍後重試。').slice(0,300);}
  async function allPages(query,max=4000){const out=[];let last;while(true){let q=query.limit(200);if(last)q=q.startAfter(last);const snap=await q.get();out.push(...snap.docs.map(normalize));if(out.length>max)throw Error('本次資料超過 4,000 則，請縮短日期範圍後下載。');if(snap.size<200)return out;last=snap.docs[snap.docs.length-1];}throw Error('本次資料超過 4,000 則，請縮短日期範圍後下載。');}
  async function archives(){if(!db)return [];const result=await db.collection('weeklyReports').orderBy('periodStart','desc').limit(100).get();return result.docs.map(normalize);}
  async function refreshAdmin(){if(!state.admin)return;const [sources,settings,runs]=await Promise.all([db.collection('sources').limit(100).get(),db.doc('settings/pipeline').get(),db.collection('runs').orderBy('startedAt','desc').limit(1).get()]);emit({sources:sources.docs.map(normalize),settings:settings.exists?settings.data():null,lastRun:runs.empty?null:normalize(runs.docs[0])});}
  async function loadRange(from,to,{archiveId=null}={}){
    if(!db)return;const ticket=++loadId;emit({loading:true,error:'',range:{from,to},snapshot:null,insights:null,articles:[]});
    try{
      let items,meta=null;const list=await archives();
      if(archiveId)meta=list.find(x=>x.id===archiveId);else meta=list.find(x=>x.periodStart===from&&x.periodEnd===to);
      if(archiveId&&!meta)throw Error('這份歷史週報已不存在，請重新整理清單。');
      if(meta)items=await allPages(db.collection(`weeklyReports/${meta.id}/versions/${meta.activeVersion}/items`).orderBy('order','asc'));
      else {items=await allPages(db.collection('articles').where('published','==',true).where('reportDate','>=',from).where('reportDate','<=',to).orderBy('reportDate','desc'));if(!items.length&&!list.length){const old=await db.collection('articles').where('published','==',true).orderBy('retrievedAt','desc').limit(200).get();items=old.docs.map(normalize).filter(a=>{const day=ReportUtils.articleDay(a);return day>=from&&day<=to;});}}
      const status=await db.doc('publicStatus/collection').get();if(ticket!==loadId)return;
      emit({loading:false,connected:true,articles:ReportUtils.sortArticles(items),archives:list,snapshot:meta,insights:meta?.insights||null,status:status.exists?status.data():null});
    }catch(e){if(ticket===loadId)emit({loading:false,connected:false,error:friendly(e)});}
  }
  async function refresh(){const r=state.range||ReportUtils.bounds();await loadRange(r.from,r.to,{archiveId:state.snapshot?.id});if(state.admin)await refreshAdmin();}
  async function call(name,data={}){if(!functions)throw Error('後端尚未連線。');try{return (await functions.httpsCallable(name,{timeout:540000})(data)).data;}catch(e){throw Error(friendly(e));}}
  async function signIn(){if(!auth)throw Error('登入元件尚未載入。');try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){throw Error(friendly(e));}}
  async function signOut(){await auth.signOut();}
  function onState(fn){listeners.push(fn);fn({...state});return()=>listeners.splice(listeners.indexOf(fn),1);}
  window.PlatformBackend={state,onState,loadRange,refresh,refreshAdmin,call,signIn,signOut,friendly};
  try{
    if(!window.firebase||!window.FIREBASE_CONFIG)throw Error('連線元件未載入，請確認網路後重新整理。');
    const app=firebase.initializeApp(window.FIREBASE_CONFIG);db=app.firestore();auth=app.auth();functions=app.functions(window.PLATFORM_REGION||'asia-east1');
    const range=ReportUtils.bounds();loadRange(range.from,range.to);
    auth.onAuthStateChanged(async user=>{const ticket=++epoch;emit({user:user?{uid:user.uid,email:user.email,displayName:user.displayName}:null,admin:false,sources:[],settings:null,lastRun:null});if(!user)return;try{const doc=await db.doc('admins/'+user.uid).get();if(ticket!==epoch)return;emit({admin:doc.exists&&doc.data().enabled===true});if(state.admin)await refreshAdmin();}catch(e){if(ticket===epoch)emit({error:friendly(e)});}});
  }catch(e){emit({loading:false,error:friendly(e)});}
})();
