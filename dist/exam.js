(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.CoachCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExamCoach = api;
}(typeof window !== 'undefined' ? window : globalThis, function (C) {
  'use strict';
  const esc = C.escapeHTML;
  const allAnswered = (q,d) => q.answerParts.every(p => p.kind === 'choice' ? p.choices.some(c => c.value === d.fields?.[p.key]) : !!d.fields?.[p.key]?.trim());
  function objectiveResult(q,d) {
    if (!q.authentic || !q.answerParts.every(p => p.kind === 'choice') || !d.examReviewed || !allAnswered(q,d)) return null;
    return {earned:q.answerParts.reduce((sum,p) => sum + (d.fields[p.key] === p.answer ? p.marks : 0), 0), total:q.marks};
  }
  function scoreText(q,d) {
    const result = objectiveResult(q,d);
    if (result) return `客觀題核對 ${result.earned} / ${result.total} 分`;
    if(q.answerParts.every(p=>p.kind==='choice'))return '尚未核對答案';
    return C.teacherReviewStats(q,d,q.answerParts).status==='pending'?'書面題待教師評閱':teacherReviewLabel(q,d)+' · 未記錄正式分數';
  }
  function questionText(q) {
    let text = q.prompt + (q.promptMarks?`（${q.marks}分）`:'');
    if (q.quote) text += '\n'+q.quote;
    if (q.table) text += '\n'+q.table.headers.join(' | ')+'\n'+q.table.rows.map(r=>r.join(' | ')).join('\n');
    for (const p of q.answerParts) {
      if (q.answerParts.length>1 && !q.table) text += '\n'+p.label+(q.partMarks?`（${p.marks}分）`:'');
      if (p.choices) text += '\n'+p.choices.map(c=>c.value+'. '+c.text).join('　');
    }
    return text;
  }
  function promptHTML(q,{showChoices=true}={}) {
    const choiceList = p => `<ul class="exam-options">${p.choices.map(c=>`<li><span>${esc(c.value)}.</span> ${esc(c.text)}</li>`).join('')}</ul>`;
    return `<span class="small-label source-label">原題 · QAB 第${esc(q.source.question.pages)}頁</span><p class="prompt">${q.number}. ${esc(q.prompt)}${q.promptMarks?`（${q.marks}分）`:''}</p>${q.quote?`<blockquote class="exam-quote">${esc(q.quote)}</blockquote>`:''}${q.table?`<div class="table-scroll" role="region" aria-label="第${q.number}題原題表格" tabindex="0"><table class="exam-table"><thead><tr>${q.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${!q.table?q.answerParts.map(p=>`${q.answerParts.length>1&&(showChoices||p.kind!=='choice')?`<p class="exam-part-prompt">${esc(p.label)}${q.partMarks?`（${p.marks}分）`:''}</p>`:''}${p.choices&&showChoices?choiceList(p):''}`).join(''):''}<p class="field-help source-credit">來源：${esc(q.source.question.name)}，第${esc(q.source.question.pages)}頁。文字與分值按原卷；答題欄轉為網頁格式。</p>`;
  }
  function answerHTML(q,d) {
    return q.answerParts.map(p=>p.kind==='choice'?`<fieldset class="exam-answer-part"><legend>${esc(p.label)} <span class="muted">／${p.marks}分</span></legend>${p.choices.map(c=>`<label class="choice"><input type="radio" name="exam-${esc(q.id)}-${esc(p.key)}" data-exam-answer="${esc(p.key)}" value="${esc(c.value)}" ${d.fields[p.key]===c.value?'checked':''}><span><strong>${esc(c.value)}.</strong> ${esc(c.text)}</span></label>`).join('')}</fieldset>`:`<label class="field exam-answer-part"><span class="field-label">${esc(p.label)} <span class="muted">／${p.marks}分</span></span>${p.kind==='short'?`<input type="text" data-answer="${esc(p.key)}" maxlength="120" value="${esc(d.fields[p.key]||'')}" placeholder="${p.exactChars?'請填一個'+p.exactChars+'字詞':'請按原題填寫'}" autocomplete="off">`:`<textarea class="big" data-answer="${esc(p.key)}" maxlength="12000" placeholder="先直接回應題目，再用貼題的原文線索說明。">${esc(d.fields[p.key]||'')}</textarea>`}${p.exactChars?`<span class="field-help">原題要求${p.exactChars}字詞。系統只提醒格式，內容及錯別字仍須教師評閱。</span>`:''}</label>`).join('');
  }
  function markingHTML(q,d,{reveal=false}={}) {
    if (!reveal && (!d.examReviewed || !allAnswered(q,d))) return '';
    const result = reveal ? null : objectiveResult(q,d);
    return `<section class="source-answer" aria-label="來源答案及評分資料"><h3>來源答案及評分資料</h3><p class="source-credit">${esc(q.source.answer.name)} · 第${esc(q.source.answer.pages)}頁</p>${result?`<p class="note">按文件答案核對：<strong>${result.earned} / ${result.total} 分</strong>。只核對選項，不評定閱讀能力等級。</p>`:q.answerParts.every(p=>p.kind==='choice')?'<p class="note neutral">以下是文件的客觀題答案。直接閱讀精講不會核對或更改你此次的作答記錄。</p>':'<p class="note neutral">以下答案及準則摘自文件。長答題按整體表現評閱；自檢項目不換算成分數。合理而有文本支持的其他表達，可交由教師按準則判斷。</p>'}${q.official.map(m=>`<article class="source-part"><h4>${esc(m.label)} <span class="tag">原題 ${m.marks}分</span></h4>${m.answers.length?`<div class="source-excerpt"><strong>文件列出的正確答案</strong><ul>${m.answers.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>`:''}${m.criteria.length?`<details class="source-criteria"><summary>評分原則（文件摘錄）</summary><ul>${m.criteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}${m.bands.length?`<details class="source-criteria"><summary>查看各品第準則（文件摘錄）</summary>${m.bands.map(b=>`<p><strong>${esc(b.label)} · ${b.score}分</strong><br>${esc(b.text)}</p>`).join('')}</details>`:''}${m.examples.length?`<details class="source-criteria" data-support="examples"><summary>比較文件中的答案舉隅</summary>${m.examples.map(e=>`<article class="example"><div class="example-head"><strong>文件答案舉隅</strong><span class="tag">${e.score} / ${m.marks} 分</span></div><p>${esc(e.text)}</p><p class="field-help">${esc(e.note)}</p></article>`).join('')}</details>`:''}</article>`).join('')}</section>`;
  }
  function evidenceHTML(q,d) {
    if (!d.examReviewed) return '';
    return `<section class="exam-evidence-analysis"><div class="small-label source-label">教練分析 · 以下解釋為新增指引</div><h3>答案如何連到文本證據？</h3>${q.evidenceAnalysis.map((e,i)=>`<article class="evidence-analysis"><span class="tag">第${e.paragraph}段 · 原文</span><blockquote>${esc(e.quote)}</blockquote><p><strong>如何支持作答：</strong>${esc(e.why)}</p><button type="button" class="button small secondary" data-action="add-source-evidence" data-index="${i}">加入這句證據</button></article>`).join('')}</section>`;
  }
  const lessonEvidence = lesson => lesson.steps.flatMap(s => s.evidence);
  function reviewQuestion(q,index) {
    const prompts={
      'dse2024-q13':[
        '你所寫的手法，在哪兩組內容之間形成關係？請圈出自己解釋這個關係的一句。',
        '乳汁與鮮血各使人聯想到甚麼感覺？你的答案有沒有寫出兩者的反差？',
        '哪一句交代「牠們」所指的生命及其處境？只抄引文是否已說清楚？',
        '除了「生動」或「同情」，這種反差怎樣使讀者感受生境巨變的衝擊？請用自己答案的具體句子說明。'
      ],
      'dse2024-q15':[
        '你有沒有把光、黑暗及它們的關係一起解釋，而非只列出兩個象徵意思？',
        '「撐開」與「小小縫隙」分別補充甚麼？向微光靠攏又怎樣連到求生？',
        '哪個人物或生命的處境能支持你的寓意？請解釋情境和意象的關係。'
      ],
      'dse2024-q20':[
        '你選的是那個人的哪項特點？怎樣由他的經歷或行為推得，而非只複述他出現？',
        '你答案中哪一句把那個人和作者的經歷連起來？相似之處如何形成感情上的相通？',
        '若沿情感角度作答：作者向他哭泣，反映作者自己有甚麼需要？若沿生命或命運角度：重現怎樣把不同年代的經歷連起來？選一個有文本支持的方向說深，無須把所有方向都加入。'
      ]
    };
    return prompts[q.id]?.[index]||`你圈出的句子怎樣做到「${q.rubric[index].label}」？若只提名稱或抄情節，還需要補哪個解釋？`;
  }
  function linkedReviewHTML(q,d) {
    const sentences=C.answerSentences(d,q.answerParts);
    return q.rubric.map((r,i)=>`<fieldset class="rubric-item" id="selfcheck-${i}"><legend><span class="rubric-label">${i+1}. ${esc(r.label)}</span><span class="rubric-detail">${esc(r.detail)}</span></legend><div class="self-options">${[['yes','已做到'],['unsure','不確定'],['no','未做到']].map(([value,label])=>`<label><input type="radio" name="check-${i}" data-check="${i}" value="${value}" ${d.checks[i]===value?'checked':''}><span>${label}</span></label>`).join('')}</div><details class="answer-links" ${['yes','unsure','no'].includes(d.checks[i])?'open':''}><summary>圈選我的答案中對應的句子</summary><p class="field-help">只圈你已寫出的內容；圈到句子仍要檢查推論是否說清楚。</p>${sentences.map((s,j)=>`<label class="choice"><input type="checkbox" data-check-evidence="${i}" data-sentence="${j}" ${d.checkEvidence?.[i]?.includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join('')}${d.checks[i]==='yes'&&!d.checkEvidence?.[i]?.length?'<p class="note">尚未指出支持句。請圈選；若答案還欠解釋，可改選「不確定」。</p>':''}<p class="review-followup"><strong>再想深一層：</strong>${esc(reviewQuestion(q,i))}</p></details></fieldset>`).join('');
  }
  function revisionPrompts(q) {
    if(q.answerParts.every(p=>p.kind==='choice'))return ['重讀題幹，確認選的是符合、不符合，還是逐項判斷。','為自己的選項找一句原文依據，再檢查其他選項有沒有增加或改動原意。','想改選時先記下理由；想核對時才選擇查看來源答案。'];
    if(q.answerParts.every(p=>p.kind==='short'))return ['確認原題要求的字數及答案類別。','用引文中的言行或語境核驗自己的詞語。','只填題目所需內容，把推敲過程留在筆記。'];
    return ['逐個分題看首答，確認每項要求都有回應。','指出自己答案中的文本線索，補寫線索如何支持判斷。','若只有情節或手法名稱，再補一句解釋其關係或作用；記下這次修改理由。'];
  }
  function revisionPromptHTML(q) {
    return `<aside class="revision-prompts" aria-label="自主修訂提醒"><h3>首答已保存 · 先自行修訂</h3><ol>${revisionPrompts(q).map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="field-help">這三步是通用修訂提醒。按需要自行選擇提示、示範或來源答案。</p><button type="button" class="button small secondary" data-action="revision-help">開啟教練提示</button></aside>`;
  }
  function conceptHTML(q) {
    if(q.id!=='dse2024-q13')return '';
    return `<details class="concept-guide" data-support="writing"><summary>第13題必讀：分清指涉、意象含意與主旨</summary><p class="field-help">以下是教練分析，依第6段及來源評卷準則釐清三個層次。</p><dl><div><dt>1. 句中指涉：誰在吸吮？</dt><dd>按評卷準則，「牠們」指魚兒；分析的是魚兒與河流的關係。人類濫捕、擴張耕地是造成生態改變的背景，不宜因此把句中的吸吮者改成人或耕地。</dd></div><div><dt>2. 意象含意：詞語帶來甚麼聯想？</dt><dd>「乳汁」使人聯想到孕育、滋養、溫暖和諧；「鮮血」使人聯想到受傷、殘害及艱難求生。把兩者的特點分別連到魚兒前後的生境，才能說明反差。</dd></div><div><dt>3. 效果與主旨：作者藉此凸顯甚麼？</dt><dd>由受滋養到遭殘害的轉變凸顯生態巨變，造成強烈衝擊；再連到人類過度取用資源、破壞人與自然的和諧。主旨分析須建基於前兩層，不能代替引文分析。</dd></div></dl><p class="note neutral">(i) 文件接受比喻／明喻、對比、襯托／反襯。「意象含意」是分析內容的層次，並不表示(i)必須答「象徵」。(ii)仍按效果說明獨立評閱。</p><button type="button" class="button small secondary" data-action="jump-paragraph" data-id="dse2024-fansheng-p6">回第6段核對引文</button></details>`;
  }
  function teacherReviewLabel(q,d) {
    const s=C.teacherReviewStats(q,d,q.answerParts);
    if(s.status==='stale')return '答案已修改 · 須重新覆核';
    if(s.status==='in-progress')return '教師覆核中 · 尚未確認';
    if(s.status!=='reviewed')return '待教師覆核';
    const needs=[s.revise?`需補充${s.revise}項`:'',s.discuss?`待釐清${s.discuss}項`:''].filter(Boolean);
    return '已覆核 · '+(needs.join('、')||'各項已回應');
  }
  function reviewFeedbackHTML(q,d) {
    if(!d.examReviewed)return '';
    const stats=C.teacherReviewStats(q,d,q.answerParts),answer=C.assembleAnswer(d,q.answerParts);
    const gaps=q.rubric.map((r,i)=>({r,i,check:d.checks[i],linked:d.checkEvidence?.[i]?.some(s=>answer.includes(s))})).filter(item=>['no','unsure'].includes(item.check)||(item.check==='yes'&&!item.linked));
    const teacher=stats.status==='reviewed'?d.teacherReview.items.map((item,i)=>({...item,i})).filter(item=>['revise','discuss'].includes(item.status)):[];
    return `<aside class="review-feedback" aria-label="修訂與覆核提醒"><h3>這份答案下一步要處理甚麼？</h3>${teacher.length?`<p>教師指出以下仍需處理：</p><ul>${teacher.map(item=>`<li><strong>${esc(q.rubric[item.i].label)}：</strong>${esc(item.note)}</li>`).join('')}</ul>`:gaps.length?`<p>依你剛才的自檢，以下可能仍需補充：</p><div class="button-row">${gaps.map(item=>`<button type="button" class="button small secondary" data-action="return-check" data-index="${item.i}">${esc(item.r.label)} · ${item.check==='yes'?'未圈支持句':item.check==='unsure'?'不確定':'未做到'}</button>`).join('')}</div>`:'<p>逐項核對自己的表達，圈選支持句後再檢查推論是否充分。</p>'}<p class="field-help">這個提醒依自檢及教師填寫的意見整理；圈句只定位內容，不驗證意思。${q.answerParts.some(p=>p.kind!=='choice')?esc(teacherReviewLabel(q,d))+'。':''}</p></aside>`;
  }
  function teacherFeedbackHTML(q,d) {
    const written=q.answerParts.some(p=>p.kind!=='choice'),stats=C.teacherReviewStats(q,d,q.answerParts);
    const review=stats.status==='stale'?null:d.teacherReview;
    const labels={confirmed:'已回應',revise:'需要補充',discuss:'待釐清'};
    const history=[...(d.teacherReviewHistory||[]),...(stats.status==='stale'&&d.teacherReview?[d.teacherReview]:[])];
    return `<details class="teacher-feedback"><summary>${written?'教師按要點覆核':'老師或同學的覆核意見'}（選填）${written?' · '+esc(teacherReviewLabel(q,d)):''}</summary>${written?`<p class="field-help">由教師閱讀你的答案，按來源評分準則及以下教學要點填寫。這些要點不按項換算分數；完成自檢與教師覆核分開記錄。</p><label class="field"><span class="field-label">覆核教師（選填）</span><input type="text" data-reviewer maxlength="120" value="${esc(d.teacherReview?.reviewer||'')}"></label>${q.rubric.map((r,i)=>`<fieldset class="teacher-review-item"><legend>${i+1}. ${esc(r.label)}</legend><p class="field-help">${esc(r.detail)}</p><label class="field"><span class="field-label">教師覆核結果</span><select data-teacher-result="${i}"><option value="">尚未覆核</option>${Object.entries(labels).map(([value,label])=>`<option value="${value}" ${review?.items[i]?.status===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="field"><span class="field-label">答案哪裏已回應？或還欠甚麼？</span><textarea class="compact" data-teacher-point="${i}" maxlength="1500" placeholder="指出學生的具體句子、推論缺口及下一步修訂。">${esc(review?.items[i]?.note||'')}</textarea></label></fieldset>`).join('')}<button type="button" class="button secondary" data-action="confirm-teacher-review">教師確認這個答案版本的覆核</button><div id="teacher-review-error" aria-live="polite"></div><p id="teacher-review-status" class="field-help" aria-live="polite">${esc(teacherReviewLabel(q,d))}${review?.at?' · '+esc(review.at):''}</p>${history.length?`<details class="teacher-review-history"><summary>查看先前答案版本的覆核（${history.length}份）</summary>${history.map(old=>`<article><p class="field-help">${esc(old.reviewer||'未填教師姓名')} · ${esc(old.at||'尚未確認')}</p><p class="answer-text">${esc(old.answer)}</p><ul>${old.items.map((item,i)=>`<li>${esc(q.rubric[i].label)}：${esc(labels[item.status]||'未覆核')} ${esc(item.note)}</li>`).join('')}</ul></article>`).join('')}</details>`:''}`:''}<label class="field"><span class="field-label">其他老師或同學的意見</span><textarea class="compact" data-teacher-note maxlength="3000">${esc(d.teacherNote||'')}</textarea></label><p class="field-help">意見保存在這份練習記錄，可隨完整備份匯出。</p></details>`;
  }
  function progressSummary(questions,drafts) {
    const summary={completed:0,total:questions.length,objective:{checked:0,total:0,earned:0,checkedMarks:0,totalMarks:0},written:{total:0,completed:0,reviewed:0,pending:0,needsRevision:0},rows:[]};
    for(const q of questions){
      const d=drafts[q.id]||C.newDraft(q),objective=q.answerParts.every(p=>p.kind==='choice'),result=objectiveResult(q,d),review=C.reviewStats(q,d);
      const hasAnswer=!!C.assembleAnswer(d,q.answerParts).trim(),completeAnswer=C.answerComplete(q,d,q.answerParts),started=hasAnswer||!!d.evidence?.length||!!d.hintCount;
      const stage=d.completedAt?'作答及自檢完成':d.examReviewed?`已核對 · 自檢${review.reviewed}/${review.total}`:d.firstAttempt?'首答已保存 · 修訂中':started?'已有草稿':'未開始';
      if(d.completedAt)summary.completed++;
      if(objective){summary.objective.total++;summary.objective.totalMarks+=q.marks;if(result){summary.objective.checked++;summary.objective.earned+=result.earned;summary.objective.checkedMarks+=result.total;}}
      else{const teacher=C.teacherReviewStats(q,d,q.answerParts);summary.written.total++;if(d.completedAt)summary.written.completed++;if(teacher.status==='reviewed'){summary.written.reviewed++;if(teacher.revise||teacher.discuss)summary.written.needsRevision++;}else if(completeAnswer||d.examReviewed)summary.written.pending++;}
      summary.rows.push({q,d,stage,result,review,feedback:objective?(result?`客觀題 ${result.earned}/${result.total}分`:'尚未核對答案'):!hasAnswer?'尚未作答':!completeAnswer?'分題尚未填妥':teacherReviewLabel(q,d)});
    }
    return summary;
  }
  function evidenceFeedbackHTML(q,d,compiled) {
    const status=C.evidenceStatus(q,d.evidence,compiled.sentences);
    const roles=q.id==='dse2024-q9'?[
      {paragraph:1,quote:'我常常想，一百多年前，最早決定定居此處的那些農人，一定再無路可走了。',role:'困境背景',why:'「再無路可走」能支持走投無路的處境，是有用的背景證據；單靠這句仍未說明為何此刻痛哭。'},
      {paragraph:1,quote:q.evidenceAnalysis[0].quote,role:'累積的艱辛',why:'沒日沒夜跋涉交代感情累積的背景，要與後來看到的景象連起來。'},
      {paragraph:1,quote:q.evidenceAnalysis[1].quote,role:'直接觸發與感情結果',why:'看見綠色河谷是此刻痛哭的觸發；把困境、看到安頓希望和感情釋放連成因果鏈。'}
    ]:(q.evidenceAnalysis||[]).map(e=>({...e,role:'可發展的文本線索'}));
    const selected=new Set(d.evidence),covered=new Set();
    const matches=roles.map(e=>{const ids=C.quoteSentenceIds(compiled.passages,q.passages,e.quote,e.paragraph);const found=ids.some(id=>selected.has(id));if(found)ids.forEach(id=>covered.add(id));return {...e,found};});
    const other=d.evidence.filter(id=>!covered.has(id));
    return `<strong>已選線索能支持甚麼？</strong>${matches.length?matches.map(e=>`<p><strong>${e.found?'✓ 已選到':'○ 可回讀'} · ${esc(e.role)}（第${e.paragraph}段）</strong><br>${esc(e.why)}</p>`).join(''):`<ul>${status.groups.map(g=>`<li>${g.found?'已觸及':'可回讀'}：${esc(g.label)}</li>`).join('')}</ul>`}${other.length?`<p>另有${other.length}句未在參考索引中。請說明它支持背景、判斷還是作用；索引以外的合理證據也可接受。</p>`:''}<p class="field-help">這是教練的參考路線，不是對你答案的判分。選到句子不等於已完成推論；用下面三步把關係寫出來。</p>`;
  }
  const transferCandidates=q=>q.taskPlan?.required.includes('compare')?['pace-comparison','lamp-comparison','seed-comparison']:q.taskPlan?.required.some(id=>['symbolism','technique'].includes(id))?['lamp-comparison','lamp-purpose','seed-purpose']:q.taskPlan?.required.some(id=>['effect','structure','theme'].includes(id))?['seed-purpose','lamp-purpose','pace-purpose']:['lamp-inference','seed-inference','pace-inference'];
  const listHTML = items => `<ol class="coach-list">${items.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
  function stageHTML(lesson,step) {
    if (!lesson) return '';
    if (step===0) return `<aside class="lesson-stage"><span class="small-label">教練拆題 · 新增分析</span><p>${esc(lesson.target)}</p><dl class="question-eyes">${lesson.eyes.map(e=>`<div><dt>${esc(e.word)}</dt><dd>${esc(e.meaning)}</dd></div>`).join('')}</dl></aside>`;
    if (step===1) return `<aside class="lesson-stage"><h3>找證據的路線</h3>${listHTML(lesson.search)}<p class="field-help">每選一句，先說它支持哪一個判斷；核對後可查看完整的逐句推論。</p></aside>`;
    return `<details class="lesson-stage" data-support="writing"><summary>落筆次序與可遷移句式 · 教練指引</summary>${listHTML(lesson.writing)}<p class="writing-frame">${esc(lesson.frame)}</p><p class="field-help">句式用於組織思考，並非文件提供的另一份標準答案；選擇及短答題只填原題要求的內容。</p></details>`;
  }
  function methodsHTML(coaching) {
    return `<section class="surface coaching-methods"><h2>先學一套可重用的作答方法</h2><p class="field-help">以下是新增教練分析。實際作答須按題型調整，不把每題硬寫成相同長答。</p><div class="method-grid">${coaching.generalMethods.map((m,i)=>`<article><span class="small-label">${String(i+1).padStart(2,'0')}</span><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p><p class="method-example">套回《繁盛》：${esc(m.example)}</p></article>`).join('')}</div><details class="source-criteria"><summary>篇章地圖：不同題型應回哪裏找？</summary><div class="table-scroll"><table class="exam-table"><thead><tr><th scope="col">段落</th><th scope="col">內容</th><th scope="col">相關題</th><th scope="col">怎樣使用</th></tr></thead><tbody>${coaching.passageMap.map(p=>`<tr><th scope="row">${esc(p.range)}</th><td>${esc(p.focus)}</td><td>${esc(p.questions)}</td><td>${esc(p.use)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }
  function lessonHTML(q,lesson,{standalone=false,compact=true}={}) {
    if (!lesson) return '';
    let evidenceIndex=0;
    const steps=lesson.steps.map((s,i)=>`<article class="worked-step"><h4><span>${i+1}</span>${esc(s.title)}</h4>${s.evidence.map(e=>`<div class="worked-evidence"><span class="small-label source-label">第${e.paragraph}段 · 原文</span><blockquote>${esc(e.quote)}</blockquote><button type="button" class="button small secondary" data-action="add-coach-evidence" data-index="${evidenceIndex++}">標註這句證據</button></div>`).join('')}<p><strong>先看原文字面：</strong>${esc(s.read)}</p><p class="reasoning"><strong>再推到答案：</strong>${esc(s.infer)}</p></article>`).join('');
    const options=lesson.options.map(o=>{const p=q.answerParts.find(p=>p.key===o.part),c=p.choices.find(c=>c.value===o.value);return `<article class="option-analysis ${o.correct?'is-correct':''}"><div><span class="tag">${esc(o.value)} · ${o.correct?'符合文件答案':'排除'}</span><strong>${q.answerParts.length>1?esc(p.label)+' · ':''}${esc(c.text)}</strong></div><p>${esc(o.reason)}</p></article>`;}).join('');
    const cases=lesson.mistakes.map((m,i)=>`<details class="loss-case"><summary><span class="tag">文件 ${m.score} / ${m.outOf}分</span><span>${esc(m.part)} · ${esc(m.title||("失分例 "+(i+1)))}</span></summary><div class="loss-case-body"><p class="source-credit">來源：${esc(m.source.name)} · 第${esc(m.source.pages)}頁</p><blockquote class="source-excerpt">${esc(m.text)}</blockquote><p><strong>可能怎樣想到這個答案：</strong>${esc(m.thought)}</p><p><strong>為甚麼不足分／零分：</strong>${esc(m.diagnosis)}</p><h4>怎樣保留正確部分、修補缺口</h4>${listHTML(m.repair)}</div></details>`).join('');
    const model=q.official.flatMap(p=>p.examples).find(e=>e.score===4);
    const modelHTML=lesson.modelNotes&&model?`<details class="coaching-section"><summary>文件4分舉隅：逐層看它做到甚麼</summary><div class="coaching-section-body"><p class="source-credit">來源：${esc(q.source.answer.name)} · 第${esc(q.source.answer.pages)}頁。分數來自文件；下列段落功能為新增教練分析。</p><blockquote class="source-excerpt">${esc(model.text)}</blockquote>${lesson.modelNotes.map(n=>`<p class="model-note"><strong>「${esc(n.quote)}」</strong><br>${esc(n.role)}</p>`).join('')}<p class="field-help">學習推論與組織方式，無須逐字背誦；品第按整體表現評閱。</p></div></details>`:'';
    return `<section class="deep-lesson" aria-label="第${q.number}題逐題精講">
      <div class="small-label">教練精講 · 新增分析</div><h2>${esc(lesson.headline)}</h2>
      <section class="lesson-essentials" aria-label="先讀三步"><span class="tag">必讀 · 先掌握三步</span><ol>${[...lesson.search,...lesson.writing].slice(0,3).map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${conceptHTML(q)}</section>
      <p class="field-help">按需要選一組展開；來源答案與教練分析分別標示。</p>
      <details class="lesson-track" data-support="lesson"${compact?'':' open'}><summary><span class="tag">必讀</span> 找證據、推論與落筆</summary><div class="lesson-track-body"><p class="lesson-target">${esc(lesson.target)}</p>${standalone?stageHTML(lesson,0)+stageHTML(lesson,1):''}<details class="coaching-section"><summary>從原文到答案：${lesson.steps.length}步完整示範</summary><div class="coaching-section-body">${steps}</div></details>${options?`<details class="coaching-section"><summary>逐項判斷：正確選項與干擾項為何成立或不成立</summary><div class="coaching-section-body">${options}</div></details>`:''}<details class="coaching-section"><summary>落筆次序：如何把理解寫清楚</summary><div class="coaching-section-body">${listHTML(lesson.writing)}<h4>可遷移的思考／表達框架</h4><p class="writing-frame">${esc(lesson.frame)}</p><p class="field-help">框架為教練新增；不是另一份文件標準答案，也不是逐空一分的評分表。</p></div></details></div></details>
      ${(cases||modelHTML)?`<details class="lesson-track" data-support="examples"><summary><span class="tag">延伸</span> 比較文件例答與失分修訂</summary><div class="lesson-track-body"><p class="field-help">低分例是文件答案舉隅，不代表學生作答次數或比例。「可能怎樣想到」是教練推測。</p>${cases?`<details class="coaching-section"><summary>文件失分例診斷：${lesson.mistakes.length}個不足分／零分答案</summary><div class="coaching-section-body">${cases}</div></details>`:''}${modelHTML}</div></details>`:''}
      <details class="lesson-track" data-support="lesson"><summary><span class="tag">延伸</span> 遷移技巧與理解自測</summary><div class="lesson-track-body"><details class="coaching-section"><summary>通用步驟與這題的額外技巧</summary><div class="coaching-section-body"><h4>下一篇可怎樣重用？</h4>${listHTML(lesson.transfer)}<h4>再避開這些陷阱</h4><ul class="coach-list">${lesson.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></details><details class="coaching-section"><summary>教練小檢查：是否真的理解推論？</summary><div class="coaching-section-body"><p class="field-help">以下是新增口頭自測，不屬原卷題目、不計分。</p>${lesson.checks.map(c=>`<article class="coach-check"><h4>${esc(c.question)}</h4><details><summary>查看思路</summary><p>${esc(c.answer)}</p></details></article>`).join('')}</div></details></div></details>
      <div class="lesson-toolbar"><button type="button" class="button small secondary" data-action="expand-coaching">展開精講細節</button><button type="button" class="button small quiet" data-action="collapse-coaching">收起精講細節</button></div>
    </section>`;
  }
  function lessonText(q,lesson) {
    const lines=['【逐題精講｜教練分析（新增）】',lesson.headline,lesson.target,'','題眼：',...lesson.eyes.map(e=>`${e.word}：${e.meaning}`),'','找證據的路線：',...lesson.search.map((s,i)=>`${i+1}. ${s}`)];
    lesson.steps.forEach((s,i)=>{lines.push('',`解題步驟${i+1}：${s.title}`,...s.evidence.map(e=>`原文證據｜第${e.paragraph}段：${e.quote}`),'先看字面：'+s.read,'再推答案：'+s.infer);});
    if(lesson.options.length)lines.push('','【逐項排除｜教練分析】');
    for(const o of lesson.options){const p=q.answerParts.find(p=>p.key===o.part),c=p.choices.find(c=>c.value===o.value);lines.push(`${p.label}｜${o.value}. ${c.text}｜${o.correct?'符合文件答案':'排除'}`,o.reason);}
    if(lesson.mistakes.length)lines.push('','【不足分／零分答案診斷】','原答案與分數按文件；可能誤讀及修訂為教練分析，不代表實際考生出現率。');
    for(const m of lesson.mistakes)lines.push('',`${m.part}｜${m.title||"失分例"}｜文件 ${m.score}/${m.outOf}分`,`來源：${m.source.name}，第${m.source.pages}頁。`,'文件答案舉隅：'+m.text,'可能怎樣想到（教練推測）：'+m.thought,'失分診斷（教練分析）：'+m.diagnosis,...m.repair.map((s,i)=>`修訂${i+1}：${s}`));
    if(lesson.modelNotes)lines.push('','【文件4分舉隅的結構拆解｜教練分析】',...lesson.modelNotes.map(n=>`「${n.quote}」：${n.role}`));
    lines.push('','【落筆次序】',...lesson.writing.map((s,i)=>`${i+1}. ${s}`),'可遷移框架（新增，不是文件標準答案）：'+lesson.frame,'','【通用步驟】',...lesson.transfer.map((s,i)=>`${i+1}. ${s}`),'','【額外技巧】',...lesson.tips,'','【教練小檢查｜新增，不屬原卷，不計分】',...lesson.checks.map(c=>c.question+'\n思路：'+c.answer));
    return lines.join('\n');
  }
  function worksheet(exam) {
    const lines=[`2024 DSE 中國語文卷一｜李娟《${exam.title}》練習`, '原卷第一篇：15段，第9–20題，共35分。', '文章與原題按提供資料夾的原卷；版面空格及答題線改為文字稿。', '', '【文章】'];
    exam.passages[0].paragraphs.forEach((p,i)=>lines.push(`（${i+1}）${p}`,''));
    lines.push(`李娟《${exam.title}》`,'','【原題】');
    for (const q of exam.questions) {lines.push(`${q.number}. ${questionText(q)}`);for(const p of q.answerParts)if(p.kind!=='choice')lines.push((p.answerLabel||p.label)+' ______________________________');lines.push('');}
    lines.push('【來源】',...exam.sources.slice(0,2).map(s=>`${s.name}，第${s.pages}頁。`));
    return lines.join('\n')+'\n';
  }
  function answerSheet(exam,coaching=null) {
    const lines=[`2024 DSE 李娟《${exam.title}》｜來源答案與教練分析`, '來源答案及評分準則保留文件文字；教練拆題、提示及證據解釋為新增分析。', '客觀題核對選項；書面題仍須教師評閱，自檢項目不換算分數。',''];
    if(coaching){lines.push(coaching.notice,'','【通用答題方法｜教練新增】');coaching.generalMethods.forEach((m,i)=>lines.push(`${i+1}. ${m.title}`,m.text,'套回本篇：'+m.example,''));lines.push('【篇章地圖｜教練新增】',...coaching.passageMap.map(p=>`第${p.range}段｜${p.focus}｜第${p.questions}題｜${p.use}`),'');}
    for (const q of exam.questions) {
      lines.push(`【第${q.number}題｜原題 ${q.marks}分】`,questionText(q),'',`來源：${q.source.answer.name}，第${q.source.answer.pages}頁。`);
      for (const m of q.official) {
        lines.push(`${m.label}（${m.marks}分）`,...m.answers.map(a=>'文件答案：'+a),...m.criteria.map(c=>'評分原則：'+c),...m.bands.map(b=>`${b.label}（${b.score}分）：${b.text}`));
        for (const e of m.examples) lines.push(`文件答案舉隅（${e.score}/${m.marks}分）：${e.text}`,e.note);
      }
      const lesson=coaching?.lessons[q.id];
      if(lesson)lines.push('',lessonText(q,lesson));
      else {lines.push('','教練拆題（新增）：'+q.guidance,...q.hints.map((h,i)=>`教練提示${i+1}：${h}`));for(const e of q.evidenceAnalysis)lines.push(`原文證據｜第${e.paragraph}段：${e.quote}`,'教練分析（新增）：'+e.why);}
      lines.push('');
    }
    lines.push('【書面題一般評分原則（文件摘錄）】',...exam.generalCriteria,'','【來源】',...[...exam.sources,...(coaching?.references||[])].map(s=>`${s.name}，第${s.pages}頁。`));
    return lines.join('\n')+'\n';
  }
  return {allAnswered,objectiveResult,scoreText,questionText,promptHTML,answerHTML,markingHTML,evidenceHTML,lessonEvidence,reviewQuestion,linkedReviewHTML,revisionPromptHTML,conceptHTML,teacherReviewLabel,reviewFeedbackHTML,teacherFeedbackHTML,progressSummary,evidenceFeedbackHTML,transferCandidates,stageHTML,methodsHTML,lessonHTML,lessonText,worksheet,answerSheet};
}));
