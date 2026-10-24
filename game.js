'use strict';

// All scenery is drawn locally. No external art files or services are required.
const canvas = document.querySelector('#farm');
let ctx = canvas.getContext('2d');
let landscape, farmGround, groundStep=-1;
const N = 12, KEY = 'minifazenda-progress-v3';
const MAP_LAYOUT='front-square-v1', LAND_MARGIN=3;
const CROPS = {
  corn: {name:'Milho', level:1, cost:5, sale:15, grow:20000, xp:10},
  carrot: {name:'Cenoura', level:2, cost:8, sale:24, grow:35000, xp:15},
  strawberry: {name:'Morango', level:3, cost:12, sale:38, grow:50000, xp:20}
};
const LAND = [
  {size:3, level:1, cost:0}, {size:5, level:2, cost:100},
  {size:7, level:3, cost:250}, {size:9, level:5, cost:600},
  {size:12, level:7, cost:1200}
];
const BUILDINGS = {
  apple:{name:'Laranjeira',level:2,cost:80,x:390,y:174,description:'Produz 15 moedas em frutas a cada 60 segundos. Clique para colher.'},
  coop:{name:'Galinheiro',level:3,cost:240,x:504,y:177,description:'Alimente por 5 moedas. Após 45 segundos, recolha ovos por 30 moedas e 5 XP.'},
  cottage:{name:'Casa da fazenda',level:4,cost:400,x:445,y:155,description:'Aumenta em 20% o valor de venda de todas as colheitas.'},
  tractor:{name:'Trator',level:6,cost:900,x:335,y:201,description:'Rega todas as plantas de uma vez, por 1 moeda por canteiro.'}
};
function freshState(){return {version:3,mapLayout:MAP_LAYOUT,soilLayout:'manual-v1',coins:50,xp:0,landStep:0,plots:Array.from({length:N*N},()=>({stage:0,tilled:false})),buildings:{},counts:{plant:0,water:0,harvest:0},claimed:[]};}
let state=freshState();
function validSave(s){
  return s?.version===3 && Number.isSafeInteger(s.coins) && s.coins>=0 && Number.isSafeInteger(s.xp) && s.xp>=0 &&
    Number.isInteger(s.landStep) && s.landStep>=0 && s.landStep<LAND.length &&
    Array.isArray(s.plots) && s.plots.length===N*N && s.plots.every(p=>p && [0,1,2].includes(p.stage) &&
      (!p.crop||CROPS[p.crop]) && (p.tilled===undefined||typeof p.tilled==='boolean') && (p.stage!==2||Number.isFinite(p.watered))) &&
    s.buildings && Object.entries(s.buildings).every(([id,b])=>BUILDINGS[id] && b && Number.isFinite(b.boughtAt) && (b.readyAt===null || Number.isFinite(b.readyAt)) && (b.stored===undefined||typeof b.stored==='boolean') && (b.remainingMs===undefined||b.remainingMs===null||(Number.isFinite(b.remainingMs)&&b.remainingMs>=0))) &&
    s.counts && ['plant','water','harvest'].every(k=>Number.isSafeInteger(s.counts[k])&&s.counts[k]>=0) &&
    Array.isArray(s.claimed) && s.claimed.every(id=>typeof id==='string');
}
try{
  const raw=localStorage.getItem(KEY),saved=JSON.parse(raw);
  if(validSave(saved)){
    state=saved;
    if(saved.mapLayout!==MAP_LAYOUT){
      // Rebase the former centered plots without changing their timers or crops.
      const start=Math.floor((N-LAND[saved.landStep].size)/2);
      const plots=Array.from({length:N*N},()=>({stage:0,tilled:false}));
      for(let i=0;i<N;i++)for(let j=0;j<N;j++){
        const p=saved.plots[i*N+j];if(!p.stage)continue;
        const a=i-start,b=j-start;
        const target=a>=0&&b>=0&&a<N&&b<N?a*N+b:plots.findIndex(t=>!t.stage);
        if(target>=0)plots[target]=p;
      }
      state={...saved,mapLayout:MAP_LAYOUT,plots};
      if(!localStorage.getItem(KEY+'-before-front-square'))localStorage.setItem(KEY+'-before-front-square',raw);
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  }
}catch{}
// Former saves had soil on every owned cell; keep it while new farms start on grass.
if(state.soilLayout!=='manual-v1'){
  try{if(!localStorage.getItem(KEY+'-before-manual-soil'))localStorage.setItem(KEY+'-before-manual-soil',JSON.stringify(state));}catch{}
  const size=LAND[state.landStep].size;
  state={...state,soilLayout:'manual-v1',plots:state.plots.map((p,index)=>({...p,tilled:!!p.stage||(Math.floor(index/N)<size&&index%N<size)}))};
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
}
function isPlaced(id){return !!state.buildings[id]&&!state.buildings[id].stored;}
const level=()=>1+Math.floor(state.xp/100);
function owned(i,j){const size=LAND[state.landStep].size;return i>=0&&j>=0&&i<size&&j<size;}
function landCorners(size=LAND[state.landStep].size){
  const a=-LAND_MARGIN,b=size+LAND_MARGIN;
  return {back:grid(a,a),right:grid(b,a),front:grid(b,b),left:grid(a,b)};
}
function expansionPositions(){
  const size=LAND[state.landStep].size;
  return {left:grid(size/2,size+LAND_MARGIN+2.3),right:grid(size+LAND_MARGIN+2.3,size/2)};
}
const MISSIONS=[
  {id:'plant',title:'Uma semente, um começo',description:'Plante seu primeiro milho.',current:()=>state.counts.plant,target:1,coins:10,xp:0},
  {id:'water',title:'Água para crescer',description:'Regue seu primeiro canteiro.',current:()=>state.counts.water,target:1,coins:0,xp:10},
  {id:'harvest',title:'Frutos do seu trabalho',description:'Faça 3 colheitas.',current:()=>state.counts.harvest,target:3,coins:30,xp:10},
  {id:'level2',title:'Aprendendo a cultivar',description:'Chegue ao nível 2.',current:()=>level(),target:2,coins:30,xp:0},
  {id:'expand',title:'Espaço para novos sonhos',description:'Compre a expansão para 25 canteiros.',current:()=>state.landStep,target:1,coins:20,xp:20},
  {id:'orchard',title:'Seu primeiro pomar',description:'Compre sua primeira laranjeira.',current:()=>state.buildings.apple?1:0,target:1,coins:20,xp:20},
  {id:'coop',title:'Novos moradores',description:'Chegue ao nível 3 e compre o galinheiro.',current:()=>state.buildings.coop?1:0,target:1,coins:30,xp:25}
];
function mission(){return MISSIONS.find(m=>!state.claimed.includes(m.id));}
let tool='info', crop='corn', zoom=1, W=0, H=0, scale=1, tx=0, ty=0;
let pan={x:0,y:0}, hover=null, pointer=null, drag=false, toastTimer;
const floats=[];
const $=selector=>document.querySelector(selector);
let activeBuilding=null, expansionMode=false;
const rand=(n)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
function poly(points,fill,stroke,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(points,color,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function oval(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function gradient(x,y,x2,y2,colors){const g=ctx.createLinearGradient(x,y,x2,y2);colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;}
function diamond(x,y,w,h,color,stroke){poly([[x,y-h],[x+w,y],[x,y+h],[x-w,y]],color,stroke);}
function at(x,y,s,fn){ctx.save();ctx.translate(x,y);ctx.scale(s,s);fn();ctx.restore();}
function grid(i,j){return [445+(i-j)*22,180+(i+j)*10.5];}
function iso(i,j){const [x,y]=grid(i,j);return [x*scale+tx,y*scale+ty];}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}}
function tell(text){$('#message').textContent=text;$('#message').classList.remove('quiet');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#message').classList.add('quiet'),6500);}
function update(){
  if(!drag)canvas.style.cursor=tool==='info'?'default':'crosshair';
  $('#money').textContent=state.coins.toLocaleString('pt-BR');$('#level').textContent=level();
  $('#xp').textContent=`${state.xp%100} / 100`;$('#xp-fill').style.width=(state.xp%100)+'%';
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  document.querySelectorAll('[data-crop]').forEach(b=>{
    const c=CROPS[b.dataset.crop],locked=level()<c.level;
    b.classList.toggle('active',b.dataset.crop===crop);b.classList.toggle('locked',locked);
    b.setAttribute('aria-disabled',String(locked));b.querySelector('small').textContent=locked?`Nível ${c.level}`:`${c.cost} moedas`;
  });
  const m=mission();
  $('#objective-title').textContent=m?m.title:'Uma fazenda com história';
  $('#objective-text').textContent=m?(m.id==='plant'&&!state.plots.some(p=>p.tilled)?'Use a enxada para aplicar terra. Depois plante milho.':m.description):'Continue cultivando, expandindo e subindo de nível.';
  $('#objective-progress').textContent=m?`${Math.min(m.current(),m.target)} / ${m.target}`:`Nível ${level()}`;
  $('#claim').hidden=!m;$('#claim').disabled=!m||m.current()<m.target;
  $('#claim').textContent=m?`Receber ${[m.coins?m.coins+' moedas':'',m.xp?m.xp+' XP':''].filter(Boolean).join(' + ')}`:'';
  $('#land-size').textContent=`${LAND[state.landStep].size**2} canteiros`;
}
function grantXP(amount){const before=level();state.xp+=amount;return level()>before;}
function levelMessage(){return `Nível ${level()} alcançado! Veja os novos desbloqueios na loja.`;}
function claimMission(){
  const m=mission();if(!m||m.current()<m.target)return;
  state.claimed.push(m.id);state.coins+=m.coins;const up=grantXP(m.xp);save();update();
  tell(up?levelMessage():`Objetivo concluído! +${m.coins} moedas e +${m.xp} XP.`);
}
function ready(p){return p.stage===2 && Date.now()-p.watered>=CROPS[p.crop||'corn'].grow;}

// Vector illustrations remain sharp when the map is zoomed.
function sprite(name,x,y,s,draw){at(x,y,s,draw);}
function tree(x,y,s=1,kind='green'){
  sprite('tree-'+kind,x,y,s,()=>{
    oval(8,0,24,9,'#276c2860');
    poly([[-4,0],[4,-2],[5,-39],[-2,-44]],'#755324','#574c28');
    line([[0,-17],[-11,-34]],'#806433',3);line([[2,-23],[12,-39]],'#96713c',3);
    const colors=kind==='pink'?['#a45b79','#c77d9b','#e19fb7','#efb7c8']:['#237c34','#36963b','#51ae43','#70ba4c'];
    const lumps=[[-12,-37,15,13],[12,-40,17,15],[0,-51,19,17],[-17,-48,12,12],[17,-52,12,12],[0,-62,13,11]];
    for(const [a,b,c,d] of lumps)oval(a,b,c,d,colors[0]);
    for(let n=0;n<24;n++)oval((rand(n+3)-.5)*42,-34-rand(n+40)*31,6+rand(n+19)*7,4+rand(n+2)*6,colors[1+n%3]);
    if(kind==='fruit')for(let n=0;n<8;n++){oval((rand(n+13)-.5)*32,-38-rand(n+11)*23,2.5,3,'#ecb13a');oval((rand(n+13)-.5)*32-1,-39-rand(n+11)*23,1,1,'#ffe388');}
  });
}
function palm(x,y,s=1){at(x,y,s,()=>{
  oval(11,0,26,8,'#276c2860');
  poly([[-5,0],[2,0],[10,-66],[5,-70]],'#977c39','#625b2d');
  for(let n=0;n<9;n++)line([[-2+n*.8,-n*7],[4+n*.7,-n*7-2]],'#c3a46a',1.4);
  for(let n=0;n<9;n++){
    const angle=n/9*Math.PI*2,dx=Math.cos(angle)*39,dy=Math.sin(angle)*16;
    ctx.beginPath();ctx.moveTo(8,-68);ctx.quadraticCurveTo(8+dx*.7,-92+dy,8+dx,-65+dy);ctx.quadraticCurveTo(8+dx*.65,-59+dy,8,-68);ctx.fillStyle=n%2?'#49a54e':'#2a8c49';ctx.fill();
    line([[8,-68],[8+dx*.55,-80+dy*.7],[8+dx,-65+dy]],'#72bf62',1);
    for(let j=1;j<6;j++){const a=8+dx*j/6,b=-68-10*Math.sin(j/6*Math.PI)+dy*j/6;poly([[a,b],[a+dx*.12-3,b+8],[a+dx*.2,b+3]],n%2?'#58b36a':'#369b59');}
  }
  oval(5,-66,3,4,'#a08b48');oval(11,-64,3,4,'#766633');
});}
function rock(x,y,s=1){at(x,y,s,()=>{oval(2,1,10,3,'#2b712c50');poly([[-10,0],[-8,-6],[-2,-10],[7,-8],[11,-1],[6,2]],'#9d9d78','#5d7859');poly([[-8,-6],[-2,-10],[7,-8],[1,-5]],'#bec09d');});}
function fence(points){
  for(let n=1;n<points.length;n++){
    const [x,y]=points[n-1],[u,v]=points[n],steps=Math.ceil(Math.hypot(u-x,v-y)/19);
    line([[x,y-13],[u,v-13]],'#737a4570',4);
    line([[x,y-14],[u,v-14]],'#f9efd2',2.5);line([[x,y-7],[u,v-7]],'#e1d9b8',2.2);
    for(let k=0;k<=steps;k++){const a=x+(u-x)*k/steps,b=y+(v-y)*k/steps;poly([[a-2,b+1],[a+2,b],[a+2,b-21],[a,b-24],[a-2,b-21]],'#eee8c9','#9da77c',.6);line([[a-1,b-20],[a-1,b-2]],'#fffbe1',.8);}
  }
}
function barn(x,y,s=1,cottage=false){at(x,y,s,()=>{
  const wall=cottage?'#f4e4bc':'#bf4f3c',side=cottage?'#c9bd8d':'#993d30';
  oval(3,2,48,15,'#325a2940');
  poly([[-32,-3],[3,14],[40,-5],[6,-22]],'#bba67c','#8e8e58');
  poly([[-31,-5],[3,10],[3,-48],[-31,-65]],wall,'#664f32');
  poly([[3,10],[38,-7],[38,-65],[3,-48]],side,'#664f32');
  // Gabled facade, roof planes and visible shingle rows.
  poly([[-31,-65],[-14,-92],[3,-48]],wall,'#6c4735');
  poly([[-38,-66],[-15,-100],[46,-72],[21,-40]],'#6d3c3b','#4e4234');
  poly([[-15,-100],[8,-60],[46,-72]],'#a44847','#673e35');
  for(let n=1;n<7;n++){
    const t=n/7;line([[-38+23*t,-66-34*t],[21+25*t,-40-32*t]],'#b26357',.9);
    for(let k=1;k<6;k++)line([[-38+23*t+k*9,-66-34*t+k*4],[-35+23*t+k*9,-70-34*t+k*4]],'#492f2c',.7);
  }
  line([[-38,-66],[21,-40],[46,-72]],'#e5b79c',2);
  line([[-31,-62],[-31,-6],[3,10],[3,-43]],'#f9e7c0',3);
  line([[38,-62],[38,-7]],'#f0deaf',2);
  for(let n=0;n<9;n++)line([[-28,-53+n*5],[0,-40+n*5]],cottage?'#d2c69d':'#a23f32',.6);
  for(let n=0;n<8;n++)line([[7,-41+n*5],[35,-55+n*5]],cottage?'#b2a97f':'#7e372c',.6);
  // Double doors with cross braces.
  poly([[-25,-7],[-5,2],[-5,-28],[-25,-37]],'#694c35','#fff1c6',2);
  line([[-15,-32],[-15,-2]],'#e7d1a0',1.5);
  line([[-24,-34],[-6,0],[-6,-26],[-24,-8]],'#e8d3a7',1.5);
  oval(-11,-13,1,1.6,'#d5ba76');
  poly([[12,-13],[28,-21],[28,-39],[12,-31]],'#67acbc','#eee2b9',2);
  poly([[13,-30],[26,-37],[26,-29],[13,-23]],'#a7e0df');
  line([[20,-34],[20,-18]],'#f6eaca',1.5);line([[13,-22],[27,-29]],'#f6eaca',1.2);
  poly([[-20,-60],[-11,-56],[-11,-69],[-20,-73]],'#80c9d0','#fce6c0',1.5);
  line([[-21,-59],[-9,-53]],'#f5d898',2);
  if(cottage){
    poly([[19,-84],[26,-87],[26,-109],[19,-106]],'#b37b5f','#6b5140');poly([[13,-109],[21,-113],[29,-109],[21,-105]],'#c58e68','#775440');
    oval(24,-121,5,4,'#ffffff66');oval(27,-132,7,5,'#ffffff40');
  }else{
    poly([[-19,-102],[-13,-110],[-7,-99],[-13,-95]],'#efcf9f','#6a5237');
    rect(-14,-120,2,14,'#866c43');line([[-20,-116],[-7,-116]],'#5f5d39',1.3);
  }
  // Flower boxes and stepping stones.
  poly([[10,-7],[30,-17],[30,-11],[10,-1]],'#a9713d','#785133');
  for(let n=0;n<7;n++){const a=12+n*2.5,b=-8-n*1.2;line([[a,b],[a,b-6]],'#568c30',1.3);oval(a,b-7,2,2,n%2?'#f2ce6d':'#d887ab');}
  for(let n=0;n<3;n++)diamond(-17-n*8,9+n*4,8,3,'#c9c0a0','#92936f');
});}
function chicken(x,y){at(x,y,.8,()=>{oval(0,1,7,3,'#33782a50');line([[-2,-1],[-3,3]],'#d0a233',1);line([[2,-1],[3,3]],'#d0a233',1);oval(0,-5,6,4,'#fff7db');oval(5,-9,3,4,'#fffbe5');poly([[7,-10],[11,-8],[7,-7]],'#e9ae3b');oval(5,-13,2,2,'#c9513d');oval(6,-10,1,1,'#454a35');poly([[-5,-5],[-9,-11],[-8,-4]],'#e7e2bb');});}
function tractor(x,y){at(x,y,1,()=>{
  oval(0,3,31,10,'#276b2d60');
  for(const [a,b,r] of [[-18,-4,12],[20,5,9]]){oval(a,b,r,r,'#303d38');oval(a,b,r-3,r-3,'#4e5d51');oval(a,b,r-6,r-6,'#b5b68d');for(let n=0;n<9;n++){const ang=n/9*Math.PI*2;line([[a+Math.cos(ang)*r*.8,b+Math.sin(ang)*r*.8],[a+Math.cos(ang+.16)*r,b+Math.sin(ang+.16)*r]],'#1b302b',2);}}
  poly([[-20,-16],[4,-25],[27,-14],[5,-4]],'#417ca9','#285170');poly([[5,-4],[27,-14],[27,-6],[5,4]],'#2c5b82');poly([[-20,-16],[5,-4],[5,4],[-20,-8]],'#325b8d');
  poly([[-18,-17],[-18,-39],[0,-45],[0,-25]],'#9cd2d6','#e7e8b7',1.6);poly([[0,-25],[0,-45],[10,-40],[10,-21]],'#588f99','#d7d7a4');poly([[-23,-39],[-4,-49],[15,-41],[-4,-31]],'#306ea0','#224f71');
  line([[18,-16],[18,-34]],'#3e5252',3);oval(18,-35,2,1,'#253e3b');
  for(let n=0;n<5;n++)line([[8+n*3,-3-n*1.5],[8+n*3,3-n*1.5]],'#c2cba9',1);
  oval(25,-8,2,2,'#ffec9e');
});}
function flowers(x,y,color='#e9ba38',count=8){for(let n=0;n<count;n++){const a=x+rand(n+17)*23,b=y+rand(n+32)*12;line([[a,b],[a,b-5]],'#418939',1);oval(a-2,b-2,2,1,'#70ad43');oval(a,b-6,2.5,2,color);oval(a,b-6,1,1,'#f9e294');}}
function avatar(x,y,t){at(x,y,1,()=>{
  oval(1,1,8,3,'#2c562e55');line([[-3,-10],[-4,-2]],'#454f68',3);line([[3,-10],[4,-2]],'#454f68',3);oval(-4,-1,3,1.4,'#4a3d30');oval(5,-1,3,1.4,'#4a3d30');
  poly([[-5,-22],[5,-22],[6,-9],[-5,-9]],'#4e9db5','#376f89');line([[-5,-20],[-10,-14]],'#e1ba83',3);line([[5,-20],[9+Math.sin(t/400),-15]],'#e1ba83',3);oval(0,-29,6,7,'#f1cda0');oval(2,-28,.7,1,'#564b3e');poly([[-7,-31],[-5,-37],[5,-37],[7,-31]],'#628fb5','#365c79');oval(1,-31,9,2,'#8db4bf');
});}
function scenery(){
  rect(-1000,-1000,3000,2500,'#278a2e');
  // Hills and forest shadows frame the farm, rather than isolated circles.
  poly([[-200,330],[75,240],[280,70],[450,-70],[-200,-100]],'#287c2e');
  for(let n=0;n<48;n++){const x=rand(n+17)*1300-100,y=rand(n+321)*210-110;tree(x,y,.7+rand(n+6)*.7);}
  poly([[-200,230],[30,190],[105,150],[190,105],[270,62],[340,13],[430,-80],[570,-80],[450,60],[360,125],[270,175],[170,227],[40,280],[-200,345]],'#a0a263','#6d9560',2);
  poly([[-200,242],[35,205],[115,162],[200,117],[280,75],[350,28],[440,-80],[535,-80],[430,45],[350,108],[260,158],[160,211],[30,263],[-200,329]],gradient(70,60,230,240,['#1b9da9','#22b9c2','#53ccc9']));
  for(let n=0;n<65;n++){const x=rand(n+53)*570-90,y=240-x*.57+(rand(n+733)-.5)*39;line([[x,y],[x+8+rand(n+31)*16,y-2]],n%3?'#6cd2ce60':'#c2eee359',.8);}
  for(let n=0;n<28;n++){const x=35+n*14,y=267-n*7.8;rock(x,y,.55+rand(n)*.3);}
  // A planked bridge with two raised railings.
  at(270,100,1,()=>{
    poly([[-57,-34],[12,-66],[63,1],[-6,34]],'#735634','#655534');
    for(let n=0;n<13;n++){const t=n/13;poly([[-57+51*t,-34+68*t],[12+51*t,-66+68*t],[16+51*t,-61+68*t],[-53+51*t,-29+68*t]],n%2?'#b8945a':'#bf9c61','#8d6b3d',.7);}
    for(const side of [0,1]){const x=side?12:-57,y=side?-66:-34;line([[x,y-17],[x+51,y+51]],'#947849',3);for(let n=0;n<5;n++)line([[x+n*12,y+n*16],[x+n*12,y+n*16-19]],'#6d613c',2);line([[x,y-20],[x+51,y+48]],'#d1ae74',2);}
  });
  // Background only: no owned plot or future-farm outline is baked into it.
  for(let n=0;n<12000;n++){
    const x=rand(n+1)*1100,y=155+rand(n+14000)*520;
    if(y<280-x*.55)continue;
    rect(x,y,n%7===0?1.6:.8,.6,n%3===0?'#79c54b50':n%3===1?'#a2cf5820':'#1e713330');
  }
  for(let n=0;n<90;n++){const x=rand(n+713)*1100,y=rand(n+572)*600;if(x<120||x>980||y>575){line([[x,y],[x-2,y-4]],'#66a947',.7);line([[x,y],[x+2,y-6]],'#6cab4a',.7);}}
  // Surrounding tropical vegetation, rocks and small flowers.
  palm(92,491,1.13);palm(164,550,.94);palm(1019,290,1.12);palm(961,553,1.34);palm(1038,465,.91);palm(610,77,.89);
  tree(37,375,1.2);tree(1071,395,1.2);tree(759,95,.9);tree(794,103,.8);tree(1040,154,1.15);
  for(let n=0;n<6;n++){tree(29+n*26,643+(n%2)*13,1.15);tree(1035+n*23,641-(n%3)*9,1.2);}
  rock(168,502,.8);rock(78,428,.7);rock(1022,376,.65);rock(702,114,.7);flowers(130,472,'#eddb7a',5);flowers(981,475,'#d5dba6',6);
}
// Cache static vector landscape to a high resolution backing canvas.
function cacheScenery(){
  const source=document.createElement('canvas');source.width=2400;source.height=1600;
  const screen=ctx;
  try {
    ctx=source.getContext('2d');
    ctx.scale(2,2);ctx.translate(50,50);scenery();
    landscape=source;
  } finally {ctx=screen;}
}
function plotTile(x,y,p,i,j){
  diamond(x,y+2,20.5,9.5,'#566b2b');diamond(x,y,20.5,9.5,p.stage===2?'#684c2c':'#876031','#a0a653');
  line([[x-19,y],[x,y+9],[x+19,y]],'#b8aa60',.8);
  for(let n=0;n<6;n++){
    const a=n*5.5;line([[x-16+a*.5,y-1-a*.24],[x+a*.5,y+7-a*.24]],p.stage===2?'#423b25':'#543d23',1.2);
    line([[x-15+a*.5,y-2-a*.24],[x+1+a*.5,y+6-a*.24]],p.stage===2?'#927141':'#b08b49',.7);
  }
  for(let n=0;n<9;n++)rect(x+(rand(n+i*13+j*37)-.5)*25,y+(rand(n+i*71+j*9)-.5)*8,.8,.7,'#c1a26380');
  if(hover&&hover.i===i&&hover.j===j){diamond(x,y,21,10,'#eaf58b30','#f4f0ab');}
}
function cropPlant(x,y,p,seed){
  if(!p.stage)return;
  const mature=ready(p),age=p.stage===1?.12:Math.min(1,(Date.now()-p.watered)/CROPS[p.crop||'corn'].grow);
  const kind=p.crop||'corn';
  for(let n=0;n<5;n++){
    const a=x+(n%3-1)*8+(n>2?3:0),b=y+(Math.floor(n/3)-.5)*5;
    const h=kind==='corn'?5+age*16:5+age*7;
    line([[a,b],[a,b-h]],'#376c27',1.4);
    for(let k=0;k<3;k++){
      const d=k%2?-1:1,yy=b-h*.3-k*h*.22;
      poly([[a,yy],[a+d*(4+age*3),yy-5],[a+d*(3+age*2),yy],[a,yy+1]],k%2?'#79ad36':'#558d2b','#46792a',.4);
    }
    if(kind==='corn'&&age>.5){oval(a+2,b-h+4,1.8,4,mature?'#efc43d':'#9dbb4c');if(mature){line([[a,b-h],[a+2,b-h-3]],'#dbb765',.6);rect(a+2,b-h+3,.7,2,'#fff09b');}}
    if(kind==='carrot'&&mature){poly([[a-2,b-3],[a+3,b-3],[a,b+3]],'#ef973d','#bd722c',.5);}
    if(kind==='strawberry'&&mature){oval(a+2,b-4,2.7,2.7,'#d95546');rect(a+1,b-5,.7,.7,'#ffdb9b');oval(a-3,b-6,2,2,'#ed6652');}
  }
}
function draw(timestamp){
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  rect(0,0,W,H,'#278a2e');
  const size=LAND[state.landStep].size;
  scale=Math.min(W/Math.max(570,(size+11)*44),Math.max(220,H-180)/450,1.4)*zoom;
  tx=W/2-445*scale+pan.x;ty=(H-125)/2-(180+size*10.5)*scale+35+pan.y;
  ctx.save();ctx.translate(tx,ty);ctx.scale(scale,scale);
  ctx.drawImage(landscape,-50,-50,1200,800);
  if(expansionMode)drawExpansionPreview();
  drawFarmGround();
  // Only land earned by the player becomes usable, arable soil.
  for(let d=0;d<N*2-1;d++)for(let i=0;i<N;i++){
    const j=d-i;if(j<0||j>=N)continue;
    const p=state.plots[i*N+j],[x,y]=grid(i+.5,j+.5);
    if(owned(i,j)&&!p.tilled&&!p.stage&&tool==='till')diamond(x,y,21,10,'#c7dd8a10','#b9d97460');
    if((!owned(i,j)||!p.tilled)&&!p.stage)continue;
    plotTile(x,y,state.plots[i*N+j],i,j);
  }
  if(hover&&!owned(hover.i,hover.j)){
    const [x,y]=grid(hover.i+.5,hover.j+.5);diamond(x,y,21,10,'#f4eccb20','#c8d4a575');
  }
  for(let d=0;d<N*2-1;d++)for(let i=0;i<N;i++){
    const j=d-i;if(j<0||j>=N)continue;const [x,y]=grid(i+.5,j+.5);cropPlant(x,y,state.plots[i*N+j],i*N+j);
  }
  const [ax,ay]=grid(Math.min(size,3)+.8,1.3);avatar(ax,ay,timestamp);
  drawBuildings(timestamp);
  // A butterfly is part of the natural landscape.
  const wing=Math.sin(timestamp/120)*2;
  oval(642+Math.sin(timestamp/2200)*8,231+Math.cos(timestamp/1900)*5,3,1+Math.abs(wing),'#f4d66f');
  for(let n=floats.length-1;n>=0;n--){const f=floats[n],age=(performance.now()-f.time)/1400;if(age>1){floats.splice(n,1);continue;}ctx.globalAlpha=1-age;ctx.font='bold 14px Tahoma';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#355329';ctx.strokeText(f.text,f.x,f.y-age*32);ctx.fillStyle='#fff1a4';ctx.fillText(f.text,f.x,f.y-age*32);ctx.globalAlpha=1;}
  ctx.restore();positionExpansionButtons();requestAnimationFrame(draw);
}
function resize(){W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=Math.round(W*devicePixelRatio);canvas.height=Math.round(H*devicePixelRatio);}
function tileAt(clientX,clientY){const box=canvas.getBoundingClientRect(),x=(clientX-box.left-tx)/scale-445,y=(clientY-box.top-ty)/scale-180;const i=Math.floor((x/22+y/10.5)/2),j=Math.floor((y/10.5-x/22)/2);return i>=0&&j>=0&&i<N&&j<N?{i,j}:null;}
function inspect(p){if(!p.stage)return p.tilled?'Terra arada · pronta para plantar':'Grama · use a enxada para aplicar terra';const def=CROPS[p.crop||'corn'];return def.name+' · '+(p.stage===1?'precisa de água':ready(p)?'pronto para colher':`${Math.ceil((def.grow-Date.now()+p.watered)/1000)} s para colher`);}
function act(tile){
  if(!tile)return;
  if(expansionMode)return tell('Escolha uma seta da frente para ver a expansão, ou clique em Voltar à fazenda.');
  const {i,j}=tile,index=i*N+j,p=state.plots[index],def=CROPS[crop];
  if(!owned(i,j)&&!p.stage)return tell('Seu terreno cresce pelos dois lados da frente. Abra Loja → Expansão para ampliar.');
  if(tool==='till'){
    if(p.tilled||p.stage)return tell('A terra desse espaço já está preparada. Escolha uma semente para plantar.');
    state.plots[index]={stage:0,tilled:true};save();update();tell('Terra preparada! Escolha milho na barra de sementes e plante aqui.');return;
  }
  if(tool==='plant'){
    if(!p.tilled)return tell('Primeiro use a enxada do painel para aplicar terra neste espaço.');
    if(level()<def.level)return tell(`${def.name} desbloqueia no nível ${def.level}.`);
    if(p.stage)return tell(inspect(p));
    if(state.coins<def.cost)return tell(`Você precisa de ${def.cost} moedas. Colha suas plantas maduras para ganhar mais.`);
    state.coins-=def.cost;state.plots[index]={stage:1,crop,tilled:true};state.counts.plant++;tell(`${def.name} plantado! Agora selecione o regador.`);
  }else if(tool==='water'){
    if(!p.stage)return tell('Esse canteiro está vazio. Escolha uma semente e plante primeiro.');
    if(p.stage===2)return tell(inspect(p));
    p.stage=2;p.watered=Date.now();state.counts.water++;tell(`${CROPS[p.crop||'corn'].name} regado! Fica pronto em ${CROPS[p.crop||'corn'].grow/1000} segundos.`);
  }else if(tool==='harvest'){
    if(!ready(p))return tell(p.stage?inspect(p):'Use a cesta nas plantas que já estiverem maduras.');
    const harvest=CROPS[p.crop||'corn'],sale=Math.floor(harvest.sale*(isPlaced('cottage')?1.2:1));state.coins+=sale;const up=grantXP(harvest.xp);state.counts.harvest++;state.plots[index]={stage:0,tilled:true};
    const [x,y]=grid(i+.5,j+.5);floats.push({x,y:y-15,text:`+${sale} moedas · +${harvest.xp} XP`,time:performance.now()});tell(up?levelMessage():`Boa colheita! +${sale} moedas e +${harvest.xp} XP.`);
  }else return tell(inspect(p));
  save();update();
}
function tooltip(e){const el=$('#tooltip');if(!hover||drag){el.hidden=true;return;}el.textContent=owned(hover.i,hover.j)?inspect(state.plots[hover.i*N+hover.j]):'Amplie o terreno em Loja → Expansão';el.hidden=false;const box=canvas.getBoundingClientRect();el.style.left=Math.max(4,Math.min(W-205,e.clientX-box.left+15))+'px';el.style.top=Math.max(8,e.clientY-box.top-37)+'px';}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};drag=false;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(pointer&&pointer.id===e.pointerId){if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)drag=true;if(drag){pan.x=pointer.panX+e.clientX-pointer.x;pan.y=pointer.panY+e.clientY-pointer.y;canvas.style.cursor='grabbing';}}hover=tileAt(e.clientX,e.clientY);tooltip(e);});
canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(!drag){const asset=buildingAt(e.clientX,e.clientY);if(asset)openBuilding(asset);else act(tileAt(e.clientX,e.clientY));}pointer=null;drag=false;canvas.style.cursor=tool==='info'?'default':'crosshair';});
canvas.addEventListener('pointercancel',()=>{pointer=null;drag=false;canvas.style.cursor=tool==='info'?'default':'crosshair';});
canvas.addEventListener('pointerleave',()=>{hover=null;$('#tooltip').hidden=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(2,zoom+(e.deltaY<0?.08:-.08)));},{passive:false});
function setTool(next){leaveExpansionMode();tool=next;canvas.style.cursor=next==='info'?'default':'crosshair';update();const hints={till:'Enxada selecionada. Clique na grama do terreno para aplicar terra, sem custo.',plant:`${CROPS[crop].name} selecionado. Clique em um canteiro vazio.`,water:'Clique nas plantas que precisam de água.',harvest:'Clique nas plantas maduras para colher.',info:'Modo de visualizar. Clique nos objetos para usar ou guardar no armazém.'};tell(hints[next]);}
function setCrop(next){if(level()<CROPS[next].level)return tell(`${CROPS[next].name} será liberado no nível ${CROPS[next].level}. Continue colhendo para ganhar XP.`);crop=next;setTool('plant');}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.querySelectorAll('[data-crop]').forEach(b=>b.onclick=()=>setCrop(b.dataset.crop));
$('#save').onclick=()=>tell(save()?'Fazenda salva! Seu progresso fica guardado neste navegador.':'O navegador bloqueou o salvamento. Permita o armazenamento local para guardar sua fazenda.');
$('#in').onclick=()=>zoom=Math.min(2,zoom+.15);$('#out').onclick=()=>zoom=Math.max(.65,zoom-.15);$('#home').onclick=()=>{pan={x:0,y:0};zoom=1;};
function modal(title,body){activeBuilding=null;$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;if(!$('#modal').open)$('#modal').showModal();}
$('#close-modal').onclick=()=>$('#modal').close();
$('#help').onclick=()=>modal('Sua fazenda começa aqui',`<p>Você começa no <b>nível 1</b>, com <b>50 moedas e espaço para 9 canteiros</b>. Não há prédios nem animais comprados.</p><p>Use a <b>enxada</b> do painel verde para aplicar terra na grama. Depois plante milho, regue e espere 20 segundos. Depois colha com a cesta para ganhar moedas e experiência. Recolha também as recompensas dos objetivos.</p><p>No nível 2, você poderá plantar cenouras, expandir o terreno e comprar sua primeira laranjeira. No nível 3, chegam morangos e o galinheiro.</p><p>As plantas continuam crescendo com o jogo fechado. Não murcham. A fazenda fica salva neste navegador, sem sincronização entre aparelhos.</p><p>O terreno é quadrado, com uma ponta voltada para você. Abra <b>Loja → Expansão</b> para ver a metragem e as duas setas da frente. A ponta de trás fica no mesmo lugar; a expansão aumenta os dois lados da frente juntos.</p><p>Arraste o mapa, use +/− ou a roda do mouse para aproximar e as teclas 1 a 5 para trocar de ferramenta. Clique nos prédios comprados para usá-los.</p>`);
$('#quest').onclick=()=>modal('O caminho da sua fazenda',MISSIONS.map(m=>{
  const claimed=state.claimed.includes(m.id),done=m.current()>=m.target;
  return `<div class="mission-row ${claimed?'completed':''}"><b>${claimed?'✓ ':''}${m.title}</b><small>${m.description} · ${Math.min(m.current(),m.target)}/${m.target}</small><span>${claimed?'Recompensa recebida':`${m.coins} moedas · ${m.xp} XP${done?' · disponível':''}`}</span></div>`;
}).join('')+'<p>Receba a recompensa de cada etapa no cartão de objetivo.</p>');
$('#claim').onclick=claimMission;
$('#shop').onclick=()=>openShop();
$('#expand-left').onclick=()=>openExpansion('left');
$('#expand-right').onclick=()=>openExpansion('right');
$('#exit-expansion').onclick=leaveExpansionMode;
$('#achievements').onclick=openAchievements;$('#machines').onclick=openMachines;
$('#gifts').onclick=openGifts;$('#warehouse').onclick=openWarehouse;
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').open){leaveExpansionMode();return;}if($('#modal').open||e.ctrlKey||e.metaKey||e.altKey)return;const next={'1':'info','2':'plant','3':'water','4':'harvest','5':'till'}[e.key];if(next)setTool(next);});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
cacheScenery();resize();update();requestAnimationFrame(draw);toastTimer=setTimeout(()=>$('#message').classList.add('quiet'),6500);

