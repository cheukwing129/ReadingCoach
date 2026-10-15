const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-table-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'#year/2024');await page.locator('#year-access-password').fill(process.env.BROWSER_QA_PASSWORD);
  await page.locator('#year-access-form button[type=submit]').click();await page.locator('.article-row').first().waitFor();
  const questions=await page.evaluate(()=>SelfStudyData.questions.filter(q=>q.tableAnswerCells));
  assert.equal(questions.length,33);
  const start=async q=>{
   await page.goto(origin+'#lesson/'+q.id);await page.locator('.question-prompt').waitFor();
   await page.locator('.stepper [data-step="0"]').click();await page.locator('[data-type="'+q.lesson.type+'"]').click();await page.locator('.learning-stage [data-step="1"]').click();
  };
  let cells=0,layouts=0;
  for(const q of questions){
   await start(q);
   assert.equal(await page.locator('.question-text table').count(),0,q.id+' duplicates');
   assert.equal(await page.locator('.answer-table').count(),(q.tables||[q.table]).length);
   assert.equal(await page.locator('[data-answer]').count(),q.answerParts.length);
   for(const [key,[ti,ri,ci]]of Object.entries(q.tableAnswerCells)){
    const cell=page.locator('.answer-table').nth(ti).locator('tbody tr').nth(ri).locator(':scope > th,:scope > td').nth(ci);
    assert.equal(await cell.locator('[data-answer="'+key+'"]').count(),1,q.id+'/'+key+' mapping');
    await cell.locator('[data-answer]').fill('答案'+q.number+'-'+key+'<&');cells++;
   }
   await page.locator('.learning-stage [data-step="2"]').first().click();
   await page.locator('.stepper [data-step="1"]').click();
   await page.reload();await page.locator('.answer-table').first().waitFor();
   for(const p of q.answerParts)assert.equal(await page.locator('[data-answer="'+p.key+'"]').inputValue(),'答案'+q.number+'-'+p.key+'<&',q.id+' persistence');
   for(const width of [320,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){await page.screenshot({path:out+'/overflow.png'});console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1&&e.left<innerWidth).slice(0,20)));}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,q.id+' width '+width);
    for(const input of await page.locator('.answer-table textarea').all()){
     const box=await input.boundingBox();assert.ok(box.width>=85,q.id+' usable width');
    }
    layouts++;
   }
  }
  // A merged cell, an input in the row-heading column, and two source tables survive.
  await start(questions.find(q=>q.id==='dse2018-q23'));assert.equal(await page.locator('.table-answer-cell[colspan="2"] [data-answer="i"]').count(),1);
  await start(questions.find(q=>q.id==='dse2018-q14'));assert.equal(await page.locator('th.table-answer-cell [data-answer="i"]').count(),1);
  await page.locator('[data-answer="i"]').fill('測試字數');assert.equal(await page.locator('[data-count="i"]').innerText(),'4字');
  await page.locator('[data-answer="i"]').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('[data-answer="ii"]').evaluate(el=>el===document.activeElement),true);
  await start(questions.find(q=>q.id==='dse2024-q11'));await page.locator('[data-answer="i"]').fill('失落');await page.locator('[data-answer="ii"]').fill('凸顯魚兒受挫後變得謹慎。');
  await page.locator('.learning-stage [data-step="2"]').first().click();
  for(const select of await page.locator('[data-grade]').all())await select.selectOption('0');
  await page.locator('[data-action="reveal"]').click();assert.equal(await page.locator('[data-own-part]').count(),2);
  await page.locator('.stepper [data-step="1"]').click();await page.locator('[data-answer="ii"]').fill('修改後的答案');
  await page.locator('.learning-stage [data-step="2"]').first().click();assert.equal(await page.locator('#reveal-button').isDisabled(),true);assert.equal(await page.locator('.score-badge').count(),0);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1000});await start(questions.find(q=>q.id==='dse2024-q11'));
   await page.locator('.answer-table').scrollIntoViewIfNeeded();await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:out+'/table-answer-'+width+'.png'});
  }
  // Static choice tables retain their existing answer controls and all original options.
  await page.goto(origin+'#lesson/dse2026-q23');await page.locator('[data-type="judgement"]').click();await page.locator('.learning-stage [data-step="1"]').click();assert.equal(await page.locator('.question-text table').count(),1);assert.equal(await page.locator('[data-answer="answer"]').count(),3);
  await page.goto(origin+'dist/index.html#lesson/dse2024-q11');await page.locator('.answer-table').waitFor();assert.equal(await page.locator('[data-answer="ii"]').inputValue(),'修改後的答案');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,questions:questions.length,cells,layouts,screenshots:out}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
