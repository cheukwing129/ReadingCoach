const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-2022-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const sizes=[{width:320,height:740},{width:390,height:844},{width:768,height:1000},{width:844,height:390},{width:1024,height:768},{width:1024,height:1366},{width:1440,height:1000}];
 await page.goto(origin);const ids=await page.evaluate(()=>SelfStudyData.questions.map(q=>q.id));let checks=0;
 for(const size of sizes){
  await page.setViewportSize(size);
  for(const id of ids){
   await page.goto(origin+'#lesson/'+id);await page.locator('.question-text').waitFor();
   const prompt=await page.locator('.question-prompt').textContent();
   await page.evaluate(()=>{const a=document.querySelector('.question-sticky-anchor');window.scrollTo({top:a.getBoundingClientRect().top+scrollY+180,behavior:'instant'});});
   const canStick=await page.evaluate(()=>{const a=document.querySelector('.question-sticky-anchor'),q=document.querySelector('.question-text');return document.documentElement.scrollHeight-innerHeight>a.getBoundingClientRect().top+scrollY-parseFloat(q.style.getPropertyValue('--question-sticky-top'))+2;});
   if(!canStick){assert.ok(await page.locator('.question-text').isVisible());checks++;continue;}
   await page.waitForFunction(()=>document.querySelector('.question-text').classList.contains('is-stuck'),null,{timeout:2000});
   const metrics=await page.evaluate(()=>{const q=document.querySelector('.question-text'),r=q.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect(),tabs=document.querySelector('.lesson-tabs'),b=q.querySelector('.question-body');return{top:r.top,height:r.height,clear:h.bottom+(tabs.hidden?0:tabs.getBoundingClientRect().height),overflow:b.scrollHeight>b.clientHeight+1,accessible:b.tabIndex===0,horizontal:document.documentElement.scrollWidth>innerWidth+1,text:b.textContent};});
   assert.ok(metrics.top>=metrics.clear-1,JSON.stringify({id,size,metrics}));assert.ok(metrics.height<size.height*.40,JSON.stringify({id,size,metrics}));assert.equal(metrics.horizontal,false);assert.ok(metrics.text.includes(prompt));if(metrics.overflow)assert.ok(metrics.accessible);
   await page.evaluate(()=>{const b=document.querySelector('.question-body');b.scrollTop=b.scrollHeight;});
   assert.equal(await page.locator('.question-prompt').textContent(),prompt);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>!document.querySelector('.question-text').classList.contains('is-stuck'));
   checks++;
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'#lesson/dse2022-q17');
 await page.locator('[data-type="synthesis"]').click();await page.locator('button[data-step="1"]').last().click();await page.locator('[data-answer="answer"]').fill('切換原文與尺寸後保留答案');
 await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.question-text').classList.contains('is-stuck'));
 await page.screenshot({path:out+'/sticky-question-mobile.png'});
 await page.locator('#tab-text').click();assert.equal(await page.locator('.question-text').isVisible(),false);
 await page.locator('#tab-coach').click();assert.equal(await page.locator('[data-answer="answer"]').inputValue(),'切換原文與尺寸後保留答案');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.question-text').classList.contains('is-stuck'));
 await page.screenshot({path:out+'/sticky-question-desktop.png'});
 await page.setViewportSize({width:844,height:390});await page.goto(origin+'#lesson/dse2022-q7');await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.question-text').classList.contains('is-stuck'));
 await page.screenshot({path:out+'/sticky-question-short-landscape.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,questions:ids.length,viewports:sizes.length,stickyAndRestoreChecks:checks,checks:['navigation clearance','compact height','complete question text','keyboard scroll access','no horizontal overflow','tab hides question','draft survives tab and orientation']}));
 await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
