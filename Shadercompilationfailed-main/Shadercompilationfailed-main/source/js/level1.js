// Scene one: the checkered maze. Everything that belongs only to it lives here: how a chamber is generated and checked for a way through,
// its geometry (walls, arches, doors, painted skies, ceilings), light, collision, the staircases that roll you onto the ceiling, the windows onto
// the far side, the planets and the red door, and the way out — the moon, the ladder and the black stair.
// Nobody can fall out of this scene: outer openings are closed with air, and over a hole there is air to stand on.
'use strict';
/* ---------- generating a chamber ---------- */
function wget(L,x,y,d){return d===0?L.hw[y*L.W+x]:d===2?L.hw[(y+1)*L.W+x]:d===3?L.vw[y*(L.W+1)+x]:L.vw[y*(L.W+1)+x+1];}
function wset(L,x,y,d,v){if(d===0)L.hw[y*L.W+x]=v;else if(d===2)L.hw[(y+1)*L.W+x]=v;else if(d===3)L.vw[y*(L.W+1)+x]=v;else L.vw[y*(L.W+1)+x+1]=v;}
function inb(L,x,y){return x>=0&&y>=0&&x<L.W&&y<L.H;}
function wcount(L,c){const x=c%L.W,y=(c/L.W)|0;let n=0;for(let d=0;d<4;d++)if(wget(L,x,y,d))n++;return n;}
function bfsDist(L,s){const N=L.W*L.H,dist=new Int16Array(N).fill(-1),q=[s];dist[s]=0;
  for(let i=0;i<q.length;i++){const c=q[i],x=c%L.W,y=(c/L.W)|0;
    for(let d=0;d<4;d++){if(wget(L,x,y,d))continue;const n=(y+DY[d])*L.W+x+DX[d];if(dist[n]<0){dist[n]=dist[c]+1;q.push(n);}}}
  return dist;}
// World 1 is the far side of the windows: the same rooms with floor and ceiling openings exchanged.
function blockedAt(L,c,l,w){return (l^w)?L.ch[c]:L.fh[c];}
// Fewest transitions (stair flips, window crossings) to reach every state.
// state = cell + N*(layer + 2*world + 4*small). Walking, shrinking and mini doors are free.
function solve(L){const W=L.W,N=W*L.H,fl=new Int16Array(N*8).fill(-1);
  let frontier=[L.start],lvl=0;fl[L.start]=0;
  while(frontier.length){const q=frontier,next=[];
    for(let i=0;i<q.length;i++){const s=q[i],k=(s/N)|0,c=s-k*N,l=k&1,w=(k>>1)&1,z=(k>>2)&1,x=c%W,y=(c/W)|0;
      for(let d=0;d<4;d++){const t=wget(L,x,y,d),nx=x+DX[d],ny=y+DY[d];
        if(!t){const n=ny*W+nx;if(!blockedAt(L,n,l,w)){const ns=n+k*N;if(fl[ns]<0){fl[ns]=lvl;q.push(ns);}}continue;}
        if(!inb(L,nx,ny))continue;const n=ny*W+nx;
        if(t===3){if(!z&&!blockedAt(L,n,l,1-w))next.push(n+N*(l+2*(1-w)));}
        else if(((t===8&&l===0)||(t===9&&l===1))&&z&&!blockedAt(L,n,l,w)){const ns=n+k*N;if(fl[ns]<0){fl[ns]=lvl;q.push(ns);}}}
      if(L.st[c]>=0)next.push(c+N*((1-l)+2*w+4*z));
      if(L.shr[c+l*N]){const ns=c+N*(l+2*w+4*(1-z));if(fl[ns]<0){fl[ns]=lvl;q.push(ns);}}}
    lvl++;frontier=[];for(const s of next)if(fl[s]<0){fl[s]=lvl;frontier.push(s);}}
  return fl;}
function wkey(L,x,y,d){const W=L.W;return d===0?'h'+(y*W+x):d===2?'h'+((y+1)*W+x):d===3?'v'+(y*(W+1)+x):'v'+(y*(W+1)+x+1);}
// Set pieces stamped onto the grid before the corridors are carved around them:
// hall (open room, sometimes pillared), court (roof open to space), chasm (no floor, cross on the ceiling),
// well (a ring walk around a bottomless, roofless shaft with a planet hanging in it), gallery (a long row of planet windows).
function tryBuild(cfg,rng){
  const W=cfg.W,H=cfg.H,N=W*H,ri=n=>(rng()*n)|0;
  const L={W,H,hw:new Uint8Array((H+1)*W).fill(1),vw:new Uint8Array(H*(W+1)).fill(1),fh:new Uint8Array(N),ch:new Uint8Array(N),st:new Int8Array(N).fill(-1),
    orbs:[],decor:[],rooms:[],room:new Int16Array(N).fill(-1),pillars:[],props:[],forced:{}};
  const place=(type,w,h)=>{
    for(let t=0;t<60;t++){const x=ri(W-w+1),y=ri(H-h+1);let ok=true;
      for(let yy=y-1;yy<=y+h&&ok;yy++)for(let xx=x-1;xx<=x+w;xx++)if(inb(L,xx,yy)&&L.room[yy*W+xx]>=0){ok=false;break;}
      if(!ok)continue;
      const id=L.rooms.length,R={type,x,y,w,h};L.rooms.push(R);
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){L.room[yy*W+xx]=id;if(xx<x+w-1)wset(L,xx,yy,1,0);if(yy<y+h-1)wset(L,xx,yy,2,0);}
      return R;}
    return null;};
  const S=cfg.set||{};
  for(let i=0;i<(S.well||0);i++){const big=rng()<0.5&&W>=13,n=big?4:3,R=place('well',n,n);if(!R)continue;
    for(let yy=R.y+1;yy<R.y+n-1;yy++)for(let xx=R.x+1;xx<R.x+n-1;xx++){L.fh[yy*W+xx]=1;L.ch[yy*W+xx]=1;}
    L.props.push({x:R.x+n/2,y:R.y+n/2,s:big?0.95:0.55});}
  for(let i=0;i<(S.chasm||0);i++){const o=[[3,3],[2,3],[3,2],[2,4],[4,2]][ri(5)],R=place('chasm',o[0],o[1]);if(!R)continue;
    for(let yy=R.y;yy<R.y+R.h;yy++)for(let xx=R.x;xx<R.x+R.w;xx++)L.fh[yy*W+xx]=1;
    L.orbs.push((R.y+((R.h-1)>>1))*W+R.x+((R.w-1)>>1));}
  for(let i=0;i<(S.court||0);i++){const o=[[3,3],[2,3],[3,2],[3,4],[4,3]][ri(5)],R=place('court',o[0],o[1]);if(!R)continue;
    for(let yy=R.y;yy<R.y+R.h;yy++)for(let xx=R.x;xx<R.x+R.w;xx++)L.ch[yy*W+xx]=1;}
  for(let i=0;i<(S.hall||0);i++){const o=[[2,2],[3,2],[2,3],[3,3],[4,3],[3,4]][ri(6)],R=place('hall',o[0],o[1]);if(!R)continue;
    if(rng()<0.65)for(let yy=R.y+1;yy<R.y+R.h;yy++)for(let xx=R.x+1;xx<R.x+R.w;xx++)L.pillars.push([xx,yy]);}
  for(let i=0;i<(S.gallery||0);i++){const n=5+ri(3),hz=rng()<0.5,R=hz?place('gallery',n,1):place('gallery',1,n);if(!R)continue;
    const a=rng()<0.5;
    for(let k=0;k<n;k++){const x=R.x+(hz?k:0),y=R.y+(hz?0:k);
      L.forced[wkey(L,x,y,hz?0:3)]=a?3:4;L.forced[wkey(L,x,y,hz?2:1)]=a?4:3;}}
  // corridors: depth-first, swallowing a whole set piece the moment it is touched
  {const seen=new Uint8Array(N),stack=[];
    const visit=c=>{const r=L.room[c];if(r<0){seen[c]=1;stack.push(c);return;}
      const R=L.rooms[r],cells=[];for(let yy=R.y;yy<R.y+R.h;yy++)for(let xx=R.x;xx<R.x+R.w;xx++){const k=yy*W+xx;if(!seen[k]){seen[k]=1;cells.push(k);}}
      for(let i=cells.length-1;i>0;i--){const j=ri(i+1),t=cells[i];cells[i]=cells[j];cells[j]=t;}
      for(const k of cells)stack.push(k);};
    visit(ri(N));
    while(stack.length){const c=stack[stack.length-1],x=c%W,y=(c/W)|0,o=[];
      for(let d=0;d<4;d++){const nx=x+DX[d],ny=y+DY[d];if(inb(L,nx,ny)&&!seen[ny*W+nx])o.push(d);}
      if(!o.length){stack.pop();continue;}
      const d=o[ri(o.length)];wset(L,x,y,d,0);visit((y+DY[d])*W+x+DX[d]);}}
  for(let i=0,k=0;i<600&&k<cfg.braid;i++){const x=ri(W),y=ri(H),d=ri(4);if(!inb(L,x+DX[d],y+DY[d])||!wget(L,x,y,d))continue;
    const n=(y+DY[d])*W+x+DX[d];if(L.fh[y*W+x]&&L.ch[y*W+x]||L.fh[n]&&L.ch[n])continue;wset(L,x,y,d,0);k++;}
  let start=-1;for(let t=0;t<80;t++){const c=ri(N);if(L.room[c]<0){start=c;break;}}
  if(start<0)return null;
  L.start=start;const d0=bfsDist(L,start);
  let ex=-1,bd=-1;for(let c=0;c<N;c++){const x=c%W,y=(c/W)|0;if(x&&y&&x<W-1&&y<H-1)continue;if(L.room[c]>=0)continue;if(d0[c]>bd){bd=d0[c];ex=c;}}
  if(ex<0||bd<cfg.minPath)return null;
  L.exit=ex;{const x=ex%W,y=(ex/W)|0,o=[];for(let d=0;d<4;d++)if(!inb(L,x+DX[d],y+DY[d]))o.push(d);L.exitDir=o[ri(o.length)];}
  const path=[ex];
  while(path[path.length-1]!==start){const c=path[path.length-1],x=c%W,y=(c/W)|0;
    for(let d=0;d<4;d++){if(wget(L,x,y,d))continue;const n=(y+DY[d])*W+x+DX[d];if(d0[n]===d0[c]-1){path.push(n);break;}}}
  path.reverse();
  const used=new Uint8Array(N),onPath=new Uint8Array(N);used[start]=used[ex]=1;for(const c of path)onPath[c]=1;
  for(let c=0;c<N;c++)if(L.room[c]>=0)used[c]=1;
  const stairWall=c=>{const x=c%W,y=(c/W)|0,o=[];for(let d=0;d<4;d++)if(wget(L,x,y,d)&&!(c===ex&&d===L.exitDir))o.push(d);return o.length?o[ri(o.length)]:-1;};
  // every way into a chasm gets a staircase, so the far side can always be reached overhead
  for(const R of L.rooms){if(R.type!=='chasm')continue;
    for(let yy=R.y;yy<R.y+R.h;yy++)for(let xx=R.x;xx<R.x+R.w;xx++)for(let d=0;d<4;d++){
      if(wget(L,xx,yy,d))continue;const nx=xx+DX[d],ny=yy+DY[d],n=ny*W+nx;if(L.room[n]>=0||used[n]||L.ch[n]||L.fh[n])continue;
      const sd=stairWall(n);if(sd<0)continue;L.st[n]=sd;used[n]=1;}}
  const Lp=path.length,m=cfg.gaps;
  const free=c=>c!==undefined&&!used[c]&&!L.ch[c]&&!L.fh[c]&&L.st[c]<0;
  for(let k=0;k<m;k++){
    const lo=2+Math.floor((Lp-4)*k/m),hi=1+Math.floor((Lp-4)*(k+1)/m),ok=[];
    for(let i=lo;i<=hi;i++)if(free(path[i-1])&&free(path[i])&&free(path[i+1])&&wcount(L,path[i-1])&&wcount(L,path[i+1]))ok.push(i);
    if(!ok.length)return null;
    const i=ok[ri(ok.length)],A=path[i-1],Hc=path[i],B=path[i+1];
    L.fh[Hc]=1;L.st[A]=stairWall(A);L.st[B]=stairWall(B);used[A]=used[Hc]=used[B]=1;
    const c1=path[i-2],c2=path[i+2];
    if(c1!==undefined&&L.st[c1]<0&&!L.fh[c1]&&L.room[c1]<0)L.ch[c1]=1;
    if(c2!==undefined&&L.st[c2]<0&&!L.fh[c2]&&L.room[c2]<0)L.ch[c2]=1;
  }
  const shuffled=()=>{const a=[];for(let i=0;i<N;i++)a.push(i);for(let i=N-1;i>0;i--){const j=ri(i+1),t=a[i];a[i]=a[j];a[j]=t;}return a;};
  let k=0;
  for(const c of shuffled()){if(k>=cfg.pitOrbs)break;if(used[c]||L.ch[c]||onPath[c]||wcount(L,c)!==3)continue;L.fh[c]=1;used[c]=1;L.orbs.push(c);k++;}
  if(k<cfg.pitOrbs)return null;
  k=0;for(const c of shuffled()){if(k>=cfg.extraSt)break;if(used[c]||L.ch[c]||L.fh[c])continue;const d=stairWall(c);if(d<0)continue;L.st[c]=d;used[c]=1;k++;}
  k=0;for(const c of shuffled()){if(k>=cfg.extraCeil)break;if(L.st[c]>=0||L.fh[c]||L.ch[c]||L.room[c]>=0)continue;L.ch[c]=1;k++;}
  k=0;for(const c of shuffled()){if(k>=cfg.extraFloor)break;if(used[c]||L.ch[c]||L.fh[c]||onPath[c])continue;L.fh[c]=1;used[c]=1;k++;}
  if(cfg.startSky&&!L.fh[start])L.ch[start]=1;
  // closets: a dead end sealed behind a mini door, with a planet inside
  L.shr=new Uint8Array(N*2);L.closet=new Uint8Array(N);L.orbW=[];
  k=0;for(const c of shuffled()){if(k>=(cfg.closets||0))break;if(used[c]||L.ch[c]||L.fh[c]||onPath[c]||wcount(L,c)!==3)continue;
    const x=c%W,y=(c/W)|0;let od=-1;for(let d=0;d<4;d++)if(!wget(L,x,y,d))od=d;
    const n=(y+DY[od])*W+x+DX[od];if(L.fh[n]||L.ch[n]||L.room[n]>=0||n===start)continue;
    wset(L,x,y,od,rng()<0.7?8:9);used[c]=1;L.closet[c]=1;L.orbs.push(c);k++;}
  if(k<(cfg.closets||0))return null;
  if(L.orbs.length>cfg.orbs)return null;
  decorate(L,rng,cfg);
  const fl=solve(L);
  const can=(c,w)=>fl[c+N*2*w]>=0||fl[c+N*(1+2*w)]>=0||fl[c+N*(4+2*w)]>=0||fl[c+N*(5+2*w)]>=0;
  for(let c=0;c<N;c++)if(!can(c,0)&&!can(c,1)&&!(L.fh[c]&&L.ch[c]))return null;
  const exA=fl[ex],exB=fl[ex+N*2];if(exA<0&&exB<0)return null;
  for(const o of L.orbs){if(!can(o,0))return null;L.orbW.push(0);}
  const plain=c=>!L.fh[c]&&!L.ch[c]&&c!==start&&c!==ex&&L.st[c]<0&&!L.closet[c]&&!L.orbs.includes(c);
  const dm=[d0];for(const o of L.orbs)dm.push(bfsDist(L,o));
  const far=(cand)=>{let bi=-1,bs=-1;
    for(let i=0;i<cand.length;i++){const c=cand[i];let mn=1e9;for(const d of dm)if(d[c]>=0)mn=Math.min(mn,d[c]);
      const s=mn+(wcount(L,c)===3?1.5:0)+rng()*1.5;if(s>bs){bs=s;bi=i;}}
    return bi<0?-1:cand[bi];};
  let nb=0;
  while(nb<(cfg.orbsB||0)&&L.orbs.length<cfg.orbs){const cand=[];for(let c=0;c<N;c++)if(plain(c)&&can(c,1))cand.push(c);
    const c=far(cand);if(c<0)return null;L.orbs.push(c);L.orbW.push(1);dm.push(bfsDist(L,c));nb++;}
  while(L.orbs.length<cfg.orbs){const cand=[];for(let c=0;c<N;c++)if(!L.fh[c]&&c!==start&&c!==ex&&L.st[c]<0&&!L.closet[c]&&!L.orbs.includes(c)&&can(c,0))cand.push(c);
    const c=far(cand);if(c<0)break;L.orbs.push(c);L.orbW.push(0);dm.push(bfsDist(L,c));}
  // spares: the red door wants L.need moons (one socket each), but a few more lie about indoors in the ordinary world,
  // so missing the hard ones (closets, pits, the far world) is not the end of it. More than needed is fine; fewer is not.
  L.need=L.orbs.length;
  for(let k=0,tries=0;k<(cfg.spareOrbs??3)&&tries<2;){
    const cand=[];for(let c=0;c<N;c++)if(!L.fh[c]&&(tries||!L.ch[c])&&c!==start&&c!==ex&&L.st[c]<0&&!L.closet[c]&&!L.orbs.includes(c)&&can(c,0))cand.push(c);
    const c=far(cand);if(c<0){tries++;continue;}L.orbs.push(c);L.orbW.push(0);dm.push(bfsDist(L,c));k++;}
  L.flips=exA<0?exB:exB<0?exA:Math.min(exA,exB);L.ok=L.flips>=cfg.minFlips;L.pathLen=Lp;
  return L;
}
// Wall kinds: 1 checker, 2 window, 3 window onto the other world, 4 olive panel, 5 round opening, 6 exit door, 7 wide opening,
// 8 mini door at the floor, 9 mini door at the ceiling
function decorate(L,rng,cfg){
  const W=L.W,H=L.H,N=W*H,ri=n=>(rng()*n)|0;
  const key=(x,y,d)=>wkey(L,x,y,d);
  const lock=new Set();
  for(let c=0;c<N;c++){const x=c%W,y=(c/W)|0;if(L.st[c]>=0)lock.add(key(x,y,L.st[c]));if(L.closet[c])for(let d=0;d<4;d++)lock.add(key(x,y,d));}
  const ek=key(L.exit%W,(L.exit/W)|0,L.exitDir);lock.add(ek);
  const clean=c=>c>=0&&c<N&&!L.fh[c]&&!L.ch[c]&&!L.closet[c];
  // shortcut mini doors through ordinary walls
  for(let t=0,k=0;t<N*8&&k<(cfg.miniDoors||0);t++){const c=ri(N),d=ri(4),x=c%W,y=(c/W)|0,nx=x+DX[d],ny=y+DY[d];
    if(!inb(L,nx,ny)||wget(L,x,y,d)!==1||lock.has(key(x,y,d)))continue;const n=ny*W+nx;
    if(!clean(c)||!clean(n)||L.room[c]>=0||L.room[n]>=0)continue;wset(L,x,y,d,rng()<0.7?8:9);k++;}
  const pick=(per,rm,gate)=>{const r=rng();if(per)return r<0.22?5:r<0.42?7:r<0.52?4:1;
    if(rm)return r<0.22?2:r<0.44?(gate?3:1):r<0.54?4:1;return r<0.12?2:r<0.25?(gate?3:1):r<0.33?4:1;};
  const rm=(a,b)=>(a>=0&&a<N&&L.room[a]>=0)||(b>=0&&b<N&&L.room[b]>=0);
  for(let i=0;i<L.hw.length;i++){const k='h'+i,y=(i/W)|0,per=y===0||y===H;if(k===ek){L.hw[i]=6;continue;}if(L.hw[i]!==1||lock.has(k))continue;
    const gate=!per&&clean(i-W)&&clean(i),f=L.forced[k];L.hw[i]=(f&&!per)?(f===3&&!gate?4:f):pick(per,!per&&rm(i-W,i),gate);}
  for(let i=0;i<L.vw.length;i++){const k='v'+i,x=i%(W+1),y=(i/(W+1))|0,per=x===0||x===W;if(k===ek){L.vw[i]=6;continue;}if(L.vw[i]!==1||lock.has(k))continue;
    const gate=!per&&clean(y*W+x-1)&&clean(y*W+x),f=L.forced[k];L.vw[i]=(f&&!per)?(f===3&&!gate?4:f):pick(per,!per&&rm(y*W+x-1,y*W+x),gate);}
  // small staircases along the walls: crouch onto one to change size
  const nSt=Math.round(N/8);
  for(let t=0,k=0;t<N*8&&k<nSt;t++){const c=ri(N),d=ri(4),layer=ri(2),x=c%W,y=(c/W)|0;
    if(c===L.start||c===L.exit||L.st[c]>=0||L.shr[c]||L.shr[c+N]||!clean(c))continue;
    const w=wget(L,x,y,d);if(w!==1&&w!==4)continue;
    if(lock.has(key(x,y,d)))continue;
    L.shr[c+layer*N]=1;L.decor.push({t:0,c,d,layer,rev:rng()<0.5});k++;}
}
function generate(cfg,seed){
  const c=Object.assign({},cfg);
  for(let relax=0;relax<5;relax++){let best=null;
    for(let a=0;a<600;a++){
      const L=tryBuild(c,mulberry32((Math.imul(seed|0,0x9E3779B1)+Math.imul(a,40503)+relax*977)>>>0));
      if(!L)continue;if(L.ok){L.attempt=a;L.relax=relax;return L;}
      if(!best||L.flips>best.flips)best=L;}
    if(best){best.relax=relax;return best;}
    c.gaps=Math.max(0,c.gaps-1);c.pitOrbs=0;c.closets=0;c.orbsB=0;if(relax>1)c.set={hall:2};c.extraFloor=0;c.extraCeil=Math.min(c.extraCeil,1);c.minFlips=0;c.minPath=Math.max(2,c.minPath-5);
  }
  c.gaps=0;c.minPath=0;c.extraSt=1;c.set={};
  for(let a=0;;a++){const L=tryBuild(c,mulberry32(a+17));if(L)return L;}
}
const LEVELS=[
  {W:11,H:11,gaps:2,pitOrbs:1,orbs:5,orbsB:1,closets:1,miniDoors:3,braid:6,set:{hall:2,court:1,chasm:1,well:0,gallery:1},extraSt:2,extraCeil:5,extraFloor:2,minFlips:2,minPath:20,startSky:true,seed:9},
  {W:13,H:13,gaps:2,pitOrbs:1,orbs:6,orbsB:2,closets:1,miniDoors:4,braid:9,set:{hall:2,court:1,chasm:1,well:1,gallery:1},extraSt:3,extraCeil:7,extraFloor:3,minFlips:3,minPath:26,startSky:false,seed:2},
  {W:17,H:17,gaps:3,pitOrbs:1,orbs:7,orbsB:2,closets:2,miniDoors:6,braid:14,set:{hall:3,court:2,chasm:2,well:1,gallery:2},extraSt:5,extraCeil:11,extraFloor:5,minFlips:3,minPath:36,startSky:false,seed:3}
];
function cfgFor(li){
  if(li<LEVELS.length)return LEVELS[li];
  const k=(li-LEVELS.length)%3,S=15+2*k;
  return {W:S,H:S,gaps:2+(k>0?1:0),pitOrbs:1,orbs:6+(k>0?1:0),orbsB:2,closets:1+(k>1?1:0),miniDoors:4+k,braid:10+3*k,
    set:{hall:2+k,court:1+(k>1?1:0),chasm:1+(k>0?1:0),well:1,gallery:1+(k>1?1:0)},
    extraSt:3+k,extraCeil:8+2*k,extraFloor:3+k,minFlips:3,minPath:28+4*k,startSky:k===0};
}

