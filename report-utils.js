/* Shared report dates and ordering. All calendar boundaries use Asia/Taipei. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReportUtils=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
  function shift(s,n){if(!validDate(s))throw Error('日期格式不正確。');const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function bounds(mode='previous',now=new Date()){const day=today(now),weekday=new Date(day+'T00:00:00Z').getUTCDay();const monday=shift(day,-((weekday+6)%7));return mode==='current'?{from:monday,to:day}:{from:shift(monday,-7),to:shift(monday,-1)};}
  function stamp(v){if(!v)return '';const d=typeof v.toDate==='function'?v.toDate():v.seconds!=null?new Date(v.seconds*1000):new Date(v);return isNaN(d)?'':today(d);}
  function articleDay(a){return validDate(a.reportDate)?a.reportDate:validDate(a.date)?a.date:stamp(a.retrievedAt);}
  function period(from,to){return `${from.replaceAll('-','/')} – ${to.replaceAll('-','/')}`;}
  function safeURL(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  function sortArticles(items){const order={high:0,medium:1,low:2};return [...items].sort((a,b)=>(order[a.priority]??2)-(order[b.priority]??2)||articleDay(b).localeCompare(articleDay(a))||String(a.id).localeCompare(String(b.id)));}
  function topics(items){const m=new Map();items.forEach(a=>[...new Set(a.topics||[])].forEach(t=>m.set(t,(m.get(t)||0)+1)));return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-TW'));}
  const DOMESTIC_HOSTS=new Set(['www.fsc.gov.tw','fsc.gov.tw','www.banking.gov.tw','banking.gov.tw','law.fsc.gov.tw','tcf.sfi.org.tw','www.ba.org.tw','ba.org.tw','www.foi.org.tw','foi.org.tw','www.esunbank.com','www.cathaybk.com.tw','cathaybk.com.tw','www.taishinbank.com.tw','www.fubon.com','www.bot.com.tw','www.tcb-bank.com.tw','www.cna.com.tw','netzero.cna.com.tw','www.ctee.com.tw']);
  function articleRegion(a){if(['國內','國外'].includes(a.region))return a.region;try{return DOMESTIC_HOSTS.has(new URL(a.url).hostname.toLowerCase())?'國內':'';}catch{return '';}}
  function reportArticle(a){return {id:String(a.id||''),title:String(a.title||''),source:String(a.source||''),type:String(a.type||'相關機構'),region:articleRegion(a),kind:String(a.kind||''),date:validDate(a.date)?a.date:null,reportDate:articleDay(a),summary:String(a.summary||''),implication:String(a.implication||''),facts:(a.facts||[]).map(String).slice(0,4),topics:(a.topics||[]).map(String),priority:a.priority||'medium',url:safeURL(a.url),retrievedAt:stamp(a.retrievedAt)};}
  function overview(items,label='報告'){if(!items.length)return '所選期間尚無收錄資訊。';const names=topics(items).slice(0,3).map(t=>t[0]);return `${label}收錄 ${items.length} 則公開資訊${names.length?'，涵蓋'+names.join('、')+'等主題':''}。以下整理各項措施與值得關注的發展。`;}
  return {today,validDate,shift,bounds,stamp,articleDay,period,safeURL,sortArticles,topics,articleRegion,reportArticle,overview};
});