function buyExpansion(){
  const next=LAND[state.landStep+1];if(!next)return;
  if(level()<next.level)return tell(`A próxima expansão exige o nível ${next.level}.`);
  if(state.coins<next.cost+5)return tell(`Você precisa de ${next.cost} moedas e deve reservar 5 para continuar plantando.`);
  state.coins-=next.cost;state.landStep++;save();update();
  leaveExpansionMode();if($('#modal').open)$('#modal').close();
  tell(`Seu terreno cresceu pelos dois lados da frente! Agora são ${next.size**2} canteiros.`);
}
function buyBuilding(id,origin='shop'){
  const def=BUILDINGS[id];if(!def||state.buildings[id])return;
  if(level()<def.level)return tell(`${def.name} exige o nível ${def.level}.`);
  if(state.coins<def.cost+5)return tell(`Você precisa de ${def.cost} moedas e deve reservar 5 para continuar plantando.`);
  state.coins-=def.cost;state.buildings[id]={boughtAt:Date.now(),readyAt:id==='apple'?Date.now()+60000:null};
  save();update();if(origin==='machines')openMachines();else openShop('buildings');tell(`${def.name} comprado! Clique nele na fazenda para usar.`);
}
function openShop(tab='seeds'){
  leaveExpansionMode();
  const seeds=Object.entries(CROPS).map(([id,c])=>{
    const locked=level()<c.level;
    return `<div class="shop-row ${locked?'unavailable':''}"><span class="crop-art ${id==='corn'?'corn':id==='carrot'?'carrot':'berry'}-art"><i></i>${id==='corn'?'<i></i><i></i>':''}</span><div><b>${c.name}</b><small>${c.grow/1000} s · venda: ${Math.floor(c.sale*(isPlaced('cottage')?1.2:1))} moedas · ${c.xp} XP</small></div><button data-buy="${id}" ${locked?'disabled':''}>${locked?'Nível '+c.level:'Plantar · '+c.cost}</button></div>`;
  }).join('');
  const buildings=Object.entries(BUILDINGS).map(([id,b])=>{
    const has=!!state.buildings[id],locked=level()<b.level;
    return `<div class="shop-row ${locked?'unavailable':''}"><span class="upgrade-icon">${{apple:'♣',coop:'⌂',cottage:'⌂',tractor:'⚙'}[id]}</span><div><b>${b.name}</b><small>${b.description}</small></div><button data-building="${id}" ${has||locked?'disabled':''}>${has?(state.buildings[id].stored?'No armazém':'Comprado'):locked?'Nível '+b.level:b.cost+' moedas'}</button></div>`;
  }).join('');
  modal('Loja da fazenda',`<div class="shop-summary">Nível ${level()} · ${state.coins} moedas</div><nav class="shop-tabs" aria-label="Categorias da loja"><button data-shop-tab="seeds" class="${tab==='seeds'?'active':''}">Sementes</button><button data-shop-tab="buildings" class="${tab==='buildings'?'active':''}">Construções</button><button id="shop-expansion">Expansão</button></nav>${tab==='buildings'?buildings:seeds}<p class="shop-note">As melhorias preservam 5 moedas para você continuar plantando.</p>`);
  document.querySelectorAll('[data-shop-tab]').forEach(b=>b.onclick=()=>openShop(b.dataset.shopTab));
  $('#shop-expansion').onclick=enterExpansionMode;
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{setCrop(b.dataset.buy);$('#modal').close();});
  document.querySelectorAll('[data-building]').forEach(b=>b.onclick=()=>buyBuilding(b.dataset.building));
}
function drawBuildings(timestamp){
  if(isPlaced('cottage'))barn(BUILDINGS.cottage.x,BUILDINGS.cottage.y,.91,true);
  if(isPlaced('apple')){
    const {x,y}=BUILDINGS.apple;tree(x,y,.95,Date.now()>=state.buildings.apple.readyAt?'fruit':'green');
    if(Date.now()>=state.buildings.apple.readyAt)productionBadge(x,y-80,'Frutas prontas');
  }
  if(isPlaced('coop')){
    const b=state.buildings.coop;
    at(BUILDINGS.coop.x-850,BUILDINGS.coop.y-330,1,()=>{
    fence([[788,336],[847,308],[909,339]]);barn(873,323,.53);
    for(let n=0;n<3;n++)chicken(820+n*18+Math.sin(timestamp/1600+n)*1.3,348+n%2*7);
    fence([[788,336],[850,367],[909,339]]);
    if(b.readyAt&&Date.now()>=b.readyAt)productionBadge(848,261,'Ovos prontos');
    });
  }
  if(isPlaced('tractor'))tractor(BUILDINGS.tractor.x,BUILDINGS.tractor.y);
}
function productionBadge(x,y,text){
  ctx.font='bold 9px Tahoma';ctx.textAlign='center';
  rect(x-36,y-12,72,17,'#fff0b9');ctx.strokeStyle='#a48b47';ctx.lineWidth=.8;ctx.strokeRect(x-36,y-12,72,17);ctx.fillStyle='#536a2d';ctx.fillText(text,x,y);
}
function buildingAt(clientX,clientY){
  const box=canvas.getBoundingClientRect(),x=(clientX-box.left-tx)/scale,y=(clientY-box.top-ty)/scale;
  return Object.keys(BUILDINGS).find(id=>{
    if(!isPlaced(id))return false;const b=BUILDINGS[id];
    const w=id==='coop'?67:id==='apple'?30:42,h=id==='cottage'?100:id==='apple'?85:65;
    return x>b.x-w&&x<b.x+w&&y>b.y-h&&y<b.y+14;
  });
}
function openBuilding(id){
  const b=state.buildings[id],def=BUILDINGS[id];if(!isPlaced(id)||!def)return;
  let content=`<p>${def.description}</p>`,action=null,label='';
  if(id==='apple'){
    if(Date.now()>=b.readyAt){content+='<p>Suas laranjas estão maduras! Venda esta colheita por <b>15 moedas e 3 XP</b>.</p>';action='fruit';label='Colher laranjas';}
    else content+=`<p>As laranjas ficam prontas em <b>${Math.ceil((b.readyAt-Date.now())/1000)} segundos</b>.</p>`;
  }else if(id==='coop'){
    if(b.readyAt===null){content+='<p>As galinhas estão esperando comida. A produção começa depois que você alimenta.</p>';action='feed';label='Alimentar · 5 moedas';}
    else if(Date.now()>=b.readyAt){content+='<p>Uma cesta de ovos está pronta! Venda por <b>30 moedas e 5 XP</b>.</p>';action='eggs';label='Recolher ovos';}
    else content+=`<p>Ovos prontos em <b>${Math.ceil((b.readyAt-Date.now())/1000)} segundos</b>.</p>`;
  }else if(id==='cottage')content+='<p>Seu bônus está ativo: <b>+20% de moedas em todas as colheitas de canteiros</b>.</p>';
  else if(id==='tractor'){
    const count=state.plots.filter(p=>p.stage===1).length;
    content+=`<p>Há <b>${count} canteiros</b> precisando de água. Custo total: <b>${count} moedas</b>.</p>`;
    if(count){action='waterAll';label=`Regar tudo · ${count} moedas`;}
  }
  if(action)content+=`<button class="production-button" id="production-action">${label}</button>`;
  content+='<button class="storage-button" id="store-building">Guardar no armazém</button>';
  modal(def.name,content);activeBuilding=id;$('#store-building').onclick=()=>storeBuilding(id);
  if(action)$('#production-action').onclick=()=>useBuilding(id,action);
}
function useBuilding(id,action){
  const b=state.buildings[id];if(!isPlaced(id))return;let up=false;
  if(id==='apple'&&action==='fruit'&&Date.now()>=b.readyAt){state.coins+=15;up=grantXP(3);b.readyAt=Date.now()+60000;tell('Laranjas vendidas! +15 moedas e +3 XP.');}
  else if(id==='coop'&&action==='feed'&&b.readyAt===null){if(state.coins<5)return tell('Você precisa de 5 moedas para alimentar as galinhas.');state.coins-=5;b.readyAt=Date.now()+45000;tell('Galinhas alimentadas! Os ovos ficam prontos em 45 segundos.');}
  else if(id==='coop'&&action==='eggs'&&b.readyAt&&Date.now()>=b.readyAt){state.coins+=30;up=grantXP(5);b.readyAt=null;tell('Ovos vendidos! +30 moedas e +5 XP.');}
  else if(id==='tractor'&&action==='waterAll'){
    const dry=state.plots.filter(p=>p.stage===1);if(!dry.length)return;
    if(state.coins<dry.length)return tell('Moedas insuficientes. Você pode regar gratuitamente com o regador.');
    state.coins-=dry.length;dry.forEach(p=>{p.stage=2;p.watered=Date.now();});state.counts.water+=dry.length;tell(`${dry.length} canteiros regados pelo trator.`);
  }else return;
  if(up)tell(levelMessage());save();update();openBuilding(id);
}
setInterval(()=>{if($('#modal').open&&activeBuilding)openBuilding(activeBuilding);},1000);