/* ---------- measures ---------- */
const CELL=2,WH=7,LOWH=3,CTH=0.32,T=0.14,PR=0.27; // the ceiling is about six times your height; where it opens to the sky the opening hangs down to LOWH
const WIN_W=1.1,WIN_Y0=0.85,WIN_Y1=2.15,RND_R=0.74,RND_Y=1.25,DOOR_W=1.1,DOOR_H=2.2;
// arches cut through walls: [half-width, height of the springing]; k = size 1..3, +4 = it stands on a sill
const ARCH=[[0.52,1.55],[0.62,1.95],[0.74,2.45]];
const archDims=k=>{const a=ARCH[((k&3)||1)-1],y0=(k&4)?0.7:0;return {r:a[0],ys:a[1]+y0,y0};};
// the way out: a ladder LH metres straight up into a black landing adrift in the sky, then a very long black stair
const LH=16,LT=LH+1,DEEP_N=46,DEEP=DEEP_N*0.35,NSTEP=80,SD=0.4,SR=0.248,XS=1,XE=XS+NSTEP*SD,UEND=LH+XE+0.25;
// Under the floor, down the ladder that goes on into the mist: a sheet of water at WAT_Y, and under it the inverted pool (poolflip.html).
// It only goes on down once the mist has the whole building (G.deep); WAT_UP is how far above the water it starts to show, DIVE how deep you go before you are through.
const WAT_Y=-16,WAT_UP=15,DIVE=2.6;
const hx=x=>x<XS?LH:LH+(x-XS)*SR/SD;

