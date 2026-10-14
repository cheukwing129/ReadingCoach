const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {TextEncoder}=require('node:util');
const root=path.join(__dirname,'..');
const digest=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
function loadAccess(config=null,store=new Map(),blocked=false){
  const sandbox={crypto:crypto.webcrypto,TextEncoder,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>{if(blocked)throw new Error('blocked');store.set(key,value);}},COACH_YEAR_ACCESS_CONFIG:config};
  sandbox.window=sandbox;const context=vm.createContext(sandbox);
  if(!config)vm.runInContext(fs.readFileSync(path.join(root,'dist/year-access-config.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'dist/year-access.js'),'utf8'),context);
  return{access:sandbox.ReadingCoachYearAccess,config:sandbox.COACH_YEAR_ACCESS_CONFIG,store};
}

test('year defaults cover 2012 through 2030 and year unlock persists only in this browser',async()=>{
  const defaults=loadAccess();
  const years=Object.keys(defaults.config.years).map(Number);
  assert.deepEqual(years,Array.from({length:19},(_,i)=>2012+i));
  const hashes=Object.values(defaults.config.years);
  assert.ok(hashes.every(hash=>/^[a-f0-9]{64}$/.test(hash)));
  assert.equal(new Set(hashes).size,hashes.length);
  for(let year=2019;year<=2026;year++)assert.notEqual(defaults.config.years[year],digest(String(year)));
  assert.match(defaults.config.teacher,/^[a-f0-9]{64}$/);

  const config={years:{2023:digest('test-year-2023'),2024:digest('test-year-2024')},teacher:defaults.config.teacher};
  const first=loadAccess(config);
  const result=await first.access.unlock(2024,'test-year-2024');
  assert.deepEqual({...result},{ok:true,teacher:false,remembered:true});
  assert.equal(first.access.isUnlocked(2024),true);assert.equal(first.access.isUnlocked(2023),false);
  const restored=loadAccess(config,first.store);
  assert.equal(restored.access.isUnlocked(2024),true);assert.equal(restored.access.isUnlocked(2023),false);
  assert.equal((await restored.access.unlock(2023,'test-year-2024')).ok,false);
  const changedConfig={years:{...config.years,2024:digest('new-year-password')},teacher:config.teacher};
  assert.equal(loadAccess(changedConfig,first.store).access.isUnlocked(2024),false);
});

test('teacher hash unlocks every year; unavailable storage still grants the current session',async()=>{
  const config={years:{2024:digest('year-test')},teacher:digest('staff-test')};
  const staff=loadAccess(config);
  const result=await staff.access.unlock(2024,'staff-test');
  assert.deepEqual({...result},{ok:true,teacher:true,remembered:true});
  assert.equal(staff.access.isUnlocked(2020),true);assert.equal(staff.access.isUnlocked(2026),true);
  assert.equal(loadAccess({years:config.years,teacher:digest('new-staff-pass')},staff.store).access.isUnlocked(2024),false);
  const temporary=loadAccess(config,new Map(),true);
  const sessionResult=await temporary.access.unlock(2024,'year-test');
  assert.equal(sessionResult.remembered,false);assert.equal(temporary.access.isUnlocked(2024),true);
});

test('both public entries load the hash config before the access guard and protect direct article routes',()=>{
  const expected=['vendor/lumen.css','self-study.css','lumen-theme.css','brand-theme.css','vendor/lumen-elements.js','dse2013-data.js','dse2014-data.js','dse2015-data.js','dse2016-data.js','dse2017-data.js','dse2018-data.js','dse2019-data.js','dse2020-data.js','dse2021-data.js','dse2022-data.js','dse2022-classical-data.js','dse2023-data.js','dse2023-classical-data.js','dse2024-classical-data.js','dse2025-classical-data.js','dse2024-data.js','dse2024-coaching.js','transfer-data.js','self-study-samples.js','self-study-analysis.js','dse2025-data.js','dse2026-data.js','self-study-data.js','self-study-core.js','year-access-config.js','year-access.js','reading-support.js','self-study-app.js'];
  for(const [file,prefix]of [['index.html','dist/'],['dist/index.html','']]){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    const urls=[...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]+)?)"/g)].map(match=>match[1]);
    assert.deepEqual(urls.map(url=>url.split('?')[0]),expected.map(item=>prefix+item));
    assert.equal(new Set(urls.map(url=>url.split('?')[1])).size,1);
  }
  const app=fs.readFileSync(path.join(root,'dist/self-study-app.js'),'utf8');
  assert.match(app,/ReadingCoachYearAccess\.isUnlocked\(targetYear\)/);
  assert.match(app,/function yearGate\(year\)/);
  assert.match(app,/year-access-form/);
});
