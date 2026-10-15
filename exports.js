/* Office exports use local dependencies. No documents or notes leave the browser. */
(() => {
  'use strict';
  const clean = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  const xml = s => clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const colName = n => { let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s; };
  const formatPriority = p => ({high:'高關注',medium:'中關注',low:'一般'}[p] || '一般');
  async function xlsx(payload) {
    const zip = new window.JSZip();
    const detail = [
      ['資訊標題','來源','來源類型','發布／更新日期','日期性質','公平待客原則','金融友善主題','關注程度','關注理由','摘要','參考判讀','確認狀態','整理筆記','公開來源網址','摘要產生方式','模型','公開內容重點','原文依據'],
      ...payload.articles.map(a=>[a.title,a.source,a.type,a.date||'未標示',a.dateLabel,a.principles.join('、'),a.topics.join('、'),formatPriority(a.priority),a.priorityReason,a.summary,a.implication,a.reviewed?'已確認':'待確認',a.note,a.url,a.analysisKind==='gemini'?'Gemini AI':'人工整理',a.model||'',a.facts.join('；'),(a.evidence||[]).map(e=>e.claim+'：'+e.quote).join('；')])
    ];
    const overview=[['報告資訊','內容'],['報告名稱',payload.title],['資料範圍',payload.period],['資訊件數',payload.articles.length],['觀測重點',payload.introduction],['資料說明',payload.notice],[],['主題','涉及資訊件數（可複選）'],...payload.topics];
    const sheet = (rows, widths, hyperlink=false) => {
      const body=rows.map((row,j)=>`<row r="${j+1}" ht="${j===0?28:42}" customHeight="1">${row.map((cell,k)=>{const ref=colName(k+1)+(j+1),style=j===0?1:2;return typeof cell==='number'?`<c r="${ref}" s="${style}"><v>${cell}</v></c>`:`<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`}).join('')}</row>`).join('');
      const links=hyperlink?`<hyperlinks>${rows.slice(1).map((_,j)=>`<hyperlink ref="N${j+2}" r:id="rId${j+1}"/>`).join('')}</hyperlinks>`:'';
      return declaration+`<worksheet xmlns="${ns}" xmlns:r="${relns}"><dimension ref="A1:${colName(Math.max(...rows.map(r=>r.length)))}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,k)=>`<col min="${k+1}" max="${k+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${hyperlink?`<autoFilter ref="A1:R${rows.length}"/>`:''}${links}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`;
    };
    zip.file('[Content_Types].xml',declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    zip.file('_rels/.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',declaration+`<workbook xmlns="${ns}" xmlns:r="${relns}"><sheets><sheet name="資訊明細" sheetId="1" r:id="rId1"/><sheet name="報告與主題統計" sheetId="2" r:id="rId2"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relns}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${relns}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${relns}/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',declaration+`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft JhengHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B58"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    zip.file('xl/worksheets/sheet1.xml',sheet(detail,[46,27,15,18,25,32,32,14,35,70,65,14,50,65,20,28,70,65],true));
    zip.file('xl/worksheets/sheet2.xml',sheet(overview,[34,100]));
    zip.file('xl/worksheets/_rels/sheet1.xml.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${payload.articles.map((a,j)=>`<Relationship Id="rId${j+1}" Type="${relns}/hyperlink" Target="${xml(a.url)}" TargetMode="External"/>`).join('')}</Relationships>`);
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  async function word(payload) {
    const d=window.docx;
    const p=(text,opts={})=>new d.Paragraph({children:[new d.TextRun({text:clean(text),font:'Microsoft JhengHei',size:22})],spacing:{after:130,line:330},...opts});
    const children=[new d.Paragraph({text:payload.title,heading:d.HeadingLevel.TITLE}),p(payload.period),p(payload.notice),new d.Paragraph({text:'一、觀測重點',heading:d.HeadingLevel.HEADING_1}),p(payload.introduction),p('主題分布：'+payload.topics.map(([t,n])=>`${t} ${n} 則`).join('；')),new d.Paragraph({text:'二、重點資訊與參考判讀',heading:d.HeadingLevel.HEADING_1})];
    payload.articles.forEach((a,j)=>{
      children.push(new d.Paragraph({text:`${j+1}. ${clean(a.title)}`,heading:d.HeadingLevel.HEADING_2}),p(`${a.source}｜${a.dateLabel}：${a.date||'未標示'}｜${formatPriority(a.priority)}｜${a.reviewed?'已確認':'待確認'}`),p('摘要：'+a.summary),p('參考判讀：'+a.implication),p('分類：'+a.principles.join('、')+'；'+a.topics.join('、')));
      children.push(p('公開內容重點：'+a.facts.join('；')));if(a.model)children.push(p('AI 模型：'+a.model));for(const e of a.evidence||[])children.push(p('原文依據：'+e.claim+'（'+e.quote+'）'));if(a.note)children.push(p('整理筆記：'+a.note));
      children.push(p('核對事項：'+a.verification),new d.Paragraph({children:[new d.ExternalHyperlink({link:a.url,children:[new d.TextRun({text:'公開來源：'+a.url,style:'Hyperlink',size:18})]})],spacing:{after:280}}));
    });
    const doc=new d.Document({creator:'公平待客暨金融友善資訊平台',title:payload.title,styles:{default:{document:{run:{font:'Microsoft JhengHei',size:22,color:'344E39'}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{font:'Microsoft JhengHei',size:38,bold:true,color:'176B58'},paragraph:{spacing:{after:250}}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',run:{font:'Microsoft JhengHei',size:28,bold:true,color:'176B58'},paragraph:{spacing:{before:280,after:180},keepNext:true}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',run:{font:'Microsoft JhengHei',size:24,bold:true},paragraph:{spacing:{before:250,after:150},keepNext:true}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},footers:{default:new d.Footer({children:[new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[new d.TextRun({text:'公開資訊觀測 · ',size:18,color:'91A084'}),new d.TextRun({children:[d.PageNumber.CURRENT],size:18})]})]})},children}]});
    return d.Packer.toBlob(doc);
  }
  async function powerpoint(payload) {
    const ppt=new window.PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='公平待客暨金融友善資訊平台';ppt.subject='公開資訊觀測';ppt.title=payload.title;ppt.lang='zh-TW';ppt.theme={headFontFace:'Microsoft JhengHei',bodyFontFace:'Microsoft JhengHei',lang:'zh-TW'};
    const text=(slide,s,x,y,w,h,size=18,color='344E39',extra={})=>slide.addText(clean(s),{x,y,w,h,fontFace:'Microsoft JhengHei',fontSize:size,color,margin:0,breakLine:false,fit:'shrink',...extra});
    function base(title) {const slide=ppt.addSlide();slide.background={color:'F6F8F3'};slide.addShape(ppt.ShapeType.rect,{x:0,y:0,w:0.18,h:7.5,fill:{color:'176B58'},line:{color:'176B58'}});text(slide,'PUBLIC INFORMATION BRIEF',.62,.36,11,.3,11,'7C9470');text(slide,title,.62,.95,12,1,28,'233930',{bold:true});text(slide,'公開來源 · AI 摘要及判讀請核對原文',.62,7.06,9,.2,9,'8FA080');text(slide,String(ppt._slides.length),12.0,7.02,.6,.3,10,'8FA080',{align:'right'});return slide;}
    const cover=base(payload.title);text(cover,payload.period,.66,2.05,11,.55,16,'78916C');text(cover,`${payload.articles.length} 則公開資訊`,.66,3.15,11,1,38,'176B58',{bold:true});text(cover,payload.introduction,.66,4.55,11.6,1.5,19);text(cover,'來源連結、日期及確認狀態保留於各資訊頁',.66,6.42,11,.35,12,'8B9C7C');
    const overview=base('觀測重點與主題分布');text(overview,payload.introduction,.66,2.05,5.2,2.2,20);
    const topics=payload.topics.slice(0,6);if(topics.length){overview.addChart(ppt.ChartType.bar,[{name:'涉及資訊件數',labels:topics.map(x=>x[0]),values:topics.map(x=>x[1])}],{x:6.25,y:2.05,w:6.35,h:3.8,barDir:'bar',chartColors:['719675'],showLegend:false,showValue:true,catAxisLabelFontFace:'Microsoft JhengHei',catAxisLabelFontSize:12,valAxisLabelFontSize:11,showTitle:false,showBorder:false,showCatName:false,valGridLine:{color:'E3EBDD',style:'dash'}});}text(overview,'一則資訊可涉及多個主題；此圖不代表全市場發生率。',6.3,6.1,6,.5,11,'8B9C7C');
    payload.articles.forEach((a,j)=>{
      const chunks=clean(a.summary).match(/[\s\S]{1,400}/g)||[''];
      chunks.forEach((chunk,k)=>{
        const s=base(`${j+1}. ${a.title}${k?'（續）':''}`);text(s,`${a.source} ｜ ${a.dateLabel}：${a.date||'未標示'} ｜ ${a.reviewed?'已確認':'待確認'}`,.66,1.95,12,.55,12,'819574');
        s.addShape(ppt.ShapeType.rect,{x:.65,y:2.8,w:7.1,h:3.1,fill:{color:'FFFFFF'},line:{color:'E4EBDC'},radius:.1});text(s,'重點摘要',.9,3.05,6.5,.35,15,'176B58',{bold:true});text(s,chunk,.9,3.66,6.45,1.95,19);
        text(s,'參考判讀',8.15,3.04,4.3,.4,15,'176B58',{bold:true});text(s,a.implication,8.15,3.68,4.35,1.35,17);if(a.note)text(s,'整理筆記：'+a.note,8.15,5.15,4.35,.8,12,'748F66');
        text(s,a.topics.join(' · '),.7,6.2,11.7,.4,11,'8FA17E');text(s,'開啟公開來源',.7,6.66,3,.26,10,'176B58',{hyperlink:{url:a.url}});
      });
    });
    return ppt.write({outputType:'arraybuffer'});
  }
  const mime={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
  async function create(format,payload) {if(!payload.articles.length)throw Error('No articles selected');return ({xlsx,docx:word,pptx:powerpoint}[format])(payload);}
  async function download(format,payload) {const bytes=await create(format,payload);const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:mime[format]});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(payload.title||'公開資訊報告').replace(/[\\/:*?"<>|]/g,'_').slice(0,100)+'.'+format;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  window.PlatformExports={create,download};
})();
