const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1200,height:780}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();const base=process.env.BASE_URL||'http://127.0.0.1:8000';
  await context.addInitScript(()=>{if(!localStorage.getItem('minifazenda-player-name'))localStorage.setItem('minifazenda-player-name','Teste');});
  await page.goto(base);await page.waitForTimeout(80);
  const get=()=>page.evaluate(()=>JSON.parse(JSON.stringify(state)));
  const close=async()=>{if(await page.locator('#modal').evaluate(e=>e.open))await page.click('#close-modal');};
  const plot=async(i=1,j=1)=>{const xy=await page.evaluate(({i,j})=>iso(i+.5,j+.5),{i,j});await page.mouse.click(...xy);};
  const layout=await page.locator('.farm-panel button').evaluateAll(bs=>bs.map(b=>({id:b.id||b.dataset.tool,col:getComputedStyle(b).gridColumnStart,row:getComputedStyle(b).gridRowStart})));
  assert.deepEqual(layout.map(b=>b.id),['shop','info','till','machines','achievements','gifts','warehouse']);
  assert.deepEqual(layout.map(b=>[b.col,b.row]),[['1','1'],['2','1'],['3','1'],['4','1'],['2','2'],['3','2'],['4','2']]);
  assert.equal(await page.evaluate(()=>tool),'info');assert.ok((await get()).plots.every(p=>!p.tilled));
  await page.click('[data-crop="corn"]');await plot();assert.equal((await get()).coins,50);assert.equal((await get()).plots[13].stage,0,'planting on grass must fail');
  await page.click('[data-tool="till"]');await plot();assert.equal((await get()).plots[13].tilled,true);assert.equal((await get()).coins,50,'applying soil is free');
  await plot();assert.equal((await get()).coins,50,'repeated hoe action is harmless');
  await plot(11,11);assert.equal((await get()).plots[143].tilled,false,'locked land cannot be tilled');
  await page.click('[data-crop="corn"]');await plot();assert.equal((await get()).coins,45);
  await page.click('[data-tool="info"]');await plot();assert.equal((await get()).plots[13].stage,1,'view mode does not act');
  await page.click('[data-tool="water"]');await plot();await page.clock.fastForward(21000);await page.click('[data-tool="harvest"]');await plot();assert.equal((await get()).plots[13].tilled,true);
  await page.click('#achievements');assert.match(await page.locator('#modal-title').textContent(),/Conquistas/);assert.equal(await page.locator('.achievement-card.unlocked').count(),1);await close();
  await page.click('#machines');assert.equal(await page.locator('#machine-action').isDisabled(),true);await close();
  await page.click('#gifts');assert.match(await page.locator('#modal-body').textContent(),/Nenhum presente recebido/);assert.match(await page.locator('#modal-body').textContent(),/ainda não estão conectadas/);assert.equal(await page.locator('.gift-count').textContent(),'0');await close();
  await page.click('#warehouse');assert.match(await page.locator('#modal-body').textContent(),/está vazio/);await close();
  // Prepare late-game ownership without changing the player's starter save.
  await page.evaluate(()=>{state.xp=500;state.coins=3000;update();});
  await page.click('#machines');await page.click('#machine-action');assert.ok((await get()).buildings.tractor);await close();
  await page.click('#machines');await page.click('#machine-action');assert.match(await page.locator('#modal-title').textContent(),/Trator/);await page.click('#store-building');assert.equal((await get()).buildings.tractor.stored,true);
  const balance=(await get()).coins;await page.click('[data-restore="tractor"]');assert.equal((await get()).buildings.tractor.stored,false);assert.equal((await get()).coins,balance);
  await close();await page.click('#shop');await page.click('[data-shop-tab="buildings"]');await page.click('[data-building="apple"]');await close();
  await page.evaluate(()=>openBuilding('apple'));assert.equal(await page.locator('#store-building').count(),0,'living tree has no storage action');
  await page.evaluate(()=>storeBuilding('apple'));assert.equal(await page.evaluate(()=>isPlaced('apple')),true);await close();
  await page.click('#shop');await page.click('[data-shop-tab="buildings"]');await page.click('[data-building="coop"]');await close();
  assert.equal((await get()).animals.chickens,3);await page.evaluate(()=>openBuilding('coop'));await page.click('#production-action');
  await page.clock.fastForward(10000);await page.click('#store-building');
  const remaining=(await get()).buildings.coop.remainingMs;assert.ok(remaining>30000&&remaining<=35000);
  assert.equal(await page.evaluate(()=>isPlaced('coop')),false);assert.equal((await get()).animals.chickens,3,'animals stay outside storage');const coins=(await get()).coins;
  await page.clock.fastForward(120000);await page.evaluate(()=>useBuilding('coop','eggs'));assert.equal((await get()).coins,coins,'stored shelter cannot produce');
  await page.reload();assert.equal((await get()).buildings.coop.stored,true);assert.equal((await get()).buildings.coop.remainingMs,remaining);assert.equal((await get()).animals.chickens,3);
  await page.click('#warehouse');assert.equal(await page.locator('[data-restore="apple"]').count(),0);await page.click('[data-restore="coop"]');assert.equal((await get()).coins,coins,'restoration is free');
  assert.ok(await page.evaluate(()=>state.buildings.coop.readyAt>Date.now()+29000),'stored production resumes from remaining duration');
  await page.evaluate(()=>restoreBuilding('coop'));assert.equal((await get()).coins,coins,'restoring twice cannot duplicate');await close();
  await page.clock.fastForward(36000);await page.evaluate(()=>openBuilding('coop'));await page.click('#production-action');assert.equal((await get()).coins,coins+30);await close();
  await page.evaluate(()=>{state.buildings.cottage={boughtAt:Date.now(),readyAt:null};save();update();storeBuilding('cottage');});
  assert.equal(await page.evaluate(()=>isPlaced('cottage')),false);await page.click('[data-restore="cottage"]');assert.equal(await page.evaluate(()=>isPlaced('cottage')),true);await close();
  // Existing saves retain prepared soil and objects instead of losing progress.
  await page.evaluate(()=>{state=freshState();delete state.soilLayout;state.plots[13]={stage:1,crop:'corn'};state.coins=123;save();});await page.reload();
  assert.equal((await get()).coins,123);assert.equal((await get()).plots[13].stage,1);assert.equal((await get()).plots.filter(p=>p.tilled).length,9);
  await page.evaluate(()=>{state=freshState();save();update();});await page.reload();await page.screenshot({path:'/tmp/farm-v6-panel.png'});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(60);
   const boxes=await page.locator('.farm-panel,.dock,.camera').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};}));
   assert.ok(boxes.every(b=>b.l>=0&&b.r<=width&&b.t>=0&&b.b<=844),'mobile controls must fit');
   assert.ok(boxes[0].b<boxes[1].t,'seed bar must not overlap the main panel');
  }
  await page.screenshot({path:'/tmp/farm-v6-mobile.png'});assert.deepEqual(errors,[]);
  console.log('PASS: seven-button layout, view mode, manual hoe/grass restrictions, soil persistence/migration, achievement progress, machine gating/purchase, honest empty gifts, warehouse store/restore, no duplicate charge, paused production and reload, stored bonus disabled, 390/320px layout, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
