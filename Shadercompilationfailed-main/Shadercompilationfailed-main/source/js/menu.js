// The main menu (index.html): what start_game.bat / start_game.command open.
// Behind it, the level-select hall's field of grass, drawn by the hall's own shader (js/hub.js), seen from far out in the field
// where the white screen and the computer behind it are lost in the haze; the view turns slowly. Over it, the game's name in the hall's own
// lettering (the same strokes, ttlBuild in js/hub.js), and three choices:
//   New Game   a new save slot (the existing ones are kept), starting in the playroom
//   Continue   the save played last, where it was left
//   Load Game  every save, to pick one (or delete one: it asks again first); and Import / Export / Export all, which read saves in from
//              a .json file (added as new saves, nothing here is replaced) and write the chosen save, or all of them, out to one
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
#menu .row2{display:flex;gap:10px}#menu .row2 button.xp{justify-content:center;white-space:nowrap;padding-left:8px;padding-right:8px;gap:8px}
#menu button.xp.del{color:#9b1c10}#menu button.xp.del.hot{background:linear-gradient(#f27a63,#d63d22 86%,#b02a12);color:#fff;border-color:#7a1a0a}#menu button.xp.del.hot small{color:#ffe1d8}
#menu .conf{background:#fff7d6;border:1px solid #d9b44a;padding:10px 12px;font-size:13.5px;color:#4a3a10}#menu .conf b{color:#9b1c10}
#menu .hint{position:fixed;left:0;right:0;bottom:14px;text-align:center;color:rgba(255,255,255,.75);font-size:12px;text-shadow:0 1px 2px rgba(0,0,0,.6)}
#menu [hidden]{display:none!important}
#menu .ach{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid #f0efe8}#menu .ach:last-child{border-bottom:0}
#menu .ach i{flex:none;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6b0,#f1b62e 55%,#b07a10);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 1px 2px rgba(0,0,0,.3)}
#menu .ach.lock i{background:radial-gradient(circle at 35% 35%,#f4f4f0,#c9c7ba 60%,#9a988c);filter:grayscale(1)}
#menu .ach b{display:block;font-size:14px}#menu .ach span{color:#555;font-size:12.5px}#menu .ach.lock b{color:#8a897f}#menu .ach.lock span{color:#a7a69c}
#menu .achsel{display:flex;align-items:center;gap:8px}#menu .achsel .xp{width:auto;flex:none;padding:5px 12px}#menu .achsel .who{flex:1;text-align:center;font-size:13px;color:#333}`;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',`<div id="menu">
  <canvas id="mtitle" aria-label="SHADER COMPILATION FAILED"></canvas>
  <div class="win" role="dialog" aria-label="Main menu">
    <div class="bar"><span class="ico"></span><span class="t" id="mwt">C:\\SCF\\start.exe</span><span class="x">×</span></div>
    <div class="body" id="mmain">
      <button class="xp" id="mNew">New Game <small>新游戏</small></button>
      <button class="xp" id="mCont">Continue <small>继续游戏</small></button>
      <button class="xp" id="mLoad">Load Game <small>读取存档</small></button>
      <button class="xp" id="mAch">Achievements <small>成就</small></button>
      <div class="info" id="minfo"></div>
    </div>
    <div class="body" id="machv" hidden>
      <div class="achsel"><button class="xp" id="maPrev">&lt;</button><span class="who" id="maWho"></span><button class="xp" id="maNext">&gt;</button></div>
      <div class="list" id="malist"></div>
      <div class="row2"><button class="xp" id="maBack">Back <small>返回</small></button></div>
    </div>
    <div class="body" id="mlist" hidden>
      <div class="list"><table><thead><tr><th>Save</th><th>Where</th><th>Moons</th><th>Last played</th></tr></thead><tbody id="mrows"></tbody></table><div class="empty" id="mempty" hidden>No saves yet. 还没有存档。</div></div>
      <div class="row2" id="mrow"><button class="xp" id="mBack">Back <small>返回</small></button><button class="xp del" id="mDel" disabled>Delete <small>删除</small></button><button class="xp" id="mGo" disabled>Load <small>读取</small></button></div>
      <div class="row2" id="mrowio"><button class="xp" id="mImp">Import <small>导入</small></button><button class="xp" id="mExp" disabled>Export <small>导出</small></button><button class="xp" id="mExpAll" disabled>Export all <small>全部导出</small></button></div>
      <div class="info" id="mlinfo"></div><input type="file" id="mfile" accept=".json,application/json" hidden>
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
      document.body.style.transition='opacity .7s';document.body.style.opacity='0';setTimeout(()=>{(window.scfGo?scfGo(S.pageFor(slot)):(location.href=S.pageFor(slot)));},720);};
    const refreshMain=()=>{const last=S.latest();$m('mCont').disabled=!last;   // Load Game stays open with no saves: it is where one is imported
      $m('minfo').textContent=last?'Last played: Save '+last.id+' — '+WHERE(last.data)+', '+when(last.updated):'No saves yet. 还没有存档。';};
    const buttons=()=>[...document.querySelectorAll('#menu .body:not([hidden]) button.xp')].filter((b)=>!b.disabled);
    const focusAt=(i)=>{const b=buttons();if(b.length)b[(i+b.length)%b.length].focus();};
    const showList=(on)=>{$m('mmain').hidden=on;$m('mlist').hidden=!on;$m('mwt').textContent=on?'C:\\SCF\\saves\\':'C:\\SCF\\start.exe';
      if(!on){refreshMain();focusAt(0);return;}
      ask(false);note('');const rows=$m('mrows'),list=S.slots();rows.innerHTML='';pick=null;$m('mGo').disabled=true;$m('mDel').disabled=true;$m('mExp').disabled=true;$m('mExpAll').disabled=!list.length;$m('mempty').hidden=list.length>0;
      for(const s of list){const tr=document.createElement('tr');tr.className='row';
        tr.innerHTML='<td>Save '+s.id+(s.id===S.currentId()?' ●':'')+'</td><td>'+WHERE(s.data)+(s.data.gun?' · size gun':'')+'</td><td>'+(s.data.moons||0)+'</td><td>'+when(s.updated)+'</td>';
        tr.onclick=()=>{if(asking)return;for(const r of rows.children)r.classList.remove('sel');tr.classList.add('sel');pick=s;$m('mGo').disabled=false;$m('mDel').disabled=false;$m('mExp').disabled=false;blip(660,0.04);};
        tr.ondblclick=()=>go(s);rows.appendChild(tr);}
      if(rows.firstChild)rows.firstChild.onclick();};
    $m('mNew').onclick=()=>go(S.newGame());
    $m('mCont').onclick=()=>{const l=S.latest();if(l)go(l);};
    $m('mLoad').onclick=()=>showList(true);
    // Achievements: each save has its own; < and > go through the saves (the one played last first)
    let achI=0;
    const showAch=(on)=>{$m('mmain').hidden=on;$m('machv').hidden=!on;$m('mwt').textContent=on?'C:\\SCF\\achievements\\':'C:\\SCF\\start.exe';
      if(!on){refreshMain();focusAt(3);return;}achI=0;paintAch();$m('maBack').focus();};
    const paintAch=()=>{const list=S.slots(),A=window.SCF_ACH,L=A?A.LIST:[];const s=list.length?list[(achI%list.length+list.length)%list.length]:null,have=s&&A?A.of(s.data):[];
      const shown=L.filter((a)=>have.includes(a.id));   // only the ones earned: the rest are not shown, nor how many there are
      $m('maWho').textContent=s?'Save '+s.id+' — '+shown.length+' achievement'+(shown.length===1?'':'s'):'No saves yet. 还没有存档。';
      $m('maPrev').disabled=$m('maNext').disabled=list.length<2;
      $m('malist').innerHTML=s&&!shown.length?'<div class="empty">No achievements yet. 还没有成就。</div>':'';for(const a of shown){const d=document.createElement('div');d.className='ach';d.innerHTML='<i></i><div><b></b><span></span></div>';d.querySelector('b').textContent=a.name;d.querySelector('span').textContent=a.desc;$m('malist').appendChild(d);}};
    $m('mAch').onclick=()=>showAch(true);
    $m('maBack').onclick=()=>showAch(false);
    $m('maPrev').onclick=()=>{achI--;paintAch();blip(660,0.04);};
    $m('maNext').onclick=()=>{achI++;paintAch();blip(660,0.04);};
    $m('mBack').onclick=()=>showList(false);
    $m('mGo').onclick=()=>{if(pick)go(pick);};
    // Delete: ask again, in the window itself, before anything is gone
    function ask(on){asking=on&&!!pick;$m('mrow').hidden=asking;$m('mrowio').hidden=asking;$m('mlinfo').hidden=asking;$m('mconf').hidden=!asking;$m('mrowc').hidden=!asking;
      if(asking){$m('mconf').innerHTML='Delete <b>Save '+pick.id+'</b> &mdash; '+WHERE(pick.data)+', '+when(pick.updated)+'?<br>This cannot be undone. 删除后无法恢复。';$m('mNo').focus();blip(330,0.12);}}
    $m('mDel').onclick=()=>{if(pick)ask(true);};
    $m('mNo').onclick=()=>{ask(false);$m('mDel').focus();};
    $m('mYes').onclick=()=>{if(!pick)return;const id=pick.id;S.remove(id);blip(140,0.3);showList(true);note('Save '+id+' deleted. 已删除。');};
    // Export: the chosen save, or all of them, written out as a .json file (a download). Import: a file like that read back in;
    // every save in it is added as a new one, and nothing already here is touched.
    const note=(t)=>{$m('mlinfo').textContent=t;};
    const stamp=()=>{const d=new Date(),p=(n)=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes());};
    const saveOut=(id)=>{const o=S.exportSlots(id);if(!o.slots.length)return;const name='scf-'+(id==null?'saves':'save-'+id)+'-'+stamp()+'.json';
      const url=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
      blip(520,0.1);note((id==null?o.slots.length+' save'+(o.slots.length>1?'s':''):'Save '+id)+' exported to '+name+'. 已导出。');};
    $m('mExp').onclick=()=>{if(pick)saveOut(pick.id);};
    $m('mExpAll').onclick=()=>saveOut(null);
    $m('mImp').onclick=()=>{$m('mfile').value='';$m('mfile').click();};
    $m('mfile').onchange=()=>{const f=$m('mfile').files[0];if(!f)return;
      if(f.size>2e6){blip(140,0.3);note('That file is too big to be a save. 文件过大，不是存档。');return;}
      const rd=new FileReader();rd.onerror=()=>{blip(140,0.3);note('Could not read that file. 无法读取该文件。');};
      rd.onload=()=>{let made=null;try{made=S.importSlots(JSON.parse(String(rd.result)));}catch(e){made=null;}
        if(!made||!made.length){blip(140,0.3);note('Not a save file. 这不是存档文件，没有导入任何内容。');return;}
        showList(true);blip(520,0.1);note(made.length+' save'+(made.length>1?'s':'')+' imported as Save '+made.map((s)=>s.id).join(', ')+'. 已导入为新存档。');};
      rd.readAsText(f);};
    document.addEventListener('focusin',(e)=>{for(const b of document.querySelectorAll('#menu button.xp'))b.classList.toggle('sel',b===e.target);});
    window.addEventListener('keydown',(e)=>{
      if(leaving)return;const onList=!$m('mlist').hidden;
      if(onList&&asking){if(e.code==='Escape'){e.preventDefault();ask(false);}else if(e.code==='Enter'){e.preventDefault();document.activeElement&&document.activeElement.click();}return;}
      if(onList&&e.code==='Delete'&&pick){e.preventDefault();ask(true);return;}
      if(e.code==='Escape'&&onList){showList(false);return;}
      if(!$m('machv').hidden){if(e.code==='Escape'){showAch(false);return;}if(e.code==='ArrowLeft'){$m('maPrev').click();return;}if(e.code==='ArrowRight'){$m('maNext').click();return;}}
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
