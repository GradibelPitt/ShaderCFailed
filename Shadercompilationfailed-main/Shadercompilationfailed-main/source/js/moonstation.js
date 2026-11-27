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
SAVE.set('scene', 'moon');
{ const v = Array.isArray(SAVE.get('visited')) ? SAVE.get('visited').slice() : []; if (!v.includes('moon')) { v.push('moon'); SAVE.set('visited', v); } }   // the level-select hall gets a MOON STATION line

/* ---------------- measures (metres) ---------------- */
const XL = -4300, XR = 4800, ZB = 3000, ZE = -9000, TOPY = 11800;   // cliff side, frame side (at the floor), back wall, the open end, where frames meet the cliff
const PAR_H = 150, PAR_D = 120, STRIP_Y = 70;                        // the low wall at the open end, and its line of light
const DOOR = { x: 600, w: 1.1, h: 2.25 };                             // the door you came in by, in the back wall
const SL = Math.hypot(XR - XL, TOPY), SD = [(XL - XR) / SL, TOPY / SL], SN = [-SD[1], SD[0]];   // the frames' line: along it (up to the cliff), and across it into the hall
// (SN points down and left, into the hall)

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
  vec3 sp = vec3(clamp(p.x, -4300.0, 4800.0), ${STRIP_Y.toFixed(1)}, -9000.0); vec3 sd = sp - p; float dd = length(sd) + 1.0;
  c += vec3(0.85, 0.92, 1.0) * 1.1 * max(dot(n, sd / dd), 0.0) / (1.0 + dd * dd / (1000.0 * 1000.0));
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
varying vec3 vW; varying vec3 vN; varying vec4 vR;
uniform mat4 uMirrorVP;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vR = uMirrorVP * w;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const FRAG = `#include <logdepthbuf_pars_fragment>
${NOISE}${LIGHT}
uniform vec3 uBase;
varying vec3 vW; varying vec3 vN; varying vec4 vR;
float lines(float v, float period, float w){ float f = abs(fract(v / period + 0.5) - 0.5) * period; float aa = fwidth(v) * 1.2; return 1.0 - smoothstep(w - aa, w + aa, f); }
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN); if (dot(n, uCam - vW) < 0.0) n = -n;
  vec3 col; float glow = 0.0;
#if KIND == 0
  // the frames: dark blue-grey metal, smooth, long faint seams along them
  float s = fbm3(vW * 0.004) * 0.25;
  vec3 alb = vec3(0.085, 0.10, 0.12) * (0.85 + s);
  col = shade(vW, n, alb, 0.28, 1.2);
#elif KIND == 1
  // between the frames: the skin, darker still, in great panels
  float g = max(lines(vW.z, 520.0, 3.0), lines(vW.y, 300.0, 2.0));
  vec3 alb = vec3(0.028, 0.033, 0.040) * (0.8 + 0.4 * fbm3(vW * 0.002)) * (1.0 - 0.5 * g);
  col = shade(vW, n, alb, 0.75, 0.05);
#elif KIND == 2
  // the cliff: bare dark rock, rough at every size
  float aa = clamp(1.0 - fwidth(vW.x) * 0.02, 0.0, 1.0);
  float r = fbm(vW * 0.0011) * 0.6 + fbm3(vW * 0.0045) * 0.4 * aa + noise3(vW * 0.02) * 0.25 * clamp(1.0 - fwidth(vW.x) * 0.06, 0.0, 1.0);
  vec3 alb = mix(vec3(0.030, 0.028, 0.026), vec3(0.085, 0.080, 0.072), r);
  col = shade(vW, n, alb, 0.85, 0.08);
#elif KIND == 3
  // concrete: the back wall and the low wall at the end
  float g = max(lines(vW.x + 30.0, 60.0, 0.25), lines(vW.y, 30.0, 0.2));
  vec3 alb = vec3(0.07, 0.075, 0.08) * (0.8 + 0.4 * fbm3(vW * 0.05)) * (1.0 - 0.35 * g);
  col = shade(vW, n, alb, 0.6, 0.2);
#elif KIND == 5
  // the little door: painted steel, a frame round it
  vec3 alb = vec3(0.30, 0.31, 0.30);
  col = shade(vW, n, alb, 0.4, 0.5);
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
  g.computeVertexNormals(); add(g, mat(2));
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
// the back wall (a great plane; only the part inside the hall is ever seen), with the door
{
  const s = new THREE.Shape([new THREE.Vector2(-7000, 0), new THREE.Vector2(DOOR.x - DOOR.w / 2, 0), new THREE.Vector2(DOOR.x - DOOR.w / 2, DOOR.h), new THREE.Vector2(DOOR.x + DOOR.w / 2, DOOR.h), new THREE.Vector2(DOOR.x + DOOR.w / 2, 0), new THREE.Vector2(7000, 0), new THREE.Vector2(7000, 14000), new THREE.Vector2(-7000, 14000)]);
  const g = new THREE.ShapeGeometry(s); g.translate(0, 0, ZB); add(g, mat(3));
  const box = (x0, y0, z0, x1, y1, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  add(box(DOOR.x - DOOR.w / 2, 0, ZB - 0.02, DOOR.x + DOOR.w / 2, DOOR.h, ZB + 0.04), mat(5));                                   // the door, shut
  add(mergeGeometries([box(DOOR.x - DOOR.w / 2 - 0.08, 0, ZB - 0.06, DOOR.x - DOOR.w / 2, DOOR.h + 0.08, ZB), box(DOOR.x + DOOR.w / 2, 0, ZB - 0.06, DOOR.x + DOOR.w / 2 + 0.08, DOOR.h + 0.08, ZB),
    box(DOOR.x - DOOR.w / 2 - 0.08, DOOR.h, ZB - 0.06, DOOR.x + DOOR.w / 2 + 0.08, DOOR.h + 0.08, ZB)]), mat(5));
  add(box(DOOR.x + 0.32, 1.0, ZB - 0.07, DOOR.x + 0.42, 1.04, ZB - 0.02), mat(4, [0.6, 0.6, 0.55], 'knob'));
  add(box(DOOR.x - 0.16, 2.68, ZB - 0.12, DOOR.x + 0.16, 2.78, ZB), mat(4, [6.0, 4.4, 2.6], 'doorlamp'));                        // the lamp over it
  // the low wall at the far end, and its line of light
  add(box(XL - 600, 0, ZE - PAR_D, XR + 900, PAR_H, ZE), mat(3));
  add(box(XL - 600, STRIP_Y - 14, ZE + 0.5, XR + 900, STRIP_Y + 14, ZE + 3), mat(4, [3.6, 3.9, 4.2], 'strip'));
}

/* ---------------- little lights: how big it is ---------------- */
let blinkMat = null;
{
  const white = [], red = [];
  // along the top of the low wall
  for (let x = XL + 150; x < XR + 800; x += 260) white.push(x, PAR_H + 4, ZE - PAR_D / 2);
  // on the front edge of every frame: red lights at intervals up it
  for (let z = ZB - 120; z >= ZE - 1; z -= 520) for (let u = 900; u < SL; u += 1700) { const x = XR + SD[0] * u + SN[0] * 290, y = SD[1] * u + SN[1] * 290; red.push(x, y, z - 58); }
  // a few far up the cliff, where something must once have been fixed to it
  const r = mulberry32(7);
  for (let k = 0; k < 40; k++) { const z = ZB - r() * (ZB - ZE), y = 600 + r() * 9000; white.push(XL + cliffOut(y, z) + 12, y, z); }
  const pts = (arr, color, size) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, depthWrite: false }); const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return m; };
  pts(white, new THREE.Color(2.2, 2.3, 2.5), 2.0);
  blinkMat = pts(red, new THREE.Color(4, 0.35, 0.25), 2.6);
}
// dust in the air right round you, the one thing here at your own scale
const dust = (() => {
  const N = 500, a = new Float32Array(N * 3), r = mulberry32(11); for (let i = 0; i < N * 3; i++) a[i] = (r() - 0.5) * 24;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const m = new THREE.PointsMaterial({ color: new THREE.Color(0.55, 0.62, 0.7), size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return { p, a, N };
})();

/* ---------------- the sky ---------------- */
// worked out per pixel from the direction looked in, in kilometres: the Earth 420 km below (its upper edge about 13 degrees above level, straight
// ahead out of the open end; the station keeps its own "down"), its thin bright air, the stars, and a ring round it, one edge of which glows orange
const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 64, 32), new THREE.ShaderMaterial({
  uniforms: { uTime }, side: THREE.BackSide, depthWrite: false, depthTest: false,
  vertexShader: `#include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
  }`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
  ${NOISE}
  uniform float uTime; varying vec3 vD;
  const float R = 6371.0, H = 420.0;
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
    // the Earth
    float b = dot(rd, C), cc = dot(C, C) - R * R, disc = b * b - cc, tE = 1e9;
    if (disc > 0.0 && b > 0.0) {
      tE = b - sqrt(disc);
      vec3 P = rd * tE, N = (P - C) / R;
      float land = smoothstep(0.53, 0.57, fbm(N * 2.6 + 3.0));
      vec3 surf = mix(vec3(0.010, 0.045, 0.12), mix(vec3(0.20, 0.17, 0.12), vec3(0.62, 0.62, 0.60), smoothstep(0.6, 0.8, fbm(N * 6.0))), land);
      float cl = fbm(N * vec3(9.0, 16.0, 9.0) + vec3(0.0, 0.0, uTime * 0.0008)); cl = smoothstep(0.50, 0.80, cl + 0.16 * fbm(N * 42.0));
      vec3 c = mix(surf, vec3(0.92, 0.93, 0.95), cl);
      float lit = max(dot(N, S), 0.0);
      float mu = max(dot(N, -rd), 0.0);
      col = c * (0.02 + 0.85 * lit);
      col = mix(col, vec3(0.22, 0.42, 0.85) * (0.08 + 0.7 * lit), pow(1.0 - mu, 4.0) * 0.6);   // the air, seen at a slant toward the edge
    } else if (b > 0.0) {
      // past the edge: a thin blazing line of air, then blue going to black
      float alt = sqrt(max(dot(C, C) - b * b, 0.0)) - R;
      vec3 Nl = normalize(rd * b - C); float lit = smoothstep(-0.25, 0.4, dot(Nl, S));
      col += (vec3(0.30, 0.65, 1.0) * exp(-alt / 14.0) * 2.2 + vec3(0.06, 0.16, 0.45) * exp(-alt / 70.0)) * lit;
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
        col = mix(col, vec3(0.055, 0.058, 0.064) * (0.4 + 0.6 * max(dot(Nr, S), 0.0)), step(0.0, d) * step(d, 520.0) * 0.92);
        col += vec3(1.0, 0.36, 0.10) * line;
      }
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
function renderMirror() {
  mirrorCam.copy(camera);
  mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion); _f.y = -_f.y;
  _u.set(0, 1, 0).applyQuaternion(camera.quaternion); _u.y = -_u.y;
  mirrorCam.up.copy(_u); mirrorCam.lookAt(mirrorCam.position.clone().add(_f)); mirrorCam.updateMatrixWorld();
  mirrorCam.projectionMatrix.copy(camera.projectionMatrix); mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  uMirrorVP.value.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
  floor.visible = false; dust.p.visible = false;
  renderer.setRenderTarget(refl); renderer.clear(); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
  floor.visible = true; dust.p.visible = true;
}

/* ---------------- post ---------------- */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.55, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
// a print of it: grain, colour fringes toward the corners, darker corners, and the fade in when you arrive
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 d = c * (0.0008 + r2 * 0.006);
    vec3 col = vec3(texture2D(tDiffuse, vUv - d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d).b);
    col = col * vec3(0.97, 1.0, 1.04) + vec3(0.006, 0.008, 0.012);
    col *= 1.0 - smoothstep(0.10, 0.75, r2) * 0.55;
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
  P.pos.x = clamp(P.pos.x, XL + cliffOut(0, P.pos.z) + 4, XR - 700);
  P.pos.z = clamp(P.pos.z, ZE + 1.2, ZB - 0.5);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.ground && hs > 0.3) { const b0 = P.bob; P.bob += hs * dt; if (Math.floor(b0 / 0.78) !== Math.floor(P.bob / 0.78)) footstep(hs > 3 ? 1.0 : 0.6); }
}
function placeCamera(t) {
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
{
  const el = document.createElement('div'); el.id = 'mname';
  el.innerHTML = 'MOON STATION<small>月球空间站</small>';
  el.style.cssText = "position:fixed;left:0;right:0;bottom:16%;text-align:center;color:#dfe8f2;font:300 30px/1.2 'Segoe UI Light','Segoe UI','Helvetica Neue',Arial,sans-serif;letter-spacing:.9em;text-indent:.9em;opacity:0;transition:opacity 2.4s;pointer-events:none;z-index:4;text-shadow:0 0 18px rgba(140,180,255,.35)";
  document.body.appendChild(el);
  const sm = el.querySelector('small'); sm.style.cssText = 'display:block;margin-top:10px;font-size:15px;letter-spacing:.6em;text-indent:.6em;color:#9fb0c2';
  setTimeout(() => { el.style.opacity = '1'; }, 2200); setTimeout(() => { el.style.opacity = '0'; }, 8200);
}
if (window.SCF_G) window.SCF_G.setPages(() => [{ t: 'Moon Station', html: '<p>A hall of the station over the Moon.</p><p>Walk to the light at the far end. It is a long way.</p><p>Hold <kbd>Shift</kbd> to run.</p>' }]);

/* ---------------- loop ---------------- */
canvas.style.display = 'block';
let last = -1, fadeT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (last < 0) last = now; const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; uTime.value += dt; fadeT += dt;
  if (!(window.SCF_G && window.SCF_G.isOpen())) step(dt);
  placeCamera(uTime.value); uCam.value.copy(camera.position);
  // dust: kept round you, drifting
  { const a = dust.a, c = camera.position, t = uTime.value;
    for (let i = 0; i < dust.N; i++) { const o = i * 3; a[o] += Math.sin(t * 0.2 + i) * 0.0015; a[o + 1] += 0.001 * Math.cos(t * 0.13 + i * 1.7); for (let k = 0; k < 3; k++) { const ck = k === 0 ? c.x : k === 1 ? c.y : c.z, rel = a[o + k] - ck; if (rel > 12 || rel < -12) a[o + k] = ck + (((rel + 12) % 24) + 24) % 24 - 12; } }
    dust.p.geometry.attributes.position.needsUpdate = true; }
  if (blinkMat) blinkMat.opacity = 0.15 + 0.85 * (Math.sin(uTime.value * Math.PI * 0.9) > 0.2 ? 1 : 0);
  grade.uniforms.uTime.value = uTime.value; grade.uniforms.uFade.value = clamp(1 - (fadeT - 0.4) / 3.5, 0, 1);
  renderMirror();
  composer.render();
}
requestAnimationFrame(frame);
// a handle for testing from the console
window.__moon = { P, camera, skipFade() { fadeT = 99; } };
