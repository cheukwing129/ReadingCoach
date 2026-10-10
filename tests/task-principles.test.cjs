const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../dist/core.js');
const context={window:{}};
for(const name of ['data.js','dse2024-data.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../dist/'+name),'utf8'),context);
const base=JSON.parse(JSON.stringify(context.window.COACH_DATA));
const exam=JSON.parse(JSON.stringify(context.window.COACH_EXAM_DATA));
const compiled=C.compile({passages:[...base.passages,...exam.passages],questions:[...base.questions,...exam.questions]});
const question=id=>compiled.questions.find(q=>q.id===id);

test('all 21 built-in questions share neutral principles, with valid question-specific task plans',()=>{
  assert.equal(C.TASK_PRINCIPLES.length,16);
  assert.equal(new Set(C.TASK_PRINCIPLES.map(p=>p.id)).size,16);
  const shared=C.TASK_PRINCIPLES.map(p=>({id:p.id,text:p.text}));
  for(const raw of [...base.questions,...exam.questions]){
    assert.ok(C.validTaskPlan(raw.taskPlan),raw.id);
    assert.equal(raw.requirements,undefined,raw.id);
    const q=question(raw.id);
    assert.deepEqual(q.requirements.map(({id,text})=>({id,text})),shared,q.id);
    assert.ok(q.requirements.some(r=>r.correct)&&q.requirements.some(r=>!r.correct&&!r.optional),q.id);
    assert.ok(q.requirements.every(r=>!(r.correct&&r.optional)),q.id);
  }
  assert.ok(C.TASK_PRINCIPLES.every(p=>!/魚兒|小店|兩張表|母親|無關|只寫|所有人/.test(p.text)));
});

test('task checks distinguish the requested work from helpful reasoning and other question types',()=>{
  const q11=question('dse2024-q11'),d=C.newDraft(q11);
  d.requirements=['emotion'];
  assert.deepEqual(C.taskFeedback(q11,d).missing.map(r=>r.id),['effect']);
  d.requirements=['emotion','effect','compare'];
  const good=C.taskFeedback(q11,d);assert.equal(good.correct,true);assert.deepEqual(good.support.map(r=>r.id),['compare']);
  d.requirements.push('title');
  const extra=C.taskFeedback(q11,d);assert.equal(extra.correct,false);assert.deepEqual(extra.extra.map(r=>r.id),['title']);
  const q12=question('dse2024-q12');
  assert.equal(C.taskFeedback(q12,{directive:q12.directive,requirements:['technique','meaning']}).correct,true);
  assert.deepEqual(C.taskFeedback(q12,{directive:q12.directive,requirements:['technique','effect']}).extra.map(r=>r.id),['effect']);
  const q16=question('dse2024-q16');
  assert.deepEqual(C.taskFeedback(q16,{directive:q16.directive,requirements:['symbolism']}).missing.map(r=>r.id),['referent']);
  const q20=question('dse2024-q20');
  assert.equal(C.taskFeedback(q20,{directive:q20.directive,requirements:['effect','compare','theme']}).correct,true);
  assert.equal(C.taskFeedback(q20,{requirements:['effect']}).correct,true);
  assert.equal(C.taskFeedback(q20,{directive:'已刪除的舊選擇',requirements:['effect']}).correct,true);
});

test('old positional task choices reset without losing an answer, evidence, source review or completion',()=>{
  const q=question('dse2024-q9'),evidence=q.evidenceGroups[0].ids[0],completedAt='2026-10-09T15:00:00Z';
  const old={fields:{answer:'D'},evidence:[evidence],checks:q.rubric.map(()=> 'yes'),examReviewed:true,completedAt,requirements:[0,1],directive:q.directive,step:3};
  const restored=C.sanitizeDraft(old,q,q.answerParts,compiled.sentences);
  assert.deepEqual(restored.requirements,[]);assert.equal(restored.requirementsVersion,C.TASK_VERSION);
  assert.equal(restored.fields.answer,'D');assert.deepEqual(restored.evidence,[evidence]);
  assert.equal(restored.examReviewed,true);assert.equal(restored.completedAt,completedAt);assert.deepEqual(restored.checks,old.checks);
  const current={...restored,requirements:['cause','emotion','cause',0,'missing']};
  const reordered={...q,requirements:[...q.requirements].reverse()};
  assert.deepEqual(C.sanitizeDraft(current,reordered,q.answerParts,compiled.sentences).requirements,['cause','emotion']);
});

