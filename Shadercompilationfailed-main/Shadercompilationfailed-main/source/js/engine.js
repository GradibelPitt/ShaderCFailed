// The shared engine: small maths, WebGL set-up, the post-processing chain ("developing the photograph"), sound, input and the frame loop.
// It knows nothing about any one scene. Each scene file supplies three functions and the engine calls whichever is live:
//   level1.js  tickMaze(dt)  cameraMaze()  sceneMaze(C,VP,fovy,asp,time)
//   level2.js  tickVoid(dt)  cameraVoid()  sceneVoid(C,VP,time)
//   hub.js     tickHub(dt)   cameraHub()   sceneHub(C,VP,fovy,asp,time)
// All files are plain scripts sharing one global scope, loaded in the order shaders, engine, level1, level2, hub, main.
'use strict';
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DX=[0,1,0,-1],DY=[-1,0,1,0];
const EYE=1.15,PI=Math.PI;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ease=t=>t*t*(3-2*t);
const reducedMotion=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- small math ---------- */
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function rot(v,a,ang){const c=Math.cos(ang),s=Math.sin(ang),k=cross(a,v),d=dot(a,v)*(1-c);return [v[0]*c+k[0]*s+a[0]*d,v[1]*c+k[1]*s+a[1]*d,v[2]*c+k[2]*s+a[2]*d];}
function persp(fovy,asp,n,f){const q=1/Math.tan(fovy/2),o=new Float32Array(16);o[0]=q/asp;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function lookDir(e,f,u){const r=cross(f,u);return new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,e),-dot(u,e),dot(f,e),1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
const IDENT=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function modelRY(tx,ty,tz,th){const c=Math.cos(th),s=Math.sin(th);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,tx,ty,tz,1]);}
function modelOrb(tx,ty,tz,th,sc){const c=Math.cos(th),s=Math.sin(th),tc=Math.cos(0.4),ts=Math.sin(0.4);
  return new Float32Array([tc*c*sc,ts*c*sc,-s*sc,0,-ts*sc,tc*sc,0,0,tc*s*sc,ts*s*sc,c*sc,0,tx,ty,tz,1]);}
/* ---------- WebGL ---------- */
const canvas=$('gl');
// desynchronized: lets the browser hand frames to the screen without waiting a compositor frame (lower input-to-photon latency)
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance',desynchronized:true});
function compile(vs,fs){
  const mk=(ty,src)=>{const s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(p));
  const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm);}
  return {p,u};
}
let progMain,progSky,progMerge,progBright,progKuw,progBlur,progPost,vao,vbo,vaoSky,lightTex=[],FB=null;
function initGL(){
  if(!gl)return false;
  try{progMain=compile(VS_MAIN,FS_MAIN);progSky=compile(VS_SKY,FS_SKY);progMerge=compile(VS_QUAD,FS_MERGE);progBright=compile(VS_QUAD,FS_BRIGHT);progKuw=compile(VS_QUAD,FS_KUW);progBlur=compile(VS_QUAD,FS_BLUR);progPost=compile(VS_QUAD,FS_POST);}
  catch(e){console.error(e);return false;}
  vao=gl.createVertexArray();vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  const st=13*4;
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,st,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,st,12);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,st,24);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,st,32);
  gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,1,gl.FLOAT,false,st,48);
  vaoSky=gl.createVertexArray();
  for(let i=0;i<2;i++){lightTex[i]=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,lightTex[i]);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
  gl.disable(gl.CULL_FACE);
  return true;
}
function mkFBO(w,h,depth){
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  let rb=null,dtex=null;
  if(depth==='rb'){rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}
  else if(depth==='tex'){dtex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,dtex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,dtex,0);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return {fb,tex,rb,dtex,w,h};
}
function freeFBO(f){gl.deleteFramebuffer(f.fb);gl.deleteTexture(f.tex);if(f.rb)gl.deleteRenderbuffer(f.rb);if(f.dtex)gl.deleteTexture(f.dtex);}
// The scene is drawn smaller than the screen and then enlarged, for a soft photographic look.
function setupTargets(lw,lh){
  if(FB){freeFBO(FB.s1);freeFBO(FB.s2);FB.bl.forEach(freeFBO);}
  const bw=Math.max(8,lw>>2),bh=Math.max(8,lh>>2);
  FB={s1:mkFBO(lw,lh,'tex'),s2:mkFBO(lw,lh,'rb'),bl:[mkFBO(bw,bh),mkFBO(bw,bh)],lw,lh,bw,bh};
}

