// Every GLSL program in the game, as strings. engine.js compiles them.
// FS_MAIN is the one material shader for both scenes: vMat picks checker, cream, wood, olive, painted sky (14/16), the black stair (8-11), concrete (12/13).
'use strict';
const GLSL_COMMON=`
precision highp float;
uniform float uTime;uniform float uSink;
uniform vec3 uSkyH;uniform vec3 uSkyZ;uniform vec3 uCloud;uniform vec3 uGrass;uniform float uWorld;uniform float uMoon;uniform float uCrack;
const float TILE=0.5;
const float BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
// 15-bit colour with ordered dither, quantised in sqrt space so the dark end keeps more steps
vec3 finalize(vec3 c){ivec2 i=ivec2(gl_FragCoord.xy)&3;float b=(BAYER[i.y*4+i.x]+0.5)/16.0;
  vec3 q=floor(sqrt(clamp(c,0.0,1.0))*31.0+b)/31.0;return q*q;}
const vec3 INK=vec3(0.055,0.06,0.11);
float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float h31(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm2(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n2(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
// The mist under the ladder. Seen from above the roof there is no building and no ground: only this, thickest straight down. uSink is how far it has risen (0 none, 1 everything).
float mistK(vec3 d){return smoothstep(0.07,-0.30,d.y);} // how much of a line of sight is in it: none above the horizon
vec3 mistAt(vec3 d){
  float dy=max(-d.y,0.03);vec2 p=d.xz/dy; // where the line of sight would meet a level sheet below
  float n=fbm2(p*0.30+uTime*vec2(0.011,0.007))*0.62+fbm2(p*0.85-uTime*vec2(0.016,0.004))*0.38;
  float deep=smoothstep(0.05,0.95,-d.y);
  vec3 c=mix(vec3(0.33,0.31,0.35),vec3(0.17,0.165,0.19),deep*deep*(1.6-0.6*deep)); // paler where it catches the night's light, dimmer the further down you look
  return c*(1.0+0.55*(n-0.5)*smoothstep(0.03,0.28,-d.y)*(1.0-0.8*deep)); // it rolls near the horizon and has no features at all at the bottom
}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n3(p);p=p*2.03+vec3(17.1,9.2,5.3);a*=.5;}return s;}

vec3 planetTex(vec3 n,float seed){
  vec3 p=n*1.9+seed*13.7;
  float w=fbm3(p*1.3);
  float f1=fbm3(p+vec3(0.,w*1.6,0.));
  float f2=fbm3(p*3.7+f1*2.5+7.);
  vec3 col=mix(vec3(0.40,0.11,0.08),vec3(0.71,0.25,0.15),smoothstep(0.30,0.62,f1));
  col=mix(col,vec3(0.89,0.51,0.34),smoothstep(0.50,0.74,f2)*0.7);
  col=mix(col,vec3(0.22,0.06,0.07),smoothstep(0.42,0.24,f2)*0.55);
  return col;
}
vec3 spaceCol(vec3 d,float aa,vec3 off){
  vec3 col=mix(vec3(0.026,0.032,0.092),vec3(0.062,0.068,0.185),fbm3(d*2.3+3.+off));
  vec3 p=d*40.0+off;vec3 id=floor(p);vec3 f=fract(p)-0.5;float h=h31(id);
  vec3 o=vec3(h31(id+11.7),h31(id+25.3),h31(id+39.1))-0.5;
  float r=length(f-o*0.5);float sz=mix(0.05,0.115,h31(id+3.3));float w=min(aa*40.0,0.05)+0.004;
  float s=(1.0-smoothstep(sz-w,sz+w,r))*step(0.62,h);
  s*=0.78+0.22*sin(uTime*1.9+h*61.0);
  return mix(col,vec3(0.97,0.96,0.90),s);
}
vec4 planetDisc(vec3 d,vec3 pd,float ang,float seed,float aa){
  float c=dot(d,pd);if(c<cos(ang*1.06))return vec4(0.);
  vec3 t1=normalize(cross(pd,vec3(0.21,0.94,0.27)));vec3 t2=cross(pd,t1);
  vec2 q=vec2(dot(d,t1),dot(d,t2))/sin(ang);float r=length(q);if(r>1.03)return vec4(0.);
  float z=sqrt(max(0.,1.-r*r));vec3 n=vec3(q,z);
  vec3 col=planetTex(n,seed);
  float lit=clamp(dot(n,normalize(vec3(-0.55,0.45,0.70))),0.,1.);
  col*=0.40+0.80*lit;
  col=mix(col,vec3(0.09,0.03,0.05),smoothstep(0.90,1.0,r)*0.75);
  float w=aa/sin(ang)+0.003;
  return vec4(col,1.-smoothstep(1.-w,1.+w,r));
}
vec3 skyBase(vec3 d,float aa){
  float y=d.y;
  if(uWorld>0.5){ // the far side of the windows: nothing but night in every direction
    vec3 m=vec3(d.x,abs(d.y),d.z);
    vec3 sp=spaceCol(d,aa,vec3(4.0));
    sp+=vec3(0.10,0.02,0.05)*smoothstep(0.35,0.0,abs(y))*(0.6+0.4*fbm2(d.xz*2.0));
    vec4 p1=planetDisc(m,normalize(vec3(0.06,1.0,0.085)),0.14,1.0,aa);
    vec4 p2=planetDisc(m,normalize(vec3(-0.50,0.72,-0.42)),0.105,2.0,aa);
    vec4 p3=planetDisc(d,normalize(vec3(-0.30,-0.80,0.52)),0.46,5.0,aa);
    vec4 p4=planetDisc(d,normalize(vec3(0.90,0.12,-0.42)),0.15,6.0,aa);
    sp=mix(sp,p1.rgb,p1.a*uMoon);sp=mix(sp,p2.rgb,p2.a);sp=mix(sp,p3.rgb,p3.a);sp=mix(sp,p4.rgb,p4.a);
    return sp;
  }
  // What is really outside is night, in every direction, above and below. The only daylight anywhere is paint on a wall.
  vec3 sp=spaceCol(d,aa,vec3(0.));
  vec4 p1=planetDisc(d,normalize(vec3(0.06,1.0,0.085)),0.14,1.0,aa);   // the moon you can take: almost overhead, so it shows down a deep skylight
  vec4 p2=planetDisc(d,normalize(vec3(-0.50,0.72,-0.42)),0.105,2.0,aa);
  vec4 p3=planetDisc(d,normalize(vec3(0.05,0.90,-0.62)),0.06,3.0,aa);
  // enormous ones low on every side, so that a window is usually full of one
  vec4 p4=planetDisc(d,normalize(vec3(0.95,0.10,0.30)),0.27,4.0,aa);
  vec4 p5=planetDisc(d,normalize(vec3(-0.80,0.16,-0.60)),0.20,7.0,aa);
  vec4 p6=planetDisc(d,normalize(vec3(-0.28,0.07,0.96)),0.32,8.0,aa);
  vec4 p7=planetDisc(d,normalize(vec3(0.30,0.14,-0.95)),0.17,9.0,aa);
  vec4 p8=planetDisc(d,normalize(vec3(0.20,-0.86,-0.40)),0.44,11.0,aa); // and one under the floor
  sp=mix(sp,p1.rgb,p1.a*uMoon);sp=mix(sp,p2.rgb,p2.a);sp=mix(sp,p3.rgb,p3.a);sp=mix(sp,p4.rgb,p4.a);
  sp=mix(sp,p5.rgb,p5.a);sp=mix(sp,p6.rgb,p6.a);sp=mix(sp,p7.rgb,p7.a);sp=mix(sp,p8.rgb,p8.a);
  return sp;
}
`;
const GLSL_SKY=`
// The sky breaks like a pane of glass, outward from where the moon was torn off: shards slip out of place, some go dark, some fall out.
vec3 skyCol(vec3 d,float aa){
  if(uCrack<=0.0)return skyBase(d,aa);
  vec3 p=d*5.0,ip=floor(p),fp=fract(p),bid=vec3(0.0);float d1=9.0,d2=9.0;
  for(int k=-1;k<=1;k++)for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec3 g=vec3(float(i),float(j),float(k));
    vec3 o=vec3(h31(ip+g+3.1),h31(ip+g+17.7),h31(ip+g+41.3));float dd=length(g+o-fp);
    if(dd<d1){d2=d1;d1=dd;bid=ip+g;}else if(dd<d2)d2=dd;}
  float e=d2-d1,hh=h31(bid+7.0);
  float reach=acos(clamp(dot(d,vec3(0.0597,0.9946,0.0845)),-1.0,1.0))/3.14159;
  float a=clamp((uCrack*1.35-reach)/0.10,0.0,1.0);
  vec3 off=(vec3(h31(bid+1.3),h31(bid+2.7),h31(bid+5.1))-0.5)*0.34*a*(1.0+0.2*sin(uTime*0.7+hh*30.0));
  vec3 col=skyBase(normalize(d+off),aa+0.002);
  col*=1.0-0.6*a*hh;
  col=mix(col,vec3(0.0),a*step(0.74,hh)*smoothstep(0.5,1.0,a));
  float ln=1.0-smoothstep(0.0,0.03+aa*5.0,e);
  col=mix(col,mix(vec3(1.0,0.32,0.2),vec3(0.0),smoothstep(0.35,1.0,a)),ln*smoothstep(0.0,0.15,a));
  return col;
}
`;
const VS_MAIN=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNrm;layout(location=2) in vec2 aUV;layout(location=3) in vec4 aEdge;layout(location=4) in float aMat;
uniform mat4 uVP;uniform mat4 uModel;
out vec3 vPos;out vec3 vNrm;out vec3 vObj;out vec2 vUV;out vec4 vEdge;flat out int vMat;
void main(){vec4 w=uModel*vec4(aPos,1.0);vPos=w.xyz;vObj=aPos;vNrm=mat3(uModel)*aNrm;vUV=aUV;vEdge=aEdge;vMat=int(aMat+0.5);gl_Position=uVP*w;}`;
const FS_MAIN=`#version 300 es
`+GLSL_COMMON+`
in vec3 vPos;in vec3 vNrm;in vec3 vObj;in vec2 vUV;in vec4 vEdge;flat in int vMat;
uniform vec3 uCam;uniform float uG;uniform float uSeed;
uniform int uPass;uniform sampler2D uPrev;uniform highp sampler2D uPrevD;uniform vec2 uRes;
uniform sampler2D uLight;uniform vec2 uMaze;uniform vec3 uAmb;uniform vec3 uFog;uniform vec3 uOut;uniform vec3 uFwd;uniform float uHold;uniform float uNoFog;uniform float uBright;uniform float uWH;uniform vec4 uOpC;uniform float uOpK;uniform float uInk;uniform vec4 uCut;
out vec4 o;
float checkerF(vec2 p,vec2 w){w=max(w,vec2(0.002));
  vec2 i=2.0*(abs(fract((p-0.5*w)*0.5)-0.5)-abs(fract((p+0.5*w)*0.5)-0.5))/w;return 0.5-0.5*i.x*i.y;}
