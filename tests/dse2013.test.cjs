const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2017-classical-data','dse2018-data','dse2018-classical-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2013-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2013-source-manifest.json'))),articles=D.articles.filter(a=>a.year===2013);
const own=(n,key,text,answers={},prior={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S,prior).find(s=>s.own);};
const context=value=>({'dse2013-q9':{...C.draft(),answers:{answer:value}}});

test('2013 contains both complete original texts, nineteen paragraphs and questions 1–12 totaling 59 marks',()=>{
 assert.deepEqual(articles.map(a=>[a.title,a.author,a.paragraphs.length]),[['我交給你們一個孩子','張曉風',12],['說誓','黃國彬',7]]);
 const qs=D.questions.filter(x=>x.year===2013);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+1));assert.deepEqual(qs.map(x=>x.marks),[12,4,4,6,4,4,6,2,2,4,6,5]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),59);assert.equal(qs.filter(x=>x.exerciseId===articles[0].id).reduce((n,x)=>n+x.marks,0),40);
 for(const a of articles){assert.deepEqual(a.paragraphs.map(p=>p.number),Array.from({length:a.paragraphs.length},(_,i)=>i+1));for(const p of a.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[a.id].find(h=>h.number===p.number).textSha256);}
 for(const x of qs){const h=manifest.questionHashes.find(h=>h.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
 assert.equal(articles[0].paragraphs[9].text.split('〈尋人啟事〉\n\n')[1].split('\n').length,17);assert.match(articles[0].paragraphs[5].text,/撰述者/);assert.match(articles[0].paragraphs[7].text,/也請帶他/);assert.match(articles[0].paragraphs[10].text,/小手有如飛鳥/);assert.match(articles[1].paragraphs[2].text,/以賓虛的氣勢/);assert.match(articles[1].paragraphs[4].text,/率爾鼓匹夫之勇/);assert.match(articles[1].paragraphs[5].text,/有一本小說/);
});

test('Q1 assesses missing segmentation but gives the corresponding summary zero for an incorrect range',()=>{
 assert.deepEqual(q(1).answerParts.map(p=>p.marks),[1,1,1,3,3,3]);for(const [k,t]of [['i','1–6'],['ii','七至九'],['iii','第10至11段']])assert.equal(own(1,k,t).score,1);
 for(const [key,pre,range]of [['iv','ii','7–9'],['v','iii','10–11']]){const text=S[q(1).id][key].find(s=>s.score===3).text;assert.equal(own(1,key,text,{[pre]:range}).score,3);assert.equal(own(1,key,text).score,3);assert.equal(own(1,key,text,{[pre]:'1–2'}).score,0);assert.equal(own(1,key,text,{[pre]:'另一分法'}).dependencyPending,true);assert.equal(own(1,key,text,{[pre]:'1–2'}).notAssessed,undefined);}
 assert.equal(q(1).table.rows[0][1],'(1)：第___段');assert.equal(q(1).answerParts.slice(0,3).every(p=>p.referenceOnly),true);assert.equal(S[q(1).id].vi.find(s=>s.id.endsWith('partial1')).score,1);
});

test('Q2 distinguishes noun, value and information content rather than automatically accepting adjectives or channels',()=>{
 for(const [k,t,v]of [['i','正確的價值觀',2],['i','教人忠信正直的資訊或知識',2],['i','正面的資訊',1],['i','善良的',0],['i','知識傳遞渠道，如電郵報紙等',0],['ii','令人變得奸詐邪惡的資訊或知識',2],['ii','不好的道理',1],['ii','古往今來的撰述者',0]])assert.equal(own(2,k,t).score,v);
 assert.equal(own(2,'i','我以自己的文字解釋有益的知識。').score,null);assert.ok(q(2).answerParts.every(p=>!p.exactChars&&!p.maxChars));
});

test('objective keys and every option explanation follow the official answer sheet including both true Q6 statements',()=>{
 for(const [n,keys]of [[3,['B','D']],[5,['D','E']],[6,['正確','正確']],[8,['D']],[9,['A']]]){const x=q(n),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.answer),keys);for(const p of x.answerParts){d.answers[p.key]=p.answer;assert.equal(p.answerVerified,true);for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===p.answer);assert.ok(rows[0].reason.length>20);}}assert.ok(C.choiceResult(x,d).every(r=>r.score===2));assert.deepEqual(C.gradingItems(x,d,S),[]);}
 assert.equal(q(3).answerParts[0].choices[3].text,'前句較為輕快，後句較為平穩。');assert.match(q(5).optionAnalysis.find(r=>r.part==='ii'&&r.value==='C').reason,/國中少年/);
});

