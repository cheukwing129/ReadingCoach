const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const C=require('../dist/core.js');
const E=require('../dist/exam.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/dse2024-data.js'),'utf8'),context);
const exam=JSON.parse(JSON.stringify(context.window.COACH_EXAM_DATA));
const compiled=C.compile(exam);
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/dse2024-source-manifest.json'),'utf8'));
const digest=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const q=n=>compiled.questions.find(q=>q.number===n);
function filled(question){const d=C.newDraft();for(const p of question.answerParts)d.fields[p.key]=p.kind==='choice'?p.answer:'自己的試答';return d;}

test('source text and question wording match the verified paper fingerprints',()=>{
  assert.equal(exam.passages.length,1);
  assert.equal(exam.passages[0].paragraphs.length,15);
  assert.equal(exam.questions.length,12);
  assert.deepEqual(exam.questions.map(q=>q.number),[9,10,11,12,13,14,15,16,17,18,19,20]);
  assert.equal(exam.questions.reduce((n,q)=>n+q.marks,0),35);
  assert.equal(exam.questions.reduce((n,q)=>n+q.answerParts.length,0),18);
  assert.deepEqual(exam.passages[0].paragraphs.map(digest),manifest.paragraphHashes);
  for(const question of exam.questions){
    assert.equal(digest(E.questionText(question)),manifest.questionHashes[question.id],question.id);
    assert.equal(digest(JSON.stringify(question.official)),manifest.answerHashes[question.id],question.id+' source answers');
    assert.equal(question.marks,manifest.questionMarks[question.id]);
  }
  assert.match(exam.passages[0].paragraphs[8],/挪到了地邊/);
  assert.match(exam.passages[0].paragraphs[13],/老闆據說賠進去上百萬/);
  assert.doesNotMatch(exam.passages[0].paragraphs[13],/直接自殺/);
});

test('official totals are independent of coaching checklist counts',()=>{
  assert.equal(q(13).marks,5);
  assert.equal(q(15).marks,4);assert.equal(q(15).rubric.length,3);
  assert.equal(q(20).marks,4);assert.equal(q(20).rubric.length,3);
  for(const question of compiled.questions)assert.equal(question.answerParts.reduce((n,p)=>n+p.marks,0),question.marks);
  const d=filled(q(15));d.checks=q(15).rubric.map(()=> 'yes');d.examReviewed=true;
  assert.equal(E.objectiveResult(q(15),d),null);
  assert.equal(E.scoreText(q(15),d),'書面題待教師評閱');
});

test('objective answers match the folder key and cannot earn marks from self-checks',()=>{
  const found={};
  for(const question of compiled.questions.filter(q=>q.answerParts.every(p=>p.kind==='choice'))){
    const d=filled(question);assert.equal(E.objectiveResult(question,d),null);
    for(const p of question.answerParts)found[String(question.number)+(question.answerParts.length>1?'('+p.key+')':'')]=p.answer;
    d.examReviewed=true;assert.equal(E.objectiveResult(question,d).earned,question.marks);
    d.checks=question.rubric.map(()=> 'yes');
    for(const p of question.answerParts)d.fields[p.key]=p.choices.find(c=>c.value!==p.answer).value;
    assert.equal(E.objectiveResult(question,d).earned,0);
  }
  assert.deepEqual(found,manifest.objectiveAnswers);
});

test('all evidence quotes point to exact text and sentence annotation preserves every character',()=>{
  const passage=compiled.passages[0];
  for(const p of passage.paragraphs)assert.equal(p.sentences.map(s=>s.text).join(''),exam.passages[0].paragraphs[p.number-1]);
  for(const question of compiled.questions){
    assert.equal(question.hints.length,3);
    for(const e of question.evidenceAnalysis){
      assert.ok(exam.passages[0].paragraphs[e.paragraph-1].includes(e.quote));
      const ids=C.quoteSentenceIds(compiled.passages,question.passages,e.quote,e.paragraph);
      assert.ok(ids.length,question.id+': '+e.quote);
      assert.ok(ids.map(id=>compiled.sentences[id].text).join('').includes(e.quote));
    }
    for(const group of question.evidenceGroups)assert.ok(group.ids.length,question.id+': '+group.label);
  }
});
test('an evidence excerpt spanning multiple sentences selects the entire quote once',()=>{
  const question=q(16),e=question.evidenceAnalysis[2];
  const ids=C.quoteSentenceIds(compiled.passages,question.passages,e.quote,e.paragraph);
  assert.equal(ids.length,3);
  assert.deepEqual(ids,question.evidenceGroups[2].ids);
  assert.deepEqual(C.quoteSentenceIds(compiled.passages,question.passages,''),[]);
});

