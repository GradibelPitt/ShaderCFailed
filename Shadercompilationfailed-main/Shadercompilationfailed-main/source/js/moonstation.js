// Moon Station (月球空间站). A place on its own page: one hall of a station in orbit, built so that you are almost nothing in it.
// You come in by a small door in the back wall (a lamp over it, the only thing here made to your size). Ahead the floor runs on for twelve
// kilometres, polished and wet, to a low wall with a line of white light along it; past that, nothing: the edge of the Earth, and space.
// On your right the hall is closed by stepped frames leaning in over your head, one after another into the haze; on your left by a cliff of
// bare rock as high as the frames. Against your 1.7 m the hall is about 9 km wide and 12 km high (some 1 : 7000), and there is nobody else.
// Other planets get stations of their own later; this one is the Moon's.
// Everything here is lit by its own shaders. The floor is a mirror: the hall is drawn a second time, upside down, every frame, and the floor
// looks that picture up through its puddles. The sky (the Earth, the stars, the orange ring) is worked out per pixel on a sphere round the eye.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- the save ---------------- */
const SAVE = window.SCF_SAVE || { get: () => undefined, set() {} };
// the achievement 终极神速: here without ever having been to the level-select hall, and without Admin settings having unlocked the levels
if (window.SCF_ACH && !SAVE.get('hubSeen') && !SAVE.get('pcPower') && !SAVE.get('allLevels') && !SAVE.get('adminUsed')) setTimeout(() => window.SCF_ACH.unlock('speed'), 3000);   // (once the station is up on the screen)
SAVE.set('scene', 'moon');
{ const v = Array.isArray(SAVE.get('visited')) ? SAVE.get('visited').slice() : []; if (!v.includes('moon')) { v.push('moon'); SAVE.set('visited', v); } }   // the level-select hall gets a MOON STATION line

/* ---------------- measures (metres) ---------------- */
const XL = -4300, XR = 4800, ZB = 3000, ZE = -9000, TOPY = 11800;   // cliff side, frame side (at the floor), back wall, the open end, where frames meet the cliff
const PAR_H = 150, PAR_D = 120, STRIP_Y = 70;                        // the low wall at the open end, and its line of light
const PZ1 = ZE - 600, XLP = XL - 5200;                                 // the white platform beyond the end of the hall: its outer edge, and its far (left) end
const DOOR = { x: 600, w: 1.1, h: 2.25 };                             // the door you came in by, in the back wall
const SL = Math.hypot(XR - XL, TOPY), SD = [(XL - XR) / SL, TOPY / SL], SN = [-SD[1], SD[0]];   // the frames' line: along it (up to the cliff), and across it into the hall
// (SN points down and left, into the hall)
const WALL_H = SD[1] * 900 + SN[1] * 290;   // the back wall stops here, level with the lowest row of red lamps on the frames (about 536 m); above it, open space

/* ---------------- renderer ---------------- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
const pickPR = () => Math.min(window.devicePixelRatio || 1, Math.sqrt(2.6e6 / Math.max(1, innerWidth * innerHeight)), 1.5);
renderer.setPixelRatio(pickPR()); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 90000); camera.rotation.order = 'YXZ';

/* ---------------- shared shader pieces ---------------- */
const uTime = { value: 0 }, uCam = { value: new V3() };
const NOISE = `
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm8(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 8; i++){ s += a * noise3(p); p = p * 2.02 + vec3(5.3, 2.9, 8.1); a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * noise3(p); p = p * 2.07 + vec3(4.1, 1.3, 7.7); a *= 0.5; } return s; }
`;
// light in the hall: what comes in from the open end (the Earth below it, bright and cold), the orange ring high up, the strip of white light
// along the low wall, the lamp over the door; and the haze it all hangs in, thick low down and brightest looking out
const LIGHT = `
uniform vec3 uCam; uniform float uTime;
const vec3 DIR_E = vec3(0.0790, -0.1186, -0.9898);
const vec3 DIR_O = vec3(0.4446, 0.8398, -0.3113);
vec3 shade(vec3 p, vec3 n, vec3 alb, float rough, float spk){
  float op = 0.08 + 0.92 * exp(-max(0.0, p.z + 9000.0) / 6500.0);
  float e = dot(n, DIR_E);
  vec3 c = vec3(0.010, 0.013, 0.018);
  c += vec3(0.42, 0.60, 0.86) * 1.7 * (max(e, 0.0) * 0.82 + 0.18 * (e * 0.5 + 0.5)) * op;
  c += vec3(1.0, 0.36, 0.11) * 0.16 * max(dot(n, DIR_O), 0.0) * (0.3 + 0.7 * smoothstep(3000.0, 11000.0, p.y));
  vec3 sp = vec3(clamp(p.x, -4300.0, 4800.0), ${STRIP_Y.toFixed(1)}, ${PZ1.toFixed(1)}); vec3 sd = sp - p; float dd = length(sd) + 1.0;
  c += vec3(0.85, 0.92, 1.0) * 0.65 * max(dot(n, sd / dd), 0.0) / (1.0 + dd * dd / (1000.0 * 1000.0));
  vec3 dl = vec3(${DOOR.x.toFixed(1)}, 2.75, 2999.6) - p; float dld = length(dl) + 0.01;
  c += vec3(1.0, 0.72, 0.42) * 1.6 * max(dot(n, dl / dld), 0.0) / (1.0 + dld * dld / 9.0);
  vec3 v = normalize(uCam - p), h = normalize(DIR_E + v);
  float pw = 2.0 / max(rough * rough * rough * rough, 0.0004);
  // and the open end seen in it: glossy faces turned to catch it shine blue
  vec3 r = reflect(-v, n), to = normalize(vec3(clamp(p.x, -3000.0, 3000.0), 1800.0, -9300.0) - p);
  float sh = pow(max(dot(r, to), 0.0), mix(400.0, 6.0, rough));
  return alb * c + vec3(0.42, 0.60, 0.86) * op * pow(max(dot(n, h), 0.0), pw) * spk + vec3(0.40, 0.58, 0.85) * sh * spk * 0.9 * (0.4 + 0.6 * op);
}
vec3 haze(vec3 col, vec3 p){
  vec3 d = p - uCam; float L = length(d); vec3 rd = d / max(L, 1e-3);
  float yy = max(min(p.y, uCam.y), 0.0);
  float f = 1.0 - exp(-L / 25000.0 * (0.45 + 0.9 * exp(-yy / 2600.0)));
  float fw = pow(max(dot(rd, vec3(0.0, -0.05, -0.9987)), 0.0), 6.0);
  vec3 fc = mix(vec3(0.010, 0.013, 0.019), vec3(0.20, 0.28, 0.37), fw * 0.85);
  return mix(col, fc, f);
}
`;
const VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW; varying vec3 vN; varying vec4 vR; varying vec2 vUv2;
uniform mat4 uMirrorVP;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vR = uMirrorVP * w; vUv2 = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const FRAG = `#include <logdepthbuf_pars_fragment>
${NOISE}${LIGHT}
uniform vec3 uBase;
varying vec3 vW; varying vec3 vN; varying vec4 vR; varying vec2 vUv2;
float lines(float v, float period, float w){ float f = abs(fract(v / period + 0.5) - 0.5) * period; float aa = fwidth(v) * 1.2; return 1.0 - smoothstep(w - aa, w + aa, f); }
#if KIND == 2
// the rock: numbers for it that stay good however far along the cliff you are, noise that knows its own slope, and blocks with cracks between
varying float vAO;
vec2 rh2(vec2 p){ p = mod(p, 2048.0); vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float rh1(vec2 p){ p = mod(p, 2048.0); vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 gnoise(vec2 p){   // x: the value (about -0.7 .. 0.7); yz: which way it rises
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = rh2(i) * 2.0 - 1.0, gb = rh2(i + vec2(1.0, 0.0)) * 2.0 - 1.0, gc = rh2(i + vec2(0.0, 1.0)) * 2.0 - 1.0, gd = rh2(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  return vec3(va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd),
              ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va));
}
vec2 rG; float rTone, rDark, rShd;   // what the rock's layers add up: its lean (along the cliff, and up), its shade, the black of its cracks, shadow
// one thickness of beds, each bed broken into blocks by joints. Every block stands out of the face or back in it by its own amount, leans its own
// way, and has its own shade; where one stands out past the next its edge catches the light from the open end, and the other side lies in its shadow
void beds(vec2 u, float T, float sd, float px){
  float kk = 1.0 - smoothstep(0.14, 0.42, px / T); if (kk <= 0.0) return;
  vec3 wv = gnoise(u / (T * 3.3) + sd * 1.7), wu = gnoise(u / (T * 0.83) + sd * 4.3);   // nothing in it is straight
  float s = (u.y + 0.05 * u.x + wv.x * T * 0.6 + wu.x * T * 0.16) / T + sd * 3.71, zz = (u.x + wv.y * T * 0.45 + wu.y * T * 0.10) / T;
  float i = floor(s), f = s - i, b = 0.5 + 0.64 * (rh1(vec2(i, sd)) - 0.5), bed = i + step(b, f);
  float lo = bed - 0.5 + 0.64 * (rh1(vec2(bed - 1.0, sd)) - 0.5), hi = bed + 0.5 + 0.64 * (rh1(vec2(bed, sd)) - 0.5);
  float dLo = (s - lo) * T, dHi = (hi - s) * T;                               // metres to the bedding planes under it and over it
  vec2 hb = rh2(vec2(bed, sd + 5.0)), hb2 = rh2(vec2(bed, sd + 11.0));
  float asp = 0.8 + 3.4 * hb.x * hb.x;                                        // long blocks in this bed, or short ones
  float x = (zz + (s - bed) * (hb.y - 0.5) * 0.5) / asp + hb2.x * 7.0, sj = bed * 0.37 + sd * 13.0;   // the joints lean, each bed's its own way
  float j = floor(x), fx = x - j, c = 0.5 + 0.64 * (rh1(vec2(j, sj)) - 0.5), blk = j + step(c, fx);
  float l = blk - 0.5 + 0.64 * (rh1(vec2(blk - 1.0, sj)) - 0.5), r = blk + 0.5 + 0.64 * (rh1(vec2(blk, sj)) - 0.5);
  float dL = (x - l) * asp * T, dR = (r - x) * asp * T;                       // metres to the joints either side; L is the side the light comes from
  vec2 id = vec2(blk, sj + 3.3); vec2 h0 = rh2(id), h1 = rh2(id + 31.7);
  float oL = rh2(id - vec2(1.0, 0.0)).x, oR = rh2(id + vec2(1.0, 0.0)).x, out0 = h0.x + hb2.y;   // how far out: the block's own, and its bed's
  float oUp = rh2(vec2(bed + 1.0, sd + 11.0)).y, oDn = rh2(vec2(bed - 1.0, sd + 11.0)).y;
  float stL = h0.x - oL, stR = h0.x - oR, stU = hb2.y - oUp, stD = hb2.y - oDn;
  float e = px * 0.8, em = mix(1.0, 0.35, smoothstep(12.0, 200.0, T / px));   // the big ones go quiet as you come close, and leave the small ones to speak
  // cracks: the joints, and the bedding planes (never thinner than a pixel; fainter instead)
  float cw = T * 0.014, cx = max(cw, e), jl = 0.35 + 0.65 * h1.y;
  rDark += kk * em * min(1.0, cw / cx) * max((1.0 - smoothstep(cx * 0.4, cx, min(dL, dR))) * jl, (1.0 - smoothstep(cx * 0.4, cx, min(dLo, dHi))) * (0.4 + 0.6 * hb.y));
  // shadow: from the block next to it on the light's side, if that one stands further out; and under a bed that overhangs this one
  float sw = max(-stL, 0.0) * T * 1.3, su = max(-stU, 0.0) * T * 0.7;
  rShd += kk * em * max((1.0 - smoothstep(sw * 0.5, sw + e, dL)) * step(0.02, -stL), (1.0 - smoothstep(su * 0.3, su + e, dHi)) * step(0.02, -stU) * 0.8);
  // its edges, broken back: the one toward the light shines, the far one is dark; more so the further it stands out past its neighbour
  float bw = T * 0.09, fb = kk * (1.0 - smoothstep(0.3, 0.9, px / bw));
  float bL = 1.0 - smoothstep(0.0, bw * (0.5 + 2.0 * max(stL, 0.0)), dL), bR = 1.0 - smoothstep(0.0, bw * (0.5 + 2.0 * max(stR, 0.0)), dR);
  float bU = 1.0 - smoothstep(0.0, bw, dHi), bD = 1.0 - smoothstep(0.0, bw * (0.5 + 2.0 * max(stD, 0.0)), dLo);
  rG += vec2(-bL * bL * (0.5 + 2.2 * max(stL, 0.0)) + bR * bR * (0.5 + 2.2 * max(stR, 0.0)), bU * bU * 0.8 - bD * bD * (0.4 + 1.2 * max(stD, 0.0))) * fb;
  // a thin pale line where an edge stands clear (chipped, and the dust on it), for when the edge itself is too small to see
  float rw = max(T * 0.02, e), rl = min(1.0, T * 0.02 / rw);
  rTone += kk * rl * 0.5 * max((1.0 - smoothstep(rw * 0.5, rw, dL)) * smoothstep(0.05, 0.4, stL), (1.0 - smoothstep(rw * 0.5, rw, dLo)) * smoothstep(0.05, 0.4, stD) * 0.7);
  // the block's own lean and shade, and its bed's
  rG += (h1 - 0.5) * 0.52 * kk * mix(1.0, 0.6, smoothstep(12.0, 200.0, T / px));
  rTone += ((h0.y - 0.5) * 0.20 + (out0 - 1.0) * 0.12 + (hb.y - 0.5) * 0.24) * kk;
}
#endif
#if KIND == 0 || KIND == 1
// the station's side: steel plate on every scale. Each size of plate is cut into smaller ones, and those again; every plate has its seam,
// its edges rolled down to it (lit on the side toward the open end), its own tilt, shade and polish; some carry a grille of louvres or a
// recessed hatch, rows of bolts run along the edges, grime lies along their lower edges and has run down from the seams, and here and there
// a tiny lamp. As with the rock, whatever is too small for a pixel from where you stand is left out, so it stays sharp at any distance.
vec2 hh2(vec2 p){ p = mod(p, 2048.0); vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float hh1(vec2 p){ p = mod(p, 2048.0); vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hG; float hTone, hDark, hRough; vec3 hLit;
void plates(vec2 u, float T, float sd, float px){
  float kk = 1.0 - smoothstep(0.10, 0.35, px / T); if (kk <= 0.0) return;
  float em = mix(1.0, 0.45, smoothstep(15.0, 250.0, T / px));        // the big ones go quiet as you come close
  vec2 cs = vec2(T * 1.7, T);                                         // plates run long, along the frames
  vec2 q = u / cs + sd * 7.31, ci = floor(q), f = q - ci;
  vec2 h = hh2(ci + sd * 17.0);
  float nx = h.x < 0.45 ? 1.0 : (h.x < 0.8 ? 2.0 : 3.0), ny = h.y < 0.55 ? 1.0 : 2.0;
  vec2 g = f * vec2(nx, ny), gi = floor(g), gf = g - gi, ps = cs / vec2(nx, ny);
  vec2 pid = ci * 3.0 + gi + sd * 41.0;
  vec2 d0 = gf * ps, d1 = (1.0 - gf) * ps;                            // metres to the plate's edges: below / to one side, above / the other
  float dm = min(min(d0.x, d1.x), min(d0.y, d1.y));
  vec2 r = hh2(pid + 3.7), r2 = hh2(pid + 19.1);
  float e = px * 0.8;
  // the seam (never thinner than a pixel: fainter instead)
  float sw = T * 0.008, sx = max(sw, e);
  hDark += kk * min(1.0, sw / sx) * (1.0 - smoothstep(sx * 0.35, sx, dm)) * 0.85;
  // its edges rolled down to the seam, and the plate never quite flat
  float bw = T * 0.035, fb = kk * em * (1.0 - smoothstep(0.12, 0.4, px / bw));   // only once it is a few pixels wide: thinner, it would only sparkle
  vec2 b0 = 1.0 - smoothstep(0.0, bw, d0), b1 = 1.0 - smoothstep(0.0, bw, d1);
  hG += (b1 * b1 - b0 * b0) * 0.9 * fb;
  hG += (r - 0.5) * 0.07 * kk * em;
  float tk = 1.0 - smoothstep(0.04, 0.15, px / T);                   // a plate only a few pixels across keeps its own shade to itself (no mosaic)
  hTone += ((r2.x - 0.5) * 0.20 + (h.y - 0.5) * 0.06) * kk * em * tk;
  hRough += (r2.y - 0.5) * 0.30 * kk * em;
  // grime along each plate's lower edge, and streaks run down from the seam above it
  float sk = 1.0 - smoothstep(0.15, 0.5, px / (ps.y * 0.06));
  float st = noise3(vec3(d0.y / max(ps.y * 0.05, 1e-3), pid.x * 0.37, pid.y * 0.21));
  hTone -= kk * em * (0.20 * (1.0 - smoothstep(0.0, ps.x * 0.22, d0.x)) + 0.22 * sk * smoothstep(0.45, 0.85, st) * (1.0 - smoothstep(0.0, ps.x * (0.3 + 0.5 * r.y), d1.x)));
  // what some plates carry, while it can still be seen
  float ins = T * 0.10; vec2 i0 = d0 - ins, i1 = d1 - ins; float di = min(min(i0.x, i1.x), min(i0.y, i1.y));   // inside the inset: > 0
  float fk = kk * (1.0 - smoothstep(0.25, 0.7, px / (T * 0.03)));
  if (fk > 0.0){
    if (r.x < 0.11){
      // a grille: louvres across it, each one a slat leaning out, a dark slot under it
      float inn = smoothstep(0.0, e + T * 0.004, di), lp = T * 0.04, lk = 1.0 - smoothstep(0.10, 0.25, px / lp), lf = fract(d0.x / lp);
      hG.x += inn * fk * lk * (0.9 - 1.8 * smoothstep(0.0, 0.85, lf)) * 0.45;
      hDark += inn * fk * (lk * (1.0 - smoothstep(0.0, 0.3, lf)) * 0.75 + (1.0 - lk) * 0.25);
      hDark += fk * (1.0 - smoothstep(0.0, max(T * 0.004, e), abs(di))) * 0.5;
      hRough += inn * fk * 0.3;
    } else if (r.x < 0.19){
      // a hatch: the panel set back into the plate, its rim casting a line of shadow on the light's side
      float inn = smoothstep(-e, e, di), rw = max(T * 0.012, e * 0.5);
      vec2 w0 = 1.0 - smoothstep(0.0, rw * 1.5, i0), w1 = 1.0 - smoothstep(0.0, rw * 1.5, i1);
      hG += inn * fk * (w0 - w1) * 0.6 * step(0.0, di) * (1.0 - smoothstep(0.15, 0.45, px / rw));
      hDark += fk * (1.0 - smoothstep(0.0, rw, abs(di))) * 0.6;
      hTone -= inn * fk * 0.10;
    } else if (r.x < 0.24){
      // a plate left darker, rougher: worn through its paint
      hTone -= fk * 0.18; hRough += fk * 0.35;
    }
    // bolts in rows just in from the long edges, and the short ones
    float bs = T * 0.06, br = T * 0.0075, bk = fk * (1.0 - smoothstep(0.5, 1.3, px / br));
    if (bk > 0.0){
      float off = T * 0.04;
      float la = length(vec2(abs(fract(d0.x / bs) - 0.5) * bs, min(abs(d0.y - off), abs(d1.y - off))));
      float lb = length(vec2(abs(fract(d0.y / bs) - 0.5) * bs, min(abs(d0.x - off), abs(d1.x - off))));
      float bd = min(la, lb);
      hTone += bk * (1.0 - smoothstep(br * 0.5, br, bd)) * 0.30;
      hDark += bk * (smoothstep(br * 0.7, br, bd) - smoothstep(br, br * 1.5, bd)) * 0.35;
    }
  }
  // a tiny lamp, very rarely: amber or white, some of them slowly blinking
  if (T > 6.0 && r2.x > 0.988){
    vec2 lc = vec2(ps.x * (0.15 + 0.7 * r.y), ps.y * (0.3 + 0.4 * r2.y)); float ls = T * 0.010, lr = max(ls, px * 0.75);
    float on = (1.0 - smoothstep(lr * 0.55, lr, length(d0 - lc))) * (ls / lr) * (ls / lr);
    float bl = r.x > 0.6 ? 0.25 + 0.75 * step(0.55, fract(uTime * (0.15 + 0.2 * r.y) + r.x * 7.0)) : 1.0;
    hLit += mix(vec3(1.0, 0.55, 0.22), vec3(0.75, 0.85, 1.0), step(0.55, h.x)) * 3.2 * on * bl;
  }
}
#endif
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN); if (dot(n, uCam - vW) < 0.0) n = -n;
  vec3 col; float glow = 0.0;
#if KIND == 0 || KIND == 1
  // the frames (0) and the skin between them (1): the same plate, the frames lighter and polished, the skin darker and duller
  vec2 pl = vW.xy - vec2(${((XR + XL) / 2).toFixed(1)}, ${(TOPY / 2).toFixed(1)});
  const vec2 SDV = vec2(${SD[0].toFixed(6)}, ${SD[1].toFixed(6)}), SNV = vec2(${SN[0].toFixed(6)}, ${SN[1].toFixed(6)});
  float a = dot(pl, SDV), b = dot(pl, SNV);                          // along the frames (up toward the cliff), and out of the skin into the hall
  vec3 ea = vec3(SDV, 0.0), eb; vec2 u;
  if (abs(n.z) > 0.7){ u = vec2(a, b); eb = vec3(SNV, 0.0); } else { u = vec2(a, vW.z); eb = vec3(0.0, 0.0, 1.0); }
  float px = length(fwidth(vW)) * 0.7 + 1e-4;
  hG = vec2(0.0); hTone = 0.0; hDark = 0.0; hRough = 0.0; hLit = vec3(0.0);
#if KIND == 0
  { float T = 150.0; for (int k = 0; k < 7; k++){ plates(u, T, float(k) * 2.0 + 1.0, px); T *= 0.36; } }
#else
  { float T = 260.0; for (int k = 0; k < 7; k++){ plates(u, T, float(k) * 2.0 + 21.0, px); T *= 0.36; } }
#endif
  // slow changes over the whole side, and long stains running down it
  hTone += (fbm3(vW * 0.0009) - 0.5) * 0.45
         + (noise3(vec3(u.y / 34.0, a / 1100.0, 1.0)) - 0.5) * 0.30 * (1.0 - smoothstep(0.1, 0.4, px / 34.0))
         + (noise3(vec3(u.y / 5.0, a / 160.0, 2.0)) - 0.5) * 0.18 * (1.0 - smoothstep(0.1, 0.4, px / 5.0));
  // close to, the grain of it
  { float k1 = 1.0 - smoothstep(0.12, 0.4, px / 0.25); if (k1 > 0.0) hTone += (noise3(vec3(u / 0.25, 3.0)) - 0.5) * 0.16 * k1; }
  // in the shadow of the frames: the skin close to them, and their sides close to the skin
#if KIND == 1
  float zr = mod(vW.z - ${(ZB - 120).toFixed(1)}, 520.0); zr = min(zr, 520.0 - zr);
  float occ = mix(0.40, 1.0, smoothstep(150.0, 330.0, zr));
#else
  float occ = abs(n.z) > 0.7 ? mix(0.50, 1.0, smoothstep(-150.0, 60.0, b)) : 1.0;
#endif
  vec2 g = hG / (1.0 + 0.4 * length(hG));
  vec3 ta = normalize(ea - n * dot(n, ea) + 1e-4), tb = normalize(eb - n * dot(n, eb) + 1e-4);
  vec3 nb = normalize(n + ta * g.x + tb * g.y);
  // where the bumps change faster than a pixel can show, the shine spreads and dims instead of breaking into sparks
  float nv = min(length(fwidth(nb)), 1.0), sq = 1.0 / (1.0 + nv * 8.0);
  float dk = clamp(hDark, 0.0, 1.0), tone = clamp(1.0 + hTone, 0.35, 1.8);
#if KIND == 0
  vec3 alb = vec3(0.085, 0.10, 0.12) * tone * (1.0 - 0.78 * dk) * occ;
  float rg = clamp(0.32 + hRough * 0.35, 0.16, 0.75); rg = min(sqrt(rg * rg + nv * 0.8), 0.95);   // never past 1: shade() raises to a power that turns negative there
  col = shade(vW, nb, alb, rg, 1.2 * (1.0 - 0.6 * dk) * sq);
#else
  vec3 alb = vec3(0.040, 0.046, 0.055) * tone * (1.0 - 0.75 * dk) * occ;
  float rg = clamp(0.62 + hRough * 0.30, 0.30, 0.92); rg = min(sqrt(rg * rg + nv * 0.8), 0.95);   // never past 1: shade() raises to a power that turns negative there
  col = shade(vW, nb, alb, rg, 0.30 * (1.0 - 0.6 * dk) * sq);
#endif
  col += hLit; glow = clamp(max(hLit.r, hLit.b), 0.0, 1.0);
#elif KIND == 2
  // the cliff: bare dark rock. Nothing here is soft: it is broken into blocks, the blocks into smaller blocks and those again, each one
  // tilted its own way with a crack round it; it lies in beds, some of them standing out as ledges; it is worn into flutes running down it;
  // and what is too small for a pixel from where you stand is left out, so twelve kilometres off it is still sharp, and so it is at arm's length
#ifdef CAPX
  vec2 u = vW.xy;                                                   // the rock's broken-off end faces -z: its pattern runs across x
#elif defined(CAPY)
  vec2 u = vW.zx;                                                   // the underside of the rock over the platform's way through
#else
  vec2 u = vW.zy;
#endif
  float px = length(fwidth(vW)) * 0.7 + 1e-4;                       // metres to a pixel, here
  float face = n.x > 0.0 ? 1.0 : -1.0;                              // the hall's side of it, or the outside
  rG = vec2(0.0); rTone = 0.0; rDark = 0.0; rShd = 0.0;
  // slow changes across the whole of it, and a wander to put on everything else so that nothing runs straight
  vec3 w1 = gnoise(u / 2600.0 + 3.7), w2 = gnoise(u / 640.0 + 11.3), w3 = gnoise(u / 640.0 + 41.9);
  rTone += w1.x * 0.30 + w2.x * 0.16;
  vec2 uw = u + vec2(w2.x, w3.x) * 110.0 + vec2(w1.x, -w1.x) * 260.0;
  // beds and blocks, six sizes of them: from a third of a kilometre thick down to a step
  { float T = 340.0; for (int k = 0; k < 6; k++){ beds(uw, T, 1.0 + float(k) * 2.0, px); T *= 0.3; } }
  // worn: flutes and ribs running down the face, creased, at every size; whatever is just big enough to see is what stands out most
  { mat2 R = mat2(1.0, 0.0, 0.0, 1.0); const mat2 M = mat2(0.8, 0.6, -0.6, 0.8); vec2 A = vec2(1.0, 0.40), q = uw * A / 260.0 + 5.3; float lam = 260.0, hs = 0.0, an = 0.0;
    for (int k = 0; k < 14; k++){
      float kk = 1.0 - smoothstep(0.16, 0.45, px / lam); if (kk <= 0.0) break;
      kk *= mix(1.0, 0.14, smoothstep(6.0, 80.0, lam / px));
      vec3 nn = gnoise(q); float r = 1.0 - min(abs(nn.x) * 1.7, 1.0);
      hs += (r * r - 0.3) * kk; an += kk;
      rG += (nn.yz * R) * A * (2.0 * r * 1.7 * sign(nn.x) * 0.13) * kk;
      q = M * q * 1.93; R = M * R; lam /= 1.93;
    }
    rTone += hs / max(an, 1.0) * 0.55;
  }
  vec2 g = rG; float tone = rTone, dark = rDark;
  // stains run down it
  tone += gnoise(vec2(u.x / 46.0, u.y / 1100.0) + 2.2).x * 0.22 * (1.0 - smoothstep(0.1, 0.4, px / 46.0))
        + gnoise(vec2(u.x / 9.0, u.y / 330.0) + 8.1).x * 0.14 * (1.0 - smoothstep(0.1, 0.4, px / 9.0));
  // and close to, its grain
  { float k1 = 1.0 - smoothstep(0.12, 0.4, px / 0.30), k2 = 1.0 - smoothstep(0.12, 0.4, px / 0.06);
    if (k1 > 0.0){ vec3 a = gnoise(u / 0.30 + 1.9); g += a.yz * 0.35 * k1; tone += a.x * 0.20 * k1; }
    if (k2 > 0.0){ vec3 a = gnoise(u / 0.06 + 6.4); g += a.yz * 0.25 * k2; tone += a.x * 0.16 * k2; } }
  // the hollows of the cliff's own shape sit in shade, its ridges stand a little clear
  float cv = vAO * face, occ = 1.0 - 0.50 * smoothstep(0.0, 0.9, -cv) + 0.14 * smoothstep(0.0, 0.9, cv);
  g /= 1.0 + 0.4 * length(g);
#ifdef CAPX
  vec3 ez = normalize(vec3(1.0, 0.0, 0.0) - n * n.x + 1e-4), ey = normalize(vec3(0.0, 1.0, 0.0) - n * n.y + 1e-4);
#elif defined(CAPY)
  vec3 ez = normalize(vec3(0.0, 0.0, 1.0) - n * n.z + 1e-4), ey = normalize(vec3(1.0, 0.0, 0.0) - n * n.x + 1e-4);
#else
  vec3 ez = normalize(vec3(0.0, 0.0, 1.0) - n * n.z + 1e-4), ey = normalize(vec3(0.0, 1.0, 0.0) - n * n.y + 1e-4);
#endif
  vec3 nb = normalize(n + ez * g.x + ey * g.y);
  vec3 alb = mix(vec3(0.022, 0.021, 0.020), vec3(0.098, 0.092, 0.083), clamp(0.52 + tone, 0.0, 1.0));
  alb = mix(alb, vec3(0.105, 0.102, 0.098), smoothstep(0.30, 0.85, nb.y) * 0.55);      // dust lying where it can
  alb *= (1.0 - 0.80 * clamp(dark, 0.0, 1.0)) * (1.0 - 0.62 * clamp(rShd, 0.0, 1.0)) * occ;
  col = shade(vW, nb, alb, 0.88, 0.05);
#elif KIND == 3
  // concrete: the back wall and the low wall at the end
  float g = max(lines(vW.x + 30.0, 60.0, 0.25), lines(vW.y, 30.0, 0.2));
  vec3 alb = vec3(0.07, 0.075, 0.08) * (0.8 + 0.4 * fbm3(vW * 0.05)) * (1.0 - 0.35 * g);
  col = shade(vW, n, alb, 0.6, 0.2);
#elif KIND == 5
  // the little door: painted steel, a frame round it
  vec3 alb = vec3(0.30, 0.31, 0.30);
  col = shade(vW, n, alb, 0.4, 0.5);
#elif KIND == 8
  // the tug's paint: glossy, a clear coat that shows the light of the open end, brighter at a glancing angle
  vec3 v8 = normalize(uCam - vW); float fr = pow(1.0 - max(dot(n, v8), 0.0), 5.0);
  col = shade(vW, n, uBase, 0.16, 1.5) + uBase * vec3(0.035, 0.04, 0.05) * (0.6 + 0.4 * max(n.y, 0.0)) + vec3(0.06, 0.08, 0.11) * fr;
#elif KIND == 9
  // rubber: near black, rough, the tread cut across the face of the tyre
  float tr = step(0.5, fract(vUv2.x * 64.0)) * smoothstep(0.25, 0.3, vUv2.y) * smoothstep(0.75, 0.7, vUv2.y);
  vec3 alb = vec3(0.028, 0.028, 0.03) * (1.0 - 0.5 * tr);
  col = shade(vW, n, alb, 0.8, 0.05) + alb * 0.4;
#elif KIND == 10
  // bright metal: the bumper, rims, lamp rims, the chequered step plate
  vec3 alb = vec3(0.55, 0.56, 0.58) * (0.9 + 0.2 * step(0.5, fract((vW.x + vW.z) * 30.0)) * step(0.5, fract((vW.x - vW.z) * 30.0)));
  col = shade(vW, n, alb, 0.12, 2.2) + alb * vec3(0.04, 0.045, 0.055);
#elif KIND == 11
  // black plastic, the steel frame, the seat: dark, satin
  vec3 alb = vec3(0.035, 0.036, 0.04);
  col = shade(vW, n, alb, 0.45, 0.35) + alb * 0.5;
#elif KIND == 7
  // the white platform and its rails
  float g = max(lines(vW.x, 12.0, 0.04), lines(vW.z, 12.0, 0.04));
  vec3 alb = vec3(0.66, 0.67, 0.68) * (0.92 + 0.12 * fbm3(vW * 0.05)) * (1.0 - 0.25 * g);
  col = shade(vW, n, alb, 0.45, 0.4) + alb * vec3(0.05, 0.06, 0.08);
#elif KIND == 6
  // the car: glossy white paint, with a little light of its own so it never vanishes into the dark
  vec3 alb = vec3(0.78, 0.79, 0.80);
  col = shade(vW, n, alb, 0.22, 1.6) + alb * vec3(0.035, 0.04, 0.05) * (0.6 + 0.4 * max(n.y, 0.0));
#else
  col = uBase; glow = 1.0;
#endif
  gl_FragColor = vec4(mix(haze(col, vW), col, glow * 0.5), 1.0);
}`;
const uMirrorVP = { value: new THREE.Matrix4() };
const matCache = {};
function mat(kind, base = [0, 0, 0], key = '') {
  const k = kind + key; if (matCache[k]) return matCache[k];
  return (matCache[k] = new THREE.ShaderMaterial({ uniforms: { uCam, uTime, uMirrorVP, uBase: { value: new V3(...base) } }, vertexShader: VERT, fragmentShader: FRAG, defines: { KIND: kind }, side: THREE.DoubleSide }));
}
const add = (geo, m) => { const me = new THREE.Mesh(geo, m); scene.add(me); return me; };

