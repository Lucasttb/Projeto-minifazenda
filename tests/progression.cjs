// Run against a local server. PLAYWRIGHT_MODULE may point at a temporary install.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1200,height:780}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  const base=process.env.BASE_URL||'http://127.0.0.1:8000';
  await page.goto(base);await page.waitForTimeout(50);
  const get=()=>page.evaluate(()=>JSON.parse(JSON.stringify(state)));
  const plot=async(i=1,j=1)=>{const xy=await page.evaluate(({i,j})=>iso(i+.5,j+.5),{i,j});await page.mouse.click(...xy);};
  const close=async()=>{if(await page.locator('#modal').evaluate(e=>e.open))await page.click('#close-modal');};
  const shop=async()=>{await close();await page.click('#shop');await page.click('[data-shop-tab="buildings"]');};
  const expansion=async()=>{await close();await page.click('#shop');await page.click('#shop-expansion');await page.click('#expand-left');};
  const expand=async()=>{await expansion();await page.click('#confirm-expansion');};
  const claim=async()=>{await close();if(await page.locator('#claim').isEnabled())await page.click('#claim');};
  const harvest=async(name='corn',time=20)=>{
   const count=(await get()).counts.harvest;
   await page.click(`[data-crop="${name}"]`);await plot();
   await page.click('[data-tool="water"]');await plot();
   await page.clock.fastForward((time+1)*1000);
   await page.click('[data-tool="harvest"]');await plot();
   assert.equal((await get()).counts.harvest,count+1,'each farming cycle must complete');
  };
  console.log('Checking starter and locks');assert.equal((await get()).coins,50);assert.equal((await get()).xp,0);
  assert.deepEqual((await get()).buildings,{});assert.ok((await get()).plots.every(p=>p.stage===0));
  assert.equal(await page.evaluate(()=>state.plots.filter((_,i)=>owned(Math.floor(i/N),i%N)).length),9);
  assert.equal(await page.locator('[data-crop="carrot"]').getAttribute('aria-disabled'),'true');
  await plot(11,11);assert.equal((await get()).coins,50,'locked land cannot be planted');
  await page.click('[data-crop="carrot"]',{force:true});assert.equal(await page.evaluate(()=>crop),'corn');
  await page.evaluate(()=>{buyBuilding('coop');buyExpansion();});assert.equal((await get()).coins,50);
  await plot();assert.equal((await get()).coins,45);await claim();assert.equal((await get()).coins,55);
  await page.evaluate(()=>claimMission());assert.equal((await get()).coins,55,'incomplete mission cannot be claimed');
  await page.click('[data-tool="water"]');await plot();await claim();assert.equal((await get()).xp,10);
  await page.click('[data-tool="harvest"]');await plot();assert.equal((await get()).coins,55,'early harvest cannot pay');
  await page.clock.fastForward(21000);await plot();assert.equal((await get()).coins,70);
  await harvest();await harvest();await claim();assert.equal((await get()).counts.harvest,3);
  assert.equal((await get()).claimed.filter(x=>x==='harvest').length,1);
  console.log('Playing first harvests through level 2');while((await get()).xp<100)await harvest();
  assert.equal(await page.locator('[data-crop="carrot"]').getAttribute('aria-disabled'),'false');
  await claim();await expand();await close();
  assert.equal((await get()).landStep,1);assert.equal(await page.evaluate(()=>state.plots.filter((_,i)=>owned(Math.floor(i/N),i%N)).length),25);await claim();
  await shop();await page.click('[data-building="apple"]');await close();assert.ok((await get()).buildings.apple);await claim();
  const beforeFruit=(await get()).coins;
  await page.evaluate(()=>useBuilding('apple','fruit'));assert.equal((await get()).coins,beforeFruit,'fruit must mature');
  await page.clock.fastForward(61000);await page.evaluate(()=>openBuilding('apple'));await page.click('#production-action');assert.equal((await get()).coins,beforeFruit+15);
  await page.evaluate(()=>useBuilding('apple','fruit'));assert.equal((await get()).coins,beforeFruit+15,'fruit cannot be collected twice');await close();
  await harvest('carrot',35);
  console.log('Playing toward first livestock purchase');while((await get()).coins<245||(await get()).xp<200)await harvest();
  await shop();await page.click('[data-building="coop"]');await close();assert.ok((await get()).buildings.coop);await claim();
  let coins=(await get()).coins;
  await page.evaluate(()=>openBuilding('coop'));await page.click('#production-action');assert.equal((await get()).coins,coins-5);
  await page.clock.fastForward(46000);await page.click('#production-action');assert.equal((await get()).coins,coins+25);
  await page.evaluate(()=>useBuilding('coop','eggs'));assert.equal((await get()).coins,coins+25);await close();
  await harvest('strawberry',50);
  const persisted=await get();await page.reload();assert.deepEqual(await get(),persisted);
  // Exercise late-game effects independently of the organic early-game playthrough.
  await page.evaluate(()=>{state.coins=5000;state.xp=500;save();update();});
  await shop();await page.click('[data-building="cottage"]');await page.click('[data-building="tractor"]');await close();
  coins=(await get()).coins;await page.click('[data-crop="corn"]');await plot();
  await page.evaluate(()=>openBuilding('tractor'));await page.click('#production-action');assert.equal((await get()).coins,coins-6);
  await close();await page.clock.fastForward(21000);await page.click('[data-tool="harvest"]');await plot();assert.equal((await get()).coins,coins-6+18,'house bonus pays 20%');
  await expand();await expand();
  assert.equal((await get()).landStep,3);await expansion();assert.equal(await page.locator('#confirm-expansion').isDisabled(),true,'final land requires level 7');await close();
  await page.evaluate(()=>{state.xp=600;state.coins=1300;update();});await expand();
  assert.equal((await get()).landStep,4);assert.equal(await page.locator('#expand-left').isVisible(),false);await close();
  assert.equal(await page.evaluate(()=>state.plots.filter((_,i)=>owned(Math.floor(i/N),i%N)).length),144);
  // A purchase may not leave the player without enough money for a seed.
  await page.evaluate(()=>{state=freshState();state.xp=100;state.coins=100;buyExpansion();});
  assert.equal((await get()).landStep,0);assert.equal((await get()).coins,100);
  // The earlier prototype's save must remain untouched when starting this campaign.
  await page.evaluate(()=>{localStorage.setItem('minifazenda-save-v1','prototype-backup');state=freshState();save();});
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('minifazenda-save-v1')),'prototype-backup');
  await page.screenshot({path:'/tmp/farm-starter-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(50);await page.screenshot({path:'/tmp/farm-starter-mobile.png'});
  const boxes=await page.locator('.dock button,.objective').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom];}));
  assert.ok(boxes.every(([l,r,t,b])=>l>=0&&r<=390&&t>=0&&b<=844),'mobile controls fit');
  // A new page opened later must see the crop grown from its saved timestamp.
  await page.evaluate(()=>{state=freshState();state.plots[13]={stage:2,crop:'corn',watered:Date.now()};save();});
  const departedAt=await page.evaluate(()=>Date.now()),offline=await page.context().newPage();
  offline.on('pageerror',e=>errors.push(e.message));await offline.clock.install({time:new Date(departedAt+21000)});await offline.goto(base);
  assert.equal(await offline.evaluate(()=>ready(state.plots[13])),true,'growth continues while away');await offline.close();
  await page.addInitScript(()=>localStorage.setItem('minifazenda-progress-v3','broken'));await page.reload();assert.equal((await get()).coins,50);
  assert.deepEqual(errors,[]);
  console.log('PASS: empty starter, land/crop/level locks, organic level progression, one-time missions, expansion, fruit/egg production, no double collection, crop tiers, offline growth, persistence, house bonus, tractor, seed reserve, legacy backup, mobile layout, corrupt save recovery, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
