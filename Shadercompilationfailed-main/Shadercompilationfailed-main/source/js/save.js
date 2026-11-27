// Saves. Every page loads this first (a plain script, before the game's own), so window.SCF_SAVE is there for all of them.
// Everything lives in localStorage under one key (not cookies): any number of save slots, and which one is being played.
// The main menu (index.html) makes a new slot (New Game, existing ones are kept), picks the latest (Continue) or one from the list (Load Game),
// and deletes one from the list (after asking again). The list can also write saves out to a file and read them back in (exportSlots,
// importSlots): what comes in is always added as new slots, with new numbers, and never replaces a save that is already here.
// A game page opened directly, without the menu, plays the slot last chosen, or the latest one, or makes a first one if there are none.
// What a slot keeps:
//   scene      where to pick up: 'playroom' | 'level1' | 'level2' | 'hub' | 'moon' (each scene writes it when it starts)
//   li         which checkerboard maze (0 = the first) when scene is 'level1'
//   small      true while the player is shrunk (little stairs in the checkerboard rooms, or the size gun); every scene starts the player at this size
//   moons      how many moons have been picked up in the checkerboard rooms, all visits together
//   skyMoons   how many times the big moon has been pulled out of the sky
//   grate      true once the round mesh door low on the pool's deep-end wall has been opened (it stays open)
//   allLevels  true when Admin settings (G book > Settings > Admin settings) has unlocked every level for this save: the level-select hall's
//              screen then lists every place, and the G book's Level select button opens, visited or not
//   allItems   true when Admin settings has put every thing there is to carry in your hands; adminItems: the ids it gave (taken back when it is turned off)
//   gun        true once the size gun (伸缩枪) at the end of the flooded passages behind the pool has been found (js/sizegun.js: Z smaller, X bigger)
'use strict';
(function () {
  const KEY = 'scf.saves.v2', OLD = 'scf.save.v1', FORMAT = 'scf-saves';
  const FRESH = () => ({ scene: 'playroom', li: 0, small: false, moons: 0, skyMoons: 0, grate: false, gun: false, allLevels: false });
  const PAGES = { playroom: 'playroom.html', level1: 'level1.html', level2: 'level2.html', hub: 'hub.html', moon: 'moonstation.html' };
  let db = null;
  function load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.slots)) d = { v: 2, next: 1, current: null, slots: [] };
    if (!d.slots.length && !d.migrated) {   // the single save from before there were slots becomes Save 1
      let old = null; try { old = JSON.parse(localStorage.getItem(OLD) || 'null'); } catch (e) { old = null; }
      d.migrated = true;
      if (old && old.v === 1) { const data = FRESH(); for (const k of Object.keys(data)) if (k in old) data[k] = old[k]; d.slots.push({ id: d.next++, created: old.t || Date.now(), updated: old.t || Date.now(), data }); d.current = d.slots[0].id; }
    }
    db = d; return d;
  }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode: the save lasts as long as the page */ } }
  const latest = () => db.slots.slice().sort((a, b) => b.updated - a.updated)[0] || null;
  function make() { const s = { id: db.next++, created: Date.now(), updated: Date.now(), data: FRESH() }; db.slots.push(s); db.current = s.id; write(); return s; }
  function cur() {   // the slot being played (made on first use, never just by opening the menu)
    load(); let s = db.slots.find((x) => x.id === db.current) || latest();
    if (!s) s = make(); else if (db.current !== s.id) { db.current = s.id; write(); }
    return s;
  }
  const copy = (o) => JSON.parse(JSON.stringify(o));
  // The main menu (index.html) runs the game's engine for its background, and the engine writes as it starts up (scene, size...).
  // There, nothing is written and nothing is made: the slot calls see defaults, and only the menu's own calls (newGame, select) touch the saves.
  const MENU = document.documentElement.dataset.level === 'menu';
  load();
  window.SCF_SAVE = {
    // the slot being played
    get: (k) => { if (MENU) return FRESH()[k]; const s = cur(); return k in s.data ? s.data[k] : FRESH()[k]; },
    set(k, v) { if (MENU) return; const s = cur(); if (s.data[k] === v) return; s.data[k] = v; s.updated = Date.now(); write(); },
    add(k, n = 1) { if (MENU) return; const s = cur(); s.data[k] = (s.data[k] || 0) + n; s.updated = Date.now(); write(); },
    all: () => (MENU ? FRESH() : copy(cur().data)),
    reset() { if (MENU) return; const s = cur(); s.data = FRESH(); s.updated = Date.now(); write(); },
    // the slots, for the menu (none of these makes a slot except newGame)
    slots: () => (load(), db.slots.slice().sort((a, b) => b.updated - a.updated).map(copy)),
    latest: () => (load(), latest() ? copy(latest()) : null),
    newGame() { load(); return copy(make()); },
    select(id) { load(); if (!db.slots.some((s) => s.id === id)) return false; db.current = id; write(); return true; },
    currentId: () => (load(), db.current),
    remove(id) { load(); const i = db.slots.findIndex((s) => s.id === id); if (i < 0) return false; db.slots.splice(i, 1); if (db.current === id) { const l = latest(); db.current = l ? l.id : null; } write(); return true; },   // for the menu's Delete (it asks first)
    pageFor: (slot) => PAGES[(slot && slot.data && slot.data.scene) || 'playroom'] || PAGES.playroom,
    // out to a file: one slot (by id) or, with no id, all of them; what is returned is plain data, ready for JSON.stringify
    exportSlots(id) { load(); const list = db.slots.filter((s) => id == null || s.id === id).map((s) => ({ id: s.id, created: s.created, updated: s.updated, data: copy(s.data) }));
      return { format: FORMAT, v: 1, exported: Date.now(), slots: list }; },
    // back in from a file (the parsed JSON): every save in it becomes a new slot here, the times it was made and last played kept.
    // Only plain values are taken (numbers, text, true/false, and short lists of those). Returns the new slots; throws if it is not a save file.
    importSlots(o) {
      if (!o || typeof o !== 'object' || o.format !== FORMAT || !Array.isArray(o.slots)) throw new Error('not a save file');
      const plain = (v) => v === null || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.length <= 200);
      const time = (t) => (typeof t === 'number' && isFinite(t) && t > 0 && t <= Date.now() ? t : Date.now());
      load(); const made = [];
      for (const s of o.slots.slice(0, 200)) {
        if (!s || typeof s !== 'object' || !s.data || typeof s.data !== 'object' || Array.isArray(s.data)) continue;
        const data = FRESH(); let n = 0;
        for (const k of Object.keys(s.data)) { if (n++ >= 100 || k.length > 40 || k === '__proto__') break; const v = s.data[k];
          if (plain(v)) data[k] = v; else if (Array.isArray(v) && v.length <= 200 && v.every(plain)) data[k] = v.slice(); }
        if (!(data.scene in PAGES)) data.scene = 'playroom';
        const slot = { id: db.next++, created: time(s.created), updated: time(s.updated), data }; db.slots.push(slot); made.push(copy(slot));
      }
      if (made.length) write(); return made;
    },
  };
})();
