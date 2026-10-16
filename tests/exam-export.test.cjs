const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const X=require('../dist/exam-export.js'),C=require('../dist/self-study-core.js'),root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="dist\/([^"?]+)\?/g)){
 if(/vendor|self-study-app|self-study-core|year-access|reading-support|exam-export/.test(m[1]))continue;
 vm.runInContext(fs.readFileSync(path.join(root,'dist',m[1]),'utf8'),ctx);
}
const D=JSON.parse(JSON.stringify(ctx.window.SelfStudyData)),S=JSON.parse(JSON.stringify(ctx.window.SELF_STUDY_SAMPLES)),q=id=>D.questions.find(q=>q.id===id);
function completed(questions){return Object.fromEntries(questions.map(q=>[q.id,{...C.draft(),answers:Object.fromEntries(q.answerParts.map(p=>[p.key,p.kind==='choice'?p.answer:p.segment?(p.segment.entry==='start'?String(p.segment.accepted[0][0]):p.segment.accepted[0].join('至')):'這是學生自己的答案。']))}]));}
test('preflight checks each written and choice part, independently of learning completion',()=>{
 const x=q('dse2024-q12'),drafts={[x.id]:{completed:true,answers:{i:'D',ii:'  '}}};
 assert.deepEqual(X.missing([x],drafts).map(r=>r.key),['ii']);drafts[x.id].completed=false;drafts[x.id].answers.ii='A';assert.equal(X.missing([x],drafts).length,0);
 drafts[x.id].answers.ii='invalid';assert.equal(X.missing([x],drafts).length,1);
});
test('year and article selection preserve original numbering and do not include other years',()=>{
 assert.deepEqual(X.questionsFor(D,{kind:'year',year:2024}).map(q=>q.number),Array.from({length:19},(_,i)=>i+9));
 assert.deepEqual(X.questionsFor(D,{kind:'article',id:'dse2024-fansheng'}).map(q=>q.number),Array.from({length:12},(_,i)=>i+9));
 assert.equal(X.build(D,{kind:'year',year:2099},{},S).ready,false);
});
test('known correct and incorrect choices, partial short answers, and unknown free answers remain distinct',()=>{
 const a=q('dse2024-q12'),d={answers:{i:'D',ii:'D'}};
 assert.equal(X.assessment(a,a.answerParts[0],d,S,{}).score,1);assert.equal(X.assessment(a,a.answerParts[1],d,S,{}).score,0);
 const b=q('dse2024-q17'),p=b.answerParts[0];
 assert.equal(X.assessment(b,p,{answers:{answer:'堅毅'}},S,{}).score,2);
 assert.equal(X.assessment(b,p,{answers:{answer:'不屈'},selfGrades:{answer:2}},S,{}).status,'manual');
 assert.equal(X.assessment(b,p,{answers:{answer:'十分樂觀'}},S,{}).score,0);
 const c=q('dse2024-q15');assert.equal(X.assessment(c,c.answerParts[0],{answers:{answer:S[c.id].answer[0].text}},S,{}).status,'manual');
});
test('multiple choice accepts optional selections and never assigns marks to unverified keys',()=>{
 const x=q('dse2015-q7'),p=x.answerParts.find(p=>p.multiple);
 for(const set of p.acceptedAnswers)assert.equal(X.assessment(x,p,{answers:{[p.key]:set.join('、')}},S,{}).score,2);
 assert.equal(X.assessment(x,{...p,answerVerified:false},{answers:{[p.key]:p.answer}},S,{}).status,'manual');
});
test('IR, unresolved prerequisites, duplicate traits and cross-question conditions use current drafts',()=>{
 const a=q('dse2016-q1'),p=a.answerParts.find(p=>p.assessmentDependency);const d={answers:{[p.key]:'學生答案',[p.assessmentDependency.key]:'99至100'}};
 assert.equal(X.assessment(a,p,d,S,{}).status,'ir');
 const b=q('dse2026-q14'),drafts={[b.id]:{answers:{i:'真誠',ii:'誠實'}}};
 const scores=b.answerParts.map(p=>X.assessment(b,p,drafts[b.id],S,drafts));assert.equal(scores[0].score,2);assert.equal(scores[1].score,0);
 const c=q('dse2013-q10'),part=c.answerParts[0],known=S[c.id][part.key].find(s=>s.explainedMethods?.length===1&&s.explainedMethods[0]==='C');
 assert.ok(known);{const all={[c.id]:{answers:{[part.key]:known.text}},'dse2013-q9':{answers:{answer:'C'}}};assert.equal(X.assessment(c,part,all[c.id],S,all).score,0);}
});
test('all years render each original question and every answer exactly once, without changing drafts',()=>{
 for(const year of [...new Set(D.articles.map(a=>a.year))]){
  const scope={kind:'year',year},qs=X.questionsFor(D,scope),drafts=completed(qs),before=JSON.stringify(drafts),m=X.build(D,scope,drafts,S),html=X.paperHTML(m,{name:'<script>學生</script>',date:'2026/10/16'});
  assert.equal(m.ready,true,year);assert.equal((html.match(/data-export-question=/g)||[]).length,qs.length);
  assert.equal((html.match(/data-export-answer=/g)||[]).length,qs.reduce((s,q)=>s+q.answerParts.length,0));
  assert.equal(m.total,qs.reduce((s,q)=>s+q.marks,0));assert.ok(m.autoScore<=m.autoMax&&m.autoMax<=m.total,year);
  assert.equal(JSON.stringify(drafts),before);assert.ok(html.includes('&lt;script&gt;學生&lt;/script&gt;'));assert.ok(!html.includes('<script>'));
 }
});
test('long answers are preserved in full, merged cells survive, and unfinished papers cannot render',()=>{
 const qs=X.questionsFor(D,{kind:'year',year:2018}),drafts=completed(qs),answer='極長作答段落。\n'.repeat(400)+'最後一句';drafts['dse2018-q26'].answers.ii=answer;
 const m=X.build(D,{kind:'year',year:2018},drafts,S),html=X.paperHTML(m);assert.ok(html.includes(answer));assert.match(html,/colspan="2"/);
 delete drafts['dse2018-q26'].answers.ii;assert.equal(X.paperHTML(X.build(D,{kind:'year',year:2018},drafts,S)),'');
});

test('article exports include both source texts when a question compares passages',()=>{
 const scope={kind:'article',id:'dse2021-train'},qs=X.questionsFor(D,scope),model=X.build(D,scope,completed(qs),S);
 assert.equal(model.articles.length,1);assert.equal(model.readingArticles.length,2);assert.equal((X.paperHTML(model,{includePassages:true}).match(/class="exam-passage"/g)||[]).length,2);
});