vec3 matChecker(vec2 uv,vec2 fw){
  vec2 p=uv/TILE;vec2 w=fw/TILE;
  float lod=clamp(1.0-max(w.x,w.y)*2.2,0.0,1.0);
  vec2 q=p+((vec2(n2(p*1.1+11.0),n2(p*1.1+47.0))-0.5)*0.05+(vec2(n2(p*9.0+3.0),n2(p*9.0+71.0))-0.5)*0.014)*lod;
  float c=checkerF(q,w*1.25+0.014);
  vec2 id=floor(q);float tr=h21(id);
  float br=fbm2(vec2(q.x*2.2,q.y*8.0)+tr*31.0);
  float bl=fbm2(q*2.7+5.0);
  vec3 white=vec3(0.955,0.935,0.868)*(0.905+0.11*br*lod+0.03*(tr-0.5));
  white=mix(white,vec3(0.80,0.80,0.76),smoothstep(0.52,0.85,bl)*0.22*lod);
  vec3 black=vec3(0.050,0.058,0.125)+vec3(0.030,0.036,0.070)*smoothstep(0.42,0.80,br)*lod+0.010*(tr-0.5);
  white=mix(white,vec3(0.66,0.13,0.10)*(0.80+0.25*br*lod+0.05*(tr-0.5)),uWorld);
  black=mix(black,black.bgr*vec3(0.8,0.45,0.5),uWorld);
  return mix(black,white,c);
}
vec3 matCream(vec2 uv,vec3 n){
  float br=fbm2(vec2(uv.x*5.0,uv.y*17.0));
  vec3 c=abs(n.y)>0.5?vec3(0.925,0.895,0.770):(abs(n.x)>0.5?vec3(0.66,0.64,0.49):vec3(0.80,0.775,0.63));
  return c*(0.91+0.13*br);
}
vec3 matWood(vec2 uv,vec2 fw){
  float lod=clamp(1.0-max(fw.x,fw.y)*26.0,0.0,1.0);
  float g=fbm2(vec2(uv.x*2.5,uv.y*26.0));float k=fbm2(uv*3.0+9.0);
  float l=sin(uv.y*70.0+g*9.0+k*7.0)*lod;
  vec3 col=mix(vec3(0.50,0.17,0.11),vec3(0.73,0.31,0.20),smoothstep(-0.7,0.5,l));
  col=mix(col,vec3(0.87,0.53,0.38),smoothstep(0.55,1.0,l)*smoothstep(0.35,0.7,g)*0.8);
  col=mix(col,vec3(0.30,0.09,0.07),smoothstep(-0.75,-1.0,l)*0.6);
  return col;
}
vec3 matOlive(vec2 uv,vec2 fw){
  vec2 p=uv*2.1;vec2 wv=vec2(fbm2(p*1.2+3.0),fbm2(p*1.2+8.0));
  float v=fbm2(p+wv*1.3)*10.0;float l=abs(fract(v)-0.5);
  float w=max(fw.x,fw.y)*30.0+0.012;
  float line=1.0-smoothstep(0.045,0.045+w,l);
  vec3 base=vec3(0.565,0.545,0.335)*(0.92+0.14*fbm2(uv*7.0));
  return mix(base,vec3(0.29,0.28,0.15),line*0.85*clamp(1.25-w*2.2,0.25,1.0));
}
float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
vec3 matDoor(vec2 uv,vec2 fw){
  vec3 col=matWood(vec2(uv.y*0.55,uv.x*0.5)+3.0,fw.yx*0.55);
  float d=min(sdBox(uv-vec2(0.5,0.50),vec2(0.33,0.34)),sdBox(uv-vec2(0.5,1.47),vec2(0.33,0.37)));
  float w=max(fw.x,fw.y)*1.2+0.004;
  float line=1.0-smoothstep(0.014,0.014+w,abs(d));
  col*=d<0.0?0.90:1.04;
  return mix(col,vec3(0.22,0.06,0.05),line*0.8);
}
void main(){
  // second pass: only what lies beyond a window pane, seen through it
  if(uPass==1){vec2 sc=gl_FragCoord.xy/uRes;if(texture(uPrev,sc).a>0.5)discard;if(gl_FragCoord.z<=texture(uPrevD,sc).r+1e-6)discard;}
  // the shadow that walks into the window: no surface, only black, fraying at its outline; two pale eyes (uInk: opacity; 2 + opacity for the eyes).
  // It walks through a wall from one world into the other, so each world draws only the part on its own side of that wall (uCut).
  if(uInk>0.0){
    if(uCut.w!=0.0&&uCut.w*(dot(uCut.xy,vPos.xz)-uCut.z)<0.0)discard;
    bool eye=uInk>1.5;float op=eye?uInk-2.0:uInk;
    float gr=fract(52.9829189*fract(dot(gl_FragCoord.xy+floor(uTime*20.0)*vec2(5.3,7.7),vec2(0.06711056,0.00583715))));
    float rim=abs(dot(normalize(vNrm),normalize(vPos-uCam)));
    if(gr>op*(eye?1.0:smoothstep(0.0,0.45,rim)*1.3))discard;
    o=vec4(finalize(eye?vec3(1.0,0.96,0.88):vec3(0.004,0.004,0.008)),1.0);return;}
  // the roof all round comes apart checker tile by checker tile, from the middle outward; each tile stutters in and out before it is gone
  if(uOpK>0.0&&vMat<8&&vPos.y>uWH-0.13&&vPos.y<uWH+0.5){vec2 q=vPos.xz-uOpC.xy;
    if(abs(q.x)<2.93&&abs(q.y)<2.93){vec2 id=floor(q/0.5);float hh=h21(id+31.0);
      float r=hh*0.5+length((id+0.5)*0.5)/4.2*0.55,k=uOpK*1.15;
      if(r<k||(r<k+0.14&&fract(sin(floor(uTime*18.0)*12.9+hh*91.0)*437.5)>0.45))discard;}}
  vec3 n=normalize(vNrm);vec3 Vv=vPos-uCam;float dist=length(Vv);vec3 V=Vv/dist;
  // climbing out through the roof, the building goes: first it greys into the mist, then it is not there (a dissolve, grain by grain)
  bool sinks=uSink>0.0&&uNoFog<0.5&&(vMat<8||vMat>11);
  if(sinks){float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));if(ign<smoothstep(0.40,1.0,uSink))discard;}
  vec2 fw=max(abs(dFdx(vUV)),abs(dFdy(vUV)));float aa=length(fwidth(V));
  float e=min(min(vEdge.x,vEdge.y),min(vEdge.z,vEdge.w));float fe=fwidth(e);
  vec3 col;bool lit=true,glow=false;
  if(vMat==0)col=matChecker(vUV,fw);
  else if(vMat==1)col=matCream(vUV,n);
  else if(vMat==2)col=matWood(vUV,fw);
  else if(vMat==3)col=matOlive(vUV,fw);
  else if(vMat==4){col=uFog*1.6;lit=false;}
  else if(vMat==5){
    col=planetTex(normalize(vObj),uSeed);
    float l=clamp(dot(n,normalize(vec3(-0.45,0.65,0.55))),0.0,1.0);
    float rim=1.0-abs(dot(n,V));
    col=col*(0.95+0.9*l)+vec3(0.55,0.16,0.08)*pow(1.0-rim,2.0)*0.6;
    col=mix(col,vec3(1.0,0.45,0.25),smoothstep(0.55,1.0,rim)*0.55);lit=false;
  }
  else if(vMat==6)col=matDoor(vUV,fw);
  else if(vMat==8){col=vec3(0.0);lit=false;} // the stairwell walls: no surface at all, only black
  else if(vMat==9)col=vec3(0.50,0.47,0.46);
  else if(vMat==10){col=vec3(1.0,0.98,0.94);lit=false;} // the door of light at the very top
  else if(vMat==11)col=vec3(0.80,0.74,0.70); // the ladder
  else if(vMat==14||vMat==16){ // paint: blue sky, cloud and a strip of meadow, flat on the wall. It is brighter than the room: it gives off the day it shows.
    float y0=0.0,yT=uWH,d=-1.0;
    if(vMat==16){ // only inside the outline of an arch; the rest of the wall stays checker
      float lx=(fract(vUV.x*0.5)-0.5)*2.0;
      float hs=h21(vec2(floor(vUV.x*0.5),floor(dot(vPos.xz,abs(n.xz))*0.5+0.25))+7.7);
      float r=0.50+0.28*fract(hs*7.0);y0=hs<0.45?0.0:(hs<0.8?0.9:2.3);float ys=y0+1.3+2.4*fract(hs*13.0);yT=ys+r;
      d=vUV.y<ys?max(abs(lx)-r,y0-vUV.y):length(vec2(lx,vUV.y-ys))-r;
      float fd=fwidth(d)+1e-4;
      col=mix(vec3(0.925,0.895,0.770),matChecker(vUV,fw),smoothstep(0.06,0.06+fd,d)); // a cream surround
      col=mix(col*0.14,col,smoothstep(0.0,fd*1.5,abs(d-0.06)-0.006));
    }
    if(d<=0.0){lit=false;
      vec3 sk;
      if(uWorld>0.5){ // on the far side the same paint shows night
        vec2 p=vUV*5.0,id=floor(p),f=fract(p)-0.5;float h=h21(id+3.7);
        float rr=length(f-(vec2(h21(id+11.1),h21(id+23.3))-0.5)*0.6);
        sk=mix(mix(vec3(0.030,0.034,0.100),vec3(0.075,0.060,0.180),fbm2(vUV*0.9)),vec3(0.97,0.96,0.90),(1.0-smoothstep(0.035,0.075,rr))*step(0.5,h));
      }else{glow=true;
        float hh=clamp((vUV.y-y0)/(yT-y0),0.0,1.0);
        sk=mix(uSkyH,uSkyZ,smoothstep(0.15,1.0,hh));
        vec2 q=vec2(vUV.x*0.62+uTime*0.008,vUV.y*1.30);
        float cn=fbm2(q*1.25+7.3),band=smoothstep(0.20,0.34,hh)*(1.0-smoothstep(0.84,0.98,hh));
        float cl=smoothstep(0.50,0.56,cn*(0.66+0.46*band))*band;
        float nu=fbm2(q*1.25+7.3+vec2(0.0,0.24));
        sk=mix(sk,mix(mix(uSkyZ,uCloud,0.64),uCloud,smoothstep(-0.05,0.06,cn-nu)),cl);
        float gy=y0+min(0.92,(yT-y0)*0.28)+0.03*sin(vUV.x*1.7)+0.015*sin(vUV.x*4.3+1.0); // the meadow, up to where a horizon would be
        vec3 gr=mix(vec3(0.13,0.50,0.24),vec3(0.20,0.64,0.29),smoothstep(0.0,0.9,vUV.y-y0))*uGrass;
        sk=mix(sk,gr,1.0-smoothstep(gy-0.012,gy+0.012,vUV.y));
      }
      col=vMat==16?mix(sk*0.14,sk,smoothstep(0.0,0.02,-d-0.004)):sk;
    }
  }
  else if(vMat==12||vMat==13){ // the stair void: bare concrete at a scale that has nothing to do with you
    float cn=fbm2(vUV*1.7)+0.5*fbm2(vUV*8.0)+0.9*fbm2(vUV*0.11);col=vec3(0.80)*(0.62+0.2*cn);lit=false;
    if(vMat==13){ // far flights: the steps are drawn on, not built
      float q=vUV.x/0.75,fq=fwidth(q),k=clamp(1.0-fq*1.1,0.0,1.0),fr=fract(q);
      col*=1.0-k*(0.40*step(0.68,fr)+0.5*(1.0-smoothstep(0.0,0.05+fq,fr)));}
    float shd=n.y>0.5?1.0:(n.y<-0.5?0.30:(abs(n.x)>0.5?0.74:0.54));
    col*=shd*(0.55+0.5/(1.0+dist*dist*0.004));}
  else col=vec3(0.84,0.70,0.32);
  bool vd=vMat>=8&&vMat<=13;
  vec2 lp=(vPos.xz+n.xz*0.45)/uMaze;
  bool outside=lp.x<0.0||lp.y<0.0||lp.x>1.0||lp.y>1.0||vPos.y<-0.3||vPos.y>uWH+0.3;
  if(lit){
    float fl=n.y*uG;
    float sh=abs(n.y)>0.5?mix(0.84,1.0,smoothstep(-0.6,0.6,fl)):(abs(n.x)>0.5?(n.x>0.0?0.97:0.86):(n.z>0.0?0.92:0.80));
    vec3 Lm=outside?uOut:texture(uLight,lp).rgb*2.0;
    // on-camera flash: bright up close, gone a few steps away
    float fc=pow(max(dot(V,uFwd),0.0),3.0);
    float flash=(0.055+0.21*fc)/(1.0+dist*dist*0.24);
    // the moon in your hand is a red lamp; in the stairwell it is the only light there is
    vec3 hold=vec3(1.0,0.42,0.28)*uHold/(1.0+dist*dist*0.45);
    if(vd)col*=sh*(vec3(0.004,0.004,0.006)+(vMat==11?vec3(0.20,0.16,0.17):vec3(0.0))+hold*1.6+vec3(1.0,0.96,0.88)*flash*0.7);
    else if(uBright>0.5)col*=outside?sh*vec3(0.40,0.45,0.66):mix(1.0,sh,0.55)*min(vec3(0.84)+Lm*0.30+hold*0.25,vec3(1.20)); // the painted room: lit everywhere, as flat as gouache. Outside it is night.
    else col*=sh*(uAmb+Lm+vec3(1.0,0.96,0.88)*flash+hold*0.5);
  }
  float lw=uBright>0.5?0.020:0.013; // the ink line is a little heavier in the painted room
  float w=max(lw,fe*0.9);
  float line=1.0-smoothstep(w-fe*0.5-1e-4,w+fe*0.5+1e-4,e);
  line*=clamp(lw/max(fe*0.9,1e-5),0.25,1.0);
  if(vMat!=8)col=mix(col,col*0.12,line*0.85);
  if(vMat==10||uNoFog>0.5){}else if(vMat==12||vMat==13)col=mix(vec3(0.085),col,exp(-dist*0.0075));
  else if(vd){float dk=exp(-dist*0.05);
    // the ladder below you does not end: it goes on down into the mist for as far as you can see
    float dn=vMat==11?uSink*clamp((uCam.y-vPos.y)*0.6,0.0,1.0):0.0;
    col=mix(col*dk,mix(col*(0.5+0.5*dk),mistAt(V),1.0-exp(-dist*0.030)),dn);}
  else if(outside)col=mix(col,uWorld>0.5?uSkyH:vec3(0.035,0.040,0.110),(1.0-exp(-dist*0.028))*0.9);
  else if(uBright>0.5)col=mix(col,vec3(0.90,0.92,0.97),(1.0-exp(-dist*0.022))*0.36); // only a breath of air between you and the far wall
  else col=mix(col,uFog,1.0-exp(-dist*0.085));
  if(sinks)col=mix(col,mistAt(V),smoothstep(0.0,0.62,uSink)*mix(0.35,1.0,mistK(V)));
  o=vec4(finalize(col),(uPass==0&&vMat==4)?0.0:(glow&&uSink<0.2?0.75:1.0)); // alpha: 0 = glass to see through, 0.75 = a surface that gives off daylight
}`;
const VS_SKY=`#version 300 es
uniform vec3 uR;uniform vec3 uU;uniform vec3 uF;out vec3 vDir;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.0-1.0;vDir=uF+uR*p.x+uU*p.y;gl_Position=vec4(p,1.0,1.0);}`;
const FS_SKY=`#version 300 es
`+GLSL_COMMON+GLSL_SKY+`
in vec3 vDir;out vec4 o;uniform int uPass;uniform sampler2D uPrev;uniform vec2 uRes;
void main(){if(uPass==1&&texture(uPrev,gl_FragCoord.xy/uRes).a>0.5)discard;vec3 d=normalize(vDir);float aa=length(fwidth(d));
  vec3 c=skyCol(d,aa);if(uSink>0.0)c=mix(c,mistAt(d),smoothstep(0.0,0.45,uSink)*mistK(d)); // below the horizon, the mist
  o=vec4(finalize(c),1.0);}`;

const VS_QUAD=`#version 300 es
out vec2 vUV;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const FS_MERGE=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uA;out vec4 o;
void main(){vec4 a=texture(uA,vUV);if(a.a<0.5)discard;o=a;}`;
const FS_BRIGHT=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uA;uniform vec2 uPx;uniform float uPrint;out vec4 o;
void main(){vec4 s=(texture(uA,vUV+uPx*vec2(-1.,-1.))+texture(uA,vUV+uPx*vec2(1.,-1.))+texture(uA,vUV+uPx*vec2(-1.,1.))+texture(uA,vUV+uPx*vec2(1.,1.)))*0.25;
  vec3 c=s.rgb;float l=max(c.r,max(c.g,c.b));
  // darkroom look: every highlight halates. Painted room: only what is sky (alpha 0.75) gives off light.
  o=vec4(mix(c*smoothstep(0.42,0.92,l)+c*0.07,c*(1.0-smoothstep(0.78,0.97,s.a)),uPrint),1.0);}`;