/* ---------------- the frames ---------------- */
{
  const ang = Math.atan2(SD[1], SD[0]), mx = (XR + XL) / 2, my = TOPY / 2, parts = [];
  const LEN = SL + 2600;   // run on past the cliff top and down through the floor
  // three beams to a frame, stepped: the big one on the line, two narrower ones standing out of it into the hall
  const STEPS = [{ t: 300, d: 300, o: 0 }, { t: 130, d: 190, o: 200 }, { t: 60, d: 110, o: 290 }];
  for (let z = ZB - 120; z >= ZE - 1; z -= 520) {
    for (const s of STEPS) {
      const g = new THREE.BoxGeometry(LEN, s.t, s.d); g.rotateZ(ang); g.translate(mx + SD[0] * 600 + SN[0] * s.o, my + SD[1] * 600 + SN[1] * s.o, z); parts.push(g);
    }
  }
  add(mergeGeometries(parts), mat(0));
  // the skin behind them, one plane the length of the hall
  const sk = new THREE.PlaneGeometry(LEN, ZB - ZE + 400); sk.rotateY(Math.PI / 2); sk.rotateX(0);   // in (z, y), facing +x
  const p = sk.attributes.position;
  for (let i = 0; i < p.count; i++) { const zz = p.getZ(i), u = p.getY(i); p.setXYZ(i, mx + SD[0] * (u + 600) - SN[0] * 150, my + SD[1] * (u + 600) - SN[1] * 150, zz + (ZB + ZE) / 2 - 200); }
  sk.computeVertexNormals(); add(sk, mat(1));
}

