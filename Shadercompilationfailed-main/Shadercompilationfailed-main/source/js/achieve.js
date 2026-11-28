// Achievements. A plain script, loaded right after js/save.js on every page, so window.SCF_ACH is there for all of them.
// Each save has its own (SCF_SAVE ach: the ids unlocked in that save). The first time one is earned in a save, a window pops up in the game
// for a few seconds; the main menu (js/menu.js) has a page listing them all for any save.
// A new one: add it to LIST, and call SCF_ACH.unlock(id) where it is earned.
'use strict';
(function () {
  const LIST = [
    { id: 'chair', name: 'You can sit on this chair!', desc: '在游乐室泳池边的白色沙滩椅上坐下' },
    { id: 'speed', name: '终极神速', desc: '未到达选关房的情况下到达月球基地' },
  ];
  const S = () => window.SCF_SAVE;
  const got = () => { const a = S() && S().get('ach'); return Array.isArray(a) ? a : []; };
  let box = null, timer = 0, ac = null;
  function chime() {   // three little rising notes
    try { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); } if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime; [[784, 0], [988, 0.09], [1319, 0.18]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.07, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5); o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + 0.55); });
    } catch (e) { /* sound is optional */ }
  }
  function pop(a) {   // an XP-style balloon, top middle of the screen
    if (!box) {
      const st = document.createElement('style');
      st.textContent = "#achpop{position:fixed;left:50%;top:22px;z-index:99;transform:translate(-50%,-30px);opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;width:min(380px,86vw);border-radius:7px 7px 3px 3px;background:#ece9d8;box-shadow:0 0 0 1px #0831d9,0 10px 34px rgba(0,0,0,.45);overflow:hidden;font:13px/1.35 Tahoma,'Segoe UI','Microsoft YaHei',sans-serif;color:#111}"
        + "#achpop.on{opacity:1;transform:translate(-50%,0)}#achpop .b{height:24px;display:flex;align-items:center;gap:6px;padding:0 8px;color:#fff;font:bold 12px Tahoma,sans-serif;text-shadow:1px 1px #0a1a6e;background:linear-gradient(#0997ff,#0053ee 8%,#0050ee 40%,#06f 88%,#003dd7)}"
        + "#achpop .b i{width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6b0,#f1b62e 55%,#b07a10);box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}"
        + "#achpop .c{padding:10px 14px 12px}#achpop .n{font-weight:bold;font-size:15px;margin-bottom:3px}#achpop .d{color:#3b4a5a}";
      document.head.appendChild(st); box = document.createElement('div'); box.id = 'achpop'; document.body.appendChild(box);
    }
    box.innerHTML = '<div class="b"><i></i>Achievement unlocked · 成就解锁</div><div class="c"><div class="n"></div><div class="d"></div></div>';
    box.querySelector('.n').textContent = a.name; box.querySelector('.d').textContent = a.desc;
    requestAnimationFrame(() => box.classList.add('on')); clearTimeout(timer); timer = setTimeout(() => box.classList.remove('on'), 4800); chime();
  }
  window.SCF_ACH = {
    LIST,
    has: (id) => got().includes(id),
    of: (data) => (data && Array.isArray(data.ach) ? data.ach : []),   // the ids unlocked in a save's data (for the menu's list)
    unlock(id) {   // earned now: the first time in this save, keep it and say so
      const a = LIST.find((x) => x.id === id); if (!a || !S() || got().includes(id)) return false;
      S().set('ach', got().concat([id])); if (document.body) pop(a); else addEventListener('DOMContentLoaded', () => pop(a)); return true;
    },
  };
})();
