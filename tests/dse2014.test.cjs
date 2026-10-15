const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2013-classical-data','dse2014-data','dse2014-classical-data','dse2015-data','dse2015-classical-data','dse2016-data','dse2016-classical-data','dse2017-data','dse2017-classical-data','dse2018-data','dse2018-classical-data','dse2019-data','dse2019-classical-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2014-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2014-source-manifest.json'))),article=D.articles.find(a=>a.id==='dse2014-ninth-taste');
const own=(n,key,text,answers={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S).find(s=>s.own);};

test('2014 retains the complete fourteen-paragraph text and questions 1–12 totaling 54 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2014&&x.number<=12);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+1));assert.deepEqual(qs.map(x=>x.marks),[8,4,2,5,5,10,2,2,2,2,6,6]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),54);assert.deepEqual([article.title,article.author,article.paragraphs.length],['第九味','徐國能',14]);
 assert.deepEqual(article.paragraphs.map(p=>p.number),Array.from({length:14},(_,i)=>i+1));for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(h=>h.number===p.number).textSha256);
 for(const x of qs){const h=manifest.questionHashes.find(h=>h.id===x.id);assert.equal(hash(x.prompt),h.promptSha256);assert.equal(hash(x.quote),h.quoteSha256);}
 assert.match(article.paragraphs[5].text,/當時王謝堂前燕/);assert.match(article.paragraphs[8].text,/一臉肥像/);assert.match(article.paragraphs[8].text,/八臂金鋼/);assert.match(article.paragraphs[13].text,/一啄一飲都是一種寬慰/);assert.equal(manifest.files.some(f=>f.file==='2014-mark2-supplement.pdf'),true);
});

test('Q1 uses the four original two-mark ranges without invented partial-credit exemplars',()=>{
 assert.deepEqual(q(1).answerParts.map(p=>p.marks),[2,2,2,2]);for(const [k,t]of [['i','第1段至第4段'],['ii','五至七'],['iii','8–10'],['iv','11-14']])assert.equal(own(1,k,t).score,2);
 assert.equal(own(1,'i','1–3').score,0);assert.equal(own(1,'ii','5–8').score,0);assert.equal(own(1,'ii','另一分法').score,null);assert.deepEqual(C.gradingItems(q(1),C.draft(),S),[]);
});

test('Q2 assesses only the first twenty characters including punctuation and keeps authentic summary distinctions',()=>{
 for(const p of q(2).answerParts){assert.equal(p.assessFirstChars,20);assert.equal(p.maxChars,undefined);assert.equal(C.assessmentText(p,'一'.repeat(19)+'。超出部分不評'), '一'.repeat(19)+'。');}
 assert.equal(C.answerCharacters(' 地位崇高，享負盛名。 ').length,10);assert.equal(own(2,'i','地位崇高，享負盛名。').score,2);assert.equal(own(2,'i','地位崇高，只喫菜嚐菜。').score,1);assert.equal(own(2,'ii','人生逆境。').score,0);
 assert.equal(own(2,'i','我先概括人物地位與名氣，再補充例子及其他細節，超出首二十字的部分不評閱。').score,null);assert.match(q(2).official[0].criteria.join(''),/不予評閱.*並非整題0分/);assert.match(q(2).official[0].criteria.join(''),/不可錯配/);
});

test('Q3 accepts both orders and does not award two marks for two names of the same direct-description category',()=>{
 for(const [a,b]of [['行動','語言'],['說話','動作'],['言語','行為']]){assert.equal(own(3,'i',a,{ii:b}).score,1);assert.equal(own(3,'ii',b,{i:a}).score,1);}
 for(const [a,b]of [['行動','動作'],['語言','說話']]){assert.equal(own(3,'i',a,{ii:b}).score,1);assert.equal(own(3,'ii',b,{i:a}).score,0);assert.match(own(3,'ii',b,{i:a}).analysis,/描寫方面/);}
 assert.equal(own(3,'i','神態').score,0);assert.equal(own(3,'i','動作描寫').score,0);assert.equal(own(3,'i','另一').score,null);assert.match(q(3).distinctAnswerGroups.note,/描寫方面/);
});

test('Q4 implements the revised and supplemental prerequisite rules without treating all zero names alike',()=>{
 const rows=S[q(4).id].ii,drink=rows.find(s=>s.id.endsWith('full-drink')).text,status=rows.find(s=>s.id.endsWith('full-status')).text,action=rows.find(s=>s.id.endsWith('action-full')).text;
 assert.equal(own(4,'i','襯托').score,2);assert.equal(own(4,'i','對比').score,1);assert.equal(own(4,'i','行動描寫').score,0);
 assert.equal(own(4,'ii',drink,{i:'反襯'}).score,3);assert.equal(own(4,'ii',drink,{i:'正襯'}).score,2);assert.equal(own(4,'ii',status,{i:'正襯'}).score,3);assert.equal(own(4,'ii',status,{i:'反襯'}).score,2);
 assert.equal(own(4,'ii',action,{i:'行動描寫'}).score,3);assert.equal(own(4,'ii',action,{i:'肖像描寫'}).score,0);assert.equal(own(4,'ii',action).score,0);assert.equal(own(4,'ii',action,{i:'心理描寫'}).score,0);assert.equal(own(4,'ii',action,{i:'另一名稱'}).dependencyPending,true);
 assert.match(q(4).official[1].criteria.join(''),/負面特點.*杜撰/);assert.match(q(4).official[1].criteria.join(''),/油汗如雨.*不能/);
 const d=C.draft();d.answers={i:'正襯',ii:status};d.grades={x:3};d.selfGrades={ii:3};d.revealed=true;C.updateAnswer(d,'i','反襯');assert.deepEqual(d.grades,{});assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});

