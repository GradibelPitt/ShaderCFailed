// Scene two: the stair void. A block of landings, flights, bridges, beams and columns built far too large for a person, repeated without end
// in every direction; no colour, no sound. Step off into a gap that goes all the way down and the fall becomes the way out: ten seconds of gathering speed, then the questions,
// and after the last of them the field of the white screen (js/hub.js), where you choose where to go back to.
'use strict';
/* ---------- the stair void ---------- */
// One block of landings, stair flights, bridges, beams and columns, repeated without end in every direction, up and down included.
// Everything is built for something far larger than a person: a level is 16 m, a flight 30 m long, a block 220 m across.
// Position simply wraps: climb forever, walk forever, fall forever, and you are always somewhere in the same block.
const VA=44,VH=16,VNX=5,VNZ=5,VNY=4,VPX=VA*VNX,VPY=VH*VNY,VPZ=VA*VNZ,VPL=7,VRUN=VA-2*VPL,VTH=1.0,VSTEPS=40;
let VD=null;const V={x:0,y:0,z:0,vy:0,on:true,walk:0};
function buildVoid(){
  const A=[],rng=mulberry32(7741),QI=[0,1,2,0,2,3],flights=[],boxes=[],pillars=[];
  const quad=(p,n,w,h,ln,m,us)=>{const ab=[[0,0],[w,0],[w,h],[0,h]],c1=p[0][0]*1.3+p[0][1]*0.7,c2=p[0][2]*1.1+p[0][1]*0.3;
    for(let q=0;q<6;q++){const i=QI[q],v=p[i],a=ab[i][0],b=ab[i][1];A.push(v[0],v[1],v[2],n[0],n[1],n[2],us?us[i]:a+c1,b+c2,ln?a:9,ln?w-a:9,ln?b:9,ln?h-b:9,m||12);}};
  const box=(x0,x1,y0,y1,z0,z1)=>{
    for(const x of [x0,x1])quad([[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0]],[x===x0?-1:1,0,0],z1-z0,y1-y0,1);
    for(const y of [y0,y1])quad([[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],[0,y===y0?-1:1,0],x1-x0,z1-z0,1);
    for(const z of [z0,z1])quad([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],[0,0,z===z0?-1:1],x1-x0,y1-y0,1);};
  // a slab you can stand on (and bump into)
  const slab=(cx,cz,hx,hz,top,th)=>{box(cx-hx,cx+hx,top-th,top,cz-hz,cz+hz);boxes.push({cx,cz,hx,hz,top,th});};
  // landings: 14 m square; some thin plates, some the tops of solid blocks
  for(let k=0;k<VNY;k++)for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){const r=rng();slab(i*VA,j*VA,VPL,VPL,k*VH,r<0.2?9:r<0.5?3:1.4);}
  // every landing sends at least one flight up to a neighbour. One flight per side of a landing, never two crossing in one gap.
  const used=new Set(),dirs=[[1,0],[-1,0],[0,1],[0,-1]],widths=[1.5,2.2,2.2,3.2,3.2,5,6.5];
  for(let k=0;k<VNY;k++)for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){
    const want=1+(rng()<0.34?1:0),o=dirs.slice();for(let a=3;a>0;a--){const b=(rng()*(a+1))|0,t=o[a];o[a]=o[b];o[b]=t;}
    let got=0;for(const d of o){if(got>=want)break;const ni=(i+d[0]+VNX)%VNX,nj=(j+d[1]+VNZ)%VNZ,k1=(k+1)%VNY,e0=i+'_'+j+'_'+k+'_'+d[0]+'_'+d[1],e1=ni+'_'+nj+'_'+k1+'_'+(-d[0])+'_'+(-d[1]);
      const c0=j*VNX+i,c1=nj*VNX+ni,gk=Math.min(c0,c1)+'g'+Math.max(c0,c1)+'g'+k;
      if(used.has(e0)||used.has(e1)||used.has(gk))continue;used.add(e0);used.add(e1);used.add(gk);got++;
      flights.push({ax:i*VA,az:j*VA,y0:k*VH,dx:d[0],dz:d[1],inv:rng()<0.27,w:widths[(rng()*widths.length)|0]});}}
  // level bridges across gaps whose two landing sides are still free
  for(let k=0;k<VNY;k++)for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++)for(const d of [[1,0],[0,1]]){
    const ni=(i+d[0])%VNX,nj=(j+d[1])%VNZ,e0=i+'_'+j+'_'+k+'_'+d[0]+'_'+d[1],e1=ni+'_'+nj+'_'+k+'_'+(-d[0])+'_'+(-d[1]);
    if(used.has(e0)||used.has(e1)||rng()>0.3)continue;used.add(e0);used.add(e1);const w=rng()<0.3?4:1.6;
    slab(i*VA+d[0]*VA/2,j*VA+d[1]*VA/2,d[0]?VRUN/2:w,d[1]?VRUN/2:w,k*VH,1.2);}
  // columns run the whole height of the block, so stacked they have no top and no bottom; beams tie neighbours together
  const hasP=[];for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){const on=rng()<0.55,h=rng()<0.3?4.5:2.6;hasP.push(on?h:0);if(!on)continue;
    const px=(i+0.5)*VA,pz=(j+0.5)*VA;pillars.push([px,pz,h]);box(px-h,px+h,0,VPY,pz-h,pz+h);}
  for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){if(!hasP[j*VNX+i])continue;const px=(i+0.5)*VA,pz=(j+0.5)*VA;
    for(const d of [[1,0],[0,1]]){if(!hasP[((j+d[1])%VNZ)*VNX+(i+d[0])%VNX])continue;
      for(let k=0;k<VNY;k++){if(rng()>0.7)continue;slab(px+d[0]*VA/2,pz+d[1]*VA/2,d[0]?VA/2:1.6,d[1]?VA/2:1.6,k*VH+13,2.2);}}}
  // colonnades: some landings stand on four thin legs that reach down to the landing below
  for(let k=0;k<VNY;k++)for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){if(rng()>0.4)continue;
    for(const u of [-1,1])for(const w of [-1,1])slab(i*VA+u*(VPL-0.9),j*VA+w*(VPL-0.9),0.55,0.55,k*VH-1.4,VH-1.4);}
  const nCommon=A.length/13;
  const s0=VPL,s1=VA-VPL,r=VH/VSTEPS,run=VRUN/VSTEPS;
  const flight=(f,detail)=>{const ym=f.y0+VH/2,dx=f.dx,dz=f.dz,y0=f.y0,W=f.w;
    // "inv" flights are the same stair turned over: a smooth ramp on top, the steps hanging underneath
    const pt=(s,y,l)=>{if(f.inv){s=s0+s1-s;y=2*ym-y-VTH;}return [f.ax+dx*s-dz*l,y,f.az+dz*s+dx*l];};
    const nv=(ns,ny)=>f.inv?[-dx*ns,-ny,-dz*ns]:[dx*ns,ny,dz*ns],under=s=>y0+(s-s0)/VRUN*VH-VTH;
    if(detail)for(let i=0;i<VSTEPS;i++){const sa=s0+i*run,sb=sa+run,yt=y0+(i+1)*r;
      quad([pt(sa,yt,-W),pt(sb,yt,-W),pt(sb,yt,W),pt(sa,yt,W)],nv(0,1),run,2*W,1);
      quad([pt(sa,yt-r,-W),pt(sa,yt,-W),pt(sa,yt,W),pt(sa,yt-r,W)],nv(-1,0),r,2*W,1);
      for(const L of [-W,W])quad([pt(sa,under(sa),L),pt(sb,under(sb),L),pt(sb,yt,L),pt(sa,yt,L)],[-dz*Math.sign(L),0,dx*Math.sign(L)],run,r+VTH,0);}
    else{const t0=y0+r/2,t1=y0+VH+r/2;
      quad([pt(s0,t0,-W),pt(s1,t1,-W),pt(s1,t1,W),pt(s0,t0,W)],nv(0,1),Math.hypot(VRUN,VH),2*W,1,13,[0,VRUN,VRUN,0]);
      for(const L of [-W,W])quad([pt(s0,y0-VTH,L),pt(s1,y0+VH-VTH,L),pt(s1,t1,L),pt(s0,t0,L)],[-dz*Math.sign(L),0,dx*Math.sign(L)],VRUN,VTH+r/2,0);}
    quad([pt(s0,y0-VTH,-W),pt(s1,y0+VH-VTH,-W),pt(s1,y0+VH-VTH,W),pt(s0,y0-VTH,W)],nv(0,-1),Math.hypot(VRUN,VH),2*W,1);};
  for(const f of flights)flight(f,false);const nLod=A.length/13-nCommon;
  for(const f of flights)flight(f,true);const nDet=A.length/13-nCommon-nLod;
  const data=new Float32Array(A),vao=gl.createVertexArray(),buf=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  const st=13*4,at=[[0,3,0],[1,3,12],[2,2,24],[3,4,32],[4,1,48]];for(const a of at){gl.enableVertexAttribArray(a[0]);gl.vertexAttribPointer(a[0],a[1],gl.FLOAT,false,st,a[2]);}
  gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  return {vao,nCommon,nLod,nDet,flights,boxes,pillars};
}
const wd=(d,p)=>d-p*Math.round(d/p);
function vFlight(f,x,z,m){const rx=wd(x-f.ax,VPX),rz=wd(z-f.az,VPZ),s=rx*f.dx+rz*f.dz,l=-rx*f.dz+rz*f.dx;
  if(s<VPL-0.05||s>VA-VPL+0.05||Math.abs(l)>f.w+m)return null;
  const t=clamp((s-VPL)/VRUN,0,1);return Math.min(f.y0+VH,f.y0+t*VH+(f.inv?0:0.2));}
