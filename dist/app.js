(function () {
  'use strict';
  const C = window.CoachCore, base = window.COACH_DATA, esc = C.escapeHTML;
  const main = document.getElementById('main');
  const KEY = 'dse-reading-coach-v1';
  const emptyBank = () => ({schemaVersion:1, passages:[], questions:[]});
  let state = {version:1, bank:emptyBank(), drafts:{}, readingSize:18};
  let compiled, current = null, mobileView = 'coach', saveTimer, toastTimer, pendingConfirm;
  let storageBlocked = false, editQuestionId = null;
  const groups = [
    {number:'01',title:'還亮著的燈',label:'從人物變化入手',description:'一部舊收音機，讓我們重新理解傾聽、回憶和舊物的價值。',ids:['lamp-inference','lamp-purpose','lamp-comparison']},
    {number:'02',title:'種子沒有準時',label:'從前後關係入手',description:'比較兩張表的用途，從具體細節推論觀念與態度的改變。',ids:['seed-inference','seed-purpose','seed-comparison']},
    {number:'03',title:'快慢之間',label:'從雙篇比較入手',description:'慢走和趕路的選擇不同。試從兩篇文章找出共同的衡量準則。',ids:['pace-inference','pace-purpose','pace-comparison']}
  ];
  const byId = id => compiled.questions.find(q => q.id === id);
  const fieldsFor = q => base.fields[q.type];
  const answerFor = (q,d) => C.assembleAnswer(d,fieldsFor(q));
  const hasWork = d => d && (d.completedAt || d.free?.trim() || Object.values(d.fields || {}).some(v=>v.trim()) || d.evidence?.length || d.hintCount);
  const formatDate = s => {const dt=new Date(s);return Number.isFinite(+dt)?new Intl.DateTimeFormat('zh-HK',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt):'';};
  function storageWarning(message) {const el=document.getElementById('storage-warning');el.hidden=false;el.textContent=message;}
  function rebuild() {compiled=C.compile({passages:[...base.passages,...state.bank.passages],questions:[...base.questions,...state.bank.questions]});}
  try {
    const raw=localStorage.getItem(KEY);
    if(raw){
      const value=JSON.parse(raw);
      if(value.version!==1 || C.validateBank(value.bank).length || !value.drafts || typeof value.drafts!=='object' || Array.isArray(value.drafts))throw new Error('invalid data');
      state={version:1,bank:value.bank,drafts:value.drafts,readingSize:[16,18,20,22,24,26].includes(value.readingSize)?value.readingSize:18};
    }
  } catch(e) {storageBlocked=true;storageWarning('未能讀取或保存瀏覽器資料。本次仍可練習，請使用「匯出完整備份」保存內容；原有資料不會被覆蓋。');}
  rebuild();
  const cleanDrafts={};
  for(const q of compiled.questions)if(state.drafts[q.id])cleanDrafts[q.id]=C.sanitizeDraft(state.drafts[q.id],q,fieldsFor(q),compiled.sentences);
  state.drafts=cleanDrafts;
  function draft(q) {return state.drafts[q.id] ||= C.newDraft();}
  function persist() {
    if(storageBlocked)return false;
    try {localStorage.setItem(KEY,JSON.stringify(state));document.querySelectorAll('.save-label').forEach(el=>el.textContent='已保存在此瀏覽器');return true;}
    catch(e){storageBlocked=true;storageWarning('瀏覽器未能儲存，這次的內容仍在頁面中。離開前請在「學習記錄」匯出完整備份。');document.querySelectorAll('.save-label').forEach(el=>el.textContent='尚未儲存，請匯出備份');return false;}
  }
  function save() {clearTimeout(saveTimer);return persist();}
  function touch(d, delayed=false) {d.updatedAt=new Date().toISOString();clearTimeout(saveTimer);if(delayed){document.querySelectorAll('.save-label').forEach(el=>el.textContent='保存中…');saveTimer=setTimeout(persist,400);}else persist();}
  function toast(message) {const el=document.getElementById('toast');clearTimeout(toastTimer);el.textContent=message;el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,4500);}
  function confirmAction(title,message) {
    const dialog=document.getElementById('confirm-dialog');
    if(pendingConfirm)return Promise.resolve(false);
    document.getElementById('dialog-title').textContent=title;document.getElementById('dialog-text').textContent=message;
    return new Promise(resolve=>{pendingConfirm=resolve;dialog.returnValue='cancel';dialog.showModal();});
  }
  document.getElementById('confirm-dialog').addEventListener('close',()=>{const callback=pendingConfirm;pendingConfirm=null;callback?.(document.getElementById('confirm-dialog').returnValue==='confirm');});
  function download(name,text,type='application/json') {const url=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const backup = () => {save();download('reading-coach-backup.json',JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2));toast('完整備份已匯出，包含教師題庫、答案草稿和自評記錄。');};
  function allGroups() {return [...groups,...(state.bank.questions.length?[{number:'＋',title:'教師新增練習',label:'自訂題庫',description:'以老師提供的文章、題幹和評分要點練習。',ids:state.bank.questions.map(q=>q.id)}]:[])];}
  const statusSymbol = d => d?.completedAt?'✓':hasWork(d)?'·':'';
  function renderHome() {
    const total=compiled.questions.length,done=compiled.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    const last=compiled.questions.filter(q=>hasWork(state.drafts[q.id])&&!state.drafts[q.id].completedAt).sort((a,b)=>(state.drafts[b.id].updatedAt||'').localeCompare(state.drafts[a.id].updatedAt||''))[0];
    const first=last || byId('lamp-inference');
    main.innerHTML=`<section class="hero"><div><div class="eyebrow">READ · THINK · EXPLAIN</div><h1>把想法，<br>寫成有根據的答案。</h1><p>閱讀理解不止是找到一句話。先讀準題目，再挑選文本證據，把「為甚麼」和「如何」說清楚。</p><div class="button-row"><a class="button primary" href="#practice/${esc(first.id)}">${last?'繼續上次練習':'開始第一道練習'} <span aria-hidden="true">→</span></a><a class="button quiet" href="#records">查看學習記錄</a></div></div><aside class="hero-card"><span class="small-label">你的練習進度</span><strong>${done}<span style="font-size:16px;opacity:.8"> / ${total} 題</span></strong><span class="small-label">已完成作答及自檢</span><div class="mini-line">原創材料 · 分步提示 · 多層次例答<br>自評幫你找出下一次要改進的地方。</div></aside></section>
    <div class="section-heading"><h2>一次練一個重點</h2><p>每組由人物推論到作用分析，再到比較</p></div><section class="series-grid" aria-label="練習組別">${allGroups().map(g=>{
      const n=g.ids.filter(id=>state.drafts[id]?.completedAt).length, next=g.ids.find(id=>!state.drafts[id]?.completedAt)||g.ids[0];
      return `<article class="series-card"><div class="series-top"><span class="series-number">${g.number}</span><span class="tag">${esc(g.label)}</span></div><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><ul class="question-list">${g.ids.map((id,i)=>{const q=byId(id),d=state.drafts[id];return `<li><a href="#practice/${esc(id)}"><span class="question-status ${d?.completedAt?'done':''}" aria-label="${d?.completedAt?'已完成':hasWork(d)?'已有草稿':'尚未開始'}">${statusSymbol(d)||i+1}</span><span class="question-title">${esc(q.title)}</span><span class="question-meta">${q.marks}分</span></a></li>`;}).join('')}</ul><div class="series-bottom"><span>${n} / ${g.ids.length} 題完成</span><a class="button small secondary" href="#practice/${esc(next)}">${n===g.ids.length?'重溫這一組':'進入練習'} →</a></div></article>`;
    }).join('')}</section><section class="how-strip" aria-label="四個作答步驟">${[['讀準題目','分清指令、範圍及作答要求。'],['找到證據','點選原文，保留最貼題的線索。'],['組織答案','把判斷、依據和解釋連在一起。'],['自檢與修訂','比較例答，找出仍欠缺的關係。']].map((x,i)=>`<div><h3><span>0${i+1}</span>${x[0]}</h3><p>${x[1].replace('题','題')}</p></div>`).join('')}</section><p class="note neutral" style="margin-top:22px">本版有 3 組原創材料、9 道練習，集中訓練推論、作用分析和比較。題目及評分要點屬教學設計；自評分數用來檢查答案要素，並非正式 DSE 評級。</p>`;
  }
  function renderPassages(q,d) {
    return `<section class="passage-panel" aria-label="閱讀原文"><div class="panel-title"><div><h2>閱讀原文</h2><small>點選句子，可加入或移除證據</small></div><div class="text-tools"><button type="button" data-action="font-less" aria-label="縮小原文字體" ${state.readingSize<=16?'disabled':''}>A−</button><button type="button" data-action="font-more" aria-label="放大原文字體" ${state.readingSize>=26?'disabled':''}>A＋</button></div></div><div class="passage-scroll" style="--reading-size:${state.readingSize}px">${q.passages.map((id,i)=>{
      const p=compiled.passages.find(p=>p.id===id);
      return `${i?'<hr class="reading-divider">':''}<h2 class="passage-heading">${q.passages.length>1?(i===0?'甲文 · ':'乙文 · '):''}${esc(p.title)}</h2><p class="passage-label">${esc(p.label||'教師提供文章')}</p>${p.paragraphs.map(a=>`<p class="paragraph"><span class="paragraph-number" aria-label="第${a.number}段">${a.number}</span>${a.sentences.map(s=>`<button type="button" class="sentence ${d.evidence.includes(s.id)?'selected':''}" data-evidence="${esc(s.id)}" aria-pressed="${d.evidence.includes(s.id)}" title="點選此句作證據">${esc(s.text)}</button>`).join('')}</p>`).join('')}`;
    }).join('')}</div><div class="evidence-summary" id="evidence-summary">已選 ${d.evidence.length} 句 · ${esc(q.scope||'按題目要求作答')}</div></section>`;
  }
  function evidenceList(q,d) {
    if(!d.evidence.length)return '<div class="empty-state">先到原文點選最貼題的句子。<br>不用把整篇文章都圈起來。</div>';
    return d.evidence.map(id=>{const s=compiled.sentences[id],p=compiled.passages.find(p=>p.id===s.passage);return `<blockquote class="evidence-item"><button data-action="remove-evidence" data-id="${esc(id)}" aria-label="移除第${s.paragraph}段這句證據">×</button><cite>${esc(p.title)} · 第${s.paragraph}段</cite><p>${esc(s.text)}</p></blockquote>`;}).join('');
  }
  function hintBox(q,d) {return `<aside class="hint-box"><div class="hint-head"><h3>需要一點提示？</h3><span class="muted" style="font-size:11px">已使用 ${d.hintCount} / ${q.hints.length} 級</span></div>${q.hints.slice(0,d.hintCount).map((h,i)=>`<p><span class="hint-level">提示 ${i+1}</span>${esc(h)}</p>`).join('')}<button type="button" class="button small secondary" data-action="hint" style="margin-top:14px" ${d.hintCount>=q.hints.length?'disabled':''}>${d.hintCount>=q.hints.length?'提示已全部展開':d.hintCount?'解鎖下一級提示':'查看第一級提示'}</button><p class="muted" style="font-size:11px">提示使用次數會記錄；不影響自評分數。</p></aside>`;}
  function answerPreview(q,d) {const a=answerFor(q,d);return `<div class="answer-preview"><h3>我的答案</h3><p class="answer-text" id="answer-preview-text">${a.trim()?esc(a):'尚未填寫。請先試寫，再查看例答。'}</p><div class="answer-count ${q.wordLimit&&C.countChars(a)>q.wordLimit?'over':''}" id="answer-count">${C.countChars(a)} 字${q.wordLimit?' / 上限 '+q.wordLimit+' 字':''}（不計空白）</div></div>`;}
  function stepContent(q,d) {
    if(d.step===0)return `<div class="step-label">STEP 01 · 先確認自己要回答甚麼</div><h2 class="step-title">拆開題目要求</h2><p class="step-description">先選主要指令，再勾選題目真正要求的內容。</p><fieldset><legend>這道題主要要求你做甚麼？</legend>${q.options.map(o=>`<label class="choice"><input type="radio" name="directive" value="${esc(o)}" ${d.directive===o?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset><fieldset><legend>答案應處理哪些內容？可選多項。</legend>${q.requirements.map((r,i)=>`<label class="choice"><input type="checkbox" name="requirement" value="${i}" ${d.requirements.includes(i)?'checked':''}><span>${esc(r.text)}</span></label>`).join('')}</fieldset><button type="button" class="button secondary" data-action="check-task">核對拆題</button><div id="task-feedback" aria-live="polite"></div>${hintBox(q,d)}`;
    if(d.step===1)return `<div class="step-label">STEP 02 · 用原文支持判斷</div><h2 class="step-title">挑選最貼題的證據</h2><p class="step-description">在原文點選句子。想想每一句支持答案的哪一部分，避免把「有圈句子」當成「已解釋」。</p><button type="button" class="button secondary" data-action="show-passage">到原文選取證據 →</button><div id="evidence-list">${evidenceList(q,d)}</div><button type="button" class="button secondary" data-action="check-evidence" ${!q.evidenceGroups.length?'disabled':''}>核對證據範圍</button><div id="evidence-feedback" aria-live="polite"></div>${!q.evidenceGroups.length?'<p class="field-help">這道教師題目未設定證據範圍，請按題幹自行判斷。</p>':''}${hintBox(q,d)}`;
    if(d.step===2)return `<div class="step-label">STEP 03 · 不只複述，要交代關係</div><h2 class="step-title">把線索寫成答案</h2><p class="step-description">依照框架試寫，或選擇自由作答。欄目幫助組織思路，實際答案仍須按題目調整。</p><div class="mode-switch" role="group" aria-label="作答模式"><button type="button" data-action="mode-guided" aria-pressed="${d.mode!=='free'}">分步作答</button><button type="button" data-action="mode-free" aria-pressed="${d.mode==='free'}">自由作答</button></div>${d.mode==='free'?`<label class="field"><span class="field-label">寫下你的答案</span><textarea class="big" data-answer="free" maxlength="12000" placeholder="直接回應題目，用具體文本證據支持，再解釋兩者的關係。">${esc(d.free)}</textarea></label>`:fieldsFor(q).map(f=>`<label class="field"><span class="field-label">${esc(f.label)}</span><textarea data-answer="${esc(f.key)}" maxlength="5000" placeholder="${esc(f.placeholder)}">${esc(d.fields[f.key]||'')}</textarea></label>`).join('')}<details><summary class="text-link" style="cursor:pointer">查看已選文本證據（${d.evidence.length} 句）</summary>${evidenceList(q,d)}</details>${answerPreview(q,d)}<button type="button" class="button secondary" data-action="structure">檢查答案結構</button><div id="structure-feedback" aria-live="polite"></div><p class="field-help">結構提醒只檢查是否有內容和常見表達，不判斷意思是否正確。</p>${hintBox(q,d)}`;
    const a=answerFor(q,d),all=q.rubric.every((_,i)=>d.checks[i]);
    return `<div class="step-label">STEP 04 · 找出下一次可以改進的地方</div><h2 class="step-title">自檢，再比較例答</h2><p class="step-description">逐項查看自己的答案。只有答案中已寫清楚的內容，才選「已做到」；不能把腦中想過的內容當成已寫。</p>${answerPreview(q,d)}<button type="button" class="button small secondary" data-action="revise">← 返回修訂答案</button><p class="note neutral" style="margin-top:20px">以下每項作 1 分自評檢查；合計只表示你自行確認的答案要素。正式評分還須考慮意思準確、論述和整體表現，由老師評閱。</p>${q.rubric.map((r,i)=>`<fieldset class="rubric-item"><legend><span class="rubric-label">${i+1}. ${esc(r.label)} <span class="muted" style="font-size:11px">／1 分</span></span><span class="rubric-detail">${esc(r.detail)}</span></legend><div class="self-options">${[['yes','已做到'],['unsure','不確定'],['no','未做到']].map(([value,label])=>`<label><input type="radio" name="check-${i}" data-check="${i}" value="${value}" ${d.checks[i]===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`).join('')}<div class="score-bar"><div><span>學生自評 ${all?'':'· 尚未逐項完成'}</span><br><strong id="self-score">${C.selfScore(q,d)} / ${q.marks}</strong></div><span>「不確定」暫不計入<br>系統沒有判定答案正確</span></div><details class="examples" id="examples" ${d.examplesViewed?'open':''}><summary>比較不同程度例答</summary>${a.trim()?`<p class="field-help">例答分數依本練習的要點示範，並非官方評分。合理而有文本支持的其他表達也可接受。</p>${q.examples.map(e=>`<article class="example"><div class="example-head"><strong>${esc(e.label)}</strong><span class="tag">示範 ${e.score} / ${q.marks} 分</span></div><p>${esc(e.text)}</p><p class="note">${esc(e.note)}</p></article>`).join('')}`:'<p class="note">請先寫下自己的答案，再來比較例答。</p>'}</details><label class="field" style="margin-top:24px"><span class="field-label">下一次，我會特別留意……（選填）</span><textarea class="compact" data-reflection maxlength="1500" placeholder="例如：比較題要以同一角度寫出兩方，不能只有兩段內容。">${esc(d.reflection||'')}</textarea></label><button type="button" class="button primary" data-action="complete">${d.completedAt?'更新完成記錄':'完成本題並記錄自評'} ✓</button>${d.completedAt?`<p class="note completion-note">已完成作答及自檢 · ${formatDate(d.completedAt)}<br>完成記錄不代表答案全對；仍可返回修訂。</p>`:''}<div id="completion-error" aria-live="polite"></div>`;
  }
  function renderPractice(q, focus=false) {
    current=q;const d=draft(q);
    main.innerHTML=`<div class="practice-top"><a class="back-link" href="#home">← 返回練習題庫</a><span class="save-label">${storageBlocked?'尚未儲存，請匯出備份':'草稿自動保存在此瀏覽器'}</span><label class="practice-select">切換題目 <select id="question-select" aria-label="切換練習題目">${allGroups().map(g=>`<optgroup label="${esc(g.title)}">${g.ids.map(id=>`<option value="${esc(id)}" ${id===q.id?'selected':''}>${esc(byId(id).title)}</option>`).join('')}</optgroup>`).join('')}</select></label></div><div class="question-heading"><div><p>${esc(C.TYPES[q.type])} · ${esc(q.level||'自訂練習')} ${q.minutes?'· 建議 '+q.minutes+' 分鐘':''}</p><h1>${esc(q.title)}</h1></div><span class="tag">練習 ${q.marks} 分</span></div><div class="mobile-view-switch" role="group" aria-label="原文與作答頁面"><button type="button" data-action="show-passage" aria-pressed="${mobileView==='passage'}">原文 · ${d.evidence.length} 句證據</button><button type="button" data-action="show-coach" aria-pressed="${mobileView==='coach'}">作答教練</button></div><div class="practice-layout" data-mobile-view="${mobileView}">${renderPassages(q,d)}<section class="coach-panel" aria-label="分步作答教練"><div class="step-tabs" role="tablist" aria-label="作答步驟">${['拆題','找證據','寫答案','自檢'].map((name,i)=>`<button id="step-tab-${i}" type="button" class="step-tab" data-step="${i}" role="tab" aria-selected="${d.step===i}" aria-controls="step-content" tabindex="${d.step===i?'0':'-1'}"><span aria-hidden="true">${i+1}</span>${name}</button>`).join('')}</div><div class="coach-body"><div class="prompt-block"><span class="tag">${esc(q.scope||'按題目要求作答')}</span><p class="prompt">${esc(q.prompt)}</p></div><div id="step-content" role="tabpanel" aria-labelledby="step-tab-${d.step}" tabindex="-1">${stepContent(q,d)}</div><div class="step-controls"><button type="button" class="button quiet" data-action="previous" ${d.step===0?'disabled':''}>← 上一步</button>${d.step<3?`<button type="button" class="button primary" data-action="next">下一步：${['','找證據','寫答案','自檢'][d.step+1]} →</button>`:'<a class="button secondary" href="#records">查看學習記錄 →</a>'}</div></div></section></div>`;
    if(focus)document.getElementById('step-content').focus({preventScroll:true});
  }
  function setStep(step) {if(!current)return;const d=draft(current);d.step=step;mobileView='coach';touch(d);renderPractice(current,true);document.querySelector('.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});}
  function updateEvidence(q,d) {
    main.querySelectorAll('[data-evidence]').forEach(el=>{const yes=d.evidence.includes(el.dataset.evidence);el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});
    const summary=document.getElementById('evidence-summary');if(summary)summary.textContent=`已選 ${d.evidence.length} 句 · ${q.scope||'按題目要求作答'}`;
    const list=document.getElementById('evidence-list');if(list)list.innerHTML=evidenceList(q,d);
    const mobile=main.querySelector('.mobile-view-switch [data-action="show-passage"]');if(mobile)mobile.textContent=`原文 · ${d.evidence.length} 句證據`;
    const feedback=document.getElementById('evidence-feedback');if(feedback)feedback.innerHTML='';
    const details=main.querySelector('details:not(.examples)');if(d.step===2&&details){const summary=details.querySelector('summary');summary.textContent=`查看已選文本證據（${d.evidence.length} 句）`;details.querySelectorAll('.evidence-item,.empty-state').forEach(el=>el.remove());details.insertAdjacentHTML('beforeend',evidenceList(q,d));}
  }
  function recordReport() {
    const lines=['閱讀理解答題教練｜學習記錄','匯出日期：'+formatDate(new Date().toISOString()),'本記錄為學生自評，並非正式評分。',''];
    for(const q of compiled.questions){const d=state.drafts[q.id];if(!hasWork(d))continue;lines.push('【'+q.title+'】',q.prompt,'狀態：'+(d.completedAt?'完成作答及自檢':'練習中'),'學生自評：'+C.selfScore(q,d)+' / '+q.marks+'（已做到的要點數）','使用提示：'+d.hintCount+' / '+q.hints.length,'','我的答案：',answerFor(q,d)||'尚未填寫','','自檢：',...q.rubric.map((r,i)=>`${i+1}. ${r.label}：${{yes:'已做到',unsure:'不確定',no:'未做到'}[d.checks[i]]||'未選'}`),'反思：'+(d.reflection||'未填寫'),'');}
    download('reading-coach-learning-record.txt',lines.join('\n'),'text/plain');
  }
  function renderRecords() {
    const rows=compiled.questions.filter(q=>hasWork(state.drafts[q.id]));
    const done=rows.filter(q=>state.drafts[q.id].completedAt).length;
    const hint=rows.reduce((n,q)=>n+state.drafts[q.id].hintCount,0);
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">LEARNING JOURNAL</div><h1>看見自己的進步</h1><p>記下答案、提示使用和自檢結果，為下一次作答找一個改進重點。</p></div><a href="#home" class="button primary">繼續練習 →</a></div><div class="stats-grid"><div class="stat"><strong>${done} / ${compiled.questions.length}</strong><span>已完成作答及自檢</span></div><div class="stat"><strong>${rows.length-done}</strong><span>已有草稿，尚未完成</span></div><div class="stat"><strong>${hint}</strong><span>已使用的提示級數</span></div></div><p class="note neutral">自評分數是你自行確認的答案要點數，不能代表 DSE 等級。修改答案後，原有自評會清除，請按新答案重新檢查。</p><div class="toolbar"><button type="button" class="button secondary" data-action="export-report">匯出學習記錄</button><button type="button" class="button secondary" data-action="export-backup">匯出完整備份</button><button type="button" class="button quiet" data-action="import-backup">還原備份</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><div class="record-list">${rows.length?rows.map(q=>{const d=state.drafts[q.id];return `<article class="record-row"><div><h3>${esc(q.title)}</h3><p>${esc(C.TYPES[q.type])} · ${d.completedAt?'已完成作答及自檢':'仍在練習'} · 提示 ${d.hintCount} 級${d.updatedAt?' · '+formatDate(d.updatedAt):''}</p>${d.reflection?`<p style="margin-top:7px">下一次：${esc(d.reflection)}</p>`:''}</div><div class="record-score"><span>學生自評</span><strong>${C.selfScore(q,d)} / ${q.marks}</strong><span>${q.rubric.every((_,i)=>d.checks[i])?'已逐項自檢':'自檢未完成'}</span></div><a class="button secondary" href="#practice/${esc(q.id)}">${d.completedAt?'重溫與修訂':'繼續作答'} →</a></article>`;}).join(''):'<div class="empty-state">還沒有練習記錄。從第一組開始，寫下自己的答案。</div>'}</div>`;
  }
  function teacherEditor(q=null) {
    editQuestionId=q?.id||null;
    const p=q?state.bank.passages.find(p=>p.id===q.passages[0]):null;
    const options=state.bank.passages.map(p=>`<option value="${esc(p.id)}" ${q?.passages[0]===p.id?'selected':''}>${esc(p.title)}</option>`).join('');
    const full=q?.examples.find(e=>e.score===q.rubric.length)||q?.examples.at(-1);
    return `<section class="surface" id="teacher-editor"><h2>${q?'編輯這道練習':'新增自己的練習'}</h2><p class="field-help">可新增文章，或用已加入的文章再設一題。每行評分要點作 1 分自檢；提示和例答可按題目調整。</p>${q?'<p class="note neutral">修改題目後，這道題的舊草稿和自評會清除；同一篇文章的其他題目會保留。</p>':''}<div id="teacher-errors" role="alert" hidden></div><form id="teacher-form" class="teacher-form"><h3 class="form-section">閱讀文章</h3><label class="field wide"><span class="field-label">使用哪篇文章？</span><select name="passage"><option value="new">新增一篇文章</option>${options}</select><span class="field-help">已有文章不在這裡修改；如需改寫原文，請另存一篇文章。</span></label><div id="new-passage-fields" class="wide" ${q?'hidden':''}><label class="field"><span class="field-label">文章標題</span><input type="text" name="articleTitle" maxlength="160" ${q?'':'required'}></label><label class="field"><span class="field-label">文章內容</span><textarea name="articleText" class="big" maxlength="100000" ${q?'':'required'} placeholder="每個段落以一個空白行分隔。">${q?'':''}</textarea><span class="field-help">最多 40 段，每段最多 4,000 字。請使用可供教學的文章。</span></label></div><h3 class="form-section">題目與作答要求</h3><label class="field"><span class="field-label">練習名稱</span><input type="text" name="title" maxlength="160" required value="${esc(q?.title||'')}"></label><label class="field"><span class="field-label">題型</span><select name="type">${Object.entries(C.TYPES).map(([k,v])=>`<option value="${k}" ${q?.type===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="field wide"><span class="field-label">題幹</span><textarea name="prompt" maxlength="2500" required>${esc(q?.prompt||'')}</textarea></label><label class="field"><span class="field-label">作答範圍</span><input type="text" name="scope" maxlength="200" value="${esc(q?.scope||'全文')}"></label><label class="field"><span class="field-label">字數上限（可留空）</span><input type="number" name="wordLimit" min="10" max="2000" step="1" value="${q?.wordLimit||''}"></label><label class="field wide"><span class="field-label">必須處理的要求</span><textarea class="compact" name="requirements" maxlength="2000" required placeholder="每行一項。例如：\n交代人物原來的想法\n說明後來的轉變及原因">${esc(q?.requirements.filter(r=>r.correct).map(r=>r.text).join('\n')||'')}</textarea></label><label class="field wide"><span class="field-label">拆題的錯誤選項（選填）</span><input type="text" name="distractor" maxlength="300" value="${esc(q?.requirements.find(r=>!r.correct)?.text||'')}"></label><h3 class="form-section">評分、自檢與提示</h3><label class="field wide"><span class="field-label">評分要點（1 至 8 項）</span><textarea name="rubric" class="big" maxlength="8500" required placeholder="每行一項，格式：名稱｜具體要求\n準確判斷｜指出人物由催促轉為耐心觀察\n文本依據｜以兩項言行支持判斷\n解釋關係｜說明言行怎樣反映態度">${esc(q?.rubric.map(r=>r.label+'｜'+r.detail).join('\n')||'')}</textarea></label>${[0,1,2].map(i=>`<label class="field ${i===2?'wide':''}"><span class="field-label">提示 ${i+1}（選填）</span><textarea class="compact" name="hint${i}" maxlength="1200">${esc(q?.hints[i]||'')}</textarea></label>`).join('')}<h3 class="form-section">例答比較</h3><label class="field wide"><span class="field-label">完整例答</span><textarea name="fullExample" class="big" maxlength="8000" required>${esc(full?.text||'')}</textarea></label><label class="field wide"><span class="field-label">完整例答評語</span><textarea class="compact" name="fullNote" maxlength="1000" required>${esc(full?.note||'')}</textarea></label><label class="field wide"><span class="field-label">部分達標例答（選填）</span><textarea name="partialExample" maxlength="8000">${esc(q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.text||'')}</textarea></label><label class="field"><span class="field-label">部分例答示範分數</span><input type="number" name="partialScore" min="0" max="8" step="1" value="${q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.score??1}"></label><label class="field"><span class="field-label">部分例答評語</span><textarea class="compact" name="partialNote" maxlength="1000">${esc(q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.note||'')}</textarea></label><label class="field wide"><span class="field-label">未達標例答（選填，示範 0 分）</span><textarea class="compact" name="weakExample" maxlength="8000">${esc(q?.examples.find(e=>e.score===0)?.text||'')}</textarea></label><label class="field wide"><span class="field-label">未達標例答評語</span><textarea class="compact" name="weakNote" maxlength="1000">${esc(q?.examples.find(e=>e.score===0)?.note||'')}</textarea></label><div class="button-row wide"><button class="button primary" type="submit">${q?'儲存修改':'加入練習題庫'}</button><button class="button secondary" type="button" data-action="close-editor">取消</button></div></form></section>`;
  }
  function renderTeacher(q=null) {
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">TEACHER WORKSPACE</div><h1>把教材變成分步練習</h1><p>加入文章、題目、提示及評分要點，讓學生練習有依據的作答。</p></div><button type="button" class="button primary" data-action="new-question">＋ 新增練習</button></div><p class="note">教師題庫儲存在這個瀏覽器。要交給學生或在另一部裝置使用，可先匯出題庫，再在對方的「教師題庫」匯入。</p><section class="surface"><div class="teacher-top"><div><h2>我的練習題庫</h2><p>${state.bank.passages.length} 篇文章 · ${state.bank.questions.length} 道題目</p></div><div class="button-row"><button class="button secondary" type="button" data-action="export-bank">匯出題庫</button><button class="button secondary" type="button" data-action="import-bank">匯入題庫</button><input type="file" id="bank-file" accept=".json,application/json" hidden></div></div>${state.bank.questions.length?state.bank.questions.map(q=>`<article class="teacher-card"><div><h3>${esc(q.title)}</h3><p>${esc(state.bank.passages.find(p=>p.id===q.passages[0])?.title||'自訂文章')} · ${esc(C.TYPES[q.type])} · ${q.rubric.length} 分自評</p></div><div class="button-row"><a class="button small secondary" href="#practice/${esc(q.id)}">試做</a><button class="button small quiet" data-action="edit-question" data-id="${esc(q.id)}">編輯</button><button class="button small quiet danger" data-action="delete-question" data-id="${esc(q.id)}">刪除</button></div></article>`).join(''):'<div class="empty-state" style="margin-top:24px">尚未加入自己的題目。按「新增練習」即可填入教材，<br>原有 9 道練習仍可在練習題庫使用。</div>'}</section><div id="editor-container">${q?teacherEditor(q):''}</div><p class="note neutral">本版集中支援推論、作用分析及比較題。原有材料為原創教學練習；教師新增的評分要點由教師制定。</p>`;
  }
  function route() {
    save();current=null;mobileView='coach';
    const path=location.hash.replace(/^#\/?/,'')||'home';
    const isPractice=path.startsWith('practice/');
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(isPractice?'home':path);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(isPractice){const id=path.slice(9);const q=byId(id);if(q)renderPractice(q);else{renderHome();toast('這道題目已不存在，請從題庫重新選擇。');}}
    else if(path==='records')renderRecords();else if(path==='teacher'){editQuestionId=null;renderTeacher();}else renderHome();
    main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function checkTask(q,d) {
    const selected=new Set(d.requirements),correct=q.requirements.every((r,i)=>selected.has(i)===r.correct)&&d.directive===q.directive;
    const target=document.getElementById('task-feedback');
    target.className='feedback'+(correct?'':' warning');
    target.innerHTML=`<strong>${correct?'拆題準確。接下來為每項要求找證據。':'再核對主要指令和作答範圍。'}</strong><p style="margin:8px 0 0">主要指令：${esc(q.directive)}</p><ul>${q.requirements.filter(r=>r.correct).map(r=>`<li>${esc(r.text)}</li>`).join('')}</ul><p style="margin:8px 0 0">不需要：${q.requirements.filter(r=>!r.correct).map(r=>esc(r.text)).join('；')||'按題目範圍作答，避免加入無關內容。'}</p>`;
  }
  main.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.evidence&&current){const d=draft(current),id=button.dataset.evidence;d.evidence=d.evidence.includes(id)?d.evidence.filter(x=>x!==id):[...d.evidence,id];touch(d);updateEvidence(current,d);return;}
    if(button.dataset.step!==undefined){setStep(Number(button.dataset.step));return;}
    const action=button.dataset.action;if(!action)return;
    const q=current,d=q?draft(q):null;
    if(action==='export-backup'){backup();return;}
    if(action==='export-report'){recordReport();return;}
    if(action==='import-backup'){document.getElementById('backup-file').click();return;}
    if(action==='export-bank'){download('reading-coach-teacher-bank.json',JSON.stringify(state.bank,null,2));toast('教師題庫已匯出。');return;}
    if(action==='import-bank'){document.getElementById('bank-file').click();return;}
    if(action==='new-question'){document.getElementById('editor-container').innerHTML=teacherEditor();document.getElementById('teacher-editor').scrollIntoView({block:'start'});document.querySelector('[name="articleTitle"]').focus({preventScroll:true});return;}
    if(action==='close-editor'){if(await confirmAction('關閉編輯','未儲存的表格內容將不保留。')){document.getElementById('editor-container').innerHTML='';editQuestionId=null;}return;}
    if(action==='edit-question'){const custom=state.bank.questions.find(q=>q.id===button.dataset.id);if(custom.passages.length!==1){toast('雙篇教師題目請以匯出題庫後修改、再匯入的方式編輯。');return;}renderTeacher(custom);document.getElementById('teacher-editor').scrollIntoView({block:'start'});return;}
    if(action==='delete-question'){const id=button.dataset.id;if(await confirmAction('刪除這道教師題目','會刪除此題及其草稿、自評記錄。文章仍保留，可用來新增其他題目。')){state.bank.questions=state.bank.questions.filter(q=>q.id!==id);delete state.drafts[id];rebuild();save();renderTeacher();toast('已刪除這道題目。');}return;}
    if(!q)return;
    if(action==='previous'){setStep(Math.max(0,d.step-1));return;}
    if(action==='next'){setStep(Math.min(3,d.step+1));return;}
    if(action==='revise'){setStep(2);return;}
    if(action==='hint'){d.hintCount=Math.min(q.hints.length,d.hintCount+1);touch(d);renderPractice(q);return;}
    if(action==='check-task'){checkTask(q,d);return;}
    if(action==='show-passage'||action==='show-coach'){mobileView=action==='show-passage'?'passage':'coach';main.querySelector('.practice-layout').dataset.mobileView=mobileView;main.querySelectorAll('.mobile-view-switch button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.action==='show-passage')===(mobileView==='passage')));main.querySelector(mobileView==='passage'?'.passage-panel':'.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});return;}
    if(action==='font-less'||action==='font-more'){const scroll=main.querySelector('.passage-scroll').scrollTop;state.readingSize=Math.max(16,Math.min(26,state.readingSize+(action==='font-more'?2:-2)));save();renderPractice(q);main.querySelector('.passage-scroll').scrollTop=scroll;return;}
    if(action==='remove-evidence'){d.evidence=d.evidence.filter(id=>id!==button.dataset.id);touch(d);updateEvidence(q,d);return;}
    if(action==='check-evidence'){const status=C.evidenceStatus(q,d.evidence,compiled.sentences);const target=document.getElementById('evidence-feedback');target.className='feedback';target.innerHTML=`<strong>是否觸及這些文本範圍？</strong><ul>${status.groups.map(g=>`<li>${g.found?'✓ 已選到相關句子：':'○ 尚未選到：'}${esc(g.label)}</li>`).join('')}</ul><p style="margin:10px 0 0">${status.extra.length?'另有 '+status.extra.length+' 句不在預設範圍，可再判斷是否貼題。':''}這只是原文範圍提示，不能判定證據或答案正確；合理的其他證據也可接受。</p>`;return;}
    if(action==='mode-free'||action==='mode-guided'){
      if(action==='mode-free'){if(d.mode==='free')return;if(!d.free.trim())d.free=answerFor(q,d);d.mode='free';}
      else {if(d.mode==='guided')return;if(d.free.trim()&&!(await confirmAction('切回分步作答','分步欄目會顯示原有內容。自由答案仍會保留，但不會自動拆入各欄；請自行整理，或稍後切回自由作答。')))return;d.mode='guided';}
      d.checks=[];delete d.completedAt;touch(d);renderPractice(q);return;
    }
    if(action==='structure'){const target=document.getElementById('structure-feedback');target.className='feedback warning';target.innerHTML=`<strong>答案結構提醒</strong><ul>${C.structuralFeedback(q,d,fieldsFor(q)).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;return;}
    if(action==='complete'){const message=C.completionError(q,d,fieldsFor(q));if(message){const el=document.getElementById('completion-error');el.className='feedback warning';el.textContent=message;return;}d.completedAt=new Date().toISOString();touch(d);renderPractice(q);toast('已記錄作答及自檢，可到學習記錄重溫。');return;}
  });
  main.addEventListener('input',event=>{
    if(!current)return;
    const el=event.target,d=draft(current);
    if(el.dataset.answer){C.changeAnswer(d,el.dataset.answer,el.value);touch(d,true);const preview=document.getElementById('answer-preview-text');if(preview)preview.textContent=answerFor(current,d)||'尚未填寫。';const count=document.getElementById('answer-count');if(count){const length=C.countChars(answerFor(current,d));count.textContent=`${length} 字${current.wordLimit?' / 上限 '+current.wordLimit+' 字':''}（不計空白）`;count.classList.toggle('over',!!current.wordLimit&&length>current.wordLimit);}const feedback=document.getElementById('structure-feedback');if(feedback)feedback.innerHTML='';}
    if(el.hasAttribute('data-reflection')){d.reflection=el.value;touch(d,true);}
  });
  main.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='question-select'){location.hash='practice/'+el.value;return;}
    if(el.name==='passage'){const fresh=el.value==='new';document.getElementById('new-passage-fields').hidden=!fresh;for(const name of ['articleTitle','articleText'])document.querySelector(`[name="${name}"]`).required=fresh;return;}
    if(el.id==='bank-file'||el.id==='backup-file'){const file=el.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('請選擇小於 2 MB 的題庫或備份檔。');const value=JSON.parse(await file.text());if(el.id==='bank-file')await importBank(value);else await importBackup(value);}catch(e){toast(e.message==='Unexpected end of JSON input'?'檔案不完整，請重新選擇有效的 JSON 檔。':e instanceof SyntaxError?'檔案不是有效的 JSON。':e.message);}finally{el.value='';}return;}
    if(!current)return;
    const d=draft(current);
    if(el.name==='directive'){d.directive=el.value;touch(d);const feedback=document.getElementById('task-feedback');if(feedback)feedback.innerHTML='';}
    if(el.name==='requirement'){const index=Number(el.value);d.requirements=el.checked?[...new Set([...d.requirements,index])]:d.requirements.filter(i=>i!==index);touch(d);const feedback=document.getElementById('task-feedback');if(feedback)feedback.innerHTML='';}
    if(el.dataset.check!==undefined){d.checks[Number(el.dataset.check)]=el.value;delete d.completedAt;touch(d);document.getElementById('self-score').textContent=`${C.selfScore(current,d)} / ${current.marks}`;const label=main.querySelector('.score-bar>div>span');label.textContent='學生自評'+(current.rubric.every((_,i)=>d.checks[i])?'':' · 尚未逐項完成');main.querySelector('.completion-note')?.remove();const complete=main.querySelector('[data-action="complete"]');complete.textContent='完成本題並記錄自評 ✓';}
  });
  main.addEventListener('toggle',event=>{if(event.target.id==='examples'&&event.target.open&&current&&answerFor(current,draft(current)).trim()){const d=draft(current);d.examplesViewed=true;touch(d);}},true);
  main.addEventListener('keydown',event=>{const tab=event.target.closest('[data-step]');if(!tab||!current)return;let step=Number(tab.dataset.step);if(event.key==='ArrowRight')step=(step+1)%4;else if(event.key==='ArrowLeft')step=(step+3)%4;else if(event.key==='Home')step=0;else if(event.key==='End')step=3;else return;event.preventDefault();setStep(step);document.getElementById('step-tab-'+step).focus({preventScroll:true});});
  async function importBank(value) {
    const errors=C.validateBank(value);if(errors.length)throw new Error(errors.slice(0,3).join('；'));
    const merged=C.mergeBanks(state.bank,value);const combinedErrors=C.validateBank(merged);if(combinedErrors.length)throw new Error(combinedErrors.slice(0,3).join('；'));
    const replacedQ=new Set(value.questions.filter(q=>state.bank.questions.some(x=>x.id===q.id)).map(q=>q.id));
    const changedPassages=new Set(value.passages.filter(p=>state.bank.passages.some(x=>x.id===p.id&&JSON.stringify(x)!==JSON.stringify(p))).map(p=>p.id));
    for(const q of state.bank.questions)if(q.passages.some(id=>changedPassages.has(id)))replacedQ.add(q.id);
    const message=`將加入或更新 ${value.questions.length} 道題目及 ${value.passages.length} 篇文章。${replacedQ.size?'同名識別碼會更新；受影響的 '+replacedQ.size+' 題草稿及自評會清除。':'原有題目和記錄會保留。'}`;
    if(!(await confirmAction('匯入教師題庫',message)))return;
    state.bank=merged;for(const id of replacedQ)delete state.drafts[id];rebuild();save();renderTeacher();toast('題庫已匯入，可以在練習題庫試做。');
  }
  async function importBackup(value) {
    if(value?.version!==1||!value.drafts||typeof value.drafts!=='object'||Array.isArray(value.drafts))throw new Error('這不是第 1 版的答題教練完整備份。');
    const errors=C.validateBank(value.bank);if(errors.length)throw new Error(errors.slice(0,3).join('；'));
    if(!(await confirmAction('還原完整備份','這會以備份內容取代此瀏覽器的教師題庫、草稿和記錄。建議先匯出目前的完整備份。')))return;
    const nextCompiled=C.compile({passages:[...base.passages,...value.bank.passages],questions:[...base.questions,...value.bank.questions]});
    const drafts={};for(const q of nextCompiled.questions)if(value.drafts[q.id])drafts[q.id]=C.sanitizeDraft(value.drafts[q.id],q,fieldsFor(q),nextCompiled.sentences);
    state={version:1,bank:value.bank,drafts,readingSize:[16,18,20,22,24,26].includes(value.readingSize)?value.readingSize:18};compiled=nextCompiled;storageBlocked=false;document.getElementById('storage-warning').hidden=true;save();renderRecords();toast('已還原備份。');
  }
  main.addEventListener('submit',async event=>{
    if(event.target.id!=='teacher-form')return;event.preventDefault();const form=event.target,data=new FormData(form),get=name=>String(data.get(name)||'').trim();
    const errors=[];const qid=editQuestionId||'custom-q-'+crypto.randomUUID();let pid=get('passage'),passage=null;
    if(pid==='new'){pid='custom-p-'+crypto.randomUUID();passage={id:pid,title:get('articleTitle'),label:'教師提供文章',paragraphs:get('articleText').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean)};}
    const rubric=get('rubric').split('\n').map(t=>t.trim()).filter(Boolean).map(line=>{const pos=line.search(/[｜|]/);return pos<0?{label:line,detail:line}:{label:line.slice(0,pos).trim(),detail:line.slice(pos+1).trim()};});
    const type=get('type'),directives={purpose:'分析作用',inference:'推論並說明',comparison:'比較並說明'},directive=directives[type];
    const requirements=get('requirements').split('\n').map(t=>t.trim()).filter(Boolean).map(text=>({text,correct:true}));if(get('distractor'))requirements.push({text:get('distractor'),correct:false});
    const examples=[];
    if(get('weakExample')){if(!get('weakNote'))errors.push('請為未達標例答補上評語。');examples.push({label:'未達標例答',score:0,text:get('weakExample'),note:get('weakNote')});}
    if(get('partialExample')){const score=Number(get('partialScore'));if(!get('partialNote'))errors.push('請為部分達標例答補上評語。');if(!Number.isInteger(score)||score<0||score>=rubric.length)errors.push('部分例答分數須低於完整例答分數。');examples.push({label:'部分達標例答',score,text:get('partialExample'),note:get('partialNote')});}
    examples.push({label:'完整例答',score:rubric.length,text:get('fullExample'),note:get('fullNote')});
    const question={id:qid,title:get('title'),type,level:'自訂練習',passages:[pid],scope:get('scope')||'全文',prompt:get('prompt'),directive,options:[directive,'只重述事件','加入自己的經歷'],requirements,rubric,hints:[0,1,2].map(i=>get('hint'+i)).filter(Boolean),examples,evidenceGroups:[]};
    if(get('wordLimit'))question.wordLimit=Number(get('wordLimit'));
    const bank={schemaVersion:1,passages:[...state.bank.passages,...(passage?[passage]:[])],questions:[...state.bank.questions.filter(q=>q.id!==qid),question]};
    errors.push(...C.validateBank(bank));
    if(errors.length){const el=document.getElementById('teacher-errors');el.hidden=false;el.className='form-error';el.textContent=errors.join('；');el.scrollIntoView({block:'center'});return;}
    if(editQuestionId&&!(await confirmAction('儲存修改','此題的草稿和自評記錄會清除，讓學生按新題目重新練習。')))return;
    state.bank=bank;delete state.drafts[qid];rebuild();save();editQuestionId=null;renderTeacher();toast('題目已儲存。按「試做」查看分步練習。');
  });
  window.addEventListener('hashchange',route);
  window.addEventListener('pagehide',save);
  route();
}());
