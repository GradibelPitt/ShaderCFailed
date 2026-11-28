// The Black Tower (黑塔). The last place, on a page of its own for now: nothing leads here yet.
// Inside one of the towers where they keep the sleepers. A round black shaft eighty metres across with no top and no bottom you can see:
// its wall is set, row over row, with pods, each with somebody asleep in it, curled up in a pink glow that beats slowly like a heart.
// A narrow steel walkway winds up the wall in a spiral, close enough to the pods to touch them; once a turn a bridge goes off it to a
// platform round the bundle of cables that hangs down the middle. One column of the wall has no pods: openings, and through them the
// field outside: more towers, thousands of them, every one covered in the same small lights, under a sky that flashes now and then.
// You start beside the one pod that is open, and empty.
// Everything repeats once a turn (thirteen metres up), so the tower is drawn as thirteen turns round you, moved along as you climb.
// All the light is worked out in the shaders: the pods' glow from the wall, small cold lamps on the rails, the flashes outside.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const ang = (x, z) => { const a = Math.atan2(z, x); return a < 0 ? a + TAU : a; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(1999);

/* ---------------- measures (metres) ---------------- */
const PITCH = 13;                   // the walkway climbs this much in one turn (and everything repeats every turn)
const R_IN = 34.45, R_OUT = 36.85;  // the walkway, between its inner rail and the pods
const R_POD = 38.5, R_WALL = 40.2;  // where the pods stand, and the wall behind them
const NP = 56, ROWS = 5, ROW_H = 2.6, DA = TAU / NP;   // pods round one row, rows in a turn, the step up between rows
const WIN_A = Math.PI, WIN_POD = 0.27, WIN_WALL = 0.22; // the column of openings: no pods there, and the wall open
const R_PLAT0 = 4.6, R_PLAT1 = 6.7, BR_W = 0.8;        // the platform round the cables, and the bridge out to it (half its width)
const SEG = 256;                    // steps round one turn of the walkway
const TURNS = 6;                    // turns drawn above and below you (the haze has them all but gone by then)
const NEAR = 2;                     // turns of pods drawn in full round you; the rest more simply
const helix = (a) => a / TAU * PITCH;   // the walkway's height at an angle in the turn (0..TAU)
const EMPTY_ROW = 0, EMPTY_I = Math.round(5.6 / DA - 0.5), EMPTY_ID = EMPTY_ROW * NP + EMPTY_I;
const podAngle = (j, i) => (i + 0.5 + 0.5 * (j % 2)) * DA;

/* ---------------- renderer ---------------- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const pickPR = () => Math.min(window.devicePixelRatio || 1, Math.sqrt(2.2e6 / Math.max(1, innerWidth * innerHeight)), 1.5);
renderer.setPixelRatio(pickPR()); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070303);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 9000); camera.rotation.order = 'YXZ';

/* ---------------- shared shader pieces ---------------- */
const U = { uTime: { value: 0 }, uFlash: { value: 0 }, uTurn: { value: 0 }, uBolt: { value: 0 }, uBoltA: { value: 0 }, uBoltS: { value: 0 } };
const COMMON = `
uniform float uTime, uFlash, uTurn, uBolt, uBoltA, uBoltS;
const float PI = 3.14159265, TAU = 6.2831853, PITCH = ${PITCH.toFixed(1)};
float hash1(float n){ return fract(sin(n) * 43758.5453); }
float hash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(mix(mix(hash1(n), hash1(n + 1.0), f.x), mix(hash1(n + 57.0), hash1(n + 58.0), f.x), f.y),
             mix(mix(hash1(n + 113.0), hash1(n + 114.0), f.x), mix(hash1(n + 170.0), hash1(n + 171.0), f.x), f.y), f.z); }
float angOf(vec3 p){ float a = atan(p.z, p.x); return a < 0.0 ? a + TAU : a; }
float helixL(float a){ return a / TAU * PITCH; }
// the height of the walkway at angle a, in the turn nearest to height y
float deckAt(float a, float y){ float h = helixL(a); return h + floor((y - h) / PITCH + 0.5) * PITCH; }
// the heartbeat every pod glows to: a wave going slowly up the tower
float beat(float x){ x = fract(x); return exp(-pow((x - 0.08) * 20.0, 2.0)) + 0.55 * exp(-pow((x - 0.25) * 18.0, 2.0)); }
float pulseAt(float y, float k){ return 0.78 + 0.22 * beat(uTime * 0.72 - y * 0.011 + k); }
float nearWindow(float a){ return smoothstep(0.75, 0.2, abs(a - PI)); }
// the haze: cold and grey looking up (whatever light there is, far above), red-brown looking down, into the glow of all the pods below
vec3 hazeCol(vec3 dir){ return mix(vec3(0.034, 0.011, 0.010), vec3(0.016, 0.019, 0.026), smoothstep(-0.5, 0.85, dir.y)); }
vec3 haze(vec3 col, vec3 p){ vec3 d = p - cameraPosition; float l = length(d);
  float f = 1.0 - exp(-l * 0.0175 - abs(d.y) * 0.011); return mix(col, hazeCol(d / max(l, 1e-4)), f); }
float seeThrough(vec3 p){ vec3 d = p - cameraPosition; float l = length(d); return exp(-l * 0.0175 - abs(d.y) * 0.011); }
// light falling on a surface in the tower
vec3 lightAt(vec3 p, vec3 n, vec3 alb, float shine){
  float r = length(p.xz), a = angOf(p); vec3 outv = vec3(p.x, 0.0, p.z) / max(r, 1e-3);
  vec3 v = normalize(cameraPosition - p);
  // the pods: a warm red from the wall, strongest close to it and on whatever faces it
  float podK = (0.18 + 0.82 * smoothstep(8.0, 37.5, r)) * pulseAt(p.y, 0.0) * (1.0 - 0.85 * nearWindow(a) * smoothstep(30.0, 39.0, r));
  vec3 col = alb * vec3(1.0, 0.22, 0.15) * podK * (0.05 + 0.38 * max(dot(n, outv), 0.0) + 0.08 * max(-n.y, 0.0));
  col += vec3(1.0, 0.3, 0.22) * podK * pow(max(dot(reflect(-v, n), outv), 0.0), 8.0) * shine * 0.35;
  // the faint cold from far above
  col += alb * vec3(0.32, 0.42, 0.58) * (0.03 + 0.06 * max(n.y, 0.0));
  // the small lamps on the walkway's inner rail (16 a turn), on the bridge and round the platform
  {
    float LS = TAU / 16.0, al = floor(a / LS + 0.5) * LS;
    vec3 lp = vec3(cos(al) * (${R_IN.toFixed(2)} + 0.12), 0.0, sin(al) * (${R_IN.toFixed(2)} + 0.12)); lp.y = deckAt(mod(al, TAU), p.y - 0.95) + 0.95;
    vec3 L = lp - p; float d2 = dot(L, L); L *= inversesqrt(d2);
    float k = 2.2 / (1.0 + d2 * 0.9);
    col += (alb * max(dot(n, L), 0.0) + pow(max(dot(reflect(-L, n), v), 0.0), 24.0) * shine) * vec3(0.75, 0.86, 1.0) * k;
  }
  {
    float yk = floor((p.y - 1.0) / PITCH + 0.5) * PITCH + 1.0;
    if (p.x > 4.0 && abs(p.z) < 5.0) {
      vec3 lp = vec3(clamp(floor((p.x - 9.0) / 6.0 + 0.5) * 6.0 + 9.0, 9.0, 33.0), yk, sign(p.z + 1e-4) * 0.72);
      vec3 L = lp - p; float d2 = dot(L, L); L *= inversesqrt(d2);
      col += (alb * max(dot(n, L), 0.0) + pow(max(dot(reflect(-L, n), v), 0.0), 24.0) * shine) * vec3(0.75, 0.86, 1.0) * 1.6 / (1.0 + d2 * 0.9);
    }
    if (r < 14.0) {
      float LS = TAU / 8.0, al = floor((a - LS * 0.5) / LS + 0.5) * LS + LS * 0.5;
      vec3 lp = vec3(cos(al) * 6.6, yk, sin(al) * 6.6);
      vec3 L = lp - p; float d2 = dot(L, L); L *= inversesqrt(d2);
      col += (alb * max(dot(n, L), 0.0) + pow(max(dot(reflect(-L, n), v), 0.0), 24.0) * shine) * vec3(0.75, 0.86, 1.0) * 1.8 / (1.0 + d2 * 0.9);
    }
  }
  // a flash outside comes in through the openings
  vec3 Lw = normalize(vec3(-1.0, 0.45, 0.0));
  col += alb * vec3(0.55, 0.65, 1.0) * uFlash * (0.2 + 1.4 * smoothstep(1.1, 0.0, abs(a - PI)) * smoothstep(16.0, 39.0, r)) * (0.3 + max(dot(n, Lw), 0.0));
  return col;
}
`;
const VERT = `
attribute float aKind; varying vec3 vW, vN; varying float vK;
void main(){
#ifdef USE_INSTANCING
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
#else
  vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal);
#endif
  vW = w.xyz; vK = aKind; gl_Position = projectionMatrix * viewMatrix * w;
}`;
// steel: 0 grating (the walkway and the bridges), 1 structure, 2 lamp, 3 cable and rubber, 4 plate (the platforms), 5 the small red pilot lights
const metalMat = new THREE.ShaderMaterial({
  uniforms: U, vertexShader: VERT,
  fragmentShader: COMMON + `
  varying vec3 vW, vN; varying float vK;
  void main(){
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    float k = floor(vK + 0.5), r = length(vW.xz), a = angOf(vW);
    float grime = vnoise(vW * 1.7) * 0.6 + vnoise(vW * 7.3) * 0.4;
    vec3 alb = vec3(0.12, 0.12, 0.13) * (0.6 + 0.6 * grime); float shine = 0.5;
    if (k == 2.0) { gl_FragColor = vec4(haze(vec3(2.6, 3.1, 3.8), vW), 1.0); return; }
    if (k == 5.0) { float bl = step(0.5, fract(uTime * 0.5 + hash2(floor(vW.xz * 3.0)))); gl_FragColor = vec4(haze(vec3(3.0, 0.15, 0.08) * (0.25 + 0.75 * bl), vW), 1.0); return; }
    if (k == 0.0) {
      // grating: bars across the way, a slot between each, and a heavier bar every so often
      float arc = a * r; if (vW.x > 4.0 && abs(vW.z) < 1.2 && r < ${R_IN.toFixed(2)}) arc = vW.x;
      float across = (vW.x > 4.0 && abs(vW.z) < 1.2 && r < ${R_IN.toFixed(2)}) ? vW.z : r;
      float u = arc / 0.045, w = fwidth(u);
      float slot = smoothstep(0.35, 0.45, abs(fract(u) - 0.5)) ; slot = mix(slot, 0.4, clamp(w * 1.5, 0.0, 1.0));
      float heavy = smoothstep(0.04, 0.0, abs(fract(across / 0.8) - 0.5) - 0.44);
      alb = mix(vec3(0.16, 0.16, 0.17), vec3(0.015), (1.0 - slot) * (1.0 - heavy) * step(0.5, n.y + 0.5)) * (0.55 + 0.4 * grime); shine = 1.7;   // soaking wet
    } else if (k == 3.0) { alb = vec3(0.035, 0.032, 0.034) * (0.8 + 0.4 * grime); shine = 0.9; }
    else if (k == 4.0) { float tr = step(0.93, fract(r * 1.1)) + step(0.96, fract(a * 40.0)); alb = vec3(0.1, 0.1, 0.105) * (0.75 + 0.5 * grime) * (1.0 - 0.5 * tr); shine = 0.7; }
    vec3 col = lightAt(vW, n, alb, shine);
    // rain: on anything facing up, drops landing (a ring spreading and gone); on everything, water running down
    if (n.y > 0.6) { vec2 g = vW.xz * 2.2; vec2 id = floor(g); float h = hash2(id + floor(uTime * 1.3 + hash2(id) * 7.0)); float ph = fract(uTime * 1.3 + hash2(id) * 7.0);
      float ring = smoothstep(0.05, 0.0, abs(length(fract(g) - 0.5 - (h - 0.5) * 0.4) - ph * 0.35)) * (1.0 - ph);
      col += (vec3(0.5, 0.55, 0.7) * 0.25 + vec3(1.0, 0.3, 0.22) * 0.25) * ring * step(0.45, h); }
    else { float run = smoothstep(0.75, 1.0, vnoise(vec3(vW.x * 9.0 + vW.z * 9.0, vW.y * 0.8 + uTime * 2.5, 0.0))); col += vec3(1.0, 0.35, 0.28) * run * 0.05 + vec3(0.6, 0.7, 1.0) * run * uFlash * 0.3; }
    gl_FragColor = vec4(haze(col, vW), 1.0);
  }`,
});
metalMat.extensions.derivatives = true;

