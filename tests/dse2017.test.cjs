const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2018-classical-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2017-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2017-source-manifest.json'))),article=D.articles.find(a=>a.year===2017);
const own=(n,key,text,answers={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S).find(s=>s.own);};

test('2017 retains sixteen authentic paragraphs and questions 1–13 with original 57-mark distribution',()=>{
 const qs=D.questions.filter(x=>x.year===2017);assert.deepEqual(qs.map(x=>x.number),Array.from({length:13},(_,i)=>i+1));assert.deepEqual(qs.map(x=>x.marks),[10,5,4,4,2,6,4,4,4,2,6,2,4]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),57);
 assert.equal(D.articles.filter(a=>a.year===2017).length,1);assert.equal(article.title,'跑道');assert.equal(article.author,'劉裘蒂');assert.deepEqual(article.paragraphs.map(p=>p.number),Array.from({length:16},(_,i)=>i+1));
 for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(a=>a.number===p.number).textSha256);
 for(const x of qs)assert.equal(hash(x.prompt),manifest.questionHashes.find(a=>a.id===x.id).promptSha256);
 assert.match(article.paragraphs[7].text,/非洲斑馬/);assert.match(article.paragraphs[9].text,/奔赴的里程/);assert.match(article.paragraphs[10].text,/當風梳理/);assert.doesNotMatch(article.paragraphs[10].text,/當風吹梳理/);assert.match(article.paragraphs[13].text,/替代你跑/);assert.match(article.paragraphs[13].text,/赴跑的路上/);assert.match(article.paragraphs[13].text,/默默地記掛彼此/);assert.match(q(9).prompt,/會否更佳/);
 assert.deepEqual(C.questionParagraphs(q(1),article),Array.from({length:16},(_,i)=>i+1));assert.deepEqual(C.questionParagraphs(q(11),article),[6,7,9,10,14,16]);assert.equal(C.nextQuestion(D,q(12)).id,q(13).id);assert.equal(C.nextQuestion(D,q(13)),null);
});

test('Q1 keeps original table examples and scores segmentation before its dependent summaries',()=>{
 const x=q(1);assert.deepEqual(x.answerParts.map(p=>p.marks),[1,1,1,1,3,3]);assert.match(x.table.rows[0][2],/拋開束縛、身心調和/);assert.match(x.table.rows[2][2],/競奔的體悟/);
 for(const [key,text,score]of [['i','2',1],['ii','3–7',1],['iii','第8至13段',1],['iv','十四',1],['ii','3–8',0],['iv','13',0]])assert.equal(own(1,key,text).score,score);
 for(const [key,pre,correct,wrong]of [['v','ii','3–7','3–8'],['vi','iv','14','13']]){
  const answer='我概括這部分的內容和主題。';
  const missing=own(1,key,answer);assert.equal(missing.score,null);assert.equal(missing.notAssessed,true);assert.match(missing.analysis,/IR/);
  const incorrect=own(1,key,answer,{[pre]:wrong});assert.equal(incorrect.score,0);assert.equal(incorrect.dependencyChecked,true);assert.match(incorrect.analysis,/不給分/);
  const valid=own(1,key,answer,{[pre]:correct});assert.equal(valid.score,null);assert.equal(valid.notAssessed,undefined);assert.equal(valid.dependencyChecked,undefined);
  const pending=own(1,key,answer,{[pre]:'我的另一種分法'});assert.equal(pending.score,null);assert.equal(pending.dependencyPending,true);
 }
 const source=S[x.id].v[0].text;assert.equal(own(1,'v',source,{ii:'3–8'}).score,0,'a full-score exemplar cannot bypass the dependency');assert.equal(own(1,'v',source,{ii:'3–7'}).score,3);assert.equal(own(1,'v',source,{ii:'另一種分法'}).score,null,'matching prose still needs a verified prerequisite');
 const d=C.draft();d.answers={ii:'3–7',v:'我的概括'};d.selfGrades={v:3};d.revealed=true;C.updateAnswer(d,'ii','3–8');assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});

