/* Shared Firebase adapter. Platform-specific names are declared in data.js. */
(() => {
  'use strict';
  const D = window.PLATFORM_DATA, T = D.collections, listeners = [];
  const state = {
    user: null, admin: false, checkingAdmin: false, loading: true, connected: false,
    articles: [], archives: [], sources: [], settings: null, runtime: null,
    quota: null, lastRun: null, status: null, error: '', range: null, relatedIds: null,
    knowledge: [], knowledgeLoading: false, knowledgeError: '', knowledgeLoaded: false, snapshot: null, insights: null, removed: [], removedLoading: false, removedError: '', removedHasMore: false
  };
  let knowledgeTicket = 0;
  let db, auth, functions, epoch = 0, ticket = 0, removedRequest = 0, removedCursor = null;
  const emit = patch => {
    Object.assign(state, patch);
    listeners.forEach(fn => fn({ ...state }));
  };
  const normal = doc => ({ ...doc.data(), id: doc.id });
  const millis = value => value?.toMillis ? value.toMillis()
    : value?.seconds != null ? value.seconds * 1000 : Date.parse(value) || 0;

  function friendly(error) {
    const code = error?.code || '';
    if (code.startsWith('functions/') && error.message && !/INTERNAL|not found/i.test(error.message)) return error.message;
    return {
      'auth/unauthorized-domain': '此網站尚未加入登入授權網域。',
      'auth/operation-not-allowed': '請啟用管理員的 Google 登入。',
      'auth/popup-blocked': '請允許登入視窗彈出後重試。',
      'auth/popup-closed-by-user': '登入視窗已關閉。',
      'permission-denied': '資料讀取權限尚未設定完成，請由管理員檢查資料庫規則。',
      'failed-precondition': '查詢索引可能仍在建立，請稍後重試。',
      'functions/not-found': '對應的平台後端尚未部署完成。'
    }[code] || String(error.message || '連線未完成，請稍後重試。').slice(0, 300);
  }

  async function pages(query, max = 4000) {
    const items = [];
    let last;
    while (true) {
      let next = query.limit(200);
      if (last) next = next.startAfter(last);
      const page = await next.get();
      items.push(...page.docs.map(normal));
      if (items.length > max) throw Error('資訊超過 4,000 則，請縮短日期範圍。');
      if (page.size < 200) return items;
      last = page.docs[page.docs.length - 1];
    }
  }

  async function loadArchives() {
    const result = await db.collection(T.reports).orderBy('periodStart', 'desc').limit(100).get();
    return result.docs.map(normal);
  }

  async function loadRange(from, to, { archiveId = null } = {}) {
    if (!db) return;
    const request = ++ticket;
    emit({ loading: true, error: '', range: { from, to }, relatedIds: null, knowledge: [], knowledgeLoading: false, knowledgeError: '', knowledgeLoaded: false, snapshot: null, insights: null, articles: [] });
    try {
      const [archives, status] = await Promise.all([
        loadArchives(), db.doc(T.status + '/collection').get()
      ]);
      let articles, snapshot = null, insights = null;
      if (archiveId) {
        snapshot = archives.find(item => item.id === archiveId);
        if (!snapshot) throw Error('這份歷史週報已不存在，請重新整理。');
        articles = await pages(db.collection(`${T.reports}/${snapshot.id}/versions/${snapshot.activeVersion}/items`).orderBy('order', 'asc'));
        insights = snapshot.insights || null;
      } else {
        articles = await pages(db.collection(T.articles).where('published', '==', true)
          .where('reportDate', '>=', from).where('reportDate', '<=', to).orderBy('reportDate', 'desc'));
        const matching = archives.find(item => item.periodStart === from && item.periodEnd === to);
        if (matching && matching.count === articles.length && articles.every(item => millis(item.updatedAt) <= millis(matching.generatedAt))) {
          insights = matching.insights || null;
        }
      }
      if (request !== ticket) return;
      emit({ loading: false, connected: true, articles: ReportUtils.sortArticles(articles),
        archives, status: status.exists ? status.data() : null, snapshot, insights });
    } catch (error) {
      if (request === ticket) emit({ loading: false, connected: false, error: friendly(error) });
    }
  }

  // Only admins can query removed articles. Never merge these into public state.
  async function loadRemoved({ more = false } = {}) {
    if (!state.admin || (more && state.removedLoading)) return;
    const request = ++removedRequest, authEpoch = epoch;
    const prior = more ? state.removed : [];
    if (!more) removedCursor = null;
    emit({ removedLoading: true, removedError: '', ...(more ? {} : { removed: [], removedHasMore: false }) });
    try {
      let query = db.collection(T.articles).where('published', '==', false).limit(200);
      if (more && removedCursor) query = query.startAfter(removedCursor);
      const page = await query.get();
      if (authEpoch !== epoch || request !== removedRequest || !state.admin) return;
      if (page.docs.length) removedCursor = page.docs[page.docs.length - 1];
      const items = [...new Map([...prior, ...page.docs.map(normal)].map(item => [item.id, item])).values()];
      emit({ removed: items, removedLoading: false, removedHasMore: page.size === 200 });
    } catch (error) {
      if (authEpoch === epoch && request === removedRequest && state.admin) {
        emit({ removedLoading: false, removedError: friendly(error) });
      }
    }
  }

  async function loadKnowledge() {
    if (!db || state.knowledgeLoading) return;
    const request = ++knowledgeTicket; emit({ knowledgeLoading: true, knowledgeError: '' });
    try {
      const items = await pages(db.collection(T.knowledge).where('published', '==', true));
      if (request !== knowledgeTicket) return;
      emit({ knowledge: items.sort((a,b) => a.term.localeCompare(b.term,'zh-TW')), knowledgeLoading: false, knowledgeLoaded: true });
    } catch (error) { if (request === knowledgeTicket) emit({ knowledgeLoading: false, knowledgeError: friendly(error) }); }
  }

  async function loadRelated(ids) {
    const request=++ticket;emit({loading:true,error:'',articles:[],snapshot:null,insights:null,relatedIds:ids});
    try {
      const valid=[...new Set(ids||[])].filter(id=>/^[a-f0-9]{64}$/.test(id)).slice(-120),items=[];
      for(let i=0;i<valid.length;i+=20){const page=await db.collection(T.articles).where(firebase.firestore.FieldPath.documentId(),'in',valid.slice(i,i+20)).where('published','==',true).limit(200).get();items.push(...page.docs.map(normal));}
      if(request===ticket)emit({articles:ReportUtils.sortArticles(items),loading:false,connected:true,range:null});
    }catch(error){if(request===ticket)emit({loading:false,error:friendly(error)});}
  }

  async function refreshAdmin() {
    if (!state.admin) return;
    const request = epoch;
    const [sources, settings, runtime, quota, runs] = await Promise.all([
      db.collection(T.sources).limit(100).get(),
      db.doc(T.settings + '/pipeline').get(),
      D.queue ? db.doc(T.settings + '/runtime').get() : null,
      T.quotas ? db.doc(T.quotas + '/' + ReportUtils.today()).get() : null,
      db.collection(T.runs).orderBy('startedAt', 'desc').limit(1).get()
    ]);
    if (request !== epoch || !state.admin) return;
    emit({ sources: sources.docs.map(normal), settings: settings.exists ? settings.data() : null,
      runtime: runtime?.exists ? runtime.data() : null, quota: quota?.exists ? quota.data() : null,
      lastRun: runs.empty ? null : normal(runs.docs[0]) });
  }

  async function refresh() {
    if(state.relatedIds){await loadRelated(state.relatedIds);if(state.admin)await refreshAdmin();return;}
    const range = state.range || ReportUtils.bounds();
    await loadRange(range.from, range.to, { archiveId: state.snapshot?.id });
    if (state.admin) await refreshAdmin();
  }

  async function call(name, data = {}) {
    if (!functions) throw Error('後端尚未連線。');
    if (!Object.values(D.functions).includes(name)) throw Error('函式範圍無效。');
    try { return (await functions.httpsCallable(name, { timeout: 540000 })(data)).data; }
    catch (error) { throw Error(friendly(error)); }
  }
  async function signIn() {
    if (!auth) throw Error('登入元件尚未載入。');
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (error) { throw Error(friendly(error)); }
  }
  async function signOut() { await auth.signOut(); }
  function onState(fn) {
    listeners.push(fn); fn({ ...state });
    return () => { const index = listeners.indexOf(fn); if (index >= 0) listeners.splice(index, 1); };
  }
  window.PlatformBackend = { state, onState, loadRange, loadRelated, loadKnowledge, loadRemoved, refresh, refreshAdmin, call, signIn, signOut, friendly };

  try {
    if (!window.firebase || !window.FIREBASE_CONFIG) throw Error('連線元件未載入，請確認網路後重新整理。');
    const app = D.authAppName ? firebase.initializeApp(window.FIREBASE_CONFIG, D.authAppName)
      : firebase.initializeApp(window.FIREBASE_CONFIG);
    db = app.firestore(); auth = app.auth(); functions = app.functions(window.PLATFORM_REGION || 'asia-east1');
    const range = ReportUtils.bounds();
    loadRange(range.from, range.to);
    auth.onAuthStateChanged(async user => {
      const request = ++epoch;
      ++removedRequest; removedCursor = null;
      emit({ user: user ? { uid: user.uid, email: user.email } : null, admin: false, checkingAdmin: !!user,
        sources: [], settings: null, runtime: null, quota: null, lastRun: null,
        removed: [], removedLoading: false, removedError: '', removedHasMore: false });
      if (!user) return;
      try {
        const admin = await db.doc('admins/' + user.uid).get();
        if (request !== epoch) return;
        emit({ admin: admin.exists && admin.data().enabled === true, checkingAdmin: false });
        if (state.admin) await refreshAdmin();
      } catch (error) {
        if (request === epoch) emit({ error: friendly(error), checkingAdmin: false });
      }
    });
  } catch (error) { emit({ loading: false, error: friendly(error) }); }
})();