/* ---------- geometry ---------- */
function buildGeometry(L,seed){
  const A=[],W=L.W,H=L.H,N=W*H,C=CELL,h=T/2;
  let rng=null,world=0,writ=null;const starts=[],counts=[];
  const rects=[new Array(N),new Array(N)];
  const shr=[new Array(N),new Array(N)];
  // collision footprints: x0,z0,x1,z1,top (height above the layer's floor; you can jump onto anything lower than your jump)
  const addRect=(layer,c,r,top)=>{if(world)return;(rects[layer][c]||(rects[layer][c]=[])).push(r[0],r[1],r[2],r[3],top);};
  const NOE=[0,0,0,0],ALL=[1,1,1,1],QI=[0,1,2,0,2,3];
  // axis 0: plane x=c with (a,b)=(z,y); axis 1: plane y=c with (a,b)=(x,z); axis 2: plane z=c with (a,b)=(x,y)
  function rect(ax,c,a0,a1,b0,b1,sg,m,ef,uvm){
    const E=ef||NOE,cs=[[a0,b0],[a1,b0],[a1,b1],[a0,b1]],arr=uvm&&uvm.length,swap=uvm===1&&(b1-b0)>(a1-a0);
    for(let q=0;q<6;q++){const a=cs[QI[q]][0],b=cs[QI[q]][1];let x,y,z;
      if(ax===0){x=c;y=b;z=a;}else if(ax===1){x=a;y=c;z=b;}else{x=a;y=b;z=c;}
      let u=a,v=b;
      if(arr){u=uvm[0]+(a-a0)/(a1-a0)*(uvm[1]-uvm[0]);v=uvm[2]+(b-b0)/(b1-b0)*(uvm[3]-uvm[2]);}else if(swap){u=b;v=a;}
      A.push(x,y,z,ax===0?sg:0,ax===1?sg:0,ax===2?sg:0,u,v,E[0]?a-a0:9,E[1]?a1-a:9,E[2]?b-b0:9,E[3]?b1-b:9,m);}
  }
  function box(x0,x1,y0,y1,z0,z1,m,uvm){
    rect(0,x0,z0,z1,y0,y1,-1,m,ALL,uvm);rect(0,x1,z0,z1,y0,y1,1,m,ALL,uvm);
    rect(1,y0,x0,x1,z0,z1,-1,m,ALL,uvm);rect(1,y1,x0,x1,z0,z1,1,m,ALL,uvm);
    rect(2,z0,x0,x1,y0,y1,-1,m,ALL,uvm);rect(2,z1,x0,x1,y0,y1,1,m,ALL,uvm);
  }
  // First chamber only: a line painted on a plain wall you see as you come in (material 17, the uWrit texture; see writTex()).
  // The wall at the end of the way you start facing if it is near and bare, otherwise a bare wall of the start cell itself.
  function wallWriting(){
    const sx=L.start%W,sy=(L.start/W)|0;
    const plainW=(x,y,d)=>{if(!inb(L,x,y)||wget(L,x,y,d)!==1)return false;
      const i=d===0?y*W+x:d===2?(y+1)*W+x:d===3?y*(W+1)+x:y*(W+1)+x+1;return !(d===0||d===2?varH[i]:varV[i]);};
    let bd=0,bl=-1;for(let d=0;d<4;d++){let l=0,x=sx,y=sy;while(!wget(L,x,y,d)){x+=DX[d];y+=DY[d];l++;}if(l>bl){bl=l;bd=d;}}
    const cand=[];{const fx=sx+DX[bd]*bl,fy=sy+DY[bd]*bl;if(bl<=3)cand.push([fx,fy,bd]);}
    for(const d of [(bd+1)&3,(bd+3)&3,(bd+2)&3])cand.push([sx,sy,d]);
    const hit=cand.find(([x,y,d])=>plainW(x,y,d));if(!hit)return;
    writ=hit;const [x,y,d]=hit,e=h+0.006,wd=1.5,hg=0.92,yc=1.3,y0=yc-hg/2,y1=yc+hg/2,E=[9,9,9,9];
    let p,n;   // corners bottom-left, bottom-right, top-right, top-left as seen from inside the cell
    if(d===0){const z=y*C+e,a=(x+0.5)*C-wd/2,b=a+wd;n=[0,0,1];p=[[a,y0,z],[b,y0,z],[b,y1,z],[a,y1,z]];}
    else if(d===2){const z=(y+1)*C-e,a=(x+0.5)*C+wd/2,b=a-wd;n=[0,0,-1];p=[[a,y0,z],[b,y0,z],[b,y1,z],[a,y1,z]];}
    else if(d===3){const X=x*C+e,a=(y+0.5)*C+wd/2,b=a-wd;n=[1,0,0];p=[[X,y0,a],[X,y0,b],[X,y1,b],[X,y1,a]];}
    else{const X=(x+1)*C-e,a=(y+0.5)*C-wd/2,b=a+wd;n=[-1,0,0];p=[[X,y0,a],[X,y0,b],[X,y1,b],[X,y1,a]];}
    const uv=[[0,0],[1,0],[1,1],[0,1]];Q(p.map((q,k)=>[q[0],q[1],q[2],uv[k][0],uv[k][1],...E]),n,17);
  }
  function Q(p,n,m){for(let q=0;q<6;q++){const v=p[QI[q]];A.push(v[0],v[1],v[2],n[0],n[1],n[2],v[3],v[4],v[5],v[6],v[7],v[8],m);}}
  function windowFrame(ax,c,a,b,y0,y1,n,pane,pm){
    const lbox=(a0,a1,ya,yb,d0,d1,m)=>ax==='x'?box(a0,a1,ya,yb,c+d0,c+d1,m,1):box(c+d0,c+d1,ya,yb,a0,a1,m,1);
    const fd=0.115;
    lbox(a-0.03,a+0.05,y0-0.03,y1+0.03,-fd,fd,2);lbox(b-0.05,b+0.03,y0-0.03,y1+0.03,-fd,fd,2);
    lbox(a+0.05,b-0.05,y0-0.03,y0+0.05,-fd,fd,2);lbox(a+0.05,b-0.05,y1-0.05,y1+0.03,-fd,fd,2);
    for(let i=1;i<n;i++){const s=a+(b-a)*i/n,yy=y0+(y1-y0)*i/n;
      lbox(s-0.018,s+0.018,y0+0.05,y1-0.05,-0.04,0.04,2);lbox(a+0.05,b-0.05,yy-0.018,yy+0.018,-0.045,0.045,2);}
    if(pane){const sd=1+rng()*60;rect(ax==='x'?2:0,c,a+0.05,b-0.05,y0+0.05,y1-0.05,1,pm||4,NOE,[sd,sd,0,0]);}
  }
  // ---- decoration hung on the maze without changing it (chosen by hash, never by the level's own dice) ----
  // on plain checker walls (var): 1 the whole wall painted with sky, 2 a big window open to the real night (outer walls only),
  //   3 sky painted inside the outline of an arch, 4 doors of odd sizes, shut for good
  // on walls with a way through (ak): the size of the arch (1..3, +4 = with a sill): outer openings, and portals across corridors
  // on ceilings (cmask): irregular holes that follow the checker, one bit per half-metre tile
  const varH=new Uint8Array(L.hw.length),varV=new Uint8Array(L.vw.length),akH=new Uint8Array(L.hw.length),akV=new Uint8Array(L.vw.length),cmask=new Uint16Array(N),mur=[];
  const hsh=(i,salt)=>{let t=Math.imul(((i+1)*2654435761)^Math.imul(seed|0,40503)^salt,0x9E3779B1);t^=t>>>15;t=Math.imul(t,0x85EBCA6B);t^=t>>>13;return (t>>>0)/4294967296;};
  {const lkH=new Uint8Array(L.hw.length),lkV=new Uint8Array(L.vw.length),dec=new Uint8Array(N);
    const lk=(x,y,d)=>{if(d===0)lkH[y*W+x]=1;else if(d===2)lkH[(y+1)*W+x]=1;else if(d===3)lkV[y*(W+1)+x]=1;else lkV[y*(W+1)+x+1]=1;};
    for(let c=0;c<N;c++){const x=c%W,y=(c/W)|0;if(L.st[c]>=0)lk(x,y,L.st[c]);if(L.closet&&L.closet[c])for(let d=0;d<4;d++)lk(x,y,d);}
    for(const o of L.decor){lk(o.c%W,(o.c/W)|0,o.d);dec[o.c]=1;}
    const plain=c=>!L.fh[c]&&!L.ch[c]&&L.room[c]<0&&!(L.closet&&L.closet[c]);
    const pick=(i,per,tp,lkd,r,cA,cB,V,AK)=>{
      if(tp===7){AK[i]=1+((hsh(i,5)*3)|0)+(hsh(i,6)<0.4?4:0);return;}
      if(tp===0){if(!per&&plain(cA)&&plain(cB)&&r<0.2)AK[i]=1+((hsh(i,5)*3)|0);return;}
      if(tp!==1||lkd)return;
      if(per){if(r<0.40)V[i]=2;else if(r<0.64){V[i]=1;mur.push(cA>=0?cA:cB);}else if(r<0.77)V[i]=3;else if(r<0.88)V[i]=4;}
      else if(r<0.17){V[i]=1;mur.push(cA,cB);}else if(r<0.29)V[i]=3;else if(r<0.40)V[i]=4;};
    for(let i=0;i<L.hw.length;i++){const x=i%W,y=(i/W)|0;pick(i,y===0||y===H,L.hw[i],lkH[i],hsh(i,17),y>0?(y-1)*W+x:-1,y<H?y*W+x:-1,varH,akH);}
    for(let i=0;i<L.vw.length;i++){const x=i%(W+1),y=(i/(W+1))|0;pick(i,x===0||x===W,L.vw[i],lkV[i],hsh(i,91),x>0?y*W+x-1:-1,x<W?y*W+x:-1,varV,akV);}
    // holes in the ceiling: a few tiles grown into an odd shape. In a corridor they keep to the two rows against one wall,
    // so whoever is walking up there still has room to pass.
    for(let c=0;c<N;c++){if(L.fh[c]||L.ch[c]||L.st[c]>=0||dec[c]||(L.closet&&L.closet[c])||c===L.start||c===L.exit)continue;
      const x=c%W,y=(c/W)|0;let no=false;for(let d=0;d<4;d++)if(wget(L,x,y,d)===9)no=true;if(no)continue;
      const room=L.room[c]>=0;if(hsh(c,333)>(room?0.5:0.3))continue;
      const pr=mulberry32((c*7919+(seed|0)*31+5)>>>0),side=(pr()*4)|0,n=3+((pr()*(room?8:4))|0);
      const ok=(i,j)=>i>=0&&j>=0&&i<4&&j<4&&(room||(side===0?j<2:side===2?j>1:side===3?i<2:i>1));
      let ci=(pr()*4)|0,cj=(pr()*4)|0;if(!room){if(side===0)cj&=1;else if(side===2)cj=2+(cj&1);else if(side===3)ci&=1;else ci=2+(ci&1);}
      let m=1<<(cj*4+ci);const cells=[[ci,cj]];
      for(let t=0;t<40&&cells.length<n;t++){const b=cells[(pr()*cells.length)|0],d=(pr()*4)|0,ni=b[0]+DX[d],nj=b[1]+DY[d];if(!ok(ni,nj)||(m>>(nj*4+ni)&1))continue;m|=1<<(nj*4+ni);cells.push([ni,nj]);}
      cmask[c]=m;}
  }
  // how an opening is cut: where it starts and stops at each point along the wall (lo, hi), how far a point of wall is from it (sd),
  // and where its sides run straight (j0..j1). Every opening in one wall shares one half-width.
  const oRect=(y0,y1)=>({lo:()=>y0,hi:()=>y1,j0:y0,j1:y1,curved:false,flatLo:true,flatHi:true,
    sd:(dx,y,hw)=>{const ex=Math.abs(dx)-hw,ey=Math.max(y0-y,y-y1);return ex>0&&ey>0?Math.hypot(ex,ey):Math.max(ex,ey,0);}});
  const oDisc=(cy,r)=>({lo:dx=>cy-Math.sqrt(Math.max(0,r*r-dx*dx)),hi:dx=>cy+Math.sqrt(Math.max(0,r*r-dx*dx)),j0:0,j1:0,curved:true,flatLo:false,flatHi:false,
    sd:(dx,y)=>Math.max(Math.hypot(dx,y-cy)-r,0)});
  // an arch standing on y0 with its springing at ys; flip = the same arch hanging from the ceiling
  const oArch=(y0,ys,r,flip)=>{const top=dx=>ys+Math.sqrt(Math.max(0,r*r-dx*dx));
    return {lo:dx=>flip?WH-top(dx):y0,hi:dx=>flip?WH-y0:top(dx),j0:flip?WH-ys:y0,j1:flip?WH-y0:ys,curved:true,flatLo:!flip,flatHi:flip,
      sd:(dx,y)=>{const yy=flip?WH-y:y,ex=Math.abs(dx)-r;if(yy>=ys)return Math.max(Math.hypot(dx,yy-ys)-r,0);if(yy>=y0)return Math.max(ex,0);return ex>0?Math.hypot(ex,y0-yy):y0-yy;}};};
  for(world=0;world<2;world++){
  rng=mulberry32((seed*7+1234567)>>>0);starts.push(A.length/13);
  const FH=world?L.ch:L.fh,CH=world?L.fh:L.ch;
  // floors and ceilings. The ceiling is WH up, except where it is open to the sky: there the opening hangs down to LOWH inside a skirt of wall.
  for(let c=0;c<N;c++){const x=c%W,y=(c/W)|0,x0=x*C,x1=x0+C,z0=y*C,z1=z0+C;
    for(let layer=0;layer<2;layer++){const hole=layer?CH[c]:FH[c],Y=layer?(hole?LOWH:WH):0,sg=layer?-1:1;
      if(!hole){
        if(layer&&cmask[c]){const m=cmask[c],sol=(a,b)=>a<0||b<0||a>3||b>3||!(m>>(b*4+a)&1);
          for(let j=0;j<4;j++)for(let i=0;i<4;i++){const u0=x0+i*0.5,v0=z0+j*0.5;
            if(sol(i,j)){rect(1,WH,u0,u0+0.5,v0,v0+0.5,-1,0,NOE);continue;}
            // the cut edge of the ceiling: a cream curb all the way round, standing a little proud of the checker so the shape reads from the floor
            if(sol(i,j-1))box(u0,u0+0.5,WH-0.06,WH+CTH,v0,v0+0.08,1);
            if(sol(i,j+1))box(u0,u0+0.5,WH-0.06,WH+CTH,v0+0.42,v0+0.5,1);
            if(sol(i-1,j))box(u0,u0+0.08,WH-0.06,WH+CTH,v0,v0+0.5,1);
            if(sol(i+1,j))box(u0+0.42,u0+0.5,WH-0.06,WH+CTH,v0,v0+0.5,1);}
          continue;}
        rect(1,Y,x0,x1,z0,z1,sg,L.st[c]>=0?3:0,NOE);continue;}
      if(!layer){ // a hole in the floor: a thin margin of floor, and the cut edge going down
        rect(1,Y,x0,x1,z0,z0+h,sg,0,NOE);rect(1,Y,x0,x1,z1-h,z1,sg,0,NOE);rect(1,Y,x0,x0+h,z0+h,z1-h,sg,0,NOE);rect(1,Y,x1-h,x1,z0+h,z1-h,sg,0,NOE);
        const ya=Y-0.22,ef=[0,0,0,1];
        rect(2,z0+h,x0+h,x1-h,ya,Y,1,1,ef);rect(2,z1-h,x0+h,x1-h,ya,Y,-1,1,ef);rect(0,x0+h,z0+h,z1-h,ya,Y,1,1,ef);rect(0,x1-h,z0+h,z1-h,ya,Y,-1,1,ef);}
      const k0=Math.min(Y,Y+sg*0.12),k1=Math.max(Y,Y+sg*0.12),kh=h+0.012,lw=0.08; // the beam stands a hair proud of the wall posts, never level with them
      for(let d=0;d<4;d++){
        if(wget(L,x,y,d)){ // against a wall, an opening in the ceiling gets a cream lip (a solid moulding, nothing lying in the wall's own plane)
          if(layer){if(d===0)box(x0+h,x1-h,k0,k1,z0+h,z0+h+lw,1);else if(d===2)box(x0+h,x1-h,k0,k1,z1-h-lw,z1-h,1);else if(d===3)box(x0+h,x0+h+lw,k0,k1,z0+h,z1-h,1);else box(x1-h-lw,x1-h,k0,k1,z0+h,z1-h,1);}
          continue;}
        const n=(y+DY[d])*W+x+DX[d],nh=layer?CH[n]:FH[n];if(nh&&n<c)continue;
        if(d===0)box(x0,x1,k0,k1,z0-kh,z0+kh,1);else if(d===2)box(x0,x1,k0,k1,z1-kh,z1+kh,1);else if(d===3)box(x0-kh,x0+kh,k0,k1,z0,z1,1);else box(x1-kh,x1+kh,k0,k1,z0,z1,1);
        if(layer&&!nh){ // the skirt: wall from the low opening up to the high ceiling next door. A hair thinner than the walls, so it never shares a plane with their posts.
          const hs=h-0.004,E=[0,0,1,0];
          if(d===0||d===2){const zc=d===0?z0:z1;rect(2,zc-hs,x0,x1,Y,WH,-1,0,E);rect(2,zc+hs,x0,x1,Y,WH,1,0,E);rect(0,x0,zc-hs,zc+hs,Y,WH,-1,0,NOE);rect(0,x1,zc-hs,zc+hs,Y,WH,1,0,NOE);}
          else{const xc=d===3?x0:x1;rect(0,xc-hs,z0,z1,Y,WH,-1,0,E);rect(0,xc+hs,z0,z1,Y,WH,1,0,E);rect(2,z0,xc-hs,xc+hs,Y,WH,-1,0,NOE);rect(2,z1,xc-hs,xc+hs,Y,WH,1,0,NOE);}}}
    }}
  // walls
  function wall(ax,c,s0,s1,tp,eL,eR,vr,ak){
    const pa=ax==='x'?2:0,mid=(s0+s1)/2;
    const face=(sd,a0,a1,b0,b1,m,ef)=>rect(pa,c+sd*h,a0,a1,b0,b1,sd,m,ef);
    const lbox=(a0,a1,y0,y1,d0,d1,m,uvm)=>ax==='x'?box(a0,a1,y0,y1,c+d0,c+d1,m,uvm):box(c+d0,c+d1,y0,y1,a0,a1,m,uvm);
    const hrim=(y,a0,a1,sg)=>ax==='x'?rect(1,y,a0,a1,c-h,c+h,sg,1,[0,0,1,1]):rect(1,y,c-h,c+h,a0,a1,sg,1,[1,1,0,0]);
    const vrim=(s,y0,y1,sg)=>rect(ax==='x'?0:2,s,c-h,c+h,y0,y1,sg,1,[1,1,0,0]);
    const P3=(s,y,d)=>ax==='x'?[s,y,c+d]:[c+d,y,s];
    let sh=[],hw=0;
    if(tp===2||tp===3){hw=WIN_W/2;sh=[oRect(WIN_Y0,WIN_Y1),oRect(WH-WIN_Y1,WH-WIN_Y0)];}
    else if(tp===1&&vr===2){hw=0.72;sh=[oRect(0.52,2.48),oRect(WH-2.48,WH-0.52)];}
    else if(tp===5){hw=RND_R;sh=[oDisc(RND_Y,RND_R),oDisc(WH-RND_Y,RND_R)];}
    else if(tp===7||tp===0){const D=archDims(ak);hw=D.r;sh=[oArch(D.y0,D.ys,D.r,false),oArch(D.y0,D.ys,D.r,true)];}
    else if(tp===6){hw=DOOR_W/2;sh=[oRect(0,DOOR_H)];}
    else if(tp===8){hw=0.21;sh=[oRect(0,0.72)];}
    else if(tp===9){hw=0.21;sh=[oRect(WH-0.72,WH)];}
    const m0=tp===4?3:tp===1&&vr===1?14:tp===1&&vr===3?16:0,a=mid-hw,b=mid+hw;
    for(let k=0;k<2;k++){const sd=k?1:-1,el=eL[k],er=eR[k],nrm=ax==='x'?[0,0,sd]:[sd,0,0];
      if(!sh.length){face(sd,s0,s1,0,WH,m0,[el,er,1,1]);continue;}
      // the wall either side of the openings, cut into rows so that the ink line follows only the straight sides
      const ys=[0,WH];for(const o of sh)if(o.j1>o.j0)ys.push(o.j0,o.j1);ys.sort((p,q)=>p-q);
      for(let i=0;i+1<ys.length;i++){const r0=ys[i],r1=ys[i+1];if(r1-r0<1e-6)continue;const ym=(r0+r1)/2,jm=sh.some(o=>ym>o.j0&&ym<o.j1)?1:0;
        face(sd,s0,a,r0,r1,0,[el,jm,r0===0?1:0,r1===WH?1:0]);face(sd,b,s1,r0,r1,0,[jm,er,r0===0?1:0,r1===WH?1:0]);}
      // the strip between them: whatever is left under, over and between the openings
      const ns=sh.some(o=>o.curved)?14:1;
      for(let i=0;i<ns;i++){const xa=a+(b-a)*i/ns,xb=a+(b-a)*(i+1)/ns,da=xa-mid,db=xb-mid;
        for(let j=0;j<=sh.length;j++){const lo=j?sh[j-1]:null,up=j<sh.length?sh[j]:null;
          const ba=lo?lo.hi(da):0,bb=lo?lo.hi(db):0,ta=up?up.lo(da):WH,tb=up?up.lo(db):WH;
          if(ta-ba<1e-4&&tb-bb<1e-4)continue;
          const vtx=(s,dx,y)=>{const p=P3(s,y,sd*h);return [p[0],p[1],p[2],s,y,lo?lo.sd(dx,y,hw):9,up?up.sd(dx,y,hw):9,lo?9:y,up?9:WH-y];};
          Q([vtx(xa,da,ba),vtx(xb,db,bb),vtx(xb,db,tb),vtx(xa,da,ta)],nrm,0);}}
    }
    if(tp===5||tp===7||tp===0){ // the thickness of the wall, shown cream in each opening
      const rv=(s,y,d,u)=>{const p=P3(s,y,d);return [p[0],p[1],p[2],u,d,d+h,h-d,9,9];};
      for(const o of sh){const yc=(o.lo(0)+o.hi(0))/2;
        if(o.j1>o.j0){vrim(a,o.j0,o.j1,1);vrim(b,o.j0,o.j1,-1);}
        for(let e=0;e<2;e++){const fn=e?o.hi:o.lo,flat=e?o.flatHi:o.flatLo;
          if(flat){const yv=fn(0);if(yv>1e-3&&yv<WH-1e-3)hrim(yv,a,b,e?-1:1);continue;}
          const ns=14;let u=0;for(let i=0;i<ns;i++){const xa=a+(b-a)*i/ns,xb=a+(b-a)*(i+1)/ns,ya=fn(xa-mid),yb=fn(xb-mid),ln=Math.hypot(xb-xa,yb-ya);if(ln<1e-5)continue;
            let nx=-(yb-ya)/ln,ny=(xb-xa)/ln;if(nx*(mid-(xa+xb)/2)+ny*(yc-(ya+yb)/2)<0){nx=-nx;ny=-ny;}
            Q([rv(xa,ya,-h,u),rv(xb,yb,-h,u+ln),rv(xb,yb,h,u+ln),rv(xa,ya,h,u)],ax==='x'?[nx,ny,0]:[0,ny,nx],1);u+=ln;}}}
    }
    if(tp===2||tp===3){const n=tp===3?2:(rng()<0.5?2:3);windowFrame(ax,c,a,b,WIN_Y0,WIN_Y1,n,tp===3);windowFrame(ax,c,a,b,WH-WIN_Y1,WH-WIN_Y0,n,tp===3);}
    else if(tp===1&&vr===2){windowFrame(ax,c,a,b,0.52,2.48,4,false);windowFrame(ax,c,a,b,WH-2.48,WH-0.52,4,false);}
    else if(tp===8||tp===9){const y0=tp===8?0:WH-0.72,y1=y0+0.72,j0=tp===8?0:y0-0.035,j1=tp===8?y1+0.035:WH,l0=tp===8?y1:y0-0.035;
      lbox(a-0.035,a,j0,j1,-0.085,0.085,2,1);lbox(b,b+0.035,j0,j1,-0.085,0.085,2,1);lbox(a,b,l0,l0+0.035,-0.085,0.085,2,1);}
    else if(tp===6){const y1=DOOR_H;
      lbox(a-0.1,a,0,y1+0.1,-0.11,0.11,1);lbox(b,b+0.1,0,y1+0.1,-0.11,0.11,1);lbox(a,b,y1,y1+0.1,-0.11,0.11,1);
      lbox(a,b,-0.01,0.02,-0.09,0.09,2,1);
      const inner=c===0?1:-1,no=L.need||L.orbs.length;
      for(let i=0;i<no;i++){const s=mid+(i-(no-1)/2)*0.26;lbox(s-0.085,s+0.085,2.465,2.635,inner>0?h:-h-0.03,inner>0?h+0.03:-h,1);}
    }
    if(tp===1&&vr===4){ // doors of every size: standing, hanging head-down from the ceiling, or opening onto nothing halfway up
      const pr=mulberry32((Math.round(c*131+mid*17)+(seed|0)*7+(ax==='x'?0:9973))>>>0),SZ=[[0.42,0.84],[0.62,1.24],[0.85,1.7],[1.1,2.2],[1.35,3.3],[0.8,4.4]];
      const door=(s,y0,w,hg,flip)=>{const fr=Math.max(0.04,w*0.07),ya=y0-(y0>1e-3?fr:0),yb=y0+hg+(y0+hg<WH-1e-3?fr:0);
        for(let k=0;k<2;k++){const sd=k?1:-1,d0=sd>0?h:-h-0.05,d1=sd>0?h+0.05:-h;
          lbox(s-w/2-fr,s-w/2,ya,yb,d0,d1,1);lbox(s+w/2,s+w/2+fr,ya,yb,d0,d1,1);
          if(y0+hg<WH-1e-3)lbox(s-w/2,s+w/2,y0+hg,y0+hg+fr,d0,d1,1);
          if(y0>1e-3)lbox(s-w/2-fr-0.05,s+w/2+fr+0.05,y0-fr,y0,sd>0?h:-h-0.13,sd>0?h+0.13:-h,1);
          rect(pa,c+sd*(h+0.03),s-w/2,s+w/2,y0,y0+hg,sd,6,ALL,flip?[0,1,2,0]:[0,1,0,2]);
          const kx=s+(w/2-w*0.16)*sd,ky=y0+hg*(flip?0.55:0.45),ks=Math.max(0.022,w*0.034);
          lbox(kx-ks,kx+ks,ky-ks,ky+ks,sd>0?h+0.03:-h-0.03-ks*2,sd>0?h+0.03+ks*2:-h-0.03,7);}};
      const span=(s1-s0)-0.3;
      {const z=SZ[(pr()*SZ.length)|0],w=z[0],hg=z[1],stand=w>=0.8&&pr()<0.6;door(mid+(pr()-0.5)*Math.max(0,span-w),stand?0:0.5+pr()*1.1,w,hg,false);
        if(hg<3.4&&pr()<0.6){const z2=SZ[(pr()*4)|0],w2=z2[0],h2=z2[1],hang=w2>=0.8&&pr()<0.5;door(mid+(pr()-0.5)*Math.max(0,span-w2),hang?WH-h2:WH-h2-0.5-pr()*0.9,w2,h2,hang);}}
    }
  }
  const vN=(vx,vy)=>vy>0?(L.vw[(vy-1)*(W+1)+vx]||akV[(vy-1)*(W+1)+vx]):0,vS=(vx,vy)=>vy<H?(L.vw[vy*(W+1)+vx]||akV[vy*(W+1)+vx]):0;
  const vW=(vx,vy)=>vx>0?(L.hw[vy*W+vx-1]||akH[vy*W+vx-1]):0,vE=(vx,vy)=>vx<W?(L.hw[vy*W+vx]||akH[vy*W+vx]):0;
  for(let y=0;y<=H;y++)for(let x=0;x<W;x++){const i=y*W+x,tp=L.hw[i];if(!tp&&!akH[i])continue;
    wall('x',y*C,x*C+h,(x+1)*C-h,tp,[vN(x,y)?1:0,vS(x,y)?1:0],[vN(x+1,y)?1:0,vS(x+1,y)?1:0],varH[i],akH[i]);}
  for(let y=0;y<H;y++)for(let x=0;x<=W;x++){const i=y*(W+1)+x,tp=L.vw[i];if(!tp&&!akV[i])continue;
    wall('z',x*C,y*C+h,(y+1)*C-h,tp,[vW(x,y)?1:0,vE(x,y)?1:0],[vW(x,y+1)?1:0,vE(x,y+1)?1:0],varV[i],akV[i]);}
  for(let vy=0;vy<=H;vy++)for(let vx=0;vx<=W;vx++){
    const n=vN(vx,vy),s=vS(vx,vy),w=vW(vx,vy),e=vE(vx,vy);if(!n&&!s&&!w&&!e)continue;
    const x0=vx*C-h,x1=vx*C+h,z0=vy*C-h,z1=vy*C+h;
    if(!n)rect(2,z0,x0,x1,0,WH,-1,0,[w?0:1,e?0:1,1,1]);
    if(!s)rect(2,z1,x0,x1,0,WH,1,0,[w?0:1,e?0:1,1,1]);
    if(!w)rect(0,x0,z0,z1,0,WH,-1,0,[n?0:1,s?0:1,1,1]);
    if(!e)rect(0,x1,z0,z1,0,WH,1,0,[n?0:1,s?0:1,1,1]);
  }
  // free-standing pillars inside the halls
  for(const pl of (L.pillars||[])){const px=pl[0]*C,pz=pl[1]*C,c=Math.min(H-1,pl[1])*W+Math.min(W-1,pl[0]);
    box(px-0.2,px+0.2,0.14,WH-0.14,pz-0.2,pz+0.2,0);
    box(px-0.3,px+0.3,0,0.14,pz-0.3,pz+0.3,1);box(px-0.3,px+0.3,WH-0.14,WH,pz-0.3,pz+0.3,1);
    const r=[px-0.3,pz-0.3,px+0.3,pz+0.3];addRect(0,c,r,99);addRect(1,c,r,99);}
  // things mounted on the inner face of a cell wall
  function cbox(c,d,a0,a1,y0,y1,p0,p1,m,uvm){
    const cx=(c%W+0.5)*C,cz=(((c/W)|0)+0.5)*C,f=C/2-h;let r;
    if(d===0)r=[cx+a0,cz-f+p0,cx+a1,cz-f+p1];else if(d===2)r=[cx+a0,cz+f-p1,cx+a1,cz+f-p0];
    else if(d===3)r=[cx-f+p0,cz+a0,cx-f+p1,cz+a1];else r=[cx+f-p1,cz+a0,cx+f-p0,cz+a1];
    if(m>=0)box(r[0],r[2],y0,y1,r[1],r[3],m,uvm);return r;
  }
  function cface(c,d,a0,a1,y0,y1,p,m,uvm){
    const cx=(c%W+0.5)*C,cz=(((c/W)|0)+0.5)*C,f=C/2-h;
    if(d===0)rect(2,cz-f+p,cx+a0,cx+a1,y0,y1,1,m,ALL,uvm);else if(d===2)rect(2,cz+f-p,cx+a0,cx+a1,y0,y1,-1,m,ALL,uvm);
    else if(d===3)rect(0,cx-f+p,cz+a0,cz+a1,y0,y1,1,m,ALL,uvm);else rect(0,cx+f-p,cz+a0,cz+a1,y0,y1,-1,m,ALL,uvm);
  }
  const NS=Math.round(WH/0.25);
  for(let c=0;c<N;c++){const d=L.st[c];if(d<0)continue;
    for(let i=0;i<NS;i++){const dep=0.09+0.5*Math.pow(Math.abs(1-2*(i+0.5)/NS),1.5);cbox(c,d,-0.55,0.55,i*WH/NS,(i+1)*WH/NS,0,dep,1);}
  }
  for(const o of L.decor){
    for(let j=0;j<5;j++){const hj=(o.rev?5-j:j+1)*0.15;
      cbox(o.c,o.d,-0.6+j*0.24,-0.6+(j+1)*0.24,o.layer?WH-hj:0,o.layer?WH:hj,0,0.36,1);}
    const r=cbox(o.c,o.d,-0.6,0.6,0,0,0,0.36,-1);addRect(o.layer,o.c,r,0.75);if(!world)shr[o.layer][o.c]=r;
  }
  // fragments adrift outside the maze
  {const mx=W*C/2,mz=H*C/2,rad=Math.hypot(mx,mz),n=14+Math.round(N/8);
    for(let k=0;k<n;k++){
      const ang=(k+rng())/n*PI*2,rr=rad+3.5+rng()*13,x=mx+Math.cos(ang)*rr,z=mz+Math.sin(ang)*rr,y=-5+rng()*13,ty=(rng()*5)|0;
      const alongX=Math.abs(Math.cos(ang))<Math.abs(Math.sin(ang));
      if(ty===0){const up=rng()<0.5?1:-1;for(let j=0;j<7;j++){const q0=j*0.42,yy=y+up*j*0.26;
        if(alongX)box(x+q0,x+q0+0.42,yy,yy+0.26,z-0.9,z+0.9,1);else box(x-0.9,x+0.9,yy,yy+0.26,z+q0,z+q0+0.42,1);}}
      else if(ty===1)box(x-1.5,x+1.5,y,y+0.14,z-1.5,z+1.5,0);
      else if(ty===2){const s=1.0+rng()*0.5;
        if(alongX){windowFrame('x',z,x-s,x+s,y,y+2*s,3,true);}else{windowFrame('z',x,z-s,z+s,y,y+2*s,3,true);}}
      else if(ty===3){if(alongX)box(x-0.9,x+0.9,y,y+0.1,z-0.5,z+0.5,2,1);else box(x-0.5,x+0.5,y,y+0.1,z-0.9,z+0.9,2,1);}
      else{if(alongX)box(x-1.5,x+1.5,y,y+3,z-0.07,z+0.07,0);else box(x-0.07,x+0.07,y,y+3,z-1.5,z+1.5,0);}
    }}
  if(world===0&&G.li===0)wallWriting();
  counts.push(A.length/13-starts[world]);
  }
  const nStatic=A.length/13;
  // door leaf, hinge at local origin
  box(0,DOOR_W,0,DOOR_H,-0.03,0.03,2,1);
  rect(2,0.034,0,DOOR_W,0,DOOR_H,1,6,ALL,[0,1,0,2]);rect(2,-0.034,0,DOOR_W,0,DOOR_H,-1,6,ALL,[0,1,0,2]);
  box(DOOR_W-0.2,DOOR_W-0.12,1.0,1.08,-0.1,0.1,7);
  const doorStart=nStatic,doorCount=A.length/13-nStatic;
  // mini door leaf, hinge at local origin
  const mdStart=A.length/13;
  box(0,0.42,0,0.72,-0.015,0.015,2,1);
  rect(2,0.019,0,0.42,0,0.72,1,6,ALL,[0,1,0,2]);rect(2,-0.019,0,0.42,0,0.72,-1,6,ALL,[0,1,0,2]);
  box(0.31,0.35,0.34,0.38,-0.04,0.04,7);
  const mdCount=A.length/13-mdStart;
  // unit sphere
  const sphStart=A.length/13,LA=12,LO=20;
  const sv=(i,j)=>{const th=i/LA*PI,ph=j/LO*PI*2,x=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);A.push(x,y,z,x,y,z,0,0,9,9,9,9,5);};
  for(let i=0;i<LA;i++)for(let j=0;j<LO;j++){sv(i,j);sv(i+1,j);sv(i+1,j+1);sv(i,j);sv(i+1,j+1);sv(i,j+1);}
  const sphCount=A.length/13-sphStart;
  // the way out, built once around the origin (stairs toward +x) and set down on the cell where the moon is taken
  let lad=null,tun=null,deep=null,hatch=null;
  {const ps=()=>A.length/13;let k=ps();
    box(0.23,0.27,0,LT,-0.22,-0.18,11);box(0.23,0.27,0,LT,0.18,0.22,11);
    for(let y=0.3;y<LH-0.1;y+=0.35)box(0.235,0.265,y-0.015,y+0.015,-0.18,0.18,11);
    lad=[k,ps()-k];k=ps();
    // one more length of the same ladder, hanging below the floor with the rungs in step: drawn again and again, further and further down
    box(0.23,0.27,-DEEP,0,-0.22,-0.18,11);box(0.23,0.27,-DEEP,0,0.18,0.22,11);
    for(let j=1;j<=DEEP_N;j++){const y=0.3-0.35*j;box(0.235,0.265,y-0.015,y+0.015,-0.18,0.18,11);}
    deep=[k,ps()-k];k=ps();
    const c0=LH+3.5;
    // landing: a floor with a hatch for the ladder, three walls, a roof
    box(-1,-0.9,LH-0.12,LH,-0.93,0.93,8);box(0.45,XS,LH-0.12,LH,-0.93,0.93,8);
    box(-0.9,0.45,LH-0.12,LH,-0.93,-0.45,8);box(-0.9,0.45,LH-0.12,LH,0.45,0.93,8);
    box(-1.07,-1,LH-0.12,c0,-1,1,8);box(-1,XS,LH-0.12,c0,0.93,1,8);box(-1,XS,LH-0.12,c0,-1,-0.93,8);box(-1.07,XS,c0,c0+0.12,-1,1,8);
    for(let i=0;i<NSTEP;i++){const top=LH+(i+1)*SR;box(XS+i*SD,XS+(i+1)*SD,top-1.2,top,-0.86,0.86,9);}
    let prev=c0;
    for(let x0=XS;x0<XE-1e-6;x0+=2){const x1=Math.min(XE,x0+2),ceil=hx(x1)+3.5,bot=hx(x0)-1.4;
      box(x0,x1,bot,ceil,0.86,0.93,8);box(x0,x1,bot,ceil,-0.93,-0.86,8);
      box(x0,x1,ceil,ceil+0.12,-0.93,0.93,8);box(x0,x0+0.12,prev,ceil,-0.93,0.93,8);prev=ceil;}
    const ft=hx(XE);
    box(XE,XE+0.12,ft-1.4,ft+3.5,-0.93,0.93,8);box(XE-0.03,XE,ft,ft+2.15,-0.42,0.42,10);
    tun=[k,ps()-k];k=ps();
    // seen from below, all of that is hidden: only the hatch shows, a black square the ladder goes up into
    box(-0.9,0.45,LH-0.13,LH-0.11,-0.45,0.45,8);
    hatch=[k,ps()-k];}
  return {writ,data:new Float32Array(A),starts,counts,doorStart,doorCount,mdStart,mdCount,sphStart,sphCount,rects,shr,lad,tun,deep,hatch,varH,varV,akH,akV,cmask,mur};
}
/* ---------- game state ---------- */
// Each chamber has its own weather: sky horizon/zenith, cloud, meadow tint, fog, daylight, ambient, print tint.
const MOODS=[
  {H:[0.50,0.70,1.00],Z:[0.12,0.34,0.90],C:[1.00,0.99,0.96],G:[1.00,1.00,1.00],fog:[0.030,0.032,0.075],day:[0.86,0.94,1.00],amb:[0.038,0.042,0.070],tint:[1.00,0.99,1.02]},
  {H:[1.00,0.66,0.56],Z:[0.34,0.22,0.62],C:[1.00,0.84,0.80],G:[0.78,0.82,0.80],fog:[0.065,0.030,0.070],day:[1.00,0.74,0.62],amb:[0.058,0.038,0.060],tint:[1.05,0.97,1.02]},
  {H:[0.50,0.44,0.86],Z:[0.09,0.08,0.30],C:[0.80,0.76,0.98],G:[0.42,0.58,0.80],fog:[0.028,0.024,0.085],day:[0.60,0.62,1.00],amb:[0.036,0.036,0.076],tint:[0.98,0.98,1.08]},
  {H:[0.80,0.93,0.84],Z:[0.40,0.66,0.62],C:[0.98,1.00,0.96],G:[0.86,1.00,0.80],fog:[0.028,0.055,0.055],day:[0.80,1.00,0.90],amb:[0.036,0.056,0.054],tint:[0.98,1.03,1.00]}
];
// The words on the wall of the first chamber, painted by hand in white with a dark edge: a canvas made once (and again when the hand-lettering font arrives).
let writT=null,writFont=false;
function writTex(){
  if(writT&&writT.ok)return writT.tex;
  if(!writT){writT={tex:gl.createTexture(),ok:false};
    try{document.fonts.load('60px "Rock Salt"').then(()=>{writFont=true;if(writT)writT.ok=false;}).catch(()=>{});}catch(e){}}
  const cv=document.createElement('canvas');cv.width=1024;cv.height=632;const x=cv.getContext('2d');
  const lines=['Sometimes you need','to take a few steps backwards','to overcome an obstacle.'];
  x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
  let fs=60;x.font=fs+'px "Rock Salt","Segoe Print","Comic Sans MS",cursive';
  const widest=Math.max(...lines.map(t=>x.measureText(t).width));if(widest>940){fs=Math.floor(fs*940/widest);x.font=fs+'px "Rock Salt","Segoe Print","Comic Sans MS",cursive';}
  const rr=mulberry32(77);
  lines.forEach((t,i)=>{const yy=130+i*186;x.save();x.translate(512+(rr()-0.5)*24,yy);x.rotate((rr()-0.5)*0.05);
    x.lineWidth=fs*0.16;x.strokeStyle='rgba(8,10,14,0.92)';x.strokeText(t,0,0);   // a dark edge so the white reads on the white squares too
    x.fillStyle='#f6f4ee';x.fillText(t,0,0);x.restore();});
  gl.bindTexture(gl.TEXTURE_2D,writT.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  writT.ok=writFont||!(document.fonts&&document.fonts.check)?true:document.fonts.check('60px "Rock Salt"');
  return writT.tex;
}
// The far side of the windows is always the same red night.
const NIGHT={H:[0.10,0.03,0.08],Z:[0.03,0.03,0.09],C:[1,1,1],G:[1,1,1],fog:[0.034,0.012,0.030],day:[0.34,0.40,0.82],amb:[0.062,0.036,0.050],tint:[1.05,0.95,1.02]};
const STAR=[0.30,0.42,0.90];
let lvl=null,R=null,flip=null,xing=null;
const moodOf=w=>w?NIGHT:G.mood;
// The moon is the big planet in the sky, and it is only in the red room's sky (world 1): almost straight overhead and, the night there being
// the same in every direction, mirrored almost straight underfoot. The ordinary rooms never show it, and neither does a window from the side.
// Wherever in the red room it can be seen, up through an opening in the ceiling or down through one in the floor, aim at it and press E or click.
const PD=[0.0597,0.9946,0.0845],PDD=[PD[0],-PD[1],PD[2]],MOON_R=0.17; // MOON_R: a little more than the disc's own angular radius
function moonAim(){
  if(G.plucked||P.w!==1||G.climb||flip||xing||G.mode!=='play')return null;
  const C=cameraMaze(),F=C.F;
  for(const dn of [false,true]){const D=dn?PDD:PD;if(F[0]*D[0]+F[1]*D[1]+F[2]*D[2]<Math.cos(MOON_R))continue;
    const c=moonRay(C.eye,F,dn);if(c>=0)return {c,down:dn};}
  return null;
}
// Follow the line of sight out of the building. Returns the opening it leaves by (-1 if a wall, the ceiling or the floor is in the way).
// In the red room the openings are exchanged: the ceiling is open where the ordinary floor has a pit (lvl.fh), the floor where the ordinary ceiling is open (lvl.ch).
// An opening in the ceiling is a shaft from LOWH up through the roof; one in the floor is a hole through the slab.
function moonRay(E,F,dn){
  const L=lvl,W=L.W,CHo=L.fh,FHo=L.ch,cell=(x,z)=>{const gx=Math.floor(x/CELL),gy=Math.floor(z/CELL);return inb(L,gx,gy)?gy*W+gx:-1;};
  let x=E[0],y=E[1],z=E[2],pc=cell(x,z),shaft=-1;if(pc<0)return -1;
  const top=WH+CTH+0.05,bot=-CTH-0.05,st=0.03;
  for(let i=0;i<4000;i++){
    const py=y;x+=F[0]*st;y+=F[1]*st;z+=F[2]*st;
    if(dn?y<bot:y>top)return dn?pc:shaft;                    // out under the open sky
    const c=cell(x,z);if(c<0)return -1;
    if(c!==pc){const dx=c%W-pc%W,dy=((c/W)|0)-((pc/W)|0);
      if(Math.abs(dx)+Math.abs(dy)!==1)return -1;             // through a corner: call it blocked
      if(y>0&&y<WH&&wget(L,pc%W,(pc/W)|0,dx===1?1:dx===-1?3:dy===1?2:0))return -1; // a wall (glass included: never from the side)
      if(shaft>=0&&!CHo[c])return -1;                          // the shaft's own walls
      if(!dn&&shaft<0&&y>LOWH&&CHo[c])return -1;               // the outside of a shaft
      if(dn&&y<0&&!FHo[c])return -1;
      pc=c;}
    if(!dn){if(py<=LOWH&&y>LOWH&&CHo[pc])shaft=pc;            // into the bottom of a shaft
      if(shaft<0&&y>=WH)return -1;}                            // the ceiling
    else if(py>=0&&y<0&&!FHo[pc])return -1;                    // the floor
  }
  return -1;
}
// Where the ladder comes down once the moon is taken: up a shaft you could stand under, right there; otherwise on your own cell,
// or the nearest cell you can walk to from it. Never on a hole in the floor (nothing to stand on to climb it), a wall staircase or the red door's cell.
// That holds wherever you took it from: standing on the floor, or upside down on the ceiling looking down through a hole.
function ladderCell(a){
  const L=lvl,ok=c=>c>=0&&L.st[c]<0&&!blockedAt(L,c,0,P.w)&&c!==L.exit;
  if(!a.down&&ok(a.c))return a.c;
  const pc=curCell();if(ok(pc))return pc;
  const from=pc>=0?pc:a.c,dist=bfsDist(L,from);let best=-1,bd=1e9;
  for(let c=0;c<L.W*L.H;c++){if(dist[c]<0||!ok(c))continue;const d=dist[c]*10+Math.hypot((c%L.W+0.5)*CELL-P.x,(((c/L.W)|0)+0.5)*CELL-P.z);if(d<bd){bd=d;best=c;}}
  return best>=0?best:from;
}
// The ladder comes down on the very cell you took the moon from; the stairs lead off the way you were facing.
function placeStairs(c0){
  const W=lvl.W,c=c0!=null&&c0>=0?c0:curCell(),cx=(c%W+0.5)*CELL,cz=(((c/W)|0)+0.5)*CELL;
  // on your own cell it faces the way you face; on another cell it faces away from you, so that you walk up to it from the front
  let fx=Math.sin(P.yaw),fz=Math.cos(P.yaw);if(c!==curCell()&&Math.hypot(cx-P.x,cz-P.z)>0.3){fx=cx-P.x;fz=cz-P.z;}
  const nx=Math.abs(fx)>=Math.abs(fz)?Math.sign(fx):0,nz=nx?0:Math.sign(fz)||1;
  return {c,w:P.w,cx,cz,nx,nz,lx:-nz,lz:nx,th:Math.atan2(-nz,nx)};
}
// Sent here from the white screen (js/hub.js): the moon is already in your hand, the ladder is down, the mist has the whole building,
// and you are on the ladder u metres above the floor. Up is the black stair; down is the water.
function toLadder(u){
  const L=lvl,W=L.W;let c=curCell();
  if(c<0||!L.ch[c]||L.fh[c]){for(let i=0;i<W*L.H;i++)if(L.ch[i]&&!L.fh[i]&&L.st[i]<0){c=i;break;}P.x=(c%W+0.5)*CELL;P.z=(((c/W)|0)+0.5)*CELL;} // it comes down through an opening in the ceiling
  G.M=placeStairs();G.plucked=true;G.pk=-1;G.hit=true;G.crack=1;G.opening=true;G.open=1;G.hold=1;bakeLight();
  poolPreload();G.climb=true;G.deep=true;G.cu=u;G.cl=0;G.ca=0;P.vx=P.vz=0;P.pitch=0;climbPos();Snd.droneOn();
}
function toStart(){const W=lvl.W,c=lvl.start;P.x=(c%W+0.5)*CELL;P.z=(((c/W)|0)+0.5)*CELL;P.g=1;P.w=0;P.small=!!SCF_SAVE.get('small');P.size=P.small?0.28:1;P.jy=0;P.vy=0;P.vx=P.vz=0;P.pitch=0;}
function loadLevel(li,seed){
  const cfg=cfgFor(li);G.li=li;SCF_SAVE.set('scene','level1');SCF_SAVE.set('li',li); // Continue picks up at the start of this maze
  G.seed=seed!=null?seed:(cfg.seed!=null?cfg.seed:((Math.random()*90000)|0)+1000);
  G.mood=MOODS[li%MOODS.length];
  lvl=generate(cfg,G.seed);
  G.M=null;G.hit=false;G.crack=0;G.cu=0;G.ca=0;G.pix=0;G.walked=0;G.wr=0;G.cry=4;
  G.deep=false;G.wat=0;G.sea=0;G.drown=0;G.splash=false;G.gone=false;
  G.pk=-1;G.plucked=false;G.open=0;G.opening=false;G.climb=false;G.cs=0;G.cl=0;G.shock=0;G.flashA=0;G.fovAdd=0;G.hold=0;G.dark=0;G.beat=0;G.stepS=0;Snd.droneOff();
  R=buildGeometry(lvl,G.seed);
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,R.data,gl.STATIC_DRAW);
  const W=lvl.W,H=lvl.H;
  G.orbs=lvl.orbs.map((c,i)=>({c,w:lvl.orbW[i]||0,x:(c%W+0.5)*CELL,z:(((c/W)|0)+0.5)*CELL,got:false,t:0,seed:1+i*3.7+(G.seed%13),ph:i*1.7}));
  G.props=lvl.props.map((q,i)=>({x:q.x*CELL,z:q.y*CELL,s:q.s,seed:20+i*5.3+(G.seed%7)}));
  placeGhost();
  // mini doors: one swinging leaf per door-sized hole in a wall
  G.mdoors=[];G.mdH=new Array(lvl.hw.length);G.mdV=new Array(lvl.vw.length);
  for(let i=0;i<lvl.hw.length;i++){const tp=lvl.hw[i];if(tp<8)continue;const x=i%W,y=(i/W)|0,mid=(x+0.5)*CELL,c=y*CELL;
    const d={ax:'x',c,mid,layer:tp===8?0:1,y0:tp===8?0:WH-0.72,hx:mid-0.21,hz:c,th0:0,px:mid,pz:c,open:0,opened:false,sgn:1};G.mdoors.push(d);G.mdH[i]=d;}
  for(let i=0;i<lvl.vw.length;i++){const tp=lvl.vw[i];if(tp<8)continue;const x=i%(W+1),y=(i/(W+1))|0,mid=(y+0.5)*CELL,c=x*CELL;
    const d={ax:'z',c,mid,layer:tp===8?0:1,y0:tp===8?0:WH-0.72,hx:c,hz:mid-0.21,th0:-PI/2,px:c,pz:mid,open:0,opened:false,sgn:1};G.mdoors.push(d);G.mdV[i]=d;}
  const sx=lvl.start%W,sy=(lvl.start/W)|0;
  P.x=(sx+0.5)*CELL;P.z=(sy+0.5)*CELL;P.g=1;P.w=0;P.pitch=0;P.vx=P.vz=P.av=0;P.bob=0;P.amp=0;P.small=!!SCF_SAVE.get('small');P.size=P.small?0.28:1;P.cr=0;P.jy=0;P.vy=0;G.jb=0;G.coyote=0.1;
  let bd=0,bl=-1;for(let d=0;d<4;d++){let l=0,x=sx,y=sy;while(!wget(lvl,x,y,d)){x+=DX[d];y+=DY[d];l++;}if(l>bl){bl=l;bd=d;}}
  P.yaw=Math.atan2(DX[bd],DY[bd]);
  if(R.writ)P.yaw=Math.atan2(DX[R.writ[2]],DY[R.writ[2]]); // first chamber: you come in facing the words on the wall
  G.time=0;G.door=0;G.doorOpen=false;G.push=G.pushW=G.pushS=0;G.cool=G.coolS=0;G.got=0;G.tCrouch=false;flip=null;xing=null;
  const x=lvl.exit%W,y=(lvl.exit/W)|0,d=lvl.exitDir,D={out:[DX[d],DY[d]]};
  if(d===0||d===2){D.ax='x';D.c=(d===0?y:y+1)*CELL;D.mid=(x+0.5)*CELL;D.hx=D.mid-DOOR_W/2;D.hz=D.c;D.th0=0;}
  else{D.ax='z';D.c=(d===3?x:x+1)*CELL;D.mid=(y+0.5)*CELL;D.hx=D.c;D.hz=D.mid-DOOR_W/2;D.th0=-PI/2;}
  const th=D.th0+PI/2;D.sgn=(Math.cos(th)*D.out[0]-Math.sin(th)*D.out[1])>0?1:-1;G.D=D;
  // one socket above the red door for every planet in the chamber
  const inner=D.c===0?1:-1,n=lvl.need||G.orbs.length;G.sockets=[];   // only as many sockets as the door wants
  for(let i=0;i<n;i++){const s=D.mid+(i-(n-1)/2)*0.26,dd=D.c+inner*(T/2+0.075);G.sockets.push(D.ax==='x'?[s,2.55,dd]:[dd,2.55,s]);}
  bakeLight();
}
// Light pools: daylight through openings, starlight through the roof, lamp-warm stairs, the glow of planets and of the far world
// leaking through its windows. Everything else stays dim. One map per world.
function bakeLight(){
  const L=lvl,W=L.W,H=L.H,N=W*H,best=new Float32Array(N);
  for(let w=0;w<2;w++){
    const acc=new Float32Array(N*3),m=moodOf(w),FH=w?L.ch:L.fh,CH=w?L.fh:L.ch,day=w?STAR:G.mood.day;
    const add=(c,col,I)=>{best.fill(0);best[c]=I;const q=[c];
      for(let i=0;i<q.length;i++){const k=q[i],x=k%W,y=(k/W)|0,v=best[k];if(v<0.03)continue;
        for(let d=0;d<4;d++){const tp=wget(L,x,y,d);let f=0.44;if(tp){if(tp===2)f=0.18;else continue;}
          const nx=x+DX[d],ny=y+DY[d];if(!inb(L,nx,ny))continue;const n=ny*W+nx;if(v*f>best[n]+0.005){best[n]=v*f;q.push(n);}}}
      for(let i=0;i<N;i++){const b=best[i];if(b>0){acc[i*3]+=col[0]*b;acc[i*3+1]+=col[1]*b;acc[i*3+2]+=col[2]*b;}}};
    for(let c=0;c<N;c++){const x=c%W,y=(c/W)|0;
      if(L.fh[c]&&L.ch[c])add(c,[1.00,0.40,0.24],0.34);
      if(FH[c])add(c,STAR,0.20);
      if(CH[c])add(c,STAR,0.22);
      if(L.st[c]>=0)add(c,[1.00,0.74,0.38],0.46);
      for(let d=0;d<4;d++){const tp=wget(L,x,y,d);
        if(tp===5||tp===7)add(c,STAR,0.22);
        else if(tp===3)add(c,w?G.mood.day:[0.95,0.35,0.22],w?0.30:0.26);}}
    for(const o of G.orbs)if(!o.got&&o.w===w)add(o.c,[1.00,0.42,0.24],0.34);
    if(G.doorOpen)add(L.exit,day,w?0.4:0.8);
    if(R&&R.mur)for(const c of R.mur)add(c,w?STAR:day,w?0.12:0.30); // the painted sky is the lamp of the room it hangs in
    if(R&&R.cmask)for(let c=0;c<N;c++)if(R.cmask[c])add(c,STAR,0.10);
    if(R&&R.varH){for(let i=0;i<R.varH.length;i++)if(R.varH[i]===2)add(i<W?i:i-W,STAR,0.2);for(let i=0;i<R.varV.length;i++)if(R.varV[i]===2){const x=i%(W+1),y=(i/(W+1))|0;add(y*W+(x?x-1:0),STAR,0.2);}}
    if(G.M&&G.hit&&w===G.M.w)add(G.M.c,[1.00,0.30,0.20],0.9); // where the stairs are, the room glows red
    const px=new Uint8Array(N*4);
    for(let i=0;i<N;i++){px[i*4]=Math.min(255,acc[i*3]*127.5);px[i*4+1]=Math.min(255,acc[i*3+1]*127.5);px[i*4+2]=Math.min(255,acc[i*3+2]*127.5);px[i*4+3]=255;}
    gl.bindTexture(gl.TEXTURE_2D,lightTex[w]);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  }
}
/* ---------- collision ---------- */
// Things to bump into, gathered around the player: x0,z0,x1,z1,top,bottom. Heights are measured from the surface you walk on
// (the ceiling, if that is where you are). top: you can stand on it if you get that high. bottom > 0: it hangs overhead.
const RB=[];
function stairDepth(){return P.size<0.6?0.62:0.3;}
function gather(){
  RB.length=0;const L=lvl,W=L.W,H=L.H,C=CELL,h=T/2,cx=Math.floor(P.x/C),cy=Math.floor(P.z/C),layer=P.g>0?0:1,sm=P.size<0.6;
  const open=G.door>0.9&&P.g>0&&!sm,CH=P.w?L.fh:L.ch,FH=P.w?L.ch:L.fh,sd=stairDepth(),f=C/2-h;
  // one wall: solid, or with a way through — a gap between two stubs, sometimes a sill to get over and a lintel overhead
  const wallAt=(hz,x,y,tp,ak)=>{const p=(hz?y:x)*C,lo=(hz?x:y)*C-h,hi=lo+C+2*h,m=lo+h+C/2;let gap=0,sill=0,lin=99;
    if(tp===6){if(open)gap=DOOR_W/2;}
    else if(tp>=8){if(sm){const md=hz?G.mdH[y*W+x]:G.mdV[y*(W+1)+x];if(md&&md.opened&&md.layer===layer)gap=0.21;}}
    else if(tp===0){const D=archDims(ak);gap=D.r-0.03;lin=D.ys+D.r*0.6;} // an arch across a corridor. (Arches and round holes in the outer wall look out on the night but are closed with air: nobody leaves that way.)
    const put=(a0,a1,top,bot)=>{if(hz)RB.push(a0,p-h,a1,p+h,top,bot);else RB.push(p-h,a0,p+h,a1,top,bot);};
    if(!gap){put(lo,hi,99,0);return;}
    put(lo,m-gap,99,0);put(m+gap,hi,99,0);if(sill>0)put(m-gap,m+gap,sill,0);if(lin<99)put(m-gap,m+gap,99,lin);};
  for(let y=cy-1;y<=cy+2;y++){if(y<0||y>H)continue;for(let x=cx-1;x<=cx+1;x++){if(x<0||x>=W)continue;const i=y*W+x,tp=L.hw[i],ak=R.akH[i];if(tp||ak)wallAt(true,x,y,tp,ak);}}
  for(let y=cy-1;y<=cy+1;y++){if(y<0||y>=H)continue;for(let x=cx-1;x<=cx+2;x++){if(x<0||x>W)continue;const i=y*(W+1)+x,tp=L.vw[i],ak=R.akV[i];if(tp||ak)wallAt(false,x,y,tp,ak);}}
  for(let y=cy-1;y<=cy+1;y++){if(y<0||y>=H)continue;for(let x=cx-1;x<=cx+1;x++){if(x<0||x>=W)continue;const c=y*W+x;
    const d=L.st[c];
    if(d>=0){const mx=(x+0.5)*C,mz=(y+0.5)*C;
      if(d===0)RB.push(mx-0.55,mz-f,mx+0.55,mz-f+sd,99,0);else if(d===2)RB.push(mx-0.55,mz+f-sd,mx+0.55,mz+f,99,0);
      else if(d===3)RB.push(mx-f,mz-0.55,mx-f+sd,mz+0.55,99,0);else RB.push(mx+f-sd,mz-0.55,mx+f,mz+0.55,99,0);}
    const rr=R.rects[layer][c];if(rr)for(let i=0;i<rr.length;i+=5)RB.push(rr[i],rr[i+1],rr[i+2],rr[i+3],rr[i+4],0);
    // a hole in the floor is ringed with a knee-high wall of air: you cannot wander in, but a running jump clears it
    // (bottom -1 marks it as something you cannot stand on)
    if(!layer&&FH[c])for(let q=0;q<4;q++){if(wget(L,x,y,q))continue;if(FH[(y+DY[q])*W+x+DX[q]])continue;const e=0.05;
      if(q===0)RB.push(x*C,y*C-e,(x+1)*C,y*C+e,0.5,-1);else if(q===2)RB.push(x*C,(y+1)*C-e,(x+1)*C,(y+1)*C+e,0.5,-1);
      else if(q===3)RB.push(x*C-e,y*C,x*C+e,(y+1)*C,0.5,-1);else RB.push((x+1)*C-e,y*C,(x+1)*C+e,(y+1)*C,0.5,-1);}
    // the skirt of wall that hangs round an opening in the ceiling: overhead for someone on the floor, a wall for someone on the ceiling
    if(CH[c])for(let q=0;q<4;q++){if(wget(L,x,y,q))continue;if(CH[(y+DY[q])*W+x+DX[q]])continue;const top=layer?99:WH,bot=layer?0:LOWH-0.12;
      if(q===0)RB.push(x*C,y*C-h,(x+1)*C,y*C+h,top,bot);else if(q===2)RB.push(x*C,(y+1)*C-h,(x+1)*C,(y+1)*C+h,top,bot);
      else if(q===3)RB.push(x*C-h,y*C,x*C+h,(y+1)*C,top,bot);else RB.push((x+1)*C-h,y*C,(x+1)*C+h,(y+1)*C,top,bot);}}}
}
function collide(){
  gather();const pr=Math.max(0.085,PR*P.size),head=P.jy+1.35*P.size;
  for(let it=0;it<3;it++)for(let i=0;i<RB.length;i+=6){
    if(RB[i+4]<=P.jy+0.06||RB[i+5]>=head)continue; // low enough to be under your feet, or high enough to be over your head
    const x0=RB[i],z0=RB[i+1],x1=RB[i+2],z1=RB[i+3],qx=clamp(P.x,x0,x1),qz=clamp(P.z,z0,z1),dx=P.x-qx,dz=P.z-qz,d2=dx*dx+dz*dz;
    if(d2>=pr*pr)continue;
    if(d2>1e-10){const d=Math.sqrt(d2);P.x=qx+dx/d*pr;P.z=qz+dz/d*pr;}
    else{const l=P.x-x0,r=x1-P.x,u=P.z-z0,b=z1-P.z,m=Math.min(l,r,u,b);if(m===l)P.x=x0-pr;else if(m===r)P.x=x1+pr;else if(m===u)P.z=z0-pr;else P.z=z1+pr;}
  }
}
// Height of whatever is under the player (0 = the surface itself); uses the list the last collide() gathered.
// There is always something: over a hole in the floor, or one of the odd holes in the ceiling, you stand on air. Nobody falls out of this scene.
function support(){
  const pr=Math.max(0.085,PR*P.size)*0.6;let s=0;
  for(let i=0;i<RB.length;i+=6){const t=RB[i+4];if(RB[i+5]!==0||t>P.jy+0.06||t<=s)continue;
    const qx=clamp(P.x,RB[i],RB[i+2]),qz=clamp(P.z,RB[i+1],RB[i+3]);if((P.x-qx)**2+(P.z-qz)**2<pr*pr)s=t;}
  return s;
}
/* ---------- camera ---------- */
const FLIP_T=1.45; // seconds for the roll over a staircase (was 1.45): shorter, so the inner ear has less time to argue
function flipCam(f,u){
  // one continuous roll up the wall and over: the eye rides a half-circle around the room's mid-height
  const e=ease(u),al=PI*e,u0=[0,f.g0,0],Ax=cross(f.n,u0);
  return {eye:[f.x0+f.n[0]*0.33*Math.sin(al),WH/2-f.g0*(WH/2-f.e0)*Math.cos(al),f.z0+f.n[2]*0.33*Math.sin(al)],F:rot(f.F0,Ax,al),U:rot(f.U0,Ax,al),g:f.g0*Math.cos(al)};
}
function cameraMaze(){
  if(flip&&!reducedMotion)return flipCam(flip,clamp(flip.t,0,1));
  const g=P.g,fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),cp=Math.cos(P.pitch),sp=Math.sin(P.pitch),eh=eyeH();
  // no head bob: the eye glides level, which is the single biggest help against motion sickness
  return {eye:[P.x,g>0?eh+P.jy:WH-eh-P.jy,P.z],F:[fx*cp,g*sp,fz*cp],U:[-fx*sp,g*cp,-fz*sp],g};
}
// Draw one world. pass 0 is the world the player stands in; pass 1 is the other one, kept only where a window pane was seen.
function drawWorld(w,pass,C,VP,fovy,asp,time){
  const lw=FB.lw,lh=FB.lh,md=moodOf(w),tm=time%1000;
  let m=progMain;gl.useProgram(m.p);
  gl.uniformMatrix4fv(m.u.uVP,false,VP);gl.uniform3fv(m.u.uCam,C.eye);gl.uniform1f(m.u.uTime,tm);gl.uniform1f(m.u.uG,C.g);gl.uniform1f(m.u.uSeed,0);
  gl.uniform2f(m.u.uMaze,lvl.W*CELL,lvl.H*CELL);gl.uniform3fv(m.u.uAmb,md.amb);gl.uniform3fv(m.u.uFog,md.fog);gl.uniform3fv(m.u.uFwd,C.F);
  gl.uniform3f(m.u.uOut,md.day[0]*0.9+0.1,md.day[1]*0.9+0.1,md.day[2]*0.9+0.1);
  gl.uniform3fv(m.u.uSkyH,md.H);gl.uniform3fv(m.u.uSkyZ,md.Z);gl.uniform3fv(m.u.uCloud,md.C);gl.uniform3fv(m.u.uGrass,md.G);
  gl.uniform1f(m.u.uWorld,w);gl.uniform1i(m.u.uPass,pass);gl.uniform2f(m.u.uRes,lw,lh);gl.uniform1f(m.u.uHold,G.hold);gl.uniform1f(m.u.uNoFog,0);gl.uniform1f(m.u.uBright,w?0:1);gl.uniform1f(m.u.uWH,WH);gl.uniform1f(m.u.uMoon,!G.plucked&&w===1&&pass===0?1:0);
  {const M=G.M,on=M&&G.hit&&w===M.w;gl.uniform4f(m.u.uOpC,on?M.cx:0,on?M.cz:0,on?M.lx:0,on?M.lz:0);gl.uniform1f(m.u.uOpK,on?clamp(G.open/0.55,0,1):0);}
  bindTex(0,lightTex[w],m.u.uLight);if(m.u.uWrit)bindTex(3,writTex(),m.u.uWrit);
  bindTex(1,pass?FB.s1.tex:lightTex[0],m.u.uPrev);bindTex(2,pass?FB.s1.dtex:lightTex[0],m.u.uPrevD);
  const sink=G.sink||0;gl.uniform1f(m.u.uSink,sink);gl.uniform4f(m.u.uWat,WAT_Y,G.climb&&G.deep?G.wat:0,0,0);
  gl.bindVertexArray(vao);
  if(sink<1){ // seen from above the roof there is no building
  gl.uniformMatrix4fv(m.u.uModel,false,IDENT);gl.drawArrays(gl.TRIANGLES,R.starts[w],R.counts[w]);
  const D=G.D;gl.uniformMatrix4fv(m.u.uModel,false,modelRY(D.hx,0,D.hz,D.th0+D.sgn*ease(G.door)*1.9));gl.drawArrays(gl.TRIANGLES,R.doorStart,R.doorCount);
  for(const d of G.mdoors){gl.uniformMatrix4fv(m.u.uModel,false,modelRY(d.hx,d.y0,d.hz,d.th0+d.sgn*ease(d.open)*1.75));gl.drawArrays(gl.TRIANGLES,R.mdStart,R.mdCount);}
  for(const o of G.orbs){
    if(o.got){ // a gathered planet settles into its socket over the door
      const s=G.sockets[o.slot]||G.sockets[G.sockets.length-1],k=ease(o.t);if(k<1&&o.w!==w)continue;if(!G.sockets[o.slot]&&k>=1)continue; // a spare beyond the sockets flies to the last one and is gone
      gl.uniform1f(m.u.uSeed,o.seed);gl.uniformMatrix4fv(m.u.uModel,false,modelOrb(o.x+(s[0]-o.x)*k,WH/2+(s[1]-WH/2)*k,o.z+(s[2]-o.z)*k,time*0.45+o.ph,0.34+(0.062-0.34)*k));
    }else{
      if(o.w!==w)continue;
      gl.uniform1f(m.u.uSeed,o.seed);gl.uniformMatrix4fv(m.u.uModel,false,modelOrb(o.x,WH/2+Math.sin(time*1.3+o.ph)*0.07,o.z,time*0.45+o.ph,0.34));
    }
    gl.drawArrays(gl.TRIANGLES,R.sphStart,R.sphCount);}
  for(const q of G.props){gl.uniform1f(m.u.uSeed,q.seed);gl.uniformMatrix4fv(m.u.uModel,false,modelOrb(q.x,WH/2+Math.sin(time*0.5+q.seed)*0.12,q.z,time*0.12+q.seed,q.s));gl.drawArrays(gl.TRIANGLES,R.sphStart,R.sphCount);}
  drawGhost(m,w);
  }
  const M=G.M;
  if(M&&G.hit&&w===M.w){
    // the landing and the black stair only once your head is up through the hatch; from anywhere below, just the black square of the hatch
    const up=G.climb&&C.eye[1]>LH-0.6,TN=up?R.tun:R.hatch;
    gl.uniformMatrix4fv(m.u.uModel,false,modelRY(M.cx,0,M.cz,M.th));gl.drawArrays(gl.TRIANGLES,TN[0],TN[1]);
    const q=ease(clamp((G.open-0.45)/0.55,0,1)); // the ladder lets itself down out of the dark
    if(q>0.01){const mm=modelRY(M.cx,LT*(1-q),M.cz,M.th);mm[5]=q;gl.uniformMatrix4fv(m.u.uModel,false,mm);gl.drawArrays(gl.TRIANGLES,R.lad[0],R.lad[1]);}
    // and below the floor it simply carries on, into the mist
    if(sink>0)for(let i=0;i<8;i++){gl.uniformMatrix4fv(m.u.uModel,false,modelRY(M.cx,-DEEP*i,M.cz,M.th));gl.drawArrays(gl.TRIANGLES,R.deep[0],R.deep[1]);}
  }
  if(G.plucked&&pass===0){ // the moon itself: torn out of the sky, swelling as it falls at you, then small in your hand
    const Rt=cross(C.F,C.U),hand=[C.eye[0]+C.F[0]*0.5-C.U[0]*0.2+Rt[0]*0.16,C.eye[1]+C.F[1]*0.5-C.U[1]*0.2+Rt[1]*0.16,C.eye[2]+C.F[2]*0.5-C.U[2]*0.2+Rt[2]*0.16];
    let p=hand,sc=0.06;
    if(G.pk>=0&&G.pk<0.45){const e=Math.pow(G.pk/0.45,2.2),d=Math.max(0.9,60*(1-e));const MD=G.mdir||PD;p=[C.eye[0]+MD[0]*d,C.eye[1]+MD[1]*d,C.eye[2]+MD[2]*d];sc=Math.max(0.06,8.4*Math.sqrt(1-e));}
    gl.uniform1f(m.u.uSeed,1.0);gl.uniform1f(m.u.uNoFog,1);
    gl.uniformMatrix4fv(m.u.uModel,false,modelOrb(p[0],p[1],p[2],time*0.6,sc));gl.drawArrays(gl.TRIANGLES,R.sphStart,R.sphCount);gl.uniform1f(m.u.uNoFog,0);
  }
  m=progSky;gl.useProgram(m.p);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
  const tf=Math.tan(fovy/2),Rt=cross(C.F,C.U);
  gl.uniform3f(m.u.uR,Rt[0]*tf*asp,Rt[1]*tf*asp,Rt[2]*tf*asp);gl.uniform3f(m.u.uU,C.U[0]*tf,C.U[1]*tf,C.U[2]*tf);gl.uniform3fv(m.u.uF,C.F);gl.uniform1f(m.u.uTime,tm);
  gl.uniform3fv(m.u.uSkyH,md.H);gl.uniform3fv(m.u.uSkyZ,md.Z);gl.uniform3fv(m.u.uCloud,md.C);gl.uniform3fv(m.u.uGrass,md.G);
  gl.uniform1f(m.u.uWorld,w);gl.uniform1i(m.u.uPass,pass);gl.uniform2f(m.u.uRes,lw,lh);bindTex(1,pass?FB.s1.tex:lightTex[0],m.u.uPrev);gl.uniform1f(m.u.uMoon,!G.plucked&&w===1&&pass===0?1:0);gl.uniform1f(m.u.uCrack,G.crack);gl.uniform1f(m.u.uSink,sink);gl.uniform4f(m.u.uWat,WAT_Y,G.climb&&G.deep?G.wat:0,0,0);gl.uniform3fv(m.u.uWc,C.eye);
  gl.bindVertexArray(vaoSky);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.depthFunc(gl.LESS);
}
// The whole scene, left in FB.s2 for the engine to develop.
function sceneMaze(C,VP,fovy,asp,time){
  const lw=FB.lw,lh=FB.lh;
  // 1. this world, small; window panes leave a hole in alpha
  gl.bindFramebuffer(gl.FRAMEBUFFER,FB.s1.fb);gl.viewport(0,0,lw,lh);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawWorld(P.w,0,C,VP,fovy,asp,time);
  // 2. the world on the far side, only beyond the panes
  gl.bindFramebuffer(gl.FRAMEBUFFER,FB.s2.fb);gl.viewport(0,0,lw,lh);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawWorld(1-P.w,1,C,VP,fovy,asp,time);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(progMerge.p);bindTex(0,FB.s1.tex,progMerge.u.uA);gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- play ---------- */
function curCell(){const W=lvl.W,cx=Math.floor(P.x/CELL),cy=Math.floor(P.z/CELL);return (cx<0||cy<0||cx>=W||cy>=lvl.H)?-1:cy*W+cx;}
function startFlip(){
  const c=curCell();if(c<0||flip)return false;const d=lvl.st[c];if(d<0)return false;
  const g=P.g,fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),cp=Math.cos(P.pitch),sp=Math.sin(P.pitch);
  flip={t:0,n:[DX[d],0,DY[d]],g0:g,x0:P.x,z0:P.z,e0:eyeH(),F0:[fx*cp,g*sp,fz*cp],U0:[-fx*sp,g*cp,-fz*sp],swapped:false};
  P.vx=P.vz=P.av=0;G.push=0;Snd.flip();return true;
}
function flipSwap(){
  const f=flip,A=cross(f.n,[0,f.g0,0]),fx=Math.sin(P.yaw),fz=Math.cos(P.yaw),d=A[0]*fx+A[2]*fz;
  P.yaw=Math.atan2(2*d*A[0]-fx,2*d*A[2]-fz);P.g=-f.g0;P.x=f.x0;P.z=f.z0;G.cool=0.7;P.jy=0;P.vy=0;G.jb=0;
  const v=wish();P.vx=v[0]*0.8;P.vz=v[1]*0.8;P.amp=0.6; // keep walking out of the roll
}
function updateFlip(dt){
  const f=flip;
  if(reducedMotion){f.t+=dt/0.8;G.fade=Math.sin(PI*clamp(f.t,0,1));
    if(f.t>=0.5&&!f.swapped){flipSwap();f.swapped=true;}if(f.t>=1){flip=null;G.fade=0;}return;}
  f.t+=dt/FLIP_T;if(f.t>=1){flipSwap();flip=null;Snd.land();}
}
// Backing through a window: glide out between the bars; the worlds trade places as the eye crosses the glass.
function startCross(d){
  const c=curCell(),W=lvl.W,cx=(c%W+0.5)*CELL,cz=(((c/W)|0)+0.5)*CELL,nx=DX[d],nz=DY[d];
  const lat=(P.x-cx)*-nz+(P.z-cz)*nx,lt=lat<0?-0.27:0.27;
  xing={t:0,nx,nz,wx:cx+nx*CELL/2,wz:cz+nz*CELL/2,s0:(P.x-cx)*nx+(P.z-cz)*nz-CELL/2,lat0:lat,lat1:lt,swapped:false,cr0:P.cr};
  P.vx=P.vz=P.av=0;G.pushW=0;Snd.pass();
}
function updateCross(dt){
  const k=xing;k.t=Math.min(1,k.t+dt/0.8);
  const e=ease(k.t),el=ease(Math.min(1,k.t*2.4));let s=k.s0+(0.62-k.s0)*e;const lat=k.lat0+(k.lat1-k.lat0)*el;
  if(!k.swapped&&s>-0.075){k.swapped=true;P.w=1-P.w;}
  if(k.swapped&&s<0.075)s=0.075;
  P.x=k.wx+k.nx*s-k.nz*lat;P.z=k.wz+k.nz*s+k.nx*lat;P.pitch*=1-Math.min(1,dt*3);
  if(k.t>=1){xing=null;G.cool=0.4;if(P.w===1)G.told=true;} // once you have been through to the red side, the line at the top of the screen stays
}
function target(){ // what E would act on right now: a planet in reach, then the red door, then a mini door
  const sm=P.size<0.6,layer=P.g>0?0:1;let no=null;
  // stand under the slit, look up at the moon, reach
  {const a=moonAim();if(a)return {t:'moon',a,can:true};}
  for(const o of G.orbs){if(o.got||o.w!==P.w)continue;if(Math.hypot(o.x-P.x,o.z-P.z)<1.15)return {t:'orb',o,can:true};}
  if(!G.doorOpen&&curCell()===lvl.exit){const D=G.D,dOut=((D.ax==='x'?P.z:P.x)-D.c)*(D.out[0]+D.out[1]);
    if(dOut>-1.25){const q={t:'door',can:P.g>0&&!sm&&G.got>=(lvl.need||G.orbs.length)};if(q.can)return q;no=q;}}
  for(const d of G.mdoors){if(d.opened||d.layer!==layer)continue;const r=Math.hypot(d.px-P.x,d.pz-P.z);
    if(r<(sm?0.8:1.25)){if(sm)return {t:'md',d,can:true};no=no||{t:'md',d,can:false};}}
  return no;
}
function interact(){
  if(G.mode==='void'){if(typeof rocketE==='function')rocketE();return;} // the stair void: the rocket (js/rocketlaunch.js)
  if(G.mode!=='play'||flip||xing)return;const q=target();if(!q)return;
  if(!q.can){Snd.thud();return;}
  if(q.t==='moon'){ // the ladder comes down right by you (ladderCell), never off in some other room
    const a=q.a;G.mdir=a.down?PDD:PD;G.M=placeStairs(ladderCell(a));G.plucked=true;G.pk=0;G.hit=false;P.vx=P.vz=0;SCF_SAVE.add('skyMoons');Snd.reach();return;}
  if(q.t==='md'){const d=q.d,side=(d.ax==='x'?P.z:P.x)-d.c;d.opened=true;d.sgn=d.ax==='x'?(side>0?1:-1):(side>0?-1:1);Snd.creak();}
  else if(q.t==='orb'){q.o.got=true;q.o.slot=G.got++;SCF_SAVE.add('moons');Snd.orb();bakeLight();}
  else{G.doorOpen=true;Snd.door();bakeLight();}
}
// The pull: the moon accelerates down through the slit into your hand, and at the moment it arrives everything hits at once.
function moonFx(dt){
  if(G.pk>=0){G.pk+=dt/1.8;
    if(G.pk<0.45)G.fovAdd=-0.42*ease(G.pk/0.45); // the world narrows as it rushes at you
    else{const t=G.pk-0.45;G.fovAdd=-0.42*Math.cos(t*10)*Math.exp(-t*5)+0.22*Math.sin(t*7)*Math.exp(-t*3);}
    if(G.pk>=0.45&&!G.hit){G.hit=true;G.shock=1;G.flashA=0.95;G.hold=1;Snd.boom();Snd.crack();bakeLight();}
    if(G.pk>=1){G.pk=-1;G.fovAdd=0;G.opening=true;Snd.grind();}}
  if(G.hit&&G.crack<1)G.crack=Math.min(1,G.crack+dt/7);
  if(G.opening&&G.open<1)G.open=Math.min(1,G.open+dt/7);
  G.shock*=Math.exp(-dt*1.8);if(G.shock<0.004)G.shock=0;
  G.flashA*=Math.exp(-dt*3.2);if(G.flashA<0.004)G.flashA=0;
}
// Going on down the deep ladder: the water comes up out of the mist under your feet; climb into it, and deep enough in you come out the other side.
function diveFx(){
  const ey=P.jy+eyeH();
  G.wat=clamp((WAT_Y+WAT_UP-ey)/(WAT_UP-1.5),0,1);G.wat=G.wat*G.wat*(3-2*G.wat); // nothing at the floor, all of it a metre and a half above the surface
  G.sea=clamp((WAT_Y-ey)/0.5,0,1);                                             // eyes under the surface
  G.drown=clamp((WAT_Y-ey-0.6)/(DIVE-0.6),0,1);                                // deeper: everything goes the dark green of deep water
  if(!G.splash&&ey<WAT_Y+0.15){G.splash=true;Snd.tone(110,1.6,'sine',0.11,0,true,48);Snd.noise(0.9,420,0.7,0.07,1600);}
  if(ey>WAT_Y+0.3)G.splash=false;
  if(G.drown<0.85||G.cu<WAT_Y-DIVE-EYE-0.8)G.gone=false; // climbed back up (or on down again) out of the deep green: going down again goes through again
  // if the pool and the two places behind its ENTER holes are not all built yet, you hang in the dark water until they are, behind the
  // loading screen (in the same dark green): built before you get there, nothing stutters down in the pool
  if(G.drown>=1&&!G.gone){if(poolAllReady()){G.gone=true;poolHandOver();}else if(window.SCF_LOADING&&!SCF_LOADING.active)SCF_LOADING.wait(()=>poolAllReady()||G.drown<0.85||G.mode!=='play',{bg:'#01090b',fadeIn:700});}
}
// The inverted pool is built in the background as soon as you get on the ladder (js/poolflip.js, its own canvas over this one),
// and takes the screen deep under the water, where both pictures are the same dark green. Same page, nothing reloads.
let poolLoading=false;
const poolAllReady=()=>!!window.__poolReady&&!!(window.__bounceReady||window.__bounceFailed)&&!!(window.__storeReady||window.__storeFailed);
function poolPreload(){
  if(poolLoading)return;poolLoading=true;
  import('./poolflip.js').catch(e=>{poolLoading=false;console.error('inverted pool failed to load',e);});
}
function poolHandOver(){
  const held=[...keys];keys.clear();say('');
  try{Snd.mute=true;Snd.droneOff();if(Snd.ctx)Snd.silence();}catch(e){} // (mute even if the sound has not started yet: it must not start up playing down there)
  G.mode='pool';
  const c=document.getElementById('c');c.style.opacity='0';c.style.transition='opacity 0.5s linear';
  window.__poolStart(held);
  requestAnimationFrame(()=>{c.style.opacity='1';});
}
// Back from the inverted pool, up its ladder: level 1 has the screen again, low on the same ladder in the dark green water, facing the rungs.
// Keep climbing and you come up out of the water, through the mist, to the black stair; climb down and you are back in the pool.
window.__poolReturn=function(held){
  const M=G.M;if(!M)return;
  G.mode='play';G.climb=true;G.deep=true;G.gone=true;G.pk=-1;
  G.cu=WAT_Y-DIVE-EYE-0.15;G.cl=0;G.ca=0;P.vx=P.vz=0;P.av=0;
  P.yaw=Math.atan2(M.lx,M.lz);P.pitch=0.55; // side-on to the stair's way, so W climbs: looking up the ladder toward the light
  climbPos();diveFx();keys.clear();for(const k of held||[])keys.add(k);
  try{if(Snd.ctx){Snd.master.gain.setTargetAtTime(0.9,Snd.ctx.currentTime,0.3);}Snd.droneOn();}catch(e){} // the pool silenced level 1 on the way down
  const gl=document.getElementById('gl');try{if(document.pointerLockElement&&document.pointerLockElement!==gl){const r=gl.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}gl.focus({preventScroll:true});}catch(e){}
  requestAnimationFrame(frame);
};
// Climbing: one dimension, up the ladder and then along the stairs; free to look anywhere. The higher, the darker, louder and wider.
function climbPos(){const M=G.M,x=(G.cu<LH?-0.25:-0.25+(G.cu-LH))+G.ca;
  P.x=M.cx+M.nx*x+M.lx*G.cl;P.z=M.cz+M.nz*x+M.lz*G.cl;P.jy=G.cu<LH?G.cu:hx(x);P.vy=0;return x;}