// Kuwahara filter: each pixel takes the mean of whichever neighbouring quadrant is calmest. Edges stay hard, everything
// between them settles into flat patches of colour, the way gouache lies on paper.
const FS_KUW=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uA;uniform vec2 uPx;uniform float uAmt;out vec4 o;
void main(){vec4 c0=texture(uA,vUV);vec3 m0=vec3(0.),m1=vec3(0.),m2=vec3(0.),m3=vec3(0.),q0=vec3(0.),q1=vec3(0.),q2=vec3(0.),q3=vec3(0.);
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec3 c=texture(uA,vUV+vec2(float(i),float(j))*uPx).rgb,cc=c*c;
    if(i<=0&&j<=0){m0+=c;q0+=cc;}if(i>=0&&j<=0){m1+=c;q1+=cc;}if(i<=0&&j>=0){m2+=c;q2+=cc;}if(i>=0&&j>=0){m3+=c;q3+=cc;}}
  m0/=9.;m1/=9.;m2/=9.;m3/=9.;
  vec3 v0=abs(q0/9.-m0*m0),v1=abs(q1/9.-m1*m1),v2=abs(q2/9.-m2*m2),v3=abs(q3/9.-m3*m3);
  float a=v0.r+v0.g+v0.b,b=v1.r+v1.g+v1.b,c=v2.r+v2.g+v2.b,d=v3.r+v3.g+v3.b;
  vec3 r=m0;float best=a;if(b<best){best=b;r=m1;}if(c<best){best=c;r=m2;}if(d<best){r=m3;}
  o=vec4(mix(c0.rgb,r,uAmt),c0.a);}`;
const FS_BLUR=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uA;uniform vec2 uDir;out vec4 o;
void main(){vec3 c=texture(uA,vUV).rgb*0.227;
  c+=(texture(uA,vUV+uDir).rgb+texture(uA,vUV-uDir).rgb)*0.1946;
  c+=(texture(uA,vUV+uDir*2.).rgb+texture(uA,vUV-uDir*2.).rgb)*0.1216;
  c+=(texture(uA,vUV+uDir*3.).rgb+texture(uA,vUV-uDir*3.).rgb)*0.054;
  c+=(texture(uA,vUV+uDir*4.).rgb+texture(uA,vUV-uDir*4.).rgb)*0.0162;
  o=vec4(c,1.0);}`;