/* ---------------- a little geometry kit ---------------- */
const BP = [], BN = [], BK = [];
const _a = new V3(), _b = new V3(), _n = new V3();
function tri(a, b, c, k) { _a.subVectors(b, a); _b.subVectors(c, a); _n.crossVectors(_a, _b).normalize(); for (const v of [a, b, c]) { BP.push(v.x, v.y, v.z); BN.push(_n.x, _n.y, _n.z); BK.push(k); } }
// a quad facing roughly toward hint
function quad(a, b, c, d, hint, k) { _a.subVectors(b, a); _b.subVectors(d, a); _n.crossVectors(_a, _b); if (_n.dot(hint) < 0) { tri(a, d, c, k); tri(a, c, b, k); } else { tri(a, b, c, k); tri(a, c, d, k); } }
// a box round centre c, along three axes (a right-handed set), half sizes hx hy hz
function box(c, ax, ay, hx, hy, hz, k) {
  const az = new V3().crossVectors(ax, ay).normalize(), X = ax.clone().multiplyScalar(hx), Y = ay.clone().multiplyScalar(hy), Z = az.clone().multiplyScalar(hz);
  const P = (sx, sy, sz) => c.clone().addScaledVector(X, sx).addScaledVector(Y, sy).addScaledVector(Z, sz);
  for (const [N, s] of [[ax, 0], [ay, 1], [az, 2]]) for (const sg of [1, -1]) {
    const pts = [];
    for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push(s === 0 ? P(sg, u, w) : s === 1 ? P(u, sg, w) : P(u, w, sg));
    quad(pts[0], pts[1], pts[2], pts[3], N.clone().multiplyScalar(sg), k);
  }
}
const UP = new V3(0, 1, 0);
function beam(p0, p1, w, h, k) { const ax = new V3().subVectors(p1, p0), L = ax.length(); ax.divideScalar(L); let ay = UP.clone().addScaledVector(ax, -ax.dot(UP)); if (ay.lengthSq() < 1e-4) ay = new V3(1, 0, 0).addScaledVector(ax, -ax.x); ay.normalize(); box(p0.clone().add(p1).multiplyScalar(0.5), ax, ay, L / 2, h / 2, w / 2, k); }
const polar = (r, a, y) => new V3(Math.cos(a) * r, y, Math.sin(a) * r);
function takeGeom() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(BP.splice(0), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(BN.splice(0), 3)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(BK.splice(0), 1)); return g; }
function kindGeom(g, k) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count; g.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(n).fill(k), 1)); return g; }

/* ---------------- one turn of the tower's steel ---------------- */
{
  const inBridgeGap = (a) => Math.abs(wrapPi(a)) < 0.034, inWin = (a) => Math.abs(a - WIN_A) < 0.33;
  for (let s = 0; s < SEG; s++) {
    const a0 = s / SEG * TAU, a1 = (s + 1) / SEG * TAU, y0 = helix(a0), y1 = helix(a1);
    // the deck
    quad(polar(R_IN, a0, y0), polar(R_OUT, a0, y0), polar(R_OUT, a1, y1), polar(R_IN, a1, y1), UP, 0);
    quad(polar(R_IN, a0, y0 - 0.05), polar(R_OUT, a0, y0 - 0.05), polar(R_OUT, a1, y1 - 0.05), polar(R_IN, a1, y1 - 0.05), new V3(0, -1, 0), 0);
    // stringers along both edges
    for (const [ra, rb] of [[R_IN, R_IN + 0.14], [R_OUT - 0.14, R_OUT]]) {
      quad(polar(ra, a0, y0 - 0.05), polar(ra, a1, y1 - 0.05), polar(ra, a1, y1 - 0.42), polar(ra, a0, y0 - 0.42), polar(-1, a0, 0), 1);
      quad(polar(rb, a0, y0 - 0.05), polar(rb, a1, y1 - 0.05), polar(rb, a1, y1 - 0.42), polar(rb, a0, y0 - 0.42), polar(1, a0, 0), 1);
      quad(polar(ra, a0, y0 - 0.42), polar(rb, a0, y0 - 0.42), polar(rb, a1, y1 - 0.42), polar(ra, a1, y1 - 0.42), new V3(0, -1, 0), 1);
    }
    // the toe plate and the two rails on the inside edge (not across the bridge)
    if (!inBridgeGap(a0) && !inBridgeGap(a1)) {
      quad(polar(R_IN + 0.02, a0, y0), polar(R_IN + 0.02, a1, y1), polar(R_IN + 0.02, a1, y1 + 0.12), polar(R_IN + 0.02, a0, y0 + 0.12), polar(1, a0, 0), 1);
      for (const [h, t] of [[1.05, 0.05], [0.55, 0.03]]) {
        const r = R_IN + 0.06;
        quad(polar(r - t, a0, y0 + h + t), polar(r + t, a0, y0 + h + t), polar(r + t, a1, y1 + h + t), polar(r - t, a1, y1 + h + t), UP, 1);
        quad(polar(r + t, a0, y0 + h - t), polar(r + t, a1, y1 + h - t), polar(r + t, a1, y1 + h + t), polar(r + t, a0, y0 + h + t), polar(1, a0, 0), 1);
        quad(polar(r - t, a0, y0 + h - t), polar(r - t, a1, y1 + h - t), polar(r - t, a1, y1 + h + t), polar(r - t, a0, y0 + h + t), polar(-1, a0, 0), 1);
        quad(polar(r - t, a0, y0 + h - t), polar(r + t, a0, y0 + h - t), polar(r + t, a1, y1 + h - t), polar(r - t, a1, y1 + h - t), new V3(0, -1, 0), 1);
      }
    }
    // by the openings the outside edge gets a rail too
    if (inWin(a0)) {
      const r = R_OUT - 0.06, h = 1.05, t = 0.05;
      quad(polar(r - t, a0, y0 + h + t), polar(r + t, a0, y0 + h + t), polar(r + t, a1, y1 + h + t), polar(r - t, a1, y1 + h + t), UP, 1);
      quad(polar(r - t, a0, y0 + h - t), polar(r - t, a1, y1 + h - t), polar(r - t, a1, y1 + h + t), polar(r - t, a0, y0 + h + t), polar(-1, a0, 0), 1);
      quad(polar(r + t, a0, y0 + h - t), polar(r + t, a1, y1 + h - t), polar(r + t, a1, y1 + h + t), polar(r + t, a0, y0 + h + t), polar(1, a0, 0), 1);
      if (s % 4 === 0) beam(polar(r, a0, y0), polar(r, a0, y0 + h), 0.05, 0.05, 1);
    }
    if (s % 4 === 0) {
      const mid = (a0 + a1) / 2;
      // a cross beam under the deck, and a bracket back to the wall between the pods
      beam(polar(R_IN, a0, y0 - 0.28), polar(R_OUT, a0, y0 - 0.28), 0.08, 0.22, 1);
      if (s % 8 === 0 && !inWin(a0)) { beam(polar(R_OUT, a0, y0 - 0.3), polar(R_WALL - 0.05, a0, y0 - 1.6), 0.1, 0.12, 1); }
      // posts on the inside rail, and on every fourth a small lamp facing the walk
      if (!inBridgeGap(a0)) {
        beam(polar(R_IN + 0.06, a0, y0), polar(R_IN + 0.06, a0, y0 + 1.1), 0.05, 0.05, 1);
        if (s % 16 === 0) box(polar(R_IN + 0.12, a0, y0 + 0.95), new V3(-Math.sin(a0), 0, Math.cos(a0)), UP, 0.07, 0.025, 0.03, 2);
        if (s % 32 === 8) box(polar(R_IN + 0.1, a0, y0 + 0.3), new V3(-Math.sin(a0), 0, Math.cos(a0)), UP, 0.012, 0.012, 0.012, 5);
      }
      void mid;
    }
  }
  // the bridge out to the platform (along +x, at the height of the turn), with its rails and the trusses under it
  {
    const x0 = R_PLAT1 - 0.05, x1 = R_IN + 0.05, w = BR_W;
    quad(new V3(x0, 0, -w), new V3(x1, 0, -w), new V3(x1, 0, w), new V3(x0, 0, w), UP, 0);
    quad(new V3(x0, -0.05, -w), new V3(x1, -0.05, -w), new V3(x1, -0.05, w), new V3(x0, -0.05, w), new V3(0, -1, 0), 0);
    for (const z of [-w, w]) {
      beam(new V3(x0, -0.25, z), new V3(x1, -0.25, z), 0.12, 0.4, 1);
      beam(new V3(x0, 1.05, z * 0.97), new V3(x1, 1.05, z * 0.97), 0.06, 0.06, 1);
      beam(new V3(x0, 0.55, z * 0.97), new V3(x1, 0.55, z * 0.97), 0.035, 0.035, 1);
      for (let x = x0 + 0.5; x < x1; x += 3) beam(new V3(x, 0, z * 0.97), new V3(x, 1.1, z * 0.97), 0.05, 0.05, 1);
      for (let x = 9; x <= 33; x += 6) box(new V3(x, 0.95, z * 0.9), new V3(1, 0, 0), UP, 0.07, 0.025, 0.03, 2);
    }
    for (let x = x0; x < x1 - 2; x += 2.5) { beam(new V3(x, -0.45, -w), new V3(x + 2.5, -1.6, 0), 0.06, 0.06, 1); beam(new V3(x, -0.45, w), new V3(x + 2.5, -1.6, 0), 0.06, 0.06, 1); }
    beam(new V3(x0, -1.6, 0), new V3(x1, -1.6, 0), 0.14, 0.14, 1);
  }
  // the platform round the cables, its rail (open toward the bridge) and lamps
  {
    const N = 64;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU, a1 = (i + 1) / N * TAU;
      quad(polar(R_PLAT0, a0, 0), polar(R_PLAT1, a0, 0), polar(R_PLAT1, a1, 0), polar(R_PLAT0, a1, 0), UP, 4);
      quad(polar(R_PLAT0, a0, -0.35), polar(R_PLAT1, a0, -0.35), polar(R_PLAT1, a1, -0.35), polar(R_PLAT0, a1, -0.35), new V3(0, -1, 0), 4);
      quad(polar(R_PLAT1, a0, 0), polar(R_PLAT1, a1, 0), polar(R_PLAT1, a1, -0.35), polar(R_PLAT1, a0, -0.35), polar(1, a0, 0), 1);
      quad(polar(R_PLAT0, a0, 0), polar(R_PLAT0, a1, 0), polar(R_PLAT0, a1, -0.35), polar(R_PLAT0, a0, -0.35), polar(-1, a0, 0), 1);
      const gap = Math.abs(wrapPi(a0)) < 0.14 || Math.abs(wrapPi(a1)) < 0.14;
      if (!gap) { beam(polar(R_PLAT1 - 0.06, a0, 1.05), polar(R_PLAT1 - 0.06, a1, 1.05), 0.05, 0.05, 1); beam(polar(R_PLAT1 - 0.06, a0, 0.55), polar(R_PLAT1 - 0.06, a1, 0.55), 0.03, 0.03, 1); }
      beam(polar(R_PLAT0 + 0.05, a0, 0.6), polar(R_PLAT0 + 0.05, a1, 0.6), 0.04, 0.04, 1);
      if (i % 2 === 0 && !gap) beam(polar(R_PLAT1 - 0.06, a0, 0), polar(R_PLAT1 - 0.06, a0, 1.1), 0.05, 0.05, 1);
      if (i % 8 === 4) box(polar(R_PLAT1 - 0.1, a0, 0.95), new V3(-Math.sin(a0), 0, Math.cos(a0)), UP, 0.07, 0.025, 0.03, 2);
      if (i % 4 === 0) { beam(polar(R_PLAT1, a0, -0.35), polar(R_PLAT0 - 0.1, a0, -2.4), 0.1, 0.1, 1); }
    }
    // collars round the bundle, one at the platform and one half a turn up
    for (const y of [-0.6, PITCH / 2]) for (let i = 0; i < 48; i++) { const a0 = i / 48 * TAU, a1 = (i + 1) / 48 * TAU; quad(polar(4.45, a0, y + 0.35), polar(4.45, a1, y + 0.35), polar(4.45, a1, y - 0.35), polar(4.45, a0, y - 0.35), polar(1, a0, 0), 1); }
  }
  // the cables hanging down the middle: straight through every turn, so they never end
  {
    const r2 = mulberry32(7);
    for (let c = 0; c < 46; c++) {
      const rr = Math.sqrt(r2()) * 3.9, aa = r2() * TAU, rad = 0.1 + r2() * r2() * 0.42, cx = Math.cos(aa) * rr, cz = Math.sin(aa) * rr, M = 8;
      for (let i = 0; i < M; i++) { const a0 = i / M * TAU, a1 = (i + 1) / M * TAU;
        quad(new V3(cx + Math.cos(a0) * rad, 0, cz + Math.sin(a0) * rad), new V3(cx + Math.cos(a1) * rad, 0, cz + Math.sin(a1) * rad), new V3(cx + Math.cos(a1) * rad, PITCH, cz + Math.sin(a1) * rad), new V3(cx + Math.cos(a0) * rad, PITCH, cz + Math.sin(a0) * rad), new V3(Math.cos(a0), 0, Math.sin(a0)), 3); }
    }
  }
}
const turnGeom = takeGeom();
const tower = new THREE.Group(); scene.add(tower);
const NT = TURNS * 2 + 1, turnMat4 = new THREE.Matrix4();
{
  const m = new THREE.InstancedMesh(turnGeom, metalMat, NT); m.frustumCulled = false;
  for (let k = -TURNS; k <= TURNS; k++) m.setMatrixAt(k + TURNS, turnMat4.makeTranslation(0, k * PITCH, 0));
  tower.add(m);
}

