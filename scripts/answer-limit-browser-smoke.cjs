const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{try{
  const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
  if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/';let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  const page=await browser.newPage({viewport:{width:320,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'#year/2024');await page.locator('#year-access-password').fill(process.env.BROWSER_QA_PASSWORD);await page.locator('#year-access-form button[type=submit]').click();await page.locator('.article-row').first().waitFor();
  const questions=await page.evaluate(()=>SelfStudyData.questions.filter(q=>q.answerParts.some(p=>SelfStudyCore.answerLimit(p))).map(q=>({...q,answerParts:q.answerParts.map(p=>({...p,limit:SelfStudyCore.answerLimit(p)}))})));let fields=0,grids=0;
  const start=async q=>{await page.goto(origin+'#lesson/'+q.id);await page.waitForFunction(q=>document.querySelector('.question-prompt')?.textContent===q.prompt,q);await page.locator('.stepper [data-step="0"]').click();await page.locator('[data-type="'+q.lesson.type+'"]').click();await page.locator('.learning-stage [data-step="1"]').click();};
  for(const q of questions){
   await start(q);
   for(const p of q.answerParts.filter(p=>p.limit)){
    const input=page.locator('[data-answer="'+p.key+'"]'),hint=page.locator('#answer-limit-'+p.key),count=page.locator('[data-count="'+p.key+'"]');
    assert.equal(await hint.innerText(),p.limit.text,q.id+'/'+p.key);assert.match(await input.getAttribute('aria-describedby'),new RegExp('answer-limit-'+p.key));assert.equal(await input.getAttribute('maxlength'),null);
    const text='字'.repeat(p.limit.max?p.limit.max+1:4);await input.fill(text);assert.equal(await input.inputValue(),text);
    if(p.limit.max){assert.equal(await count.innerText(),(p.limit.max+1)+' / '+p.limit.max+'字 · 已超出1字');assert.equal(await count.evaluate(e=>e.classList.contains('is-over-limit')),true);}
    else{assert.equal(await count.innerText(),'4字');assert.equal(await count.evaluate(e=>e.classList.contains('is-over-limit')),false);assert.match(await hint.innerText(),/四字手法/);}
    fields++;if(p.sourceGridCells)grids++;
   }
   await page.reload();await page.locator('.answer-limit').first().waitFor();
   for(const p of q.answerParts.filter(p=>p.limit)){const input=page.locator('[data-answer="'+p.key+'"]');assert.equal(await input.inputValue(),'字'.repeat(p.limit.max?p.limit.max+1:4));await input.fill('字');assert.equal(await page.locator('[data-count="'+p.key+'"]').evaluate(e=>e.classList.contains('is-over-limit')),false);}
   for(const width of [320,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,q.id+' width '+width);}
  }
  assert.equal(grids,28);
  for(const [id,width]of [['dse2017-q7',390],['dse2024-q13',1440]]){await page.setViewportSize({width,height:1000});await start(questions.find(q=>q.id===id));await page.locator('.answer-limit').first().scrollIntoViewIfNeeded();await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:'/tmp/readingcoach-answer-limit-'+width+'.png'});}
  await page.goto(origin+'dist/index.html#lesson/dse2025-q19');await page.locator('#answer-limit-answer').waitFor();assert.match(await page.locator('#answer-limit-answer').innerText(),/最多可答26字.*包括標點/);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,questions:questions.length,fields,grids,limitsAndCountsPersist:true,viewports:2}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