function updateClimb(dt){
  const M=G.M;
  let fwd=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);if(joy.id>=0)fwd-=joy.y;fwd=clamp(fwd,-1,1);
  let turn=(keys.has('ArrowRight')||(!locked&&keys.has('KeyD'))?1:0)-(keys.has('ArrowLeft')||(!locked&&keys.has('KeyA'))?1:0);if(joy.id>=0)turn+=joy.x*0.9;
  P.av+=(turn*2.4-P.av)*(1-Math.exp(-dt*24));P.yaw-=P.av*dt;
  const onL=G.cu<LH,run=keys.has('ShiftLeft')||keys.has('ShiftRight'),sp=onL?(run?3.4:2.2):(run?3.2:1.8);
  // you move the way you look: facing up the stairs, W climbs; facing back down, S climbs
  const face=Math.sin(P.yaw)*M.nx+Math.cos(P.yaw)*M.nz,dir=Math.abs(face)<0.15?(onL?1:0):Math.sign(face);
  let du=dir*fwd*sp*dt*(G.sea>0?0.6:1); // slower in the water
  // Once the mist has taken the whole building and the ladder is seen going on below the floor, there is no floor to step off onto:
  // climbing down goes on down. Before that, climbing down brings the room back as it always did.
  if(!G.deep&&onL&&G.sink>=0.985)G.deep=true;
  if(du<0&&G.cu<=0&&!G.deep){G.climb=false;Snd.droneOff();climbPos();P.jy=0;G.cool=0.6;G.dark=0;G.pix=0;G.hold=1;G.fovAdd=0;return;}
  const u0=G.cu;G.cu=clamp(G.cu+du,G.deep?WAT_Y-DIVE-EYE-2:0,UEND);du=G.cu-u0;
  if(G.deep)diveFx();
  // Walk up facing forward and the stair never ends: every two metres gained are quietly taken away again.
  // Only someone climbing backwards, eyes on the way they came, actually gets anywhere.
  const eaten=!onL&&du>0&&face>0&&G.cu-LH-0.25>XS+5;
  if(eaten){G.wr+=du;while(G.wr>=2){G.cu-=2;G.wr-=2;}}
  G.fwdRun=eaten?(G.fwdRun||0)+dt:0; // how long you have kept walking up it facing forward (stopSign reads it)
  const k=1-Math.exp(-dt*3);G.cl-=G.cl*k;G.ca-=G.ca*k;
  climbPos();
  G.stepS+=Math.abs(du);const sd=onL?0.35:SD;if(G.stepS>sd){G.stepS-=sd;if(onL)Snd.tone(520+Math.random()*60,0.09,'triangle',0.035,0,true);else Snd.step(Math.random()<0.5);}
  if(onL)G.walked*=Math.exp(-dt*0.6);else G.walked+=Math.abs(du);
  const dep=clamp(G.walked/(XE*0.73),0,1),e=1-Math.exp(-dt*1.5); // the dark comes on in step with the stair's length
  G.dark+=(dep-G.dark)*e;G.pix+=(Math.pow(dep,1.4)-G.pix)*e;G.hold+=(1-0.65*dep-G.hold)*e;
  G.fovAdd+=(dep*0.3-G.fovAdd)*e;
  Snd.drone(0.04+0.22*dep,dep);
  G.beat-=dt;if(G.beat<=0){Snd.heart(dep);G.beat=1.25-0.8*dep;}
  if(dep>0.1){G.cry-=dt;if(G.cry<=0){Snd.sob(dep*(0.3+0.7*Math.random()));if(Math.random()<0.4)Snd.tone(38,2.6,'sawtooth',0.05*dep,0,true,72);G.cry=2.5+Math.random()*7*(1.25-dep);}}
  if(G.cu>=UEND-0.6){enterVoid();}
}
function updatePlay(dt){
  G.time+=dt;
  if(G.doorOpen&&G.door<1)G.door=Math.min(1,G.door+dt/1.6);
  for(const o of G.orbs)if(o.got&&o.t<1)o.t=Math.min(1,o.t+dt/1.1);
  for(const d of G.mdoors)if(d.opened&&d.open<1)d.open=Math.min(1,d.open+dt/0.7);
  moonFx(dt);
  if(G.pk>=0)return; // frozen while the moon comes down into your hand (you can still look)
  if(G.climb){updateClimb(dt);return;}
  if(flip){updateFlip(dt);return;}
  if(xing){updateCross(dt);return;}
  if(curCell()<0)toStart(); // should never happen: the scene is closed on every side
  if(G.cool>0)G.cool-=dt;if(G.coolS>0)G.coolS-=dt;
  const crouch=keys.has('KeyC')||G.tCrouch;
  P.cr+=((crouch?1:0)-P.cr)*(1-Math.exp(-dt*14));
  P.size+=((P.small?0.28:1)-P.size)*(1-Math.exp(-dt*4));
  let turn=(keys.has('ArrowRight')||(!locked&&keys.has('KeyD'))?1:0)-(keys.has('ArrowLeft')||(!locked&&keys.has('KeyA'))?1:0);
  if(joy.id>=0)turn+=joy.x*0.9;
  // snappy response: velocity and turning reach their target in ~50 ms instead of ~110 ms
  P.av+=(turn*2.4-P.av)*(1-Math.exp(-dt*24));P.yaw-=P.g*P.av*dt;
  const v0=wish(),tx=v0[0],tz=v0[1],k=1-Math.exp(-dt*20);
  P.vx+=(tx-P.vx)*k;P.vz+=(tz-P.vz)*k;
  const ox=P.x,oz=P.z,v=Math.hypot(P.vx,P.vz);
  if(v>0.01){const n=Math.max(1,Math.ceil(v*dt/0.05));for(let i=0;i<n;i++){P.x+=P.vx*dt/n;P.z+=P.vz*dt/n;collide();}}else collide();
  const moved=Math.hypot(P.x-ox,P.z-oz);
  // jumping: rise, fall, land on the floor or on top of anything low enough
  {const sup=support();
    if(P.jy>sup+1e-4||P.vy>0){P.vy-=GRAV*dt;P.jy+=P.vy*dt;
      if(P.jy<=sup&&P.vy<=0){if(P.vy<-2.5)Snd.land();P.jy=sup;P.vy=0;}}
    else{P.jy=sup;P.vy=0;}
    if(P.vy===0)G.coyote=0.1;else if(G.coyote>0)G.coyote-=dt;
    if(G.jb>0){G.jb-=dt;if(grounded()&&P.cr<0.5){P.vy=Math.sqrt(2*GRAV*JUMP_H*Math.max(0.45,P.size));G.jb=0;G.coyote=0;Snd.step(1);}}}
  const onFloor=P.jy<0.02&&P.vy===0;
  P.amp+=((moved/dt>0.4&&P.vy===0?1:0)-P.amp)*Math.min(1,dt*8);
  if(P.vy===0){const b0=Math.floor(P.bob/PI);P.bob+=moved*2.0/Math.max(0.4,P.size);if(Math.floor(P.bob/PI)!==b0)Snd.step(b0&1);}
  const c=curCell(),W=lvl.W,pr=Math.max(0.085,PR*P.size),layer=P.g>0?0:1,sm=P.size<0.6;
  // the ladder is down: walk into it and you are on it
  if(G.M&&G.open>=1&&onFloor&&c===G.M.c&&P.w===G.M.w&&P.g>0&&G.cool<=0){
    const M=G.M,dx=M.cx+M.nx*0.25-P.x,dz=M.cz+M.nz*0.25-P.z,dd=Math.hypot(dx,dz);
    if(dd<0.75&&(dd<0.2?Math.hypot(tx,tz)>0.5:(dx*tx+dz*tz)/dd>0.6)){
      poolPreload();
      G.climb=true;G.cu=0;G.cl=(P.x-M.cx)*M.lx+(P.z-M.cz)*M.lz;G.ca=(P.x-M.cx)*M.nx+(P.z-M.cz)*M.nz+0.25;P.vx=P.vz=0;Snd.droneOn();return;}}
  if(c>=0&&onFloor){
    const cxw=(c%W+0.5)*CELL,czw=(((c/W)|0)+0.5)*CELL,fx=Math.sin(P.yaw),fz=Math.cos(P.yaw);
    // walk into a staircase and keep walking: it carries you up the wall and over
    let pushing=false;
    if(lvl.st[c]>=0&&G.cool<=0){const d=lvl.st[c],nx=DX[d],nz=DY[d];
      const along=(P.x-cxw)*nx+(P.z-czw)*nz,lat=(P.x-cxw)*-nz+(P.z-czw)*nx;
      if(along>CELL/2-T/2-stairDepth()-pr-0.05&&Math.abs(lat)<0.55+pr&&tx*nx+tz*nz>0.5*(0.4+0.6*P.size))pushing=true;}
    if(pushing){G.push+=dt;if(G.push>0.14){startFlip();return;}}else G.push=0;
    // back into a window onto the other world and keep backing: you come out on its far side
    let backing=-1;
    if(!sm&&P.small===false&&P.cr<0.3&&G.cool<=0)for(let d=0;d<4;d++){if(wget(lvl,c%W,(c/W)|0,d)!==3)continue;const nx=DX[d],nz=DY[d];
      const along=(P.x-cxw)*nx+(P.z-czw)*nz,lat=(P.x-cxw)*-nz+(P.z-czw)*nx;
      if(along>CELL/2-T/2-pr-0.07&&Math.abs(lat)<0.5&&fx*nx+fz*nz<-0.35&&tx*nx+tz*nz>1.0){
        const n=(((c/W)|0)+DY[d])*W+c%W+DX[d];if(!blockedAt(lvl,n,layer,1-P.w))backing=d;}}
    if(backing>=0){G.pushW+=dt;if(G.pushW>0.2){startCross(backing);return;}}else G.pushW=0;
    // crouch onto one of the little staircases: it changes your size
    let stepping=false;const sr=R.shr[layer][c];
    if(sr&&P.cr>0.6&&G.coolS<=0){const qx=clamp(P.x,sr[0],sr[2]),qz=clamp(P.z,sr[1],sr[3]),dx=qx-P.x,dz=qz-P.z,dd=Math.hypot(dx,dz);
      if(dd<pr+0.08&&dx*tx+dz*tz>0.02)stepping=true;}
    if(stepping){G.pushS+=dt;if(G.pushS>0.18){P.small=!P.small;SCF_SAVE.set('small',P.small);if(window.SizeGun)SizeGun.refresh();G.coolS=1.6;G.pushS=0;Snd.shrink(P.small);}}else G.pushS=0;
  }
  const q=target();G.hint+=((q&&q.can?1:0)-G.hint)*Math.min(1,dt*8);
  if(G.door>0.9&&P.g>0&&!sm){const D=G.D,lat=D.ax==='x'?P.x-D.mid:P.z-D.mid,dOut=((D.ax==='x'?P.z:P.x)-D.c)*(D.out[0]+D.out[1]);
    if(Math.abs(lat)<DOOR_W/2&&dOut>-0.22){G.mode='leaving';keys.clear();G.hint=0;Snd.win();}}
}
/* ---------- the one who shows the way ---------- */
// At the first window you can cross (first chamber only), a shadow shaped like a person stands with its back to the glass, watching the room,
// and walks backwards into the window and through it into the red room. That is how the crossing is done. It does it once each time the place
// comes into view: look away, look back, and it is there again.
const GH_IN=0.55,GH_V=0.8,GH_END=0.85,GH_STEP=0.40; // seconds to gather, metres a second, how far past the glass it gets, length of a step
function placeGhost(){
  G.gh=null;if(G.li!==0)return;
  const L=lvl,W=L.W,dist=bfsDist(L,L.start);let best=null;
  for(let c=0;c<W*L.H;c++){if(dist[c]<0||blockedAt(L,c,0,0))continue;const x=c%W,y=(c/W)|0;
    for(let d=0;d<4;d++){if(wget(L,x,y,d)!==3)continue;const nx=x+DX[d],ny=y+DY[d];if(!inb(L,nx,ny)||blockedAt(L,ny*W+nx,0,1))continue;
      if(!best||dist[c]<best.k)best={c,d,k:dist[c]};}}
  if(!best)return;
  const c=best.c,d=best.d,x=c%W,y=(c/W)|0,nx=DX[d],nz=DY[d],bx=x-nx,by=y-nz;
  // room to start from further back if the cell behind is open and has a floor
  const deep=!wget(L,x,y,(d+2)%4)&&inb(L,bx,by)&&!blockedAt(L,by*W+bx,0,0)&&L.st[c]<0&&L.st[by*W+bx]<0;
  G.gh={c,nx,nz,wx:(x+0.5)*CELL+nx*CELL/2,wz:(y+0.5)*CELL+nz*CELL/2,lat:0.27,s0:deep?-2.45:-1.3,t:-1,armed:true};
}
// can a straight line be drawn across the floor plan without meeting a wall? (arches count as open, windows as walls)
function losClear(x0,z0,x1,z1){const L=lvl,n=Math.max(1,Math.ceil(Math.hypot(x1-x0,z1-z0)/0.2));let cx=Math.floor(x0/CELL),cy=Math.floor(z0/CELL);
  if(!inb(L,cx,cy))return false;
  for(let i=1;i<=n;i++){const nx=Math.floor((x0+(x1-x0)*i/n)/CELL),ny=Math.floor((z0+(z1-z0)*i/n)/CELL);
    if(nx!==cx){if(!inb(L,nx,cy)||wget(L,cx,cy,nx>cx?1:3))return false;cx=nx;}
    if(ny!==cy){if(!inb(L,cx,ny)||wget(L,cx,cy,ny>cy?2:0))return false;cy=ny;}}
  return true;}
