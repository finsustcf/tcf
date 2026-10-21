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
  const state = { page: 'weekly', mode: 'previous', ...U.bounds(), search: '', topic: '', region: '',
    selected: new Set(), limit: 8, customOpen: false, settingsTab: 'updates', knowledgeSearch: '', knowledgeTopic: '', focusIds: null, busy: false };
  let timer, returnFocus, accountRequested = false, previousUID = null, previousAdmin = false;

  const periodItems = () => B().articles.filter(item => U.articleDay(item) >= state.from && U.articleDay(item) <= state.to)
    .map(item => ({ ...item, topics: Array.isArray(item.topics) ? item.topics : [], region: U.articleRegion(item) }))
    .sort((a, b) => U.articleDay(b).localeCompare(U.articleDay(a)) || a.id.localeCompare(b.id));
  function filtered() {
    const query = state.search.trim().toLocaleLowerCase();
    return periodItems().filter(item => (!state.focusIds || state.focusIds.has(item.id)) && (!state.topic || item.topics.includes(state.topic))
      && (!state.region || (item.region || 'unknown') === state.region)
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
      <a class="brand" href="#weekly" data-action="weekly" aria-label="${esc(D.title)}"><span class="brand-mark">${icon(D.icon)}</span><span>${esc(D.brand)}</span></a>
      <nav class="main-nav" aria-label="主要選單"><button class="nav-link ${state.page === 'weekly' ? 'active' : ''}" data-action="weekly" ${state.page === 'weekly' ? 'aria-current="page"' : ''}>週報閱讀</button><button class="nav-link ${state.page === 'history' ? 'active' : ''}" data-action="history" ${state.page === 'history' ? 'aria-current="page"' : ''}>歷史週報</button><button class="nav-link ${state.page === 'knowledge' ? 'active' : ''}" data-action="knowledge" ${state.page === 'knowledge' ? 'aria-current="page"' : ''}>知識庫</button></nav>
      <button class="admin-link" data-action="account" ${B().checkingAdmin ? 'disabled' : ''}>${icon('settings')}${adminLabel}</button>
      </div></header><main id="main-content" class="page-wrap" tabindex="-1"></main>
      <footer class="site-footer"><p>${esc(D.title)}</p><p>日期時間以臺灣時間為準；僅有日期的來源保留原文日期。</p></footer>`;
    if (state.page === 'history') renderHistory(); else if (state.page === 'knowledge') renderKnowledge(); else renderWeekly();
  }

  function renderWeekly() {
    $('main-content').innerHTML = `<div class="period-row"><div class="period-tabs" role="group" aria-label="資料期間">
      ${[['previous', '上週週報'], ['current', '本週資訊'], ['custom', '自訂期間']].map(([mode, label]) => `<button class="period-tab ${(mode === 'custom' ? state.customOpen : state.mode === mode) ? 'active' : ''}" data-action="period" data-mode="${mode}" aria-pressed="${mode === 'custom' ? state.customOpen : state.mode === mode}">${label}</button>`).join('')}
      </div><p class="updated">${B().snapshot ? '彙整時間' : '更新時間'}：${time(B().snapshot?.generatedAt || B().status?.lastSuccessAt)}</p></div>
      <div id="custom-period"></div><section class="report-panel" aria-labelledby="report-period"><div class="report-identity">
      <p class="report-label">${icon('calendar')}${modeLabel()}</p><h1 class="report-period" id="report-period">${U.period(state.from,state.to)}</h1><p class="report-count" id="report-count"></p>
      </div><div class="export-area"><p class="export-label" id="export-label" aria-live="polite"></p><div class="export-buttons">
      ${[['xlsx', 'Excel'], ['docx', 'Word'], ['pptx', 'PowerPoint']].map(([format, label]) => `<button class="btn export-btn" data-action="export" data-format="${format}">${icon('download')}${label}</button>`).join('')}
      </div></div></section><section class="highlights" id="highlights" aria-labelledby="highlights-title"></section>
      <section aria-labelledby="list-title"><div class="section-heading"><h2 id="list-title">${scopeLabel()}資訊</h2><div class="list-heading-actions"><p id="result-count" role="status" aria-live="polite"></p><button class="text-btn" data-action="reload">重新讀取</button></div></div>
      <form class="filter-form" id="filter-form" role="search"><label class="search-field"><span class="sr-only">搜尋標題、摘要或來源</span>${icon('search')}<input id="search-input" type="search" placeholder="搜尋標題、摘要或來源" value="${esc(state.search)}" autocomplete="off"></label>
      <label><span class="sr-only">篩選主題</span><select id="topic-filter"><option value="">全部主題</option>${D.topics.map(topic => `<option ${state.topic === topic ? 'selected' : ''}>${esc(topic)}</option>`).join('')}</select></label>
      <label><span class="sr-only">篩選來源地區</span><select id="region-filter"><option value="">國內外來源</option><option ${state.region === '國內' ? 'selected' : ''}>國內</option><option ${state.region === '國外' ? 'selected' : ''}>國外</option><option value="unknown" ${state.region === 'unknown' ? 'selected' : ''}>未標示</option></select></label></form>
      <div class="list-toolbar"><label class="select-all"><input type="checkbox" id="select-all">全選篩選結果</label><div class="selection-controls"><span id="selection-count" aria-live="polite"></span><button class="text-btn" data-action="reset-filters" id="reset-filters">清除篩選</button><button class="text-btn" data-action="clear-selection" id="clear-selection">取消勾選</button></div></div>
      <div id="news-list"></div><div class="load-more" id="load-more"></div></section>`;
    renderDateForm(); renderHighlights(); renderList();
  }

  function renderDateForm() {
    $('custom-period').innerHTML = state.customOpen ? `<form class="date-form" id="date-form"><label>開始日期<input name="from" type="date" value="${state.from}" max="${U.today()}" required></label><label>結束日期<input name="to" type="date" value="${state.to}" max="${U.today()}" required></label><button class="btn btn-primary" type="submit">套用日期</button><p class="date-error" id="date-error" role="alert"></p></form>` : '';
  }
  function renderHighlights() {
    if (B().loading || B().error) { $('highlights').innerHTML = ''; return; }
    const points = U.highlights(periodItems(), B().insights);
    $('highlights').innerHTML = `<div class="section-heading"><h2 id="highlights-title">${scopeLabel()}重點</h2></div>${points.length ? `<div class="highlight-list">${points.map((item,index)=>`<article class="highlight"><span class="highlight-number">${index+1}</span><div class="highlight-copy"><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><button class="text-btn" data-action="related" data-index="${index}">查看相關資訊（${item.articleIds.length} 則）${icon('arrow')}</button></div></article>`).join('')}</div>` : '<p class="small-note">這段期間尚無可整理的重點。</p>'}`;
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
      <div class="news-bottom"><span class="topic-tag">${esc(item.topics[0] || '相關資訊')}</span><button class="detail-link" data-action="detail" data-id="${esc(item.id)}">閱讀重點${icon('arrow')}</button></div></div></article>`).join('')}</div>`
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
    $('selection-count').textContent = count ? `已勾選 ${count} 則` : '';
    $('clear-selection').hidden = !count;
    $('reset-filters').hidden = !(state.search || state.topic || state.region || state.focusIds);
    $('export-label').textContent = count ? `下載已勾選的 ${count} 則資訊` : `下載篩選結果・${items.length} 則資訊`;
    document.querySelectorAll('.export-btn').forEach(button => { button.disabled = state.busy || B().loading || !!B().error || !items.length; });
  }
  function resetFilters() { state.search = ''; state.topic = ''; state.region = ''; state.focusIds = null; state.selected.clear(); state.limit = 8; }
  async function setPeriod(mode, from, to, archiveId = null) {
    state.mode = mode; state.page = 'weekly'; Object.assign(state, from ? { from, to } : U.bounds(mode));
    state.customOpen = mode === 'custom'; resetFilters(); frame();
    await window.PlatformBackend.loadRange(state.from, state.to, { archiveId });
  }
  function renderHistory() {
    const error = B().error;
    $('main-content').innerHTML = `<div class="history-heading"><h1>歷史週報</h1><p>選擇期間後，可閱讀與下載該週封存內容。</p></div>${error ? `<div class="empty-state"><h3>暫時無法讀取週報</h3><p>${esc(error)}</p><button class="btn" data-action="reload">重新讀取</button></div>` : B().archives.length ? `<div class="history-list">${B().archives.map(item => `<button class="history-card" data-action="archive" data-id="${esc(item.id)}" data-from="${esc(item.periodStart)}" data-to="${esc(item.periodEnd)}">${icon('archive')}<span class="history-copy"><strong>${esc(U.period(item.periodStart, item.periodEnd))}</strong><p>${item.count || 0} 則資訊・彙整時間：${time(item.generatedAt)}</p></span><span class="history-open">閱讀週報${icon('arrow')}</span></button>`).join('')}</div>` : `<div class="empty-state"><h3>${B().loading ? '讀取週報中…' : '尚無封存週報'}</h3><p>每週一早上整理上一週內容。</p></div>`}`;
  }
  function renderKnowledge(){
    $('main-content').innerHTML=`<div class="history-heading"><h1>知識庫</h1></div><form id="knowledge-filter" class="filter-form knowledge-filter" role="search"><label class="search-field"><span class="sr-only">搜尋名詞或縮寫</span>${icon('search')}<input id="knowledge-search" type="search" placeholder="搜尋名詞、縮寫或解釋" value="${esc(state.knowledgeSearch)}"></label><label><span class="sr-only">主題</span><select id="knowledge-topic"><option value="">全部主題</option>${D.topics.map(x=>`<option ${state.knowledgeTopic===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><button class="btn" type="button" data-action="reload-knowledge">重新讀取</button></form><div id="knowledge-list"></div>`;renderKnowledgeList();
  }
  function renderKnowledgeList(){
    if(B().knowledgeLoading){$('knowledge-list').innerHTML='<div class="loading" role="status">讀取知識庫中…</div>';return;}
    if(B().knowledgeError){$('knowledge-list').innerHTML=`<div class="empty-state"><h2>暫時無法讀取知識庫</h2><p>${esc(B().knowledgeError)}</p><button class="btn" data-action="reload-knowledge">重新讀取</button></div>`;return;}
    const query=state.knowledgeSearch.toLocaleLowerCase().replace(/\s/g,''),items=(B().knowledge||[]).filter(x=>(!state.knowledgeTopic||(x.topics||[]).includes(state.knowledgeTopic))&&(!query||[x.term,...x.aliases||[],x.definition].join(' ').toLocaleLowerCase().replace(/\s/g,'').includes(query)));
    $('knowledge-list').innerHTML=items.length?`<p class="knowledge-count">${items.length} 個詞條</p><div class="knowledge-grid">${items.map(x=>`<article class="knowledge-card"><h2><button class="article-title" data-action="knowledge-detail" data-id="${esc(x.id)}">${esc(x.term)}</button></h2>${x.aliases?.length?`<p class="knowledge-aliases">${x.aliases.filter(a=>a!==x.term).map(esc).join('、')}</p>`:''}<p>${esc(x.definition)}</p><button class="text-btn" data-action="knowledge-detail" data-id="${esc(x.id)}">查看說明${icon('arrow')}</button></article>`).join('')}</div>`:'<div class="empty-state"><h2>沒有符合的詞條</h2><p>知識庫會隨公開資訊整理逐步累積。</p></div>';
  }
  function knowledgeDetail(id){const term=(B().knowledge||[]).find(x=>x.id===id);if(!term)return;$('detail-dialog').innerHTML=`<button class="dialog-close" data-action="close-detail" aria-label="關閉內容">${icon('close')}</button><div class="detail-body"><h2 id="detail-title">${esc(term.term)}</h2><section><h3>簡明解釋</h3><p>${esc(term.definition)}</p></section><section><h3>與銀行業務的關係</h3><p>${esc(term.bankRelevance)}</p></section><section><h3>參考來源</h3><a href="${esc(U.safeURL(term.url))}" target="_blank" rel="noopener noreferrer">${esc(term.source||'開啟參考來源')}${icon('external')}</a></section><p class="small-note">更新時間：${time(term.updatedAt)}</p></div>${term.articleIds?.length?`<div class="detail-actions"><button class="btn" data-action="knowledge-related" data-id="${esc(id)}">查看相關資訊</button></div>`:''}`;showDialog($('detail-dialog'));}
  async function showKnowledgeArticles(term){close($('detail-dialog'));state.mode='custom';state.page='weekly';state.customOpen=true;state.from='2000-01-01';state.to=U.today();resetFilters();frame();await window.PlatformBackend.loadRelated(term.articleIds);if(!B().error){state.focusIds=new Set(term.articleIds);if(B().articles.length){state.from=B().articles.map(U.articleDay).sort()[0];state.to=B().articles.map(U.articleDay).sort().at(-1);}frame();}}
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
  function settingsDialog() {
    if (!B().admin) return;
    const backend = B(), settings = backend.settings || {}, run = backend.lastRun;
    const ready = !!backend.settings && (!D.requiresUpgrade || settings.version === 3);
    const sourceRows = media => {
      const sources = backend.sources.filter(source => (source.type === '新聞媒體') === media);
      return sources.length ? sources.map(source => `<div class="source-row"><div><a href="${esc(U.safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a><small>${[U.articleRegion(source), source.type, source.enabled ? '使用中' : '已停用'].filter(Boolean).map(esc).join('・')}</small>${source.lastError ? `<small class="source-error">${esc(source.lastError)}</small>` : ''}</div><button class="btn" data-action="toggle-source" data-id="${esc(source.id)}" ${state.busy ? 'disabled' : ''}>${source.enabled ? '停用' : '啟用'}</button></div>`).join('') : '<p class="small-note">尚未設定此類來源。</p>';
    };
    let content;
    if (state.settingsTab === 'sources') {
      content = `<section class="source-group"><h3>主管機關、同業與相關機構</h3>${sourceRows(false)}<h3>新聞媒體</h3>${sourceRows(true)}<div class="settings-actions"><button class="btn" data-action="seed-sources" ${state.busy ? 'disabled' : ''}>補齊預設來源</button></div><details class="advanced-settings"><summary>新增來源</summary>${sourceForm()}</details></section>`;
    } else if (state.settingsTab === 'removed') {
      const items = backend.removed || [];
      content = `<section class="removed-section"><div class="section-heading"><h3>已移除資訊</h3><button class="text-btn" data-action="reload-removed" ${backend.removedLoading || state.busy ? 'disabled' : ''}>重新讀取</button></div><p class="small-note">這些資訊未公開顯示；還原後會回到原發布日期所屬的期間。歷史封存週報不會自動改寫。</p>
        ${backend.removedError ? `<p class="form-error" role="alert">${esc(backend.removedError)}</p>` : ''}
        ${items.length ? `<div class="removed-list">${items.map(item => `<article class="removed-item"><div class="removed-copy"><p class="news-meta">${esc(U.dateText(item))}・${esc(item.source)}</p><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><a href="${esc(U.safeURL(item.url))}" target="_blank" rel="noopener noreferrer">查看原文</a></div><button class="btn" data-action="restore" data-id="${esc(item.id)}" ${state.busy || backend.removedLoading ? 'disabled' : ''}>還原</button></article>`).join('')}</div>` : !backend.removedLoading && !backend.removedError ? '<p class="removed-empty">目前沒有已移除的資訊。</p>' : ''}
        ${backend.removedLoading ? '<p class="loading" role="status">讀取已移除資訊中…</p>' : ''}
        ${backend.removedHasMore ? `<button class="btn" data-action="more-removed" ${backend.removedLoading || state.busy ? 'disabled' : ''}>載入更多已移除資訊</button>` : ''}</section>`;
    } else if (state.settingsTab === 'add') {
      content = articleForm();
    } else {
      content = `<section class="settings-section"><div class="schedule-row"><span>資訊蒐集</span><strong>每天 08:00、12:00、16:00</strong></div><div class="schedule-row"><span>上週週報整理</span><strong>週一 00:00 啟動</strong></div><p class="small-note">皆為台灣時間。</p><div class="pipeline-state"><span class="status-dot ${settings.enabled ? 'enabled' : ''}"></span>自動更新${settings.enabled ? '已開啟' : '尚未開啟'}</div>
        <div class="settings-actions">${!ready ? `<button class="btn btn-primary" data-action="initialize" ${state.busy ? 'disabled' : ''}>啟用平台與預設來源</button>` : `<button class="btn" data-action="toggle-pipeline" ${state.busy ? 'disabled' : ''}>${settings.enabled ? '暫停自動更新' : '開啟自動更新'}</button><button class="btn" data-action="collect" ${state.busy ? 'disabled' : ''}>${state.busy ? '處理中…' : '立即更新'}</button><button class="btn" data-action="build-weekly" ${state.busy ? 'disabled' : ''}>重新彙整上週週報</button>`}</div>
        ${backend.runtime?.message ? `<p class="status-message">${esc(backend.runtime.message)}</p>` : ''}
        ${run ? `<div class="run-status"><h3>最近一次更新</h3><p>${time(run.startedAt)}・新增 ${run.created || 0} 則・待處理 ${run.pending || 0} 則${run.state === 'running' ? '・執行中' : run.state === 'failed' ? '・未完成' : ''}</p>${run.message ? `<p class="status-message">${esc(run.message)}</p>` : ''}${run.errors?.length ? `<details><summary>查看未完成項目（${run.errors.length}）</summary>${run.errors.map(error => `<p>${esc(error.source)}${error.title ? '｜'+esc(error.title):''}：${esc(error.message)}${U.safeURL(error.url)?` <a href="${esc(U.safeURL(error.url))}" target="_blank" rel="noopener noreferrer">查看原文</a>`:''}</p>`).join('')}</details>` : ''}</div>` : ''}
        </section>`;
    }
    $('settings-dialog').innerHTML = `<button class="dialog-close" data-action="close-settings" aria-label="關閉管理設定">${icon('close')}</button><h2 class="dialog-title" id="settings-title">管理設定</h2><div class="settings-tabs" role="group" aria-label="設定分類">${[['updates', '更新設定'], ['sources', '資訊來源'], ['add', '新增資訊'], ['removed', '已移除資訊']].map(([tab, title]) => `<button class="period-tab ${state.settingsTab === tab ? 'active' : ''}" data-action="settings-tab" data-tab="${tab}" aria-pressed="${state.settingsTab === tab}">${title}</button>`).join('')}</div>${content}<div class="admin-footer"><span>${esc(backend.user?.email)}</span><button class="text-btn" data-action="logout">登出</button></div>`;
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
      if (state.page === 'weekly') renderSelection();
    }
  }
  function payload() {
    const articles = (state.selected.size ? selectedItems() : filtered()).map(U.reportArticle);
    return { title: D.title, from: state.from, to: state.to, period: U.period(state.from, state.to), articles,
      topics: U.topics(articles), introduction: '', sectionLabel: scopeLabel(), highlights: U.highlights(articles, B().insights),
      insights: state.selected.size || state.search || state.topic || state.region ? null : B().insights };
  }
  async function download(format) {
    if (state.busy || B().loading || B().error) return;
    const report = payload(); if (!report.articles.length) return;
    state.busy = true; renderSelection();
    try { await window.PlatformExports.download(format, report); toast(`已產生 ${format === 'xlsx' ? 'Excel' : format === 'docx' ? 'Word' : 'PowerPoint'} 檔案，共 ${report.articles.length} 則資訊。`); }
    catch (error) { toast('下載未完成：' + error.message); }
    finally { state.busy = false; if (state.page === 'weekly') renderSelection(); }
  }

  const adminActions = new Set(['settings-tab', 'initialize', 'collect', 'build-weekly', 'toggle-pipeline', 'seed-sources', 'toggle-source', 'edit', 'hide', 'restore', 'reload-removed', 'more-removed']);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    event.preventDefault(); const action = button.dataset.action, id = button.dataset.id;
    if (adminActions.has(action) && (!B().admin || state.busy)) return;
    switch (action) {
      case 'weekly': state.page = 'weekly'; frame(); break;
      case 'history': state.page = 'history'; frame(); break;
      case 'knowledge': state.page = 'knowledge'; frame(); if (!B().knowledgeLoaded) await window.PlatformBackend.loadKnowledge(); break;
      case 'reload-knowledge': await window.PlatformBackend.loadKnowledge(); break;
      case 'knowledge-detail': knowledgeDetail(id); break;
      case 'knowledge-related': { const term=B().knowledge.find(x=>x.id===id);if(term)await showKnowledgeArticles(term);break;}
      case 'related': { const point=U.highlights(periodItems(),B().insights)[Number(button.dataset.index)];if(point){resetFilters();state.focusIds=new Set(point.articleIds);renderWeekly();$('news-list').scrollIntoView?.({block:'start',behavior:'smooth'});}break;}
      case 'period':
        if (button.dataset.mode === 'custom') { state.customOpen = !state.customOpen; renderWeekly(); }
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
      case 'settings-tab': state.settingsTab = button.dataset.tab; settingsDialog(); if (state.settingsTab === 'removed') await window.PlatformBackend.loadRemoved(); break;
      case 'reload-removed': await window.PlatformBackend.loadRemoved(); break;
      case 'more-removed': await window.PlatformBackend.loadRemoved({ more: true }); break;
      case 'restore': if ((B().removed || []).some(item => item.id === id)) await task('visibility', { id, published: true }, '資訊已還原，可切換至原發布日期查看。'); break;
      case 'close-settings': close($('settings-dialog')); break;
      case 'copy-uid': try { await navigator.clipboard.writeText(B().user.uid); toast('UID 已複製。'); } catch { toast('請選取 UID 欄位並複製。'); } break;
      case 'logout': close($('settings-dialog')); await window.PlatformBackend.signOut(); break;
      case 'initialize': await task('initialize', {}, '平台已啟用，請按「立即更新」蒐集資訊。'); break;
      case 'seed-sources': await task('seed', {}, '預設來源已補齊。'); break;
      case 'collect': await task('collect', {}, result => `本次新增 ${result.created || 0} 則${Number.isInteger(result.pending) ? '，待處理 ' + result.pending + ' 則' : ''}。`); break;
      case 'build-weekly': await task('weekly', { force: true }, result => `上週週報已彙整，共 ${result.count || 0} 則。`); break;
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
    if(event.target.id==='knowledge-search'){state.knowledgeSearch=event.target.value;renderKnowledgeList();return;}
    if (event.target.id === 'search-input') { state.search = event.target.value; state.focusIds = null; state.selected.clear(); state.limit = 8; renderList(); }
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if(target.id==='knowledge-topic'){state.knowledgeTopic=target.value;renderKnowledgeList();return;}
    if (target.id === 'topic-filter' || target.id === 'region-filter') {
      state[target.id === 'topic-filter' ? 'topic' : 'region'] = target.value; state.focusIds = null;
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
    if (!['filter-form', 'knowledge-filter', 'date-form', 'source-form', 'article-form', 'edit-form'].includes(id)) return;
    event.preventDefault(); if (id === 'filter-form' || id==='knowledge-filter') return;
    const values = Object.fromEntries(new FormData(form));
    if (id === 'date-form') {
      if (!U.validDate(values.from) || !U.validDate(values.to) || values.from > values.to || values.to > U.today()) { $('date-error').textContent = '請選擇有效日期，結束日需晚於或等於開始日，且不可晚於今天。'; return; }
      await setPeriod('custom', values.from, values.to); return;
    }
    if (!B().admin || state.busy) return;
    if (id === 'source-form') await task('source', { ...values, enabled: true }, '來源已新增。');
    if (id === 'article-form') await task('ingest', values, result => {
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
  ['detail-dialog', 'settings-dialog'].forEach(id => $(id).addEventListener('close', () => returnFocus?.focus?.()));
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
    if ($('settings-dialog').open && B().admin && state.settingsTab === 'removed') settingsDialog();
    if (accountRequested && B().user && !B().checkingAdmin) { accountRequested = false; account(); }
  });
})();
