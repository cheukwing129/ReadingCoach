const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2024-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2024-classical-source-manifest.json'))),article=D.articles.find(a=>a.id==='dse2024-classical');
const own=(n,text)=>{const x=q(n),d=C.draft();d.answers.answer=text;return C.samples(x,x.answerParts[0],d,S).find(s=>s.own);};

test('2024 classical trial adds only Part B questions 21–27, fourteen marks, without any prescribed-text question',()=>{
 const qs=D.questions.filter(x=>x.exerciseId===article.id);assert.deepEqual(qs.map(x=>x.number),[21,22,23,24,25,26,27]);assert.deepEqual(qs.map(x=>x.marks),[2,1,2,3,1,2,3]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),14);
 assert.deepEqual(D.questions.filter(x=>x.year===2024).map(x=>x.number),Array.from({length:19},(_,i)=>i+9));assert.equal(D.questions.filter(x=>x.year===2024&&x.number<9).length,0);assert.equal(D.questions.filter(x=>x.year===2024).reduce((n,x)=>n+x.marks,0),49);
 assert.deepEqual(D.articles.filter(a=>a.year===2024).map(a=>a.id),['dse2024-fansheng','dse2024-classical']);assert.equal(D.articles.length,29);assert.equal(D.questions.length,202);
 for(const x of qs){const h=manifest.questionHashes.find(h=>h.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
});

test('both original named sections retain their complete text, six original notes and source titles',()=>{
 assert.equal(article.genre,'classical');assert.equal(article.author,'劉義慶、蘇軾');assert.equal(article.paragraphs.length,2);assert.deepEqual(article.paragraphs.map(p=>[p.number,p.label]),[[1,'第一則'],[2,'第二則']]);assert.equal(article.notes.length,6);
 for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(h=>h.number===p.number).textSha256);
 assert.match(article.paragraphs[0].text,/蘇峻亂①，諸庾逃散/);assert.match(article.paragraphs[0].text,/不願名器/);assert.match(article.paragraphs[1].text,/劉伯倫④常以鍤⑤自隨/);assert.match(article.paragraphs[1].text,/苟為不然，死則已矣，何必更埋/);assert.match(article.paragraphs[0].sourceLabel,/世說新語・任誕/);assert.match(article.paragraphs[1].sourceLabel,/東坡志林/);
 assert.deepEqual(article.paragraphs[0].highlights,['冰欲報卒，適其所願']);assert.match(manifest.numberingConvention,/不新增原段號/);
});

test('new word-meaning and translation types state different transferable tasks and do not alter vernacular classifications',()=>{
 assert.equal(q(22).lesson.type,'classicalWord');assert.equal(q(25).lesson.type,'classicalWord');assert.equal(q(23).lesson.type,'translation');assert.equal(q(17).lesson.type,'trait');
 for(const key of ['classicalWord','translation']){assert.ok(D.types[key].feature.length>20);assert.equal(D.types[key].steps.length,3);assert.ok(D.types[key].note.length>20);}
 assert.notEqual(D.types.classicalWord.feature,D.types.translation.feature);assert.equal(Object.keys(D.types).length,30);
});

test('all five classical objective parts retain verified keys, original marks and independent option reasons',()=>{
 for(const [n,keys]of [[21,['C']],[22,['D']],[25,['B']],[26,['A','B']]]){const x=q(n),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.answer),keys);for(const p of x.answerParts){assert.equal(p.answerVerified,true);d.answers[p.key]=p.answer;for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===p.answer);assert.ok(rows[0].reason.length>=20);}}assert.equal(C.choiceResult(x,d).reduce((sum,r)=>sum+r.score,0),x.marks);assert.deepEqual(C.gradingItems(x,d,S),[]);}
 assert.match(q(21).optionAnalysis.find(a=>a.value==='A').reason,/失言/);assert.match(q(22).optionAnalysis.find(a=>a.value==='B').reason,/名詞/);assert.match(q(25).optionAnalysis.find(a=>a.value==='D').reason,/浪費/);assert.match(q(26).answerParts[1].label,/不埋葬最為通達/);
});

test('Q23 uses one original translation field, independent clause meaning and authentic two-, one- and zero-mark responses',()=>{
 assert.equal(q(23).answerParts.length,1);assert.equal(q(23).answerParts[0].marks,2);assert.equal(q(23).answerParts[0].kind,'long');const rows=S[q(23).id].answer;assert.equal(rows.length,5);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2]);
 assert.equal(rows.find(s=>s.id.endsWith('partial1')).score,1);assert.match(rows.find(s=>s.id.endsWith('partial1')).analysis,/前句.*零分.*後句.*獨立/);assert.equal(rows.find(s=>s.id.endsWith('sampleE2')).score,2);assert.equal(rows.find(s=>s.id.endsWith('sampleB0')).score,0);assert.equal(rows.find(s=>s.id.endsWith('sampleC0')).score,0);
 const criteria=q(23).official[0].criteria.join('');assert.match(criteria,/兩分句獨立評改/);assert.match(criteria,/錯別字不扣分/);assert.match(criteria,/其.*他的或差役的/);assert.match(criteria,/報復.*報告/);assert.match(criteria,/冗文可扣1分/);
 assert.equal(own(23,'我以自己的白話句說明庾冰報恩並滿足差役願望。').score,null);assert.equal(own(23,rows.find(s=>s.id.endsWith('sampleE2')).text).score,2);assert.equal(own(23,rows.find(s=>s.id.endsWith('sampleE2')).text).dependencyChecked,undefined);
 for(const suffix of ['sampleB0','sampleC0','sampleE2'])assert.deepEqual(manifest.longExemplars.find(r=>r.id.endsWith(suffix)).scoreEvidence,{file:'2024-brief4.pdf',page:15});
});