/* ---------------- the cliff ---------------- */
// how far the rock comes out into the hall (from x = XL) at height y, position z: big ridges, smaller ones, and leaning out a little near the top
function n2(x, y) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; }
function rfbm(x, y) { let a = 0.5, s = 0; for (let k = 0; k < 6; k++) { const r = 1 - Math.abs(n2(x, y) * 2 - 1); s += a * r * r; x = x * 2.02 + 3.1; y = y * 2.02 + 7.3; a *= 0.5; } return s; }
const cliffOut = (y, z) => 80 + 620 * rfbm(z / 2600, y / 2600) + 260 * Math.sin(z / 1900 + 1.3) * Math.sin(y / 2300) + 500 * Math.pow(clamp((y - 6000) / 7000, 0, 1), 2);
const CZ1 = ZE - 1700;   // the rock runs on past the end of the floor, out into the light
{
  const NZ = 230, NY = 200, W = ZB + 300 - CZ1, Hh = 13600;
  const g = new THREE.PlaneGeometry(W, Hh, NZ, NY); g.rotateY(Math.PI / 2);   // spans z (as its x) and y, faces +x
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) + (ZB + 300 + CZ1) / 2, y = p.getY(i) + Hh / 2 - 300;
    let x = XL + cliffOut(y, z);
    if (z < ZE + 300) x -= Math.pow((ZE + 300 - z) / 1400, 2) * 900 * (0.6 + 0.4 * rfbm(y / 900, z / 900));   // its far edge breaks back, ragged
    p.setXYZ(i, x, y, z);
  }
  // a slot at its foot where the platform runs out under it
  { const ix = g.index.array, keep = []; for (let t = 0; t < ix.length; t += 3) { let cut = true; for (let q = 0; q < 3; q++) { const v = ix[t + q], y = p.getY(v), z = p.getZ(v); if (!(y < 112 && z > PZ1 - 70 && z < ZE + 70)) cut = false; } if (!cut) keep.push(ix[t], ix[t + 1], ix[t + 2]); } g.setIndex(keep); }
  // how far each point stands out of the rock round it (a ridge) or sits back in it (a hollow), near and wide: the shader shades by it
  { const C = NZ + 1, Rr = NY + 1, H0 = new Float32Array(p.count); for (let i = 0; i < p.count; i++) H0[i] = p.getX(i);
    const blur = (s, R) => { const t = new Float32Array(s.length), o = new Float32Array(s.length);
      for (let j = 0; j < Rr; j++) for (let i = 0; i < C; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const ii = i + k; if (ii >= 0 && ii < C) { a += s[j * C + ii]; c++; } } t[j * C + i] = a / c; }
      for (let j = 0; j < Rr; j++) for (let i = 0; i < C; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const jj = j + k; if (jj >= 0 && jj < Rr) { a += t[jj * C + i]; c++; } } o[j * C + i] = a / c; }
      return o; };
    const b1 = blur(H0, 2), b2 = blur(H0, 9), ao = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) ao[i] = clamp((H0[i] - b1[i]) / 38 * 0.55 + (H0[i] - b2[i]) / 170 * 0.6, -1, 1);
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); }
  g.computeVertexNormals();
  add(g, new THREE.ShaderMaterial({ uniforms: { uCam, uTime, uMirrorVP, uBase: { value: new V3() } }, defines: { KIND: 2 }, side: THREE.DoubleSide, fragmentShader: FRAG,
    vertexShader: VERT.replace('uniform mat4 uMirrorVP;', 'uniform mat4 uMirrorVP; attribute float aAO; varying float vAO;').replace('void main(){', 'void main(){ vAO = aAO;') }));
}

// The cliff is seen from outside too (from the platform past the end of the hall), so it is not a sheet but solid rock: all along its length
// it has a back, 0.9 to 1.6 km behind its face, and both its ends (the broken-off one out in the light, and the far one) close the gap.
{
  const NY = 200, Hh = 13600, y0 = -300, Z0b = CZ1, Z1b = ZB + 300, NZ = 230, NS = 14;
  const front = (y, z) => { let x = XL + cliffOut(y, z); if (z < ZE + 300) x -= Math.pow((ZE + 300 - z) / 1400, 2) * 900 * (0.6 + 0.4 * rfbm(y / 900, z / 900)); return x; };
  const thick = (y, z) => 900 + 700 * rfbm(z / 1500 + 9.1, y / 1500 + 2.3);
  const mesh = (pos, idx, cap) => {   // cap: false (the face's own pattern), true (across x), 'y' (lying flat)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1)); g.computeVertexNormals();
    add(g, new THREE.ShaderMaterial({ uniforms: { uCam, uTime, uMirrorVP, uBase: { value: new V3() } }, defines: cap === 'y' ? { KIND: 2, CAPY: 1 } : cap ? { KIND: 2, CAPX: 1 } : { KIND: 2 }, side: THREE.DoubleSide, fragmentShader: FRAG,
      vertexShader: VERT.replace('uniform mat4 uMirrorVP;', 'uniform mat4 uMirrorVP; attribute float aAO; varying float vAO;').replace('void main(){', 'void main(){ vAO = aAO;') }));
  };
  const grid = (C, R, at, cut) => { const pos = [], idx = [];
    for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) pos.push(...at(i / C, j / R));
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1;
      if (cut && cut(pos, [a, b, c, d])) continue; idx.push(a, c, b, b, c, d); }
    return [pos, idx]; };
  // the back: the face pushed in by the rock's thickness (with a slot at its foot where the platform runs under, like the face)
  const back = grid(NZ, NY, (u, v) => { const z = Z0b + (Z1b - Z0b) * u, y = y0 + Hh * v; return [front(y, z) - thick(y, z), y, z]; },
    (pos, q) => q.every((k) => pos[k * 3 + 1] < 112 && pos[k * 3 + 2] > PZ1 - 70 && pos[k * 3 + 2] < ZE + 70));
  mesh(back[0], back[1], false);
  // the end: from the face's last edge to the back's, bulging out a little, ragged, as broken rock does
  const end = grid(NS, NY, (s, v) => { const y = y0 + Hh * v, xf = front(y, CZ1), xb = xf - thick(y, CZ1);
    const b = Math.sin(Math.PI * s) * (120 + 260 * rfbm(y / 700 + 4.2, s * 3.0 + 1.7)); return [xf + (xb - xf) * s, y, CZ1 - b]; });
  mesh(end[0], end[1], true);
  const end2 = grid(NS, NY, (s, v) => { const y = y0 + Hh * v, xf = front(y, Z1b), xb = xf - thick(y, Z1b);
    const b = Math.sin(Math.PI * s) * (120 + 260 * rfbm(y / 700 + 8.6, s * 3.0 + 5.1)); return [xf + (xb - xf) * s, y, Z1b + b]; });
  mesh(end2[0], end2[1], true);
  // and its top, from the face's upper edge back to the back's
  const top = grid(NZ, NS, (u, s) => { const z = Z0b + (Z1b - Z0b) * u, y = y0 + Hh, xf = front(y, z), xb = xf - thick(y, z);
    return [xf + (xb - xf) * s, y + Math.sin(Math.PI * s) * (60 + 140 * rfbm(z / 600 + 2.2, s * 3.0)), z]; });
  mesh(top[0], top[1], false);
  // the platform's way through at its foot is a tunnel in solid rock, not a gap into a hollow: a rock roof over it, and rock at both its sides
  const TY = 108, za = PZ1 - 70, zb = ZE + 70, ru = (a, b) => 18 * (rfbm(a, b) - 0.5);
  const roof = grid(16, 16, (s, u) => { const z = za + (zb - za) * u, xf = front(TY, z) + 30, xb = xf - 30 - thick(TY, z) - 30; return [xf + (xb - xf) * s, TY + ru(s * 4.1, u * 6.3), z]; });
  mesh(roof[0], roof[1], 'y');
  for (const z of [za, zb]) {
    const side = grid(16, 6, (s, v) => { const y = -5 + (TY + 10) * v, xf = front(y, z) + 30, xb = xf - 30 - thick(y, z) - 30; return [xf + (xb - xf) * s, y, z + ru(s * 3.7 + z, v * 2.9)]; });
    mesh(side[0], side[1], true);
  }
}