test('teacher banks validate shared task plans while retaining legacy authored choices',()=>{
  const p={...base.passages[0],id:'custom-p-one'},q={...base.questions[0],id:'custom-q-one',passages:[p.id]};
  const bank={schemaVersion:1,passages:[p],questions:[q]};
  assert.deepEqual(C.validateBank(bank),[]);
  for(const plan of [null,{required:[],support:[]},{required:['missing'],support:[]},{required:['effect','effect'],support:[]},{required:['effect'],support:['effect']}]){
    assert.ok(C.validateBank({...bank,questions:[{...q,taskPlan:plan}]}).length);
  }
  const legacy={...q,requirements:[{text:'說明作用',correct:true},{text:'比較異同',correct:false}]};delete legacy.taskPlan;
  assert.deepEqual(C.validateBank({...bank,questions:[legacy]}),[]);
  const [cq]=C.compile({...bank,questions:[legacy]}).questions;
  const restored=C.sanitizeDraft({requirements:[0,1,9,0]},cq,base.fields[cq.type],compiled.sentences);
  assert.deepEqual(restored.requirements,[0,1]);
  assert.ok(C.validateBank({...bank,questions:[{...q,requirements:legacy.requirements}]}).length);
});

test('narration, description and reasoning share existing principles and cover every method',()=>{
  const q=question('dse2024-q17'),groups=C.taskCategories(q);
  assert.deepEqual(groups.map(g=>g.label),['記敘','描寫','說理']);
  assert.deepEqual(new Set(groups.flatMap(g=>g.requirements.map(r=>r.id))),new Set(C.TASK_PRINCIPLES.map(r=>r.id)));
  for(const group of groups)assert.equal(new Set(group.requirements.map(r=>r.id)).size,group.requirements.length);
  const traits=groups.filter(g=>g.requirements.some(r=>r.id==='trait'));
  assert.deepEqual(traits.map(g=>g.id),['narration','description']);
  assert.equal(traits[0].requirements.find(r=>r.id==='trait'),traits[1].requirements.find(r=>r.id==='trait'));
  assert.ok(groups.find(g=>g.id==='reasoning').requirements.some(r=>r.id==='argument'));
  assert.equal(C.taskFeedback(q,{requirements:['trait','trait']}).required.length,1);
});

test('grouped principle choices restore intact while retired directive selections are ignored',()=>{
  const q=question('lamp-inference'),fields=base.fields[q.type],old=C.newDraft(q);
  old.requirements=['change','emotion'];old.directive='已刪除的選擇';old.fields.point='由急躁轉為耐心。';old.evidence=[q.evidenceGroups[0].ids[0]];
  const restored=C.sanitizeDraft(old,q,fields,compiled.sentences);
  assert.deepEqual(restored.requirements,['change','emotion']);assert.equal(restored.directive,undefined);
  assert.equal(restored.fields.point,old.fields.point);assert.deepEqual(restored.evidence,old.evidence);
  assert.equal(C.taskFeedback(q,restored).correct,true);
  const p={...base.passages[0],id:'custom-p-new'},custom={...base.questions[0],id:'custom-q-new',passages:[p.id]};
  delete custom.directive;delete custom.options;
  assert.deepEqual(C.validateBank({schemaVersion:1,passages:[p],questions:[custom]}),[]);
});
