const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const file of ['dse2013-data','dse2014-data','dse2015-data','dse2016-data','dse2017-data','dse2018-data','dse2019-data','dse2020-data','dse2020-classical-data','dse2021-data','dse2021-classical-data','dse2022-data','dse2022-classical-data','dse2023-data','dse2023-classical-data','dse2024-classical-data','dse2024-data','dse2024-coaching','transfer-data','self-study-samples','self-study-analysis','dse2025-classical-data','dse2025-data','dse2026-data','self-study-data'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),C=require('../dist/self-study-core.js'),q=n=>D.questions.find(x=>x.id==='dse2018-q'+n),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/dse2018-source-manifest.json'))),article=D.articles.find(a=>a.year===2018);
const own=(n,key,text,answers={})=>{const x=q(n),d=C.draft();d.answers={...answers,[key]:text};return C.samples(x,x.answerParts.find(p=>p.key===key),d,S).find(s=>s.own);};

test('2018 retains the complete authentic vernacular passage and original questions 9–20 totaling 50 marks',()=>{
 const qs=D.questions.filter(x=>x.year===2018);assert.deepEqual(qs.map(x=>x.number),Array.from({length:12},(_,i)=>i+9));assert.deepEqual(qs.map(x=>x.marks),[4,2,2,4,4,6,4,6,8,4,4,2]);assert.equal(qs.reduce((n,x)=>n+x.marks,0),50);
 assert.equal(D.articles.filter(a=>a.year===2018).length,1);assert.equal(article.title,'孤獨的理由');assert.equal(article.author,'林黛嫚');assert.deepEqual(article.paragraphs.map(p=>p.number),Array.from({length:20},(_,i)=>i+1));
 assert.match(article.paragraphs[7].text,/妻子離開他，/);assert.match(article.paragraphs[7].text,/車子晃盪四十分鐘/);assert.match(article.paragraphs[7].text,/希冀火車不要誤點/);assert.match(article.paragraphs[10].text,/備妥嫁妝歡鑼喜鼓出嫁/);assert.match(article.paragraphs[15].text,/悠閒地踱步/);
 assert.equal(article.paragraphs[10].text.split('\n').length,1,'source paragraph 11 spans two PDF pages without being split');
 for(const p of article.paragraphs)assert.equal(hash(p.text),manifest.paragraphHashes[article.id].find(a=>a.number===p.number).textSha256);
 for(const x of qs)assert.equal(hash(x.prompt),manifest.questionHashes.find(a=>a.id===x.id).promptSha256);
 assert.equal(C.nextQuestion(D,q(19)).id,q(20).id);assert.equal(C.nextQuestion(D,q(20)),null);
});

test('source proofreading preserves shyness, waiting for a train, full wealth wording and the official objective answers',()=>{
 assert.match(q(10).prompt,/殷實富裕/);assert.match(q(11).prompt,/候車回家/);assert.match(q(15).prompt,/神情靦腆/);assert.doesNotMatch(q(15).prompt,/神情驕傲/);assert.match(q(20).answerParts[0].choices[3].text,/紓解/);
 for(const [n,answers]of [[10,['D']],[11,['C']],[17,['行為描寫','行為描寫','肖像描寫','心理描寫']],[18,['錯誤','正確']],[20,['C']]]){
  const x=q(n),d=C.draft();assert.deepEqual(x.answerParts.map(p=>p.answer),answers);
  for(const p of x.answerParts){assert.equal(p.answerVerified,true);d.answers[p.key]=p.answer;for(const c of p.choices){const rows=x.optionAnalysis.filter(r=>r.part===p.key&&r.value===c.value);assert.equal(rows.length,1);assert.equal(rows[0].correct,c.value===p.answer);assert.ok(rows[0].reason.length>20);}}
  assert.equal(C.choiceResult(x,d).reduce((n,r)=>n+r.score,0),x.marks);assert.deepEqual(C.gradingItems(x,d,S),[]);
 }
 assert.deepEqual(q(11).answerParts[0].choices.map(c=>c.text),['層遞','正襯','反襯','對比']);
 for(const p of q(17).answerParts){assert.ok(q(17).quote.includes('('+p.key+')'),'all four source quotations are present before the answer grid');assert.ok(p.label.length<20,'answer labels do not repeat full quotations');}assert.match(q(17).quote,/他坐在客廳的藤椅上/);assert.match(q(17).quote,/心中沉吟/);
 assert.deepEqual(q(19).promptHighlights,['最主要的理由']);assert.deepEqual(q(20).promptHighlights,['最能說明']);
});

test('Q9 scores both standard boundaries and the two-field partial-credit exception without double counting',()=>{
 for(const [key,text,score]of [['i','7',1],['i','第1至7段',1],['ii','第8至10段',1],['iii','11–12',1],['iii','十一至十三',1],['iv','13',1],['iv','第14至20段',1],['iii','11–14',0],['iv','12',0]])assert.equal(own(9,key,text).score,score,key+' '+text);
 assert.equal(own(9,'i','6').score,0,'the alternative needs both fields');
 for(const end of [7,10,13,20]){
  const answers={i:'6',ii:'7–'+end,iii:'11–12',iv:'13'};
  const results=q(9).answerParts.map(p=>own(9,p.key,answers[p.key],answers));assert.deepEqual(results.map(s=>s.score),[1,0,1,1]);assert.equal(results[0].coupledChecked,true);assert.match(results[1].analysis,/合共只得1分/);
 }
 assert.equal(own(9,'i','6',{ii:'7–21'}).score,0);assert.equal(own(9,'ii','8–10',{i:'6'}).score,1);
 const d=C.draft();assert.deepEqual(C.gradingItems(q(9),d,S),[]);assert.equal(C.gradingReady([],d),false);assert.equal(own(9,'iii','我提出另一種分法').score,null);
});

