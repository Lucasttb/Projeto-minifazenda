const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1200,height:780}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();const base=process.env.BASE_URL||'http://127.0.0.1:8000';
  await page.goto(base);assert.equal(await page.locator('#modal-title').textContent(),'Passaporte');
  assert.equal(await page.locator('#close-modal').isVisible(),false);await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);
  await page.fill('#profile-name','   ');await page.click('#player-profile button');assert.match(await page.locator('#profile-error').textContent(),/Digite seu nome/);
  await page.fill('#profile-name',' Ana   Silva ');await page.click('#player-profile button');assert.equal(await page.locator('#player-name').textContent(),'Ana Silva');
  assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);assert.equal(await page.locator('.objective,.quests,.hint,.version').count(),0);
  assert.equal(await page.locator('#message').isVisible(),false,'no automatic tutorial');
  assert.equal(await page.locator('#money').textContent(),'50');assert.equal(await page.locator('#cash').textContent(),'0');
  assert.equal(await page.locator('.wallet').filter({hasText:'MiniOuro'}).count(),0);assert.equal(await page.locator('.wallet').filter({hasText:'MiniGrana'}).count(),0);
  assert.equal(await page.locator('[data-hud-tip][title]').count(),0,'no early native currency tooltip');
  // A paused browser clock verifies the exact delay, including quick-leave cancellation.
  const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(new Date(now+100));
  const gold=await page.locator('#gold-wallet').boundingBox(),cash=await page.locator('#cash-wallet').boundingBox();
  await page.mouse.move(gold.x+20,gold.y+10);await page.clock.runFor(1999);assert.equal(await page.locator('#hud-tooltip').isVisible(),false);
  await page.clock.runFor(1);assert.equal(await page.locator('#hud-tooltip').textContent(),'MiniOuro');assert.equal(await page.locator('#hud-tooltip').isVisible(),true);
  await page.mouse.move(700,500);assert.equal(await page.locator('#hud-tooltip').isVisible(),false);
  await page.mouse.move(cash.x+20,cash.y+10);await page.clock.runFor(1000);await page.mouse.move(700,500);await page.clock.runFor(1500);assert.equal(await page.locator('#hud-tooltip').isVisible(),false);
  await page.mouse.move(cash.x+20,cash.y+10);await page.clock.runFor(2000);assert.equal(await page.locator('#hud-tooltip').textContent(),'MiniGrana');assert.equal(await page.locator('#hud-tooltip').isVisible(),true);
  await page.mouse.move(700,500);await page.clock.resume();
  for(const tool of ['info','till','plant','water','harvest']){
   await page.click(`[data-tool="${tool}"]`);const cursor=await page.locator('#farm').evaluate(e=>getComputedStyle(e).cursor);assert.ok(cursor.includes('url(')&&!cursor.includes('crosshair'),'all tools use the white arrow');
   assert.equal(await page.locator('#message').isVisible(),false,'selecting tools does not narrate a tutorial');
  }
  await page.reload();assert.equal(await page.locator('#player-name').textContent(),'Ana Silva');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
  await page.click('#farm-name');await page.fill('#profile-name','Bruno');await page.click('#player-profile button');await page.reload();assert.equal(await page.locator('#player-name').textContent(),'Bruno');
  // Balances survive migration and are independent currencies.
  await page.evaluate(()=>{state.coins=123;state.cash=7;state.xp=144;save();update();});await page.reload();assert.equal(await page.locator('#money').textContent(),'123');assert.equal(await page.locator('#cash').textContent(),'7');assert.equal(await page.locator('#xp').textContent(),'144/200');
  await page.screenshot({path:'/tmp/farm-v6-header.png'});
  // Rescue previously stored living things instead of deleting them or their growth time.
  await page.evaluate(()=>{
   state=freshState();delete state.inventoryRules;delete state.animals;
   state.coins=321;state.buildings.apple={boughtAt:100,stored:true,readyAt:null,remainingMs:30000};
   state.buildings.coop={boughtAt:200,stored:true,readyAt:null,remainingMs:15000};save();
  });
  await page.reload();assert.equal(await page.evaluate(()=>isPlaced('apple')),true);assert.equal(await page.evaluate(()=>state.coins),321);
  assert.ok(await page.evaluate(()=>state.buildings.apple.readyAt>Date.now()+29000));assert.equal(await page.evaluate(()=>state.animals.chickens),3);
  assert.equal(await page.evaluate(()=>state.buildings.coop.stored),true);await page.click('#warehouse');assert.equal(await page.locator('[data-restore="apple"]').count(),0);assert.equal(await page.locator('[data-restore="coop"]').count(),1);await page.click('#close-modal');
  const chickens=await page.evaluate(()=>{const original=chicken;let seen=0;try{chicken=()=>seen++;drawBuildings(0);}finally{chicken=original;}return seen;});assert.equal(chickens,3,'living chickens remain drawn when shelter is stored');
  await page.evaluate(()=>storeBuilding('apple'));assert.equal(await page.evaluate(()=>isPlaced('apple')),true);
  // Every nonliving owned object remains eligible for storage, regardless of purchase level.
  await page.evaluate(()=>{state.buildings.cottage={boughtAt:300,readyAt:null};state.buildings.tractor={boughtAt:400,readyAt:null};});
  for(const id of ['cottage','tractor']){await page.evaluate(id=>storeBuilding(id),id);assert.equal(await page.evaluate(id=>state.buildings[id].stored,id),true);await page.click('#close-modal');}
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(50);
   const boxes=await page.locator('.player-hud .experience,.player-hud .level,.farm-name,.wallet,.header-actions').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom];}));
   assert.ok(boxes.every(([l,r,t,b])=>l>=0&&r<=width&&t>=0&&b<=844),'header must fit mobile');
  }
  await page.evaluate(()=>{state=freshState();save();update();});await page.screenshot({path:'/tmp/farm-v6-header-mobile.png'});assert.deepEqual(errors,[]);
  console.log('PASS: no tutorial, player-name entry/edit/persistence, compact responsive header, independent MiniOuro/MiniGrana, exact 2000ms tooltip and cancellation, white cursor on all tools, living storage guard, legacy tree rescue, chickens remain visible, all nonliving objects storable, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
