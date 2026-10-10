(function () {
  'use strict';
  const C = window.CoachCore, E = window.ExamCoach, base = window.COACH_DATA, exam = window.COACH_EXAM_DATA, coaching = window.COACH_EXAM_COACHING, esc = C.escapeHTML;
  const main = document.getElementById('main');
  const KEY = 'dse-reading-coach-v1';
  const emptyBank = () => ({schemaVersion:1, passages:[], questions:[]});
  let state = {version:1, bank:emptyBank(), drafts:{}, readingSize:18};
  let compiled, current = null, mobileView = 'coach', coachingView = false, saveTimer, toastTimer, pendingConfirm;
  let storageBlocked = false, editQuestionId = null;
  const groups = [
    {number:'01',title:'還亮著的燈',label:'從人物變化入手',description:'一部舊收音機，讓我們重新理解傾聽、回憶和舊物的價值。',ids:['lamp-inference','lamp-purpose','lamp-comparison']},
    {number:'02',title:'種子沒有準時',label:'從前後關係入手',description:'比較兩張表的用途，從具體細節推論觀念與態度的改變。',ids:['seed-inference','seed-purpose','seed-comparison']},
    {number:'03',title:'快慢之間',label:'從雙篇比較入手',description:'慢走和趕路的選擇不同。試從兩篇文章找出共同的衡量準則。',ids:['pace-inference','pace-purpose','pace-comparison']}
  ];
  const byId = id => compiled.questions.find(q => q.id === id);
  const fieldsFor = q => q.answerParts || base.fields[q.type];
  const answerFor = (q,d) => C.assembleAnswer(d,fieldsFor(q));
  const hasWork = d => d && (d.completedAt || d.free?.trim() || Object.values(d.fields || {}).some(v=>v.trim()) || d.evidence?.length || d.hintCount);
  const formatDate = s => {const dt=new Date(s);return Number.isFinite(+dt)?new Intl.DateTimeFormat('zh-HK',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt):'';};
  function storageWarning(message) {const el=document.getElementById('storage-warning');el.hidden=false;el.textContent=message;}
  function rebuild() {compiled=C.compile({passages:[...base.passages,...exam.passages,...state.bank.passages],questions:[...base.questions,...exam.questions,...state.bank.questions]});}
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
  function draft(q) {return state.drafts[q.id] ||= C.newDraft(q);}
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
  function allGroups() {return [{number:'2024',title:'DSE真題 · 繁盛',ids:exam.questions.map(q=>q.id)},...groups,...(state.bank.questions.length?[{number:'＋',title:'教師新增練習',label:'自訂題庫',description:'以老師提供的文章、題幹和評分要點練習。',ids:state.bank.questions.map(q=>q.id)}]:[])];}
  function reviewCountText(q,d) {return C.selfScore(q,d)+' / '+(q.authentic?q.rubric.length:q.marks)+(q.authentic?' 項':'');}
  function examFeature() {
    const done=exam.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    const next=exam.questions.find(q=>!state.drafts[q.id]?.completedAt)||exam.questions[0];
    return `<section class="exam-feature" aria-labelledby="exam-feature-title"><div><div class="eyebrow">2024 DSE · 真實篇章與原題</div><h2 id="exam-feature-title">李娟《繁盛》</h2><p>在荒涼與希望之間，練習讀準人物、意象與生命的寄意。</p><div class="exam-facts"><span>15 段原文</span><span>第 9–20 題</span><span>12 題 · 35 分</span><span>${done} / 12 題完成</span></div><p class="field-help">文章、題目及答案依你提供的 2024 年文件；拆題、提示與證據解釋為教練分析。</p></div><div class="button-row"><a class="button primary" href="#practice/${esc(next.id)}">${done?'繼續真題練習':'開始《繁盛》練習'} →</a><a class="button secondary" href="#exercise/dse2024-fansheng">查看整份練習</a></div></section>`;
  }
  function renderExamOverview() {
    const done=exam.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    main.innerHTML=`<a class="back-link" href="#home">← 返回練習題庫</a><div class="page-head"><div><div class="eyebrow">2024 DSE · CHINESE READING</div><h1>李娟《繁盛》</h1><p>原卷第一篇 · 15段 · 第9–20題 · 35分 · 已完成 ${done}/12 題</p></div><a class="button primary" href="#practice/${esc((exam.questions.find(q=>!state.drafts[q.id]?.completedAt)||exam.questions[0]).id)}">進入練習 →</a></div><p class="note">文章、原題及來源答案保留文件內容。選擇題按文件答案核對；書面題保留原分值及評分準則，交由教師評閱。教練自檢不換算分數。</p><p class="note neutral">逐題精講會示範如何找證據、補推論、排除干擾選項，並以文件低分舉隅拆解失分與修訂。可先作答再核對，也可直接閱讀精講。</p><div class="toolbar"><a class="button primary" href="#coaching/dse2024-q9">直接閱讀逐題精講 →</a><button type="button" class="button secondary" data-action="download-exam">下載練習文字稿</button><button type="button" class="button quiet" data-action="download-exam-answers">下載答案與教練分析</button></div>${E.methodsHTML(coaching)}<section class="exam-question-grid" aria-label="繁盛原題列表">${exam.questions.map(original=>{const q=byId(original.id),d=state.drafts[q.id];return `<article class="surface exam-question-card"><span class="tag">原題 ${q.marks}分</span><h2>${esc(q.title)}</h2><p class="field-help">${esc(q.typeLabel)} · ${esc(q.scope)}</p><p>${esc(q.prompt)}</p><a class="button secondary" href="#practice/${esc(q.id)}">${d?.completedAt?'重溫與修訂':hasWork(d)?'繼續作答':'開始作答'} →</a><a class="text-link lesson-link" href="#coaching/${esc(q.id)}">閱讀本題精講與失分修訂 →</a></article>`;}).join('')}</section><section class="surface exam-sources"><h2>資料依據</h2><p class="field-help">原文及原題以資料夾的原卷PDF為準，文字稿只協助轉錄；評卷表格已按各分數欄核對。紙本行末換行與答題線改為網頁格式。</p><ul>${[...exam.sources,...coaching.references].map(s=>`<li><strong>${esc(s.name)}</strong> · 第${esc(s.pages)}頁<br><span class="muted">${esc(s.role)}</span></li>`).join('')}</ul><p class="note neutral">教練新增：逐題解題示範、逐項排除、失分例診斷與修訂、通用方法、句式、三級提示及自檢。文件答案與教練分析在作答頁分開標示。</p></section>`;
  }
  function examStepContent(q,d) {
    if(d.step===2)return `<div class="step-label">STEP 03 · 按原題的分題位置作答</div><h2 class="step-title">寫下自己的答案</h2><p class="step-description">選擇題逐項作答；表格題及分題保留原題的位置與分值。先試答，再到下一步核對來源答案。</p>${E.stageHTML(coaching.lessons[q.id],2)}${E.answerHTML(q,d)}<details class="selected-evidence"><summary class="text-link">查看已選文本證據（${d.evidence.length} 句）</summary>${evidenceList(q,d)}</details>${answerPreview(q,d)}<button type="button" class="button secondary" data-action="structure">檢查作答格式</button><div id="structure-feedback" aria-live="polite"></div>${hintBox(q,d)}`;
    const all=q.rubric.every((_,i)=>d.checks[i]);
    return `<div class="step-label">STEP 04 · 核對來源，再作教練自檢</div><h2 class="step-title">核對答案與文本證據</h2>${answerPreview(q,d)}<div class="button-row"><button type="button" class="button small secondary" data-action="revise">← 返回修訂答案</button><button type="button" class="button primary" data-action="review-source" ${d.examReviewed?'disabled':''}>${d.examReviewed?'已核對來源答案':'核對來源答案'}</button></div><div id="source-review-error" aria-live="polite"></div>${d.examReviewed?E.markingHTML(q,d)+E.lessonHTML(q,coaching.lessons[q.id])+`<details class="source-criteria"><summary>快速證據索引</summary>${E.evidenceHTML(q,d)}</details>`:'<p class="note neutral" style="margin-top:18px">先完成每個分題，按「核對來源答案」後才展開答案、評分資料及證據分析。</p>'}${d.examReviewed&&q.answerParts.some(p=>p.kind!=='choice')?`<details class="source-criteria general-criteria"><summary>一般評分原則（文件摘錄）</summary><ul>${exam.generalCriteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}<h3 class="exam-check-heading">教練自檢 · 不換算分數</h3><p class="step-description">按自己已寫出的內容選擇；這些項目用來修訂答案，不是原卷的一分一點評分表。</p>${q.rubric.map((r,i)=>`<fieldset class="rubric-item"><legend><span class="rubric-label">${i+1}. ${esc(r.label)}</span><span class="rubric-detail">${esc(r.detail)}</span></legend><div class="self-options">${[['yes','已做到'],['unsure','不確定'],['no','未做到']].map(([value,label])=>`<label><input type="radio" name="check-${i}" data-check="${i}" value="${value}" ${d.checks[i]===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`).join('')}<div class="score-bar"><div><span>教練自檢 ${all?'':'· 尚未逐項完成'}</span><br><strong id="self-score">${reviewCountText(q,d)}</strong></div><span>自檢項目數<br>不代表原題得分</span></div><label class="field"><span class="field-label">下一次，我會特別留意……（選填）</span><textarea class="compact" data-reflection maxlength="1500" placeholder="記下這題需要修訂的概念、證據或說明。">${esc(d.reflection||'')}</textarea></label><button type="button" class="button primary" data-action="complete">${d.completedAt?'更新完成記錄':'完成本題並記錄自檢'} ✓</button>${d.completedAt?`<p class="note completion-note">已完成作答、來源核對及自檢 · ${formatDate(d.completedAt)}<br>完成記錄不代表答案全對；仍可返回修訂。</p>`:''}<div id="completion-error" aria-live="polite"></div>`;
  }
  function renderCoaching(q) {
    current=q;coachingView=true;const d=draft(q),lesson=coaching.lessons[q.id];
    main.innerHTML=`<div class="practice-top"><a class="back-link" href="#exercise/dse2024-fansheng">← 返回《繁盛》練習</a><span class="save-label">${storageBlocked?'尚未儲存，請匯出備份':'草稿證據保存在此瀏覽器'}</span><label class="practice-select">切換精講 <select id="question-select" aria-label="切換逐題精講">${exam.questions.map(item=>`<option value="${esc(item.id)}" ${item.id===q.id?'selected':''}>第${item.number}題 · ${esc(item.typeLabel)}</option>`).join('')}</select></label></div><div class="question-heading"><div><p>2024 DSE 李娟《繁盛》 · 逐題精講</p><h1>第${q.number}題 · ${esc(q.typeLabel)}</h1></div><a class="button secondary" href="#practice/${esc(q.id)}">返回本題作答 →</a></div><div class="mobile-view-switch" role="group" aria-label="原文與精講頁面"><button type="button" data-action="show-passage" aria-pressed="${mobileView==='passage'}">原文 · ${d.evidence.length} 句證據</button><button type="button" data-action="show-coach" aria-pressed="${mobileView==='coach'}">逐題精講</button></div><div class="practice-layout" data-mobile-view="${mobileView}">${renderPassages(q,d)}<section class="coach-panel" aria-label="逐題精講與失分修訂"><div class="coach-body"><div class="prompt-block"><span class="tag">原題 ${q.marks}分</span>${E.promptHTML(q)}</div><details class="selected-evidence"><summary>已標註的證據 · 可與本題作答共用</summary><div id="evidence-list">${evidenceList(q,d)}</div></details>${E.lessonHTML(q,lesson,{standalone:true})}<details class="coaching-source"><summary>核對文件答案及各品第準則</summary>${E.markingHTML(q,d,{reveal:true})}</details><div class="lesson-navigation">${q.number>9?`<a class="button secondary" href="#coaching/dse2024-q${q.number-1}">← 上一題精講</a>`:''}<a class="button primary" href="${q.number<20?'#coaching/dse2024-q'+(q.number+1):'#exercise/dse2024-fansheng'}">${q.number<20?'下一題精講 →':'返回整份練習 →'}</a></div></div></section></div>`;
  }
  const statusSymbol = d => d?.completedAt?'✓':hasWork(d)?'·':'';
  function renderHome() {
    const total=compiled.questions.length,done=compiled.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    const last=compiled.questions.filter(q=>hasWork(state.drafts[q.id])&&!state.drafts[q.id].completedAt).sort((a,b)=>(state.drafts[b.id].updatedAt||'').localeCompare(state.drafts[a.id].updatedAt||''))[0];
    const first=last || byId('dse2024-q9');
    main.innerHTML=`<section class="hero"><div><div class="eyebrow">READ · THINK · EXPLAIN</div><h1>把想法，<br>寫成有根據的答案。</h1><p>閱讀理解不止是找到一句話。先讀準題目，再挑選文本證據，把「為甚麼」和「如何」說清楚。</p><div class="button-row"><a class="button primary" href="#practice/${esc(first.id)}">${last?'繼續上次練習':'開始第一道練習'} <span aria-hidden="true">→</span></a><a class="button quiet" href="#records">查看學習記錄</a></div></div><aside class="hero-card"><span class="small-label">你的練習進度</span><strong>${done}<span style="font-size:16px;opacity:.8"> / ${total} 題</span></strong><span class="small-label">已完成作答及自檢</span><div class="mini-line">DSE真題 · 原創練習 · 分步提示<br>自評幫你找出下一次要改進的地方。</div></aside></section>
    ${examFeature()}<div class="section-heading"><h2>一次練一個重點</h2><p>每組由人物推論到作用分析，再到比較</p></div><section class="series-grid" aria-label="練習組別">${allGroups().slice(1).map(g=>{
      const n=g.ids.filter(id=>state.drafts[id]?.completedAt).length, next=g.ids.find(id=>!state.drafts[id]?.completedAt)||g.ids[0];
      return `<article class="series-card"><div class="series-top"><span class="series-number">${g.number}</span><span class="tag">${esc(g.label)}</span></div><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><ul class="question-list">${g.ids.map((id,i)=>{const q=byId(id),d=state.drafts[id];return `<li><a href="#practice/${esc(id)}"><span class="question-status ${d?.completedAt?'done':''}" aria-label="${d?.completedAt?'已完成':hasWork(d)?'已有草稿':'尚未開始'}">${statusSymbol(d)||i+1}</span><span class="question-title">${esc(q.title)}</span><span class="question-meta">${q.marks}分</span></a></li>`;}).join('')}</ul><div class="series-bottom"><span>${n} / ${g.ids.length} 題完成</span><a class="button small secondary" href="#practice/${esc(next)}">${n===g.ids.length?'重溫這一組':'進入練習'} →</a></div></article>`;
    }).join('')}</section><section class="how-strip" aria-label="四個作答步驟">${[['讀準題目','分清指令、範圍及作答要求。'],['找到證據','點選原文，保留最貼題的線索。'],['組織答案','把判斷、依據和解釋連在一起。'],['自檢與修訂','比較例答，找出仍欠缺的關係。']].map((x,i)=>`<div><h3><span>0${i+1}</span>${x[0]}</h3><p>${x[1].replace('题','題')}</p></div>`).join('')}</section><p class="note neutral" style="margin-top:22px">本版有 3 組原創材料、9 道練習，另有2024 DSE《繁盛》15段原文及第9–20題。原創練習用要點作教學自評；真題按來源答案核對，書面題仍須教師評閱。</p>`;
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
  function hintBox(q,d) {return `<aside class="hint-box"><div class="hint-head"><h3>需要一點提示？</h3><span class="muted" style="font-size:11px">已使用 ${d.hintCount} / ${q.hints.length} 級</span></div>${q.hints.slice(0,d.hintCount).map((h,i)=>`<p><span class="hint-level">提示 ${i+1}</span>${esc(h)}</p>`).join('')}<button type="button" class="button small secondary" data-action="hint" style="margin-top:14px" ${d.hintCount>=q.hints.length?'disabled':''}>${d.hintCount>=q.hints.length?'提示已全部展開':d.hintCount?'解鎖下一級提示':'查看第一級提示'}</button><p class="muted" style="font-size:11px">提示使用次數會記錄，可用來回顧需要支援的地方。</p></aside>`;}
  function answerPreview(q,d) {const a=answerFor(q,d);return `<div class="answer-preview"><h3>我的答案</h3><p class="answer-text" id="answer-preview-text">${a.trim()?esc(a):'尚未填寫。請先試寫，再查看例答。'}</p><div class="answer-count ${q.wordLimit&&C.countChars(a)>q.wordLimit?'over':''}" id="answer-count">${C.countChars(a)} 字${q.wordLimit?' / 上限 '+q.wordLimit+' 字':''}（不計空白）</div></div>`;}
  function stepContent(q,d) {
    if(q.authentic&&d.step>=2)return examStepContent(q,d);
    if(d.step===0)return `<div class="step-label">STEP 01 · 先確認自己要回答甚麼</div><h2 class="step-title">拆開題目要求</h2><p class="step-description">先選主要指令，再從處理原則辨別本題需要做甚麼。</p><fieldset><legend>這道題主要要求你做甚麼？</legend>${q.options.map(o=>`<label class="choice"><input type="radio" name="directive" value="${esc(o)}" ${d.directive===o?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset><fieldset ${q.taskPlan?'aria-describedby="task-principles-help"':''}><legend>答案應處理哪些內容？可選多項。</legend>${q.taskPlan?'<p id="task-principles-help" class="field-help task-principles-help">以下是不同題型的通用處理原則。請依題幹選出本題須處理的項目；多分題可能涉及數項。核對時也會說明哪些方法可輔助思考。找證據與留意作答範圍，是每題的共同基礎。</p>':''}<div class="${q.taskPlan?'task-principles':''}">${q.requirements.map((r,i)=>{const key=C.requirementKey(r,i);return `<label class="choice"><input type="checkbox" name="requirement" value="${esc(key)}" ${d.requirements.includes(key)?'checked':''}><span>${esc(r.text)}</span></label>`;}).join('')}</div></fieldset><button type="button" class="button secondary" data-action="check-task">核對拆題</button><div id="task-feedback" aria-live="polite"></div>${hintBox(q,d)}`;
    if(d.step===1)return `<div class="step-label">STEP 02 · 用原文支持判斷</div><h2 class="step-title">挑選最貼題的證據</h2><p class="step-description">在原文點選句子。想想每一句支持答案的哪一部分，避免把「有圈句子」當成「已解釋」。</p><button type="button" class="button secondary" data-action="show-passage">到原文選取證據 →</button><div id="evidence-list">${evidenceList(q,d)}</div><button type="button" class="button secondary" data-action="check-evidence" ${!q.evidenceGroups.length?'disabled':''}>核對證據範圍</button><div id="evidence-feedback" aria-live="polite"></div>${!q.evidenceGroups.length?'<p class="field-help">這道教師題目未設定證據範圍，請按題幹自行判斷。</p>':''}${hintBox(q,d)}`;
    if(d.step===2)return `<div class="step-label">STEP 03 · 不只複述，要交代關係</div><h2 class="step-title">把線索寫成答案</h2><p class="step-description">依照框架試寫，或選擇自由作答。欄目幫助組織思路，實際答案仍須按題目調整。</p><div class="mode-switch" role="group" aria-label="作答模式"><button type="button" data-action="mode-guided" aria-pressed="${d.mode!=='free'}">分步作答</button><button type="button" data-action="mode-free" aria-pressed="${d.mode==='free'}">自由作答</button></div>${d.mode==='free'?`<label class="field"><span class="field-label">寫下你的答案</span><textarea class="big" data-answer="free" maxlength="12000" placeholder="直接回應題目，用具體文本證據支持，再解釋兩者的關係。">${esc(d.free)}</textarea></label>`:fieldsFor(q).map(f=>`<label class="field"><span class="field-label">${esc(f.label)}</span><textarea data-answer="${esc(f.key)}" maxlength="5000" placeholder="${esc(f.placeholder)}">${esc(d.fields[f.key]||'')}</textarea></label>`).join('')}<details class="selected-evidence"><summary class="text-link" style="cursor:pointer">查看已選文本證據（${d.evidence.length} 句）</summary>${evidenceList(q,d)}</details>${answerPreview(q,d)}<button type="button" class="button secondary" data-action="structure">檢查答案結構</button><div id="structure-feedback" aria-live="polite"></div><p class="field-help">結構提醒只檢查是否有內容和常見表達，不判斷意思是否正確。</p>${hintBox(q,d)}`;
    const a=answerFor(q,d),all=q.rubric.every((_,i)=>d.checks[i]);
    return `<div class="step-label">STEP 04 · 找出下一次可以改進的地方</div><h2 class="step-title">自檢，再比較例答</h2><p class="step-description">逐項查看自己的答案。只有答案中已寫清楚的內容，才選「已做到」；不能把腦中想過的內容當成已寫。</p>${answerPreview(q,d)}<button type="button" class="button small secondary" data-action="revise">← 返回修訂答案</button><p class="note neutral" style="margin-top:20px">以下每項作 1 分自評檢查；合計只表示你自行確認的答案要素。正式評分還須考慮意思準確、論述和整體表現，由老師評閱。</p>${q.rubric.map((r,i)=>`<fieldset class="rubric-item"><legend><span class="rubric-label">${i+1}. ${esc(r.label)} <span class="muted" style="font-size:11px">／1 分</span></span><span class="rubric-detail">${esc(r.detail)}</span></legend><div class="self-options">${[['yes','已做到'],['unsure','不確定'],['no','未做到']].map(([value,label])=>`<label><input type="radio" name="check-${i}" data-check="${i}" value="${value}" ${d.checks[i]===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`).join('')}<div class="score-bar"><div><span>學生自評 ${all?'':'· 尚未逐項完成'}</span><br><strong id="self-score">${C.selfScore(q,d)} / ${q.marks}</strong></div><span>「不確定」暫不計入<br>系統沒有判定答案正確</span></div><details class="examples" id="examples" ${d.examplesViewed?'open':''}><summary>比較不同程度例答</summary>${a.trim()?`<p class="field-help">例答分數依本練習的要點示範，並非官方評分。合理而有文本支持的其他表達也可接受。</p>${q.examples.map(e=>`<article class="example"><div class="example-head"><strong>${esc(e.label)}</strong><span class="tag">示範 ${e.score} / ${q.marks} 分</span></div><p>${esc(e.text)}</p><p class="note">${esc(e.note)}</p></article>`).join('')}`:'<p class="note">請先寫下自己的答案，再來比較例答。</p>'}</details><label class="field" style="margin-top:24px"><span class="field-label">下一次，我會特別留意……（選填）</span><textarea class="compact" data-reflection maxlength="1500" placeholder="例如：比較題要以同一角度寫出兩方，不能只有兩段內容。">${esc(d.reflection||'')}</textarea></label><button type="button" class="button primary" data-action="complete">${d.completedAt?'更新完成記錄':'完成本題並記錄自評'} ✓</button>${d.completedAt?`<p class="note completion-note">已完成作答及自檢 · ${formatDate(d.completedAt)}<br>完成記錄不代表答案全對；仍可返回修訂。</p>`:''}<div id="completion-error" aria-live="polite"></div>`;
  }
  function renderPractice(q, focus=false) {
    current=q;coachingView=false;const d=draft(q);
    main.innerHTML=`<div class="practice-top"><a class="back-link" href="${q.authentic?'#exercise/dse2024-fansheng':'#home'}">← ${q.authentic?'返回《繁盛》練習':'返回練習題庫'}</a><span class="save-label">${storageBlocked?'尚未儲存，請匯出備份':'草稿自動保存在此瀏覽器'}</span><label class="practice-select">切換題目 <select id="question-select" aria-label="切換練習題目">${allGroups().map(g=>`<optgroup label="${esc(g.title)}">${g.ids.map(id=>`<option value="${esc(id)}" ${id===q.id?'selected':''}>${esc(byId(id).title)}</option>`).join('')}</optgroup>`).join('')}</select></label></div><div class="question-heading"><div><p>${esc(q.typeLabel||C.TYPES[q.type])} · ${esc(q.level||'自訂練習')} ${q.minutes?'· 建議 '+q.minutes+' 分鐘':''}</p><h1>${esc(q.title)}</h1></div><div class="question-actions"><span class="tag">練習 ${q.marks} 分</span>${q.authentic?`<a class="text-link lesson-link" href="#coaching/${esc(q.id)}">閱讀本題精講 →</a>`:''}</div></div><div class="mobile-view-switch" role="group" aria-label="原文與作答頁面"><button type="button" data-action="show-passage" aria-pressed="${mobileView==='passage'}">原文 · ${d.evidence.length} 句證據</button><button type="button" data-action="show-coach" aria-pressed="${mobileView==='coach'}">作答教練</button></div><div class="practice-layout" data-mobile-view="${mobileView}">${renderPassages(q,d)}<section class="coach-panel" aria-label="分步作答教練"><div class="step-tabs" role="tablist" aria-label="作答步驟">${['拆題','找證據','寫答案','自檢'].map((name,i)=>`<button id="step-tab-${i}" type="button" class="step-tab" data-step="${i}" role="tab" aria-selected="${d.step===i}" aria-controls="step-content" tabindex="${d.step===i?'0':'-1'}"><span aria-hidden="true">${i+1}</span>${name}</button>`).join('')}</div><div class="coach-body"><div class="prompt-block"><span class="tag">${esc(q.scope||'按題目要求作答')}</span>${q.authentic?E.promptHTML(q):`<p class="prompt">${esc(q.prompt)}</p>`}</div><div id="step-content" role="tabpanel" aria-labelledby="step-tab-${d.step}" tabindex="-1">${q.authentic&&d.step<2?E.stageHTML(coaching.lessons[q.id],d.step):''}${stepContent(q,d)}</div><div class="step-controls"><button type="button" class="button quiet" data-action="previous" ${d.step===0?'disabled':''}>← 上一步</button>${d.step<3?`<button type="button" class="button primary" data-action="next">下一步：${['','找證據','寫答案','自檢'][d.step+1]} →</button>`:q.authentic?`<a class="button primary" href="${q.number<20?'#practice/dse2024-q'+(q.number+1):'#exercise/dse2024-fansheng'}">${q.number<20?'下一題 →':'返回整份練習 →'}</a>`:'<a class="button secondary" href="#records">查看學習記錄 →</a>'}</div></div></section></div>`;
    if(focus)document.getElementById('step-content').focus({preventScroll:true});
  }
  function setStep(step) {if(!current)return;const d=draft(current);d.step=step;mobileView='coach';touch(d);renderPractice(current,true);document.querySelector('.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});}
  function updateEvidence(q,d) {
    main.querySelectorAll('[data-evidence]').forEach(el=>{const yes=d.evidence.includes(el.dataset.evidence);el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});
    const summary=document.getElementById('evidence-summary');if(summary)summary.textContent=`已選 ${d.evidence.length} 句 · ${q.scope||'按題目要求作答'}`;
    const list=document.getElementById('evidence-list');if(list)list.innerHTML=evidenceList(q,d);
    const mobile=main.querySelector('.mobile-view-switch [data-action="show-passage"]');if(mobile)mobile.textContent=`原文 · ${d.evidence.length} 句證據`;
    const feedback=document.getElementById('evidence-feedback');if(feedback)feedback.innerHTML='';
    const details=main.querySelector('details.selected-evidence');if(d.step===2&&details&&!coachingView){const summary=details.querySelector('summary');summary.textContent=`查看已選文本證據（${d.evidence.length} 句）`;details.querySelectorAll('.evidence-item,.empty-state').forEach(el=>el.remove());details.insertAdjacentHTML('beforeend',evidenceList(q,d));}
  }
  function recordReport() {
    const lines=['閱讀理解答題教練｜學習記錄','匯出日期：'+formatDate(new Date().toISOString()),'本記錄為學生自評，並非正式評分。',''];
    for(const q of compiled.questions){const d=state.drafts[q.id];if(!hasWork(d))continue;lines.push('【'+q.title+'】',q.authentic?E.questionText(q):q.prompt,'狀態：'+(d.completedAt?'完成作答及自檢':'練習中'),q.authentic?E.scoreText(q,d)+'；教練自檢：'+reviewCountText(q,d):'學生自評：'+reviewCountText(q,d)+'（已做到的要點數）','使用提示：'+d.hintCount+' / '+q.hints.length,'','我的答案：',answerFor(q,d)||'尚未填寫','','自檢：',...q.rubric.map((r,i)=>`${i+1}. ${r.label}：${{yes:'已做到',unsure:'不確定',no:'未做到'}[d.checks[i]]||'未選'}`),'反思：'+(d.reflection||'未填寫'),'');}
    download('reading-coach-learning-record.txt',lines.join('\n'),'text/plain');
  }
  function renderRecords() {
    const rows=compiled.questions.filter(q=>hasWork(state.drafts[q.id]));
    const done=rows.filter(q=>state.drafts[q.id].completedAt).length;
    const hint=rows.reduce((n,q)=>n+state.drafts[q.id].hintCount,0);
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">LEARNING JOURNAL</div><h1>看見自己的進步</h1><p>記下答案、提示使用和自檢結果，為下一次作答找一個改進重點。</p></div><a href="#home" class="button primary">繼續練習 →</a></div><div class="stats-grid"><div class="stat"><strong>${done} / ${compiled.questions.length}</strong><span>已完成作答及自檢</span></div><div class="stat"><strong>${rows.length-done}</strong><span>已有草稿，尚未完成</span></div><div class="stat"><strong>${hint}</strong><span>已使用的提示級數</span></div></div><p class="note neutral">原創練習記錄教學自評；真題記錄客觀題核對結果及教練自檢，書面題待教師評閱。修改答案後，舊核對結果、自檢及完成標記會清除，請重新檢查。</p><div class="toolbar"><button type="button" class="button secondary" data-action="export-report">匯出學習記錄</button><button type="button" class="button secondary" data-action="export-backup">匯出完整備份</button><button type="button" class="button quiet" data-action="import-backup">還原備份</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><div class="record-list">${rows.length?rows.map(q=>{const d=state.drafts[q.id];return `<article class="record-row"><div><h3>${esc(q.title)}</h3><p>${esc(q.typeLabel||C.TYPES[q.type])} · ${d.completedAt?'已完成作答及自檢':'仍在練習'} · 提示 ${d.hintCount} 級${d.updatedAt?' · '+formatDate(d.updatedAt):''}</p>${d.reflection?`<p style="margin-top:7px">下一次：${esc(d.reflection)}</p>`:''}</div><div class="record-score"><span>${q.authentic?'真題記錄':'學生自評'}</span><strong class="${q.authentic?'exam-score-text':''}">${q.authentic?esc(E.scoreText(q,d)):reviewCountText(q,d)}</strong>${q.authentic?`<span>教練自檢：${reviewCountText(q,d)}</span>`:''}<span>${q.rubric.every((_,i)=>d.checks[i])?'已逐項自檢':'自檢未完成'}</span></div><a class="button secondary" href="#practice/${esc(q.id)}">${d.completedAt?'重溫與修訂':'繼續作答'} →</a></article>`;}).join(''):'<div class="empty-state">還沒有練習記錄。從第一組開始，寫下自己的答案。</div>'}</div>`;
  }
  function teacherTaskEditor(q) {
    if(q&&!q.taskPlan)return `<div class="wide"><p class="field-help">這道舊題保留教師原有的拆題選項。新建練習會使用共用處理原則。</p><label class="field"><span class="field-label">必須處理的要求</span><textarea class="compact" name="requirements" maxlength="2000" required>${esc(q.requirements.filter(r=>r.correct).map(r=>r.text).join('\n'))}</textarea></label><label class="field"><span class="field-label">其他拆題選項（選填）</span><input type="text" name="distractor" maxlength="300" value="${esc(q.requirements.find(r=>!r.correct)?.text||'')}"></label></div>`;
    const plan=q?.taskPlan||{required:[],support:[]};
    return `<fieldset class="wide"><legend>本題適用的通用處理原則</legend><p class="field-help task-principles-help">學生會看到全部16項原則。請標示至少一項「必須處理」；「可輔助思考」可選可不選，不當作答錯。</p><input type="hidden" name="taskPlanVersion" value="${C.TASK_VERSION}"><div class="task-principle-editor">${C.TASK_PRINCIPLES.map(p=>`<label class="field"><span class="field-label">${esc(p.text)}</span><select name="task-${p.id}">${[['none','本題未要求'],['required','必須處理'],['support','可輔助思考']].map(([value,label])=>`<option value="${value}" ${(plan.required.includes(p.id)?'required':plan.support.includes(p.id)?'support':'none')===value?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div><label class="field"><span class="field-label">核對後的拆題說明（選填）</span><textarea class="compact" name="taskNote" maxlength="1000" placeholder="說明題幹如何決定必須處理的內容。">${esc(plan.note||'')}</textarea></label></fieldset>`;
  }
  function teacherEditor(q=null) {
    editQuestionId=q?.id||null;
    const p=q?state.bank.passages.find(p=>p.id===q.passages[0]):null;
    const options=state.bank.passages.map(p=>`<option value="${esc(p.id)}" ${q?.passages[0]===p.id?'selected':''}>${esc(p.title)}</option>`).join('');
    const full=q?.examples.find(e=>e.score===q.rubric.length)||q?.examples.at(-1);
    return `<section class="surface" id="teacher-editor"><h2>${q?'編輯這道練習':'新增自己的練習'}</h2><p class="field-help">可新增文章，或用已加入的文章再設一題。每行評分要點作 1 分自檢；提示和例答可按題目調整。</p>${q?'<p class="note neutral">修改題目後，這道題的舊草稿和自評會清除；同一篇文章的其他題目會保留。</p>':''}<div id="teacher-errors" role="alert" hidden></div><form id="teacher-form" class="teacher-form"><h3 class="form-section">閱讀文章</h3><label class="field wide"><span class="field-label">使用哪篇文章？</span><select name="passage"><option value="new">新增一篇文章</option>${options}</select><span class="field-help">已有文章不在這裡修改；如需改寫原文，請另存一篇文章。</span></label><div id="new-passage-fields" class="wide" ${q?'hidden':''}><label class="field"><span class="field-label">文章標題</span><input type="text" name="articleTitle" maxlength="160" ${q?'':'required'}></label><label class="field"><span class="field-label">文章內容</span><textarea name="articleText" class="big" maxlength="100000" ${q?'':'required'} placeholder="每個段落以一個空白行分隔。">${q?'':''}</textarea><span class="field-help">最多 40 段，每段最多 4,000 字。請使用可供教學的文章。</span></label></div><h3 class="form-section">題目與作答要求</h3><label class="field"><span class="field-label">練習名稱</span><input type="text" name="title" maxlength="160" required value="${esc(q?.title||'')}"></label><label class="field"><span class="field-label">題型</span><select name="type">${Object.entries(C.TYPES).map(([k,v])=>`<option value="${k}" ${q?.type===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="field wide"><span class="field-label">題幹</span><textarea name="prompt" maxlength="2500" required>${esc(q?.prompt||'')}</textarea></label><label class="field"><span class="field-label">作答範圍</span><input type="text" name="scope" maxlength="200" value="${esc(q?.scope||'全文')}"></label><label class="field"><span class="field-label">字數上限（可留空）</span><input type="number" name="wordLimit" min="10" max="2000" step="1" value="${q?.wordLimit||''}"></label>${teacherTaskEditor(q)}<h3 class="form-section">評分、自檢與提示</h3><label class="field wide"><span class="field-label">評分要點（1 至 8 項）</span><textarea name="rubric" class="big" maxlength="8500" required placeholder="每行一項，格式：名稱｜具體要求\n準確判斷｜指出人物由催促轉為耐心觀察\n文本依據｜以兩項言行支持判斷\n解釋關係｜說明言行怎樣反映態度">${esc(q?.rubric.map(r=>r.label+'｜'+r.detail).join('\n')||'')}</textarea></label>${[0,1,2].map(i=>`<label class="field ${i===2?'wide':''}"><span class="field-label">提示 ${i+1}（選填）</span><textarea class="compact" name="hint${i}" maxlength="1200">${esc(q?.hints[i]||'')}</textarea></label>`).join('')}<h3 class="form-section">例答比較</h3><label class="field wide"><span class="field-label">完整例答</span><textarea name="fullExample" class="big" maxlength="8000" required>${esc(full?.text||'')}</textarea></label><label class="field wide"><span class="field-label">完整例答評語</span><textarea class="compact" name="fullNote" maxlength="1000" required>${esc(full?.note||'')}</textarea></label><label class="field wide"><span class="field-label">部分達標例答（選填）</span><textarea name="partialExample" maxlength="8000">${esc(q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.text||'')}</textarea></label><label class="field"><span class="field-label">部分例答示範分數</span><input type="number" name="partialScore" min="0" max="8" step="1" value="${q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.score??1}"></label><label class="field"><span class="field-label">部分例答評語</span><textarea class="compact" name="partialNote" maxlength="1000">${esc(q?.examples.find(e=>e.score>0&&e.score<q.rubric.length)?.note||'')}</textarea></label><label class="field wide"><span class="field-label">未達標例答（選填，示範 0 分）</span><textarea class="compact" name="weakExample" maxlength="8000">${esc(q?.examples.find(e=>e.score===0)?.text||'')}</textarea></label><label class="field wide"><span class="field-label">未達標例答評語</span><textarea class="compact" name="weakNote" maxlength="1000">${esc(q?.examples.find(e=>e.score===0)?.note||'')}</textarea></label><div class="button-row wide"><button class="button primary" type="submit">${q?'儲存修改':'加入練習題庫'}</button><button class="button secondary" type="button" data-action="close-editor">取消</button></div></form></section>`;
  }
  function renderTeacher(q=null) {
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">TEACHER WORKSPACE</div><h1>把教材變成分步練習</h1><p>加入文章、題目、提示及評分要點，讓學生練習有依據的作答。</p></div><button type="button" class="button primary" data-action="new-question">＋ 新增練習</button></div><p class="note">教師題庫儲存在這個瀏覽器。要交給學生或在另一部裝置使用，可先匯出題庫，再在對方的「教師題庫」匯入。</p><section class="surface"><div class="teacher-top"><div><h2>我的練習題庫</h2><p>${state.bank.passages.length} 篇文章 · ${state.bank.questions.length} 道題目</p></div><div class="button-row"><button class="button secondary" type="button" data-action="export-bank">匯出題庫</button><button class="button secondary" type="button" data-action="import-bank">匯入題庫</button><input type="file" id="bank-file" accept=".json,application/json" hidden></div></div>${state.bank.questions.length?state.bank.questions.map(q=>`<article class="teacher-card"><div><h3>${esc(q.title)}</h3><p>${esc(state.bank.passages.find(p=>p.id===q.passages[0])?.title||'自訂文章')} · ${esc(C.TYPES[q.type])} · ${q.rubric.length} 分自評</p></div><div class="button-row"><a class="button small secondary" href="#practice/${esc(q.id)}">試做</a><button class="button small quiet" data-action="edit-question" data-id="${esc(q.id)}">編輯</button><button class="button small quiet danger" data-action="delete-question" data-id="${esc(q.id)}">刪除</button></div></article>`).join(''):'<div class="empty-state" style="margin-top:24px">尚未加入自己的題目。按「新增練習」即可填入教材，<br>2024《繁盛》真題及原有9道練習可在練習題庫使用。</div>'}</section><div id="editor-container">${q?teacherEditor(q):''}</div><p class="note neutral">教師編輯器支援推論、作用分析及比較題。內置2024《繁盛》另保留選擇、判斷、表格、短答及長答的原題格式。教師新增的評分要點由教師制定。</p>`;
  }
  function route() {
    save();current=null;coachingView=false;mobileView='coach';
    const path=location.hash.replace(/^#\/?/,'')||'home';
    const isPractice=path.startsWith('practice/');
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(isPractice||path.startsWith('exercise/')||path.startsWith('coaching/')?'home':path);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(isPractice){const id=path.slice(9);const q=byId(id);if(q)renderPractice(q);else{renderHome();toast('這道題目已不存在，請從題庫重新選擇。');}}
    else if(path.startsWith('coaching/')){const q=byId(path.slice(9));if(q?.authentic&&coaching.lessons[q.id])renderCoaching(q);else{renderExamOverview();toast('這道精講已不存在，請重新選擇。');}}
    else if(path==='exercise/dse2024-fansheng')renderExamOverview();else if(path==='records')renderRecords();else if(path==='teacher'){editQuestionId=null;renderTeacher();}else renderHome();
    main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function checkTask(q,d) {
    const result=C.taskFeedback(q,d);
    const target=document.getElementById('task-feedback');
    target.className='feedback'+(result.correct?'':' warning');
    const items=rows=>rows.map(r=>`<li>${esc(r.text)}${result.missing.includes(r)?'（尚未勾選）':''}</li>`).join('');
    target.innerHTML=`<strong>${result.correct?'拆題準確。接下來為每項要求找證據。':'再核對主要指令和作答範圍。'}</strong><p>主要指令：${esc(q.directive)}${result.directiveCorrect?'':'（請修訂選擇）'}</p><p>本題須處理：</p><ul>${items(result.required)}</ul>${q.taskPlan?.note?`<p>${esc(q.taskPlan.note)}</p>`:''}${result.support.length?`<p>你選的這些方法可輔助本題思考：</p><ul>${items(result.support)}</ul><p>可用來找線索，不代表答案必須另寫一段。</p>`:''}${result.extra.length?`<p>你選的以下方法適用於其他問法，本題沒有要求處理：</p><ul>${items(result.extra)}</ul><p>請回到題幹的指令及作答範圍，修訂勾選。</p>`:''}`;
  }
  main.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.evidence&&current){const d=draft(current),id=button.dataset.evidence;d.evidence=d.evidence.includes(id)?d.evidence.filter(x=>x!==id):[...d.evidence,id];touch(d);updateEvidence(current,d);return;}
    if(button.dataset.step!==undefined){setStep(Number(button.dataset.step));return;}
    const action=button.dataset.action;if(!action)return;
    const q=current,d=q?draft(q):null;
    if(action==='export-backup'){backup();return;}
    if(action==='download-exam'){download('2024-fansheng-practice.txt',E.worksheet(exam),'text/plain');toast('已下載《繁盛》原文及原題練習。');return;}
    if(action==='download-exam-answers'){download('2024-fansheng-answer-coach.txt',E.answerSheet(exam,coaching),'text/plain');toast('已下載來源答案、逐題精講及失分修訂。');return;}
    if(action==='export-report'){recordReport();return;}
    if(action==='import-backup'){document.getElementById('backup-file').click();return;}
    if(action==='export-bank'){download('reading-coach-teacher-bank.json',JSON.stringify(state.bank,null,2));toast('教師題庫已匯出。');return;}
    if(action==='import-bank'){document.getElementById('bank-file').click();return;}
    if(action==='new-question'){document.getElementById('editor-container').innerHTML=teacherEditor();document.getElementById('teacher-editor').scrollIntoView({block:'start'});document.querySelector('[name="articleTitle"]').focus({preventScroll:true});return;}
    if(action==='close-editor'){if(await confirmAction('關閉編輯','未儲存的表格內容將不保留。')){document.getElementById('editor-container').innerHTML='';editQuestionId=null;}return;}
    if(action==='edit-question'){const custom=state.bank.questions.find(q=>q.id===button.dataset.id);if(custom.passages.length!==1){toast('雙篇教師題目請以匯出題庫後修改、再匯入的方式編輯。');return;}renderTeacher(custom);document.getElementById('teacher-editor').scrollIntoView({block:'start'});return;}
    if(action==='delete-question'){const id=button.dataset.id;if(await confirmAction('刪除這道教師題目','會刪除此題及其草稿、自評記錄。文章仍保留，可用來新增其他題目。')){state.bank.questions=state.bank.questions.filter(q=>q.id!==id);delete state.drafts[id];rebuild();save();renderTeacher();toast('已刪除這道題目。');}return;}
    if(!q)return;
    if(action==='expand-coaching'||action==='collapse-coaching'){main.querySelectorAll('.deep-lesson details').forEach(el=>{el.open=action==='expand-coaching';});return;}
    if(action==='add-coach-evidence'&&q.authentic&&(coachingView||d.examReviewed)){
      const e=E.lessonEvidence(coaching.lessons[q.id])[Number(button.dataset.index)];if(!e)return;
      const matches=C.quoteSentenceIds(compiled.passages,q.passages,e.quote,e.paragraph);
      if(!matches.length){toast('請到原文點選這段證據。');return;}
      d.evidence=[...new Set([...d.evidence,...matches])];touch(d);updateEvidence(q,d);toast('已標註第'+e.paragraph+'段的證據；再確認它支持哪一步推論。');return;
    }
    if(action==='review-source'&&q.authentic){
      if(!E.allAnswered(q,d)){const el=document.getElementById('source-review-error');el.className='feedback warning';el.textContent='請先完成每個原題分題，再核對來源答案。';return;}
      d.examReviewed=true;touch(d);renderPractice(q);const answerPanel=main.querySelector('.source-answer');answerPanel.setAttribute('tabindex','-1');answerPanel.focus({preventScroll:true});toast('已展開文件答案及教練證據分析。');return;
    }
    if(action==='add-source-evidence'&&q.authentic&&d.examReviewed){
      const e=q.evidenceAnalysis[Number(button.dataset.index)];if(!e)return;
      const matches=C.quoteSentenceIds(compiled.passages,q.passages,e.quote,e.paragraph);
      if(!matches.length){toast('請到原文點選這段證據。');return;}
      d.evidence=[...new Set([...d.evidence,...matches])];touch(d);updateEvidence(q,d);toast('已加入第'+e.paragraph+'段的原文證據。');return;
    }
    if(action==='previous'){setStep(Math.max(0,d.step-1));return;}
    if(action==='next'){setStep(Math.min(3,d.step+1));return;}
    if(action==='revise'){setStep(2);return;}
    if(action==='hint'){d.hintCount=Math.min(q.hints.length,d.hintCount+1);touch(d);renderPractice(q);return;}
    if(action==='check-task'){checkTask(q,d);return;}
    if(action==='show-passage'||action==='show-coach'){mobileView=action==='show-passage'?'passage':'coach';main.querySelector('.practice-layout').dataset.mobileView=mobileView;main.querySelectorAll('.mobile-view-switch button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.action==='show-passage')===(mobileView==='passage')));main.querySelector(mobileView==='passage'?'.passage-panel':'.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});return;}
    if(action==='font-less'||action==='font-more'){const scroll=main.querySelector('.passage-scroll').scrollTop;state.readingSize=Math.max(16,Math.min(26,state.readingSize+(action==='font-more'?2:-2)));save();if(coachingView)renderCoaching(q);else renderPractice(q);main.querySelector('.passage-scroll').scrollTop=scroll;return;}
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
    if(el.id==='question-select'){location.hash=(coachingView?'coaching/':'practice/')+el.value;return;}
    if(el.name==='passage'){const fresh=el.value==='new';document.getElementById('new-passage-fields').hidden=!fresh;for(const name of ['articleTitle','articleText'])document.querySelector(`[name="${name}"]`).required=fresh;return;}
    if(el.id==='bank-file'||el.id==='backup-file'){const file=el.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('請選擇小於 2 MB 的題庫或備份檔。');const value=JSON.parse(await file.text());if(el.id==='bank-file')await importBank(value);else await importBackup(value);}catch(e){toast(e.message==='Unexpected end of JSON input'?'檔案不完整，請重新選擇有效的 JSON 檔。':e instanceof SyntaxError?'檔案不是有效的 JSON。':e.message);}finally{el.value='';}return;}
    if(!current)return;
    const d=draft(current);
    if(el.dataset.examAnswer&&current.authentic){
      const p=current.answerParts.find(p=>p.key===el.dataset.examAnswer&&p.kind==='choice');
      if(!p?.choices.some(c=>c.value===el.value))return;
      C.changeAnswer(d,p.key,el.value);touch(d);
      const preview=document.getElementById('answer-preview-text');if(preview)preview.textContent=answerFor(current,d)||'尚未填寫。';
      const count=document.getElementById('answer-count');if(count)count.textContent=C.countChars(answerFor(current,d))+' 字（不計空白）';
      const feedback=document.getElementById('structure-feedback');if(feedback)feedback.innerHTML='';return;
    }
    if(el.name==='directive'){d.directive=el.value;touch(d);const feedback=document.getElementById('task-feedback');if(feedback)feedback.innerHTML='';}
    if(el.name==='requirement'){const key=current.requirementsVersion?el.value:Number(el.value);if(!current.requirements.some((r,i)=>C.requirementKey(r,i)===key))return;d.requirements=el.checked?[...new Set([...d.requirements,key])]:d.requirements.filter(i=>i!==key);touch(d);const feedback=document.getElementById('task-feedback');if(feedback)feedback.innerHTML='';}
    if(el.dataset.check!==undefined){d.checks[Number(el.dataset.check)]=el.value;delete d.completedAt;touch(d);document.getElementById('self-score').textContent=reviewCountText(current,d);const label=main.querySelector('.score-bar>div>span');label.textContent=(current.authentic?'教練自檢':'學生自評')+(current.rubric.every((_,i)=>d.checks[i])?'':' · 尚未逐項完成');main.querySelector('.completion-note')?.remove();const complete=main.querySelector('[data-action="complete"]');complete.textContent=current.authentic?'完成本題並記錄自檢 ✓':'完成本題並記錄自評 ✓';}
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
    const nextCompiled=C.compile({passages:[...base.passages,...exam.passages,...value.bank.passages],questions:[...base.questions,...exam.questions,...value.bank.questions]});
    const drafts={};for(const q of nextCompiled.questions)if(value.drafts[q.id])drafts[q.id]=C.sanitizeDraft(value.drafts[q.id],q,fieldsFor(q),nextCompiled.sentences);
    state={version:1,bank:value.bank,drafts,readingSize:[16,18,20,22,24,26].includes(value.readingSize)?value.readingSize:18};compiled=nextCompiled;storageBlocked=false;document.getElementById('storage-warning').hidden=true;save();renderRecords();toast('已還原備份。');
  }
  main.addEventListener('submit',async event=>{
    if(event.target.id!=='teacher-form')return;event.preventDefault();const form=event.target,data=new FormData(form),get=name=>String(data.get(name)||'').trim();
    const errors=[];const qid=editQuestionId||'custom-q-'+crypto.randomUUID();let pid=get('passage'),passage=null;
    if(pid==='new'){pid='custom-p-'+crypto.randomUUID();passage={id:pid,title:get('articleTitle'),label:'教師提供文章',paragraphs:get('articleText').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean)};}
    const rubric=get('rubric').split('\n').map(t=>t.trim()).filter(Boolean).map(line=>{const pos=line.search(/[｜|]/);return pos<0?{label:line,detail:line}:{label:line.slice(0,pos).trim(),detail:line.slice(pos+1).trim()};});
    const type=get('type'),directives={purpose:'分析作用',inference:'推論並說明',comparison:'比較並說明'},directive=directives[type];
    let taskData;
    if(get('taskPlanVersion')===C.TASK_VERSION){
      taskData={taskPlan:{required:C.TASK_PRINCIPLES.filter(p=>get('task-'+p.id)==='required').map(p=>p.id),support:C.TASK_PRINCIPLES.filter(p=>get('task-'+p.id)==='support').map(p=>p.id),note:get('taskNote')}};
    }else{
      const requirements=get('requirements').split('\n').map(t=>t.trim()).filter(Boolean).map(text=>({text,correct:true}));if(get('distractor'))requirements.push({text:get('distractor'),correct:false});taskData={requirements};
    }
    const examples=[];
    if(get('weakExample')){if(!get('weakNote'))errors.push('請為未達標例答補上評語。');examples.push({label:'未達標例答',score:0,text:get('weakExample'),note:get('weakNote')});}
    if(get('partialExample')){const score=Number(get('partialScore'));if(!get('partialNote'))errors.push('請為部分達標例答補上評語。');if(!Number.isInteger(score)||score<0||score>=rubric.length)errors.push('部分例答分數須低於完整例答分數。');examples.push({label:'部分達標例答',score,text:get('partialExample'),note:get('partialNote')});}
    examples.push({label:'完整例答',score:rubric.length,text:get('fullExample'),note:get('fullNote')});
    const question={id:qid,title:get('title'),type,level:'自訂練習',passages:[pid],scope:get('scope')||'全文',prompt:get('prompt'),directive,options:[directive,'概括內容','辨識表達手法'],...taskData,rubric,hints:[0,1,2].map(i=>get('hint'+i)).filter(Boolean),examples,evidenceGroups:[]};
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
