const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),output=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-export-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/',errors=[];let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'#export/year/2024');await page.locator('#year-access-form').waitFor();assert.equal(await page.locator('.exam-paper').count(),0);
  // Use the existing access API so no password is embedded in this script.
  await page.evaluate(()=>localStorage.setItem(ReadingCoachYearAccess.storageKey,JSON.stringify({version:1,teacherHash:COACH_YEAR_ACCESS_CONFIG.teacher,years:{}})));await page.reload();await page.locator('#export-missing-title').waitFor();assert.equal(await page.locator('[data-export-print]').count(),0);
  // One answered part does not hide a missing sibling, even if the learning status is complete.
  await page.evaluate(()=>{const s=SelfStudyCore.fresh();s.questions['dse2024-q12']={...SelfStudyCore.draft(),completed:true,answers:{i:'D'}};localStorage.setItem(SelfStudyCore.KEY,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:SelfStudyCore.KEY,newValue:JSON.stringify(s)}));});await page.reload();
  assert.equal(await page.locator('[href="#lesson/dse2024-q12"][data-export-missing="i"]').count(),0);assert.equal(await page.locator('[href="#lesson/dse2024-q12"][data-export-missing="ii"]').count(),1);
  // Seed distinctive student responses, not official prose, with every learning step incomplete.
  await page.evaluate(()=>{const s=SelfStudyCore.fresh();for(const q of SelfStudyData.questions){const d=SelfStudyCore.draft();d.type=q.lesson.type;for(const p of q.answerParts)d.answers[p.key]=p.kind==='choice'?p.answer:p.segment?p.segment.accepted[0].join('至'):p.kind==='short'?(q.official.find(o=>o.key===p.key)?.answers?.[0]?.split('／')[0]||'學生短答'):'學生'+q.id+'-'+p.key+'的完整作答。這段以原文作依據，解釋人物的處境、行動與感受。';s.questions[q.id]=d;}s.questions['dse2024-q17'].answers.answer='堅毅';s.questions['dse2024-q12'].answers.ii='D';localStorage.setItem(SelfStudyCore.KEY,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:SelfStudyCore.KEY,newValue:JSON.stringify(s)}));});await page.reload();await page.locator('.exam-paper').waitFor();
  assert.equal(await page.locator('[data-export-question]').count(),19);assert.match(await page.locator('[data-export-question="dse2024-q12"] [data-export-answer="ii"] .exam-mark').innerText(),/0 \/ 1分/);
  assert.match(await page.locator('[data-export-question="dse2024-q17"] .exam-mark').innerText(),/2 \/ 2分/);assert.match(await page.locator('[data-export-question="dse2024-q15"] .exam-mark').innerText(),/教師評分/);
  await page.locator('[data-export-meta="name"]').fill('測試同學');await page.locator('[data-export-meta="className"]').fill('6A');await page.locator('[data-export-meta="number"]').fill('12');
  await page.evaluate(()=>{window.__printed=0;window.print=()=>window.__printed++;});await page.locator('[data-export-print]').click();await page.waitForFunction(()=>window.__printed===1);
  assert.equal(await page.locator('[data-exam-meta="name"]').innerText(),'測試同學');
  const before=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem(SelfStudyCore.KEY)).questions));
  for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'viewport overflow '+width);}
  await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(output,'2024.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.locator('[data-export-passages]').check();assert.equal(await page.locator('.exam-passage').count(),2);await page.locator('[data-export-passages]').uncheck();
  const years=await page.evaluate(()=>[...new Set(SelfStudyData.questions.map(q=>q.year))]);let questions=0,parts=0;
  for(const year of years){
   await page.goto(origin+'#export/year/'+year);await page.locator('.exam-paper').waitFor();
   const counts=await page.evaluate(y=>{const qs=SelfStudyData.questions.filter(q=>q.year===y);return{questions:qs.length,parts:qs.reduce((s,q)=>s+q.answerParts.length,0),tables:qs.reduce((s,q)=>s+(q.tables?.length||(q.table?1:0)),0)};},year);
   assert.equal(await page.locator('[data-export-question]').count(),counts.questions);assert.equal(await page.locator('[data-export-answer]').count(),counts.parts);assert.equal(await page.locator('.exam-table').count(),counts.tables);questions+=counts.questions;parts+=counts.parts;
   assert.equal(await page.locator('.exam-paper').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'paper overflow '+year);
   if([2013,2018,2026].includes(year))await page.pdf({path:path.join(output,year+'.pdf'),preferCSSPageSize:true});
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem(SelfStudyCore.KEY)).questions)),before,'export leaves student answers and learning state intact');
  // A single article exports only its own questions, including full unsplit grouped tasks.
  await page.goto(origin+'dist/index.html#export/article/dse2024-fansheng');await page.locator('.exam-paper').waitFor();assert.equal(await page.locator('[data-export-question]').count(),12);assert.equal(await page.locator('[data-export-question="dse2024-q13"] [data-export-answer]').count(),2);
  await page.goto(origin+'#export/article/dse2021-train');await page.locator('.exam-paper').waitFor();await page.locator('[data-export-passages]').check();assert.equal(await page.locator('.exam-passage').count(),2,'cross-passage questions include both original texts');
  // Long responses must flow over pages with their final line preserved.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(SelfStudyCore.KEY));s.questions['dse2024-q15'].answers.answer=('長答案要保留每個字，不可以因分頁而截斷。\n').repeat(220)+'長答案最後一句';localStorage.setItem(SelfStudyCore.KEY,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:SelfStudyCore.KEY,newValue:JSON.stringify(s)}));});
  await page.goto(origin+'#export/article/dse2024-fansheng');await page.locator('.exam-paper').waitFor();await page.pdf({path:path.join(output,'long-answer.pdf'),preferCSSPageSize:true});assert.match(await page.locator('[data-export-question="dse2024-q15"] .exam-answer').innerText(),/長答案最後一句$/);
  // Return to learning still opens the correct group and keeps the drafted text.
  await page.goto(origin+'#lesson/dse2024-q13');await page.locator('.learning-stage').waitFor();await page.locator('.stepper [data-step="1"]').click();assert.equal(await page.locator('[data-answer="i"]').inputValue(),'比喻');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,years:years.length,questions,parts,pdfs:5,mobileWidths:4,missingChecks:true,automaticScores:true,originalLearningFlow:true,output}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
