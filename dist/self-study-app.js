(function(){
'use strict';
const D=window.SelfStudyData,C=window.SelfStudyCore,S=window.SELF_STUDY_SAMPLES,E=C.escapeHTML,R=window.ReadingCoachReadingSupport;
const main=document.getElementById('main'),warning=document.getElementById('storage-warning'),live=document.getElementById('live-status');
const splitScreen=window.matchMedia('(min-width: 960px) and (min-height: 540px) and (orientation: landscape)');
let state,storageFailed=false,current=null,persistTimer,activePane='coach',shownLesson='',activeReadingId='',readerScroll=null,readerAnchor=null,readerObserver=null,observedReader=null,locateTarget=null,locatedParagraphs=[],paneScroll={text:0,coach:0};
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
try{state=C.migrate(read(C.KEY),read(C.LEGACY_KEY),D.questions);persist();}catch{state=C.fresh();showStorageWarning();}
function showStorageWarning(){storageFailed=true;warning.hidden=false;warning.textContent='這個瀏覽器暫時無法儲存答案；目前可以繼續練習，關閉頁面後本次內容可能消失。';}
function persist(){state.updatedAt=new Date().toISOString();try{localStorage.setItem(C.KEY,JSON.stringify(state));if(storageFailed){storageFailed=false;warning.hidden=true;}}catch{showStorageWarning();}}
function announce(text){live.textContent=text;}
function draft(q){return state.questions[q.id]||(state.questions[q.id]=C.draft());}
function route(){const bits=location.hash.slice(1).split('/');if(bits[0]==='export'){const scope=bits[1]==='year'?{kind:'year',year:Number(bits[2])}:{kind:'article',id:bits[2]};const p=scope.kind==='article'?D.articles.find(a=>a.id===scope.id):null;return{view:'export',scope,p,year:p?.year||scope.year};}if(['practice','lesson'].includes(bits[0]))return{view:'lesson',q:D.questions.find(q=>q.id===bits[1])};if(bits[0]==='article')return{view:'article',p:D.articles.find(p=>p.id===bits[1]),mode:bits[2]==='questions'?'questions':'read'};if(bits[0]==='year')return{view:'year',year:Number(bits[1])};return{view:'home'};}
function go(hash){if(location.hash==='#'+hash){render();return;}location.hash=hash;}
function crumb(items){return '<nav class="breadcrumbs" aria-label="所在位置"><a href="#home">年份目錄</a>'+items.map(x=>'<span aria-hidden="true">／</span>'+(x.href?'<a href="'+E(x.href)+'">'+E(x.text)+'</a>':'<span aria-current="page">'+E(x.text)+'</span>')).join('')+'</nav>';}
function readingArt(){return '<svg viewBox="0 0 260 160" width="260" height="160" fill="none"><g stroke="currentColor" stroke-width="1.2"><path opacity=".45" d="M10 131c38-30 73-30 114-13s80 22 126-11M10 145c38-30 73-30 114-13s80 22 126-11M10 117c38-30 73-30 114-13s80 22 126-11"/><path d="M166 110V59m0 25c-25-3-33-17-33-17 25 0 32 17 32 17m2 16c23-3 33-18 33-18-25 0-33 18-33 18"/><circle cx="166" cy="39" r="13"/><circle cx="166" cy="39" r="28" stroke-dasharray="2 6"/><path d="M63 82V49m0 19C43 64 42 54 42 54c18-2 21 14 21 14m0 9c20-4 23-15 23-15-18-1-23 15-23 15"/><circle cx="63" cy="32" r="11"/><circle cx="63" cy="32" r="21" stroke-dasharray="2 5"/></g></svg>';}
function readingTools(){return '<div class="reading-tools" role="group" aria-label="字體大小"><lumen-button variant="ghost" size="icon" data-ui-action="font-smaller" aria-label="縮小原文字體" title="縮小字體">A−</lumen-button><lumen-button variant="ghost" size="icon" data-ui-action="font-larger" aria-label="放大原文字體" title="放大字體">A＋</lumen-button></div>';}
function yearGate(year){return '<div class="year-gate-wrap"><section class="year-gate" aria-labelledby="year-gate-title"><p class="eyebrow">DSE YEAR / ACCESS</p><h1 id="year-gate-title">進入'+year+'年篇章</h1><p class="year-gate-copy">請輸入密碼，查看這一年的文章與題目。</p><form class="year-gate-form" id="year-access-form" data-year="'+year+'"><label for="year-access-password">密碼</label><input id="year-access-password" name="password" type="password" autocomplete="current-password" required><button class="button primary" type="submit">解鎖年份 <span aria-hidden="true">→</span></button><p class="year-access-error" id="year-access-error" role="alert" hidden></p></form><p class="year-gate-note">教師通行碼可一次解鎖所有年份。</p><a class="back-link" href="#home">← 返回篇章目錄</a></section></div>';}
function updateShell(){
 const nav=document.getElementById('context-nav'),years=document.getElementById('sidebar-years'),title=document.getElementById('current-location');
 const p=current.p||(current.q&&D.articles.find(p=>p.id===current.q.exerciseId)),year=p?.year||current.year;
 if(title)title.textContent=p?p.title:year?year+' 年篇章':'篇章目錄';
 if(nav)nav.innerHTML='<a href="#home" '+(current.view==='home'?'aria-current="page"':'')+'><span class="nav-symbol" aria-hidden="true">☰</span>篇章目錄</a>'+(p?'<a href="#article/'+p.id+'" '+(current.view==='article'&&current.mode==='read'?'aria-current="page"':'')+'><span class="nav-symbol" aria-hidden="true">01</span>文章</a><a href="#article/'+p.id+'/questions" '+(current.view==='lesson'||current.mode==='questions'?'aria-current="page"':'')+'><span class="nav-symbol" aria-hidden="true">02</span>題目</a>':'');
 if(years)years.innerHTML=[...new Set(D.articles.map(a=>a.year))].sort().map(y=>'<a href="#year/'+y+'" '+(year===y?'aria-current="page"':'')+'>'+y+'<span>'+D.articles.filter(a=>a.year===y).length+'篇</span></a>').join('');
 document.body.dataset.view=current.view;
 document.body.dataset.year=year||'';
}
let readingFont=19;try{const n=Number(localStorage.getItem('readingcoach-font-size'));if(n>=14&&n<=26)readingFont=n;}catch{}
document.documentElement.style.setProperty('--reading-size',readingFont+'px');
function animateContent(target){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!target?.animate)return;target.animate([{opacity:.2},{opacity:1}],{duration:180,easing:'ease-out'});}
function articleQuestions(p){return D.questions.filter(q=>q.exerciseId===p.id).sort((a,b)=>a.number-b.number);}
function status(q){const d=state.questions[q.id];return d?.completed?'已完成':d&&(d.type||Object.values(d.answers).some(v=>v.trim()))?'練習中':'未開始';}
function coverage(p){return '第'+articleQuestions(p).map(q=>q.number).join('、')+'題';}
// Use the verified source glyph only when its mask can load; otherwise use the shortened display name.
let rareAuthorReady=false;
function rareAuthorName(){return rareAuthorReady?'利格拉樂．阿<span class="rare-author-glyph">𡠄</span>':'利格拉樂';}
function authorLabel(p){return p.id==='dse2020-father'?'<span class="author-name" data-rare-author>'+rareAuthorName()+'</span>':E(p.author);}
const maskSupported=window.CSS&&(CSS.supports('mask-image','url("glyph.svg")')||CSS.supports('-webkit-mask-image','url("glyph.svg")'));
if(maskSupported&&document.currentScript?.src){
 const glyph=new Image();
 glyph.onload=()=>{rareAuthorReady=glyph.naturalWidth>0;main.querySelectorAll('[data-rare-author]').forEach(el=>{el.innerHTML=rareAuthorName();});};
 glyph.onerror=()=>{rareAuthorReady=false;main.querySelectorAll('[data-rare-author]').forEach(el=>{el.textContent='利格拉樂';});};
 glyph.src=new URL('author-au-glyph.svg',document.currentScript.src).href;
}
function paragraphName(p,number){return p.paragraphs.find(a=>a.number===Number(number))?.label||'第'+number+'段';}
function unitCount(p){return p.paragraphs.length+(p.paragraphs.some(a=>a.label)?'則':'段');}
const readingSupport=R.bind(main,()=>current?.view==='article'?current.p:current?.view==='lesson'?readingArticle(current.q):null);
function articleRow(p){
 const qs=articleQuestions(p),done=qs.filter(q=>state.questions[q.id]?.completed).length,index=D.articles.filter(a=>a.year===p.year).findIndex(a=>a.id===p.id)+1;
 return '<a class="article-row" href="#article/'+p.id+'"><div class="article-index">'+String(index).padStart(2,'0')+'</div><div class="article-info"><h3>'+E(p.title)+'</h3><p>'+authorLabel(p)+'<span>·</span>'+unitCount(p)+'<span>·</span>'+qs.length+'題</p><small>已收錄'+E(coverage(p))+'</small></div><div class="article-progress"><span>'+done+' / '+qs.length+' 完成</span><progress class="article-meter" max="'+qs.length+'" value="'+done+'" aria-label="'+E(p.title)+'答題進度"></progress></div><span class="arrow" aria-hidden="true">→</span></a>';
}
function home(year){
 const allYears=[...new Set(D.articles.map(p=>p.year))].sort(),years=year?[year]:allYears,articles=D.articles.filter(p=>!year||p.year===year),questions=D.questions.filter(q=>!year||q.year===year),done=questions.filter(q=>state.questions[q.id]?.completed).length;
 const latest=questions.filter(q=>state.questions[q.id]?.lastSeen&&!state.questions[q.id]?.completed).sort((a,b)=>(state.questions[b.id].lastSeen).localeCompare(state.questions[a.id].lastSeen))[0];
 return '<div class="directory">'+(year?crumb([{text:year+'年'}])+'<a class="button secondary" href="#export/year/'+year+'">導出本年份試卷</a>':'')+'<section class="hero"><div><p class="eyebrow">READING COACH / DSE 中文</p><h1>'+(year?year+'，<br>讀進這一年。':'從一篇文章，<br>開始閱讀。')+'</h1><p class="hero-copy">'+(year?(articles.some(a=>a.genre==='classical')?'文言與白話閱讀':'白話文閱讀')+' · '+articles.length+' 篇文章':'讀懂文字，也讀出自己的理解。')+'</p>'+(latest?'<a class="button primary" href="#lesson/'+latest.id+'">繼續第'+latest.number+'題 <span aria-hidden="true">→</span></a>':'')+'</div><div class="hero-stats"><div><strong>'+articles.length+'</strong><span>篇文章</span></div><div><strong>'+questions.length+'</strong><span>道真題</span></div><div><strong>'+done+'</strong><span>已完成</span></div></div></section><div class="directory-heading"><h2>'+(year?year+' 年篇章':'篇章目錄')+'</h2><span>'+done+' / '+questions.length+'題已完成</span></div><nav class="year-filter" aria-label="選擇年份"><a href="#home" '+(!year?'aria-current="page"':'')+'>全部</a>'+allYears.map(y=>'<a href="#year/'+y+'" '+(y===year?'aria-current="page"':'')+'>'+y+'</a>').join('')+'</nav>'+years.map(y=>'<section class="year-group" aria-labelledby="year-'+y+'"><div class="year-heading"><h2 id="year-'+y+'">'+y+'</h2><span>'+D.articles.filter(p=>p.year===y).length+' 篇</span></div><lumen-card class="year-articles" density="compact">'+D.articles.filter(p=>p.year===y).map(articleRow).join('')+'</lumen-card></section>').join('')+'</div>';
}
function articlePage(p){
 const qs=articleQuestions(p),done=qs.filter(q=>state.questions[q.id]?.completed).length;
 const continueQ=qs.filter(q=>state.questions[q.id]?.lastSeen).sort((a,b)=>(state.questions[b.id]?.lastSeen||'').localeCompare(state.questions[a.id]?.lastSeen||''))[0];
 const start=continueQ||qs.find(q=>!state.questions[q.id]?.completed)||qs[0],reading=current.mode==='read';
 const directory='<section class="question-directory" aria-labelledby="questions-title"><h2 id="questions-title">逐題學習</h2><p><a class="button secondary" href="#export/article/'+p.id+'">導出本篇試卷</a></p>'+qs.map((q,i)=>'<a class="question-row" href="#lesson/'+q.id+'"><span class="question-number">'+String(i+1).padStart(2,'0')+'</span><div><h3>第'+q.number+'題 <small>'+q.marks+'分</small></h3><p>'+E(q.prompt)+'</p></div><span class="status '+(state.questions[q.id]?.completed?'done':'')+'">'+status(q)+'</span><span aria-hidden="true">→</span></a>').join('')+'</section>';
 return '<div class="article-page">'+crumb([{href:'#year/'+p.year,text:p.year+'年'},{text:p.title}])+'<header class="article-intro"><div><p class="eyebrow">'+p.year+' DSE / '+(p.genre==='classical'?(p.year<2018?'非指定文言':'乙部文言'):'閱讀篇章')+'</p><h1 class="'+(Array.from(p.title).length>12?'long-title':'')+'">'+E(p.title)+'</h1><p>'+authorLabel(p)+'<span>·</span>'+unitCount(p)+'<span>·</span>'+qs.length+'題<span>·</span>'+done+' / '+qs.length+'題完成</p></div><div class="article-intro-art" aria-hidden="true">'+readingArt()+'</div></header><nav class="article-nav" aria-label="本篇學習"><a href="#article/'+p.id+'" '+(reading?'aria-current="page"':'')+'>原文與分析</a><a href="#article/'+p.id+'/questions" '+(!reading?'aria-current="page"':'')+'>逐題學習 <span>'+qs.length+'題</span></a><a class="button primary article-start" href="#lesson/'+start.id+'">'+(continueQ?'繼續第'+start.number+'題':'開始第'+start.number+'題')+' <span aria-hidden="true">→</span></a></nav>'+(reading?'<div class="article-study-layout"><section class="article-reading" aria-labelledby="reading-title"><div class="analysis-toolbar"><h2 id="reading-title">原文</h2>'+readingTools()+'<label class="analysis-switch"><input type="checkbox" id="analysis-toggle" aria-controls="article-original"><span>'+(p.genre==='classical'?'逐則分析':'逐段分析')+'</span></label></div><div id="article-original">'+passageText(p,true)+'</div><div class="article-read-end"><span>全文完</span><a class="button primary" href="#lesson/'+start.id+'">進入答題 <span aria-hidden="true">→</span></a></div></section><aside class="article-outline" aria-label="篇章索引"><p class="eyebrow">篇章索引</p><nav>'+p.paragraphs.map(a=>'<a href="#para-'+a.number+'" data-ui-action="paragraph" data-paragraph="'+a.number+'">'+String(a.number).padStart(2,'0')+'<span>'+E(paragraphName(p,a.number))+'</span></a>').join('')+'</nav><div class="outline-progress"><strong>'+qs.length+'</strong><span>道閱讀題</span><a href="#article/'+p.id+'/questions">查看題目 →</a></div></aside></div>':directory)+'</div>';
}
function passageText(p,analysis=false){return '<div class="passage-text">'+(p.background?'<aside class="passage-notes" aria-label="寫作背景"><p><strong>寫作背景：</strong>'+E(p.background)+'</p></aside>':'')+(p.numberingNote?'<p class="muted small">'+E(p.numberingNote)+'</p>':'')+p.paragraphs.map(a=>'<div class="paragraph '+(a.label?'named-paragraph':'')+'" id="para-'+a.number+'" data-paragraph="'+a.number+'">'+(a.label?'<h3 class="passage-section-label">'+E(a.label)+'</h3>':'<span class="paragraph-number" aria-label="第'+a.number+'段">('+a.number+')</span>')+'<p class="source-text">'+R.sourceHTML(a.text,a.highlights||[],[],a.number,p.notes,a.highlightRanges||[])+'</p>'+(a.sourceLabel?'<p class="passage-section-source">'+E(a.sourceLabel)+'</p>':'')+(analysis&&a.support?'<div class="classical-help-slot" data-translation-paragraph="'+a.number+'"></div>':'')+(analysis?'<div class="analysis-slot" data-analysis-paragraph="'+a.number+'"></div>':'')+'</div>').join('')+(p.notes?.length?'<aside class="passage-notes" aria-label="原文註釋"><h3 class="source-notes-title">原卷註釋</h3>'+p.notes.map(t=>'<p>'+E(t)+'</p>').join('')+'</aside>':'')+'</div>';}

function readingArticle(q){return D.articles.find(p=>p.id===(activeReadingId||q.readingArticleId||q.exerciseId));}
function readerPanel(q,p){
 const ids=Object.keys(q.readingReferences||{});
 const selector=ids.length>1?'<nav class="reading-selector" aria-label="本題相關篇章">'+ids.map(id=>{const a=D.articles.find(p=>p.id===id);return '<button type="button" data-action="reading" data-article="'+id+'" aria-pressed="'+(p.id===id)+'">'+E(a.title)+'</button>';}).join('')+'</nav>':'';
 return selector+'<section class="reader" aria-labelledby="reader-title"><header class="reader-header"><h2 id="reader-title">閱讀原文 · '+E(p.title)+'</h2><span>'+unitCount(p)+'</span>'+readingTools()+'<small data-reader-location></small>'+(p.genre==='classical'?'<label class="analysis-switch reader-analysis-switch"><input type="checkbox" id="reader-analysis-toggle" aria-controls="reader-original"><span>逐則分析</span></label>':'')+'</header><div class="reader-content" id="reader-original" tabindex="0" aria-label="可捲動的原文">'+passageText(p,p.genre==='classical')+'</div></section>';
}
function switchReading(id){
 const q=current.q;if(!q.readingReferences?.[id]||activeReadingId===id)return;
 readingSupport.close();
 activeReadingId=id;const p=readingArticle(q);locatedParagraphs=C.questionParagraphs(q,p);locateTarget=locatedParagraphs[0]||p.paragraphs[0].number;readerScroll=null;readerAnchor=null;
 main.querySelector('#lesson-text').innerHTML=readerPanel(q,p);main.querySelector('#tab-text span').textContent=unitCount(p);applyLessonLayout();
 main.querySelector('.reading-selector [data-article="'+id+'"]')?.focus({preventScroll:true});announce('已切換到'+p.title+'，段號按這篇原文。');
}
function paragraphAnalysis(p,number){
 const a=window.SelfStudyAnalysis[p.id].find(a=>a.number===number);
 return '<details class="paragraph-analysis"><summary>顯示'+E(paragraphName(p,number))+'大意與分析</summary><dl>'+[['內容大意',a.summary],['手法與表達',a.technique],['深層意思',a.meaning],['結構與連繫',a.structure]].map(([label,text])=>'<div><dt>'+label+'</dt><dd>'+E(text)+'</dd></div>').join('')+'</dl></details>';
}
function setReadingAnalysis(p,enabled){
 readingSupport.close();
 main.querySelectorAll('.paragraph').forEach(row=>{const a=p.paragraphs.find(a=>a.number===Number(row.dataset.paragraph));if(!a)return;row.querySelector('.source-text').innerHTML=R.sourceHTML(a.text,a.highlights||[],enabled?a.support?.words||[]:[],a.number,p.notes,a.highlightRanges||[]);const support=row.querySelector('[data-translation-paragraph]');if(support)support.innerHTML=enabled?R.translationHTML(a):'';});
 main.querySelectorAll('[data-analysis-paragraph]').forEach(slot=>{slot.innerHTML=enabled?paragraphAnalysis(p,Number(slot.dataset.analysisParagraph)):'';});
 announce(enabled?'分析按鈕已顯示；點擊個別部分才會打開分析。':'分析已隱藏。');
}
function questionParts(q){
 // Tables contain their own parts; explicit keys retain any original following parts.
 const parts=q.table||q.tables?.length?q.answerParts.filter(p=>q.tableAnswerKeys&&!q.tableAnswerKeys.includes(p.key)):q.answerParts;
 if(!parts.length)return '';
 return '<div class="question-subparts">'+parts.map(p=>{
 const label=q.answerParts.length>1?'<p class="question-part-label">'+E(p.label)+'</p>':'';
 const choices=p.kind==='choice'?'<ul class="question-options">'+p.choices.map(c=>'<li>'+(c.value!==c.text?'<b>'+E(c.value)+'</b> ':'')+quoteHTML({quote:c.text,quoteHighlights:c.highlights,quoteHighlightRanges:c.highlightRanges})+'</li>').join('')+'</ul>':'';
 return label+choices;
}).join('')+'</div>';}
function quoteHTML(q){
 if(q.quoteHighlightRanges?.length)return R.sourceHTML(q.quote||'',[],[],undefined,[],q.quoteHighlightRanges);
 const words=(q.quoteHighlights||[]).filter(word=>typeof word==='string'&&word.length);
 let text=q.quote||'',html='';
 while(text){const matches=words.map(word=>({word,index:text.indexOf(word)})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index||b.word.length-a.word.length);const next=matches[0];if(!next){html+=E(text);break;}html+=E(text.slice(0,next.index))+'<strong>'+E(next.word)+'</strong>';text=text.slice(next.index+next.word.length);}
 return html;
}
function questionTable(t,q,d,tableIndex=0){
 const editable=!!(q&&d&&q.tableAnswerCells),keys=editable?Object.entries(q.tableAnswerCells):[];
 const widths=t.columnWidths,columns=Array.isArray(widths)&&widths.length===t.headers.length&&widths.every(w=>Number.isFinite(w)&&w>0)&&Math.abs(widths.reduce((s,w)=>s+w,0)-100)<.01?'<colgroup>'+widths.map(w=>'<col style="width:'+w+'%">').join('')+'</colgroup>':'';
 return '<div class="table-scroll'+(editable?' answer-table-scroll':'')+'"'+(editable?' role="region" aria-label="填寫答案表格" tabindex="0"':'')+'><table'+(editable?' class="answer-table"'+(t.headers.length>2?' data-wide="true"':''):'')+(columns?' style="table-layout:fixed"':'')+'>'+columns+'<thead><tr>'+t.headers.map(x=>'<th scope="col">'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map((r,rowIndex)=>'<tr>'+r.map((x,i)=>{
  const cell=x&&typeof x==='object'?x:{text:x},span=Number.isInteger(cell.colSpan)&&cell.colSpan>1&&cell.colSpan<=t.headers.length-i?' colspan="'+cell.colSpan+'"':'',tag=i===0?'th':'td';
  const key=keys.find(([,at])=>at[0]===tableIndex&&at[1]===rowIndex&&at[2]===i)?.[0],part=q?.answerParts.find(p=>p.key===key);
  return '<'+tag+(i===0?' scope="row"':'')+span+(part?' class="table-answer-cell"':'')+'>'+(part?'<div class="table-cell-prompt" id="cell-prompt-'+E(key)+'">'+E(cell.text)+'</div>'+answerField(part,d,true):E(cell.text))+'</'+tag+'>';
 }).join('')+'</tr>').join('')+'</tbody></table></div>';
}
function questionText(q,d){
 const g=d.step>0?C.learningGroup(q,d):null,keys=g&&(d.step===1?g.answerKeys:g.keys);
 const focused=keys?{...q,answerParts:q.answerParts.filter(p=>keys.includes(p.key))}:q;
 let quote=q,fullQuote=false;
 if(g?.quoteLine!==undefined){
  const lines=q.quote.split('\n'),line=lines[g.quoteLine],offset=lines.slice(0,g.quoteLine).reduce((n,s)=>n+s.length+1,0);
  quote={...q,quote:line,quoteHighlightRanges:(q.quoteHighlightRanges||[]).filter(r=>r.start>=offset&&r.end<=offset+line.length).map(r=>({start:r.start-offset,end:r.end-offset}))};fullQuote=true;
 }
 const fullParts=!!keys&&keys.length<q.answerParts.length&&!q.tableAnswerCells;
 const original=fullQuote||fullParts?'<details class="full-question-details"><summary>查看完整原題（全部分題）</summary>'+(fullQuote?'<blockquote class="question-quote">'+quoteHTML(q)+'</blockquote>':'')+questionParts(q)+'</details>':'';
 return '<div class="question-sticky-anchor" aria-hidden="true"></div><section class="question-text" aria-label="原題"><div class="question-title"><h1>第'+q.number+'題</h1><span>'+q.marks+'分</span></div><div class="question-body" role="region" aria-label="題目全文" tabindex="-1"><p class="question-prompt">'+quoteHTML({quote:q.prompt,quoteHighlights:q.promptHighlights,quoteHighlightRanges:q.promptHighlightRanges})+'</p>'+(q.quote?'<blockquote class="question-quote focused-quote">'+quoteHTML(quote)+'</blockquote>':'')+(d?.step===1&&q.tableAnswerCells?'':(q.tables||(q.table?[q.table]:[])).map(t=>questionTable(t)).join(''))+questionParts(focused)+original+'</div><p class="question-scroll-note">題目較長，可在此捲動查看全文</p></section>';
}
function questionReference(q){
 const ref=q.answerParts.find(p=>p.assessmentReference)?.assessmentReference;if(!ref)return '';
 const prior=D.questions.find(x=>x.id===ref.questionId),part=prior?.answerParts.find(p=>p.key===ref.key),selected=state.questions[ref.questionId]?.answers?.[ref.key],choice=part?.choices.find(c=>c.value===selected);
 return '<div class="context-note question-reference"><strong>'+E(ref.label)+'</strong><p>你的選擇：'+(choice?E(choice.value+' '+choice.text):'尚未作答')+'</p><a class="back-link" href="#lesson/'+E(ref.questionId)+'">回第'+prior.number+'題核對或修改 →</a></div>';
}
function stageQuestion(q,d,step){
 const g=C.learningGroup(q,d);if(!g||step===0)return q;
 const keys=step===1?g.answerKeys:g.keys;
 return {...q,_original:q,_group:g,_wholeReview:d.revealed,_questionCompleted:d.completed,_lastIncomplete:q.learningGroups.filter(g=>!d.groupProgress[g.id].completed).length<=1,answerParts:q.answerParts.filter(p=>keys.includes(p.key))};
}
function gradingItems(q,d){
 const original=q._original||q,keys=q.answerParts.map(p=>p.key);
 return C.gradingItems(original,d,S,state.questions).filter(s=>keys.includes(s.key));
}
function learningGroups(q,d){
 const g=C.learningGroup(q,d);if(!g||d.step===0)return '';
 const done=q.learningGroups.filter(x=>d.groupProgress[x.id].completed).length;
 const together=g.answerKeys.length>g.keys.length;
 return '<section class="learning-groups'+(g.quoteLine!==undefined?' word-groups':'')+'" aria-label="分組練習"><div class="learning-group-heading"><strong>分組練習 '+(q.learningGroups.indexOf(g)+1)+' / '+q.learningGroups.length+'</strong><span>已完成 '+done+' / '+q.learningGroups.length+'組</span></div><nav aria-label="選擇練習分組">'+q.learningGroups.map((x,i)=>'<button type="button" data-action="group" data-group="'+E(x.id)+'" '+(x.id===g.id?'aria-current="true"':'')+'><span>'+(i+1)+'</span><b>'+E(x.label)+'</b>'+(d.groupProgress[x.id].completed?'<small aria-label="已完成">'+(g.quoteLine!==undefined?'✓':'已完成 ✓')+'</small>':'')+'</button>').join('')+'</nav><p class="muted small">'+(together?'相關分題先一併作答，再分組評分及閱讀解析。':'每次集中練習一組；完成後繼續下一組。')+'原題題號及總分維持不變。</p></section>';
}
function stepper(q,d){const labels=['辨認題型','找線索・作答',q.answerParts.every(p=>p.referenceOnly)?'核對分段':q.answerParts.every(p=>p.kind==='choice')?'核對選項':'評分練習','讀解析'];return '<nav class="stepper" aria-label="學習步驟">'+labels.map((x,i)=>'<button type="button" data-action="step" data-step="'+i+'" '+(i>0&&d.type!==q.lesson.type||i===3&&!d.revealed?'disabled':'')+' '+(d.step===i?'aria-current="step"':'')+'><span>'+String(i+1).padStart(2,'0')+'</span><b>'+x+'</b></button>').join('')+'</nav>';}
function classification(q,d){const l=q.lesson,has=d.type===l.type;return '<section class="learning-stage"><p class="stage-label">STEP 01 · 先拆題</p><h2>這一題主要考什麼？</h2><p class="muted">對照各題型的特徵，選出題幹要求的主要任務。</p><div class="type-grid">'+C.typeChoices(q).map(t=>'<button type="button" class="type-choice '+(d.type===t?'selected':'')+'" data-action="type" data-type="'+t+'" aria-pressed="'+(d.type===t)+'"><span class="type-copy"><strong>'+E(D.types[t].label)+'</strong><small>'+E(D.types[t].feature)+'</small></span><span class="type-mark" aria-hidden="true">'+(d.type===t?'✓':'＋')+'</span></button>').join('')+'</div>'+(d.type?'<div class="type-feedback '+(has?'success':'')+'" role="status"><strong>'+(has?'辨認正確':'再對照題幹與選項特徵')+'</strong><p>'+E(has?l.reason:D.types[d.type].feature+' 再看本題的要求：'+l.reason)+'</p></div>':'')+(d.type?methodDetails(d.type):'')+'<button class="button primary" type="button" data-action="step" data-step="1" '+(!has?'disabled':'')+'>進入作答 <span aria-hidden="true">→</span></button></section>';}
function methodDetails(type){const t=D.types[type];return '<details class="help-details method-details" data-help="method"><summary>答題步驟與注意事項 <span>點擊展開</span></summary><ol>'+t.steps.map(s=>'<li>'+E(s)+'</li>').join('')+'</ol><p class="tip">'+E(t.note)+'</p></details>';}
function hints(q){return '<details class="help-details question-hints" data-help="specific"><summary>本題提示：找線索與推論 <span>點擊展開</span></summary><p class="muted">先試着想；需要時逐項打開。</p>'+q.lesson.prompts.map((t,i)=>'<details class="hint-level" data-help="hint-'+i+'"><summary>提示 '+(i+1)+'</summary><p>'+E(t)+'</p></details>').join('')+'<div class="locate"><span>到文章中找：</span>'+(q.readingReferences?Object.entries(q.readingReferences).flatMap(([id,ns])=>ns.map(n=>'<button class="paragraph-link" type="button" data-action="locate" data-article="'+id+'" data-paragraph="'+n+'">'+E(D.articles.find(p=>p.id===id).title)+' · '+E(paragraphName(D.articles.find(p=>p.id===id),n))+'</button>')).join(''):q.lesson.locate.map(n=>'<button class="paragraph-link" type="button" data-action="locate" data-paragraph="'+n+'">'+E(paragraphName(D.articles.find(p=>p.id===q.exerciseId),n))+'</button>').join(''))+'</div></details>';}
function answerField(p,d,inTable=false){const limit=C.answerLimit(p),over=limit?.max&&C.answerCharacters(d.answers[p.key]||'').length>limit.max;return '<fieldset class="answer-field'+(inTable?' table-answer-field':'')+'"><legend'+(inTable?' class="sr-only"':'')+'>'+E(p.label)+' <span>'+p.marks+'分</span></legend>'+(inTable?'<p class="table-answer-marks">'+p.marks+'分</p>':'')+(p.markNote?'<p class="field-note">'+E(p.markNote)+'</p>':'')+(limit?'<p class="answer-limit" id="answer-limit-'+p.key+'">'+E(limit.text)+'</p>':'')+(p.kind==='choice'?(p.multiple?'<p class="field-note">可複選；本分題全部選對才給分。</p>':'')+'<div class="choice-list">'+p.choices.map(c=>'<label class="answer-choice"><input type="'+(p.multiple?'checkbox':'radio')+'" name="answer-'+p.key+'" data-answer="'+p.key+'" value="'+E(c.value)+'" '+(C.choiceValues(p,d.answers[p.key]).includes(c.value)?'checked':'')+'>'+(c.value===c.text?'<span>'+quoteHTML({quote:c.text,quoteHighlights:c.highlights,quoteHighlightRanges:c.highlightRanges})+'</span>':'<span class="option-letter">'+E(c.value)+'</span><span>'+quoteHTML({quote:c.text,quoteHighlights:c.highlights,quoteHighlightRanges:c.highlightRanges})+'</span>')+'</label>').join('')+'</div>':'<label class="sr-only" for="answer-'+p.key+'">'+E(p.label)+'</label><textarea id="answer-'+p.key+'" aria-describedby="'+(limit?'answer-limit-'+p.key+' ':'')+'answer-count-'+p.key+'" data-answer="'+p.key+'" rows="'+(p.kind==='short'?2:6)+'" placeholder="'+(p.exactChars?(p.exactChars===2?'填寫兩字詞':'以'+p.exactChars+'個字概括'):p.assessFirstChars?'不多於'+p.assessFirstChars+'字（標點亦計）':p.maxChars?'不多於'+p.maxChars+'個字':p.sourceGridCells&&!p.gridLimitNote?'最多可答'+p.sourceGridCells+'字':p.kind==='short'?'寫下簡短答案':'先寫你的理解，並用原文支持。')+'">'+E(d.answers[p.key]||'')+'</textarea><p class="field-note"><span id="answer-count-'+p.key+'" data-count="'+p.key+'" class="'+(over?'is-over-limit':'')+'">'+E(C.answerCount(p,d.answers[p.key]||''))+'</span></p>')+'</fieldset>';}
function answerFields(q,d){
 const tables=q.tables||(q.table?[q.table]:[]),mapped=q.tableAnswerCells||{};
 return (q.tableAnswerCells?tables.map((t,i)=>questionTable(t,q,d,i)).join(''):'')+q.answerParts.filter(p=>!mapped[p.key]).map(p=>answerField(p,d)).join('');
}
function answerStage(q,d){const choice=q.answerParts.every(p=>p.kind==='choice'),referenceOnly=q.answerParts.every(p=>p.referenceOnly);return '<section class="learning-stage"><p class="stage-label">STEP 02 · 由文本出發</p><h2>找到線索，再寫答案</h2>'+methodDetails(q.lesson.type)+hints(q)+'<div class="answer-heading"><h3>你的答案</h3><span class="save-status" id="save-status" role="status">'+(storageFailed?'暫未儲存':'自動儲存')+'</span></div>'+(q.tableAnswerCells?'<p class="table-answer-help muted small">直接在表格內作答；表格可左右滑動。</p>':'')+answerFields(q,d)+'<div class="stage-actions"><button class="button primary" type="button" data-action="step" data-step="2">'+(choice?'核對答案與選項':referenceOnly?'儲存答案，核對分段':'儲存答案，進入評分')+' <span aria-hidden="true">→</span></button>'+(!choice?'<button class="button text" type="button" data-action="step" data-step="2">'+(referenceOnly?'先不作答，直接核對':'先不作答，直接評分')+'</button>':'')+'</div><p class="muted small">'+(choice?'每個選項的理由會在核對後顯示。':referenceOnly?'可接受的分段及特殊給分規則會在核對後顯示。':'先評示例；你的答案會在公佈分數後自評，已知相同的短答則自動評分。')+'</p></section>';}
function gradeSelect(s,d,i){return '<label class="grade-label" for="grade-'+i+'">你給幾分？ <select id="grade-'+i+'" data-grade="'+s.id+'"><option value="">選擇分數</option>'+Array.from({length:s.outOf+1},(_,n)=>'<option value="'+n+'" '+(d.grades[s.id]===n?'selected':'')+'>'+n+'分</option>').join('')+'</select></label>';}
function sampleLabel(q,key){const p=q.answerParts.find(p=>p.key===key);const labels={'dse2024-q11':{i:'(i) 感受',ii:'(ii) 用意'},'dse2024-q13':{i:'(i) 手法',ii:'(ii) 效果'},'dse2024-q16':{i:'(i) 事物',ii:'(ii) 寓意'},'dse2025-q20':{i:'(i) 節奏',ii:'(ii) 領悟',iii:'(iii) 引文分析'}};return q.answerParts.length===1?'':labels[q.id]?.[key]||p.label;}
function sampleAnalysis(s){return s.analysis.split(/[−-]/).filter(t=>t.trim()).map(t=>E(t.trim())).join('；').replace(/；；/g,'；');}
function sampleContext(s){return s.prerequisiteText&&!s.own?'<p class="small muted sample-context">前一分題的答案：<strong>'+E(s.prerequisiteText)+'</strong></p>':'';}
function teacherMode(){return window.ReadingCoachYearAccess?.isTeacher?.()===true;}
function canRevealGrades(items,d){return teacherMode()||C.gradingReady(items,d);}
function gradingStage(q,d){const choice=q.answerParts.every(p=>p.kind==='choice');if(choice){const provisional=q.answerParts.some(p=>p.answerVerified===false);return '<section class="learning-stage"><p class="stage-label">STEP 03 · 核對選項</p><h2>準備看各項的理由</h2><p>'+(provisional?'以下提供原文的參考判讀；客觀答案待官方核對，暫不評分。':'選擇題直接核對答案，每個選項都會解釋。')+'</p>'+q.answerParts.map(p=>'<p class="choice-summary"><strong>'+E(p.label)+'</strong><span>你的選擇：'+(d.answers[p.key]?E(d.answers[p.key]):'尚未選擇')+'</span></p>').join('')+'<button class="button primary" type="button" data-action="reveal">'+(provisional?'查看參考判讀與解析':'公佈答案，閱讀解析')+' <span aria-hidden="true">→</span></button><button class="button text" type="button" data-action="step" data-step="1">回去選答案</button></section>';}
 if(q.answerParts.every(p=>p.referenceOnly))return '<section class="learning-stage"><p class="stage-label">STEP 03 · 核對分段</p><h2>準備看標準答案</h2><p class="muted">分段題直接按可接受的範圍核對，再看各部分的內容及界線。</p>'+q.answerParts.map(p=>'<p class="choice-summary"><strong>'+E(p.label)+'</strong><span>你的答案：'+(d.answers[p.key]?E(d.answers[p.key]):'尚未作答')+'</span></p>').join('')+'<button class="button primary" type="button" data-action="reveal">公佈標準答案與解析 <span aria-hidden="true">→</span></button><button class="button text" type="button" data-action="step" data-step="1">回去修改答案</button></section>';
 const items=gradingItems(q,d),examples=items.filter(s=>!s.own),ready=canRevealGrades(items,d);
 const groups=q.answerParts.filter(p=>p.kind!=='choice'&&(!p.referenceOnly||items.some(s=>s.key===p.key))).map(p=>sampleGroup(q,p,items.filter(s=>s.key===p.key).map((s,i)=>'<article class="grading-card '+(s.own?'own-preview':'')+'"><div class="sample-heading"><h3>'+(s.own?'你的答案':'示例 '+String(items.filter(x=>x.key===p.key&&!x.own).findIndex(x=>x.id===s.id)+1).padStart(2,'0'))+'</h3>'+(s.own?'<b class="own-label">你的答案'+(s.merged?' · 已合併':'')+'</b>':'')+'</div>'+sampleContext(s)+'<blockquote>'+E(s.text)+'</blockquote>'+(s.own?'<p class="own-deferred">公佈示例分數後，再回看自己的答案。</p>':gradeSelect(s,d,p.key+'-'+i))+'</article>').join(''))).join('');
 return '<section class="learning-stage"><p class="stage-label">STEP 03 · 換個角度看答案</p><h2>你來當評分員</h2><p class="muted">'+(teacherMode()?'教師模式：可直接公佈分數與解析，亦可先替部分示例評分。':'先替示例評分。你的答案毋須在這一步評分；公佈示例分數後，再對照準則自評。')+'</p>'+(q.id==='dse2025-q20'?'<p class="context-note">(iii) 示例有分析引文，按4分準則評閱。若只重複領悟，還要看(ii)是否已得分。</p>':'')+(q.distinctAnswerGroups?'<p class="context-note">'+E(q.distinctAnswerGroups.note||'兩項品格須不同；同類答案只計較高分的一項。公布示例後，亦須比較自己兩欄的意思。')+'</p>':'')+groups+'<p class="small muted" id="grading-progress">已評 '+examples.filter(s=>C.validScore(d.grades[s.id],s.outOf)).length+' / '+examples.length+'份示例</p><button class="button primary" id="reveal-button" type="button" data-action="reveal" '+(!ready?'disabled':'')+'>公佈分數與解析 <span aria-hidden="true">→</span></button><button class="button text" type="button" data-action="step" data-step="1">回去修改答案</button></section>';}
function sampleGroup(q,p,content){return '<section class="sample-group" data-sample-part="'+p.key+'" aria-label="'+E(p.label)+'"><div class="sample-group-title"><h3>'+E(p.label)+'</h3><span>'+p.marks+'分</span></div>'+content+'</section>';}
function ownReview(q,p,s,d){
 const auto=!s.notAssessed&&(p.kind==='short'||s.dependencyChecked)&&s.score!==null,self=d.selfGrades?.[p.key],chars=C.answerCharacters(s.text),limited=p.assessFirstChars&&chars.length>p.assessFirstChars;
 const answer=limited?'<blockquote><span class="assessed-answer">'+E(chars.slice(0,p.assessFirstChars).join(''))+'</span><span class="ignored-answer">'+E(chars.slice(p.assessFirstChars).join(''))+'</span></blockquote><p class="assessment-limit">只評首'+p.assessFirstChars+'字（包括標點）；淡色部分超出字數，不評閱。</p>':'<blockquote>'+E(s.text)+'</blockquote>';
 return '<article class="review-card own-review" data-own-part="'+p.key+'"><div class="sample-heading"><h3>'+E(p.label)+'</h3><b class="own-label">你的答案'+(s.merged?' · 已合併':'')+'</b></div>'+answer+(s.scoreCap!==undefined?'<p class="assessment-limit">答案超過'+p.maxChars+'字，本題最高'+s.scoreCap+'分；仍須按內容核對。</p>':'')+(s.notAssessed?'<p class="own-not-assessed">不予評閱（IR）</p>':auto?'<p class="own-auto-score">自動評分：<strong>'+s.score+'分</strong></p><p class="small muted">'+(s.lengthCapChecked?'已按內容核對，並套用原題的超字分數上限。':s.dependencyChecked?'已按原題的前置答案及給分條件核對。':s.distinctChecked?'與另一欄同類，只計較高分的一項。':s.pairedChecked?'兩欄在同一層面形成準確對比，已計配對的加分。':s.segmentChecked?'已按原題可接受的段落範圍核對。':s.merged?(limited?'首'+p.assessFirstChars+'字與已知短答相同，按相應得分評定。':'與已知短答相同，已按相應得分評定。'):'字數不符合原題要求，按格式規則評定。')+'</p>':'<label class="grade-label" for="self-grade-'+p.key+'">對照示例與準則，你給自己的答案幾分？ <select id="self-grade-'+p.key+'" data-self-grade="'+p.key+'"><option value="">選擇分數</option>'+Array.from({length:Math.min(p.marks,s.scoreCap??p.marks)+1},(_,n)=>'<option value="'+n+'" '+(self===n?'selected':'')+'>'+n+'分</option>').join('')+'</select></label><p class="small muted">留作自評：分數由你判斷，會自動儲存。</p>')+'<div class="analysis"><h4>'+(auto?'得分原因':'怎樣檢查自己的答案')+'</h4><p>'+(auto||s.notAssessed||s.dependencyPending?sampleAnalysis(s):'對照同分段示例及下方準則，檢查你是否回應所有要求，並有準確的文本依據及推論。')+'</p></div></article>';
}

function rubric(q,p){const o=q.official.find(x=>x.key===p.key);return '<details class="rubric-details"><summary>查看'+E(p.label)+'的評分準則</summary>'+(o.bands?.length?'<ul class="bands">'+o.bands.map(b=>'<li><strong>'+b.score+'分</strong><span>'+E(b.text)+'</span></li>').join('')+'</ul>':'')+'<ul>'+(o.criteria||[]).map(t=>'<li>'+E(t)+'</li>').join('')+'</ul></details>';}
function reviewStage(q,d){const items=gradingItems(q,d),result=C.gradingResult(items.filter(s=>C.validScore(d.grades[s.id],s.outOf)),d),choices=C.choiceResult(q,d),l=q.lesson;const choiceOnly=q.answerParts.every(p=>p.kind==='choice'),referenceOnly=q.answerParts.every(p=>p.referenceOnly);const reviewCards=q.answerParts.filter(p=>p.kind!=='choice').map(p=>{
 const examples=items.filter(s=>s.key===p.key&&!s.own);if(!examples.length)return '';
 return sampleGroup(q,p,examples.map((s,i)=>{const graded=C.validScore(d.grades[s.id],s.outOf),full=s.outOf>0&&C.validScore(s.score,s.outOf)&&s.score===s.outOf;return '<article class="review-card'+(full?' full-score':'')+'" id="review-'+s.id+'"><div class="sample-heading"><h3>示例 '+String(i+1).padStart(2,'0')+'</h3>'+(full?'<strong class="full-score-label">滿分答案</strong>':'')+'</div><div class="score-row"><span>'+(graded?'你評：<b>'+d.grades[s.id]+'分</b>':'未評分')+'</span><span class="score-badge '+(s.score===s.outOf?'full':'')+'">得分 '+s.score+'分</span></div>'+sampleContext(s)+'<blockquote>'+E(s.text)+'</blockquote><div class="analysis"><h4>為什麼是'+s.score+'分？</h4><p>'+sampleAnalysis(s)+'</p>'+(graded?'<p class="comparison-note">'+(s.score===d.grades[s.id]?'你這次評分準確。':'你'+(d.grades[s.id]>s.score?'高估':'低估')+'了'+Math.abs(d.grades[s.id]-s.score)+'分；再對照以上評閱重點。')+'</p>':'')+'</div></article>';}).join(''));
 }).join('');
 const ownCards=items.filter(s=>s.own).map(s=>ownReview(q,q.answerParts.find(p=>p.key===s.key),s,d)).join('');
 const ownSection=ownCards?'<section class="own-assessment"><h3>公布分數後，回看自己的答案</h3><p class="muted small">'+(referenceOnly?'逐欄對照可接受的分段；特殊分法須連看兩欄的給分規則。':'比較上方示例，再逐分題自評。相同的短答已自動評分。')+'</p>'+ownCards+'</section>':'';
 const referenceCards=q.answerParts.filter(p=>p.referenceOnly).map(p=>'<section class="reference-answer" data-reference-part="'+p.key+'"><h3>'+E(p.label)+'</h3><p>標準答案：<strong>'+E(q.official.find(o=>o.key===p.key).answers.join('或'))+'</strong></p></section>').join('');
 const choiceCards=q.answerParts.filter(p=>p.kind==='choice').map(p=>{const r=choices.find(x=>x.key===p.key),options=(q.optionAnalysis||window.COACH_EXAM_COACHING.lessons[q.id]?.options||[]).filter(o=>o.part===p.key);return '<section class="choice-review"><h3>'+E(p.label)+'</h3><p class="choice-result">你的選擇：'+(r.chosen?E(r.chosen):'未作答')+' <span>'+(p.answerVerified===false?'參考判讀：'+E(r.correct)+' · 暫不評分':'正確答案：'+E(r.correct)+' · '+r.score+' / '+r.outOf+'分')+'</span></p>'+(p.answerVerified===false?'<p class="context-note">以下依原文分析；尚未取得官方客觀題答案核對，暫不給確認分數。</p>':'')+p.choices.map(o=>{const detail=options.find(x=>x.value===o.value);return '<article class="option-analysis '+(C.choiceStatus(p,o.value)!=='excluded'?'correct':'')+'"><div>'+(o.value===o.text?'':'<b>'+E(o.value)+'</b>')+'<h4>'+E(o.text)+'</h4><span>'+(p.answerVerified===false?(C.choiceStatus(p,o.value)!=='excluded'?'參考答案':'其他選項'):(C.choiceStatus(p,o.value)==='optional'?'可選亦可不選':C.choiceStatus(p,o.value)==='required'?'正確':'錯誤'))+'</span></div><p>'+E(C.cleanAnalysis(detail?.reason||''))+'</p></article>';}).join('')+'</section>';}).join('');
 return '<section class="learning-stage"><p class="stage-label">STEP 04 · 看懂得分差異</p><h2>'+(choiceOnly?'每個選項，逐一核對':referenceOnly?'按內容核對分段':'答案不是越長越高分')+'</h2>'+(!choiceOnly&&result.total?'<div class="result-banner"><strong>'+result.correct+' / '+result.total+'</strong><span>示例評分判斷準確<br><small>你的自由答案另作準則自評</small></span></div>':'')+(q._wholeReview===false?'<p class="context-note">先看本組示例及準則；全題的解題關鍵會在各組公佈後顯示。</p>':'<section class="explanation-overview"><h3>這題的解題關鍵</h3><ol>'+l.review.map(t=>'<li>'+E(t)+'</li>').join('')+'</ol></section>')+referenceCards+choiceCards+reviewCards+ownSection+q.answerParts.filter(p=>p.kind!=='choice').map(p=>rubric(q,p)).join('')+(!choiceOnly&&q._wholeReview!==false?'<section class="self-check"><h3>用準則回看你的答案</h3>'+q.rubric.map((r,i)=>'<label><input type="checkbox" data-self-check="'+i+'" '+(d.selfChecks.includes(i)?'checked':'')+'><span><strong>'+E(r.label)+'</strong>'+E(r.detail.replace(/來源/g,'').replace(/文件/g,''))+'</span></label>').join('')+'</section>':'')+(q._wholeReview===false?'':'<section class="transfer-note"><p class="eyebrow">帶到其他文章</p><h3>記住方法，再換一個情境</h3><ol>'+l.transfer.map(t=>'<li>'+E(t)+'</li>').join('')+'</ol><label for="learning-note">用一句話記下下次會怎樣做 <span>選填</span></label><textarea id="learning-note" data-note rows="2" placeholder="例如：先拆出引文的每個關鍵元素，再逐一找文本支持。">'+E(d.note)+'</textarea></section>')+'<div class="stage-actions"><button class="button primary" type="button" data-action="complete">'+(q._group?(d.completed?'此組已完成 ✓':q._lastIncomplete?'完成本題':'完成此組，繼續下一組'):(d.completed?'已完成本題 ✓':'完成本題'))+'</button><button class="button secondary" type="button" data-action="step" data-step="1">回去重寫答案</button></div><p class="completion-message" id="completion-message" role="status">'+((q._questionCompleted??d.completed)?'已記下你的進度，可以繼續同一篇的下一題。':'')+'</p>'+nextAction(q._original||q,{completed:q._questionCompleted??d.completed})+'</section>';}
function nextAction(q,d){const next=C.nextQuestion(D,q);return '<div class="next-question" id="next-question" '+(!d.completed?'hidden':'')+'>'+(next?'<a class="button primary" href="#lesson/'+next.id+'">同篇下一題：第'+next.number+'題 <span aria-hidden="true">→</span></a>':'<a class="button primary" href="#article/'+q.exerciseId+'/questions">回到本篇，查看學習進度 <span aria-hidden="true">→</span></a>')+'<a class="button secondary" href="#export/article/'+q.exerciseId+'">導出本篇試卷</a></div>';}
function lessonPage(q){
 const p=D.articles.find(p=>p.id===q.exerciseId),rp=readingArticle(q),d=draft(q),qs=articleQuestions(p);
 if(!q.lesson.choices.includes(d.type))d.type='';if(d.type!==q.lesson.type)d.step=0;if(d.step===3&&!C.learningDraft(q,d).revealed)d.step=2;d.lastSeen=new Date().toISOString();persist();
 const stages=[classification,answerStage,gradingStage,reviewStage];
 return '<div class="lesson-page">'+crumb([{href:'#year/'+p.year,text:p.year+'年'},{href:'#article/'+p.id,text:p.title},{text:'第'+q.number+'題'}])+'<div class="lesson-heading"><a class="back-link" href="#article/'+p.id+'/questions">← 本篇題目</a><nav class="question-rail" aria-label="同篇題目">'+qs.map(x=>'<a href="#lesson/'+x.id+'" '+(x.id===q.id?'aria-current="page"':'')+' class="'+(state.questions[x.id]?.completed?'done':'')+'" aria-label="第'+x.number+'題'+(state.questions[x.id]?.completed?'，已完成':'')+'">'+x.number+(state.questions[x.id]?.completed?'<span aria-hidden="true">·</span>':'')+'</a>').join('')+'</nav><span class="lesson-count">'+(qs.findIndex(x=>x.id===q.id)+1)+' / '+qs.length+'題</span></div><div class="lesson-tabs" role="tablist" aria-label="切換原文與教學"><button type="button" id="tab-text" role="tab" aria-controls="lesson-text" data-action="pane" data-pane="text">原文 <span>'+unitCount(rp)+'</span></button><button type="button" id="tab-coach" role="tab" aria-controls="lesson-coach" data-action="pane" data-pane="coach">題目與教學 <span>第'+q.number+'題</span></button></div><div class="lesson-layout"><aside class="reader-panel" id="lesson-text">'+readerPanel(q,rp)+'</aside><div class="coach-panel" id="lesson-coach">'+stepper(stageQuestion(q,d,2),C.learningDraft(q,d))+questionText(q,d)+questionReference(q)+learningGroups(q,d)+stages[d.step](stageQuestion(q,d,d.step),C.learningDraft(q,d))+'</div></div></div>';
}
function captureReader(){
 const content=main.querySelector('.reader-content');if(!content||main.querySelector('#lesson-text')?.hidden)return;
 readerScroll=content.scrollTop;const top=content.getBoundingClientRect().top;
 const paragraph=[...content.querySelectorAll('.paragraph')].find(p=>p.getBoundingClientRect().bottom>top+15);
 if(paragraph)readerAnchor={number:Number(paragraph.dataset.paragraph),offset:paragraph.getBoundingClientRect().top-top};
}
function scrollReaderTo(number,offset=12){
 const content=main.querySelector('.reader-content'),paragraph=content?.querySelector('[data-paragraph="'+number+'"]');
 if(!content||!paragraph||main.querySelector('#lesson-text').hidden)return;
 const top=content.scrollTop+paragraph.getBoundingClientRect().top-content.getBoundingClientRect().top-offset;
 content.scrollTo({top:Math.max(0,top),behavior:'instant'});captureReader();
}
function restoreReaderPosition(){
 const content=main.querySelector('.reader-content');if(!content||main.querySelector('#lesson-text')?.hidden)return;
 if(readerAnchor)scrollReaderTo(readerAnchor.number,readerAnchor.offset);else if(readerScroll===null)scrollReaderTo(locateTarget);else content.scrollTop=readerScroll;
}
// Measure visible navigation so the question never overlaps the header or tabs.
let stickyFrame=0;
const stickyMeasurements=new WeakMap();
function updateStickyQuestion(){
 stickyFrame=0;if(current?.view!=='lesson')return;
 const question=main.querySelector('.question-text'),anchor=main.querySelector('.question-sticky-anchor');if(!question||!anchor)return;
 const tabs=main.querySelector('.lesson-tabs'),top=document.querySelector('.site-header').getBoundingClientRect().height+(tabs&&!tabs.hidden?tabs.getBoundingClientRect().height:0)+8;
 question.style.setProperty('--question-sticky-top',top+'px');
 const stuck=!main.querySelector('#lesson-coach').hidden&&anchor.getBoundingClientRect().top<top;
 const width=question.getBoundingClientRect().width;let measurement=stickyMeasurements.get(question);
 if(!measurement||measurement.width!==width||!stuck){question.classList.remove('is-stuck');measurement={width,height:question.getBoundingClientRect().height};stickyMeasurements.set(question,measurement);}
 // Reserve space before measuring the compact box: a forced layout must not clamp scrollY.
 if(stuck)question.style.marginBottom=measurement.height+'px';
 question.classList.toggle('is-stuck',stuck);
 // Reserve the original height so compacting cannot shift answers or oscillate at the page end.
 const body=question.querySelector('.question-body'),overflow=stuck&&body.scrollHeight>body.clientHeight+1;
 question.classList.toggle('has-overflow',overflow);body.tabIndex=overflow?0:-1;
 question.style.marginBottom=stuck?Math.max(0,measurement.height-question.getBoundingClientRect().height)+'px':'';
 if(!stuck&&body.scrollTop)body.scrollTop=0;
}
function scheduleStickyQuestion(){if(!stickyFrame)stickyFrame=requestAnimationFrame(updateStickyQuestion);}
function applyLessonLayout(){
 if(current?.view!=='lesson'||!current.q)return;
 const layout=main.querySelector('.lesson-layout'),tabs=main.querySelector('.lesson-tabs'),text=main.querySelector('#lesson-text'),coach=main.querySelector('#lesson-coach');if(!layout)return;
 const split=splitScreen.matches;layout.classList.toggle('is-split',split);layout.classList.toggle('is-tabs',!split);tabs.hidden=split;
 for(const [name,panel] of [['text',text],['coach',coach]]){panel.hidden=!split&&activePane!==name;if(split){panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');}else{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+name);}const tab=document.getElementById('tab-'+name);tab.setAttribute('aria-selected',String(activePane===name));tab.tabIndex=activePane===name?0:-1;}
 main.querySelectorAll('.reader .paragraph').forEach(p=>p.classList.toggle('located',locatedParagraphs.includes(Number(p.dataset.paragraph))));
 const label=main.querySelector('[data-reader-location]');label.textContent=locatedParagraphs.length?'相關：'+locatedParagraphs.map(n=>paragraphName(readingArticle(current.q),n)).join('、'):'';
 scheduleStickyQuestion();
 const content=main.querySelector('.reader-content');if(observedReader!==content){readerObserver?.disconnect();observedReader=content;readerObserver=new ResizeObserver(()=>{if(content===main.querySelector('.reader-content'))restoreReaderPosition();});readerObserver.observe(content);}
 requestAnimationFrame(()=>{if(current?.view==='lesson'&&text===document.getElementById('lesson-text'))restoreReaderPosition();});
}
function switchPane(name,focus=false){
 if(!['text','coach'].includes(name))return;readingSupport.close();captureReader();paneScroll[activePane]=window.scrollY;activePane=name;applyLessonLayout();
 if(!splitScreen.matches){const heading=main.querySelector('.lesson-heading'),naturalTop=heading.getBoundingClientRect().bottom+window.scrollY+parseFloat(getComputedStyle(heading).marginBottom);const top=paneScroll[name]||Math.max(0,naturalTop-document.querySelector('.site-header').offsetHeight);window.scrollTo({top,behavior:'instant'});requestAnimationFrame(()=>{if(current?.view==='lesson'&&activePane===name&&!splitScreen.matches)window.scrollTo({top,behavior:'instant'});});}
 if(focus)document.getElementById('tab-'+name)?.focus({preventScroll:true});
}
function locateParagraph(number){
 if(!splitScreen.matches)switchPane('text',true);locateTarget=number;locatedParagraphs=[number];readerScroll=null;readerAnchor={number,offset:12};applyLessonLayout();
 requestAnimationFrame(()=>scrollReaderTo(number));announce('已定位原文'+paragraphName(readingArticle(current.q),number)+'。');
}
let exportMeta={name:'',className:'',number:'',includePassages:false};
const exportModel=()=>window.ReadingCoachExamExport.build(D,current.scope,state.questions,S);
function exportDate(){return new Intl.DateTimeFormat('zh-HK',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function exportPage(){
 const m=exportModel(),back=current.p?'#article/'+current.p.id+'/questions':'#year/'+current.year;
 const settings='<div class="export-fields">'+[['name','姓名',40],['className','班別',20],['number','學號',12]].map(([key,label,max])=>'<label>'+label+'<input type="text" data-export-meta="'+key+'" maxlength="'+max+'" value="'+E(exportMeta[key])+'" autocomplete="off"></label>').join('')+'</div><label class="export-options"><input type="checkbox" data-export-passages '+(exportMeta.includePassages?'checked':'')+'>附上閱讀原文及原卷註釋</label>';
 return '<div class="exam-export-page"><div class="export-no-print">'+crumb([{href:'#year/'+current.year,text:current.year+'年'},{text:'導出試卷'}])+'<section class="export-toolbar"><h1>導出'+(current.p?'本篇':'本年份')+'試卷</h1><p>共'+m.questions.length+'題、'+m.total+'分。逐個分題檢查是否已作答，毋須完成示例評分練習。</p>'+(m.ready?settings+'<p>按下按鈕後，在列印視窗選擇「另存為 PDF」或印表機。版面已設為 A4 直向；建議關閉瀏覽器的頁首及頁尾。</p><button class="button primary" type="button" data-export-print>列印／儲存 PDF</button>':'<p>尚有'+new Set(m.missing.map(r=>r.qid)).size+'題、'+m.missing.length+'個分題未作答，完成後即可導出。</p>')+' <a class="button secondary" href="'+back+'">返回'+(current.p?'本篇題目':'年份目錄')+'</a><p id="export-status" role="status"></p></section></div>'+(m.ready?'<div class="exam-preview" aria-label="試卷預覽">'+window.ReadingCoachExamExport.paperHTML(m,{...exportMeta,date:exportDate()},R.sourceHTML)+'</div>':'<section class="export-missing" aria-labelledby="export-missing-title"><h2 id="export-missing-title">未作答的分題</h2><ul>'+m.missing.map(r=>'<li><a href="#lesson/'+r.qid+'" data-export-missing="'+E(r.key)+'">第'+r.number+'題：'+E(r.label)+'</a></li>').join('')+'</ul></section>')+'</div>';
}
main.addEventListener('click',async event=>{
 const missing=event.target.closest('[data-export-missing]');
 if(missing&&current.view==='export'){
  const id=missing.getAttribute('href').split('/')[1],q=D.questions.find(q=>q.id===id),d=draft(q),g=q.learningGroups?.find(g=>g.answerKeys.includes(missing.dataset.exportMissing));
  if(g)C.selectLearningGroup(q,d,g.id);if(d.type===q.lesson.type)d.step=1;persist();return;
 }
 const button=event.target.closest('[data-export-print]');if(!button||current.view!=='export'||button.disabled)return;
 if(!exportModel().ready){render();return;}
 clearTimeout(persistTimer);persist();button.disabled=true;
 try{if(document.fonts?.ready)await document.fonts.ready;if(current.view==='export'&&exportModel().ready)window.print();}
 catch{const status=main.querySelector('#export-status');if(status)status.textContent='無法開啟列印視窗。請使用瀏覽器的「列印」功能，或在支援列印的瀏覽器開啟本頁。';}
 finally{button.disabled=false;}
});
main.addEventListener('input',event=>{
 const key=event.target.dataset.exportMeta;if(current.view!=='export'||!['name','className','number'].includes(key))return;
 exportMeta[key]=event.target.value;const label=main.querySelector('[data-exam-meta="'+key+'"]');if(label)label.textContent=exportMeta[key]||'＿＿＿＿';
});
main.addEventListener('change',event=>{
 if(current.view!=='export'||!event.target.hasAttribute('data-export-passages'))return;
 exportMeta.includePassages=event.target.checked;main.querySelector('.exam-preview').innerHTML=window.ReadingCoachExamExport.paperHTML(exportModel(),{...exportMeta,date:exportDate()},R.sourceHTML);
});
function render(){
 readingSupport.close();captureReader();clearTimeout(persistTimer);current=route();const targetYear=['year','export'].includes(current.view)?current.year:current.p?.year||current.q?.year;if(targetYear&&D.articles.some(p=>p.year===targetYear)&&!window.ReadingCoachYearAccess.isUnlocked(targetYear))current={view:'gate',year:targetYear};updateShell();document.body.classList.toggle('studying',current.view==='lesson');
 if(current.view==='lesson'&&!current.q||current.view==='article'&&!current.p||current.view==='year'&&!D.articles.some(p=>p.year===current.year)||current.view==='export'&&!window.ReadingCoachExamExport.questionsFor(D,current.scope).length){main.innerHTML='<div class="empty-page"><h1>找不到這道題目</h1><a class="button primary" href="#home">回到年份目錄</a></div>';return;}
 if(current.view==='lesson'&&shownLesson!==current.q.id){shownLesson=current.q.id;activePane='coach';readerScroll=null;readerAnchor=null;paneScroll={text:0,coach:0};activeReadingId=current.q.readingArticleId||current.q.exerciseId;const p=readingArticle(current.q);locatedParagraphs=C.questionParagraphs(current.q,p);locateTarget=locatedParagraphs[0]||p.paragraphs[0].number;}
 if(current.view!=='lesson'){shownLesson='';activeReadingId='';readerObserver?.disconnect();observedReader=null;}
 document.title=(current.view==='export'?current.year+'年試卷作答紀錄 · ':current.view==='gate'?current.year+' 年解鎖 · ':current.q?'第'+current.q.number+'題 · ':current.p?current.p.title+' · ':'')+'閱讀教練';main.innerHTML=current.view==='export'?exportPage():current.view==='gate'?yearGate(current.year):current.view==='lesson'?lessonPage(current.q):current.view==='article'?articlePage(current.p):home(current.year);styleNativeActions();applyLessonLayout();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});if(current.view!=='export')animateContent(main.querySelector('.learning-stage')||main);
}
function styleNativeActions(){main.querySelectorAll('.button').forEach(el=>el.classList.add('ui-button',el.classList.contains('primary')?'ui-button--default':el.classList.contains('text')?'ui-button--ghost':'ui-button--outline'));}
document.addEventListener('click',e=>{
 const control=e.target.closest('[data-ui-action]');if(!control)return;
 if(control.dataset.uiAction==='paragraph'){e.preventDefault();const target=main.querySelector('#para-'+Number(control.dataset.paragraph));if(target){target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});main.querySelectorAll('.article-outline a').forEach(a=>a.toggleAttribute('aria-current',a===control));}return;}
 if(!['font-smaller','font-larger'].includes(control.dataset.uiAction))return;
 readingFont=Math.max(14,Math.min(26,readingFont+(control.dataset.uiAction==='font-larger'?1:-1)));document.documentElement.style.setProperty('--reading-size',readingFont+'px');try{localStorage.setItem('readingcoach-font-size',String(readingFont));}catch{}announce('原文字體已調整至 '+readingFont+' 像素。');
});
main.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||button.disabled||current.view!=='lesson')return;const q=current.q,d=draft(q),action=button.dataset.action;
 if(action==='type'){d.type=button.dataset.type;if(!q.learningGroups)d.completed=false;persist();const y=window.scrollY;main.querySelector('.learning-stage').outerHTML=classification(q,d);main.querySelector('.stepper').outerHTML=stepper(stageQuestion(q,d,2),C.learningDraft(q,d));styleNativeActions();main.querySelector('[data-type="'+d.type+'"]')?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'});scheduleStickyQuestion();return;}
 if(action==='step'){const n=Number(button.dataset.step);if(n>0&&d.type!==q.lesson.type||n===3&&!C.learningDraft(q,d).revealed)return;d.step=n;persist();render();return;}
 if(action==='group'){if(d.type!==q.lesson.type)return;if(C.selectLearningGroup(q,d,button.dataset.group)){persist();render();announce('已切換練習分組。');}return;}
 if(action==='pane'){switchPane(button.dataset.pane);return;}
 if(action==='reading'){switchReading(button.dataset.article);return;}
 if(action==='locate'){if(button.dataset.article)switchReading(button.dataset.article);locateParagraph(Number(button.dataset.paragraph));return;}
 if(action==='reveal'){const items=gradingItems(stageQuestion(q,d,2),d);if(items.some(s=>!s.own)&&!canRevealGrades(items,d))return;C.revealLearningGroup(q,d);persist();render();announce('分數及每份答案的解析已公佈。');return;}
 if(action==='complete'){
  if(!C.completeLearningGroup(q,d))return;
  const next=q.learningGroups?.find(g=>!d.groupProgress[g.id].completed);
  if(next)C.selectLearningGroup(q,d,next.id);
  persist();render();announce(next?'此組已完成，繼續下一組。':'本題已完成。');
 }
});
main.addEventListener('input',e=>{if(current.view!=='lesson')return;const t=e.target,d=draft(current.q);if(t.dataset.answer!==undefined&&t.tagName==='TEXTAREA'){C.updateQuestionAnswer(state,current.q,t.dataset.answer,t.value,D.questions);const count=main.querySelector('[data-count="'+t.dataset.answer+'"]');if(count){const p=current.q.answerParts.find(p=>p.key===t.dataset.answer),limit=C.answerLimit(p)?.max;count.textContent=C.answerCount(p,t.value);count.classList.toggle('is-over-limit',!!limit&&C.answerCharacters(t.value).length>limit);}document.getElementById('save-status').textContent='儲存中…';clearTimeout(persistTimer);persistTimer=setTimeout(()=>{persist();const s=document.getElementById('save-status');if(s)s.textContent=storageFailed?'暫未儲存':'已儲存';},250);}if(t.hasAttribute('data-note')){d.note=t.value;clearTimeout(persistTimer);persistTimer=setTimeout(persist,250);}});
main.addEventListener('change',e=>{if(current.view==='article'&&e.target.id==='analysis-toggle'||current.view==='lesson'&&e.target.id==='reader-analysis-toggle'){setReadingAnalysis(current.view==='article'?current.p:readingArticle(current.q),e.target.checked);return;}if(current.view!=='lesson')return;const t=e.target,q=current.q,d=draft(q);if(t.dataset.answer!==undefined){const p=q.answerParts.find(p=>p.key===t.dataset.answer),value=p?.multiple?p.choices.filter(c=>main.querySelector('[data-answer="'+p.key+'"][value="'+c.value+'"]')?.checked).map(c=>c.value).join('、'):t.value;C.updateQuestionAnswer(state,q,t.dataset.answer,value,D.questions);persist();}if(t.dataset.selfGrade!==undefined&&C.learningDraft(q,d).revealed){const p=q.answerParts.find(p=>p.key===t.dataset.selfGrade);if(p){d.selfGrades||={};const v=t.value===''?null:Number(t.value);const own=C.samples(q,p,d,S,state.questions).find(s=>s.own),cap=Math.min(p.marks,own?.scoreCap??p.marks);if(C.validScore(v,cap))d.selfGrades[p.key]=v;else delete d.selfGrades[p.key];persist();}}if(t.dataset.grade){const v=t.value===''?null:Number(t.value),items=gradingItems(stageQuestion(q,d,2),d),s=items.find(x=>x.id===t.dataset.grade);if(s&&C.validScore(v,s.outOf))d.grades[s.id]=v;else delete d.grades[t.dataset.grade];persist();const ready=canRevealGrades(items,d);document.getElementById('reveal-button').disabled=!ready;document.getElementById('grading-progress').textContent='已評 '+items.filter(s=>!s.own&&C.validScore(d.grades[s.id],s.outOf)).length+' / '+items.filter(s=>!s.own).length+'份示例';}if(t.dataset.selfCheck!==undefined){const n=Number(t.dataset.selfCheck);d.selfChecks=d.selfChecks.filter(x=>x!==n);if(t.checked)d.selfChecks.push(n);persist();}});
main.addEventListener('toggle',e=>{const t=e.target;if(t.classList?.contains('help-details')){const label=t.querySelector(':scope > summary > span');if(label)label.textContent=t.open?'點擊收起':'點擊展開';}if(current.view==='lesson'&&t.dataset.help&&t.open){const d=draft(current.q);if(!d.opened.includes(t.dataset.help)){d.opened.push(t.dataset.help);persist();}}},true);
main.addEventListener('keydown',e=>{const tab=e.target.closest('[data-action="pane"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();switchPane(e.key==='Home'?'text':e.key==='End'?'coach':activePane==='text'?'coach':'text',true);});
main.addEventListener('scroll',e=>{if(e.target===main.querySelector('.reader-content'))captureReader();},true);
window.addEventListener('scroll',scheduleStickyQuestion,{passive:true});window.addEventListener('resize',scheduleStickyQuestion,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleStickyQuestion,{passive:true});
splitScreen.addEventListener('change',applyLessonLayout);
main.addEventListener('submit',async event=>{
 const form=event.target?.closest('#year-access-form');if(!form)return;event.preventDefault();
 const input=form.querySelector('[name="password"]'),button=form.querySelector('button[type="submit"]'),error=main.querySelector('#year-access-error'),year=Number(form.dataset.year),password=input.value;
 if(!password){error.textContent='請先輸入密碼。';error.hidden=false;input.focus();return;}
 button.disabled=true;button.textContent='正在核對…';error.hidden=true;
 try{
  const result=await window.ReadingCoachYearAccess.unlock(year,password);
  if(!result.ok){error.textContent='密碼不正確，請再試一次。';error.hidden=false;input.focus();button.disabled=false;button.innerHTML='解鎖年份 <span aria-hidden="true">→</span>';return;}
  announce(result.teacher?'教師通行碼已解鎖所有年份。'+(result.remembered?'此瀏覽器已記住解鎖狀態。':'瀏覽器無法記住狀態，重新載入後需再次輸入。'):'已解鎖'+year+'年。'+(result.remembered?'此瀏覽器已記住解鎖狀態。':'瀏覽器無法記住狀態，重新載入後需再次輸入。'));
  render();
 }catch{error.textContent='目前無法核對密碼，請重新載入頁面再試。';error.hidden=false;button.disabled=false;button.innerHTML='解鎖年份 <span aria-hidden="true">→</span>';}
});
window.addEventListener('hashchange',()=>{persist();render();});window.addEventListener('pagehide',persist);window.addEventListener('storage',e=>{if(e.key!==C.KEY)return;try{const next=JSON.parse(e.newValue);if(next?.version!==1)return;const id=current.q?.id;for(const [k,v]of Object.entries(next.questions||{}))if(k!==id)state.questions[k]=v;if(id)announce('另一個分頁的進度已更新；這題保留目前分頁的答案。');else render();}catch{}});
render();
})();
