const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../dist/core.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),context);
const base=JSON.parse(JSON.stringify(context.window.COACH_DATA));
const compiled=C.compile(base);
const emptyBank=()=>({schemaVersion:1,passages:[],questions:[]});
function customBank(){
  const passage=structuredClone(base.passages[0]);passage.id='custom-p-one';
  const question=structuredClone(base.questions[0]);question.id='custom-q-one';question.passages=[passage.id];
  return {schemaVersion:1,passages:[passage],questions:[question]};
}
test('nine lessons have valid evidence ranges and examples bounded by their rubric',()=>{
  assert.equal(base.questions.length,9);
  assert.equal(base.passages.length,4);
  assert.deepEqual(new Set(base.questions.map(q=>q.type)),new Set(['purpose','inference','comparison']));
  for(const q of compiled.questions){
    assert.equal(q.hints.length,3,q.id);
    assert.ok(q.examples.length>=3,q.id);
    for(const ex of q.examples)assert.ok(ex.score>=0&&ex.score<=q.marks,q.id);
    for(const g of q.evidenceGroups)assert.ok(g.ids.length>0,q.id+': '+g.label);
    for(const group of q.evidenceGroups)assert.ok(group.ids.every(id=>q.passages.includes(compiled.sentences[id].passage)),q.id);
  }
});
test('sentence selection preserves every character of the original passages',()=>{
  for(const p of compiled.passages)for(let i=0;i<p.paragraphs.length;i++)assert.equal(p.paragraphs[i].sentences.map(s=>s.text).join(''),base.passages.find(x=>x.id===p.id).paragraphs[i]);
});
test('a complete self-review may honestly include no or unsure; empty answers cannot finish',()=>{
  const q=compiled.questions[0],fields=base.fields[q.type],d=C.newDraft();
  d.checks=q.rubric.map(()=> 'no');
  assert.match(C.completionError(q,d,fields),/先寫/);
  d.fields.point='舊物承載了無法替代的回憶。';
  d.checks=q.rubric.map((_,i)=>i===0?'yes':'unsure');
  assert.equal(C.completionError(q,d,fields),'');
  assert.equal(C.selfScore(q,d),1);
  d.checks[1]=null;
  assert.match(C.completionError(q,d,fields),/每項/);
});
test('editing an answer invalidates its old completion and self-score',()=>{
  const q=compiled.questions[0],d=C.newDraft();
  d.fields.point='原答案';d.completedAt=new Date().toISOString();d.checks=q.rubric.map(()=> 'yes');
  C.changeAnswer(d,'point','修訂答案');
  assert.equal(d.fields.point,'修訂答案');
  assert.equal(d.completedAt,undefined);
  assert.equal(C.selfScore(q,d),0);
  d.mode='free';d.free='原自由答案';d.checks=['yes'];C.changeAnswer(d,'free','新的自由答案');
  assert.equal(d.free,'新的自由答案');assert.equal(C.selfScore(q,d),0);
});
test('restored drafts ignore invalid scoring values, stale evidence, and foreign passage IDs',()=>{
  const q=compiled.questions[0],fields=base.fields[q.type];
  const valid=q.evidenceGroups[0].ids[0],foreign=Object.values(compiled.sentences).find(s=>!q.passages.includes(s.passage)).id;
  const restored=C.sanitizeDraft({mode:'free',free:'我的答案',checks:['yes',9,'confirmed'],evidence:[valid,valid,foreign,'missing'],hintCount:99,step:88,completedAt:'2026-10-09T15:00:00Z'},q,fields,compiled.sentences);
  assert.deepEqual(restored.evidence,[valid]);
  assert.equal(restored.hintCount,3);assert.equal(restored.step,3);
  assert.equal(C.selfScore(q,restored),1);assert.equal(restored.completedAt,undefined);
});
test('invalid teacher banks fail with messages rather than throwing or entering the app',()=>{
  for(const value of [null,{},[],{schemaVersion:1,passages:[null],questions:[null]}, {schemaVersion:1,passages:[],questions:[false]}]){
    assert.ok(C.validateBank(value).length>0);
  }
  assert.deepEqual(C.validateBank(emptyBank()),[]);
  const bank=customBank();assert.deepEqual(C.validateBank(bank),[]);
  bank.questions[0].type='toString';assert.ok(C.validateBank(bank).length);
  bank.questions[0].type='purpose';bank.questions[0].passages=['missing'];assert.ok(C.validateBank(bank).length);
  bank.questions[0].passages=['custom-p-one'];bank.questions[0].rubric=[null];assert.ok(C.validateBank(bank).length);
  const malformed=customBank();malformed.questions[0].requirements=[{text:7,correct:true}];assert.ok(C.validateBank(malformed).length);
});
test('bank merge retains unrelated lessons and replaces a known identifier once',()=>{
  const first=customBank(),second=structuredClone(first);second.questions[0].title='修訂題目';
  const result=C.mergeBanks(first,second);
  assert.equal(result.questions.length,1);assert.equal(result.passages.length,1);
  assert.equal(result.questions[0].title,'修訂題目');assert.deepEqual(C.validateBank(result),[]);
});
test('evidence coverage does not count other sentences as proof of answer correctness',()=>{
  const q=compiled.questions[0],valid=q.evidenceGroups[0].ids[0];
  const status=C.evidenceStatus(q,[valid,valid,'missing'],compiled.sentences);
  assert.equal(status.count,1);assert.equal(status.groups[0].found,true);assert.equal(status.groups.at(-1).found,false);
});
test('character limits and HTML escaping protect imported content and answer display',()=>{
  const q={...compiled.questions[0],wordLimit:10},d=C.newDraft();d.mode='free';d.free='這個答案已經超過了十個字數限制';d.checks=q.rubric.map(()=> 'yes');
  assert.match(C.completionError(q,d,base.fields[q.type]),/超出/);
  assert.equal(C.countChars(' 字\n詞 '),2);
  assert.equal(C.escapeHTML('<img src=x onerror="bad()">'), '&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});