/* ---------------- the wall ---------------- */
{
  const g = new THREE.CylinderGeometry(R_WALL, R_WALL, PITCH * (NT + 1), 224, 1, true);
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `
    varying vec3 vW;
    void main(){
      float a = angOf(vW), u = mod(vW.y - helixL(a), PITCH);
      float win = abs(a - PI);
      if (win < ${WIN_WALL.toFixed(2)} && u > 0.4 && u < 9.6) discard;   // an opening: the field outside
      vec3 n = -normalize(vec3(vW.x, 0.0, vW.z));
      float col_ = a / ${DA.toFixed(5)}, fr = fract(col_);
      // black plates in courses, a rib between every two columns of pods, cables going up from each pod, and the sockets they sit in
      float course = mod(vW.y - helixL(a), ${ROW_H.toFixed(2)});
      float rib = smoothstep(0.06, 0.0, abs(fract(col_ + 0.5) - 0.5) - 0.0) ;
      float cable = smoothstep(0.035, 0.0, abs(fr - 0.5 - 0.06 * sin(vW.y * 0.7 + floor(col_))) - 0.03) * step(1.9, course);
      float seam = smoothstep(0.03, 0.0, abs(course - 0.15));
      float g = vnoise(vW * vec3(0.9, 2.5, 0.9)) * 0.5 + vnoise(vW * 6.0) * 0.5;
      vec3 alb = vec3(0.055, 0.052, 0.055) * (0.6 + 0.7 * g) * (1.0 - 0.5 * seam) * (1.0 - 0.6 * cable) + rib * 0.03;
      // the frame round the openings
      float frame = (win < ${(WIN_WALL + 0.03).toFixed(2)}) ? 1.0 : 0.0; alb = mix(alb, vec3(0.13), frame);
      vec3 c = lightAt(vW, n, alb, 0.4);
      // right behind each pod the wall glows with it
      float pr = length(vec2((fr - 0.5) * 2.2, (mod(course, ${ROW_H.toFixed(2)}) - 1.45) / 1.2));
      c += vec3(1.0, 0.2, 0.14) * 0.12 * smoothstep(1.0, 0.1, pr) * step(0.32, win) * pulseAt(vW.y, 0.0);
      gl_FragColor = vec4(haze(c, vW), 1.0);
    }` });
  tower.add(new THREE.Mesh(g, mat));
}