/* ---------------- floor, walls ---------------- */
const floorMat = new THREE.ShaderMaterial({
  uniforms: { uCam, uTime, uMirrorVP, uRefl: { value: null }, uPx: { value: new THREE.Vector2(1, 1) } },
  vertexShader: VERT,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
  ${NOISE}${LIGHT}
  uniform sampler2D uRefl; uniform vec2 uPx;
  varying vec3 vW; varying vec3 vN; varying vec4 vR;
  float lines(float v, float period, float w){ float f = abs(fract(v / period + 0.5) - 0.5) * period; float aa = fwidth(v) * 1.2; return 1.0 - smoothstep(w - aa, w + aa, f); }
  void main(){
    #include <logdepthbuf_fragment>
    vec2 q = vW.xz;
    // wet where it is wet: big pools, and smaller patches inside them
    float big = fbm3(vec3(q / 520.0, 0.0)), mid = fbm3(vec3(q / 46.0, 3.0)), small = noise3(vec3(q / 3.2, 7.0));
    float wet = clamp(smoothstep(0.38, 0.62, big) * 0.75 + smoothstep(0.42, 0.68, mid) * 0.35 + 0.08, 0.0, 1.0);
    // the floor: great slabs, joints between them, finer lines inside
    float j = max(lines(q.x, 240.0, 0.6), lines(q.y, 240.0, 0.6)), j2 = max(lines(q.x, 24.0, 0.04), lines(q.y, 24.0, 0.04));
    vec3 alb = vec3(0.060, 0.066, 0.074) * (0.75 + 0.5 * mid + 0.15 * small) * (1.0 - 0.55 * j - 0.18 * j2);
    vec3 n = vec3(0.0, 1.0, 0.0);
    vec3 col = shade(vW, n, alb * (1.0 - 0.45 * wet), 0.7, 0.0);
    // the hall seen in it: looked up in the upside-down picture, a little broken up by the surface, softer where it is dry
    vec2 uv = vR.xy / vR.w * 0.5 + 0.5;
    vec2 wob = (vec2(noise3(vec3(q / 7.0, 1.0)), noise3(vec3(q / 7.0, 5.0))) - 0.5) * 0.012 * (1.2 - wet);
    float rad = mix(9.0, 1.2, wet);
    vec3 rf = vec3(0.0);
    for (int k = 0; k < 7; k++){ float a = float(k) * 2.39996; float r = sqrt(float(k) / 7.0) * rad; rf += texture2D(uRefl, uv + wob + vec2(cos(a), sin(a)) * r * uPx).rgb; }
    rf /= 7.0;
    vec3 v = normalize(uCam - vW);
    float fres = 0.04 + 0.96 * pow(1.0 - max(v.y, 0.0), 5.0);
    float k = mix(0.12, 0.92, wet) * mix(0.55, 1.0, fres);
    col = col * (1.0 - k * 0.6) + rf * k;
    gl_FragColor = vec4(haze(col, vW), 1.0);
  }`,
});
const floor = add((() => { const g = new THREE.PlaneGeometry(XR - XL + 1200, ZB - ZE); g.rotateX(-Math.PI / 2); g.translate((XR + XL) / 2 + 400, 0, (ZB + ZE) / 2); return g; })(), floorMat);
// the back wall (a great plane; only the part inside the hall is ever seen), with the door. It goes up only to WALL_H, its top a thick
// straight edge; above it the back of the hall is open, and you look out into space (and at the sun, from the middle of the hall)
{
  const s = new THREE.Shape([new THREE.Vector2(-7000, 0), new THREE.Vector2(DOOR.x - DOOR.w / 2, 0), new THREE.Vector2(DOOR.x - DOOR.w / 2, DOOR.h), new THREE.Vector2(DOOR.x + DOOR.w / 2, DOOR.h), new THREE.Vector2(DOOR.x + DOOR.w / 2, 0), new THREE.Vector2(7000, 0), new THREE.Vector2(7000, WALL_H), new THREE.Vector2(-7000, WALL_H)]);
  const g = new THREE.ShapeGeometry(s); g.translate(0, 0, ZB); add(g, mat(3));
  const box = (x0, y0, z0, x1, y1, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  add(box(-7000, WALL_H - 24, ZB, 7000, WALL_H, ZB + 90), mat(3));                                                                 // its top edge, with some thickness to it
  add(box(DOOR.x - DOOR.w / 2, 0, ZB - 0.02, DOOR.x + DOOR.w / 2, DOOR.h, ZB + 0.04), mat(5));                                   // the door, shut
  add(mergeGeometries([box(DOOR.x - DOOR.w / 2 - 0.08, 0, ZB - 0.06, DOOR.x - DOOR.w / 2, DOOR.h + 0.08, ZB), box(DOOR.x + DOOR.w / 2, 0, ZB - 0.06, DOOR.x + DOOR.w / 2 + 0.08, DOOR.h + 0.08, ZB),
    box(DOOR.x - DOOR.w / 2 - 0.08, DOOR.h, ZB - 0.06, DOOR.x + DOOR.w / 2 + 0.08, DOOR.h + 0.08, ZB)]), mat(5));
  add(box(DOOR.x + 0.32, 1.0, ZB - 0.07, DOOR.x + 0.42, 1.04, ZB - 0.02), mat(4, [0.6, 0.6, 0.55], 'knob'));
  add(box(DOOR.x - 0.16, 2.68, ZB - 0.12, DOOR.x + 0.16, 2.78, ZB), mat(4, [6.0, 4.4, 2.6], 'doorlamp'));                        // the lamp over it
  // the low wall at the far end, and its line of light
  add(box(XL - 600, 0, PZ1 - PAR_D, XR + 900, PAR_H, PZ1), mat(3));
  add(box(XL - 600, STRIP_Y - 14, PZ1 + 0.5, XR + 900, STRIP_Y + 14, PZ1 + 3), mat(4, [1.3, 1.4, 1.5], 'strip')   /* toned down: it was glaring (was 3.6, 3.9, 4.2) */);
}

/* ---------------- little lights: how big it is ---------------- */
let blinkMat = null;
{
  const white = [], red = [];
  // along the top of the low wall
  for (let x = XL + 150; x < XR + 800; x += 260) white.push(x, PAR_H + 4, PZ1 - PAR_D / 2);
  // on the front edge of every frame: red lights at intervals up it
  for (let z = ZB - 120; z >= ZE - 1; z -= 520) for (let u = 900; u < SL; u += 1700) { const x = XR + SD[0] * u + SN[0] * 290, y = SD[1] * u + SN[1] * 290; red.push(x, y, z - 58); }
  // a few far up the cliff, where something must once have been fixed to it
  const r = mulberry32(7);
  for (let k = 0; k < 40; k++) { const z = ZB - r() * (ZB - ZE), y = 600 + r() * 9000; white.push(XL + cliffOut(y, z) + 12, y, z); }
  const pts = (arr, color, size) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, depthWrite: false }); const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return m; };
  pts(white, new THREE.Color(2.2, 2.3, 2.5), 2.0);
  blinkMat = pts(red, new THREE.Color(4, 0.35, 0.25), 2.6);
}

/* ---------------- the sky ---------------- */
// worked out per pixel from the direction looked in, in kilometres: the Earth 420 km below (its upper edge about 13 degrees above level, straight
// ahead out of the open end; the station keeps its own "down"), its thin bright air, the stars, and a ring round it, one edge of which glows orange
const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 64, 32), new THREE.ShaderMaterial({
  uniforms: { uTime, uSun: { value: 1 } }, side: THREE.BackSide, depthWrite: false, depthTest: false,
  vertexShader: `#include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
  }`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
  ${NOISE}
  uniform float uTime, uSun; varying vec3 vD;
  const float R = 6371.0, H = 420.0;
  // a galaxy far off, seen as a smudge: its disc turned at a slant (incl), turned in the picture (pa), with spiral arms if arms > 0
  float galaxy(vec3 rd, vec3 dir, float size, float incl, float pa, float arms){
    if (dot(rd, dir) < 0.99) return 0.0;
    vec3 ex = normalize(cross(dir, vec3(0.0, 1.0, 0.0))), ey = cross(ex, dir);
    vec2 p = vec2(dot(rd, ex), dot(rd, ey)) / size; float c = cos(pa), s = sin(pa); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y); p.y /= cos(incl);
    float r = length(p); if (r > 3.5) return 0.0;
    float th = atan(p.y, p.x), sp = 0.5 + 0.5 * cos(2.0 * (th - 2.4 * log(r + 0.06)));
    float knots = fbm(vec3(p * 7.0, size * 300.0));
    float disk = exp(-r * 2.0) * mix(1.0, sp * (0.4 + 1.0 * knots), arms);
    float lane = arms > 0.0 ? 1.0 - 0.5 * smoothstep(0.35, 0.65, knots) * exp(-r * 1.5) * (1.0 - sp) : 1.0;
    return disk * lane + exp(-r * r * 30.0) * 1.4;
  }
  void main(){
    #include <logdepthbuf_fragment>
    vec3 rd = normalize(vD);
    float el = radians(-57.0), az = 0.10;
    vec3 C = normalize(vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el))) * (R + H);
    vec3 S = normalize(vec3(-0.45, 0.62, 0.62));
    vec3 col = vec3(0.0);
    // stars
    vec3 q = rd * 420.0, id = floor(q); float h = hash3(id);
    if (h > 0.9975) { vec3 c = id + 0.5 + (vec3(hash3(id + 1.3), hash3(id + 2.7), hash3(id + 5.1)) - 0.5) * 0.6; float d = length(q - c); col += vec3(0.75, 0.82, 1.0) * smoothstep(0.16, 0.0, d) * (0.4 + 2.2 * fract(h * 931.7)); }
    // Behind the station (only that half of the sky: what lies ahead, out of the open end, is left as it was): our own galaxy, a great band
    // of star clouds across it with lanes and rifts of dark dust, its core a warm glow low down, dense faint stars along it, red and grey-blue
    // gas here and there; and other galaxies far off. All of it faint: it is only seen, it lights nothing.
    float back = smoothstep(-0.05, 0.40, rd.z);
    if (back > 0.0) {
      vec3 Gc = normalize(vec3(0.02, 0.10, 1.0)), Ng = normalize(cross(Gc, normalize(vec3(-0.62, 0.78, 0.0)))), Gb = cross(Ng, Gc);
      float gb = dot(rd, Ng), gl = atan(dot(rd, Gb), dot(rd, Gc));
      float wv = 0.06 + 0.11 * exp(-gl * gl / 0.30);                                  // the band thickens toward the core
      float wav = gb - 0.022 * sin(gl * 2.3 + 1.0) - 0.008 * sin(gl * 6.1);
      float band = exp(-pow(wav / wv, 2.0));
      float clouds = fbm(rd * 9.0) * 0.55 + fbm(rd * 33.0) * 0.45;
      float dust = smoothstep(0.42, 0.70, fbm(rd * 14.0 + 3.0)) * exp(-pow((wav + 0.012) / (wv * 0.5), 2.0));
      float rift = exp(-pow((wav - 0.006 * sin(gl * 7.0)) / (wv * 0.16), 2.0)) * smoothstep(0.30, 0.60, fbm(rd * 6.0 + 9.0));
      float core = exp(-(gl * gl + pow(gb * 1.7, 2.0)) / 0.045);
      vec3 mw = mix(vec3(0.40, 0.47, 0.62), vec3(0.95, 0.76, 0.52), clamp(core * 1.4 + exp(-gl * gl / 0.5) * 0.35, 0.0, 1.0));
      float I = (band * (0.30 + 1.0 * smoothstep(0.32, 0.78, clouds)) + core * 1.3) * (1.0 - 0.88 * clamp(dust + rift, 0.0, 1.0));
      vec3 gcol = mw * I * 0.075;
      // the faint stars thick in the band (and a few out of it)
      vec3 q2 = rd * 560.0, id2 = floor(q2); float h2 = hash3(id2 + 0.37);
      if (h2 > 0.992 - 0.10 * band * (1.0 - dust)) { vec3 c2 = id2 + 0.5 + (vec3(hash3(id2 + 1.7), hash3(id2 + 3.1), hash3(id2 + 4.9)) - 0.5) * 0.5;
        gcol += mix(vec3(0.78, 0.85, 1.0), vec3(1.0, 0.84, 0.66), hash3(id2 + 8.0)) * smoothstep(0.30, 0.0, length(q2 - c2)) * (0.12 + 0.55 * fract(h2 * 517.3)); }
      // glowing gas along it
      float neb = smoothstep(0.56, 0.80, fbm(rd * 7.0 + 21.0)) * exp(-pow(wav / (wv * 1.5), 2.0));
      gcol += mix(vec3(0.70, 0.16, 0.26), vec3(0.22, 0.40, 0.58), smoothstep(0.42, 0.60, fbm(rd * 4.0 + 5.0))) * neb * 0.045 * (0.5 + fbm(rd * 40.0));
      // other galaxies: a big spiral at a slant, a thin one edge-on, a round one; and faint specks of more, far beyond
      gcol += vec3(0.80, 0.84, 1.0) * galaxy(rd, normalize(vec3(-0.34, 0.30, 0.89)), 0.034, 1.05, 0.7, 1.0) * 0.11;
      gcol += vec3(0.95, 0.90, 0.82) * galaxy(rd, normalize(vec3(0.10, 0.36, 0.93)), 0.020, 1.50, -0.5, 0.0) * 0.10;
      gcol += vec3(1.0, 0.88, 0.72) * galaxy(rd, normalize(vec3(-0.30, 0.13, 0.95)), 0.008, 0.55, 0.3, 0.0) * 0.12;
      { vec3 q3 = rd * 70.0, id3 = floor(q3); float h3 = hash3(id3 + 2.9);
        if (h3 > 0.93) { vec3 c3 = id3 + 0.5 + (vec3(hash3(id3 + 4.1), hash3(id3 + 6.3), hash3(id3 + 7.7)) - 0.5) * 0.6, dv = q3 - c3;
          vec3 ax = normalize(vec3(hash3(id3 + 9.1), hash3(id3 + 1.9), hash3(id3 + 3.3)) - 0.5); float al = dot(dv, ax);
          float d3 = length(dv - ax * al * 0.65);   // stretched along its own axis
          gcol += vec3(0.85, 0.85, 0.95) * exp(-d3 * d3 / 0.0045) * 0.05 * (0.4 + fract(h3 * 77.0)); } }
      col += gcol * back;
    }
    // the Earth
    float b = dot(rd, C), cc = dot(C, C) - R * R, disc = b * b - cc, tE = 1e9;
    if (disc > 0.0 && b > 0.0) {
      tE = b - sqrt(disc);
      vec3 P = rd * tE, N = (P - C) / R;
      // the ground: continents with ragged coasts (the sphere a little warped first, so nothing comes out round), shallow seas
      // round them, green and dry country, mountains, ice toward the poles
      vec3 Nw = N + (vec3(fbm(N * 4.0 + 1.0), fbm(N * 4.0 + 7.0), fbm(N * 4.0 + 13.0)) - 0.5) * 0.09;
      float cont = fbm8(Nw * 3.2 + 3.0), land = smoothstep(0.515, 0.53, cont), shelf = smoothstep(0.47, 0.515, cont) * (1.0 - land);
      float mtn = fbm8(Nw * 22.0 + 5.0), dry = smoothstep(0.42, 0.62, fbm(Nw * 7.0 + 2.0));
      vec3 lc = mix(vec3(0.045, 0.085, 0.035), vec3(0.34, 0.25, 0.15), dry) * (0.7 + 0.6 * mtn);
      lc = mix(lc, vec3(0.55, 0.52, 0.48), smoothstep(0.62, 0.72, mtn) * 0.6);                              // bare rock on the high ground
      float lat = abs(dot(N, normalize(vec3(0.15, 1.0, 0.25))));
      lc = mix(lc, vec3(0.86, 0.89, 0.92), smoothstep(0.80, 0.86, lat + 0.06 * fbm(Nw * 9.0)));             // ice
      vec3 sea = mix(vec3(0.004, 0.028, 0.085), vec3(0.02, 0.13, 0.19), shelf);
      vec3 surf = mix(sea, lc, land);
      // the clouds: big swirling systems, streets of small ones, thin veils, and where they are thick a bluer grey underneath
      // (the whole of the weather is carried slowly over the ground, the same clouds, turning about an axis chosen so that from the station they go up and to the left)
      vec3 ax = vec3(0.845, 0.300, -0.443); float ca = cos(uTime * 0.0012), sa = sin(uTime * 0.0012);
      vec3 Nc = Nw * ca + cross(ax, Nw) * sa + ax * dot(ax, Nw) * (1.0 - ca);
      vec3 cw = Nc + (vec3(fbm(Nc * 10.0 + 4.0), fbm(Nc * 10.0 + 9.0), fbm(Nc * 10.0 + 2.0)) - 0.5) * 0.06;
      float c1 = fbm8(cw * vec3(7.0, 12.0, 7.0) + vec3(0.0, 0.0, uTime * 0.0006)), c2 = fbm8(cw * 34.0 + 3.0);
      float cl = smoothstep(0.42, 0.68, c1 * 0.75 + c2 * 0.35 - 0.05), veil = smoothstep(0.40, 0.58, c1) * 0.3;
      cl = max(cl, veil);
      vec3 cloud = mix(vec3(0.70, 0.74, 0.80), vec3(0.97, 0.97, 0.98), smoothstep(0.4, 0.75, c2));
      float lit = max(dot(N, S), 0.0), soft = smoothstep(-0.08, 0.25, dot(N, S));
      float mu = max(dot(N, -rd), 0.0);
      // the cloud shadows on the ground, and the sun caught on open water
      float shadow = smoothstep(0.46, 0.76, fbm8((cw + S * 0.004) * vec3(7.0, 12.0, 7.0) + vec3(0.0, 0.0, uTime * 0.0006)) * 0.82 + c2 * 0.32 - 0.04);
      vec3 hh = normalize(S - rd); float glint = pow(max(dot(N, hh), 0.0), 220.0) * (1.0 - land) * (1.0 - cl);
      vec3 c = mix(surf * (1.0 - 0.45 * shadow), cloud, cl);
      col = c * (0.012 + 0.85 * lit * soft) + vec3(1.0, 0.95, 0.85) * glint * 1.6 * soft;
      // the air over it: bluer and thicker toward the edge, warm along the line between day and night
      float haze = pow(1.0 - mu, 7.0), term = smoothstep(0.0, 0.12, lit) * (1.0 - smoothstep(0.12, 0.35, lit));
      col = mix(col, vec3(0.20, 0.42, 0.92) * (0.06 + 0.8 * soft), haze * 0.8) + vec3(0.015, 0.035, 0.08) * (1.0 - mu) * soft;
      col += vec3(0.45, 0.16, 0.05) * term * haze * 0.5;
    } else if (b > 0.0) {
      // past the edge: a thin blazing line of air, then blue going to black
      float alt = sqrt(max(dot(C, C) - b * b, 0.0)) - R;
      vec3 Nl = normalize(rd * b - C); float lit = smoothstep(-0.25, 0.4, dot(Nl, S));
      // past the edge: a hair-thin white-blue line, a band of blue, then a faint violet going off into black
      col += (vec3(0.55, 0.80, 1.0) * exp(-alt / 6.0) * 2.4 + vec3(0.18, 0.50, 1.0) * exp(-alt / 22.0) * 0.9 + vec3(0.10, 0.12, 0.40) * exp(-alt / 80.0) * 0.22) * lit;
    }
    // the ring: a band of grey structure round the Earth, its inner edge lit orange
    vec3 Nr = normalize(vec3(-0.30, 0.42, 0.86));
    float dn = dot(rd, Nr);
    if (abs(dn) > 1e-4) {
      float t = dot(C, Nr) / dn;
      if (t > 0.0 && t < tE) {
        float r = length(rd * t - C), Rr = 9300.0;
        float d = r - Rr;
        float line = exp(-abs(d) / 9.0) * 3.2 + exp(-abs(d) / 120.0) * 0.35;
        // the band's face is built, not blank: concentric tracks with dark gaps between them, each track laid in plates of its own
        // shade, finer plates inside those, a few lamps; whatever is too small for a pixel from here is left out, so it reads as far off
        vec3 e1 = normalize(cross(Nr, vec3(0.0, 1.0, 0.0))), e2 = cross(Nr, e1), vv = rd * t - C;
        float th = atan(dot(vv, e2), dot(vv, e1)), wd = clamp(fwidth(d) * 0.9, 3.0, 40.0), wa = fwidth(th);
        float tex = 1.0, lamp = 0.0;
        {
          float k1 = 1.0 - smoothstep(0.12, 0.45, wd / 130.0), k2 = 1.0 - smoothstep(0.12, 0.45, wd / 32.5), k3 = 1.0 - smoothstep(0.12, 0.45, wd / 8.0);
          float i1 = floor(d / 130.0), i2 = floor(d / 32.5), i3 = floor(d / 8.0), f1 = fract(d / 130.0) * 130.0, f2 = fract(d / 32.5) * 32.5;
          tex *= 1.0 + (hash3(vec3(i1, 1.0, 4.0)) - 0.5) * 0.55 * k1; tex *= 1.0 + (hash3(vec3(i2, 2.0, 4.0)) - 0.5) * 0.40 * k2; tex *= 1.0 + (hash3(vec3(i3, 3.0, 4.0)) - 0.5) * 0.30 * k3;
          float g1 = max(7.0, wd), g2 = max(1.6, wd);
          tex *= 1.0 - 0.75 * k1 * min(1.0, 7.0 / g1) * (1.0 - smoothstep(g1 * 0.5, g1, min(f1, 130.0 - f1)));          // the gaps between the great tracks
          tex *= 1.0 - 0.50 * k2 * min(1.0, 1.6 / g2) * (1.0 - smoothstep(g2 * 0.5, g2, min(f2, 32.5 - f2)));
          // plates along each track: long ones, and short ones inside them (each track's joints fall in a different place)
          float A1 = 0.021, A2 = 0.0042, a1 = th / A1 + hash3(vec3(i1, 5.0, 1.0)) * 7.0, a2 = th / A2 + hash3(vec3(i2, 6.0, 1.0)) * 7.0;
          float q1 = (1.0 - smoothstep(0.12, 0.45, wa / A1)) * k1, q2 = (1.0 - smoothstep(0.12, 0.45, wa / A2)) * k2;
          tex *= 1.0 + (hash3(vec3(floor(a1), i1, 7.0)) - 0.5) * 0.60 * q1; tex *= 1.0 + (hash3(vec3(floor(a2), i2, 8.0)) - 0.5) * 0.45 * q2;
          float s1 = max(0.03, wa / A1), s2 = max(0.05, wa / A2);
          tex *= 1.0 - 0.6 * q1 * min(1.0, 0.03 / s1) * (1.0 - smoothstep(s1 * 0.5, s1, min(fract(a1), 1.0 - fract(a1))));
          tex *= 1.0 - 0.4 * q2 * min(1.0, 0.05 / s2) * (1.0 - smoothstep(s2 * 0.5, s2, min(fract(a2), 1.0 - fract(a2))));
          float lh = hash3(vec3(floor(a2), i2, 9.0)); lamp = step(0.965, lh) * q2 * smoothstep(0.22, 0.08, abs(fract(a2) - 0.5)) * smoothstep(0.22, 0.08, abs(f2 / 32.5 - 0.5));
        }
        float inband = step(0.0, d) * step(d, 520.0);
        col = mix(col, vec3(0.055, 0.058, 0.064) * tex * (0.4 + 0.6 * max(dot(Nr, S), 0.0)), inband * 0.92);
        col += mix(vec3(1.0, 0.75, 0.45), vec3(0.6, 0.8, 1.0), step(0.5, fract(hash3(vec3(floor(th / 0.0042), 3.0, 2.0))))) * lamp * 0.4 * inband;
        col += vec3(1.0, 0.36, 0.10) * line;
      }
    }
    // small cruisers going round with the ring, a little off it, each with a bright engine and a long faint wake
    {
      vec3 e1 = normalize(cross(Nr, vec3(0.0, 1.0, 0.0))), e2 = cross(Nr, e1);
      for (int k = 0; k < 9; k++){
        float fk = float(k), w = (0.010 + 0.012 * fract(fk * 0.618)) * (mod(fk, 3.0) < 1.0 ? -1.0 : 1.0);
        float th = fk * 2.17 + uTime * w;
        vec3 Pp = C + (9300.0 + (fract(fk * 0.37) - 0.35) * 900.0) * (cos(th) * e1 + sin(th) * e2) + Nr * (fract(fk * 0.71) - 0.5) * 400.0;
        float dist = length(Pp); vec3 u = Pp / dist;
        if (dot(rd, u) < 0.999) continue;
        float bb = dot(u, C), dd = bb * bb - (dot(C, C) - R * R); if (bb > 0.0 && dd > 0.0 && bb - sqrt(dd) < dist) continue;   // behind the Earth
        vec3 T = normalize((-sin(th) * e1 + cos(th) * e2) * sign(w)); T = normalize(T - u * dot(T, u)); vec3 Np = cross(u, T);
        vec3 dv = rd - u; float x = dot(dv, T), y = dot(dv, Np);
        float hull = smoothstep(1.0, 0.4, (x * x) / (0.0026 * 0.0026) + (y * y) / (0.0007 * 0.0007));
        col = mix(col, vec3(0.78, 0.80, 0.84) * (0.4 + 0.6 * smoothstep(-0.0007, 0.0007, y)), hull);
        col += vec3(0.6, 0.85, 1.6) * 3.0 * exp(-(pow(x + 0.0026, 2.0) + y * y) / (0.0006 * 0.0006));
        if (x < -0.0026) col += vec3(0.45, 0.7, 1.0) * 0.7 * exp((x + 0.0026) / 0.014) * exp(-y * y / (0.00035 * 0.00035));
      }
    }
    // the sun, behind the station: seen through the open top of the back wall from the middle of the hall. Only a white disc, its edge
    // darkening, and a thin uneven corona round it; kept dim enough that it lights nothing and hardly blooms (and the floor's mirror leaves it out)
    {
      vec3 SU = normalize(vec3(-0.15, 0.45, 0.88)); float sa = length(rd - SU), R0 = 0.0105;
      float limb = sqrt(max(1.0 - (sa / R0) * (sa / R0), 0.0));
      float disc = 1.0 - smoothstep(R0 * 0.94, R0, sa);
      vec3 ex = normalize(cross(SU, vec3(0.0, 1.0, 0.0))), ey = cross(ex, SU); float ang = atan(dot(rd, ey), dot(rd, ex));
      float rays = 0.65 + 0.7 * noise3(vec3(cos(ang) * 3.0, sin(ang) * 3.0, 1.0)) * noise3(vec3(cos(ang) * 9.0, sin(ang) * 9.0, 4.0)) * 2.0;
      float cor = (0.16 * exp(-max(sa - R0, 0.0) / 0.006) * rays + 0.035 * exp(-max(sa - R0, 0.0) / 0.05)) * step(R0 * 0.94, sa);
      col = mix(col, vec3(1.0, 0.97, 0.92) * (0.85 + 0.45 * limb), disc * uSun) + vec3(1.0, 0.90, 0.76) * cor * uSun;
    }
    gl_FragColor = vec4(col, 1.0);
  }`,
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };

/* ---------------- the floor's mirror ---------------- */
const mirrorCam = new THREE.PerspectiveCamera(); const _f = new V3(), _u = new V3();
let refl = null;
function makeRefl() {
  const pr = renderer.getPixelRatio(), w = Math.max(2, Math.round(innerWidth * pr * 0.7)), h = Math.max(2, Math.round(innerHeight * pr * 0.7));
  if (refl) refl.dispose(); refl = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  floorMat.uniforms.uRefl.value = refl.texture; floorMat.uniforms.uPx.value.set(1 / w, 1 / h);
}
makeRefl();
let spdK = 0;    // how fast you are going, eased (0 standing .. 1 flat out): it drives the blur of speed in the print
function renderMirror() {
  mirrorCam.copy(camera);
  mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion); _f.y = -_f.y;
  _u.set(0, 1, 0).applyQuaternion(camera.quaternion); _u.y = -_u.y;
  mirrorCam.up.copy(_u); mirrorCam.lookAt(mirrorCam.position.clone().add(_f)); mirrorCam.updateMatrixWorld();
  mirrorCam.projectionMatrix.copy(camera.projectionMatrix); mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  uMirrorVP.value.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
  floor.visible = false; sky.material.uniforms.uSun.value = 0; for (const m of PLAT) m.visible = false;
  renderer.setRenderTarget(refl); renderer.clear(); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
  floor.visible = true; sky.material.uniforms.uSun.value = 1; for (const m of PLAT) m.visible = true;
}

