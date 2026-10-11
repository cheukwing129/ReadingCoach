const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-2022-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const go=async id=>{await page.goto(origin+'#lesson/'+id);await page.locator('.question-text').waitFor();};
 const enter=async(id,type)=>{await go(id);await page.locator('[data-type="'+type+'"]').click();await page.locator('button[data-step="1"]').last().click();};
 const gradeExamples=async()=>{for(const select of await page.locator('[data-grade]').all())await select.selectOption('0');assert.equal(await page.locator('#reveal-button').isDisabled(),false);await page.locator('#reveal-button').click();};
 for(const size of [{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1024,height:768},{width:1024,height:1366},{width:1440,height:1000}]){
  await page.setViewportSize(size);await go('dse2022-q13');
  assert.equal(await page.locator('.question-part-label').count(),2);assert.match(await page.locator('.question-subparts').innerText(),/詩歌的主旨是讚美愛情/);assert.match(await page.locator('.question-subparts').innerText(),/神卻可以超越一切/);assert.equal(await page.locator('.question-options li').count(),6);
  const button=page.locator('[data-type="'+await page.evaluate(()=>SelfStudyData.questions.find(q=>q.id==='dse2022-q13').lesson.type)+'"]');await button.scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.addEventListener('click',()=>{window.clickScroll={y:scrollY,reader:document.querySelector('.reader-content').scrollTop};},{capture:true,once:true}));await button.click();const before=await page.evaluate(()=>window.clickScroll);
  const after=await page.evaluate(()=>({y:scrollY,reader:document.querySelector('.reader-content').scrollTop}));assert.ok(Math.abs(after.y-before.y)<2,JSON.stringify({size,before,after}));assert.equal(after.reader,before.reader);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 }
 await page.setViewportSize({width:390,height:844});await enter('dse2022-q8','concept');
 await page.locator('[data-answer="i"]').fill('自以為是');await page.locator('[data-answer="ii"]').fill('甲乙丙丁');await page.locator('button[data-step="2"]').last().click();
 assert.equal(await page.locator('.sample-group').count(),2);assert.match(await page.locator('.sample-group-title').first().innerText(),/「我」的缺失/);assert.match(await page.locator('.sample-group-title').last().innerText(),/「他」的缺失/);
 assert.equal(await page.locator('.own-preview [data-grade]').count(),0);assert.equal(await page.locator('[data-self-grade]').count(),0);
 assert.equal(await page.locator('select option').evaluateAll(els=>els.some(e=>e.textContent.includes('/'))),false);
 await page.screenshot({path:out+'/split-grading-mobile.png',fullPage:true});await gradeExamples();
 assert.equal(await page.locator('[data-own-part="i"] [data-self-grade]').count(),0);assert.match(await page.locator('[data-own-part="i"] .own-auto-score').innerText(),/1分/);
 // Unknown short responses with valid format are self-rated, while invalid lengths get the explicit format score.
 assert.equal(await page.locator('[data-own-part="ii"] .own-auto-score').count(),0);assert.equal(await page.locator('[data-self-grade="ii"]').count(),1);await page.locator('[data-self-grade="ii"]').selectOption('0');
 await page.screenshot({path:out+'/short-auto-review-mobile.png',fullPage:true});
 await enter('dse2022-q11','comparison');await page.locator('[data-answer="answer"]').fill('這是我自己的比較答案。');await page.locator('button[data-step="2"]').last().click();assert.equal(await page.locator('.own-preview [data-grade]').count(),0);assert.equal(await page.locator('[data-self-grade]').count(),0);await gradeExamples();
 await page.locator('[data-self-grade="answer"]').selectOption('2');await page.reload();await page.locator('[data-self-grade="answer"]').waitFor();assert.equal(await page.locator('[data-self-grade="answer"]').inputValue(),'2');
 await page.screenshot({path:out+'/own-self-assessment-mobile.png',fullPage:true});
 await page.locator('button[data-step="1"]').first().click();await page.locator('[data-answer="answer"]').fill('重新寫的比較答案。');await page.locator('button[data-step="2"]').last().click();assert.equal(await page.locator('button[data-step="3"]').isDisabled(),true);await gradeExamples();assert.equal(await page.locator('[data-self-grade="answer"]').inputValue(),'');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['classification preserves scroll and reader','complete true/false question before classification','clear multipart sample groups','score choices without denominators','own answers excluded from blind scoring','short identical answer automatically rated after reveal','long self-rating after reveal and survives reload','revision resets self-rating','responsive overflow']}));await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
