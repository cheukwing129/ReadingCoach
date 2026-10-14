const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2020-data','dse2021-data','dse2022-data','dse2023-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2016-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2016-source-manifest.json'))),article=D.articles.find(a=>a.year===2016);
const own=(n,key,text,answers={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S).find(s=>s.own);};

test('2016 retains all twenty-one original paragraphs and questions 1–12 totaling 51 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2016);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+1));assert.deepEqual(qs.map(x=>x.marks),[6,3,2,4,6,2,8,6,4,4,4,2]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),51);assert.equal(D.articles.filter(a=>a.year===2016).length,1);assert.equal(article.title,'紅心番薯');assert.equal(article.author,'林清玄');assert.deepEqual(article.paragraphs.map(p=>p.number),Array.from({length:21},(_,i)=>i+1));
 for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(a=>a.number===p.number).textSha256);
 for(const x of qs){const h=manifest.questionHashes.find(a=>a.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
 assert.match(article.paragraphs[2].text,/憤憤轉成喃喃/);assert.match(article.paragraphs[8].text,/十燭光/);assert.match(article.paragraphs[11].text,/烤炙/);assert.match(article.paragraphs[12].text,/白瓢/);assert.match(article.paragraphs[16].text,/嗅着泥土/);assert.match(article.paragraphs[20].text,/仔細端凝/);
 assert.deepEqual(C.questionParagraphs(q(1),article),Array.from({length:21},(_,i)=>i+1));assert.equal(C.nextQuestion(D,q(11)).id,q(12).id);assert.equal(C.nextQuestion(D,q(12)),null);
});

test('Q1 accepts the transition paragraph in either part and marks incorrect or omitted third ranges IR',()=>{
 const x=q(1);assert.deepEqual(x.answerParts.map(p=>p.marks),[1,1,1,1,2]);assert.match(x.table.rows[1][2],/憶述往事/);assert.match(x.table.rows[3][2],/抒發作者的感受/);
 for(const [key,text,score]of [['i','3',1],['i','4',1],['ii','4–14',1],['ii','5–14',1],['iii','第15至18段',1],['iv','十九',1],['iii','15–19',0]])assert.equal(own(1,key,text).score,score);
 const answer=S[x.id].v[0].text;
 for(const text of ['', '15–19']){const s=own(1,'v',answer,{iii:text});assert.equal(s.score,null);assert.equal(s.notAssessed,true);assert.match(s.analysis,/IR/);}
 assert.equal(own(1,'v',answer,{iii:'15–18'}).score,2);assert.equal(own(1,'v','我概括番薯特點及作者感情。',{iii:'15–18'}).score,null);assert.equal(own(1,'v',answer,{iii:'我的分段'}).dependencyPending,true);
 assert.match(x.official.at(-1).criteria.join(''),/扣冗文1分/);assert.equal(S[x.id].v.find(s=>s.id.endsWith('-k')).score,1);
});

test('Q2 validates two-character technique names, IR prerequisites and matching example aspects',()=>{
 const action=S[q(2).id].ii.find(s=>s.id.endsWith('-d')).text,appearance=S[q(2).id].ii.find(s=>s.id.endsWith('-a')).text;
 for(const name of ['行為','行動','動作','神態','外貌','肖像','表情','容貌'])assert.equal(own(2,'i',name).score,1);
 for(const name of ['活動','心理','語言','行動描寫']){assert.equal(own(2,'i',name).score,0);assert.equal(own(2,'ii',action,{i:name}).notAssessed,true);}
 assert.equal(own(2,'ii',action).notAssessed,true);assert.equal(own(2,'ii',action,{i:'行動'}).score,2);assert.equal(own(2,'ii',appearance,{i:'表情'}).score,2);
 for(const [answer,name]of [[action,'神態'],[appearance,'動作']]){const s=own(2,'ii',answer,{i:name});assert.equal(s.score,0);assert.equal(s.dependencyChecked,true);assert.match(s.analysis,/不相符/);}
 assert.equal(own(2,'ii',action,{i:'色彩'}).dependencyPending,true);assert.equal(own(2,'ii','父親轉圈仍找不到可種植的地方，因而失望。',{i:'行動'}).score,null,'unmatched prose remains manual');
 assert.deepEqual(S[q(2).id].ii.map(s=>s.score),[2,2,1,0],'source examples retain their original matching-name scores');
 const d=C.draft();d.answers={i:'行動',ii:action};d.selfGrades={ii:2};d.revealed=true;C.updateAnswer(d,'i','神態');assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});