test('Q4 and Q7 preserve all authentic 0–6 bands, including the audited two-mark moderation script',()=>{
 for(const n of [4,7])assert.deepEqual([...new Set(S[q(n).id].answer.map(s=>s.score))].sort(),[0,1,2,3,4,5,6]);
 const j=S[q(4).id].answer.find(s=>s.id.endsWith('sampleJ2'));assert.equal(j.score,2);const audit=manifest.longExemplars.find(s=>s.id===j.id);assert.equal(audit.file,'2013-sample-gj.pdf');assert.equal(audit.page,6);assert.ok(manifest.files.some(f=>f.file==='2013-score1.pdf'));assert.match(q(4).official[0].criteria.join(''),/母親身份.*節奏或語調/);
 assert.match(q(7).official[0].criteria.join(''),/愛猶不及惟恐失之/);assert.equal(S[q(4).id].answer.filter(s=>s.score===6).length,2);
});

test('Q10 accepts content after A or B, caps mismatched methods, and applies zero only to the wrong method actually selected',()=>{
 const rows=S[q(10).id].answer,a=rows.find(s=>s.id.endsWith('full4-association')).text,b=rows.find(s=>s.id.endsWith('full4-echo')).text,c=rows.find(s=>s.id.endsWith('zero-layer')).text,opposed=rows.find(s=>s.id.endsWith('zero-contrast')).text;
 assert.equal(own(10,'answer',a,{},context('A')).score,4);assert.equal(own(10,'answer',b,{},context('B')).score,4);
 const d=C.draft();d.answers.answer='B';assert.equal(C.choiceResult(q(9),d)[0].score,0);
 for(const [text,choice,score]of [[a,'B',2],[b,'A',2],[a,'C',2],[a,'D',2],[c,'C',0],[opposed,'D',0]]){const result=own(10,'answer',text,{},context(choice));assert.equal(result.score,score);assert.equal(result.dependencyChecked,true);}
 assert.equal(own(10,'answer',a).score,null);assert.equal(own(10,'answer',a).dependencyPending,true);assert.equal(own(10,'answer','我會用自己的文字說兩段聯想的運作。',{},context('D')).score,null);
 const custom=JSON.parse(JSON.stringify(S));custom[q(10).id].answer.find(s=>s.id.endsWith('full4-association')).explainedMethods=['A','B'];d.answers.answer=a;const multi=C.samples(q(10),q(10).answerParts[0],d,custom,context('A')).find(s=>s.own);assert.equal(multi.score,2);
});

test('Q10 source practice grades stay independent of the student previous choice and retain original method context',()=>{
 const d=C.draft();const before=JSON.stringify(S[q(10).id]);for(const selected of ['A','B','C','D','']){const items=C.gradingItems(q(10),d,S,context(selected));for(const s of items)assert.equal(s.score,S[q(10).id].answer.find(x=>x.id===s.id).score);assert.ok(items.every(s=>s.prerequisiteText));}
 assert.equal(JSON.stringify(S[q(10).id]),before);assert.equal(C.gradingItems(q(10),d,S).length,7);
});

test('changing Q9 invalidates Q10 grading and completion while preserving its answer, note and unrelated saved work',()=>{
 const state=C.fresh();state.questions[q(9).id]={...C.draft(),answers:{answer:'A'},revealed:true,completed:true};state.questions[q(10).id]={...C.draft(),answers:{answer:'保留自己的扣連說明'},grades:{x:4},selfGrades:{answer:4},revealed:true,completed:true,note:'下次核對手法',type:'technique',step:3};state.questions['dse2014-q1']={...C.draft(),answers:{i:'1–4'},completed:true};const old=JSON.stringify(state.questions['dse2014-q1']);
 C.updateQuestionAnswer(state,q(9),'answer','A',D.questions);assert.equal(state.questions[q(10).id].completed,true);
 C.updateQuestionAnswer(state,q(9),'answer','B',D.questions);const linked=state.questions[q(10).id];assert.equal(linked.answers.answer,'保留自己的扣連說明');assert.equal(linked.note,'下次核對手法');assert.equal(linked.type,'technique');assert.deepEqual(linked.grades,{});assert.deepEqual(linked.selfGrades,{});assert.equal(linked.revealed,false);assert.equal(linked.completed,false);assert.equal(JSON.stringify(state.questions['dse2014-q1']),old);
 const restored=C.migrate(state,null,D.questions);assert.equal(restored.questions[q(10).id].answers.answer,linked.answers.answer);assert.equal(restored.questions['dse2014-q1'].completed,true);
});