// the highest thing to stand on that is no more than a step above the feet
function vGround(x,z,y){const lim=y+0.45;let best=-1e9;
  for(const b of VD.boxes){if(Math.abs(wd(x-b.cx,VPX))>b.hx+0.1||Math.abs(wd(z-b.cz,VPZ))>b.hz+0.1)continue;const h=b.top+VPY*Math.floor((lim-b.top)/VPY);if(h>best)best=h;}
  for(const f of VD.flights){const h0=vFlight(f,x,z,0.1);if(h0===null)continue;const h=h0+VPY*Math.floor((lim-h0)/VPY);if(h>best)best=h;}
  return best;}
// is there concrete between knee and head here?
function vBlocked(x,z,y){const lo=y+0.45,hi=y+1.5;
  for(const b of VD.boxes){if(Math.abs(wd(x-b.cx,VPX))>b.hx+0.22||Math.abs(wd(z-b.cz,VPZ))>b.hz+0.22)continue;if(b.top+VPY*Math.ceil((lo-b.top)/VPY)-b.th<hi)return true;}
  for(const f of VD.flights){const h0=vFlight(f,x,z,0.22);if(h0===null)continue;if(h0+VPY*Math.ceil((lo-h0)/VPY)-VTH-0.6<hi)return true;}
  for(const q of VD.pillars)if(Math.abs(wd(x-q[0],VPX))<q[2]+0.25&&Math.abs(wd(z-q[1],VPZ))<q[2]+0.25)return true;
  return false;}
