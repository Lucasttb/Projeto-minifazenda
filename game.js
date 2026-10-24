'use strict';

// All scenery is drawn locally. No external art files or services are required.
const canvas = document.querySelector('#farm');
let ctx = canvas.getContext('2d');
const N = 12, KEY = 'minifazenda-save-v1';
const CROPS = {
  corn: {name:'Milho', cost:5, sale:15, grow:20000, xp:10},
  carrot: {name:'Cenoura', cost:8, sale:24, grow:35000, xp:15},
  strawberry: {name:'Morango', cost:12, sale:38, grow:50000, xp:20}
};
let state = {coins:200, xp:0, plots:Array.from({length:N*N},(_,index)=>{
  const i=Math.floor(index/N),j=index%N;
  if(i>=7&&i<=10&&j>=3&&j<=6){
    const crop=i<9?'corn':j<5?'carrot':'strawberry';
    return {stage:2,crop,watered:Date.now()-CROPS[crop].grow};
  }
  return {stage:0};
})};
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && Number.isFinite(saved.coins) && saved.coins >= 0 && Number.isFinite(saved.xp) && saved.xp >= 0 &&
      Array.isArray(saved.plots) && saved.plots.length === N*N &&
      saved.plots.every(p=>p && [0,1,2].includes(p.stage) && (!p.crop || CROPS[p.crop]) && (p.stage!==2 || Number.isFinite(p.watered)))) state=saved;
} catch { /* A blocked storage API must not prevent playing. */ }
let tool='plant', crop='corn', zoom=1, W=0, H=0, scale=1, tx=0, ty=0;
let pan={x:0,y:0}, hover=null, pointer=null, drag=false, toastTimer;
const floats=[];
const $=selector=>document.querySelector(selector);
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
  $('#money').textContent=state.coins.toLocaleString('pt-BR');
  $('#level').textContent=1+Math.floor(state.xp/100);
  $('#xp').textContent=`${state.xp%100} / 100`;
  $('#xp-fill').style.width=(state.xp%100)+'%';
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  document.querySelectorAll('[data-crop]').forEach(b=>b.classList.toggle('active',b.dataset.crop===crop));
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
function silo(x,y){at(x,y,1,()=>{
  oval(4,1,13,5,'#2d682c60');rect(-9,-61,18,60,gradient(-9,0,9,0,['#869e95','#d0d5bb','#829a91']));
  oval(0,-1,9,4,'#82988b');poly([[-11,-61],[0,-76],[11,-61]],'#9aaba3','#596f68');oval(0,-61,11,4,'#afc0ad');
  for(let i=1;i<8;i++)line([[-8,-i*7],[8,-i*7]],'#6f8b8270',.8);
  line([[5,-63],[5,-2]],'#e1e5ce',1);line([[1,-62],[1,-2]],'#5b776c',1);for(let i=0;i<12;i++)line([[1,-4-i*5],[5,-4-i*5]],'#647d71',1);
});}
function animal(x,y,s=1,type='cow',phase=0){at(x,y,s,()=>{
  oval(2,1,14,5,'#306e2a55');
  const sheep=type==='sheep',pig=type==='pig';
  const hoof=pig?'#aa7772':'#5e5140',body=pig?'#edb4ae':'#f5edcf';
  for(let n=0;n<4;n++){const a=[-9,-4,5,10][n],b=n%2?-1:1;line([[a,-5],[a+Math.sin(phase+n)*.5,b+4]],hoof,2.3);}
  oval(0,-10,14,8,body);
  if(sheep)for(let n=0;n<13;n++)oval(-11+(n%5)*5,-10-Math.floor(n/5)*3,4,4,n%3?'#faf3dc':'#dfdcc2');
  if(type==='cow'){oval(-5,-13,5,4,'#514c3f');oval(5,-7,3,3,'#5f5948');poly([[-9,-13],[-12,-16],[-13,-12]],'#5e5643');}
  oval(13,-13,5,6,pig?'#e7a59e':sheep?'#a19273':'#fff4d6');
  oval(16,-10,4,2.5,pig?'#d78c86':'#ccb894');
  poly([[11,-17],[8,-21],[13,-19]],body,'#a99b77',.5);poly([[16,-17],[19,-20],[19,-16]],body,'#a99b77',.5);
  if(type==='cow'){line([[10,-18],[11,-22]],'#c6bc99',1.4);line([[15,-18],[16,-21]],'#c6bc99',1.4);}
  oval(15,-14,1,1.2,'#3c4336');oval(15,-14.4,.3,.3,'#fff');
  line([[-13,-12],[-17,-17],[-19,-14]],pig?'#d19588':'#7c6b45',1);if(!pig)oval(-19,-14,1,2,'#5c543b');
});}
function chicken(x,y){at(x,y,.8,()=>{oval(0,1,7,3,'#33782a50');line([[-2,-1],[-3,3]],'#d0a233',1);line([[2,-1],[3,3]],'#d0a233',1);oval(0,-5,6,4,'#fff7db');oval(5,-9,3,4,'#fffbe5');poly([[7,-10],[11,-8],[7,-7]],'#e9ae3b');oval(5,-13,2,2,'#c9513d');oval(6,-10,1,1,'#454a35');poly([[-5,-5],[-9,-11],[-8,-4]],'#e7e2bb');});}
function hay(x,y,s=1){at(x,y,s,()=>{poly([[-13,-2],[3,6],[16,-1],[0,-9]],'#c8a53c','#9d8433');poly([[-13,-2],[-13,-12],[3,-5],[3,6]],'#d5b54b');poly([[3,6],[16,-1],[16,-11],[3,-5]],'#b69a32');poly([[-13,-12],[0,-19],[16,-11],[3,-5]],'#efd274','#ba9b37');for(let n=0;n<13;n++){line([[-11+n,-11+n*.5],[-11+n,-2+n*.5]],'#f0d372',.5);line([[-9+n,-13+n*.2],[1+n,-7+n*.1]],'#d3b550',.5);}line([[-5,-16],[-5,2]],'#aa8a35',1);line([[9,-15],[9,2]],'#a48835',1);});}
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
function pond(x,y){at(x,y,1,()=>{
  poly([[-35,0],[-24,-15],[0,-20],[30,-9],[35,6],[13,17],[-13,15]],'#91c65c','#e7e3b5',2);
  poly([[-31,0],[-20,-12],[0,-16],[26,-7],[30,5],[11,13],[-12,11]],gradient(0,-15,0,15,['#249bba','#79d4cd']));
  for(let n=0;n<5;n++)line([[-20+n*7,-4+n%3*4],[-10+n*7,-4+n%3*4]],'#c2f0d57a',1);
  for(let n=0;n<6;n++){const a=-28+n*10,b=n%2?12:-12;line([[a,b],[a-1,b-12]],'#6f9b36',1);line([[a,b],[a+3,b-9]],'#8fb34b',1);}
  oval(9,0,5,2,'#4c9f50');oval(8,-1,2,1,'#a4d377');
});}

