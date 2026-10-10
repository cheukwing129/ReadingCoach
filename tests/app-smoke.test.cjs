const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
// A lightweight DOM facade checks app rendering and event/state transitions.
// It deliberately does not claim to validate browser layout or CSS behavior.
function harness(saved=null,blocked=false){
  const nodes=new Map(),listeners={},store=new Map(saved?[['dse-reading-coach-v1',saved]]:[]);
  class Element{
    constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.dataset={};this.value='';this.hidden=false;this.classList={toggle(){},add(){},remove(){}};this.handlers={};}
    addEventListener(name,fn){this.handlers[name]=fn;}
    querySelectorAll(selector){
      if(selector==='input[name="requirement"]')return (this.controls||[]).filter(el=>el.name==='requirement');
      if(selector==='select[data-task-role]')return (this.controls||[]).filter(el=>el.dataset.taskRole);
      return [];
    }
    querySelector(selector){return node(selector);}
    setAttribute(){} removeAttribute(){} focus(){} scrollIntoView(){} append(){} remove(){} insertAdjacentHTML(_,html){this.innerHTML+=html;}
    showModal(){this.returnValue='confirm';this.handlers.close?.();}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  const location={hash:'#home'};
  const document={getElementById:node,querySelectorAll:()=>[],querySelector:node,createElement:()=>new Element('temp'),body:new Element('body')};
  class FormDataFacade {constructor(form){this.data=form.formValues||{};}get(key){return this.data[key]??node('main').controls?.find(el=>el.name===key)?.value??null;}}
  const sandbox={document,location,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(blocked)throw new Error('blocked');store.set(k,v);}},console,Intl,Date,Set,Map,URL,Blob,crypto:require('node:crypto').webcrypto,FormData:FormDataFacade,JSON,setTimeout:()=>0,clearTimeout:()=>{}};
  sandbox.window=sandbox;sandbox.addEventListener=(name,fn)=>listeners[name]=fn;sandbox.scrollTo=()=>{};
  const context=vm.createContext(sandbox);
  for(const name of ['core.js','data.js','dse2024-data.js','dse2024-coaching.js','exam.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',name),'utf8'),context,{filename:name});
  const main=node('main');
  const navigate=hash=>{location.hash=hash;listeners.hashchange();};
  const click=async dataset=>{const button={dataset,disabled:false};await main.handlers.click({target:{closest:()=>button}});};
  const input=(key,value)=>main.handlers.input({target:{dataset:{answer:key},value,hasAttribute:()=>false}});
  const change=target=>main.handlers.change({target});
  const state=()=>JSON.parse(store.get('dse-reading-coach-v1'));
  const submit=async values=>{const form=node('teacher-form');form.formValues=values;await main.handlers.submit({target:form,preventDefault(){}});};
  return {main,node,navigate,click,input,change,submit,state,listeners,store};
}
function categoryControls(h,html=h.main.innerHTML){
  const groups=[...html.matchAll(/<details class="task-category" data-task-category="([^"]+)"\s*(?:open)?>([\s\S]*?)<\/details>/g)];
  h.main.controls=groups.flatMap(g=>[
    ...[...g[2].matchAll(/<input type="checkbox" name="requirement" value="([^"]+)"([^>]*)>/g)].map(m=>({name:'requirement',value:m[1],checked:m[2].includes('checked'),dataset:{},category:g[1]})),
    ...[...g[2].matchAll(/<select name="(task-[^"]+)" data-task-role="([^"]+)">([\s\S]*?)<\/select>/g)].map(m=>({name:m[1],value:m[3].match(/value="([^"]+)" selected/)?.[1]||'none',dataset:{taskRole:m[2]},category:g[1]}))
  ]);
  return h.main.controls;
}
test('home and all four stages of all nine lessons render without dependencies',async()=>{
  const h=harness();assert.match(h.main.innerHTML,/3 組原創材料、9 道練習/);
  for(const id of ['lamp-purpose','lamp-inference','lamp-comparison','seed-purpose','seed-inference','seed-comparison','pace-purpose','pace-inference','pace-comparison']){
    h.navigate('#practice/'+id);
    for(let step=0;step<4;step++){await h.click({step:String(step)});assert.ok(h.main.innerHTML.includes('STEP 0'+(step+1)),id);}
  }
  h.navigate('#records');assert.match(h.main.innerHTML,/學習記錄|看見自己的進步/);
  h.navigate('#teacher');assert.match(h.main.innerHTML,/新增練習/);await h.click({action:'new-question'});assert.match(h.node('editor-container').innerHTML,/teacher-form/);
});
test('UI actions preserve free and guided drafts, finish honest self-review, then invalidate it on revision',async()=>{
  const h=harness();h.navigate('#practice/lamp-inference');await h.click({step:'2'});
  h.input('point','原來只求便宜與快速，後來懂得傾聽。');h.input('evidence','他後來坐下，聽陳伯把故事說完。');h.input('explanation','理解舊機連著回憶，所以願意留時間陪伴。');h.listeners.pagehide();
  await h.click({action:'mode-free'});assert.match(h.state().drafts['lamp-inference'].free,/懂得傾聽/);
  h.input('free','另外整理的一份完整自由答案');h.listeners.pagehide();await h.click({action:'mode-guided'});await h.click({action:'mode-free'});
  assert.equal(h.state().drafts['lamp-inference'].free,'另外整理的一份完整自由答案');
  await h.click({step:'3'});
  for(let i=0;i<3;i++)await h.change({dataset:{check:String(i)},value:i===0?'yes':'unsure'});
  await h.click({action:'complete'});assert.ok(h.state().drafts['lamp-inference'].completedAt);
  await h.click({step:'2'});h.input('free','修訂後的自由答案');h.listeners.pagehide();
  assert.equal(h.state().drafts['lamp-inference'].completedAt,undefined);assert.deepEqual(h.state().drafts['lamp-inference'].checks,[]);
  const restored=harness(JSON.stringify(h.state()));restored.navigate('#practice/lamp-inference');assert.match(restored.main.innerHTML,/修訂後的自由答案/);
});
test('saving failures show a visible backup instruction; unknown routes do not crash',()=>{
  const h=harness(null,true);assert.equal(h.node('storage-warning').hidden,false);assert.match(h.node('storage-warning').textContent,/匯出/);
  h.navigate('#practice/missing');assert.match(h.main.innerHTML,/把想法/);
  const corrupt=harness('{bad-json');assert.equal(corrupt.store.get('dse-reading-coach-v1'),'{bad-json');assert.equal(corrupt.node('storage-warning').hidden,false);
});
test('teacher form creates a playable lesson, rejects broken imports, and supports a second question on the same passage',async()=>{
  const h=harness();h.navigate('#teacher');await h.click({action:'new-question'});
  const values={passage:'new',articleTitle:'練習文章',articleText:'我最初只想快一點。\n\n後來我願意留下來聽他說話。',title:'人物的轉變',type:'inference',prompt:'人物的態度有甚麼轉變？試說明。',scope:'全文',requirements:'交代原來態度\n交代後來態度',rubric:'原來態度｜只顧速度\n後來態度｜願意傾聽',hint0:'兼顧前後',fullExample:'人物由只顧速度轉為願意傾聽。',fullNote:'能交代前後。'};
  await h.submit(values);const first=h.state().bank.questions[0];assert.ok(first);assert.equal(first.rubric.length,2);
  h.navigate('#practice/'+first.id);await h.click({step:'2'});assert.match(h.main.innerHTML,/人物的態度有甚麼轉變/);
  h.navigate('#teacher');await h.click({action:'new-question'});await h.submit({...values,passage:first.passages[0],title:'第二道題'});
  assert.equal(h.state().bank.passages.length,1);assert.equal(h.state().bank.questions.length,2);
  const file={size:30,text:async()=>JSON.stringify({schemaVersion:1,passages:[null],questions:[null]})};
  await h.change({id:'bank-file',files:[file],value:'selected'});assert.equal(h.state().bank.questions.length,2);assert.match(h.node('toast').textContent,/有誤/);
});
test('authentic exercise overview and all twelve questions render in all four stages',async()=>{
  const h=harness();assert.match(h.main.innerHTML,/2024 DSE/);assert.match(h.main.innerHTML,/12 題 · 35 分/);
  h.navigate('#exercise/dse2024-fansheng');assert.match(h.main.innerHTML,/第9–20題 · 35分/);assert.match(h.main.innerHTML,/下載答案與教練分析/);
  for(let number=9;number<=20;number++){
    h.navigate('#practice/dse2024-q'+number);await h.click({action:'start-guided'});
    for(let step=0;step<4;step++){await h.click({step:String(step)});assert.match(h.main.innerHTML,new RegExp('STEP 0'+(step+1)));}
    assert.match(h.main.innerHTML,/核對來源答案/);
  }
  h.navigate('#practice/dse2024-q11');assert.match(h.main.innerHTML,/exam-table/);assert.match(h.main.innerHTML,/凸顯環境改變之急速/);
});
test('objective UI checks the folder answer, restores it, and requires a fresh check after revision',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q9');await h.click({step:'2'});
  await h.change({dataset:{examAnswer:'answer'},value:'D'});await h.click({step:'3'});
  assert.doesNotMatch(h.main.innerHTML,/文件列出的正確答案/);
  await h.click({action:'review-source'});assert.match(h.main.innerHTML,/按文件答案核對：<strong>2 \/ 2 分/);
  for(let i=0;i<2;i++)await h.change({dataset:{check:String(i)},value:'unsure'});
  await h.click({action:'complete'});assert.ok(h.state().drafts['dse2024-q9'].completedAt);
  const restored=harness(JSON.stringify(h.state()));restored.navigate('#practice/dse2024-q9');assert.match(restored.main.innerHTML,/已核對來源答案/);
  await restored.click({step:'2'});await restored.change({dataset:{examAnswer:'answer'},value:'A'});
  assert.equal(restored.state().drafts['dse2024-q9'].examReviewed,undefined);assert.equal(restored.state().drafts['dse2024-q9'].completedAt,undefined);
  await restored.click({step:'3'});await restored.click({action:'review-source'});assert.match(restored.main.innerHTML,/按文件答案核對：<strong>0 \/ 2 分/);
});
test('multipart source answers remain gated until all parts are written, and analysed evidence is selectable',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q13');await h.click({step:'2'});h.input('i','對比');h.listeners.pagehide();
  await h.click({step:'3'});await h.click({action:'review-source'});assert.match(h.node('source-review-error').textContent,/每個原題分題/);
  await h.click({step:'2'});h.input('ii','乳汁代表滋養，鮮血呈現求生的痛苦，對比前後生境變化。');h.listeners.pagehide();
  await h.click({step:'3'});await h.click({action:'review-source'});assert.match(h.main.innerHTML,/第13.\(i\)題的答案錯誤，本題仍須獨立評改/);
  assert.match(h.main.innerHTML,/原題 4分/);assert.match(h.main.innerHTML,/答案如何連到文本證據/);
  await h.click({action:'add-source-evidence',index:'0'});assert.ok(h.state().drafts['dse2024-q13'].evidence.length);
  h.navigate('#records');assert.match(h.main.innerHTML,/書面題待教師評閱/);assert.doesNotMatch(h.main.innerHTML,/學生自評<\/span><strong[^>]*>0 \/ 5/);
});