function drawFarmGround(){
  if(groundStep!==state.landStep){
    const source=document.createElement('canvas');source.width=1800;source.height=1100;
    const screen=ctx;
    try{ctx=source.getContext('2d');ctx.scale(2,2);paintFarmGround();farmGround=source;groundStep=state.landStep;}finally{ctx=screen;}
  }
  ctx.drawImage(farmGround,0,0,900,550);
}
function paintFarmGround(){
  const {back,right,front,left}=landCorners();
  poly([back,right,front,left],'#49af38','#65ba3c',.65);
  // A thin green seam, without permanent arrows or measurement labels.
  poly([left,front,[front[0],front[1]+2],[left[0],left[1]+2]],'#35962e');
  poly([front,right,[right[0],right[1]+2],[front[0],front[1]+2]],'#31892c');
  line([left,front,right],'#79c846',.8);
  const size=LAND[state.landStep].size,span=size+LAND_MARGIN*2;
  for(let n=0;n<span*span*38;n++){
    const i=-LAND_MARGIN+rand(n+43)*span,j=-LAND_MARGIN+rand(n+7001)*span;
    const [x,y]=grid(i,j);rect(x,y,n%5?1:1.8,.7,n%3?'#8dc95750':'#298d3345');
  }
}
function positionExpansionButtons(){
  const points=expansionPositions(),next=LAND[state.landStep+1];
  for(const side of ['left','right']){
    const button=$('#expand-'+side);button.hidden=!expansionMode||!next;
    if(!expansionMode||!next)continue;
    const [x,y]=points[side];button.style.left=(tx+x*scale)+'px';button.style.top=(ty+y*scale)+'px';
    button.querySelector('b').textContent=`${next.size+LAND_MARGIN*2} × ${next.size+LAND_MARGIN*2} m`;
    button.querySelector('small').textContent=level()<next.level?`Nível ${next.level}`:`${next.cost} moedas`;
    button.classList.toggle('level-locked',level()<next.level);
  }
}
function openExpansion(side){
  const next=LAND[state.landStep+1];if(!expansionMode||!next)return;
  const locked=level()<next.level,affordable=state.coins>=next.cost+5;
  modal('Expandir a fazenda',`<p>Você escolheu a seta da frente à <b>${side==='left'?'esquerda':'direita'}</b>.</p><p>A próxima expansão aumenta <b>os dois lados da frente juntos</b>, preservando o quadrado e a ponta de trás no mesmo lugar.</p><div class="expansion-comparison"><b>${LAND[state.landStep].size+LAND_MARGIN*2} × ${LAND[state.landStep].size+LAND_MARGIN*2} m</b><span>→</span><b>${next.size+LAND_MARGIN*2} × ${next.size+LAND_MARGIN*2} m</b></div><p>${LAND[state.landStep].size**2} → <b>${next.size**2} canteiros</b><br>Custo: <b>${next.cost} moedas</b> · nível necessário: <b>${next.level}</b></p><button class="production-button" id="confirm-expansion" ${locked||!affordable?'disabled':''}>${locked?'Disponível no nível '+next.level:!affordable?'Junte '+(next.cost+5)+' moedas (inclui 5 de reserva)':'Expandir · '+next.cost+' moedas'}</button>`);
  $('#confirm-expansion').onclick=buyExpansion;
}

