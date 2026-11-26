// One save for the whole game. Every page loads this first (a plain script, before the game's own), so window.SCF_SAVE is there for all of them.
// It lives in localStorage under one key, not in cookies, and keeps only what has to carry over from one scene or one visit to the next.
// No manual saving or loading yet: that will come later as part of the wall in the level-select hall, as numbered slots built on this.
//   small      true while the player is shrunk (shrinking happens on the little stairs in the checkerboard rooms; every scene starts the player at this size)
//   moons      how many moons have been picked up in the checkerboard rooms, all visits together
//   skyMoons   how many times the big moon has been pulled out of the sky
//   usb        true once the USB stick at the end of the flooded passages behind the pool has been found
'use strict';
(function () {
  const KEY = 'scf.save.v1';
  const DEFAULTS = { v: 1, small: false, moons: 0, skyMoons: 0, usb: false };
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
  d = Object.assign({}, DEFAULTS, d && d.v === 1 ? d : {});
  function write() { d.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode: the save lasts as long as the page */ } }
  window.SCF_SAVE = {
    get: (k) => d[k],
    set(k, v) { if (d[k] === v) return; d[k] = v; write(); },
    add(k, n = 1) { d[k] = (d[k] || 0) + n; write(); },
    all: () => JSON.parse(JSON.stringify(d)),
    reset() { d = Object.assign({}, DEFAULTS); write(); },
  };
})();
