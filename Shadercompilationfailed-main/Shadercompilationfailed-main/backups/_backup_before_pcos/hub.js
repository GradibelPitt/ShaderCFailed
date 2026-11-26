// The hall of the white screen: where the stair void lets you out once every question has been answered.
// Grass to the horizon under a wide sky, the way an old desktop picture looked, and behind you one very large white screen standing in it.
// On the screen, three places to go back to. Aim at one (or point at it, when the pointer is free) and click.
// The field has no edge: walk away from the screen in any direction and, once it is lost in the haze behind you, it is ahead of you again.
// Everything here is one full-screen shader (FS_HUB, below, kept in this file with the scene it belongs to): no geometry at all.
// The first time you arrive, the name of the game is shown before the field is (see "the name of the game", below).
'use strict';
/* ---------- measures ---------- */
const HP=384;               // the field repeats every HP metres; a screen stands at every crossing of that grid and only the nearest is ever seen
const SW=8,SH=9,ST=0.2;     // the screen: half its width, its height, half its thickness. It stands on the grass at the origin and faces +z.
const HUB_Z=12;             // you arrive this far in front of it, with your back to it
const LADDER_MID=0;         // "the very middle of the ladder", in metres above the chamber floor: the landing is 16 m up, the water 16 m down
// the three lines on the screen, top to bottom: where each is drawn (as a fraction of the screen's height, from the top) and where it sends you
const HUB_ROWS=[{label:'POOL',y:0.24,go:'pool'},{label:'CHECKERED ROOM',y:0.50,go:'room'},{label:'LADDER',y:0.76,go:'ladder'}];
const ROW_H=0.20,ROW_U0=0.07,ROW_U1=0.93;
const HB={x:0,z:HUB_Z,y:0,vy:0,title:-1,hover:-1,pick:-1,pt:0,gone:false,dirty:true,blink:0,step:0,tf:0.7,asp:1.78,mouse:null,down:null,tap:null,prog:null,tex:null,cv:null,wind:null,cur:''};
const HUB_TINT=[1.0,0.995,0.94]; // printed a little warm, like an old photograph of a desktop picture