// the "developed photo": light soft focus, halation, lifted violet blacks, vignette, fine sensor noise.
// Comfort: almost no lens warp, a steady centre dot, quieter grain and scanlines so turning doesn't swim.
const FS_POST=`#version 300 es
precision highp float;in vec2 vUV;
uniform sampler2D uScene;uniform sampler2D uBloom;uniform vec2 uLow;uniform float uTime;uniform float uFade;uniform vec3 uTint;uniform float uHint;
uniform float uShock;uniform vec3 uFlash;uniform float uFlashA;uniform float uDark;uniform float uPix;uniform float uMono;uniform float uPrint;uniform float uFall;
out vec4 o;
float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 soft(vec2 uv){vec2 px=(0.8+uPix*4.0)/uLow;vec3 c0=texture(uScene,uv).rgb;
  vec3 bl=c0*0.6+(texture(uScene,uv+px*vec2(0.9,0.4)).rgb+texture(uScene,uv+px*vec2(-0.4,0.9)).rgb+texture(uScene,uv+px*vec2(-0.9,-0.4)).rgb+texture(uScene,uv+px*vec2(0.4,-0.9)).rgb)*0.1;
  return mix(bl,c0,uPrint*0.85);}
void main(){
  vec2 cc=vUV-0.5;
  cc+=vec2(sin(uTime*93.0),cos(uTime*71.0))*0.008*uShock; // the impact shakes the frame
  float r2=dot(cc,cc);
  vec2 uv=0.5+cc*(1.0-0.012*r2);
  if(uPix>0.003){ // the deeper you go, the less of the picture is left
    vec2 g=uLow/(1.0+uPix*12.0);uv=(floor(uv*g)+0.5)/g;
    float tear=step(1.0-0.045*uPix,h21(vec2(floor(vUV.y*34.0),floor(uTime*7.0))));uv.x+=tear*0.03*sin(uTime*47.0+vUV.y*9.0);}
  vec3 col;
  if(uShock>0.01){ // colour tears apart and the picture is sucked toward the centre
    vec2 ca=cc*0.045*uShock;
    col=vec3(soft(uv+ca).r,soft(uv).g,soft(uv-ca).b);
    vec3 z=vec3(0.0);for(int i=1;i<=4;i++)z+=soft(0.5+(uv-0.5)*(1.0-0.03*float(i)*uShock));
    col=mix(col,z*0.25,0.55*uShock);
  }else col=soft(uv);
  if(uFall>0.004){ // a long fall: the picture smears
    vec2 rr=uFall*9.0/uLow;vec3 sm=col*0.20;
    for(int i=0;i<8;i++){float a=float(i)*0.7854+0.39;sm+=texture(uScene,uv+vec2(cos(a),sin(a))*rr).rgb*0.060+texture(uScene,uv+vec2(cos(a+0.3927),sin(a+0.3927))*rr*0.5).rgb*0.040;}
    col=mix(col,sm,min(1.0,uFall*2.2));}
  vec3 bl=texture(uBloom,uv).rgb;
  {float em=1.0-smoothstep(0.78,0.97,texture(uScene,uv).a);col+=bl*mix(0.85,0.55*(1.0-em),uPrint);} // in the painted room the glow falls on the walls, not back on the sky that makes it
  col=mix(col,bl*1.5,0.06*(1.0-uPrint));
  float lum=dot(col,vec3(0.299,0.587,0.114));
  col=mix(vec3(lum),col,mix(1.12,1.20,uPrint));
  col=col*uTint+vec3(0.020,0.014,0.040)*(1.0-uPrint);
  col=mix(1.0-exp(-col*1.12),col*1.10/(1.0+0.10*col*col),uPrint); // the painted room is printed straight, without the darkroom
  col=mix(col,vec3(dot(col,vec3(0.299,0.587,0.114))),uMono);
  col*=1.0-0.55*(1.0-0.8*uPrint)*smoothstep(0.10,0.66,r2);
  col*=1.0-0.5*uDark*smoothstep(0.015,0.32,r2); // higher up the stairs the edges of sight close in
  col=mix(col,vec3(dot(col,vec3(0.3,0.59,0.11))),0.45*uDark);
  col*=1.0-uFall*(0.42+0.30*smoothstep(0.02,0.40,r2)); // and goes dim, the edges first
  {float l2=dot(col,vec3(0.3,0.59,0.11));col=mix(col,vec3(l2*1.3,l2*0.09,l2*0.08),0.6*uPix);}
  float line=0.988+0.012*sin(vUV.y*uLow.y*3.14159);
  col*=line;
  vec2 gp=floor(gl_FragCoord.xy*0.5);float gt=fract(uTime*7.31)*191.0;
  vec3 g=vec3(h21(gp+gt),h21(gp+gt+37.0),h21(gp+gt+71.0))-0.5;g=mix(g,vec3(g.g),uMono);
  col+=mix(vec3(g.g),g,0.55)*(0.05-0.03*lum)*(1.0+3.5*uPix)*(1.0-0.75*uPrint);
  float hd=length(cc*vec2(uLow.x/uLow.y,1.0));
  col=mix(col,mix(vec3(1.0,0.97,0.90),vec3(0.06,0.07,0.14),step(0.5,dot(col,vec3(0.3333)))),(1.0-smoothstep(0.0012,0.0024,hd))*0.4); // centre dot: light on dark, dark on light
  col+=vec3(1.0,0.93,0.80)*(1.0-smoothstep(0.0018,0.0042,abs(hd-0.013)))*uHint*0.55;
  col=mix(col,uFlash,clamp(uFlashA,0.0,1.0));
  col=mix(col,vec3(1.0,0.985,0.96),uFade);
  o=vec4(col,1.0);}`;
