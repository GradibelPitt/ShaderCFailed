// The loading screen. Every game page loads this first thing in <body>, so the very first picture of a page is this, not a half-built scene.
// Every page of the game builds its whole world when it opens (geometry, baked light, textures drawn in code) and the graphics driver then
// has to build every shader the first time it is drawn: for the first second or so the frames stutter. All of that now happens behind here.
// It goes once three things are true: the page has finished loading, everything that asked to be waited for is ready (hold / wait), and the
// scene has drawn a run of smooth frames in a row (so the shaders and textures really are built). Then it fades and the game is there.
//
//   SCF_LOADING.active            true while it is up (a scene can keep its intro clock still meanwhile)
//   SCF_LOADING.hold(fn)          on this page's opening: also wait until fn() is true (or a promise resolves)
//   SCF_LOADING.wait(fn, opts)    later on, inside a page: cover the screen until fn() is true and the frames are smooth again
//   SCF_LOADING.need(fn, opts)    either: added to the opening wait if that is still up, else a wait of its own
//   SCF_LOADING.whenDone(cb)      cb() once it has gone (at once if it is not up)
//   scfGo(url, opts)              go to another page: the loading screen covers the old one at once, then the browser leaves.
//                                 opts.bg: the colour to cover with (and to open the next page with), e.g. '#fff' out of the rocket's white
'use strict';
(function () {
  const SMOOTH_FRAMES = 18;     // frames in a row...
  const SMOOTH_MS = 70;         // ...each no longer than this (or, on a computer that is simply slow, not much longer than its usual frame), and it is ready
  const MIN_MS = 350;           // never just a flash
  const MAX_MS = 20000;         // and never stuck: after this it goes anyway
  const FADE_MS = 450;
  let bg = '#000';
  try { const c = sessionStorage.getItem('scfLoadBg'); if (c) { bg = c; sessionStorage.removeItem('scfLoadBg'); } } catch (e) {}
  const light = (c) => /^#(f|e|d)/i.test(c);

  const el = document.createElement('div'); el.id = 'scfload';
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;' +
    'background:' + bg + ';opacity:1;transition:opacity ' + FADE_MS + 'ms linear;cursor:wait;user-select:none;-webkit-user-select:none';
  // the word, drawn in code from a 5x7 grid (no font to wait for)
  const word = document.createElement('canvas'); word.width = 7 * 6 * 4 + 3 * 4 * 4; word.height = 7 * 4;
  word.style.cssText = 'image-rendering:pixelated;width:' + word.width + 'px;height:' + word.height + 'px;opacity:.82';
  // the bar, like an old computer starting up: three blocks going round and round in a rounded frame
  const bar = document.createElement('div');
  bar.style.cssText = 'position:relative;width:156px;height:16px;border:2px solid ' + (light(bg) ? '#9aa0a8' : '#b8bcc4') + ';border-radius:5px;overflow:hidden;box-sizing:border-box;opacity:.85';
  const blocks = document.createElement('div');
  blocks.style.cssText = 'position:absolute;top:2px;left:0;height:8px;width:36px;display:flex;gap:3px;will-change:transform';
  for (let i = 0; i < 3; i++) { const b = document.createElement('i'); b.style.cssText = 'display:block;width:10px;height:8px;border-radius:1px;background:linear-gradient(#7fa8ff,#2652d8 55%,#1c3fae)'; blocks.appendChild(b); }
  bar.appendChild(blocks); el.appendChild(word); el.appendChild(bar);
  const mount = () => { if (!el.isConnected) (document.body || document.documentElement).appendChild(el); };
  mount(); if (!document.body) document.addEventListener('DOMContentLoaded', mount);

  const G5 = { L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'], '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'] };
  const wctx = word.getContext('2d');
  function drawWord(dots) {
    wctx.clearRect(0, 0, word.width, word.height);
    wctx.fillStyle = light(bg) ? '#3a3f46' : '#d8dbe0';
    let x = 0; const s = 4;
    for (const ch of 'LOADING' + '.'.repeat(dots)) {
      const g = G5[ch], w = ch === '.' ? 4 : 6;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1' && (ch !== '.' || c < 3)) wctx.fillRect((x + c) * s, r * s, s, s);
      x += w;
    }
  }
  drawWord(0);

  /* ---- state ---- */
  const L = { active: true, t0: performance.now(), holds: [], done: [], until: 0 };
  let smooth = 0, lastF = 0, fading = false, raf = 0, dotsAt = -1; const recent = [];
  const pageLoaded = () => document.readyState === 'complete';
  const holdsReady = () => L.holds.every((h) => { try { return h.ok || (h.fn && !!h.fn()); } catch (e) { return true; } });
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = lastF ? now - lastF : 0; lastF = now;
    if (dt) { recent.push(dt); if (recent.length > 30) recent.shift(); }
    // the blocks go round on the clock, not on frames, so a stalled frame shows as a stall and nothing jumps
    const k = ((now - L.t0) / 1500) % 1; blocks.style.transform = 'translateX(' + (-40 + k * 196).toFixed(1) + 'px)';
    const d = Math.floor((now - L.t0) / 400) % 4; if (d !== dotsAt) { dotsAt = d; drawWord(d); }
    if (fading) return;
    const waiting = !pageLoaded() || !holdsReady();
    const usual = recent.length >= 10 ? recent.slice().sort((a, b) => a - b)[recent.length >> 1] : 0;   // this computer's ordinary frame, the stalls left out
    if (waiting || !dt || dt > Math.max(SMOOTH_MS, usual * 1.6)) smooth = 0; else smooth++;
    const age = now - L.t0;
    if ((smooth >= SMOOTH_FRAMES && age >= MIN_MS && !waiting) || age > L.until) finish();
  }
  function finish() {
    if (fading) return; fading = true;
    el.style.pointerEvents = 'none'; el.style.opacity = '0';
    setTimeout(() => {
      if (!fading) return;   // covered again meanwhile
      cancelAnimationFrame(raf); raf = 0; el.style.display = 'none'; L.active = false; fading = false;
      const cbs = L.done.splice(0); for (const cb of cbs) try { cb(); } catch (e) { console.error(e); }
    }, FADE_MS);
  }
  function cover(fadeIn, colour) {
    if (colour) { bg = colour; el.style.background = colour; drawWord(dotsAt < 0 ? 0 : dotsAt); }
    mount(); L.active = true; fading = false; smooth = 0; lastF = 0; recent.length = 0; L.t0 = performance.now(); L.until = MAX_MS;
    el.style.display = 'flex'; el.style.pointerEvents = 'auto';
    if (fadeIn) { el.style.transition = 'none'; el.style.opacity = '0'; void el.offsetWidth; el.style.transition = 'opacity ' + fadeIn + 'ms linear'; el.style.opacity = '1';
      setTimeout(() => { el.style.transition = 'opacity ' + FADE_MS + 'ms linear'; }, fadeIn); }
    else { el.style.transition = 'none'; el.style.opacity = '1'; void el.offsetWidth; el.style.transition = 'opacity ' + FADE_MS + 'ms linear'; }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  L.until = MAX_MS; raf = requestAnimationFrame(tick);

  // nothing reaches the game while it is up (the keys you let go of still do, so nobody is left walking)
  addEventListener('keydown', (e) => {
    if (!L.active || fading || e.ctrlKey || e.metaKey || /^F\d+$/.test(e.code)) return;
    e.stopImmediatePropagation(); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }, true);
  // back to this page from the browser's back/forward cache: it is already built
  addEventListener('pageshow', (e) => { if (e.persisted && L.active) { fading = false; finish(); } });

  window.SCF_LOADING = {
    get active() { return L.active; },
    hold(fn) { if (fn && typeof fn.then === 'function') { const h = { ok: false }; L.holds.push(h); fn.then(() => { h.ok = true; }, () => { h.ok = true; }); } else if (typeof fn === 'function') L.holds.push({ fn }); },
    wait(fn, opts) {
      opts = opts || {}; L.holds = (typeof fn === 'function') ? [{ fn }] : [];
      cover(opts.fadeIn === undefined ? 250 : opts.fadeIn, opts.bg);
      if (opts.max) L.until = opts.max;
    },
    // wait for fn() too: kept on the opening wait if that is still up, else the screen is covered again for it
    need(fn, opts) { if (L.active && !fading) L.holds.push({ fn }); else this.wait(fn, opts); },
    whenDone(cb) { if (!L.active) cb(); else L.done.push(cb); },
    cover,
  };
  // go to another page: cover the old one at once (it would otherwise sit frozen while the next one is fetched and built)
  window.scfGo = function (url, opts) {
    opts = opts || {};
    let to = null; try { to = new URL(url, location.href); } catch (e) {}
    if (to && to.pathname === location.pathname && to.search === location.search) { location.href = url; return; }   // only the #part changes: the same page, nothing reloads
    try { if (opts.bg) sessionStorage.setItem('scfLoadBg', opts.bg); } catch (e) {}
    cover(opts.fadeIn || 0, opts.bg); L.until = 1e9;
    let gone = false; const go = () => { if (gone) return; gone = true; location.href = url; };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 250);   // in case frames have stopped (a hidden tab)
  };
})();
