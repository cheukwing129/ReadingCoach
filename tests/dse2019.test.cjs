const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2019-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2019-source-manifest.json')));

test('2019 retains both complete vernacular passages and original questions 7–16 totaling 45 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2019&&x.number<=16),as=D.articles.filter(x=>x.year===2019&&x.genre!=='classical');
 assert.deepEqual(qs.map(x=>x.number),Array.from({length:10},(_,i)=>i+7));assert.deepEqual(qs.map(x=>x.marks),[4,4,4,8,5,6,4,2,2,6]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),45);
 assert.deepEqual(as.map(a=>[a.title,a.author,a.paragraphs.length]),[['聰明人和傻子和奴才','魯迅',28],['談教訓','錢鍾書',6]]);
 assert.match(as[0].background,/1925年.*外有列強壓迫.*內則軍閥割據/);assert.match(as[0].numberingNote,/原卷沒有段號/);assert.equal(as[1].numberingNote,'');
 assert.match(as[0].paragraphs[1].text,/高粱皮/);assert.match(as[0].paragraphs[9].text,/他流着眼淚說/);assert.match(as[0].paragraphs[11].text,/穢氣/);assert.match(as[0].paragraphs[25].text,/慰問的人/);assert.match(as[0].paragraphs[27].text,/可不是麼/);
 assert.match(as[1].paragraphs[3].text,/有我則傲/);assert.doesNotMatch(as.map(a=>a.paragraphs.map(p=>p.text).join('')).join(''),/高粱粥|討飯的人|有我即傲/);
 for(const a of as)for(const p of a.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);
 assert.equal(hash(as[0].background),manifest.backgroundSha256);assert.equal(C.nextQuestion(D,q(10)),null);assert.equal(C.nextQuestion(D,q(15)).id,q(16).id);assert.equal(C.nextQuestion(D,q(16)),null);
});

test('all 2019 objective alternatives explain their role and preserve independent original part scores',()=>{
 for(const [n,answers]of [[7,['統治者','百姓','讀書人','革命者']],[12,['錯誤','錯誤','正確']],[14,['C']],[15,['D']]]){
  const x=q(n),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.answer),answers);
  for(const p of x.answerParts)for(const c of p.choices){const reasons=x.optionAnalysis.filter(o=>o.part===p.key&&o.value===c.value);assert.equal(reasons.length,1);assert.equal(reasons[0].correct,c.value===p.answer);assert.ok(reasons[0].reason.length>20);}
  x.answerParts.forEach(p=>d.answers[p.key]=p.answer);assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),x.marks);assert.deepEqual(C.gradingItems(x,d,S),[]);
 }
 const x=q(7),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.marks),[1,1,1,1]);assert.equal(x.table.headers.length,6);d.answers={i:'統治者',ii:'百姓',iii:'革命者',iv:'讀書人'};assert.deepEqual(C.choiceResult(x,d).map(x=>x.score),[1,1,0,0]);
 assert.match(q(15).quote,/有我則傲/);
});

test('allegory and criticism short answers distinguish complete meaning, incomplete terms and mere actions',()=>{
 for(const [n,key,text,score]of [[8,'i','腐敗的政權',2],[8,'i','當時社會',1],[8,'i','惡劣的居住環境',0],[8,'ii','改善百姓生活',2],[8,'ii','解決社會問題',1],[8,'ii','改善居住環境',0],[9,'i','魯莽',2],[9,'i','激進',1],[9,'i','熱血',0],[9,'i','使用暴力',0],[9,'ii','懦弱',2],[9,'ii','不敢抗爭',1],[9,'ii','尋人訴苦',0]]){
  const x=q(n),p=x.answerParts.find(p=>p.key===key),d=C.draft();d.answers[key]=text;assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,score,text);
 }
 const x=q(8),p=x.answerParts[0],d=C.draft();d.answers.i='改革中的新制度';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,null);
});