test('Q24 separates the rescue strategy from freedom from rank and external desires without grading by checklist count',()=>{
 assert.deepEqual([...new Set(S[q(24).id].answer.map(s=>s.score))].sort(),[0,1,2,3]);assert.equal(S[q(24).id].answer.filter(s=>s.score===3).length,2);const criteria=q(24).official[0].criteria.join('');assert.match(criteria,/率性而行/);assert.match(criteria,/不是沒有任何回報要求/);assert.match(criteria,/整體評品/);
 assert.equal(own(24,'他不求官位，但仍要酒，因此我會分析自由與名利。').score,null);assert.equal(S[q(24).id].answer.find(s=>s.id.endsWith('zero')).score,0);
});

test('Q27 preserves the briefing distinction between the three-mark nonattachment analysis and the two-mark burial-only direction',()=>{
 const criteria=q(27).official[0].criteria.join('');assert.match(criteria,/不害為達.*最高上品3分/);assert.match(criteria,/何必更埋.*最高中品2分/);assert.match(criteria,/任一項已使全題0分/);assert.match(criteria,/不是說棺槨衣衾都是浪費/);
 const rows=S[q(27).id].answer;assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3]);assert.equal(rows.find(s=>s.id.endsWith('middle2')).score,2);assert.equal(rows.find(s=>s.id.endsWith('zero')).score,0);assert.equal(rows.find(s=>s.id.endsWith('sampleE3')).score,3);assert.match(rows.find(s=>s.id.endsWith('sampleE3')).text,/棺材.*不通達/);
 assert.match(manifest.q27Rules.twoMarkDirection,/簡報第40頁/);assert.match(manifest.q27Rules.zero,/第41頁/);assert.equal(own(27,'我會解釋不必刻意追求簡葬，形式少仍可能有所執着。').score,null);
});

test('sixteen authentic written exemplars retain text and score audits and every written part offers at least four source examples',()=>{
 const ids=[23,24,27].map(n=>q(n).id),cases=ids.flatMap(id=>Object.values(S[id]).flat());assert.equal(cases.length,16);assert.equal(manifest.longExemplars.length,16);
 for(const s of cases){const row=manifest.longExemplars.find(r=>r.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const [n,total]of [[23,5],[24,5],[27,6]])assert.equal(C.gradingItems(q(n),C.draft(),S).length,total);
});

test('translation and lexical reading help stays separate from original text and question scores',()=>{
 for(const p of article.paragraphs){assert.ok(p.support.translation.length>50);assert.ok(p.support.words.length>=6);assert.ok(p.support.words.every(w=>w.term&&w.meaning));assert.equal(p.support.number,p.number);}
 const first=article.paragraphs[0].support;assert.match(first.translation,/庾冰因此免於被捕/);assert.match(first.words.find(w=>w.term==='名器').meaning,/官爵/);assert.match(article.paragraphs[1].support.words.find(w=>w.term==='何必更埋').meaning,/反問/);
 const analyses=w.window.SelfStudyAnalysis[article.id];assert.equal(analyses.length,2);for(const a of analyses)for(const key of ['summary','technique','meaning','structure'])assert.ok(a[key].length>=15);
 assert.ok(manifest.dictionaryChecks.every(d=>d.url.startsWith('https://dict.revised.moe.edu.tw/')));
});

test('named-section locations, saved earlier answers and last-question boundaries remain correct',()=>{
 for(const n of [21,22,23,24])assert.deepEqual(C.questionParagraphs(q(n),article),[1]);for(const n of [25,26,27])assert.deepEqual(C.questionParagraphs(q(n),article),[2]);assert.equal(C.nextQuestion(D,q(20)),null);assert.equal(C.nextQuestion(D,q(23)).id,q(24).id);assert.equal(C.nextQuestion(D,q(27)),null);
 const saved=C.fresh();saved.questions[q(20).id]={...C.draft(),answers:{answer:'原先的繁盛答案'},selfGrades:{answer:3},revealed:true,completed:true};const restored=C.migrate(saved,null,D.questions);assert.equal(restored.questions[q(20).id].answers.answer,'原先的繁盛答案');assert.equal(restored.questions[q(20).id].selfGrades.answer,3);assert.equal(restored.questions[q(20).id].completed,true);assert.equal(restored.questions[q(21).id],undefined);
});