// is the place where it walks in front of your eyes? (wide: or anywhere near them — used to tell when you have really looked away)
function ghostSeen(wide){const g=G.gh;
  if(P.w!==0||P.g<0||G.climb||flip||xing)return false;
  const tx=g.wx-g.nx*0.8-g.nz*g.lat,tz=g.wz-g.nz*0.8+g.nx*g.lat,ey=eyeH()+P.jy,dx=tx-P.x,dy=0.9-ey,dz=tz-P.z,dd=Math.hypot(dx,dy,dz);
  if(dd>12)return false;if(dd<0.5)return true;
  const cp=Math.cos(P.pitch);if((dx*Math.sin(P.yaw)*cp+dy*Math.sin(P.pitch)+dz*Math.cos(P.yaw)*cp)/dd<(wide?0.42:0.70))return false;
  return losClear(P.x,P.z,tx,tz);}
function updateGhost(dt){const g=G.gh;if(!g)return;
  const near=ghostSeen(true);
  if(g.t<0){if(!near)g.armed=true;else if(g.armed&&ghostSeen(false)){g.t=0;g.armed=false;}return;}
  if(!near){g.t=-1;g.armed=true;return;} // you looked away: it is gone, and will start again when you look back
  g.t+=dt;if(g.s0+Math.max(0,g.t-GH_IN)*GH_V>=GH_END)g.t=-1; // it has gone through; nothing more until you look away and back
}
// one ellipsoid of the figure: it hangs from a joint (jx,jy,jz in the figure's own space: x to its side, y up, z the way it faces),
// swung forward by f radians, len long and rx by rz thick; bx,by,bz and th set the whole figure down in the room
function ghPart(bx,by,bz,th,jx,jy,jz,f,len,rx,rz){
  const c=Math.cos(th),s=Math.sin(th),ca=Math.cos(f),sa=-Math.sin(f),h=len/2,ty=jy-ca*h,tz=jz-sa*h;
  // columns of Ry(th)·Rx(-f)·S, then the translation
  return new Float32Array([c*rx,0,-s*rx,0, s*sa*h,ca*h,c*sa*h,0, s*ca*rz,-sa*rz,c*ca*rz,0, bx+c*jx+s*tz,by+ty,bz-s*jx+c*tz,1]);}