test('all twelve direct coaching routes expose worked reasoning without changing review or completion status',async()=>{
  const h=harness();h.navigate('#exercise/dse2024-fansheng');
  assert.match(h.main.innerHTML,/直接閱讀逐題精講/);assert.match(h.main.innerHTML,/篇章地圖/);
  for(let n=9;n<=20;n++){
    assert.ok(h.main.innerHTML.includes('#coaching/dse2024-q'+n));
  }
  for(let n=9;n<=20;n++){
    h.navigate('#coaching/dse2024-q'+n);h.listeners.pagehide();
    assert.match(h.main.innerHTML,/從原文到答案/);assert.match(h.main.innerHTML,/下一篇可怎樣重用/);
    const d=h.state().drafts['dse2024-q'+n];
    assert.ok(!d.examReviewed&&!d.completedAt);assert.deepEqual(d.fields,{});
  }
  h.navigate('#coaching/not-found');assert.match(h.main.innerHTML,/直接閱讀逐題精講/);
});

test('coaching evidence is shared with the answer draft and font or question changes keep the coaching route',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q15');await h.click({step:'2'});h.input('answer','我自己的原有試答');h.listeners.pagehide();
  h.navigate('#coaching/dse2024-q15');await h.click({action:'add-coach-evidence',index:'0'});
  const before=h.state().drafts['dse2024-q15'];assert.ok(before.evidence.length);assert.equal(before.fields.answer,'我自己的原有試答');assert.ok(!before.examReviewed&&!before.completedAt);
  await h.click({action:'add-coach-evidence',index:'0'});assert.deepEqual(h.state().drafts['dse2024-q15'].evidence,before.evidence);
  await h.click({action:'font-more'});assert.match(h.main.innerHTML,/逐題精講與失分修訂/);assert.equal(h.state().readingSize,20);
  await h.change({id:'question-select',value:'dse2024-q16'});h.navigate('#coaching/dse2024-q16');assert.match(h.main.innerHTML,/填表先分事物與寓意/);
  h.navigate('#practice/dse2024-q15');assert.match(h.main.innerHTML,/我自己的原有試答/);assert.equal(h.state().drafts['dse2024-q15'].step,2);
});

