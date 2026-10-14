const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2020-data','dse2021-data','dse2022-data','dse2023-data','dse2024-classical-data','dse2025-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-data','dse2026-data','self-study-data','reading-support'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core'),q=n=>D.questions.find(x=>x.id==='dse2025-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const article=D.articles.find(a=>a.id==='dse2025-classical'),manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2025-classical-source-manifest.json')));
const own=(n,text)=>{const d=C.draft();d.answers.answer=text;return C.samples(q(n),q(n).answerParts[0],d,S).find(s=>s.own);};

test('2025 adds only six Part B classical questions, fifteen marks, in original third-passage order',()=>{
 const qs=D.questions.filter(x=>x.exerciseId===article.id);assert.deepEqual(qs.map(x=>x.number),[21,22,23,24,25,26]);assert.deepEqual(qs.map(x=>x.marks),[2,2,2,2,3,4]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),15);
 assert.deepEqual(D.questions.filter(x=>x.year===2025).map(x=>x.number),Array.from({length:18},(_,i)=>i+9));assert.equal(D.questions.filter(x=>x.year===2025).reduce((n,x)=>n+x.marks,0),56);assert.deepEqual(D.articles.filter(a=>a.year===2025).map(a=>a.id),['dse2025-fiction','dse2025-alley','dse2025-classical']);assert.equal(D.questions.filter(x=>x.year===2025&&x.number<9).length,0);
 assert.equal(D.articles.length,24);assert.equal(D.questions.length,172);assert.equal(D.articles.find(a=>a.id==='dse2026-classical'),undefined);
 for(const x of qs){const h=manifest.questionHashes.find(h=>h.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
});
test('original texts retain named sections, source introduction and the visually corrected classical characters',()=>{
 assert.equal(article.genre,'classical');assert.equal(article.paperOrder,3);assert.equal(article.author,'司馬光、王若虛');assert.deepEqual(article.paragraphs.map(p=>[p.number,p.label]),[[1,'第一則'],[2,'第二則']]);assert.equal(article.notes.length,2);assert.match(article.background,/安史之亂.*王若虛/);
 for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(h=>h.number===p.number).textSha256);
 assert.match(article.paragraphs[0].text,/張巡、許遠謀/);assert.match(article.paragraphs[0].text,/飢羸/);assert.match(article.paragraphs[0].text,/密邇羣帥/);assert.match(article.paragraphs[1].text,/然而未仁/);assert.match(article.paragraphs[1].text,/故予嘗謂/);assert.match(article.paragraphs[1].text,/足以塞/);assert.match(article.paragraphs[1].text,/亦多尤之/);assert.match(article.paragraphs[1].text,/李翰②輩曲為辯說，詎能服人之心/);
 assert.match(q(21).prompt,/記賊人圍城/);assert.match(q(22).prompt,/第一則的引文/);assert.match(article.notes[1],/殉國。時人/);assert.match(article.paragraphs[0].sourceLabel,/資治通鑑/);assert.match(article.paragraphs[1].sourceLabel,/滹南遺老集/);
});
test('four objective questions retain verified C D C B keys, two marks each and independent option reasons',()=>{
 for(const [n,key]of [[21,'C'],[22,'D'],[23,'C'],[24,'B']]){const x=q(n),p=x.answerParts[0],d=C.draft();assert.equal(p.answer,key);assert.equal(p.answerVerified,true);assert.equal(p.marks,2);d.answers.answer=key;assert.equal(C.choiceResult(x,d)[0].score,2);d.answers.answer=key==='A'?'B':'A';assert.equal(C.choiceResult(x,d)[0].score,0);assert.deepEqual(C.gradingItems(x,d,S),[]);for(const option of p.choices){const rows=x.optionAnalysis.filter(r=>r.part==='answer'&&r.value===option.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,option.value===key);assert.ok(rows[0].reason.length>=25);}}
 assert.equal(q(21).quote.split('\n').length,4);assert.equal(q(24).quote.split('\n').length,4);assert.match(q(22).prompt,/不正確/);assert.match(q(21).optionAnalysis.find(r=>r.value==='B').reason,/後來/);assert.match(q(22).optionAnalysis.find(r=>r.value==='D').reason,/未直接/);assert.match(q(23).optionAnalysis.find(r=>r.value==='C').reason,/盡.*責任/);
});
test('question types and hints teach distinct tasks using the right named section',()=>{
 for(const [n,type,section]of [[21,'cause',1],[22,'judgement',1],[23,'classicalWord',2],[24,'technique',2],[25,'meaning',2],[26,'criticism',2]]){assert.equal(q(n).lesson.type,type);assert.ok(q(n).lesson.choices.includes(type));assert.ok(q(n).lesson.prompts.length>=3);assert.deepEqual(C.questionParagraphs(q(n),article),[section]);assert.ok(q(n).lesson.transfer.length>=2);}
 assert.equal(Object.keys(D.types).length,27);assert.equal(q(12).lesson.type,'technique');assert.equal(q(20).marks,7);
});
test('Q25 preserves the two-mark cap for a size-only rebuttal and the common moral standard required for three marks',()=>{
 const criteria=q(25).official[0].criteria.join('');assert.match(criteria,/公.*私/);assert.match(criteria,/事情本身/);assert.match(criteria,/動機.*結果/);assert.match(criteria,/守城小.*食人大.*最高中品2分/);assert.match(criteria,/不是只有一個人/);assert.deepEqual([...new Set(S[q(25).id].answer.map(s=>s.score))].sort(),[0,1,2,3]);
 assert.equal(S[q(25).id].answer.length,8);assert.equal(S[q(25).id].answer.find(s=>s.id.endsWith('middle2-size')).score,2);assert.ok(C.gradingItems(q(25),C.draft(),S).some(s=>s.id.endsWith('middle2-size')));assert.equal(own(25,'我會解釋為公或為私都不能改變殺害無辜這個行為的對錯。').score,null);
});
test('Q26 preserves loyalty versus inhumanity, the two-mark limits, label-only one mark and loyalty-only zero',()=>{
 const criteria=q(26).official[0].criteria.join('');assert.match(criteria,/功不能抵/);assert.match(criteria,/只批不仁.*最高中下品2分/);assert.match(criteria,/功過相當.*最高中下品2分/);assert.match(criteria,/只肯定忠貞.*0分/);assert.match(criteria,/標示.*欠分析.*1分/);
 const rows=S[q(26).id].answer;assert.equal(rows.length,10);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3,4]);assert.equal(rows.find(s=>s.id.endsWith('only-unren2')).score,2);assert.equal(rows.find(s=>s.id.endsWith('labels1')).score,1);assert.equal(rows.find(s=>s.id.endsWith('supplement0')).score,0);assert.equal(own(26,'他們為國盡忠但不仁，忠的功不能抵殺害百姓的罪。').score,null);
});
test('eighteen authentic written exemplars preserve text hashes, source pages and declared scores',()=>{
 const cases=[25,26].flatMap(n=>S[q(n).id].answer);assert.equal(cases.length,18);assert.equal(manifest.longExemplars.length,18);const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/self-study-sample-audit.json')));
 for(const s of cases){const row=manifest.longExemplars.find(r=>r.id===s.id),global=audit.samples.find(r=>r.id===s.id);assert.ok(row&&global);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.equal(global.textSha256,row.textSha256);assert.ok(s.analysis.startsWith(s.score+'分'));}
 const full=cases.find(s=>s.id.endsWith('sampleE4'));assert.ok(full.text.endsWith('因此反對二人的做法。'));assert.doesNotMatch(full.text,/\d$/);assert.match(full.text,/打戰/);assert.equal(full.score,4);
});
test('the conflicting Q26 example follows the final zero-mark version while the briefing discrepancy remains recorded',()=>{
 const row=S[q(26).id].answer.find(s=>s.id.endsWith('zero8'));assert.equal(row.score,0);assert.equal(own(26,row.text).score,0);const resolution=manifest.versionResolutions[0];assert.equal(resolution.finalFile,'mark4.pdf');assert.equal(resolution.finalPage,9);assert.equal(resolution.score,0);assert.equal(resolution.conflictingPage,52);assert.equal(resolution.displayedScore,1);
});
test('reading support keeps the two original notes independent of the optional translation and eighteen teaching glosses',()=>{
 const R=w.window.ReadingCoachReadingSupport;assert.equal(R.sourceNotes(article.notes).length,2);let words=0;
 for(const p of article.paragraphs){assert.ok(p.support.translation.length>=100);assert.ok(p.support.words.length>=8);words+=p.support.words.length;const off=R.sourceHTML(p.text,[],[],p.number,article.notes),on=R.sourceHTML(p.text,[],p.support.words,p.number,article.notes);assert.doesNotMatch(off,/data-reading-word=/);assert.match(off,/data-source-note=/);assert.match(on,/data-reading-word=/);for(const term of p.support.words)assert.ok(on.includes(term.term+'：顯示詞解'));const translation=R.translationHTML(p);assert.doesNotMatch(translation,/classical-glossary/);}
 assert.equal(words,18);for(const a of w.window.SelfStudyAnalysis[article.id])for(const key of ['summary','technique','meaning','structure'])assert.ok(a[key].length>=15);
});
test('existing 2025 and 2024 answers persist and next-question navigation remains within each original passage',()=>{
 assert.equal(C.nextQuestion(D,q(20)),null);assert.equal(C.nextQuestion(D,q(21)).id,q(22).id);assert.equal(C.nextQuestion(D,q(26)),null);
 const saved=C.fresh();saved.questions[q(20).id]={...C.draft(),answers:{i:'緩慢',ii:'放下執着',iii:'保留的繁巷答案'},selfGrades:{ii:1,iii:3},revealed:true,completed:true};saved.questions['dse2024-q23']={...C.draft(),answers:{answer:'保留的2024語譯'},selfGrades:{answer:2}};const restored=C.migrate(saved,null,D.questions);assert.equal(restored.questions[q(20).id].answers.iii,'保留的繁巷答案');assert.equal(restored.questions[q(20).id].completed,true);assert.equal(restored.questions['dse2024-q23'].answers.answer,'保留的2024語譯');assert.equal(restored.questions[q(21).id],undefined);
});
