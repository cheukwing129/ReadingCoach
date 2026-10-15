const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
 const w={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'dist/year-access-config.js'),'utf8'),w);
 const config=JSON.parse(JSON.stringify(w.window.COACH_YEAR_ACCESS_CONFIG));config.years[2024]=crypto.createHash('sha256').update('student-test-year').digest('hex');
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(file.endsWith('/year-access-config.js')?'window.COACH_YEAR_ACCESS_CONFIG='+JSON.stringify(config)+';':fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/',errors=[];
 let browser;
 try{
  const launch=()=>chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  const pageFor=async password=>{const p=await browser.newPage({viewport:{width:390,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'#year/2024');await p.locator('#year-access-password').fill(password);await p.locator('#year-access-form button[type=submit]').click();await p.locator('.article-row').first().waitFor();return p;};
  const start=async(p,id)=>{await p.goto(origin+'#lesson/'+id);await p.locator('.question-rail a[href="#lesson/'+id+'"][aria-current]').waitFor();await p.locator('.stepper [data-step="0"]').click();const q=await p.evaluate(id=>SelfStudyData.questions.find(q=>q.id===id),id);await p.locator('[data-type="'+q.lesson.type+'"]').click();await p.locator('.learning-stage [data-step="1"]').click();return q;};
  const scoreAll=async p=>{for(const s of await p.locator('[data-grade]').all())await s.selectOption('0');};
  const saved=async(p,id)=>p.evaluate(id=>JSON.parse(localStorage.getItem(SelfStudyCore.KEY)).questions[id],id);
  browser=await launch();const student=await pageFor('student-test-year');await start(student,'dse2024-q13');
  assert.deepEqual(await student.locator('[data-answer]').evaluateAll(es=>es.map(e=>e.dataset.answer)),['i','ii']);
  await student.locator('[data-answer="i"]').fill('對比');await student.locator('[data-answer="ii"]').fill('學生自己的分析');await student.locator('.learning-stage [data-step="2"]').first().click();
  assert.deepEqual(await student.locator('[data-sample-part]').evaluateAll(es=>es.map(e=>e.dataset.samplePart)),['i']);assert.equal(await student.locator('#reveal-button').isDisabled(),true);
  await student.locator('#reveal-button').evaluate(b=>{b.disabled=false;b.click();});assert.equal(await student.locator('.score-badge').count(),0);
  await scoreAll(student);assert.equal(await student.locator('#reveal-button').isDisabled(),false);await student.locator('#reveal-button').click();assert.equal(await student.locator('.explanation-overview,.transfer-note').count(),0);assert.equal(await student.locator('[data-own-part="ii"]').count(),0);assert.equal(await student.locator('#next-question').isVisible(),false);
  await student.locator('[data-action="complete"]').click();await student.locator('[data-group="ii"][aria-current]').waitFor();assert.equal(await student.locator('#reveal-button').isDisabled(),true);assert.equal((await saved(student,'dse2024-q13')).groupProgress.i.completed,true);await student.reload();await student.locator('[data-group="ii"][aria-current]').waitFor();assert.equal(await student.locator('#reveal-button').isDisabled(),true);
  await scoreAll(student);await student.locator('#reveal-button').click();assert.equal(await student.locator('.explanation-overview').count(),1);await student.locator('[data-action="complete"]').click();assert.equal((await saved(student,'dse2024-q13')).completed,true);assert.equal(await student.locator('#next-question').isVisible(),true);
  await student.locator('.stepper [data-step="1"]').click();await student.locator('[data-answer="i"]').fill('另一手法');await student.locator('.learning-stage [data-step="2"]').first().click();assert.equal(await student.locator('#reveal-button').isDisabled(),true);const changed=await saved(student,'dse2024-q13');assert.equal(changed.groupProgress.i.revealed,false);assert.equal(changed.groupProgress.ii.revealed,false);
  await browser.close();browser=await launch();const teacher=await pageFor(process.env.BROWSER_QA_PASSWORD);
  const questions=await teacher.evaluate(()=>SelfStudyData.questions.filter(q=>q.learningGroups));let groups=0;
  for(const q of questions){
   await start(teacher,q.id);
   for(const [index,g]of q.learningGroups.entries()){
    await teacher.locator('[data-group="'+g.id+'"][aria-current]').waitFor();
    if(g.quoteLine!==undefined){assert.equal(await teacher.locator('.focused-quote').innerText(),q.quote.split('\n')[g.quoteLine]);assert.equal(await teacher.locator('.full-question-details').getAttribute('open'),null);assert.equal(await teacher.locator('.focused-quote strong').count(),1);}

    const answering=await teacher.locator('[data-answer]').count();if(answering){assert.deepEqual(await teacher.locator('[data-answer]').evaluateAll(es=>es.map(e=>e.dataset.answer).sort()),[...g.answerKeys].sort(),q.id+' answer grouping');if(q.tableAnswerCells)assert.equal(answering,q.answerParts.length,q.id+' full table');await teacher.locator('.learning-stage [data-step="2"]').first().click();}
    const reference=g.keys.every(k=>q.answerParts.find(p=>p.key===k).referenceOnly);
    if(!reference){assert.deepEqual(await teacher.locator('[data-sample-part]').evaluateAll(es=>es.map(e=>e.dataset.samplePart)),g.keys,q.id+' scoped samples');assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);}
    const examples=await teacher.locator('[data-grade]').count();await teacher.locator('[data-action="reveal"]').click();assert.equal(await teacher.locator('.score-badge').count(),examples);assert.equal(await teacher.locator('.explanation-overview').count(),index===q.learningGroups.length-1?1:0,q.id+' hides later explanations');
    assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,q.id+' mobile overflow');
    await teacher.locator('[data-action="complete"]').click();groups++;
   }
   assert.equal((await saved(teacher,q.id)).completed,true,q.id+' whole completion');assert.equal(await teacher.locator('#next-question').isVisible(),true);
   if(groups%10<5)console.log(JSON.stringify({checked:q.id,groups}));
  }
  // Entering a later independent word preserves the earlier word, even after reload.
  await teacher.goto(origin+'#lesson/dse2013-q13');await teacher.locator('[data-group="i"]').click();await teacher.locator('.stepper [data-step="1"]').click();await teacher.locator('[data-answer="i"]').fill('高興');await teacher.locator('.learning-stage [data-step="2"]').first().click();await teacher.locator('[data-action="reveal"]').click();await teacher.locator('[data-action="complete"]').click();await teacher.locator('[data-group="ii"]').click();await teacher.locator('.stepper [data-step="1"]').click();await teacher.locator('[data-answer="ii"]').fill('贈送');await teacher.reload();await teacher.locator('[data-answer="ii"]').waitFor();assert.equal((await saved(teacher,'dse2013-q13')).groupProgress.i.completed,true);assert.equal(await teacher.locator('[data-answer="ii"]').inputValue(),'贈送');
  // Linked insight and quotation are answered together; moving to quotation starts at grading.
  await teacher.goto(origin+'#lesson/dse2025-q20');await teacher.locator('[data-group="ii"]').click();await teacher.locator('.stepper [data-step="1"]').click();assert.deepEqual(await teacher.locator('[data-answer]').evaluateAll(es=>es.map(e=>e.dataset.answer)),['ii','iii']);await teacher.locator('[data-answer="ii"]').fill('人生有苦有樂');await teacher.locator('[data-answer="iii"]').fill('學生自己的引文說明');await teacher.locator('.learning-stage [data-step="2"]').first().click();await teacher.locator('[data-action="reveal"]').click();await teacher.locator('[data-action="complete"]').click();await teacher.locator('[data-group="iii"][aria-current]').waitFor();await teacher.locator('#reveal-button').waitFor();assert.equal(await teacher.locator('[data-answer]').count(),0);assert.deepEqual(await teacher.locator('[data-sample-part]').evaluateAll(es=>es.map(e=>e.dataset.samplePart)),['iii']);
  // Both entry points restore the active group; capture representative layouts.
  await teacher.goto(origin+'dist/index.html#lesson/dse2013-q13');await teacher.locator('[data-group="ii"][aria-current]').waitFor();
  for(const width of [320,390,1440]){await teacher.setViewportSize({width,height:1000});await teacher.locator('.learning-groups').scrollIntoViewIfNeeded();await teacher.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await teacher.screenshot({path:'/tmp/readingcoach-learning-groups-'+width+'.png'});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,questions:questions.length,groups,studentLocksEachGroup:true,teacherBypass:true,fullTables:true,persistentProgress:true}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
