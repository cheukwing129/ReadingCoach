const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const C=require('../dist/core.js');
const E=require('../dist/exam.js');
const context={window:{}};
for(const name of ['dse2024-data.js','dse2024-coaching.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',name),'utf8'),context);
const exam=JSON.parse(JSON.stringify(context.window.COACH_EXAM_DATA));
const coaching=JSON.parse(JSON.stringify(context.window.COACH_EXAM_COACHING));
const compiled=C.compile(exam);
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/dse2024-coaching-manifest.json'),'utf8'));
const digest=s=>crypto.createHash('sha256').update(s.replace(/\s+/g,''),'utf8').digest('hex');

test('each original question has a complete worked lesson and a reusable method suited to its format',()=>{
  assert.deepEqual(Object.keys(coaching.lessons),exam.questions.map(q=>q.id));
  for(const q of exam.questions){
    const lesson=coaching.lessons[q.id];
    assert.ok(lesson.eyes.length>=2&&lesson.search.length>=2,q.id);
    assert.ok(lesson.steps.length>=3&&lesson.steps.every(s=>s.read&&s.infer),q.id);
    assert.ok(lesson.writing.length&&lesson.frame&&lesson.transfer.length>=4&&lesson.tips.length>=2,q.id);
    assert.ok(lesson.checks.length>=2,q.id);
    if(q.answerParts.some(p=>p.kind!=='choice')){
      assert.ok(lesson.mistakes.some(m=>m.score===0),q.id+' zero-mark diagnosis');
      assert.ok(lesson.mistakes.some(m=>m.score>0),q.id+' partial-mark diagnosis');
      for(const m of lesson.mistakes)assert.ok(m.thought&&m.diagnosis&&m.repair.length&&m.title,q.id);
    }
  }
  assert.match(coaching.lessons['dse2024-q17'].writing.join(''),/只填.*兩字|只填.*性格詞/);
  assert.match(coaching.lessons['dse2024-q20'].tips.join(''),/不是三個分析方向的必備清單/);
});

test('every coached evidence excerpt is exact and can be highlighted in its original paragraph',()=>{
  let count=0;
  for(const q of exam.questions)for(const e of E.lessonEvidence(coaching.lessons[q.id])){
    assert.ok(exam.passages[0].paragraphs[e.paragraph-1].includes(e.quote),q.id+': '+e.quote);
    const ids=C.quoteSentenceIds(compiled.passages,q.passages,e.quote,e.paragraph);
    assert.ok(ids.length,q.id);
    assert.ok(ids.map(id=>compiled.sentences[id].text).join('').includes(e.quote),q.id);
    count++;
  }
  assert.equal(count,manifest.evidenceCount);
});

test('all objective alternatives are explained exactly once and correct choices match the source key',()=>{
  for(const q of exam.questions.filter(q=>q.answerParts.every(p=>p.kind==='choice'))){
    const options=coaching.lessons[q.id].options;
    for(const p of q.answerParts){
      const rows=options.filter(o=>o.part===p.key);
      assert.deepEqual(rows.map(o=>o.value),p.choices.map(c=>c.value),q.id+' '+p.key);
      assert.deepEqual(rows.filter(o=>o.correct).map(o=>o.value),[p.answer],q.id+' '+p.key);
      assert.ok(rows.every(o=>o.reason.length>15));
    }
  }
});

test('loss examples retain the wording, part scores and references checked against the supplied marking PDFs',()=>{
  const actual=[];
  for(const [id,lesson] of Object.entries(coaching.lessons))for(const m of lesson.mistakes){
    assert.ok(Number.isInteger(m.score)&&m.score>=0&&m.score<m.outOf);
    actual.push({id,part:m.part,score:m.score,outOf:m.outOf,textHash:digest(m.text),source:m.source});
  }
  assert.deepEqual(actual,manifest.cases);
  for(const q of exam.questions){
    const model=q.official.flatMap(p=>p.examples).find(e=>e.score===4);
    for(const n of coaching.lessons[q.id].modelNotes||[])assert.ok(model.text.includes(n.quote),q.id);
  }
});

test('reading source answers directly neither reviews a draft nor invents an objective result',()=>{
  const q=compiled.questions.find(q=>q.number===9),d=C.newDraft(),before=JSON.stringify(d);
  assert.equal(E.markingHTML(q,d),'');
  assert.match(E.markingHTML(q,d,{reveal:true}),/文件列出的正確答案/);
  assert.equal(E.objectiveResult(q,d),null);
  assert.equal(JSON.stringify(d),before);
  const html=E.lessonHTML(q,coaching.lessons[q.id],{standalone:true});
  assert.match(html,/逐項判斷/);assert.match(html,/add-coach-evidence/);
  const unsafe={...coaching.lessons[q.id],headline:'<img src=x onerror=alert(1)>'};
  assert.doesNotMatch(E.lessonHTML(q,unsafe),/<img src=x/);
  assert.match(E.lessonHTML(q,unsafe),/&lt;img/);
});

test('downloads include all reasoning and repairs while the original practice paper remains answer-free',()=>{
  const answers=E.answerSheet(exam,coaching),practice=E.worksheet(exam);
  for(const q of exam.questions){
    const lesson=coaching.lessons[q.id];
    assert.ok(answers.includes(E.questionText(q)),q.id);
    for(const step of lesson.steps)assert.ok(answers.includes(step.infer),q.id);
    for(const m of lesson.mistakes){assert.ok(answers.includes(m.text));assert.ok(answers.includes(m.diagnosis));for(const s of m.repair)assert.ok(answers.includes(s));}
    assert.ok(answers.includes(lesson.frame));
  }
  assert.match(answers,/不代表實際考生出現率/);
  assert.doesNotMatch(practice,/文件答案舉隅|失分診斷|再推答案/);
  assert.equal(answers,fs.readFileSync(path.join(__dirname,'../dist/worksheets/2024-fansheng-answer-coach.txt'),'utf8'));
  assert.equal(practice,fs.readFileSync(path.join(__dirname,'../dist/worksheets/2024-fansheng-practice.txt'),'utf8'));
});
