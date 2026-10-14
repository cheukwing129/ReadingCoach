const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2017-classical-data','dse2018-data','dse2018-classical-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2026-q'+n);
test('2026 contains both original vernacular texts and all questions 9–20, totaling 42 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2026);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+9));assert.equal(qs.reduce((n,x)=>n+x.marks,0),42);
 assert.deepEqual(qs.map(x=>x.marks),[6,4,4,2,2,4,2,4,4,4,4,2]);assert.equal(D.articles.length,31);assert.equal(D.questions.length,216);
 const as=D.articles.filter(a=>a.year===2026);assert.deepEqual(as.map(a=>[a.title,a.author,a.paragraphs.length]),[['當機器人成立作家協會','韓少功',3],['聲音','葛亮',10]]);
 assert.deepEqual(as[0].notes,['① 蒙圈：感到困惑而不知所措。']);assert.equal(w.window.SelfStudyAnalysis[as[0].id].length,3);
 assert.equal(C.nextQuestion(D,q(11)),null);assert.equal(C.nextQuestion(D,q(19)).number,20);assert.equal(C.nextQuestion(D,q(20)),null);
 const m=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2026-source-manifest.json')));assert.equal(m.marks,42);for(const a of as)for(const p of a.paragraphs)assert.equal(crypto.createHash('sha256').update(p.text).digest('hex'),m.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);
});
test('unverified objective analyses never produce confirmed scores or claim a source key',()=>{
 for(const [n,answers]of [[9,['D']],[10,['否','是']],[11,['否','是']],[12,['B']],[15,['B']],[16,['否','是']],[20,['C']]]){
  const x=q(n),parts=x.answerParts.filter(p=>p.kind==='choice');assert.deepEqual(parts.map(p=>p.answer),answers);assert.ok(parts.every(p=>p.answerVerified===false));
  const d=C.draft();parts.forEach(p=>d.answers[p.key]=p.answer);assert.ok(C.choiceResult(x,d).every(r=>r.score===null));
  parts.forEach(p=>p.choices.forEach(c=>assert.ok(x.optionAnalysis.find(o=>o.part===p.key&&o.value===c.value)?.reason.length>15)));
  parts.forEach(p=>d.answers[p.key]='無從判斷');assert.ok(C.choiceResult(x,d).every(r=>r.score===null));
 }
 const app=fs.readFileSync(path.join(root,'dist/self-study-app.js'),'utf8');assert.match(app,/尚未取得官方客觀題答案核對/);assert.match(app,/參考判讀/);
 const verified=D.questions.find(x=>x.id==='dse2025-q10'),d=C.draft();d.answers.answer='D';assert.equal(C.choiceResult(verified,d)[0].score,2);
});
test('Q9 mixes an unscored objective part and source-graded written examples covering 0–4',()=>{
 const x=q(9),d=C.draft();assert.deepEqual(x.answerParts.map(p=>[p.key,p.kind,p.marks]),[['i','choice',2],['ii','long',4]]);
 assert.deepEqual(S[x.id].ii.map(s=>s.score),[4,3,2,1,0]);assert.ok(C.gradingItems(x,d,S).every(s=>s.key==='ii'));assert.match(x.official[1].criteria.join(''),/最高2分/);
 d.answers.i='D';assert.equal(C.choiceResult(x,d)[0].score,null);d.answers.ii='我選擇盲童，這是我的個人意見。';assert.equal(C.samples(x,x.answerParts[1],d,S).find(s=>s.own).score,null);
});
test('Q13 keeps features and effects separate and applies the four-character maximum per part',()=>{
 const x=q(13);for(const [key,text,score]of [['i','輕柔',1],['i','安謐靜和',1],['i','輕聲吟唱',0],['ii','安撫人心',1],['ii','振奮人心',0]]){
  const p=x.answerParts.find(p=>p.key===key),d=C.draft();d.answers[key]=text;assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,score);
 }
 const d=C.draft();d.answers={i:'聲音非常輕柔',ii:'安撫人心'};assert.equal(C.samples(x,x.answerParts[0],d,S).find(s=>s.own).score,0);assert.equal(C.samples(x,x.answerParts[1],d,S).find(s=>s.own).score,1);
});
test('Q14 counts synonymous traits only once, retaining the higher score and recomputing on edits',()=>{
 const x=q(14),scores=answers=>{const d=C.draft();d.answers=answers;return x.answerParts.map(p=>C.samples(x,p,d,S).find(s=>s.own)?.score);};
 assert.deepEqual(scores({i:'真誠',ii:'誠實'}),[2,0]);assert.deepEqual(scores({i:'純真',ii:'單純'}),[2,0]);assert.deepEqual(scores({i:'善心',ii:'善良'}),[0,2]);assert.deepEqual(scores({i:'誠懇',ii:'誠實'}),[0,2]);
 assert.deepEqual(scores({i:'善良',ii:'真誠'}),[2,2]);assert.deepEqual(scores({i:'勇敢',ii:'冷靜'}),[0,0]);assert.deepEqual(scores({i:'十分善良',ii:'真誠'}),[0,2]);assert.deepEqual(scores({i:'質樸',ii:'善良'}),[null,2]);
 const d=C.draft();d.answers={i:'真誠',ii:'誠實'};assert.equal(C.samples(x,x.answerParts[1],d,S).find(s=>s.own).distinctChecked,true);C.updateAnswer(d,'i','善良');assert.equal(C.samples(x,x.answerParts[1],d,S).find(s=>s.own).score,2);
 assert.ok(C.pool(x,x.answerParts[1],S).find(s=>s.text==='誠實').score===2);
});
test('2026 completion preserves old long-answer drafts and earlier years',()=>{
 const saved={version:1,questions:{'dse2026-q17':{type:'cause',step:1,answers:{answer:'馬師傅舊答案'}},'dse2026-q18':{type:'quote',step:1,answers:{answer:'英珠舊答案'}},'dse2025-q19':{type:'summary',step:1,answers:{answer:'2025舊答案'}}}};
 const s=C.migrate(saved,null,D.questions);assert.equal(s.questions['dse2026-q17'].answers.answer,'馬師傅舊答案');assert.equal(s.questions['dse2026-q18'].answers.answer,'英珠舊答案');assert.equal(s.questions['dse2025-q19'].answers.answer,'2025舊答案');
});
