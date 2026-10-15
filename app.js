(() => {
  'use strict';
  const D = window.PLATFORM_DATA;
  let KEY = 'fair-finance-live-v1:guest';
  const B = () => window.PlatformBackend?.state || {user:null,admin:false,loading:true,connected:false,error:''};
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const saved = read();
  const state = {
    view: ['overview','library','trends','peers','report','sources'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview',
    articles: [],
    sources: [],
    selected: Array.isArray(saved.selected) ? saved.selected : [],
    bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks : [],
    reviewed: saved.reviewed || {}, notes: saved.notes || {},
    title: saved.title || '公平待客暨金融友善資訊週報', introduction: saved.introduction ?? '',
    rangeFrom: saved.rangeFrom || '', rangeTo: saved.rangeTo || '', reportReviewed: false,
    q: '', type: 'all', topic: 'all', year: 'all', priority: 'all', onlySaved: false, onlyPending: false, sort: 'date', overviewType: 'all',
  };
  const views = {overview:'資訊總覽',library:'資訊庫',trends:'趨勢分析',peers:'同業觀測',report:'週報工作台',sources:'資訊來源'};
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    archive:'<path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-6"/>',
    building:'<path d="m3 8 9-5 9 5H3ZM5 9v10m5-10v10m4-10v10m5-10v10M3 21h18"/>',
    report:'<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h8"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 6"/>',
    edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.report}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
  const fmtDate = a => a.date ? a.date.replaceAll('-','.') : '常設專區';
  const priority = p => `<span class="priority ${p}">${({high:'高關注',medium:'中關注',low:'一般'})[p] || '一般'}</span>`;
  const tags = (list, limit = 3) => `<div class="tag-list">${list.slice(0,limit).map((s,j) => `<span class="tag ${j===1?'blue':''}">${esc(s)}</span>`).join('')}${list.length>limit?`<span class="tag gray">+${list.length-limit}</span>`:''}</div>`;
  const btn = (label, action, glyph = '', attrs = '', cls = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${glyph?icon(glyph,15):''}${label}</button>`;
  const persist = () => { const prefs={selected:state.selected,bookmarks:state.bookmarks,notes:state.notes,title:state.title,introduction:state.introduction,rangeFrom:state.rangeFrom,rangeTo:state.rangeTo};try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}window.PlatformBackend?.savePrefs(prefs); };
  let toastTimer;
  function toast(message) { const node = document.getElementById('toast'); node.textContent = message; node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>node.classList.remove('visible'),3100); }
  function counts(list, field) { const result = {}; list.forEach(a => (field==='type'?[a.type]:a[field]).forEach(k=>result[k]=(result[k]||0)+1)); return Object.entries(result).sort((a,b)=>b[1]-a[1]); }
  function filtered() {
    const q = state.q.trim().toLocaleLowerCase();
    return state.articles.filter(a => (!q || [a.title,a.source,a.summary,...a.topics,...a.principles].join(' ').toLocaleLowerCase().includes(q)) && (state.type==='all'||a.type===state.type) && (state.topic==='all'||a.topics.includes(state.topic)) && (state.year==='all'||(state.year==='undated'?!a.date:a.date?.startsWith(state.year))) && (state.priority==='all'||a.priority===state.priority) && (!state.onlySaved||state.bookmarks.includes(a.id)) && (!state.onlyPending||!state.reviewed[a.id])).sort((a,b)=>state.sort==='priority'?({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]):(b.date||'').localeCompare(a.date||''));
  }
  function reportArticles() { return state.selected.map(id=>state.articles.find(a=>a.id===id)).filter(a=>a && (!state.reportReviewed||state.reviewed[a.id]) && (!state.rangeFrom||(a.date&&a.date>=state.rangeFrom)) && (!state.rangeTo||(a.date&&a.date<=state.rangeTo))); }
  function reportIntro(list) { return state.introduction || `本次整理 ${list.length} 則公開資訊，主要涵蓋${counts(list,'topics').slice(0,3).map(x=>x[0]).join('、') || '待選取主題'}。建議優先核對主管機關公告內容，並參考同業的具體服務措施。`; }
  function reportPayload() { const articles = reportArticles().map(a=>({...a,reviewed:!!state.reviewed[a.id],note:state.notes[a.id]||''})); return {title:state.title || '公平待客暨金融友善資訊週報',period:state.rangeFrom||state.rangeTo?`${state.rangeFrom||'不限起日'} 至 ${state.rangeTo||'不限迄日'}`:'自訂選取的公開資訊',introduction:reportIntro(articles),articles,topics:counts(articles,'topics'),notice:'公开來源資料；AI 摘要與參考判讀須核對原文。公開資訊已經人工確認；管理者亦可選入待確認初稿。'.replace('公开','公開')}; }
  function navigate(view) { state.view=view; try { history.replaceState(null,'','#'+view); } catch {} render(); window.scrollTo({top:0,behavior:'instant'}); }
  function heading(title,description,actions='',eyebrow='PUBLIC INSIGHTS · 公開資訊觀測') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`; }
  function render() {
    const navIcons={overview:'grid',library:'archive',trends:'chart',peers:'building',report:'report',sources:'globe'};
    document.getElementById('app').innerHTML = `<div class="mobile-overlay" data-action="close-menu"></div><aside class="sidebar"><button class="mobile-nav-close" data-action="close-menu" aria-label="關閉選單">${icon('close')}</button><div class="brand"><div class="brand-symbol">${icon('shield',27)}</div><div><div class="brand-name">公平待客</div><div class="brand-sub">暨金融友善資訊平台</div></div></div><div class="nav-label">WORKSPACE</div><nav class="nav" aria-label="主要選單">${Object.entries(views).slice(0,5).map(([key,value])=>`<button class="nav-btn ${state.view===key?'active':''}" data-action="view" data-view="${key}" ${state.view===key?'aria-current="page"':''}>${icon(navIcons[key])}<span>${value}</span>${key==='report'?`<span class="nav-count">${state.selected.length}</span>`:''}</button>`).join('')}</nav><div class="nav-divider"></div><div class="nav-label">MANAGEMENT</div><nav class="nav"><button class="nav-btn ${state.view==='sources'?'active':''}" data-action="view" data-view="sources">${icon('globe')}資訊來源</button></nav><div class="sidebar-bottom"><div class="preview-card"><div class="preview-label"><span class="status-dot"></span>${B().connected?'Firestore 已連線':B().loading?'正在讀取資料':'資料庫待連線'}</div><p>公開來源資料與 AI 整理。<br>初稿經人工確認後公開。</p></div><button class="help-btn" data-action="help">${icon('help',16)}使用說明${icon('external',12)}</button></div></aside><div class="workspace"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="開啟選單">${icon('menu',21)}</button><div class="breadcrumbs"><span>觀測中心</span><span>/</span><strong>${views[state.view]}</strong></div><div class="topbar-right"><form class="global-search" id="global-search">${icon('search',15)}<input name="q" aria-label="搜尋公開資訊" placeholder="搜尋資訊、主題或來源" value="${esc(state.q)}"></form><span class="top-date">${new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}</span><button class="top-icon" data-action="notifications" aria-label="查看待確認資訊">${icon('bell',18)}${state.articles.some(a=>!state.reviewed[a.id])?'<span class="notification-dot"></span>':''}</button><button class="btn auth-btn" data-action="${B().user?'account':'login'}">${B().user?(B().admin?'管理者':'我的帳號'):'Google 登入'}</button></div></header><main id="main-content" class="main" tabindex="-1">${page()}</main></div>`;
  }
  function page() {
    const pages={overview,library,trends,peers,report,sources};
    const status=B().error?`<div class="connection-message" role="status">${icon('help',16)}<span>${esc(B().error)}</span><button class="btn-text" data-action="refresh-data">重新連線</button></div>`:B().loading?`<div class="connection-message">${icon('clock',16)}正在讀取雲端公開資訊…</div>`:'';
    return status+pages[state.view]()+`<footer class="page-footer"><span>目前載入最新 ${state.articles.length} 則資訊（上限200則） · AI 摘要請核對原文。</span><span>公平待客暨金融友善資訊平台</span></footer>`;
  }
  function statCards() {
    const cards=[['公開資訊',state.articles.length,'archive','目前載入的公開資訊','library',''],['高關注資訊',state.articles.filter(a=>a.priority==='high').length,'shield','優先追蹤的公告與議題','high','amber'],['待確認資訊',state.articles.filter(a=>!state.reviewed[a.id]).length,'clock','摘要與分類待人工確認','pending',''],['週報選入',state.selected.length,'report','集中整理，隨時匯出','report','']];
    return `<div class="stats-grid">${cards.map(([name,n,g,caption,action,c])=>`<button class="stat-card" data-action="stat" data-target="${action}"><div class="stat-heading">${name}<span class="stat-icon ${c}">${icon(g,18)}</span></div><div class="stat-number">${n}<span class="stat-unit">則</span></div><div class="stat-footer"><span class="desktop-stat">${caption}</span></div></button>`).join('')}</div>`;
  }
  function topicPanel(list=state.articles,limit=5) {
    const data=counts(list,'topics').slice(0,limit),max=data[0]?.[1]||1;
    return `<section class="panel"><div class="panel-head"><h2>主題分布</h2><span class="small-label">${list.length} 則資訊 · 主題可複選</span></div><div class="panel-sub">了解目前收錄資訊的關注面向</div><div class="panel-body"><div class="topic-bars">${data.map(([label,n])=>`<div class="bar-line"><button class="btn-text" data-action="topic" data-topic="${esc(label)}" style="font-size:inherit;color:inherit;justify-content:flex-start;padding:0;text-align:left">${label}</button><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></div><span class="bar-count">${n}</span></div>`).join('') || '<p class="small-muted">尚無符合條件的資料</p>'}</div><div class="panel-footnote">依目前載入資訊的標籤統計，點選主題可查看來源。</div></div></section>`;
  }
  function sourcePanel(list=state.articles) {
    const palette=['#719675','#aac29a','#d3dfc6','#8b9eb4']; const data=counts(list,'type'); let offset=0;
    const circles=data.map(([label,n],j)=>{const part=n/(list.length||1)*100; const s=`<circle cx="50" cy="50" r="39" fill="none" stroke="${palette[j]}" stroke-width="10" pathLength="100" stroke-dasharray="${Math.max(0,part-.7)} ${100-Math.max(0,part-.7)}" stroke-dashoffset="${-offset}"/>`;offset+=part;return s;}).join('');
    return `<section class="panel source-panel"><div class="panel-head"><h2>來源組成</h2><span class="small-label">公開資訊</span></div><div class="panel-sub">主管機關、同業與相關機構</div><div class="panel-body"><div class="source-breakdown"><div class="donut-wrap"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(data.map(([l,n])=>l+' '+n+'則').join('，'))}"><circle cx="50" cy="50" r="39" fill="none" stroke="#f0f4ed" stroke-width="10"/>${circles}</svg><div class="donut-center"><strong>${list.length}</strong><span>公開資訊</span></div></div><div class="legend">${data.map(([l,n],j)=>`<div class="legend-row"><span class="legend-dot" style="background:${palette[j]}"></span>${esc(l)}<b>${n}<span class="small-muted"> 則</span></b></div>`).join('')}</div></div><div class="panel-footnote">來源依目前載入資料統計，範圍不代表全市場。</div></div></section>`;
  }
  function tabs(current, action) {return `<div class="tabs">${[['all','全部資訊'],['主管機關','主管機關'],['同業公告','同業公告'],['相關機構','相關機構']].map(([key,name])=>`<button class="tab ${current===key?'active':''}" data-action="${action}" data-type="${key}">${name}<span class="tab-count">${key==='all'?state.articles.length:state.articles.filter(a=>a.type===key).length}</span></button>`).join('')}</div>`;}
  function table(list, compact=false) {
    if(!list.length) return `<div class="empty-state">${icon('search',31)}<h3>${B().loading?'正在讀取資訊':state.articles.length?'沒有符合條件的資訊':'尚未收錄可顯示的資訊'}</h3><p>${state.articles.length?'試著更換搜尋字詞，或清除篩選條件。':B().admin?'可先初始化來源，再貼入公開網址分析。':'公開資訊會在管理者確認後顯示。'}</p>${btn('清除篩選','clear-filters')}</div>`;
    return `<div class="table-wrap"><table class="info-table"><thead><tr><th><input type="checkbox" class="check" data-change="select-all" aria-label="選取這些資訊加入週報" ${list.every(a=>state.selected.includes(a.id))?'checked':''}></th><th>資訊與主題</th><th>來源</th><th>發布／更新</th><th>關注程度</th><th><span class="hidden">收藏</span></th></tr></thead><tbody>${list.map(a=>`<tr><td><input type="checkbox" class="check" data-change="select" data-id="${esc(a.id)}" aria-label="將${esc(a.title)}加入週報" ${state.selected.includes(a.id)?'checked':''}></td><td class="title-col"><button class="article-title" data-action="detail" data-id="${esc(a.id)}">${esc(a.title)}${state.reviewed[a.id]?`<span class="reviewed-label">${icon('check',10)}</span>`:''}</button>${tags(a.topics,compact?2:3)}</td><td class="source-cell">${esc(a.source)}<div class="source-kind">${esc(a.type)}</div></td><td class="date-cell">${fmtDate(a)}</td><td>${priority(a.priority)}</td><td><button class="icon-btn ${state.bookmarks.includes(a.id)?'saved':''}" data-action="bookmark" data-id="${esc(a.id)}" aria-label="${state.bookmarks.includes(a.id)?'取消收藏':'收藏'}：${esc(a.title)}" aria-pressed="${state.bookmarks.includes(a.id)}">${icon('bookmark',16)}</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function overview() {
    const list=state.articles.filter(a=>state.overviewType==='all'||a.type===state.overviewType).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4);
    return heading('資訊總覽','從監理動態到同業實務，集中掌握值得關注的訊號。',btn('查看收藏','saved','bookmark','','secondary-action')+btn('整理週報','view','report','data-view="report"','btn-primary'))+`<div class="intro-strip"><div class="intro-copy">${icon('spark',19)}<span><strong>把公開資訊，整理成清楚的服務觀點。</strong> 從發現、判讀到報告，一處完成。</span></div><span class="sample-pill">雲端公開資料</span></div>`+statCards()+`<div class="analytics-grid">${topicPanel()}${sourcePanel()}</div><div class="content-grid"><section class="panel table-panel"><div class="panel-head"><h2>最新收錄資訊</h2><button class="btn btn-text" data-action="view" data-view="library">查看全部${icon('arrow',13)}</button></div>${tabs(state.overviewType,'overview-type')}${table(list,true)}<div class="table-footer"><span>顯示 ${list.length} 則公開資訊</span><button class="btn btn-text" data-action="view" data-view="library">前往資訊庫 ${icon('arrow',12)}</button></div></section><aside class="panel focus-panel"><div class="panel-head"><h2>重點速讀</h2>${icon('spark',17)}</div><div class="focus-intro">依公開來源整理的觀測筆記<br>每項重點都能回到原始資訊</div><div class="focus-list">${state.articles.filter(a=>a.priority==='high').slice(0,2).map(a=>[a.id,a.type,a.title,a.summary]).map(([id,type,title,summary])=>`<div class="focus-item"><div class="focus-type">${icon('globe',11)}${esc(type)}</div><h3>${esc(title)}</h3><p>${esc(summary)}</p><button class="focus-link" data-action="detail" data-id="${id}">查看資訊 ${icon('arrow',12)}</button></div>`).join('')}</div><div class="focus-bottom">${icon('shield',12)} 每則摘要保留公開來源與核對依據。</div></aside></div>`;
  }
  function options(values,current,first='全部') {return `<option value="all">${first}</option>${values.map(v=>`<option value="${esc(v)}" ${current===v?'selected':''}>${esc(v)}</option>`).join('')}`;}
  function library() {
    const list=filtered();
    return heading('資訊庫','搜尋公開公告、服務措施與案例，將值得追蹤的資訊加入週報。',(B().admin?btn('新增公開資訊','add-article','plus'):''))+`<section class="panel table-panel"><div class="panel-head" style="padding-bottom:18px"><h2>公開資訊</h2><span class="small-label" id="result-count">${list.length} 則符合條件</span></div>${tabs(state.type,'type')}<div class="filters"><label class="filter-search">${icon('search',14)}<input id="library-query" placeholder="搜尋標題、內容或來源" aria-label="搜尋資訊庫" value="${esc(state.q)}"></label><select class="select-control" data-change="topic" aria-label="主題篩選">${options(D.topics,state.topic,'全部主題')}</select><select class="select-control" data-change="year" aria-label="年份篩選">${options(['2026','2025','2024'],state.year,'全部期間')}<option value="undated" ${state.year==='undated'?'selected':''}>未標示日期</option></select><select class="select-control" data-change="priority" aria-label="關注程度"><option value="all">全部關注程度</option>${['high','medium','low'].map(p=>`<option value="${p}" ${state.priority===p?'selected':''}>${{high:'高關注',medium:'中關注',low:'一般'}[p]}</option>`).join('')}</select><button class="filter-toggle ${state.onlySaved?'on':''}" data-action="saved-toggle">${icon('bookmark',13)}僅收藏</button><button class="filter-toggle ${state.onlyPending?'on':''}" data-action="pending-toggle">${icon('clock',13)}待確認</button><button class="btn btn-text" data-action="clear-filters">清除</button></div><div class="selection-bar"><span>已選入週報 <b>${state.selected.length}</b> 則</span><div class="actions"><button class="btn btn-text" data-action="export" data-format="xlsx">匯出選入資訊 ${icon('download',12)}</button><button class="btn btn-text" data-action="view" data-view="report">整理週報 ${icon('arrow',12)}</button></div></div><div id="library-results">${table(list)}<div class="table-footer"><span>共 ${list.length} 則資訊</span><span>勾選資訊即可加入週報</span></div></div></section>`;
  }
  function timeChart() {
    const dated=state.articles.filter(a=>a.date);const buckets={};dated.forEach(a=>{const k=a.date.slice(0,4);buckets[k]=(buckets[k]||0)+1});const data=Object.entries(buckets).sort();const max=Math.max(1,...data.map(x=>x[1]));
    return `<div class="time-chart"><svg viewBox="0 0 460 190" role="img" aria-label="${esc(data.map(([y,n])=>y+'年 '+n+'則').join('，'))}">${[0,1,2,3].map(j=>`<line x1="25" x2="435" y1="${145-j*40}" y2="${145-j*40}" stroke="#eaf0e5" stroke-dasharray="3 4"/>`).join('')}${data.map(([year,n],j)=>{const x=65+j*340/Math.max(1,data.length-1),h=n/max*110;return `<rect x="${x}" y="${145-h}" width="40" height="${h}" rx="5" fill="${j===data.length-1?'#74986b':'#c2d4b6'}"/><text x="${x+20}" y="${133-h}" fill="#719363" font-size="12" text-anchor="middle">${n}</text><text x="${x+20}" y="172" fill="#8d9f80" font-size="11" text-anchor="middle">${year}</text>`}).join('')}</svg></div>`;
  }
  function trends() {
    const ai=state.trend;
    const insights=ai?`<div class="insight-card"><p>${esc(ai.summary)}</p><p class="small-muted" style="margin-top:10px">${esc(ai.limitations)}</p></div>${ai.insights.map((i,j)=>`<div class="insight-card"><div class="insight-label">${j+1} · ${esc(i.title)}</div><p>${esc(i.detail)}</p><div class="tag-list">${i.articleIds.map(id=>`<button class="tag" data-action="detail" data-id="${id}">查看支持來源</button>`).join('')}</div></div>`).join('')}`:`<div class="insight-card"><p>先收錄至少兩則相關資訊，再由管理者產生 AI 觀測筆記。圖表數字由程式計算，觀察結論保留支持來源。</p></div>`;
    return heading('趨勢分析','從資料分布與來源證據，建立可追溯的觀察。',(B().admin?btn('產生 AI 觀察','ai-trends','spark'):'')+btn('整理週報','view','report','data-view="report"','btn-primary'))+`<div class="intro-strip"><div class="intro-copy">${icon('chart',18)}<span><strong>分析基礎：目前載入 ${state.articles.length} 則公開資訊。</strong> 此統計不代表全市場發生率。</span></div><span class="sample-pill">資料統計</span></div><div class="analytics-grid">${topicPanel(state.articles,8)}${sourcePanel()}</div><div class="trend-grid"><section class="panel"><div class="panel-head"><h2>發布年度分布</h2><span class="small-label">排除未標示日期的資料</span></div><div class="panel-sub">${state.articles.filter(a=>a.date).length} 則有日期資訊</div><div class="panel-body">${timeChart()}<p class="panel-footnote">各年度資料涵蓋程度不同；持續蒐集且確認涵蓋範圍後，才適合比較週、月變化。</p></div></section><section class="panel"><div class="panel-head"><h2>AI 觀測筆記</h2><span class="graph-chip">${ai?'待確認分析':'來源可追溯'}</span></div>${insights}</section></div>`;
  }

  function peers() {
    const rows=state.articles.filter(a=>a.type==='同業公告');const topics=['數位無障礙','高齡友善','溝通協助','實體設施'];
    return heading('同業觀測','整理銀行公開揭露的服務作法，快速比較主題與資料依據。',btn('整理週報','view','report','data-view="report"','btn-primary'))+`<div class="peer-grid">${rows.map(a=>`<article class="panel peer-card"><div class="peer-card-top"><div class="peer-mark">${esc(a.institution.slice(0,1))}</div><span class="small-label">${fmtDate(a)}</span></div><h3>${esc(a.institution)}</h3>${tags(a.topics,3)}<p>${esc(a.summary)}</p>${btn('查看公開資訊','detail','external',`data-id="${a.id}"`)}</article>`).join('')}</div><section class="panel"><div class="panel-head" style="padding-bottom:18px"><h2>公開資料主題比較</h2><span class="small-label">依目前收錄內容</span></div><div class="table-wrap"><table class="info-table comparison"><thead><tr><th>銀行</th>${topics.map(t=>`<th>${t}</th>`).join('')}<th>來源</th></tr></thead><tbody>${rows.map(a=>`<tr><td class="bank-col">${esc(a.institution)}</td>${topics.map(t=>`<td><span class="${a.topics.includes(t)?'check-circle':'check-empty'}">${a.topics.includes(t)?icon('check',16):'—'}<span class="hidden">${a.topics.includes(t)?'資料提及':'資料未提及'}</span></span></td>`).join('')}<td><button class="btn btn-text" data-action="detail" data-id="${a.id}">查看 ${icon('external',12)}</button></td></tr>`).join('')}</tbody></table></div><p class="comparison-note">✓ 代表收錄資料提及此主題；— 代表此筆資料未提及。此表不代表銀行沒有提供該服務，也不作服務品質排名。</p></section>`;
  }
  function paper() {
    const payload=reportPayload();
    return `<article class="paper"><div class="paper-label">PUBLIC INFORMATION BRIEF</div><header class="paper-header"><h2>${esc(payload.title)}</h2><p>${esc(payload.period)}　｜　${payload.articles.length} 則資訊</p></header><section class="paper-section"><h3 class="paper-section-title"><span class="section-number">01</span>觀測重點</h3><p class="paper-note">${esc(payload.introduction)}</p><div class="paper-topic-list">${payload.topics.slice(0,4).map(([t,n])=>`<span class="tag">${esc(t)} · ${n}</span>`).join('')}</div></section><section class="paper-section"><h3 class="paper-section-title"><span class="section-number">02</span>重點資訊與參考判讀</h3>${payload.articles.map((a,j)=>`<div class="paper-item"><h3><span class="report-number">${String(j+1).padStart(2,'0')}</span>${esc(a.title)}</h3><div class="paper-item-meta">${esc(a.source)}　｜　${a.date?esc(a.date):'未標示日期'}　｜　${a.reviewed?'已確認':'待確認'}</div><p>${esc(a.summary)}</p><p class="paper-implication">參考判讀：${esc(a.implication)}</p>${a.note?`<p class="paper-implication">追蹤筆記：${esc(a.note)}</p>`:''}<a class="paper-source" href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">公開來源 ${icon('external',9)}</a></div>`).join('')||'<div class="report-empty">選入資訊後，這裡會顯示報告內容。</div>'}</section><footer class="paper-footer"><span>公開來源資料 · AI 摘要及判讀請核對原文</span><span>公平待客暨金融友善資訊平台</span></footer></article>`;
  }
  function report() {
    const list=reportArticles();
    return heading('週報工作台','選取資訊、編輯重點，再匯出為可編輯的報告檔案。',(B().user?btn('保存週報快照','save-report','report'):'')+btn('回到資訊庫','view','archive','data-view="library"'),'REPORT STUDIO · 資訊整理與匯出')+`<div class="report-grid"><section class="panel report-settings"><div class="panel-head"><h2>報告設定</h2><span class="small-label">私人草稿</span></div><div class="settings-body"><div class="report-config"><label class="field"><span class="field-label">報告名稱</span><input id="report-title" value="${esc(state.title)}" maxlength="100"></label><label class="field"><span class="field-label">觀測重點</span><textarea id="report-introduction" placeholder="${esc(reportIntro(list))}">${esc(state.introduction)}</textarea><span class="field-hint">可自行修改重點；預設文字依選入主題整理。</span></label><div class="field"><span class="field-label">發布／更新日期範圍（選填）</span><div class="date-row"><input type="date" aria-label="起始日期" id="report-from" value="${esc(state.rangeFrom)}"><input type="date" aria-label="結束日期" id="report-to" value="${esc(state.rangeTo)}"></div><p class="field-hint">不填則匯出全部選入資訊；指定日期將排除未標日期的專區。</p></div><label class="filter-toggle"><input class="check" type="checkbox" data-change="report-reviewed" ${state.reportReviewed?'checked':''}>僅匯出已確認資訊</label><div class="export-options">${[['xlsx','Excel','excel-icon'],['docx','Word','word-icon'],['pptx','PowerPoint','ppt-icon']].map(([ext,label,cls])=>`<button data-action="export" data-format="${ext}" ${!list.length?'disabled':''}><span class="${cls}">${icon('report',21)}</span>${label}<span class="file-extension">.${ext}</span></button>`).join('')}</div><p class="note-inline">三種格式皆保留來源、日期、確認狀態及整理筆記。</p><div id="export-progress" class="export-progress" role="status"></div></div><div class="report-selected"><div class="report-selected-heading"><strong>已選入 ${state.selected.length} 則</strong><button class="btn-text" style="font-size:10px" data-action="view" data-view="library">新增</button></div>${state.selected.map(id=>state.articles.find(a=>a.id===id)).filter(Boolean).map(a=>`<div class="selected-item"><span>${esc(a.title)}</span><button data-action="remove-selection" data-id="${a.id}" aria-label="移除${esc(a.title)}">${icon('close',13)}</button></div>`).join('')||'<p class="small-muted">尚未選入資訊。</p>'}<p class="field-hint">本次匯出：${list.length} 則。勾選「已確認」或日期條件會影響匯出內容。</p></div></div></section><div><div class="report-preview-head"><span>${icon('report',13)} 即時報告預覽</span><button class="btn-text" style="font-size:10px" data-action="print">列印預覽 ${icon('external',11)}</button></div><div id="report-paper">${paper()}</div></div></div>`;
  }
  function sources() {
    return heading('資訊來源','建立公開來源清單，依資料性質規劃後續追蹤。',(B().admin?btn('初始化來源','initialize-sources','plus')+btn('手動更新','refresh-sources','globe','','btn-primary')+btn('新增來源','add-source','plus'):''))+`<div class="source-topline">${icon('globe',18)}<span>${B().admin?'來源保存至 Firestore。手動更新會擷取公開來源並產生待確認 AI 初稿。':'這是平台的公開來源清單，管理者可調整追蹤規劃。'}</span></div><section class="panel"><div class="panel-head" style="padding-bottom:19px"><h2>追蹤來源清單</h2><span class="small-label">${state.sources.length} 個來源</span></div><div class="table-wrap"><table class="info-table sources-table"><thead><tr><th>來源名稱</th><th>來源類型</th><th>關注範圍</th><th>取得方式</th><th>規劃狀態</th><th>納入追蹤</th></tr></thead><tbody>${state.sources.map(s=>`<tr><td><a class="source-name" href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ${icon('external',11)}</a><span class="source-url">${esc(new URL(safeURL(s.url)==='#'?'https://example.invalid':s.url).hostname)}</span></td><td class="source-cell">${esc(s.type)}</td><td class="source-cell" style="max-width:180px">${esc(s.scope)}</td><td class="source-cell">${esc(s.method)}</td><td><span class="source-status ${s.enabled?'':'off'}">${s.enabled?'已啟用':'已停用'}</span></td><td><button class="switch ${s.enabled?'on':''}" role="switch" aria-checked="${s.enabled}" aria-label="${esc(s.name)}納入追蹤規劃" data-action="toggle-source" data-id="${esc(s.id)}" ${!B().admin?'disabled':''}></button></td></tr>`).join('')}</tbody></table></div><div class="source-table-bottom">依公開介面與來源規則蒐集。${B().admin?`<div class="pipeline-controls"><span>每日 07:00（臺灣）自動更新：${B().settings?.enabled?'已開啟':'未開啟'}</span>${btn(B().settings?.enabled?'關閉每日更新':'開啟每日更新','pipeline-toggle','clock')}<span>每日 AI 上限 ${B().settings?.dailyLimit||20} 次。</span></div>`:''}${B().lastRun?`<p class="note-inline">最近更新：新增 ${B().lastRun.created||0} 則，略過 ${B().lastRun.skipped||0} 則；${B().lastRun.errors?.length||0} 筆錯誤。</p>`:''}</div></section><section class="panel source-keywords"><div class="panel-head"><h2>主題追蹤範圍</h2><span class="small-label">多面向分類</span></div><div class="panel-body"><div class="tag-cloud">${D.topics.map(t=>`<button class="tag" data-action="topic" data-topic="${t}">${t}</button>`).join('')}</div><p class="panel-footnote">分類可對應公平待客十項原則；後續亦可依年度評核文件調整。</p></div></section>`;
  }
  function showArticle(id) {
    const a=state.articles.find(x=>x.id===id);if(!a)return;
    const form=document.getElementById('form-dialog');if(form.open)form.close();
    const dialog=document.getElementById('detail-dialog');dialog.dataset.id=id;
    dialog.innerHTML=`<button class="dialog-close" data-action="close-detail" aria-label="關閉資訊詳情">${icon('close',17)}</button><div class="detail-content"><div class="detail-kicker">PUBLIC INFORMATION · 資訊詳情</div>${priority(a.priority)}${state.reviewed[id]?`<span class="reviewed-label">${icon('check',12)} 已確認</span>`:''}<h2 id="detail-title">${esc(a.title)}</h2><div class="detail-meta">${esc(a.source)}　·　${esc(a.documentType)}<br>${esc(a.dateLabel)}：${a.date||'未標示'}</div><div class="detail-tags">${tags(a.topics,20)}</div><div class="detail-section"><h3>重點摘要 <span class="custom-label">${a.analysisKind==='gemini'?'Gemini 摘要':'公開內容整理'}</span></h3><p>${esc(a.summary)}</p></div><div class="detail-section"><h3>公開內容重點</h3><ul>${a.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${(a.evidence||[]).map(e=>`<div class="source-evidence"><strong>${esc(e.claim)}</strong><p>原文節錄：${esc(e.quote)}</p></div>`).join('')}<p class="detail-verification">${esc(a.verification)}</p></div><div class="detail-ai"><div class="detail-ai-label">${icon('spark',13)} ${a.analysisKind==='gemini'?'AI 參考判讀 · 請核對來源':'參考判讀'}</div><p>${esc(a.implication)}</p></div><div class="detail-section" style="margin-top:23px"><h3>分類與關注理由</h3>${tags(a.principles,20)}<p class="priority-reason">${esc(a.priorityReason)}</p></div><div class="detail-section detail-notes"><h3>整理筆記</h3><textarea id="detail-note" placeholder="記下需追蹤的事項或補充觀點…">${esc(state.notes[id]||'')}</textarea><small>登入後筆記同步至你的私人工作區，未登入時僅保存在本機。</small></div><a class="btn" href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${icon('external',14)}開啟公開來源</a></div><div class="detail-bottom"><button class="icon-btn ${state.bookmarks.includes(id)?'saved':''}" data-action="bookmark" data-id="${id}" aria-label="收藏此資訊" aria-pressed="${state.bookmarks.includes(id)}">${icon('bookmark',19)}</button><div style="display:flex;gap:8px">${B().admin?btn('編輯摘要','edit-article','edit',`data-id="${id}"`)+btn(state.reviewed[id]?'改為待確認':'確認並公開','review','check',`data-id="${id}"`):''}${btn(state.selected.includes(id)?'已加入週報':'加入週報','select-detail','plus',`data-id="${id}"`,'btn-primary')}</div></div>`;
    if(!dialog.open)dialog.showModal();
  }
  function formModal(content) {const el=document.getElementById('form-dialog');el.innerHTML=`<button class="dialog-close" data-action="close-form" aria-label="關閉視窗">${icon('close',17)}</button><div class="form-content">${content}</div>`;if(!el.open)el.showModal();}
  function help() {formModal(`<h2 id="form-title">公開資訊到週報</h2><p class="description">GitHub Pages 提供介面，Firebase 保存資料與工作區；Gemini 整理公開來源。</p><div class="help-steps"><div class="help-step"><span class="step-num">1</span><div><strong>建立來源</strong>管理者初始化來源後，手動更新或新增公開網址。支援核准來源的 HTML 與文字型 PDF。</div></div><div class="help-step"><span class="step-num">2</span><div><strong>核對 AI 初稿</strong>閱讀摘要、分類及原文依據，確認後公開。整理筆記保存在你的私人工作區。</div></div><div class="help-step"><span class="step-num">3</span><div><strong>整理與匯出</strong>選入資訊，編輯觀測重點，匯出 Excel、Word、PowerPoint。登入後可保存週報快照。</div></div></div><div class="help-status"><strong>首次設定：</strong>啟用 Google 登入、建立 Firestore，並部署規則與後端。<br>第一個管理者須由專案擁有者在 Firestore 的 admins 集合新增對應 UID 文件，enabled 設為布林 true。<br>登入後點右上「我的帳號」可複製 UID。<br>目前資料：${state.articles.length} 則；資料庫${B().connected?'已連線':'待設定'}。</div>`);}

  function addForm(kind) {
    const source=kind==='source';
    formModal(`<h2 id="form-title">${source?'新增公開來源':'新增公開資訊'}</h2><p class="description">${source?'設定會保存至 Firestore；網址須來自核准來源。':'擷取公開網址並由 Gemini 整理。若原站阻擋擷取，可貼入該公開頁面的文字。'}</p><form id="${source?'source-form':'article-form'}"><label class="field"><span class="field-label">${source?'來源名稱':'資訊標題'}</span><input name="title" required maxlength="150" placeholder="${source?'例如：金融消費評議中心':'輸入公開資訊標題'}"></label><label class="field"><span class="field-label">公開網址</span><input name="url" type="url" required placeholder="https://"></label>${!source?'<label class="field"><span class="field-label">發布機構</span><input name="source" required maxlength="80"></label>':''}<label class="field"><span class="field-label">來源類型</span><select name="type">${['主管機關','新聞媒體','同業公告','相關機構'].map(t=>`<option>${t}</option>`).join('')}</select></label>${source?'<label class="field"><span class="field-label">關注範圍</span><input name="scope" required maxlength="150" placeholder="新聞稿、服務措施或公開案例"></label>':`<div class="date-row"><label class="field"><span class="field-label">發布／更新日期</span><input name="date" type="date"></label><label class="field"><span class="field-label">主題</span><select name="topic">${D.topics.map(t=>`<option>${t}</option>`).join('')}</select></label></div><label class="field"><span class="field-label">公開來源文字（選填）</span><textarea name="summary" maxlength="18000" placeholder="留白會自動擷取網址。若原站不允許擷取，可手動貼入公開內容，至少100字。"></textarea></label>`}<div id="form-error" class="form-error" role="alert"></div><div class="btn-row">${btn('取消','close-form')}<button class="btn btn-primary" type="submit">${icon('plus',14)}${source?'新增來源':'擷取並分析'}</button></div></form>`);
  }
  function editForm(id) {
    const a=state.articles.find(x=>x.id===id);if(!a||!B().admin)return;
    const detail=document.getElementById('detail-dialog');if(detail.open)detail.close();
    formModal(`<h2 id="form-title">編輯摘要與分類</h2><p class="description">修正後會恢復為待確認，重新核對後再公開。</p><form id="edit-article-form" data-id="${id}"><label class="field"><span class="field-label">標題</span><input name="title" value="${esc(a.title)}" required maxlength="180"></label><label class="field"><span class="field-label">摘要</span><textarea name="summary" required maxlength="1200">${esc(a.summary)}</textarea></label><label class="field"><span class="field-label">公開內容重點（一行一點）</span><textarea name="facts" required maxlength="1500">${esc(a.facts.join('\n'))}</textarea></label><label class="field"><span class="field-label">參考判讀</span><textarea name="implication" required maxlength="800">${esc(a.implication)}</textarea></label><label class="field"><span class="field-label">關注程度</span><select name="priority">${['high','medium','low'].map(p=>`<option value="${p}" ${a.priority===p?'selected':''}>${{high:'高關注',medium:'中關注',low:'一般'}[p]}</option>`).join('')}</select></label><label class="field"><span class="field-label">關注理由</span><input name="priorityReason" value="${esc(a.priorityReason)}" required maxlength="400"></label><fieldset class="classification-field"><legend>金融友善主題</legend>${D.topics.map(t=>`<label><input class="check" type="checkbox" name="topics" value="${t}" ${a.topics.includes(t)?'checked':''}>${t}</label>`).join('')}</fieldset><fieldset class="classification-field"><legend>公平待客原則</legend>${D.principles.map(t=>`<label><input class="check" type="checkbox" name="principles" value="${t}" ${a.principles.includes(t)?'checked':''}>${t}</label>`).join('')}</fieldset><div id="form-error" class="form-error" role="alert"></div><div class="btn-row">${btn('取消','close-form')}<button type="submit" class="btn btn-primary">保存修正</button></div></form>`);
  }
  function resetFilters(){Object.assign(state,{q:'',type:'all',topic:'all',year:'all',priority:'all',onlySaved:false,onlyPending:false,sort:'date'});}
  function toggleSelection(id){state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];persist();}
  function refreshPaper(){const el=document.getElementById('report-paper');if(el)el.innerHTML=paper();}
  async function exportReport(format) {
    const payload=reportPayload();if(!payload.articles.length){toast('請先選入符合日期及確認條件的資訊。');return;}
    if(state.rangeFrom&&state.rangeTo&&state.rangeFrom>state.rangeTo){toast('起始日期不可晚於結束日期。');return;}
    const indicator=document.getElementById('export-progress');if(indicator)indicator.textContent='正在產製檔案…';
    try{await window.PlatformExports.download(format,payload);toast(`${{xlsx:'Excel',docx:'Word',pptx:'PowerPoint'}[format]} 已產製並開始下載。`);if(indicator)indicator.textContent='檔案已產製，包含公開來源連結。';}catch(e){console.error(e);toast('匯出失敗，請稍後重試。');if(indicator)indicator.textContent='匯出失敗，請重試。';}
  }
  async function backendAction(name,data={},message='作業完成。') {
    try{toast('正在處理，請稍候…');const result=await window.PlatformBackend.call(name,data);await window.PlatformBackend.refresh();toast(message);return result;}catch(e){toast(e.message);throw e;}
  }
  function account() {const user=B().user;if(!user)return;formModal(`<h2 id="form-title">我的帳號</h2><p class="description">${esc(user.email||user.displayName||'Google 帳號')}</p><div class="help-status"><strong>管理權限：</strong>${B().admin?'已啟用':'尚未啟用'}<br><strong>Firebase UID：</strong><br><code class="uid-code">${esc(user.uid)}</code><br>${!B().admin?'由專案擁有者在 Firestore 的 admins 集合新增此 UID 文件，enabled 欄位設為布林 true，重新整理頁面後即可管理。':''}</div><div class="btn-row">${btn('複製 UID','copy-uid','report')}${btn('登出','logout')}</div>`);}
  async function liveReview(id){persist();await backendAction('setArticleReview',{id,published:!state.reviewed[id]},state.reviewed[id]?'已改為待確認。':'已確認並公開。');showArticle(id);}
  document.addEventListener('click',event=>{
    const t=event.target.closest('[data-action]');if(!t)return;const action=t.dataset.action,id=t.dataset.id;
    if(action==='login'){window.PlatformBackend.signIn().catch(e=>toast(e.message));return;}
    if(action==='account'){account();return;}
    if(action==='logout'){document.getElementById('form-dialog').close();window.PlatformBackend.signOut().catch(e=>toast(e.message));return;}
    if(action==='copy-uid'){navigator.clipboard.writeText(B().user.uid).then(()=>toast('UID 已複製。')).catch(()=>toast('請選取 UID 文字複製。'));return;}
    if(action==='refresh-data'){window.PlatformBackend.refresh();return;}
    if(action==='initialize-sources'){backendAction('initializeSources',{},'預設來源已建立。').catch(()=>{});return;}
    if(action==='refresh-sources'){backendAction('refreshSources',{},'更新完成，可至資訊庫查看待確認初稿。').then(r=>{if(r.errors?.length)toast(`新增 ${r.created} 則；${r.errors.length} 筆擷取或分析未完成，請查看來源頁。`);}).catch(()=>{});return;}
    if(action==='pipeline-toggle'){backendAction('setPipeline',{enabled:!B().settings?.enabled,dailyLimit:B().settings?.dailyLimit||20,maxPerRun:B().settings?.maxPerRun||6},'每日更新設定已保存。').catch(()=>{});return;}
    if(action==='ai-trends'){backendAction('analyzeTrends',{ids:state.articles.map(a=>a.id).slice(0,100)},'AI 觀測已整理，請核對支持來源。').then(result=>{state.trend=result;render();}).catch(()=>{});return;}
    if(action==='save-report'){const payload=reportPayload();backendAction('saveReport',{title:payload.title,introduction:payload.introduction,period:payload.period,ids:payload.articles.map(a=>a.id),notes:Object.fromEntries(payload.articles.map(a=>[a.id,a.note]))},'週報快照已保存至私人工作區。').catch(()=>{});return;}
    if(action==='view'){navigate(t.dataset.view);return;}
    if(action==='stat'){resetFilters();if(t.dataset.target==='high')state.priority='high';if(t.dataset.target==='pending')state.onlyPending=true;navigate(t.dataset.target==='report'?'report':'library');return;}
    if(action==='detail'){showArticle(id);return;}
    if(action==='bookmark'){state.bookmarks=state.bookmarks.includes(id)?state.bookmarks.filter(x=>x!==id):[...state.bookmarks,id];persist();render();if(document.getElementById('detail-dialog').open)showArticle(id);return;}
    if(action==='select-detail'){toggleSelection(id);render();showArticle(id);toast(state.selected.includes(id)?'已加入週報。':'已從週報移除。');return;}
    if(action==='remove-selection'){toggleSelection(id);render();return;}
    if(action==='review'){liveReview(id).catch(()=>{});return;}
    if(action==='saved'){resetFilters();state.onlySaved=true;navigate('library');return;}
    if(action==='saved-toggle'){state.onlySaved=!state.onlySaved;render();return;}
    if(action==='pending-toggle'){state.onlyPending=!state.onlyPending;render();return;}
    if(action==='type'){state.type=t.dataset.type;render();return;}
    if(action==='overview-type'){state.overviewType=t.dataset.type;render();return;}
    if(action==='topic'){resetFilters();state.topic=t.dataset.topic;navigate('library');return;}
    if(action==='clear-filters'){resetFilters();render();return;}
    if(action==='export'){exportReport(t.dataset.format);return;}
    if(action==='close-detail'){document.getElementById('detail-dialog').close();return;}
    if(action==='close-form'){document.getElementById('form-dialog').close();return;}
    if(action==='help'){help();return;}
    if(action==='edit-article'){editForm(id);return;}
    if(action==='add-article'){if(!B().admin){toast('請以管理者帳號登入。');return;}addForm('article');return;}
    if(action==='add-source'){if(!B().admin){toast('請以管理者帳號登入。');return;}addForm('source');return;}
    if(action==='toggle-source'){const source=state.sources.find(s=>s.id===id);if(source)backendAction('saveSource',{...source,enabled:!source.enabled},'來源設定已保存。').catch(()=>{});return;}
    if(action==='notifications'){resetFilters();state.onlyPending=true;navigate('library');toast('以下資訊待人工確認。');return;}
    if(action==='menu'){document.querySelector('.sidebar').classList.add('open');document.querySelector('.mobile-overlay').classList.add('open');return;}
    if(action==='close-menu'){document.querySelector('.sidebar').classList.remove('open');document.querySelector('.mobile-overlay').classList.remove('open');return;}
    if(action==='print'){window.print();return;}
  });
  document.addEventListener('input',event=>{
    const t=event.target;
    if(t.id==='library-query'){state.q=t.value;const list=filtered();document.getElementById('library-results').innerHTML=table(list)+`<div class="table-footer"><span>共 ${list.length} 則資訊</span><span>勾選資訊即可加入週報</span></div>`;document.getElementById('result-count').textContent=`${list.length} 則符合條件`;}
    if(t.id==='detail-note'){state.notes[document.getElementById('detail-dialog').dataset.id]=t.value;persist();}
    if(t.id==='report-title'){state.title=t.value;persist();refreshPaper();}
    if(t.id==='report-introduction'){state.introduction=t.value;persist();refreshPaper();}
  });
  document.addEventListener('change',event=>{
    const t=event.target,k=t.dataset.change;
    if(['topic','year','priority'].includes(k)){state[k]=t.value;render();}
    if(k==='select'){toggleSelection(t.dataset.id);render();}
    if(k==='select-all'){const list=state.view==='overview'?state.articles.filter(a=>state.overviewType==='all'||a.type===state.overviewType).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4):filtered();state.selected=t.checked?[...new Set([...state.selected,...list.map(a=>a.id)])]:state.selected.filter(id=>!list.some(a=>a.id===id));persist();render();}
    if(k==='report-reviewed'){state.reportReviewed=t.checked;render();}
    if(t.id==='report-from'||t.id==='report-to'){state[t.id==='report-from'?'rangeFrom':'rangeTo']=t.value;persist();render();}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;event.preventDefault();const values=new FormData(form);
    if(form.id==='global-search'){resetFilters();state.q=String(values.get('q')||'');navigate('library');return;}
    if(form.id==='edit-article-form'){const button=form.querySelector('button[type="submit"]');button.disabled=true;try{await window.PlatformBackend.call('editArticle',{id:form.dataset.id,title:values.get('title'),summary:values.get('summary'),facts:String(values.get('facts')||'').split('\n').filter(Boolean),implication:values.get('implication'),priority:values.get('priority'),priorityReason:values.get('priorityReason'),topics:values.getAll('topics'),principles:values.getAll('principles')});document.getElementById('form-dialog').close();await window.PlatformBackend.refresh();toast('修正已保存，請重新確認後公開。');showArticle(form.dataset.id);}catch(e){document.getElementById('form-error').textContent=e.message;button.disabled=false;}return;}
    if(!['source-form','article-form'].includes(form.id))return;
    const url=safeURL(String(values.get('url')||''));if(url==='#'){document.getElementById('form-error').textContent='請輸入有效的 http 或 https 公開網址。';return;}
    const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent=form.id==='article-form'?'擷取與 AI 分析中…':'儲存中…';}
    try{
      if(form.id==='source-form')await window.PlatformBackend.call('saveSource',{name:String(values.get('title')).trim(),url,type:String(values.get('type')),scope:String(values.get('scope')).trim(),method:'html',enabled:true});
      else {const result=await window.PlatformBackend.call('ingestArticle',{url,title:String(values.get('title')).trim(),source:String(values.get('source')).trim(),type:String(values.get('type')),date:values.get('date')||null,manualText:String(values.get('summary')||'').trim()||undefined});if(result.status==='irrelevant'){document.getElementById('form-error').textContent='AI 判定此篇與追蹤主題關聯不足，未加入資訊庫。';if(submit){submit.disabled=false;submit.textContent='擷取並分析';}return;}}
      document.getElementById('form-dialog').close();await window.PlatformBackend.refresh();toast('已保存至資料庫；AI 初稿待確認。');
    }catch(e){document.getElementById('form-error').textContent=e.message;if(submit){submit.disabled=false;submit.textContent=form.id==='article-form'?'擷取並分析':'新增來源';}}

  });
  window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(views[v]){state.view=v;render();}});
  window.PlatformPreview={state,filtered,reportPayload,counts,render,views};
  render();
  let preferenceUID='guest';
  window.PlatformBackend?.onState(data=>{
    const uid=data.user?.uid||'guest';
    if(uid!==preferenceUID){for(const id of ['detail-dialog','form-dialog']){const dialog=document.getElementById(id);if(dialog.open)dialog.close();dialog.innerHTML='';}preferenceUID=uid;KEY='fair-finance-live-v1:'+uid;const local=read();state.selected=local.selected||[];state.bookmarks=local.bookmarks||[];state.notes=local.notes||{};state.title=local.title||'公平待客暨金融友善資訊週報';state.introduction=local.introduction||'';state.rangeFrom=local.rangeFrom||'';state.rangeTo=local.rangeTo||'';state.trend=null;}
    if(data.prefs!==null&&data.prefs!==state.lastCloudPrefs){state.lastCloudPrefs=data.prefs;for(const key of ['selected','bookmarks','notes','title','introduction','rangeFrom','rangeTo'])if(data.prefs[key]!==undefined)state[key]=data.prefs[key];}
    state.articles=data.articles;state.sources=data.sources;state.reviewed=Object.fromEntries(data.articles.map(a=>[a.id,a.published===true]));
    render();
  });
})();