/* ---------- the picture ---------- */
const FS_HUB=`#version 300 es
precision highp float;
in vec3 vDir;out vec4 o;
uniform vec3 uEye;uniform float uTime;uniform sampler2D uScr;
const vec3 SUN=vec3(-0.699,0.619,-0.359);          // over your right shoulder as you arrive: the grass ahead is all in the light, the screen's shadow lies off to one side
const vec3 BOX=vec3(${SW}.0,${SH/2},${ST});
const float GH=0.17;                                 // how tall the grass stands
const vec3 G0=vec3(0.035,0.125,0.020),G1=vec3(0.130,0.350,0.055),G2=vec3(0.350,0.570,0.120);
const vec3 HAZE=vec3(0.60,0.80,0.66);
const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
vec3 finalize(vec3 c){ivec2 i=ivec2(gl_FragCoord.xy)&3;float b=(BAYER[i.y*4+i.x]+0.5)/16.0;
  vec3 q=floor(sqrt(clamp(c,0.0,1.0))*31.0+b)/31.0;return q*q;}
float h1(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
// value noise that comes round again every "per" cells: the field repeats every ${HP} m and nothing in it may show the seam
float vn(vec2 p,float per){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);vec2 a=mod(i,per),b=mod(i+1.0,per);
  return mix(mix(h1(a),h1(vec2(b.x,a.y)),f.x),mix(h1(vec2(a.x,b.y)),h1(b),f.x),f.y);}
float fbm(vec2 p,float per){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*vn(p,per);p=p*2.0+vec2(17.0,9.0);per*=2.0;a*=0.5;}return s;}
// one bank of cumulus: lit from above and from the sun's side, grey underneath
vec4 bank(vec2 uv,float per,float thr,float side){
  float d=fbm(uv,per),d2=fbm(uv+vec2(side*0.09,0.12),per),cov=smoothstep(thr,thr+0.055,d);
  float lit=clamp(0.74-(d2-d)*6.5-0.22*smoothstep(thr+0.10,thr+0.30,d),0.0,1.0);
  return vec4(mix(vec3(0.50,0.61,0.67),vec3(0.99,0.965,0.87),lit),cov);
}
// The sky is only a direction: walking never brings a cloud nearer. The clouds are painted round the horizon like a backdrop.
vec3 sky(vec3 rd){
  float y=max(rd.y,0.0),sd=max(dot(rd,SUN),0.0);
  vec3 col=mix(vec3(0.66,0.83,0.87),vec3(0.13,0.44,0.72),1.0-exp(-y*2.6));
  col+=vec3(1.0,0.90,0.70)*(0.18*pow(sd,6.0)+0.40*pow(sd,48.0)+2.0*pow(sd,900.0));
  float az=atan(rd.x,rd.z)/6.28318,side=sin(atan(SUN.x,SUN.z)-az*6.28318);
  vec4 c1=bank(vec2(az*8.0+uTime*0.0013,y*3.6),8.0,0.50+0.30*smoothstep(0.30,0.80,y),side);       // the big ones
  vec4 c2=bank(vec2(az*22.0+uTime*0.0021+5.0,y*11.0+3.0),22.0,0.53+0.50*smoothstep(0.10,0.30,y),side); // a far row of small ones low down
  float hz=smoothstep(0.0,0.10,y);
  col=mix(col,mix(vec3(0.82,0.90,0.90),c2.rgb,0.25+0.60*hz),c2.a*(0.50+0.40*hz));
  col=mix(col,mix(vec3(0.82,0.90,0.90),c1.rgb,0.45+0.55*hz),c1.a*(0.65+0.35*hz));
  return col;
}
// the slab the screen is: nearest hit and which face
float box(vec3 ro,vec3 rd,out vec3 n){
  vec3 c=ro-vec3(0.0,BOX.y,0.0),m=1.0/rd,k=abs(m)*BOX,t1=-m*c-k,t2=-m*c+k;
  float tN=max(max(t1.x,t1.y),t1.z),tF=min(min(t2.x,t2.y),t2.z);
  n=-sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
  return (tN>tF||tF<0.0)?-1.0:tN;
}
// The grass. Far off it is only colour, moved over by wind and cloud shadow; close by it is cut into blades:
// a dozen level sheets between the roots and the tips, each showing the cross-sections of the blades that reach that high.
vec3 field(vec3 ro,vec3 rd,float t,float seen){
  vec2 p=ro.xz+rd.xz*t;
  float w=vn(p/16.0+uTime*vec2(0.10,0.04),24.0)*0.6+vn(p/4.0+uTime*vec2(0.33,0.13),96.0)*0.4;   // wind going over
  float m=vn(p/64.0,6.0)*0.55+vn(p/16.0+3.7,24.0)*0.45;                                           // broad lighter and darker ground
  float nearK=1.0-smoothstep(3.5,10.0,t),midK=1.0-smoothstep(20.0,80.0,t);
  float tf=mix(0.5,vn(p,384.0)*0.55+vn(p*4.0,1536.0)*0.45,midK);                                  // tufts
  float tone=0.34+0.26*m+0.24*(w-0.5),lum=0.76+0.48*tf;
  vec3 c=mix(G1,G2,tone)*lum;
  if(nearK>0.001){
    vec3 nc=mix(G0,G1,0.80)*lum;
    vec2 lean=vec2(0.83,0.56)*(0.15+0.95*w)*GH;
    for(int k=0;k<12;k++){
      float h=1.0-float(k)/12.0,tl=(GH*h-ro.y)/rd.y;
      // the blades stand on a grid turned 3-4-5 against the field, each a little off its spot, so no rows show
      vec2 g=ro.xz+rd.xz*tl-lean*h*h,q=vec2(0.6*g.x-0.8*g.y,0.8*g.x+0.6*g.y)*62.5,id=floor(q),r=h2(mod(id,4800.0)),r2=h2(mod(id,4800.0)+71.3);
      float bh=0.40+0.60*r.x;if(h>bh)continue;
      vec2 f=fract(q)-0.5-(r2-0.5)*0.55;float a=r.y*6.2832,ca=cos(a),sa=sin(a);vec2 e=vec2(ca*f.x+sa*f.y,(ca*f.y-sa*f.x)*2.2);
      float rad=0.44*(1.0-h/bh)+0.07;
      if(dot(e,e)<rad*rad){
        vec3 tip=mix(G1,G2,tone+0.34*(r.x-0.35));tip=mix(tip,vec3(0.47,0.53,0.16),step(0.92,r.y)*0.5); // now and then a yellowing one
        nc=mix(mix(G0,G1,0.8),tip,smoothstep(0.0,0.7,h/bh))*(0.80+0.30*h)*lum;break;}
    }
    c=mix(c,nc,nearK);
  }
  // the screen throws a long shadow forward over the grass, and lights what is right in front of it
  float ts=-p.y/SUN.z;vec2 sp=vec2(p.x+SUN.x*ts,SUN.y*ts);
  float pen=0.05+0.04*ts,sh=ts>0.0?1.0-smoothstep(-pen,pen,max(abs(sp.x)-BOX.x,sp.y-2.0*BOX.y)):0.0;
  c*=mix(vec3(1.0),vec3(0.46,0.55,0.68),sh*seen);
  float glow=p.y>BOX.z?exp(-(p.y-BOX.z)/6.5)*(1.0-smoothstep(BOX.x-1.0,BOX.x+7.0,abs(p.x))):0.0;
  c=mix(c,c*1.5+vec3(0.05,0.06,0.05),0.5*glow*seen);
  c*=1.0-0.45*seen*(1.0-smoothstep(0.0,0.5,max(abs(p.x)-BOX.x,abs(p.y)-BOX.z)));                  // and it is dark right against its foot
  // cloud shadows drift across
  float cl=vn(p/96.0+uTime*vec2(0.012,0.004),4.0)*0.6+vn(p/32.0+uTime*vec2(0.03,0.01),12.0)*0.4;
  c*=mix(1.0,0.80,smoothstep(0.48,0.66,cl));
  return mix(c,HAZE,0.55*(1.0-exp(-t*0.0045)));
}
void main(){
  vec3 rd=normalize(vDir),ro=uEye;
  float seen=1.0-smoothstep(110.0,176.0,length(ro.xz));      // the screen and everything it does to the grass is gone into the haze long before the field repeats
  vec3 col=sky(rd);
  // ground, with the horizon drawn as a clean line
  float e=fwidth(rd.y)+1e-6,gk=clamp(0.5-rd.y/e,0.0,1.0),tg=1e9;
  if(gk>0.0){tg=min(-ro.y/min(rd.y,-2e-5),6e4);col=mix(col,field(ro,rd,tg,seen),gk);}
  if(rd.y>=0.0)tg=1e9;
  // the screen. What is on it is looked up out here, where every pixel does it, so the picture is filtered cleanly.
  float tp=(BOX.z-ro.z)/rd.z;vec3 fp=ro+rd*tp;
  vec3 shown=texture(uScr,vec2((fp.x+BOX.x)/(2.0*BOX.x),1.0-fp.y/(2.0*BOX.y))).rgb;
  vec3 n;float tb=box(ro,rd,n),alpha=1.0;
  if(tb>0.0&&tb<tg&&seen>0.0){
    vec3 q=ro+rd*tb,sc;float em=0.0;
    if(n.z>0.5){sc=shown;em=1.0;}
    else sc=vec3(0.85,0.87,0.91)*(0.60+0.52*max(dot(n,SUN),0.0));
    // grass stands up against its foot
    float s=abs(n.z)>0.5?q.x:q.z,fr=0.035+0.10*h1(vec2(floor(s*70.0),3.0))+0.05*h1(vec2(floor(s*23.0),9.0));
    if(q.y<fr){sc=mix(G1,G2,0.25+0.5*h1(vec2(floor(s*70.0),5.0)))*(0.45+0.55*q.y/fr)*(n.z>0.5?0.62:1.0);em=0.0;}
    float k=seen*(1.0-smoothstep(120.0,180.0,tb));
    col=mix(col,sc,k);alpha=mix(1.0,0.75,em*k);              // alpha 0.75 is what the engine lets glow
  }
  o=vec4(finalize(col),alpha);
}`;
function hubInit(){
  HB.prog=compile(VS_SKY,FS_HUB);
  HB.cv=document.createElement('canvas');HB.cv.width=1024;HB.cv.height=576;
  HB.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,HB.tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  HB.dirty=true;
  // the pixel type may still be on its way: paint again once it is here
  try{if(document.fonts&&document.fonts.load)document.fonts.load('112px "VT323"').then(()=>{HB.dirty=true;}).catch(()=>{});}catch(e){}
}
// What the screen shows: white, three lines of black pixel type. The line under the aim is shown in reverse, like a cursor on an old screen
// (the same way the answers to the questions are); the line you chose blinks before you go.
function hubPaint(){
  const c=HB.cv,g=c.getContext('2d'),W=c.width,H=c.height;
  g.fillStyle='#fff';g.fillRect(0,0,W,H);
  // as large as the longest line allows, whichever face the browser ends up with
  const face='px "VT323","Courier New",ui-monospace,monospace';g.font='100'+face;
  const wide=Math.max(...HUB_ROWS.map(r=>g.measureText(r.label).width))||1;
  g.font=Math.round(Math.min(H*0.27,100*(ROW_U1-ROW_U0-0.08)*W/wide))+face;g.textAlign='center';g.textBaseline='middle';
  HUB_ROWS.forEach((r,i)=>{
    const on=HB.pick>=0?(HB.pick===i&&HB.blink===0):HB.hover===i,y=r.y*H;
    if(on){g.fillStyle='#000';g.fillRect(ROW_U0*W,y-ROW_H*H/2,(ROW_U1-ROW_U0)*W,ROW_H*H);}
    g.fillStyle=on?'#fff':'#000';g.fillText(r.label,W/2,y+H*0.008);});
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,HB.tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);
  HB.dirty=false;
}
/* ---------- aiming at the screen ---------- */
// pt: where on the page the pointer or finger is, or nothing for the centre of the view
function hubRay(pt){
  const C=cameraHub();if(!pt)return {o:C.eye,d:C.F};
  const r=cross(C.F,C.U),b=canvas.getBoundingClientRect(),nx=((pt.x-b.left)/(b.width||1)*2-1)*HB.tf*HB.asp,ny=(1-(pt.y-b.top)/(b.height||1)*2)*HB.tf;
  return {o:C.eye,d:[C.F[0]+r[0]*nx+C.U[0]*ny,C.F[1]+r[1]*nx+C.U[1]*ny,C.F[2]+r[2]*nx+C.U[2]*ny]};
}
// which line of the screen that ray lands on, or -1
function hubRow(pt){
  const q=hubRay(pt),o=q.o,d=q.d;if(o[2]<=ST||d[2]>-1e-4)return -1;
  const t=(ST-o[2])/d[2],x=o[0]+d[0]*t,y=o[1]+d[1]*t,u=(x+SW)/(2*SW),v=1-y/SH;
  if(t>120||u<ROW_U0||u>ROW_U1)return -1;
  for(let i=0;i<HUB_ROWS.length;i++)if(Math.abs(v-HUB_ROWS[i].y)<=ROW_H/2)return i;
  return -1;
}
function hubClick(pt){
  if(G.mode!=='hub'||HB.menu||HB.pick>=0||HB.title>=0||G.fade>0.5)return;
  const i=hubRow(pt);if(i<0)return;
  HB.pick=i;HB.pt=0;HB.gone=false;HB.blink=0;HB.dirty=true;keys.clear();G.jb=0;
  Snd.tone(660,0.09,'square',0.035,0,true);Snd.tone(990,0.16,'square',0.03,0.08,true);
}
/* ---------- wind ---------- */
function windOn(){
  const c=Snd.ctx;if(!c||HB.wind)return;
  try{
    const n=c.sampleRate*3,buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),l=c.createOscillator(),lf=c.createGain(),lg=c.createGain();
    s.buffer=buf;s.loop=true;f.type='bandpass';f.frequency.value=380;f.Q.value=0.6;g.gain.value=0;
    l.frequency.value=0.09;lf.gain.value=170;lg.gain.value=0.018;l.connect(lf);lf.connect(f.frequency);l.connect(lg);lg.connect(g.gain);
    s.connect(f);f.connect(g);g.connect(Snd.master);s.start();l.start();g.gain.setTargetAtTime(0.045,c.currentTime,1.8);
    HB.wind={s,l,g};
  }catch(e){HB.wind=null;}
}
function windOff(){const w=HB.wind;if(!w||!Snd.ctx)return;const t=Snd.ctx.currentTime;HB.wind=null;
  try{w.g.gain.cancelScheduledValues(t);w.g.gain.setTargetAtTime(0,t,0.25);w.s.stop(t+1.6);w.l.stop(t+1.6);}catch(e){}}