/* ---------------- post ---------------- */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.55, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
// a print of it: grain, colour fringes toward the corners, darker corners, and the fade in when you arrive
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uSpd: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uSpd; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 d = c * (0.0008 + r2 * 0.006);
    // at speed everything off the middle of the view smears back toward it (the middle itself stays sharp), and the fringes widen a little
    d *= 1.0 + 1.5 * uSpd;
    float bl = uSpd * 0.075 * smoothstep(0.004, 0.22, r2);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 10; i++){
      vec2 uv = vUv - c * bl * (float(i) / 9.0);
      col += vec3(texture2D(tDiffuse, uv - d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d).b);
      if (bl < 1e-4) { col *= 10.0; break; }
    }
    col *= 0.1;
    col = col * vec3(0.97, 1.0, 1.04) + vec3(0.006, 0.008, 0.012);
    col *= 1.0 - smoothstep(0.10 - 0.04 * uSpd, 0.75, r2) * (0.55 + 0.15 * uSpd);
    col += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(613.0, 271.0)) - 0.5) * 0.045;
    gl_FragColor = vec4(max(col, 0.0) * (1.0 - uFade), 1.0);
  }`,
});
composer.addPass(grade);
addEventListener('resize', () => {
  renderer.setPixelRatio(pickPR()); renderer.setSize(innerWidth, innerHeight, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); makeRefl();
});

/* ---------------- you ---------------- */
const EYE = 1.62, WALK = 1.7, RUN = 6.0, GRAV = 9.8, JUMP = 4.0;
const P = { pos: new V3(DOOR.x, 0, ZB - 14), vel: new V3(), yaw: 0, pitch: 0.06, ground: true, bob: 0 };
const keys = Object.create(null);
let dragging = false, lastX = 0, lastY = 0;
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  if (!locked()) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { dragging = true; }); } catch (err) { dragging = true; } lastX = e.clientX; lastY = e.clientY; }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (!locked() && !dragging) return;
  const sk = 0.0022 * (window.SCF_SETTINGS ? window.SCF_SETTINGS.get('sens') : 1);
  P.yaw -= (e.movementX || 0) * sk; P.pitch = clamp(P.pitch - (e.movementY || 0) * sk, -1.5, 1.5);
});
addEventListener('keydown', (e) => { keys[e.code] = true; initAudio(); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dragging = false; });
function step(dt) {
  if (keys.ArrowLeft) P.yaw += 1.8 * dt; if (keys.ArrowRight) P.yaw -= 1.8 * dt;
  if (keys.ArrowUp) P.pitch = Math.min(1.5, P.pitch + 1.3 * dt); if (keys.ArrowDown) P.pitch = Math.max(-1.5, P.pitch - 1.3 * dt);
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); const il = Math.hypot(fw, st); if (il > 1) { fw /= il; st /= il; }
  const spd = keys.ShiftLeft || keys.ShiftRight ? RUN : WALK, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const wx = (-sy * fw + cy * st) * spd, wz = (-cy * fw - sy * st) * spd, k = 1 - Math.exp(-(P.ground ? 10 : 2) * dt);
  P.vel.x += (wx - P.vel.x) * k; P.vel.z += (wz - P.vel.z) * k;
  if (keys.Space && P.ground) { P.vel.y = JUMP; P.ground = false; }
  P.vel.y -= GRAV * dt; P.pos.addScaledVector(P.vel, dt);
  if (P.pos.y <= 0) { if (!P.ground && P.vel.y < -3) footstep(1.4); P.pos.y = 0; P.vel.y = 0; P.ground = true; }
  // the walls of the hall
  walkClamp(P.pos, 0);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.ground && hs > 0.3) { const b0 = P.bob; P.bob += hs * dt; if (Math.floor(b0 / 0.78) !== Math.floor(P.bob / 0.78)) footstep(hs > 3 ? 1.0 : 0.6); }
}
function placeCamera(t) {
  if (CAR.on) {   // in the driver's seat, a little shake that grows with the speed
    const c = Math.cos(CAR.yaw), s = Math.sin(CAR.yaw), k = clamp(Math.abs(CAR.v) / CAR_MAX, 0, 1), j = (Math.random() - 0.5) * 0.012 * k;
    camera.position.set(CAR.x + c * SEAT[0] + s * SEAT[2], SEAT[1] + j, CAR.z - s * SEAT[0] + c * SEAT[2]);
    camera.rotation.set(P.pitch, P.yaw, CAR.roll); camera.updateMatrixWorld(); return;
  }
  const hs = Math.hypot(P.vel.x, P.vel.z);
  camera.position.set(P.pos.x, P.pos.y + EYE + Math.sin(P.bob * Math.PI * 2 / 1.56) * 0.025 * clamp(hs / 2, 0, 1), P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0); camera.updateMatrixWorld();
}

/* ---------------- sound: a hum as big as the hall, and your steps going a long way ---------------- */
let AC = null, verb = null, out = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx();
    out = AC.createGain(); out.gain.value = 0; out.connect(AC.destination); out.gain.setTargetAtTime(1, AC.currentTime, 3);
    verb = AC.createConvolver(); const len = AC.sampleRate * 7, ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.08; d[i] = lp * Math.pow(1 - i / len, 2.2) * (i < AC.sampleRate * 0.25 ? i / (AC.sampleRate * 0.25) : 1) * 2.2; } }
    verb.buffer = ir; const vg = AC.createGain(); vg.gain.value = 0.9; verb.connect(vg); vg.connect(out);
    // the hum: two low tones beating, and air moving through something very large
    for (const [f, g0] of [[38, 0.05], [38.35, 0.05], [57.2, 0.018]]) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.value = g0; o.connect(g); g.connect(out); o.start(); }
    const n = AC.sampleRate * 4, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const ng = AC.createGain(); ng.gain.value = 0.22; const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.035; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(ng.gain);
    src.connect(lp); lp.connect(ng); ng.connect(out); ng.connect(verb); src.start(); lfo.start();
  } catch (e) { AC = null; }
}
function footstep(k) {
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime, len = Math.floor(AC.sampleRate * 0.07), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = AC.createBufferSource(); s.buffer = buf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 300; f.Q.value = 1.2;
  const g = AC.createGain(); g.gain.value = 0.10 * k; const w = AC.createGain(); w.gain.value = 0.22 * k;
  s.connect(f); f.connect(g); g.connect(out); f.connect(w); w.connect(verb); s.start(t);
}

/* ---------------- its name, once, as you arrive ---------------- */
// shown on the scene's own clock (fadeT, which only runs once the hall is being drawn), not on timers from when the page loaded: the first
// load can stall for seconds while the shaders are built, and timers would then fire one straight after the other and the name never show
const MNAME = { el: null, on: false, off: false };
{
  const el = document.createElement('div'); el.id = 'mname'; MNAME.el = el;
  el.innerHTML = 'MOON STATION<small>月球空间站</small>';
  el.style.cssText = "position:fixed;left:0;right:0;bottom:16%;text-align:center;color:#dfe8f2;font:300 30px/1.2 'Segoe UI Light','Segoe UI','Helvetica Neue',Arial,sans-serif;letter-spacing:.9em;text-indent:.9em;opacity:0;transition:opacity 2.4s;pointer-events:none;z-index:4;text-shadow:0 0 18px rgba(140,180,255,.35)";
  document.body.appendChild(el);
  const sm = el.querySelector('small'); sm.style.cssText = 'display:block;margin-top:10px;font-size:15px;letter-spacing:.6em;text-indent:.6em;color:#9fb0c2';
}
if (window.SCF_G) window.SCF_G.setPages(() => [{ t: 'Moon Station', html: '<p>A hall of the station over the Moon.</p><p>Walk to the light at the far end. It is a long way.</p><p>Hold <kbd>Shift</kbd> to run, or take the little tug by the door: <kbd>E</kbd> to get in.</p>' }]);

/* ---------------- the platform, and the Moon below ---------------- */
// Past the end of the hall the floor runs on as a white platform: across the open end, and on out to the left, under the foot of the
// cliff and along the outside of the station for five kilometres. Walk to its far end and look down: the Moon, a long way below, grey-white
// and cratered as far as you can see, and in the nearest crater a settlement dug into it: a wall of metal panels round the crater floor,
// long stairs going down to it, a lit doorway, buildings cut into the slope; and more of the same, smaller and smaller, on into the distance.
const OUT = { y: -700, sx: -10500, sz: -11000, cr: 1700 };   // the ground far below, and the crater with the settlement in it
const SUN = new V3(-0.45, 0.62, 0.62).normalize();
const outMat = (kind, base = [0, 0, 0]) => new THREE.ShaderMaterial({
  uniforms: { uCam, uBase: { value: new V3(...base) }, uSun: { value: SUN } }, side: THREE.DoubleSide, defines: { KIND: kind },
  // (things set down many times over, like the station buildings, bring a place and size of their own with them)
  vertexShader: VERT.replace('uniform mat4 uMirrorVP;', 'uniform mat4 uMirrorVP; uniform vec3 uBase;')
    .replace('vec4 w = modelMatrix * vec4(position, 1.0);', '\n#ifdef USE_INSTANCING\n  mat4 mm = modelMatrix * instanceMatrix;\n#else\n  mat4 mm = modelMatrix;\n#endif\n  vec4 w = mm * vec4(position, 1.0);')
    .replace('mat3(modelMatrix) * normal', 'mat3(mm) * normal'),
  fragmentShader: `#include <logdepthbuf_pars_fragment>
  ${NOISE}
  uniform vec3 uCam, uBase, uSun; varying vec3 vW; varying vec3 vN; varying vec4 vR;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN); if (dot(n, uCam - vW) < 0.0) n = -n;
    float d = distance(uCam, vW), aa = clamp(1.0 - d / 9000.0, 0.0, 1.0);
    vec3 col; float glow = 0.0;
  #if KIND == 0
    // regolith: grey-white dust, pocked with craters at every size down to a few metres, lumpy, with rocks strewn about;
    // the small craters are drawn by bending the light (each one a bowl with a raised rim), so they stay sharp however close you get
    vec2 xz = vW.xz; vec2 grad = vec2(0.0); float rocks = 0.0, cav = 0.0;
    for (int sc = 0; sc < 4; sc++){
      float S = sc == 0 ? 220.0 : sc == 1 ? 70.0 : sc == 2 ? 22.0 : 7.0;
      float fade = clamp(1.0 - d / (S * 160.0), 0.0, 1.0); if (fade <= 0.0) continue;
      vec2 cell = floor(xz / S);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
        vec2 id = cell + vec2(float(i), float(j));
        float h = hash3(vec3(id, float(sc) * 7.3)); if (h < 0.35) continue;
        vec2 c = (id + 0.15 + 0.7 * vec2(hash3(vec3(id, 3.1 + float(sc))), hash3(vec3(id, 5.7 + float(sc))))) * S;
        float R = S * (0.15 + 0.35 * hash3(vec3(id, 9.1 + float(sc))));
        vec2 dv = xz - c; float r = length(dv) / R; if (r > 1.6) continue;
        // slope of the profile: down into the bowl, up over the rim, gently down outside
        float sl = r < 1.0 ? 2.2 * r : -3.0 * (r - 1.0) * exp(-pow((r - 1.0) * 3.0, 2.0)) * 2.0;
        sl -= 1.6 * exp(-pow((r - 1.0) * 4.0, 2.0)) * (r - 1.0) * 4.0 * 0.5;
        grad += normalize(dv + 1e-4) * sl * 0.22 * fade;
        cav += (r < 1.0 ? (1.0 - r * r) : 0.0) * fade * 0.18;
      }
    }
    // lumps and ripples of dust, then grain
    float f1 = clamp(1.0 - d / 2500.0, 0.0, 1.0), f2 = clamp(1.0 - d / 600.0, 0.0, 1.0);
    grad += (vec2(noise3(vec3(xz * 0.06, 1.0)), noise3(vec3(xz * 0.06, 7.0))) - 0.5) * 0.5 * f1;
    grad += (vec2(noise3(vec3(xz * 0.5, 2.0)), noise3(vec3(xz * 0.5, 4.0))) - 0.5) * 0.45 * f2;
    grad += (vec2(noise3(vec3(xz * 3.0, 3.0)), noise3(vec3(xz * 3.0, 6.0))) - 0.5) * 0.35 * clamp(1.0 - d / 90.0, 0.0, 1.0);
    // rocks: small dark-and-bright specks, densest near the craters' rims
    float rk = step(0.985, hash3(vec3(floor(xz / 2.5), 2.0))) * clamp(1.0 - d / 700.0, 0.0, 1.0);
    vec3 pn = normalize(n + vec3(-grad.x, 0.0, -grad.y));
    float g = noise3(vec3(xz * 0.004, 0.0)) * 0.55 + noise3(vec3(xz * 0.03, 9.0)) * 0.3 + noise3(vec3(xz * 0.2, 5.0)) * 0.15 * f1;
    vec3 alb = mix(vec3(0.40, 0.42, 0.46), vec3(0.76, 0.79, 0.84), g) * (1.0 - 0.25 * cav) + rk * 0.15;
    float sl = max(dot(pn, uSun), 0.0);
    col = alb * (vec3(1.0, 0.98, 0.95) * 1.15 * sl + vec3(0.025, 0.035, 0.06));
  #elif KIND == 1
    // the panelled walls: grey metal sheet in tall panels, each a slightly different grey, ribs between
    vec2 u = abs(n.y) > 0.5 ? vW.xz : vec2(vW.x + vW.z, vW.y);
    float pid = floor(u.x / 6.0), rib = smoothstep(0.92, 1.0, abs(fract(u.x / 6.0) - 0.5) * 2.0);
    vec3 alb = vec3(0.50, 0.53, 0.57) * (0.8 + 0.3 * hash3(vec3(pid, floor(u.y / 9.0), 1.0))) * (1.0 - 0.4 * rib);
    float sl = max(dot(n, uSun), 0.0); vec3 v = normalize(uCam - vW);
    col = alb * (vec3(1.0, 0.98, 0.95) * 1.1 * sl + vec3(0.05, 0.07, 0.11)) + vec3(0.8) * pow(max(dot(reflect(-uSun, n), v), 0.0), 40.0) * 0.5 * sl;
  #elif KIND == 2
    // white built things: the platform, the stairs, the buildings
    vec3 alb = vec3(0.70, 0.71, 0.72);
    float sl = max(dot(n, uSun), 0.0);
    col = alb * (vec3(1.0, 0.98, 0.95) * 1.1 * sl + vec3(0.07, 0.09, 0.13) + vec3(0.13, 0.135, 0.15) * (0.5 - 0.5 * n.y));   // and a little back off the bright ground
  #elif KIND == 4
    // solar panels: deep blue cells in a fine grid, catching the sun as they turn
    vec2 u = abs(n.y) > 0.5 ? vW.xz : vW.xy;
    float grid = max(step(0.9, fract(u.x / 9.0)), step(0.9, fract(u.y / 9.0)));
    vec3 alb = mix(vec3(0.03, 0.06, 0.16), vec3(0.4, 0.42, 0.45), grid * 0.6);
    float sl = max(dot(n, uSun), 0.0); vec3 v = normalize(uCam - vW);
    col = alb * (1.2 * sl + 0.08) + vec3(0.6, 0.7, 1.0) * pow(max(dot(reflect(-uSun, n), v), 0.0), 60.0) * 1.5;
  #else
    col = uBase; glow = 1.0;
  #endif
    // a very little blue in the distance, nothing like air: just enough that far things sit back
    col = mix(col, vec3(0.03, 0.045, 0.07), (1.0 - exp(-d / 60000.0)) * (1.0 - glow * 0.7));
    gl_FragColor = vec4(col, 1.0);
  }`,
});
// the ground: craters on craters; the grid is fine under the settlement and coarse far off (it reaches some 60 km every way)
const craters = [];
{
  const r = mulberry32(919);
  craters.push([OUT.sx, OUT.sz, OUT.cr, 0.09, 1]);
  for (let k = 0; k < 700; k++) { const R = 25 * Math.pow(400, r()), a = r() * Math.PI * 2, dist = 300 + r() * 90000; if (dist < 3800 + R) continue; craters.push([OUT.sx + Math.cos(a) * dist, OUT.sz + Math.sin(a) * dist * 0.9 - 6000, R, 0.12 + 0.12 * r()]); }
}
function groundH(x, z) {
  const ds = Math.hypot(x - OUT.sx, z - OUT.sz), calm = 0.25 + 0.75 * clamp((ds - 2600) / 4000, 0, 1);   // the ground round the settlement is gentler
  let h = (260 * rfbm(x / 9000, z / 9000) + 60 * rfbm(x / 1500 + 5, z / 1500)) * calm;
  for (const [cx, cz, R, dp, flat] of craters) {
    const dx = x - cx, dz = z - cz; if (Math.abs(dx) > R * 1.8 || Math.abs(dz) > R * 1.8) continue;
    const d = Math.hypot(dx, dz) / R;
    if (d < 1) h += R * dp * ((flat ? d * d * d * d : d * d) - 1) * 0.9; h += R * dp * 0.28 * Math.exp(-Math.pow((d - 1) * 3.2, 2));
  }
  const dd = Math.hypot(x - OUT.sx, z - OUT.sz);
  return OUT.y + clamp(h, -2600, 380) - dd * dd / (2 * 1737000);   // and the ground curves away: the Moon is small
}
{
  const N = 340, L = 115000, P = [], I = [];
  const at = (s) => Math.sign(s) * s * s * L;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = OUT.sx + at(i / N * 2 - 1), z = OUT.sz + at(j / N * 2 - 1); P.push(x, groundH(x, z), z); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; I.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const m = new THREE.Mesh(g, outMat(0)); m.frustumCulled = false; scene.add(m);
}
// the settlement, and the smaller ones scattered on into the distance
{
  const box = (x0, y0, z0, x1, y1, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  const metal = [], white = [], warm = [], cold = [];
  const floorY = groundH(OUT.sx, OUT.sz);
  // a wall of panels most of the way round the crater floor
  const WR = OUT.cr * 0.62, WH = 210;
  for (let k = 0; k < 120; k++) {
    const a0 = -0.4 + k / 120 * Math.PI * 1.55, a1 = a0 + Math.PI * 1.55 / 120;
    const x0 = OUT.sx + Math.cos(a0) * WR, z0 = OUT.sz + Math.sin(a0) * WR, x1 = OUT.sx + Math.cos(a1) * WR, z1 = OUT.sz + Math.sin(a1) * WR;
    const y0 = Math.min(groundH(x0, z0), groundH(x1, z1)) - 8, y1 = Math.max(groundH(x0, z0), groundH(x1, z1)) + WH;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0], 3)); g.computeVertexNormals(); metal.push(g);
    if (k % 6 === 0) metal.push(box(x0 - 5, y0, z0 - 5, x0 + 5, y1 + 8, z0 + 5));   // the ribs
  }
  // the lit doorway in it, and the warm room behind
  { const a = 0.55, x = OUT.sx + Math.cos(a) * WR, z = OUT.sz + Math.sin(a) * WR, y = groundH(x, z);
    warm.push(box(x - 55, y - 5, z - 55, x + 55, y + 130, z + 55)); }
  // long stairs from the rim down to the floor, on trusses
  for (const [a, len] of [[2.1, 1300], [2.7, 1200], [3.6, 1400]]) {
    const xr = OUT.sx + Math.cos(a) * OUT.cr * 1.05, zr = OUT.sz + Math.sin(a) * OUT.cr * 1.05, yr = groundH(xr, zr) + 4;
    const xb = OUT.sx + Math.cos(a) * WR * 0.75, zb = OUT.sz + Math.sin(a) * WR * 0.75, yb = floorY + 2;
    const n = 90;
    for (let k = 0; k < n; k++) { const t = k / n, x = xr + (xb - xr) * t, y = yr + (yb - yr) * t, z = zr + (zb - zr) * t, w = 16;
      white.push(box(x - w, y - 1.2, z - w, x + w, y, z + w));
      if (k % 6 === 0) metal.push(box(x - 4, Math.min(groundH(x, z), y) - 2, z - 4, x + 4, y, z + 4)); }
  }
  // The buildings. Two kinds, each modelled once (about 130 m long, in metres) and then set down again and again, every one at its own
  // size and turned its own way: on the near slope above the crater, terrace above terrace; and in small groups on and on into the distance.
  // Each stands on a bench of panelled metal sunk into the ground, so it sits level on a slope.
  //   the hab: a long white hull lying on its side on saddles, hooped, an airlock out of its front with a lit door, a row of windows
  //            (some lit), plant on its back, a mast with a dish and a lamp at the top, whip aerials, two wings of solar panel behind
  //   the lab: a dome on a drum with lit windows round its foot, joined by a tube to a stepped block with a long window, tanks behind,
  //            a lattice tower on the roof carrying a big dish and a whip, a small dish beside it, an arched garage
  const r = mulberry32(55);
  const cylX = (rad, len, seg, x, y, z) => { const c = new THREE.CylinderGeometry(rad, rad, len, seg); c.rotateZ(Math.PI / 2); c.translate(x, y, z); return c; };
  const cylY = (r0, r1, h, seg, x, y, z) => { const c = new THREE.CylinderGeometry(r1, r0, h, seg); c.translate(x, y + h / 2, z); return c; };   // r0 at its foot, r1 at its top
  const ball = (rad, x, y, z, sx = 1) => { const s = new THREE.SphereGeometry(rad, 16, 8); s.scale(sx, 1, 1); s.translate(x, y, z); return s; };
  // a dish: a bowl with its feed on a stalk, tipped over by `tilt` and turned to face `yaw`; K.w takes the bowl, K.m the feed
  const dish = (K, rad, x, y, z, tilt, yaw) => {
    const bowl = new THREE.SphereGeometry(rad * 1.6, 16, 4, 0, Math.PI * 2, 0, 0.675); bowl.rotateX(Math.PI); bowl.translate(0, rad * 1.6, 0);
    const parts = [bowl, box(-rad * 0.035, 0, -rad * 0.035, rad * 0.035, rad * 0.8, rad * 0.035), box(-rad * 0.1, rad * 0.74, -rad * 0.1, rad * 0.1, rad * 0.9, rad * 0.1),
      box(-rad * 0.07, -rad * 0.5, -rad * 0.07, rad * 0.07, 0.02 * rad, rad * 0.07)];
    parts.forEach((g, i) => { g.rotateX(tilt); g.rotateY(yaw); g.translate(x, y, z); (i ? K.m : K.w).push(g); });
  };
  const HAB = { w: [], m: [], g: [], d: [], p: [] }, LAB = { w: [], m: [], g: [], d: [], p: [] };
  {
    const K = HAB;
    K.m.push(box(-66, -40, -42, 66, 0, 38));                                                                    // the bench
    K.w.push(cylX(20, 96, 18, 0, 27, 0), ball(20, -48, 27, 0, 0.5), ball(20, 48, 27, 0, 0.5));                   // the hull, and its rounded ends
    for (const x of [-36, -12, 12, 36]) K.m.push(cylX(20.9, 2.4, 18, x, 27, 0));                                 // hoops
    for (const x of [-34, 0, 34]) for (const z of [-12, 12]) K.m.push(box(x - 3, 0, z - 3, x + 3, 12.5, z + 3));  // saddles
    K.w.push(box(-13, 0, 14, 13, 24, 34)); K.m.push(box(-15, 24, 13, 15, 26, 35.5));                             // the airlock, its roof
    K.g.push(box(-5, 1, 34, 5, 17, 34.5)); K.d.push(box(-9.5, 1, 34, -7, 20, 34.3), box(7, 1, 34, 9.5, 20, 34.3));   // its door, lit
    K.m.push(box(-7, 0, 34.5, 7, 1, 44));                                                                        // and the ramp up to it
    [-40, -30, -20, 20, 30, 40].forEach((x, i) => (i % 3 === 1 ? K.d : K.g).push(box(x - 3, 28, 19.2, x + 3, 33, 20.2)));   // windows
    K.m.push(box(-34, 46, -7, -14, 52, 7), box(-30, 52, -4, -26, 55, 4), box(-22, 52, -4, -18, 55, 4));          // plant on its back
    K.w.push(cylY(5.5, 5, 6, 12, 4, 46, 0)); K.m.push(cylY(5.8, 5.8, 1, 12, 4, 52, 0));                          // a hatch
    K.m.push(box(23.2, 46, -0.8, 24.8, 104, 0.8), box(18, 84, -0.5, 30, 85, 0.5), box(20, 94, -0.5, 28, 95, 0.5), box(21, 46, -3, 27, 49, 3));   // the mast
    K.g.push(box(23.2, 104, -0.8, 24.8, 105.6, 0.8));
    dish(K, 9, 24, 68, 2.5, 0.95, 0.5);
    K.m.push(box(-42.4, 45, 3.6, -41.6, 84, 4.4), box(-39.4, 45, -4.4, -38.6, 71, -3.6), box(40.6, 44, -0.4, 41.4, 66, 0.4));   // whips
    for (const x of [-36, 24]) {                                                                                 // solar wings behind
      K.m.push(box(x - 1.5, 0, -31.5, x + 1.5, 17, -28.5), box(x - 16, 16, -30.6, x + 16, 17.4, -29.4));
      const pn = new THREE.BoxGeometry(46, 1, 20); pn.rotateX(0.45); pn.translate(x, 19, -30); K.p.push(pn);
    }
  }
  {
    const K = LAB;
    K.m.push(box(-62, -40, -50, 62, 0, 52));                                                                    // the bench
    K.w.push(cylY(33, 31, 9, 20, -24, 0, 0)); K.m.push(cylY(31.8, 31.8, 2, 20, -24, 8, 0));                      // the drum, a band round it
    { const d = new THREE.SphereGeometry(30, 20, 7, 0, Math.PI * 2, 0, Math.PI / 2); d.translate(-24, 9.5, 0); K.w.push(d); }   // the dome
    K.m.push(cylY(4.5, 3.5, 3, 12, -24, 39, 0), box(-24.5, 42, -0.5, -23.5, 56, 0.5)); K.g.push(box(-24.6, 56, -0.6, -23.4, 57.4, 0.6));
    for (let k = -4; k <= 4; k++) { const a = k * 0.27, w = new THREE.BoxGeometry(5.2, 3.6, 1.2); w.rotateY(a); w.translate(-24 + Math.sin(a) * 32.2, 4.6, Math.cos(a) * 32.2); (k % 3 === 0 ? K.d : K.g).push(w); }
    K.w.push(box(16, 0, -24, 56, 22, 24), box(21, 22, -19, 51, 31, 19)); K.m.push(box(15, 21, -25, 57, 23, 25), box(20, 30.4, -20, 52, 32, 20));   // the block, stepped
    K.g.push(box(20, 9, 24, 36, 15, 24.5), box(24, 24.5, 19, 34, 28, 19.5)); K.d.push(box(39, 9, 24, 52, 15, 24.5), box(37, 24.5, 19, 48, 28, 19.5));
    K.d.push(box(56, 2, -6, 56.4, 16, 6));
    K.w.push(cylX(6, 14, 12, 12, 8, 0)); K.m.push(cylX(6.9, 1.5, 12, 7.5, 8, 0), cylX(6.9, 1.5, 12, 15.5, 8, 0));   // the tube between
    for (const x of [26, 44]) { K.w.push(ball(8.5, x, 12, -37)); K.m.push(box(x - 5, 0, -42, x + 5, 5, -32)); }  // tanks
    K.m.push(box(26, 11.4, -37.6, 44, 12.6, -36.4), box(34.4, 12, -37, 35.6, 20, -24));
    { const tx = 36, y0 = 32, y1 = 98, h = 3.2;                                                                  // the tower
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.m.push(box(tx + sx * h - 0.45, y0, sz * h - 0.45, tx + sx * h + 0.45, y1, sz * h + 0.45));
      for (let y = y0 + 11; y < y1 + 1; y += 11) K.m.push(box(tx - h, y, -h - 0.3, tx + h, y + 0.6, -h + 0.3), box(tx - h, y, h - 0.3, tx + h, y + 0.6, h + 0.3), box(tx - h - 0.3, y, -h, tx - h + 0.3, y + 0.6, h), box(tx + h - 0.3, y, -h, tx + h + 0.3, y + 0.6, h));
      K.m.push(box(tx - 6, y1, -6, tx + 6, y1 + 1.2, 6), box(tx + 4.6, y1, 4.6, tx + 5.4, y1 + 34, 5.4)); K.g.push(box(tx + 4.4, y1 + 34, 4.4, tx + 5.6, y1 + 35.6, 5.6));
      dish(K, 11, tx - 1, y1 + 7, 0, 0.8, -0.5); }
    dish(K, 5, 25, 34.5, -12, 0.55, 2.4);
    { const a = new THREE.CylinderGeometry(9, 9, 22, 12, 1, false, 0, Math.PI); a.rotateZ(Math.PI / 2); a.rotateY(Math.PI / 2); a.translate(-48, 0, 40); K.w.push(a); }   // the garage
    K.d.push(box(-53, 0, 51, -43, 6.5, 51.3));
  }
  const KINDS = [HAB, LAB].map((K) => [[K.w, outMat(2)], [K.m, outMat(1)], [K.g, outMat(3, [3.2, 2.0, 0.9])], [K.d, outMat(3, [0.02, 0.026, 0.036])], [K.p, outMat(4)]]
    .filter(([a]) => a.length).map(([a, m]) => [mergeGeometries(a), m]));
  const placed = [[], []], spots = [], _q = new THREE.Quaternion(), _up = new V3(0, 1, 0);
  // set one down: level on the slope (its bench takes up the difference), unless something already stands there
  const setDown = (kind, x, z, s, yaw) => {
    for (const [px, pz, pr] of spots) if (Math.hypot(x - px, z - pz) < (pr + 62 * s)) return false;
    let lo = 1e9, hi = -1e9; for (const [ox, oz] of [[-60, -40], [60, -40], [-60, 40], [60, 40], [0, 0]]) { const c = Math.cos(yaw), sn = Math.sin(yaw), y = groundH(x + (c * ox + sn * oz) * s, z + (-sn * ox + c * oz) * s); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (hi - lo > 60 * s) return false;                                                                        // too steep here even for a bench
    placed[kind].push(new THREE.Matrix4().compose(new V3(x, lo + (hi - lo) * 0.28 + 1.5 * s, z), _q.setFromAxisAngle(_up, yaw), new V3(s, s, s)));
    spots.push([x, z, 62 * s]); return true;
  };
  for (const a of [2.1, 2.7, 3.6]) for (const q of [1.06, 0.97, 0.88]) spots.push([OUT.sx + Math.cos(a) * OUT.cr * q, OUT.sz + Math.sin(a) * OUT.cr * q, 45]);   // keep the heads of the stairs clear
  // on the slope on the near side
  for (let k = 0, tries = 0; k < 26 && tries < 600; tries++) {
    const a = 1.0 + r() * 1.6, rr = OUT.cr * (0.95 + r() * 0.5), x = OUT.sx + Math.cos(a) * rr, z = OUT.sz + Math.sin(a) * rr;
    if (setDown(r() < 0.55 ? 0 : 1, x, z, 0.8 + r() * 1.3, (r() - 0.5) * 1.4)) k++;
  }
  // and outposts on and on: a few of them together, a light or two, smaller and further
  const pts = [];
  for (let k = 0; k < 140; k++) {
    const a = r() * Math.PI * 2, dist = 1600 + Math.pow(r(), 0.7) * 40000, x = OUT.sx + Math.cos(a) * dist, z = OUT.sz + Math.sin(a) * dist - 4000, y = groundH(x, z);
    const s = 0.6 + r() * 1.8;
    for (let q = 0, n = 2 + (r() * 4 | 0), tries = 0; q < n && tries < 30; tries++) if (setDown(r() < 0.5 ? 0 : 1, x + (r() - 0.5) * 420 * s, z + (r() - 0.5) * 420 * s, (0.3 + r() * 0.55) * s, r() * Math.PI * 2)) q++;
    pts.push(x, y + 30 * s, z);
    if (r() < 0.5) { const ex = x + (r() - 0.5) * 200, ez = z + (r() - 0.5) * 200; pts.push(ex, groundH(ex, ez) + 15, ez); }
  }
  KINDS.forEach((parts, kind) => { for (const [geo, m] of parts) { const im = new THREE.InstancedMesh(geo, m, placed[kind].length); placed[kind].forEach((M, i) => im.setMatrixAt(i, M)); im.frustumCulled = false; scene.add(im); } });
  for (let k = 0; k < 60; k++) { const a = r() * 6.283, rr = r() * OUT.cr * 1.4, x = OUT.sx + Math.cos(a) * rr, z = OUT.sz + Math.sin(a) * rr; pts.push(x, groundH(x, z) + 6, z); }
  const add2 = (geos, m) => { if (!geos.length) return; const me = new THREE.Mesh(mergeGeometries(geos.map((g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); return g; })), m); me.frustumCulled = false; scene.add(me); };
  add2(metal, outMat(1)); add2(white, outMat(2)); add2(warm, outMat(3, [3.2, 2.0, 0.9]));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const pm = new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(2.6, 2.1, 1.5), size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false })); pm.frustumCulled = false; scene.add(pm);
}
// The megastructures: three of them hanging out over the Earth beyond the open end, high up (the big two are hidden by the roof from inside
// the hall: you only see them from out on the platform, looking up), kilometres across, built of plates and blocks and
// trusses on every scale (the big one a tower with a broken ring round it and gold rings of light at its waist), turning very slowly;
// small ships go to and fro round the big one.
const megaMat = (kind) => new THREE.ShaderMaterial({
  uniforms: { uCam, uSun: { value: SUN }, uTime }, side: THREE.DoubleSide, defines: { KIND: kind },
  vertexShader: `#include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec3 vNl;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vNl = normal; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
  ${NOISE}
  uniform vec3 uCam, uSun; uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec3 vNl;
  float seam(vec2 q, float S, float w){ vec2 f = abs(fract(q / S) - 0.5) * S; vec2 aa = fwidth(q) * 0.9; vec2 s = 1.0 - smoothstep(vec2(w) - aa, vec2(w) + aa, f); return max(s.x, s.y) * clamp(1.0 - max(fwidth(q.x), fwidth(q.y)) / (S * 0.25), 0.0, 1.0); }
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN); if (dot(n, uCam - vW) < 0.0) n = -n;
    vec3 an = abs(vNl); vec2 q = an.x > 0.5 ? vL.zy : (an.y > 0.5 ? vL.xz : vL.xy);
    float side = an.x > 0.5 ? 1.0 : (an.y > 0.5 ? 2.0 : 3.0);
    // plates in three sizes, each its own shade: mostly off-white, some blue-grey, now and then a dull red
    vec2 i1 = floor(q / 90.0), i2 = floor(q / 26.0), i3 = floor(q / 7.0);
    float h1 = hash3(vec3(i1, side)), h2 = hash3(vec3(i2, side + 4.0)), h3 = hash3(vec3(i3, side + 9.0));
    vec3 alb = vec3(0.70, 0.71, 0.72) * (0.82 + 0.22 * h1) * (0.9 + 0.14 * h2) * (0.94 + 0.08 * h3);
    if (h2 > 0.82) alb = mix(alb, vec3(0.33, 0.38, 0.46), 0.75);
    if (h1 > 0.93) alb = mix(alb, vec3(0.50, 0.17, 0.14), 0.7);
  #if KIND == 1
    alb = vec3(0.20, 0.22, 0.25) * (0.8 + 0.4 * h2);   // trusses and the dark undersides
  #endif
    alb *= 1.0 - 0.45 * seam(q, 90.0, 1.2) - 0.3 * seam(q, 26.0, 0.5) - 0.18 * seam(q, 7.0, 0.18);
    // each plate sits at its own slight angle, so the light breaks up across them
    vec3 pn = normalize(n + (vec3(hash3(vec3(i2, 1.0)), hash3(vec3(i2, 2.0)), hash3(vec3(i2, 3.0))) - 0.5) * 0.22);
    float sl = max(dot(pn, uSun), 0.0);
    float fill = max(dot(pn, normalize(vec3(0.1, -0.8, -0.55))), 0.0);   // the Earth, bright below
    vec3 v = normalize(uCam - vW);
    vec3 col = alb * (vec3(1.0, 0.97, 0.92) * 1.55 * sl + vec3(0.25, 0.42, 0.7) * 0.32 * fill + vec3(0.025, 0.03, 0.045));
    col += vec3(0.9) * pow(max(dot(reflect(-uSun, pn), v), 0.0), 50.0) * 0.35 * sl;
    // rows of small windows on some plates; a few of them lit
    vec2 wq = q / vec2(5.0, 3.5); vec2 wi = floor(wq), wf = fract(wq);
    float win = step(0.72, h1) * step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.7) * clamp(1.0 - fwidth(wq.x) * 1.5, 0.0, 1.0);
    float lit = step(0.8, hash3(vec3(wi, 7.0)));
    col = mix(col, vec3(0.02, 0.025, 0.035), win * 0.8);
    col += win * lit * mix(vec3(1.6, 1.1, 0.6), vec3(0.6, 0.9, 1.6), step(0.5, hash3(vec3(wi, 3.0)))) * 0.9;
    float d = distance(uCam, vW);
    col = mix(col, vec3(0.03, 0.045, 0.07), (1.0 - exp(-d / 220000.0)));
    gl_FragColor = vec4(col, 1.0);
  }`,
});
const megas = [];
{
  const r = mulberry32(2027), M4 = THREE.Matrix4;
  const B = (arr, cx, cy, cz, sx, sy, sz, m) => { const b = new THREE.BoxGeometry(sx, sy, sz); b.deleteAttribute('uv'); b.translate(cx, cy, cz); if (m) b.applyMatrix4(m); arr.push(b); };
  // blocks stuck all over one face of a box (centre c, half sizes h), pointing out along axis ax (0 x, 1 y, 2 z) and sign sg
  const greeble = (arr, c, h, ax, sg, n, smin, smax, m) => {
    for (let k = 0; k < n; k++) {
      const s = [smin + r() * (smax - smin), smin + r() * (smax - smin), smin + r() * (smax - smin)], p = [0, 0, 0];
      for (let a = 0; a < 3; a++) p[a] = c[a] + (r() * 2 - 1) * Math.max(0, h[a] - s[a] / 2);
      const out = s[ax] = (0.15 + r() * 0.6) * smax; p[ax] = c[ax] + sg * (h[ax] + out / 2 - 2);
      B(arr, p[0], p[1], p[2], s[0], s[1], s[2], m);
    }
  };
  const boxDetailed = (arr, c, h, n, smin, smax, m, skipY) => { B(arr, c[0], c[1], c[2], 2 * h[0], 2 * h[1], 2 * h[2], m); for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) if (!(skipY && ax === 1)) greeble(arr, c, h, ax, sg, n, smin, smax, m); };
  const finish = (hull, dark, glow, pos, scale, rot) => {
    const g = new THREE.Group();
    const mk = (arr, mt) => { if (!arr.length) return; const me = new THREE.Mesh(mergeGeometries(arr.map((q) => q.index ? q.toNonIndexed() : q)), mt); me.frustumCulled = false; g.add(me); };
    mk(hull, megaMat(0)); mk(dark, megaMat(1)); mk(glow, outMat(3, [5.0, 3.4, 0.9]));
    g.position.set(...pos); g.scale.setScalar(scale); g.rotation.set(...rot); scene.add(g); return g;
  };
  // 1: the tower and its broken ring
  {
    const hull = [], dark = [], glow = [];
    let y = -2600;
    while (y < 1500) {
      const hgt = 120 + r() * 380, w = 260 + r() * 220, d = 220 + r() * 200, ox = (r() - 0.5) * 60, oz = (r() - 0.5) * 60;
      boxDetailed(hull, [ox, y + hgt / 2, oz], [w / 2, hgt / 2, d / 2], 5 + (r() * 6 | 0), 15, 90);
      if (r() < 0.35) B(dark, ox + (r() - 0.5) * w, y + hgt / 2, oz + d / 2 + 30, 20, hgt * 0.9, 20);
      y += hgt;
    }
    boxDetailed(hull, [40, 1500 + 350, 0], [150, 350, 120], 6, 12, 60);                       // the block at the top
    for (let k = 0; k < 8; k++) B(dark, (r() - 0.5) * 240, 2200 + r() * 160, (r() - 0.5) * 180, 6, 160 + r() * 200, 6);   // masts
    // the ring: 290 degrees of it, in segments of different depth, built over with blocks, open at one side
    const RR = 2000;
    for (let k = 0; k < 40; k++) {
      const a = 0.6 + k / 40 * 5.06, len = RR * 5.06 / 40 * 1.02, m = new M4().makeRotationY(-a).premultiply(new M4().makeTranslation(Math.cos(a) * RR, 300, Math.sin(a) * RR));
      const rd = 420 + r() * 260, hh = 300 + r() * 160;
      boxDetailed(hull, [0, 0, 0], [rd / 2, hh / 2, len / 2], 3 + (r() * 4 | 0), 20, 120, m);
      if (r() < 0.5) boxDetailed(hull, [rd / 2 + 60, (r() - 0.5) * 100, 0], [70, hh * 0.3, len * 0.3], 2, 10, 40, m);
      if (r() < 0.4) B(dark, -rd / 2 - 20, -hh / 2 - 40, 0, 30, 80, len * 0.8, m);
    }
    for (const a of [0.6, 5.66]) { const m = new M4().makeRotationY(-a).premultiply(new M4().makeTranslation(Math.cos(a) * RR, 300, Math.sin(a) * RR));   // trusses across the open ends
      for (let k = 0; k < 6; k++) B(dark, (k - 2.5) * 90, 0, 0, 14, 420, 14, m); B(dark, 0, 200, 0, 520, 14, 14, m); B(dark, 0, -200, 0, 520, 14, 14, m); }
    for (const a of [1.6, 3.3, 4.9]) { const m = new M4().makeRotationY(-a); B(dark, RR / 2, 300, 0, RR - 300, 40, 40, m); B(dark, RR / 2, 380, 0, RR - 300, 16, 16, m); }   // spokes
    // the gold rings of light at its waist
    for (const [rr, t] of [[430, 9], [560, 6], [700, 11]]) { const tg = new THREE.TorusGeometry(rr, t, 6, 96); tg.deleteAttribute('uv'); tg.rotateX(Math.PI / 2); tg.translate(0, 250, 0); glow.push(tg); }
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; if (k % 3 === 0) continue; const m = new M4().makeRotationY(-a); B(glow, 630, 250, 0, 90, 6, 18, m); }
    megas.push({ g: finish(hull, dark, glow, [-11000, 42000, -28000], 2.3, [0.12, 0.6, 0.05]), spin: 0.035, bob: 400 });   // spin: radians a second about its own axis (about three minutes a turn)
  }
  // 2: a spine with two great wheels
  {
    const hull = [], dark = [], glow = [];
    boxDetailed(hull, [0, 0, 0], [120, 1500, 120], 22, 15, 70);
    for (const wy of [-700, 650]) {
      const RR = 1100;
      for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, m = new M4().makeRotationY(-a).premultiply(new M4().makeTranslation(Math.cos(a) * RR, wy, Math.sin(a) * RR));
        boxDetailed(hull, [0, 0, 0], [130, 110, RR * Math.PI / 36 * 1.03], 2, 12, 50, m); }
      for (let k = 0; k < 4; k++) { const m = new M4().makeRotationY(-k * Math.PI / 2); B(dark, RR / 2, wy, 0, RR, 30, 30, m); }
      const tg = new THREE.TorusGeometry(260, 6, 6, 64); tg.deleteAttribute('uv'); tg.rotateX(Math.PI / 2); tg.translate(0, wy, 0); glow.push(tg);
    }
    megas.push({ g: finish(hull, dark, glow, [2000, 50000, -36000], 1.9, [0.35, 0.2, -0.25]), spin: -0.05, bob: 300 });
  }
  // 3: a long hauler, lying across
  {
    const hull = [], dark = [], glow = [];
    let x = -1400;
    while (x < 1400) { const l = 120 + r() * 260, w = 160 + r() * 200, h = 140 + r() * 180; boxDetailed(hull, [x + l / 2, (r() - 0.5) * 40, 0], [l / 2, h / 2, w / 2], 4, 12, 60); x += l + 10; }
    B(dark, 0, 0, 0, 2900, 50, 50);
    for (let k = 0; k < 4; k++) { const tg = new THREE.CylinderGeometry(70, 90, 120, 16); tg.deleteAttribute('uv'); tg.rotateZ(Math.PI / 2); tg.translate(-1460, (k % 2 - 0.5) * 180, (k < 2 ? -1 : 1) * 90); dark.push(tg); }
    for (let k = 0; k < 4; k++) B(glow, -1525, (k % 2 - 0.5) * 180, (k < 2 ? -1 : 1) * 90, 8, 120, 120);
    megas.push({ g: finish(hull, dark, glow, [-33000, 10500, -44000], 1.6, [0.05, -0.5, 0.08]), spin: 0.0, bob: 200, drift: 25 });
  }
  // small ships round the big one
  const sh = [], sg = [];
  for (let k = 0; k < 10; k++) { const s = 30 + r() * 50; B(sh, 0, 0, 0, s * 3, s * 0.7, s); B(sg, -s * 1.55, 0, 0, 4, s * 0.5, s * 0.6); }
  const shipGeo = mergeGeometries(sh.map((q) => q.toNonIndexed())), glowGeo = mergeGeometries(sg.map((q) => q.toNonIndexed()));
  for (let k = 0; k < 10; k++) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(shipGeo, megaMat(0))); g.add(new THREE.Mesh(glowGeo, outMat(3, [1.5, 2.6, 4.0])));
    g.traverse((o) => { o.frustumCulled = false; }); g.scale.setScalar(1.6); scene.add(g);
    megas.push({ ship: g, R: 3600 + r() * 2600, ph: r() * 6.28, sp: 0.01 + r() * 0.02, yy: (r() - 0.5) * 3000 });
  }
}
const _spinQ = new THREE.Quaternion(), _spinAx = new THREE.Vector3(0, 1, 0);
function megaFrame(t) {
  const c = megas[0].g.position;
  for (const m of megas) {
    if (m.ship) { const a = m.ph + t * m.sp, x = c.x + Math.cos(a) * m.R * 1.4, z = c.z + Math.sin(a) * m.R * 1.4; m.ship.position.set(x, c.y + m.yy + Math.sin(a * 2) * 300, z); m.ship.rotation.y = -a - Math.PI / 2; continue; }
    if (m.base === undefined) { m.base = m.g.position.clone(); m.q0 = m.g.quaternion.clone(); }
    if (m.spin) m.g.quaternion.copy(m.q0).multiply(_spinQ.setFromAxisAngle(_spinAx, t * m.spin));   // turning slowly about its own (tilted) axis
    m.g.position.set(m.base.x + (m.drift ? Math.sin(t * 0.003) * m.drift * 40 : 0), m.base.y + Math.sin(t * 0.05 + m.base.x) * m.bob * 0.1, m.base.z);
  }
}

// the platform itself: 600 m deep, from the right-hand side of the hall to 5 km past the cliff, no rail along it (you still cannot walk off).
// Its top is done like the floor of the hall, only pale: great slabs with joints between them and finer lines inside, stained and mottled,
// polished, damp here and there, and the hall and the sky seen in it (the same upside-down picture the hall's floor looks up), not as deep.
// Little lamps are let into it along its edges, so the edge reads in the dark.
const PLAT = [];   // left out of the floor's mirror picture, as the floor is
{
  const box = (x0, y0, z0, x1, y1, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  PLAT.push(add(box(XLP, -24, PZ1, XR + 900, -0.02, ZE), mat(7)));   // the slab
  const platMat = new THREE.ShaderMaterial({
    uniforms: { uCam, uTime, uMirrorVP, uRefl: floorMat.uniforms.uRefl, uPx: floorMat.uniforms.uPx },
    vertexShader: VERT,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
    ${NOISE}${LIGHT}
    uniform sampler2D uRefl; uniform vec2 uPx;
    varying vec3 vW; varying vec3 vN; varying vec4 vR;
    float lines(float v, float period, float w){ float f = abs(fract(v / period + 0.5) - 0.5) * period; float aa = fwidth(v) * 1.2; return 1.0 - smoothstep(w - aa, w + aa, f); }
    void main(){
      #include <logdepthbuf_fragment>
      vec2 q = vW.xz; float px = length(fwidth(vW)) + 1e-3;
      float big = fbm3(vec3(q / 420.0, 11.0)), mid = fbm3(vec3(q / 38.0, 13.0)), small = noise3(vec3(q / 2.6, 17.0));
      float wet = clamp(smoothstep(0.45, 0.70, big) * 0.6 + smoothstep(0.50, 0.75, mid) * 0.3, 0.0, 1.0);
      // slabs: great ones with a wide joint, a finer grid inside them, and each small slab its own shade
      float j = max(lines(q.x, 120.0, 0.35), lines(q.y, 120.0, 0.35)), j2 = max(lines(q.x, 12.0, 0.05), lines(q.y, 12.0, 0.05)), j3 = max(lines(q.x, 3.0, 0.012), lines(q.y, 3.0, 0.012));
      vec2 sid = floor(q / 12.0); float st = fract(sin(dot(sid, vec2(127.1, 311.7))) * 43758.5453) * (1.0 - smoothstep(0.5, 3.0, px));
      float gr = (noise3(vec3(q / 0.25, 23.0)) - 0.5) * (1.0 - smoothstep(0.03, 0.12, px));      // close to, the grain of it
      vec3 alb = vec3(0.60, 0.61, 0.62) * (0.78 + 0.32 * mid + 0.12 * small + 0.18 * (st - 0.5) + 0.12 * gr) * (1.0 - 0.50 * j - 0.32 * j2 - 0.14 * j3);
      alb *= (1.0 - 0.18 * smoothstep(0.55, 0.85, fbm3(vec3(q / 9.0, 19.0)))) * (1.0 - 0.10 * smoothstep(0.5, 0.8, fbm3(vec3(q.x / 3.0, q.y / 30.0, 29.0))));   // stains, and long scuffs
      vec3 n = vec3(0.0, 1.0, 0.0);
      vec3 col = shade(vW, n, alb * (1.0 - 0.25 * wet), 0.5, 0.25) + alb * vec3(0.05, 0.06, 0.08);
      // what is seen in it
      vec2 uv = vR.xy / vR.w * 0.5 + 0.5;
      vec2 wob = (vec2(noise3(vec3(q / 6.0, 1.0)), noise3(vec3(q / 6.0, 5.0))) - 0.5) * 0.012 * (1.2 - wet);
      float rad = mix(10.0, 1.5, wet); vec3 rf = vec3(0.0);
      for (int k = 0; k < 7; k++){ float a = float(k) * 2.39996; float r = sqrt(float(k) / 7.0) * rad; rf += texture2D(uRefl, uv + wob + vec2(cos(a), sin(a)) * r * uPx).rgb; }
      rf /= 7.0;
      vec3 v = normalize(uCam - vW);
      float fres = 0.04 + 0.96 * pow(1.0 - max(v.y, 0.0), 5.0);
      float k = mix(0.10, 0.70, wet) * mix(0.5, 1.0, fres);
      col = col * (1.0 - k * 0.5) + rf * k;
      gl_FragColor = vec4(haze(col, vW), 1.0);
    }`,
  });
  const g = new THREE.PlaneGeometry(XR + 900 - XLP, ZE - PZ1); g.rotateX(-Math.PI / 2); g.translate((XR + 900 + XLP) / 2, 0, (ZE + PZ1) / 2);
  PLAT.push(add(g, platMat));
  // the lamps let into the edges
  const lp = []; for (let x = XL - 700; x > XLP; x -= 120) lp.push(x, 0.06, PZ1 + 0.8, x, 0.06, ZE - 0.8);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const lpt = new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color(2.0, 2.2, 2.5), size: 2.0, sizeAttenuation: false, transparent: true, depthWrite: false })); lpt.frustumCulled = false; scene.add(lpt);
}
// where you can go: the hall, and the platform (with its own walls)
function walkClamp(pos, m) {
  const cx = XL + cliffOut(0, Math.max(pos.z, ZE)) + 4 + m;
  if (pos.z > ZE - m) {   // in the hall (or the strip where it meets the platform)
    if (pos.x < cx) { if (pos.z < ZE + 2 * m + 2) pos.z = ZE - m; else pos.x = cx; }
  }
  if (pos.z <= ZE - m) { pos.x = clamp(pos.x, XLP + 1 + m, XR - 700 - m); pos.z = clamp(pos.z, PZ1 + 1.2 + m, ZE - m); }
  else pos.x = Math.min(pos.x, XR - 700 - m);
  pos.z = Math.min(pos.z, ZB - 0.5 - m);
}