test('worked answers and loss diagnosis stay gated during practice until a complete source check',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q11');
  assert.match(h.main.innerHTML,/題目|感受/);assert.doesNotMatch(h.main.innerHTML,/文件失分例診斷/);
  await h.click({step:'2'});h.input('i','恐懼');h.listeners.pagehide();await h.click({step:'3'});await h.click({action:'review-source'});
  assert.doesNotMatch(h.main.innerHTML,/文件失分例診斷/);
  await h.click({step:'2'});h.input('ii','魚由無憂無慮變成避險，呈現濫捕使物性改變。');h.listeners.pagehide();
  await h.click({step:'3'});await h.click({action:'review-source'});assert.match(h.main.innerHTML,/文件失分例診斷/);assert.match(h.main.innerHTML,/可能怎樣想到/);
  await h.click({action:'add-coach-evidence',index:'0'});assert.ok(h.state().drafts['dse2024-q11'].evidence.length);
});

test('all built-in task screens expose the same full set of generic processing principles',async()=>{
  const h=harness(),ids=['lamp-purpose','lamp-inference','lamp-comparison','seed-purpose','seed-inference','seed-comparison','pace-purpose','pace-inference','pace-comparison',...Array.from({length:12},(_,i)=>'dse2024-q'+(i+9))];
  let first;
  for(const id of ids){
    h.navigate('#practice/'+id);await h.click({action:'start-guided'});
    const methods=[...h.main.innerHTML.matchAll(/name="requirement" value="([^"]+)"[^>]*><span>([^<]+)<\/span>/g)].map(m=>[m[1],m[2]]);
    assert.equal(new Set(methods.map(m=>m[0])).size,16,id);if(!first)first=methods;else assert.deepEqual(methods,first,id);
    assert.equal((h.main.innerHTML.match(/data-task-category=/g)||[]).length,3,id);
    for(const label of ['記敘','描寫','說理'])assert.ok(h.main.innerHTML.includes('<summary>'+label+'</summary>'),id);
    assert.doesNotMatch(h.main.innerHTML,/name="directive"|這道題主要要求你做甚麼/);
    assert.doesNotMatch(h.main.innerHTML,/只寫與題目無關的個人意見/);
  }
});

