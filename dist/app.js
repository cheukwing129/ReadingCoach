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
      state={version:1,bank:value.bank,drafts:value.drafts,readingSize:[16,18,20,22,24,26].includes(value.readingSize)?value.readingSize:18,overviewViewedAt:typeof value.overviewViewedAt==='string'?value.overviewViewedAt:''};
    }
  } catch(e) {storageBlocked=true;storageWarning('未能讀取或保存瀏覽器資料。本次仍可練習，請使用「匯出完整備份」保存內容；原有資料不會被覆蓋。');}
  rebuild();
  const cleanDrafts={};
  for(const q of compiled.questions)if(state.drafts[q.id])cleanDrafts[q.id]=C.sanitizeDraft(state.drafts[q.id],q,fieldsFor(q),compiled.sentences);
  state.drafts=cleanDrafts;
  function draft(q) {
    if(!state.drafts[q.id]){state.drafts[q.id]=C.newDraft(q);if(q.authentic&&state.overviewViewedAt)C.recordSupport(q,state.drafts[q.id],fieldsFor(q),'overview',state.overviewViewedAt);}
    return state.drafts[q.id];
  }
  function rememberReading() {if(current){const pane=main.querySelector('.passage-scroll');if(pane&&Number.isFinite(pane.scrollTop))draft(current).readingTop=pane.scrollTop;}}
  function restoreReading(d) {const pane=main.querySelector('.passage-scroll');if(pane)pane.scrollTop=d.readingTop||0;}
  function persist() {
    rememberReading();
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
  function reviewCountText(q,d) {if(!q.authentic)return C.selfScore(q,d)+' / '+q.marks;const s=C.reviewStats(q,d);return `已檢視 ${s.reviewed}/${s.total} 項；已做到 ${s.yes}；不確定 ${s.unsure}；未做到 ${s.no}`;}
  const supportLabels={revision:'自主修訂提醒（通用）',legacy:'舊記錄未追蹤指引',overview:'篇章總覽教學',guide:'教練模式',task:'拆題指引',evidence:'證據指引',writing:'落筆句式',hint:'額外提示',lesson:'逐題精講',source:'來源答案',examples:'例答'};
  function firstLabel(d) {const f=d.firstAttempt;return !f?'尚未保存首答':(f.practiceMode==='independent'&&!f.supportLog.length&&!f.hintCount?'自主首答（未開啟本題支援）':'使用指引後的首稿')+(f.complete?'':' · 分題未全部填妥');}
  function historyHTML(q,d) {
    if(!d.firstAttempt)return d.supportLog?.some(s=>s.kind==='legacy')?'<p class="field-help">舊記錄沒有首答及指引查看時點；提示0級不能據此判定為自主作答。</p>':'';
    const firstResult=q.authentic&&d.examReviewed&&d.firstAttempt.complete?E.objectiveResult(q,{...d.firstAttempt,examReviewed:true}):null;
    return `<details class="attempt-history"><summary>比較首答與修訂 · ${esc(firstLabel(d))}</summary><div class="attempt-comparison"><article><h3>保存的首答</h3>${firstResult?`<p>首答客觀題核對 ${firstResult.earned} / ${firstResult.total} 分</p>`:''}<p class="field-help">${formatDate(d.firstAttempt.at)}</p><p class="answer-text">${esc(C.assembleAnswer(d.firstAttempt,fieldsFor(q)))}</p></article><article><h3>目前答案</h3><p class="answer-text">${esc(answerFor(q,d))}</p><p class="field-help">${esc(d.revisionReason||'可記下這次補充的證據或推論。')}</p></article></div>${d.supportLog.length?`<h3>支援查看紀錄</h3><ul>${d.supportLog.map(s=>`<li>${esc(supportLabels[s.kind])}${s.level?'第'+s.level+'級':''}${s.at?' · '+formatDate(s.at):' · 時點未追蹤'}</li>`).join('')}</ul>`:''}${(d.revisions||[]).map((r,i)=>`<details><summary>修訂版本 ${i+1} · ${formatDate(r.at)}</summary><p class="answer-text">${esc(C.assembleAnswer(r,fieldsFor(q)))}</p><p>修改理由：${esc(r.reason||'未填寫')}</p></details>`).join('')}<p class="field-help">版本比較用來看見具體改動，書面題仍按整體意思與論述由教師評閱。</p></details>`;
  }
  function practiceModeBar(q,d) {
    return `<section class="practice-mode" aria-label="學習模式"><div class="mode-switch"><button type="button" data-action="start-independent" aria-pressed="${d.practiceMode==='independent'}">自主試答</button><button type="button" data-action="start-guided" aria-pressed="${d.practiceMode==='guided'}">教練引導</button></div><p class="field-help">${d.practiceMode==='independent'?(d.firstAttempt?'首答已保存。先自行修訂，再按需要開啟支援。':'先閱讀原文及原題，寫下自己的答案；保存首答後可自行修訂。'):'按需要使用拆題、證據及提示，將推論寫清楚。'}${d.firstAttempt?' · '+esc(firstLabel(d)):''}</p></section>`;
  }
  function revisionFields(q,d) {
    return `<label class="field"><span class="field-label">這次改了哪裏？為甚麼？（選填）</span><textarea class="compact" data-revision-reason maxlength="1500" placeholder="例如：由概括意思，改為用兩個原文細節解釋它們的關係。">${esc(d.revisionReason||'')}</textarea></label><button type="button" class="button small secondary" data-action="save-revision">保存這個修訂版本</button>`;
  }
  function bridgeHTML(d) {
    return `<details class="reasoning-bridge"><summary>把證據連到答案：線索 → 推論 → 回應</summary><p class="field-help">選句有甚麼用？先試寫三步。這是思考筆記，短答或選擇題只需在正式答案填原題要求的內容。</p>${[['observation','1. 原文線索','這句寫了甚麼具體言行、處境或變化？'],['inference','2. 推論','為甚麼這個線索支持你的理解？中間還欠哪個關係？'],['answer','3. 回應題目','這個理解回答了題目的哪一項要求？']].map(([key,label,placeholder])=>`<label class="field"><span class="field-label">${label}</span><textarea class="compact" data-bridge="${key}" maxlength="1500" placeholder="${placeholder}">${esc(d.bridge?.[key]||'')}</textarea></label>`).join('')}<button type="button" class="button small secondary" data-action="check-bridge">檢查推論步驟</button><div id="bridge-feedback" aria-live="polite"></div></details>`;
  }
  function transferHTML(q,d) {
    const next=E.transferCandidates(q).map(byId).find(target=>target&&!hasWork(state.drafts[target.id]));
    const pending=q.rubric.map((r,i)=>({r,i})).filter(({i})=>['unsure','no'].includes(d.checks[i]));
    return `<section class="transfer-practice"><h3>用另一篇驗證能否運用</h3><p class="field-help">完成數記錄練習進度。換一篇先自主試答，才能看出是否能重用方法；以下為原創練習。</p>${next?`<button type="button" class="button secondary" data-action="start-transfer" data-id="${esc(next.id)}">試做《${esc(compiled.passages.find(p=>p.id===next.passages[0]).title)}》同類題 →</button>`:'<a class="button secondary" href="#home">選另一篇原創練習 →</a>'}${pending.length?`<p>這題值得再重溫：</p><div class="button-row">${pending.map(({r,i})=>`<button type="button" class="button small quiet" data-action="return-check" data-index="${i}">${esc(r.label)} · ${d.checks[i]==='unsure'?'不確定':'未做到'}</button>`).join('')}</div>`:''}</section>`;
  }
  function examFeature() {
    const done=exam.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    const next=exam.questions.find(q=>!state.drafts[q.id]?.completedAt)||exam.questions[0];
    return `<section class="exam-feature" aria-labelledby="exam-feature-title"><div><div class="eyebrow">2024 DSE · 真實篇章與原題</div><h2 id="exam-feature-title">李娟《繁盛》</h2><p>在荒涼與希望之間，練習讀準人物、意象與生命的寄意。</p><div class="exam-facts"><span>15 段原文</span><span>第 9–20 題</span><span>12 題 · 35 分</span><span>${done} / 12 題完成</span></div><p class="field-help">文章、題目及答案依你提供的 2024 年文件；拆題、提示與證據解釋為教練分析。</p></div><div class="button-row"><a class="button primary" href="#practice/${esc(next.id)}">${done?'繼續真題練習':'開始《繁盛》練習'} →</a><a class="button secondary" href="#exercise/dse2024-fansheng">查看整份練習</a></div></section>`;
  }
  function renderExamOverview() {
    const done=exam.questions.filter(q=>state.drafts[q.id]?.completedAt).length;
    main.innerHTML=`<a class="back-link" href="#home">← 返回練習題庫</a><div class="page-head"><div><div class="eyebrow">2024 DSE · CHINESE READING</div><h1>李娟《繁盛》</h1><p>原卷第一篇 · 15段 · 第9–20題 · 35分 · 已完成 ${done}/12 題</p></div><a class="button primary" href="#practice/${esc((exam.questions.find(q=>!state.drafts[q.id]?.completedAt)||exam.questions[0]).id)}">進入練習 →</a></div><p class="note">文章、原題及來源答案保留文件內容。選擇題按文件答案核對；書面題保留原分值及評分準則，交由教師評閱。教練自檢不換算分數。</p><p class="note neutral">逐題精講會示範如何找證據、補推論、排除干擾選項，並以文件低分舉隅拆解失分與修訂。可先作答再核對，也可直接閱讀精講。</p><div class="toolbar"><a class="button secondary" href="#progress/dse2024-fansheng">查看完成總覽</a><a class="button primary" href="#coaching/dse2024-q9">直接閱讀逐題精講 →</a><button type="button" class="button secondary" data-action="download-exam">下載練習文字稿</button><button type="button" class="button quiet" data-action="download-exam-answers">下載答案與教練分析</button></div><details class="overview-teaching" ${state.overviewViewedAt?'open':''}><summary>作答方法與篇章地圖（含本篇分析）</summary>${state.overviewViewedAt?E.methodsHTML(coaching):'<p class="field-help">先自主試答，再按需要閱讀教學；查看時點會加入本篇的支援紀錄。</p><button type="button" class="button secondary" data-action="overview-help">閱讀教練方法與篇章地圖</button>'}</details><section class="exam-question-grid" aria-label="繁盛原題列表">${exam.questions.map(original=>{const q=byId(original.id),d=state.drafts[q.id];return `<article class="surface exam-question-card"><span class="tag">原題 ${q.marks}分</span><h2>${esc(q.title)}</h2><p class="field-help">${esc(q.typeLabel)} · ${esc(q.scope)}</p><p>${esc(q.prompt)}</p><a class="button secondary" href="#practice/${esc(q.id)}">${d?.completedAt?'重溫與修訂':hasWork(d)?'繼續作答':'開始作答'} →</a><a class="text-link lesson-link" href="#coaching/${esc(q.id)}">閱讀本題精講與失分修訂 →</a></article>`;}).join('')}</section><section class="surface exam-sources"><h2>資料依據</h2><p class="field-help">原文及原題以資料夾的原卷PDF為準，文字稿只協助轉錄；評卷表格已按各分數欄核對。紙本行末換行與答題線改為網頁格式。</p><ul>${[...exam.sources,...coaching.references].map(s=>`<li><strong>${esc(s.name)}</strong> · 第${esc(s.pages)}頁<br><span class="muted">${esc(s.role)}</span></li>`).join('')}</ul><p class="note neutral">教練新增：逐題解題示範、逐項排除、失分例診斷與修訂、通用方法、句式、三級提示及自檢。文件答案與教練分析在作答頁分開標示。</p></section>`;
  }
  function progressPanelHTML({compact=false}={}) {
    const summary=E.progressSummary(compiled.questions.filter(q=>q.authentic),state.drafts),o=summary.objective,w=summary.written;
    return `<section class="surface exam-progress" aria-label="繁盛完成與覆核總覽"><h2>逐題完成與覆核</h2><div class="exam-progress-stats"><article><strong>${summary.completed}/${summary.total}題</strong><span>作答及自檢完成</span></article><article><strong>${o.checked?o.earned+'/'+o.checkedMarks+'分':'尚未核對'}</strong><span>已核對客觀題 ${o.checked}/${o.total}題<br>全部客觀題共${o.totalMarks}分</span></article><article><strong>${w.pending}題</strong><span>已作答書面題 · 待教師覆核</span></article><article><strong>${w.reviewed}題</strong><span>書面題已覆核 · ${w.needsRevision}題仍需修訂</span></article></div><p class="field-help">客觀題分數只計已核對的題目。書面題的自檢、圈句及教師要點覆核不換算分數，因此這裏不推算35分總成績。</p><details class="progress-rows" ${compact?'':'open'}><summary>查看12題的進度、核對結果與下一步</summary><div class="table-scroll" role="region" aria-label="繁盛逐題完成狀態" tabindex="0"><table class="exam-table progress-table"><thead><tr><th scope="col">題目</th><th scope="col">目前進度</th><th scope="col">核對／覆核</th><th scope="col">下一步</th></tr></thead><tbody>${summary.rows.map(row=>`<tr><th scope="row">第${row.q.number}題<br><span class="field-help">${esc(row.q.typeLabel)}</span></th><td>${esc(row.stage)}${row.q.answerParts.some(p=>p.kind!=='choice')&&row.review.reviewed?`<br><span class="field-help">${reviewCountText(row.q,row.d)}</span>`:''}</td><td>${esc(row.feedback)}</td><td><a class="button small secondary" href="#practice/${esc(row.q.id)}">${row.q.answerParts.some(p=>p.kind!=='choice')&&row.d.examReviewed?'修訂／覆核':row.d.completedAt?'重溫':'繼續作答'}</a></td></tr>`).join('')}</tbody></table></div></details></section>`;
  }
  function updateTeacherReviewUI(q,d) {
    const label=E.teacherReviewLabel(q,d),status=document.getElementById('teacher-review-status');
    if(status)status.textContent=label;
    const summary=main.querySelector('.teacher-feedback>summary');if(summary)summary.textContent='教師按要點覆核（選填） · '+label;
    const next=document.getElementById('review-next');if(next)next.innerHTML=E.reviewFeedbackHTML(q,d);
    const completion=main.querySelector('.completion-note');if(completion&&d.completedAt)completion.innerHTML='已完成作答、來源核對及自檢 · '+formatDate(d.completedAt)+'<br>完成記錄不代表答案全對；'+esc(label)+'。';
  }
  function renderExamProgress() {
    main.innerHTML=`<a class="back-link" href="#exercise/dse2024-fansheng">← 返回《繁盛》練習</a><div class="page-head"><div><div class="eyebrow">2024 DSE · LEARNING REVIEW</div><h1>《繁盛》完成總覽</h1><p>分開看作答進度、客觀題核對及書面題覆核。</p></div><a class="button secondary" href="#records">全部學習記錄 →</a></div>${progressPanelHTML()}<div class="toolbar"><button type="button" class="button secondary" data-action="export-report">匯出學習記錄</button><button type="button" class="button secondary" data-action="export-backup">匯出完整備份</button></div>`;
  }
  function examStepContent(q,d) {
    if(d.step===2)return `<div class="step-label">STEP 03 · 按原題的分題位置作答</div><h2 class="step-title">${d.firstAttempt?'修訂自己的答案':'寫下自己的答案'}</h2><p class="step-description">${d.firstAttempt?'先檢查首答，補充自己能解釋的證據及關係；支援由你選擇開啟。':'先按原題試答，再保存首答。選擇及短答題可直接完成這一步。'}</p>${d.practiceMode==='guided'?E.stageHTML(coaching.lessons[q.id],2)+E.conceptHTML(q):d.firstAttempt?E.revisionPromptHTML(q):''}${E.answerHTML(q,d)}<details class="selected-evidence"><summary class="text-link">查看已選文本證據（${d.evidence.length} 句）</summary>${evidenceList(q,d)}</details>${answerPreview(q,d)}<div class="button-row">${!d.firstAttempt?'<button type="button" class="button primary" data-action="save-first">保存首答，開始修訂</button>':''}<button type="button" class="button secondary" data-action="structure">檢查作答格式</button></div><div id="first-attempt-error" aria-live="polite"></div><div id="structure-feedback" aria-live="polite"></div>${d.firstAttempt?revisionFields(q,d)+historyHTML(q,d):''}${d.practiceMode==='guided'?bridgeHTML(d)+hintBox(q,d):''}`;
    const all=C.reviewStats(q,d).reviewed===q.rubric.length;
    const review=d.examReviewed?`${E.markingHTML(q,d)}<h3 class="exam-check-heading">教練自檢 · 扣回我已寫出的內容</h3><p class="step-description">選擇「已做到」時，圈選自己答案中的支持句，再用追問檢查是否說深。自檢與圈句都不換算分數。</p>${E.linkedReviewHTML(q,d)}<div class="score-bar"><div><span>自檢進度 ${all?'':'· 尚未逐項完成'}</span><br><strong id="self-score">${reviewCountText(q,d)}</strong></div><span>不代表原題得分</span></div><div id="review-next">${E.reviewFeedbackHTML(q,d)}</div>${E.teacherFeedbackHTML(q,d)}<label class="field"><span class="field-label">下一次，我會特別留意……（選填）</span><textarea class="compact" data-reflection maxlength="1500" placeholder="記下仍欠的證據、推論或說明。">${esc(d.reflection||'')}</textarea></label><button type="button" class="button primary" data-action="complete">${d.completedAt?'更新完成記錄':'完成本題並記錄自檢'} ✓</button>${d.completedAt?`<p class="note completion-note">已完成作答、來源核對及自檢 · ${formatDate(d.completedAt)}<br>完成記錄不代表答案全對；${q.answerParts.some(p=>p.kind!=='choice')?esc(E.teacherReviewLabel(q,d))+'。':'仍可返回修訂。'}</p><a class="button small secondary" href="#progress/dse2024-fansheng">查看《繁盛》完成總覽 →</a>${transferHTML(q,d)}`:''}<div id="completion-error" aria-live="polite"></div>${historyHTML(q,d)}<details class="optional-coaching" data-support="lesson"><summary>自選：查看完整示範、例答與失分修訂</summary>${E.lessonHTML(q,coaching.lessons[q.id],{compact:true})}</details><details class="source-criteria"><summary>快速證據索引</summary>${E.evidenceHTML(q,d)}</details>${q.answerParts.some(p=>p.kind!=='choice')?`<details class="source-criteria general-criteria"><summary>一般評分原則（文件摘錄）</summary><ul>${exam.generalCriteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}`:'<p class="note neutral" style="margin-top:18px">可以先返回修訂，或自行選擇「核對來源答案」查看文件答案及評分資料。系統會保存核對前的答案版本。</p>';
    return `<div class="step-label">STEP 04 · 核對來源，再作教練自檢</div><h2 class="step-title">核對答案與文本證據</h2>${answerPreview(q,d)}<div class="button-row"><button type="button" class="button small secondary" data-action="revise">← 返回修訂答案</button><button type="button" class="button primary" data-action="review-source" ${d.examReviewed?'disabled':''}>${d.examReviewed?'已核對來源答案':'核對來源答案'}</button></div><div id="source-review-error" aria-live="polite"></div>${review}`;
  }
  function renderCoaching(q) {
    rememberReading();current=q;coachingView=true;const d=draft(q),lesson=coaching.lessons[q.id];C.recordSupport(q,d,fieldsFor(q),'lesson');touch(d);
    main.innerHTML=`<div class="practice-top"><a class="back-link" href="#exercise/dse2024-fansheng">← 返回《繁盛》練習</a><span class="save-label">${storageBlocked?'尚未儲存，請匯出備份':'草稿證據保存在此瀏覽器'}</span><label class="practice-select">切換精講 <select id="question-select" aria-label="切換逐題精講">${exam.questions.map(item=>`<option value="${esc(item.id)}" ${item.id===q.id?'selected':''}>第${item.number}題 · ${esc(item.typeLabel)}</option>`).join('')}</select></label></div><div class="question-heading"><div><p>2024 DSE 李娟《繁盛》 · 逐題精講</p><h1>第${q.number}題 · ${esc(q.typeLabel)}</h1></div><a class="button secondary" href="#practice/${esc(q.id)}">返回本題作答 →</a></div><div class="mobile-view-switch" role="group" aria-label="原文與精講頁面"><button type="button" data-action="show-passage" aria-pressed="${mobileView==='passage'}">原文 · ${d.evidence.length} 句證據</button><button type="button" data-action="show-coach" aria-pressed="${mobileView==='coach'}">逐題精講</button></div><div class="practice-layout" data-mobile-view="${mobileView}">${renderPassages(q,d)}<section class="coach-panel" aria-label="逐題精講與失分修訂"><div class="coach-body"><details class="coaching-original"><summary>回看第${q.number}題完整原題 · ${q.marks}分</summary><div class="prompt-block"><span class="tag">原題 ${q.marks}分</span>${E.promptHTML(q)}</div></details>${E.lessonHTML(q,lesson,{standalone:true})}<details class="selected-evidence"><summary>已標註的證據 · 可與本題作答共用</summary><div id="evidence-list">${evidenceList(q,d)}</div></details><details class="coaching-source" data-support="source"><summary>核對文件答案及各品第準則</summary>${E.markingHTML(q,d,{reveal:true})}</details><div class="lesson-navigation">${q.number>9?`<a class="button secondary" href="#coaching/dse2024-q${q.number-1}">← 上一題精講</a>`:''}<a class="button primary" href="${q.number<20?'#coaching/dse2024-q'+(q.number+1):'#exercise/dse2024-fansheng'}">${q.number<20?'下一題精講 →':'返回整份練習 →'}</a></div></div></section></div>`;
    restoreReading(d);
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
  function passageNavigation(q,d) {
    return `<nav class="paragraph-nav" aria-label="原文段落導航"><label>跳至段落 <select data-paragraph-target><option value="">選擇段落</option>${q.passages.map(id=>{const p=compiled.passages.find(p=>p.id===id);return `<optgroup label="${esc(p.title)}">${p.paragraphs.map(a=>`<option value="${esc(a.id)}">第${a.number}段</option>`).join('')}</optgroup>`;}).join('')}</select></label><div class="button-row">${d.practiceMode==='guided'?'<button type="button" class="button small quiet" data-action="jump-scope">回題目範圍</button>':''}<button type="button" class="button small quiet" data-action="jump-selected" ${d.evidence.length?'':'disabled'}>回已選證據</button></div></nav>`;
  }
  function jumpParagraph(id) {
    if(!current||!compiled.passages.filter(p=>current.passages.includes(p.id)).some(p=>p.paragraphs.some(a=>a.id===id)))return;
    mobileView='passage';main.querySelector('.practice-layout').dataset.mobileView=mobileView;
    main.querySelectorAll('.mobile-view-switch button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.action==='show-passage'));
    const paragraph=document.getElementById(id);paragraph.scrollIntoView({block:'start',behavior:'instant'});paragraph.setAttribute('tabindex','-1');paragraph.focus({preventScroll:true});rememberReading();save();
  }
  function renderPassages(q,d) {
    return `<section class="passage-panel" aria-label="閱讀原文"><div class="panel-title"><div><h2>閱讀原文</h2><small>點選句子，可加入或移除證據</small></div><div class="text-tools"><button type="button" data-action="font-less" aria-label="縮小原文字體" ${state.readingSize<=16?'disabled':''}>A−</button><button type="button" data-action="font-more" aria-label="放大原文字體" ${state.readingSize>=26?'disabled':''}>A＋</button></div></div>${passageNavigation(q,d)}<div class="passage-scroll" style="--reading-size:${state.readingSize}px">${q.passages.map((id,i)=>{
      const p=compiled.passages.find(p=>p.id===id);
      return `${i?'<hr class="reading-divider">':''}<h2 class="passage-heading">${q.passages.length>1?(i===0?'甲文 · ':'乙文 · '):''}${esc(p.title)}</h2><p class="passage-label">${esc(p.label||'教師提供文章')}</p>${p.paragraphs.map(a=>`<p class="paragraph" id="${esc(a.id)}"><span class="paragraph-number" aria-label="第${a.number}段">${a.number}</span>${a.sentences.map(s=>`<button type="button" class="sentence ${d.evidence.includes(s.id)?'selected':''}" data-evidence="${esc(s.id)}" aria-pressed="${d.evidence.includes(s.id)}" title="點選此句作證據">${esc(s.text)}</button>`).join('')}</p>`).join('')}`;
    }).join('')}</div><div class="evidence-summary" id="evidence-summary">已選 ${d.evidence.length} 句 · ${esc(d.practiceMode==='independent'?'按原題作答':q.scope||'按題目要求作答')}</div></section>`;
  }
  function evidenceList(q,d) {
    if(!d.evidence.length)return '<div class="empty-state">先到原文點選最貼題的句子。<br>不用把整篇文章都圈起來。</div>';
    return d.evidence.map(id=>{const s=compiled.sentences[id],p=compiled.passages.find(p=>p.id===s.passage);return `<blockquote class="evidence-item"><button data-action="remove-evidence" data-id="${esc(id)}" aria-label="移除第${s.paragraph}段這句證據">×</button><cite>${esc(p.title)} · 第${s.paragraph}段 <button type="button" data-action="jump-paragraph" data-id="${esc(s.passage+'-p'+s.paragraph)}">回原文</button></cite><p>${esc(s.text)}</p></blockquote>`;}).join('');
  }
  function hintBox(q,d) {return `<aside class="hint-box"><div class="hint-head"><h3>需要一點提示？</h3><span class="muted" style="font-size:11px">已使用 ${d.hintCount} / ${q.hints.length} 級</span></div>${q.hints.slice(0,d.hintCount).map((h,i)=>`<p><span class="hint-level">提示 ${i+1}</span>${esc(h)}</p>`).join('')}<button type="button" class="button small secondary" data-action="hint" style="margin-top:14px" ${d.hintCount>=q.hints.length?'disabled':''}>${d.hintCount>=q.hints.length?'提示已全部展開':d.hintCount?'解鎖下一級提示':'查看第一級提示'}</button><p class="muted" style="font-size:11px">提示使用次數會記錄，可用來回顧需要支援的地方。</p></aside>`;}
  function answerPreview(q,d) {const a=answerFor(q,d);return `<div class="answer-preview"><h3>我的答案</h3><p class="answer-text" id="answer-preview-text">${a.trim()?esc(a):'尚未填寫。請先試寫，再查看例答。'}</p><div class="answer-count ${q.wordLimit&&C.countChars(a)>q.wordLimit?'over':''}" id="answer-count">${C.countChars(a)} 字${q.wordLimit?' / 上限 '+q.wordLimit+' 字':''}（不計空白）</div></div>`;}
  function taskChoice(q,d,r) {
    const key=C.requirementKey(r,q.requirements.indexOf(r));
    return `<label class="choice"><input type="checkbox" name="requirement" value="${esc(key)}" ${d.requirements.includes(key)?'checked':''}><span>${esc(r.text)}</span></label>`;
  }
  const taskSelectionText = d => `已選 ${new Set(d.requirements).size} 項處理原則（跨類別重複顯示的項目只計一次）。`;
  function taskPrinciples(q,d) {
    if(!q.taskPlan)return `<fieldset><legend>答案應處理哪些內容？可選多項。</legend>${q.requirements.map(r=>taskChoice(q,d,r)).join('')}</fieldset>`;
    return `<fieldset aria-describedby="task-principles-help"><legend>答案應處理哪些內容？可選多項。</legend><p id="task-principles-help" class="field-help task-principles-help">按「記敘、描寫、說理」瀏覽通用處理原則，依題幹選出本題須處理的項目。可跨類別選擇；同一原則在各類中的勾選會同步。各類可收起或展開。找證據與留意作答範圍，是每題的共同基礎。</p><label class="field"><span class="field-label">聚焦一類處理原則</span><select data-task-category-focus>${C.TASK_CATEGORIES.map(g=>`<option value="${g.id}" ${(d.taskCategory||'narration')===g.id?'selected':''}>${g.label}</option>`).join('')}</select></label><p id="task-selection-count" class="field-help task-selection-count" aria-live="polite">${taskSelectionText(d)}</p>${C.taskCategories(q).map(group=>`<details class="task-category" data-task-category="${group.id}" ${(d.taskCategory||'narration')===group.id?'open':''}><summary>${group.label}</summary><p class="field-help task-category-focus">${group.focus}</p><div class="task-principles">${group.requirements.map(r=>taskChoice(q,d,r)).join('')}</div></details>`).join('')}</fieldset>`;
  }
  function syncTaskSelections(q,d) {
    main.querySelectorAll('input[name="requirement"]').forEach(input=>{const key=q.requirementsVersion?input.value:Number(input.value);input.checked=d.requirements.includes(key);});
    const count=document.getElementById('task-selection-count');if(count)count.textContent=taskSelectionText(d);
  }
  function stepContent(q,d) {
    if(q.authentic&&d.step>=2)return examStepContent(q,d);
    if(!q.authentic&&d.practiceMode==='independent'){
      if(d.step===3)return `<div class="step-label">STEP 04 · 保存試答後再核對</div><h2>核對自己的答法</h2>${answerPreview(q,d)}<button type="button" class="button secondary" data-action="revise">返回試答</button><button type="button" class="button primary" data-action="review-original">保存首答，查看例答與自檢</button><div id="first-attempt-error" aria-live="polite"></div>`;
      return `<div class="step-label">STEP 03 · 自主試答</div><h2>先寫自己的答案</h2><p class="step-description">先用兩三句交代判斷、文本線索及解釋，試試能否在另一篇運用方法。</p><label class="field"><span class="field-label">按題幹作答</span><textarea class="big" data-answer="free" maxlength="12000">${esc(d.free)}</textarea></label>${answerPreview(q,d)}<button type="button" class="button primary" data-action="save-first">保存首答，開始修訂</button><div id="first-attempt-error" aria-live="polite"></div>`;
    }
    if(d.step===0)return `<div class="step-label">STEP 01 · 先確認自己要回答甚麼</div><h2 class="step-title">拆開題目要求</h2><p class="step-description">從處理原則辨別本題需要回答哪些內容。</p>${taskPrinciples(q,d)}<button type="button" class="button secondary" data-action="check-task">核對拆題</button><div id="task-feedback" aria-live="polite"></div>${hintBox(q,d)}`;
    if(d.step===1)return `<div class="step-label">STEP 02 · 用原文支持判斷</div><h2 class="step-title">挑選最貼題的證據</h2><p class="step-description">在原文點選句子。想想每一句支持答案的哪一部分，避免把「有圈句子」當成「已解釋」。</p><button type="button" class="button secondary" data-action="show-passage">到原文選取證據 →</button><div id="evidence-list">${evidenceList(q,d)}</div><button type="button" class="button secondary" data-action="check-evidence" ${!q.evidenceGroups.length?'disabled':''}>了解證據的作用</button><div id="evidence-feedback" aria-live="polite"></div>${!q.evidenceGroups.length?'<p class="field-help">這道教師題目未設定證據範圍，請按題幹自行判斷。</p>':''}${bridgeHTML(d)}${hintBox(q,d)}`;
    if(d.step===2)return `<div class="step-label">STEP 03 · 不只複述，要交代關係</div><h2 class="step-title">把線索寫成答案</h2><p class="step-description">依照框架試寫，或選擇自由作答。欄目幫助組織思路，實際答案仍須按題目調整。</p><div class="mode-switch" role="group" aria-label="作答模式"><button type="button" data-action="mode-guided" aria-pressed="${d.mode!=='free'}">分步作答</button><button type="button" data-action="mode-free" aria-pressed="${d.mode==='free'}">自由作答</button></div>${d.mode==='free'?`<label class="field"><span class="field-label">寫下你的答案</span><textarea class="big" data-answer="free" maxlength="12000" placeholder="直接回應題目，用具體文本證據支持，再解釋兩者的關係。">${esc(d.free)}</textarea></label>`:fieldsFor(q).map(f=>`<label class="field"><span class="field-label">${esc(f.label)}</span><textarea data-answer="${esc(f.key)}" maxlength="5000" placeholder="${esc(f.placeholder)}">${esc(d.fields[f.key]||'')}</textarea></label>`).join('')}<details class="selected-evidence"><summary class="text-link" style="cursor:pointer">查看已選文本證據（${d.evidence.length} 句）</summary>${evidenceList(q,d)}</details>${answerPreview(q,d)}<button type="button" class="button secondary" data-action="structure">檢查答案結構</button><div id="structure-feedback" aria-live="polite"></div><p class="field-help">結構提醒只檢查是否有內容和常見表達，不判斷意思是否正確。</p>${hintBox(q,d)}`;
    const a=answerFor(q,d),all=q.rubric.every((_,i)=>d.checks[i]);
    return `<div class="step-label">STEP 04 · 找出下一次可以改進的地方</div><h2 class="step-title">自檢，再比較例答</h2><p class="step-description">逐項查看自己的答案。只有答案中已寫清楚的內容，才選「已做到」；不能把腦中想過的內容當成已寫。</p>${answerPreview(q,d)}<button type="button" class="button small secondary" data-action="revise">← 返回修訂答案</button><p class="note neutral" style="margin-top:20px">以下每項作 1 分自評檢查；合計只表示你自行確認的答案要素。正式評分還須考慮意思準確、論述和整體表現，由老師評閱。</p>${q.rubric.map((r,i)=>`<fieldset class="rubric-item"><legend><span class="rubric-label">${i+1}. ${esc(r.label)} <span class="muted" style="font-size:11px">／1 分</span></span><span class="rubric-detail">${esc(r.detail)}</span></legend><div class="self-options">${[['yes','已做到'],['unsure','不確定'],['no','未做到']].map(([value,label])=>`<label><input type="radio" name="check-${i}" data-check="${i}" value="${value}" ${d.checks[i]===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`).join('')}<div class="score-bar"><div><span>學生自評 ${all?'':'· 尚未逐項完成'}</span><br><strong id="self-score">${C.selfScore(q,d)} / ${q.marks}</strong></div><span>「不確定」暫不計入<br>系統沒有判定答案正確</span></div><details class="examples" id="examples" ${d.examplesViewed?'open':''}><summary>比較不同程度例答</summary>${a.trim()?`<p class="field-help">例答分數依本練習的要點示範，並非官方評分。合理而有文本支持的其他表達也可接受。</p>${q.examples.map(e=>`<article class="example"><div class="example-head"><strong>${esc(e.label)}</strong><span class="tag">示範 ${e.score} / ${q.marks} 分</span></div><p>${esc(e.text)}</p><p class="note">${esc(e.note)}</p></article>`).join('')}`:'<p class="note">請先寫下自己的答案，再來比較例答。</p>'}</details><label class="field" style="margin-top:24px"><span class="field-label">下一次，我會特別留意……（選填）</span><textarea class="compact" data-reflection maxlength="1500" placeholder="例如：比較題要以同一角度寫出兩方，不能只有兩段內容。">${esc(d.reflection||'')}</textarea></label><button type="button" class="button primary" data-action="complete">${d.completedAt?'更新完成記錄':'完成本題並記錄自評'} ✓</button>${d.completedAt?`<p class="note completion-note">已完成作答及自檢 · ${formatDate(d.completedAt)}<br>完成記錄不代表答案全對；仍可返回修訂。</p>`:''}<div id="completion-error" aria-live="polite"></div>`;
  }
  function renderPractice(q, focus=false) {
    rememberReading();current=q;coachingView=false;const d=draft(q);if(d.practiceMode==='independent'&&d.step<2)d.step=2;if(d.practiceMode==='guided'&&q.authentic&&d.step<2){C.recordSupport(q,d,fieldsFor(q),d.step===0?'task':'evidence');touch(d);}
    main.innerHTML=`<div class="practice-top"><a class="back-link" href="${q.authentic?'#exercise/dse2024-fansheng':'#home'}">← ${q.authentic?'返回《繁盛》練習':'返回練習題庫'}</a><span class="save-label">${storageBlocked?'尚未儲存，請匯出備份':'草稿自動保存在此瀏覽器'}</span><label class="practice-select">切換題目 <select id="question-select" aria-label="切換練習題目">${allGroups().map(g=>`<optgroup label="${esc(g.title)}">${g.ids.map(id=>`<option value="${esc(id)}" ${id===q.id?'selected':''}>${esc(byId(id).title)}</option>`).join('')}</optgroup>`).join('')}</select></label></div><div class="question-heading"><div><p>${esc(q.typeLabel||C.TYPES[q.type])} · ${esc(q.level||'自訂練習')} ${q.minutes?'· 建議 '+q.minutes+' 分鐘':''}</p><h1>${q.authentic&&d.practiceMode==='independent'?'第'+q.number+'題':esc(q.title)}</h1></div><div class="question-actions"><span class="tag">練習 ${q.marks} 分</span>${q.authentic?`<a class="text-link lesson-link" href="#coaching/${esc(q.id)}">閱讀本題精講 →</a>`:''}</div></div><div class="mobile-view-switch" role="group" aria-label="原文與作答頁面"><button type="button" data-action="show-passage" aria-pressed="${mobileView==='passage'}">原文 · ${d.evidence.length} 句證據</button><button type="button" data-action="show-coach" aria-pressed="${mobileView==='coach'}">作答教練</button></div><div class="practice-layout" data-mobile-view="${mobileView}">${renderPassages(q,d)}<section class="coach-panel" aria-label="分步作答教練"><div class="step-tabs" role="tablist" aria-label="作答步驟">${['拆題','找證據','寫答案','自檢'].map((name,i)=>d.practiceMode==='independent'&&i<2?'':`<button id="step-tab-${i}" type="button" class="step-tab" data-step="${i}" role="tab" aria-selected="${d.step===i}" aria-controls="step-content" tabindex="${d.step===i?'0':'-1'}"><span aria-hidden="true">${i+1}</span>${name}</button>`).join('')}</div><div class="coach-body">${practiceModeBar(q,d)}<div class="prompt-block"><span class="tag">${esc(d.practiceMode==='independent'?'按原題作答':q.scope||'按題目要求作答')}</span>${q.authentic?E.promptHTML(q,{showChoices:d.step!==2}):`<p class="prompt">${esc(q.prompt)}</p>`}</div><div id="step-content" role="tabpanel" aria-labelledby="step-tab-${d.step}" tabindex="-1">${q.authentic&&d.practiceMode==='guided'&&d.step<2?E.stageHTML(coaching.lessons[q.id],d.step):''}${stepContent(q,d)}${!q.authentic&&d.step===3&&d.practiceMode==='guided'?historyHTML(q,d):''}</div><div class="step-controls"><button type="button" class="button quiet" data-action="previous" ${d.step===(d.practiceMode==='independent'?2:0)?'disabled':''}>← 上一步</button>${d.step<3?`<button type="button" class="button primary" data-action="next">下一步：${['','找證據','寫答案','自檢'][d.step+1]} →</button>`:q.authentic?`<a class="button primary" href="${q.number<20?'#practice/dse2024-q'+(q.number+1):'#exercise/dse2024-fansheng'}">${q.number<20?'下一題 →':'返回整份練習 →'}</a>`:'<a class="button secondary" href="#records">查看學習記錄 →</a>'}</div></div></section></div>`;
    restoreReading(d);if(focus)document.getElementById('step-content').focus({preventScroll:true});
  }
  function setStep(step) {if(!current)return;const d=draft(current);d.step=d.practiceMode==='independent'?Math.max(2,step):step;mobileView='coach';touch(d);renderPractice(current,true);document.querySelector('.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});}
  function updateEvidence(q,d) {
    main.querySelectorAll('[data-evidence]').forEach(el=>{const yes=d.evidence.includes(el.dataset.evidence);el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});
    const summary=document.getElementById('evidence-summary');if(summary)summary.textContent=`已選 ${d.evidence.length} 句 · ${d.practiceMode==='independent'?'按原題作答':q.scope||'按題目要求作答'}`;
    const list=document.getElementById('evidence-list');if(list)list.innerHTML=evidenceList(q,d);
    const mobile=main.querySelector('.mobile-view-switch [data-action="show-passage"]');if(mobile)mobile.textContent=`原文 · ${d.evidence.length} 句證據`;
    const feedback=document.getElementById('evidence-feedback');if(feedback)feedback.innerHTML='';
    const details=main.querySelector('details.selected-evidence');if(d.step===2&&details&&!coachingView){const summary=details.querySelector('summary');summary.textContent=`查看已選文本證據（${d.evidence.length} 句）`;details.querySelectorAll('.evidence-item,.empty-state').forEach(el=>el.remove());details.insertAdjacentHTML('beforeend',evidenceList(q,d));}
  }
  function recordReport() {
    const lines=['閱讀理解答題教練｜學習記錄','匯出日期：'+formatDate(new Date().toISOString()),'本記錄為學生自評，並非正式評分。',''];
    for(const q of compiled.questions){const d=state.drafts[q.id];if(!hasWork(d))continue;lines.push('【'+q.title+'】',q.authentic?E.questionText(q):q.prompt,'狀態：'+(d.completedAt?'完成作答及自檢':'練習中'),q.authentic?E.scoreText(q,d)+'；教練自檢：'+reviewCountText(q,d):'學生自評：'+reviewCountText(q,d)+'（已做到的要點數）','使用提示：'+d.hintCount+' / '+q.hints.length,'','我的答案：',answerFor(q,d)||'尚未填寫','','自檢：',...q.rubric.map((r,i)=>`${i+1}. ${r.label}：${{yes:'已做到',unsure:'不確定',no:'未做到'}[d.checks[i]]||'未選'}`),'自檢支持句：',...q.rubric.map((r,i)=>r.label+'：'+(d.checkEvidence?.[i]?.join('／')||'未圈選')),'首答：'+firstLabel(d),d.firstAttempt?C.assembleAnswer(d.firstAttempt,fieldsFor(q)):'未保存','支援查看：',...(d.supportLog||[]).map(item=>(supportLabels[item.kind]||item.kind)+(item.level?'第'+item.level+'級':'')+' · '+(item.at||'時點未追蹤')),'修訂版本：',...(d.revisions||[]).flatMap((r,i)=>['版本 '+(i+1)+' · '+r.at,C.assembleAnswer(r,fieldsFor(q)),'理由：'+(r.reason||'未填寫')]),'反思：'+(d.reflection||'未填寫'),...(q.authentic&&q.answerParts.some(p=>p.kind!=='choice')?['教師要點覆核：'+E.teacherReviewLabel(q,d),...(d.teacherReview?["覆核答案版本：",d.teacherReview.answer,'教師：'+(d.teacherReview.reviewer||'未填寫'),'確認時點：'+(d.teacherReview.at||'尚未確認'),...d.teacherReview.items.map((item,i)=>q.rubric[i].label+'：'+({confirmed:'已回應',revise:'需要補充',discuss:'待釐清'}[item.status]||'未覆核')+'；'+(item.note||'未填意見'))]:[]),...(d.teacherReviewHistory||[]).flatMap(old=>['先前版本覆核：'+(old.at||'尚未確認'),old.answer,...old.items.map((item,i)=>q.rubric[i].label+'：'+({confirmed:'已回應',revise:'需要補充',discuss:'待釐清'}[item.status]||'未覆核')+'；'+(item.note||'未填意見'))])]:[]),'覆核意見：'+(d.teacherNote||'未填寫'),'');}
    download('reading-coach-learning-record.txt',lines.join('\n'),'text/plain');
  }
  function renderRecords() {
    const rows=compiled.questions.filter(q=>hasWork(state.drafts[q.id]));
    const done=rows.filter(q=>state.drafts[q.id].completedAt).length;
    const hint=rows.reduce((n,q)=>n+state.drafts[q.id].hintCount,0);
    main.innerHTML=`<div class="page-head"><div><div class="eyebrow">LEARNING JOURNAL</div><h1>看見自己的進步</h1><p>比較首答與修訂，記下支援使用和仍需重溫的項目。</p></div><a href="#home" class="button primary">繼續練習 →</a></div><div class="stats-grid"><div class="stat"><strong>${done} / ${compiled.questions.length}</strong><span>全題庫已完成作答及自檢</span></div><div class="stat"><strong>${rows.length-done}</strong><span>已有草稿，尚未完成</span></div><div class="stat"><strong>${hint}</strong><span>已使用的提示級數</span></div></div><p class="note neutral">原創練習記錄教學自評；真題記錄客觀題核對結果及教練自檢，書面題待教師評閱。修改答案後，舊核對結果、自檢及完成標記會清除，請重新檢查。</p><div class="toolbar"><a class="button secondary" href="#progress/dse2024-fansheng">《繁盛》完成總覽 →</a><button type="button" class="button secondary" data-action="export-report">匯出學習記錄</button><button type="button" class="button secondary" data-action="export-backup">匯出完整備份</button><button type="button" class="button quiet" data-action="import-backup">還原備份</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><div class="record-list">${rows.length?rows.map(q=>{const d=state.drafts[q.id];return `<article class="record-row"><div><h3>${esc(q.title)}</h3><p>${esc(q.typeLabel||C.TYPES[q.type])} · ${d.completedAt?'已完成作答及自檢':'仍在練習'} · 提示 ${d.hintCount} 級${d.updatedAt?' · '+formatDate(d.updatedAt):''}</p>${d.reflection?`<p style="margin-top:7px">下一次：${esc(d.reflection)}</p>`:''}<p class="field-help">${esc(firstLabel(d))}</p>${historyHTML(q,d)}${q.authentic?transferHTML(q,d):''}</div><div class="record-score"><span>${q.authentic?'真題記錄':'學生自評'}</span><strong class="${q.authentic?'exam-score-text':''}">${q.authentic?esc(E.scoreText(q,d)):reviewCountText(q,d)}</strong>${q.authentic?`<span>教練自檢：${reviewCountText(q,d)}</span>`:''}<span>${C.reviewStats(q,d).reviewed===q.rubric.length?'每項均已檢視':'尚有未檢視項目'}</span></div><a class="button secondary" href="#practice/${esc(q.id)}">${d.completedAt?'重溫與修訂':'繼續作答'} →</a></article>`;}).join(''):'<div class="empty-state">還沒有練習記錄。從第一組開始，寫下自己的答案。</div>'}</div>`;
  }
  function teacherTaskRole(p,plan) {
    return `<label class="field"><span class="field-label">${esc(p.text)}</span><select name="task-${p.id}" data-task-role="${p.id}">${[['none','本題未要求'],['required','必須處理'],['support','可輔助思考']].map(([value,label])=>`<option value="${value}" ${(plan.required.includes(p.id)?'required':plan.support.includes(p.id)?'support':'none')===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
  }
  function teacherTaskEditor(q) {
    if(q&&!q.taskPlan)return `<div class="wide"><p class="field-help">這道舊題保留教師原有的拆題選項。新建練習會使用共用處理原則。</p><label class="field"><span class="field-label">必須處理的要求</span><textarea class="compact" name="requirements" maxlength="2000" required>${esc(q.requirements.filter(r=>r.correct).map(r=>r.text).join('\n'))}</textarea></label><label class="field"><span class="field-label">其他拆題選項（選填）</span><input type="text" name="distractor" maxlength="300" value="${esc(q.requirements.find(r=>!r.correct)?.text||'')}"></label></div>`;
    const plan=q?.taskPlan||{required:[],support:[]};
    return `<fieldset class="wide"><legend>本題適用的通用處理原則</legend><p class="field-help task-principles-help">16項原則按「記敘、描寫、說理」分類，相同原則的設定會同步。請標示至少一項「必須處理」；「可輔助思考」可選可不選，不當作答錯。</p><input type="hidden" name="taskPlanVersion" value="${C.TASK_VERSION}">${C.taskCategories({requirements:C.TASK_PRINCIPLES}).map(group=>`<details class="task-category" data-task-category="${group.id}" open><summary>${group.label}</summary><p class="field-help task-category-focus">${group.focus}</p><div class="task-principle-editor">${group.requirements.map(p=>teacherTaskRole(p,plan)).join('')}</div></details>`).join('')}<label class="field"><span class="field-label">核對後的拆題說明（選填）</span><textarea class="compact" name="taskNote" maxlength="1000" placeholder="說明題幹如何決定必須處理的內容。">${esc(plan.note||'')}</textarea></label></fieldset>`;
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
    clearTimeout(toastTimer);document.getElementById('toast').hidden=true;
    save();current=null;coachingView=false;mobileView='coach';
    const path=location.hash.replace(/^#\/?/,'')||'home';
    const isPractice=path.startsWith('practice/');
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(isPractice||path.startsWith('exercise/')||path.startsWith('coaching/')?'home':path.startsWith('progress/')?'records':path);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(isPractice){const id=path.slice(9);const q=byId(id);if(q)renderPractice(q);else{renderHome();toast('這道題目已不存在，請從題庫重新選擇。');}}
    else if(path.startsWith('coaching/')){const q=byId(path.slice(9));if(q?.authentic&&coaching.lessons[q.id])renderCoaching(q);else{renderExamOverview();toast('這道精講已不存在，請重新選擇。');}}
    else if(path==='exercise/dse2024-fansheng')renderExamOverview();else if(path==='progress/dse2024-fansheng')renderExamProgress();else if(path==='records')renderRecords();else if(path==='teacher'){editQuestionId=null;renderTeacher();}else renderHome();
    main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function checkTask(q,d) {
    const result=C.taskFeedback(q,d);
    const target=document.getElementById('task-feedback');
    target.className='feedback'+(result.correct?'':' warning');
    const items=rows=>rows.map(r=>`<li>${esc(r.text)}${result.missing.includes(r)?'（尚未勾選）':''}</li>`).join('');
    target.innerHTML=`<strong>${result.correct?'拆題準確。接下來為每項要求找證據。':'再核對題幹和作答範圍。'}</strong><p>本題須處理：</p><ul>${items(result.required)}</ul>${q.taskPlan?.note?`<p>${esc(q.taskPlan.note)}</p>`:''}${result.support.length?`<p>你選的這些方法可輔助本題思考：</p><ul>${items(result.support)}</ul><p>可用來找線索，不代表答案必須另寫一段。</p>`:''}${result.extra.length?`<p>你選的以下方法適用於其他問法，本題沒有要求處理：</p><ul>${items(result.extra)}</ul><p>請回到題幹的指令及作答範圍，修訂勾選。</p>`:''}`;
  }
  main.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.evidence&&current){const d=draft(current),id=button.dataset.evidence;d.evidence=d.evidence.includes(id)?d.evidence.filter(x=>x!==id):[...d.evidence,id];touch(d);updateEvidence(current,d);return;}
    if(button.dataset.step!==undefined){setStep(Number(button.dataset.step));return;}
    const action=button.dataset.action;if(!action)return;
    const q=current,d=q?draft(q):null;
    if(action==='overview-help'){
      state.overviewViewedAt=new Date().toISOString();for(const item of compiled.questions.filter(item=>item.authentic))C.recordSupport(item,draft(item),fieldsFor(item),'overview',state.overviewViewedAt);save();renderExamOverview();return;
    }
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
    if(action==='start-independent'){d.practiceMode='independent';d.step=2;if(!q.authentic){if(d.mode!=='free'&&!d.free.trim())d.free=answerFor(q,d);d.mode='free';}touch(d);renderPractice(q);return;}
    if(action==='start-guided'){C.recordSupport(q,d,fieldsFor(q),'guide');d.practiceMode='guided';d.step=0;touch(d);renderPractice(q);return;}
    if(action==='save-first'||action==='review-original'){
      if(!C.answerComplete(q,d,fieldsFor(q))){const target=document.getElementById('first-attempt-error');target.className='feedback warning';target.textContent='請先完成自己的答案；真題須填妥每個分題，才保存首答。';return;}
      C.captureFirstAttempt(q,d,fieldsFor(q));
      if(q.authentic&&action==='save-first'){C.recordSupport(q,d,fieldsFor(q),'revision');d.step=2;touch(d);renderPractice(q);toast('首答已保存。先自行修訂，再按需要開啟支援。');return;}
      C.recordSupport(q,d,fieldsFor(q),action==='review-original'?'examples':'guide');d.practiceMode='guided';d.step=action==='review-original'?3:2;if(action==='review-original')d.examplesViewed=true;touch(d);renderPractice(q);return;
    }
    if(action==='revision-help'){C.recordSupport(q,d,fieldsFor(q),'guide');d.practiceMode='guided';d.step=2;touch(d);renderPractice(q);return;}
    if(action==='confirm-teacher-review'&&q.authentic){const error=C.teacherReviewError(q,d,fieldsFor(q));if(error){const target=document.getElementById('teacher-review-error');target.className='feedback warning';target.textContent=error;return;}d.teacherReview.at=new Date().toISOString();touch(d);renderPractice(q);const panel=main.querySelector('.teacher-feedback');panel.open=true;panel.querySelector('[data-action="confirm-teacher-review"]')?.focus({preventScroll:true});toast('已保存教師對這個答案版本的覆核。');return;}
    if(action==='save-revision'){if(!C.answerComplete(q,d,fieldsFor(q))){toast('請先填妥答案，再保存修訂版本。');return;}C.saveRevision(q,d,fieldsFor(q),'manual');touch(d);toast('已保留這個修訂版本及修改理由。');return;}
    if(action==='jump-paragraph'){jumpParagraph(button.dataset.id);return;}
    if(action==='jump-scope'){const n=Number(q.scope?.match(/\d+/)?.[0]||1);jumpParagraph(q.passages[0]+'-p'+n);return;}
    if(action==='jump-selected'){const sentence=compiled.sentences[d.evidence[0]];if(sentence)jumpParagraph(sentence.passage+'-p'+sentence.paragraph);return;}
    if(action==='return-check'){d.step=3;mobileView='coach';touch(d);renderPractice(q);const target=document.getElementById('selfcheck-'+button.dataset.index);target?.scrollIntoView({block:'center'});target?.querySelector('input')?.focus();return;}
    if(action==='start-transfer'){
      const target=byId(button.dataset.id);if(!target||target.authentic||hasWork(state.drafts[target.id])){toast('這題已有練習紀錄，請選另一題自主試答。');return;}
      const next=draft(target);next.practiceMode='independent';next.mode='free';next.step=2;touch(next);location.hash='practice/'+target.id;return;
    }
    if(action==='expand-coaching'||action==='collapse-coaching'){main.querySelectorAll('.deep-lesson details').forEach(el=>{el.open=action==='expand-coaching';});return;}
    if(action==='add-coach-evidence'&&q.authentic&&(coachingView||d.examReviewed)){
      const e=E.lessonEvidence(coaching.lessons[q.id])[Number(button.dataset.index)];if(!e)return;
      const matches=C.quoteSentenceIds(compiled.passages,q.passages,e.quote,e.paragraph);
      if(!matches.length){toast('請到原文點選這段證據。');return;}
      d.evidence=[...new Set([...d.evidence,...matches])];touch(d);updateEvidence(q,d);toast('已標註第'+e.paragraph+'段的證據；再確認它支持哪一步推論。');return;
    }
    if(action==='review-source'&&q.authentic){
      if(!E.allAnswered(q,d)){const el=document.getElementById('source-review-error');el.className='feedback warning';el.textContent='請先完成每個原題分題，再核對來源答案。';return;}
      C.saveRevision(q,d,fieldsFor(q),'source');C.recordSupport(q,d,fieldsFor(q),'source');d.practiceMode='guided';d.examReviewed=true;touch(d);renderPractice(q);const answerPanel=main.querySelector('.source-answer');answerPanel.setAttribute('tabindex','-1');answerPanel.focus({preventScroll:true});toast('已保存核對前答案，並展開文件答案；精講與例答可自行選擇查看。');return;
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
    if(action==='hint'){const level=Math.min(q.hints.length,d.hintCount+1);C.recordSupport(q,d,fieldsFor(q),'hint',new Date().toISOString(),level);d.practiceMode='guided';d.hintCount=level;touch(d);renderPractice(q);return;}
    if(action==='check-task'){C.recordSupport(q,d,fieldsFor(q),'task');touch(d);checkTask(q,d);return;}
    if(action==='show-passage'||action==='show-coach'){mobileView=action==='show-passage'?'passage':'coach';main.querySelector('.practice-layout').dataset.mobileView=mobileView;main.querySelectorAll('.mobile-view-switch button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.action==='show-passage')===(mobileView==='passage')));main.querySelector(mobileView==='passage'?'.passage-panel':'.coach-panel').scrollIntoView({block:'start',behavior:'smooth'});return;}
    if(action==='font-less'||action==='font-more'){const scroll=main.querySelector('.passage-scroll').scrollTop;state.readingSize=Math.max(16,Math.min(26,state.readingSize+(action==='font-more'?2:-2)));save();if(coachingView)renderCoaching(q);else renderPractice(q);main.querySelector('.passage-scroll').scrollTop=scroll;return;}
    if(action==='remove-evidence'){d.evidence=d.evidence.filter(id=>id!==button.dataset.id);touch(d);updateEvidence(q,d);return;}
    if(action==='check-evidence'){C.recordSupport(q,d,fieldsFor(q),'evidence');touch(d);const target=document.getElementById('evidence-feedback');target.className='feedback';target.innerHTML=E.evidenceFeedbackHTML(q,d,compiled);return;}
    if(action==='check-bridge'){const missing=C.bridgeFeedback(d),target=document.getElementById('bridge-feedback');target.className='feedback'+(missing.length?' warning':'');target.innerHTML=missing.length?`<strong>還欠這些推論步驟：</strong><ul>${missing.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'三步都有筆記。請回看原文，檢查它們的關係是否成立；系統只檢查步驟有沒有填寫，不評判意思或給分。';return;}
    if(action==='mode-free'||action==='mode-guided'){
      if(action==='mode-free'){if(d.mode==='free')return;if(!d.free.trim())d.free=answerFor(q,d);d.mode='free';}
      else {if(d.mode==='guided')return;if(d.free.trim()&&!(await confirmAction('切回分步作答','分步欄目會顯示原有內容。自由答案仍會保留，但不會自動拆入各欄；請自行整理，或稍後切回自由作答。')))return;d.mode='guided';}
      d.checks=[];d.checkEvidence={};delete d.completedAt;touch(d);renderPractice(q);return;
    }
    if(action==='structure'){const target=document.getElementById('structure-feedback');target.className='feedback warning';target.innerHTML=`<strong>答案結構提醒</strong><ul>${C.structuralFeedback(q,d,fieldsFor(q)).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;return;}
    if(action==='complete'){const message=C.completionError(q,d,fieldsFor(q));if(message){const el=document.getElementById('completion-error');el.className='feedback warning';el.textContent=message;return;}C.saveRevision(q,d,fieldsFor(q),'complete');d.completedAt=new Date().toISOString();touch(d);renderPractice(q);toast('已記錄作答及自檢，可到學習記錄重溫。');return;}
  });
  main.addEventListener('input',event=>{
    if(!current)return;
    const el=event.target,d=draft(current);
    if(el.dataset.answer){C.changeAnswer(d,el.dataset.answer,el.value);touch(d,true);const preview=document.getElementById('answer-preview-text');if(preview)preview.textContent=answerFor(current,d)||'尚未填寫。';const count=document.getElementById('answer-count');if(count){const length=C.countChars(answerFor(current,d));count.textContent=`${length} 字${current.wordLimit?' / 上限 '+current.wordLimit+' 字':''}（不計空白）`;count.classList.toggle('over',!!current.wordLimit&&length>current.wordLimit);}const feedback=document.getElementById('structure-feedback');if(feedback)feedback.innerHTML='';}
    if(el.hasAttribute('data-reflection')){d.reflection=el.value;touch(d,true);}
    if(el.hasAttribute('data-revision-reason')){d.revisionReason=el.value;touch(d,true);}
    if(current.authentic&&(el.hasAttribute('data-reviewer')||el.dataset.teacherPoint!==undefined)){const review=C.prepareTeacherReview(current,d,fieldsFor(current));if(el.hasAttribute('data-reviewer'))review.reviewer=el.value;else{const i=Number(el.dataset.teacherPoint);if(review.items[i])review.items[i].note=el.value;}touch(d,true);updateTeacherReviewUI(current,d);}
    if(el.hasAttribute('data-teacher-note')){d.teacherNote=el.value;touch(d,true);}
    if(['observation','inference','answer'].includes(el.dataset.bridge)){d.bridge[el.dataset.bridge]=el.value;touch(d,true);const feedback=document.getElementById('bridge-feedback');if(feedback)feedback.innerHTML='';}
  });
  main.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='question-select'){location.hash=(coachingView?'coaching/':'practice/')+el.value;return;}
    if(el.name==='passage'){const fresh=el.value==='new';document.getElementById('new-passage-fields').hidden=!fresh;for(const name of ['articleTitle','articleText'])document.querySelector(`[name="${name}"]`).required=fresh;return;}
    if(el.dataset?.taskRole){
      if(!C.TASK_PRINCIPLES.some(p=>p.id===el.dataset.taskRole)||!['none','required','support'].includes(el.value))return;
      main.querySelectorAll('select[data-task-role]').forEach(select=>{if(select.dataset.taskRole===el.dataset.taskRole)select.value=el.value;});return;
    }
    if(el.id==='bank-file'||el.id==='backup-file'){const file=el.files[0];if(!file)return;try{const limit=el.id==='backup-file'?10:2;if(file.size>limit*1024*1024)throw new Error('請選擇小於 '+limit+' MB 的'+(el.id==='backup-file'?'備份':'題庫')+'檔。');const value=JSON.parse(await file.text());if(el.id==='bank-file')await importBank(value);else await importBackup(value);}catch(e){toast(e.message==='Unexpected end of JSON input'?'檔案不完整，請重新選擇有效的 JSON 檔。':e instanceof SyntaxError?'檔案不是有效的 JSON。':e.message);}finally{el.value='';}return;}
    if(!current)return;
    const d=draft(current);
    if(el.hasAttribute?.('data-paragraph-target')){jumpParagraph(el.value);return;}
    if(el.hasAttribute?.('data-task-category-focus')){if(C.TASK_CATEGORIES.some(g=>g.id===el.value)){d.taskCategory=el.value;touch(d);renderPractice(current);}return;}
    if(el.dataset.teacherResult!==undefined&&current.authentic){const i=Number(el.dataset.teacherResult);if(!current.rubric[i]||!['','confirmed','revise','discuss'].includes(el.value))return;const review=C.prepareTeacherReview(current,d,fieldsFor(current));review.items[i].status=el.value;touch(d);updateTeacherReviewUI(current,d);return;}
    if(el.dataset.checkEvidence!==undefined){const i=Number(el.dataset.checkEvidence),sentence=C.answerSentences(d,fieldsFor(current))[Number(el.dataset.sentence)];if(!current.rubric[i]||!sentence)return;d.checkEvidence[i]=el.checked?[...new Set([...(d.checkEvidence[i]||[]),sentence])]:(d.checkEvidence[i]||[]).filter(s=>s!==sentence);delete d.completedAt;touch(d);if(d.checkEvidence[i].length)document.getElementById('selfcheck-'+i)?.querySelector('.answer-links .note')?.remove();main.querySelector('.completion-note')?.remove();main.querySelector('.transfer-practice')?.remove();const next=document.getElementById('review-next');if(next)next.innerHTML=E.reviewFeedbackHTML(current,d);const complete=main.querySelector('[data-action="complete"]');if(complete)complete.textContent='完成本題並記錄自檢 ✓';return;}
    if(el.dataset.examAnswer&&current.authentic){
      const p=current.answerParts.find(p=>p.key===el.dataset.examAnswer&&p.kind==='choice');
      if(!p?.choices.some(c=>c.value===el.value))return;
      C.changeAnswer(d,p.key,el.value);touch(d);
      const preview=document.getElementById('answer-preview-text');if(preview)preview.textContent=answerFor(current,d)||'尚未填寫。';
      const count=document.getElementById('answer-count');if(count)count.textContent=C.countChars(answerFor(current,d))+' 字（不計空白）';
      const feedback=document.getElementById('structure-feedback');if(feedback)feedback.innerHTML='';return;
    }
    if(el.name==='requirement'){const key=current.requirementsVersion?el.value:Number(el.value);if(!current.requirements.some((r,i)=>C.requirementKey(r,i)===key))return;d.requirements=el.checked?[...new Set([...d.requirements,key])]:d.requirements.filter(i=>i!==key);syncTaskSelections(current,d);touch(d);const feedback=document.getElementById('task-feedback');if(feedback)feedback.innerHTML='';}
    if(el.dataset.check!==undefined){const i=Number(el.dataset.check);if(!current.rubric[i]||!['yes','unsure','no'].includes(el.value))return;d.checks[i]=el.value;if(current.authentic&&el.value==='yes'&&current.answerParts.every(p=>p.kind!=='long'))d.checkEvidence[i]=C.answerSentences(d,fieldsFor(current));delete d.completedAt;touch(d);if(current.authentic){renderPractice(current);document.getElementById('selfcheck-'+i)?.querySelector('input:checked')?.focus({preventScroll:true});}else{document.getElementById('self-score').textContent=reviewCountText(current,d);main.querySelector('.score-bar>div>span').textContent='學生自評'+(current.rubric.every((_,j)=>d.checks[j])?'':' · 尚未逐項完成');main.querySelector('.completion-note')?.remove();}}
  });
  main.addEventListener('toggle',event=>{if(!current||!event.target.open)return;const d=draft(current);if(event.target.id==='examples'&&answerFor(current,d).trim()){C.recordSupport(current,d,fieldsFor(current),'examples');d.examplesViewed=true;touch(d);}if(event.target.dataset?.support){C.recordSupport(current,d,fieldsFor(current),event.target.dataset.support);touch(d);}},true);
  main.addEventListener('scroll',event=>{if(current&&event.target.classList?.contains?.('passage-scroll')){draft(current).readingTop=event.target.scrollTop;touch(draft(current),true);}},true);
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
    state={version:1,bank:value.bank,drafts,readingSize:[16,18,20,22,24,26].includes(value.readingSize)?value.readingSize:18,overviewViewedAt:typeof value.overviewViewedAt==='string'?value.overviewViewedAt:''};compiled=nextCompiled;storageBlocked=false;document.getElementById('storage-warning').hidden=true;save();renderRecords();toast('已還原備份。');
  }
  main.addEventListener('submit',async event=>{
    if(event.target.id!=='teacher-form')return;event.preventDefault();const form=event.target,data=new FormData(form),get=name=>String(data.get(name)||'').trim();
    const errors=[];const qid=editQuestionId||'custom-q-'+crypto.randomUUID();let pid=get('passage'),passage=null;
    if(pid==='new'){pid='custom-p-'+crypto.randomUUID();passage={id:pid,title:get('articleTitle'),label:'教師提供文章',paragraphs:get('articleText').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean)};}
    const rubric=get('rubric').split('\n').map(t=>t.trim()).filter(Boolean).map(line=>{const pos=line.search(/[｜|]/);return pos<0?{label:line,detail:line}:{label:line.slice(0,pos).trim(),detail:line.slice(pos+1).trim()};});
    const type=get('type');
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
    const question={id:qid,title:get('title'),type,level:'自訂練習',passages:[pid],scope:get('scope')||'全文',prompt:get('prompt'),...taskData,rubric,hints:[0,1,2].map(i=>get('hint'+i)).filter(Boolean),examples,evidenceGroups:[]};
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
