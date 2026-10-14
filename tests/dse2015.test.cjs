const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2020-data','dse2021-data','dse2022-data','dse2023-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2015-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2015-source-manifest.json'))),first=D.articles.find(a=>a.id==='dse2015-interest'),second=D.articles.find(a=>a.id==='dse2015-gravel');
const own=(n,key,text,answers={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S).find(s=>s.own);};

test('2015 retains both complete vernacular texts and all original questions 1–11 totaling 53 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2015);assert.deepEqual(qs.map(x=>x.number),Array.from({length:11},(_,i)=>i+1));assert.deepEqual(qs.map(x=>x.marks),[9,6,2,3,4,6,6,2,6,3,6]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),53);assert.deepEqual([first,second].map(a=>[a.title,a.author,a.paragraphs.length]),[['論趣','林語堂',7],['觀沙礫記','賈平凹',5]]);
 for(const a of [first,second]){assert.deepEqual(a.paragraphs.map(p=>p.number),Array.from({length:a.paragraphs.length},(_,i)=>i+1));for(const p of a.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[a.id].find(h=>h.number===p.number).textSha256);}
 for(const x of qs){const h=manifest.questionHashes.find(h=>h.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
 assert.match(first.paragraphs[3].text,/袁中郎/);assert.doesNotMatch(first.paragraphs[3].text,/袁中甫/);assert.match(first.notes[0],/佣金/);assert.match(second.paragraphs[2].text,/反復揣摩/);assert.match(second.paragraphs[3].text,/沙礫本是無情/);
});

test('Q1 gives zero for incorrect summary ranges and IR for omitted ranges without confusing the 2016 rule',()=>{
 assert.deepEqual(q(1).answerParts.map(p=>p.marks),[1,1,1,3,3]);assert.match(q(1).table.rows[0][2],/名利色權/);
 for(const [key,text]of [['i','1–3'],['ii','第4至5段'],['iii','六至七']])assert.equal(own(1,key,text).score,1);
 for(const [key,pre,range]of [['iv','ii','4–5'],['v','iii','6–7']]){const text=S[q(1).id][key][0].text;assert.equal(own(1,key,text,{[pre]:range}).score,3);assert.equal(own(1,key,text,{[pre]:'4–7'}).score,0);assert.equal(own(1,key,text).notAssessed,true);assert.equal(own(1,key,text,{[pre]:'另一分法'}).dependencyPending,true);}
});

test('Q5 allocates one comparison bonus for matched levels, never for individually correct but mismatched terms',()=>{
 for(const [a,b]of q(5).pairedAnswers.accepted){assert.equal(own(5,'ii-a',a,{'ii-b':b}).score,2);assert.equal(own(5,'ii-b',b,{'ii-a':a}).score,1);}
 for(const [a,b]of [['科學','感性'],['理性','興趣'],['學問','藝術']])assert.equal(own(5,'ii-a',a,{'ii-b':b}).score+own(5,'ii-b',b,{'ii-a':a}).score,2);
 assert.equal(own(5,'ii-a','科學').score,1);assert.equal(own(5,'ii-a','科學知識',{'ii-b':'藝術'}).score,0);assert.equal(own(5,'ii-b','理性',{'ii-a':'理性'}).score,0);assert.equal(own(5,'i','好奇心').score,1);assert.equal(own(5,'i','求知欲').score,0);
 const d=C.draft();d.answers={'ii-a':'科學','ii-b':'藝術'};d.selfGrades={'ii-a':2};d.revealed=true;C.updateAnswer(d,'ii-b','感性');assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});

test('Q7 checks all sixteen combinations per row, accepts both fire answers and awards only complete two-mark sets',()=>{
 const x=q(7);assert.equal(C.gradingItems(x,C.draft(),S).length,0);assert.match(x.prompt,/分題全對才給分/);
 for(const p of x.answerParts){assert.equal(p.multiple,true);assert.equal(p.marks,2);for(let mask=0;mask<16;mask++){const values=p.choices.filter((_,i)=>mask&(1<<i)).map(c=>c.value),d=C.draft();d.answers[p.key]=values.join('、');const expected=p.acceptedAnswers.some(set=>set.length===values.length&&set.every(v=>values.includes(v)));assert.equal(C.choiceResult(x,d).find(r=>r.key===p.key).score,expected?2:0,p.key+'/'+mask);}}
 const d=C.draft();d.answers={i:'顏色、光芒',ii:'光芒、顏色',iii:'形狀、光芒'};assert.deepEqual(C.choiceResult(x,d).map(r=>r.score),[2,2,2]);d.answers.i='光芒、顏色、形狀';assert.equal(C.choiceResult(x,d)[0].score,2);d.answers.i+='、紋理';assert.equal(C.choiceResult(x,d)[0].score,0);assert.equal(C.choiceStatus(x.answerParts[0],'形狀'),'optional');assert.equal(C.choiceStatus(x.answerParts[0],'光芒'),'required');assert.equal(C.choiceStatus(x.answerParts[0],'紋理'),'excluded');
});

test('all ordinary objective alternatives retain the official keys and their independent explanations',()=>{
 for(const [n,answers]of [[2,['正確','正確','錯誤']],[3,['D']],[8,['A']]]){const x=q(n),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.answer),answers);for(const p of x.answerParts){d.answers[p.key]=p.answer;assert.equal(p.answerVerified,true);for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.ok(rows[0].reason.length>20);assert.equal(rows[0].correct,c.value===p.answer);}}assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),x.marks);}
 assert.match(q(3).quote,/權高天下/);assert.match(q(8).quote,/紋理/);for(const p of q(7).answerParts)for(const c of p.choices)assert.equal(q(7).optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value).length,1);
});