test('task check feedback handles missing work, accepts supporting methods, and persists stable choices',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q11');await h.click({action:'start-guided'});
  const choose=(value,checked=true)=>h.change({name:'requirement',value,checked,dataset:{}});
  await choose('emotion');await h.click({action:'check-task'});
  assert.match(h.node('task-feedback').innerHTML,/材料安排的作用（尚未勾選）/);
  await choose('effect');await choose('compare');await h.click({action:'check-task'});
  assert.match(h.node('task-feedback').innerHTML,/拆題準確/);assert.match(h.node('task-feedback').innerHTML,/可輔助本題思考/);
  await choose('title');await h.click({action:'check-task'});
  assert.match(h.node('task-feedback').innerHTML,/本題沒有要求處理/);assert.match(h.node('task-feedback').innerHTML,/篇名的含義/);
  await choose('title',false);assert.equal(h.node('task-feedback').innerHTML,'');
  await choose('invalid');assert.deepEqual(h.state().drafts['dse2024-q11'].requirements,['emotion','effect','compare']);
  const restored=harness(JSON.stringify(h.state()));restored.navigate('#practice/dse2024-q11');await restored.click({step:'0'});
  for(const id of ['emotion','effect','compare'])assert.ok(restored.main.innerHTML.includes('value="'+id+'" checked'));
  await restored.click({action:'check-task'});assert.match(restored.node('task-feedback').innerHTML,/拆題準確/);
});

