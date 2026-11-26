// The size gun (伸缩枪): found at the end of the flooded passages behind the pool's round grate (js/playroom.js).
// Once you have it (SCF_SAVE gun), it goes with you everywhere: Z makes you smaller, X makes you bigger.
// turnSmall() does nothing if you are already small, turnBig() nothing if you are already big (or there is no room to grow);
// both return whether they worked. The size itself is SCF_SAVE small, the same one the little stairs in the checkerboard rooms change.
// Each scene says whether a change is allowed right now and carries it out, through window.__sizeGunScene = { can(toSmall), apply(toSmall) }.
'use strict';
(function () {
  const S = () => window.SCF_SAVE;
  const has = () => !!(S() && S().get('gun'));
  const isSmall = () => !!(S() && S().get('small'));
  let ac = null;
  function beep(ok, toSmall) {
    try {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); }
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination);
      if (ok) { o.type = 'triangle'; o.frequency.setValueAtTime(toSmall ? 900 : 220, t); o.frequency.exponentialRampToValueAtTime(toSmall ? 1800 : 110, t + 0.35); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.start(t); o.stop(t + 0.5); }
      else { o.type = 'square'; o.frequency.value = 95; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.start(t); o.stop(t + 0.25); }
    } catch (e) { /* sound is optional */ }
  }
  // the little picture of it in the corner, and what the keys do
  let hud = null;
  function build() {
    if (hud || !document.body) return;
    const st = document.createElement('style');
    st.textContent = "#sizegun{position:fixed;right:18px;bottom:18px;z-index:8;display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;border-radius:12px;background:rgba(255,248,220,.88);color:#35424a;font:17px/1.2 'Gochi Hand','Comic Sans MS',cursive;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none;transition:transform .12s}"
      + "#sizegun[hidden]{display:none}#sizegun kbd{font:inherit;padding:0 7px;border-radius:6px;background:#74e3a0;color:#17402b;box-shadow:0 2px 0 #3fae72}"
      + "#sizegun .rows{display:flex;flex-direction:column;gap:4px}#sizegun .off{opacity:.38}"
      + "#sizegun.zap svg .ring{animation:sg_zap .45s ease-out}@keyframes sg_zap{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(2.4)}}"
      + "#sizegun.no{animation:sg_no .3s}@keyframes sg_no{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}"
      + "#sizeflash{position:fixed;inset:0;pointer-events:none;z-index:7;opacity:0;transition:opacity .35s;background:radial-gradient(circle at 50% 55%,rgba(120,255,220,.0) 30%,rgba(120,255,220,.45) 100%)}";
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'sizegun'; hud.hidden = true;
    hud.innerHTML = '<svg width="58" height="40" viewBox="0 0 58 40" aria-hidden="true">'
      + '<path d="M14 22 L10 37 L19 37 L23 24 Z" fill="#e0692a" stroke="#8a3a12" stroke-width="1.5"/>'
      + '<rect x="6" y="10" width="34" height="14" rx="6" fill="#4fc3b0" stroke="#1f6e63" stroke-width="1.5"/>'
      + '<rect x="12" y="13" width="14" height="4" rx="2" fill="#fff8dc" opacity=".8"/>'
      + '<path d="M40 11 L50 7 L50 27 L40 23 Z" fill="#d993c2" stroke="#7d3f68" stroke-width="1.5"/>'
      + '<circle class="ring" cx="52" cy="17" r="5" fill="none" stroke="#7fffd4" stroke-width="2" style="transform-origin:52px 17px;opacity:0"/>'
      + '<circle cx="51" cy="17" r="2.6" fill="#7fffd4"/></svg>'
      + '<div class="rows"><span class="s"><kbd>Z</kbd> smaller</span><span class="b"><kbd>X</kbd> bigger</span></div>';
    document.body.appendChild(hud);
    const fl = document.createElement('div'); fl.id = 'sizeflash'; document.body.appendChild(fl);
  }
  function refresh() {
    build(); if (!hud) return;
    hud.hidden = !has();
    hud.querySelector('.s').classList.toggle('off', isSmall());
    hud.querySelector('.b').classList.toggle('off', !isSmall());
  }
  function kick(cls) { if (!hud) return; hud.classList.remove(cls); void hud.offsetWidth; hud.classList.add(cls); }
  function change(toSmall) {
    if (!has()) return false;
    const sc = window.__sizeGunScene;
    if (isSmall() === toSmall || !sc || !sc.can(toSmall)) { beep(false); kick('no'); return false; }
    sc.apply(toSmall); S().set('small', toSmall); beep(true, toSmall); kick('zap');
    const fl = document.getElementById('sizeflash'); if (fl) { fl.style.opacity = '1'; setTimeout(() => { fl.style.opacity = '0'; }, 160); }
    refresh(); return true;
  }
  const turnSmall = () => change(true);   // already small: false
  const turnBig = () => change(false);    // already big: false
  window.SizeGun = { turnSmall, turnBig, refresh, has, isSmall };
  addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyZ') turnSmall(); else if (e.code === 'KeyX') turnBig();
  });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', refresh); else refresh();
})();