// Step off into a gap that goes all the way down and the fall gathers speed for ten seconds; then the questions start.
// The answers change nothing. By the end they are not even words.
const QS=[
  {q:'Have you ever wondered why you exist?',a:'yes',b:'no'},
  {q:'Do you want to stay here?',a:'yes',b:'no'},
  {q:'When was the last time you got lost inside your own home?',a:'yes',b:'no'},
  {q:'How many doors were there when you came in?',a:'yes',b:'no'},
  {q:'Is the one reading this the same one who started?',a:'yes',b:'no'},
  {q:'Which of your memories did you make up?',a:'yes',b:'yes'},
  {q:'Who taught you to count the stairs?',a:'no',b:'no'},
  {q:'Are you still falling?',a:'yes',b:'no',go:0.35},
  {q:'What is standing behind you right now?',a:'yes',b:'no',go:0.7,gq:0.04},
  {q:'Did you answer the first question honestly?',a:'yes',b:'no',go:1,gq:0.12},
  {q:'How long have you been the one answering?',a:'yes',b:'no',go:1,gq:0.3},
  {q:'Have you ever wondered why you exist?',a:'yes',b:'no',go:1,gq:0.6}
];
const GLY='█▓▒░#@%&?/|<>¿ø§ʞʎ∆¤≠';
const Qs={i:-1,t0:0,pick:-1,pt:0,tick:0,last:''};
function garble(str,f){if(!f)return str;let o='';for(const ch of str)o+=(ch!==' '&&Math.random()<f)?GLY[(Math.random()*GLY.length)|0]:ch;
  if(f>=1){const n=2+((Math.random()*5)|0);o='';for(let i=0;i<n;i++)o+=GLY[(Math.random()*GLY.length)|0];}return o;}
