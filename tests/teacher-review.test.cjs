const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const C=require('../dist/core.js'),E=require('../dist/exam.js');
const source={window:{}};
for(const file of ['dse2024-data.js','dse2024-coaching.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),source);
const bank=C.compile(JSON.parse(JSON.stringify(source.window.COACH_EXAM_DATA))),coaching=JSON.parse(JSON.stringify(source.window.COACH_EXAM_COACHING));
const question=n=>bank.questions.find(q=>q.number===n);
function reviewedDraft(n=20){const q=question(n),d=C.newDraft(q);for(const p of q.answerParts)d.fields[p.key]='自己的答案。';d.examReviewed=true;return {q,d};}

test('teacher feedback requires every result and a useful comment for gaps, without inventing marks',()=>{
  const {q,d}=reviewedDraft();
  assert.match(C.teacherReviewError(q,d,q.answerParts),/每項/);
  const review=C.prepareTeacherReview(q,d,q.answerParts);
  review.items.forEach(item=>item.status='confirmed');review.items[2].status='revise';
  assert.match(C.teacherReviewError(q,d,q.answerParts),/具体|具體/);
  review.items[2].note='請把共同經歷連到作者當下的情感需要。';
  assert.equal(C.teacherReviewError(q,d,q.answerParts),'');
  assert.equal(C.teacherReviewStats(q,d,q.answerParts).status,'in-progress');
  review.at='2026-10-10T14:00:00Z';
  assert.equal(C.teacherReviewStats(q,d,q.answerParts).status,'reviewed');
  assert.match(E.teacherReviewLabel(q,d),/需補充1項/);
  assert.equal(E.objectiveResult(q,d),null);assert.match(E.scoreText(q,d),/未記錄正式分數/);
});

test('teacher review binds to the answer version and retains prior review when editing or re-reviewing',()=>{
  const {q,d}=reviewedDraft();const review=C.prepareTeacherReview(q,d,q.answerParts);
  review.items.forEach(item=>{item.status='confirmed';item.note='已指出相關內容。';});review.at='2026-10-10T14:00:00Z';
  C.changeAnswer(d,'answer','修訂後的答案。');
  assert.equal(C.teacherReviewStats(q,d,q.answerParts).status,'stale');
  const next=C.prepareTeacherReview(q,d,q.answerParts);
  assert.equal(next.at,undefined);assert.ok(next.items.every(item=>!item.status));
  assert.equal(d.teacherReviewHistory.length,1);assert.equal(d.teacherReviewHistory[0].answer,'第20題：自己的答案。');
  next.items.forEach(item=>item.status='confirmed');next.at='2026-10-10T14:01:00Z';
  C.prepareTeacherReview(q,d,q.answerParts).items[0].note='再補充意見';
  assert.equal(d.teacherReviewHistory.length,2);assert.equal(d.teacherReview.at,undefined);
  const restored=C.sanitizeDraft(JSON.parse(JSON.stringify(d)),q,q.answerParts,bank.sentences);
  assert.deepEqual(restored.teacherReview,d.teacherReview);assert.deepEqual(restored.teacherReviewHistory,d.teacherReviewHistory);
  assert.equal(C.teacherReviewStats(q,restored,q.answerParts).status,'in-progress');
});

test('restoration rejects unknown teacher results and unconfirmed gaps; old self-checks are not teacher reviews',()=>{
  const {q,d}=reviewedDraft();d.checks=['yes','yes','yes'];
  d.teacherReview={answer:C.assembleAnswer(d,q.answerParts),items:[{status:'full-marks',note:''},{status:'revise',note:''},{status:'confirmed',note:''}],at:'2026-10-10T14:00:00Z'};
  const restored=C.sanitizeDraft(d,q,q.answerParts,bank.sentences);
  assert.equal(restored.teacherReview.items[0].status,'');assert.equal(restored.teacherReview.at,undefined);
  const legacy=C.sanitizeDraft({fields:d.fields,checks:d.checks,examReviewed:true,teacherNote:'同學表示看得懂。'},q,q.answerParts,bank.sentences);
  assert.equal(legacy.teacherReview,undefined);assert.equal(C.teacherReviewStats(q,legacy,q.answerParts).status,'pending');
});

test('completion overview counts only checked objective marks and separates written self-check from teacher review',()=>{
  const drafts={};for(const n of [9,10]){const q=question(n),d=C.newDraft(q);q.answerParts.forEach(p=>d.fields[p.key]=p.answer);drafts[q.id]=d;}
  drafts['dse2024-q9'].examReviewed=true;
  const {q,d}=reviewedDraft();d.checks=['yes','yes','yes'];d.completedAt='2026-10-10T14:00:00Z';drafts[q.id]=d;
  const before=E.progressSummary(bank.questions,drafts);
  assert.equal(before.total,12);assert.deepEqual(before.objective,{checked:1,total:6,earned:2,checkedMarks:2,totalMarks:12});
  assert.deepEqual(before.written,{total:6,completed:1,reviewed:0,pending:1,needsRevision:0});
  assert.match(before.rows.find(row=>row.q.number===20).feedback,/待教師覆核/);assert.equal(before.rows.find(row=>row.q.number===11).feedback,'尚未作答');
  const partial=C.newDraft(question(13));partial.fields.i='對比';const withPartial=E.progressSummary(bank.questions,{...drafts,'dse2024-q13':partial});assert.equal(withPartial.written.pending,1);assert.equal(withPartial.rows.find(row=>row.q.number===13).feedback,'分題尚未填妥');
  const review=C.prepareTeacherReview(q,d,q.answerParts);review.items.forEach(item=>item.status='confirmed');review.at='2026-10-10T14:01:00Z';
  const after=E.progressSummary(bank.questions,drafts);assert.equal(after.written.reviewed,1);assert.equal(after.written.pending,0);assert.deepEqual(after.objective,before.objective);
  C.changeAnswer(d,'answer','另一個版本。');assert.equal(E.progressSummary(bank.questions,drafts).written.reviewed,0);
});

test('Q13 distinguishes the referent, imagery and theme without narrowing the source accepted techniques',()=>{
  const html=E.conceptHTML(question(13));
  for(const text of ['句中指涉','指魚兒','意象含意','效果與主旨','人類過度取用資源','比喻／明喻、對比、襯托／反襯','(ii)仍按效果說明獨立評閱'])assert.ok(html.includes(text),text);
  assert.equal(E.conceptHTML(question(20)),'');
  assert.deepEqual(question(13).official[0].answers,['比喻／明喻','對比','襯托／反襯']);
});

test('lessons start with three essential steps and closed detail groups while retaining every worked step',()=>{
  const q=question(20),lesson=coaching.lessons[q.id],html=E.lessonHTML(q,lesson,{standalone:true});
  const essentials=html.match(/<section class="lesson-essentials"[^>]*>([\s\S]*?)<\/section>/)[1];
  assert.equal((essentials.match(/<li>/g)||[]).length,3);
  assert.doesNotMatch(html,/<details class="(?:lesson-track|coaching-section)"[^>]*\bopen/);
  for(const step of lesson.steps)assert.ok(html.includes(C.escapeHTML(step.infer)));
  assert.match(html,/必讀/);assert.match(html,/延伸/);
  const {d}=reviewedDraft();assert.equal(E.reviewFeedbackHTML(q,{...d,examReviewed:false}),'');
  d.checks=['yes','unsure','no'];const feedback=E.reviewFeedbackHTML(q,d);
  assert.match(feedback,/依你剛才的自檢/);assert.match(feedback,/不驗證意思/);assert.doesNotMatch(feedback,/得分|已確認正確/);
});
