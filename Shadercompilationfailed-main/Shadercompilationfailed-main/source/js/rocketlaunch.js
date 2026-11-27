// The rocket in the stair void: how you get to the Moon Station (moonstation.html).
// Carry the inflatable rocket (from the bounce house, js/bounce.js) into the grey stair void (js/level2.js) and press E with it in your hand:
// you set it down on the landing in front of you and it swells up, far bigger than it ever was, until it stands over you. E on it and you
// are inside, looking out of its round window: the stairs fall away past the glass, faster and faster, then break up and tumble away,
// colour seeps back in, the grey turns blue, white air tears past the glass... and you are there.
// Kept in the save (window.SCF_SAVE):
//   rocketAt        [x, y, z, yaw] where the rocket stands in the void (one block of it, repeated like everything there), or nothing
//   rocketLaunched  true once it has taken you up
// A plain script, loaded after js/level2.js on every page that has the void; level2.js calls rocketTick and rocketDraw, level1.js's interact calls rocketE.
'use strict';
(function () {
  const S = () => window.SCF_SAVE, EQ = () => window.Equip;
  const RH = 7.2;           // how tall it stands once it has filled with air, in metres
  const RK = { at: null, grow: 1, prog: null, vao: null, n: 0, VP: null, busy: false, told: false, aimed: false };
  { const a = S() && S().get('rocketAt'); if (Array.isArray(a) && a.length === 4) RK.at = a.slice(); }

  /* ---------------- the rocket itself ---------------- */
  // turned on a lathe and sewn from eight gores (each one bulging a little, like anything blown up), a red nose, four fins, a round window
  function build() {
    const P = [], N = [], C = [];
    const tri = (a, b, c, col) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
      for (const p of [a, b, c]) { P.push(...p); N.push(...n); C.push(...col); }
    };
    // the body: profile of (radius, height), from the stand up to the tip
    const prof = [[1.05, 0], [1.1, 0.35], [1.18, 0.55], [1.32, 1.4], [1.38, 2.6], [1.34, 3.8], [1.22, 4.7], [1.12, 5.2], [0.95, 5.7], [0.7, 6.2], [0.4, 6.7], [0.12, 7.05], [0.0, RH]];
    const NA = 64, cream = [0.93, 0.90, 0.82], red = [0.82, 0.27, 0.16], band = [0.86, 0.80, 0.68];
    const at = (k, j) => { const th = (j / NA) * Math.PI * 2, pil = 1 + 0.045 * Math.pow(Math.abs(Math.sin(th * 4)), 0.6), r = prof[k][0] * pil; return [Math.cos(th) * r, prof[k][1], Math.sin(th) * r]; };
    for (let k = 0; k < prof.length - 1; k++) for (let j = 0; j < NA; j++) {
      const y = prof[k][1], col = y >= 5.2 ? red : y < 0.5 ? band : cream;
      const a = at(k, j), b = at(k, j + 1), c = at(k + 1, j + 1), d = at(k + 1, j);
      tri(a, c, b, col); tri(a, d, c, col);
    }
    // fins
    const fin = [0.86, 0.38, 0.10];
    for (let f = 0; f < 4; f++) {
      const th = Math.PI / 4 + f * Math.PI / 2, cx = Math.cos(th), sz = Math.sin(th), px = -sz, pz = cx, w = 0.09;
      const pt = (r, y, s) => [cx * r + px * s, y, sz * r + pz * s];
      const A = [1.25, 0.15], B = [2.35, 0.0], Cc = [2.2, 0.9], D = [1.3, 2.6];
      for (const s of [-w, w]) { tri(pt(A[0], A[1], s), pt(B[0], B[1], s), pt(Cc[0], Cc[1], s), fin); tri(pt(A[0], A[1], s), pt(Cc[0], Cc[1], s), pt(D[0], D[1], s), fin); }
      const rim = [A, B, Cc, D]; for (let i = 0; i < 3; i++) { const p = rim[i], q = rim[i + 1]; tri(pt(p[0], p[1], -w), pt(q[0], q[1], -w), pt(q[0], q[1], w), fin); tri(pt(p[0], p[1], -w), pt(q[0], q[1], w), pt(p[0], p[1], w), fin); }
    }
    // the window, on the side that faces you when you set it down (-z), with its yellow rim
    const wy = 3.9, wr = 0.5, glass = [0.55, 0.80, 0.84], ring = [0.88, 0.72, 0.10], z0 = -1.4;
    for (let j = 0; j < 32; j++) {
      const a0 = j / 32 * Math.PI * 2, a1 = (j + 1) / 32 * Math.PI * 2;
      tri([0, wy, z0 - 0.02], [Math.cos(a1) * wr, wy + Math.sin(a1) * wr, z0 - 0.02], [Math.cos(a0) * wr, wy + Math.sin(a0) * wr, z0 - 0.02], glass);
      const R0 = wr, R1 = wr + 0.16;
      const p = (a, r, dz) => [Math.cos(a) * r, wy + Math.sin(a) * r, z0 - dz];
      tri(p(a0, R0, 0.06), p(a1, R1, 0.03), p(a1, R0, 0.06), ring); tri(p(a0, R0, 0.06), p(a0, R1, 0.03), p(a1, R1, 0.03), ring);
    }
    const data = new Float32Array(P.length / 3 * 9);
    for (let i = 0; i < P.length / 3; i++) { data.set(P.slice(i * 3, i * 3 + 3), i * 9); data.set(N.slice(i * 3, i * 3 + 3), i * 9 + 3); data.set(C.slice(i * 3, i * 3 + 3), i * 9 + 6); }
    const vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [i, o] of [[0, 0], [1, 12], [2, 24]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, o); }
    gl.bindVertexArray(null);
    RK.vao = vao; RK.n = P.length / 3;
    RK.prog = compile(`#version 300 es
      layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC;
      uniform mat4 uVP, uM; out vec3 vW; out vec3 vN; out vec3 vC;
      void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vC = aC; gl_Position = uVP * w; }`,
    `#version 300 es
      precision highp float;
      in vec3 vW; in vec3 vN; in vec3 vC; uniform vec3 uCam; uniform vec3 uFwd; out vec4 o;
      void main(){
        vec3 n = normalize(vN), V = normalize(uCam - vW); if (dot(n, V) < 0.0) n = -n;
        float d = distance(uCam, vW);
        // the void's own light: almost none, and what there is comes from where you stand (the same flash the concrete gets)
        float fc = pow(max(dot(-V, uFwd), 0.0), 3.0), flash = (0.10 + 0.32 * fc) / (1.0 + d * d * 0.02);
        float l = 0.16 + 0.22 * max(dot(n, normalize(vec3(0.3, 0.9, 0.2))), 0.0) + flash * max(dot(n, V), 0.0) * 1.6;
        vec3 col = vC * l + vec3(0.25) * pow(max(dot(reflect(-V, n), V), 0.0), 30.0) * flash;
        o = vec4(mix(vec3(0.085), col, exp(-d * 0.0075)), 1.0);
      }`);
  }

  // the model matrix: stood at (x, y, z), turned yaw, scaled s (with a wobble while it fills)
  function model(x, y, z, yaw, s, sy) { const c = Math.cos(yaw), n = Math.sin(yaw); return new Float32Array([c * s, 0, -n * s, 0, 0, sy, 0, 0, n * s, 0, c * s, 0, x, y, z, 1]); }

  // drawn from js/level2.js, after the void, into the same picture and depth: once for every copy of the block near enough to see
  window.rocketDraw = function (C, VP) {
    RK.VP = VP; if (!RK.at) return;
    if (!RK.prog) build();
    const p = RK.prog; gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform3fv(p.u.uCam, C.eye); gl.uniform3fv(p.u.uFwd, C.F);
    gl.bindVertexArray(RK.vao);
    const g = RK.grow, e = g < 1 ? 1 - Math.pow(1 - g, 3) : 1, wob = g < 1 ? Math.sin(g * 26) * 0.06 * (1 - g) : 0, s = 0.18 + 0.82 * e;
    const [x, y, z, yaw] = RK.at;
    for (let b = -3; b <= 3; b++) for (let c = -2; c <= 2; c++) for (let a = -2; a <= 2; a++) {
      const ox = x + a * VPX, oy = y + b * VPY, oz = z + c * VPZ, dx = ox - C.eye[0], dy = oy - C.eye[1], dz = oz - C.eye[2];
      if (dx * dx + dy * dy + dz * dz > 380 * 380) continue;
      gl.uniformMatrix4fv(p.u.uM, false, model(ox, oy, oz, yaw, s * (1 - wob * 0.5), s * (1 + wob)));
      gl.drawArrays(gl.TRIANGLES, 0, RK.n);
    }
  };

  /* ---------------- E ---------------- */
  const fwd = () => [Math.sin(P.yaw), Math.cos(P.yaw)];
  // the copy of the rocket nearest you, as an offset from your feet
  function near() { if (!RK.at) return null; return [wd(RK.at[0] - V.x, VPX), wd(RK.at[1] - V.y, VPY), wd(RK.at[2] - V.z, VPZ)]; }
  function aimed() {
    const d = near(); if (!d || RK.grow < 1) return false;
    const h = Math.hypot(d[0], d[2]); if (h > 6 || d[1] > 1 || d[1] < -RH) return false;
    const f = fwd(); return (d[0] * f[0] + d[2] * f[1]) / (h || 1) > 0.55;
  }
  function place() {
    const f = fwd(), dist = 3.4, x = V.x + f[0] * dist, z = V.z + f[1] * dist;
    const g = vGround(x, z, V.y);
    let ok = V.on && Math.abs(g - V.y) < 0.3 && !vBlocked(x, z, V.y);
    for (let k = 0; k < 6 && ok; k++) { const a = k / 6 * Math.PI * 2, px = x + Math.cos(a) * 1.4, pz = z + Math.sin(a) * 1.4; if (Math.abs(vGround(px, pz, V.y) - V.y) > 0.3 || vBlocked(px, pz, V.y)) ok = false; }
    if (!ok) { EQ() && EQ().say('There is no room to set it down here.', 2.5); return; }
    // the window turned to face you
    RK.at = [x, V.y, z, Math.atan2(f[0], f[1])]; RK.grow = 0;
    S() && S().set('rocketAt', RK.at.slice()); EQ() && EQ().remove('rocket');
    EQ() && EQ().say('It fills with air... and keeps on filling.', 3);
    hiss();
  }
  window.rocketE = function () {
    if (RK.busy || G.mode !== 'void' || Qs.i >= 0) return;
    if (aimed()) { launch(); return; }
    if (EQ() && EQ().sel() === 'rocket') place();
  };

  /* ---------------- every frame in the void ---------------- */
  window.rocketTick = function (dt) {
    const E = EQ();
    if (G.mode !== 'void') { if (RK.aimed && E) { E.prompt(null); RK.aimed = false; } return; }
    if (RK.busy) { keys.clear(); P.vx = P.vz = 0; return; }
    if (RK.grow < 1) RK.grow = Math.min(1, RK.grow + dt / 2.6);
    if (!RK.told && E && E.sel() === 'rocket' && V.on && Qs.i < 0) { RK.told = true; E.say('Press E to set the rocket down.', 3.5); }
    const a = aimed() && Qs.i < 0;
    if (a && RK.VP && E) {
      const d = near(), M = RK.VP, wx = V.x + d[0], wy = V.y + d[1] + 3.0, wz = V.z + d[2];
      const cx = M[0] * wx + M[4] * wy + M[8] * wz + M[12], cy = M[1] * wx + M[5] * wy + M[9] * wz + M[13], cw = M[3] * wx + M[7] * wy + M[11] * wz + M[15];
      if (cw > 0) E.prompt((cx / cw * 0.5 + 0.5) * innerWidth, (0.5 - cy / cw * 0.5) * innerHeight); else E.prompt(null);
    } else if (RK.aimed && E) E.prompt(null);
    RK.aimed = a;
  };

  /* ---------------- sound ---------------- */
  let AC = null;
  const ac = () => { try { if (!AC) { const Cx = window.AudioContext || window.webkitAudioContext; if (!Cx) return null; AC = new Cx(); } if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } };
  function noiseSrc(c, sec) { const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let br = 0; for (let i = 0; i < n; i++) { br = (br + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = br * 3; } const s = c.createBufferSource(); s.buffer = b; return s; }
  function hiss() {
    const c = ac(); if (!c) return; const t = c.currentTime, s = noiseSrc(c, 3), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.7);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 3);
  }

  /* ---------------- the flight: inside, looking out of the window ---------------- */
  const T_END = 14.8;
  function launch() {
    RK.busy = true; if (EQ()) EQ().prompt(null);
    try { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    const sv = S(); if (sv) { sv.set('rocketAt', null); sv.set('rocketLaunched', true); }
    const cv = document.createElement('canvas'); cv.id = 'rkfly';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:60;background:#000;opacity:0;transition:opacity .7s';
    document.body.appendChild(cv); requestAnimationFrame(() => { cv.style.opacity = '1'; });
    const g2 = cv.getContext('webgl2', { antialias: false });
    if (!g2) { setTimeout(() => { location.href = 'moonstation.html'; }, 1500); return; }
    const sh = (ty, src) => { const s = g2.createShader(ty); g2.shaderSource(s, src); g2.compileShader(s); if (!g2.getShaderParameter(s, g2.COMPILE_STATUS)) throw new Error(g2.getShaderInfoLog(s)); return s; };
    const pr = g2.createProgram();
    g2.attachShader(pr, sh(g2.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }'));
    g2.attachShader(pr, sh(g2.FRAGMENT_SHADER, FLY)); g2.linkProgram(pr);
    const uRes = g2.getUniformLocation(pr, 'uRes'), uT = g2.getUniformLocation(pr, 'uT');
    rumble();
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      const sc = Math.min(1, Math.sqrt(1.6e6 / (innerWidth * innerHeight))), w = Math.round(innerWidth * sc), h = Math.round(innerHeight * sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g2.viewport(0, 0, w, h); g2.useProgram(pr); g2.uniform2f(uRes, w, h); g2.uniform1f(uT, t); g2.drawArrays(g2.TRIANGLES, 0, 3);
      if (t < T_END) requestAnimationFrame(step); else location.href = 'moonstation.html';
    };
    requestAnimationFrame(step);
  }
  function rumble() {
    const c = ac(); if (!c) return; const t = c.currentTime;
    // the burn: a roar that keeps on building all the way, lower and rougher at first, brighter as it goes
    const s = noiseSrc(c, 4); s.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(140, t); lp.frequency.linearRampToValueAtTime(900, t + T_END - 1);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 1.2); g.gain.setValueAtTime(0.45, t + T_END - 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + T_END);
    s.connect(lp); lp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + T_END + 0.1);
    const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(30, t); o.frequency.linearRampToValueAtTime(62, t + T_END); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.22, t + 1); og.gain.exponentialRampToValueAtTime(0.0001, t + T_END);
    o.connect(og); og.connect(c.destination); o.start(t); o.stop(t + T_END + 0.1);
    // the stairs giving way: deep cracks and slams, one after another
    for (let k = 0; k < 9; k++) { const d = 4.6 + k * 0.42 + Math.random() * 0.2, b = noiseSrc(c, 0.9), f = c.createBiquadFilter(), bg = c.createGain(); f.type = 'lowpass'; f.frequency.value = 260 + Math.random() * 300;
      bg.gain.setValueAtTime(0.0001, t + d); bg.gain.exponentialRampToValueAtTime(0.5, t + d + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.8); b.connect(f); f.connect(bg); bg.connect(c.destination); b.start(t + d); b.stop(t + d + 0.9); }
    // air: a rising rush that takes over once you are out into the blue
    const a = noiseSrc(c, 4); a.loop = true; const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.setValueAtTime(600, t + 6); hp.frequency.linearRampToValueAtTime(2400, t + T_END); hp.Q.value = 0.6;
    const ag = c.createGain(); ag.gain.setValueAtTime(0.0001, t + 6); ag.gain.exponentialRampToValueAtTime(0.35, t + 11); ag.gain.setValueAtTime(0.35, t + T_END - 1); ag.gain.exponentialRampToValueAtTime(0.0001, t + T_END);
    a.connect(hp); hp.connect(ag); ag.connect(c.destination); a.start(t + 6); a.stop(t + T_END + 0.1);
  }

  // The whole flight is one picture worked out per pixel: the inside of the rocket (blown-up vinyl in gores, lit by the window), its round
  // window with a fat yellow rim, and through it: the stair void falling past, faster and faster (grey, like the void itself); then the stairs
  // break up, the blocks coming apart and tumbling away below you; colour seeps in, the grey turns to blue, and white air rushes past the glass.
  const FLY = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uT; out vec4 o;
  float hash1(float n){ return fract(sin(n) * 43758.5453); }
  float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
  float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  // the stair void, simplified: a landing in every cell, a slanted flight in most, columns at the corners running all the way up
  float vbase(vec3 p){
    vec3 c = vec3(44.0, 16.0, 44.0), id = floor(p / c), q = p - (id + 0.5) * c; float h = hash3(id);
    float d = sdBox(q - vec3(0.0, -7.0, 0.0), vec3(7.0, 0.7 + 3.5 * step(0.6, h), 7.0));
    if (h > 0.3) d = min(d, sdBox(vec3(q.x, q.y - q.z * 0.36 + 0.5, q.z), vec3(1.5 + 3.5 * hash3(id + 3.0), 0.5, 14.0)));
    vec3 k = vec3(abs(q.x) - 22.0, q.y, abs(q.z) - 22.0);
    d = min(d, sdBox(k, vec3(2.6, 9.0, 2.6)));
    if (hash3(id + 7.0) > 0.5) d = min(d, sdBox(q - vec3(0.0, 5.0, 22.0), vec3(22.0, 1.1, 1.6)));
    return d;
  }
  // the same, coming apart: cut into chunks, each one shoved, turned and dropped away on its own (k: 0 whole, 1 gone)
  float vmap(vec3 p, float k){
    if (k <= 0.0) return vbase(p);
    const float CS = 7.0; vec3 cid = floor(p / CS), cc = (cid + 0.5) * CS;
    float h = hash3(cid), h2 = hash3(cid + 11.0), h3 = hash3(cid + 23.0);
    float kk = clamp(k * (0.6 + 0.8 * h), 0.0, 1.5);
    vec3 off = vec3((h2 - 0.5) * 9.0 * kk, -(2.0 + 16.0 * h) * kk * kk, (h3 - 0.5) * 9.0 * kk);
    vec3 lp = p - cc - off; lp.xz *= rot(kk * (h - 0.5) * 2.5); lp.xy *= rot(kk * (h2 - 0.5) * 2.0);
    float d = max(vbase(cc + lp), sdBox(lp, vec3(CS * 0.5 * (1.0 - 0.45 * kk))));
    return d + max(kk - 0.5, 0.0) * 6.0 * step(0.7, h);   // some chunks are simply gone
  }
  vec3 voidView(vec3 ro, vec3 rd, float k, vec3 fogc){
    float t = 0.5; float hit = 0.0;
    for (int i = 0; i < 72; i++){ float d = vmap(ro + rd * t, k); if (d < 0.02 * t){ hit = 1.0; break; } t += clamp(d * 0.75, 0.05, k > 0.0 ? 2.5 : 8.0); if (t > 320.0) break; }
    vec3 col = fogc;
    if (hit > 0.5){
      vec3 p = ro + rd * t; vec2 e = vec2(0.06, 0.0);
      vec3 n = normalize(vec3(vmap(p + e.xyy, k) - vmap(p - e.xyy, k), vmap(p + e.yxy, k) - vmap(p - e.yxy, k), vmap(p + e.yyx, k) - vmap(p - e.yyx, k)));
      float sh = 0.62 + 0.38 * max(dot(n, normalize(vec3(0.3, 0.9, 0.2))), 0.0);
      vec3 c = vec3(0.46) * sh * (0.85 + 0.25 * noise3(p * 0.7));
      col = mix(fogc, c, exp(-t * mix(0.0075, 0.02, clamp(k, 0.0, 1.0))));
    }
    return col;
  }
  void main(){
    vec2 fc = gl_FragCoord.xy, uv = (fc - 0.5 * uRes) / uRes.y;
    float T = uT;
    // the shaking: it only gets worse
    float sk = smoothstep(0.0, 0.8, T) * (0.55 + 0.45 * smoothstep(0.0, 9.0, T)) * (1.0 - smoothstep(13.6, 14.4, T));
    vec2 jit = vec2(hash1(floor(T * 40.0)) - 0.5, hash1(floor(T * 40.0) + 7.0) - 0.5) * 0.012 * sk;
    uv += jit;
    float WR = 0.33, r = length(uv);
    float brk = smoothstep(4.4, 9.4, T);          // the stairs coming apart
    float hue = smoothstep(6.2, 10.0, T);         // colour seeping in
    float blue = smoothstep(8.0, 12.5, T);        // and turning to blue
    float air = smoothstep(8.2, 11.5, T);         // the white air rushing past
    vec3 col, winLight;
    {
      vec2 w = uv / WR;
      vec3 rd = normalize(vec3(1.0, w.y * 0.75 - 0.05, w.x * 0.75));
      // what the empty space out there is: void grey, warming as colour comes, then sky (deeper blue higher up)
      vec3 sky = mix(vec3(0.42, 0.62, 0.88), vec3(0.10, 0.30, 0.72), smoothstep(-0.3, 0.6, rd.y));
      vec3 fogc = mix(vec3(0.085), mix(vec3(0.20, 0.18, 0.16), sky, blue), hue);
      // climbing: slow at first, then faster and faster
      float y = 2.0 + 4.0 * T + 2.6 * T * T + 0.9 * T * T * T * step(6.0, T) * (T - 6.0) / max(T, 1.0);
      vec3 ro = vec3(7.0, y, 22.0);
      vec3 out1 = fogc;
      if (brk < 0.999){
        out1 = voidView(ro, rd, brk, fogc);
        if (T > 2.5) out1 = mix(out1, voidView(ro - vec3(0.0, 0.05 * (6.0 + 5.0 * T), 0.0), rd, brk, fogc), 0.5);   // a little smear the faster it climbs
        out1 = mix(out1, fogc, smoothstep(0.82, 1.0, brk));
      }
      // air: long white streaks tearing down past the glass, and torn wisps of cloud
      float az = atan(rd.z, rd.x), spd = 6.0 + 9.0 * air;
      float lane = floor(az * 26.0), lf = fract(az * 26.0);
      float sy = fract(rd.y * (0.5 + hash1(lane) * 0.8) + T * spd * 0.25 * (0.6 + hash1(lane + 3.0)) + hash1(lane + 9.0));
      float wd = 0.08 + 0.3 * hash1(lane + 5.0);
      float streak = smoothstep(wd, 0.0, abs(lf - 0.5)) * smoothstep(0.0, 0.15, sy) * smoothstep(0.85, 0.2, sy) * step(0.72, hash1(lane + 17.0));
      // and the air itself, torn into long white wisps streaming down past you
      float wisp = smoothstep(0.48, 0.82, fbm(vec3(rd.z * 2.6 + 1.3, rd.y * 0.32 + T * spd * 0.22, T * 0.25)));
      float wisp2 = smoothstep(0.55, 0.9, fbm(vec3(rd.z * 6.0, rd.y * 0.6 + T * spd * 0.45, 4.0)));
      out1 = mix(out1, vec3(1.0), clamp(streak * 0.45 + wisp * 0.75 + wisp2 * 0.5, 0.0, 1.0) * air);
      winLight = mix(vec3(0.30), mix(vec3(0.28, 0.26, 0.22), vec3(0.34, 0.50, 0.75), blue), hue) * (0.8 + 0.2 * air);
      float refl = smoothstep(0.25, 0.0, abs(w.x + w.y * 0.6 - 0.35)) * 0.025;
      col = out1 + refl;
    }
    // the rim and the inside of the rocket
    if (r > WR){
      float rr = (r - WR) / 0.07;
      float gx = uv.x * 2.2, gore = abs(fract(gx / (1.0 + uv.y * uv.y * 0.3) * 1.6) - 0.5);
      float pil = 0.75 + 0.25 * smoothstep(0.5, 0.15, gore), seam = smoothstep(0.03, 0.0, 0.5 - gore);
      vec3 vinyl = vec3(0.86, 0.82, 0.72) * pil * (1.0 - 0.35 * seam);
      float wl = 0.9 / (1.0 + pow(max(r - WR, 0.0) * 4.0, 2.0));
      vec3 light = vec3(0.06, 0.045, 0.035) * (0.6 + 0.6 * smoothstep(0.5, -0.5, uv.y)) + winLight * wl * 0.6 + vec3(0.02, 0.012, 0.01) * sk * hash1(floor(T * 24.0));
      vec3 inside = vinyl * light;
      inside += vec3(1.0, 0.15, 0.08) * smoothstep(0.012, 0.0, length(uv - vec2(0.42, 0.24))) * step(0.5, fract(T * 0.9)) * 2.0;
      float ring = smoothstep(1.0, 0.85, rr), bevel = sin(clamp(rr, 0.0, 1.0) * 3.14159);
      vec3 rim = vec3(0.88, 0.70, 0.10) * (0.12 + 0.5 * bevel * (0.5 + 0.5 * dot(normalize(uv), normalize(vec2(-0.4, 0.8))))) + winLight * 0.25 * bevel;
      col = mix(inside, rim, ring);
    }
    // colourless while you are still in the void, as everything there is; colour comes back as it falls apart
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, hue);
    col *= 1.0 - smoothstep(0.35, 1.1, length(uv)) * 0.6;
    col *= smoothstep(0.0, 0.8, T);
    col = mix(col, vec3(1.0), smoothstep(13.4, 14.6, T));
    col = col / (1.0 + col * 0.35);
    o = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
  }`;
  window.__rk = { RK, launch };   // a handle for testing from the console
})();
