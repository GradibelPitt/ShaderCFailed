// The river hall: what the flooded shaft over the size gun floats you up into (js/playroom.js builds it into its own page, so there is no page change).
// A long vaulted corridor of green terrazzo with a polished red-speckled floor, fog hanging under the big round ceiling lamps, a glowing red arch
// at the far end; down the middle, a lazy river in blue mosaic winds between palms and warm-lit boulders, yellow rings turning slowly on it, and a
// striped water slide comes out of the wall over your head and drops into it.
// It is built far above the playroom (O, below), where nothing of either is ever seen from the other. The square shaft exists twice, once over the
// size gun and once under the river, every metre of the two alike; halfway up you are moved from one to the other, which you cannot see.
// Every surface here is lit by its own shader from one list of point lights (the playroom's lights are not used), and fogged the same way.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const NL = 24, NS = 9;   // point lights, and the lamps whose glow hangs in the fog

// ctx: scene, addCollider(geometry, matrix), CAUSTIC (glsl), uTime and uCam (shared uniform objects),
//      shaft { x, z, y0, hs, L } (the lower shaft: over the size gun, from the maze ceiling y0 up L, half-width hs)
export function buildRiverHall(ctx) {
  const { scene, addCollider, CAUSTIC, uTime, uCam, shaft } = ctx;
  const O = new V3(0, 40, 40);
  const LEN = 46, HWALL = 4.2, SPRING = 3.2, CROWN = SPRING + HWALL;   // the corridor: 46 m long, walls 4.2 m either side of the middle, a round vault on them
  const WY = -0.12, FLOOR = -1.0, HW = 1.05, CZ0 = 0.9, CZ1 = 42;     // the river: its surface, its floor, half its width, where it starts and ends
  const cxf = (z) => 1.1 * Math.sin(z * 0.21 + 0.4) + 0.45 * Math.sin(z * 0.53 + 1.3);   // where the middle of the river is at each z
  const SZ = 5, SX = cxf(SZ), SHS = shaft.hs, SL = shaft.L;           // where the shaft comes up through the river floor
  const rnd = mulberry32(4401);

  const group = new THREE.Group(); group.position.copy(O); scene.add(group); group.updateMatrixWorld(true);
  const MW = group.matrixWorld.clone();
  const solid = (geo) => addCollider(geo, MW);

  /* ---------------- lights ---------------- */
  const LP = [], LC = [], LR = [], SP = [], SC = [];
  const light = (x, y, z, c, r) => { if (LP.length >= NL) return false; LP.push(new V3(x, y, z).add(O)); LC.push(new V3(c[0], c[1], c[2])); LR.push(r); return true; };
  const haze = (x, y, z, c) => { if (SP.length >= NS) return; SP.push(new V3(x, y, z).add(O)); SC.push(new V3(c[0], c[1], c[2])); };

  const U = {
    uLP: { value: LP }, uLC: { value: LC }, uLR: { value: LR }, uSP: { value: SP }, uSC: { value: SC },
    uCam, uTime, uUW: { value: 0 }, uWY: { value: O.y + WY }, uFY: { value: O.y },
  };
  const COMMON = `
  #define NL ${NL}
  #define NS ${NS}
  uniform vec3 uLP[NL]; uniform vec3 uLC[NL]; uniform float uLR[NL];
  uniform vec3 uSP[NS]; uniform vec3 uSC[NS];
  uniform vec3 uCam; uniform float uTime, uUW, uWY, uFY;
  ${CAUSTIC}
  float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 lit(vec3 p, vec3 n, float wrap){
    vec3 s = vec3(0.010, 0.020, 0.013);
    for (int i = 0; i < NL; i++){
      vec3 d = uLP[i] - p; float r = length(d) + 1e-4; float a = clamp(1.0 - r / max(uLR[i], 1e-3), 0.0, 1.0); a *= a;
      float nl = dot(n, d / r); nl = max(nl, 0.0) * (1.0 - wrap) + wrap * (nl * 0.5 + 0.5);
      s += uLC[i] * a * nl;
    }
    return s;
  }
  vec3 spec(vec3 p, vec3 n, float pw, float k){
    vec3 v = normalize(uCam - p), s = vec3(0.0);
    for (int i = 0; i < NL; i++){
      vec3 d = uLP[i] - p; float r = length(d) + 1e-4; float a = clamp(1.0 - r / max(uLR[i], 1e-3), 0.0, 1.0); a *= a;
      s += uLC[i] * a * pow(max(dot(n, normalize(d / r + v)), 0.0), pw);
    }
    return s * k;
  }
  // the lamps seen in something shiny: the view bounced off it and pointed at each lamp (sharp core, soft smear)
  vec3 mirror(vec3 p, vec3 n, float sharp, float soft, float k){
    vec3 r = reflect(normalize(p - uCam), n), s = vec3(0.0);
    for (int i = 0; i < NS; i++){ float c = max(dot(r, normalize(uSP[i] - p)), 0.0); s += uSC[i] * (pow(c, sharp) * 4.0 + pow(c, soft) * 0.12); }
    return s * k;
  }
  // fog: thin and green in the air, thick and blue-green under the water, and the lamps glowing in it
  vec3 finish(vec3 col, vec3 p, float glow){
    vec3 d = p - uCam; float L = length(d); vec3 rd = d / max(L, 1e-4);
    float fd = mix(0.050, 0.55, uUW);
    vec3 fc = mix(vec3(0.013, 0.032, 0.019), vec3(0.008, 0.085, 0.095), uUW);
    col = mix(col, fc, (1.0 - exp(-L * fd)) * (1.0 - 0.55 * glow));
    vec3 sc = vec3(0.0);
    for (int i = 0; i < NS; i++){
      vec3 q = uSP[i] - uCam; float t = clamp(dot(q, rd), 0.0, L); vec3 c = uCam + rd * t - uSP[i]; float dd = dot(c, c);
      sc += uSC[i] * exp(-t * fd * 0.5) * (0.035 / (1.0 + dd * 3.0) + 0.0035 / (1.0 + dd * 0.15));
    }
    return col + sc * (1.0 - 0.6 * uUW);
  }`;
  const VERT = `attribute vec2 tuv; attribute vec3 vcol;
  varying vec3 vW; varying vec3 vN; varying vec2 vT; varying vec3 vC; varying vec2 vUv;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = tuv; vC = vcol; vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const FRAG = `${COMMON}
  uniform sampler2D uMap; uniform vec3 uBase;
  varying vec3 vW; varying vec3 vN; varying vec2 vT; varying vec3 vC; varying vec2 vUv;
  // terrazzo: chips of stone in a ground, two sizes of them; they fade into their average far off, so nothing shimmers
  vec3 terr(vec3 p, vec3 n, vec3 base, vec3 c1, vec3 c2, vec3 c3, float sc){
    vec3 an = abs(n); vec2 q = (an.y > 0.5 ? p.xz : (an.x > 0.5 ? p.zy : p.xy)) * sc;
    vec2 id = floor(q), f = fract(q); float h = h21(id);
    vec2 c = vec2(h21(id + 3.1), h21(id + 7.7)) * 0.6 + 0.2;
    float aa = clamp(1.6 - fwidth(q.x) * 1.7, 0.0, 1.0);
    float chip = smoothstep(0.03, 0.0, length(f - c) - (0.16 + 0.22 * h21(id + 1.3))) * step(0.22, h);
    float k = h21(id + 9.2); vec3 cc = k < 0.45 ? c1 : (k < 0.8 ? c2 : c3);
    vec3 avg = mix(base, (c1 + c2 + c3) / 3.0, 0.22);
    vec3 col = mix(base * (0.88 + 0.24 * h21(floor(q * 0.31))), cc, chip);
    vec2 q2 = q * 2.7; float s2 = step(0.82, h21(floor(q2))) * step(length(fract(q2) - 0.5), 0.28) * clamp(1.6 - fwidth(q2.x) * 1.7, 0.0, 1.0);
    col = mix(col, c1, s2 * 0.7);
    return mix(avg, col, aa);
  }
  // mosaic: small square tiles, every one its own blue, light grout between
  vec3 mosaic(vec2 uv){
    vec2 q = uv / 0.068, id = floor(q), f = fract(q);
    float g = step(0.07, f.x) * step(0.07, f.y) * step(f.x, 0.97) * step(f.y, 0.97);
    float h = h21(id + 2.0);
    vec3 t = mix(vec3(0.012, 0.09, 0.26), vec3(0.03, 0.30, 0.40), h);
    if (h21(id + 11.0) > 0.80) t = vec3(0.006, 0.04, 0.17);
    if (h21(id + 17.0) > 0.93) t = vec3(0.20, 0.50, 0.50);
    float aa = clamp(1.2 - fwidth(q.x) * 1.8, 0.0, 1.0);
    return mix(mix(vec3(0.05, 0.22, 0.34), vec3(0.32, 0.40, 0.40), 0.3), mix(vec3(0.32, 0.40, 0.40), t, g), aa);
  }
  void main(){
    vec3 n = normalize(vN); if (dot(n, uCam - vW) < 0.0) n = -n;
    vec3 col; float glow = 0.0;
  #if KIND == 0
    vec3 alb = terr(vW, n, vec3(0.040, 0.105, 0.030), vec3(0.32, 0.40, 0.22), vec3(0.015, 0.035, 0.015), vec3(0.32, 0.38, 0.10), 46.0);
    col = alb * lit(vW, n, 0.15) + spec(vW, n, 50.0, 0.08);
  #elif KIND == 1
    vec3 alb = terr(vW, n, vec3(0.17, 0.060, 0.048), vec3(0.50, 0.47, 0.42), vec3(0.025, 0.018, 0.016), vec3(0.40, 0.08, 0.05), 50.0);
    col = alb * lit(vW, n, 0.1) + spec(vW, n, 300.0, 0.35) + mirror(vW, n, 500.0, 70.0, 0.10);
  #elif KIND == 2
    vec3 alb = mosaic(vT);
    float wet = step(vW.y, uWY);
    alb *= 1.0 + wet * 1.7 * caus(vW.xz * 0.8 + vW.y * 0.3, uTime * 0.5);
    col = alb * lit(vW, n, 0.3) * (1.0 + 0.4 * wet) + spec(vW, n, 90.0, 0.3);
  #elif KIND == 3
    vec3 alb = terr(vW, n, vec3(0.40, 0.34, 0.26), vec3(0.72, 0.70, 0.64), vec3(0.14, 0.10, 0.08), vec3(0.50, 0.30, 0.20), 60.0);
    col = alb * lit(vW, n, 0.25) + spec(vW, n, 60.0, 0.15);
  #elif KIND == 4
    float nn = h21(floor(vW.xz * 11.0) + floor(vW.y * 11.0)) * 0.18 + h21(floor(vW.xy * 3.0)) * 0.12;
    col = vec3(0.25, 0.21, 0.16) * (0.80 + nn * 1.6) * lit(vW, n, 0.35);
  #elif KIND == 5
    vec4 t = texture2D(uMap, vUv); if (t.a < 0.5) discard;
    col = t.rgb * lit(vW, n, 0.65) * 1.15;
  #elif KIND == 6
    vec3 alb = uBase.x < 0.0 ? vC : uBase;
    col = alb * lit(vW, n, 0.2) + spec(vW, n, 110.0, 0.7);
  #elif KIND == 7
    float ring = 0.7 + 0.3 * smoothstep(0.15, 0.55, fract(vT.y * 7.0));
    col = vec3(0.15, 0.10, 0.065) * ring * (0.85 + 0.3 * h21(floor(vT * vec2(14.0, 7.0)))) * lit(vW, n, 0.3);
  #elif KIND == 8
    col = uBase; glow = 1.0;
  #elif KIND == 9
    col = vec3(0.60, 0.62, 0.58) * lit(vW, n, 0.2) + spec(vW, n, 40.0, 0.2);
  #else
    col = vec3(0.26, 0.15, 0.14) * lit(vW, n, 0.2);
  #endif
    gl_FragColor = vec4(finish(col, vW, glow), 1.0);
  }`;
  const mats = {};
  function mat(kind, o = {}) {
    const key = kind + (o.key || '');
    if (mats[key]) return mats[key];
    const u = Object.assign({}, U, { uMap: { value: o.map || null }, uBase: { value: new V3(...(o.base || [0, 0, 0])) } });
    return (mats[key] = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, defines: { KIND: kind }, side: THREE.DoubleSide }));
  }
  const add = (geo, m, col) => { const me = new THREE.Mesh(geo, m); me.castShadow = false; me.receiveShadow = false; group.add(me); if (col) solid(col === true ? geo : col); return me; };
  // a shape drawn in (a, b) and stood up in the hall: map(a, b) gives the point
  function shapeGeo(shape, map, seg = 12) {
    const g = new THREE.ShapeGeometry(shape, seg), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = map(p.getX(i), p.getY(i)); p.setXYZ(i, v[0], v[1], v[2]); }
    g.computeVertexNormals(); return g;
  }
  const box = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };

  /* ---------------- the river's outline ---------------- */
  const loop = [];   // [x, z], all the way round: left bank going up the hall, the far end, the right bank coming back, the near end
  {
    const nrm = (z) => { const d = (cxf(z + 0.01) - cxf(z - 0.01)) / 0.02, l = Math.hypot(1, d); return [1 / l, -d / l]; };
    const tan = (z) => { const d = (cxf(z + 0.01) - cxf(z - 0.01)) / 0.02, l = Math.hypot(1, d); return [d / l, 1 / l]; };
    const N = Math.round((CZ1 - CZ0) / 0.25);
    for (let i = 0; i <= N; i++) { const z = CZ0 + (CZ1 - CZ0) * i / N, n = nrm(z); loop.push([cxf(z) - n[0] * HW, z - n[1] * HW]); }
    { const z = CZ1, n = nrm(z), t = tan(z), c = [cxf(z), z]; for (let k = 1; k < 16; k++) { const a = Math.PI * k / 16; loop.push([c[0] + (-n[0] * Math.cos(a) + t[0] * Math.sin(a)) * HW, c[1] + (-n[1] * Math.cos(a) + t[1] * Math.sin(a)) * HW]); } }
    for (let i = N; i >= 0; i--) { const z = CZ0 + (CZ1 - CZ0) * i / N, n = nrm(z); loop.push([cxf(z) + n[0] * HW, z + n[1] * HW]); }
    { const z = CZ0, n = nrm(z), t = tan(z), c = [cxf(z), z]; for (let k = 1; k < 16; k++) { const a = Math.PI * k / 16; loop.push([c[0] + (n[0] * Math.cos(a) - t[0] * Math.sin(a)) * HW, c[1] + (n[1] * Math.cos(a) - t[1] * Math.sin(a)) * HW]); } }
  }
  const inLoop = (x, z) => {   // local
    if (z < CZ0) return Math.hypot(x - cxf(CZ0), z - CZ0) < HW;
    if (z > CZ1) return Math.hypot(x - cxf(CZ1), z - CZ1) < HW;
    return Math.abs(x - cxf(z)) < HW * 0.97;
  };
  const toShape = (pts) => pts.map((p) => new THREE.Vector2(p[0], -p[1]));
  const flat = (y) => (a, b) => [a, y, -b];

  /* ---------------- floor, river ---------------- */
  {
    // the walkway: the whole floor of the hall, less the river
    const s = new THREE.Shape([new THREE.Vector2(-HWALL, 0), new THREE.Vector2(HWALL, 0), new THREE.Vector2(HWALL, -LEN), new THREE.Vector2(-HWALL, -LEN)]);
    s.holes.push(new THREE.Path(toShape(loop)));
    add(shapeGeo(s, flat(0)), mat(1), true);
    // the river floor, with the square mouth of the shaft in it
    const r = new THREE.Shape(toShape(loop));
    r.holes.push(new THREE.Path(toShape([[SX - SHS, SZ - SHS], [SX + SHS, SZ - SHS], [SX + SHS, SZ + SHS], [SX - SHS, SZ + SHS]])));
    const fg = shapeGeo(r, flat(FLOOR)); { const p = fg.attributes.position, t = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { t[i * 2] = p.getX(i); t[i * 2 + 1] = p.getZ(i); } fg.setAttribute('tuv', new THREE.BufferAttribute(t, 2)); }
    add(fg, mat(2), true);
    // its walls, all the way round
    const P = [], T = [], Nn = []; let s0 = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
      const q = [[a[0], FLOOR, a[1], s0, FLOOR], [b[0], FLOOR, b[1], s0 + len, FLOOR], [b[0], 0, b[1], s0 + len, 0], [a[0], 0, a[1], s0, 0]];
      for (const k of [0, 1, 2, 0, 2, 3]) { P.push(q[k][0], q[k][1], q[k][2]); T.push(q[k][3], q[k][4]); Nn.push(nx, 0, nz); }
      s0 += len;
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); wg.setAttribute('tuv', new THREE.Float32BufferAttribute(T, 2));
    add(wg, mat(2), true);
    // the rounded lip of pale terrazzo along the edge
    const curve = new THREE.CatmullRomCurve3(loop.filter((_, i) => i % 2 === 0).map((p) => new V3(p[0], -0.01, p[1])), true, 'centripetal');
    add(new THREE.TubeGeometry(curve, loop.length, 0.07, 8, true), mat(3));
  }
  // the water itself (seen from above and from below)
  const waterMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON}
    varying vec3 vW;
    void main(){
      vec2 p = vW.xz; float c1 = caus(p * 0.55, uTime * 0.45), c2 = caus(p * 0.31 + 0.4, uTime * 0.33 + 1.0);
      vec2 g = vec2(sin(p.x * 3.1 + uTime * 1.1) + 0.6 * sin(p.y * 4.3 - uTime * 0.8 + p.x), cos(p.y * 2.7 + uTime * 0.9) + 0.6 * cos(p.x * 3.9 + uTime * 0.7 - p.y)) * 0.03 + (c1 - 0.2) * 0.02;
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      if (uCam.y < vW.y) {   // from underneath: the bright window straight up, a mirror of the blue all round it
        vec3 v = normalize(vW - uCam);
        float cone = smoothstep(0.62, 0.76, v.y + (c1 - 0.2) * 0.05);
        vec3 m = vec3(0.02, 0.20, 0.24) * (0.4 + lit(vW - vec3(0.0, 0.4, 0.0), vec3(0.0, -1.0, 0.0), 1.0)) + vec3(0.3, 0.8, 0.8) * c1 * 0.15;
        vec3 w = vec3(0.25, 0.55, 0.45) * (0.4 + c1) + mirror(vW, -n, 30.0, 6.0, 0.25);
        gl_FragColor = vec4(finish(mix(m, w, cone), vW, 0.0), mix(0.9, 0.35, cone)); return;
      }
      vec3 v = normalize(uCam - vW);
      float fres = 0.03 + 0.97 * pow(1.0 - max(dot(v, n), 0.0), 5.0);
      // the lamps in the walls under the water light it from inside, the way a pool at night glows
      vec3 body = mix(vec3(0.004, 0.06, 0.16), vec3(0.02, 0.17, 0.22), clamp(c2 * 1.3 + 0.2, 0.0, 1.0)) * (0.6 + 1.6 * lit(vW - vec3(0.0, 0.45, 0.0), vec3(0.0, 1.0, 0.0), 1.0));
      body += vec3(0.35, 0.85, 0.75) * c1 * 0.10;
      vec3 refl = vec3(0.02, 0.045, 0.03) + mirror(vW, n, 900.0, 40.0, 1.0);
      vec3 col = body * (1.0 - fres) + refl * (0.25 + fres);
      gl_FragColor = vec4(finish(col, vW, 0.0), mix(0.62, 0.97, fres));
    }`,
  });
  { const s = new THREE.Shape(toShape(loop)); const wm = add(shapeGeo(s, flat(WY), 4), waterMat); wm.renderOrder = 2; }

  /* ---------------- walls, vault, ribs, niches, ends ---------------- */
  const NICHES = [{ s: -1, zc: 15 }, { s: 1, zc: 27 }], NR = 1.8, NSPR = 1.4, NDEEP = 6.4;
  for (const side of [-1, 1]) {
    const n = NICHES.find((q) => q.s === side), a = n.zc - NR, b = n.zc + NR;
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(a, 0); sh.lineTo(a, NSPR); sh.absarc(n.zc, NSPR, NR, Math.PI, 0, true); sh.lineTo(b, 0); sh.lineTo(LEN, 0); sh.lineTo(LEN, SPRING); sh.lineTo(0, SPRING); sh.closePath();
    add(shapeGeo(sh, (u, v) => [side * HWALL, v, u], 24), mat(0), true);
    // the niche: an arched bay with three steps up into it
    const x0 = side * HWALL, x1 = side * NDEEP, xm = (x0 + x1) / 2, dx = Math.abs(x1 - x0);
    for (const zz of [a, b]) add(box(Math.min(x0, x1), 0, zz - 0.01, Math.max(x0, x1), NSPR, zz + 0.01), mat(0), true);
    const nv = new THREE.CylinderGeometry(NR, NR, dx, 32, 1, true, 0, Math.PI); nv.rotateZ(Math.PI / 2); nv.translate(xm, NSPR, n.zc); add(nv, mat(0));
    const bk = new THREE.Shape(); bk.moveTo(a, 0); bk.lineTo(b, 0); bk.lineTo(b, NSPR); bk.absarc(n.zc, NSPR, NR, 0, Math.PI, false); bk.closePath();
    if (side === 1) { const h = new THREE.Path(); h.moveTo(n.zc - 0.5, 0.45); h.lineTo(n.zc - 0.5, 2.52); h.lineTo(n.zc + 0.5, 2.52); h.lineTo(n.zc + 0.5, 0.45); h.closePath(); bk.holes.push(h); }   // the white door's opening
    add(shapeGeo(bk, (u, v) => [x1, v, u], 24), mat(0), true);
    for (let k = 0; k < 3; k++) { const xa = side * (HWALL + 0.35 * k); add(box(Math.min(xa, x1), 0, a, Math.max(xa, x1), 0.15 * (k + 1), b), mat(1), true); }
    n.floor = 0.45; n.x0 = x0; n.x1 = x1;
  }
  { // the vault
    const vg = new THREE.CylinderGeometry(HWALL, HWALL, LEN, 64, 1, true, Math.PI / 2, Math.PI); vg.rotateX(Math.PI / 2); vg.translate(0, SPRING, LEN / 2); add(vg, mat(0));
  }
  const RIBS = [6, 12, 18, 24, 30, 36, 42];
  for (const z of RIBS) {
    const sh = new THREE.Shape(); sh.absarc(0, 0, HWALL + 0.01, 0, Math.PI, false); sh.lineTo(-(HWALL - 0.28), 0); sh.absarc(0, 0, HWALL - 0.28, Math.PI, 0, true); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false, curveSegments: 40 }); rg.translate(0, SPRING, z - 0.275); add(rg, mat(0));
    for (const s of [-1, 1]) add(box(s > 0 ? HWALL - 0.28 : -HWALL, 0, z - 0.275, s > 0 ? HWALL : -(HWALL - 0.28), SPRING, z + 0.275), mat(0), true);
  }
  { // the near end: a plain wall, and high on it the round hole the slide comes out of
    const sh = new THREE.Shape(); sh.moveTo(-HWALL, 0); sh.lineTo(HWALL, 0); sh.lineTo(HWALL, SPRING); sh.absarc(0, SPRING, HWALL, 0, Math.PI, false); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(2.6, 5.35, 0.47, 0, Math.PI * 2, true); sh.holes.push(hole);
    add(shapeGeo(sh, (u, v) => [u, v, 0], 40), mat(0), true);
  }
  const RA = { hw: 1.0, spr: 2.0, d: 3.4 };   // the red arch at the far end, and the little red room through it
  {
    const sh = new THREE.Shape(); sh.moveTo(-HWALL, 0); sh.lineTo(-RA.hw, 0); sh.lineTo(-RA.hw, RA.spr); sh.absarc(0, RA.spr, RA.hw, Math.PI, 0, true); sh.lineTo(RA.hw, 0); sh.lineTo(HWALL, 0); sh.lineTo(HWALL, SPRING); sh.absarc(0, SPRING, HWALL, 0, Math.PI, false); sh.closePath();
    add(shapeGeo(sh, (u, v) => [u, v, LEN], 40), mat(0), true);
    const pl = mat(10);
    for (const s of [-1, 1]) add(box(s * RA.hw - 0.01, 0, LEN, s * RA.hw + 0.01, RA.spr, LEN + RA.d), pl, true);
    const rv = new THREE.CylinderGeometry(RA.hw, RA.hw, RA.d, 24, 1, true, Math.PI / 2, Math.PI); rv.rotateX(Math.PI / 2); rv.translate(0, RA.spr, LEN + RA.d / 2); add(rv, pl);
    const bk = new THREE.Shape(); bk.moveTo(-RA.hw, 0); bk.lineTo(RA.hw, 0); bk.lineTo(RA.hw, RA.spr); bk.absarc(0, RA.spr, RA.hw, 0, Math.PI, false); bk.closePath();
    add(shapeGeo(bk, (u, v) => [u, v, LEN + RA.d], 24), pl, true);
    add(box(-RA.hw, -0.02, LEN, RA.hw, 0, LEN + RA.d), mat(1), true);
    // the arch's edge glows, and so does a small red dot on the far wall
    const ring = new THREE.Shape(); ring.absarc(0, 0, RA.hw + 0.06, 0, Math.PI, false); ring.lineTo(-RA.hw, 0); ring.absarc(0, 0, RA.hw, Math.PI, 0, true); ring.closePath();
    const rg = new THREE.ShapeGeometry(ring, 32); rg.translate(0, RA.spr, LEN - 0.012); add(rg, mat(8, { key: 'red', base: [3.2, 0.45, 0.32] }));
    for (const s of [-1, 1]) add(box(s * (RA.hw + 0.03) - 0.03, 0, LEN - 0.015, s * (RA.hw + 0.03) + 0.03, RA.spr, LEN - 0.01), mat(8, { key: 'red', base: [3.2, 0.45, 0.32] }));
    const dot = new THREE.CircleGeometry(0.06, 20); dot.translate(0, 2.25, LEN + RA.d - 0.01); add(dot, mat(8, { key: 'reddot', base: [6, 0.6, 0.4] }));
    const lampG = new THREE.CircleGeometry(0.2, 24); lampG.rotateX(Math.PI / 2); lampG.translate(0, RA.spr + RA.hw - 0.04, LEN + 1.6); add(lampG, mat(8, { key: 'redlamp', base: [5, 1.1, 0.8] }));
  }
  // The white door at the back of the right-hand bay. E opens it (it stays open: SCF_SAVE riverDoor). Behind it a plain corridor runs on,
  // darker and darker; some way down it, in the dark, it is the corridor behind the exit door at the top of the cinema's hall (js/store.js),
  // and you walk out of that one toward the hall. (DC: the corridor, in this hall's own coordinates; w is how far in from the door.)
  const DC = { x: NICHES[1].x1, z0: NICHES[1].zc - 0.5, z1: NICHES[1].zc + 0.5, zc: NICHES[1].zc, y: NICHES[1].floor, L: 9, W0: 8 };
  const door = { open: !!(window.SCF_SAVE && window.SCF_SAVE.get('riverDoor')), t: 0, pivot: null };
  door.t = door.open ? 1 : 0;
  {
    const x = DC.x - 0.035, chrome = mat(6, { key: 'chrome', base: [0.5, 0.5, 0.48] });
    door.pivot = new THREE.Group(); door.pivot.position.set(x, DC.y, DC.z0 + 0.02); group.add(door.pivot);
    const leaf = new THREE.Mesh(box(-0.03, 0, 0, 0.03, 2.05, 0.96), mat(9)); door.pivot.add(leaf);
    for (const s of [-1, 1]) door.pivot.add(new THREE.Mesh(box(s < 0 ? -0.08 : 0.03, 0.98, 0.78, s < 0 ? -0.03 : 0.08, 1.02, 0.88), chrome));
    door.pivot.rotation.y = door.t * 1.5;
    for (const z of [DC.z0 - 0.06, DC.z1]) add(box(x - 0.05, DC.y, z, x + 0.035, DC.y + 2.58, z + 0.06), mat(9));   // the frame
    add(box(x - 0.05, DC.y + 2.52, DC.z0 - 0.06, x + 0.035, DC.y + 2.58, DC.z1 + 0.06), mat(9));
    // the corridor: the same terrazzo, low, one weak light just inside the door and nothing after it
    const X1 = DC.x + DC.L;
    add(box(DC.x, DC.y - 0.15, DC.z0, X1, DC.y, DC.z1), mat(1), true);
    add(box(DC.x, DC.y, DC.z0 - 0.1, X1, DC.y + 2.62, DC.z0), mat(0), true); add(box(DC.x, DC.y, DC.z1, X1, DC.y + 2.62, DC.z1 + 0.1), mat(0), true);
    add(box(DC.x, DC.y + 2.52, DC.z0 - 0.1, X1, DC.y + 2.62, DC.z1 + 0.1), mat(0), true); add(box(X1, DC.y - 0.15, DC.z0 - 0.1, X1 + 0.1, DC.y + 2.62, DC.z1 + 0.1), mat(0), true);
    light(DC.x + 1.4, DC.y + 2.3, DC.zc, [0.55, 0.6, 0.48], 4.5);
  }

  /* ---------------- lamps ---------------- */
  for (let z = 3; z < LEN; z += 6) {
    const g = new THREE.CircleGeometry(0.42, 32); g.rotateX(Math.PI / 2); g.translate(0, CROWN - 0.03, z); add(g, mat(8, { key: 'lamp', base: [3.4, 3.6, 3.0] }));
    light(0, CROWN - 0.5, z, [1.8, 1.9, 1.6], 14); haze(0, CROWN - 0.05, z, [1.0, 1.08, 0.9]);
  }
  light(0, RA.spr + 0.7, LEN + 1.5, [2.2, 0.10, 0.06], 8); haze(0, RA.spr + 0.9, LEN + 1.6, [1.7, 0.22, 0.16]);
  // lights set in the river walls under the water, one side then the other
  {
    const nrm = (z) => { const d = (cxf(z + 0.01) - cxf(z - 0.01)) / 0.02, l = Math.hypot(1, d); return [1 / l, -d / l]; };
    let side = 1;
    for (let z = 3; z < CZ1; z += 6, side = -side) {
      const n = nrm(z), bx = cxf(z) + side * n[0] * HW, bz = z + side * n[1] * HW;
      const g = new THREE.CircleGeometry(0.085, 20); const m = add(g, mat(8, { key: 'uw', base: [2.6, 3.4, 3.4] }));
      m.position.set(bx - side * n[0] * 0.012, -0.55, bz - side * n[1] * 0.012); m.lookAt(new V3(cxf(z), -0.55, z).add(O));
      light(bx - side * n[0] * 0.3, -0.55, bz - side * n[1] * 0.3, [0.55, 1.1, 1.2], 3.2);
    }
  }

  /* ---------------- planting ---------------- */
  const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const frondTex = tex(512, 128, (g, w, h) => {   // along u: base to tip; across v: one side of the midrib to the other
    const r = mulberry32(31);
    for (let i = 0; i < 70; i++) {
      const u = 0.04 + 0.94 * i / 70, x = u * w, len = (0.46 - 0.30 * u * u) * h, ang = 0.55 + r() * 0.2;
      for (const s of [-1, 1]) {
        g.strokeStyle = `rgb(${40 + r() * 30},${92 + r() * 50},${28 + r() * 20})`; g.lineWidth = 5 - 3 * u; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, h / 2); g.quadraticCurveTo(x + len * 0.5 * Math.cos(ang), h / 2 + s * len * 0.6, x + len * Math.cos(ang) * 1.1, h / 2 + s * len * Math.sin(ang) * 1.6); g.stroke();
      }
    }
    g.strokeStyle = '#6f7a3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
  const bladeTex = tex(256, 256, (g, w, h) => {
    const r = mulberry32(57);
    for (let i = 0; i < 26; i++) {
      const a = -1.25 + 2.5 * r(), len = h * (0.55 + 0.4 * r()), bx = w / 2 + (r() - 0.5) * 30, tx = bx + Math.sin(a) * len, ty = h - Math.cos(a) * len, wd = 6 + r() * 9;
      g.fillStyle = `rgb(${30 + r() * 40},${85 + r() * 70},${25 + r() * 30})`;
      g.beginPath(); g.moveTo(bx - wd, h); g.quadraticCurveTo((bx + tx) / 2 - wd * 0.6, (h + ty) / 2, tx, ty); g.quadraticCurveTo((bx + tx) / 2 + wd * 0.6, (h + ty) / 2, bx + wd, h); g.fill();
    }
  });
  const mFrond = mat(5, { key: 'frond', map: frondTex }), mBlade = mat(5, { key: 'blade', map: bladeTex }), mTrunk = mat(7), mStone = mat(4);
  function palm(x, y, z, h, lx, lz) {
    const tg = new THREE.CylinderGeometry(0.075, 0.13, h, 10, 14, true); tg.translate(0, h / 2, 0);
    const p = tg.attributes.position, t = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i), k = yy / h; p.setX(i, p.getX(i) + lx * k * k); p.setZ(i, p.getZ(i) + lz * k * k); t[i * 2] = Math.atan2(p.getZ(i), p.getX(i)); t[i * 2 + 1] = yy; }
    tg.setAttribute('tuv', new THREE.BufferAttribute(t, 2)); tg.computeVertexNormals(); tg.translate(x, y, z); add(tg, mTrunk, new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8).translate(x, y + 0.6, z));
    const top = new V3(x + lx, y + h, z + lz), nf = 11, ph = rnd() * 6;
    for (let f = 0; f < nf; f++) {
      const L = 1.5 + rnd() * 0.6, W = 0.62, yaw = ph + f * Math.PI * 2 / nf + (rnd() - 0.5) * 0.3, lift = 0.15 + rnd() * 0.35, droop = 0.7 + rnd() * 0.5;
      const P = [], UV = [], N = [], I = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12, taper = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.9 + 0.1;
        for (let j = 0; j <= 2; j++) { const w = (j / 2 - 0.5) * W * taper; P.push(u * L, L * (lift * u - droop * u * u * 0.5) - Math.abs(w) * 0.35, w); UV.push(u, j / 2); N.push(0, 1, 0); } }
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; I.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
      g.rotateY(yaw); g.translate(top.x, top.y, top.z); add(g, mFrond);
    }
  }
  function bush(x, y, z, s) {
    for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(s, s); g.translate(0, s / 2, 0); g.rotateY(k * Math.PI / 3 + rnd()); g.translate(x, y, z); add(g, mBlade); }
  }
  function boulder(x, y, z, r) {
    const ico = new THREE.IcosahedronGeometry(r, 4); ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
    const g = mergeVertices(ico), p = g.attributes.position, sd = rnd() * 100;
    for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i), k = 1 + 0.12 * Math.sin(v.x * 7 + sd) * Math.sin(v.y * 6 + sd) * Math.sin(v.z * 8) + 0.05 * Math.sin(v.x * 19 + v.z * 13 + sd); v.multiplyScalar(k); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); { const nm = g.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new V3(p.getX(i), p.getY(i) / 0.52, p.getZ(i)).normalize(); nm.setXYZ(i, v.x, v.y, v.z); } }
    g.translate(x, y + r * 0.45, z); add(g, mStone, new THREE.IcosahedronGeometry(r * 0.9, 0).scale(1, 0.72, 1).translate(x, y + r * 0.45, z));
  }
  function groundLamp(x, y, z) {
    const st = new THREE.CylinderGeometry(0.012, 0.016, 0.22, 8); st.translate(x, y + 0.11, z); add(st, mat(6, { key: 'post', base: [0.05, 0.05, 0.045] }));
    const b = new THREE.SphereGeometry(0.035, 12, 8); b.translate(x, y + 0.24, z); add(b, mat(8, { key: 'warm', base: [5.0, 3.0, 1.3] }));
    light(x, y + 0.3, z, [2.3, 1.25, 0.5], 2.9);
  }
  const nearRib = (z) => RIBS.some((r) => Math.abs(z - r) < 0.9);
  for (const side of [-1, 1]) {
    let last = -99, count = 0;
    for (let z = 3.6; z < 43.5; z += 0.5) {
      const edge = side < 0 ? cxf(z) - HW : cxf(z) + HW, gap = side < 0 ? edge + HWALL : HWALL - edge;
      const n = NICHES.find((q) => q.s === side); if (Math.abs(z - n.zc) < NR + 0.9) continue;
      if (gap < 2.25 || z - last < 5.5 || nearRib(z)) continue;
      last = z; count++;
      const x0 = side * (HWALL - 0.7);
      boulder(x0 + side * 0.05, 0, z - 0.45, 0.42 + rnd() * 0.15); boulder(x0 - side * 0.25, 0, z + 0.4, 0.3 + rnd() * 0.12);
      if (rnd() < 0.5) boulder(x0 + side * 0.2, 0, z + 0.95, 0.25);
      bush(x0, 0, z + 0.05, 0.9 + rnd() * 0.3); bush(x0 + side * 0.25, 0, z - 1.0, 0.7); bush(x0 - side * 0.1, 0, z + 1.2, 0.75);
      if (count % 2 === 1 || rnd() < 0.3) palm(x0 + side * 0.15, 0, z + 0.1, 3.4 + rnd() * 1.4, -side * (0.4 + rnd() * 0.5), (rnd() - 0.5) * 0.5);
      groundLamp(x0 - side * 0.6, 0, z - 0.1);
    }
  }
  { const n = NICHES[0], x = n.x1 + 0.9;   // a big palm up in the left-hand bay
    palm(x, n.floor, n.zc, 2.3, 0.6, -0.3); boulder(x + 0.3, n.floor, n.zc + 0.8, 0.4); boulder(x - 0.1, n.floor, n.zc - 0.9, 0.33); bush(x + 0.2, n.floor, n.zc + 0.2, 1.0); groundLamp(x + 0.75, n.floor, n.zc - 0.3); }

  /* ---------------- the slide ---------------- */
  let rideCurve = null;
  {
    const curve = new THREE.CatmullRomCurve3([new V3(2.6, 5.35, -1.2), new V3(2.6, 5.35, 0.3), new V3(2.95, 5.0, 2.8), new V3(2.7, 4.1, 5.6), new V3(1.8, 2.7, 8.2), new V3(cxf(10.4) + 0.5, 1.35, 10.4), new V3(cxf(12) + 0.15, 0.32, 12.1)]);
    const TS = 180, RS = 22, g = new THREE.TubeGeometry(curve, TS, 0.45, RS, false), nrm = g.attributes.normal, col = new Float32Array(nrm.count * 3);
    const PAL = [[[0.85, 0.58, 0.03], [0.02, 0.36, 0.42]], [[0.72, 0.06, 0.03], [0.85, 0.58, 0.03]], [[0.02, 0.36, 0.42], [0.03, 0.12, 0.52]], [[0.85, 0.58, 0.03], [0.72, 0.06, 0.03]]];
    const L = curve.getLength();
    for (let i = 0; i <= TS; i++) for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j, band = Math.floor(i / TS * L / 1.9) % 4, top = nrm.getY(k) > -0.15, c = PAL[band][top ? 0 : 1];
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    g.setAttribute('vcol', new THREE.BufferAttribute(col, 3));
    add(g, mat(6, { key: 'slide', base: [-1, 0, 0] }), new THREE.TubeGeometry(curve, 50, 0.45, 8, false));
    // the line someone riding it follows, low in the tube (in the world's coordinates): from deep in the wall down to the water
    rideCurve = new THREE.CatmullRomCurve3(curve.points.map((q) => new V3(q.x, q.y - 0.36, q.z).add(O))); rideCurve.arcLengthDivisions = 400;
  }

  /* ---------------- rings on the water ---------------- */
  const rings = [];
  { const tg = new THREE.TorusGeometry(0.4, 0.15, 16, 40); tg.rotateX(Math.PI / 2); const rm = mat(6, { key: 'ring', base: [0.80, 0.60, 0.05] });
    for (const [z, o] of [[8.6, 0.3], [17.2, -0.35], [23.8, 0.25], [33.4, -0.2], [38.5, 0.35]]) { const m = add(tg, rm); m.position.set(cxf(z) + o, WY + 0.03, z); rings.push({ m, x: m.position.x, z, ph: rnd() * 6 }); } }

  /* ---------------- the shaft, twice ---------------- */
  const shaftMat = (base) => new THREE.ShaderMaterial({
    uniforms: { uTime, uCam, uBase: { value: base }, uL: { value: SL }, uCap: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uL, uCap; uniform vec3 uCam, uBase; varying vec3 vW; varying vec3 vN; ${CAUSTIC}
    void main(){
      vec3 r = vW - uBase, n = abs(vN);
      vec2 q = (n.y > 0.5 ? r.xz : (n.x > 0.5 ? r.zy : r.xy)) / 0.05, f = fract(q), id = floor(q);
      float tile = step(0.07, f.x) * step(0.07, f.y);
      float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
      vec3 tc = mix(vec3(0.62, 0.80, 0.76), vec3(0.36, 0.70, 0.68), step(0.88, h)) * (0.88 + 0.22 * h);
      vec3 base = mix(vec3(0.26, 0.36, 0.34), tc, tile);
      float lt = 0.05 + 0.55 * exp(-(uL - r.y) * 2.2) + 0.22 * exp(-r.y * 3.0) + 0.4 * exp(-abs(r.y - uL * 0.33) * 8.0) + 0.4 * exp(-abs(r.y - uL * 0.70) * 8.0);
      vec3 col = base * vec3(0.30, 0.75, 0.70) * lt * (1.0 + 1.3 * caus(r.xz * 1.4 + r.y * 0.6, uTime * 0.5));
      if (uCap > 0.5) col = vec3(0.05, 0.30, 0.31);
      float k = clamp((uCam.y - uBase.y) / uL, 0.0, 1.0);
      vec3 fc = mix(vec3(0.004, 0.032, 0.034), vec3(0.008, 0.085, 0.095), k);
      gl_FragColor = vec4(mix(col, fc, 1.0 - exp(-distance(uCam, vW) * 2.6)), 1.0);
    }`,
  });
  const porthole = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.6, 1.15) });
  // one copy: its four walls, two little round lamps, and a cap at the top (the lower copy) or the bottom (the upper one)
  function shaftCopy(bx, by, bz, parent, world, capTop) {
    const wb = world ? new V3(bx, by, bz) : new V3(bx, by, bz).add(O), m = shaftMat(wb), cap = shaftMat(wb); cap.uniforms.uCap.value = capTop ? 1 : 0;
    const P = [], N = [];
    const quad = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) P.push(...v); for (let k = 0; k < 6; k++) N.push(...n); };
    const s = SHS, y0 = by, y1 = by + SL;
    quad([bx - s, y0, bz - s], [bx + s, y0, bz - s], [bx + s, y1, bz - s], [bx - s, y1, bz - s], [0, 0, 1]);
    quad([bx + s, y0, bz + s], [bx - s, y0, bz + s], [bx - s, y1, bz + s], [bx + s, y1, bz + s], [0, 0, -1]);
    quad([bx - s, y0, bz + s], [bx - s, y0, bz - s], [bx - s, y1, bz - s], [bx - s, y1, bz + s], [1, 0, 0]);
    quad([bx + s, y0, bz - s], [bx + s, y0, bz + s], [bx + s, y1, bz + s], [bx + s, y1, bz - s], [-1, 0, 0]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    const me = new THREE.Mesh(g, m); parent.add(me);
    const cy = capTop ? y1 : y0, cg = new THREE.PlaneGeometry(2 * s, 2 * s); cg.rotateX(-Math.PI / 2); cg.translate(bx, cy, bz); parent.add(new THREE.Mesh(cg, cap));
    for (const [yy, face] of [[SL * 0.33, 0], [SL * 0.70, 1]]) {
      const lg = new THREE.CircleGeometry(0.035, 16);
      if (face === 0) lg.translate(bx, by + yy, bz - s + 0.002); else { lg.rotateY(-Math.PI / 2); lg.translate(bx + s - 0.002, by + yy, bz); }
      parent.add(new THREE.Mesh(lg, porthole));
    }
    const mw = world ? null : MW;
    addCollider(g, mw); addCollider(cg, mw);
  }
  shaftCopy(shaft.x, shaft.y0, shaft.z, scene, true, true);
  shaftCopy(SX, FLOOR - SL, SZ, group, false, false);
  const lowBase = new V3(shaft.x, shaft.y0, shaft.z), upBase = new V3(SX, FLOOR - SL, SZ).add(O), D = upBase.clone().sub(lowBase);

  // pad the light lists to their full length (unused lights have no reach)
  while (LP.length < NL) { LP.push(new V3(0, -999, 0)); LC.push(new V3()); LR.push(0.001); }
  while (SP.length < NS) { SP.push(new V3(0, -999, 0)); SC.push(new V3()); }

  /* ---------------- what the playroom asks ---------------- */
  const loc = (x, z) => [x - O.x, z - O.z];
  const inLowShaft = (x, y, z) => Math.abs(x - lowBase.x) < SHS && Math.abs(z - lowBase.z) < SHS && y > lowBase.y - 0.35 && y < lowBase.y + SL;
  const inUpShaft = (x, y, z) => Math.abs(x - upBase.x) < SHS && Math.abs(z - upBase.z) < SHS && y > upBase.y - 0.1 && y < upBase.y + SL + 0.05;
  const inCorr = (lx, ly, lz) => lx > DC.x - 0.05 && lx < DC.x + DC.L + 0.2 && lz > DC.z0 - 0.2 && lz < DC.z1 + 0.2 && ly > DC.y - 0.5 && ly < DC.y + 3;
  const inZone = (x, y, z) => { const [lx, lz] = loc(x, z); return (y > upBase.y - 0.5 && y < O.y + 12 && lx > -NDEEP - 0.5 && lx < NDEEP + 0.5 && lz > -1.7 && lz < LEN + RA.d + 1) || inCorr(lx, y - O.y, lz); };
  const doorAt = new V3(DC.x - 0.04, DC.y + 1.1, DC.zc).add(O), _dd = new V3();
  let amb = null, zk = 0;
  return {
    O, group, spawn: { pos: new V3(-1.7, 0.05, 1.8).add(O), yaw: Math.PI + 0.2 },
    inZone,
    inShaft: (x, y, z) => inLowShaft(x, y, z) || inUpShaft(x, y, z),
    // under the shaft's mouth in the maze: close enough to be drawn up into it
    underShaft: (x, y, z) => Math.abs(x - lowBase.x) < SHS + 0.12 && Math.abs(z - lowBase.z) < SHS + 0.12 && y > lowBase.y - 0.6 && y < lowBase.y + 0.05,
    shaftCenter: (y) => (y > 10 ? [upBase.x, upBase.z] : [lowBase.x, lowBase.z]),
    // the water surface over (x, y, z), if that is in this hall's water: the river, or the upper shaft
    waterY(x, y, z) {
      if (inUpShaft(x, y, z)) return O.y + WY;
      const [lx, lz] = loc(x, z); if (y > O.y + FLOOR - 0.2 && y < O.y + 1.5 && inLoop(lx, lz)) return O.y + WY;
      return null;
    },
    inRiverXZ: (x, z) => { const [lx, lz] = loc(x, z); return inLoop(lx, lz); },
    edgeY: O.y,
    // halfway up the shaft you are moved from one copy to the other; returns the move, or null
    warp(p) {
      if (inLowShaft(p.x, p.y, p.z) && p.y > lowBase.y + SL / 2 + 0.03) { p.add(D); return D; }
      if (inUpShaft(p.x, p.y, p.z) && p.y < upBase.y + SL / 2 - 0.03) { p.sub(D); return D.clone().negate(); }
      return null;
    },
    get k() { return zk; },
    slideCurve: rideCurve,   // the striped slide, to ride (js/playroom.js: from the slide holes of the mirror room)
    // the white door and the corridor behind it
    CORR: { W0: DC.W0, half: (DC.z1 - DC.z0) / 2, yawIn: -Math.PI / 2 },
    get doorOpen() { return door.open; },
    openDoor(quiet) { if (door.open) return; door.open = true; if (quiet) door.t = 1; if (window.SCF_SAVE) window.SCF_SAVE.set('riverDoor', true); },
    doorAt,
    doorNear(cam, dir) { if (door.open) return false; _dd.copy(doorAt).sub(cam); const d = _dd.length(); return d < 1.6 && (d < 0.5 || _dd.dot(dir) / d > 0.6); },
    blockDoor(p, r) {   // the shut door is in the way
      if (door.t > 0.85) return; const lx = p.x - O.x, ly = p.y - O.y, lz = p.z - O.z;
      if (lz > DC.z0 - r && lz < DC.z1 + r && ly > DC.y - 0.3 && ly < DC.y + 2.5 && lx > DC.x - 0.07 - r && lx < DC.x + 0.3) p.x = O.x + DC.x - 0.07 - r;
    },
    corrW(p) { const lx = p.x - O.x, ly = p.y - O.y, lz = p.z - O.z; return lx > DC.x && lx < DC.x + DC.L + 0.2 && lz > DC.z0 - 0.05 && lz < DC.z1 + 0.05 && ly > DC.y - 0.4 && ly < DC.y + 2.6 ? lx - DC.x : -1; },
    corrU(p) { return p.z - O.z - DC.zc; },
    corrPoint(w, u, y) { return new V3(DC.x + w, DC.y + y, DC.zc + u).add(O); },
    corrFloor: O.y + DC.y,
    update(dt, cam, under, AC) {
      if (door.open && door.t < 1) { door.t = Math.min(1, door.t + dt / 0.9); const e = 1 - Math.pow(1 - door.t, 3); door.pivot.rotation.y = 1.5 * e; }
      const here = inZone(cam.x, cam.y, cam.z);
      group.visible = here;
      zk += ((here ? 1 : 0) - zk) * Math.min(1, dt * 2.5);
      U.uUW.value = here && under > 0.5 ? 1 : 0;
      for (const r of rings) { const t = uTime.value; r.m.position.y = O.y + WY + 0.035 + Math.sin(t * 1.1 + r.ph) * 0.018; r.m.position.x = O.x + r.x + Math.sin(t * 0.13 + r.ph) * 0.12; r.m.position.z = O.z + r.z + Math.sin(t * 0.09 + r.ph * 2) * 0.25; r.m.rotation.y = t * 0.05 + r.ph; r.m.rotation.z = Math.sin(t * 0.8 + r.ph) * 0.03; }
      // the hall's sound: water moving somewhere, a low room tone, now and then a drip
      if (AC && AC.state === 'running' && !amb) {
        try {
          const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let b = 0;
          for (let i = 0; i < len; i++) { b = (b + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = b * 3; }
          const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
          const lp = AC.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 520; lp.Q.value = 0.5;
          const g = AC.createGain(); g.gain.value = 0;
          const l = AC.createOscillator(); l.frequency.value = 0.11; const lg = AC.createGain(); lg.gain.value = 160; l.connect(lg); lg.connect(lp.frequency);
          const verb = AC.createConvolver(), ir = AC.createBuffer(2, AC.sampleRate * 3, AC.sampleRate);
          for (let c = 0; c < 2; c++) { const dd = ir.getChannelData(c); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dd.length, 3); }
          verb.buffer = ir; const vg = AC.createGain(); vg.gain.value = 0;
          src.connect(lp); lp.connect(g); g.connect(AC.destination); verb.connect(vg); vg.connect(AC.destination);
          src.start(); l.start(); amb = { g, verb, vg, next: 0 };
        } catch (e) { amb = { failed: true }; }
      }
      if (amb && !amb.failed) {
        const t = AC.currentTime; amb.g.gain.setTargetAtTime(0.16 * zk, t, 0.3); amb.vg.gain.setTargetAtTime(0.5 * zk, t, 0.3);
        if (zk > 0.5 && t > amb.next) {
          amb.next = t + 2 + Math.random() * 6;
          const o = AC.createOscillator(), og = AC.createGain(), f = 900 + Math.random() * 1100; o.type = 'sine';
          o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06);
          og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          o.connect(og); og.connect(amb.verb); o.start(t); o.stop(t + 0.15);
        }
      }
    },
  };
}
