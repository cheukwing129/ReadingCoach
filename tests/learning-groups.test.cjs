const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../dist/self-study-core.js'),root=path.resolve(__dirname,'..'),w={window:{}};vm.createContext(w);
for(const m of fs.readFileSync(path.join(root,'dist/index.html'),'utf8').matchAll(/src="([^"?]+)/g))if(/data|coaching|samples|analysis/.test(m[1]))vm.runInContext(fs.readFileSync(path.join(root,'dist',m[1]),'utf8'),w);
const D=JSON.parse(JSON.stringify(w.window.SelfStudyData)),S=JSON.parse(JSON.stringify(w.window.SELF_STUDY_SAMPLES)),q=id=>D.questions.find(x=>x.id===id);

test('curated learning groups cover every original part once and retain all marks and table answer cells',()=>{
 const grouped=D.questions.filter(x=>x.learningGroups);assert.equal(grouped.length,26);
 for(const x of grouped){
  assert.deepEqual(x.learningGroups.flatMap(g=>g.keys).sort(),x.answerParts.map(p=>p.key).sort(),x.id);
  assert.equal(x.learningGroups.reduce((sum,g)=>sum+x.answerParts.filter(p=>g.keys.includes(p.key)).reduce((n,p)=>n+p.marks,0),0),x.marks,x.id);
  for(const g of x.learningGroups){assert.ok(g.keys.every(k=>g.answerKeys.includes(k)),x.id);assert.ok(g.answerKeys.every(k=>x.answerParts.some(p=>p.key===k)),x.id);if(x.tableAnswerCells)assert.equal(g.answerKeys.length,x.answerParts.length,x.id+' keeps full table');}
 }
 assert.equal(q('dse2024-q11').learningGroups,undefined);assert.equal(q('dse2015-q11').learningGroups,undefined);assert.equal(q('dse2026-q26').learningGroups,undefined);
});
test('five-word practice retains completed words and scores while later words are answered, including after reload',()=>{
 const x=q('dse2013-q13'),d=C.draft();d.type=x.lesson.type;
 assert.equal(C.learningGroup(x,d).id,'i');assert.equal(C.completeLearningGroup(x,d),false);
 C.updateAnswer(d,'i','高興',x);d.grades[x.id+'-i-short1']=1;C.revealLearningGroup(x,d);C.completeLearningGroup(x,d);
 assert.equal(d.completed,false);assert.equal(d.revealed,false);assert.equal(C.learningDraft(x,d).revealed,true);
 C.selectLearningGroup(x,d,'ii');assert.equal(d.step,1);C.updateAnswer(d,'ii','贈送',x);
 assert.equal(d.groupProgress.i.completed,true);assert.equal(d.grades[x.id+'-i-short1'],1);
 for(const g of x.learningGroups.slice(1)){C.selectLearningGroup(x,d,g.id);C.revealLearningGroup(x,d);C.completeLearningGroup(x,d);}
 assert.equal(d.completed,true);assert.equal(d.revealed,true);
 const saved={version:1,questions:{[x.id]:d}},restored=C.migrate(saved,null,D.questions).questions[x.id];
 assert.equal(restored.activeGroup,'v');assert.equal(restored.completed,true);assert.equal(restored.answers.i,'高興');
 C.updateAnswer(restored,'ii','遺留',x);assert.equal(restored.completed,false);assert.equal(restored.groupProgress.i.completed,true);assert.equal(restored.groupProgress.ii.revealed,false);assert.equal(restored.groupProgress.v.completed,true);
});
test('dependent parts share an answer stage and revising the prerequisite resets their reviews together',()=>{
 const x=q('dse2025-q20'),d=C.draft();d.type=x.lesson.type;
 C.learningGroup(x,d);C.revealLearningGroup(x,d);C.completeLearningGroup(x,d);C.selectLearningGroup(x,d,'ii');assert.equal(d.step,1);
 assert.deepEqual(x.learningGroups[1].answerKeys,['ii','iii']);C.updateAnswer(d,'ii','人生是有苦有樂的',x);C.updateAnswer(d,'iii','用引文分析',x);
 C.revealLearningGroup(x,d);C.completeLearningGroup(x,d);C.selectLearningGroup(x,d,'iii');assert.equal(d.step,2);
 C.revealLearningGroup(x,d);C.completeLearningGroup(x,d);assert.equal(d.completed,true);
 C.updateAnswer(d,'ii','修訂領悟',x);assert.equal(d.groupProgress.i.completed,true);assert.equal(d.groupProgress.ii.revealed,false);assert.equal(d.groupProgress.iii.revealed,false);
});
test('old revealed and completed questions migrate without losing their progress; partial groups reject foreign or impossible state',()=>{
 const x=q('dse2014-q20');
 for(const completed of [true,false]){const old={version:1,questions:{[x.id]:{...C.draft(),type:x.lesson.type,step:3,revealed:true,completed,answers:{i:'舊答案',ii:'另一答案'},note:'舊筆記'}}};const d=C.migrate(old,null,D.questions).questions[x.id];assert.equal(d.completed,completed);assert.ok(x.learningGroups.every(g=>d.groupProgress[g.id].revealed));assert.ok(x.learningGroups.every(g=>d.groupProgress[g.id].completed===completed));assert.equal(d.answers.i,'舊答案');assert.equal(d.note,'舊筆記');}
 const saved={version:1,questions:{[x.id]:{...C.draft(),activeGroup:'foreign',groupProgress:{i:{revealed:true,completed:true},ii:{revealed:false,completed:true},foreign:{revealed:true}}}}};
 const d=C.migrate(saved,null,D.questions).questions[x.id];assert.equal(d.activeGroup,'i');assert.equal(d.groupProgress.ii.completed,false);assert.equal(d.groupProgress.foreign,undefined);assert.equal(d.completed,false);
});
test('full context still applies paired answers and predecessor scoring when only one group is being reviewed',()=>{
 const x=q('dse2015-q5'),d=C.draft();d.answers={'i':'研究趣','ii-a':'求真','ii-b':'求美'};C.selectLearningGroup(x,d,'ii-a+ii-b');
 const items=C.gradingItems(x,d,S),own=items.filter(s=>s.own&&['ii-a','ii-b'].includes(s.key));assert.equal(own.reduce((n,s)=>n+s.score,0),3);assert.ok(own.every(s=>s.pairedChecked));
 const y=q('dse2014-q4'),e=C.draft();e.answers={i:'這是錯誤手法',ii:'學生的分析'};C.selectLearningGroup(y,e,'ii');
 const answer=C.gradingItems(y,e,S).find(s=>s.own&&s.key==='ii');assert.equal(answer.dependencyPending,true);assert.equal(answer.score,null);
 // Grade IDs stay attributable to their original part, allowing independent progress to survive edits.
 for(const x of D.questions.filter(q=>q.learningGroups))for(const item of C.gradingItems(x,C.draft(),S))assert.ok(item.id.startsWith(x.id+'-'+item.key+'-'),item.id);
});