/* ---------- the name of the game ---------- */
// Not part of the scene: lettering laid straight onto the screen the first time the field is reached, there for a few seconds, then gone.
// It is shown the way an old computer came up: black screen, the name in the middle, a little bar under it with three blocks going round,
// and then the desktop, which here is the field. Except that this one does not finish. The blocks stop. Nothing moves. Then the picture is
// dragged a little way and leaves itself behind, the way a window did when the machine had hung; then nothing; then daylight.
// The lettering is not a typeface: every letter is a few strokes and arcs given here (centre lines, on a grid ten units high), drawn with a round pen.
const TTL_TOP='SHADER COMPILATION',TTL_BIG='FAILED';
const TTL_IN=0.6,TTL_FAIL=4.0,TTL_DRAG=4.4,TTL_CUT=5.05,TTL_DAY=5.7,TTL_END=6.1; // seconds: it starts to show, the bar stops, the picture smears, black, the black lifts, gone
const TQ=Math.PI/2;
// each letter: w its width, p its strokes; a stroke is M x y, L x y, or E cx cy rx ry from to anticlockwise (an arc of an ellipse)
const TTL_GLYPH={
  S:{w:5,p:[[['E',2.5,2.5,2.5,2.5,-0.55,TQ,1],['E',2.5,7.5,2.5,2.5,-TQ,Math.PI-0.55,0]]]},
  H:{w:6,p:[[['M',0,0],['L',0,10]],[['M',6,0],['L',6,10]],[['M',0,5],['L',6,5]]]},
  A:{w:6.4,p:[[['M',0,10],['L',3.2,0],['L',6.4,10]],[['M',1.12,6.5],['L',5.28,6.5]]]},
  D:{w:6,p:[[['M',0,10],['L',0,0],['L',1.4,0],['E',1.4,5,4.6,5,-TQ,TQ,0],['L',0,10]]]},
  E:{w:5.4,p:[[['M',5.4,0],['L',0,0],['L',0,10],['L',5.4,10]],[['M',0,5],['L',4.4,5]]]},
  R:{w:5.8,p:[[['M',0,10],['L',0,0],['L',3.1,0],['E',3.1,2.65,2.65,2.65,-TQ,TQ,0],['L',0,5.3]],[['M',2.9,5.3],['L',5.8,10]]]},
  C:{w:5.6,p:[[['E',3.4,5,3.4,5,-0.9,0.9,1]]]},
  O:{w:6.8,p:[[['E',3.4,5,3.4,5,0,Math.PI*2,0]]]},
  M:{w:8,p:[[['M',0,10],['L',0,0],['L',4,7],['L',8,0],['L',8,10]]]},
  P:{w:5.6,p:[[['M',0,10],['L',0,0],['L',2.9,0],['E',2.9,2.8,2.7,2.8,-TQ,TQ,0],['L',0,5.6]]]},
  I:{w:0,p:[[['M',0,0],['L',0,10]]]},
  L:{w:5,p:[[['M',0,0],['L',0,10],['L',5,10]]]},
  T:{w:6.4,p:[[['M',0,0],['L',6.4,0]],[['M',3.2,0],['L',3.2,10]]]},
  N:{w:6,p:[[['M',0,10],['L',0,0],['L',6,10],['L',6,0]]]},
  F:{w:5.2,p:[[['M',5.2,0],['L',0,0],['L',0,10]],[['M',0,5],['L',4.2,5]]]}
};
const TT={cv:null,img:null,key:'',k:-1,seen:false,bar:null};
// how wide a line is in letter units: tr between letters, sp for a space
const ttlWide=(str,tr,sp)=>[...str].reduce((a,ch)=>a+(ch===' '?sp-tr:TTL_GLYPH[ch].w+tr),-tr);
// one line of lettering: left edge x, top of the letters y, scale s (pixels per unit), pen width pen (pixels)
function ttlLine(c2,str,x,y,s,tr,sp,pen){
  c2.lineWidth=pen/s;c2.lineJoin='round';c2.lineCap='round';
  for(const ch of str){if(ch===' '){x+=(sp-tr)*s;continue;}const g=TTL_GLYPH[ch];
    c2.save();c2.translate(x,y);c2.scale(s,s);
    for(const st of g.p){c2.beginPath();for(const q of st){if(q[0]==='M')c2.moveTo(q[1],q[2]);else if(q[0]==='L')c2.lineTo(q[1],q[2]);else c2.ellipse(q[1],q[2],q[3],q[4],0,q[5],q[6],!!q[7]);}c2.stroke();}
    c2.restore();x+=(g.w+tr)*s;}
}
// The lettering, built once for the size of the window: the whole name small and widely spaced, and under it, set to the same width, the one word that matters.
function ttlBuild(W,H){
  const Wt=Math.max(120,Math.round(Math.min(W*0.46,H*0.80))),pad=Math.ceil(Wt*0.08);
  const w1=ttlWide(TTL_TOP,3.6,9),w2=ttlWide(TTL_BIG,2.9,0),s1=Wt/w1,s2=Wt/w2,y2=10*s1+Wt*0.085,Ht=Math.ceil(y2+10*s2);
  const ink=document.createElement('canvas');ink.width=Wt+2*pad;ink.height=Ht+2*pad;
  let c2=ink.getContext('2d');c2.strokeStyle='#fff';
  ttlLine(c2,TTL_TOP,pad,pad,s1,3.6,9,Math.max(1.2,1.22*s1));ttlLine(c2,TTL_BIG,pad,pad+y2,s2,2.9,0,1.75*s2);
  // white going a little blue toward the foot of each line, like something lit from above
  c2.globalCompositeOperation='source-in';const gr=c2.createLinearGradient(0,pad,0,pad+Ht);
  gr.addColorStop(0,'#ffffff');gr.addColorStop(10*s1/Ht,'#dfe7f6');gr.addColorStop(y2/Ht,'#ffffff');gr.addColorStop(1,'#c3d0ea');c2.fillStyle=gr;c2.fillRect(0,0,ink.width,ink.height);
  // and a soft light round it
  const img=document.createElement('canvas');img.width=ink.width;img.height=ink.height;c2=img.getContext('2d');
  c2.shadowColor='rgba(120,160,255,0.55)';c2.shadowBlur=Wt*0.03;c2.drawImage(ink,0,0);c2.shadowBlur=0;c2.drawImage(ink,0,0);
  TT.img=img;TT.bar={w:Math.round(Wt*0.34),h:Math.max(8,Math.round(Wt*0.030)),gap:Math.round(Wt*0.105)};
}
// the lettering and the bar under it, as one picture, at (ox,oy) off the middle; bt is where the three blocks have got to
function ttlPicture(c2,W,H,ox,oy,bt){
  const im=TT.img,b=TT.bar,top=Math.round((H-(im.height+b.gap+b.h))/2)+oy;
  c2.drawImage(im,Math.round((W-im.width)/2)+ox,top);
  const x=Math.round((W-b.w)/2)+ox+0.5,y=top+im.height+b.gap-Math.round(im.height*0.06)+0.5,r=b.h*0.3,u=Math.max(1,Math.round(b.h/9));
  const box=()=>{c2.beginPath();c2.moveTo(x+r,y);c2.arcTo(x+b.w,y,x+b.w,y+b.h,r);c2.arcTo(x+b.w,y+b.h,x,y+b.h,r);c2.arcTo(x,y+b.h,x,y,r);c2.arcTo(x,y,x+b.w,y,r);c2.closePath();};
  c2.save();box();c2.fillStyle='#000';c2.fill();c2.lineWidth=u;c2.strokeStyle='rgba(178,190,214,0.9)';c2.stroke();box();c2.clip();
  const bw=Math.round(b.h*0.62),bh=b.h-4*u,step=bw+u*2,span=b.w+3*step,bx=x-3*step+(bt*0.43%1)*span;
  const g=c2.createLinearGradient(0,y+2*u,0,y+2*u+bh);g.addColorStop(0,'#c9dcff');g.addColorStop(0.45,'#5b8cf2');g.addColorStop(1,'#2a56c4');c2.fillStyle=g;
  for(let i=0;i<3;i++)c2.fillRect(Math.round(bx+i*step),y+2*u-0.5,bw,bh);
  c2.restore();
}
function ttlDraw(t){
  if(!TT.cv){document.body.insertAdjacentHTML('beforeend','<canvas id="ttl" aria-label="Shader Compilation Failed"></canvas>');TT.cv=$('ttl');}
  const cv=TT.cv,dpr=Math.min(window.devicePixelRatio||1,2),W=Math.max(2,Math.round(window.innerWidth*dpr)),H=Math.max(2,Math.round(window.innerHeight*dpr));
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;TT.k=-1;}
  if(TT.key!==W+'x'+H){TT.key=W+'x'+H;ttlBuild(W,H);}
  cv.hidden=false;cv.style.opacity=t<TTL_DAY?'1':String(clamp(1-(t-TTL_DAY)/(TTL_END-TTL_DAY),0,1));
  const c2=cv.getContext('2d'),drag=reducedMotion?TTL_CUT:TTL_DRAG;
  if(t>=drag&&t<TTL_CUT){
    // dragged, and never wiped: each place it has been stays on the glass
    const k=Math.floor((t-drag)*34),rnd=mulberry32(4117);let ox=0,oy=0;
    for(let i=0;i<=k;i++){ox+=(0.0055+0.004*rnd())*W*(i>11?-0.45:1);oy+=(0.0022+0.0055*rnd())*W*(i>17?-0.8:1);if(i>TT.k)ttlPicture(c2,W,H,Math.round(ox),Math.round(oy),TTL_FAIL);}
    TT.k=k;return;}
  TT.k=-1;c2.globalAlpha=1;c2.fillStyle='#000';c2.fillRect(0,0,W,H);if(t>=TTL_CUT)return; // black, then black with nothing on it
  const a=clamp((t-TTL_IN)/1.3,0,1);c2.globalAlpha=a*a*(3-2*a);ttlPicture(c2,W,H,0,0,Math.min(t,TTL_FAIL));c2.globalAlpha=1;
}
function ttlOff(){HB.title=-1;if(TT.cv)TT.cv.hidden=true;}
// only the first time in a sitting: the playroom is a page of its own, so this is kept where it outlives a change of page (and no longer than the tab)
function ttlFirst(){try{if(sessionStorage.getItem('scf.title'))return false;sessionStorage.setItem('scf.title','1');}catch(e){if(TT.seen)return false;}TT.seen=true;return true;}
/* ---------- arriving, being there, leaving ---------- */
function enterHub(){
  SCF_SAVE.set('scene','hub');
  if(!HB.prog)hubInit();
  G.mode='hub';G.climb=false;flip=null;xing=null;keys.clear();say('');
  Qs.i=-1;$('q').hidden=true;canvas.style.cursor='';HB.cur='';
  G.fade=1;G.flashA=0;G.shock=0;G.pix=0;G.dark=0;G.hold=0;G.fovAdd=0;G.hint=0;G.fall=0;G.plunge=false;G.print=1;G.tCrouch=false;G.jb=0;
  P.g=1;P.vx=P.vz=P.av=0;P.small=!!SCF_SAVE.get('small');P.size=P.small?0.28:1;P.cr=0;P.yaw=0;P.pitch=0; // facing out over the grass: the screen is behind you
  HB.x=0;HB.z=HUB_Z;HB.y=0;HB.vy=0;HB.hover=-1;HB.pick=-1;HB.pt=0;HB.gone=false;HB.blink=0;HB.step=0;HB.dirty=true;
  HB.title=ttlFirst()?0:-1; // the first time here, the name of the game comes before the field does
}
function updateHub(dt){
  // no bells, no chord: only the wind
  if(Snd.ctx&&!HB.wind&&!HB.gone&&HB.title<0){Snd.mute=true;const t=Snd.ctx.currentTime;Snd.droneOff();if(Snd.pad)Snd.pad.gain.setTargetAtTime(0,t,0.05);Snd.master.gain.setTargetAtTime(0.9,t,0.4);windOn();}
  if(HB.menu){P.yaw-=dt*0.022;P.pitch=0.05;return;} // the main menu: no walking, the view turns slowly over the grass (js/menu.js)
  const busy=HB.pick>=0; // a line has been chosen: you stand where you are until it takes you
  const crouch=!busy&&(keys.has('KeyC')||G.tCrouch);P.cr+=((crouch?1:0)-P.cr)*(1-Math.exp(-dt*14));
  let turn=busy?0:(keys.has('ArrowRight')||(!locked&&keys.has('KeyD'))?1:0)-(keys.has('ArrowLeft')||(!locked&&keys.has('KeyA'))?1:0);if(!busy&&joy.id>=0)turn+=joy.x*0.9;
  P.av+=(turn*2.4-P.av)*(1-Math.exp(-dt*24));P.yaw-=P.av*dt;
  const on=HB.y===0&&HB.vy===0,v0=busy?[0,0]:wish(),k=1-Math.exp(-dt*(on?20:4));P.vx+=(v0[0]-P.vx)*k;P.vz+=(v0[1]-P.vz)*k;
  let nx=HB.x+P.vx*dt,nz=HB.z+P.vz*dt;
  // the screen is solid
  const bx=SW+0.3,bz=ST+0.3;
  if(Math.abs(nx)<bx&&Math.abs(nz)<bz){if(Math.abs(HB.x)>=bx){nx=Math.sign(HB.x)*bx;P.vx=0;}else{nz=(HB.z<0?-1:1)*bz;P.vz=0;}}
  if(typeof pcCollide==='function')[nx,nz]=pcCollide(HB.x,HB.z,nx,nz); // and so is the old computer behind it (js/hubpc.js)
  const moved=Math.hypot(nx-HB.x,nz-HB.z);
  HB.x=wd(nx,HP);HB.z=wd(nz,HP); // no edge: only ever the nearest screen
  if(!on){HB.vy-=GRAV*dt;HB.y+=HB.vy*dt;if(HB.y<=0){if(HB.vy<-2.5)Snd.noise(0.12,300,0.9,0.07);HB.y=0;HB.vy=0;}}
  if(G.jb>0){G.jb-=dt;if(HB.y===0&&HB.vy===0&&P.cr<0.5&&!busy){HB.vy=Math.sqrt(2*GRAV*JUMP_H);HB.y=1e-4;G.jb=0;}}
  if(on){HB.step+=moved;if(HB.step>0.78){HB.step=0;Snd.noise(0.11,700+Math.random()*500,0.7,0.03);}} // feet in grass
  // what the aim is on
  const aim=locked?null:HB.mouse,row=busy?-1:hubRow(aim);
  if(row!==HB.hover){HB.hover=row;HB.dirty=true;}
  G.hint+=((row>=0&&locked?1:0)-G.hint)*Math.min(1,dt*8);
  const cur=locked?'':row>=0?'pointer':'default';if(cur!==HB.cur){HB.cur=cur;canvas.style.cursor=cur;} // with the pointer free you can simply point at a line
}
function hubGo(i){
  windOff();ttlOff();canvas.style.cursor='';HB.cur='';G.hint=0;
  const go=HUB_ROWS[i].go;
  if(go==='pool'){location.href='playroom.html';return;} // the playroom and its pool are a page of their own
  // both of the others are in the first chamber, on this same page
  Snd.mute=false;if(Snd.ctx){Snd.master.gain.setTargetAtTime(0.9,Snd.ctx.currentTime,0.5);Snd.pad.gain.setTargetAtTime(0.05,Snd.ctx.currentTime,0.5);}
  G.shock=0;G.fovAdd=0;G.fall=0;G.told=false;loadLevel(0);G.fade=1;G.mode='play';
  if(go==='ladder')toLadder(LADDER_MID);
}
function tickHub(dt){
  if(HB.title>=0){HB.title+=dt;if(HB.title>=TTL_END)ttlOff();else ttlDraw(HB.title);}
  if(HB.title>=0)G.fade=1; // daylight waits behind the black until the name has been and gone
  else if(HB.pick<0){if(G.fade>0)G.fade=Math.max(0,G.fade-dt/2.6);} // out of the white, the way eyes take a moment in daylight
  else{HB.pt+=dt;
    const b=HB.pt<0.5?Math.floor(HB.pt*12)%2:0;if(b!==HB.blink){HB.blink=b;HB.dirty=true;}
    if(HB.pt>0.5)G.fade=Math.min(1,G.fade+dt/1.1); // and back into it
    if(G.fade>=1&&!HB.gone){HB.gone=true;hubGo(HB.pick);if(G.mode!=='hub')return true;}}
  updateHub(dt);return true;
}
/* ---------- what the engine asks of this scene ---------- */
function cameraHub(){const fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),cp=Math.cos(P.pitch),sp=Math.sin(P.pitch);
  return {eye:[HB.x,HB.y+eyeH(),HB.z],F:[fx*cp,sp,fz*cp],U:[-fx*sp,cp,-fz*sp],g:1};}