// A question is simply there, whole, in plain pixel type: no writing-out, no fading in. Answer and the next one is there.
const Q_GUARD=0.12,Q_PICK=0.14; // a breath before an answer counts (one click cannot answer two questions), and how long the chosen answer stays lit
function qShow(force){
  const Q=QS[Qs.i],live=Q.gq||Q.go,key=Qs.pick+'|'+(live?Qs.tick:0);
  if(key===Qs.last&&!force)return;Qs.last=key;
  $('qt').textContent=garble(Q.q,Q.gq||0);
  const A=$('qa'),B=$('qb');A.textContent=garble(Q.a,Q.go||0);B.textContent=garble(Q.b,Q.go||0);
  A.className=Qs.pick===0?'pick':Qs.pick===1?'gone':'';B.className=Qs.pick===1?'pick':Qs.pick===0?'gone':'';
}
function qNext(){Qs.i++;if(Qs.i>=QS.length){endVoid();return;}Qs.t0=G.clock;Qs.pick=-1;Qs.last='';$('q').hidden=false;canvas.style.cursor='default';qShow(true);}
function answer(i){if(G.mode!=='void'||Qs.i<0||Qs.pick>=0)return;if(G.clock-Qs.t0<Q_GUARD)return;Qs.pick=i;Qs.pt=G.clock;qShow(true);}
function qUpdate(){if(Qs.i<0)return;Qs.tick=Math.floor(G.clock*11);qShow(false);if(Qs.pick>=0&&G.clock-Qs.pt>Q_PICK)qNext();}
function endVoid(){$('q').hidden=true;canvas.style.cursor='';Qs.i=-1;G.mode='end';G.endT=0;}
function enterVoid(){
  SCF_SAVE.set('scene','level2');
  if(!VD)VD=buildVoid();
  G.mode='void';G.climb=false;flip=null;xing=null;keys.clear();say('');
  G.fade=0;G.flashA=0;G.shock=0;G.pix=0;G.dark=0;G.hold=0;G.fovAdd=0;G.hint=0;
  V.x=0;V.z=0;V.y=0;V.vy=0;V.on=true;V.walk=0;V.air=0;G.plunge=false;G.pt=0;G.fall=0;Qs.i=-1;$('q').hidden=true;canvas.style.cursor='';P.g=1;P.vx=P.vz=P.av=0;P.small=!!SCF_SAVE.get('small');P.size=P.small?0.28:1;P.pitch=clamp(P.pitch,-0.6,0.6);
  if(Snd.ctx)Snd.silence();else Snd.mute=true;
}
// Falling here is ordinary falling: you keep your eyes and your say in where you go, and whatever is under you catches you.
// Only a fall that finds nothing under it (a gap that goes all the way down, through every level) keeps gathering speed.
// Ten seconds of that, and the questions start.
const FALL_AFTER=1.5,FALL_T=10,FALL_V=95;
// is there nothing at all under this spot, on any level?
function vClear(x,z){const m=0.4;
  for(const b of VD.boxes)if(Math.abs(wd(x-b.cx,VPX))<=b.hx+m&&Math.abs(wd(z-b.cz,VPZ))<=b.hz+m)return false;
  for(const f of VD.flights)if(vFlight(f,x,z,m)!==null)return false;
  for(const q of VD.pillars)if(Math.abs(wd(x-q[0],VPX))<=q[2]+m&&Math.abs(wd(z-q[1],VPZ))<=q[2]+m)return false;
  return true;}