test('Q12 Q14 and Q16 preserve specific short-answer marks and subject distinctions',()=>{
 for(const [n,key,text,score]of [[12,'i','焦急',2],[12,'i','盼望',2],[12,'i','緊張',1],[12,'i','興奮',0],[12,'i','興奮期待',0],[12,'ii','內心矛盾，無法突破心裡的孤獨感。',2],[12,'ii','因為孤單寂寞。',0],[14,'ii','刻苦耐勞',2],[14,'ii','能幹',1],[14,'ii','有耐心',0],[14,'iii','自尊心重',2],[14,'iii','自尊',1],[14,'iii','獨立',0],[16,'i','同情',2],[16,'i','孤獨',0],[16,'ii','尷尬',2],[16,'ii','緊張',1],[16,'iii','感動',2],[16,'iii','高興',1],[16,'iii','熱淚盈眶',0],[16,'iii','驕傲',0]])assert.equal(own(n,key,text).score,score,n+' '+key+' '+text);
 assert.equal(own(12,'ii','他寧可把祝福留在心裏，也無法踏進人群。').score,null,'unknown wording is left for self-assessment');
});

test('Q14 evaluates the first twenty characters including punctuation without making overflow a zero score',()=>{
 const p=q(14).answerParts[0];assert.equal(p.assessFirstChars,20);assert.equal(p.maxChars,undefined);
 assert.equal(C.answerCharacters('為了弟妹，放棄學業。').length,10);assert.equal(C.assessmentText(p,'一'.repeat(19)+'。後面內容'), '一'.repeat(19)+'。');
 const text='捨棄自己的人生，為爭取弟妹美好的生活努力。';assert.ok(C.answerCharacters(text).length>20);assert.equal(own(14,'i',text+'這些超出的字不參與評閱。').score,2);
 assert.equal(own(14,'i','他掙來的錢全都給予自己的子女。').score,0);assert.match(q(14).official[0].criteria.join(''),/弟妹/);
});

test('2018 true long-answer exemplars cover every 0–4 band and retain alternative full-score approaches',()=>{
 const cases=Object.entries(S).filter(([id])=>id.startsWith('dse2018-')).flatMap(([,parts])=>Object.values(parts).flat());assert.equal(cases.length,18);assert.equal(manifest.longExemplars.length,18);
 for(const s of cases){const row=manifest.longExemplars.find(x=>x.id===s.id);assert.ok(row);assert.equal(row.score,s.score);assert.equal(row.textSha256,hash(s.text));assert.ok(s.analysis.startsWith(s.score+'分'));}
 for(const n of [13,15,19]){const rows=C.samples(q(n),q(n).answerParts[0],C.draft(),S);assert.equal(rows.length,6);assert.deepEqual([...new Set(rows.map(s=>s.score))].sort(),[0,1,2,3,4]);assert.equal(rows.filter(s=>s.score===4).length,2);}
 assert.match(q(13).official[0].criteria.join(''),/只說人生路.*1分.*只說回家路.*不給分/);assert.match(q(15).official[0].criteria.join(''),/其中一個方向.*滿分/);assert.match(q(19).official[0].criteria.join(''),/最高2分/);assert.match(q(19).official[0].criteria.join(''),/不扣冗文分/);
 assert.equal(S[q(15).id].answer.find(s=>s.id.endsWith('-n')).score,0,'a bare communication trait is not automatically awarded a mark');
});

test('adding 2018 preserves drafts, reveals self-assessment only after examples and clears it on revision',()=>{
 const old=C.fresh();old.questions['dse2019-q16']={...C.draft(),type:'evaluation',answers:{answer:'上一年的答案'},completed:true,revealed:true};old.questions['dse2018-q15']={...C.draft(),type:'cause',answers:{answer:'我的獨立分析'},selfGrades:{answer:3},revealed:true};const before=JSON.stringify(old),restored=C.migrate(old,null,D.questions);assert.equal(JSON.stringify(old),before);assert.equal(restored.questions['dse2019-q16'].completed,true);assert.deepEqual(restored.questions['dse2018-q15'].selfGrades,{answer:3});
 const d=restored.questions['dse2018-q15'],items=C.gradingItems(q(15),d,S);assert.equal(items.find(s=>s.own).score,null);assert.equal(C.gradingReady(items,d),false);items.filter(s=>!s.own).forEach(s=>d.grades[s.id]=s.score);assert.equal(C.gradingReady(items,d),true);assert.equal(C.gradingResult(items,d).total,6);C.updateAnswer(d,'answer','重新作答');assert.deepEqual(d.selfGrades,{});assert.equal(d.revealed,false);
});
