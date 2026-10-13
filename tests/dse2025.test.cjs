const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2017-data','dse2018-data','dse2019-data','dse2020-data','dse2021-data','dse2022-data','dse2023-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2025-q'+n);
test('2025 contains both vernacular passages and all original questions 9–20, totaling 41 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2025);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+9));assert.equal(qs.reduce((n,x)=>n+x.marks,0),41);
 assert.deepEqual(qs.map(x=>x.marks),[2,2,2,4,4,4,2,2,4,6,2,7]);assert.equal(new Set(D.questions.map(x=>x.id)).size,D.questions.length);
 const as=D.articles.filter(x=>x.year===2025);assert.deepEqual(as.map(x=>[x.title,x.paragraphs.length]),[['我們都曾以為自己會是小說的主人公',10],['比正路還長的巷子',10]]);
 assert.equal(C.nextQuestion(D,q(13)).number,14);assert.equal(C.nextQuestion(D,q(15)),null);assert.equal(C.nextQuestion(D,q(19)).number,20);assert.equal(C.nextQuestion(D,q(20)),null);
 const m=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2025-source-manifest.json')));assert.equal(m.marks,41);for(const a of as)for(const p of a.paragraphs)assert.equal(crypto.createHash('sha256').update(p.text).digest('hex'),m.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);
});
test('all objective options retain the real answer key and an individual explanation',()=>{
 for(const [n,answers]of [[9,['C']],[10,['D']],[14,['C','B']],[15,['B']],[17,['A','D']]]){
  const x=q(n);assert.deepEqual(x.answerParts.map(p=>p.answer),answers);
  for(const p of x.answerParts)for(const c of p.choices)assert.ok(x.optionAnalysis.find(o=>o.part===p.key&&o.value===c.value)?.reason.length>20);
  const d=C.draft();x.answerParts.forEach(p=>d.answers[p.key]=p.answer);assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),x.marks);assert.deepEqual(C.gradingItems(x,d,S),[]);
 }
 assert.equal(q(9).table.rows.length,4);assert.equal(q(18).table.rows.length,3);
});
test('short-answer examples preserve meaning, format and multipart score boundaries',()=>{
 for(const [n,key,text,score]of [[11,'answer','自省',2],[11,'answer','懷疑',1],[11,'answer','現實',0],[16,'answer','昂首挺胸',2],[16,'answer','自信',1],[16,'answer','高聳',0],[18,'i','人生失意的時候。',1],[18,'i','前路茫茫時，感到十分鬱悶。',0],[18,'ii','紅磚道有高低不齊的騎樓。',1],[18,'iii','因為生活貧困，感到驚恐和慌張。',0],[19,'answer','人生短暫，人類也是微不足道的。',1],[19,'answer','城市的生活十分壓迫。',0]]){
  const x=q(n),p=x.answerParts.find(p=>p.key===key);assert.equal(C.pool(x,p,S).find(s=>s.text===text)?.score,score,n+'/'+key+'/'+text);
 }
 const d=C.draft();d.answers.answer='重新醒悟';assert.equal(C.samples(q(11),q(11).answerParts[0],d,S).find(s=>s.own).score,0);
 d.answers.answer='反省';assert.equal(C.samples(q(11),q(11).answerParts[0],d,S).find(s=>s.own).score,null);
 const items=C.gradingItems(q(18),C.draft(),S);assert.deepEqual([...new Set(items.map(x=>x.key))].sort(),['i','ii','iii']);assert.ok(items.every(x=>x.outOf===2));
});
test('Q19 assesses the first 26 characters including punctuation without failing the whole answer',()=>{
 const x=q(19),p=x.answerParts[0];assert.equal(p.assessFirstChars,26);assert.equal(p.exactChars,undefined);assert.equal(p.maxChars,undefined);
 const prefix='比起自然之永恆，人類更顯得渺小。',d=C.draft();d.answers.answer=prefix+'這是我補充的其他文字，超過部分不評。';const own=C.samples(x,p,d,S).find(s=>s.own);assert.equal(own.score,null);
 assert.equal(C.answerCharacters(d.answers.answer).length>26,true);assert.equal(C.assessmentText(p,d.answers.answer),C.answerCharacters(d.answers.answer).slice(0,26).join(''));
 d.answers.answer='城市的生活十分壓迫。';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,0);
 assert.match(x.official[0].criteria.join(''),/超出部分不評閱.*並非整題0分/);
});
test('adding 2025 questions preserves prior 2025 and 2026 drafts and the Q20 dependency rule',()=>{
 const before={version:1,questions:{'dse2025-q12':{type:'technique',step:1,answers:{answer:'原有答案'},note:'舊筆記'},'dse2025-q20':{type:'rhythm',step:1,answers:{i:'緩慢',ii:'人生短暫。',iii:'原有分析'}},'dse2026-q17':{type:'cause',step:1,answers:{answer:'2026舊答案'}}}};
 const restored=C.migrate(before,null,D.questions);assert.equal(restored.questions['dse2025-q12'].answers.answer,'原有答案');assert.equal(restored.questions['dse2025-q12'].note,'舊筆記');assert.equal(restored.questions['dse2025-q20'].answers.iii,'原有分析');assert.equal(restored.questions['dse2026-q17'].answers.answer,'2026舊答案');
 assert.match(q(20).official.find(x=>x.key==='iii').criteria.join(''),/\(ii\)|（ii）/);
});
