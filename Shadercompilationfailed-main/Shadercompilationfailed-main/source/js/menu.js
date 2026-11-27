// The main menu (index.html): what start_game.bat / start_game.command open.
// Behind it, the level-select hall's field of grass, drawn by the hall's own shader (js/hub.js), seen from far out in the field
// where the white screen and the computer behind it are lost in the haze; the view turns slowly. Over it, the game's name in the hall's own
// lettering (the same strokes, ttlBuild in js/hub.js), and three choices:
//   New Game   a new save slot (the existing ones are kept), starting in the playroom
//   Continue   the save played last, where it was left
//   Load Game  every save, to pick one (or delete one: it asks again first)
// Saves: js/save.js. On this page the engine's own writes are switched off, so opening the menu never makes or changes a save.
'use strict';
function enterMenu(){
  enterHub();
  HB.menu=true;HB.title=-1;
  HB.x=HP/2-1;HB.z=HP/2-1;P.yaw=2.4;P.pitch=0.05; // halfway between screens: the nearest is ~270 m off, far past where the haze takes it
  G.fade=1;   // out of the white into daylight, as the hall always opens
  MENU.build();
}
const MENU={
  build(){
    const st=document.createElement('style');
    st.textContent=`#gl{cursor:default}#dot,#helpk{display:none!important}
#menu{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3.2vh;color:#111;font:15px/1.35 Tahoma,'Segoe UI','Microsoft YaHei',sans-serif;user-select:none;opacity:0;transition:opacity 1.2s}
#menu.on{opacity:1}#menu.out{opacity:0;transition:opacity .6s}
#mtitle{display:block;pointer-events:none}
#menu .win{width:min(520px,92vw);border-radius:8px 8px 3px 3px;background:#ece9d8;box-shadow:0 0 0 1px #0831d9,0 18px 60px rgba(0,0,0,.45);overflow:hidden}
#menu .bar{height:30px;display:flex;align-items:center;gap:7px;padding:0 6px 0 9px;color:#fff;font:bold 13px Tahoma,sans-serif;text-shadow:1px 1px #0a1a6e;
  background:linear-gradient(#0997ff,#0053ee 8%,#0050ee 40%,#06f 88%,#06f 93%,#005bff 95%,#003dd7 96%,#003dd7)}
#menu .bar .ico{width:16px;height:16px;border-radius:3px;background:linear-gradient(135deg,#ff9a30,#d13a1f);box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
#menu .bar .t{flex:1}#menu .bar .x{width:21px;height:21px;border-radius:3px;border:1px solid #fff;background:linear-gradient(#e97a62,#c4371b);display:grid;place-items:center;font:bold 13px/1 Tahoma}
#menu .body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px}
#menu button.xp{display:flex;align-items:baseline;justify-content:space-between;gap:12px;width:100%;padding:9px 14px;border:1px solid #003c74;border-radius:3px;cursor:pointer;
  background:linear-gradient(#fff,#ecebe6 86%,#d6d0c5);color:#111;font:15px Tahoma,sans-serif;text-align:left;box-shadow:inset 0 -1px #d6d0c5;outline:none}
#menu button.xp small{color:#555;font-size:13px}
#menu button.xp:hover,#menu button.xp.sel{box-shadow:inset 0 0 0 2px #f8b636,inset 0 -1px #d6d0c5}
#menu button.xp:active{background:linear-gradient(#e5e4dd,#e2e2da 14%,#f1f0eb)}
#menu button.xp:disabled{color:#a7a69c;cursor:default;box-shadow:none;border-color:#c9c7ba}#menu button.xp:disabled small{color:#b8b6aa}
#menu .info{min-height:1.3em;color:#3b4a5a;font-size:12.5px;padding:0 2px}
#menu .list{background:#fff;border:1px solid #7f9db9;max-height:min(40vh,320px);overflow:auto}
#menu table{width:100%;border-collapse:collapse;font-size:13px}
#menu th{position:sticky;top:0;background:linear-gradient(#fff,#ebeadb);border-bottom:1px solid #d6d2c2;text-align:left;font-weight:normal;padding:4px 8px;color:#333}
#menu td{padding:6px 8px;border-bottom:1px solid #f0efe8;white-space:nowrap}
#menu tr.row{cursor:pointer}#menu tr.row:hover td,#menu tr.row.sel td{background:#316ac5;color:#fff}
#menu .empty{padding:18px;text-align:center;color:#777}
#menu .row2{display:flex;gap:10px}#menu .row2 button.xp{justify-content:center}
#menu button.xp.del{color:#9b1c10}#menu button.xp.del.hot{background:linear-gradient(#f27a63,#d63d22 86%,#b02a12);color:#fff;border-color:#7a1a0a}#menu button.xp.del.hot small{color:#ffe1d8}
#menu .conf{background:#fff7d6;border:1px solid #d9b44a;padding:10px 12px;font-size:13.5px;color:#4a3a10}#menu .conf b{color:#9b1c10}
#menu .hint{position:fixed;left:0;right:0;bottom:14px;text-align:center;color:rgba(255,255,255,.75);font-size:12px;text-shadow:0 1px 2px rgba(0,0,0,.6)}
#menu [hidden]{display:none!important}`;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',`<div id="menu">
  <canvas id="mtitle" aria-label="SHADER COMPILATION FAILED"></canvas>
  <div class="win" role="dialog" aria-label="Main menu">
    <div class="bar"><span class="ico"></span><span class="t" id="mwt">C:\\SCF\\start.exe</span><span class="x">×</span></div>
    <div class="body" id="mmain">
      <button class="xp" id="mNew">New Game <small>新游戏</small></button>
      <button class="xp" id="mCont">Continue <small>继续游戏</small></button>
      <button class="xp" id="mLoad">Load Game <small>读取存档</small></button>
      <div class="info" id="minfo"></div>
    </div>
    <div class="body" id="mlist" hidden>
      <div class="list"><table><thead><tr><th>Save</th><th>Where</th><th>Moons</th><th>Last played</th></tr></thead><tbody id="mrows"></tbody></table><div class="empty" id="mempty" hidden>No saves yet. 还没有存档。</div></div>
      <div class="row2" id="mrow"><button class="xp" id="mBack">Back <small>返回</small></button><button class="xp del" id="mDel" disabled>Delete <small>删除</small></button><button class="xp" id="mGo" disabled>Load <small>读取</small></button></div>
      <div class="conf" id="mconf" hidden></div>
      <div class="row2" id="mrowc" hidden><button class="xp" id="mNo">Cancel <small>取消</small></button><button class="xp del hot" id="mYes">Delete <small>确认删除</small></button></div>
    </div>
  </div>
  <p class="hint">↑ ↓ to choose · Enter to confirm · Esc to go back</p>
</div>`);
    const $m=(id)=>document.getElementById(id),S=window.SCF_SAVE;
    const WHERE=(d)=>({playroom:'The Playroom',level1:'Checkerboard rooms · '+((d.li||0)+1),level2:'The grey stairs',hub:'The white screen'})[d.scene]||'The Playroom';
    const when=(t)=>{const d=new Date(t),p=(n)=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());};
    let leaving=false,pick=null,asking=false;
    const blip=(f,d)=>{try{if(!Snd.ctx)Snd.init();const ac=Snd.ctx;if(!ac)return;if(ac.state==='suspended')ac.resume();const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(0.03,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+0.02);}catch(e){}};
    const go=(slot)=>{if(leaving)return;leaving=true;S.select(slot.id);blip(220,0.25);$m('menu').classList.add('out');
      document.body.style.transition='opacity .7s';document.body.style.opacity='0';setTimeout(()=>{location.href=S.pageFor(slot);},720);};
    const refreshMain=()=>{const last=S.latest(),n=S.slots().length;$m('mCont').disabled=!last;$m('mLoad').disabled=!n;
      $m('minfo').textContent=last?'Last played: Save '+last.id+' — '+WHERE(last.data)+', '+when(last.updated):'No saves yet. 还没有存档。';};
    const buttons=()=>[...document.querySelectorAll('#menu .body:not([hidden]) button.xp')].filter((b)=>!b.disabled);
    const focusAt=(i)=>{const b=buttons();if(b.length)b[(i+b.length)%b.length].focus();};
    const showList=(on)=>{$m('mmain').hidden=on;$m('mlist').hidden=!on;$m('mwt').textContent=on?'C:\\SCF\\saves\\':'C:\\SCF\\start.exe';
      if(!on){refreshMain();focusAt(0);return;}
      ask(false);const rows=$m('mrows'),list=S.slots();rows.innerHTML='';pick=null;$m('mGo').disabled=true;$m('mDel').disabled=true;$m('mempty').hidden=list.length>0;
      for(const s of list){const tr=document.createElement('tr');tr.className='row';
        tr.innerHTML='<td>Save '+s.id+(s.id===S.currentId()?' ●':'')+'</td><td>'+WHERE(s.data)+(s.data.gun?' · size gun':'')+'</td><td>'+(s.data.moons||0)+'</td><td>'+when(s.updated)+'</td>';
        tr.onclick=()=>{if(asking)return;for(const r of rows.children)r.classList.remove('sel');tr.classList.add('sel');pick=s;$m('mGo').disabled=false;$m('mDel').disabled=false;blip(660,0.04);};
        tr.ondblclick=()=>go(s);rows.appendChild(tr);}
      if(rows.firstChild)rows.firstChild.onclick();};
    $m('mNew').onclick=()=>go(S.newGame());
    $m('mCont').onclick=()=>{const l=S.latest();if(l)go(l);};
    $m('mLoad').onclick=()=>showList(true);
    $m('mBack').onclick=()=>showList(false);
    $m('mGo').onclick=()=>{if(pick)go(pick);};
    // Delete: ask again, in the window itself, before anything is gone
    function ask(on){asking=on&&!!pick;$m('mrow').hidden=asking;$m('mconf').hidden=!asking;$m('mrowc').hidden=!asking;
      if(asking){$m('mconf').innerHTML='Delete <b>Save '+pick.id+'</b> &mdash; '+WHERE(pick.data)+', '+when(pick.updated)+'?<br>This cannot be undone. 删除后无法恢复。';$m('mNo').focus();blip(330,0.12);}}
    $m('mDel').onclick=()=>{if(pick)ask(true);};
    $m('mNo').onclick=()=>{ask(false);$m('mDel').focus();};
    $m('mYes').onclick=()=>{if(!pick)return;const id=pick.id;S.remove(id);blip(140,0.3);showList(true);if(!S.slots().length)showList(false);};
    document.addEventListener('focusin',(e)=>{for(const b of document.querySelectorAll('#menu button.xp'))b.classList.toggle('sel',b===e.target);});
    window.addEventListener('keydown',(e)=>{
      if(leaving)return;const onList=!$m('mlist').hidden;
      if(onList&&asking){if(e.code==='Escape'){e.preventDefault();ask(false);}else if(e.code==='Enter'){e.preventDefault();document.activeElement&&document.activeElement.click();}return;}
      if(onList&&e.code==='Delete'&&pick){e.preventDefault();ask(true);return;}
      if(e.code==='Escape'&&onList){showList(false);return;}
      if(onList&&(e.code==='ArrowUp'||e.code==='ArrowDown')){const rows=[...$m('mrows').children];if(!rows.length)return;e.preventDefault();
        let i=rows.findIndex((r)=>r.classList.contains('sel'));i=Math.max(0,Math.min(rows.length-1,i+(e.code==='ArrowUp'?-1:1)));rows[i].onclick();rows[i].scrollIntoView({block:'nearest'});return;}
      if(onList&&e.code==='Enter'){e.preventDefault();if(pick)go(pick);return;}
      if(e.code==='ArrowUp'||e.code==='ArrowDown'){e.preventDefault();const b=buttons(),i=b.indexOf(document.activeElement);focusAt(i<0?0:i+(e.code==='ArrowUp'?-1:1));blip(660,0.04);}
    },true);
    // the name, in the hall's lettering, laid over the top of the view
    const tc=$m('mtitle');
    const paintTitle=()=>{const dpr=Math.min(window.devicePixelRatio||1,2),W=Math.round(innerWidth*dpr),H=Math.round(innerHeight*dpr);
      ttlBuild(W,Math.round(H*0.62));const im=TT.img;tc.width=im.width;tc.height=im.height;tc.style.width=(im.width/dpr)+'px';tc.style.height=(im.height/dpr)+'px';
      const c2=tc.getContext('2d');c2.clearRect(0,0,tc.width,tc.height);c2.drawImage(im,0,0);};
    paintTitle();addEventListener('resize',paintTitle);
    refreshMain();focusAt(0);
    requestAnimationFrame(()=>$m('menu').classList.add('on'));
  },
};
