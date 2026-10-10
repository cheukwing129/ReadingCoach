const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),os=require('node:os');
const root=process.env.BROWSER_QA_OUTPUT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'readingcoach-browser-'));
fs.mkdirSync(root,{recursive:true});
const repo=path.resolve(__dirname,'..');
const executable=process.env.BROWSER_EXECUTABLE_PATH;
if(!executable)throw new Error('Set BROWSER_EXECUTABLE_PATH to a local Chromium executable.');
let origin;
const backup=process.env.REPORT_BACKUP_FILE;
const errors=[];
(async()=>{
 const server=require('node:http').createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.resolve(repo,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(repo+path.sep)){res.writeHead(403);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process']});
 const context=await browser.newContext({viewport:{width:1348,height:926},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const go=async route=>{await page.goto(origin+route);await page.locator('#main h1').waitFor();};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await go('#practice/dse2024-q13');assert.equal(await page.locator('.lesson-stage,.hint-box,.rubric-item').count(),0);await overflow();await page.screenshot({path:root+'/desktop-independent.png'});
 await page.locator('[data-paragraph-target]').selectOption('dse2024-fansheng-p6');const top=await page.locator('.passage-scroll').evaluate(el=>el.scrollTop);assert.ok(top>0);
 await page.locator('[data-answer="i"]').fill('對比');await page.locator('[data-answer="ii"]').fill('乳汁和鮮血帶來不同感覺。');await page.locator('[data-action="save-first"]').click();assert.equal(await page.locator('.passage-scroll').evaluate(el=>el.scrollTop),top);
 await page.locator('[data-step="0"]').click();assert.equal(await page.locator('.task-category[open]').count(),1);
 await page.locator('[data-task-category-focus]').selectOption('description');assert.equal(await page.locator('.task-category[open]').getAttribute('data-task-category'),'description');
 await page.locator('.task-category[data-task-category="description"] input[value="trait"]').check();assert.equal(await page.locator('input[value="trait"]:checked').count(),2);
 await go('#practice/dse2024-q9');await page.locator('[data-action="start-guided"]').click();await page.locator('[data-step="1"]').click();await page.locator('[data-evidence="dse2024-fansheng-p1-s1"]').click();await page.locator('[data-action="check-evidence"]').click();assert.match(await page.locator('#evidence-feedback').innerText(),/已選到 · 困境背景/);
 await page.locator('.reasoning-bridge summary').click();await page.locator('[data-bridge="observation"]').fill('農人無路可走');await page.locator('[data-bridge="answer"]').fill('回答痛哭原因');await page.locator('[data-action="check-bridge"]').click();assert.match(await page.locator('#bridge-feedback').innerText(),/推論/);
 await go('#practice/dse2024-q20');await page.locator('[data-answer="answer"]').fill('首尾呼應，使文章結構完整。');await page.locator('[data-action="save-first"]').click();await page.locator('[data-answer="answer"]').fill('那個人保留種子，與作者有共同求生經歷。作者向他哭泣，也渴望被理解和安慰。');await page.locator('[data-revision-reason]').fill('由手法名稱補上共同處境與自己的情感需要。');await page.locator('[data-action="save-revision"]').click();await page.locator('[data-step="3"]').click();await page.locator('[data-action="review-source"]').click();
 for(let i=0;i<2;i++){await page.locator(`#selfcheck-${i} input[value="yes"]`).check();await page.locator(`#selfcheck-${i} [data-check-evidence]`).first().check();}
 await page.locator('#selfcheck-2 input[value="unsure"]').check();assert.match(await page.locator('#self-score').innerText(),/已檢視 3\/3 項；已做到 2；不確定 1/);await page.locator('[data-action="complete"]').click();await page.locator('.completion-note').waitFor();
 const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('dse-reading-coach-v1')).drafts['dse2024-q20'].firstAttempt);assert.equal(first.fields.answer,'首尾呼應，使文章結構完整。');assert.equal(first.supportLog.length,0);
 const transfer=await page.locator('[data-action="start-transfer"]').first().getAttribute('data-id');await page.locator('[data-action="start-transfer"]').first().click();await page.locator('[data-answer="free"]').waitFor();assert.equal(await page.locator('.hint-box,.examples').count(),0);assert.equal(await page.locator('[data-answer="point"]').count(),0);
 await go('#records');await page.locator('[data-action="export-backup"]').click();
 if(backup){
 const restored=await browser.newContext({viewport:{width:1348,height:926}});const oldPage=await restored.newPage();oldPage.on('pageerror',e=>errors.push(e.message));await oldPage.goto(origin+'#records');await oldPage.locator('#backup-file').setInputFiles(backup);await oldPage.locator('#confirm-dialog[open]').waitFor();await oldPage.locator('#confirm-dialog button[value="confirm"]').click();await oldPage.locator('.record-row').nth(11).waitFor();
 const oldState=await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('dse-reading-coach-v1')));assert.equal(Object.values(oldState.drafts).filter(d=>d.completedAt).length,12);assert.equal(oldState.drafts['dse2024-q20'].checks[2],'unsure');assert.ok(oldState.drafts['dse2024-q20'].supportLog.some(s=>s.kind==='legacy'));
 assert.match(await oldPage.locator('.record-row').filter({has:oldPage.locator('h3', {hasText:'第20題'})}).innerText(),/已檢視 3\/3 項；已做到 2；不確定 1/);await oldPage.reload();assert.equal(await oldPage.locator('.record-row').count(),12);
 }
 await page.setViewportSize({width:390,height:844});await go('#practice/dse2024-q15');await overflow();await page.screenshot({path:root+'/mobile-independent.png'});await page.locator('[data-action="show-passage"]').first().click();await page.locator('[data-paragraph-target]').selectOption('dse2024-fansheng-p11');await overflow();await page.screenshot({path:root+'/mobile-paragraph.png'});
 await go('dist/index.html#practice/dse2024-q16');assert.equal(await page.locator('.lesson-stage,.hint-box,.rubric-item').count(),0);await overflow();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,desktop:'1348x926',mobile:'390x844',restoredCompleted:backup?12:null,transfer,checks:['independent gating','first answer and revision','answer-linked review','evidence role','missing inference','shared categories','paragraph position',...(backup?['old backup import and reload']:[]),'different-text transfer','both entry points','no horizontal page overflow','no browser errors']}));await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