test('new teacher exercises configure required and supporting methods from the shared catalogue',async()=>{
  const h=harness();h.navigate('#teacher');await h.click({action:'new-question'});
  assert.match(h.node('editor-container').innerHTML,/taskPlanVersion/);assert.doesNotMatch(h.node('editor-container').innerHTML,/name="distractor"/);
  const values={passage:'new',articleTitle:'態度',articleText:'他起初不停催促。\n\n後來他耐心等候。',title:'前後態度',type:'inference',prompt:'他的態度有甚麼轉變？',scope:'全文',taskPlanVersion:'principles-v1','task-change':'required','task-emotion':'support',taskNote:'兼顧前後態度。',rubric:'原來｜催促\n後來｜耐心',fullExample:'由催促轉為耐心。',fullNote:'兼顧前後。'};
  await h.submit({...values,'task-change':'none'});assert.equal(h.state().bank.questions.length,0);assert.match(h.node('teacher-errors').textContent,/至少一項/);
  await h.submit(values);const q=h.state().bank.questions[0];assert.deepEqual(q.taskPlan,{required:['change'],support:['emotion'],note:'兼顧前後態度。'});assert.equal(q.requirements,undefined);
  h.navigate('#practice/'+q.id);assert.equal(new Set([...h.main.innerHTML.matchAll(/name="requirement" value="([^"]+)"/g)].map(m=>m[1])).size,16);
  for(const value of ['change','emotion'])await h.change({name:'requirement',value,checked:true,dataset:{}});
  await h.click({action:'check-task'});assert.match(h.node('task-feedback').innerHTML,/拆題準確/);
  h.navigate('#teacher');await h.click({action:'edit-question',id:q.id});assert.match(h.main.innerHTML,/name="task-change"[^]*?value="required" selected/);
});

test('shared checkboxes synchronise both directions, count once and restore consistently in each category',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q17');await h.click({action:'start-guided'});
  const controls=categoryControls(h),traits=controls.filter(el=>el.value==='trait');
  assert.deepEqual(traits.map(el=>el.category),['narration','description']);
  traits[0].checked=true;await h.change(traits[0]);assert.ok(traits.every(el=>el.checked));
  assert.deepEqual(h.state().drafts['dse2024-q17'].requirements,['trait']);assert.match(h.node('task-selection-count').textContent,/已選 1 項/);
  await h.change(traits[1]);assert.deepEqual(h.state().drafts['dse2024-q17'].requirements,['trait']);
  await h.click({action:'check-task'});assert.match(h.node('task-feedback').innerHTML,/拆題準確/);assert.doesNotMatch(h.node('task-feedback').innerHTML,/主要指令/);
  traits[1].checked=false;await h.change(traits[1]);assert.ok(traits.every(el=>!el.checked));
  assert.deepEqual(h.state().drafts['dse2024-q17'].requirements,[]);assert.match(h.node('task-selection-count').textContent,/已選 0 項/);
  traits[1].checked=true;await h.change(traits[1]);
  const effects=controls.filter(el=>el.value==='effect');assert.equal(effects.length,3);effects[2].checked=true;await h.change(effects[2]);assert.ok(effects.every(el=>el.checked));
  const restored=harness(JSON.stringify(h.state()));restored.navigate('#practice/dse2024-q17');
  const recovered=categoryControls(restored);assert.ok(recovered.filter(el=>['trait','effect'].includes(el.value)).every(el=>el.checked));
  assert.ok(recovered.filter(el=>!['trait','effect'].includes(el.value)).every(el=>!el.checked));
  assert.deepEqual(restored.state().drafts['dse2024-q17'].requirements,['trait','effect']);
});

test('shared teacher method settings synchronise across categories and submit one role per principle',async()=>{
  const h=harness();h.navigate('#teacher');await h.click({action:'new-question'});
  const controls=categoryControls(h,h.node('editor-container').innerHTML),changes=controls.filter(el=>el.dataset.taskRole==='change'),emotions=controls.filter(el=>el.dataset.taskRole==='emotion');
  assert.equal(changes.length,2);changes[1].value='required';await h.change(changes[1]);assert.ok(changes.every(el=>el.value==='required'));
  emotions[0].value='support';await h.change(emotions[0]);assert.ok(emotions.every(el=>el.value==='support'));
  const values={passage:'new',articleTitle:'轉變',articleText:'他原本催促，後來耐心等待。',title:'態度轉變',type:'inference',prompt:'他的態度有甚麼轉變？',taskPlanVersion:'principles-v1',rubric:'轉變｜交代前後態度',fullExample:'由催促轉為耐心。',fullNote:'兼顧前後。'};
  await h.submit(values);const q=h.state().bank.questions[0];assert.deepEqual(q.taskPlan,{required:['change'],support:['emotion'],note:''});assert.equal(q.directive,undefined);assert.equal(q.options,undefined);
  h.navigate('#teacher');await h.click({action:'edit-question',id:q.id});
  const restored=categoryControls(h);assert.ok(restored.filter(el=>el.dataset.taskRole==='change').every(el=>el.value==='required'));assert.ok(restored.filter(el=>el.dataset.taskRole==='emotion').every(el=>el.value==='support'));
  restored.find(el=>el.dataset.taskRole==='emotion').value='none';await h.change(restored.find(el=>el.dataset.taskRole==='emotion'));assert.ok(restored.filter(el=>el.dataset.taskRole==='emotion').every(el=>el.value==='none'));
});

test('autonomous practice starts at the original answer and keeps analysis and self-checks hidden',async()=>{
  const h=harness();h.navigate('#exercise/dse2024-fansheng');assert.doesNotMatch(h.main.innerHTML,/class="method-grid"/);
  h.navigate('#practice/dse2024-q16');assert.match(h.main.innerHTML,/STEP 03/);
  assert.doesNotMatch(h.main.innerHTML,/class="lesson-stage"|class="hint-box"|class="rubric-item"|name="requirement"/);
  await h.click({action:'save-first'});assert.match(h.node('first-attempt-error').textContent,/每個分題/);
  h.input('i','種子');h.input('ii','我自己的試答');await h.click({action:'save-first'});
  const first=h.state().drafts['dse2024-q16'].firstAttempt;assert.equal(first.practiceMode,'independent');assert.equal(first.supportLog.length,0);
  h.input('ii','修改過的試答');h.listeners.pagehide();assert.equal(h.state().drafts['dse2024-q16'].firstAttempt.fields.ii,'我自己的試答');
});
test('viewing overview teaching or direct lessons is recorded even with zero extra hints',async()=>{
  const h=harness();h.navigate('#exercise/dse2024-fansheng');await h.click({action:'overview-help'});
  assert.match(h.main.innerHTML,/class="method-grid"/);h.navigate('#practice/dse2024-q14');
  await h.change({dataset:{examAnswer:'answer'},value:'C'});await h.click({action:'save-first'});
  assert.ok(h.state().drafts['dse2024-q14'].firstAttempt.supportLog.some(s=>s.kind==='overview'));
  h.navigate('#coaching/dse2024-q16');h.navigate('#practice/dse2024-q16');h.input('i','種子');h.input('ii','答案');await h.click({action:'save-first'});
  const d=h.state().drafts['dse2024-q16'];assert.equal(d.hintCount,0);assert.ok(d.firstAttempt.supportLog.some(s=>s.kind==='lesson'));assert.equal(d.completedAt,undefined);
});
test('answer-linked self-review asks for missing support and preserves source-gated followups',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q20');h.input('answer','他和作者都有艱難的經歷。這使作者感同身受。');await h.click({step:'3'});
  assert.doesNotMatch(h.main.innerHTML,/作者向他哭泣，反映作者自己/);await h.click({action:'review-source'});
  assert.match(h.main.innerHTML,/作者向他哭泣，反映作者自己/);
  for(let i=0;i<3;i++)await h.change({dataset:{check:String(i)},value:i===2?'unsure':'yes'});
  await h.click({action:'complete'});assert.match(h.node('completion-error').textContent,/支持句/);
  for(let i=0;i<2;i++)await h.change({dataset:{checkEvidence:String(i),sentence:'0'},checked:true});
  await h.click({action:'complete'});assert.ok(h.state().drafts['dse2024-q20'].completedAt);
  h.navigate('#records');assert.match(h.main.innerHTML,/已檢視 3\/3 項；已做到 2；不確定 1/);assert.match(h.main.innerHTML,/作用與主旨 · 不確定/);
});
test('completed-question transfer opens another passage without hints or answer frames',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q15');await h.click({action:'start-transfer',id:'lamp-comparison'});h.navigate('#practice/lamp-comparison');
  assert.doesNotMatch(h.main.innerHTML,/class="hint-box"|data-answer="point"|完整例答/);assert.match(h.main.innerHTML,/data-answer="free"/);
  h.input('free','兩種光的亮度和照亮對象不同。');await h.click({step:'3'});assert.doesNotMatch(h.main.innerHTML,/完整例答/);
  await h.click({action:'review-original'});assert.match(h.main.innerHTML,/完整例答/);assert.equal(h.state().drafts['lamp-comparison'].firstAttempt.practiceMode,'independent');
});
test('paragraph navigation, reading location, and focused categories persist across steps',async()=>{
  const h=harness();h.navigate('#practice/dse2024-q13');await h.click({action:'start-guided'});
  assert.equal((h.main.innerHTML.match(/data-task-category="[^\"]+" open/g)||[]).length,1);
  h.node('.passage-scroll').scrollTop=650;await h.click({step:'2'});assert.equal(h.node('.passage-scroll').scrollTop,650);
  assert.match(h.main.innerHTML,/data-paragraph-target/);assert.match(h.main.innerHTML,/value="dse2024-fansheng-p6"/);
  const restored=harness(JSON.stringify(h.state()));restored.navigate('#practice/dse2024-q13');assert.equal(restored.node('.passage-scroll').scrollTop,650);
});
