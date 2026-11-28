// Mouse look, made the same on every computer. Loaded first on every game page, before any scene adds its own listeners.
// Two things browsers get wrong with a locked pointer, worst on wide, high-resolution or scaled (125%, 150%) screens and on fast mice:
//  1. Acceleration: unless asked otherwise, the browser passes on the operating system's pointer acceleration, so how far the view turns
//     depends on how fast you move and on that computer's settings. Every pointer lock here asks for raw movement (unadjustedMovement),
//     falling back to the plain lock where the browser does not offer it (Firefox, Safari).
//  2. Jumps: now and then (most often right after the lock is taken, or when the pointer would have crossed the edge of a wide screen)
//     the browser reports one huge movement that never happened, and the view snaps round. Those are thrown away here, before any scene sees them.
'use strict';
(function () {
  // 1. raw movement, for every scene's requestPointerLock()
  // 0. one lock per page. Several scenes share a page, each with its own canvas (level 1, the inverted pool, the bounce house, the store...),
  //    and each takes the pointer for its own canvas when it gets the screen. Taking it again for another element makes the browser show its
  //    "Press Esc to show your cursor" notice again, every time, and drops a frame or two while it does. So while the pointer is already
  //    locked on this page it stays with the element that has it, and the scene that asked is simply told it has it: document.pointerLockElement
  //    answers with the element that asked last, and a pointerlockchange goes round as if it had moved. Mouse movement comes to window either way.
  const proto = Element.prototype, plain = proto.requestPointerLock;
  const pleDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');
  let virt = null;   // the element the game thinks has the pointer, when that is not the one that really has it
  if (plain && pleDesc && pleDesc.get) {
    const real = () => pleDesc.get.call(document);
    try {
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, enumerable: true,
        get() { const r = real(); if (!r) { virt = null; return null; } return virt && virt.isConnected ? virt : r; } });
    } catch (e) { /* this browser will not have it: every scene simply takes the lock itself, as before */ }
    document.addEventListener('pointerlockchange', (e) => { if (e.isTrusted) virt = null; }, true);   // a real change (taken, or let go): no stand-in
    Object.defineProperty(proto, '__scfHandOver', { configurable: true, value: function () {
      const r = real(); if (!r || !this.isConnected) return false;
      const was = virt || r, now = this === r ? null : this;
      if ((now || r) !== was) { virt = now; document.dispatchEvent(new Event('pointerlockchange')); }
      return true;
    } });
  }
  if (plain) {
    let raw = true;   // becomes false once the browser has said it cannot
    proto.requestPointerLock = function (opts) {
      const el = this;
      if (el.__scfHandOver && el.__scfHandOver()) return Promise.resolve();   // already locked on this page: hand it over, no new lock
      if (opts !== undefined || !raw) return plain.call(el, opts);
      let p;
      try { p = plain.call(el, { unadjustedMovement: true }); } catch (e) { raw = false; return plain.call(el); }
      if (p && typeof p.catch === 'function') return p.catch((err) => { if (err && err.name === 'NotSupportedError') { raw = false; return plain.call(el); } throw err; });
      return p;
    };
  }
  // 2. the jumps
  let skip = 0, avg = 0, dropped = false;
  document.addEventListener('pointerlockchange', () => { skip = 3; avg = 0; dropped = false; });   // the first few movements after taking the lock are the usual culprits
  addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    const m = Math.hypot(e.movementX || 0, e.movementY || 0);
    if (skip > 0) { skip--; if (m > 50) { e.stopImmediatePropagation(); return; } }
    // one event far bigger than a hand moves between two events, and far bigger than it has just been moving: not real.
    // A real fast flick goes on for several events: the second big one in a row is let through (and so is everything after it).
    if (m > 160 && m > avg * 6 + 60 && !dropped) { dropped = true; avg = avg * 0.5 + m * 0.5; e.stopImmediatePropagation(); return; }
    dropped = false; avg = avg * 0.8 + m * 0.2;
  }, true);
})();