function enterExpansionMode(){
  $('#modal').close();expansionMode=true;$('#game').classList.add('expanding');$('#expansion-banner').hidden=false;
  const current=LAND[state.landStep].size+LAND_MARGIN*2,next=LAND[state.landStep+1];
  $('#expansion-dimensions').textContent=next?`${current} × ${current} m → ${next.size+LAND_MARGIN*2} × ${next.size+LAND_MARGIN*2} m`:`${current} × ${current} m · terreno completo`;
  tell(next?'Escolha uma das duas setas da frente para conferir o preço e expandir.':'Você já alcançou o tamanho máximo da fazenda.');
  positionExpansionButtons();
}
function leaveExpansionMode(){
  expansionMode=false;$('#game').classList.remove('expanding');$('#expansion-banner').hidden=true;
  $('#expand-left').hidden=true;$('#expand-right').hidden=true;
}
function drawExpansionPreview(){
  const next=LAND[state.landStep+1];if(!next)return;
  const current=landCorners(),future=landCorners(next.size);
  poly([current.right,future.right,future.front,future.left,current.left,current.front],'#c1e68135');
  ctx.save();ctx.setLineDash([5,4]);line([future.left,future.front,future.right],'#fff2b8',1.5);ctx.restore();
}

function openAchievements(){
  const achievements=[
    {name:'Primeira colheita',description:'Faça sua primeira colheita.',current:state.counts.harvest,target:1},
    {name:'Mãos na terra',description:'Plante 10 vezes.',current:state.counts.plant,target:10},
    {name:'Fazendeiro dedicado',description:'Faça 50 colheitas.',current:state.counts.harvest,target:50},
    {name:'Novos horizontes',description:'Compre a primeira expansão.',current:state.landStep,target:1},
    {name:'Vida no campo',description:'Conquiste seu primeiro galinheiro.',current:state.buildings.coop?1:0,target:1},
    {name:'Fazenda mecanizada',description:'Conquiste seu primeiro trator.',current:state.buildings.tractor?1:0,target:1}
  ];
  const count=achievements.filter(a=>a.current>=a.target).length;
  modal('Conquistas',`<div class="shop-summary">${count} de ${achievements.length} conquistas desbloqueadas</div>`+achievements.map(a=>`<div class="achievement-card ${a.current>=a.target?'unlocked':''}"><span class="achievement-medal">★</span><div><b>${a.name}</b><small>${a.description}<br>${Math.min(a.current,a.target)} / ${a.target}${a.current>=a.target?' · conquistado':''}</small></div></div>`).join(''));
}
function openMachines(){
  leaveExpansionMode();const def=BUILDINGS.tractor,ownedMachine=state.buildings.tractor,locked=level()<def.level;
  modal('Máquinas e tratores',`<div class="empty-state"><svg aria-hidden="true"><use href="#i-helmet"/></svg></div><div class="shop-row"><span class="upgrade-icon">⚙</span><div><b>Trator</b><small>${def.description}</small></div><button id="machine-action" ${!ownedMachine&&locked?'disabled':''}>${ownedMachine?(ownedMachine.stored?'No armazém':'Usar trator'):locked?'Nível '+def.level:def.cost+' moedas'}</button></div><p>${ownedMachine?'Seu trator é seu: você pode usá-lo na fazenda ou guardá-lo no armazém.':'Continue evoluindo para comprar sua primeira máquina.'}</p>`);
  $('#machine-action').onclick=()=>{
    if(ownedMachine){if(ownedMachine.stored)openWarehouse();else openBuilding('tractor');}
    else buyBuilding('tractor','machines');
  };
}
function openGifts(){
  leaveExpansionMode();
  modal('Presentes dos amigos','<div class="empty-state"><svg aria-hidden="true"><use href="#i-gift"/></svg><b>Nenhum presente recebido</b><p>Os presentes enviados pelos seus amigos aparecerão aqui.</p><p>As fazendas dos amigos ainda não estão conectadas nesta versão.</p></div>');
}
function openWarehouse(){
  leaveExpansionMode();const stored=Object.entries(state.buildings).filter(([,b])=>b.stored);
  modal('Armazém',stored.length?`<p>${stored.length} ${stored.length===1?'item guardado':'itens guardados'}. Recoloque seus itens na fazenda sem pagar novamente.</p>`+stored.map(([id,b])=>`<div class="warehouse-row"><svg aria-hidden="true"><use href="#${id==='tractor'?'i-helmet':id==='apple'?'i-seed':'i-warehouse'}"/></svg><div><b>${BUILDINGS[id].name}</b><small>${b.remainingMs!==null&&b.remainingMs!==undefined?'Produção pausada enquanto estiver guardado.':'Pronto para voltar à fazenda.'}</small></div><button data-restore="${id}">Recolocar</button></div>`).join(''):'<div class="empty-state"><svg aria-hidden="true"><use href="#i-warehouse"/></svg><b>Seu armazém está vazio</b><p>Clique em um objeto da fazenda e escolha <b>Guardar no armazém</b>. Ele ficará aqui até você decidir recolocá-lo.</p></div>');
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreBuilding(b.dataset.restore));
}
function storeBuilding(id){
  if(!isPlaced(id))return;const b=state.buildings[id];
  b.remainingMs=b.readyAt===null?null:Math.max(0,b.readyAt-Date.now());b.readyAt=null;b.stored=true;
  save();update();openWarehouse();tell(`${BUILDINGS[id].name} guardado no armazém.`);
}
function restoreBuilding(id){
  const b=state.buildings[id];if(!b?.stored)return;
  b.stored=false;b.readyAt=b.remainingMs===null||b.remainingMs===undefined?null:Date.now()+b.remainingMs;delete b.remainingMs;
  save();update();openWarehouse();tell(`${BUILDINGS[id].name} voltou para a fazenda, sem custo.`);
}
