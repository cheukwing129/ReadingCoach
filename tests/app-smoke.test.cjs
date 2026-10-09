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
    querySelectorAll(){return [];}
    querySelector(selector){return node(selector);}
    setAttribute(){} removeAttribute(){} focus(){} scrollIntoView(){} append(){} remove(){} insertAdjacentHTML(_,html){this.innerHTML+=html;}
    showModal(){this.returnValue='confirm';this.handlers.close?.();}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  const location={hash:'#home'};
  const document={getElementById:node,querySelectorAll:()=>[],querySelector:node,createElement:()=>new Element('temp'),body:new Element('body')};
  class FormDataFacade {constructor(form){this.data=form.formValues||{};}get(key){return this.data[key]??null;}}
  const sandbox={document,location,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(blocked)throw new Error('blocked');store.set(k,v);}},console,Intl,Date,Set,Map,URL,Blob,crypto:require('node:crypto').webcrypto,FormData:FormDataFacade,JSON,setTimeout:()=>0,clearTimeout:()=>{}};
  sandbox.window=sandbox;sandbox.addEventListener=(name,fn)=>listeners[name]=fn;sandbox.scrollTo=()=>{};
  const context=vm.createContext(sandbox);
  for(const name of ['core.js','data.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',name),'utf8'),context,{filename:name});
  const main=node('main');
  const navigate=hash=>{location.hash=hash;listeners.hashchange();};
  const click=async dataset=>{const button={dataset,disabled:false};await main.handlers.click({target:{closest:()=>button}});};
  const input=(key,value)=>main.handlers.input({target:{dataset:{answer:key},value,hasAttribute:()=>false}});
  const change=target=>main.handlers.change({target});
  const state=()=>JSON.parse(store.get('dse-reading-coach-v1'));
  const submit=async values=>{const form=node('teacher-form');form.formValues=values;await main.handlers.submit({target:form,preventDefault(){}});};
  return {main,node,navigate,click,input,change,submit,state,listeners,store};
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