/* ---------------- the car ---------------- */
// The hall is far too big to walk, so by the door there is something to drive, absurdly fast. E to get in (and out,
// once it has stopped; F hides the car's body, and brings it back). W to go, S to brake (and back up), A/D to steer, Space for the hand brake. Flat out it does about 160 m/s,
// so the light at the far end is a bit over a minute away. It stops dead at the walls.
const CAR = { x: DOOR.x + 7, z: ZB - 10, yaw: 0, v: 0, steer: 0, sv: 0, yr: 0, on: false, g: new THREE.Group(), hintT: 0, fov: 72, roll: 0, wheels: [], hide: null, keep: [], bare: false, pT: null, tipT: 0 };
// bare: the car hidden while you drive (F), nothing of it left in view, so the floor streams past uncovered; pT: a pitch the view eases to
const CAR_MAX = 160, CAR_ACC = 75, SEAT = [0.0, 1.62, 0.6], BUS = { hw: 0.75, hl: 1.55 };
// It is an airport baggage tug, done as close to the real thing as I can: a white steel body with a blue stripe and rounded edges, a big
// orange bonnet with a grille, round headlamps, black fenders over fat treaded tyres on steel rims (the wheels turn, the front ones steer),
// a bent-tube bumper, mirrors, an open seat behind a small dash with gauges, a step plate in chequered aluminium, a tow hitch, tail lamps
// and an amber beacon. While you drive the seat back, the beacon and the back panel are left out; press F and the whole car goes, so the
// floor and what shines in it stream past under you (F again: it is back).
{
  const RB = (sx, sy, sz, r, cx, cy, cz) => { const g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3)); g.translate(cx, cy, cz); return g; };
  const BX = (x0, y0, z0, x1, y1, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  const CY = (r0, r1, h, seg, axis, cx, cy, cz) => { const c = new THREE.CylinderGeometry(r0, r1, h, seg); if (axis === 'x') c.rotateZ(Math.PI / 2); if (axis === 'z') c.rotateX(Math.PI / 2); c.translate(cx, cy, cz); return c; };
  const TB = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'catmullrom', 0.2), pts.length * 12, r, 10, false);
  const P = { white: [], orange: [], blue: [], plastic: [], rubber: [], metal: [], steel: [], seat: [], glowW: [], glowR: [], glowA: [], gauge: [], dash: [], dashM: [] };
  const H = { plastic: [], seat: [], white: [], glowA: [] };   // the parts left out while you drive
  // the frame and body
  P.steel.push(BX(-0.6, 0.24, -1.5, 0.6, 0.42, 1.45));
  P.white.push(RB(1.42, 0.5, 2.85, 0.07, 0, 0.68, -0.02));
  P.white.push(RB(1.44, 0.12, 1.15, 0.04, 0, 0.99, 0.82));                                   // the deck the seat stands on
  P.blue.push(BX(-0.716, 0.56, -1.38, -0.706, 0.64, 1.34), BX(0.706, 0.56, -1.38, 0.716, 0.64, 1.34));
  // bonnet: orange, rounded, a grille in its nose, a lip where it meets the body
  P.orange.push(RB(1.38, 0.34, 1.32, 0.11, 0, 1.1, -0.78));
  P.plastic.push(BX(-0.69, 0.92, -1.45, 0.69, 0.95, -0.12));
  for (let k = 0; k < 7; k++) P.plastic.push(BX(-0.42, 0.98 + k * 0.03, -1.445, 0.42, 0.995 + k * 0.03, -1.43));
  // fenders over the wheels
  for (const sx of [-1, 1]) for (const sz of [-0.95, 0.95]) { const f = new THREE.TorusGeometry(0.44, 0.045, 8, 28, Math.PI); f.scale(1, 1, 2.6); f.rotateY(Math.PI / 2); f.translate(sx * 0.66, 0.38, sz); P.plastic.push(f); }
  // headlamps (round, chromed rims), indicators, tail lamps, reflectors
  for (const sx of [-1, 1]) {
    P.metal.push(CY(0.085, 0.085, 0.06, 20, 'z', sx * 0.5, 0.78, -1.44)); P.glowW.push(CY(0.068, 0.068, 0.02, 20, 'z', sx * 0.5, 0.78, -1.475));
    P.glowA.push(BX(sx * 0.62 - 0.05, 0.86, -1.452, sx * 0.62 + 0.05, 0.9, -1.44));
    P.metal.push(BX(sx * 0.5 - 0.09, 0.82, 1.41, sx * 0.5 + 0.09, 0.92, 1.43)); P.glowR.push(BX(sx * 0.5 - 0.075, 0.835, 1.43, sx * 0.5 + 0.075, 0.905, 1.436));
  }
  // the bumper: bent tube
  P.metal.push(TB([[-0.62, 0.48, -1.42], [-0.64, 0.5, -1.58], [-0.4, 0.5, -1.64], [0.4, 0.5, -1.64], [0.64, 0.5, -1.58], [0.62, 0.48, -1.42]], 0.032));
  P.metal.push(TB([[-0.62, 0.82, -1.42], [-0.64, 0.84, -1.58], [-0.4, 0.84, -1.64], [0.4, 0.84, -1.64], [0.64, 0.84, -1.58], [0.62, 0.82, -1.42]], 0.028));
  for (const x of [-0.42, -0.14, 0.14, 0.42]) P.metal.push(CY(0.022, 0.022, 0.34, 10, 'y', x, 0.67, -1.64));
  // mirrors on arms at the front corners of the bonnet, low enough to keep out of the way
  for (const sx of [-1, 1]) { P.plastic.push(TB([[sx * 0.66, 1.2, -1.2], [sx * 0.82, 1.24, -1.22], [sx * 0.9, 1.28, -1.2]], 0.012)); P.plastic.push(RB(0.06, 0.14, 0.1, 0.02, sx * 0.93, 1.3, -1.2)); }
  // the step plate, the floor of the cab, the dash and its gauges, the steering column and wheel (kept low)
  P.metal.push(BX(-0.74, 0.62, 0.15, -0.71, 0.66, 0.75), BX(0.71, 0.62, 0.15, 0.74, 0.66, 0.75));
  P.rubber.push(BX(-0.6, 1.05, 0.05, 0.6, 1.06, 1.25));
  P.dash.push(RB(0.9, 0.16, 0.2, 0.05, 0, 1.17, -0.06));
  for (const x of [-0.24, 0.24]) { P.dashM.push(CY(0.045, 0.045, 0.02, 18, 'z', x, 1.18, -0.162)); P.gauge.push(CY(0.036, 0.036, 0.01, 18, 'z', x, 1.18, -0.173)); }
  P.steel.push(CY(0.03, 0.03, 0.42, 10, 'y', 0, 1.2, 0.1).rotateX(0));
  { const sw = new THREE.TorusGeometry(0.17, 0.018, 10, 32); sw.rotateX(-1.25); sw.translate(0, 1.3, 0.26); P.plastic.push(sw);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, s = new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6); s.rotateZ(Math.PI / 2); s.rotateY(a); s.rotateX(-1.25); s.translate(0, 1.3, 0.26); P.plastic.push(s); } }
  // the seat: cushion and bolsters (always), back and headrest (left out while you drive)
  P.seat.push(RB(0.56, 0.12, 0.5, 0.05, 0, 1.12, 0.6), RB(0.07, 0.1, 0.46, 0.03, -0.29, 1.17, 0.6), RB(0.07, 0.1, 0.46, 0.03, 0.29, 1.17, 0.6));
  H.seat.push(RB(0.54, 0.55, 0.1, 0.05, 0, 1.47, 0.9), RB(0.3, 0.16, 0.08, 0.04, 0, 1.84, 0.92));
  // back panel with the tow hitch below it, and the beacon on its mast
  H.white.push(RB(1.4, 0.32, 0.12, 0.03, 0, 1.18, 1.35));
  P.steel.push(BX(-0.12, 0.42, 1.43, 0.12, 0.56, 1.62), CY(0.03, 0.03, 0.2, 10, 'y', 0, 0.5, 1.56));
  H.plastic.push(CY(0.018, 0.018, 0.5, 8, 'y', 0.58, 1.6, 1.3)); H.glowA.push(CY(0.06, 0.07, 0.12, 16, 'y', 0.58, 1.9, 1.3));
  const m = (geos, mt, parent) => { if (!geos.length) return null; const me = new THREE.Mesh(mergeGeometries(geos.map((g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), mt); (parent || CAR.g).add(me); return me; };
  const MT = { white: mat(8, [0.80, 0.81, 0.82], 'paintW'), orange: mat(8, [0.78, 0.36, 0.06], 'paintO'), blue: mat(8, [0.03, 0.13, 0.48], 'paintB'), plastic: mat(11), rubber: mat(9), metal: mat(10), steel: mat(11, [0, 0, 0], 'steel'), seat: mat(11, [0, 0, 0], 'seat'),
    glowW: mat(4, [6.0, 6.0, 5.4], 'head2'), glowR: mat(4, [3.5, 0.25, 0.15], 'tail2'), glowA: mat(4, [3.8, 1.8, 0.2], 'amber'), gauge: mat(4, [0.4, 1.1, 1.5], 'gauge2'), dash: mat(11), dashM: mat(10) };
  for (const k of Object.keys(P)) { const me = m(P[k], MT[k]); if (me && (k === 'dash' || k === 'dashM' || k === 'gauge')) CAR.keep.push(me); }
  CAR.hide = new THREE.Group(); CAR.g.add(CAR.hide); for (const k of Object.keys(H)) m(H[k], MT[k], CAR.hide);
  // the wheels: treaded tyres (turned on a lathe), steel rims with five studs, a hub cap; each its own piece so it can roll and steer
  const prof = []; for (let k = 0; k <= 16; k++) { const a = -Math.PI / 2 + k / 16 * Math.PI; prof.push(new THREE.Vector2(0.29 + 0.07 * Math.cos(a), 0.12 * Math.sin(a))); }
  prof.unshift(new THREE.Vector2(0.2, -0.12)); prof.push(new THREE.Vector2(0.2, 0.12));
  const tyre = new THREE.LatheGeometry(prof, 48); tyre.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-0.95, 0.95]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.66, 0.36, sz); CAR.g.add(piv);
    const spin = new THREE.Group(); piv.add(spin);
    spin.add(new THREE.Mesh(tyre, MT.rubber));
    const rim = []; rim.push(CY(0.205, 0.205, 0.2, 28, 'x', 0, 0, 0)); rim.push(CY(0.09, 0.11, 0.04, 20, 'x', sx * 0.11, 0, 0));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; rim.push(CY(0.014, 0.014, 0.03, 8, 'x', sx * 0.125, Math.cos(a) * 0.06, Math.sin(a) * 0.06)); }
    m(rim, MT.metal, spin);
    CAR.wheels.push({ piv, spin, front: sz < 0 });
  }
  // the shadow it throws on the floor (soft, darkest under the middle)
  { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128);
    const sg = new THREE.PlaneGeometry(2.0, 3.6); sg.rotateX(-Math.PI / 2); sg.translate(0, 0.012, 0); const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); CAR.g.add(sm); }
  CAR.g.position.set(CAR.x, 0, CAR.z); scene.add(CAR.g);
}
const carUI = document.createElement('div');
carUI.style.cssText = "position:fixed;left:0;right:0;bottom:7%;text-align:center;color:#dfe8f2;font:300 17px/1.4 'Segoe UI','Helvetica Neue',Arial,sans-serif;letter-spacing:.25em;opacity:0;transition:opacity .4s;pointer-events:none;z-index:4;text-shadow:0 0 10px rgba(0,0,0,.6)";
const carSpd = document.createElement('div');
carSpd.style.cssText = "position:fixed;right:4%;bottom:6%;color:#cfe0f0;font:200 40px/1 'Segoe UI Light','Segoe UI',Arial,sans-serif;letter-spacing:.08em;text-align:right;opacity:0;transition:opacity .4s;pointer-events:none;z-index:4";
const carTip = document.createElement('div');
carTip.style.cssText = "position:fixed;left:0;right:0;bottom:12%;text-align:center;color:#dfe8f2;font:300 14px/1.4 'Segoe UI','Helvetica Neue',Arial,sans-serif;letter-spacing:.25em;opacity:0;transition:opacity .4s;pointer-events:none;z-index:4;text-shadow:0 0 10px rgba(0,0,0,.6)";
carTip.textContent = 'TIP  ·  PRESS  F  TO HIDE THE CAR';
document.body.appendChild(carUI); document.body.appendChild(carSpd); document.body.appendChild(carTip);
const carNear = () => { if (CAR.on) return false; const dx = P.pos.x - CAR.x, dz = P.pos.z - CAR.z, c = Math.cos(CAR.yaw), s = Math.sin(CAR.yaw), lx = c * dx - s * dz, lz = s * dx + c * dz; return Math.abs(lx) < BUS.hw + 2.0 && Math.abs(lz) < BUS.hl + 1.6; };
function carE() {
  if (CAR.on) {
    if (Math.abs(CAR.v) > 4) return;
    CAR.on = false; CAR.v = 0; CAR.bare = false; CAR.pT = null; CAR.tipT = 0;
    const c = Math.cos(CAR.yaw), s = Math.sin(CAR.yaw);   // out on the driver's side
    const lx = -BUS.hw - 1.0, lz = SEAT[2]; P.pos.set(CAR.x + c * lx + s * lz, 0, CAR.z - s * lx + c * lz); P.vel.set(0, 0, 0); return;
  }
  if (carNear()) { CAR.on = true; CAR.hintT = 7; CAR.tipT = 6; CAR.bare = false; CAR.pT = null; CAR.steer = CAR.sv = CAR.yr = CAR.roll = 0; P.vel.set(0, 0, 0); P.yaw = CAR.yaw; P.pitch = -0.22; initAudio(); }
}
function carBare(b) { CAR.bare = b; CAR.pT = b ? -0.02 : -0.22; CAR.tipT = 0; }
addEventListener('keydown', (e) => { if (e.repeat || (window.SCF_G && window.SCF_G.isOpen())) return;
  if (e.code === 'KeyE') carE(); else if (e.code === 'KeyF' && CAR.on) carBare(!CAR.bare); });