/* ---------------- the pods ---------------- */
// a capsule of glass, somebody curled up inside it, and the black cradle it hangs in
const SHELL_PTS = [[0, 0], [0.25, 0.03], [0.42, 0.12], [0.52, 0.34], [0.53, 1.2], [0.52, 1.98], [0.42, 2.2], [0.25, 2.29], [0, 2.32]];
const podShell = new THREE.LatheGeometry(SHELL_PTS.map(([r, y]) => new THREE.Vector2(r, y)), 12);
const podShellLo = new THREE.LatheGeometry([0, 2, 3, 5, 6, 8].map((i) => new THREE.Vector2(SHELL_PTS[i][0], SHELL_PTS[i][1])), 8);
const podBody = (() => {
  const parts = [], e = (sx, sy, sz, x, y, z, rx = 0, rz = 0) => { const g = new THREE.SphereGeometry(1, 6, 4); g.scale(sx, sy, sz); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
  e(0.2, 0.34, 0.17, 0, 1.2, 0.0, 0.45);          // the back, bent forward
  e(0.16, 0.14, 0.12, 0, 1.42, 0.06, 0.6);         // shoulders
  e(0.065, 0.1, 0.065, 0, 1.55, 0.13, 0.9);        // the neck
  e(0.115, 0.135, 0.125, 0, 1.64, 0.2, 0.7);       // the head, down on the chest
  e(0.19, 0.16, 0.17, 0, 0.98, 0.0, 0.2);          // hips
  e(0.09, 0.3, 0.09, -0.1, 1.05, 0.22, -1.25);     // thighs, drawn up
  e(0.09, 0.3, 0.09, 0.1, 1.05, 0.22, -1.2);
  e(0.07, 0.27, 0.07, -0.1, 0.78, 0.38, 0.25);     // shins
  e(0.07, 0.27, 0.07, 0.1, 0.8, 0.38, 0.2);
  e(0.06, 0.24, 0.06, -0.15, 1.25, 0.25, -0.6, 0.3); // arms round the knees
  e(0.06, 0.24, 0.06, 0.15, 1.25, 0.25, -0.6, -0.3);
  for (const p of parts) { p.deleteAttribute('uv'); }
  return mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p));
})();
const podCradle = (() => {
  const parts = [];
  const add = (g, k) => parts.push(kindGeom(g, k));
  { const g = new THREE.BoxGeometry(1.2, 2.7, 0.14); g.translate(0, 1.16, -0.66); add(g, 1); }
  for (const x of [-0.6, 0.6]) { const g = new THREE.BoxGeometry(0.1, 2.6, 0.32); g.translate(x, 1.16, -0.45); add(g, 1); }
  for (const y of [0.34, 1.98]) { const g = new THREE.TorusGeometry(0.535, 0.06, 4, 14); g.rotateX(Math.PI / 2); g.translate(0, y, 0); add(g, 1); }
  { const g = new THREE.CylinderGeometry(0.34, 0.5, 0.26, 12); g.translate(0, 2.42, -0.05); add(g, 1); }
  { const g = new THREE.CylinderGeometry(0.3, 0.42, 0.22, 12); g.translate(0, -0.08, 0); add(g, 1); }
  { const g = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6); g.rotateX(-0.9); g.translate(0, 2.8, -0.35); add(g, 3); }   // the feed, up into the wall
  { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6); g.rotateX(0.8); g.translate(0.18, -0.25, -0.3); add(g, 3); }
  { const g = new THREE.BoxGeometry(0.05, 0.05, 0.02); g.translate(0.45, 2.5, 0.2); add(g, 5); }   // a pilot light
  return mergeGeometries(parts);
})();
// further off, the same in far fewer pieces
const podBodyLo = (() => {
  const parts = [], e = (sx, sy, sz, x, y, z, rx = 0) => { const g = new THREE.SphereGeometry(1, 5, 3); g.scale(sx, sy, sz); g.rotateX(rx); g.translate(x, y, z); g.deleteAttribute('uv'); parts.push(g.toNonIndexed()); };
  e(0.22, 0.4, 0.19, 0, 1.15, 0.05, 0.45); e(0.12, 0.14, 0.13, 0, 1.63, 0.19, 0.7); e(0.16, 0.32, 0.12, 0, 1.0, 0.3, -1.2);
  return mergeGeometries(parts);
})();
const podCradleLo = (() => {
  const parts = [], add = (g, k) => parts.push(kindGeom(g, k));
  { const g = new THREE.BoxGeometry(1.2, 2.7, 0.14); g.translate(0, 1.16, -0.66); add(g, 1); }
  for (const y of [0.34, 1.98]) { const g = new THREE.TorusGeometry(0.535, 0.06, 3, 8); g.rotateX(Math.PI / 2); g.translate(0, y, 0); add(g, 1); }
  { const g = new THREE.CylinderGeometry(0.34, 0.5, 0.26, 6); g.translate(0, 2.42, -0.05); add(g, 1); }
  { const g = new THREE.CylinderGeometry(0.3, 0.42, 0.22, 6); g.translate(0, -0.08, 0); add(g, 1); }
  return mergeGeometries(parts);
})();
// where every pod goes, in the turns drawn: those near you (drawn in full) and the rest
const podMats = [], podAttr = [], podMatsLo = [], podAttrLo = [];
{
  const o = new THREE.Object3D();
  for (let k = -TURNS; k <= TURNS; k++) for (let j = 0; j < ROWS; j++) for (let i = 0; i < NP; i++) {
    const a = podAngle(j, i) % TAU; if (Math.abs(a - WIN_A) < WIN_POD) continue;
    const y = k * PITCH + helix(a) + 0.3 + j * ROW_H;
    o.position.set(Math.cos(a) * R_POD, y, Math.sin(a) * R_POD); o.rotation.set(0, 0, 0);
    o.lookAt(0, y, 0); o.rotateX(-0.1); o.updateMatrix();
    const near = Math.abs(k) <= NEAR, r = rnd();
    (near ? podMats : podMatsLo).push(o.matrix.clone());
    (near ? podAttr : podAttrLo).push(rnd(), r < 0.045 ? 1 : 0, k, j * NP + i);   // a pulse of its own, dead or not, which turn, which pod
  }
}
const POD_VERT = `
attribute vec4 aP; varying vec3 vW, vN, vL; varying vec4 vP;
uniform float uPose, uTime;
void main(){
  // (the sleepers: each turned and tipped a little its own way, and breathing)
  float ry = (aP.x - 0.5) * 2.4 * uPose, rz = (fract(aP.x * 7.13) - 0.5) * 0.5 * uPose, cy = cos(ry), sy = sin(ry), cz = cos(rz), sz = sin(rz);
  vec3 q = position - vec3(0.0, 1.15, 0.12) * uPose; q *= 1.0 + 0.015 * uPose * sin(uTime * 1.3 + aP.x * 40.0);
  q = vec3(cz * q.x - sz * q.y, sz * q.x + cz * q.y, q.z); q = vec3(cy * q.x + sy * q.z, q.y, -sy * q.x + cy * q.z); q += vec3(0.0, 1.15, 0.0) * uPose;
  vec3 nn = normal; nn = vec3(cz * nn.x - sz * nn.y, sz * nn.x + cz * nn.y, nn.z); nn = vec3(cy * nn.x + sy * nn.z, nn.y, -sy * nn.x + cy * nn.z);
  vec4 w = modelMatrix * instanceMatrix * vec4(q, 1.0); vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * nn);
  vW = w.xyz; vL = position; vP = aP;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const isEmpty = `bool emptyOne(){ return abs(vP.z + uTurn) < 0.5 && abs(vP.w - ${EMPTY_ID.toFixed(1)}) < 0.5; }`;
// The glow is drawn on the inside of the far half of the glass (so whoever is in there stands dark against it), and the near half only
// tints it a little and catches the light at its edge.
const shellFrag = (back) => COMMON + `varying vec3 vW, vN, vL; varying vec4 vP; ${isEmpty}
  void main(){
    if (emptyOne()) discard;
    vec3 v = normalize(cameraPosition - vW), n = normalize(vN); float f = abs(dot(n, v));
    float dead = vP.y, p = pulseAt(vW.y, vP.x * 0.12);
    // the fluid: deep red, murky, thick with drifting specks, brighter low down where the light is, darker toward the top
    float murk = 0.65 + 0.35 * vnoise(vL * vec3(7.0, 3.0, 7.0) + vec3(0.0, uTime * 0.12 + vP.x * 9.0, 0.0)) - 0.25 * smoothstep(0.75, 0.95, vnoise(vL * 22.0 + vec3(0.0, uTime * 0.3, vP.x * 5.0)));
    vec3 tint = mix(vec3(1.0, 0.13, 0.085), vec3(0.1, 0.17, 0.14), dead) * mix(p, 0.5, dead) * murk * (0.55 + 0.45 * smoothstep(2.2, 0.6, vL.y)) * (1.0 - 0.5 * smoothstep(0.45, 0.0, vL.y));
    vec3 glow = ${back} ? tint * (0.04 + 0.62 * pow(f, 2.5)) : tint * 0.04 + vec3(1.0, 0.62, 0.56) * pow(1.0 - f, 5.0) * 0.1;
    gl_FragColor = vec4(glow * seeThrough(vW), 1.0);
  }`;
const shellMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uPose: { value: 0 } }, U), vertexShader: POD_VERT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fragmentShader: shellFrag('true') });
const glassMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uPose: { value: 0 } }, U), vertexShader: POD_VERT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fragmentShader: shellFrag('false') });
const bodyMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uPose: { value: 1 } }, U), vertexShader: POD_VERT,
  fragmentShader: COMMON + `varying vec3 vW, vN, vL; varying vec4 vP; ${isEmpty}
  void main(){
    if (emptyOne()) discard;
    vec3 v = normalize(cameraPosition - vW), n = normalize(vN);
    float rim = pow(1.0 - abs(dot(n, v)), 2.0);
    vec3 c = mix(vec3(0.5, 0.09, 0.06), vec3(0.06, 0.08, 0.07), vP.y) * (0.01 + 0.22 * rim * rim) * pulseAt(vW.y, vP.x * 0.12);
    gl_FragColor = vec4(haze(c, vW), 1.0);
  }` });
const cradleMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: metalMat.fragmentShader });
cradleMat.extensions.derivatives = true;
function podMesh(geom, mat, order, mats, attr) {
  const m = new THREE.InstancedMesh(geom, mat, mats.length); m.frustumCulled = false; m.renderOrder = order;
  mats.forEach((M, i) => m.setMatrixAt(i, M));
  if (mat !== cradleMat) geom.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(attr), 4));
  tower.add(m); return m;
}
for (const [cr, bo, sh, M, A] of [[podCradle, podBody, podShell, podMats, podAttr], [podCradleLo, podBodyLo, podShellLo, podMatsLo, podAttrLo]]) {
  podMesh(cr, cradleMat, 0, M, A); podMesh(bo, bodyMat, 0, M, A); podMesh(sh, shellMat, 2, M, A); podMesh(sh, glassMat, 3, M, A);
}

/* ---------------- the open pod: yours ---------------- */
const EMPTY = (() => {
  const a = podAngle(EMPTY_ROW, EMPTY_I), y = helix(a) + 0.3;
  const g = new THREE.Group(); g.position.set(Math.cos(a) * R_POD, y, Math.sin(a) * R_POD); g.lookAt(0, y, 0); g.rotateX(-0.1); scene.add(g);
  const pts = [[0, 0], [0.25, 0.03], [0.42, 0.12], [0.52, 0.34], [0.53, 1.2], [0.52, 1.98], [0.42, 2.2], [0.25, 2.29], [0, 2.32]].map(([r, yy]) => new THREE.Vector2(r, yy));
  // the back half stays; the front half has swung open on its hinge
  const back = new THREE.LatheGeometry(pts, 10, Math.PI / 2, Math.PI), front = new THREE.LatheGeometry(pts, 10, -Math.PI / 2, Math.PI);
  front.translate(-0.53, 0, 0);   // hung on its hinge (lidPivot, below): shut while you wake in it, swung open after
  const inside = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: `varying vec3 vW, vN, vL; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `varying vec3 vW, vN, vL;
    void main(){
      vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
      // wet, dark glass, with what is left of the fluid still glowing in the bottom, and runs of it down the inside
      float runs = smoothstep(0.6, 1.0, vnoise(vec3(vL.x * 14.0, vL.y * 1.5, vL.z * 14.0)));
      vec3 c = lightAt(vW, n, vec3(0.05, 0.04, 0.045), 1.6);
      c += vec3(1.0, 0.3, 0.22) * (0.5 * smoothstep(0.42, 0.05, vL.y) + 0.06 * runs) * (0.7 + 0.3 * pulseAt(vW.y, 0.0));
      gl_FragColor = vec4(haze(c, vW), 1.0);
    }` });
  g.add(new THREE.Mesh(back, inside));
  // the lid: glass, smeared on the inside, red while the pod is full
  const uFill = { value: 0 };
  const glass = new THREE.ShaderMaterial({ uniforms: Object.assign({ uFill }, U), side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW, vN, vL; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `uniform float uFill; varying vec3 vW, vN, vL;
    void main(){
      vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float f = abs(dot(n, v));
      float smear = smoothstep(0.45, 0.9, vnoise(vec3(vL.x * 9.0, vL.y * 2.2, vL.z * 9.0))), runs = smoothstep(0.7, 1.0, vnoise(vec3(vL.x * 30.0, vL.y * 0.8, vL.z * 30.0)));
      vec3 c = vec3(1.0, 0.24, 0.18) * (0.05 + 0.25 * uFill) * (0.6 + 0.4 * pulseAt(vW.y, 0.0)) + vec3(1.0, 0.75, 0.7) * pow(1.0 - f, 4.0) * 0.18 + vec3(0.25, 0.08, 0.07) * (smear * 0.25 + runs * 0.3);
      gl_FragColor = vec4(c * seeThrough(vW), 0.16 + 0.3 * pow(1.0 - f, 2.0) + 0.25 * smear + 0.2 * uFill);
    }` });
  const lidPivot = new THREE.Group(); lidPivot.position.set(0.53, 0, 0); lidPivot.rotation.y = -1.95; g.add(lidPivot);
  const lid = new THREE.Mesh(front, glass); lid.renderOrder = 4; lidPivot.add(lid);
  // the tube that fed it, pulled out, hanging (when you wake here, the one you pull out yourself takes its place)
  let hanging;
  { const c = new THREE.CatmullRomCurve3([new V3(0, 2.45, -0.2), new V3(0.15, 2.2, 0.3), new V3(0.3, 1.2, 0.55), new V3(0.25, 0.4, 0.62), new V3(0.4, 0.05, 0.8)]);
    hanging = new THREE.Mesh(kindGeom(new THREE.TubeGeometry(c, 30, 0.045, 6), 3), metalMat); g.add(hanging); }
  // a puddle on the walkway in front of it
  const pa = a + 0.006, pr = (R_IN + R_OUT) / 2 + 0.6;
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; varying vec2 vU; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vU = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `varying vec3 vW; varying vec2 vU;
    void main(){
      float r = length(vU * vec2(1.0, 1.6)) + (vnoise(vec3(vU * 3.0, 1.0)) - 0.5) * 0.5; if (r > 0.95) discard;
      vec3 c = lightAt(vW, vec3(0.0, 1.0, 0.0), vec3(0.004), 0.9) + vec3(0.03, 0.004, 0.003) * pulseAt(vW.y, 0.0);
      gl_FragColor = vec4(haze(c, vW), smoothstep(0.95, 0.6, r) * 0.6);
    }` }));
  pud.rotation.x = -Math.PI / 2; pud.scale.set(1.1, 1.1, 1); pud.position.copy(polar(pr, pa, helix(pa) + 0.012)); pud.rotation.z = -pa; pud.renderOrder = 1; scene.add(pud);
  return { a, y, group: g, lidPivot, uFill, hanging, pud };
})();