test('Q3 distinguishes missing or wrong referents from the official imprecise-name exception',()=>{
 for(const text of ['交響曲','交響樂','協奏曲'])assert.equal(own(3,'i',text).score,1);
 assert.equal(own(3,'i','西樂器').score,0);assert.equal(own(3,'i','交響樂曲').score,0);
 const answer='兩者的部分都需互相配合，形成規則的節奏。';
 assert.equal(own(3,'ii',answer).notAssessed,true);assert.equal(own(3,'ii',answer,{i:'呼吸'}).notAssessed,true);
 for(const name of ['交響樂','西樂器']){const s=own(3,'ii',answer,{i:name});assert.equal(s.notAssessed,undefined);assert.equal(s.score,null);}
 const unknown=own(3,'ii',answer,{i:'一種合奏樂曲'});assert.equal(unknown.dependencyPending,true);assert.equal(unknown.score,null);
 assert.equal(own(3,'ii',S[q(3).id].ii[0].text,{i:'西樂器'}).score,3,'the second part remains assessable when the name is imprecise');
});

test('Q7 assesses only the first twenty characters including punctuation and preserves external-behaviour distinctions',()=>{
 for(const p of q(7).answerParts){assert.equal(p.assessFirstChars,20);assert.equal(p.maxChars,undefined);}
 assert.equal(C.answerCharacters('保持原有步伐，比男孩子多跑了幾圈。').length,17);
 assert.equal(own(7,'i','不必為走少幾步跑內圈，選跑外圈，保持速度。後面超過字數不評閱。').score,2);
 assert.equal(C.assessmentText(q(7).answerParts[0],'甲。'.repeat(11)),'甲。'.repeat(10));
 for(const [key,text,score]of [['i','退到外圈的跑道，保持一定的速度。',2],['i','相信自己的跑步速度。',0],['ii','保持自己的節奏。',1],['ii','持續跑上好幾圈。',0],['ii','均速跑步，堅持跑。',0],['ii','不以為然，不為所動。',0]])assert.equal(own(7,key,text).score,score);
});

test('official objective keys and every option explanation preserve their source meanings',()=>{
 for(const [n,answers]of [[2,['B']],[4,['正確','錯誤']],[5,['C']],[6,['B','E','C']],[10,['D']],[12,['A']]]){
  const x=q(n),d=C.draft(),ps=x.answerParts.filter(p=>p.kind==='choice');assert.deepEqual(ps.map(p=>p.answer),answers);
  for(const p of ps){assert.equal(p.answerVerified,true);d.answers[p.key]=p.answer;for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===p.answer);assert.ok(rows[0].reason.length>20);}}
  assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),ps.reduce((n,p)=>n+p.marks,0));
 }
 assert.match(q(2).quote,/髮際吮到風的鼻息/);assert.equal(q(2).answerParts[0].choices[3].text,'反復');assert.match(q(10).quote,/從容沉着/);assert.match(q(12).quote,/景致截然不同/);
});

test('forty source-graded exemplars retain score audits, genuine band gaps and two full-score comparison approaches',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2017-')).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,40);assert.equal(manifest.longExemplars.length,40);
 for(const s of cases){const row=manifest.longExemplars.find(x=>x.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const n of [9,13]){const rows=C.samples(q(n),q(n).answerParts[0],C.draft(),S);assert.equal(rows.length,6);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3,4]);assert.equal(rows.filter(s=>s.score===4).length,2);}
 assert.deepEqual(S[q(8).id].answer.map(s=>s.score),[4,2,1,0]);assert.match(q(9).official[0].criteria.join(''),/最高2分/);assert.match(q(13).official[0].criteria.join(''),/最高3分/);assert.match(q(13).official[0].criteria.join(''),/不扣冗文分/);
 for(const n of [1,2,3,11])for(const p of q(n).answerParts.filter(p=>p.kind==='long'))assert.deepEqual([...new Set(S[q(n).id][p.key].map(s=>s.score))].sort(),[0,1,2,3]);
});

test('2017 additions preserve older drafts and defer unknown long-answer scores until example review',()=>{
 const old=C.fresh();old.questions['dse2018-q19']={...C.draft(),type:'cause',answers:{answer:'上一年的答案'},completed:true,revealed:true};const before=JSON.stringify(old),restored=C.migrate(old,null,D.questions);assert.equal(JSON.stringify(old),before);assert.equal(restored.questions['dse2018-q19'].completed,true);
 const d=C.draft();d.answers.answer='我根據兩項跑道特點建立個人比喻。';const items=C.gradingItems(q(13),d,S);assert.equal(items.find(s=>s.own).score,null);assert.equal(C.gradingReady(items,d),false);items.filter(s=>!s.own).forEach(s=>d.grades[s.id]=s.score);assert.equal(C.gradingReady(items,d),true);assert.equal(C.gradingResult(items,d).total,6);d.selfGrades={answer:3};C.updateAnswer(d,'answer','重寫');assert.deepEqual(d.selfGrades,{});
});
