(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoachCore = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TYPES = {purpose:'引文目的／效果',inference:'推論／人物',comparison:'比較／綜合'};
  const TASK_VERSION = 'principles-v1';
  // All questions share neutral methods; relevance is supplied by each task plan.
  const TASK_PRINCIPLES = Object.freeze([
    {id:'summary',text:'概括事件、內容或事物特點'},
    {id:'meaning',text:'解釋字詞、句子在語境中的意思'},
    {id:'referent',text:'辨明描寫對象、指代或對應關係'},
    {id:'cause',text:'推敲原因、結果與動機'},
    {id:'emotion',text:'理解人物或事物的感受與態度'},
    {id:'trait',text:'歸納人物的性格與形象'},
    {id:'change',text:'梳理前後變化及形成原因'},
    {id:'compare',text:'按共同角度比較異同'},
    {id:'symbolism',text:'解釋事物、意象的象徵或寓意'},
    {id:'technique',text:'辨識修辭、描寫或表達手法'},
    {id:'effect',text:'說明用詞、手法或材料安排的作用'},
    {id:'structure',text:'分析敍事次序與篇章結構'},
    {id:'theme',text:'歸納作者觀點、思想感情或主旨'},
    {id:'title',text:'分析篇名的含義、作用與寄意'},
    {id:'argument',text:'檢視論點、論據與論證關係'},
    {id:'evaluation',text:'評析觀點或行為，提出有據的看法'}
  ].map(Object.freeze));
  const TASK_CATEGORIES = Object.freeze([
    {id:'narration',label:'記敘',focus:'從事件脈絡、人物言行及前後變化入手。',principleIds:['summary','cause','change','emotion','trait','compare','symbolism','technique','effect','structure','theme','title','meaning','referent','evaluation']},
    {id:'description',label:'描寫',focus:'從人物形象、事物特點、景物與意象入手。',principleIds:['referent','trait','emotion','symbolism','technique','effect','compare','change','summary','structure','theme','title','meaning']},
    {id:'reasoning',label:'說理',focus:'從觀點、理由、論據及論證關係入手。',principleIds:['theme','argument','cause','evaluation','compare','technique','effect','structure','summary','title','meaning','referent']}
  ].map(group=>Object.freeze({...group,principleIds:Object.freeze(group.principleIds)})));
  function taskCategories(q) {
    return TASK_CATEGORIES.map(group=>({...group,requirements:group.principleIds.map(id=>q.requirements.find(r=>r.id===id)).filter(Boolean)}));
  }
  const requirementKey = (r,i) => r.id ?? i;
  function validTaskPlan(plan) {
    if(!plan||typeof plan!=='object'||Array.isArray(plan))return false;
    const validIds=ids=>Array.isArray(ids)&&ids.length<=TASK_PRINCIPLES.length&&new Set(ids).size===ids.length&&ids.every(id=>TASK_PRINCIPLES.some(p=>p.id===id));
    return validIds(plan.required)&&plan.required.length>0&&validIds(plan.support)&&!plan.support.some(id=>plan.required.includes(id))&&(plan.note===undefined||(typeof plan.note==='string'&&plan.note.length<=1000));
  }
  function taskRequirements(plan) {
    return TASK_PRINCIPLES.map(p=>({...p,correct:plan.required.includes(p.id),optional:plan.support.includes(p.id)}));
  }
  function taskFeedback(q,draft) {
    const selected=new Set(draft.requirements);
    const required=q.requirements.filter(r=>r.correct);
    const missing=q.requirements.filter((r,i)=>r.correct&&!selected.has(requirementKey(r,i)));
    const support=q.requirements.filter((r,i)=>r.optional&&selected.has(requirementKey(r,i)));
    const extra=q.requirements.filter((r,i)=>!r.correct&&!r.optional&&selected.has(requirementKey(r,i)));
    return {correct:!missing.length&&!extra.length,required,missing,support,extra};
  }
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countChars = value => Array.from(String(value || '').replace(/\s/g,'')).length;
  function parsePassage(p) {
    return {...p,paragraphs:p.paragraphs.map((text,i)=>({id:p.id+'-p'+(i+1),number:i+1,text,sentences:(text.match(/[^。！？]+[。！？]+[」』”]?|[^。！？]+$/g)||[text]).map((t,j)=>({id:p.id+'-p'+(i+1)+'-s'+(j+1),text:t,paragraph:i+1,passage:p.id}))}))};
  }
  function quoteSentenceIds(passages,passageIds,quote,number) {
    if(typeof quote!=='string'||!quote.trim())return [];
    const found=new Set();
    for(const p of passages.filter(p=>passageIds.includes(p.id)))for(const paragraph of p.paragraphs){
      if(number!==undefined&&paragraph.number!==number)continue;
      let match=paragraph.text.indexOf(quote);
      while(match>=0){
        let offset=0;
        for(const s of paragraph.sentences){const end=offset+s.text.length;if(offset<match+quote.length&&end>match)found.add(s.id);offset=end;}
        match=paragraph.text.indexOf(quote,match+1);
      }
    }
    return [...found];
  }
  function compile(data) {
    const passages=data.passages.map(parsePassage);
    const sentences=Object.fromEntries(passages.flatMap(p=>p.paragraphs.flatMap(a=>a.sentences)).map(s=>[s.id,s]));
    const questions=data.questions.map(q=>({...q,...(q.taskPlan?{requirements:taskRequirements(q.taskPlan),requirementsVersion:TASK_VERSION}:{}),marks:q.authentic?q.marks:q.rubric.length,evidenceGroups:(q.evidenceGroups||[]).map(g=>({...g,ids:g.ids||[...new Set([...(g.needles||[]).flatMap(n=>quoteSentenceIds(passages,q.passages,n)),...Object.values(sentences).filter(s=>q.passages.includes(s.passage)&&(g.paragraphs||[]).includes(s.passage+'-p'+s.paragraph)).map(s=>s.id)])]}))}));
    return {passages,questions,sentences};
  }
  function evidenceStatus(q,selected,sentences) {
    const chosen=new Set(selected.filter(id=>sentences[id]));
    return {groups:q.evidenceGroups.map(g=>({label:g.label,found:g.ids.some(id=>chosen.has(id))})),extra:Array.from(chosen).filter(id=>!q.evidenceGroups.some(g=>g.ids.includes(id))),count:chosen.size};
  }
  function assembleAnswer(draft,fields) {
    if(draft.mode==='free') return draft.free||'';
    return fields.map(f=>{
      const value=(draft.fields?.[f.key]||'').trim();
      if(!value)return '';
      if(f.kind==='choice'){const choice=f.choices.find(c=>c.value===value);return choice?f.label+'：'+value+'. '+choice.text:'';}
      return f.kind?f.label.replace(/：$/,'')+'：'+value:value;
    }).filter(Boolean).join('\n');
  }
  function selfScore(q,draft) { return q.rubric.reduce((n,_,i)=>n+(draft.checks?.[i]==='yes'?1:0),0); }
  function reviewStats(q,draft) {
    const counts={reviewed:0,yes:0,unsure:0,no:0,total:q.rubric.length};
    q.rubric.forEach((_,i)=>{const value=draft.checks?.[i];if(['yes','unsure','no'].includes(value)){counts.reviewed++;counts[value]++;}});
    return counts;
  }
  const TEACHER_RESULTS=['confirmed','revise','discuss'];
  function teacherReviewStats(q,draft,fields) {
    const review=draft.teacherReview;
    const counts={confirmed:0,revise:0,discuss:0,pending:q.rubric.length,total:q.rubric.length,status:'pending'};
    if(!review)return counts;
    q.rubric.forEach((_,i)=>{const status=review.items?.[i]?.status;if(TEACHER_RESULTS.includes(status)){counts[status]++;counts.pending--;}});
    if(review.answer!==assembleAnswer(draft,fields))counts.status='stale';
    else if(review.at&&Number.isFinite(Date.parse(review.at))&&!counts.pending)counts.status='reviewed';
    else if(counts.pending<counts.total||review.reviewer||review.items?.some(item=>item.note))counts.status='in-progress';
    return counts;
  }
  function prepareTeacherReview(q,draft,fields) {
    const answer=assembleAnswer(draft,fields),old=draft.teacherReview;
    if(old&&(old.at||old.answer!==answer)&&(old.at||old.items?.some(item=>item.status||item.note))){
      draft.teacherReviewHistory=[...(draft.teacherReviewHistory||[]),JSON.parse(JSON.stringify(old))].slice(-5);
    }
    if(!old||old.answer!==answer)draft.teacherReview={answer,reviewer:old?.reviewer||'',items:q.rubric.map(()=>({status:'',note:''}))};
    else delete old.at;
    return draft.teacherReview;
  }
  function teacherReviewError(q,draft,fields) {
    if(!answerComplete(q,draft,fields)||!draft.examReviewed)return '請先完成答案及來源核對，再記錄教師覆核。';
    const review=draft.teacherReview;
    if(!review||review.answer!==assembleAnswer(draft,fields)||q.rubric.some((_,i)=>!TEACHER_RESULTS.includes(review.items?.[i]?.status)))return '請由教師為每項選擇覆核結果。';
    if(review.items.some(item=>['revise','discuss'].includes(item.status)&&!(item.note||'').trim()))return '需要補充或待釐清的項目，請寫下具體缺口或修訂建議。';
    return '';
  }
  function answerSentences(draft,fields) {
    return [...new Set((assembleAnswer(draft,fields).match(/[^\n。！？]+[。！？]?/g)||[]).map(s=>s.trim()).filter(Boolean))];
  }
  function answerComplete(q,draft,fields) {
    return q.authentic?fields.every(f=>f.kind==='choice'?f.choices.some(c=>c.value===draft.fields?.[f.key]):!!draft.fields?.[f.key]?.trim()):!!assembleAnswer(draft,fields).trim();
  }
  function attemptSnapshot(q,draft,fields,at=new Date().toISOString()) {
    return {mode:draft.mode,free:draft.free,fields:{...draft.fields},at,complete:answerComplete(q,draft,fields),practiceMode:draft.practiceMode,supportLog:(draft.supportLog||[]).map(s=>({...s})),hintCount:draft.hintCount,reason:draft.revisionReason||''};
  }
  function captureFirstAttempt(q,draft,fields,at) {
    if(draft.firstAttempt||!assembleAnswer(draft,fields).trim())return false;
    draft.firstAttempt=attemptSnapshot(q,draft,fields,at);return true;
  }
  function recordSupport(q,draft,fields,kind,at=new Date().toISOString(),level) {
    captureFirstAttempt(q,draft,fields,at);
    draft.supportLog||=[];
    if(!draft.supportLog.some(s=>s.kind===kind&&s.level===level))draft.supportLog.push({kind,at,...(level?{level}:{})});
  }
  function saveRevision(q,draft,fields,kind,at=new Date().toISOString()) {
    captureFirstAttempt(q,draft,fields,at);
    if(!assembleAnswer(draft,fields).trim())return false;
    const revisions=draft.revisions||=[];
    const last=revisions.at(-1);
    if(last&&assembleAnswer(last,fields)===assembleAnswer(draft,fields)&&last.reason===(draft.revisionReason||''))return false;
    revisions.push({...attemptSnapshot(q,draft,fields,at),kind});draft.revisions=revisions.slice(-10);return true;
  }
  function bridgeFeedback(draft) {
    const labels={observation:'原文線索：寫出選句提供的具體內容。',inference:'推論：解釋線索怎樣支持你的理解。',answer:'回應題目：指出這個理解回答了哪一項要求。'};
    return Object.entries(labels).filter(([key])=>!draft.bridge?.[key]?.trim()).map(([,label])=>label);
  }
  function structuralFeedback(q,draft,fields) {
    const answer=assembleAnswer(draft,fields), out=[];
    if(q.authentic){
      for(const f of fields){const value=(draft.fields?.[f.key]||'').trim();
        if(!value)out.push('尚未完成：'+f.label+'。');
        else if(f.exactChars&&countChars(value)!==f.exactChars)out.push(f.label+'原題要求'+f.exactChars+'字詞，目前為'+countChars(value)+'字。請修訂格式並檢查是否準確概括性格。');
      }
      if(!out.length)out.push('已填寫所有作答欄。下一步核對來源答案及評分準則；書面題須檢查意思、證據及論述，系統未判定正確或分數。');
      return out;
    }
    if(countChars(answer)<20) out.push('答案仍很短。先直接回應題目，再補上文本依據和解釋。');
    if(draft.mode!=='free') {
      if(!(draft.fields?.point||'').trim()) out.push('尚未寫出直接回應題目的判斷或比較角度。');
      if(!(draft.fields?.explanation||'').trim()) out.push('補上「這些線索如何支持答案」的解釋。');
      if(q.type==='comparison'&&(!(draft.fields?.evidenceA||'').trim()||!(draft.fields?.evidenceB||'').trim())) out.push('比較題要用同一角度兼顧兩方；檢查甲、乙項是否都已說明。');
      else if(q.type!=='comparison'&&!(draft.fields?.evidence||'').trim()) out.push('加入最貼題的字句或情節，讓讀者看到判斷的依據。');
    }
    if(q.wordLimit&&countChars(answer)>q.wordLimit) out.push('目前超出本題'+q.wordLimit+'字限制，請保留最能回應題目的內容。');
    if(/生動形象|吸引讀者|更感人/.test(answer)&&countChars(answer)<70) out.push('「生動」「吸引讀者」仍需具體化：寫清呈現甚麼內容、造成甚麼效果。');
    if(!out.length) out.push('答案各部分已有內容。請逐項核對意思是否準確，證據和解釋能否連起來；系統未判定答案正確。');
    return out;
  }
  function validateBank(bank) {
    const errors=[];
    if(!bank||bank.schemaVersion!==1||!Array.isArray(bank.passages)||!Array.isArray(bank.questions)) return ['題庫格式不符：需要第1版題庫及文章、題目列表。'];
    if(bank.questions.length>80||bank.passages.length>100) errors.push('一次最多匯入80題及100篇文章。');
    const ids=new Set();
    const validId=id=>typeof id==='string'&&/^custom-[a-zA-Z0-9_-]+$/.test(id);
    const validText=(s,max=1000)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
    bank.passages.forEach((p,i)=>{
      if(!p||typeof p!=='object'){errors.push('文章'+(i+1)+'的資料有誤。');return;}
      if(!validId(p.id)||ids.has(p.id)) errors.push('文章'+(i+1)+'的識別碼有誤或重複。');else ids.add(p.id);
      if(!validText(p.title,160)||!Array.isArray(p.paragraphs)||!p.paragraphs.length||p.paragraphs.length>40||p.paragraphs.some(v=>!validText(v,4000))) errors.push('文章'+(i+1)+'的標題或段落有誤。');
      if(p.label!==undefined&&!validText(p.label,200)) errors.push('文章'+(i+1)+'的資料標籤有誤。');
    });
    const qids=new Set();
    bank.questions.forEach((q,i)=>{
      const n='題目'+(i+1);
      if(!q||typeof q!=='object'){errors.push(n+'的資料有誤。');return;}
      if(q.authentic||q.answerParts!==undefined)errors.push(n+'的教師題庫格式不支援內置真題專用欄位。');
      if(!validId(q.id)||qids.has(q.id)) errors.push(n+'的識別碼有誤或重複。');else qids.add(q.id);
      if(typeof q.type!=='string'||!Object.prototype.hasOwnProperty.call(TYPES,q.type)||typeof q.title!=='string'||!q.title.trim()||q.title.length>160||typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>2500) errors.push(n+'的題型、標題或題幹有誤。');
      if(!Array.isArray(q.passages)||!q.passages.length||q.passages.some(id=>!ids.has(id))) errors.push(n+'引用的文章不存在。');
      if(!Array.isArray(q.rubric)||!q.rubric.length||q.rubric.length>8||q.rubric.some(r=>!r||!validText(r.label,160)||!validText(r.detail,1000))) errors.push(n+'需要1至8個有效的評分要點。');
      if(!Array.isArray(q.examples)||!q.examples.length||q.examples.length>8||q.examples.some(e=>!e||!validText(e.text,8000)||!validText(e.label,160)||!validText(e.note,1000)||!Number.isInteger(e.score)||e.score<0||e.score>(q.rubric?.length||0))) errors.push(n+'的例答資料有誤。');
      if(!Array.isArray(q.hints)||q.hints.length>3||q.hints.some(s=>typeof s!=='string'||s.length>1200)) errors.push(n+'的提示資料有誤。');
      if(q.taskPlan!==undefined){
        if(!validTaskPlan(q.taskPlan))errors.push(n+'須選擇至少一項有效的必須處理原則；必須與輔助項目不可重複。');
        if(q.requirements!==undefined)errors.push(n+'不可同時使用通用原則與舊式拆題選項。');
      } else {
        if(!Array.isArray(q.requirements)||q.requirements.length>8||q.requirements.some(r=>!r||typeof r.text!=='string'||r.text.length>300||typeof r.correct!=='boolean')) errors.push(n+'的拆題資料有誤。');
        if(Array.isArray(q.requirements)&&(!q.requirements.some(r=>r?.correct===true)||q.requirements.some(r=>!validText(r?.text,300)))) errors.push(n+'須有最少一項有效作答要求。');
      }
      // Old banks may contain the removed directive question; it is optional metadata.
      if(q.directive!==undefined||q.options!==undefined){
        if(typeof q.directive!=='string'||!Array.isArray(q.options)||!q.options.includes(q.directive)) errors.push(n+'的舊式拆題資料有誤。');
        if(Array.isArray(q.options)&&(q.options.length<2||q.options.length>8||q.options.some(s=>!validText(s,100))||new Set(q.options).size!==q.options.length)) errors.push(n+'的舊式拆題選項有誤。');
      }
      for(const key of ['level','scope']) if(q[key]!==undefined&&!validText(q[key],200)) errors.push(n+'的難度或作答範圍有誤。');
      if(q.minutes!==undefined&&(!Number.isInteger(q.minutes)||q.minutes<1||q.minutes>90)) errors.push(n+'的建議時間有誤。');
      if(q.evidenceGroups!==undefined&&(!Array.isArray(q.evidenceGroups)||q.evidenceGroups.length>12||q.evidenceGroups.some(g=>!g||typeof g.label!=='string'||(g.needles!==undefined&&(!Array.isArray(g.needles)||g.needles.some(v=>typeof v!=='string')))||(g.paragraphs!==undefined&&(!Array.isArray(g.paragraphs)||g.paragraphs.some(v=>typeof v!=='string')))||(g.ids!==undefined&&(!Array.isArray(g.ids)||g.ids.some(v=>typeof v!=='string')))))) errors.push(n+'的證據資料有誤。');
      if(q.wordLimit!==undefined&&(!Number.isInteger(q.wordLimit)||q.wordLimit<10||q.wordLimit>2000)) errors.push(n+'的字數限制有誤。');
    });
    return errors;
  }
  function mergeBanks(oldBank,newBank) {
    const merge=(a,b)=>Array.from(new Map([...a,...b].map(x=>[x.id,x])).values());
    return {schemaVersion:1,passages:merge(oldBank.passages,newBank.passages),questions:merge(oldBank.questions,newBank.questions)};
  }
  function newDraft(q) { return {mode:'guided',practiceMode:q?.authentic?'independent':'guided',free:'',fields:{},checks:[],checkEvidence:{},reviewVersion:'answer-linked-v1',supportLog:[],revisions:[],teacherReviewHistory:[],bridge:{},readingTop:0,hintCount:0,step:q?.authentic?2:0,evidence:[],requirements:[],...(q?.requirementsVersion?{requirementsVersion:q.requirementsVersion}:{}),reflection:''}; }
  function sanitizeDraft(raw,q,fields,sentences) {
    const draft=newDraft(q);
    if(!raw||typeof raw!=='object')return draft;
    const str=s=>typeof s==='string'?s.slice(0,20000):'';
    draft.mode=!q.authentic&&raw.mode==='free'?'free':'guided';draft.free=str(raw.free);
    draft.practiceMode=raw.practiceMode==='independent'?'independent':'guided';
    const supportKinds=['legacy','revision','overview','guide','task','evidence','writing','hint','lesson','source','examples'];
    const cleanLog=log=>Array.isArray(log)?log.filter(s=>s&&supportKinds.includes(s.kind)).slice(0,20).map(s=>({kind:s.kind,at:typeof s.at==='string'?s.at.slice(0,40):'',...(s.kind==='hint'&&Number.isInteger(s.level)&&s.level>=1&&s.level<=3?{level:s.level}:{})})):[];
    draft.supportLog=cleanLog(raw.supportLog);
    if(raw.practiceMode===undefined)draft.supportLog=[{kind:'legacy',at:''}];
    for(const f of fields){const value=str(raw.fields?.[f.key]);draft.fields[f.key]=f.kind==='choice'&&!f.choices.some(c=>c.value===value)?'':value;}
    if(q.authentic)draft.examReviewed=raw.examReviewed===true&&fields.every(f=>!!draft.fields[f.key].trim());
    draft.checks=q.rubric.map((_,i)=>['yes','unsure','no'].includes(raw.checks?.[i])?raw.checks[i]:null);
    draft.evidence=Array.isArray(raw.evidence)?[...new Set(raw.evidence.filter(id=>sentences[id]&&q.passages.includes(sentences[id].passage)))]:[];
    draft.hintCount=Number.isInteger(raw.hintCount)?Math.max(0,Math.min(q.hints.length,raw.hintCount)):0;
    draft.step=Number.isInteger(raw.step)?Math.max(0,Math.min(3,raw.step)):0;
    if(q.requirementsVersion){
      // Old numeric positions refer to different text. Reset only these choices.
      draft.requirements=raw.requirementsVersion===q.requirementsVersion&&Array.isArray(raw.requirements)?[...new Set(raw.requirements.filter(id=>q.requirements.some(r=>r.id===id)))]:[];
    }else draft.requirements=Array.isArray(raw.requirements)?[...new Set(raw.requirements.filter(i=>Number.isInteger(i)&&i>=0&&i<q.requirements.length))]:[];
    draft.taskCategory=TASK_CATEGORIES.some(g=>g.id===raw.taskCategory)?raw.taskCategory:'narration';
    draft.reflection=str(raw.reflection);draft.examplesViewed=raw.examplesViewed===true;
    draft.revisionReason=str(raw.revisionReason);draft.teacherNote=str(raw.teacherNote);
    const cleanTeacherReview=review=>{
      if(!review||typeof review!=='object'||typeof review.answer!=='string')return null;
      const clean={answer:review.answer.slice(0,100000),reviewer:str(review.reviewer).slice(0,120),items:q.rubric.map((_,i)=>({status:TEACHER_RESULTS.includes(review.items?.[i]?.status)?review.items[i].status:'',note:str(review.items?.[i]?.note).slice(0,1500)}))};
      if(typeof review.at==='string'&&Number.isFinite(Date.parse(review.at))&&clean.items.every(item=>item.status&&(!['revise','discuss'].includes(item.status)||item.note.trim())))clean.at=review.at;
      return clean;
    };
    if(q.authentic&&fields.some(f=>f.kind!=='choice')){
      const review=cleanTeacherReview(raw.teacherReview);if(review)draft.teacherReview=review;
      draft.teacherReviewHistory=Array.isArray(raw.teacherReviewHistory)?raw.teacherReviewHistory.slice(-5).map(cleanTeacherReview).filter(Boolean):[];
    }
    draft.reviewVersion=raw.reviewVersion==='answer-linked-v1'?'answer-linked-v1':'legacy';
    const answer=assembleAnswer(draft,fields);
    for(let i=0;i<q.rubric.length;i++)draft.checkEvidence[i]=Array.isArray(raw.checkEvidence?.[i])?[...new Set(raw.checkEvidence[i].filter(s=>typeof s==='string'&&s.trim()&&answer.includes(s)))].slice(0,12):[];
    for(const key of ['observation','inference','answer'])draft.bridge[key]=str(raw.bridge?.[key]);
    draft.readingTop=Number.isFinite(raw.readingTop)?Math.max(0,Math.min(1e7,raw.readingTop)):0;
    const cleanSnapshot=s=>{
      if(!s||typeof s!=='object'||!Number.isFinite(Date.parse(s.at)))return null;
      const snapshot={mode:!q.authentic&&s.mode==='free'?'free':'guided',free:str(s.free),fields:{},at:s.at,practiceMode:s.practiceMode==='independent'?'independent':'guided',supportLog:cleanLog(s.supportLog),hintCount:Number.isInteger(s.hintCount)?Math.max(0,Math.min(q.hints.length,s.hintCount)):0,reason:str(s.reason)};
      for(const f of fields){const value=str(s.fields?.[f.key]);snapshot.fields[f.key]=f.kind==='choice'&&!f.choices.some(c=>c.value===value)?'':value;}
      snapshot.complete=answerComplete(q,snapshot,fields);
      return assembleAnswer(snapshot,fields).trim()?snapshot:null;
    };
    const first=cleanSnapshot(raw.firstAttempt);if(first)draft.firstAttempt=first;
    draft.revisions=Array.isArray(raw.revisions)?raw.revisions.slice(-10).map(s=>{const clean=cleanSnapshot(s);return clean?{...clean,kind:['manual','source','complete'].includes(s.kind)?s.kind:'manual'}:null;}).filter(Boolean):[];
    draft.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:'';
    const finished=typeof raw.completedAt==='string'&&Number.isFinite(Date.parse(raw.completedAt));
    if(finished&&!completionError(q,draft,fields))draft.completedAt=raw.completedAt;
    return draft;
  }
  function changeAnswer(draft,key,value) {
    const target=key==='free'?draft:draft.fields;
    if(target[key]===value)return;
    target[key]=value;draft.checks=[];draft.checkEvidence={};delete draft.completedAt;delete draft.examReviewed;
  }
  function completionError(q,draft,fields) {
    if(!assembleAnswer(draft,fields).trim())return '請先寫下自己的答案，再進行自檢。';
    if(q.authentic&&fields.some(f=>f.kind==='choice'?!f.choices.some(c=>c.value===draft.fields?.[f.key]):!(draft.fields?.[f.key]||'').trim()))return '請完成每個原題分題，再核對答案及自檢。';
    if(q.authentic&&!draft.examReviewed)return '請先核對來源答案，再完成自檢記錄。';
    if(q.wordLimit&&countChars(assembleAnswer(draft,fields))>q.wordLimit)return '答案超出本題字數限制，請先修訂。';
    if(q.rubric.some((_,i)=>!['yes','unsure','no'].includes(draft.checks[i])))return '請為每項選擇「已做到」「不確定」或「未做到」。不需要全部選「已做到」才算完成。';
    if(q.authentic&&draft.reviewVersion==='answer-linked-v1'&&q.rubric.some((_,i)=>draft.checks[i]==='yes'&&!draft.checkEvidence?.[i]?.some(s=>assembleAnswer(draft,fields).includes(s))))return '請為「已做到」項圈選答案中的支持句；若尚未說清楚，可選「不確定」或「未做到」。';
    return '';
  }
  return {TYPES,TASK_VERSION,TASK_PRINCIPLES,TASK_CATEGORIES,taskCategories,requirementKey,validTaskPlan,taskFeedback,escapeHTML,countChars,parsePassage,quoteSentenceIds,compile,evidenceStatus,assembleAnswer,selfScore,reviewStats,teacherReviewStats,prepareTeacherReview,teacherReviewError,answerSentences,answerComplete,captureFirstAttempt,recordSupport,saveRevision,bridgeFeedback,structuralFeedback,validateBank,mergeBanks,newDraft,sanitizeDraft,changeAnswer,completionError};
}));