test('every multipart answer must be filled and reviewed before completion',()=>{
  const question=q(13),d=filled(question);d.checks=question.rubric.map(()=> 'unsure');
  delete d.fields.ii;assert.match(C.completionError(question,d,question.answerParts),/每個/);
  d.fields.ii='自己的效果分析';assert.match(C.completionError(question,d,question.answerParts),/來源答案/);
  d.examReviewed=true;assert.equal(C.completionError(question,d,question.answerParts),'');
  assert.ok(!E.markingHTML(question,{...d,examReviewed:false}).includes('「乳汁」代表'));
});

test('two-character task gives format feedback without inventing a semantic grade',()=>{
  const question=q(17),d=filled(question);d.fields.answer='十分樂觀';
  assert.match(C.structuralFeedback(question,d,question.answerParts).join(''),/要求2字詞，目前為4字/);
  d.fields.answer='樂觀';assert.doesNotMatch(C.structuralFeedback(question,d,question.answerParts).join(''),/目前為/);
  d.examReviewed=true;assert.equal(E.objectiveResult(question,d),null);
  assert.match(E.markingHTML(question,d),/不是兩字詞，給0分/);
});

test('draft restoration rejects invalid options and revision invalidates the old source check',()=>{
  const question=q(12),d=filled(question);d.examReviewed=true;d.checks=question.rubric.map(()=> 'yes');d.checkEvidence=Object.fromEntries(question.rubric.map((_,i)=>[i,C.answerSentences(d,question.answerParts)]));d.completedAt='2026-10-09T23:40:00Z';
  const restored=C.sanitizeDraft(d,question,question.answerParts,compiled.sentences);
  assert.equal(restored.completedAt,d.completedAt);
  assert.equal(restored.fields.i,'D');assert.equal(E.objectiveResult(question,restored).earned,2);
  C.changeAnswer(restored,'i','A');assert.equal(restored.examReviewed,undefined);assert.equal(restored.completedAt,undefined);assert.deepEqual(restored.checks,[]);
  const invalid=C.sanitizeDraft({...d,mode:'free',free:'D A',fields:{i:'<script>',ii:'A'}},question,question.answerParts,compiled.sentences);
  assert.equal(invalid.mode,'guided');assert.equal(invalid.fields.i,'');assert.equal(invalid.examReviewed,false);assert.equal(invalid.completedAt,undefined);
});

test('downloads retain original questions and distinguish source answers from coaching',()=>{
  const worksheet=E.worksheet(exam),answers=E.answerSheet(exam);
  for(const p of exam.passages[0].paragraphs)assert.ok(worksheet.includes(p));
  for(const question of exam.questions){
    assert.ok(worksheet.includes(E.questionText(question)));
    for(const m of question.official){for(const a of m.answers)assert.ok(answers.includes(a));for(const e of m.examples)assert.ok(answers.includes(e.text));}
  }
  assert.doesNotMatch(worksheet,/教練提示|文件答案舉隅/);
  assert.match(answers,/教練分析（新增）/);
  assert.match(answers,/最高只給下品/);
});

test('Cloudflare root and dist entries load the same complete versioned dependency set',()=>{
  const repo=path.join(__dirname,'..');
  const expected=['styles.css','core.js','data.js','dse2024-data.js','dse2024-coaching.js','exam.js','transfer-data.js','catalog.js','academy-core.js','academy-ui.js','app.js'];
  for(const [file,prefix] of [['index.html','dist/'],['dist/index.html','']]){
    const html=fs.readFileSync(path.join(repo,file),'utf8');
    const urls=[...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]+)?)"/g)].map(m=>m[1]);
    assert.deepEqual(urls.map(url=>url.split('?')[0]),expected.map(a=>prefix+a));
    assert.equal(new Set(urls.map(url=>url.split('?')[1])).size,1);
    for(const url of urls)assert.ok(fs.existsSync(path.resolve(repo,path.dirname(file),url.split('?')[0])));
  }
});
