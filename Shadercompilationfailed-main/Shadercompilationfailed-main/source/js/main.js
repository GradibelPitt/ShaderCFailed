// Start-up. Which scene to open in comes from the page: <html data-level="1">, "2" or "hub"; adding #level-1, #level-2 or #hub to the address overrides it,
// and a saved state from a reload overrides both.
'use strict';
const startLevel=()=>{const h=/^#(?:level-([12])|(hub))$/.exec(location.hash);return h?h[1]||h[2]:document.documentElement.dataset.level||'1';};
function boot(data){
  if(!initGL()){$('nogl').hidden=false;return;}
  try{if(document.fonts&&document.fonts.load)document.fonts.load('32px "VT323"').catch(()=>{});}catch(e){}
  bindInput();
  restoreMaze(data&&data.v===3?data:null); // scene one is always built: it is where scene two leads back to
  const saved=!!(data&&data.v===3),st=startLevel();
  if(st==='menu'&&typeof enterMenu==='function')enterMenu(); // the main menu (index.html, js/menu.js)
  else if(saved?data.hb:st==='hub')enterHub();else if((data&&data.vd)||(!saved&&st==='2'))enterVoid();
  try{canvas.focus({preventScroll:true});}catch(e){}
  requestAnimationFrame(frame);
  if(location.hash==='#store-exit'&&typeof storeExitWarp==='function'){try{history.replaceState(null,'',location.pathname);}catch(e){}storeExitWarp();} // out of the store, from the playroom's page
  const hot=window.claude&&window.claude.hot;
  if(hot&&hot.snapshot)hot.snapshot(()=>Object.assign({v:3,vd:G.mode==='void',hb:G.mode==='hub'},snapshotMaze()));
}
// the size gun (js/sizegun.js): in the checkerboard rooms the size eases over (updatePlay); in the hub and the void it is instant;
// down in the inverted pool, js/poolflip.js has the say (window.__poolSize)
window.__sizeGunScene={
  can(toSmall){if(G.mode==='pool')return !!window.__poolSize&&window.__poolSize.can(toSmall);return (G.mode==='play'||G.mode==='hub'||G.mode==='void')&&!flip&&!xing;},
  apply(toSmall){if(G.mode==='pool'){window.__poolSize.apply(toSmall);return;}P.small=toSmall;if(G.mode!=='play')P.size=toSmall?0.28:1;},
};
// a handle for testing from the console
window.__cp={step:updatePlay,interact,G,P,V,Qs,HB,enterVoid,enterHub,hubClick,answer,qNext,qUpdate,keys,get lvl(){return lvl;},get flip(){return flip;},get cross(){return xing;},get R(){return R;},loadLevel,solve};
{const hot=window.claude&&window.claude.hot;if(hot&&hot.ready)hot.ready(boot);else boot((hot&&hot.data)||{});}