/* ---------------- outside: the field of towers, and the sky ---------------- */
const FAR = { towers: null, sky: null };
{
  const list = [], r = mulberry32(42);
  while (list.length < 90) {
    const a = r() * TAU, d = 170 + Math.pow(r(), 0.7) * 3200, rad = 26 + r() * 34, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (list.every((t) => Math.hypot(t[0] - x, t[1] - z) > t[2] + rad + 120)) list.push([x, z, rad]);
  }
  const g = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
  const mat = new THREE.ShaderMaterial({ uniforms: U, fog: false,
    vertexShader: `varying vec3 vW, vC; varying float vR; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vR = length(instanceMatrix[0].xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `varying vec3 vW, vC; varying float vR;
    void main(){
      vec2 rel = vW.xz - vC.xz; float an = atan(rel.y, rel.x);
      // black, studded all over with small pink lights: a pod behind each
      vec2 cell = vec2(an * vR / 2.3, vW.y / 2.6); cell.x += 0.5 * mod(floor(cell.y), 2.0);
      vec2 id = floor(cell), f = fract(cell) - 0.5; float h = hash2(id + vC.xz * 0.01);
      float dotv = smoothstep(0.26, 0.08, length(f * vec2(1.0, 0.75)));
      float fw = max(fwidth(cell.x), fwidth(cell.y)); dotv = mix(dotv, 0.06, smoothstep(0.08, 0.5, fw));   // far off they blur into a glow
      // in bands that wind up the tower, black ribs between, so that even far off it reads as a tower and not a red pillar
      float bandU = fract((vW.y + an * vR * 0.25) / 11.0), band = smoothstep(0.0, 0.04, bandU) * smoothstep(0.62, 0.58, bandU);
      float rib = smoothstep(0.0, 0.06, abs(fract(an * 12.0 / 6.2831853) - 0.5) - 0.04);
      dotv *= band * mix(1.0, rib, 0.8);
      vec3 c = vec3(1.0, 0.18, 0.12) * dotv * step(0.05, h) * pulseAt(vW.y, h * 0.2) * 1.6;   // (kept under the glow threshold: thousands of them would bloom into one smear)
      vec3 n = normalize(vec3(rel.x, 0.0, rel.y)), v = normalize(cameraPosition - vW);
      c += vec3(0.006, 0.005, 0.006) + vec3(0.5, 0.6, 0.95) * uFlash * (0.005 + 0.22 * pow(1.0 - abs(dot(n, v)), 4.0));   // black against the flash, lit at the edges
      float d = length(vW - cameraPosition);
      vec3 sky = mix(vec3(0.03, 0.009, 0.008), vec3(0.014, 0.014, 0.019), smoothstep(-0.2, 0.4, (vW.y - cameraPosition.y) / d)) + vec3(0.35, 0.4, 0.6) * uFlash * 0.18;
      gl_FragColor = vec4(mix(c, sky + vec3(0.6, 0.65, 0.9) * uBolt * 0.25, 1.0 - exp(-d * 0.0011)), 1.0);   // (the rain hangs between them)
    }` });
  const m = new THREE.InstancedMesh(g, mat, list.length); m.frustumCulled = false;
  const M = new THREE.Matrix4();
  list.forEach((t, i) => { M.makeScale(t[2], 4000, t[2]); M.setPosition(t[0], 0, t[1]); m.setMatrixAt(i, M); });
  scene.add(m); FAR.towers = m;
  // the sky: low cloud lit from below by all those lights, and from inside by the flashes; straight up or down, the same haze as in here
  const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 48, 24), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: COMMON + `varying vec3 vW;
    void main(){
      vec3 d = normalize(vW - cameraPosition);
      float cl = vnoise(d * 6.0 + vec3(uTime * 0.01, 0.0, 0.0)) * 0.6 + vnoise(d * 15.0) * 0.3 + vnoise(d * 40.0) * 0.1;
      vec3 c = mix(vec3(0.03, 0.009, 0.008), vec3(0.012, 0.012, 0.016) * (0.5 + 1.0 * cl), smoothstep(-0.15, 0.35, d.y));
      c += vec3(0.55, 0.62, 0.95) * uFlash * (0.25 + smoothstep(0.3, 0.85, cl)) * smoothstep(-0.25, 0.3, d.y) * 1.3;
      // curtains of rain sweeping across, seen best in the flashes
      float az = atan(d.z, d.x), sheet = vnoise(vec3(az * 7.0 + uTime * 0.35, d.y * 2.0 + uTime * 1.8, 3.0)) * vnoise(vec3(az * 60.0, d.y * 9.0 + uTime * 14.0, 1.0));
      c += vec3(0.05, 0.05, 0.06) * sheet * (0.4 + 3.0 * uFlash);
      // the bolt: from the cloud down into the dark below, crooked, with a branch
      if (uBolt > 0.001 && d.y < 0.5 && d.y > -0.35) {
        float e = d.y, off = 0.0, amp = 0.07;
        for (int i = 0; i < 6; i++) { off += (vnoise(vec3(e * 9.0 * pow(2.1, float(i)), uBoltS * 7.0, float(i) * 3.1)) - 0.5) * amp; amp *= 0.56; }
        float dx = abs(mod(az - uBoltA - off + PI, TAU) - PI);
        float br = 0.0; if (e < 0.25 && e > 0.02) { float bo = off + (0.25 - e) * (0.5 + 0.6 * hash1(uBoltS)) * sign(hash1(uBoltS + 1.0) - 0.5) + (vnoise(vec3(e * 40.0, uBoltS, 9.0)) - 0.5) * 0.03; br = abs(mod(az - uBoltA - bo + PI, TAU) - PI); br = smoothstep(0.003, 0.0, br) * smoothstep(0.02, 0.1, e) * 0.6; }
        float core = smoothstep(0.0035, 0.0, dx), glow = exp(-dx * 45.0);
        c += vec3(0.85, 0.88, 1.0) * (core * 9.0 + br * 6.0 + glow * 0.8) * uBolt * smoothstep(-0.35, -0.2, e) * smoothstep(0.5, 0.42, e);
      }
      c = mix(c, hazeCol(d), smoothstep(0.45, 0.75, abs(d.y)));
      gl_FragColor = vec4(c, 1.0);
    }` }));
  sky.renderOrder = -10; scene.add(sky); FAR.sky = sky;
}

/* ---------------- rain ---------------- */
// Thousands of streaks in a box round you, falling hard and blown a little: down the shaft, through the light of the pods (red near the
// wall), past the lamps, and outside beyond the openings; every flash lights all of them at once.
{
  const N = 16000, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  const seed = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) seed[i] = rnd();
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aS; uniform float uTime; varying vec3 vW; varying float vU, vK;
    void main(){
      const float BOX = 30.0, H = 24.0, SPD = 24.0;
      vec3 c = cameraPosition;
      vec3 axis = normalize(vec3(0.1, -1.0, 0.04));
      float y = c.y + mod(aS.z * H - uTime * SPD * (0.85 + 0.3 * aS.w) - c.y, H) - H * 0.5;
      float fall = (c.y + H * 0.5 - y);                                    // (blown sideways as it falls)
      float x = c.x + mod(aS.x * BOX + fall * 0.1 - c.x, BOX) - BOX * 0.5, z = c.z + mod(aS.y * BOX + fall * 0.04 - c.z, BOX) - BOX * 0.5;
      vec3 p = vec3(x, y, z); float len = 0.45 + aS.w * 0.55;
      vec3 side = normalize(cross(axis, normalize(c - p)));
      float d = length(c - p);
      vec3 w = p + axis * len * position.y + side * position.x * (0.005 + d * 0.0009);
      vW = w; vU = position.y; vK = aS.w;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }`,
    fragmentShader: COMMON + `varying vec3 vW; varying float vU, vK;
    void main(){
      float r = length(vW.xz), a = angOf(vW);
      bool outside = r > ${R_WALL.toFixed(1)};
      vec3 c = outside ? vec3(0.02, 0.018, 0.02) : vec3(1.0, 0.24, 0.17) * 0.22 * smoothstep(8.0, 38.0, r) * pulseAt(vW.y, 0.0) + vec3(0.03, 0.03, 0.035);
      // the lamp on the rail nearest it
      { float LS = TAU / 16.0, al = floor(a / LS + 0.5) * LS; vec3 lp = vec3(cos(al) * ${(R_IN + 0.12).toFixed(2)}, 0.0, sin(al) * ${(R_IN + 0.12).toFixed(2)}); lp.y = deckAt(mod(al, TAU), vW.y - 0.95) + 0.95;
        vec3 L = lp - vW; c += vec3(0.75, 0.86, 1.0) * 0.7 / (1.0 + dot(L, L) * 1.5); }
      c += vec3(0.6, 0.68, 1.0) * (uFlash * (outside ? 0.35 : 0.2 + 0.35 * nearWindow(a)) + uBolt * 0.15);
      float k = smoothstep(0.0, 0.25, vU) * smoothstep(1.0, 0.6, vU) * (0.5 + 0.5 * vK);
      gl_FragColor = vec4(c * k * 0.55 * seeThrough(vW), 1.0);
    }` });
  const rain = new THREE.Mesh(g, mat); rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);
}

