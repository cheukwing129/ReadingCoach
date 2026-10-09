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
    return q.answerParts.every(p=>p.kind==='choice') ? '尚未核對答案' : '書面題待教師評閱';
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
  function promptHTML(q) {
    const choiceList = p => `<ul class="exam-options">${p.choices.map(c=>`<li><span>${esc(c.value)}.</span> ${esc(c.text)}</li>`).join('')}</ul>`;
    return `<span class="small-label source-label">原題 · QAB 第${esc(q.source.question.pages)}頁</span><p class="prompt">${q.number}. ${esc(q.prompt)}${q.promptMarks?`（${q.marks}分）`:''}</p>${q.quote?`<blockquote class="exam-quote">${esc(q.quote)}</blockquote>`:''}${q.table?`<div class="table-scroll" role="region" aria-label="第${q.number}題原題表格" tabindex="0"><table class="exam-table"><thead><tr>${q.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${!q.table?q.answerParts.map(p=>`${q.answerParts.length>1?`<p class="exam-part-prompt">${esc(p.label)}${q.partMarks?`（${p.marks}分）`:''}</p>`:''}${p.choices?choiceList(p):''}`).join(''):''}<p class="field-help source-credit">來源：${esc(q.source.question.name)}，第${esc(q.source.question.pages)}頁。文字與分值按原卷；答題欄轉為網頁格式。</p>`;
  }
  function answerHTML(q,d) {
    return q.answerParts.map(p=>p.kind==='choice'?`<fieldset class="exam-answer-part"><legend>${esc(p.label)} <span class="muted">／${p.marks}分</span></legend>${p.choices.map(c=>`<label class="choice"><input type="radio" name="exam-${esc(q.id)}-${esc(p.key)}" data-exam-answer="${esc(p.key)}" value="${esc(c.value)}" ${d.fields[p.key]===c.value?'checked':''}><span><strong>${esc(c.value)}.</strong> ${esc(c.text)}</span></label>`).join('')}</fieldset>`:`<label class="field exam-answer-part"><span class="field-label">${esc(p.label)} <span class="muted">／${p.marks}分</span></span>${p.kind==='short'?`<input type="text" data-answer="${esc(p.key)}" maxlength="120" value="${esc(d.fields[p.key]||'')}" placeholder="${p.exactChars?'請填一個'+p.exactChars+'字詞':'請按原題填寫'}" autocomplete="off">`:`<textarea class="big" data-answer="${esc(p.key)}" maxlength="12000" placeholder="先直接回應題目，再用貼題的原文線索說明。">${esc(d.fields[p.key]||'')}</textarea>`}${p.exactChars?`<span class="field-help">原題要求${p.exactChars}字詞。系統只提醒格式，內容及錯別字仍須教師評閱。</span>`:''}</label>`).join('');
  }
  function markingHTML(q,d) {
    if (!d.examReviewed || !allAnswered(q,d)) return '';
    const result = objectiveResult(q,d);
    return `<section class="source-answer" aria-label="來源答案及評分資料"><h3>來源答案及評分資料</h3><p class="source-credit">${esc(q.source.answer.name)} · 第${esc(q.source.answer.pages)}頁</p>${result?`<p class="note">按文件答案核對：<strong>${result.earned} / ${result.total} 分</strong>。只核對選項，不評定閱讀能力等級。</p>`:'<p class="note neutral">以下答案及準則摘自文件。長答題按整體表現評閱；自檢項目不換算成分數。合理而有文本支持的其他表達，可交由教師按準則判斷。</p>'}${q.official.map(m=>`<article class="source-part"><h4>${esc(m.label)} <span class="tag">原題 ${m.marks}分</span></h4>${m.answers.length?`<div class="source-excerpt"><strong>文件列出的正確答案</strong><ul>${m.answers.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>`:''}${m.criteria.length?`<details class="source-criteria" open><summary>評分原則（文件摘錄）</summary><ul>${m.criteria.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`:''}${m.bands.length?`<details class="source-criteria"><summary>查看各品第準則（文件摘錄）</summary>${m.bands.map(b=>`<p><strong>${esc(b.label)} · ${b.score}分</strong><br>${esc(b.text)}</p>`).join('')}</details>`:''}${m.examples.length?`<details class="source-criteria"><summary>比較文件中的答案舉隅</summary>${m.examples.map(e=>`<article class="example"><div class="example-head"><strong>文件答案舉隅</strong><span class="tag">${e.score} / ${m.marks} 分</span></div><p>${esc(e.text)}</p><p class="field-help">${esc(e.note)}</p></article>`).join('')}</details>`:''}</article>`).join('')}</section>`;
  }
  function evidenceHTML(q,d) {
    if (!d.examReviewed) return '';
    return `<section class="exam-evidence-analysis"><div class="small-label source-label">教練分析 · 以下解釋為新增指引</div><h3>答案如何連到文本證據？</h3>${q.evidenceAnalysis.map((e,i)=>`<article class="evidence-analysis"><span class="tag">第${e.paragraph}段 · 原文</span><blockquote>${esc(e.quote)}</blockquote><p><strong>如何支持作答：</strong>${esc(e.why)}</p><button type="button" class="button small secondary" data-action="add-source-evidence" data-index="${i}">加入這句證據</button></article>`).join('')}</section>`;
  }
  function worksheet(exam) {
    const lines=[`2024 DSE 中國語文卷一｜李娟《${exam.title}》練習`, '原卷第一篇：15段，第9–20題，共35分。', '文章與原題按提供資料夾的原卷；版面空格及答題線改為文字稿。', '', '【文章】'];
    exam.passages[0].paragraphs.forEach((p,i)=>lines.push(`（${i+1}）${p}`,''));
    lines.push(`李娟《${exam.title}》`,'','【原題】');
    for (const q of exam.questions) {lines.push(`${q.number}. ${questionText(q)}`);for(const p of q.answerParts)if(p.kind!=='choice')lines.push((p.answerLabel||p.label)+' ______________________________');lines.push('');}
    lines.push('【來源】',...exam.sources.slice(0,2).map(s=>`${s.name}，第${s.pages}頁。`));
    return lines.join('\n')+'\n';
  }
  function answerSheet(exam) {
    const lines=[`2024 DSE 李娟《${exam.title}》｜來源答案與教練分析`, '來源答案及評分準則保留文件文字；教練拆題、提示及證據解釋為新增分析。', '客觀題核對選項；書面題仍須教師評閱，自檢項目不換算分數。',''];
    for (const q of exam.questions) {
      lines.push(`【第${q.number}題｜原題 ${q.marks}分】`,questionText(q),'',`來源：${q.source.answer.name}，第${q.source.answer.pages}頁。`);
      for (const m of q.official) {
        lines.push(`${m.label}（${m.marks}分）`,...m.answers.map(a=>'文件答案：'+a),...m.criteria.map(c=>'評分原則：'+c),...m.bands.map(b=>`${b.label}（${b.score}分）：${b.text}`));
        for (const e of m.examples) lines.push(`文件答案舉隅（${e.score}/${m.marks}分）：${e.text}`,e.note);
      }
      lines.push('','教練拆題（新增）：'+q.guidance,...q.hints.map((h,i)=>`教練提示${i+1}：${h}`));
      for (const e of q.evidenceAnalysis) lines.push(`原文證據｜第${e.paragraph}段：${e.quote}`,'教練分析（新增）：'+e.why);
      lines.push('');
    }
    lines.push('【書面題一般評分原則（文件摘錄）】',...exam.generalCriteria,'','【來源】',...exam.sources.map(s=>`${s.name}，第${s.pages}頁。`));
    return lines.join('\n')+'\n';
  }
  return {allAnswered,objectiveResult,scoreText,questionText,promptHTML,answerHTML,markingHTML,evidenceHTML,worksheet,answerSheet};
}));
