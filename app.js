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
    selected: new Set(), limit: 8, customOpen: false, settingsTab: 'updates', knowledgeSearch: '', knowledgeTopic: '', focusIds: null, feedbackBusy:false,feedbackRequestId:null,historyStatus:null,historyDate:'2026-01-01',historyEditingSource:null,dailyEditingSource:null,busy: false };
  let historyPollTimer=null; let historyPollInFlight=false; let historyRequest=0; let historyResumeRetryAt=0; let timer, returnFocus, accountRequested = false, previousUID = null, previousAdmin = false;

  const periodItems = () => B().articles.filter(item => U.articleDay(item) >= state.from && U.articleDay(item) <= state.to)
    .map(item => ({ ...item, topics: Array.isArray(item.topics) ? item.topics : [], region: U.articleRegion(item) }))
    .sort((a, b) => U.articleDay(b).localeCompare(U.articleDay(a)) || a.id.localeCompare(b.id));
  function filtered() {
    const query = state.search.trim().toLocaleLowerCase();
    return periodItems().filter(item => (!state.focusIds || state.focusIds.has(item.id)) && (!state.topic || item.topics.includes(state.topic))
      && (!state.region || (item.region || 'unknown') === state.region) && (!state.type || item.type === state.type)
      && (!query || [item.title, item.summary, item.source, item.bank, item.implication, ...item.topics].join(' ').toLocaleLowerCase().includes(query)));
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
      <div id="custom-period"></div>${['provisional','partial'].includes(B().snapshot?.historyCoverage)?'<p class="settings-note">本週報依已取得的新聞彙整，部分歷史來源未能完整讀取。</p>':''}<section class="report-panel" aria-labelledby="report-period"><div class="report-identity">
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
      <p class="news-meta"><time datetime="${U.articleDay(item)}">${esc(U.dateText(item))}</time>${item.region ? `<span class="dot">${esc(item.region)}</span>` : ''}<span class="dot">${esc(item.source)}</span>${item.bank?`<span class="dot">${esc(item.bank)}</span>`:''}</p>
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
    $('main-content').innerHTML = `<div class="history-heading"><h1>歷史週報</h1><p>選擇期間後，可閱讀與下載該週封存內容。</p></div>${error ? `<div class="empty-state"><h3>暫時無法讀取週報</h3><p>${esc(error)}</p><button class="btn" data-action="reload">重新讀取</button></div>` : B().archives.length ? `<div class="history-list">${B().archives.map(item => `<button class="history-card" data-action="archive" data-id="${esc(item.id)}" data-from="${esc(item.periodStart)}" data-to="${esc(item.periodEnd)}">${icon('archive')}<span class="history-copy"><strong>${esc(U.period(item.periodStart, item.periodEnd))}</strong><p>${item.count || 0} 則資訊・更新時間：${time(item.generatedAt)}${item.historyCoverage==='provisional'?'・歷史補抓中／暫定':''}</p></span><span class="history-open">閱讀週報${icon('arrow')}</span></button>`).join('')}</div>` : `<div class="empty-state"><h3>${B().loading ? '讀取週報中…' : '尚無封存週報'}</h3><p>每週一彙整上一週內容。</p></div>`}`;
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
  function sourceFormLegacy(item=null) {
    return `<form id="source-form" class="stack-form" data-id="${esc(item?.id||'')}"><label class="field">來源名稱<input name="name" required maxlength="100" value="${esc(item?.name||'')}"></label><label class="field">公開列表或 RSS 網址<input name="url" type="url" required placeholder="https://" value="${esc(item?.url||'')}"></label><div class="field-pair"><label class="field">類型<select name="type">${D.sourceTypes.map(type => `<option ${item?.type===type?'selected':''}>${esc(type==='同業公告'?'銀行同業':type)}</option>`).join('')}</select></label><label class="field">來源地區<select name="region"><option ${item?.region==='國內'?'selected':''}>國內</option><option ${item?.region==='國外'?'selected':''}>國外</option></select></label><label class="field">讀取方式<select name="method"><option value="html" ${item?.method!=='rss'?'selected':''}>公開網頁列表</option><option value="rss" ${item?.method==='rss'?'selected':''}>RSS 訂閱</option></select></label></div><p class="small-note">僅接受公開 HTTPS 網址；不限制來源網域，但系統會檢查網址安全。</p><p class="form-error" id="form-error" role="alert"></p><button class="btn btn-primary" ${state.busy ? 'disabled' : ''}>${item?'儲存修改':'新增來源'}</button></form>`;
  }
  function articleForm(item) {
    const edit = !!item;
    return `<form id="${edit ? 'edit' : 'article'}-form" class="stack-form" ${edit ? `data-id="${esc(item.id)}"` : ''}><label class="field">資訊標題<input name="title" required maxlength="180" value="${esc(item?.title || '')}"></label>${edit ? `<label class="field">重點摘要<textarea name="summary" required rows="6" maxlength="${D.summaryLimit}">${esc(item.summary)}</textarea></label><label class="field">值得關注<textarea name="implication" rows="4" maxlength="800">${esc(item.implication)}</textarea></label><label class="field">主要主題<select name="topic">${D.topics.map(topic => `<option ${item.topics?.[0] === topic ? 'selected' : ''}>${esc(topic)}</option>`).join('')}</select></label>${U.attachments(item).length?`<fieldset class="field"><legend>檢查本文附件（勾選要移除的錯誤連結）</legend><p class="small-note">只有你勾選的附件會移除；原文網址及新聞內容保留。</p>${U.attachments(item).map(file=>`<label class="field"><input type="checkbox" name="removeAttachment" value="${esc(file.url)}">移除：${esc(file.name)} <small>${esc(file.url)}</small></label>`).join('')}</fieldset>`:''}` : `<label class="field">原文網址<input name="url" type="url" required placeholder="https://" value="${esc(item?.url||'')}"></label><label class="field">來源名稱<input name="source" required maxlength="100"></label><div class="field-pair"><label class="field">類型<select name="type">${D.sourceTypes.map(type => `<option ${item?.type===type?'selected':''}>${esc(type==='同業公告'?'銀行同業':type)}</option>`).join('')}</select></label><label class="field">來源地區<select name="region"><option ${item?.region==='國內'?'selected':''}>國內</option><option ${item?.region==='國外'?'selected':''}>國外</option></select></label></div><label class="field">發布日期（選填）<input name="date" type="date" max="${U.today()}"></label><label class="field">公開文字（選填）<textarea name="manualText" rows="5" maxlength="18000" placeholder="原網站讀取受限時，可貼入同一網址的公開文字，至少100字。"></textarea></label>`}<p class="form-error" id="form-error" role="alert"></p><button class="btn btn-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? '處理中…' : edit ? '儲存修改' : '擷取並整理'}</button></form>`;
  }
  // Reuse controls on background updates so focus, edits and open details survive.
  function updateDialogMarkup(dialog,html){
    const template=document.createElement('template');template.innerHTML=html;
    const key=node=>{
      if(node.nodeType!==1)return '';
      if(node.id)return node.id+'|'+(node.dataset.id||'');
      if(node.dataset.key)return node.dataset.key;
      if(node.dataset.action)return [node.tagName,node.dataset.action,node.dataset.tab,node.dataset.id,node.dataset.date].join('|');
      return '';
    };
    const same=(a,b)=>a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);
    function reconcile(parent,next){
      let cursor=parent.firstChild;
      for(const wanted of [...next.childNodes]){
        const wantedKey=key(wanted);
        let node=cursor;
        if(wantedKey&&(!node||!same(node,wanted)))node=[...parent.childNodes].find(n=>same(n,wanted));
        if(!node||!same(node,wanted)){parent.insertBefore(wanted.cloneNode(true),cursor);continue;}
        if(node!==cursor)parent.insertBefore(node,cursor);
        if(node.nodeType===3){if(node.data!==wanted.data)node.data=wanted.data;}
        if(node.nodeType===1){
          for(const attr of [...node.attributes])if(!wanted.hasAttribute(attr.name)&&!['open','aria-busy'].includes(attr.name))node.removeAttribute(attr.name);
          for(const attr of [...wanted.attributes])if(node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
          if(node.id==='history-date'&&document.activeElement!==node)node.value=wanted.value;
          if(node.dataset.pendingChoice)node.checked=wanted.checked;
          if(node.tagName!=='TEXTAREA'&&node.tagName!=='INPUT')reconcile(node,wanted);
          if(node.getAttribute('aria-busy')==='true')node.disabled=true;
        }
        cursor=node.nextSibling;
      }
      while(cursor){const following=cursor.nextSibling;cursor.remove();cursor=following;}
    }
    reconcile(dialog,template.content);
  }
  const pendingSelection=new Set(), pendingOperations=new Set();
  let lastControl=null, actionMessage='', actionVersion=0;
  function operationMessage(message,version=++actionVersion){
    if(version!==actionVersion)return;
    actionMessage=message;
    const status=$('admin-action-status');if(status)status.textContent=message;
  }
  async function withControl(key,work){
    if(pendingOperations.has(key)){operationMessage('此操作正在處理中。',actionVersion);return;}
    const button=lastControl,version=++actionVersion;
    pendingOperations.add(key);
    if(button){button.setAttribute('aria-busy','true');button.disabled=true;}
    operationMessage('處理中…',version);
    try{return await work(version);}
    catch(error){operationMessage(error.message||'操作未完成。',version);}
    finally{
      pendingOperations.delete(key);
      if(button?.isConnected){button.removeAttribute('aria-busy');button.disabled=false;}
    }
  }
  function pendingLabel(item){
    if(item.errorCode==='SERVICE'||/Gemini 暫時/.test(item.reason))return 'Gemini 暫時異常';
    if(item.errorCode==='RATE_LIMIT'||/額度|頻率限制/.test(item.reason))return '額度或頻率限制';
    return /等待下一次/.test(item.reason||'等待下一次')?'排隊中':'來源或文章處理未完成';
  }
  function pendingSection(){
    const backend=B(),items=backend.pendingItems||[],total=Number(backend.pendingTotal)||items.length;
    const sources=(backend.sources||[]).filter(x=>x.enabled&&!x.deleted&&x.lastError);
    return `<section class="pending-section"><div class="section-heading"><h3>更新狀態</h3><button class="text-btn" data-action="reload-pending" ${state.busy||backend.pendingLoading?'disabled':''}>重新讀取</button></div>
    <p>${total?`尚有 ${total} 篇資訊等待處理，後續更新會接續。`:'目前沒有等待處理的資訊。'}</p>
    ${backend.pendingError?`<p class="form-error" role="alert">待處理清單暫時無法讀取：${esc(backend.pendingError)}</p>`:''}
    ${total?`<details class="status-details"><summary>查看待處理文章（${total} 篇）</summary><div class="settings-actions"><button type="button" class="btn" data-action="skip-selected">一次略過（${pendingSelection.size}）</button></div><div class="status-detail-list">${items.map(x=>`<article class="pending-row" data-key="pending-${esc(x.id)}"><div><label><input type="checkbox" data-pending-choice="${esc(x.id)}" ${pendingSelection.has(x.id)?'checked':''}> 選取此篇</label><h4>${esc(x.title)}</h4><p>${esc(x.source)}</p><p class="small-note">${esc(pendingLabel(x))}・${esc(x.reason||'等待下一次更新接續')}</p>${U.safeURL(x.url)?`<a href="${esc(U.safeURL(x.url))}" target="_blank" rel="noopener noreferrer">查看原文</a>`:''}</div><button type="button" class="btn" data-action="skip-pending" data-id="${esc(x.id)}" ${state.busy?'disabled':''}>略過</button></article>`).join('')}</div>${backend.pendingCursor?`<button class="btn" data-action="more-pending" ${state.busy||backend.pendingLoading?'disabled':''}>載入更多</button>`:''}</details>`:''}
    ${sources.length?`<details class="status-details"><summary>${sources.length} 個來源暫時無法讀取，其他來源仍會更新</summary><div class="status-detail-list">${sources.map(x=>`<p><strong>${esc(x.name)}</strong><br><span class="small-note">${esc(x.lastError)}</span></p>`).join('')}</div></details>`:''}
    ${backend.pendingLoading?'<p class="small-note" role="status">正在更新狀態…</p>':''}</section>`;
  }

  function settingsDialog(preserveView=true) {
    const priorDialog=$('settings-dialog');
    const savedScroll=preserveView&&priorDialog.open?priorDialog.scrollTop:0;
    if (!B().admin) return;
    const backend = B(), settings = backend.settings || {}, run = backend.lastRun;const week=backend.archives.find(x=>x.periodStart===U.bounds().from);const hasPoints=!!week?.insights?.insights?.length;
    const ready = !!backend.settings && (!D.requiresUpgrade || settings.version === 3);
    const sourceRows = media => {
      const sources = backend.sources.filter(source => (source.type === '新聞媒體') === media);
      return sources.length ? sources.map(source => `<div class="source-row"><div class="source-copy"><a href="${esc(U.safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a><small>${[U.articleRegion(source), source.type==='同業公告'?'銀行同業':source.type, source.enabled ? '使用中' : '已停用'].filter(Boolean).map(esc).join('・')}</small>${source.lastError ? `<small class="source-error">${esc(source.lastError)}</small>` : ''}</div><div class="source-operations"><button class="btn source-status ${source.enabled?'is-enabled':'is-disabled'}" aria-pressed="${source.enabled}" title="${source.enabled?'目前啟用，點擊可關閉':'目前關閉，點擊可啟用'}" data-action="toggle-source" data-id="${esc(source.id)}" ${state.busy ? 'disabled' : ''}>${source.enabled ? '啟用' : '關閉'}</button><button class="btn" data-action="daily-source-edit" data-id="${esc(source.id)}">編輯</button><button class="btn danger-btn" data-action="daily-source-remove" data-id="${esc(source.id)}">移除</button></div></div>`).join('') : '<p class="small-note">尚未設定此類來源。</p>';
    };
    let content;
    if (state.settingsTab === 'history') {
      const hist=state.historyStatus||{},job=hist.job,week=hist.week;
      const labels={queued:'準備搜尋',running:'搜尋中',complete:'已完成',partial:'等待接續',failed:'暫時無法完成'};
      // A queued job waiting for Eventarc is not necessarily a failed search.
      // The browser can safely advance queued or expired-lease jobs while open.
      const running=job&&['queued','running'].includes(job.status);
      const waiting=job?.status==='partial'&&job.retryAfterMs>0;
      const needsRetry=job&&(['partial','failed'].includes(job.status)||job.needsRefresh===true);
      const percent=job?.sourceCount?Math.min(100,Math.max(0,Math.round((Number(job.checked)||0)/job.sourceCount*100))):0;
      const stage=job?.phase==='analyze'?'正在分析並收錄新聞':'正在搜尋當天新聞';
      const startLabel=week?.locked?'本週已定稿':state.busy?'正在送出…':waiting?'等待服務恢復':job?.status==='partial'&&job.phase==='analyze'?'接續處理':!job?'搜尋這一天':running?'搜尋中…':job.canRetryEmpty?'再搜尋這一天':job.status==='complete'&&!job.needsRefresh?'已完成':job.needsRefresh?'依新版搜尋這一天':'重新搜尋';
      const disabledStart=state.historyLoading||state.busy||running||waiting||week?.locked||(job?.status==='complete'&&!job.needsRefresh&&!job.canRetryEmpty);
      const weekDays=week?.dayResults||week?.days?.map(d=>({date:d,ready:!(week.missing||[]).includes(d),status:'not-started'}))||[];
      const countReady=weekDays.filter(d=>d.ready).length;
      content=`<section class="settings-section history-admin"><h3>歷史新聞回補</h3>
       <p class="small-note">使用原本週報的新聞抓取與分析方式，補找過去的相關新聞。搜尋結束後，直接顯示當天收錄了幾篇。</p>
       <form id="history-date-form" class="history-date-form stack-form"><label class="field">搜尋日期<input id="history-date" name="date" type="date" min="2025-12-29" max="${U.today()}" required value="${esc(state.historyDate)}"></label>
       <button class="btn btn-primary" type="submit" ${disabledStart?'disabled':''}>${startLabel}</button></form>
       ${state.historyLoading?`<p role="status" class="small-note">正在讀取 ${esc(state.historyDate)} 的回補進度…</p>`:''}
       ${job?`<div class="run-status" data-key="history-day-result" role="status" aria-live="polite"><h3>${esc(state.historyDate)}</h3>
       <p class="history-day-result">${Number(job.dayArticleCount)>0?`✅ 當天已抓到 ${Number(job.dayArticleCount)} 篇相關新聞`:running||job.stale?'正在搜尋，尚未收錄新聞':job.status==='complete'?'本次沒有抓到相關新聞':`目前尚未抓到，搜尋${job.status==='failed'?'遇到問題':'尚未完成'}`}</p>
       ${running?`<p>${esc(stage)}・已搜尋 ${Number(job.checked)||0}／${Number(job.sourceCount)||0} 個來源</p>`:''}
       <div class="history-progress"><span style="width:${percent}%"></span></div>
       ${!running&&Number(job.dayArticleCount)>0?'<p class="small-note">以上包含原本每日或週報已收錄的新聞，不重複計算。</p>':''}
       ${!running&&Number(job.dayArticleCount)===0&&job.status==='complete'?'<p class="small-note">本次未找到符合條件的新聞，不代表當天絕對沒有新聞；可以按「再搜尋這一天」。</p>':''}
       ${job.stale?'<p class="small-note">正在嘗試接續未完成的工作，背景排程會嘗試接續。</p>':''}
       ${job.lastError&&['failed','partial'].includes(job.status)?`<p class="small-note">有來源或分析未完成，仍可稍後重新搜尋。</p>`:''}
       ${waiting?`<p class="small-note">服務或分析額度暫時受限，已保留進度。約 ${Math.max(1,Math.ceil(job.retryAfterMs/60000))} 分鐘後可接續；背景排程會嘗試接續。</p>`:''}
       ${job.sourceWarnings?.length?`<details class="status-details"><summary>部分來源本次未能讀取（${Number(job.sourceWarningCount)||job.sourceWarnings.length} 個）</summary>${job.sourceWarnings.map(x=>`<p class="small-note">${esc(x.name)}：${esc(x.message)}</p>`).join('')}</details>`:''}
       ${job.needsRefresh?'<p class="small-note">來源有更新，可重新搜尋這一天。</p>':''}
       ${job.items?.some(x=>x.status==='pending'&&['partial','failed'].includes(job.status))?`<details><summary>處理無法完成的文章（選用）</summary>${job.items.filter(x=>x.status==='pending').map(x=>`<p>${esc(x.title)} <button type="button" class="btn history-skip-item" data-action="history-skip-item" data-id="${esc(x.id)}">略過</button></p>`).join('')}</details>`:''}
       </div>`:''}
       <div class="run-status history-week" data-key="history-week-result"><div class="history-week-heading"><h3>歷史週報</h3>${week?`<span class="history-week-count">${countReady}／7 天完成</span>`:''}</div>
       ${week?`<p class="history-week-period">${esc(week.monday)} ～ ${esc(week.days[6])}</p>
       <div class="history-week-grid" aria-label="本週七天搜尋狀態">${weekDays.map((d,i)=>`<button type="button" class="history-week-day ${d.ready?'is-done':d.status==='not-started'?'is-unsearched':'is-pending'} ${state.historyDate===d.date?'is-current':''}" data-action="history-jump" data-date="${esc(d.date)}" aria-label="${esc(d.date)} ${d.ready?'已完成':d.status==='not-started'?'尚未搜尋':'尚未完成'}" title="查看 ${esc(d.date)} 搜尋結果"><span>${['一','二','三','四','五','六','日'][i]}</span><strong>${esc(d.date.slice(5).replace('-','/'))}</strong><small>${d.ready?'✓ 完成':d.status==='not-started'?'未搜尋':d.status==='running'||d.status==='queued'?'搜尋中':'需處理'}</small></button>`).join('')}</div>
       <p class="small-note">${week.locked?'本週已定稿。':week.ready?(week.articleCount>0?`七天已完成，本週新聞資料庫已收錄 ${Number(week.articleCount)||0} 篇，可建立週報。`:'七天已搜尋，但本週尚無收錄新聞，可重新搜尋或手動新增資訊。'):'已有收錄新聞即可先建立暫定週報；完成七天處理後可正式定稿。'}</p>`:'<p class="small-note">選擇歷史日期，即可看到所在週次的七天進度。</p>'}
       <button class="btn" data-action="history-draft" ${state.historyLoading||!week?.canDraft||week?.locked||state.busy?'disabled':''}>建立暫定週報</button><button class="btn btn-primary" data-action="history-report" ${state.historyLoading||!week?.canFinalize||week?.locked||state.busy?'disabled':''}>${week?.locked?'已定稿':'建立並定稿週報'}</button></div>
      </section>`;
    } else if (state.settingsTab === 'sources') {
      const hist=state.historyStatus||{},records=hist.sources||[],editing=records.find(x=>x.id===state.historyEditingSource);
      const sourceForm=(item)=>`<form id="history-source-form" class="stack-form" data-id="${esc(item?.id||'')}">
       <label class="field">來源名稱<input name="name" required maxlength="100" value="${esc(item?.name||'')}"></label>
       <label class="field">公開來源網址<input name="url" required type="url" placeholder="https://" value="${esc(item?.url||'')}"></label>
       <label class="field">來源分類<select name="category">${['主管機關','銀行同業','相關機構','新聞媒體'].map(x=>`<option ${item?.category===x?'selected':''}>${x}</option>`).join('')}</select></label>
       <p class="small-note">僅接受公開 HTTPS 網址。新增來源預設啟用，之後可隨時啟用。</p><p id="history-form-error" class="form-error" role="alert"></p>
       <div class="settings-actions"><button class="btn btn-primary" type="submit">儲存來源</button><button class="btn" type="button" data-action="history-source-cancel">取消</button></div></form>`;
      content=`<section class="source-group"><h3>共用資訊來源（每日與歷史）</h3><p class="small-note">同一平台每日抓取與歷史回補都使用這份來源清單。新增、編輯、啟用、關閉或移除會同步影響兩種搜尋；舊新聞及週報不會刪除。</p>
       ${state.historyEditingSource==='new'||editing?sourceForm(editing):`<button class="btn btn-primary" data-action="history-source-add">新增來源</button>`}
       ${['主管機關','銀行同業','相關機構','新聞媒體'].map(category=>`<h3>${category}</h3>${records.filter(x=>x.category===category).map(x=>`<div class="source-row"><div class="source-copy"><a target="_blank" rel="noopener noreferrer" href="${esc(U.safeURL(x.url))}">${esc(x.name)}</a><small class="source-url">${esc(x.url)}</small><small>${x.enabled?'啟用':'關閉'}</small></div><div class="source-operations"><button class="btn source-status ${x.enabled?'is-enabled':'is-disabled'}" aria-pressed="${x.enabled}" title="${x.enabled?'目前啟用，點擊可關閉':'目前關閉，點擊可啟用'}" data-action="history-source-toggle" data-id="${esc(x.id)}" ${state.busy?'disabled':''}>${x.enabled?'啟用':'關閉'}</button><button class="btn" data-action="history-source-edit" data-id="${esc(x.id)}">編輯</button><button class="btn danger-btn" data-action="history-source-remove" data-id="${esc(x.id)}">移除</button></div></div>`).join('')||'<p class="small-note">目前沒有來源。</p>'}`).join('')}
       </section>`;
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
    updateDialogMarkup(priorDialog,`<button class="dialog-close" data-action="close-settings" aria-label="關閉管理設定">${icon('close')}</button><h2 class="dialog-title" id="settings-title">管理設定</h2><div class="settings-tabs" role="group" aria-label="設定分類">${[['updates', '更新設定'], ['history', '歷史回補'], ['sources', '資訊來源'], ['add', '新增資訊'], ['removed', '已移除資訊'], ['feedback', '問題回報']].map(([tab, title]) => `<button class="period-tab ${state.settingsTab === tab ? 'active' : ''}" data-action="settings-tab" data-tab="${tab}" aria-pressed="${state.settingsTab === tab}">${title}</button>`).join('')}</div><p id="admin-action-status" role="status" aria-live="polite">${esc(actionMessage)}</p><div data-key="settings-${state.settingsTab}">${content}</div><div class="admin-footer"><span>${esc(backend.user?.email)}</span><button class="text-btn" data-action="logout">登出</button></div>`);
    if(!$('settings-dialog').open)showDialog($('settings-dialog'));
    if(preserveView)priorDialog.scrollTop=savedScroll;
  }
  const commandTimers=new Map();
  function watchCommand(id){
    if(commandTimers.has(id))return;
    const tick=async()=>{try{const result=await window.PlatformBackend.call(D.functions.source,{operation:'command-status',id});
      if(['complete','failed','missing'].includes(result.status)){clearInterval(commandTimers.get(id));commandTimers.delete(id);toast(result.status==='complete'?'背景工作已完成。':result.message||'工作紀錄已結束。');if(result.status==='complete')await window.PlatformBackend.refresh();}
    }catch(error){clearInterval(commandTimers.get(id));commandTimers.delete(id);toast('進度暫時無法讀取，背景工作仍可能執行中。');}};
    commandTimers.set(id,setInterval(tick,5000));
  }
  async function task(action,data,message){
    if(!B().admin||!D.functions[action])return;
    return withControl(JSON.stringify([action,data.operation,data.id]),async version=>{
      const result=await window.PlatformBackend.call(D.functions[action],data);
      if(result.accepted&&result.id){watchCommand(result.id);operationMessage('工作已接收，正在背景處理。',version);}
      else{
        operationMessage(typeof message==='function'?message(result):message,version);
        window.PlatformBackend.refresh().catch(error=>operationMessage(error.message,version));
      }
      return result;
    });
  }
  async function historyTask(payload,success){
    if(!B().admin)return;
    return withControl(JSON.stringify([payload.operation,payload.id,payload.date,payload.itemId,payload.periodStart]),async version=>{
      const result=await window.PlatformBackend.call(D.functions.backfill,payload);
      if(result.accepted&&result.id){watchCommand(result.id);operationMessage('工作已接收，正在背景處理。',version);}
      else operationMessage(typeof success==='function'?success(result):success,version);
      pollHistory(true);
      return result;
    });
  }
  async function skipPendingRows(ids){
    if(!ids.length){operationMessage('請先勾選要略過的文章。');return;}
    if(!window.confirm(`確定略過選取的 ${ids.length} 篇待處理文章？`))return;
    return withControl('skip-pending',async version=>{
      const result=await window.PlatformBackend.call(D.functions.pipeline,{operation:'skip-many',ids});
      for(const id of ids)pendingSelection.delete(id);
      window.PlatformBackend.applySkipped(result.skipped);
      const untouched=result.unchanged.length;
      operationMessage(`已略過 ${result.skipped.length} 篇${untouched?`，另有 ${untouched} 篇已離開待處理清單`:''}。`,version);
      window.PlatformBackend.loadPending().catch(error=>operationMessage(error.message,version));
    });
  }
  async function selectHistoryDate(date){
    if(!U.validDate(date))return;
    const week=state.historyStatus?.week;
    state.historyDate=date;state.historyStatus=week?.days.includes(date)?{week}:null;state.historyLoading=true;
    settingsDialog(true);
    await pollHistory(true);
  }
  async function pollHistory(force=false){
    if((historyPollInFlight&&!force)||!B().admin||!$('settings-dialog').open||!['history','sources'].includes(state.settingsTab)||(state.busy&&!force))return;
    historyPollInFlight=true;const request=++historyRequest,date=state.historyDate,tab=state.settingsTab;
    try{
      // Read progress only. R11 Eventarc and the scheduled worker own processing.
      const result=await window.PlatformBackend.call(D.functions.historyStatus,{date,includeSources:tab==='sources'},{timeout:20000});
      if(request!==historyRequest||date!==state.historyDate)return;
      state.historyStatus=result;state.historyLoading=false;
      if($('settings-dialog').open&&state.settingsTab===tab)settingsDialog(true);
    }catch(error){
      if(request!==historyRequest)return;
      state.historyLoading=false;
      if($('settings-dialog').open&&state.settingsTab===tab)settingsDialog(true);
      operationMessage('這一天的進度暫時無法讀取，請切換日期重試。');
    }finally{if(request===historyRequest)historyPollInFlight=false;}
  }
  historyPollTimer=window.setInterval(pollHistory,9000);
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
  const adminActions = new Set(['settings-tab', 'initialize', 'collect', 'build-weekly', 'toggle-pipeline', 'toggle-source', 'edit', 'hide', 'restore', 'reload-removed', 'more-removed', 'permanent-delete', 'reload-feedback', 'skip-pending', 'skip-selected', 'more-pending', 'reload-pending', 'history-report', 'history-draft', 'history-jump', 'history-skip-item', 'history-source-add', 'history-source-edit', 'history-source-cancel', 'history-source-toggle', 'history-source-remove', 'daily-source-edit', 'daily-source-remove']);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button||button.disabled) return;
    lastControl=button;
    event.preventDefault(); const action = button.dataset.action, id = button.dataset.id;
    if (adminActions.has(action) && (!B().admin || (state.busy&&!['settings-tab','history-jump'].includes(action)))) return;
    switch (action) {
      case 'history-draft':await historyTask({operation:'draft',periodStart:state.historyStatus?.week?.monday},'已建立暫定週報。');break;
      case 'history-jump':await selectHistoryDate(button.dataset.date);break;
      case 'history-skip-item':{
        const job=state.historyStatus?.job,item=job?.items?.find(x=>x.id===id);
        if(!item||item.status!=='pending')break;
        if(!window.confirm(`確定手動略過「${item.title}」？\n這篇文章不會納入歷史週報，操作會保留紀錄。`))break;
        await historyTask({operation:'skip-item',date:state.historyDate,itemId:id,reason:'管理員手動略過待處理文章'},'已略過這篇文章，正在重新計算當日進度。');break;
      }

      case 'history-report': {const week=state.historyStatus?.week;
        if(!week?.ready||week.locked){toast('七天尚未完成，或本週已定稿。');break;}
        if(!window.confirm(`確認將 ${week.monday} 起七天的歷史週報建立並定稿？定稿後不可自動覆蓋。`))break;
        await historyTask({operation:'report',periodStart:week.monday},res=>`歷史週報已定稿，共 ${res.count||0} 則。`);break;}
      case 'daily-source-edit':state.dailyEditingSource=id;settingsDialog();break;
      case 'daily-source-remove':{const src=(B().sources||[]).find(x=>x.id===id);
       if(src&&window.confirm(`移除每日來源「${src.name}」？已有新聞及週報會保留。`))await task('source',{operation:'remove',id},'每日來源已移除。');break;}
      case 'history-source-add':state.historyEditingSource='new';settingsDialog();break;
      case 'history-source-edit':state.historyEditingSource=id;settingsDialog();break;
      case 'history-source-cancel':state.historyEditingSource=null;settingsDialog();break;
      case 'history-source-toggle':{const src=(state.historyStatus?.sources||[]).find(x=>x.id===id);if(src)await historyTask({operation:'source',action:'toggle',id,enabled:!src.enabled},'來源啟用狀態已更新。');break;}
      case 'history-source-remove':{const src=(state.historyStatus?.sources||[]).find(x=>x.id===id);
        if(src&&window.confirm(`移除「${src.name}」？
既有新聞和已定稿週報仍會保留。`))await historyTask({operation:'source',action:'remove',id},'來源已移除。');break;}
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
      case 'settings-tab': state.settingsTab = button.dataset.tab; settingsDialog(); if(state.settingsTab==='history'||state.settingsTab==='sources'){await pollHistory(true);if(state.settingsTab==='sources')settingsDialog(true);} if(state.settingsTab==='feedback')await window.PlatformBackend.loadFeedback(); if (state.settingsTab === 'removed') await window.PlatformBackend.loadRemoved(); break;
      case 'reload-removed': await window.PlatformBackend.loadRemoved(); break;
      case 'more-removed': await window.PlatformBackend.loadRemoved({ more: true }); break;
      case 'restore': if ((B().removed || []).some(item => item.id === id)) await task('visibility', { id, published: true }, '資訊已還原，可切換至原發布日期查看。'); break;
      case 'feedback': openFeedback();break;
      case 'close-feedback': if(!state.feedbackBusy)close($('feedback-dialog'));break;
      case 'skip-selected':await skipPendingRows([...pendingSelection]);break;
      case 'skip-pending':await skipPendingRows([id]);break;
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
  document.addEventListener('change', async event => {
    const target = event.target;
    if(target.dataset.pendingChoice){const id=target.dataset.pendingChoice;if(target.checked)pendingSelection.add(id);else pendingSelection.delete(id);settingsDialog(true);return;}
    if(target.id==='history-date'){const date=target.value;await selectHistoryDate(date);return;}
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
    lastControl=event.submitter||form.querySelector('button[type=submit]');
    if (!['filter-form', 'knowledge-filter', 'date-form', 'source-form', 'article-form', 'edit-form', 'feedback-form', 'history-date-form', 'history-source-form'].includes(id)) return;
    event.preventDefault(); if (id === 'filter-form' || id==='knowledge-filter') return;
    const values = Object.fromEntries(new FormData(form));
    if (id === 'date-form') {
      if (!U.validDate(values.from) || !U.validDate(values.to) || values.from > values.to || values.to > U.today()) { $('date-error').textContent = '請選擇有效日期，結束日需晚於或等於開始日，且不可晚於今天。'; return; }
      await setPeriod('custom', values.from, values.to); return;
    }
    if(id==='feedback-form'){await sendFeedback(form,values);return;}
    if(id==='history-date-form'){
      if(!B().admin)return;state.historyDate=values.date;
      const prior=state.historyStatus?.job;
      const resume=prior&&(prior.needsRefresh||prior.canRetryEmpty||['failed','partial'].includes(prior.status));
      if(prior&&!resume){toast('這一天正在搜尋或已經完成。');return;}
      await historyTask({operation:resume?'retry':'start',date:state.historyDate},resume?'已接續處理，保留先前完成的進度。':'已開始搜尋這一天。');return;
    }
    if(id==='history-source-form'){
      if(!B().admin)return;
      const identifier=form.dataset.id,action=identifier?'edit':'add';
      const result=await historyTask({operation:'source',action,...values,...(identifier?{id:identifier}:{})},'來源已儲存。');
      if(result){state.historyEditingSource=null;await pollHistory();settingsDialog();}return;
    }
    if (!B().admin || state.busy) return;
    if (id === 'source-form') {const identifier=form.dataset.id;const result=await task('source', { ...values, ...(identifier?{id:identifier,operation:'edit'}:{enabled:true}) }, identifier?'每日來源已更新。':'每日來源已新增。');if(result){state.dailyEditingSource=null;settingsDialog();}}
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
      const removeAttachmentUrls=new FormData(form).getAll('removeAttachment');
      if(removeAttachmentUrls.length){if(!window.confirm(`確定移除此篇新聞的 ${removeAttachmentUrls.length} 個附件連結？原文與新聞內容會保留。`))return;patch.removeAttachmentUrls=removeAttachmentUrls;}
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
      pendingSelection.clear();
      if ($('settings-dialog').open) $('settings-dialog').close();
      if ($('detail-dialog').open) $('detail-dialog').close();
    }
    previousUID = B().user?.uid || null; previousAdmin = B().admin;
    if ($('settings-dialog').open && B().admin && ['removed','feedback','updates'].includes(state.settingsTab)&&!state.busy) settingsDialog();
    if (accountRequested && B().user && !B().checkingAdmin) { accountRequested = false; account(); }
  });
})();