/* ---------------- post ---------------- */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.55); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uPod: { value: 0 }, uLid: { value: 0 }, uJolt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uPod, uLid, uJolt; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    // under the fluid (uPod): the picture wavers and blurs, everything goes the red of the pod, specks drift up past your eyes
    vec2 uv = vUv + uPod * 0.006 * vec2(sin(vUv.y * 23.0 + uTime * 1.7) + 0.5 * sin(vUv.y * 61.0 - uTime * 2.3), cos(vUv.x * 19.0 + uTime * 1.3));
    vec2 c = uv - 0.5; float r2 = dot(c, c); vec2 d = c * (0.001 + r2 * 0.008) * (1.0 + 3.0 * uPod + 6.0 * uJolt);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 5; i++) { vec2 o = uPod * 0.0045 * vec2(cos(float(i) * 2.4), sin(float(i) * 2.4)) * float(i > 0);
      col += vec3(texture2D(tDiffuse, uv - d + o).r, texture2D(tDiffuse, uv + o).g, texture2D(tDiffuse, uv + d + o).b); }
    col *= 0.2;
    col = mix(col, col * vec3(1.15, 0.36, 0.28) + vec3(0.05, 0.004, 0.002), uPod);
    { vec2 g = vec2(vUv.x * 40.0, vUv.y * 22.0 - uTime * 0.6); vec2 id = floor(g); float h = hash(id); vec2 f = fract(g) - vec2(0.5 + 0.3 * sin(uTime + h * 9.0), 0.5);
      col += vec3(0.5, 0.1, 0.07) * smoothstep(0.08, 0.0, length(f * vec2(1.0, 1.6))) * step(0.9, h) * uPod; }
    col += vec3(1.0, 0.85, 0.8) * uJolt * 0.35;
    col *= 1.0 - smoothstep(0.08 - 0.06 * uPod, 0.7, r2) * (0.6 + 0.3 * uPod);
    // eyelids: closed from top and bottom, a soft blurred edge
    float lidY = abs(vUv.y - 0.5) * 2.0, open = 1.3 * (1.0 - uLid); col *= smoothstep(open + 0.02, open - 0.25, lidY + 0.15 * uLid * (c.x * c.x * 4.0));
    col += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(613.0, 271.0)) - 0.5) * 0.05;
    gl_FragColor = vec4(max(col, 0.0) * (1.0 - uFade), 1.0);
  }`,
});
composer.addPass(grade);
addEventListener('resize', () => {
  renderer.setPixelRatio(pickPR()); renderer.setSize(innerWidth, innerHeight, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

/* ---------------- you ---------------- */
// Where you can stand: the walkway (a ring, its height set by how far round you have come: P.th counts the turns), the bridge strip and
// the platform (flat, at the height of the turn the bridge belongs to: P.k).
const EYE = 1.62, WALK = 1.55, RUN = 4.6, GRAV = 9.8, JUMP = 3.6, BODY = 0.3;
const P = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, ground: true, bob: 0, th: 0, k: 0 };
{
  const a = EMPTY.a + 0.045, r = 35.55; P.th = a; P.pos.set(Math.cos(a) * r, helix(a), Math.sin(a) * r);
  const t = new V3(-Math.sin(a), 0, Math.cos(a)), inw = new V3(-Math.cos(a), 0, -Math.sin(a)), d = t.multiplyScalar(0.62).addScaledVector(inw, 0.78).normalize();
  P.yaw = Math.atan2(-d.x, -d.z); P.pitch = -0.05;
}
const onRamp = (r) => r >= R_IN - 0.01;
function canStand(x, z) {
  const r = Math.hypot(x, z);
  if (r >= R_IN + BODY && r <= R_OUT - BODY) return true;                                  // the walkway
  if (x > R_PLAT1 - 0.4 && x < R_OUT - BODY && Math.abs(z) <= BR_W - BODY) return true;      // the bridge
  if (r >= R_PLAT0 + BODY + 0.1 && r <= R_PLAT1 - BODY) return true;                          // the platform
  return false;
}
// blocked by a curved edge (the rails of the walkway or of the platform): the same angle, pulled back in to the edge
function slideRound(x, z) {
  const r = Math.hypot(x, z); if (r < 1e-3) return null;
  for (const [lo, hi] of [[R_IN + BODY, R_OUT - BODY], [R_PLAT0 + BODY + 0.1, R_PLAT1 - BODY]]) {
    if (r > lo - 0.6 && r < hi + 0.6) { const rr = clamp(r, lo + 1e-4, hi - 1e-4), px = x / r * rr, pz = z / r * rr; if (canStand(px, pz)) return [px, pz]; }
  }
  return null;
}
function groundAt(x, z) {
  const r = Math.hypot(x, z);
  if (onRamp(r)) return P.th / TAU * PITCH;
  return P.k * PITCH;
}
const keys = Object.create(null);
let dragging = false;
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('mousedown', () => {
  initAudio();
  if (!locked()) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { dragging = true; }); } catch (err) { dragging = true; } }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (INTRO.on) return;   // (your head is not yours yet)
  if (!locked() && !dragging) return;
  const sk = 0.0022 * (window.SCF_SETTINGS ? window.SCF_SETTINGS.get('sens') : 1);
  P.yaw -= (e.movementX || 0) * sk; P.pitch = clamp(P.pitch - (e.movementY || 0) * sk, -1.5, 1.5);
});
addEventListener('keydown', (e) => { keys[e.code] = true; initAudio(); if (e.code === 'Space') e.preventDefault(); if (e.code === 'KeyE' && !e.repeat && INTRO.on) pushLid(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dragging = false; });
function step(dt) {
  if (keys.ArrowLeft) P.yaw += 1.8 * dt; if (keys.ArrowRight) P.yaw -= 1.8 * dt;
  if (keys.ArrowUp) P.pitch = Math.min(1.5, P.pitch + 1.3 * dt); if (keys.ArrowDown) P.pitch = Math.max(-1.5, P.pitch - 1.3 * dt);
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); const il = Math.hypot(fw, st); if (il > 1) { fw /= il; st /= il; }
  const spd = keys.ShiftLeft || keys.ShiftRight ? RUN : WALK, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const wx = (-sy * fw + cy * st) * spd, wz = (-cy * fw - sy * st) * spd, k = 1 - Math.exp(-(P.ground ? 10 : 2) * dt);
  P.vel.x += (wx - P.vel.x) * k; P.vel.z += (wz - P.vel.z) * k;
  // across the floor: slide along whatever edge stops you
  const ox = P.pos.x, oz = P.pos.z, nx = ox + P.vel.x * dt, nz = oz + P.vel.z * dt;
  const rc = slideRound(nx, nz);
  if (canStand(nx, nz)) { P.pos.x = nx; P.pos.z = nz; }
  else if (rc) { P.pos.x = rc[0]; P.pos.z = rc[1]; }   // along the curve of the rail
  else if (canStand(nx, oz)) { P.pos.x = nx; P.vel.z = 0; }
  else if (canStand(ox, nz)) { P.pos.z = nz; P.vel.x = 0; }
  else { P.vel.x = P.vel.z = 0; }
  // keep count of the turns
  const r0 = Math.hypot(ox, oz), r1 = Math.hypot(P.pos.x, P.pos.z), a = ang(P.pos.x, P.pos.z);
  if (onRamp(r1)) { if (!onRamp(r0)) P.th = P.k * TAU + wrapPi(a); else P.th += wrapPi(a - ((P.th % TAU) + TAU) % TAU); }
  else if (onRamp(r0)) P.k = Math.round(P.th / TAU);
  // up and down
  const g = groundAt(P.pos.x, P.pos.z);
  if (keys.Space && P.ground) { P.vel.y = JUMP; P.ground = false; }
  if (P.ground) { P.pos.y = g; P.vel.y = 0; }
  else { P.vel.y -= GRAV * dt; P.pos.y += P.vel.y * dt; if (P.pos.y <= g) { if (P.vel.y < -2.5) footstep(1.4); P.pos.y = g; P.vel.y = 0; P.ground = true; } }
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.ground && hs > 0.3) { const b0 = P.bob; P.bob += hs * dt; if (Math.floor(b0 / 0.72) !== Math.floor(P.bob / 0.72)) footstep(hs > 3 ? 1.0 : 0.6); }
}
function placeCamera() {
  const hs = Math.hypot(P.vel.x, P.vel.z);
  camera.position.set(P.pos.x, P.pos.y + EYE + Math.sin(P.bob * Math.PI * 2 / 1.44) * 0.022 * clamp(hs / 2, 0, 1), P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0); camera.updateMatrixWorld();
}

/* ---------------- sound ---------------- */
let AC = null, out = null, verb = null, wind = null, muffle = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx();
    // (everything goes through muffle: a low-pass, closed down while your ears are under the fluid in the pod)
    muffle = AC.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = INTRO.on ? 320 : 20000; muffle.Q.value = 0.5; muffle.connect(AC.destination);
    out = AC.createGain(); out.gain.value = 0; out.connect(muffle); out.gain.setTargetAtTime(1, AC.currentTime, INTRO.on ? 0.5 : 3);
    verb = AC.createConvolver(); const len = AC.sampleRate * 6, ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.12; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
    verb.buffer = ir; const vg = AC.createGain(); vg.gain.value = 0.8; verb.connect(vg); vg.connect(out);
    // the hum of the place: low tones beating against each other
    for (const [f, g0] of [[41, 0.045], [41.3, 0.045], [61.5, 0.015], [123.2, 0.004]]) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.value = g0; o.connect(g); g.connect(out); o.start(); }
    // air moving in the shaft, louder by the openings
    const n = AC.sampleRate * 4, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    wind = AC.createGain(); wind.gain.value = 0.12; src.connect(lp); lp.connect(wind); wind.connect(out); wind.connect(verb); src.start();
    // the rain: a roar, a hiss, and the drumming of it on all that steel; the roll of thunder that never quite stops
    {
      const sec = 5, n2 = AC.sampleRate * sec, mk = (fill) => { const b2 = AC.createBuffer(2, n2, AC.sampleRate); for (let c = 0; c < 2; c++) fill(b2.getChannelData(c)); return b2; };
      const loop = (buf2, type, fq, q, gain, toVerb) => { const s2 = AC.createBufferSource(); s2.buffer = buf2; s2.loop = true; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = fq; fl.Q.value = q; const g2 = AC.createGain(); g2.gain.value = gain; s2.connect(fl); fl.connect(g2); g2.connect(out); if (toVerb) { const w2 = AC.createGain(); w2.gain.value = toVerb; g2.connect(w2); w2.connect(verb); } s2.start(); return g2; };
      const white = mk((d2) => { for (let i = 0; i < n2; i++) d2[i] = Math.random() * 2 - 1; });
      const ticks = mk((d2) => { for (let i = 0; i < n2; i++) d2[i] = 0; for (let k = 0; k < sec * 2600; k++) { const at = Math.floor(Math.random() * (n2 - 300)), a2 = Math.random() * Math.random(); for (let j = 0; j < 300; j++) d2[at + j] += (Math.random() * 2 - 1) * a2 * Math.exp(-j / 40); } });
      const brown = mk((d2) => { let b3 = 0; for (let i = 0; i < n2; i++) { b3 = (b3 + 0.02 * (Math.random() * 2 - 1)) / 1.02; d2[i] = b3 * 4; } });
      RAIN.roar = loop(white, 'lowpass', 900, 0.3, 0.16, 0.3);
      RAIN.hiss = loop(white, 'highpass', 4500, 0.3, 0.035, 0);
      RAIN.drum = loop(ticks, 'bandpass', 2600, 0.7, 0.5, 0.4);
      RAIN.roll = loop(brown, 'lowpass', 90, 0.5, 0.5, 0.2);
    }
    sirenStart();
  } catch (e) { AC = null; }
}
function noiseBurst(dur, type, f, q, gain, toVerb, at) {
  if (!AC || AC.state !== 'running') return;
  const t = (at || AC.currentTime), len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const s = AC.createBufferSource(); s.buffer = buf; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = AC.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(out); if (toVerb) { const w = AC.createGain(); w.gain.value = toVerb; fl.connect(w); w.connect(verb); } s.start(t);
}
function footstep(k) {   // on steel grating: a dull clank that rings a little
  if (!AC || AC.state !== 'running') return;
  noiseBurst(0.06, 'bandpass', 900 + Math.random() * 500, 1.5, 0.12 * k, 0.25);
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = 340 + Math.random() * 120;
  g.gain.setValueAtTime(0.012 * k, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(out); g.connect(verb); o.start(t); o.stop(t + 0.3);
}
function thump(f, gain) {   // the heartbeat everything here beats to, felt more than heard
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
}
function thunder(delay, k, close) {
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime + delay, sec = close ? 7 : 5, len = Math.floor(AC.sampleRate * sec), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let b = 0;
  // the roll: bursts that come and go as the sound arrives from all along the bolt
  const bumps = []; for (let i = 0; i < 6; i++) bumps.push([Math.random() * 0.7, 0.04 + Math.random() * 0.12]);
  for (let i = 0; i < len; i++) { b = (b + 0.05 * (Math.random() * 2 - 1)) / 1.05; const e = i / len; let env = Math.pow(1 - e, 1.4) * 0.5; for (const [c, w] of bumps) env += Math.exp(-Math.pow((e - c) / w, 2)) * 0.6; d[i] = b * 4 * env; }
  const s = AC.createBufferSource(); s.buffer = buf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = (close ? 420 : 170) + 180 * k; const g = AC.createGain(); g.gain.value = (close ? 1.1 : 0.6) * k;
  s.connect(f); f.connect(g); g.connect(out); g.connect(verb); s.start(t);
  if (close) {   // close by: the crack first, splitting the air, before the roll
    const n = Math.floor(AC.sampleRate * 0.5), cb = AC.createBuffer(1, n, AC.sampleRate), cd = cb.getChannelData(0);
    for (let i = 0; i < n; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < AC.sampleRate * 0.01 ? 1.5 : 1);
    const cs = AC.createBufferSource(); cs.buffer = cb; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; const cg = AC.createGain(); cg.gain.value = 0.7 * k;
    cs.connect(hp); hp.connect(cg); cg.connect(out); cg.connect(verb); cs.start(t - 0.05);
  }
}
function drip() { if (!AC || AC.state !== 'running') return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(1500 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
  g.gain.setValueAtTime(0.006 + Math.random() * 0.01, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); const w = AC.createGain(); w.gain.value = 3; o.connect(g); g.connect(w); w.connect(verb); g.connect(out); o.start(t); o.stop(t + 0.12); }

// waking: the lid taking your weight, the tube coming out, the lid giving way, your first breaths
function thud(k) {
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
  noiseBurst(0.35 + 0.3 * k, 'bandpass', 1300 - 500 * k, 9, 0.05 + 0.12 * k, 0.3);   // the seal creaking
}
function yank() {
  if (!AC || AC.state !== 'running') { grade.uniforms.uJolt.value = 1; return; }
  grade.uniforms.uJolt.value = 1;
  noiseBurst(0.3, 'bandpass', 650, 2.2, 0.55, 0.3); noiseBurst(0.12, 'highpass', 2500, 0.7, 0.15, 0.2);
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
  g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
  thump(48, 0.25);
}
function lidGives() {
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime;
  noiseBurst(0.18, 'bandpass', 900, 1.5, 0.5, 0.4);                  // the seal going
  noiseBurst(2.6, 'highpass', 2600, 0.6, 0.18, 0.5);                 // pressure out
  { const len = Math.floor(AC.sampleRate * 3), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let b = 0;   // and the fluid, all of it, out onto the steel
    for (let i = 0; i < len; i++) { b = (b + 0.08 * (Math.random() * 2 - 1)) / 1.08; const e = i / len; d[i] = b * 5 * Math.min(1, e * 12) * Math.pow(1 - e, 1.5); }
    const sN = AC.createBufferSource(); sN.buffer = buf; const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; const g = AC.createGain(); g.gain.value = 0.55; sN.connect(fl); fl.connect(g); g.connect(out); g.connect(verb); sN.start(t + 0.05); }
  setTimeout(() => { if (!AC) return; const t2 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = 180; g.gain.setValueAtTime(0.06, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.2); o.connect(g); g.connect(out); g.connect(verb); o.start(t2); o.stop(t2 + 1.3); noiseBurst(0.08, 'bandpass', 700, 2, 0.4, 0.5); }, 1050);   // the lid hits its stop
}
function breaths() {
  if (!AC || AC.state !== 'running') return;
  [0, 1.0, 2.1, 3.4, 4.9].forEach((at, i) => {
    const k = 1 - i * 0.16, t = AC.currentTime + at;
    for (const [dt0, dur, f, gain] of [[0, 0.42, 1100, 0.2], [0.5, 0.65, 800, 0.12]]) {   // in, sharp; out, longer
      const len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) { const e = j / len; d[j] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.pow(e, dt0 ? 0.6 : 0.35)); }
      const sN = AC.createBufferSource(); sN.buffer = buf; const fl = AC.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.9; const g = AC.createGain(); g.gain.value = gain * k;
      sN.connect(fl); fl.connect(g); g.connect(out); sN.start(t + dt0);
    }
  });
}
function bubble() {
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), f = 300 + Math.random() * 500; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.04, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
}

// The sirens. Somewhere far off, outside or in other towers: air-raid sirens wailing and never stopping, two of them, out of step with
// each other: each winds up, holds, runs down, and before it is quiet winds up again. Two horns a minor third apart in each, the slow sweep
// of the rotor as it turns, and a great deal of distance.
const RAIN = { roar: null, hiss: null, drum: null, roll: null };
const SIRENS = [];
function sirenStart() {
  for (const [delay, detune, level] of [[1.0, 1, 1], [9.5, 0.94, 0.7]]) {
    const S = { at: AC.currentTime + delay, oscs: [], detune };
    const dist = AC.createBiquadFilter(); dist.type = 'lowpass'; dist.frequency.value = 780 * detune; dist.Q.value = 0.4;
    const band = AC.createBiquadFilter(); band.type = 'highpass'; band.frequency.value = 110;
    const rot = AC.createGain(); rot.gain.value = 0.7; const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.17 + Math.random() * 0.07; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(rot.gain); lfo.start();
    const env = AC.createGain(); env.gain.setValueAtTime(0.0001, S.at); env.gain.exponentialRampToValueAtTime(level, S.at + 5);
    const dry = AC.createGain(); dry.gain.value = 0.04; const wet = AC.createGain(); wet.gain.value = 0.17;
    dist.connect(band); band.connect(rot); rot.connect(env); env.connect(dry); env.connect(wet); dry.connect(out); wet.connect(verb);
    for (const [ratio, type, g0] of [[1, 'sawtooth', 0.5], [1.19, 'sawtooth', 0.42], [2, 'triangle', 0.18], [2.38, 'triangle', 0.12]]) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = type; g.gain.value = g0; o.frequency.setValueAtTime(140 * ratio * detune, AC.currentTime);
      const wob = AC.createOscillator(), wg = AC.createGain(); wob.frequency.value = 5.3 + Math.random(); wg.gain.value = 1.6 * ratio; wob.connect(wg); wg.connect(o.frequency);
      o.connect(g); g.connect(dist); o.start(); wob.start(); S.oscs.push([o, ratio]);
    }
    SIRENS.push(S);
  }
}
// keep each one going: the next wail is put in before the one now sounding runs out
function sirenTick() {
  if (!AC) return;
  for (const S of SIRENS) {
    if (AC.currentTime < S.at - 3) continue;
    const t = S.at, RISE = 5.5 + Math.random() * 1.5, HOLD = 4 + Math.random() * 4, FALL = 8 + Math.random() * 3, END = RISE + HOLD + FALL;
    const lo = 140 * S.detune, hi = (395 + Math.random() * 30) * S.detune;   // (always back down to the same low note: no step between wails)
    for (const [o, r] of S.oscs) {
      o.frequency.setValueAtTime(lo * r, t);
      o.frequency.exponentialRampToValueAtTime(hi * r, t + RISE);                 // winding up
      o.frequency.linearRampToValueAtTime(hi * r * 0.985, t + RISE + HOLD);         // held, sagging a little
      o.frequency.exponentialRampToValueAtTime(lo * r, t + END);                   // running down, and straight up again
    }
    S.at = t + END;
  }
}

/* ---------------- the weather outside ---------------- */
// A storm right over the towers: flashes every few seconds, often a bolt you can see through the openings and the crack of it close by,
// and in between, flickers deep in the cloud.
const STORM = { next: 3 + Math.random() * 3, t: -1, seq: [], hold: 0, bolt: false, flick: 0 };   // (hold: a flash kept on, for testing from the console)
function storm(dt, time) {
  if (time > STORM.next && STORM.t < 0) {
    STORM.t = 0; STORM.seq = []; let at = 0; const close = Math.random() < 0.45, n = (close ? 3 : 2) + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { STORM.seq.push([at, 0.05 + Math.random() * 0.1, (close ? 0.75 : 0.35) + Math.random() * 0.4]); at += 0.06 + Math.random() * 0.18; }
    STORM.bolt = close || Math.random() < 0.3;
    if (STORM.bolt) {   // somewhere you can see it: out through the openings from where you are
      const c = camera.position; U.uBoltA.value = Math.atan2(0 - c.z, -R_WALL - c.x) + (Math.random() - 0.5) * 0.7; U.uBoltS.value = Math.random() * 100;
    }
    const k = 0.6 + Math.random() * 0.4; thunder(close ? 0.15 + Math.random() * 0.5 : 1.5 + Math.random() * 3, k, close);
    STORM.next = time + 2.5 + Math.random() * 7;
  }
  let f = 0;
  if (STORM.t >= 0) { STORM.t += dt; let any = false; for (const [s, d, i] of STORM.seq) { if (STORM.t < s + d + 0.3) any = true; if (STORM.t >= s && STORM.t < s + d) f = Math.max(f, i); else if (STORM.t >= s + d) f = Math.max(f, i * Math.exp(-(STORM.t - s - d) * 9) * 0.5); } if (!any) { STORM.t = -1; STORM.bolt = false; } }
  // flickers in the cloud, far off, all the time
  if ((STORM.flick -= dt) < 0) { STORM.flick = 0.3 + Math.random() * 1.5; STORM.fk = 0.06 + Math.random() * 0.12; }
  STORM.fk = (STORM.fk || 0) * Math.exp(-dt * 14);
  U.uFlash.value = Math.max(f, STORM.fk, STORM.hold);
  U.uBolt.value = STORM.bolt ? f : (STORM.hold > 0 && STORM.boltHold ? 1 : 0);
}

/* ---------------- waking: the pod ---------------- */
// You come here from the old computer: the upload done, you open your eyes in a pod, in the red, under the fluid. Your hand goes up
// behind your head to the black tube plugged in there and pulls it out. Then you push at the lid, again and again (E, as many times as
// it takes), until it gives; it swings open, the fluid goes out with you onto the walkway, and you get up. (blacktower.html#nointro
// starts you standing beside the open pod instead.)
const INTRO = { on: !/nointro/.test(location.hash), t: 0, phase: 'wait', push: 0, pushAnim: 0, openT: -1, done: false };
const EYE_L = new V3(0, 1.42, 0.08), LOOK_L = new V3(0, 1.3, 2.0);
scene.add(camera);
// the skin of your own hands, lit red through the glass
const skinMat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uOut: { value: 0 } }, U), side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN, vV, vW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: COMMON + `uniform float uOut; varying vec3 vN, vV, vW;
  void main(){
    vec3 n = normalize(vN), v = normalize(vV); if (dot(n, v) < 0.0) n = -n;
    vec3 L = normalize(vec3(0.15, -0.35, 1.0));   // (view space: the glow comes in through the glass in front of you, a little from below)
    float dif = max(dot(n, L), 0.0), wrap = max(dot(n, L) * 0.5 + 0.5, 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 3.0), spec = pow(max(dot(reflect(-L, n), v), 0.0), 28.0);
    vec3 skin = vec3(0.5, 0.36, 0.31) * (0.8 + 0.35 * vnoise(vW * 90.0)) * (0.85 + 0.15 * vnoise(vW * 300.0));
    // lit from the glass in front, dark behind; the light coming through at the thin edges; wet
    vec3 c = skin * vec3(1.0, 0.32, 0.25) * (0.025 + 0.12 * wrap * wrap + 0.42 * dif) * pulseAt(vW.y, 0.0) + vec3(0.9, 0.15, 0.1) * rim * 0.16 + vec3(1.0, 0.85, 0.8) * spec * 0.5;
    gl_FragColor = vec4(c, 1.0);
  }` });
const plugMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: metalMat.fragmentShader }); plugMat.extensions.derivatives = true;
function makeHand(left) {
  const H = new THREE.Group(), F = [];
  const cap = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 3, 8); g.rotateX(Math.PI / 2); g.translate(0, 0, -len / 2 - r); return g; };
  const add = (parent, geo, x, y, z) => { const m = new THREE.Mesh(geo, skinMat); m.position.set(x, y, z); parent.add(m); return m; };
  { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.046, 0.016, 0.054); add(H, g, 0, 0, -0.05); }                 // the palm
  { const g = new THREE.SphereGeometry(1, 10, 6); g.scale(0.034, 0.022, 0.04); add(H, g, 0, 0.002, -0.012); }             // the heel of the hand
  { const g = cap(0.029, 0.32); g.rotateY(Math.PI); add(H, g, 0, 0, -0.005); }                                             // the forearm
  [[-0.03, 0.046], [-0.01, 0.052], [0.01, 0.049], [0.029, 0.039]].forEach(([x, L]) => {
    const p1 = new THREE.Group(); p1.position.set(x, 0.002, -0.094); H.add(p1); add(p1, cap(0.0098, L), 0, 0, 0);
    const p2 = new THREE.Group(); p2.position.set(0, 0, -L - 0.016); p1.add(p2); add(p2, cap(0.009, L * 0.78), 0, 0, 0);
    F.push([p1, p2]);
  });
  const th = new THREE.Group(); th.position.set(-0.038, -0.01, -0.03); th.rotation.set(0, 0.5, 0.55); H.add(th); add(th, cap(0.0115, 0.034), 0, 0, 0);
  const th2 = new THREE.Group(); th2.position.set(0, 0, -0.054); th.add(th2); add(th2, cap(0.0105, 0.026), 0, 0, 0);
  if (left) H.scale.x = -1;
  H.visible = false; camera.add(H);
  return { H, curl(c, spread) { for (const [p1, p2] of F) { p1.rotation.x = -c * 1.25; p2.rotation.x = -c * 1.45; } th.rotation.x = -c * 0.6; th2.rotation.x = -c * 0.9; for (let i = 0; i < 4; i++) F[i][0].rotation.y = (i - 1.5) * 0.035 * (spread || 0); } };
}
const HR = makeHand(false), HL = makeHand(true);
// the plug at the end of the tube: a steel barrel and a long needle
const PLUG = new THREE.Group();
{
  const parts = [];
  { const g = new THREE.CylinderGeometry(0.02, 0.022, 0.07, 10); g.rotateX(Math.PI / 2); parts.push(kindGeom(g, 1)); }
  { const g = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 10); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.032); parts.push(kindGeom(g, 1)); }
  { const g = new THREE.ConeGeometry(0.004, 0.06, 6); g.rotateX(-Math.PI / 2); g.translate(0, 0, -0.068); parts.push(kindGeom(g, 1)); }
  PLUG.add(new THREE.Mesh(mergeGeometries(parts), plugMat)); scene.add(PLUG); PLUG.visible = false;
}
const PLUGV = new V3(), plugTail = new V3(), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
let tubeMesh = null, plugFree = false;
function drawTube() {
  // from the top of the pod down to the back of the plug, hanging slack
  // (by way of the right-hand side of the pod, so that it does not hang across your face)
  const A = EMPTY.group.localToWorld(new V3(0.12, 2.28, -0.2)), B = PLUG.localToWorld(plugTail.set(0, 0, 0.04)), dir = PLUG.localToWorld(new V3(0, 0, 0.14)).sub(B);
  const side = EMPTY.group.localToWorld(new V3(0.36, 1.85, -0.05)), mid = side.clone().lerp(B.clone().add(dir), 0.5);
  const curve = new THREE.CatmullRomCurve3([A, A.clone().lerp(side, 0.5).add(new V3(0, 0.05, 0)), side, mid, B.clone().add(dir), B]);
  const g = kindGeom(new THREE.TubeGeometry(curve, 40, 0.026, 6), 3);
  if (!tubeMesh) { tubeMesh = new THREE.Mesh(g, metalMat); scene.add(tubeMesh); } else { tubeMesh.geometry.dispose(); tubeMesh.geometry = g; }
}
// "E": shown while the lid is to be pushed
const EKEY = document.createElement('div');
EKEY.innerHTML = '<b>E</b>';
EKEY.style.cssText = "position:fixed;left:50%;bottom:17%;transform:translateX(-50%);display:none;pointer-events:none;z-index:6;font:700 24px/1 system-ui,sans-serif";
EKEY.firstChild.style.cssText = 'display:block;min-width:34px;padding:8px 10px;text-align:center;border-radius:9px;background:rgba(255,236,230,.9);color:#3a0f0c;box-shadow:0 0 22px rgba(255,60,40,.45);transition:transform .08s';
document.body.appendChild(EKEY);
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const _hp = new V3();
function placeHand(h, p, rx, ry, rz, curl, spread) { h.H.visible = true; h.H.position.copy(p); h.H.rotation.set(rx, ry, rz); h.curl(curl, spread); }
// keyframes for the right hand, in the camera's space: [time, x, y, z, rx, ry, rz, curl]
const KR = [
  [6.2, 0.24, -0.52, -0.3, 0.4, 0.1, -0.3, 0.5], [7.2, 0.15, -0.06, -0.36, 1.1, 0.0, -0.2, 0.3],   // up in front of your face, open
  [7.9, 0.07, 0.2, -0.02, 2.4, 0.15, 0.1, 0.1], [8.15, 0.04, 0.16, 0.07, 2.6, 0.2, 0.2, 0.0],     // up and back, behind your head
  [8.4, 0.04, 0.16, 0.07, 2.6, 0.2, 0.2, 1.0], [9.1, 0.045, 0.15, 0.06, 2.55, 0.2, 0.15, 1.0],    // fingers round it, pulling
  [9.28, 0.12, -0.08, -0.33, 0.55, -0.25, -0.45, 1.0], [10.9, 0.13, -0.1, -0.35, 0.45, -0.2, -0.4, 1.0],   // out, and held up in front of you
  [11.2, 0.15, -0.12, -0.36, 0.4, -0.2, -0.3, 0.2], [12.0, 0.26, -0.55, -0.32, 0.2, 0.0, -0.3, 0.4],      // let go; the hand drops away
];
function keyR(t) {
  if (t <= KR[0][0]) return KR[0]; if (t >= KR[KR.length - 1][0]) return KR[KR.length - 1];
  let i = 0; while (KR[i + 1][0] < t) i++; const a = KR[i], b = KR[i + 1], k = ease((t - a[0]) / (b[0] - a[0]));
  return a.map((v, j) => lerp(v, b[j], k));
}
const T_PUSH = 12.6;   // from here on the lid is yours to push
function pushLid() {
  if (INTRO.phase !== 'push') return;
  INTRO.push = Math.min(1, INTRO.push + 0.125); INTRO.pushAnim = 1;
  EKEY.firstChild.style.transform = 'scale(.86)'; setTimeout(() => { EKEY.firstChild.style.transform = ''; }, 90);
  thud(INTRO.push);
  if (INTRO.push >= 1) { INTRO.phase = 'open'; INTRO.openT = 0; EKEY.style.display = 'none'; lidGives(); }
}
function introTick(dt) {
  const I = INTRO, G = EMPTY.group;
  if (I.phase === 'wait') { if (window.SCF_LOADING && SCF_LOADING.active) { grade.uniforms.uLid.value = 1; } else { I.phase = 'film'; initAudio(); } }
  if (I.phase !== 'wait') I.t += dt;
  const t = I.t;
  // where your head is: in the pod, drifting a little in the fluid
  const fl = I.phase === 'out' ? 0 : 1;
  camera.position.copy(G.localToWorld(_hp.copy(EYE_L)));
  camera.up.set(0, 1, 0); camera.lookAt(G.localToWorld(new V3().copy(LOOK_L)));
  camera.rotateY(Math.sin(t * 0.37) * 0.06 * fl); camera.rotateX(Math.sin(t * 0.29 + 1) * 0.04 * fl); camera.rotateZ(Math.sin(t * 0.23) * 0.05 * fl);
  // eyes: shut, half open, shut again, open
  let lid = 1;
  if (t > 2.5) lid = lerp(1, 0.5, ease((t - 2.5) / 0.8)); if (t > 3.3) lid = lerp(0.5, 0.92, ease((t - 3.3) / 0.25)); if (t > 3.6) lid = lerp(0.92, 0, ease((t - 3.6) / 1.1));
  grade.uniforms.uLid.value = lid;
  // the plug: in the back of your head, then in your hand, then let go to sink
  const holding = t >= 8.4 && t < 11.0;
  if (!plugFree) {
    PLUG.visible = true;
    if (!holding && t < 8.4) { PLUG.position.copy(camera.localToWorld(new V3(0.01, 0.1, 0.13))); _q.setFromEuler(new THREE.Euler(-0.9, 0, 0)); PLUG.quaternion.copy(camera.quaternion).multiply(_q); }
    else if (holding) { const hp = HR.H.localToWorld(new V3(0, -0.03, -0.07)); PLUG.position.copy(hp); _q.setFromEuler(new THREE.Euler(-0.4, 0.3, 0)); PLUG.quaternion.copy(camera.quaternion).multiply(_q); }
    else { plugFree = true; PLUGV.set(0, -0.12, 0); }
  } else {
    // let go, it drifts off to the side and sinks slowly while the pod is full; it drops once it is not
    const rest = G.localToWorld(new V3(0.33, 0.14, -0.05));
    if (I.openT < 0) PLUG.position.lerp(rest.setY(Math.max(rest.y, PLUG.position.y - 0.2 * dt)), Math.min(1, dt * 0.9));
    else { PLUGV.y -= 6 * dt; PLUG.position.addScaledVector(PLUGV, dt); if (PLUG.position.y < rest.y) { PLUG.position.y = rest.y; PLUGV.set(0, 0, 0); } }
    PLUG.rotation.x += dt * 0.3;
  }
  PLUG.updateMatrixWorld(); drawTube();
  // the yank
  if (t > 8.4 && t < 9.2) { camera.rotateX(-0.03 * Math.sin((t - 8.4) * 40) * ease((t - 8.4) / 0.6)); }
  if (t >= 9.18 && !I.yanked) { I.yanked = true; yank(); }
  grade.uniforms.uJolt.value = Math.max(0, grade.uniforms.uJolt.value - dt * 2.2);
  if (t >= 9.18 && t < 9.7) camera.rotateX(0.06 * Math.exp(-(t - 9.18) * 8));
  // the right hand, through the pull
  if (t >= 6.2 && t < 12.0) { const k = keyR(t); placeHand(HR, _hp.set(k[1], k[2], k[3]), k[4], k[5], k[6], k[7] + (holding ? 0.05 * Math.sin(t * 30) : 0), 0.4); }
  else if (I.phase === 'film' && t >= 12.0) HR.H.visible = false;
  // then both hands up on the glass, and the pushing
  if (I.phase === 'film' && t >= T_PUSH) { I.phase = 'push'; EKEY.style.display = 'block'; }
  if (I.phase === 'push' || I.phase === 'open') {
    if (I.phase === 'push') I.push = Math.max(0, I.push - dt * 0.07);
    I.pushAnim = Math.max(0, I.pushAnim - dt * 4.5);
    const up = ease((t - T_PUSH) / 0.7), gone = I.phase === 'open' ? ease(I.openT / 0.4) : 0, th = I.pushAnim * (2 - I.pushAnim);
    for (const [h, sx] of [[HR, 1], [HL, -1]]) placeHand(h, _hp.set(sx * (0.15 + 0.01 * th), lerp(-0.5, -0.04, up) - gone * 0.5, -0.31 - 0.07 * th), Math.PI / 2 - 0.1, sx * -0.12, sx * -0.18, 0.12, 0.5);
    if (I.phase === 'push') EMPTY.lidPivot.rotation.y = -I.push * 0.2 - th * 0.03;
    if (Math.random() < dt * 2) grade.uniforms.uJolt.value = Math.max(grade.uniforms.uJolt.value, 0.04 * I.push);
  }
  if (I.phase === 'push' && !I.pushHint) { I.pushHint = true; }
  // it gives: the lid swings open, the fluid goes, and you go with it
  if (I.openT >= 0) {
    I.openT += dt; const o = I.openT;
    EMPTY.lidPivot.rotation.y = lerp(-0.2, -1.95, ease(o / 1.1) * (1 + 0.04 * Math.sin(o * 9) * Math.exp(-o * 2)));
    const drain = ease(o / 1.6); grade.uniforms.uPod.value = 1 - drain; EMPTY.uFill.value = 1 - drain;
    if (muffle) muffle.frequency.value = lerp(320, 20000, Math.pow(drain, 3));
    if (o > 0.45) { HR.H.visible = HL.H.visible = false; if (I.phase !== 'out') { I.phase = 'out'; EMPTY.pud.visible = true; } }
    if (o > 0.45) {
      // out: fall forward onto the walkway, stay down a moment breathing, get up
      const u = o - 0.45, eye0 = G.localToWorld(_hp.copy(EYE_L)).clone(), knee = G.localToWorld(new V3(0, 0.55, 1.95)), stand = new V3(P.pos.x, P.pos.y + EYE, P.pos.z);
      const k1 = ease(u / 1.0), k2 = ease((u - 2.4) / 1.6);
      camera.position.copy(eye0.lerp(knee, k1).lerp(stand, k2)); camera.position.y += -Math.sin(Math.min(1, u / 1.0) * Math.PI) * 0.15 + (u > 1 && u < 2.4 ? Math.sin(u * 5.2) * 0.012 : 0);
      const lookIn = G.localToWorld(new V3(0, -0.6, 4.5)), fwd = new V3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      const target = lookIn.clone().lerp(camera.position.clone().add(fwd.multiplyScalar(5)), k2);
      camera.up.set(0, 1, 0); camera.lookAt(target); camera.rotateZ((1 - k2) * 0.08 * Math.sin(u * 1.3));
      if (u > 0.9 && !I.landed) { I.landed = true; footstep(1.8); noiseBurst(0.5, 'lowpass', 500, 0.5, 0.25, 0.4); breaths(); }
      if (u >= 4.0) { I.done = true; I.on = false; camera.rotation.set(P.pitch, P.yaw, 0); grade.uniforms.uPod.value = 0; grade.uniforms.uLid.value = 0; if (muffle) muffle.frequency.value = 20000; }
    }
  }
  camera.updateMatrixWorld();
}
if (INTRO.on) {
  EMPTY.lidPivot.rotation.y = 0; EMPTY.uFill.value = 1; EMPTY.hanging.visible = false; EMPTY.pud.visible = false;
  grade.uniforms.uPod.value = 1; grade.uniforms.uLid.value = 1;
}

/* ---------------- its name, once, as you arrive ---------------- */
const NAME = { el: null, on: false, off: false };
{
  const el = document.createElement('div'); NAME.el = el;
  el.innerHTML = 'THE BLACK TOWER<small>黑塔</small>';
  el.style.cssText = "position:fixed;left:0;right:0;bottom:16%;text-align:center;color:#e6d6d4;font:300 30px/1.2 'Segoe UI Light','Segoe UI','Helvetica Neue',Arial,sans-serif;letter-spacing:.9em;text-indent:.9em;opacity:0;transition:opacity 2.4s;pointer-events:none;z-index:4;text-shadow:0 0 18px rgba(255,60,40,.25)";
  document.body.appendChild(el);
  const sm = el.querySelector('small'); sm.style.cssText = 'display:block;margin-top:10px;font-size:15px;letter-spacing:.6em;text-indent:.6em;color:#b39a98';
}
if (window.SCF_G) window.SCF_G.setPages(() => [{ t: 'The Black Tower', html: '<p>A tower full of sleepers. Thousands of them, all dreaming.</p><p>One of the pods is open, and empty.</p><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to walk, hold <kbd>Shift</kbd> to run, <kbd>Space</kbd> to jump. The walkway goes up, and down, as far as you like.</p>' }]);

/* ---------------- loop ---------------- */
canvas.style.display = 'block';
let last = -1, fadeT = 0, beatPrev = 0, dripT = 2, bubT = 1;
const WOKE = INTRO.on;   // came in through the pod: no fade in, the eyes do that
function frame(now) {
  requestAnimationFrame(frame);
  if (last < 0) last = now; const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; U.uTime.value += dt;
  if (!(window.SCF_LOADING && SCF_LOADING.active) && !INTRO.on) fadeT += dt;   // the arrival (fade, the name) waits for the loading screen to go, and for you to get out of the pod
  const time = U.uTime.value;
  if (INTRO.on) { introTick(dt); if (INTRO.openT < 0 && INTRO.phase !== 'wait' && (bubT -= dt) < 0) { bubT = 0.15 + Math.random() * 0.9; bubble(); } }
  else { if (!(window.SCF_G && window.SCF_G.isOpen())) step(dt); placeCamera(); }
  // the tower is drawn round you: thirteen turns, moved a whole turn at a time so nothing seems to move
  const kc = Math.floor(camera.position.y / PITCH); tower.position.y = kc * PITCH; U.uTurn.value = kc;
  FAR.towers.position.y = camera.position.y; FAR.sky.position.copy(camera.position);
  storm(dt, time);
  // the heartbeat, as the wave passes where you are
  { const x = ((time * 0.72 - camera.position.y * 0.011) % 1 + 1) % 1; if (beatPrev < 0.08 && x >= 0.08) thump(52, 0.09); if (beatPrev < 0.25 && x >= 0.25) thump(46, 0.05); beatPrev = x; }
  if ((dripT -= dt) < 0) { dripT = 0.6 + Math.random() * 3.5; drip(); }
  sirenTick();
  { const nearW = Math.max(0, 1 - Math.abs(ang(camera.position.x, camera.position.z) - Math.PI) / 0.9);   // by the openings: the wind, and the rain pouring in
    if (wind) wind.gain.value += ((0.1 + 0.4 * nearW) - wind.gain.value) * Math.min(1, dt * 2);
    if (RAIN.roar) { RAIN.roar.gain.value += ((0.16 + 0.22 * nearW) - RAIN.roar.gain.value) * Math.min(1, dt * 2); RAIN.hiss.gain.value = 0.035 + 0.06 * nearW; } }
  if (!NAME.on && fadeT > 2.4) { NAME.on = true; NAME.el.style.opacity = '1'; }
  if (!NAME.off && fadeT > 8.4) { NAME.off = true; NAME.el.style.opacity = '0'; }
  grade.uniforms.uTime.value = time; grade.uniforms.uFade.value = WOKE ? 0 : clamp(1 - (fadeT - 0.3) / 3.2, 0, 1);
  composer.render();
}
requestAnimationFrame(frame);
// a handle for testing from the console
window.__tower = { P, camera, U, EMPTY, canStand, step, keys, renderer, STORM, INTRO, pushLid, grade, initAudio, SIRENS, skipFade() { fadeT = 99; },
  look(x, y, z, yaw, pitch) { camera.position.set(x, y, z); camera.rotation.set(pitch || 0, yaw || 0, 0); },
  put(a, r, th, yaw, pitch) { P.th = th; P.pos.set(Math.cos(a) * r, th / TAU * PITCH, Math.sin(a) * r); P.yaw = yaw; P.pitch = pitch || 0; P.vel.set(0, 0, 0); } };