test('all objective answers have source-confirmed keys and a separate explanation for every alternative',()=>{
 for(const [n,answers]of [[3,['B']],[4,['正確','錯誤']],[6,['C']],[8,['B']],[12,['C']]]){const x=q(n),d=C.draft(),ps=x.answerParts.filter(p=>p.kind==='choice');assert.deepEqual(ps.map(p=>p.answer),answers);for(const p of ps){assert.equal(p.answerVerified,true);d.answers[p.key]=p.answer;for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===p.answer);assert.ok(rows[0].reason.length>20);}}assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),ps.reduce((n,p)=>n+p.marks,0));}
 assert.match(q(3).quote,/欣慰/);assert.match(q(6).answerParts[0].choices[2].text,/沒有經歷苦難/);assert.match(q(12).quote,/兩條線索/);
});

test('Q8 assesses explanation independently of its choice and keeps both necessary causal paths',()=>{
 const x=q(8),source=S[x.id].ii[0].text;assert.equal(x.answerParts[1].assessmentDependency,undefined);for(const i of ['','A','B','D']){const s=own(8,'ii',source,{i});assert.equal(s.score,4);assert.equal(s.notAssessed,undefined);}
 assert.equal(own(8,'ii','作者離鄉居大廈且未經戰亂，故難植根和孕育濃厚鄉情。',{i:'A'}).score,null);assert.match(x.official[1].criteria.join(''),/該處境不給分/);assert.deepEqual(S[x.id].ii.map(s=>s.score),[4,2,1,0]);
});

test('Q7, Q9 and Q11 preserve genuine band gaps, paired reasoning and the documented score caps',()=>{
 for(const key of ['i','ii'])assert.deepEqual([...new Set(S[q(7).id][key].map(s=>s.score))].sort(),[0,2,3,4]);assert.match(q(7).official[0].criteria.join(''),/作用只是欠全面/);assert.match(q(7).official[1].criteria.join(''),/不配合/);
 for(const n of [9,11]){const rows=C.samples(q(n),q(n).answerParts[0],C.draft(),S);assert.equal(rows.length,6);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3,4]);assert.equal(rows.filter(s=>s.score===4).length,2);}
 assert.match(q(9).official[0].criteria.join(''),/不涉及主題.*最高3分/);assert.match(q(9).official[0].criteria.join(''),/最高1分/);assert.match(q(9).official[0].criteria.join(''),/不扣/);assert.match(q(11).official[0].criteria.join(''),/缺番薯.*最高3分/);assert.match(q(11).prompt,/一個共同特點/);
});

test('forty original long exemplars are auditable and short metaphors retain the context and behaviour distinction',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2016-')).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,40);assert.equal(manifest.longExemplars.length,40);
 for(const s of cases){const row=manifest.longExemplars.find(x=>x.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const [key,text,score]of [['i','經歷時間的洗禮，對故鄉情不變的人',2],['i','仍然思念故鄉的人',1],['i','思鄉的人',0],['ii','在苦難中，只要心繫故鄉，就能生存下去',2],['ii','在惡劣環境中仍具頑強生命力的人',1],['ii','身世坎坷的人',0]])assert.equal(own(10,key,text).score,score);
});

test('adding 2016 retains existing work and defers unknown long-answer scoring until the examples are reviewed',()=>{
 const old=C.fresh();old.questions['dse2017-q13']={...C.draft(),type:'technique',answers:{answer:'原有跑道比喻'},completed:true,revealed:true};const before=JSON.stringify(old),restored=C.migrate(old,null,D.questions);assert.equal(JSON.stringify(old),before);assert.equal(restored.questions['dse2017-q13'].completed,true);
 const d=C.draft();d.answers.answer='我以兩項父親的事例，推論他希望兒子延續鄉情。';const items=C.gradingItems(q(9),d,S);assert.equal(items.find(s=>s.own).score,null);assert.equal(C.gradingReady(items,d),false);items.filter(s=>!s.own).forEach(s=>d.grades[s.id]=s.score);assert.equal(C.gradingReady(items,d),true);assert.equal(C.gradingResult(items,d).total,6);d.selfGrades={answer:3};C.updateAnswer(d,'answer','重寫');assert.deepEqual(d.selfGrades,{});
});
