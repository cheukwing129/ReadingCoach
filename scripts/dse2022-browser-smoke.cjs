const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-2022-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'#year/2022');await page.locator('#main h1').waitFor();assert.equal(await page.locator('.article-row').count(),2);assert.match(await page.locator('.directory-heading span').innerText(),/2篇文章.*0 \/ 11題/);await page.screenshot({path:out+'/2022-directory.png',fullPage:true});
 await page.goto(origin+'#lesson/dse2022-q17');await page.locator('#main h1').waitFor();
 assert.match(await page.locator('#reader-title').innerText(),/一個人和三個人稱/);assert.equal(await page.locator('.reader .paragraph').count(),4);assert.match(await page.locator('[data-reader-location]').innerText(),/第4、2、3段/);
 await page.locator('[data-type="synthesis"]').click();await page.locator('button[data-step="1"]').last().click();
 await page.locator('[data-answer="answer"]').fill('切換篇章後保留我的跨篇答案。');const field=await page.locator('[data-answer="answer"]').elementHandle();
 await page.locator('.question-hints>summary').click();await page.locator('[data-help="hint-0"]>summary').click();
 await page.locator('.reading-selector [data-article="dse2022-universe"]').click();
 assert.equal(await field.evaluate(el=>el===document.querySelector('[data-answer="answer"]')),true);assert.equal(await page.locator('[data-answer="answer"]').inputValue(),'切換篇章後保留我的跨篇答案。');
 assert.equal(await page.locator('.question-hints').getAttribute('open'),'');assert.equal(await page.locator('[data-help="hint-0"]').getAttribute('open'),'');
 assert.match(await page.locator('#reader-title').innerText(),/每個人都是一個宇宙/);assert.equal(await page.locator('.reader .paragraph').count(),6);assert.match(await page.locator('[data-reader-location]').innerText(),/第6段/);assert.equal(await page.locator('.reader .paragraph.located').count(),1);
 await page.locator('.reading-selector [data-article="dse2022-pronouns"]').click();assert.equal(await page.locator('.reader .paragraph').count(),4);assert.ok(page.url().endsWith('#lesson/dse2022-q17'));
 await page.screenshot({path:out+'/q17-two-passages-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action="locate"][data-article="dse2022-universe"][data-paragraph="6"]').click();
 assert.equal(await page.locator('#lesson-text').isVisible(),true);assert.equal(await page.locator('#lesson-coach').isVisible(),false);assert.match(await page.locator('#reader-title').innerText(),/每個人都是一個宇宙/);assert.equal(await page.locator('#tab-text span').innerText(),'6段');
 await page.waitForFunction(()=>{const r=document.querySelector('.reader-content'),p=r.querySelector('[data-paragraph="6"]');return p.getBoundingClientRect().top>=r.getBoundingClientRect().top-1&&p.getBoundingClientRect().top<r.getBoundingClientRect().bottom-10;});
 await page.locator('.reading-selector [data-article="dse2022-pronouns"]').click();assert.equal(await page.locator('#tab-text span').innerText(),'4段');assert.equal(await page.locator('.reader .paragraph').count(),4);
 await page.locator('#tab-coach').click();assert.equal(await page.locator('[data-answer="answer"]').inputValue(),'切換篇章後保留我的跨篇答案。');await page.locator('[data-action="locate"][data-article="dse2022-pronouns"][data-paragraph="2"]').click();assert.equal(await page.locator('.reader .paragraph.located').getAttribute('data-paragraph'),'2');
 await page.screenshot({path:out+'/q17-two-passages-mobile.png'});await page.locator('#tab-coach').click();await page.reload();await page.locator('[data-answer="answer"]').waitFor();assert.equal(await page.locator('[data-answer="answer"]').inputValue(),'切換篇章後保留我的跨篇答案。');
 await page.goto(origin+'#lesson/dse2022-q8');await page.locator('[data-type="concept"]').click();await page.locator('button[data-step="1"]').last().click();assert.match(await page.locator('.field-note').first().innerText(),/4個字/);
 await page.locator('[data-answer="i"]').fill('自以為是');await page.locator('[data-answer="ii"]').fill('缺乏主見');await page.locator('button[data-step="2"]').last().click();assert.equal(await page.locator('.own-label').count(),2);assert.equal(await page.locator('.grading-card').filter({hasText:'自以為是'}).count(),1);assert.equal(await page.locator('.grading-card').filter({hasText:'缺乏主見'}).count(),1);
 for(const size of [{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1024,height:768},{width:1024,height:1366}]){
  await page.setViewportSize(size);await page.goto(origin+'#lesson/dse2022-q17');await page.locator('#main h1').waitFor({state:'attached'});if(size.width<960||size.width<size.height)await page.locator('#tab-text').click();
  for(const id of ['dse2022-universe','dse2022-pronouns']){await page.locator('.reading-selector [data-article="'+id+'"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'cross-reading '+size.width);}
 }
 await page.goto(origin+'dist/#year/2022');await page.locator('#main h1').waitFor();assert.equal(await page.locator('.article-row').count(),2);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['2022 year directory','cross-passage default and switch','paragraph reference namespaces','same mounted draft and open hints','mobile cross-passage location','reload preserves answers','four-character labels and merged own answers','cross-passage responsive widths','root and dist content'],screenshots:out}));
 await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