// The whole scene, left in FB.s2 for the engine to develop.
function sceneHub(C,VP,fovy,asp,time){
  if(HB.dirty)hubPaint();
  const m=HB.prog,tf=Math.tan(fovy/2),Rt=cross(C.F,C.U);HB.tf=tf;HB.asp=asp;
  gl.bindFramebuffer(gl.FRAMEBUFFER,FB.s2.fb);gl.viewport(0,0,FB.lw,FB.lh);gl.disable(gl.DEPTH_TEST);gl.useProgram(m.p);
  gl.uniform3f(m.u.uR,Rt[0]*tf*asp,Rt[1]*tf*asp,Rt[2]*tf*asp);gl.uniform3f(m.u.uU,C.U[0]*tf,C.U[1]*tf,C.U[2]*tf);gl.uniform3fv(m.u.uF,C.F);
  gl.uniform3fv(m.u.uEye,C.eye);gl.uniform1f(m.u.uTime,time%4096);bindTex(0,HB.tex,m.u.uScr);
  gl.bindVertexArray(vaoSky);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(vao);
}
/* ---------- choosing ---------- */
// Pointer captured: the click lands where the dot in the middle of the view is. Pointer free: it lands where the pointer is. A finger: where it taps.
canvas.addEventListener('mousedown',e=>{if(e.button!==0||G.mode!=='hub')return;if(locked)hubClick(null);else HB.down={x:e.clientX,y:e.clientY};});
window.addEventListener('mouseup',e=>{const d=HB.down;HB.down=null;if(d&&G.mode==='hub'&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)hubClick({x:d.x,y:d.y});});
canvas.addEventListener('mousemove',e=>{HB.mouse={x:e.clientX,y:e.clientY};});
canvas.addEventListener('mouseleave',()=>{HB.mouse=null;});
canvas.addEventListener('touchstart',e=>{const q=e.changedTouches[0];HB.tap={id:q.identifier,x:q.clientX,y:q.clientY,t:performance.now()};},{passive:true});
canvas.addEventListener('touchend',e=>{const a=HB.tap;HB.tap=null;if(!a||G.mode!=='hub')return;
  for(const q of e.changedTouches)if(q.identifier===a.id&&performance.now()-a.t<320&&Math.hypot(q.clientX-a.x,q.clientY-a.y)<12)hubClick({x:q.clientX,y:q.clientY});},{passive:true});
window.addEventListener('keydown',e=>{if(G.mode!=='hub'||e.repeat||e.ctrlKey||e.metaKey)return;if(e.code==='KeyE'||e.code==='Enter')hubClick(locked?null:HB.mouse);});