test('Q11 accepts source-listed four-character technique names and never makes its two parts dependent',()=>{
 const x=q(11),d=C.draft();assert.deepEqual(x.quoteHighlights,['自我犧牲精神']);assert.ok(x.quote.includes(x.quoteHighlights[0]));
 assert.equal(x.answerParts[0].exactChars,undefined);assert.equal(x.answerParts[0].maxChars,undefined);assert.deepEqual(x.answerParts.map(p=>p.marks),[2,3]);
 for(const [text,score]of [['反言正說',2],['反話正說',2],['雙關',2],['諷刺',1],['正話反說',0]]){d.answers.i=text;assert.equal(C.samples(x,x.answerParts[0],d,S).find(s=>s.own).score,score,text);}
 d.answers.i='誇張';d.answers.ii=S[x.id].ii.find(s=>s.score===3).text;assert.equal(C.samples(x,x.answerParts[1],d,S).find(s=>s.own).score,3);assert.match(x.official[1].criteria.join(''),/獨立評分/);
});

test('all long source exemplars preserve audited wording, actual bands and both full-score Q16 choices',()=>{
 assert.equal(manifest.longExemplars.length,27);const cases=Object.entries(S).filter(([id])=>/^dse2019-q(?:10|11|13|16)$/.test(id)).flatMap(([id,parts])=>Object.values(parts).flat());assert.equal(cases.length,27);
 for(const s of cases){const row=manifest.longExemplars.find(x=>x.id===s.id);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok([4,5,7,8,9,11,12,13].includes(row.page));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const [n,key,scores]of [[10,'i',[0,1,2,3,4]],[10,'ii',[0,1,2,3,4]],[11,'ii',[0,1,2,3]],[13,'answer',[0,1,2,3,4]],[16,'answer',[0,1,2,3,4,5,6]]])assert.deepEqual([...new Set(S[q(n).id][key].map(s=>s.score))].sort(),scores);
 const x=q(16),items=C.samples(x,x.answerParts[0],C.draft(),S);assert.equal(items.length,8);assert.equal(items.filter(s=>s.score===6).length,2);assert.ok(items.filter(s=>s.score===6).some(s=>s.text.includes('《談教訓》')));assert.ok(items.filter(s=>s.score===6).some(s=>s.text.includes('《聰明人和傻子和奴才》')));
 assert.match(q(13).official[0].criteria.join(''),/沒有指出禍害整題0分/);assert.match(q(16).official[0].criteria.join(''),/無須兼論另一篇/);
});

test('Q16 keeps first-text navigation numbers separate from the six original numbered second-text paragraphs',()=>{
 const x=q(16),first=D.articles.find(a=>a.id==='dse2019-fable'),second=D.articles.find(a=>a.id==='dse2019-admonition');
 assert.equal(x.exerciseId,second.id);assert.deepEqual(C.questionParagraphs(x,first),[1,3,5,7,8,16,19,21,24,25,27,28]);assert.deepEqual(C.questionParagraphs(x,second),[1,2,3,4,5,6]);
 assert.notEqual(first.paragraphs[3].text,second.paragraphs[3].text);assert.equal(first.year,second.year);
 const d=C.draft();d.answers.answer='我欣賞第一篇的荒誕情節，這是我的獨立分析。';assert.equal(C.samples(x,x.answerParts[0],d,S).find(s=>s.own).score,null);
});

test('adding 2019 preserves existing drafts and allows deferred self-assessment of its independent subparts',()=>{
 const before=C.fresh();before.questions['dse2024-q17']={...C.draft(),type:'trait',answers:{answer:'堅毅'},revealed:true,completed:true};before.questions['dse2019-q10']={...C.draft(),type:'criticism',answers:{i:'我自己的處世分析',ii:'我自己的批評'},selfGrades:{i:3,ii:2},revealed:true};const saved=JSON.stringify(before),restored=C.migrate(before,null,D.questions);
 assert.equal(JSON.stringify(before),saved);assert.equal(restored.questions['dse2024-q17'].completed,true);assert.deepEqual(restored.questions[q(10).id].selfGrades,{i:3,ii:2});
 const d=restored.questions[q(10).id],items=C.gradingItems(q(10),d,S);items.filter(s=>!s.own).forEach(s=>d.grades[s.id]=s.score);assert.equal(C.gradingReady(items,d),true);assert.equal(C.gradingResult(items,d).total,10);C.updateAnswer(d,'ii','新的批評');assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});