test('Q9 still assesses examples after missing or incomplete principles but makes known incorrect principles zero',()=>{
 const x=q(9),example=S[x.id].ii[0].text;assert.equal(own(9,'ii',example).score,3);assert.equal(own(9,'ii',example).notAssessed,undefined);
 for(const score of [1,2,3]){const principle=S[x.id].i.find(s=>s.score===score).text;assert.equal(own(9,'ii',example,{i:principle}).score,3);}
 const wrong=S[x.id].i.find(s=>s.score===0).text;assert.equal(own(9,'ii',example,{i:wrong}).score,0);assert.equal(own(9,'ii',example,{i:'我的另一種概括'}).dependencyPending,true);assert.equal(own(9,'ii','新例子按原文道理逐項檢查。').score,null);
 assert.match(x.official[1].criteria.join(''),/三文魚仍屬魚/);assert.match(x.official[1].criteria.join(''),/最高2分/);assert.match(x.official[1].criteria.join(''),/最高1分/);assert.equal(S[x.id].ii.find(s=>s.id.endsWith('-lobster')).score,1);
});

test('long-answer criteria keep the source misconceptions, three-mark reasons and six-mark comparison boundaries',()=>{
 assert.match(q(4).official[0].criteria.join(''),/誤解微微一笑.*全題0分/);assert.match(q(6).official[1].criteria.join(''),/褒義.*全欄0分/);assert.match(q(10).official[0].criteria.join(''),/兩方向擇一/);assert.match(q(11).official[0].criteria.join(''),/一個角度/);assert.match(q(11).official[0].criteria.join(''),/1–2分/);assert.match(q(11).official[0].criteria.join(''),/3–4分/);
 const rows=C.samples(q(11),q(11).answerParts[0],C.draft(),S);assert.equal(rows.length,8);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3,4,5,6]);assert.equal(rows.filter(s=>s.score===6).length,2);
});

test('forty original graded long exemplars retain their page and score audit without fabricated answers',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2015-')).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,40);assert.equal(manifest.longExemplars.length,40);
 for(const s of cases){const row=manifest.longExemplars.find(r=>r.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const n of [1,4,6,9,10])for(const p of q(n).answerParts.filter(p=>p.kind==='long'))assert.deepEqual([...new Set(S[q(n).id][p.key].map(s=>s.score))].sort(),[0,1,2,3]);
});

test('cross-text reading keeps separate original paragraph numbers and next-question navigation stays within each article',()=>{
 assert.deepEqual(C.questionParagraphs(q(11),first),[4,5,6,7]);assert.deepEqual(C.questionParagraphs(q(11),second),[3,4,5]);assert.equal(C.nextQuestion(D,q(6)),null);assert.equal(C.nextQuestion(D,q(10)).id,q(11).id);assert.equal(C.nextQuestion(D,q(11)),null);
 const old=C.fresh();old.questions['dse2016-q2']={...C.draft(),answers:{i:'神態',ii:'原有答案'},completed:true};old.questions[q(7).id]={...C.draft(),answers:{i:'光芒、顏色',ii:'光芒、顏色',iii:'光芒、形狀'},revealed:true};const before=JSON.stringify(old),saved=C.migrate(old,null,D.questions);assert.equal(JSON.stringify(old),before);assert.equal(saved.questions['dse2016-q2'].completed,true);assert.deepEqual(C.choiceResult(q(7),saved.questions[q(7).id]).map(r=>r.score),[2,2,2]);
});

test('unknown six-mark comparison answers wait for exemplar review and remain self-assessed',()=>{
 const d=C.draft();d.answers.answer='兩篇都尊重個性，須提供適切條件，我再分別引用兩文說明。';const items=C.gradingItems(q(11),d,S);assert.equal(items.find(s=>s.own).score,null);assert.equal(C.gradingReady(items,d),false);items.filter(s=>!s.own).forEach(s=>d.grades[s.id]=s.score);assert.equal(C.gradingReady(items,d),true);assert.equal(C.gradingResult(items,d).total,8);d.selfGrades={answer:6};C.updateAnswer(d,'answer','重新回答');assert.deepEqual(d.selfGrades,{});
});
