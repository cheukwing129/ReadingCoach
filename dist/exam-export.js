(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./self-study-core.js'):root.SelfStudyCore);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ReadingCoachExamExport=api;
})(typeof window!=='undefined'?window:globalThis,function(C){
'use strict';
const E=C.escapeHTML;
function questionsFor(data,scope){
 return data.questions.filter(q=>scope.kind==='year'?q.year===scope.year:scope.kind==='article'&&q.exerciseId===scope.id).sort((a,b)=>a.number-b.number);
}
function answered(p,value){
 if(typeof value!=='string'||!value.trim())return false;
 if(p.kind!=='choice')return true;
 const values=C.choiceValues(p,value);
 return values.length>0&&values.every(v=>p.choices.some(c=>c.value===v));
}
function missing(questions,drafts){
 return questions.flatMap(q=>q.answerParts.filter(p=>!answered(p,drafts[q.id]?.answers?.[p.key])).map(p=>({qid:q.id,number:q.number,key:p.key,label:p.label})));
}
function assessment(q,p,d,samples,drafts){
 if(!answered(p,d.answers?.[p.key]))return{status:'missing',score:null,reason:'尚未作答'};
 if(p.kind==='choice'){
  if(p.answerVerified===false)return{status:'manual',score:null,reason:'客觀答案尚未核實，待教師批改。'};
  const r=C.choiceResult(q,d).find(r=>r.key===p.key);
  return r.score===null?{status:'manual',score:null,reason:'客觀答案尚未核實，待教師批改。'}:{status:'auto',score:r.score,reason:'正確答案：'+r.correct};
 }
 const own=C.samples(q,p,d,samples,drafts).find(s=>s.own);
 if(own?.notAssessed)return{status:'ir',score:null,reason:C.cleanAnalysis(own.analysis)};
 // Match the learning view: a familiar long response is still for teacher review.
 if(own&&!own.dependencyPending&&(p.kind==='short'||own.dependencyChecked)&&C.validScore(own.score,p.marks))return{status:'auto',score:own.score,reason:C.cleanAnalysis(own.analysis)};
 return{status:'manual',score:null,reason:own?.dependencyPending?C.cleanAnalysis(own.analysis):'待教師批改。'};
}
function build(data,scope,drafts,samples,options={}){
 const questions=questionsFor(data,scope),unanswered=missing(questions,drafts),articles=data.articles.filter(a=>questions.some(q=>q.exerciseId===a.id));
 const readingArticles=data.articles.filter(a=>questions.some(q=>q.exerciseId===a.id||q.readingReferences?.[a.id]));
 const rows=questions.map(q=>({q,parts:q.answerParts.map(p=>({p,text:drafts[q.id]?.answers?.[p.key]||'',result:assessment(q,p,drafts[q.id]||{answers:{}},samples,drafts)}))}));
 const parts=rows.flatMap(r=>r.parts),auto=parts.filter(r=>r.result.status==='auto');
 return{scope,questions,articles,readingArticles,rows,missing:unanswered,ready:questions.length>0&&(!unanswered.length||options.teacher===true),teacher:options.teacher===true,total:questions.reduce((s,q)=>s+q.marks,0),autoScore:auto.reduce((s,r)=>s+r.result.score,0),autoMax:auto.reduce((s,r)=>s+r.p.marks,0),manual:parts.filter(r=>r.result.status==='manual').length,ir:parts.filter(r=>r.result.status==='ir').length};
}
function solidBlanks(html){
 return html.split(/(<[^>]*>)/g).map((chunk,i)=>i%2?chunk:chunk.replace(/[＿_]+/g,run=>'<span class="exam-blank" style="--blank-width:'+Math.max(1.4,Math.min(9,run.length*.65))+'em" aria-label="填寫位置"></span>')).join('');
}
function rich(text,highlights,ranges,sourceHTML){return solidBlanks(sourceHTML?sourceHTML(text||'',highlights||[],[],undefined,[],ranges||[]):E(text));}
function markHTML(row,label=false){
 const {p,result:r}=row;
 return '<div class="exam-mark '+r.status+'" data-export-mark="'+E(p.key)+'">'+(label?'<b>'+solidBlanks(E(p.label))+'：</b>':'')+(r.status==='auto'?'<strong>自動批改：'+r.score+' / '+p.marks+'分</strong><span>'+E(r.reason)+'</span>':r.status==='ir'?'<strong>不予評閱（IR）</strong><span>'+E(r.reason)+'</span>':'<span>'+E(r.reason)+'</span><strong>教師評分：<span class="exam-blank" aria-label="教師填分"></span> / '+p.marks+'分</strong>')+'</div>';
}
function answerHTML(row,inTable=false,order=0){
 const {p,text,result:r}=row,limit=C.answerLimit(p);
 const chosen=p.kind==='choice'?C.choiceValues(p,text).map(v=>{const c=p.choices.find(c=>c.value===v);return c&&c.value!==c.text?v+' '+c.text:v;}).join('、'):text;
 return '<div class="exam-response" data-export-answer="'+E(p.key)+'"'+(inTable?' data-table-order="'+order+'"':'')+' data-answer-label="'+E(p.label)+'" data-answer-marks="'+p.marks+'">'+(!inTable?'<p class="exam-part-label">'+solidBlanks(E(/^第\d+題$/.test(p.label)?'學生答案':p.label))+' <span>（'+p.marks+'分）</span></p>':'')+(limit?'<p class="exam-limit">'+E(limit.text)+'</p>':'')+'<div class="exam-answer">'+E(r.status==='missing'?'（未作答）':chosen)+'</div>'+(!inTable?markHTML(row):'')+'</div>';
}
function tableHTML(t,q,parts,index){
 const widths=t.columnWidths,valid=Array.isArray(widths)&&widths.length===t.headers.length&&widths.every(n=>Number.isFinite(n)&&n>0)&&Math.abs(widths.reduce((s,n)=>s+n,0)-100)<.01;
 return '<div class="exam-table-block" data-export-table="'+q.id+'-'+index+'"><table class="exam-table">'+(valid?'<colgroup>'+widths.map(n=>'<col style="width:'+n+'%">').join('')+'</colgroup>':'')+'<thead><tr>'+t.headers.map(h=>'<th scope="col">'+solidBlanks(E(h))+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map((row,ri)=>'<tr>'+row.map((value,ci)=>{
  const cell=value&&typeof value==='object'?value:{text:value},key=Object.keys(q.tableAnswerCells||{}).find(k=>{const at=q.tableAnswerCells[k];return at[0]===index&&at[1]===ri&&at[2]===ci;}),part=parts.find(r=>r.p.key===key),tag=ci===0?'th':'td';
  return '<'+tag+(ci===0?' scope="row"':'')+(cell.colSpan>1?' colspan="'+Number(cell.colSpan)+'"':'')+'>'+(part?'<div class="exam-cell-prompt">'+solidBlanks(E(cell.text))+'（'+part.p.marks+'分）</div>'+answerHTML(part,true,parts.indexOf(part)):solidBlanks(E(cell.text)))+'</'+tag+'>';
 }).join('')+'</tr>').join('')+'</tbody></table></div>';
}
function questionHTML(row,sourceHTML){
 const {q,parts}=row,tables=q.tables||(q.table?[q.table]:[]);
 const compact=!tables.length&&[q.prompt,q.quote,...parts.flatMap(r=>[r.p.label,r.text,r.result.reason,...(r.p.choices||[]).map(c=>c.text)])].join('').length<450;
 const choices=parts.filter(r=>r.p.kind==='choice').map(r=>'<div class="exam-options">'+(parts.length>1?'<p>'+E(r.p.label)+'</p>':'')+r.p.choices.map(c=>'<p><b>'+E(c.value!==c.text?c.value+'. ':'')+'</b>'+rich(c.text,c.highlights,c.highlightRanges,sourceHTML)+'</p>').join('')+'</div>').join('');
 return '<section class="exam-question'+(compact?' exam-compact':'')+'" data-export-question="'+q.id+'"><h3>第'+q.number+'題 <span>（'+q.marks+'分）</span></h3><p class="exam-prompt">'+rich(q.prompt,q.promptHighlights,q.promptHighlightRanges,sourceHTML)+'</p>'+(q.quote?'<blockquote class="exam-quote">'+rich(q.quote,q.quoteHighlights,q.quoteHighlightRanges,sourceHTML)+'</blockquote>':'')+tables.map((t,i)=>tableHTML(t,q,parts,i)).join('')+(q.tableAnswerCells?'<div class="exam-table-marks">'+parts.filter(r=>q.tableAnswerCells[r.p.key]).map(r=>markHTML(r,true)).join('')+'</div>':'')+choices+parts.filter(r=>!q.tableAnswerCells?.[r.p.key]).map(r=>answerHTML(r)).join('')+'</section>';
}
function paperHTML(model,meta={},sourceHTML){
 if(!model.ready)return '';
 const year=model.questions[0].year,title=year+'年 DSE 中文閱讀 · 作答紀錄',name=meta.name||'',className=meta.className||'',number=meta.number||'';
 const summary='自動批改小計：'+(model.autoMax?model.autoScore+' / '+model.autoMax+'分':'暫無已判分答案')+'；待教師批改：'+model.manual+'個分題'+(model.ir?'；不予評閱：'+model.ir+'個分題':'')+(model.missing.length?'；未作答：'+model.missing.length+'個分題':'')+'。';
 const originals=meta.includePassages?'<section class="exam-originals"><h2>閱讀篇章</h2>'+model.readingArticles.map(a=>'<article class="exam-passage"><h3>'+E(a.title)+'</h3><p>'+E(a.author)+'</p>'+(a.background?'<p>'+E(a.background)+'</p>':'')+(a.numberingNote?'<p class="exam-limit">'+E(a.numberingNote)+'</p>':'')+a.paragraphs.map(p=>'<div class="exam-paragraph">'+(p.label?'<h4>'+E(p.label)+'</h4>':'<span>('+p.number+')</span>')+'<p>'+rich(p.text,p.highlights,p.highlightRanges,sourceHTML)+'</p>'+(p.sourceLabel?'<p class="exam-limit">'+E(p.sourceLabel)+'</p>':'')+'</div>').join('')+(a.notes.length?'<aside><h4>原卷註釋</h4>'+a.notes.map(n=>'<p>'+E(n)+'</p>').join('')+'</aside>':'')+'</article>').join('')+'</section>':'';
 return '<article class="exam-paper"><header class="exam-paper-header"><p>閱讀教練 ReadingCoach</p><h1>'+E(title)+'</h1><p class="exam-identification"><span>姓名：<span class="exam-meta-field exam-name" data-exam-meta="name">'+E(name)+'</span></span><span>班別：<span class="exam-meta-field exam-class" data-exam-meta="className">'+E(className)+'</span></span><span>學號：<span class="exam-meta-field exam-number" data-exam-meta="number">'+E(number)+'</span></span></p><p>題目範圍：第'+model.questions.map(q=>q.number).join('、')+'題　共'+model.total+'分</p><p>導出日期：'+E(meta.date||'')+'</p><p class="exam-limit">依已收錄原題整理的作答紀錄。完整保留學生答案；自動批改小計不代表全卷成績。</p>'+ (model.teacher&&model.missing.length?'<p class="exam-limit">教師測試導出：本份含未作答分題，未作答部分不作自動評分。</p>':'')+'</header><div class="exam-totals"><p>'+summary+'</p><p>教師批改部分：<span class="exam-blank" aria-label="教師批改小計"></span>分　　全份總分：<span class="exam-blank" aria-label="全份總分"></span> / '+model.total+'分</p></div>'+originals+'<section class="exam-answers"><h2>題目及作答</h2>'+model.articles.map(a=>'<section class="exam-article"><h2>'+E(a.title)+'</h2>'+model.rows.filter(r=>r.q.exerciseId===a.id).map(r=>questionHTML(r,sourceHTML)).join('')+'</section>').join('')+'</section></article>';
}
function prepareTables(host){
 const maxHeight=254*96/25.4,oversized=[];let moved=0;
 for(const block of host.querySelectorAll('.exam-table-block')){
  const table=block.querySelector('.exam-table');if(!table)continue;
  while(table.getBoundingClientRect().height>maxHeight){
   const responses=[...table.querySelectorAll('.exam-response')].sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height),response=responses[0];
   if(!response){oversized.push(block.dataset.exportTable);break;}
   let extra=block.nextElementSibling;
   if(!extra?.classList.contains('exam-table-overflow')){extra=document.createElement('div');extra.className='exam-table-overflow';block.after(extra);}
   const reference=document.createElement('p');reference.className='exam-answer-reference';reference.textContent='本欄完整作答見表後（'+response.dataset.exportAnswer+'）。';response.replaceWith(reference);
   const label=document.createElement('p');label.className='exam-part-label';label.innerHTML=solidBlanks(E(response.dataset.answerLabel+'（'+response.dataset.answerMarks+'分）'));response.prepend(label);extra.append(response);extra.append(...[...extra.children].sort((a,b)=>Number(a.dataset.tableOrder)-Number(b.dataset.tableOrder)));moved++;
  }
 }
 return{moved,oversized};
}
return{questionsFor,answered,missing,assessment,build,paperHTML,solidBlanks,prepareTables};
});
