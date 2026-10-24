const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1200,height:780}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const base=process.env.BASE_URL||'http://127.0.0.1:8000';
  await page.goto(base);await page.waitForTimeout(100);
  const checkHidden=async()=>{assert.equal(await page.locator('.expand-arrow:visible').count(),0);assert.equal(await page.locator('#expansion-banner').isVisible(),false);};
  const mode=async()=>{await page.click('#shop');assert.equal(await page.locator('#expansion-banner').isVisible(),false);assert.ok(!(await page.locator('#modal-body').textContent()).includes('×'));await page.click('#shop-expansion');};
  await checkHidden();await page.screenshot({path:'/tmp/farm-v4-normal.png'});
  const geometry=await page.evaluate(()=>LAND.map((_,step)=>{
   const previous=state.landStep;state.landStep=step;const corners=landCorners(),ownedTiles=state.plots.map((_,n)=>n).filter(n=>owned(Math.floor(n/N),n%N));state.landStep=previous;
   return {corners,ownedTiles};
  }));
  const back=geometry[0].corners.back;
  geometry.forEach(({corners:c,ownedTiles},step)=>{
   assert.deepEqual(c.back,back,'back corner remains fixed');assert.equal(c.left[1],c.right[1]);assert.equal(c.front[0],back[0]);assert.ok(c.front[1]>c.left[1]&&c.left[1]>back[1]);
   const ps=[c.back,c.right,c.front,c.left],lengths=ps.map((p,i)=>Math.hypot(p[0]-ps[(i+1)%4][0],p[1]-ps[(i+1)%4][1]));
   assert.ok(lengths.every(d=>Math.abs(d-lengths[0])<1e-8),'all projected square edges match');
   if(step){assert.ok(geometry[step-1].ownedTiles.every(t=>ownedTiles.includes(t)),'expansion preserves existing land');assert.ok(c.front[1]>geometry[step-1].corners.front[1]);}
  });
  await mode();assert.equal(await page.locator('.expand-arrow:visible').count(),2);assert.match(await page.locator('#expansion-dimensions').textContent(),/9 × 9 m → 11 × 11 m/);
  assert.ok(await page.evaluate(()=>{const p=expansionPositions(),c=landCorners();return p.left[0]<c.front[0]&&p.right[0]>c.front[0]&&p.left[1]===p.right[1]&&p.left[1]>c.left[1];}));
  await page.screenshot({path:'/tmp/farm-v4-expansion.png'});await page.click('#expand-left');assert.equal(await page.locator('#confirm-expansion').isDisabled(),true);
  await page.click('#close-modal');await page.click('#exit-expansion');await checkHidden();assert.equal(await page.evaluate(()=>state.landStep),0);
  // Both front controls buy the same square expansion. Neither buys a rear strip.
  await page.evaluate(()=>{state.coins=500;state.xp=100;update();});await mode();await page.click('#expand-left');await page.click('#confirm-expansion');await checkHidden();
  assert.equal(await page.evaluate(()=>state.landStep),1);assert.equal(await page.evaluate(()=>state.coins),400);assert.deepEqual(await page.evaluate(()=>landCorners().back),back);
  await page.evaluate(()=>{state.xp=200;update();});await mode();await page.click('#expand-right');await page.click('#confirm-expansion');assert.equal(await page.evaluate(()=>state.landStep),2);await checkHidden();
  await mode();await page.keyboard.press('Escape');await checkHidden();
  await page.evaluate(()=>{state=freshState();save();update();});await page.reload();await checkHidden();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await mode();
  const boxes=await page.locator('.expand-arrow').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom];}));assert.ok(boxes.every(([l,r,t,b])=>l>=0&&r<=390&&t>=0&&b<=844),'mobile expansion arrows fit');
  await page.screenshot({path:'/tmp/farm-v4-mobile-expansion.png'});await page.click('#exit-expansion');await checkHidden();
  // The previous centered farm is rebased once, retaining its crops and purchases.
  await page.evaluate(()=>{
   const legacy=freshState();delete legacy.mapLayout;legacy.landStep=1;legacy.coins=123;legacy.xp=144;
   legacy.plots[5*N+6]={stage:2,crop:'carrot',watered:Date.now()-5000};legacy.buildings.apple={boughtAt:Date.now()-10000,readyAt:Date.now()+50000};
   state=legacy;save();
  });
  await page.reload();assert.equal(await page.evaluate(()=>state.mapLayout),'front-square-v1');assert.equal(await page.evaluate(()=>state.coins),123);
  assert.equal(await page.evaluate(()=>state.plots[2*N+3].crop),'carrot');assert.ok(await page.evaluate(()=>state.buildings.apple));
  const migrated=await page.evaluate(()=>JSON.stringify(state)),backup=await page.evaluate(()=>localStorage.getItem(KEY+'-before-front-square'));
  assert.ok(backup.includes('carrot'));await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(state)),migrated);assert.equal(await page.evaluate(()=>localStorage.getItem(KEY+'-before-front-square')),backup);
  assert.deepEqual(errors,[]);console.log('PASS: fixed-back square geometry, front-only growth, plain normal border, shop-gated measurements and preview, both front controls, level/price guards, cancel/Escape, mobile layout, legacy crop and purchase migration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
