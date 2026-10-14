const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.BROWSER_QA_OUTPUT_DIR||'/tmp/readingcoach-source-notes-qa';fs.mkdirSync(out,{recursive:true});
const notes=[['蘇峻亂','東晉時，蘇峻舉兵作亂，攻陷京師。'],['庾冰時為吳郡','庾冰當時是吳郡的長官。'],['蘧篨','粗竹編織成的席。'],['劉伯倫','劉伶，字伯倫，嗜酒，生性豁達，為竹林七賢之一。'],['鍤','挖土的工具。'],['衣衾','殮屍的衣服和被子。']];
(async()=>{
 const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'#lesson/dse2024-q23');await page.locator('#year-access-password').fill(process.env.BROWSER_QA_PASSWORD);await page.locator('#year-access-form button').click();await page.locator('.question-prompt').waitFor();
 const showReader=async()=>{if(await page.locator('.lesson-tabs').isVisible())await page.locator('#tab-text').click();};
 const checkBounds=async size=>{const b=await page.locator('#reading-word-popup').boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,JSON.stringify({size,b}));};
 const sizes=[{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1024,height:1366},{width:1440,height:1000}];
 let positions=0;
 for(const size of sizes){
  await page.setViewportSize(size);
  for(const [entry,n]of [['',22],['dist/index.html',25]]){
   await page.goto(origin+entry+'#lesson/dse2024-q'+n);await page.locator('.question-prompt').waitFor();await showReader();
   assert.equal(await page.locator('#reader-analysis-toggle').isChecked(),false);assert.equal(await page.locator('.reader .classical-help,.reader [data-reading-word]').count(),0);assert.equal(await page.locator('.reader [data-source-note]').count(),6);assert.equal(await page.locator('.reader .passage-notes[aria-label="原文註釋"] p').count(),6);assert.equal(await page.locator('.source-notes-title').innerText(),'原卷註釋');
   const text=await page.evaluate(()=>SelfStudyData.articles.find(p=>p.id==='dse2024-classical').paragraphs.map(p=>p.text));assert.deepEqual(await page.locator('.reader .source-text').allTextContents(),text);
   for(let i=0;i<notes.length;i++){
    const word=page.locator('.reader [data-source-note="'+i+'"]');await word.click();assert.equal(await page.locator('#reading-word-title').innerText(),notes[i][0]);assert.equal(await page.locator('#reading-word-meaning').innerText(),notes[i][1]);assert.equal(await page.locator('#reading-word-popup').isVisible(),true);await checkBounds(size);positions++;
    if(size.width===390&&i===2&&n===22)await page.screenshot({path:out+'/2024-paper-note-mobile.png'});
    if(size.width===1440&&i===4&&n===25)await page.screenshot({path:out+'/2024-paper-note-desktop.png'});
    await page.getByRole('button',{name:'關閉詞解',exact:true}).click();assert.equal(await word.evaluate(e=>e===document.activeElement),true);
   }
   await page.locator('#reader-analysis-toggle').check();assert.equal(await page.locator('.reader [data-reading-word]').count(),14);assert.equal(await page.locator('.reader [data-source-note]').count(),6);
   for(let i=0;i<notes.length;i++){await page.locator('.reader [data-source-note="'+i+'"]').click();assert.ok((await page.locator('#reading-word-meaning').innerText()).includes(notes[i][1]));await page.getByRole('button',{name:'關閉詞解',exact:true}).click();}
   await page.locator('#reader-analysis-toggle').uncheck();assert.equal(await page.locator('.reader [data-reading-word],.reader .classical-help').count(),0);assert.equal(await page.locator('.reader [data-source-note]').count(),6);assert.deepEqual(await page.locator('.reader .source-text').allTextContents(),text);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'#lesson/dse2024-q23');await page.locator('[data-type="translation"]').click();await page.locator('button[data-step="1"]').last().click();const own='我先釐清庾冰和差役，再翻譯報恩及實現心願。';await page.locator('[data-answer="answer"]').fill(own);await showReader();await page.locator('[data-source-note="2"]').click();assert.equal(await page.locator('#reading-word-meaning').innerText(),notes[2][1]);await page.keyboard.press('Escape');await page.locator('#tab-coach').click();assert.equal(await page.locator('[data-answer="answer"]').inputValue(),own);await page.reload();await page.locator('[data-answer="answer"]').waitFor();assert.equal(await page.locator('[data-answer="answer"]').inputValue(),own);await showReader();assert.equal(await page.locator('#reader-analysis-toggle').isChecked(),false);assert.equal(await page.locator('[data-source-note]').count(),6);
 await page.goto(origin+'#article/dse2024-classical');await page.locator('#analysis-toggle').waitFor();assert.equal(await page.locator('#analysis-toggle').isChecked(),false);assert.equal(await page.locator('[data-source-note]').count(),6);assert.equal(await page.locator('[data-reading-word]').count(),0);await page.locator('[data-source-note="2"]').click();assert.equal(await page.locator('#reading-word-meaning').innerText(),notes[2][1]);
 await page.goto(origin+'#lesson/dse2015-q1');await page.locator('.question-prompt').waitFor();await showReader();assert.equal(await page.locator('#reader-analysis-toggle').count(),0);assert.equal(await page.locator('[data-source-note]').count(),1);await page.locator('[data-source-note]').click();assert.equal(await page.locator('#reading-word-title').innerText(),'掮客術');assert.equal(await page.locator('#reading-word-meaning').innerText(),'掮客，指替人介紹買賣，從中賺取佣金的人。');await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['original notes available without analysis in both entries','six exact paper notes and original source text','teaching support remains gated','original-note and teaching-phrase overlap','keyboard focus and answer persistence','original article and 2015 vernacular paper-note regression'],popupPositions:positions,screenshots:out}));
 await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
