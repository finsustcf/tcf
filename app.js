/* Shared interface for the two public weekly-report platforms. */
(() => {
  'use strict';
  const D = window.PLATFORM_DATA, U = window.ReportUtils;
  const B = () => window.PlatformBackend.state, $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const paths = {
    leaf: '<path d="M5 15C4 7 12 4 20 5c0 8-4 15-12 14M5 21 16 10"/>',
    book: '<path d="M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm0 14h15M8 7h7M8 11h5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2M8 18h2"/>',
    archive: '<rect x="4" y="4" width="16" height="4" rx="1"/><path d="M5 8v12h14V8m-10 4h6"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
  const state = { page: 'weekly', mode: 'previous', ...U.bounds(), search: '', topic: '', region: '', type: '',
    selected: new Set(), limit: 8, customOpen: false, settingsTab: 'updates', knowledgeSearch: '', knowledgeTopic: '', focusIds: null, feedbackBusy:false,feedbackRequestId:null,busy: false };
  let timer, returnFocus, accountRequested = false, previousUID = null, previousAdmin = false;

  const periodItems = () => B().articles.filter(item => U.articleDay(item) >= state.from && U.articleDay(item) <= state.to)
    .map(item => ({ ...item, topics: Array.isArray(item.topics) ? item.topics : [], region: U.articleRegion(item) }))
    .sort((a, b) => U.articleDay(b).localeCompare(U.articleDay(a)) || a.id.localeCompare(b.id));
  function filtered() {
    const query = state.search.trim().toLocaleLowerCase();
    return periodItems().filter(item => (!state.focusIds || state.focusIds.has(item.id)) && (!state.topic || item.topics.includes(state.topic))
      && (!state.region || (item.region || 'unknown') === state.region) && (!state.type || item.type === state.type)
      && (!query || [item.title, item.summary, item.source, item.implication, ...item.topics].join(' ').toLocaleLowerCase().includes(query)));
  }
  function selectedItems() { return filtered().filter(item => state.selected.has(item.id)); }
  const formatPeriod = () => `${state.from.replaceAll('-', '/')} – ${(state.from.slice(0, 4) === state.to.slice(0, 4) ? state.to.slice(5) : state.to).replaceAll('-', '/')}`;
  const scopeLabel = () => ({ previous: '上週', current: '本週', custom: '自訂期間', archive: '該週' }[state.mode]);
  const modeLabel = () => ({ previous: '上週週報', current: '本週資訊', custom: '自訂期間', archive: '歷史週報' }[state.mode]);
  const time = value => U.timeText(value);
  function toast(message) {
    clearTimeout(timer); $('toast').textContent = message; $('toast').classList.add('visible');
    timer = setTimeout(() => $('toast').classList.remove('visible'), 6000);
  }

  function frame() {
    const adminLabel = B().checkingAdmin ? '確認權限中…' : B().admin ? '管理設定' : B().user ? '帳號資訊' : '管理者登入';
    $('app').innerHTML = `<header class="site-header"><div class="header-inner">
      <a class="brand" href="#weekly" data-action="weekly" aria-label="${esc(D.title)}"><span>${esc(D.brand)}</span></a>
      <nav class="main-nav" aria-label="主要選單"><button class="nav-link ${state.page === 'weekly' ? 'active' : ''}" data-action="weekly" ${state.page === 'weekly' ? 'aria-current="page"' : ''}>週報閱讀</button><button class="nav-link ${state.page === 'history' ? 'active' : ''}" data-action="history" ${state.page === 'history' ? 'aria-current="page"' : ''}>歷史週報</button><button class="nav-link ${state.page === 'knowledge' ? 'active' : ''}" data-action="knowledge" ${state.page === 'knowledge' ? 'aria-current="page"' : ''}>知識庫</button></nav>
      <button class="admin-link" data-action="account" ${B().checkingAdmin ? 'disabled' : ''}>${icon('settings')}${adminLabel}</button>
      </div></header><main id="main-content" class="page-wrap" tabindex="-1"></main>
      <button class="feedback-launch" data-action="feedback">問題回報</button><footer class="site-footer"><p>${esc(D.title)}</p></footer>`;
    if (state.page === 'history') { if(state.mode==='archive') renderWeekly();else renderHistory(); } else if (state.page === 'knowledge') renderKnowledge(); else renderWeekly();
  }

  function renderWeekly() {
    $('main-content').innerHTML = `<div class="period-row">${state.page==='history'?`<div class="archive-controls"><button class="btn" data-action="history">返回週報列表</button></div>`:`<div class="period-tabs" role="group" aria-label="資料期間">
      ${[['previous', '上週週報'], ['current', '本週資訊'], ['custom', '自訂期間']].map(([mode, label]) => `<button class="period-tab ${(state.mode === mode) ? 'active' : ''}" data-action="period" data-mode="${mode}" aria-pressed="${state.mode === mode}">${label}</button>`).join('')}
      </div>`}<p class="updated">更新時間：${time(B().snapshot?.generatedAt || B().status?.lastSuccessAt)}</p></div>
      <div id="custom-period"></div><section class="report-panel" aria-labelledby="report-period"><div class="report-identity">
      <p class="report-label">${icon('calendar')}${modeLabel()}</p><h1 class="report-period" id="report-period">${U.period(state.from,state.to)}</h1><p class="report-count" id="report-count"></p>
      </div></section><section class="highlights" id="highlights" aria-labelledby="highlights-title"></section>
      <section class="information-panel" aria-labelledby="list-title"><div class="information-top"><h2 id="list-title">${scopeLabel()}資訊</h2><div class="export-area"><p class="export-label" id="export-label" aria-live="polite"></p><div class="export-buttons">
      ${[['xlsx', 'Excel'], ['docx', 'Word'], ['pptx', 'PowerPoint']].map(([format, label]) => `<button class="btn export-btn" data-action="export" data-format="${format}">${icon('download')}${label}</button>`).join('')}
      </div></div></div>
      <form class="filter-form" id="filter-form" role="search"><label class="search-field"><span class="sr-only">搜尋標題、摘要或來源</span>${icon('search')}<input id="search-input" type="search" placeholder="搜尋標題、摘要或來源" value="${esc(state.search)}" autocomplete="off"></label>
      <label><span class="sr-only">篩選主題</span><select id="topic-filter"><option value="">全部主題</option>${D.topics.map(topic => `<option ${state.topic === topic ? 'selected' : ''}>${esc(topic)}</option>`).join('')}</select></label>
      <label><span class="sr-only">篩選來源地區</span><select id="region-filter"><option value="">全部來源</option><option ${state.region === '國內' ? 'selected' : ''}>國內</option><option ${state.region === '國外' ? 'selected' : ''}>國外</option><option value="unknown" ${state.region === 'unknown' ? 'selected' : ''}>未標示</option></select></label><label><span class="sr-only">篩選來源類型</span><select id="type-filter"><option value="">全部類型</option>${D.sourceTypes.map(x=>`<option ${state.type===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label></form>
      <div class="list-toolbar"><div class="selection-primary"><label class="select-all"><input type="checkbox" id="select-all">選取全部文章</label><span class="count" id="result-count" role="status" aria-live="polite"></span></div><div class="selection-controls"><span id="selection-count" aria-live="polite"></span><button class="text-btn" data-action="reset-filters" id="reset-filters">清除篩選</button><button class="text-btn" data-action="clear-selection" id="clear-selection">取消選取</button></div></div>
      <div id="news-list"></div><div class="load-more" id="load-more"></div></section>`;
    renderDateForm(); renderHighlights(); renderList();
  }

  function renderDateForm() {
    $('custom-period').innerHTML = state.customOpen ? `<form class="date-form" id="date-form"><label>開始日期<input name="from" type="date" value="${state.draftFrom||state.from}" max="${U.today()}" required></label><label>結束日期<input name="to" type="date" value="${state.draftTo||state.to}" max="${U.today()}" required></label><button class="btn apply-period" type="submit">套用期間</button><p class="date-error" id="date-error" role="alert"></p></form>` : '';
  }
  function renderHighlights() {
    const node=$('highlights');
    if (!['previous','archive'].includes(state.mode) || B().loading || B().error) { node.hidden=true;node.innerHTML='';return; }
    node.hidden=false;const points=U.highlights(periodItems(),B().insights);
    node.innerHTML=`<div class="section-heading"><h2 id="highlights-title">${scopeLabel()}重點</h2></div>${points.length?`<div class="highlight-list">${points.map((item,index)=>`<article class="highlight"><span class="highlight-number">${index+1}</span><div class="highlight-copy"><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div></article>`).join('')}</div>`:'<p class="small-note">'+esc(periodItems().length?(B().snapshot?.highlightsError?(B().admin?'重點未完成：'+B().snapshot.highlightsError:'這份週報的重點整理暫未完成。'):'這份週報尚未產生重點。'):'這段期間尚無收錄資訊。')+'</p>'}`;
  }
  function renderList() {
    const all = periodItems(), items = filtered();
    if (B().loading || B().error) {
      $('report-count').textContent = B().loading ? '讀取資料中…' : '連線尚未完成';
      $('result-count').textContent = '';
      $('news-list').innerHTML = B().loading ? '<div class="loading"><span class="spinner"></span>讀取資訊中…</div>'
        : `<div class="empty-state"><h3>暫時無法讀取資訊</h3><p>${esc(B().error)}</p><button class="btn" data-action="reload">重新讀取</button></div>`;
      $('load-more').innerHTML = ''; renderSelection(); return;
    }
    const unknown = all.filter(item => !item.region).length;
    $('report-count').innerHTML = `<span>${all.length} 則資訊</span><span>國內 ${all.filter(item => item.region === '國內').length}・國外 ${all.filter(item => item.region === '國外').length}${unknown ? '・未標示 ' + unknown : ''}</span>`;
    $('result-count').textContent = items.length === all.length ? `${all.length} 則資訊` : `符合 ${items.length} / ${all.length} 則`;
    $('news-list').innerHTML = items.length ? `<div class="news-list">${items.slice(0, state.limit).map(item => `<article class="news-item ${state.selected.has(item.id) ? 'is-selected' : ''}" id="article-${esc(item.id)}">
      <label class="news-check"><input type="checkbox" data-select="${esc(item.id)}" ${state.selected.has(item.id) ? 'checked' : ''} aria-label="勾選：${esc(item.title)}"></label><div class="news-content">
      <p class="news-meta"><time datetime="${U.articleDay(item)}">${esc(U.dateText(item))}</time>${item.region ? `<span class="dot">${esc(item.region)}</span>` : ''}<span class="dot">${esc(item.source)}</span></p>
      <h3><button class="article-title" data-action="detail" data-id="${esc(item.id)}">${esc(item.title)}</button></h3><p class="news-summary">${esc(item.summary)}</p>
      <div class="news-bottom"><span class="topic-tag">${esc(item.topics[0] || '相關資訊')}</span><button class="detail-link" data-action="detail" data-id="${esc(item.id)}">閱讀內容<span aria-hidden="true">→</span></button></div></div></article>`).join('')}</div>`
      : `<div class="empty-state"><h3>${all.length ? '沒有符合條件的資訊' : '這段期間尚無收錄資訊'}</h3><p>${all.length ? '請調整關鍵字、主題或來源地區。' : '可切換期間查看已收錄的資訊。'}</p><button class="btn" data-action="${all.length ? 'reset-filters' : state.mode === 'previous' ? 'history' : 'previous'}">${all.length ? '清除篩選' : state.mode === 'previous' ? '查看歷史週報' : '查看上週週報'}</button></div>`;
    $('load-more').innerHTML = items.length > state.limit ? `<button class="btn" data-action="more">載入更多（剩餘 ${items.length - state.limit} 則）</button>` : '';
    renderSelection();
  }
  function renderSelection() {
    const items = filtered(), visibleIds = new Set(items.map(item => item.id));
    state.selected = new Set([...state.selected].filter(id => visibleIds.has(id)));
    const count = state.selected.size, all = $('select-all');
    all.checked = items.length > 0 && count === items.length;
    all.indeterminate = count > 0 && count < items.length; all.disabled = !items.length || B().loading;
    $('selection-count').textContent = count ? `已選取 ${count} 則` : '';
    $('clear-selection').hidden = !count;
    $('reset-filters').hidden = !(state.search || state.topic || state.region || state.type || state.focusIds);
    $('export-label').textContent = count ? `下載已選取的 ${count} 則` : `下載目前列表全部 ${items.length} 則`;
    document.querySelectorAll('.export-btn').forEach(button => { button.disabled = state.busy || B().loading || !!B().error || !items.length; });
  }
  function resetFilters() { state.search = ''; state.topic = ''; state.region = ''; state.type = ''; state.focusIds = null; state.selected.clear(); state.limit = 8; }
  async function setPeriod(mode, from, to, archiveId = null) {
    state.mode = mode; state.page = mode==='archive'?'history':'weekly'; Object.assign(state, from ? { from, to } : U.bounds(mode));
    state.customOpen = mode==='custom';state.draftFrom=state.from;state.draftTo=state.to;resetFilters();frame();
    await window.PlatformBackend.loadRange(state.from, state.to, { archiveId, preferArchive: mode==='previous' });
  }
  function renderHistory() {
    const error = B().error;
    $('main-content').innerHTML = `<div class="history-heading"><h1>歷史週報</h1><p>選擇期間後，可閱讀與下載該週封存內容。</p></div>${error ? `<div class="empty-state"><h3>暫時無法讀取週報</h3><p>${esc(error)}</p><button class="btn" data-action="reload">重新讀取</button></div>` : B().archives.length ? `<div class="history-list">${B().archives.map(item => `<button class="history-card" data-action="archive" data-id="${esc(item.id)}" data-from="${esc(item.periodStart)}" data-to="${esc(item.periodEnd)}">${icon('archive')}<span class="history-copy"><strong>${esc(U.period(item.periodStart, item.periodEnd))}</strong><p>${item.count || 0} 則資訊・更新時間：${time(item.generatedAt)}</p></span><span class="history-open">閱讀週報${icon('arrow')}</span></button>`).join('')}</div>` : `<div class="empty-state"><h3>${B().loading ? '讀取週報中…' : '尚無封存週報'}</h3><p>每週一彙整上一週內容。</p></div>`}`;
  }
  function renderKnowledge(){
    $('main-content').innerHTML=`<h1 class="page-heading">知識庫</h1><section class="knowledge-panel"><form id="knowledge-filter" class="knowledge-filters" role="search"><label class="search-field"><span class="sr-only">搜尋名詞、縮寫、中譯或解釋</span>${icon('search')}<input id="knowledge-search" type="search" placeholder="搜尋名詞、縮寫、中譯或解釋" value="${esc(state.knowledgeSearch)}"></label><label><span class="sr-only">主題篩選</span><select id="knowledge-topic"><option value="">全部主題</option>${D.topics.map(x=>`<option ${state.knowledgeTopic===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label></form><div class="glossary-head" aria-hidden="true"><span>名詞</span><span>縮寫</span><span>中譯</span><span>解釋</span></div><div id="knowledge-list"></div></section>`;renderKnowledgeList();
  }
  function renderKnowledgeList(){
    if(B().knowledgeLoading&&!(B().knowledge||[]).length){$('knowledge-list').innerHTML='<div class="loading" role="status">讀取知識庫中…</div>';return;}
    if(B().knowledgeError&&!(B().knowledge||[]).length){$('knowledge-list').innerHTML=`<div class="empty-state"><h2>暫時無法讀取知識庫</h2><p>${esc(B().knowledgeError)}</p><button class="btn" data-action="reload-knowledge">重新讀取</button></div>`;return;}
    const normalize=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,''),q=normalize(state.knowledgeSearch);
    const items=(B().knowledge||[]).map(x=>({...x,view:U.knowledgeFields(x)})).filter(x=>(!state.knowledgeTopic||(x.topics||[]).includes(state.knowledgeTopic))&&(!q||[x.view.term,x.view.abbreviation,x.view.translation,x.view.definition,...x.aliases||[]].some(v=>normalize(v).includes(q))));
    $('knowledge-list').innerHTML=(B().knowledgeError?`<p class="small-note" role="status">部分詞條無法更新：${esc(B().knowledgeError)}。已載入內容仍可查閱。</p>`:'')+(items.length?items.map(x=>`<article class="knowledge-term"><h2>${esc(x.view.term)}</h2><span class="abbr">${esc(x.view.abbreviation)}</span><span class="translation">${esc(x.view.translation)}</span><p>${esc(x.view.definition)}</p></article>`).join(''):'<div class="empty-state"><h2>沒有符合的詞條</h2><p>請調整關鍵字或主題。</p></div>');
  }
  function showDialog(node) { returnFocus = document.activeElement; if (!node.open) node.showModal(); node.scrollTop = 0; }
  function close(node) { node.close(); }
  function detail(id) {
    const item = B().articles.find(article => article.id === id); if (!item) return;
    $('detail-dialog').innerHTML = `<button class="dialog-close" data-action="close-detail" aria-label="關閉內容">${icon('close')}</button><div class="detail-body"><p class="news-meta"><span>${esc(U.dateText(item))}</span>${U.articleRegion(item) ? `<span>${esc(U.articleRegion(item))}</span>` : ''}<span>${esc(item.source)}</span></p><h2 id="detail-title">${esc(item.title)}</h2>
      <section><h3>重點摘要</h3><p>${esc(item.summary)}</p></section>${item.implication ? `<section><h3>值得關注</h3><p>${esc(item.implication)}</p></section>` : ''}
      ${U.attachments(item).length ? `<section><h3>附件</h3><ul class="attachment-list">${U.attachments(item).map(file=>`<li><a href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">${esc(file.name)}${icon('external')}</a></li>`).join('')}</ul></section>` : ''}
      ${(item.alternateSources || []).length ? `<section><h3>相關報導</h3>${item.alternateSources.map(source => `<p><a href="${esc(U.safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.source)}</a></p>`).join('')}</section>` : ''}</div>
      <div class="detail-actions"><a class="btn" href="${esc(U.safeURL(item.url))}" target="_blank" rel="noopener noreferrer">查看原文${icon('external')}</a><button class="btn" data-action="detail-select" data-id="${esc(id)}">${state.selected.has(id) ? '取消勾選' : '加入下載'}</button>${B().admin && !B().snapshot ? `<button class="text-btn" data-action="edit" data-id="${esc(id)}">編輯</button><button class="text-btn" data-action="hide" data-id="${esc(id)}">移除</button>` : ''}</div>`;
    showDialog($('detail-dialog'));
  }
  function account() {
    if (B().checkingAdmin) return;
    if (B().admin) { settingsDialog(); return; }
    if (!B().user) { accountRequested = true; window.PlatformBackend.signIn().catch(error => { accountRequested = false; toast(error.message); }); return; }
    $('settings-dialog').innerHTML = `<button class="dialog-close" data-action="close-settings" aria-label="關閉帳號資訊">${icon('close')}</button><h2 id="settings-title" class="dialog-title">帳號資訊</h2><p>${esc(B().user.email)}</p><p class="settings-note">此帳號尚未設定管理權限。</p><label class="field">Firebase UID<input id="uid-value" readonly value="${esc(B().user.uid)}"></label><div class="settings-actions"><button class="btn" data-action="copy-uid">複製 UID</button><button class="text-btn" data-action="logout">登出</button></div>`;
    showDialog($('settings-dialog'));
  }
  function sourceForm() {
    return `<form id="source-form" class="stack-form"><label class="field">來源名稱<input name="name" required maxlength="100"></label><label class="field">公開列表或 RSS 網址<input name="url" type="url" required placeholder="https://"></label><div class="field-pair"><label class="field">類型<select name="type">${D.sourceTypes.map(type => `<option>${esc(type)}</option>`).join('')}</select></label><label class="field">來源地區<select name="region"><option>國內</option><option>國外</option></select></label><label class="field">讀取方式<select name="method"><option value="html">公開網頁列表</option><option value="rss">RSS 訂閱</option></select></label></div><p class="small-note">來源需符合後端允許的網站清單。</p><p class="form-error" id="form-error" role="alert"></p><button class="btn btn-primary" ${state.busy ? 'disabled' : ''}>新增來源</button></form>`;
  }
  function articleForm(item) {
    const edit = !!item;
    return `<form id="${edit ? 'edit' : 'article'}-form" class="stack-form" ${edit ? `data-id="${esc(item.id)}"` : ''}><label class="field">資訊標題<input name="title" required maxlength="180" value="${esc(item?.title || '')}"></label>${edit ? `<label class="field">重點摘要<textarea name="summary" required rows="6" maxlength="${D.summaryLimit}">${esc(item.summary)}</textarea></label><label class="field">值得關注<textarea name="implication" rows="4" maxlength="800">${esc(item.implication)}</textarea></label><label class="field">主要主題<select name="topic">${D.topics.map(topic => `<option ${item.topics?.[0] === topic ? 'selected' : ''}>${esc(topic)}</option>`).join('')}</select></label>` : `<label class="field">原文網址<input name="url" type="url" required placeholder="https://"></label><label class="field">來源名稱<input name="source" required maxlength="100"></label><div class="field-pair"><label class="field">類型<select name="type">${D.sourceTypes.map(type => `<option>${esc(type)}</option>`).join('')}</select></label><label class="field">來源地區<select name="region"><option>國內</option><option>國外</option></select></label></div><label class="field">發布日期（選填）<input name="date" type="date" max="${U.today()}"></label><label class="field">公開文字（選填）<textarea name="manualText" rows="5" maxlength="18000" placeholder="原網站讀取受限時，可貼入同一網址的公開文字，至少100字。"></textarea></label>`}<p class="form-error" id="form-error" role="alert"></p><button class="btn btn-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '處理中…' : edit ? '儲存修改' : '擷取並整理'}</button></form>`;
  }
  function pendingSection(){
    const backend=B(),items=backend.pendingItems||[],sources=(backend.sources||[]).filter(x=>x.enabled&&x.lastError);
    const generic=(backend.lastRun?.errors||[]).filter(x=>!x.url&&!x.title&&x.source==='更新作業');
    return `<section class="pending-section"><div class="section-heading"><h3>待處理資訊</h3><button class="text-btn" data-action="reload-pending" ${state.busy||backend.pendingLoading?'disabled':''}>重新讀取</button></div>
    ${backend.pendingError?`<p class="form-error" role="alert">${esc(backend.pendingError)}</p>`:''}
    ${items.map(x=>`<article class="pending-row"><div><h4>${esc(x.title)}</h4><p>來源：${esc(x.source)}</p><p>原因：${esc(x.reason||'等待下一次更新處理')}</p>${U.safeURL(x.url)?`<a href="${esc(U.safeURL(x.url))}" target="_blank" rel="noopener noreferrer">查看原文</a>`:''}</div><button class="btn" data-action="skip-pending" data-id="${esc(x.id)}" ${state.busy?'disabled':''}>略過</button></article>`).join('')}
    ${sources.map(x=>`<article class="pending-row"><div><h4>${esc(x.name)}</h4><p>來源清單讀取失敗（尚未取得文章）</p><p>原因：${esc(x.lastError)}</p></div></article>`).join('')}
    ${generic.map(x=>`<p>更新作業：${esc(x.message)}</p>`).join('')}
    ${backend.pendingLoading?'<p role="status">讀取待處理資訊中…</p>':!items.length&&!sources.length&&!generic.length&&!backend.pendingError?'<p class="small-note">目前沒有待處理資訊。</p>':''}
    ${backend.pendingCursor?`<button class="btn" data-action="more-pending" ${state.busy||backend.pendingLoading?'disabled':''}>載入更多待處理資訊</button>`:''}</section>`;
  }

  function settingsDialog() {
    if (!B().admin) return;
    const backend = B(), settings = backend.settings || {}, run = backend.lastRun;const week=backend.archives.find(x=>x.periodStart===U.bounds().from);const hasPoints=!!week?.insights?.insights?.length;
    const ready = !!backend.settings && (!D.requiresUpgrade || settings.version === 3);
    const sourceRows = media => {
      const sources = backend.sources.filter(source => (source.type === '新聞媒體') === media);
      return sources.length ? sources.map(source => `<div class="source-row"><div><a href="${esc(U.safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a><small>${[U.articleRegion(source), source.type, source.enabled ? '使用中' : '已停用'].filter(Boolean).map(esc).join('・')}</small>${source.lastError ? `<small class="source-error">${esc(source.lastError)}</small>` : ''}</div><button class="btn ${source.enabled?'action-stop':'action-start'}" data-action="toggle-source" data-id="${esc(source.id)}" ${state.busy ? 'disabled' : ''}>${source.enabled ? '停用' : '啟用'}</button></div>`).join('') : '<p class="small-note">尚未設定此類來源。</p>';
    };
    let content;
    if (state.settingsTab === 'sources') {
      content = `<section class="source-group"><h3>主管機關、同業與相關機構</h3>${sourceRows(false)}<h3>新聞媒體</h3>${sourceRows(true)}<details class="advanced-settings"><summary>新增來源</summary>${sourceForm()}</details></section>`;
    } else if(state.settingsTab==='feedback'){
      content=`<section><h3>問題回報</h3><button class="btn" data-action="reload-feedback" ${backend.feedbackLoading?'disabled':''}>重新讀取</button>${backend.feedbackLoading?'<p role="status">讀取中…</p>':''}${backend.feedbackError?`<p role="alert">${esc(backend.feedbackError)}</p>`:''}${(backend.feedback||[]).map(x=>`<article class="feedback-item"><p class="small-note">${time(x.createdAt)}｜${esc(x.category)}</p><h4>${esc(x.email)}</h4><p class="feedback-message">${esc(x.message)}</p><p class="small-note">${esc(x.view)}｜${esc(x.page)}</p></article>`).join('')||(!backend.feedbackLoading?'<p>目前沒有問題回報。</p>':'')}<p class="small-note">顯示最近100筆；聯絡信箱與內容僅管理員可見。</p></section>`;
    } else if (state.settingsTab === 'removed') {
      const items = backend.removed || [];
      content = `<section class="removed-section"><div class="section-heading"><h3>已移除資訊</h3><button class="text-btn" data-action="reload-removed" ${backend.removedLoading || state.busy ? 'disabled' : ''}>重新讀取</button></div><p class="small-note">這些資訊未公開顯示；還原後會回到原發布日期所屬的期間。歷史封存週報不會自動改寫。</p>
        ${backend.removedError ? `<p class="form-error" role="alert">${esc(backend.removedError)}</p>` : ''}
        ${items.length ? `<div class="removed-list">${items.map(item => `<article class="removed-item"><div class="removed-copy"><p class="news-meta">${esc(U.dateText(item))}・${esc(item.source)}</p><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><a href="${esc(U.safeURL(item.url))}" target="_blank" rel="noopener noreferrer">查看原文</a></div><button class="btn" data-action="restore" data-id="${esc(item.id)}" ${state.busy || backend.removedLoading ? 'disabled' : ''}>還原</button><button class="btn danger-btn" data-action="permanent-delete" data-id="${esc(item.id)}" ${state.busy?'disabled':''}>永久刪除</button></article>`).join('')}</div>` : !backend.removedLoading && !backend.removedError ? '<p class="removed-empty">目前沒有已移除的資訊。</p>' : ''}
        ${backend.removedLoading ? '<p class="loading" role="status">讀取已移除資訊中…</p>' : ''}
        ${backend.removedHasMore ? `<button class="btn" data-action="more-removed" ${backend.removedLoading || state.busy ? 'disabled' : ''}>載入更多已移除資訊</button>` : ''}</section>`;
    } else if (state.settingsTab === 'add') {
      content = articleForm();
    } else {
      content = `<section class="settings-section"><div class="schedule-row"><span>資訊蒐集</span><strong>每天 08:00、12:00、16:00</strong></div><div class="schedule-row"><span>上週週報整理</span><strong>週一 00:00 啟動</strong></div><div class="pipeline-state"><span class="status-dot ${settings.enabled ? 'enabled' : ''}"></span>自動更新${settings.enabled ? '已開啟' : '尚未開啟'}</div>
        <div class="settings-actions">${!ready ? `<button class="btn btn-primary" data-action="initialize" ${state.busy ? 'disabled' : ''}>啟用平台與預設來源</button>` : `<button class="btn ${settings.enabled?'action-stop':'action-start'}" data-action="toggle-pipeline" ${state.busy ? 'disabled' : ''}>${settings.enabled ? '暫停自動更新' : '開啟自動更新'}</button><button class="btn" data-action="collect" ${state.busy ? 'disabled' : ''}>${state.busy ? '處理中…' : '立即更新'}</button><button class="btn" data-action="build-weekly" ${state.busy ? 'disabled' : ''}>重新彙整上週週報</button>`}</div>
        <section class="run-status"><h3>上週週報整理狀態</h3><p>${week?`文章已封存 ${week.count||0} 則｜${hasPoints?(week.highlightsError?'沿用先前重點，本次整理未完成':'重點已完成'):week.count?'重點未完成':'期間內沒有資訊'}`:'尚未封存上週週報'}</p>${week&&week.count&&(week.highlightsError||!hasPoints)?`<p class="form-error">${esc(week.highlightsError||'重點尚未產生，請重新彙整上週週報。')}</p>`:''}</section>
        ${backend.runtime?.message ? `<p class="status-message">${esc(backend.runtime.message)}</p>` : ''}
        ${run ? `<div class="run-status"><h3>最近一次更新</h3><p>${time(run.startedAt)}・新增 ${run.created||0} 則${run.state==='running'?'・執行中':''}</p>${run.message?`<p>${esc(run.message)}</p>`:''}</div>`:''}${pendingSection()}
        </section>`;
    }
    $('settings-dialog').innerHTML = `<button class="dialog-close" data-action="close-settings" aria-label="關閉管理設定">${icon('close')}</button><h2 class="dialog-title" id="settings-title">管理設定</h2><div class="settings-tabs" role="group" aria-label="設定分類">${[['updates', '更新設定'], ['sources', '資訊來源'], ['add', '新增資訊'], ['removed', '已移除資訊'], ['feedback', '問題回報']].map(([tab, title]) => `<button class="period-tab ${state.settingsTab === tab ? 'active' : ''}" data-action="settings-tab" data-tab="${tab}" aria-pressed="${state.settingsTab === tab}">${title}</button>`).join('')}</div>${content}<div class="admin-footer"><span>${esc(backend.user?.email)}</span><button class="text-btn" data-action="logout">登出</button></div>`;
    showDialog($('settings-dialog'));
  }
  async function task(action, data, message) {
    if (state.busy || !B().admin || !D.functions[action]) return;
    state.busy = true;
    document.querySelectorAll('#settings-dialog button').forEach(button => { button.disabled = true; });
    try {
      const result = await window.PlatformBackend.call(D.functions[action], data);
      await window.PlatformBackend.refresh();
      if (state.settingsTab === 'removed' && B().admin) await window.PlatformBackend.loadRemoved();
      toast(typeof message === 'function' ? message(result) : message);
      if ($('settings-dialog').open && B().admin) settingsDialog();
      return result;
    } catch (error) {
      toast(error.message); const messageNode = $('form-error'); if (messageNode) messageNode.textContent = error.message;
    } finally {
      state.busy = false;
      document.querySelectorAll('#settings-dialog button').forEach(button => { button.disabled = false; });
      if ($('select-all')) renderSelection();
    }
  }
  function payload() {
    const articles=(state.selected.size?selectedItems():filtered()).map(U.reportArticle);
    const wholeWeek=['previous','archive'].includes(state.mode)&&!!B().snapshot&&articles.length===periodItems().length&&!state.search&&!state.topic&&!state.region&&!state.type&&!state.focusIds;
    return {title:D.title,from:state.from,to:state.to,period:U.period(state.from,state.to),articles,topics:U.topics(articles),introduction:'',sectionLabel:scopeLabel(),includeHighlights:wholeWeek,highlights:wholeWeek?U.highlights(articles,B().insights):[],insights:wholeWeek?B().insights:null};
  }
  async function download(format) {
    if (state.busy || B().loading || B().error) return;
    const report = payload(); if (!report.articles.length) return;
    state.busy = true; renderSelection();
    try { await window.PlatformExports.download(format, report); toast(`已產生 ${format === 'xlsx' ? 'Excel' : format === 'docx' ? 'Word' : 'PowerPoint'} 檔案，共 ${report.articles.length} 則資訊。`); }
    catch (error) { toast('下載未完成：' + error.message); }
    finally { state.busy = false; if ($('select-all')) renderSelection(); }
  }


  function openFeedback(){
    state.feedbackRequestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    $('feedback-dialog').innerHTML=`<button class="dialog-close" data-action="close-feedback" aria-label="關閉問題回報">${icon('close')}</button><h2 id="feedback-title" class="dialog-title">問題回報</h2><form id="feedback-form" class="stack-form"><label class="field">問題類型<select name="category" required><option value="">請選擇</option>${['介面','資料內容','下載','其他'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field">問題說明<textarea name="message" required maxlength="2000" rows="5"></textarea></label><label class="field">聯絡信箱<input name="email" type="email" required maxlength="254" autocomplete="email"></label><p class="small-note">三個欄位皆必填，回報內容與信箱僅供管理員查看。系統會附上平台、頁面與回報時間。</p><p id="feedback-error" class="form-error" role="alert"></p><button class="btn" type="submit">送出回報</button></form>`;
    showDialog($('feedback-dialog'));
  }
  async function sendFeedback(form,values){
    if(state.feedbackBusy)return;
    state.feedbackBusy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='送出中…';
    try{await window.PlatformBackend.call(D.functions.feedback,{...values,operation:'feedback',requestId:state.feedbackRequestId,page:location.origin+location.pathname,view:state.page+' / '+modeLabel()});close($('feedback-dialog'));toast('已收到你的問題回報。');}
    catch(e){$('feedback-error').textContent=e.message;}
    finally{state.feedbackBusy=false;submit.disabled=false;submit.textContent='送出回報';}
  }
  const adminActions = new Set(['settings-tab', 'initialize', 'collect', 'build-weekly', 'toggle-pipeline', 'toggle-source', 'edit', 'hide', 'restore', 'reload-removed', 'more-removed', 'permanent-delete', 'reload-feedback', 'skip-pending', 'more-pending', 'reload-pending']);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    event.preventDefault(); const action = button.dataset.action, id = button.dataset.id;
    if (adminActions.has(action) && (!B().admin || state.busy)) return;
    switch (action) {
      case 'weekly': if(!['previous','current','custom'].includes(state.mode))await setPeriod('previous');else{state.page='weekly';frame();}break;
      case 'history': state.page='history';state.mode='history-list';state.customOpen=false;resetFilters();frame();break;
      case 'knowledge': state.page = 'knowledge'; frame(); if (!B().knowledgeLoaded) await window.PlatformBackend.loadKnowledge(); break;
      case 'reload-knowledge': await window.PlatformBackend.loadKnowledge(); break;
      case 'period':
        if (button.dataset.mode === 'custom') { if(!state.customOpen){state.draftFrom=state.from;state.draftTo=state.to;}state.mode='custom';state.customOpen=true;state.selected.clear();frame(); }
        else await setPeriod(button.dataset.mode);
        break;
      case 'previous': await setPeriod('previous'); break;
      case 'archive': await setPeriod('archive', button.dataset.from, button.dataset.to, id); break;
      case 'detail': detail(id); break;
      case 'close-detail': close($('detail-dialog')); break;
      case 'detail-select': state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); close($('detail-dialog')); renderList(); break;
      case 'export': await download(button.dataset.format); break;
      case 'more': state.limit += 8; renderList(); break;
      case 'reset-filters': resetFilters(); renderWeekly(); break;
      case 'clear-selection': state.selected.clear(); renderList(); break;
      case 'reload': await window.PlatformBackend.refresh(); break;
      case 'account': account(); break;
      case 'settings-tab': state.settingsTab = button.dataset.tab; settingsDialog(); if(state.settingsTab==='feedback')await window.PlatformBackend.loadFeedback(); if (state.settingsTab === 'removed') await window.PlatformBackend.loadRemoved(); break;
      case 'reload-removed': await window.PlatformBackend.loadRemoved(); break;
      case 'more-removed': await window.PlatformBackend.loadRemoved({ more: true }); break;
      case 'restore': if ((B().removed || []).some(item => item.id === id)) await task('visibility', { id, published: true }, '資訊已還原，可切換至原發布日期查看。'); break;
      case 'feedback': openFeedback();break;
      case 'close-feedback': if(!state.feedbackBusy)close($('feedback-dialog'));break;
      case 'skip-pending': {
        const item=(B().pendingItems||[]).find(x=>x.id===id);if(!item)break;
        if(!window.confirm(`略過「${item.title}」？\n\n此篇將停止後續處理，並從待處理列表移除。`))break;
        state.busy=true;try{await window.PlatformBackend.skipPending(id);toast('已略過，此篇不再排入處理。');}catch(e){toast(e.message);}finally{state.busy=false;if(B().admin&&$('settings-dialog').open)settingsDialog();}break;
      }
      case 'more-pending': await window.PlatformBackend.loadPending({more:true});break;
      case 'reload-pending': await window.PlatformBackend.loadPending();break;
      case 'reload-feedback': await window.PlatformBackend.loadFeedback();break;
      case 'permanent-delete': {
        const item=(B().removed||[]).find(x=>x.id===id);if(!item)break;
        if(!window.confirm(`永久刪除「${item.title}」？\n\n此操作無法還原，會刪除資訊、編輯紀錄與待處理內容。已封存歷史週報仍保留當時內容。`))break;
        await task('permanentDelete',{id,confirm:true,operation:'permanentDelete'},'資訊已永久刪除。');break;
      }
      case 'close-settings': close($('settings-dialog')); break;
      case 'copy-uid': try { await navigator.clipboard.writeText(B().user.uid); toast('UID 已複製。'); } catch { toast('請選取 UID 欄位並複製。'); } break;
      case 'logout': close($('settings-dialog')); await window.PlatformBackend.signOut(); break;
      case 'initialize': await task('initialize', {}, '平台已啟用，請按「立即更新」蒐集資訊。'); break;
      case 'collect': await task('collect', {}, result => `本次新增 ${result.created || 0} 則${Number.isInteger(result.pending) ? '，待處理 ' + result.pending + ' 則' : ''}。`); break;
      case 'build-weekly': await task('weekly', { force: true }, result => result.highlightsPending?`文章已封存，共 ${result.count||0} 則；重點尚未完成：${result.reason||'請稍後重新彙整。'}`:`上週週報已彙整，共 ${result.count || 0} 則。`); break;
      case 'toggle-pipeline': await task('pipeline', { ...B().settings, enabled: !B().settings?.enabled }, B().settings?.enabled ? '自動更新已暫停。' : '自動更新已開啟。'); break;
      case 'toggle-source': { const source = B().sources.find(item => item.id === id); if (source) await task('source', { ...source, enabled: !source.enabled }, '來源設定已更新。'); break; }
      case 'edit': { const item = B().articles.find(article => article.id === id); if (!item || B().snapshot) return; close($('detail-dialog')); $('settings-dialog').innerHTML = `<button class="dialog-close" data-action="close-settings" aria-label="關閉編輯">${icon('close')}</button><h2 class="dialog-title" id="settings-title">編輯資訊</h2>${articleForm(item)}`; showDialog($('settings-dialog')); break; }
      case 'hide': {
        const item = B().articles.find(article => article.id === id);
        if (!item || B().snapshot) break;
        if (!window.confirm(`要將「${item.title}」從公開列表與後續下載移除嗎？\n\n資料不會永久刪除，可在「管理設定 → 已移除資訊」還原。已封存的歷史週報與已下載檔案維持原內容。`)) break;
        close($('detail-dialog'));
        await task('visibility', { id, published: false }, '資訊已移除；若為誤按，可到「管理設定 → 已移除資訊」還原。');
        break;
      }
    }
  });
  document.addEventListener('input', event => {
    if(event.target.closest?.('#date-form')&&['from','to'].includes(event.target.name)){state[event.target.name==='from'?'draftFrom':'draftTo']=event.target.value;return;}
    if(event.target.id==='knowledge-search'){state.knowledgeSearch=event.target.value;renderKnowledgeList();return;}
    if (event.target.id === 'search-input') { state.search = event.target.value; state.focusIds = null; state.selected.clear(); state.limit = 8; renderList(); }
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if(target.id==='knowledge-topic'){state.knowledgeTopic=target.value;renderKnowledgeList();return;}
    if (target.id === 'topic-filter' || target.id === 'region-filter' || target.id==='type-filter') {
      state[{'topic-filter':'topic','region-filter':'region','type-filter':'type'}[target.id]] = target.value; state.focusIds = null;
      state.selected.clear(); state.limit = 8; renderList();
    } else if (target.dataset.select) {
      target.checked ? state.selected.add(target.dataset.select) : state.selected.delete(target.dataset.select);
      target.closest('.news-item')?.classList.toggle('is-selected', target.checked); renderSelection();
    } else if (target.id === 'select-all') {
      state.selected = target.checked ? new Set(filtered().map(item => item.id)) : new Set(); renderList();
    }
  });
  document.addEventListener('submit', async event => {
    const form = event.target, id = form.id;
    if (!['filter-form', 'knowledge-filter', 'date-form', 'source-form', 'article-form', 'edit-form', 'feedback-form'].includes(id)) return;
    event.preventDefault(); if (id === 'filter-form' || id==='knowledge-filter') return;
    const values = Object.fromEntries(new FormData(form));
    if (id === 'date-form') {
      if (!U.validDate(values.from) || !U.validDate(values.to) || values.from > values.to || values.to > U.today()) { $('date-error').textContent = '請選擇有效日期，結束日需晚於或等於開始日，且不可晚於今天。'; return; }
      await setPeriod('custom', values.from, values.to); return;
    }
    if(id==='feedback-form'){await sendFeedback(form,values);return;}
    if (!B().admin || state.busy) return;
    if (id === 'source-form') await task('source', { ...values, enabled: true }, '來源已新增。');
    if (id === 'article-form') await task('ingest', values, result => {
      if(result.status==='skipped')return '此篇已略過，不再排入處理。';if(result.status==='deleted')return '此篇已永久刪除，不再排入處理。';
      if (D.queue) return result.added === false ? '這筆網址已收錄或已排入處理。' : result.result?.created ? '資訊已完成整理。' : '資訊已排入待處理。';
      return result.status === 'irrelevant' ? '此篇與平台主題無直接關聯，未收錄。' : result.status === 'created' ? '資訊已收錄，可切換至發布日期查看。' : '此篇已收錄，未重複新增。';
    });
    if (id === 'edit-form') {
      const prior = B().articles.find(item => item.id === form.dataset.id); if (!prior || B().snapshot) return;
      const patch = { title: values.title, summary: values.summary, implication: values.implication, id: prior.id,
        topics: values.topic === prior.topics?.[0] ? prior.topics : [values.topic] };
      patch.facts=prior.facts||[];
      await task('edit', patch, '修改已儲存。');
    }

  });
  ['detail-dialog', 'settings-dialog', 'feedback-dialog'].forEach(id => $(id).addEventListener('close', () => returnFocus?.focus?.()));
  window.PlatformBackend.onState(() => {
    const focused = document.activeElement?.id, selection = document.activeElement?.selectionStart;
    const allowed = new Set(filtered().map(item => item.id));
    state.selected = new Set([...state.selected].filter(id => allowed.has(id))); frame();
    if (focused) { const element = $(focused); if (element) { element.focus({ preventScroll: true }); if (typeof selection === 'number' && element.setSelectionRange) try { element.setSelectionRange(selection, selection); } catch {} } }
    if ((previousUID && previousUID !== B().user?.uid) || (previousAdmin && !B().admin)) {
      if ($('settings-dialog').open) $('settings-dialog').close();
      if ($('detail-dialog').open) $('detail-dialog').close();
    }
    previousUID = B().user?.uid || null; previousAdmin = B().admin;
    if ($('settings-dialog').open && B().admin && ['removed','feedback','updates'].includes(state.settingsTab)&&!state.busy) settingsDialog();
    if (accountRequested && B().user && !B().checkingAdmin) { accountRequested = false; account(); }
  });
})();