test('Q11 retains two original matrices, three independent two-mark parts and no invented character restriction',()=>{
 assert.equal(q(11).table,null);assert.deepEqual(q(11).tables,[{headers:['金屬的特質','凡夫的特質'],rows:[['易熱易冷','(1)']]},{headers:['金屬的特質','英雄的特質'],rows:[['(2)','(3)']]}]);assert.deepEqual(q(11).answerParts.map(p=>p.marks),[2,2,2]);assert.equal(q(11).answerParts[1].exactChars,undefined);
 for(const [text,score]of [['堅',2],['堅硬不變形',2],['耐熱',1],['熱而堅硬',1],['固',0],['耐冷',0],['可靠的',0]])assert.equal(own(11,'ii',text).score,score);
 for(const k of ['i','iii']){assert.deepEqual([...new Set(S[q(11).id][k].map(s=>s.score))].sort(),[0,1,2]);assert.match(q(11).official.find(o=>o.key===k).criteria.join(''),/誓言態度/);}
 assert.deepEqual(C.questionParagraphs(q(11),articles[1]),[5]);
});

test('Q12 preserves the complete 2+1+2 rubric and actual source component exemplars without inventing full-answer bands',()=>{
 assert.equal(q(12).marks,5);assert.equal(q(12).answerParts.length,1);assert.deepEqual([...new Set(S[q(12).id].answer.map(s=>s.score))].sort(),[0,1,2]);assert.equal(S[q(12).id].answer.length,9);assert.equal(C.gradingItems(q(12),C.draft(),S).length,9);
 const rows=S[q(12).id].answer;assert.equal(rows.find(s=>s.id.endsWith('others-full')).score,1);assert.equal(rows.find(s=>s.id.endsWith('others-zero')).score,0);assert.equal(rows.find(s=>s.id.endsWith('self-full')).score,2);assert.equal(rows.find(s=>s.id.endsWith('self-zero')).score,0);assert.equal(rows.find(s=>s.id.endsWith('self-extra')).score,1);
 assert.match(manifest.q12ExemplarScope,/不拼接/);assert.match(q(12).official[0].criteria.join(''),/2＋1＋2/);assert.match(q(12).official[0].criteria.join(''),/不當冗文/);assert.equal(own(12,'answer','我會完整說明諷刺不守信、觀行而信、自知慎誓三層。').score,null);
});

test('fifty-one authentic written exemplars preserve source pages, text hashes and original scores',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2013-')).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,51);assert.equal(manifest.longExemplars.length,51);
 for(const s of cases){const row=manifest.longExemplars.find(r=>r.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const x of D.questions.filter(x=>x.year===2013))for(const p of x.answerParts.filter(p=>p.kind!=='choice'&&!p.referenceOnly))assert.ok(C.samples(x,p,C.draft(),S).length>=4);
});

test('nineteen distinct four-part analyses preserve paragraph numbers and independent article navigation',()=>{
 for(const a of articles){const rows=w.window.SelfStudyAnalysis[a.id];assert.deepEqual(Array.from(rows,r=>r.number),a.paragraphs.map(p=>p.number));for(const r of rows)for(const key of ['summary','technique','meaning','structure'])assert.ok(r[key].length>=15);}
 assert.equal(C.nextQuestion(D,q(6)).id,q(7).id);assert.equal(C.nextQuestion(D,q(7)),null);assert.equal(C.nextQuestion(D,q(11)).id,q(12).id);assert.equal(C.nextQuestion(D,q(12)),null);assert.equal(D.articles.length,31);assert.equal(D.questions.length,216);
});
