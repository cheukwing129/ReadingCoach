const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../dist/core.js'),E=require('../dist/exam.js');
const source={};source.window=source;
for(const file of ['data.js','dse2024-data.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),source);
const bank=C.compile({passages:[...source.COACH_DATA.passages,...source.COACH_EXAM_DATA.passages],questions:[...source.COACH_DATA.questions,...source.COACH_EXAM_DATA.questions]});
const question=n=>bank.questions.find(q=>q.id==='dse2024-q'+n);

test('first attempt preserves the answer before help, including a partial multipart attempt',()=>{
  const q=question(13),d=C.newDraft(q);assert.equal(d.practiceMode,'independent');assert.equal(d.step,2);
  d.fields.i='對比';C.recordSupport(q,d,q.answerParts,'guide','2026-10-10T09:00:00Z');
  assert.equal(d.firstAttempt.complete,false);assert.equal(d.firstAttempt.supportLog.length,0);
  d.fields.i='另一手法';d.fields.ii='修訂後的解釋';d.supportLog[0].kind='task';
  assert.equal(d.firstAttempt.fields.i,'對比');assert.equal(d.firstAttempt.fields.ii,undefined);
  C.captureFirstAttempt(q,d,q.answerParts);assert.equal(d.firstAttempt.fields.i,'對比');
});
test('hint levels have separate timestamps and never become an independent first attempt',()=>{
  const q=question(15),d=C.newDraft(q);d.practiceMode='guided';
  C.recordSupport(q,d,q.answerParts,'hint','2026-10-10T09:01:00Z',1);
  d.fields.answer='光芒象徵希望';C.recordSupport(q,d,q.answerParts,'hint','2026-10-10T09:02:00Z',2);
  assert.equal(d.supportLog.length,2);assert.equal(d.firstAttempt.supportLog[0].level,1);
  const restored=C.sanitizeDraft(d,q,q.answerParts,bank.sentences);
  assert.deepEqual(restored.supportLog.map(s=>s.level),[1,2]);assert.equal(restored.firstAttempt.practiceMode,'guided');
});
test('self-review distinguishes inspected items from yes counts and requires actual answer quotes',()=>{
  const q=question(20),d=C.newDraft(q);d.fields.answer='那個人和作者有共同的經歷。';d.examReviewed=true;d.checks=['yes','yes','unsure'];
  assert.deepEqual(C.reviewStats(q,d),{reviewed:3,yes:2,unsure:1,no:0,total:3});
  assert.match(C.completionError(q,d,q.answerParts),/支持句/);
  d.checkEvidence={0:C.answerSentences(d,q.answerParts),1:['答案沒有寫出的話']};
  assert.match(C.completionError(q,d,q.answerParts),/支持句/);
  d.checkEvidence[1]=C.answerSentences(d,q.answerParts);assert.equal(C.completionError(q,d,q.answerParts),'');
  // Valid anchors are learning evidence, not a semantic grade.
  assert.equal(E.objectiveResult(q,d),null);
  C.changeAnswer(d,'answer','另一個答案');assert.deepEqual(d.checkEvidence,{});assert.equal(d.examReviewed,undefined);
});
test('new snapshots, reasons, anchors and reading position survive backups; old completed records survive migration',()=>{
  const q=question(20),d=C.newDraft(q);d.fields.answer='先交代人物。再解釋作用。';C.captureFirstAttempt(q,d,q.answerParts);
  d.revisionReason='補上作用';d.bridge={observation:'言行',inference:'共同處境',answer:'感情作用'};d.readingTop=1234;
  d.examReviewed=true;d.checks=['yes','unsure','no'];d.checkEvidence={0:['再解釋作用。']};d.teacherNote='解釋要更具體';
  C.saveRevision(q,d,q.answerParts,'manual');d.completedAt='2026-10-10T09:05:00Z';
  const clean=C.sanitizeDraft(JSON.parse(JSON.stringify(d)),q,q.answerParts,bank.sentences);
  assert.equal(clean.completedAt,d.completedAt);assert.deepEqual(clean.firstAttempt.fields,d.firstAttempt.fields);
  assert.equal(clean.revisions[0].reason,'補上作用');assert.equal(clean.readingTop,1234);assert.equal(clean.teacherNote,d.teacherNote);
  const old=C.sanitizeDraft({fields:d.fields,checks:['yes','yes','unsure'],examReviewed:true,completedAt:d.completedAt,hintCount:0},q,q.answerParts,bank.sentences);
  assert.equal(old.completedAt,d.completedAt);assert.equal(old.supportLog[0].kind,'legacy');assert.equal(old.practiceMode,'guided');assert.equal(old.firstAttempt,undefined);
});
test('Q9 recognises background evidence and asks for the trigger; bridge feedback identifies missing steps only',()=>{
  const q=question(9),d=C.newDraft(q);d.evidence=['dse2024-fansheng-p1-s1'];
  const html=E.evidenceFeedbackHTML(q,d,bank);assert.match(html,/已選到 · 困境背景/);assert.match(html,/單靠這句仍未說明為何此刻痛哭/);assert.match(html,/直接觸發與感情結果/);
  d.bridge={observation:'原文寫無路可走',answer:'解釋痛哭'};assert.equal(C.bridgeFeedback(d).length,1);assert.match(C.bridgeFeedback(d)[0],/^推論/);
  d.bridge.inference='我需要把看到河谷與感情釋放連起來';assert.deepEqual(C.bridgeFeedback(d),[]);
});
test('revision history is bounded and transfer recommendations use another passage',()=>{
  const q=question(15),d=C.newDraft(q);for(let i=0;i<15;i++){d.fields.answer='版本'+i;C.saveRevision(q,d,q.answerParts,'manual');}
  assert.equal(d.revisions.length,10);assert.equal(d.firstAttempt.fields.answer,'版本0');
  for(const id of E.transferCandidates(q)){const next=bank.questions.find(q=>q.id===id);assert.ok(next);assert.ok(next.passages.every(id=>!q.passages.includes(id)));}
});
