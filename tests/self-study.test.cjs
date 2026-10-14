const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../dist/self-study-core.js');const root=path.resolve(__dirname,'..');
function load(){const c={window:{}};vm.createContext(c);for(const f of ['dse2013-data.js','dse2014-data.js','dse2015-data.js','dse2016-data.js','dse2017-data.js','dse2018-data.js','dse2018-classical-data.js','dse2019-data.js','dse2019-classical-data.js','dse2020-data.js','dse2020-classical-data.js','dse2021-data.js','dse2021-classical-data.js','dse2022-data.js','dse2022-classical-data.js','dse2023-data.js','dse2023-classical-data.js','dse2024-classical-data.js','dse2024-data.js','dse2024-coaching.js','transfer-data.js','self-study-samples.js','self-study-analysis.js','dse2025-classical-data.js','dse2025-data.js','dse2026-data.js','self-study-data.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',f),'utf8'),c);return JSON.parse(JSON.stringify(c.window));}
const w=load(),D=w.SelfStudyData,S=w.SELF_STUDY_SAMPLES,q=id=>D.questions.find(q=>q.id===id);
test('thirty verified articles retain the original paragraph numbers and exact source text',()=>{assert.equal(D.articles.length,30);assert.equal(D.questions.length,208);const sources=[...w.COACH_DSE2018_CLASSICAL_DATA.passages,...w.COACH_DSE2019_CLASSICAL_DATA.passages,...w.COACH_DSE2020_CLASSICAL_DATA.passages,...w.COACH_DSE2021_CLASSICAL_DATA.passages,...w.COACH_DSE2022_CLASSICAL_DATA.passages,...w.COACH_DSE2023_CLASSICAL_DATA.passages,...w.COACH_DSE2024_CLASSICAL_DATA.passages,...w.COACH_DSE2025_CLASSICAL_DATA.passages,...w.COACH_DSE2013_DATA.passages,...w.COACH_DSE2014_DATA.passages,...w.COACH_DSE2015_DATA.passages,...w.COACH_DSE2016_DATA.passages,...w.COACH_DSE2017_DATA.passages,...w.COACH_DSE2018_DATA.passages,...w.COACH_DSE2019_DATA.passages,...w.COACH_DSE2020_DATA.passages,...w.COACH_DSE2021_DATA.passages,...w.COACH_DSE2022_DATA.passages,...w.COACH_DSE2023_DATA.passages,...w.COACH_DSE2026_DATA.passages,...w.COACH_EXAM_DATA.passages,...w.COACH_TRANSFER_DATA.passages];for(const p of D.articles){assert.deepEqual(p.paragraphs.map(x=>x.number),sources.find(x=>x.id===p.id).paragraphs.map((_,i)=>i+1));assert.deepEqual(p.paragraphs.map(x=>x.text),sources.find(x=>x.id===p.id).paragraphs);}assert.equal(D.articles.find(x=>x.id==='dse2025-alley').paragraphs[8].text.split('\n').length,7);});
test('every real question has classification, non-answer hints, relevant paragraph locations and transferable methods',()=>{for(const x of D.questions){const l=x.lesson;assert.ok(l.choices.includes(l.type),x.id);assert.equal(new Set(l.choices).size,l.choices.length);assert.ok(l.choices.every(t=>D.types[t]));assert.ok(l.prompts.length>=2);assert.ok(l.transfer.length>=2);assert.ok(l.review.length);assert.ok(l.locate.every(n=>D.articles.find(p=>p.id===x.exerciseId).paragraphs.some(a=>a.number===n)));}assert.doesNotMatch(q('dse2024-q15').lesson.prompts.join(''),/象徵希望|頑強|困頓|勇氣|決心/);assert.match(D.types.technique.note,/本體與喻體/);assert.match(D.types.quote.note,/所有關鍵元素/);});
test('authentic written examples cover supported marks; reference-only ranges do not manufacture samples',()=>{for(const x of D.questions)for(const p of x.answerParts.filter(p=>p.kind!=='choice')){const items=C.samples(x,p,C.draft(),S);if(p.referenceOnly){assert.deepEqual(items,[]);continue;}assert.ok(items.length>=(x.id==='dse2018-q26'&&p.key==='ii'?2:4),x.id+'/'+p.key);assert.ok(items.every(s=>C.validScore(s.score,p.marks)&&s.analysis.length>10),x.id+'/'+p.key);assert.equal(new Set(items.map(s=>C.normalize(s.text))).size,items.length);if(p.marks===4&&x.id==='dse2018-q26')assert.deepEqual([...new Set(items.map(s=>s.score))],[4]);else if(p.marks===4)assert.deepEqual([...new Set(items.map(s=>s.score))].sort(),x.id==='dse2016-q7'?[0,2,3,4]:['dse2016-q8','dse2017-q8'].includes(x.id)?[0,1,2,4]:[0,1,2,3,4]);}});
test('short own answer merges once with a selected exemplar and preserves its known score',()=>{const x=q('dse2024-q17'),p=x.answerParts[0],d=C.draft(),sample=C.samples(x,p,d,S).find(s=>s.score===2);d.answers.answer=' '+sample.text+'。 ';const items=C.samples(x,p,d,S);assert.equal(items.filter(s=>C.normalize(s.text)===C.normalize(sample.text)).length,1);assert.equal(items.find(s=>s.own).score,2);assert.equal(items.find(s=>s.own).merged,true);});
test('a matching answer outside the displayed selection is recognized without text duplication',()=>{const x=q('dse2024-q17'),p=x.answerParts[0],d=C.draft();d.answers.answer='積極';const items=C.samples(x,p,d,S);assert.equal(items.filter(s=>s.text==='積極').length,1);assert.equal(items.find(s=>s.own).score,2);});
test('unknown free responses are included but never assigned a semantic score',()=>{const x=q('dse2024-q15'),p=x.answerParts[0],d=C.draft();d.answers.answer='光是一種人生夢想，所有人都會成功。';const items=C.samples(x,p,d,S);assert.equal(items.length,6);assert.equal(items.find(s=>s.own).score,null);items.forEach(s=>d.grades[s.id]=4);const result=C.gradingResult(items,d);assert.equal(result.total,5);assert.equal(result.correct,1);});
test('two-character restrictions are checked without rating unknown two-character meaning',()=>{const x=q('dse2024-q17'),p=x.answerParts[0],d=C.draft();d.answers.answer='十分樂觀';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,0);d.answers.answer='不屈';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,null);});
test('grading stays locked until all samples have valid scores for their own part',()=>{const x=q('dse2024-q13'),d=C.draft(),items=C.gradingItems(x,d,S);assert.equal(C.gradingReady(items,d),false);items.forEach(s=>d.grades[s.id]=0);assert.equal(C.gradingReady(items,d),true);const one=items.find(s=>s.outOf===1);d.grades[one.id]=2;assert.equal(C.gradingReady(items,d),false);d.grades[one.id]=NaN;assert.equal(C.gradingReady(items,d),false);});
test('sample ordering is stable and does not reveal an ascending mark order',()=>{for(const x of D.questions)for(const p of x.answerParts.filter(p=>p.marks===4)){const a=C.samples(x,p,C.draft(),S);assert.deepEqual(a,C.samples(x,p,C.draft(),S));assert.notDeepEqual(a.map(s=>s.score),[0,1,2,3,4]);}});
test('editing any answer invalidates revealed marks, sample reviews and completion',()=>{const d=C.draft();Object.assign(d,{answers:{answer:'舊答'},revealed:true,completed:true,grades:{a:2},selfChecks:[0],reviewed:['a']});C.updateAnswer(d,'answer','新答');assert.equal(d.revealed,false);assert.equal(d.completed,false);assert.deepEqual(d.grades,{});assert.deepEqual(d.selfChecks,[]);assert.deepEqual(d.reviewed,[]);});
test('legacy answers and first attempts migrate without altering or consuming the old data',()=>{const legacy={drafts:{'dse2024-q17':{fields:{answer:'堅毅'},firstAttempt:{fields:{answer:'堅持'}}},'dse2025-q12':{fields:{},free:'以前的學生答案'},'lamp-purpose':{free:'已退役'}}},before=JSON.stringify(legacy);const state=C.migrate(null,legacy,D.questions);assert.equal(state.questions['dse2024-q17'].answers.answer,'堅毅');assert.equal(state.questions['dse2024-q17'].answerHistory[0].fields.answer,'堅持');assert.equal(state.questions['dse2025-q12'].answers.answer,'以前的學生答案');assert.equal(state.questions['lamp-purpose'],undefined);assert.equal(JSON.stringify(legacy),before);});
test('restore ignores foreign questions and bounds persisted values',()=>{const saved={version:1,questions:{fake:{},'dse2024-q17':{step:10,type:'trait',answers:{answer:'堅毅',fake:'x'},grades:{bad:99,nan:'2',valid:2},note:'a',reviewed:['b']}}};const s=C.migrate(saved,null,D.questions);assert.equal(s.questions.fake,undefined);assert.equal(s.questions['dse2024-q17'].step,3);assert.deepEqual(s.questions['dse2024-q17'].answers,{answer:'堅毅'});assert.deepEqual(s.questions['dse2024-q17'].grades,{valid:2});});
test('next-question navigation stays within the same year and article, including the final question',()=>{for(const x of D.questions){const next=C.nextQuestion(D,x);if(next){assert.equal(next.exerciseId,x.exerciseId);assert.equal(next.year,x.year);assert.ok(next.number>x.number);}else{const qs=D.questions.filter(z=>z.exerciseId===x.exerciseId);assert.equal(x.number,Math.max(...qs.map(z=>z.number)));}}assert.equal(C.nextQuestion(D,q('dse2025-q13')).number,14);});
test('choice results use actual correct options and remain separate from self-assessed marks',()=>{const x=q('dse2024-q12'),d=C.draft();d.answers={i:'D',ii:'A'};assert.deepEqual(C.choiceResult(x,d).map(r=>r.score),[1,1]);d.answers.ii='D';assert.deepEqual(C.choiceResult(x,d).map(r=>r.score),[1,0]);assert.deepEqual(C.gradingItems(x,d,S),[]);});
test('retired teacher/export/source UI is not loaded by either public entry',()=>{for(const f of ['index.html','dist/index.html']){const html=fs.readFileSync(path.join(root,f),'utf8');assert.doesNotMatch(html,/academy-|dist\/app\.js|src="app\.js|dist\/data\.js|src="data\.js|真題管理|教師|匯出|來源|出處/);}assert.equal(C.escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');});
test('all 573 long graded exemplars have an internal file-and-page audit and concrete score analyses',()=>{const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/self-study-sample-audit.json')));const cases=Object.values(S).flatMap(parts=>Object.values(parts).flat());assert.equal(cases.length,573);for(const s of cases){const row=audit.samples.find(a=>a.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,require('node:crypto').createHash('sha256').update(s.text).digest('hex'));assert.ok(s.analysis.includes(s.score+'分'));}});
test('all 256 source paragraphs have one distinct four-part reading analysis',()=>{
 let total=0;for(const p of D.articles){const rows=w.SelfStudyAnalysis[p.id];assert.deepEqual(rows.map(a=>a.number),p.paragraphs.map(a=>a.number));assert.equal(new Set(rows.map(a=>a.number)).size,rows.length);for(const a of rows)for(const key of ['summary','technique','meaning','structure'])assert.ok(typeof a[key]==='string'&&a[key].length>=15,p.id+'/'+a.number+'/'+key);total+=rows.length;}assert.equal(total,256);
 assert.match(w.SelfStudyAnalysis['dse2025-alley'][8].technique,/七行.*同一原文段落/);
 assert.match(w.SelfStudyAnalysis['dse2024-fansheng'][10].meaning,/撐開.*小小/);
 assert.match(w.SelfStudyAnalysis['dse2026-voice'][5].meaning,/預想/);
});
test('every classification option has its own concrete identifying feature',()=>{
 const features=Object.values(D.types).map(t=>t.feature);assert.equal(features.length,30);assert.equal(new Set(features).size,30);for(const x of D.questions)for(const type of x.lesson.choices)assert.ok(D.types[type].feature.length>=20);assert.match(D.types.summary.feature,/中心内容|中心內容/);assert.match(D.types.segmentation.feature,/劃分/);assert.match(D.types.technique.feature,/手法/);
});
test('auto-location reads paragraph numbers in prompts, quotes, table cells and subquestions',()=>{
 const p=D.articles.find(p=>p.id==='dse2024-fansheng');
 assert.deepEqual(C.questionParagraphs(q('dse2024-q15'),p),[11]);assert.deepEqual(C.questionParagraphs(q('dse2024-q12'),p),[4,5]);assert.deepEqual(C.questionParagraphs(q('dse2024-q11'),p),[7,4]);assert.deepEqual(C.questionParagraphs(q('dse2024-q17'),p),[14]);assert.deepEqual(C.questionParagraphs(q('dse2024-q20'),p),[15]);
 const alley=D.articles.find(p=>p.id==='dse2025-alley');assert.deepEqual(C.questionParagraphs(q('dse2025-q20'),alley),[9,10]);
});
test('paragraph references support ranges, Chinese numbers and valid fallback without renumbering',()=>{
 const p=D.articles.find(p=>p.id==='dse2024-fansheng');
 assert.deepEqual(C.questionParagraphs({prompt:'第3至6段及第十一段；第14、15段；第99段',answerParts:[]},p),[3,4,5,6,11,14,15]);
 assert.deepEqual(C.questionParagraphs({prompt:'第十段及最後一段',answerParts:[]},p),[10,15]);
 assert.deepEqual(C.questionParagraphs({prompt:'綜合全文',answerParts:[],lesson:{locate:[99,6,3]}},p),[6]);
});
test('revealed analyses can complete without any sample-read confirmations',()=>{
 const d=C.draft();assert.equal(C.canComplete(d),false);d.revealed=true;assert.deepEqual(d.reviewed,[]);assert.equal(C.canComplete(d),true);C.updateAnswer(d,'answer','修改');assert.equal(C.canComplete(d),false);
 const app=fs.readFileSync(path.join(root,'dist/self-study-app.js'),'utf8');assert.doesNotMatch(app,/data-reviewed|我明白這份答案的評閱重點|勾選你已明白/);
});
test('2022 contains exactly the two vernacular passages and all original questions 7–17, totaling 41 marks',()=>{
 const articles=D.articles.filter(a=>a.year===2022&&a.genre!=='classical'),questions=D.questions.filter(q=>q.year===2022&&q.number<=17);
 assert.deepEqual(articles.map(a=>[a.title,a.author,a.paragraphs.length]),[['一個人和三個人稱','周國平',4],['每個人都是一個宇宙','周國平',6]]);
 assert.deepEqual(questions.map(q=>q.number),[7,8,9,10,11,12,13,14,15,16,17]);assert.equal(questions.reduce((n,q)=>n+q.marks,0),41);
 assert.deepEqual(questions.map(q=>q.marks),[6,2,4,4,3,4,4,4,2,4,4]);assert.equal(articles[1].paragraphs[3].text.split('\n\n')[1].split('\n').length,15);
 assert.match(articles[1].paragraphs[3].text,/朋友，親戚，時日/);assert.match(articles[0].paragraphs[2].text,/他們只是在依據/);assert.match(articles[1].paragraphs[2].text,/你誠然不能脫離社會/);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2022-source-manifest.json')));for(const a of articles)for(const p of a.paragraphs)assert.equal(require('node:crypto').createHash('sha256').update(p.text).digest('hex'),manifest.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);
});
test('2022 short-answer marks retain concept distinctions, noun requirements and four-character format',()=>{
 const seven=q('dse2022-q7'),twelve=q('dse2022-q12');
 for(const [key,text,score]of [['i','社會的標準',2],['i','別人眼中的自己',1],['i','社會外在因素',0],['ii','既主觀又客觀',1],['iii','人生的方向',0]])assert.equal(C.pool(seven,seven.answerParts.find(p=>p.key===key),S).find(s=>s.text===text).score,score);
 assert.equal(C.pool(twelve,twelve.answerParts[0],S).find(s=>s.text==='應珍惜獨立自主的人格').score,1);
 assert.equal(C.pool(twelve,twelve.answerParts[1],S).find(s=>s.text==='精神崩潰的人').score,1);
 const eight=q('dse2022-q8'),d=C.draft(),p=eight.answerParts[0];d.answers.i='自以為是';assert.equal(C.samples(eight,p,d,S).filter(s=>s.own).length,1);assert.equal(C.samples(eight,p,d,S).find(s=>s.own).score,1);
 d.answers.i='十分自我中心';assert.equal(C.samples(eight,p,d,S).find(s=>s.own).score,0);assert.match(C.samples(eight,p,d,S).find(s=>s.own).analysis,/四個字/);
 d.answers.i='自負自傲';assert.equal(C.samples(eight,p,d,S).find(s=>s.own).score,null);
});
test('2022 objective questions use the real keys and give a reason for every option',()=>{
 for(const [id,answers]of [['dse2022-q9',['錯誤','正確']],['dse2022-q13',['錯誤','正確']],['dse2022-q15',['A']],['dse2022-q16',['暗喻','暗喻','三者皆非','借喻']]]){
  const x=q(id);assert.deepEqual(x.answerParts.map(p=>p.answer),answers);for(const p of x.answerParts)for(const o of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===o.value);assert.equal(rows.length,1);assert.ok(rows[0].reason.length>=20);}
 }
 assert.deepEqual(S['dse2022-q11'].answer.map(s=>s.score),[3,2,1,0]);
 assert.match(q('dse2022-q10').official[0].criteria.join(''),/完全沒提及不足，最高2分/);assert.match(q('dse2022-q17').official[0].criteria.join(''),/質量互補/);
});
test('cross-passage question 17 has explicit same-year reading targets without mixing equal paragraph numbers',()=>{
 const x=q('dse2022-q17'),first=D.articles.find(p=>p.id==='dse2022-pronouns'),second=D.articles.find(p=>p.id==='dse2022-universe');
 assert.equal(x.exerciseId,second.id);assert.equal(x.readingArticleId,first.id);assert.deepEqual(C.questionParagraphs(x,first),[4,2,3]);assert.deepEqual(C.questionParagraphs(x,second),[6]);
 for(const id of Object.keys(x.readingReferences))assert.equal(D.articles.find(p=>p.id===id).year,x.year);
 assert.equal(C.nextQuestion(D,x),null);
});

test('own answers never block revealing exemplar marks or enter grading accuracy',()=>{
 const x=q('dse2024-q17'),d=C.draft();d.answers.answer='堅毅';const items=C.gradingItems(x,d,S),own=items.find(s=>s.own);assert.ok(own);
 for(const s of items.filter(s=>!s.own))d.grades[s.id]=s.score;
 assert.equal(C.gradingReady(items,d),true);assert.equal(d.grades[own.id],undefined);assert.deepEqual(C.gradingResult(items,d),{correct:items.length-1,total:items.length-1});
});
test('self-assessment restores per-part valid marks and resets after revision',()=>{
 const id='dse2024-q13',s=C.migrate({version:1,questions:{[id]:{answers:{i:'對比',ii:'效果'},selfGrades:{i:1,ii:5,foreign:2}}}},null,D.questions);
 assert.deepEqual(s.questions[id].selfGrades,{i:1});C.updateAnswer(s.questions[id],'ii','修改效果');assert.deepEqual(s.questions[id].selfGrades,{});
});

test('2023 retains both original vernacular passages, paragraphs 5 and 12, and questions 9–19 totaling 40 marks',()=>{
 const articles=D.articles.filter(a=>a.year===2023&&a.genre!=='classical'),questions=D.questions.filter(q=>q.year===2023&&q.number<=19);
 assert.deepEqual(articles.map(a=>[a.title,a.author,a.paragraphs.length]),[['我們去唱歌','陳列',5],['一竿冷','簡媜',12]]);
 assert.deepEqual(questions.map(q=>q.number),[9,10,11,12,13,14,15,16,17,18,19]);assert.deepEqual(questions.map(q=>q.marks),[2,6,3,4,2,4,4,6,2,4,3]);assert.equal(questions.reduce((n,q)=>n+q.marks,0),40);
 assert.match(articles[1].paragraphs[0].text,/獨釣寒江雪。\n\n我常想/);assert.match(articles[1].paragraphs[2].text,/教導它們水的涵意/);
 assert.match(q('dse2023-q15').table.rows[2][0],/遂在中途/);assert.deepEqual(q('dse2023-q15').answerParts.map(p=>p.marks),[2,2]);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2023-source-manifest.json')));for(const a of articles)for(const p of a.paragraphs)assert.equal(require('node:crypto').createHash('sha256').update(p.text).digest('hex'),manifest.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);
 assert.equal(manifest.longExemplars.length,23);
});
test('2023 uses the actual objective keys, complete judgement statement, and independently explained options',()=>{
 for(const [id,answers]of [['dse2023-q9',['D']],['dse2023-q13',['A']],['dse2023-q16',['C','B','D']],['dse2023-q17',['A']]]){
  const x=q(id);assert.deepEqual(x.answerParts.map(p=>p.answer),answers);for(const p of x.answerParts)for(const o of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===o.value);assert.equal(rows.length,1);assert.ok(rows[0].reason.length>=20);}
 }
 assert.equal(q('dse2023-q13').quote,'這篇文章沒有直接的抒情或說理，讀者須自行體會作者的情懷。');
 assert.deepEqual(S['dse2023-q11'].answer.map(s=>s.score),[3,2,1,0]);assert.deepEqual(S['dse2023-q19'].answer.map(s=>s.score),[3,2,1,0]);
 const cold=articles=>articles.find(a=>a.id==='dse2023-cold');assert.deepEqual(C.questionParagraphs(q('dse2023-q16'),cold(D.articles)),[2,8,10]);
});
test('2023 preserves partial-credit distinctions, character format and the one-clause 3-mark pathway',()=>{
 const cases=[['dse2023-q10','i','寂靜',2],['dse2023-q10','i','荒蕪',1],['dse2023-q10','i','清幽',0],['dse2023-q14','i','流動',2],['dse2023-q14','i','不斷前進',1],['dse2023-q14','ii','成全滄海',0],['dse2023-q15','i','不懼怕自然災害。',0],['dse2023-q15','ii','不會耽溺，不論負載了誰都不允許他們在水中停留。',1]];
 for(const [id,key,text,score]of cases){const x=q(id),p=x.answerParts.find(p=>p.key===key);assert.equal(C.pool(x,p,S).find(s=>s.text===text).score,score);}
 const x=q('dse2023-q10'),p=x.answerParts[0],d=C.draft();d.answers.i='冷清';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,2);d.answers.i='十分冷清';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,0);
 assert.match(q('dse2023-q18').official[0].criteria.join(''),/一句具體飽滿可3分/);assert.match(q('dse2023-q18').official[0].criteria.join(''),/最高2分/);
 assert.doesNotMatch(q('dse2023-q16').lesson.prompts.join(''),/借喻：|油脂喻|對比：|D用典/);
});

test('2021 retains both vernacular texts, the four-line poem and all questions 8–16 totaling 41 marks',()=>{
 const articles=D.articles.filter(a=>a.year===2021&&a.genre!=='classical'),questions=D.questions.filter(q=>q.year===2021&&q.number<=16);
 assert.deepEqual(articles.map(a=>[a.title,a.author,a.paragraphs.length]),[['橘子','芥川龍之介（文潔若譯）',8],['火車和橘子','徐國能',8]]);
 assert.deepEqual(questions.map(q=>q.number),[8,9,10,11,12,13,14,15,16]);assert.deepEqual(questions.map(q=>q.marks),[2,8,7,6,2,2,4,6,4]);assert.equal(questions.reduce((n,q)=>n+q.marks,0),41);
 assert.match(articles[0].paragraphs[1].text,/站台的廊柱/);assert.match(articles[0].paragraphs[4].text,/劃破黑暗襲來/);assert.match(articles[1].paragraphs[0].text,/面容慘澹/);
 assert.equal(articles[1].paragraphs[5].text.split('\n\n')[1].split('\n').length,4);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2021-source-manifest.json')));for(const a of articles)for(const p of a.paragraphs)assert.equal(require('node:crypto').createHash('sha256').update(p.text).digest('hex'),manifest.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);assert.equal(manifest.longExemplars.length,19);
});
test('2021 objective keys, original Q13 pairs and mixed judgement/writing marks remain independent',()=>{
 for(const [id,answers]of [['dse2021-q8',['B']],['dse2021-q10',['正確','正確']],['dse2021-q12',['C']],['dse2021-q13',['B']],['dse2021-q15',['肖像描寫','行動描寫','三者皆非']]]){
  const x=q(id);assert.deepEqual(x.answerParts.filter(p=>p.kind==='choice').map(p=>p.answer),answers);for(const p of x.answerParts.filter(p=>p.kind==='choice'))for(const o of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===o.value);assert.equal(rows.length,1);assert.ok(rows[0].reason.length>=20);}
 }
 assert.equal(q('dse2021-q13').answerParts[0].choices[2].text,'(2)、(3)');assert.equal(q('dse2021-q8').answerParts[0].choices[2].text,'(2)、(4)');
 assert.match(q('dse2021-q15').prompt,/又還是三種描寫手法都沒有運用/);assert.match(q('dse2021-q15').answerParts[2].label,/摔壞/);
 const x=q('dse2021-q10'),d=C.draft();d.answers={'i-1':'正確','i-2':'錯誤',ii:'自由答案'};assert.deepEqual(C.choiceResult(x,d).map(r=>r.score),[2,0]);assert.ok(C.gradingItems(x,d,S).every(s=>s.key==='ii'));assert.deepEqual(S[x.id].ii.map(s=>s.score),[3,2,1,0]);
});
test('2021 four-character limits allow shorter terms, preserve partial credit and reject overlong matched answers',()=>{
 const cases=[['dse2021-q9','i','拘謹',2],['dse2021-q9','i','骯髒',1],['dse2021-q9','ii','鄙視',2],['dse2021-q9','ii','不快',0],['dse2021-q9','iii','堅毅',2],['dse2021-q9','iii','倔強',0],['dse2021-q9','iv','肅然起敬',2],['dse2021-q9','iv','喜悅',0],['dse2021-q11','i','冷漠',2],['dse2021-q11','i','以貌取人',1]];
 for(const [id,key,text,score]of cases){const x=q(id),p=x.answerParts.find(p=>p.key===key),d=C.draft();assert.equal(p.maxChars,4);assert.equal(p.exactChars,undefined);d.answers[key]=text;assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,score);}
 const x=q('dse2021-q9'),p=x.answerParts[0],d=C.draft();d.answers.i='十分小心翼翼';let own=C.samples(x,p,d,S).find(s=>s.own);assert.equal(own.score,0);assert.match(own.analysis,/不多於四個字/);d.answers.i='謹小慎微';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,null);
 const invalid={...x,official:[{key:'i',answers:['十分小心翼翼'],examples:[]}]};d.answers.i='十分小心翼翼';assert.equal(C.samples(invalid,p,d,{}).find(s=>s.own).score,0);
});
test('2021 cross-text references keep paragraph numbers separate and retain the single-theme three-mark pathway',()=>{
 const first=D.articles.find(p=>p.id==='dse2021-orange'),second=D.articles.find(p=>p.id==='dse2021-train');
 assert.deepEqual(C.questionParagraphs(q('dse2021-q15'),first),[3,5]);assert.deepEqual(C.questionParagraphs(q('dse2021-q15'),second),[4]);assert.equal(q('dse2021-q15').readingArticleId,first.id);
 assert.deepEqual(C.questionParagraphs(q('dse2021-q16'),first),[6,7,8]);assert.deepEqual(C.questionParagraphs(q('dse2021-q16'),second),[8,4,6,7]);assert.match(q('dse2021-q16').official[0].criteria.join(''),/只一篇準確而飽滿3分/);
 assert.deepEqual(S['dse2021-q16'].answer.map(s=>s.score),[4,3,2,1,0]);assert.equal(S['dse2021-q16'].answer.find(s=>s.score===3).id,'dse2021-q16-answer-s7');assert.match(q('dse2021-q11').official[1].criteria.join(''),/沒有對比.*不能得分/);assert.match(q('dse2021-q14').official[0].criteria.join(''),/完全沒有詩歌內容或意象不得分/);
});