function drawGhost(m,w){const g=G.gh;if(!g||g.t<0)return;
  const walked=Math.max(0,g.t-GH_IN)*GH_V,s=g.s0+walked,op=clamp(g.t/GH_IN,0,1)*(1-ease(clamp((s-0.2)/(GH_END-0.2),0,1)));if(op<=0.01)return;
  // it faces the room and moves the other way; the walk is an ordinary one run in reverse
  const th=Math.atan2(-g.nx,-g.nz),ph=-Math.PI*walked/GH_STEP,go=clamp(walked/0.25,0,1);
  const bx=g.wx+g.nx*s-g.nz*g.lat,bz=g.wz+g.nz*s+g.nx*g.lat,by=0.012*go*Math.cos(2*ph);
  gl.uniform4f(m.u.uCut,g.nx,g.nz,g.nx*g.wx+g.nz*g.wz,w===0?-1:1); // world 0 keeps what is still in the room, world 1 what has come through
  gl.uniform1f(m.u.uInk,op);
  const put=(jx,jy,jz,f,len,rx,rz)=>{gl.uniformMatrix4fv(m.u.uModel,false,ghPart(bx,by,bz,th,jx,jy,jz,f,len,rx,rz));gl.drawArrays(gl.TRIANGLES,R.sphStart,R.sphCount);};
  put(0,1.09,0.016,-0.06,0.52,0.122,0.078);             // trunk, leaning a little toward the room
  put(0,0.72,0,0,0.20,0.118,0.085);                      // hips
  put(0,1.15,0.02,0,0.12,0.036,0.036);                   // neck
  put(0,1.325,0.03,0,0.215,0.080,0.092);                 // head
  for(const sd of [-1,1]){const q=ph+(sd>0?Math.PI:0),hip=0.40*go*Math.sin(q),knee=go*(0.10+0.75*Math.max(0,Math.cos(q)));
    const hx=sd*0.074,ky=0.60-0.30*Math.cos(hip),kz=0.30*Math.sin(hip),sh=hip-knee,ay=ky-0.30*Math.cos(sh),az=kz+0.30*Math.sin(sh);
    put(hx,0.60,0,hip,0.32,0.060,0.062);                 // thigh
    put(hx,ky+0.01,kz,sh,0.32,0.046,0.048);              // shin
    put(hx,ay+0.045,az-0.05,Math.PI/2+0.25*Math.max(0,-Math.sin(q))*go,0.20,0.040,0.034); // foot, toes toward the room
    const arm=-0.26*go*Math.sin(q)-0.04,el=arm+0.18+0.10*go*Math.max(0,-Math.sin(q)),sx=sd*0.150,ey=1.04-0.30*Math.cos(arm),ez=0.012+0.30*Math.sin(arm);
    put(sx,1.05,0.012,arm,0.31,0.040,0.042);             // upper arm
    put(sx+sd*0.006,ey+0.01,ez,el,0.36,0.033,0.036);}    // forearm and a long hand
  // its eyes stay on you
  let hy=Math.atan2(P.x-bx,P.z-bz)-th;hy=clamp(Math.atan2(Math.sin(hy),Math.cos(hy)),-0.7,0.7);
  gl.uniform1f(m.u.uInk,2+op);
  for(const sd of [-1,1]){const a=hy+sd*0.36,ex=0.079*Math.sin(a),ez=0.03+0.090*Math.cos(a);put(ex,1.250,ez,0,0.040,0.017,0.012);}
  gl.uniform1f(m.u.uInk,0);gl.uniform4f(m.u.uCut,0,0,0,0);
}
/* ---------- what the engine asks of this scene ---------- */
// The chessboard chamber's help: a line at the top of the screen, and G opens a little instruction book over the picture.
const MOON_SVG='<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><defs><radialGradient id="gbm" cx="38%" cy="34%" r="70%">'
  +'<stop offset="0" stop-color="#ffd2a0"/><stop offset=".45" stop-color="#f08a4b"/><stop offset="1" stop-color="#9b3418"/></radialGradient>'
  +'<radialGradient id="gbg" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#ff8a4a" stop-opacity=".55"/><stop offset="1" stop-color="#ff8a4a" stop-opacity="0"/></radialGradient></defs>'
  +'<circle cx="60" cy="60" r="58" fill="url(#gbg)"/><circle cx="60" cy="60" r="40" fill="url(#gbm)"/>'
  +'<g fill="#fff1d8" opacity=".45"><ellipse cx="47" cy="44" rx="9" ry="6"/><ellipse cx="70" cy="58" rx="6" ry="9"/><ellipse cx="52" cy="72" rx="11" ry="5"/><ellipse cx="76" cy="40" rx="4" ry="3"/><ellipse cx="38" cy="60" rx="4" ry="6"/></g>'
  +'<g fill="#8c2d14" opacity=".35"><circle cx="64" cy="76" r="4"/><circle cx="80" cy="66" r="3"/><circle cx="44" cy="52" r="2.5"/></g></svg>';