function updateVoid(dt){
  if(Snd.ctx&&!Snd.mute)Snd.silence();
  const asking=Qs.i>=0; // once the questions have started there is nothing left to do but fall
  const crouch=!asking&&(keys.has('KeyC')||G.tCrouch);P.cr+=((crouch?1:0)-P.cr)*(1-Math.exp(-dt*14));
  let turn=asking?0:(keys.has('ArrowRight')||(!locked&&keys.has('KeyD'))?1:0)-(keys.has('ArrowLeft')||(!locked&&keys.has('KeyA'))?1:0);if(!asking&&joy.id>=0)turn+=joy.x*0.9;
  P.av+=(turn*2.4-P.av)*(1-Math.exp(-dt*24));P.yaw-=P.av*dt;
  // on your feet you walk; in the air, however long the fall, you can still steer
  const v0=asking?[0,0]:wish(),k=1-Math.exp(-dt*(asking?8:V.on?20:4));P.vx+=(v0[0]-P.vx)*k;P.vz+=(v0[1]-P.vz)*k;
  const n=Math.max(1,Math.ceil(Math.hypot(P.vx,P.vz)*dt/0.1));
  for(let i=0;i<n;i++){const nx=V.x+P.vx*dt/n,nz=V.z+P.vz*dt/n;
    if(!vBlocked(nx,V.z,V.y))V.x=nx;else P.vx=0;if(!vBlocked(V.x,nz,V.y))V.z=nz;else P.vz=0;}
  const g=asking?-1e9:vGround(V.x,V.z,V.y);
  if(V.on&&V.vy<=0&&V.y-g<0.5){V.y=g;V.vy=0;} // stay glued going down a flight
  else{
    if(G.plunge){G.pt+=dt;const q=clamp(G.pt/FALL_T,0,1);V.vy=-(G.pv0+(FALL_V-G.pv0)*q*q);} // a long fall: slowly at first, then faster and faster
    else V.vy=Math.max(-32,V.vy-GRAV*dt);
    const ny=V.y+V.vy*dt;
    if(V.vy<=0&&ny<=g){ // something was under you after all
      if(G.plunge)G.shock=Math.max(G.shock,clamp(-V.vy/70,0.2,0.9));
      V.y=g;V.vy=0;V.on=true;G.plunge=false;G.pt=0;}
    else{V.y=ny;V.on=false;}}
  if(G.jb>0){G.jb-=dt;if(V.on&&P.cr<0.5){V.vy=Math.sqrt(2*GRAV*JUMP_H);V.on=false;G.jb=0;}}
  V.x-=VPX*Math.floor(V.x/VPX);V.z-=VPZ*Math.floor(V.z/VPZ);V.y-=VPY*Math.floor(V.y/VPY);
  V.air=V.on?0:V.air+dt;
  if(!G.plunge&&V.air>FALL_AFTER&&V.vy<0){G.plunge=true;G.pt=0;G.pv0=-V.vy;} // a real fall, not a hop
  // the longer the fall, the less there is to see: the picture smears and dims, and the view pulls wide. Land, and it comes back.
  const f=G.plunge?clamp(G.pt/FALL_T,0,1):0;G.fall+=(f-G.fall)*(1-Math.exp(-dt*(f>G.fall?6:2.5)));if(G.fall<0.002)G.fall=0;
  G.fovAdd=0.46*G.fall*G.fall;G.shock=Math.max(G.shock*Math.exp(-dt*2.2),0.2*f);if(G.shock<0.004)G.shock=0;
  if(G.plunge&&G.pt>=FALL_T&&!asking&&vClear(V.x,V.z)){if(document.exitPointerLock&&locked)document.exitPointerLock();keys.clear();P.vx=P.vz=0;qNext();}
  qUpdate();
}
function drawVoid(C,VP,time){
  const m=progMain,lw=FB.lw,lh=FB.lh;gl.useProgram(m.p);
  gl.uniformMatrix4fv(m.u.uVP,false,VP);gl.uniform3fv(m.u.uCam,C.eye);gl.uniform1f(m.u.uTime,time%1000);gl.uniform1f(m.u.uG,1);gl.uniform1f(m.u.uSeed,0);
  gl.uniform2f(m.u.uMaze,1,1);gl.uniform3fv(m.u.uFwd,C.F);gl.uniform1f(m.u.uWorld,0);gl.uniform1i(m.u.uPass,0);gl.uniform2f(m.u.uRes,lw,lh);
  gl.uniform1f(m.u.uHold,0);gl.uniform1f(m.u.uNoFog,0);gl.uniform1f(m.u.uOpK,0);gl.uniform1f(m.u.uSink,0);gl.uniform1f(m.u.uBright,0);gl.uniform1f(m.u.uWH,WH);
  bindTex(0,lightTex[0],m.u.uLight);bindTex(1,lightTex[0],m.u.uPrev);bindTex(2,lightTex[0],m.u.uPrevD);
  gl.bindVertexArray(VD.vao);const mm=new Float32Array(IDENT),rad=0.5*Math.hypot(VPX,VPY,VPZ);
  for(let b=-6;b<=6;b++)for(let c=-2;c<=2;c++)for(let a=-2;a<=2;a++){
    const ox=a*VPX,oy=b*VPY,oz=c*VPZ,cx=ox+VPX/2-VA/2-C.eye[0],cy=oy+VPY/2-C.eye[1],cz=oz+VPZ/2-VA/2-C.eye[2];
    if(cx*C.F[0]+cy*C.F[1]+cz*C.F[2]<-rad)continue; // wholly behind the eye
    const ex=Math.max(0,Math.abs(cx)-VPX/2),ey=Math.max(0,Math.abs(cy)-VPY/2),ez=Math.max(0,Math.abs(cz)-VPZ/2),d2=ex*ex+ey*ey+ez*ez;if(d2>440*440)continue; // lost in the haze anyway
    mm[12]=ox;mm[13]=oy;mm[14]=oz;gl.uniformMatrix4fv(m.u.uModel,false,mm);gl.drawArrays(gl.TRIANGLES,0,VD.nCommon);
    if(d2<60*60)gl.drawArrays(gl.TRIANGLES,VD.nCommon+VD.nLod,VD.nDet);else gl.drawArrays(gl.TRIANGLES,VD.nCommon,VD.nLod);}
  gl.bindVertexArray(vao);
}
/* ---------- what the engine asks of this scene ---------- */
function cameraVoid(){const fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),cp=Math.cos(P.pitch),sp=Math.sin(P.pitch);
  return {eye:[V.x,V.y+eyeH(),V.z],F:[fx*cp,sp,fz*cp],U:[-fx*sp,cp,-fz*sp],g:1};}
// The whole scene, left in FB.s2 for the engine to develop.
function sceneVoid(C,VP,time){
  gl.bindFramebuffer(gl.FRAMEBUFFER,FB.s2.fb);gl.viewport(0,0,FB.lw,FB.lh);gl.clearColor(0.085,0.085,0.085,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawVoid(C,VP,time);gl.disable(gl.DEPTH_TEST);
}
function tickVoid(dt){
  if(G.mode==='end'){ // nothing. Then daylight: the field of the white screen (js/hub.js).
    G.endT+=dt;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
    if(G.endT>4)enterHub();
    return false;}
  updateVoid(dt);return true;
}
/* ---------- the page furniture this scene needs: the layer the questions are shown on ---------- */
document.body.insertAdjacentHTML('beforeend','<div id="q" hidden><p id="qt" aria-live="polite"></p><div id="qo"><button id="qa" type="button"></button><button id="qb" type="button"></button></div></div>');
