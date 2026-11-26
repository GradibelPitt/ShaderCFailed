// Things you carry (装备). A plain script every game page loads after js/save.js, like js/sizegun.js.
// What you have is kept in the save slot (window.SCF_SAVE):
//   items        the ids you are carrying, in the order they were picked up: 'gun' (the size gun), 'socket' (power strip), 'pump' (air pump), 'rocket'
//   itemSel      which of them is in your hand (an index into items)
//   pcPower      true once the power strip is plugged into the computer behind the level-select screen (js/hubpc.js)
//   castleFixed  true once the bounce house has been pumped up: it no longer comes down (js/bounce.js)
//   rocketTaken  true once the inflatable rocket has been carried out of the bounce house (js/bounce.js)
// With more than one thing, the mouse wheel changes which one is in your hand. Each scene decides what E does with it:
// the scene asks window.Equip.sel() and calls Equip.remove / Equip.say.
// The size gun is one of them too (it joins the list as soon as SCF_SAVE gun is set): its clicks (left smaller, right bigger) work only while it is in your hand (js/sizegun.js).
'use strict';
(function () {
  const S = () => window.SCF_SAVE;
  const ITEMS = {
    gun: { name: 'Size gun', svg: '<path d="M10 22 L7 35 L15 35 L18 24 Z" fill="#e0692a" stroke="#8a3a12" stroke-width="1.4"/><rect x="3" y="11" width="27" height="12" rx="5" fill="#4fc3b0" stroke="#1f6e63" stroke-width="1.4"/><rect x="8" y="14" width="11" height="3.5" rx="1.7" fill="#fff8dc" opacity=".8"/><path d="M30 12 L38 8 L38 26 L30 22 Z" fill="#d993c2" stroke="#7d3f68" stroke-width="1.4"/><circle cx="39" cy="17" r="2.4" fill="#7fffd4"/>' },
    socket: { name: 'Power strip', svg: '<rect x="4" y="15" width="34" height="11" rx="3" fill="#f2efe6" stroke="#8b877b" stroke-width="1.4"/><rect x="9" y="18.5" width="4" height="4" rx="1" fill="#55524b"/><rect x="17" y="18.5" width="4" height="4" rx="1" fill="#55524b"/><rect x="25" y="18.5" width="4" height="4" rx="1" fill="#55524b"/><rect x="32" y="18" width="4" height="5" rx="1" fill="#e2552c"/><path d="M4 20 C-2 20 0 32 8 32 S20 36 26 34" fill="none" stroke="#e08a2e" stroke-width="2"/>' },
    pump: { name: 'Air pump', svg: '<rect x="18" y="8" width="7" height="24" rx="2" fill="#cf3b2c" stroke="#7a2017" stroke-width="1.3"/><rect x="11" y="4" width="21" height="4" rx="2" fill="#2d2b33"/><rect x="20.5" y="6" width="2" height="4" fill="#8b8b8b"/><rect x="10" y="32" width="23" height="4" rx="1.5" fill="#2d2b33"/><path d="M25 28 C34 28 36 20 33 14" fill="none" stroke="#2d2b33" stroke-width="2"/><circle cx="21.5" cy="18" r="2.4" fill="#f4f1e8" stroke="#7a2017" stroke-width="0.8"/>' },
    rocket: { name: 'Inflatable rocket', svg: '<path d="M21 3 C29 10 30 22 27 31 L15 31 C12 22 13 10 21 3 Z" fill="#ece5d2" stroke="#8b7f66" stroke-width="1.3"/><path d="M21 3 C25 6 27 9 28 12 L14 12 C15 9 17 6 21 3 Z" fill="#d1452a"/><circle cx="21" cy="19" r="3.2" fill="#8ed0d6" stroke="#e0b91a" stroke-width="1.4"/><path d="M15 25 L9 34 L15 31 Z M27 25 L33 34 L27 31 Z" fill="#dc621a"/>' },
  };
  function list() {
    const s = S(); let v = s && s.get('items'); v = Array.isArray(v) ? v.filter((id) => ITEMS[id]) : [];
    if (s && s.get('gun') && !v.includes('gun')) { v.push('gun'); s.set('items', v.slice()); s.set('itemSel', v.length - 1); }   // the size gun was just found (or found before there was a list): it is in your hand
    return v;
  }
  const save = (items, sel) => { const s = S(); if (!s) return; s.set('items', items.slice()); s.set('itemSel', sel); };
  const selIndex = () => { const n = list().length, s = S(), i = (s && s.get('itemSel')) | 0; return n ? ((i % n) + n) % n : -1; };
  function sel() { const l = list(), i = selIndex(); return i < 0 ? null : l[i]; }
  function has(id) { return list().includes(id); }
  function add(id) { if (!ITEMS[id]) return false; const l = list(); if (l.includes(id)) return false; l.push(id); save(l, l.length - 1); refresh(); flash(); return true; }   // a new thing goes straight into your hand
  function remove(id) { const l = list(), i = l.indexOf(id); if (i < 0) return false; const cur = selIndex(); l.splice(i, 1); save(l, Math.max(0, Math.min(cur > i ? cur - 1 : cur, l.length - 1))); refresh(); return true; }
  function cycle(d) { const l = list(); if (l.length < 2) return; save(l, (selIndex() + d + l.length) % l.length); refresh(); tick(); }

  // the little cards in the corner, a line of words, and the E above whatever you are looking at
  let hud = null, toast = null, prompt = null, toastT = 0;
  function build() {
    if (hud || !document.body) return;
    const st = document.createElement('style');
    st.textContent = "#equip{position:fixed;left:18px;bottom:18px;z-index:8;display:flex;align-items:flex-end;gap:8px;pointer-events:none;font:17px/1.2 'Gochi Hand','Comic Sans MS',cursive;color:#35424a}"
      + "#equip[hidden]{display:none}#equip .it{width:52px;height:52px;border-radius:12px;background:rgba(255,248,220,.55);display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s,box-shadow .15s;opacity:.7}"
      + "#equip .it.on{background:rgba(255,248,220,.92);box-shadow:0 0 0 3px #74e3a0,0 4px 0 #3fae72;transform:translateY(-4px);opacity:1}"
      + "#equip .lab{padding:6px 10px;border-radius:10px;background:rgba(255,248,220,.88);margin-left:4px;white-space:nowrap}#equip .lab small{display:block;font-size:13px;opacity:.65}"
      + "#equip.pop .it.on{animation:eq_pop .4s ease-out}@keyframes eq_pop{0%{transform:translateY(-4px) scale(1.5)}100%{transform:translateY(-4px) scale(1)}}"
      + "#eqsay{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:9;max-width:80vw;padding:8px 16px;border-radius:12px;background:rgba(255,248,220,.9);color:#35424a;font:21px/1.3 'Gochi Hand','Comic Sans MS',cursive;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s}"
      + "#eqp{position:fixed;left:0;top:0;z-index:8;display:none;pointer-events:none;transform:translate(-50%,-140%);font:700 22px/1 system-ui,sans-serif}"
      + "#eqp b{display:block;min-width:30px;padding:7px 9px;text-align:center;border-radius:9px;background:#fff8dc;color:#17402b;box-shadow:0 4px 0 #c9a21c,0 0 18px 4px rgba(255,216,74,.6)}";
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'equip'; hud.hidden = true; document.body.appendChild(hud);
    toast = document.createElement('div'); toast.id = 'eqsay'; document.body.appendChild(toast);
    prompt = document.createElement('div'); prompt.id = 'eqp'; prompt.innerHTML = '<b>E</b>'; document.body.appendChild(prompt);
  }
  function refresh() {
    build(); if (window.SizeGun && !refresh.inner) { refresh.inner = true; try { window.SizeGun.refresh(); } catch (e) {} refresh.inner = false; } if (!hud) return;
    const l = list(), i = selIndex(); hud.hidden = !l.length; if (!l.length) { hud.innerHTML = ''; return; }
    hud.innerHTML = l.map((id, k) => '<div class="it' + (k === i ? ' on' : '') + '"><svg width="42" height="40" viewBox="0 0 42 40" aria-hidden="true">' + ITEMS[id].svg + '</svg></div>').join('')
      + '<div class="lab">' + ITEMS[l[i]].name + (l.length > 1 ? '<small>scroll to switch</small>' : '') + '</div>';
  }
  function flash() { if (!hud) return; hud.classList.remove('pop'); void hud.offsetWidth; hud.classList.add('pop'); }
  let ac = null;
  function tick() { try { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); } if (ac.state === 'suspended') ac.resume(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 660; g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.08); } catch (e) { /* sound is optional */ } flash(); }
  function say(text, sec) {
    build(); if (!toast) return; toast.textContent = text; toast.style.opacity = text ? '1' : '0'; toastT = text ? (sec || 3) : 0;
    clearTimeout(say.t); if (text) say.t = setTimeout(() => { toast.style.opacity = '0'; }, toastT * 1000);
  }
  function showPrompt(x, y) { build(); if (!prompt) return; if (x === null || x === undefined) { prompt.style.display = 'none'; return; } prompt.style.display = 'block'; prompt.style.left = x + 'px'; prompt.style.top = y + 'px'; }

  let wheelAt = 0;   // a trackpad sends a stream of small wheel events: one step per flick
  addEventListener('wheel', (e) => { if (e.ctrlKey || list().length < 2 || Math.abs(e.deltaY) < 4) return; const t = performance.now(); if (t - wheelAt < 220) { wheelAt = t; return; } wheelAt = t; cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  window.Equip = { ITEMS, list, has, add, remove, sel, cycle, say, prompt: showPrompt, refresh };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', refresh); else refresh();
})();