// One page per thing to know, each with a little photo taped on (img/help-*.jpg, taken in the game). The arrow keys turn the pages.
const GB_PAGES=[
  {img:'img/help-moons.jpg',cap:'a moon',t:'Moons',b:'See a moon? Walk up to it and press <kbd>E</kbd> to collect it.'},
  {img:'img/help-window.jpg',cap:'a window',t:'The rooms behind the windows',b:'Explore the rooms behind the windows&hellip; if you can figure out how to get in.'},
  {img:'img/help-stairs.jpg',cap:'mini stairs',t:'Mini stairs',b:'Walk into one of these mini stairs crouched down (hold <kbd>C</kbd>) and you shrink. Do it again to grow back. Small, you fit where you could not before.'},
  {img:'img/help-wallstairs.jpg',cap:'stairs on the wall',t:'Stairs up the wall',b:'Walk up the big stairs on the wall and keep going: they turn you over, and the ceiling becomes your floor.'},
  // the last page is not for reading yet: every word of it has gone to question marks
  {img:'img/help-bigmoon.jpg',cap:'??? ???? ???????',t:'??? ???? ???????',b:'???? ??? ???? ??? ?????, ?????? ??? ????? ?? ??? ??? ?????, ?????? ??? ?????? ????. ???? ?? (?? ????) ??????? ?? ???????, ??? ????? ??.'},
];
document.body.insertAdjacentHTML('beforeend','<p id="helpk" hidden>Press <kbd class="gk">G</kbd> for help</p>');
// The book is the G book (js/gmenu.js), there in every scene; in the checkerboard rooms it opens on these pages (and a page of controls after them).
if(window.SCF_G)SCF_G.setPages(()=>G.mode==='play'||G.mode==='leaving'?GB_PAGES:[]); // (the main menu page has no G book)
const helpOK=()=>G.mode==='play'&&!G.climb&&G.pk<0; // when the "Press G for help" line shows
// in the red room, a click on the moon takes it, the same as E
document.getElementById('gl').addEventListener('mousedown',e=>{if(e.button===0&&G.mode==='play'&&!(window.SCF_G&&SCF_G.isOpen())&&moonAim())interact();});
function helpUI(two){
  const on=!two&&helpOK(),el=$('helpk');if(el.hidden!==!on)el.hidden=!on;
  const cap=$('cap');cap.classList.toggle('under',on);
}
// On the black stair, while you keep walking up it facing forward (the way that gets you nowhere), a line flickers:
// STOP MOVING FORWARD. A warning, or the way out: walk it backwards. Gone the moment you stop.
document.body.insertAdjacentHTML('beforeend','<p id="stopfwd" aria-hidden="true" hidden>STOP MOVING FORWARD</p>');
let stopFl={t:0,on:false};
function stopSign(dt,two){
  helpUI(two);
  const el=$('stopfwd'),show=!two&&G.mode==='play'&&G.climb&&(G.fwdRun||0)>0.7;
  if(!show){if(!el.hidden)el.hidden=true;stopFl.t=0;return;}
  stopFl.t-=dt;
  if(stopFl.t<=0){stopFl.on=Math.random()<(stopFl.on?0.62:0.8);stopFl.t=stopFl.on?0.05+Math.random()*0.22:0.03+Math.random()*0.09;
    el.style.transform=`translate(${((Math.random()-0.5)*6).toFixed(1)}px,${((Math.random()-0.5)*3).toFixed(1)}px)`;el.style.opacity=stopFl.on?(0.75+Math.random()*0.25).toFixed(2):'0';}
  if(el.hidden)el.hidden=false;
}
// what the line at the top of the screen says once you have been through a window to the red side
const CAP_MOON='When I was a kid, I always wanted to pluck the moon and put it in my beach ball collection.';
// How far the mist has taken the building: nothing while you stand in the room, a little from the first rungs, all of it by the time your eyes clear the roof.
// It goes by height alone, so climbing back down brings the room back.
function sinkAt(){if(!G.climb||P.g<0)return 0;if(G.deep)return 1;const y0=EYE+0.9,k=clamp((P.jy+eyeH()-y0)/(WH+CTH-0.15-y0),0,1);return k*k*(3-2*k);}
// 1 while the bright painted room should be on screen, 0 for the night side and the black stair
const mazePrint=()=>(G.mode==='play'||G.mode==='leaving')&&P.w===0&&!(G.climb&&G.cu>LH)?1:0;
function tickMaze(dt){
  if(G.mode==='play'){if(!(flip&&reducedMotion)&&G.fade>0)G.fade=Math.max(0,G.fade-dt/2.2);updatePlay(dt);updateGhost(dt);}
  else if(G.mode==='leaving'){ // through the red door, into the white
    const D=G.D;P.x+=D.out[0]*dt*1.3;P.z+=D.out[1]*dt*1.3;G.fade+=dt/1.5;
    if(G.fade>=1.25){loadLevel(G.li+1);G.fade=1;G.mode='play';}}
  G.sink=G.mode==='play'?sinkAt():0;
  say(G.told&&!G.plucked?CAP_MOON:''); // it has said its piece once the moon is in your hand
  return true;
}
// what a reload needs in order to put you back where you were
function snapshotMaze(){return {li:G.li,seed:G.seed,got:G.orbs.map(o=>o.got?o.slot:-1),md:G.mdoors.map(d=>d.opened),door:G.doorOpen,told:G.told,
  x:G.climb&&G.M?G.M.cx:P.x,z:G.climb&&G.M?G.M.cz:P.z,yaw:P.yaw,pitch:P.pitch,g:P.g,w:P.w,small:P.small};}
function restoreMaze(data){
  if(!(data&&data.li!=null)){loadLevel(SCF_SAVE.get('li')||0);return;}
  loadLevel(data.li,data.seed);
  (data.got||[]).forEach((slot,i)=>{if(slot>=0&&G.orbs[i]){G.orbs[i].got=true;G.orbs[i].t=1;G.orbs[i].slot=slot;G.got++;}});
  (data.md||[]).forEach((o,i)=>{if(o&&G.mdoors[i]){G.mdoors[i].opened=true;G.mdoors[i].open=1;}});
  if(data.door){G.doorOpen=true;G.door=1;}
  G.told=!!data.told;
  P.x=data.x;P.z=data.z;P.yaw=data.yaw;P.pitch=data.pitch;P.g=data.g<0?-1:1;P.w=data.w?1:0;P.small=!!data.small;P.size=P.small?0.28:1;SCF_SAVE.set('small',P.small);
  if(curCell()<0||!isFinite(P.x+P.z))toStart(); // a saved spot off the map: back to the start of the chamber
  bakeLight();
}
