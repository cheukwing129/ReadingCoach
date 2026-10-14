(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SelfStudyCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const KEY='readingcoach-self-study-v1',LEGACY_KEY='dse-reading-coach-v1';
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=v=>String(v??'').normalize('NFC').trim().replace(/\s/g,'').replace(/[。．.!！?？]+$/g,'');
const fresh=()=>({version:1,updatedAt:'',questions:{}});
function validScore(v,max){return Number.isInteger(v)&&v>=0&&v<=max;}
function migrate(saved,legacy,questions){
 const state=fresh(),ids=new Set(questions.map(q=>q.id));
 if(saved?.version===1&&saved.questions&&typeof saved.questions==='object'){
  for(const q of questions){const raw=saved.questions[q.id];if(!raw||typeof raw!=='object')continue;const d=draft();d.type=typeof raw.type==='string'?raw.type:'';d.step=Math.min(3,Math.max(0,Number(raw.step)||0));d.answers=Object.fromEntries(q.answerParts.map(p=>[p.key,typeof raw.answers?.[p.key]==='string'?raw.answers[p.key].slice(0,30000):'']));d.grades={};for(const [id,v]of Object.entries(raw.grades||{}))if(validScore(v,q.marks))d.grades[id]=v;d.selfGrades=Object.fromEntries(q.answerParts.filter(p=>validScore(raw.selfGrades?.[p.key],p.marks)).map(p=>[p.key,raw.selfGrades[p.key]]));d.revealed=Boolean(raw.revealed);d.completed=Boolean(raw.completed);d.lastSeen=typeof raw.lastSeen==='string'?raw.lastSeen:'';d.opened=Array.isArray(raw.opened)?raw.opened.filter(x=>typeof x==='string').slice(0,100):[];d.answerHistory=Array.isArray(raw.answerHistory)?raw.answerHistory.slice(-10):[];d.note=typeof raw.note==='string'?raw.note.slice(0,3000):'';d.selfChecks=Array.isArray(raw.selfChecks)?raw.selfChecks.filter(Number.isInteger):[];d.reviewed=Array.isArray(raw.reviewed)?raw.reviewed.filter(x=>typeof x==='string'):[];state.questions[q.id]=d;}
 }else if(legacy?.drafts&&typeof legacy.drafts==='object'){
  for(const [id,old]of Object.entries(legacy.drafts)){if(!ids.has(id)||!old||typeof old!=='object')continue;const q=questions.find(x=>x.id===id),d=draft();const fields=old.fields||{};d.answers=Object.fromEntries(q.answerParts.map(p=>[p.key,typeof fields[p.key]==='string'?fields[p.key]:'']));if(q.answerParts.length===1&&!d.answers[q.answerParts[0].key]&&typeof old.free==='string')d.answers[q.answerParts[0].key]=old.free;d.answerHistory=Array.isArray(old.revisions)?old.revisions.slice(-5):[];if(old.firstAttempt)d.answerHistory.unshift(old.firstAttempt);state.questions[id]=d;}
 }
 return state;
}
function draft(){return{type:'',step:0,answers:{},grades:{},selfGrades:{},revealed:false,completed:false,lastSeen:'',opened:[],answerHistory:[],note:'',selfChecks:[],reviewed:[]};}
function updateAnswer(d,key,value){if(d.answers[key]===value)return;d.answers[key]=value;d.grades={};d.selfGrades={};d.revealed=false;d.completed=false;d.selfChecks=[];d.reviewed=[];}
function updateQuestionAnswer(state,q,key,value,questions){
 const d=state.questions[q.id]||(state.questions[q.id]=draft());
 if(d.answers[key]===value)return;
 updateAnswer(d,key,value);
 for(const dependent of questions){
  if(!dependent.answerParts.some(p=>p.assessmentReference?.questionId===q.id&&p.assessmentReference.key===key))continue;
  const saved=state.questions[dependent.id];if(!saved)continue;
  saved.grades={};saved.selfGrades={};saved.revealed=false;saved.completed=false;saved.selfChecks=[];saved.reviewed=[];
 }
}
function fingerprint(q,key,text){let h=2166136261;for(const c of q+'|'+key+'|'+normalize(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
function shortPool(q,p){
 const o=q.official.find(x=>x.key===p.key),pool=[];let i=0;
 const add=(text,score,analysis)=>{if(!normalize(text)||pool.some(x=>normalize(x.text)===normalize(text)))return;pool.push({id:q.id+'-'+p.key+'-short'+(++i),text,score,analysis,improvement:''});};
 const correct={
  'dse2024-q11:i':'這是魚面對危險時的內心感受，與「遠離」「深深隱蔽」及此前的捕殺經歷相符。',
  'dse2024-q11:ii':'由魚的避險感受推到物性或自然的變化，完成了作者用意這一層。',
  'dse2024-q13:i':'引文構成了這種手法；本分題只要求指出名稱。',
  'dse2024-q16:i':'寫明農藥浸染種子的狀態，準確找出與表格寓意相應的紅色事物。',
  'dse2024-q16:ii':'將金色盛放的葵花連到生命或生活的寓意，沒有把願望當成已全面實現。',
  'dse2024-q17:answer':'是準確概括母親遭遇挫折後不放棄或對來年仍抱希望的二字性格詞。'
 };
 for(const a of o.answers||[])for(const text of a.split('／'))add(text,p.marks,o.correctAnalysis||correct[q.id+':'+p.key]||'答案的概括與題目所問內容相符。');
 const notes=q.caseNotes||{};
 for(const e of o.examples||[]){const note=notes[e.text];for(const text of e.text.split('／'))add(text,e.score,e.analysis||(note?cleanAnalysis(note):e.score===0?'理解或概括與指定文意不合。':'方向相關，但概念或用詞未足夠準確。'));}
 if(q.id==='dse2024-q13'&&p.key==='i')for(const text of ['暗喻','借喻','正襯','象徵','層遞','誇張','擬人','對偶'])add(text,0,'本引文未構成這種手法。須對照「乳汁」「鮮血」的形象及前後關係辨識，不能只憑名稱猜測。');
 return pool;
}
function cleanAnalysis(t){return String(t||'').replace(/(?:文件|閱卷員簡報)(?:「[^」]+」)?(?:舉隅\d+)?(?:列為|列|給)?[0-4]分[，；。]?/g,'').replace(/(?:文件|閱卷員簡報)(?:說明|明示|說|把這組列為)/g,'').replace(/按來源原字保留/g,'').replace(/文件/g,'').replace(/^；/,'');}
function specialPool(q,p){
 if(q.id!=='dse2025-q20'||p.key==='iii')return null;
 let tuples=p.key==='i'?[
 ['緩慢',2,'節奏詞準確，與日常事物不疾不徐地經過、無車催逼的心境相合。'],['平緩',2,'準確形容這段從容的節奏。'],['舒緩',2,'準確形容這段從容的節奏。'],['輕柔',2,'用詞符合文意及整段心境。'],['柔和',2,'用詞符合文意及整段心境。'],['平穩',2,'用詞符合文意及整段心境。'],['平和',2,'用詞符合文意及整段心境。'],['慢慢',2,'是準確形容節奏的兩字詞。'],['很慢',2,'是準確形容節奏的兩字詞。'],['悠長',1,'有延長的感覺，但未精確概括整段不疾不徐的節奏，用詞稍欠準確。'],['柔弱',1,'方向與輕柔相關，但偏向力度的弱，未精確形容文意營造的節奏。'],['穩定',1,'抓到節奏沒有劇烈變化，但概括略寬，未如平緩或平穩準確。'],['柔慢',1,'方向與柔和緩慢相關，但詞語表述未足夠準確，只到1分。'],['輕快',1,'沒有完全掌握段落的從容節奏。'],['明快',1,'沒有完全掌握段落的從容節奏。'],['簡明',1,'指出句子簡短清楚，但未準確說明讀起來的節奏及其心境。'],['從容',1,'準確指出心境，但題目要求節奏詞。'],['平淡',1,'指出心境，但不是準確的節奏詞。'],['悠閒',1,'準確指出心境，但題目要求節奏詞。'],['快速',0,'將短句直接當成急速，忽略文意發展及從容心境。'],['急促',0,'與整段從容、沒有車催逼的心境不合。'],['鏗鏘',0,'不符合段落的節奏與心境。'],['緊湊',0,'不符合段落的節奏與心境。'],['頓挫',0,'不符合段落的節奏與心境。'],['沉重',0,'不符合段落的節奏與心境。'],['無奈',0,'既非合適的節奏詞，也未準確概括心境。'],['純樸',0,'未準確指出節奏。'],['清幽',0,'未準確指出節奏。'],['慢',0,'不符合兩字詞要求。'],['十分慢',0,'不符合兩字詞要求。']
 ]:[
 ['人生在世只是過客。',1,'從人與事短暫經過的特點，指出有文本支持的人生領悟。'],['以從容的心境面對人生。',1,'指出由無車催逼及坐看景物引出的生活態度。'],['人生是短暫的。',1,'準確指出由不同事物經過、消逝推到的生命本質。'],['人生是渺小的。',1,'領悟可由人生與歷史、自然的對照支持。'],['人生是無常的。',1,'從事物出現及離去指出有據的領悟。'],['人生是虛幻的。',1,'從經過、影子、時間等描寫指出有據的領悟。'],['人生是無聊的。',0,'把平淡、從容誤解成無聊，與作者欣賞和感受人生的態度不合。'],['應珍惜當下。',0,'單獨一句沒有準確指出這裏的領悟；需要與忘卻催逼、放下執着等文意連接。'],['人生是沒有意義的。',0,'將從容生活誤讀成否定人生意義。'],['鄉郊十分貧困。',0,'只評環境，未指出作者對人生的領悟。']
 ];
 return tuples.map(([text,score,analysis],i)=>({id:q.id+'-'+p.key+'-s'+i,text,score,analysis,improvement:''}));
}
function pool(q,p,sourceSamples){if(p.referenceOnly)return[];return(sourceSamples[q.id]?.[p.key]||specialPool(q,p)||shortPool(q,p)).map(s=>({...s,outOf:p.marks,key:p.key}));}
function answerCharacters(text){return Array.from(String(text??'').normalize('NFC').replace(/\s/g,''));}
function assessmentText(p,text){return p.assessFirstChars?answerCharacters(text).slice(0,p.assessFirstChars).join(''):String(text??'');}
function segmentScore(p,text){
 if(!p.segment)return null;
 const n=v=>/^\d+$/.test(v)?Number(v):v==='十'?10:v.includes('十')?(v[0]==='十'?1:'一二三四五六七八九'.indexOf(v[0])+1)*10+(v.endsWith('十')?0:'一二三四五六七八九'.indexOf(v.at(-1))+1):'一二三四五六七八九'.indexOf(v)+1;
 const v=normalize(text),digits='([0-9一二三四五六七八九十]+)',range=v.match(new RegExp('^第?'+digits+'段?(?:至|到|[—–~～-])第?'+digits+'段?$')),single=v.match(new RegExp('^第?'+digits+'段?$'));
 if(range)return p.segment.accepted.some(([a,b])=>a===n(range[1])&&b===n(range[2]))?p.marks:0;
 if(single&&p.segment.entry!=='range')return p.segment.accepted.some(([a,b])=>n(single[1])===(p.segment.entry==='start'?a:b))?p.marks:0;
 return null;
}
function shuffled(items,seed){return [...items].sort((a,b)=>fingerprint(seed,a.id,a.text).localeCompare(fingerprint(seed,b.id,b.text)));}
function assessmentDependency(q,p,d,sourceSamples){
 const rule=p.assessmentDependency;if(!rule)return null;
 const prerequisite=q.answerParts.find(x=>x.key===rule.key),text=String(d.answers[rule.key]||'').trim();
 if(!prerequisite)return null;
 const label=prerequisite.label;
 const failure=(action,reason)=>action==='zero'?{score:0,dependencyChecked:true,analysis:'0分：'+reason+'原題規定相關分題不給分；不能另加自評分。'}:{score:null,notAssessed:true,dependencyChecked:true,analysis:'不予評閱（IR）：'+reason+'原題規定先完成正確的前置答案，才評閱這一分題。'};
 if(!text)return rule.missing==='assess'?null:failure(rule.missing,'尚未填寫'+label+'。');
 if(rule.exceptions?.some(t=>normalize(t)===normalize(text)))return null;
 const length=Array.from(normalize(text)).length;
 if(rule.validateFormat&&((prerequisite.exactChars&&length!==prerequisite.exactChars)||(prerequisite.maxChars&&length>prerequisite.maxChars)))return failure(rule.incorrect,label+'未符合原題字數要求。');
 const score=rule.kind==='segment'?segmentScore(prerequisite,text):pool(q,prerequisite,sourceSamples).find(s=>normalize(s.text)===normalize(text))?.score;
 if(score===0&&rule.reviewZero)return{score:null,dependencyPending:true,analysis:'前一分題「'+label+'」得0分，仍須分清用詞不準確與明顯錯誤。原題規定：只是用詞不準確，仍可評閱本分題；明顯錯誤則本分題0分。先按準則核對，再自評，不能只憑前項0分決定。'};
 if(score===0)return failure(rule.incorrect,label+'未符合原題要求。');
 if(score>0)return null;
 return{score:null,dependencyPending:true,analysis:'先核對'+label+'是否符合前置條件。這個寫法尚未獲自動核驗；依下方準則確認後，再自評本分題。'};
}
function samples(q,p,d,sourceSamples,questionDrafts={}){
 const all=pool(q,p,sourceSamples),chosen=[],scores=new Set();
 for(const s of all)if(!scores.has(s.score)){scores.add(s.score);chosen.push({...s});}
 const extras=p.marks===2?[...all].sort((a,b)=>(a.score===1?0:a.score===0?1:2)-(b.score===1?0:b.score===0?1:2)):all;
 for(const s of extras)if(chosen.length<4&&!chosen.some(c=>c.id===s.id))chosen.push({...s});
 for(const s of all.filter(s=>s.essential))if(!chosen.some(c=>c.id===s.id))chosen.push({...s});
 const own=String(d.answers[p.key]||'').trim();
 if(own){
  const length=Array.from(normalize(own)).length;
  const formatError=p.exactChars&&length!==p.exactChars?'答案不符合原題的'+(p.exactChars===2?'兩字詞':p.exactChars===4?'四個字':p.exactChars+'字')+'格式要求。':p.maxChars&&length>p.maxChars?'答案超過原題「不多於'+(p.maxChars===4?'四個字':p.maxChars+'個字')+'」的限制，得0分。':'';
  const assessed=assessmentText(p,own),matches=s=>normalize(assessmentText(p,s.text))===normalize(assessed);
  const match=all.find(matches),same=chosen.find(matches),segment=segmentScore(p,own);
  if(!formatError&&same){same.own=true;same.merged=true;same.text=own;}
  else if(!formatError&&match){chosen.push({...match,text:own,own:true,merged:true});}
  else chosen.push({id:'own-'+q.id+'-'+p.key+'-'+fingerprint(q.id,p.key,own),text:own,score:formatError?0:segment,outOf:p.marks,key:p.key,own:true,segmentChecked:segment!==null,analysis:formatError||(segment!==null?(segment+'分：已按原題可接受的段落範圍核對；標準答案是'+q.official.find(o=>o.key===p.key).answers.join('或')+'。'):'對照下方準則，逐項檢查你的概念、文本依據及推論，再確認自評。')});
 }
 const coupled=q.coupledSegments;
 if(own&&coupled?.keys.includes(p.key)){
  const [first,second]=coupled.keys;
  if(segmentScore({marks:1,segment:coupled.first},d.answers[first])===1&&segmentScore({marks:1,segment:coupled.second},d.answers[second])===1){
   const current=chosen.find(s=>s.own);
   current.score=coupled.scoreByKey[p.key];current.segmentChecked=true;current.coupledChecked=true;
   current.analysis=current.score+'分：'+coupled.analysis+'為避免重複，合共的1分顯示於第一欄，第二欄不另計分。';
  }

 }
 const distinct=q.distinctAnswerGroups;
 if(own&&distinct?.keys.includes(p.key)){
  const group=distinct.groups.find(g=>g.some(t=>normalize(t)===normalize(own)));
  const current=chosen.find(s=>s.own);
  if(group&&current?.score>0){
   const candidates=distinct.keys.map(key=>{
    const part=q.answerParts.find(a=>a.key===key),text=String(d.answers[key]||'');
    if(!group.some(t=>normalize(t)===normalize(text)))return null;
    const match=pool(q,part,sourceSamples).find(s=>normalize(s.text)===normalize(text));
    return match?{key,score:match.score}:null;
   }).filter(Boolean).sort((a,b)=>b.score-a.score||distinct.keys.indexOf(a.key)-distinct.keys.indexOf(b.key));
   if(candidates.length>1&&candidates[0].key!==p.key){
    current.score=0;current.distinctChecked=true;
    current.analysis='0分：'+(distinct.analysis||'這項與另一欄的答案意涵相近；本題同類品格只取較高分的一項，同分時保留第一項，不重複計分。');
   }
  }
 }
 const paired=q.pairedAnswers;
 if(own&&paired?.keys.includes(p.key)&&paired.accepted.some(values=>values.every((text,i)=>normalize(text)===normalize(d.answers[paired.keys[i]])))){
  const current=chosen.find(s=>s.own);current.score=paired.scoreByKey[p.key];current.pairedChecked=true;current.analysis=current.score+'分：'+paired.analysis;
 }
 if(own){
  const current=chosen.find(s=>s.own),dependency=assessmentDependency(q,p,d,sourceSamples);
  if(dependency)Object.assign(current,dependency);
  if(p.assessmentDependency&&!current.notAssessed&&!current.dependencyPending){
   const prerequisite=d.answers[p.assessmentDependency.key],context=current.prerequisiteScores?.find(rule=>rule.answers.some(t=>normalize(t)===normalize(prerequisite)));
   if(context)Object.assign(current,{score:context.score,dependencyChecked:true,analysis:context.score+'分：'+context.analysis});
   else if(current.prerequisiteAnswers&&!current.prerequisiteAnswers.some(t=>normalize(t)===normalize(prerequisite)))Object.assign(current,{score:0,dependencyChecked:true,analysis:'0分：這個例子或說明與前一分題所選的內容不相符。原題要求兩項互相對應，須先配對前置答案與例子，再分析。'});
  }
  const reference=p.assessmentReference;
  if(reference){
   const selected=questionDrafts[reference.questionId]?.answers?.[reference.key],methods=current.explainedMethods;
   const note=reference.label+'：'+(selected||'尚未作答')+'。';
   if(!selected||!reference.allowed.concat(reference.zeroMethods).includes(selected))Object.assign(current,{score:null,dependencyPending:true,analysis:note+'先核對前題及本題手法是否相同。原參考未明訂漏答前題的給分處理，保留自評；不能逕判0分。'});
   else if(!Array.isArray(methods)||!methods.length)Object.assign(current,{score:null,dependencyPending:true,analysis:note+'這份答案尚未獲自動核驗。若承前用層遞／對比解說，0分；解說手法與前題不同或用兩種以上，最高2分；A／B相同手法仍按內容準則評閱。'});
   else if(methods.length===1&&reference.zeroMethods.includes(selected)&&methods[0]===selected)Object.assign(current,{score:0,dependencyChecked:true,analysis:'0分：'+note+'本題亦以該錯誤手法說明；按原題承接規則不給分。'});
   else if(methods.length>1||methods[0]!==selected){const score=Math.min(current.score,reference.mismatchCap),reason=methods.length>1?'本題採用兩種以上手法':'本題解說手法與前題的選項不同';Object.assign(current,{score,dependencyChecked:true,analysis:score+'分：'+note+'這段已知解說的內容原可得'+current.score+'分；'+reason+'，原題規定最高'+reference.mismatchCap+'分，故按'+score+'分評定。'});}
  }
 }
 return shuffled(chosen,q.id+'-'+p.key);
}
function gradingItems(q,d,sourceSamples,questionDrafts={}){return q.answerParts.filter(p=>p.kind!=='choice').flatMap(p=>samples(q,p,d,sourceSamples,questionDrafts));}
function gradingReady(items,d){const examples=items.filter(s=>!s.own);return examples.length>0&&examples.every(s=>validScore(d.grades[s.id],s.outOf));}
function gradingResult(items,d){return{correct:items.filter(s=>!s.own&&s.score!==null&&d.grades[s.id]===s.score).length,total:items.filter(s=>!s.own&&s.score!==null).length};}
function choiceValues(p,text){return p.multiple?[...new Set(String(text||'').split('、').filter(Boolean))]:[String(text||'')];}
function choiceSets(p){return p.acceptedAnswers||[choiceValues(p,p.answer)];}
function choiceStatus(p,value){const sets=choiceSets(p);return sets.every(set=>set.includes(value))?'required':sets.some(set=>set.includes(value))?'optional':'excluded';}
function choiceResult(q,d){return q.answerParts.filter(p=>p.kind==='choice').map(p=>{
 const chosen=d.answers[p.key]||'',values=choiceValues(p,chosen),sets=choiceSets(p),correct=p.multiple?sets.map(set=>set.join('、')).join(' ／ '):p.answer;
 const matched=p.multiple?sets.some(set=>set.length===values.length&&set.every(value=>values.includes(value))):chosen===p.answer;
 return{key:p.key,chosen,correct,score:p.answerVerified===false?null:matched?p.marks:0,outOf:p.marks};
});}
function nextQuestion(data,q){const items=data.questions.filter(x=>x.exerciseId===q.exerciseId).sort((a,b)=>a.number-b.number),i=items.findIndex(x=>x.id===q.id);return items[i+1]||null;}
function questionParagraphs(q,article){
 if(q.readingReferences?.[article.id])return q.readingReferences[article.id].filter(n=>article.paragraphs.some(p=>p.number===n));
 const tables=q.tables||(q.table?[q.table]:[]);
 const text=[q.prompt,q.quote,...(q.answerParts||[]).map(p=>p.label),...tables.flatMap(t=>[...t.headers,...t.rows.flat()])].filter(Boolean).join('\n');
 const valid=new Set(article.paragraphs.map(p=>p.number)),found=[];
 const add=n=>{if(valid.has(n)&&!found.includes(n))found.push(n);};
 const number=t=>/^\d+$/.test(t)?Number(t):t==='十'?10:t.includes('十')?(t[0]==='十'?1:'一二三四五六七八九'.indexOf(t[0])+1)*10+(t.endsWith('十')?0:'一二三四五六七八九'.indexOf(t.at(-1))+1):'一二三四五六七八九'.indexOf(t)+1;
 const digits='[0-9一二三四五六七八九十]+';
 const references=new RegExp('第('+digits+')(?:\\s*([至到–—-])\\s*第?('+digits+')|((?:\\s*[、及和與]\\s*第?'+digits+')+))?\\s*段|末段|最後一段','g');
 for(const m of text.matchAll(references)){
  if(!m[1]){add(article.paragraphs.at(-1).number);continue;}
  const first=number(m[1]);add(first);
  if(m[2]){const last=number(m[3]);for(let n=first+1;n<=Math.min(last,article.paragraphs.at(-1).number);n++)add(n);}
  if(m[4])for(const n of m[4].match(new RegExp(digits,'g'))||[])add(number(n));
 }
 if(found.length){const primary=q.lesson?.locate?.[0];return found.includes(primary)?[primary,...found.filter(n=>n!==primary)]:found;}
 return(q.lesson?.locate||[]).filter(n=>valid.has(n)).slice(0,1);
}
function canComplete(d){return d.revealed===true;}
return{KEY,LEGACY_KEY,escapeHTML,normalize,validScore,fresh,draft,migrate,updateAnswer,updateQuestionAnswer,fingerprint,shortPool,pool,answerCharacters,assessmentText,segmentScore,samples,gradingItems,gradingReady,gradingResult,choiceValues,choiceStatus,choiceResult,nextQuestion,cleanAnalysis,questionParagraphs,canComplete};
});