// Draw the landscape once; animals, crops and feedback stay on a separate live layer.
let landscape;
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
  // The bright buildable meadow has an isometric boundary, fine grain and tufts.
  poly([[425,124],[983,389],[540,600],[66,373]],'#3eaf35','#73bf3e',1);
  poly([[66,373],[540,600],[540,604],[66,377]],'#328d29');poly([[540,600],[983,389],[983,394],[540,604]],'#2e8b29');
  for(let n=0;n<9500;n++){
    const a=rand(n+1),b=rand(n+14000),x=425+a*540-b*360,y=136+a*255+b*176;
    rect(x,y,n%7===0?1.6:.8,.6,n%3===0?'#79c54b80':n%3===1?'#a2cf5840':'#1e8b3350');
  }
  for(let n=0;n<90;n++){const x=rand(n+713)*1100,y=rand(n+572)*600;if(x<120||x>980||y>575){line([[x,y],[x-2,y-4]],'#66a947',.7);line([[x,y],[x+2,y-6]],'#6cab4a',.7);}}
  // Distant barn, house and garden behind the fields.
  barn(441,167,.91);
  fence([[486,174],[564,211],[614,187]]);
  pond(579,195);palm(633,208,.71);flowers(650,213,'#ed91ae',9);
  for(let n=0;n<5;n++)flowers(660+n*13,216+n*6,n%2?'#efd35a':'#f4c3d3',6);
  // Pasture: rails, water, feed, coop, cottage and silo.
  fence([[722,286],[831,338],[942,286]]);
  poly([[734,298],[843,350],[937,306],[831,255]],'#55b342');
  barn(869,313,.74,true);silo(798,319);
  hay(911,330,.8);hay(927,337,.8);hay(916,321,.8);
  pond(918,362);
  fence([[738,302],[738,362],[850,415],[946,369],[946,309]]);
  // Smaller lower animal enclosure and red coop.
  fence([[680,423],[749,390],[831,430]]);
  poly([[671,430],[749,393],[835,435],[755,474]],'#65b944');
  at(807,436,.61,()=>{barn(0,0);});
  hay(695,454,.8);hay(708,460,.8);
  fence([[671,430],[755,471],[833,434]]);
  tractor(665,458);
  // Decorative flower beds on the near left, inspired by the reference's colored plots.
  const flowerbed=(x,y,colors)=>{
    diamond(x,y,62,29,'#82683d','#7f8c3e');
    for(let i=0;i<8;i++)for(let j=0;j<5;j++){
      const a=x+(i-j)*8-12,b=y+(i+j)*3.7-22;
      diamond(a,b,6.5,3.1,'#5b9837');
      const c=colors[(Math.floor(i/2)+Math.floor(j/2))%colors.length];
      for(let k=0;k<4;k++){const u=a+(k%2?2:-2),v=b+(k>1?1:-1);rect(u,v-3,1,3,'#599339');oval(u,v-4,2.2,1.8,c);rect(u,v-4,.7,.7,'#f4df8a');}
    }
  };
  flowerbed(216,383,['#eebd35','#de5d43','#7b9fcb']);
  flowerbed(320,444,['#f2eee0','#f2eee0','#5c9b42']);
  flowerbed(427,495,['#d76155','#efe8d2','#efe8d2']);
  flowerbed(544,548,['#e7b83c','#6fadd2','#e7b83c']);
  // Front orchard follows the diagonal boundary.
  for(let n=0;n<17;n++){const x=573+n*23,y=584-n*10.8;tree(x,y,.54,n%6===0?'pink':n%4===0?'fruit':'green');}
  for(let n=0;n<4;n++){const x=902+n*23,y=343-n*11;tree(x,y,.57,n%2?'pink':'fruit');}
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
  scale=Math.min(Math.max(W/1030,W<620?.69:0),Math.max(220,H-90)/590)*zoom;
  tx=W/2-540*scale+pan.x;ty=(H-95)/2-330*scale+48+pan.y;
  ctx.save();ctx.translate(tx,ty);ctx.scale(scale,scale);
  ctx.drawImage(landscape,-50,-50,1200,800);
  // Tiles then plants are drawn in diagonal depth order.
  for(let d=0;d<N*2-1;d++)for(let i=0;i<N;i++){const j=d-i;if(j<0||j>=N)continue;const [x,y]=grid(i+.5,j+.5);plotTile(x,y,state.plots[i*N+j],i,j);}
  for(let d=0;d<N*2-1;d++)for(let i=0;i<N;i++){const j=d-i;if(j<0||j>=N)continue;const [x,y]=grid(i+.5,j+.5);cropPlant(x,y,state.plots[i*N+j],i*N+j);}
  avatar(477,330,timestamp);
  for(let n=0;n<7;n++){const x=763+(n%3)*34,y=341+Math.floor(n/3)*19;animal(x+Math.sin(timestamp/2400+n)*1.4,y,.75,n%3===0?'sheep':'cow',timestamp/300+n);}
  // Repaint front rails to put the livestock behind them.
  fence([[738,362],[850,415],[946,369]]);
  for(let n=0;n<4;n++)animal(725+n%2*29,432+Math.floor(n/2)*12,.67,n%2?'sheep':'pig',timestamp/400+n);
  fence([[671,430],[755,471],[833,434]]);
  for(let n=0;n<5;n++)chicken(840+n*15,326+n%2*9);
  // Subtle life in the pond and a butterfly near the flowers.
  const wing=Math.sin(timestamp/120)*2;
  oval(642+Math.sin(timestamp/2200)*8,231+Math.cos(timestamp/1900)*5,3,1+Math.abs(wing),'#f4d66f');
  for(let n=floats.length-1;n>=0;n--){const f=floats[n],age=(performance.now()-f.time)/1400;if(age>1){floats.splice(n,1);continue;}ctx.globalAlpha=1-age;ctx.font='bold 14px Tahoma';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#355329';ctx.strokeText(f.text,f.x,f.y-age*32);ctx.fillStyle='#fff1a4';ctx.fillText(f.text,f.x,f.y-age*32);ctx.globalAlpha=1;}
  ctx.restore();requestAnimationFrame(draw);
}
function resize(){W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=Math.round(W*devicePixelRatio);canvas.height=Math.round(H*devicePixelRatio);}
function tileAt(clientX,clientY){const box=canvas.getBoundingClientRect(),x=(clientX-box.left-tx)/scale-445,y=(clientY-box.top-ty)/scale-180;const i=Math.floor((x/22+y/10.5)/2),j=Math.floor((y/10.5-x/22)/2);return i>=0&&j>=0&&i<N&&j<N?{i,j}:null;}
function inspect(p){if(!p.stage)return 'Terra arada · pronta para plantar';const def=CROPS[p.crop||'corn'];return def.name+' · '+(p.stage===1?'precisa de água':ready(p)?'pronto para colher':`${Math.ceil((def.grow-Date.now()+p.watered)/1000)} s para colher`);}
function act(tile){
  if(!tile)return;
  const {i,j}=tile,index=i*N+j,p=state.plots[index],def=CROPS[crop];
  if(tool==='plant'){
    if(p.stage)return tell(inspect(p));
    if(state.coins<def.cost)return tell(`Você precisa de ${def.cost} moedas. Colha suas plantas maduras para ganhar mais.`);
    state.coins-=def.cost;state.plots[index]={stage:1,crop};tell(`${def.name} plantado! Agora selecione o regador.`);
  }else if(tool==='water'){
    if(!p.stage)return tell('Esse canteiro está vazio. Escolha uma semente e plante primeiro.');
    if(p.stage===2)return tell(inspect(p));
    p.stage=2;p.watered=Date.now();tell(`${CROPS[p.crop||'corn'].name} regado! Fica pronto em ${CROPS[p.crop||'corn'].grow/1000} segundos.`);
  }else if(tool==='harvest'){
    if(!ready(p))return tell(p.stage?inspect(p):'Use a cesta nas plantas que já estiverem maduras.');
    const harvest=CROPS[p.crop||'corn'];state.coins+=harvest.sale;state.xp+=harvest.xp;state.plots[index]={stage:0};
    const [x,y]=grid(i+.5,j+.5);floats.push({x,y:y-15,text:`+${harvest.sale} moedas · +${harvest.xp} XP`,time:performance.now()});tell(`Boa colheita! +${harvest.sale} moedas e +${harvest.xp} XP.`);
  }else return tell(inspect(p));
  save();update();
}
function tooltip(e){const el=$('#tooltip');if(!hover||drag){el.hidden=true;return;}el.textContent=inspect(state.plots[hover.i*N+hover.j]);el.hidden=false;const box=canvas.getBoundingClientRect();el.style.left=Math.max(4,Math.min(W-205,e.clientX-box.left+15))+'px';el.style.top=Math.max(8,e.clientY-box.top-37)+'px';}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};drag=false;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(pointer&&pointer.id===e.pointerId){if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)drag=true;if(drag){pan.x=pointer.panX+e.clientX-pointer.x;pan.y=pointer.panY+e.clientY-pointer.y;canvas.style.cursor='grabbing';}}hover=tileAt(e.clientX,e.clientY);tooltip(e);});
canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(!drag)act(tileAt(e.clientX,e.clientY));pointer=null;drag=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('pointercancel',()=>{pointer=null;drag=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('pointerleave',()=>{hover=null;$('#tooltip').hidden=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(2,zoom+(e.deltaY<0?.08:-.08)));},{passive:false});
function setTool(next){tool=next;update();const hints={plant:`${CROPS[crop].name} selecionado. Clique em um canteiro vazio.`,water:'Clique nas plantas que precisam de água.',harvest:'Clique nas plantas maduras para colher.',info:'Passe o mouse ou clique nos canteiros para ver os detalhes.'};tell(hints[next]);}
function setCrop(next){crop=next;setTool('plant');}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.querySelectorAll('[data-crop]').forEach(b=>b.onclick=()=>setCrop(b.dataset.crop));
$('#save').onclick=()=>tell(save()?'Fazenda salva! Seu progresso fica guardado neste navegador.':'O navegador bloqueou o salvamento. Permita o armazenamento local para guardar sua fazenda.');
$('#in').onclick=()=>zoom=Math.min(2,zoom+.15);$('#out').onclick=()=>zoom=Math.max(.65,zoom-.15);$('#home').onclick=()=>{pan={x:0,y:0};zoom=1;};
function modal(title,body){$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;$('#modal').showModal();}
$('#close-modal').onclick=()=>$('#modal').close();
$('#help').onclick=()=>modal('Bem-vindo ao Recanto do Sol',`<p>Escolha uma semente na barra de baixo e clique em um canteiro vazio. Cada plantio custa algumas moedas.</p><p>Use o <b>regador</b> para iniciar o crescimento. Quando a planta estiver madura, use a <b>cesta</b> para colher e receber moedas e experiência.</p><p>Arraste o cenário para explorar e use + e − para ajustar o zoom. No computador, as teclas <b>1 a 4</b> selecionam as ferramentas.</p><p>O progresso é salvo automaticamente neste navegador. Os animais e prédios ainda são decorativos nesta versão.</p>`);
$('#quest').onclick=()=>modal('Seu primeiro dia na fazenda',`<p>Plante, regue e colha para ganhar experiência. Cada 100 XP sobe um nível.</p><p><b>Nível atual:</b> ${1+Math.floor(state.xp/100)}<br><b>Experiência:</b> ${state.xp} XP<br><b>Plantas na fazenda:</b> ${state.plots.filter(p=>p.stage).length}<br><b>Prontas para colher:</b> ${state.plots.filter(ready).length}</p><p>Experimente as três sementes. Elas têm tempos de crescimento e valores de venda diferentes.</p>`);
$('#shop').onclick=()=>{
  modal('Loja de sementes',Object.entries(CROPS).map(([id,c])=>`<div class="shop-row"><span class="crop-art ${id==='corn'?'corn':id==='carrot'?'carrot':'berry'}-art"><i></i>${id==='corn'?'<i></i><i></i>':''}</span><div><b>${c.name}</b><small>Cresce em ${c.grow/1000} s · venda: ${c.sale} moedas</small></div><button data-buy="${id}">Plantar · ${c.cost}</button></div>`).join('')+'<p>As sementes são cobradas quando você planta no canteiro.</p>');
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{setCrop(b.dataset.buy);$('#modal').close();});
};
window.addEventListener('keydown',e=>{if($('#modal').open||e.ctrlKey||e.metaKey||e.altKey)return;const next={'1':'info','2':'plant','3':'water','4':'harvest'}[e.key];if(next)setTool(next);});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
cacheScenery();resize();update();requestAnimationFrame(draw);toastTimer=setTimeout(()=>$('#message').classList.add('quiet'),6500);
