// The G book: press G at any time, in any scene, for a little instruction book.
// Its pages come from the scene (SCF_G.setPages(fn): fn() returns the pages for right now); every scene also gets a page of controls.
// Top left of the book: back to the main menu (index.html; click twice). Top right: settings (mouse sensitivity, volume), kept for all saves.
// While the book is open the game gets no keys and no clicks, and the pointer is let go so the buttons can be clicked.
// Also here: the settings themselves (window.SCF_SETTINGS), and the volume, applied to every sound the page makes by putting a gain
// between each audio context and its speakers (so every scene's own sound code works unchanged). Load this right after js/save.js.
'use strict';
(function () {
  /* ---------- settings ---------- */
  const SKEY = 'scf.settings', SDEF = { sens: 1, vol: 1 };
  let st = Object.assign({}, SDEF); try { Object.assign(st, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* defaults */ }
  const vols = [];
  window.SCF_SETTINGS = {
    get: (k) => st[k],
    set(k, v) { st[k] = v; try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) {} if (k === 'vol') for (const g of vols) g.gain.value = v; },
  };
  const Base = window.AudioContext || window.webkitAudioContext;
  if (Base) {
    const realDest = Object.getOwnPropertyDescriptor(window.BaseAudioContext ? BaseAudioContext.prototype : Base.prototype, 'destination');
    if (realDest && realDest.get) {
      class VolumeContext extends Base {
        constructor(...a) {
          super(...a); const out = realDest.get.call(this), g = this.createGain(); g.gain.value = st.vol; g.connect(out); vols.push(g);
          Object.defineProperty(this, 'destination', { get: () => g, configurable: true });
        }
      }
      window.AudioContext = VolumeContext; if (window.webkitAudioContext) window.webkitAudioContext = VolumeContext;
    }
  }

  /* ---------- the book ---------- */
  let pagesFn = () => [], pages = [], page = 0, open = false, view = 'pages', leaveArmed = 0;
  const hasGun = () => !!(window.SCF_SAVE && SCF_SAVE.get('gun'));
  function controlsPage() {
    const li = (k, t) => '<li><kbd>' + k + '</kbd> ' + t + '</li>';
    return { t: 'Controls', html: '<ul class="keys">' + li('W A S D', 'walk') + li('Shift', 'run') + li('Space', 'jump') + li('C', 'crouch')
      + li('E', 'pick up, use') + li('Mouse', 'look (click the picture first)') + (hasGun() ? li('Z', 'size gun: smaller') + li('X', 'size gun: bigger') : '')
      + li('G', 'this book, any time') + '</ul>' };
  }
  const CSS = `#gmenu{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
#gmenu[hidden]{display:none}
#gmenu .book{position:relative;width:min(480px,86vw);max-height:92vh;overflow:auto;box-sizing:border-box;transform:rotate(-2deg);padding:52px 30px 20px;border-radius:10px;
  background:#fff8dc;color:#35424a;font:22px/1.35 'Gochi Hand','Comic Sans MS','Segoe Print',cursive;box-shadow:0 18px 60px rgba(0,0,0,.55),inset 0 0 0 6px #ffd84a;text-wrap:pretty}
#gmenu .top{position:absolute;left:18px;right:18px;top:14px;display:flex;justify-content:space-between;gap:10px}
#gmenu .top button{font:inherit;font-size:18px;line-height:1.1;padding:4px 12px 5px;border:0;border-radius:9px;cursor:pointer;background:#ffe9a8;color:#5a4318;box-shadow:0 3px 0 #d8b24a}
#gmenu .top button:hover{background:#ffdf86}#gmenu .top button.armed{background:#e0692a;color:#fff;box-shadow:0 3px 0 #9b3a12}
#gmenu h1{margin:0 0 4px;font-size:34px;line-height:1;font-weight:400;color:#e0692a;text-align:center}
#gmenu .pg p{margin:6px 0 0;text-align:center}
#gmenu .photo{position:relative;width:min(300px,64vw);margin:6px auto 14px;padding:10px 10px 34px;background:#fff;box-shadow:0 6px 16px rgba(0,0,0,.28),0 1px 3px rgba(0,0,0,.2);transform:rotate(var(--r,-3deg))}
#gmenu .photo img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#222}
#gmenu .photo figcaption{position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:19px;color:#5b6269}
#gmenu .photo .tape{position:absolute;top:-13px;left:50%;width:96px;height:28px;transform:translateX(-50%) rotate(-4deg);background:rgba(255,234,150,.72);box-shadow:0 1px 2px rgba(0,0,0,.18);z-index:1}
#gmenu ul.keys{list-style:none;margin:10px 0 0;padding:0}#gmenu ul.keys li{margin:7px 0;display:flex;align-items:center;gap:10px}
#gmenu kbd{font:inherit;padding:0 8px;border-radius:7px;background:#74e3a0;color:#17402b;box-shadow:0 3px 0 #3fae72;white-space:nowrap}
#gmenu .turn{display:flex;align-items:center;justify-content:center;gap:16px;margin:14px 0 0}
#gmenu .arr{cursor:pointer;color:#e0692a;font-size:22px;line-height:1;user-select:none}
#gmenu .dots{display:flex;gap:8px}#gmenu .dots i{display:block;width:11px;height:11px;border-radius:50%;background:#e2d7b3}#gmenu .dots i.on{background:#e0692a}
#gmenu .close{margin:14px 0 0;text-align:right;font-size:17px;color:#7a8a8f}
#gmenu .set label{display:block;margin:14px 0 2px}#gmenu .set input[type=range]{width:100%;accent-color:#e0692a}
#gmenu .set .v{float:right;color:#e0692a}`;
  let root = null;
  function build() {
    if (root) return;
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    root = document.createElement('div'); root.id = 'gmenu'; root.hidden = true;
    root.innerHTML = '<div class="book" role="dialog" aria-label="Instruction book"><div class="top"><button id="gmMain">&larr; Main menu</button><button id="gmSet">Settings &#9881;</button></div><div id="gmBody"></div></div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.target === root) setOpen(false); });
    root.addEventListener('click', (e) => e.stopPropagation());
    root.querySelector('#gmMain').onclick = () => {
      const b = root.querySelector('#gmMain');
      if (performance.now() - leaveArmed < 3000) { location.href = 'index.html'; return; }
      leaveArmed = performance.now(); b.classList.add('armed'); b.textContent = 'Click again to leave';
      setTimeout(() => { if (performance.now() - leaveArmed >= 2900) { b.classList.remove('armed'); b.innerHTML = '&larr; Main menu'; } }, 3000);
    };
    root.querySelector('#gmSet').onclick = () => { view = view === 'settings' ? 'pages' : 'settings'; render(); };
  }
  function render() {
    const body = root.querySelector('#gmBody'); root.querySelector('#gmSet').innerHTML = view === 'settings' ? '&larr; Back to the book' : 'Settings &#9881;';
    if (view === 'settings') {
      body.innerHTML = '<h1>Settings</h1><div class="set">'
        + '<label>Mouse sensitivity <span class="v" id="gmSv"></span></label><input type="range" id="gmS" min="0.2" max="3" step="0.05">'
        + '<label>Volume <span class="v" id="gmVv"></span></label><input type="range" id="gmV" min="0" max="1" step="0.01"></div>'
        + '<p class="close">Kept for every save &middot; <kbd>G</kbd> close</p>';
      const S = body.querySelector('#gmS'), V = body.querySelector('#gmV');
      const show = () => { body.querySelector('#gmSv').textContent = (+S.value).toFixed(2) + '×'; body.querySelector('#gmVv').textContent = Math.round(V.value * 100) + '%'; };
      S.value = st.sens; V.value = st.vol; show();
      S.oninput = () => { SCF_SETTINGS.set('sens', +S.value); show(); }; V.oninput = () => { SCF_SETTINGS.set('vol', +V.value); show(); };
      return;
    }
    const p = pages[page] || { t: '', html: '' };
    const inner = p.html != null ? '<h1>' + p.t + '</h1>' + p.html
      : '<figure class="photo" style="--r:' + [-4, 3, -2, 4, -3][page % 5] + 'deg"><i class="tape"></i><img src="' + p.img + '" alt="" draggable="false"><figcaption>' + p.cap + '</figcaption></figure><h1>' + p.t + '</h1><p>' + p.b + '</p>';
    body.innerHTML = '<section class="pg">' + inner + '</section>'
      + (pages.length > 1 ? '<nav class="turn"><span class="arr" id="gmL">&#9664;</span><span class="dots">' + pages.map((_, i) => '<i' + (i === page ? ' class="on"' : '') + '></i>').join('') + '</span><span class="arr" id="gmR">&#9654;</span></nav>' : '')
      + '<p class="close">' + (pages.length > 1 ? '<kbd>&larr;</kbd> <kbd>&rarr;</kbd> turn the page &middot; ' : '') + '<kbd>G</kbd> close</p>';
    const L = body.querySelector('#gmL'), R = body.querySelector('#gmR');
    if (L) L.onclick = () => turn(-1); if (R) R.onclick = () => turn(1);
  }
  function turn(d) { if (view !== 'pages' || pages.length < 2) return; page = (page + d + pages.length) % pages.length; render(); }
  function setOpen(on) {
    build(); if (on === open) return; open = on;
    if (on) {
      let own = []; try { own = pagesFn() || []; } catch (e) { own = []; }
      pages = own.concat([controlsPage()]); if (page >= pages.length) page = 0; view = 'pages';
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
      window.dispatchEvent(new Event('blur'));   // every scene lets go of held keys on blur: nobody keeps walking while the book is open
      render();
    }
    root.hidden = !on;
  }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyG') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setOpen(!open); return; }
    if (!open) return;
    e.stopImmediatePropagation();   // the game hears nothing while the book is open
    if (e.code === 'Escape') setOpen(false);
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) turn(e.code === 'ArrowRight' ? 1 : -1); }
  }, true);
  window.addEventListener('keyup', (e) => { if (open) e.stopImmediatePropagation(); }, true);
  window.SCF_G = { setPages(fn) { pagesFn = fn; }, isOpen: () => open, open: () => setOpen(true), close: () => setOpen(false) };
})();