test('2020 retains the thirteen original paragraphs, footnote and complete questions 8–17 totaling 45 marks',()=>{
 const articles=D.articles.filter(a=>a.year===2020&&a.genre!=='classical'),questions=D.questions.filter(q=>q.year===2020&&q.number<=17),a=articles[0];
 assert.equal(articles.length,1);assert.equal(a.title,'夢中的父親');assert.equal(a.author,'利格拉樂．阿𡠄');assert.equal(a.paragraphs.length,13);assert.match(a.notes[0],/長壽：香菸牌子/);
 assert.deepEqual(questions.map(q=>q.number),[8,9,10,11,12,13,14,15,16,17]);assert.deepEqual(questions.map(q=>q.marks),[9,4,4,6,4,2,4,2,4,6]);assert.equal(questions.reduce((n,q)=>n+q.marks,0),45);
 assert.match(a.paragraphs[6].text,/父親出現在縹緲裏/);assert.match(a.paragraphs[7].text,/紀念日只剩下二個/);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2020-source-manifest.json')));for(const p of a.paragraphs)assert.equal(require('node:crypto').createHash('sha256').update(p.text).digest('hex'),manifest.paragraphHashes[a.id].find(x=>x.number===p.number).textSha256);assert.equal(manifest.longExemplars.length,32);
 assert.equal(require('node:crypto').createHash('sha256').update(q('dse2020-q17').quote).digest('hex'),manifest.comparisonQuoteSha256);assert.match(q('dse2020-q17').quote,/大江的/);assert.match(q('dse2020-q17').quote,/澗溪赴海料無還/);assert.match(q('dse2020-q17').quote,/月魄在天終不死/);assert.doesNotMatch(q('dse2020-q17').quote,/潤溪|月晦|大海的/);
});
test('2020 segmentation uses source ranges without inventing scored alternatives and accepts both boundary arrangements',()=>{
 const x=q('dse2020-q8');assert.deepEqual(x.answerParts.map(p=>p.marks),[1,1,1,3,3]);
 for(const [key,text,score]of [['i','2',1],['i','第1至2段',1],['i','三',0],['ii','3至7',1],['ii','第3段至第8段',1],['ii','3–6',0],['iii','8',1],['iii','九',1],['iii','第9至12段',1],['iii','7',0]]){
  const p=x.answerParts.find(p=>p.key===key),d=C.draft();assert.equal(p.referenceOnly,true);assert.deepEqual(C.pool(x,p,S),[]);d.answers[key]=text;assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,score);
 }
 assert.equal(C.segmentScore(x.answerParts[1],'我想用另一種分法'),null);assert.deepEqual(S[x.id].iv.map(s=>s.score),[3,2,2,0]);assert.deepEqual(S[x.id].v.map(s=>s.score),[3,2,1,0]);
});
test('2020 20-character assessment includes punctuation and ignores excess without applying an automatic zero',()=>{
 const x=q('dse2020-q13'),p=x.answerParts[0],d=C.draft(),answer='找老家的親戚想送父親的骨灰回去卻被拒絕。';assert.equal(C.answerCharacters(answer).length,20);assert.equal(p.maxChars,undefined);assert.equal(p.assessFirstChars,20);
 d.answers.answer=answer+'其後文字不評閱。';const own=C.samples(x,p,d,S).find(s=>s.own);assert.equal(own.score,2);assert.equal(own.text,d.answers.answer);assert.equal(C.assessmentText(p,d.answers.answer),answer);
 assert.equal(C.assessmentText(p,'甲。'.repeat(11)),'甲。'.repeat(10));assert.equal(C.answerCharacters('𡠄。').length,2);
 d.answers.answer='我尚未完成這項說明。'.repeat(4)+'因故鄉親友反對，只能葬於異鄉。';assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,null);assert.doesNotMatch(C.assessmentText(p,d.answers.answer),/只能葬於異鄉/);
 for(const [text,score]of [['因親友反對，只能葬於異鄉。',1],['死後骨灰也不能回到老家。',1],['死後都不能回到自己的家。',0]]){d.answers.answer=text;assert.equal(C.samples(x,p,d,S).find(s=>s.own).score,score);}
});
test('2020 objective keys and the two original comparison-writing boxes remain independent',()=>{
 for(const [id,answers]of [['dse2020-q9',['C','D']],['dse2020-q11',['D']],['dse2020-q14',['正確','錯誤']],['dse2020-q15',['B']],['dse2020-q17',['落葉歸根處','心之所安處']]]){
  const x=q(id);assert.deepEqual(x.answerParts.filter(p=>p.kind==='choice').map(p=>p.answer),answers);for(const p of x.answerParts.filter(p=>p.kind==='choice'))for(const o of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===o.value);assert.equal(rows.length,1);assert.ok(rows[0].reason.length>=20);}
 }
 const x=q('dse2020-q11'),d=C.draft();assert.deepEqual(x.answerParts.map(p=>[p.key,p.marks]),[['i',2],['ii-1',2],['ii-2',2]]);assert.match(x.answerParts[1].label,/①原因不同/);assert.match(x.answerParts[2].label,/②感覺相同/);assert.deepEqual([...new Set(C.gradingItems(x,d,S).map(s=>s.key))],['ii-1','ii-2']);assert.match(x.official[1].criteria.join(''),/只寫父親或只寫作者.*不得分/);
});
test('2020 comparative exemplars show both valid four-mark stances and preserve theme and feeling boundaries',()=>{
 const x=q('dse2020-q17'),items=C.samples(x,x.answerParts[2],C.draft(),S);assert.equal(items.length,6);assert.equal(items.filter(s=>s.score===4).length,2);assert.ok(items.some(s=>s.score===4&&s.text.startsWith('兩文對故鄉的看法有矛盾')));assert.ok(items.some(s=>s.score===4&&s.text.includes('並沒有矛盾')));assert.match(x.official[2].criteria.join(''),/單篇論述.*0分/);
 assert.match(q('dse2020-q16').official[0].criteria.join(''),/最高2分/);assert.match(q('dse2020-q16').official[0].criteria.join(''),/不按「是／否」單獨給分/);
 const twelve=q('dse2020-q12');for(const [key,text,score]of [['i','原來現世關於父親的紀念日只剩兩個。',0],['i','為不再拜祭父親而愧疚。',0],['ii','自責。',1],['ii','為父親骨灰無法送回鄉而感疑惑。',0]])assert.equal(C.pool(twelve,twelve.answerParts.find(p=>p.key===key),S).find(s=>s.text===text).score,score);
});