test('Q5 and Q6 distinguish missing prerequisites, imprecise zero words and corresponding explanations',()=>{
 const self=S[q(5).id].ii.find(s=>s.id.endsWith('full-self')).text;assert.equal(own(5,'ii',self,{i:'自重'}).score,3);assert.equal(own(5,'ii',self,{i:'傲然特立'}).score,0);assert.equal(own(5,'ii',self).score,0);assert.equal(own(5,'ii',self,{i:'孤高'}).dependencyPending,true);assert.equal(own(5,'ii',self,{i:'孤高'}).score,null);
 assert.equal(own(5,'i','果斷').score,1);assert.equal(own(5,'i','公私分明').score,2);
 for(const [k,pre,t]of [['ii','i','平常人'],['iv','iii','隱士']]){const example=S[q(6).id][k][0].text;assert.equal(own(6,k,example,{[pre]:t}).score,3);assert.equal(own(6,k,example).score,0);assert.equal(own(6,k,example,{[pre]:'老人'}).score,null);assert.equal(own(6,k,example,{[pre]:'新類型'}).dependencyPending,true);}
 assert.equal(own(6,'iii','君子').score,1);assert.equal(own(6,'iii','隱士').score,2);assert.equal(own(6,'i','沒有理想的凡人').score,1);
 const wrong=S[q(6).id].iv.find(s=>s.id.endsWith('zero-literal'));assert.equal(wrong.score,0);assert.match(wrong.analysis,/淡泊名利/);assert.match(q(6).official[3].criteria.join(''),/只抄苦味而欠人物特質0分/);
});

test('Q8 checks the two-character rewrite and preserves full, partial and zero source answers',()=>{
 for(const [text,score]of [['慌亂',2],['慌忙',2],['忙亂',2],['驚慌',1],['混亂',1],['不安',0],['忙碌',0],['非常慌亂',0]])assert.equal(own(8,'answer',text).score,score);
 assert.equal(own(8,'answer','慌張').score,null);assert.deepEqual(q(8).quoteHighlights,['雞飛狗跳']);
});

test('all three objective questions keep the officially scanned keys with independent explanations for every option',()=>{
 for(const [n,answer]of [[7,'B'],[9,'C'],[10,'D']]){const x=q(n),p=x.answerParts[0],d=C.draft();assert.equal(p.answer,answer);assert.equal(p.answerVerified,true);d.answers.answer=answer;assert.equal(C.choiceResult(x,d)[0].score,2);assert.deepEqual(C.gradingItems(x,d,S),[]);for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===answer);assert.ok(rows[0].reason.length>20);}}
});

test('six-mark explanations retain every source band and judge the reasoning rather than keyword labels',()=>{
 assert.match(q(11).official[0].criteria.join(''),/最高中品3–4分/);assert.match(q(12).official[0].criteria.join(''),/兩個世事滄桑例子/);assert.match(q(12).official[0].criteria.join(''),/評品不宜只看關鍵詞/);
 for(const n of [11,12])assert.deepEqual([...new Set(S[q(n).id].answer.map(s=>s.score))].sort(),[0,1,2,3,4,5,6]);
 assert.equal(C.samples(q(11),q(11).answerParts[0],C.draft(),S).length,8);assert.equal(C.samples(q(12),q(12).answerParts[0],C.draft(),S).length,9);assert.equal(S[q(12).id].answer.find(s=>s.id.endsWith('full-life')).score,6);assert.equal(S[q(11).id].answer.find(s=>s.id.endsWith('middle4')).score,4);
});

test('forty-eight authentic long exemplars retain their exact text, source page and score audit',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2014-')&&+id.split('-q')[1]<=12).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,48);assert.equal(manifest.longExemplars.length,48);
 for(const s of cases){const row=manifest.longExemplars.find(r=>r.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const n of [4,5,6])for(const p of q(n).answerParts.filter(p=>p.kind==='long'))assert.deepEqual([...new Set(S[q(n).id][p.key].map(s=>s.score))].sort(),[0,1,2,3]);
 assert.equal(manifest.contextualExemplarScores.find(r=>r.prerequisite==='反襯').score,2);
 for(const n of [4,5])for(const s of S[q(n).id].ii)assert.ok(s.prerequisiteText,'dependent example must show its original first answer');
});

test('unknown answers retain manual assessment and adding 2014 preserves earlier saved work and article boundaries',()=>{
 const d=C.draft();d.answers.answer='我會從父親的回應理解人生觀，再以曾先生的起伏解釋態度。';const items=C.gradingItems(q(11),d,S);assert.equal(items.find(s=>s.own).score,null);assert.equal(C.gradingReady(items,d),false);for(const s of items.filter(s=>!s.own))d.grades[s.id]=s.score;assert.equal(C.gradingReady(items,d),true);assert.equal(C.nextQuestion(D,q(11)).id,q(12).id);assert.equal(C.nextQuestion(D,q(12)),null);
 const saved=C.fresh();saved.questions['dse2015-q7']={...C.draft(),answers:{i:'光芒、顏色'},completed:true};const before=JSON.stringify(saved),restored=C.migrate(saved,null,D.questions);assert.equal(JSON.stringify(saved),before);assert.equal(restored.questions['dse2015-q7'].completed,true);assert.equal(restored.questions['dse2015-q7'].answers.i,'光芒、顏色');assert.deepEqual(C.questionParagraphs(q(6),article),[6]);
});