/* ---------- state shared by both scenes ---------- */
const G={mode:'play',sink:0,fall:0,told:false,li:0,seed:1,time:0,orbs:[],props:[],sockets:[],mdoors:[],mdH:[],mdV:[],door:0,doorOpen:false,D:null,clock:0,fade:1,
  push:0,pushW:0,pushS:0,cool:0,coolS:0,print:1,mood:null,got:0,hint:0,tCrouch:false,jb:0,coyote:0};
// jy/vy: height above the current floor and speed along "up" (whichever way up is right now)
const P={x:0,z:0,yaw:0,pitch:0,g:1,w:0,vx:0,vz:0,av:0,bob:0,amp:0,size:1,small:false,cr:0,jy:0,vy:0};
const GRAV=20,JUMP_H=0.9;
const grounded=()=>P.vy===0&&G.coyote>0;
const afoot=()=>G.mode==='play'||G.mode==='void'||G.mode==='hub'; // the scenes you walk and look around in
function jump(){if(afoot())G.jb=0.14;} // buffered: a press just before landing still counts
const keys=new Set();
let locked=false,drag=null;
const joy={id:-1,ox:0,oy:0,x:0,y:0},lookT={id:-1,x:0,y:0};
const eyeH=()=>(EYE-0.45*P.cr)*P.size;

function wish(){ // where the keys want to go, in world units per second
  const kA=keys.has('KeyA'),kD=keys.has('KeyD');
  let fwd=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),str=locked?(kD?1:0)-(kA?1:0):0;
  if(joy.id>=0)fwd-=joy.y;
  const mag=Math.hypot(fwd,str);if(mag>1){fwd/=mag;str/=mag;}
  const sp=((keys.has('ShiftLeft')||keys.has('ShiftRight'))?4.6:3.0)*(0.4+0.6*P.size)*(1-0.4*P.cr);
  const fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),rx=-Math.cos(P.yaw)*P.g,rz=Math.sin(P.yaw)*P.g;
  return [(fx*fwd+rx*str)*sp,(fz*fwd+rz*str)*sp];
}

