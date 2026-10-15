const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
 const configScope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'dist/year-access-config.js'),'utf8'),configScope);
 const config=JSON.parse(JSON.stringify(configScope.window.COACH_YEAR_ACCESS_CONFIG));
 config.years[2024]=crypto.createHash('sha256').update('student-test-year').digest('hex');
 const server=http.createServer((req,res)=>{try{
  const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
  if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');
  res.end(file.endsWith('/year-access-config.js')?'window.COACH_YEAR_ACCESS_CONFIG='+JSON.stringify(config)+';':fs.readFileSync(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/';
 let browser;
 try{
  const launch=()=>chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  browser=await launch();
  const errors=[];
  const login=async (password,existingPage)=>{
   const page=existingPage||await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'#year/2024');await page.locator('#year-access-password').fill(password);await page.locator('#year-access-form button[type=submit]').click();await page.locator('.article-row').first().waitFor();return page;
  };
  const grade=async(page,id='dse2024-q11')=>{
   await page.goto(origin+'#lesson/'+id);await page.locator('.question-prompt').waitFor();await page.locator('.stepper [data-step="0"]').click();
   const type=await page.evaluate(id=>SelfStudyData.questions.find(q=>q.id===id).lesson.type,id);await page.locator('[data-type="'+type+'"]').click();await page.locator('.learning-stage [data-step="1"]').click();await page.locator('.learning-stage [data-step="2"]').first().click();await page.locator('#reveal-button').waitFor();
  };
  // Ordinary year access still requires every example, including the click-handler guard.
  const student=await login('student-test-year');assert.equal(await student.evaluate(()=>ReadingCoachYearAccess.isTeacher()),false);await grade(student);
  assert.equal(await student.locator('#reveal-button').isDisabled(),true);
  await student.locator('#reveal-button').evaluate(b=>{b.disabled=false;b.click();});assert.equal(await student.locator('.score-badge').count(),0);
  await student.locator('[data-grade]').first().selectOption('0');assert.equal(await student.locator('#reveal-button').isDisabled(),true);
  for(const select of await student.locator('[data-grade]').all())await select.selectOption('0');assert.equal(await student.locator('#reveal-button').isDisabled(),false);await student.locator('#reveal-button').click();assert.ok(await student.locator('.score-badge').count()>0);
  // The real teacher hash restores across reloads and both public entries.
  await browser.close();browser=await launch();
  const teacher=await login(process.env.BROWSER_QA_PASSWORD);assert.equal(await teacher.evaluate(()=>ReadingCoachYearAccess.isTeacher()),true);await grade(teacher);
  const count=await teacher.locator('[data-grade]').count();assert.ok(count>1);assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);await teacher.reload();await teacher.locator('#reveal-button').waitFor();assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);
  await teacher.locator('#reveal-button').click();assert.equal(await teacher.locator('.score-badge').count(),count);assert.equal(await teacher.locator('.comparison-note,.result-banner').count(),0);assert.doesNotMatch(await teacher.locator('.learning-stage').innerText(),/undefined|NaN|低估|高估/);
  await teacher.locator('.stepper [data-step="2"]').click();const first=teacher.locator('[data-grade]').first();await first.selectOption('0');assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);await first.selectOption('');assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);await first.selectOption('0');await teacher.locator('#reveal-button').click();assert.equal(await teacher.locator('.comparison-note').count(),1);assert.match(await teacher.locator('.result-banner strong').innerText(),/^[01] \/ 1$/);assert.equal(await teacher.locator('.score-row').filter({hasText:'未評分'}).count(),count-1);
  await teacher.goto(origin+'dist/index.html#lesson/dse2024-q11');await teacher.locator('.score-badge').first().waitFor();assert.equal(await teacher.evaluate(()=>ReadingCoachYearAccess.isTeacher()),true);
  // The same teacher exemption covers another year's classical long-answer examples.
  await grade(teacher,'dse2026-q26');assert.equal(await teacher.locator('#reveal-button').isDisabled(),false);await teacher.locator('#reveal-button').click();assert.ok(await teacher.locator('.score-badge').count()>0);assert.equal(await teacher.locator('.comparison-note,.result-banner').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,studentRequiresAll:true,teacherSkipsAll:true,teacherPartialGrades:true,persistentTeacher:true}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