let eng = null;
function drive(dt) {
  if (keys.ArrowLeft) P.yaw += 1.8 * dt; if (keys.ArrowRight) P.yaw -= 1.8 * dt;
  if (keys.ArrowUp || keys.ArrowDown) CAR.pT = null;
  if (CAR.pT !== null) { P.pitch += (CAR.pT - P.pitch) * Math.min(1, dt * 5); if (Math.abs(CAR.pT - P.pitch) < 0.002) CAR.pT = null; }
  if (keys.ArrowUp) P.pitch = Math.min(1.5, P.pitch + 1.3 * dt); if (keys.ArrowDown) P.pitch = Math.max(-1.5, P.pitch - 1.3 * dt);
  const thr = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), av = Math.abs(CAR.v);
  if (thr > 0) CAR.v += CAR_ACC * dt * (1 - 0.55 * Math.max(CAR.v, 0) / CAR_MAX) * (CAR.v < 0 ? 3 : 1);
  else if (thr < 0) CAR.v -= (CAR.v > 0 ? 140 : 12) * dt;
  else CAR.v -= Math.sign(CAR.v) * Math.min(av, (4 + CAR.v * CAR.v * 0.0008) * dt);
  if (keys.Space) CAR.v -= Math.sign(CAR.v) * Math.min(Math.abs(CAR.v), 200 * dt);
  CAR.v = clamp(CAR.v, -20, CAR_MAX);
  // steering: the wheel moves on a soft spring (no snap at either end, and it comes back to the middle a little quicker than it goes out),
  // and the car's turn eases in behind it, so a tap is a small, clean correction and a held key a smooth, tight curve
  { const k = st !== 0 ? 85 : 110, d = 2 * Math.sqrt(k);
    CAR.sv += ((st - CAR.steer) * k - CAR.sv * d) * dt; CAR.steer = clamp(CAR.steer + CAR.sv * dt, -1, 1); }
  const av2 = Math.abs(CAR.v), yrT = CAR.steer * 2.3 * clamp(av2 / 2.5, 0, 1) / (1 + av2 / 95) * (CAR.v < 0 ? -1 : 1);
  CAR.yr += (yrT - CAR.yr) * Math.min(1, dt * 10);
  const yr = CAR.yr;
  CAR.yaw += yr * dt; P.yaw += yr * dt;   // the view turns with the car
  CAR.roll += (-yr * clamp(av2 / 60, 0, 1) * 0.045 - CAR.roll) * Math.min(1, dt * 6);   // and leans a touch out of the turn
  CAR.x -= Math.sin(CAR.yaw) * CAR.v * dt; CAR.z -= Math.cos(CAR.yaw) * CAR.v * dt;
  // the walls of the hall stop it dead
  { const q = { x: CAR.x, z: CAR.z }; walkClamp(q, 2.5); if (Math.abs(q.x - CAR.x) + Math.abs(q.z - CAR.z) > 1e-6) { const hit = Math.abs(CAR.v); CAR.x = q.x; CAR.z = q.z; CAR.v *= -0.1; if (hit > 25) footstep(4); } }
  P.pos.set(CAR.x, 0, CAR.z);
}
function carFrame(dt) {
  CAR.g.position.set(CAR.x, 0, CAR.z); CAR.g.rotation.y = CAR.yaw;
  // the wheels roll with the speed, the front ones turn with the steering; and while you drive the car itself is left out but for the dash
  for (const w of CAR.wheels) { w.spin.rotation.x -= CAR.v * dt / 0.36; if (w.front) w.piv.rotation.y = CAR.steer * 0.5 / (1 + Math.abs(CAR.v) / 60); }
  // the car as it is, the seat back, beacon and back panel left out while you drive; or, hidden (F), none of it at all
  const bare = CAR.on && CAR.bare;
  for (const ch of CAR.g.children) ch.visible = !bare && !(CAR.on && ch === CAR.hide);
  // the view pulls wider the faster you go
  const f = 72 + 16 * clamp(CAR.v / CAR_MAX, 0, 1); if (Math.abs(f - CAR.fov) > 0.05) { CAR.fov = f; camera.fov = f; camera.updateProjectionMatrix(); }
  CAR.hintT = Math.max(0, CAR.hintT - dt); CAR.tipT = Math.max(0, CAR.tipT - dt);
  carTip.style.opacity = CAR.on && CAR.tipT > 0 ? '1' : '0';   // the tip: once each time you get in, gone after a few seconds or the first F
  if (CAR.on) { carUI.textContent = CAR.hintT > 0 ? 'W  GO  ·  S  BRAKE  ·  A D  STEER  ·  F  HIDE CAR  ·  E  GET OUT' : (Math.abs(CAR.v) < 4 && CAR.hintT === 0 ? '' : ''); carUI.style.opacity = CAR.hintT > 0 ? '1' : '0'; carSpd.style.opacity = '1'; carSpd.textContent = Math.round(Math.abs(CAR.v) * 3.6) + ' km/h'; }
  else { const n = carNear(); carUI.textContent = 'E  DRIVE'; carUI.style.opacity = n ? '1' : '0'; carSpd.style.opacity = '0'; }
  // no motor: only air, faint and coming and going. Two layers of noise, a low soft rush and a thin high hiss, each swelling and
  // fading on its own slow gusts and drifting a little from ear to ear; louder and brighter with the speed, never loud
  if (CAR.on && AC && AC.state === 'running' && !eng) {
    try {
      const mk = (brown) => { const n = AC.sampleRate * 4, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); let l = 0;
        for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; }
        const s = AC.createBufferSource(); s.buffer = b; s.loop = true; s.start(0, Math.random() * 3); return s; };
      const lay = (brown, type, q) => { const s = mk(brown), f = AC.createBiquadFilter(); f.type = type; f.Q.value = q; const g = AC.createGain(); g.gain.value = 0;
        const pn = AC.createStereoPanner ? AC.createStereoPanner() : null; s.connect(f); f.connect(g); if (pn) { g.connect(pn); pn.connect(out); } else g.connect(out); return { f, g, pn }; };
      const lo = lay(true, 'lowpass', 0.4), hi = lay(false, 'bandpass', 0.7), send = AC.createGain(); send.gain.value = 0.25; hi.g.connect(send); send.connect(verb);
      eng = { lo, hi, ph: Math.random() * 100 };
    } catch (e) { eng = { failed: true }; }
  }
  if (eng && !eng.failed) {
    const k = clamp(Math.abs(CAR.v) / CAR_MAX, 0, 1), t = AC.currentTime, on = CAR.on ? 1 : 0, T = (eng.ph += dt);
    const gust = (a, b2, c) => clamp(0.5 + 0.32 * Math.sin(T * a) + 0.22 * Math.sin(T * b2 + 1.7) + 0.16 * Math.sin(T * c + 4.1), 0, 1);   // slow, uneven swells
    const g1 = gust(0.37, 0.91, 1.73), g2 = gust(0.53, 1.29, 2.31), sp = Math.sqrt(k);
    eng.lo.f.frequency.setTargetAtTime(160 + 520 * k + 120 * g1, t, 0.3); eng.lo.g.gain.setTargetAtTime(on * (0.004 + 0.05 * sp) * (0.25 + 0.75 * g1), t, 0.35);
    eng.hi.f.frequency.setTargetAtTime(700 + 1700 * k + 500 * g2, t, 0.3); eng.hi.g.gain.setTargetAtTime(on * 0.022 * sp * g2 * g2, t, 0.4);
    if (eng.lo.pn) eng.lo.pn.pan.setTargetAtTime(0.35 * Math.sin(T * 0.21), t, 0.5);
    if (eng.hi.pn) eng.hi.pn.pan.setTargetAtTime(0.5 * Math.sin(T * 0.33 + 2.0), t, 0.5);
  }
}

