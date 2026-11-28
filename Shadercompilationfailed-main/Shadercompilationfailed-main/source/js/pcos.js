// The computer behind the level-select screen, once it has power (js/hubpc.js opens this with window.PCOS.open()).
// A full-screen Windows 95-style desktop, after the user's own DH Midterm project: My Computer, My Documents, the Recycle Bin,
// Netscape, an MS-DOS prompt. The power button at the bottom left shuts it down and gives you back the field.
// On the disk: the diary of the man this all belongs to (he has Alzheimer's, he is in hospital, he is stuck in this dream).
// The way out of the dream: in the MS-DOS prompt, `su` with the root password (it is somewhere in his files) uploads his consciousness,
// and he wakes: in a pod, in the black tower (blacktower.html, which opens with him pulling the tube out and pushing the lid open).
// Load this before js/gmenu.js: while the computer is open it takes every key first (so typing a G does not open the book).
'use strict';
(function () {
  const PASS = ['orion1979'];   // Tom's ship and the year it was lost (Unfulfilled Dream.txt + the note in the Recycle Bin); any capitals will do
  const T = (lines) => lines.join('\n');
  // ---------------------------------------------------------------- the disk
  const F = (name, text, date) => ({ type: 'file', name, text, date: date || '' });
  const D = (name, kids) => ({ type: 'dir', name, kids });
  const DIARY = [
    F('Unfulfilled Dream.txt', T([
      'When I was nine I told my father I was going to walk on the Moon.',
      'He laughed, then he saw my face and stopped laughing, and bought me',
      'a telescope the next Christmas. I still have it. Somewhere.',
      '',
      'I made it into the program in 1976. Flight engineer candidate,',
      'fourth on the list. Tom Hale was second. Tom flew first.',
      '',
      'ORION went up on the morning of March 3rd, 1979, with Tom on board.',
      'I watched it from the roof of Building 4 with a cup of coffee',
      'going cold in my hand, until it was a star, and then not even that.',
      '',
      'On the ninth day the telemetry stopped. On the tenth, his voice.',
      'They kept the channel open for two years. Every night somebody sat',
      'by the receiver and listened. Some nights it was me.',
      'ORION never answered. Tom never came home.',
      'I still do not know where he is. Nobody does.',
      '',
      'They shelved the whole program "pending review".',
      'The review took nineteen years. When they finally opened it again',
      'I was fifty-eight. They sent me a kind letter and a pen.',
      'I retired in 2003.',
      '',
      'I never went up. Not once.',
      'I still look at the sky every night. I still want to go.',
      'I think I will always want to go.',
    ]), '04/11/2019'),
    F('The Stairs.txt', T([
      'Dr. Lin says I should write things down while I still can.',
      'So. Writing things down.',
      '',
      'Some mornings I do not know the nurse. Some mornings I do not',
      'know the room. Yesterday I asked for Margaret. Margaret has been',
      'gone eleven years. The nurse was very kind about it.',
      '',
      'I keep having the same dream.',
      'A grey place. Stairs, only stairs. Stairs going up into stairs',
      'going down, sideways, upside down, all of them grey, all of them',
      'leading back to themselves. No colour. No sound but my own feet.',
      'I walk for hours. I never get anywhere.',
      '',
      'When I wake up I am not sure I have woken up.',
      'Lately I am not sure I ever leave.',
      '',
      'If I could get on a rocket - just once - it would take me up,',
      'straight up, out of that place. Up is the one way those stairs',
      'never really go.',
      '',
      'I wish I could ride a rocket out of here.',
    ]), '09/02/2023'),
    F('03-14.txt', T([
      'The old computer still works. Sarah set it up for me again and put',
      'a password on the important part ("root", she calls it) so that I',
      'do not "break anything". I wrote the password down.',
      'Then I threw the note away so nobody would find it.',
      'Then I forgot where I threw it.',
      '',
      'Sarah says it is what I would have picked anyway. Something I',
      'would never forget. She does not know how much I forget now.',
    ]), '03/14/2023'),
    F('05-02.txt', T([
      'Made tea. Found a cup of tea already on the table, still warm.',
      'Drank both. Did not tell anyone.',
      '',
      'Sarah brought the grandchildren. The little one asked if I was',
      'really almost an astronaut. I said yes. She asked why I did not go.',
      'I could not remember for a moment. Then I could, and I wished I',
      'could not.',
    ]), '05/02/2023'),
    F('07-19.txt', T([
      'They moved me to a new room. Window faces a wall.',
      'At night the corridor light comes under the door and it looks like',
      'the bottom step of a staircase.',
      '',
      'I counted the steps in the dream tonight. I got to four hundred',
      'and then I was at the bottom again.',
    ]), '07/19/2023'),
    F('11-30.txt', T([
      'cant find the',
      '',
      'the word for the thing you sleep in',
      '',
      'bed. bed. writing it here so it stays',
    ]), '11/30/2023'),
  ];
  const ROOT = D('C:', [
    D('My Documents', [D('Diary', DIARY), F('grocery list.txt', T(['milk', 'eggs', 'bread', 'milk', 'milk']), '06/08/2023')]),
    D('Program Files', [D('Netscape', [F('readme.txt', 'Netscape Navigator 3.0\nThank you for choosing Netscape.')]), D('Accessories', [F('notepad.exe', '[program]')])]),
    D('Windows', [F('win.ini', T(['[windows]', 'load=', 'run=', '', '[Desktop]', 'Wallpaper=field.bmp', 'TileWallpaper=0'])), F('system.ini', '[boot]\nshell=Explorer.exe'), F('field.bmp', '[image]')]),
    F('autoexec.bat', T(['@ECHO OFF', 'PROMPT $P$G', 'PATH C:\\WINDOWS;C:\\WINDOWS\\COMMAND'])),
    F('config.sys', T(['DEVICE=C:\\WINDOWS\\HIMEM.SYS', 'FILES=40'])),
  ]);
  const BIN = D('Recycle Bin', [
    F('note to self.txt', T([
      'ROOT PASSWORD',
      '(because you WILL forget it, you old fool)',
      '',
      "  the name of Tom's ship",
      '  + the year we lost him',
      '',
      '  no spaces.',
      '',
      'Now throw this away.',
    ]), '03/14/2023'),
    F('letter_1998.txt', T([
      'Dear Mr. Weller,',
      '',
      'Following the conclusion of the program review, we are pleased to',
      'announce that crewed flight operations will resume next year.',
      'Regrettably, candidates from the 1976 selection group will not be',
      'considered for assignment, owing to age requirements.',
      '',
      'Please accept the enclosed pen as a token of our gratitude for your',
      'many years of service.',
    ]), '10/06/1998'),
  ]);
  ROOT.kids.forEach(function link(n) { if (n.type === 'dir') n.kids.forEach((k) => { k.parent = n; link(k); }); });
  ROOT.kids.forEach((k) => { k.parent = ROOT; });
  BIN.kids.forEach((k) => { k.parent = BIN; });
  const pathOf = (n) => { if (n === BIN) return 'Recycle Bin'; const p = []; for (let x = n; x; x = x.parent) p.unshift(x.name); return p.join('\\') + (n === ROOT ? '\\' : ''); };
  const find = (dir, name) => (dir.kids || []).find((k) => k.name.toLowerCase() === name.toLowerCase());

  // ---------------------------------------------------------------- look
  const ICON = {
    computer: 'img/pc/computer.png', bin: 'img/pc/recycle_bin.png', netscape: 'img/pc/netscape.png',
    folder: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><path d="M2 8h11l2 3h15v17H2z" fill="#c8a400" stroke="#000"/><path d="M2 13h28v15H2z" fill="#fde26b" stroke="#000"/></svg>'),
    file: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#000"/><path d="M20 3v6h6" fill="#ccc" stroke="#000"/><path d="M10 13h12M10 16h12M10 19h12M10 22h8" stroke="#000080"/></svg>'),
    dos: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="2" y="5" width="28" height="22" fill="#c0c0c0" stroke="#000"/><rect x="2" y="5" width="28" height="4" fill="#000080"/><rect x="4" y="11" width="24" height="14" fill="#000"/><path d="M6 15h4M6 19h10" stroke="#c0c0c0" stroke-width="2"/></svg>'),
    exe: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="4" y="6" width="24" height="20" fill="#fff" stroke="#000"/><rect x="4" y="6" width="24" height="4" fill="#000080"/></svg>'),
  };
  const CSS = `
#pcos{position:fixed;inset:0;z-index:25;background:#000;font:13px/1.25 Tahoma,'MS Sans Serif','Segoe UI',Arial,sans-serif;color:#000;user-select:none;-webkit-user-select:none;cursor:default}
#pcos[hidden]{display:none}
#pcos .scr{position:absolute;inset:0;overflow:hidden;transform-origin:50% 50%;background:linear-gradient(#3b74d4 0%,#7aaee9 46%,#bdd8f3 60%,#5fa83c 61%,#428f2b 80%,#2e6c1f 100%)}
#pcos .scr.on{animation:pc_on .55s ease-out}@keyframes pc_on{0%{transform:scale(1,0.004);filter:brightness(4)}50%{transform:scale(1,0.004)}100%{transform:scale(1,1);filter:none}}
#pcos .crt{position:absolute;inset:0;pointer-events:none;z-index:50;background:repeating-linear-gradient(rgba(0,0,0,.13) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.45) 100%);animation:pc_fl 3s infinite}
@keyframes pc_fl{0%,100%{opacity:.95}50%{opacity:.85}}
#pcos .cloud{position:absolute;left:58%;top:30%;width:120px;height:26px;border-radius:26px;background:rgba(255,255,255,.85);box-shadow:60px -14px 0 -4px rgba(255,255,255,.7)}
#pcos .icons{position:absolute;left:10px;top:12px;display:flex;flex-direction:column;flex-wrap:wrap;gap:18px;height:calc(100% - 60px)}
#pcos .ic{width:78px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:2px}
#pcos .ic img{width:32px;height:32px;image-rendering:pixelated}
#pcos .ic span{color:#fff;text-shadow:1px 1px 0 #000;padding:0 2px;font-size:12px}
#pcos .ic.sel span{background:#000080;outline:1px dotted #fff;text-shadow:none}
#pcos .ic.sel img{filter:brightness(.6) sepia(1) hue-rotate(190deg) saturate(4)}
#pcos .bev{background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:inset -1px -1px #808080,inset 1px 1px #dfdfdf}
#pcos .inset{border:2px solid;border-color:#808080 #fff #fff #808080;box-shadow:inset 1px 1px #000}
#pcos button{font:inherit;color:#000;background:#c0c0c0;border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:inset -1px -1px #808080,inset 1px 1px #dfdfdf;padding:2px 8px;min-height:24px}
#pcos button:active,#pcos button.dn{border-color:#000 #fff #fff #000;box-shadow:inset 1px 1px #808080}
#pcos .bar{position:absolute;left:0;right:0;bottom:0;height:32px;display:flex;align-items:center;gap:4px;padding:0 3px;z-index:40;border-top:2px solid #fff}
#pcos .pwr{width:30px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;color:#b00;font-weight:bold;font-size:15px}
#pcos .start{font-weight:bold;display:flex;align-items:center;gap:5px;height:26px}
#pcos .start i{width:16px;height:14px;background:conic-gradient(#e33 0 25%,#3a3 0 50%,#ec3 0 75%,#36d 0);display:inline-block;transform:skewX(-8deg)}
#pcos .tasks{display:flex;gap:3px;flex:1;overflow:hidden}
#pcos .tasks button{width:160px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:26px}
#pcos .tray{height:24px;display:flex;align-items:center;padding:0 10px}
#pcos .menu{position:absolute;left:36px;bottom:32px;z-index:45;width:210px;display:flex}
#pcos .menu[hidden]{display:none}
#pcos .menu .side{width:24px;background:linear-gradient(#000080,#1084d0);color:#c0c0c0;writing-mode:vertical-rl;transform:rotate(180deg);font-weight:bold;font-size:17px;padding:6px 3px}
#pcos .menu ul{list-style:none;margin:0;padding:2px;flex:1}#pcos .menu li{padding:7px 10px;display:flex;align-items:center;gap:8px}#pcos .menu li img{width:22px;height:22px}
#pcos .menu li:hover{background:#000080;color:#fff}#pcos .menu hr{border:0;border-top:1px solid #808080;border-bottom:1px solid #fff;margin:2px}
#pcos .win{position:absolute;display:flex;flex-direction:column;min-width:260px;min-height:140px;padding:2px}
#pcos .tt{height:22px;display:flex;align-items:center;gap:5px;padding:0 3px 0 5px;color:#fff;font-weight:bold;background:linear-gradient(90deg,#808080,#b5b5b5)}
#pcos .win.top .tt{background:linear-gradient(90deg,#000080,#1084d0)}
#pcos .tt span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pcos .tt img{width:16px;height:16px}
#pcos .tt button{width:18px;height:16px;min-height:0;padding:0;font-size:11px;line-height:10px;font-weight:bold}
#pcos .mb{display:flex;gap:2px;padding:2px 2px}#pcos .mb span{padding:1px 6px}#pcos .mb span:first-letter{text-decoration:underline}
#pcos .addr{display:flex;align-items:center;gap:6px;padding:2px 4px}#pcos .addr div{flex:1;background:#fff;padding:2px 4px}
#pcos .body{flex:1;margin:2px;background:#fff;overflow:auto;position:relative}
#pcos .grid{display:flex;flex-wrap:wrap;align-content:flex-start;gap:10px;padding:10px}
#pcos .grid .ic span{color:#000;text-shadow:none}#pcos .grid .ic.sel span{color:#fff}
#pcos .status{display:flex;gap:2px;padding:2px}#pcos .status div{flex:1;padding:1px 4px}
#pcos pre.np{margin:0;padding:6px 8px;font:14px/1.35 'Lucida Console','Courier New',monospace;white-space:pre;user-select:text;-webkit-user-select:text}
#pcos .dos{background:#000;color:#c0c0c0;font:15px/1.3 'Lucida Console',Consolas,'Courier New',monospace;padding:6px 8px;white-space:pre-wrap;word-break:break-all;cursor:text}
#pcos .dos .cur{display:inline-block;width:.6em;height:1em;background:#c0c0c0;vertical-align:text-bottom;animation:pc_cur 1s steps(1) infinite}@keyframes pc_cur{50%{opacity:0}}
#pcos .dos.up{animation:pc_shake .09s infinite}#pcos .dos.up .ln{display:inline-block;animation:pc_j .16s steps(2) infinite}
@keyframes pc_shake{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,-2px)}100%{transform:translate(1px,2px)}}
@keyframes pc_j{0%{transform:translateX(-3px);color:#9effa0}100%{transform:translateX(3px);color:#fff}}
#pcos .static{width:100%;height:100%;display:block;image-rendering:pixelated;background:#000}
#pcos .splash,#pcos .bye{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}
#pcos .splash{background:linear-gradient(#000 0,#0b1e5e 100%);color:#fff;font:bold 28px Tahoma,Arial,sans-serif}
#pcos .splash small{font:13px Tahoma,Arial;color:#9db3ff}#pcos .splash .pb{width:240px;height:12px;border:1px solid #9db3ff;overflow:hidden}#pcos .splash .pb i{display:block;height:100%;width:30%;background:repeating-linear-gradient(90deg,#3b6cff 0 10px,#9db3ff 10px 14px);animation:pc_pb 1.2s linear infinite}
@keyframes pc_pb{from{transform:translateX(-100%)}to{transform:translateX(340%)}}
#pcos .bye{background:#000;color:#ff8a00;font:22px 'Lucida Console',monospace;text-align:center}
#pcos .end{position:absolute;inset:0;z-index:70;background:#fff;opacity:0;transition:opacity 2.2s;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;font:19px/1.6 Georgia,'Times New Roman',serif;color:#2a2f33;text-align:center;padding:0 10vw}
#pcos .end.dark{background:#0d1012;color:#cfd6d8}
#pcos .end h2{font:normal 13px/1 Tahoma,Arial;letter-spacing:.35em;color:#8a969a;margin:0}
#pcos .end h1{font:normal 40px/1.1 Georgia,serif;margin:0;letter-spacing:.06em}
#pcos .end p{margin:0;opacity:0;transition:opacity 1.6s}#pcos .end p.in{opacity:1}
#pcos .end .btns{display:flex;gap:12px;opacity:0;transition:opacity 1.6s}#pcos .end .btns.in{opacity:1}
`;
  let root = null, scr = null, wins = [], zTop = 10, openFlag = false, focusWin = null, booting = 0;
  const $ = (s, el) => (el || root).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function build() {
    if (root) return;
    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'pcos'; root.hidden = true; document.body.appendChild(root);
    // nothing in here reaches the game underneath
    for (const ev of ['mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu', 'mousemove', 'pointerdown', 'pointerup']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'contextmenu') e.preventDefault(); });
  }
  function desktop() {
    root.innerHTML = '';
    scr = el('div', 'scr'); root.appendChild(scr); root.appendChild(el('div', 'crt'));
    scr.appendChild(el('i', 'cloud'));
    const icons = el('div', 'icons'); scr.appendChild(icons);
    const items = [
      ['computer', 'My Computer', () => explorer(ROOT)], ['folder', 'My Documents', () => explorer(find(ROOT, 'My Documents'))],
      ['bin', 'Recycle Bin', () => explorer(BIN)], ['netscape', 'Netscape Navigator', netscape], ['dos', 'MS-DOS Prompt', dos],
    ];
    for (const [ic, name, fn] of items) icons.appendChild(iconEl(ic, name, fn, icons));
    const bar = el('div', 'bar bev'); scr.appendChild(bar);
    const pwr = el('button', 'pwr', '&#x23FB;'); pwr.title = 'Turn off the computer'; pwr.onclick = shutDown; bar.appendChild(pwr);
    const start = el('button', 'start', '<i></i>Start'); bar.appendChild(start);
    bar.appendChild(el('div', 'tasks'));
    const tray = el('div', 'tray inset', ''); bar.appendChild(tray); clock(tray);
    const menu = el('div', 'menu bev', '<div class="side">Windows 95</div><ul><li data-a="docs"><img src="' + ICON.folder + '">Documents</li><li data-a="dos"><img src="' + ICON.dos + '">MS-DOS Prompt</li><li data-a="np"><img src="' + ICON.netscape + '">Netscape Navigator</li><hr><li data-a="off"><img src="' + ICON.computer + '">Shut Down...</li></ul>');
    menu.hidden = true; scr.appendChild(menu);
    start.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; start.classList.toggle('dn', !menu.hidden); };
    menu.onclick = (e) => { const li = e.target.closest('li'); if (!li) return; menu.hidden = true; start.classList.remove('dn'); ({ docs: () => explorer(find(ROOT, 'My Documents')), dos, np: netscape, off: shutDown })[li.dataset.a](); };
    scr.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu') && !e.target.closest('.start')) { menu.hidden = true; start.classList.remove('dn'); } if (e.target === scr || e.target.classList.contains('icons')) icons.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); });
  }
  function clock(tray) { const f = () => { const d = new Date(); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; tray.textContent = h + ':' + m + ' ' + ap; }; f(); clearInterval(clock.t); clock.t = setInterval(f, 10000); }
  function iconEl(ic, name, fn, group) {
    const d = el('div', 'ic', '<img draggable="false" src="' + (ICON[ic] || ic) + '"><span>' + esc(name) + '</span>');
    d.addEventListener('mousedown', () => { group.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); d.classList.add('sel'); });
    d.addEventListener('dblclick', fn); return d;
  }
  // ---------------------------------------------------------------- windows
  function win(title, icon, w, h, cls) {
    const n = wins.length, W = scr.clientWidth, H = scr.clientHeight - 32;
    w = Math.min(w, W - 20); h = Math.min(h, H - 20);
    const x = Math.max(10, Math.min(W - w - 10, (W - w) / 2 - 60 + n * 28)), y = Math.max(10, Math.min(H - h - 10, (H - h) / 2 - 40 + n * 24));
    const d = el('div', 'win bev ' + (cls || ''), '<div class="tt"><img src="' + icon + '"><span>' + esc(title) + '</span><button class="x">&#x2715;</button></div>');
    Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    scr.appendChild(d);
    const tb = el('button', '', '<img src="' + icon + '" style="width:16px;height:16px;vertical-align:middle;margin-right:4px">' + esc(title)); $('.tasks', scr).appendChild(tb);
    const W8 = { d, tb, onKey: null, onClose: null };
    wins.push(W8);
    const close = () => { if (W8.onClose) W8.onClose(); d.remove(); tb.remove(); wins = wins.filter((x) => x !== W8); if (focusWin === W8) focus(wins[wins.length - 1] || null); };
    W8.close = close; d.querySelector('.x').onclick = close;
    d.addEventListener('mousedown', () => focus(W8)); tb.onclick = () => focus(W8);
    // drag by the title bar
    const tt = d.querySelector('.tt');
    tt.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return; e.preventDefault(); const ox = e.clientX - d.offsetLeft, oy = e.clientY - d.offsetTop;
      const mv = (ev) => { d.style.left = Math.max(-w + 60, Math.min(scr.clientWidth - 60, ev.clientX - ox)) + 'px'; d.style.top = Math.max(0, Math.min(scr.clientHeight - 60, ev.clientY - oy)) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv, true); removeEventListener('mouseup', up, true); };
      addEventListener('mousemove', mv, true); addEventListener('mouseup', up, true);
    });
    focus(W8); return W8;
  }
  function focus(W8) {
    focusWin = W8; for (const x of wins) { x.d.classList.toggle('top', x === W8); x.tb.classList.toggle('dn', x === W8); }
    if (W8) W8.d.style.zIndex = ++zTop;
  }
  function explorer(dir) {
    const W8 = win(dir === BIN ? 'Recycle Bin' : dir === ROOT ? 'My Computer' : dir.name, dir === BIN ? ICON.bin : dir === ROOT ? ICON.computer : ICON.folder, 520, 360);
    W8.d.insertAdjacentHTML('beforeend', '<div class="mb"><span>File</span><span>Edit</span><span>View</span><span>Help</span></div><div class="addr"><span>Address</span><div class="inset"></div></div><div class="body inset"><div class="grid"></div></div><div class="status"><div class="inset"></div><div class="inset"></div></div>');
    let cur = dir;
    const show = (d) => {
      cur = d; W8.d.querySelector('.tt span').textContent = d === BIN ? 'Recycle Bin' : d === ROOT ? 'My Computer' : d.name; W8.tb.lastChild.textContent = W8.d.querySelector('.tt span').textContent;
      W8.d.querySelector('.addr div').textContent = d === ROOT ? 'C:\\' : pathOf(d);
      const g = W8.d.querySelector('.grid'); g.innerHTML = '';
      if (d.parent && d !== BIN) g.appendChild(iconEl('folder', '..', () => show(d.parent), g));
      for (const k of d.kids) g.appendChild(iconEl(k.type === 'dir' ? 'folder' : /\.(exe|bmp|ini|sys|bat)$/i.test(k.name) ? 'exe' : 'file', k.name, () => (k.type === 'dir' ? show(k) : open(k)), g));
      const st = W8.d.querySelectorAll('.status div'); st[0].textContent = d.kids.length + ' object(s)'; st[1].textContent = d === BIN ? 'Deleted files' : '';
    };
    show(dir);
  }
  function open(f) {
    if (/\.txt$/i.test(f.name) || /\.(ini|bat|sys)$/i.test(f.name)) return notepad(f);
    if (/notepad\.exe$/i.test(f.name)) return notepad(F('Untitled', ''));
    msg(f.name, 'Cannot open this file.\n\nThere is no program associated with it.');
  }
  function notepad(f) {
    const W8 = win(f.name + ' - Notepad', ICON.file, 660, 440);
    W8.d.insertAdjacentHTML('beforeend', '<div class="mb"><span>File</span><span>Edit</span><span>Search</span><span>Help</span></div><div class="body inset"><pre class="np"></pre></div>');
    W8.d.querySelector('pre').textContent = f.text;
  }
  function msg(title, text) {
    const W8 = win(title, ICON.exe, 330, 150);
    W8.d.insertAdjacentHTML('beforeend', '<div style="flex:1;padding:14px 14px 6px;white-space:pre-wrap">' + esc(text) + '</div><div style="text-align:center;padding:6px"><button>OK</button></div>');
    W8.d.querySelector('div:last-child button').onclick = W8.close;
  }
  function netscape() {
    const W8 = win('Netscape - [Welcome to World Wide Web]', ICON.netscape, 560, 400);
    W8.d.insertAdjacentHTML('beforeend', '<div class="mb"><span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Help</span></div><div class="body inset" style="background:#000"><canvas class="static" width="140" height="100"></canvas></div><div class="status"><div class="inset">Document: Done</div></div>');
    const c = W8.d.querySelector('canvas'), g = c.getContext('2d'), img = g.createImageData(140, 100);
    const t = setInterval(() => { for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); }, 120);
    W8.onClose = () => clearInterval(t);
  }
  // ---------------------------------------------------------------- MS-DOS
  function dos() {
    const W8 = win('MS-DOS Prompt', ICON.dos, 640, 400);
    W8.d.insertAdjacentHTML('beforeend', '<div class="body dos"></div>');
    const out = W8.d.querySelector('.dos');
    let cwd = ROOT, line = '', mode = 'cmd', tries = 0, hist = [], hi = 0, done = false, text = 'Microsoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1995.\n\n';
    const prompt = () => (mode === 'pass' ? 'Password: ' : (cwd === ROOT ? 'C:\\' : pathOf(cwd)) + '>');
    const draw = () => { out.innerHTML = esc(text) + '<span class="ln">' + esc(prompt() + (mode === 'pass' ? '*'.repeat(line.length) : line)) + '</span>' + (done ? '' : '<span class="cur"></span>'); out.scrollTop = out.scrollHeight; };
    const say = (t) => { text += t + '\n'; };
    function run(cmdline) {
      const [cmd, ...rest] = cmdline.trim().split(/\s+/), arg = rest.join(' '), c = (cmd || '').toLowerCase();
      if (!c) return;
      // help, HELP, -help, /help, ##help, /?, ?... any case, any marks around it
      if (c.replace(/[^a-z]/g, '') === 'help' || /^[\/\-#!?.]*\?$/.test(c)) { say('  DIR      list files\n  CD       change directory  (CD .. goes up, CD \\ to the top)\n  TYPE     show a text file\n  CLS      clear the screen\n  VER      version\n  SU       become root (administrator)\n  EXIT     close this window\n'); return; }
      if (c === 'cls') { text = ''; return; }
      if (c === 'ver') { say('\nWindows 95. [Version 4.00.950]\n'); return; }
      if (c === 'exit') { W8.close(); return; }
      if (c === 'echo') { say(arg); return; }
      if (c === 'whoami') { say('user'); return; }
      if (c === 'dir') {
        say('\n Volume in drive C has no label\n Directory of ' + (cwd === ROOT ? 'C:\\' : pathOf(cwd)) + '\n');
        for (const k of cwd.kids) say((k.type === 'dir' ? '<DIR>'.padEnd(10) : String(k.text.length).padStart(9) + ' ') + ' ' + (k.date || '01/01/1995').padEnd(11) + k.name);
        say('        ' + cwd.kids.length + ' file(s)\n'); return;
      }
      if (c === 'cd' || c === 'chdir' || /^cd(\.\.|\\)$/.test(c)) {
        const a = /^cd(\.\.|\\)$/.test(c) ? c.slice(2) : arg.replace(/^"|"$/g, '');
        if (!a) { say(cwd === ROOT ? 'C:\\' : pathOf(cwd)); return; }
        if (a === '\\' || /^c:\\?$/i.test(a)) { cwd = ROOT; return; }
        let d = /^c:\\/i.test(a) ? ROOT : cwd;
        for (const part of a.replace(/^c:\\/i, '').split('\\').filter(Boolean)) {
          if (part === '..') { d = d.parent || d; continue; }
          const k = find(d, part); if (!k || k.type !== 'dir') { say('Invalid directory'); return; } d = k;
        }
        cwd = d; return;
      }
      if (c === 'type' || c === 'more') {
        const k = find(cwd, arg.replace(/^"|"$/g, '')); if (!k) { say('File not found - ' + arg); return; }
        if (k.type === 'dir') { say('Access denied'); return; } say(k.text + '\n'); return;
      }
      if (c === 'su' || c === 'sudo' || c === 'login' || c === 'runas') {
        if (rest.length && !/^root$/i.test(rest[rest.length - 1])) { say('su: user ' + rest[rest.length - 1] + ' does not exist'); return; }
        mode = 'pass'; return;
      }
      if (/^[a-z]:$/i.test(c)) { say(c.toUpperCase() === 'C:' ? '' : 'Not ready reading drive ' + c[0].toUpperCase()); return; }
      say('Bad command or file name\nType HELP to see the commands you can use.');
    }
    function enter() {
      const v = line; line = '';
      if (mode === 'pass') {
        text += 'Password: ' + '*'.repeat(v.length) + '\n'; mode = 'cmd';
        if (PASS.includes(v.toLowerCase().replace(/[\s\-_.]/g, ''))) { upload(); return; }
        tries++; say('su: Authentication failure' + (tries >= 3 ? '\n(He threw the note away. Things that are thrown away are not always gone.)' : '') + '\n'); return;
      }
      text += prompt() + v + '\n'; if (v.trim()) { hist.push(v); hi = hist.length; } run(v);
    }
    // the way out
    function upload() {
      done = true; const steps = ['', 'root@localhost: access granted.', '', 'Locating memory banks ........ OK', 'Mapping hippocampal index ..... FRAGMENTED', 'Rebuilding index from diary ... OK', '', 'UPLOADING CONSCIOUSNESS'];
      let i = 0, pct = 0; out.classList.add('up');
      const t1 = setInterval(() => {
        if (i < steps.length) { say(steps[i++]); draw(); return; }
        pct = Math.min(100, pct + 1 + Math.random() * 6); const n = Math.round(pct / 4);
        const glitch = (s) => s.replace(/./g, (ch) => (Math.random() < 0.06 * pct / 100 ? '#%&@$*01'[Math.random() * 8 | 0] : ch));
        out.innerHTML = esc(text) + '<span class="ln">' + esc(glitch('[' + '#'.repeat(n) + '.'.repeat(25 - n) + '] ' + pct.toFixed(0).padStart(3) + '%')) + '</span>';
        out.scrollTop = out.scrollHeight;
        if (pct >= 100) { clearInterval(t1); setTimeout(wake, 700); }
      }, 140);
      W8.onClose = () => clearInterval(t1);
    }
    W8.onKey = (e) => {
      if (done) return;
      if (e.key === 'Enter') enter();
      else if (e.key === 'Backspace') line = line.slice(0, -1);
      else if (e.key === 'ArrowUp' && mode === 'cmd' && hist.length) { hi = Math.max(0, hi - 1); line = hist[hi]; }
      else if (e.key === 'ArrowDown' && mode === 'cmd' && hist.length) { hi = Math.min(hist.length, hi + 1); line = hist[hi] || ''; }
      else if (e.key === 'Escape') line = '';
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && line.length < 120) line += e.key;
      else return;
      draw();
    };
    draw();
  }
  // ---------------------------------------------------------------- out: into the black tower
  // The upload done, the screen goes white, then black, and he is somewhere else: blacktower.html, in a pod (its opening is his waking).
  function wake() {
    try { const s = window.SCF_SAVE; if (s) s.set('uploaded', true); } catch (e) {}
    const end = el('div', 'end', ''); root.appendChild(end);
    requestAnimationFrame(() => { end.style.opacity = '1'; });
    setTimeout(() => { scr.remove(); end.classList.add('dark'); }, 2600);
    setTimeout(() => { (window.scfGo ? scfGo('blacktower.html') : (location.href = 'blacktower.html')); }, 3600);
  }
  // ---------------------------------------------------------------- on and off
  function shutDown() {
    for (const W8 of wins.slice()) W8.close();
    const b = el('div', 'bye', 'Windows is shutting down...'); scr.appendChild(b);
    setTimeout(() => { b.innerHTML = "It's now safe to turn off<br>your computer."; }, 1400);
    setTimeout(() => close(), 3200);
  }
  function close() {
    if (!openFlag) return; openFlag = false; clearTimeout(booting);
    for (const W8 of wins.slice()) W8.close(); wins = []; root.hidden = true; root.innerHTML = '';
    if (window.PCOS.onClose) window.PCOS.onClose();
  }
  function openOS() {
    build(); if (openFlag) return; openFlag = true; root.hidden = false;
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    window.dispatchEvent(new Event('blur'));   // every scene lets go of held keys
    desktop(); scr.classList.add('on');
    const sp = el('div', 'splash', 'Windows 95<small>Starting...</small><div class="pb"><i></i></div>'); scr.appendChild(sp);
    booting = setTimeout(() => sp.remove(), 1700);
  }
  // every key goes to the computer while it is open (registered before js/gmenu.js, so it hears them first)
  addEventListener('keydown', (e) => {
    if (!openFlag) return;
    if (/^F\d+$/.test(e.key) && e.key !== 'F1') return;   // F5, F12... stay with the browser
    e.stopImmediatePropagation(); e.preventDefault();
    if (focusWin && focusWin.onKey) focusWin.onKey(e);
  }, true);
  addEventListener('keyup', (e) => { if (openFlag && !/^F\d+$/.test(e.key)) e.stopImmediatePropagation(); }, true);
  window.PCOS = { open: openOS, close, isOpen: () => openFlag, onClose: null };
})();