/* ---------- sound ---------- */
const Snd={ctx:null,master:null,echo:null,timer:0,
  init(){
    if(this.ctx)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const c=this.ctx=new AC();this.master=c.createGain();this.master.gain.value=this.mute?0:0.9;this.master.connect(c.destination);
      const dl=c.createDelay(1),fb=c.createGain(),lp=c.createBiquadFilter();dl.delayTime.value=0.43;fb.gain.value=0.42;lp.type='lowpass';lp.frequency.value=2200;
      dl.connect(lp);lp.connect(fb);fb.connect(dl);dl.connect(this.master);this.echo=dl;
      const pad=c.createGain();pad.gain.value=this.mute?0:0.05;this.pad=pad;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=420;pad.connect(f);f.connect(this.master); // (silenced before the sound had even started, e.g. straight down into the pool: it starts silent)
      [98,146.83,196.6,233.08,293.9].forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain(),l=c.createOscillator(),lg=c.createGain();
        o.type=i%2?'triangle':'sine';o.frequency.value=hz;g.gain.value=0.5;l.frequency.value=0.05+i*0.027;lg.gain.value=0.45;l.connect(lg);lg.connect(g.gain);o.connect(g);g.connect(pad);o.start();l.start();});
      const bell=()=>{if(this.ctx&&this.ctx.state==='running'&&!this.mute){const sc=[440,493.88,554.37,659.25,739.99,880,987.77];
        this.tone(sc[(Math.random()*sc.length)|0]*(Math.random()<0.3?0.5:1),2.2,'sine',0.035,0,true);}this.timer=setTimeout(bell,2600+Math.random()*4200);};
      this.timer=setTimeout(bell,1500);
    }catch(e){this.ctx=null;}
  },
  resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});},
  tone(hz,dur,type,vol,delay,echo,slide){
    const c=this.ctx;if(!c)return;const t0=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(hz,t0);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t0+dur);
    g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g);g.connect(this.master);if(echo&&this.echo)g.connect(this.echo);o.start(t0);o.stop(t0+dur+0.05);
  },
  noise(dur,hz,q,vol,slide){
    const c=this.ctx;if(!c)return;const n=Math.floor(c.sampleRate*dur),buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t0=c.currentTime;s.buffer=buf;f.type='bandpass';f.Q.value=q;
    f.frequency.setValueAtTime(hz,t0);if(slide)f.frequency.exponentialRampToValueAtTime(slide,t0+dur);
    g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+Math.min(0.02,dur*0.3));g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(f);f.connect(g);g.connect(this.master);s.start();
  },
  step(alt){this.noise(0.07,alt?620:480,1.4,0.085);},
  orb(){this.tone(880,0.6,'sine',0.16,0,true);this.tone(1318.5,0.8,'sine',0.12,0.09,true);this.tone(1760,1.1,'triangle',0.06,0.19,true);},
  flip(){this.tone(150,1.2,'sine',0.13,0,false,620);this.noise(1.2,300,0.8,0.05,2400);},
  land(){this.noise(0.12,240,1.0,0.12);},
  door(){this.tone(92,1.5,'sawtooth',0.035,0,false,128);[523.25,659.25,783.99,1046.5].forEach((hz,i)=>this.tone(hz,1.6,'sine',0.085,0.25+i*0.12,true));},
  win(){[523.25,659.25,783.99,987.77,1318.5].forEach((hz,i)=>this.tone(hz,1.4,'triangle',0.09,i*0.11,true));},
  shrink(down){this.tone(down?720:240,0.9,'sine',0.10,0,true,down?240:720);this.tone(down?1080:360,0.9,'triangle',0.04,0.03,true,down?360:1080);},
  creak(){this.tone(310,0.35,'sawtooth',0.03,0,false,180);this.noise(0.18,900,2.0,0.05);},
  thud(){this.noise(0.10,160,1.2,0.14);},
  pass(){this.noise(0.9,500,0.7,0.07,2600);this.tone(392,1.2,'sine',0.07,0.05,true,523.25);},
  // reaching for the moon: a rising inhale, then the hit, then the ringing in your ears
  reach(){this.noise(0.8,200,0.7,0.12,7000);this.tone(110,0.8,'sine',0.08,0,false,880);this.tone(55,0.8,'sawtooth',0.03,0,false,220);},
  boom(){this.tone(72,2.6,'sine',0.55,0,true,22);this.noise(1.4,130,0.5,0.4,38);this.noise(0.3,2600,0.6,0.22);
    this.tone(3100,3.8,'sine',0.045,0.05);this.tone(4180,3.2,'sine',0.022,0.12);this.tone(146.8,3,'triangle',0.08,0.1,true,73.4);},
  crack(){for(let i=0;i<26;i++)setTimeout(()=>{this.noise(0.05+Math.random()*0.08,2500+Math.random()*5000,4,0.05+Math.random()*0.09);if(i%5===0)this.tone(1800+Math.random()*2400,0.5,'sine',0.03,0,true);},i*i*9+Math.random()*120);},
  voice(f0,f1,dur,vol,delay){const c=this.ctx;if(!c)return;const t0=c.currentTime+delay,o=c.createOscillator(),lf=c.createOscillator(),lg=c.createGain(),b1=c.createBiquadFilter(),b2=c.createBiquadFilter(),g=c.createGain(),dry=c.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(f1,t0+dur);
    lf.frequency.value=5.2+Math.random();lg.gain.value=f0*0.035;lf.connect(lg);lg.connect(o.frequency);
    b1.type=b2.type='bandpass';b1.frequency.value=820;b1.Q.value=5;b2.frequency.value=1220;b2.Q.value=7;
    g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(vol,0.0002),t0+dur*0.3);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(b1);o.connect(b2);b1.connect(g);b2.connect(g);dry.gain.value=0.35;g.connect(dry);dry.connect(this.master);if(this.echo)g.connect(this.echo);
    o.start(t0);lf.start(t0);o.stop(t0+dur+0.05);lf.stop(t0+dur+0.05);},
  // someone crying, somewhere: a few caught breaths, then one long falling wail
  sob(v){if(!this.ctx)return;const f0=300+Math.random()*130,n=2+((Math.random()*3)|0);let t=0;
    for(let i=0;i<n;i++){const d=0.2+Math.random()*0.2;this.voice(f0*(1+0.07*i),f0*0.8,d,v*0.3,t);t+=d+0.1+Math.random()*0.16;}
    this.voice(f0*1.15,f0*0.66,1.6+Math.random()*1.2,v*0.36,t+0.1);},
  // the stair void: no sound at all
  silence(){this.mute=true;this.droneOff();if(this.pad)this.pad.gain.setTargetAtTime(0,this.ctx.currentTime,0.05);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,0.03);},
  clack(alt){this.noise(0.035,alt?2500:2100,3.5,0.3);this.tone(alt?1500:1300,0.06,'triangle',0.09,0,true,620);this.noise(0.02,5200,2,0.1);},
  grind(){this.noise(5.2,150,1.6,0.09,80);this.tone(46,5.2,'sawtooth',0.05,0,false,36);
    for(let i=0;i<7;i++)this.tone(170+Math.random()*60,0.22,'square',0.018,0.4+i*0.7);},
  heart(v){this.tone(54,0.2,'sine',0.35*v+0.1,0);this.tone(48,0.18,'sine',0.26*v+0.08,0.2);},
  droneOn(){if(!this.ctx||this.dr)return;const c=this.ctx,g=c.createGain(),f=c.createBiquadFilter();g.gain.value=0;f.type='lowpass';f.frequency.value=260;
    const o1=c.createOscillator(),o2=c.createOscillator();o1.type=o2.type='sawtooth';o1.frequency.value=36.7;o2.frequency.value=37.4;
    o1.connect(f);o2.connect(f);f.connect(g);g.connect(this.master);if(this.echo)g.connect(this.echo);o1.start();o2.start();this.dr={g,f,o1,o2};},
  drone(v,p){if(!this.dr)return;const t=this.ctx.currentTime;this.dr.g.gain.setTargetAtTime(v,t,0.4);this.dr.f.frequency.setTargetAtTime(220+p*1100,t,0.5);
    this.dr.o2.frequency.setTargetAtTime(37.4+p*3.5,t,0.5);},
  droneOff(){if(!this.dr)return;const d=this.dr,t=this.ctx.currentTime;d.g.gain.setTargetAtTime(0,t,0.25);d.o1.stop(t+1.5);d.o2.stop(t+1.5);this.dr=null;},
};
/* ---------- the line at the top of the screen ---------- */
// There is one small line of text and only ever one: saying something new replaces what was there, saying the same thing again changes nothing,
// and saying nothing takes it away. Nothing is ever stacked.
document.body.insertAdjacentHTML('beforeend','<p id="cap" aria-live="polite" hidden></p>');
function say(text){const el=$('cap');if(el.textContent!==text)el.textContent=text;if(el.hidden!==!text)el.hidden=!text;}
/* ---------- camera and picture ---------- */
function camera(){return G.mode==='void'?cameraVoid():G.mode==='hub'?cameraHub():cameraMaze();}
// Adaptive resolution aims for the display's full refresh rate: smooth frames feel less dizzying than sharp but stuttering ones.
let renderScale=1,scaleCap=1,slow=0,fast=0,avgDt=1/60,lastCss='';
function resize(){
  const cw=canvas.clientWidth||2,ch=canvas.clientHeight||2,dpr=Math.min(window.devicePixelRatio||1,1.5);
  const w=Math.max(2,Math.floor(cw*dpr)),h=Math.max(2,Math.floor(ch*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const key=cw+'x'+ch+'x'+renderScale.toFixed(3);
  if(key!==lastCss||!FB){lastCss=key;
    const lh=Math.round(clamp(ch*0.72,360,760)*renderScale),lw=Math.min(1600,Math.max(200,Math.round(lh*cw/ch)));
    setupTargets(lw,lh);}
}
function quad(prog,target,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,w,h);gl.useProgram(prog.p);}
function bindTex(unit,tex,loc){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc,unit);}
function render(time,dt){
  resize();
  const lw=FB.lw,lh=FB.lh,tm=time%1000;
  const C=camera(),asp=lw/lh,fovy=clamp(clamp(2*Math.atan(0.50/asp),70*PI/180,96*PI/180)+G.fovAdd,40*PI/180,128*PI/180);
  const vd=G.mode==='void',hb=G.mode==='hub';
  const VP=mul(vd?persp(fovy,asp,0.1,1000):persp(fovy,asp,0.05,300),lookDir(C.eye,C.F,C.U));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.clearColor(0,0,0,1);
  // the scene draws itself into FB.s2 (level1.js: sceneMaze, level2.js: sceneVoid, hub.js: sceneHub); everything after that is shared
  if(vd)sceneVoid(C,VP,time);else if(hb)sceneHub(C,VP,fovy,asp,time);else sceneMaze(C,VP,fovy,asp,time);
  let next=FB.s2;
  // 2b. the painted room is laid down as gouache
  if(G.print>0.02&&G.kuw!==0&&!vd){quad(progKuw,FB.s1.fb,lw,lh);bindTex(0,FB.s2.tex,progKuw.u.uA);gl.uniform2f(progKuw.u.uPx,1/lw,1/lh);gl.uniform1f(progKuw.u.uAmt,G.print*0.85);gl.drawArrays(gl.TRIANGLES,0,3);next=FB.s1;}
  // 3. halation
  const b0=FB.bl[0],b1=FB.bl[1],bw=FB.bw,bh=FB.bh;
  quad(progBright,b0.fb,bw,bh);bindTex(0,next.tex,progBright.u.uA);gl.uniform2f(progBright.u.uPx,1/lw,1/lh);gl.uniform1f(progBright.u.uPrint,G.print);gl.drawArrays(gl.TRIANGLES,0,3);
  for(let i=0;i<2;i++){const sp=i?2.4:1.2;
    quad(progBlur,b1.fb,bw,bh);bindTex(0,b0.tex,progBlur.u.uA);gl.uniform2f(progBlur.u.uDir,sp/bw,0);gl.drawArrays(gl.TRIANGLES,0,3);
    quad(progBlur,b0.fb,bw,bh);bindTex(0,b1.tex,progBlur.u.uA);gl.uniform2f(progBlur.u.uDir,0,sp/bh);gl.drawArrays(gl.TRIANGLES,0,3);}
  // 4. print it
  quad(progPost,null,canvas.width,canvas.height);bindTex(0,next.tex,progPost.u.uScene);bindTex(1,b0.tex,progPost.u.uBloom);
  gl.uniform2f(progPost.u.uLow,lw,lh);gl.uniform1f(progPost.u.uTime,tm);gl.uniform1f(progPost.u.uFade,clamp(G.fade,0,1));gl.uniform3fv(progPost.u.uTint,vd?[1,1,1]:hb?HUB_TINT:moodOf(P.w).tint);gl.uniform1f(progPost.u.uMono,vd?1:0);gl.uniform1f(progPost.u.uPrint,G.print);
  gl.uniform1f(progPost.u.uHint,G.hint);gl.uniform1f(progPost.u.uSea,vd||hb?0:(G.sea||0));gl.uniform1f(progPost.u.uDrown,vd||hb?0:(G.drown||0));
  gl.uniform1f(progPost.u.uShock,reducedMotion?G.shock*0.3:G.shock);gl.uniform3f(progPost.u.uFlash,1.0,0.52,0.38);gl.uniform1f(progPost.u.uFlashA,G.flashA);gl.uniform1f(progPost.u.uDark,G.dark);gl.uniform1f(progPost.u.uPix,G.pix);gl.uniform1f(progPost.u.uFall,vd?G.fall:0);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- input ---------- */
function wake(){Snd.init();Snd.resume();}
function lockPointer(){
  if(locked||!canvas.requestPointerLock)return;
  const plain=()=>{try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}};
  // raw mouse input where supported: no OS acceleration or smoothing between hand and view
  try{const p=canvas.requestPointerLock({unadjustedMovement:true});if(p&&p.catch)p.catch(plain);}catch(err){plain();}
}
function bindInput(){
  const used=['KeyW','KeyA','KeyS','KeyD','KeyC','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'];
  window.addEventListener('keydown',e=>{if(!used.includes(e.code)||e.ctrlKey||e.metaKey)return;if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();wake();
    if(e.repeat)return;if(e.code==='KeyE'){interact();return;}if(e.code==='Space'){jump();return;}if(afoot())keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('keydown',e=>{if(Qs.i<0||e.repeat)return;
    if(['ArrowLeft','KeyA','KeyY','Digit1'].includes(e.code))answer(0);else if(['ArrowRight','KeyD','KeyN','Digit2'].includes(e.code))answer(1);});
  $('qa').addEventListener('click',()=>answer(0));$('qb').addEventListener('click',()=>answer(1));
  window.addEventListener('blur',()=>{keys.clear();});
  document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;});
  document.addEventListener('pointerlockerror',()=>{locked=false;});
  canvas.addEventListener('mousedown',e=>{wake();canvas.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY};if(Qs.i<0)lockPointer();});
  window.addEventListener('mouseup',()=>{drag=null;});
  // look is applied the moment the mouse moves, and the next frame draws from it: no smoothing, no queue
  const look=e=>{
    if(!afoot()||flip||xing)return;let dx=0,dy=0;
    if(locked){dx=e.movementX||0;dy=e.movementY||0;}else if(drag){dx=(e.clientX-drag.x)*1.6;dy=(e.clientY-drag.y)*1.6;drag.x=e.clientX;drag.y=e.clientY;}else return;
    if(Math.abs(dx)>250||Math.abs(dy)>250)return;
    const k=0.0022*(window.SCF_SETTINGS?SCF_SETTINGS.get('sens'):1);P.yaw-=P.g*dx*k;P.pitch=clamp(P.pitch-dy*k,-1.46,1.46); // Settings in the G book
  };
  // pointerrawupdate delivers mouse motion at the device's own rate instead of once per frame
  if('onpointerrawupdate' in window)window.addEventListener('pointerrawupdate',e=>{if(e.pointerType==='mouse')look(e);});
  else window.addEventListener('mousemove',look);
  // touch: left half walks and turns, right half looks; a quick tap is E, a double tap jumps, a long press toggles the crouch
  const tp={passive:false},taps={};let lastTap=0;
  canvas.addEventListener('touchstart',e=>{e.preventDefault();wake();
    for(const q of e.changedTouches){
      taps[q.identifier]={x:q.clientX,y:q.clientY,t:performance.now(),moved:false,timer:setTimeout(()=>{const a=taps[q.identifier];if(a&&!a.moved){G.tCrouch=!G.tCrouch;a.moved=true;}},520)};
      if(q.clientX<window.innerWidth*0.5&&joy.id<0){joy.id=q.identifier;joy.ox=q.clientX;joy.oy=q.clientY;joy.x=joy.y=0;}
      else if(lookT.id<0){lookT.id=q.identifier;lookT.x=q.clientX;lookT.y=q.clientY;}}},tp);
  canvas.addEventListener('touchmove',e=>{e.preventDefault();
    for(const q of e.changedTouches){
      const a=taps[q.identifier];if(a&&Math.hypot(q.clientX-a.x,q.clientY-a.y)>12)a.moved=true;
      if(q.identifier===joy.id){let dx=(q.clientX-joy.ox)/56,dy=(q.clientY-joy.oy)/56;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}joy.x=Math.abs(dx)<0.18?0:dx;joy.y=Math.abs(dy)<0.18?0:dy;}
      else if(q.identifier===lookT.id&&!flip&&!xing&&afoot()){P.yaw-=P.g*(q.clientX-lookT.x)*0.0052;P.pitch=clamp(P.pitch-(q.clientY-lookT.y)*0.0052,-1.46,1.46);lookT.x=q.clientX;lookT.y=q.clientY;}}},tp);
  const end=e=>{for(const q of e.changedTouches){
    const a=taps[q.identifier];if(a){clearTimeout(a.timer);if(!a.moved&&performance.now()-a.t<260){const now=performance.now();if(now-lastTap<300){jump();lastTap=0;}else{interact();lastTap=now;}}delete taps[q.identifier];}
    if(q.identifier===joy.id){joy.id=-1;joy.x=joy.y=0;}if(q.identifier===lookT.id)lookT.id=-1;}};
  canvas.addEventListener('touchend',end,tp);canvas.addEventListener('touchcancel',end,tp);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
}
/* ---------- loop ---------- */
let last=0;
function frame(ms){
  if(G.mode==='pool')return; // the inverted pool (js/poolflip.js) has taken over the screen: this loop stops
  const now=ms/1000;let dt=now-last;last=now;if(!(dt>0))dt=0.016;
  // keep the frame rate up: drop resolution when frames run long, win it back slowly when there is headroom
  if(dt<0.25&&!(window.SCF_LOADING&&SCF_LOADING.active)){avgDt+=(dt-avgDt)*0.08;
    if(avgDt>0.0195&&renderScale>0.5){if(++slow>30&&G.kuw!==0&&G.print>0.5){G.kuw=0;slow=0;}else if(slow>30){scaleCap=Math.max(0.5,renderScale*0.97);renderScale=Math.max(0.5,renderScale*0.86);slow=0;fast=0;}}else if(slow>0)slow--;
    if(avgDt<0.0175&&renderScale<scaleCap){if(++fast>360){renderScale=Math.min(scaleCap,renderScale*1.05);fast=0;}}else fast=0;}
  dt=Math.min(dt,0.05);G.clock+=dt;
  const two=G.mode==='void'||G.mode==='end',hub=G.mode==='hub';
  // the painted room and the field of the white screen are printed bright and clean; the night side, the black stair and the stair void keep the darkroom look
  G.print+=((hub?1:two?0:mazePrint())-G.print)*(1-Math.exp(-dt*3));
  if(hub?tickHub(dt):two?tickVoid(dt):tickMaze(dt))render(now,dt);
  if(typeof stopSign==='function')stopSign(dt,two);
  if(typeof hubPC==='function')hubPC(dt); // the old computer behind the white screen (js/hubpc.js) // a tick returns false when there is nothing to draw this frame
  requestAnimationFrame(frame);
}