/* ---------------- loop ---------------- */
canvas.style.display = 'block';
let last = -1, fadeT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (last < 0) last = now; const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; uTime.value += dt; if (!(window.SCF_LOADING && SCF_LOADING.active)) fadeT += dt;   // the arrival (fade, the name) waits for the loading screen to go
  if (!(window.SCF_G && window.SCF_G.isOpen())) { if (CAR.on) drive(dt); else step(dt); }
  carFrame(dt); megaFrame(uTime.value);
  placeCamera(uTime.value); uCam.value.copy(camera.position);
  // speed: no dust in the air any more; what tells you how fast you go is the floor and the walls streaming past, smeared out from the middle
  spdK += ((CAR.on ? clamp(Math.abs(CAR.v) / CAR_MAX, 0, 1) : 0) - spdK) * Math.min(1, dt * 2.5);
  if (!MNAME.on && fadeT > 2.2) { MNAME.on = true; MNAME.el.style.opacity = '1'; }
  if (!MNAME.off && fadeT > 8.2) { MNAME.off = true; MNAME.el.style.opacity = '0'; }
  if (blinkMat) blinkMat.opacity = 0.15 + 0.85 * (Math.sin(uTime.value * Math.PI * 0.9) > 0.2 ? 1 : 0);
  grade.uniforms.uTime.value = uTime.value; grade.uniforms.uSpd.value = Math.pow(spdK, 1.3); grade.uniforms.uFade.value = clamp(1 - (fadeT - 0.4) / 3.5, 0, 1);
  renderMirror();
  composer.render();
}
requestAnimationFrame(frame);
// a handle for testing from the console
window.__moon = { P, camera, CAR, carE, skipFade() { fadeT = 99; } };
