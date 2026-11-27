// The mirror pool. The low pink tube in the right-hand frame (by the play hall's back wall) ends in a round black glass, which keeps its
// ordinary reflection. Behind it is the same room seen through an old console, with every light off.
// Turn your back on the glass and walk backwards into it: black slime gathers in from the edges of the screen, more the longer you keep going,
// and once it has closed over everything you are on the other side, in the reflection. Leave the same way, backwards into the glass.
//
// How it works: the reflection is the playroom itself (every mesh in it, cloned with shared geometry, given a PS2-style material and mirrored
// in the plane of the glass, x = a), drawn in a scene of its own with no lights. Its pieces copy the real ones' matrices and visibility every
// frame, so the balls, the book, the door and the size gun all move in it too. Through the glass you see it drawn from your own camera; once
// you are in, your body stays in the real room, reflected in the glass (so all the walking, swimming and colliding is the real room's), and
// the camera is reflected back: what you see is exactly the mirror world from where you stand in it, and the controls are turned to match.
//
// The PS2 look (no library: the PS1-style ones around, e.g. playshader-one or three-retropass, do 320x240, wobble and affine textures; a PS2
// game looks softer): about 270 lines drawn and scaled up smoothly, vertices snapped to that grid, Gouraud lighting per vertex (the large flat
// pieces are cut up so the light has vertices to land on), small textures filtered bilinearly with mipmaps, 15-bit colour with ordered
// dithering, a little frame blending, chroma smeared sideways like a composite cable, interlaced lines, fog.
import * as THREE from 'three';

const V2 = THREE.Vector2, V3 = THREE.Vector3;
const FOG = new THREE.Color(0.028, 0.046, 0.038);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ */
/* small textures                                                      */
/* ------------------------------------------------------------------ */
function quantize(img) {   // 15-bit colour, ordered dither
  const d = img.data, w = img.width;
  for (let i = 0; i < d.length; i += 4) {
    const p = i >> 2, b = BAYER[((((p / w) | 0) & 3) << 2) | (p % w & 3)] / 16;
    for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.floor(d[i + c] / 255 * 31 + b) * 255 / 31);
  }
}
function canvasTex(cv, like) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace;   // the PS2 world is lit and shaded in display values, the old way
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.wrapS = like ? like.wrapS : THREE.RepeatWrapping; t.wrapT = like ? like.wrapT : THREE.RepeatWrapping;
  return t;
}
function pixelsOf(img) {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0); return c.getImageData(0, 0, img.width, img.height);
}
const texCache = new Map();
// the room's tile maps are one texel per tile (drawn sharp, with the grout added in the shader): here every tile becomes a little block of
// texels with a dark seam, small enough that bilinear filtering softens it the way the PS2 did
function ps2Tex(t) {
  if (texCache.has(t)) return texCache.get(t);
  let out = null; const img = t.image;
  if (img && img.width) try {
    const w = img.width, h = img.height, cv = document.createElement('canvas'), c = cv.getContext('2d');
    if (t.magFilter === THREE.NearestFilter && Math.max(w, h) <= 420) {
      const k = Math.max(2, Math.min(8, Math.floor(512 / Math.max(w, h)))), src = pixelsOf(img).data;
      cv.width = w * k; cv.height = h * k; const o = c.createImageData(w * k, h * k), d = o.data;
      let s = 1234567;
      for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
        const si = (((y / k) | 0) * w + ((x / k) | 0)) * 4, seam = (x % k === k - 1 || y % k === k - 1) ? 0.6 : 1;
        s = (s * 1103515245 + 12345) & 0x7fffffff; const n = 1 + ((s / 0x7fffffff) - 0.5) * 0.1;
        const i = (y * w * k + x) * 4;
        for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, src[si + ch] * seam * n);
        d[i + 3] = 255;
      }
      quantize(o); c.putImageData(o, 0, 0);
    } else {
      cv.width = cv.height = 64; c.drawImage(img, 0, 0, 64, 64); const o = c.getImageData(0, 0, 64, 64); quantize(o); c.putImageData(o, 0, 0);
    }
    out = canvasTex(cv, t);
  } catch (e) { out = null; }
  texCache.set(t, out); return out;
}
function noiseTex(S, seed, fn) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), o = c.createImageData(S, S);
  let s = seed; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  fn(o.data, S, r); quantize(o); c.putImageData(o, 0, 0); return canvasTex(cv);
}
// water: a few soft blobs that tile
const waterTex = () => noiseTex(64, 77, (d, S, r) => {
  const pts = []; for (let k = 0; k < 14; k++) pts.push([r() * S, r() * S, 5 + r() * 9]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0.25; for (const [px, py, pr] of pts) { let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); v += 0.5 * Math.exp(-(dx * dx + dy * dy) / (pr * pr)); }
    const b = Math.min(255, v * 200), i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = b; d[i + 3] = 255;
  }
});
// for anything drawn with its own shader in the real room (the flooded maze): plain small aqua tiles
const tileTex = () => noiseTex(64, 31, (d, S, r) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const seam = (x % 8 === 7 || y % 8 === 7) ? 0.55 : 1, n = 0.9 + r() * 0.15, i = (y * S + x) * 4;
    d[i] = 150 * seam * n; d[i + 1] = 205 * seam * n; d[i + 2] = 196 * seam * n; d[i + 3] = 255;
  }
});

/* ------------------------------------------------------------------ */
/* big flat pieces cut up, so per-vertex light has somewhere to land   */
/* ------------------------------------------------------------------ */
const tessCache = new Map();
function tessellate(geo, maxLen) {
  const key = geo.uuid + ':' + maxLen.toFixed(3); if (tessCache.has(key)) return tessCache.get(key);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const names = ['position', 'normal', 'uv', 'color'].filter((n) => g.attributes[n]), A = names.map((n) => g.attributes[n]);
  const out = names.map(() => []); let count = 0, bail = false;
  const get = (k) => A.map((a) => { const v = []; for (let c = 0; c < a.itemSize; c++) v.push(a.array[k * a.itemSize + c]); return v; });
  const mid = (p, q) => p.map((v, i) => v.map((x, c) => (x + q[i][c]) / 2));
  const dist = (p, q) => Math.hypot(p[0][0] - q[0][0], p[0][1] - q[0][1], p[0][2] - q[0][2]);
  const tri = (a, b, c, depth) => {
    if (bail) return;
    const ab = dist(a, b), bc = dist(b, c), ca = dist(c, a), m = Math.max(ab, bc, ca);
    if (m <= maxLen || depth > 12) { for (const v of [a, b, c]) v.forEach((x, i) => out[i].push(...x)); if ((count += 3) > 60000) bail = true; return; }
    if (m === ab) { const q = mid(a, b); tri(a, q, c, depth + 1); tri(q, b, c, depth + 1); }
    else if (m === bc) { const q = mid(b, c); tri(a, b, q, depth + 1); tri(a, q, c, depth + 1); }
    else { const q = mid(c, a); tri(a, b, q, depth + 1); tri(q, b, c, depth + 1); }
  };
  const n = g.attributes.position.count;
  for (let k = 0; k + 2 < n; k += 3) tri(get(k), get(k + 1), get(k + 2), 0);
  let res = geo;
  if (!bail) { res = new THREE.BufferGeometry(); names.forEach((nm, i) => res.setAttribute(nm, new THREE.Float32BufferAttribute(out[i], A[i].itemSize))); res.computeBoundingSphere(); }
  tessCache.set(key, res); return res;
}

/* ------------------------------------------------------------------ */
/* the PS2 material                                                    */
/* ------------------------------------------------------------------ */
const VERT = `
#include <clipping_planes_pars_vertex>
uniform vec3 uCam, uAmb, uNear, uPoolMin, uPoolMax, uPoolCol; uniform float uNearK, uTime, uFogK; uniform vec4 uPortal; uniform vec2 uSnap; uniform mat3 uMapM;
varying vec2 vUv; varying vec3 vLight, vTint, vRefl; varying float vFog, vFres;
void main(){
  vec4 lp = vec4(position, 1.0); vec3 nn = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp; nn = mat3(instanceMatrix) * nn;
#endif
  vec4 w4 = modelMatrix * lp; vec3 wp = w4.xyz;
  vec3 n = mat3(modelMatrix) * nn; float nl = length(n); n = nl > 1e-5 ? n / nl : vec3(0.0, 1.0, 0.0);
  vec4 mvPosition = viewMatrix * w4;
#include <clipping_planes_vertex>
  vec4 cp = projectionMatrix * mvPosition;
  if (cp.w > 0.05) { vec2 g = uSnap * 0.5; cp.xy = floor(cp.xy / cp.w * g + 0.5) / g * cp.w; }   // vertices land on the low-res grid
  gl_Position = cp;
  vTint = vec3(1.0);
#ifdef USE_COLOR
  vTint *= pow(max(color.rgb, 0.0), vec3(0.4545));
#endif
#ifdef USE_INSTANCING_COLOR
  vTint *= pow(max(instanceColor, 0.0), vec3(0.4545));
#endif
#if defined(WORLDUV)
  vec3 an = abs(n); vUv = (an.y > max(an.x, an.z) ? wp.xz : (an.x > an.z ? wp.zy : wp.xy)) * 2.5;
#elif defined(WATER)
  vUv = wp.xz * 0.55;
#else
  vUv = (uMapM * vec3(uv, 1.0)).xy;
#endif
  vec3 V = uCam - wp; float d = length(V); vec3 vd = V / max(d, 1e-4);
  vFres = 1.0 - abs(dot(n, vd)); vRefl = reflect(-vd, n);
  // no lights at all: only what your eyes, used to the dark, make out near you (the pool and glass terms are kept but set to zero)
  vec3 L = uAmb + uNear * (0.45 + 0.55 * abs(dot(n, vd))) / (1.0 + d * d * uNearK);
  vec3 q = clamp(wp, uPoolMin, uPoolMax); float pd = length(wp - q);
  vec3 sw = vec3(q.x, uPoolMax.y, q.z) - wp; float sd = length(sw);
  float rip = 0.72 + 0.28 * sin(wp.x * 2.3 + uTime * 1.1) * sin(wp.z * 1.9 - uTime * 0.9 + wp.y);
  float inside = 1.0 - step(1e-3, pd);
  L += uPoolCol * rip * (inside * (1.0 - 0.1 * (uPoolMax.y - wp.y)) + (1.0 - inside) * exp(-pd * 0.5) * (0.25 + 0.75 * max(0.0, dot(n, sw / max(sd, 1e-4)))));
  vec3 pv = uPortal.xyz - wp; float pl = length(pv);   // and the glass, faintly
  L += vec3(0.3, 0.42, 0.45) * uPortal.w * exp(-pl * 1.8) * (0.35 + 0.65 * max(0.0, dot(n, pv / max(pl, 1e-4))));
  vLight = L;
  float fd = length(mvPosition.xyz) * uFogK; vFog = 1.0 - exp(-fd * fd);
}`;
const FRAG = `
#include <clipping_planes_pars_fragment>
uniform sampler2D uMap, uWaterTex, uPTex; uniform vec3 uColor, uEmis, uFogCol, uPoolCol; uniform float uAlpha, uTime, uPMix; uniform vec2 uPRes;
varying vec2 vUv; varying vec3 vLight, vTint, vRefl; varying float vFog, vFres;
vec3 envC(vec3 r){ return mix(vec3(0.012, 0.018, 0.016), vec3(0.13, 0.18, 0.165), smoothstep(-0.2, 0.9, r.y)) + uPoolCol * 0.35 * smoothstep(0.1, -0.7, r.y); }
void main(){
#include <clipping_planes_fragment>
  vec3 base = uColor * vTint;
#ifdef HAS_MAP
  base *= texture2D(uMap, vUv).rgb;
#endif
  vec3 col; float a = uAlpha;
#if defined(DEAD)
  col = vec3(0.07, 0.085, 0.078) * (0.5 + vLight);
#elif defined(UNLIT)
  col = base * (0.2 + 0.8 * min(vLight, vec3(1.0)));
#elif defined(METAL)
  col = base * 0.2 * vLight + envC(vRefl) * (0.35 + 0.9 * vLight);
#elif defined(GLASS)
  col = vec3(0.008) + envC(vRefl) * (0.25 + 0.9 * vFres) * (0.5 + vLight);
#elif defined(PORTAL)
  vec3 g = vec3(0.008) + envC(vRefl) * (0.3 + 0.8 * vFres);
  vec3 rc = texture2D(uPTex, gl_FragCoord.xy / uPRes).rgb * 0.85;
  rc = (rc * (2.51 * rc + 0.03)) / (rc * (2.43 * rc + 0.59) + 0.14); rc = pow(clamp(rc, 0.0, 1.0), vec3(0.4545));
  col = mix(g, rc, uPMix) + vec3(0.03, 0.045, 0.05) * (0.5 + 0.5 * sin(uTime * 1.7));
#elif defined(WATER)
  float t1 = texture2D(uWaterTex, vUv + vec2(uTime * 0.02, uTime * 0.013)).r, t2 = texture2D(uWaterTex, vUv * 1.7 - vec2(uTime * 0.017, -uTime * 0.021)).r;
  col = vec3(0.07, 0.26, 0.26) * (0.45 + 0.9 * t1 * t2) * vLight * 1.3 + envC(vRefl) * vFres * 0.5;   // dark water, nothing lit under it
#else
  col = base * vLight;
#endif
  col += uEmis;
  col = mix(col, uFogCol, vFog);
  gl_FragColor = vec4(col, a);
}`;

/* ------------------------------------------------------------------ */
/* full-screen passes                                                  */
/* ------------------------------------------------------------------ */
const QV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// A: the frame just drawn (in big blocks while it is settling) blended a little with the last one
const PASS_A = `uniform sampler2D tCur, tPrev; uniform vec2 uRes; uniform float uTrail, uSettle; varying vec2 vUv;
void main(){
  float blk = 1.0 + floor(uSettle * 7.0);
  vec2 uv = (floor(vUv * uRes / blk) * blk + 0.5 * blk) / uRes;
  vec3 c = texture2D(tCur, uv).rgb;
  gl_FragColor = vec4(mix(c, texture2D(tPrev, vUv).rgb, uTrail), 1.0);
}`;
// B: out to the screen (or to the glass): composite chroma, the room's green cast, 15-bit with ordered dither on the low-res grid, interlace
const PASS_B = `uniform sampler2D tSrc; uniform vec2 uLow; uniform float uTime, uFrame, uGray, uUnder, uVig, uFade; varying vec2 vUv;
float bayer(vec2 p){ int i = int(mod(p.y, 4.0)) * 4 + int(mod(p.x, 4.0));
  float b[16]; b[0]=0.;b[1]=8.;b[2]=2.;b[3]=10.;b[4]=12.;b[5]=4.;b[6]=14.;b[7]=6.;b[8]=3.;b[9]=11.;b[10]=1.;b[11]=9.;b[12]=15.;b[13]=7.;b[14]=13.;b[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return b[k] / 16.0; return 0.0; }
void main(){
  vec2 uv = vUv + uUnder * 0.004 * vec2(sin(vUv.y * 30.0 + uTime * 2.0), cos(vUv.x * 26.0 + uTime * 1.6));
  vec3 c = texture2D(tSrc, uv).rgb;
  vec2 dx = vec2(1.5 / uLow.x, 0.0);
  vec3 cl = (texture2D(tSrc, uv - dx).rgb + texture2D(tSrc, uv + dx).rgb + c) / 3.0;
  vec3 W = vec3(0.299, 0.587, 0.114);
  c = cl - dot(cl, W) + dot(c, W);
  c = c * vec3(0.93, 1.02, 0.95) + vec3(0.006, 0.016, 0.012);
  c = mix(c, vec3(dot(c, W)), uGray);
  c = mix(c, c * vec3(0.5, 0.95, 1.05) + vec3(0.0, 0.02, 0.04), uUnder);
  c = floor(max(c, 0.0) * 31.0 + bayer(floor(uv * uLow))) / 31.0;
  c *= 1.0 - 0.05 * mod(floor(vUv.y * uLow.y) + uFrame, 2.0);
  c *= 1.0 - smoothstep(0.3, 0.85, length(vUv - 0.5) * 1.25) * uVig;
  gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
}`;

/* ------------------------------------------------------------------ */
/* the slime                                                           */
/* ------------------------------------------------------------------ */
// its own small transparent canvas over the game (so it is the same over the real room and the PS2 one), at half resolution
const SLIME_FS = `precision highp float;
uniform vec2 uRes; uniform float uK, uT;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
float field(vec2 uv){
  float asp = uRes.x / uRes.y, k = uK; vec2 p = vec2(uv.x * asp, uv.y);
  // the edge it creeps in from is warped by slow noise, so it comes in lobes and fingers, not as a frame
  vec2 w = vec2(fbm(p * 1.6 + vec2(0.0, uT * 0.03)), fbm(p * 1.6 + vec2(5.2, 1.3) - uT * 0.025)) - 0.5;
  vec2 q = p + w * (0.16 + 0.22 * k);
  float e = min(min(q.x, asp - q.x), min(q.y * 0.8, 1.0 - q.y));   // heavier along the bottom, where it pools
  vec2 c = abs(uv - 0.5) * 2.0;
  float reach = k * 0.62 + sin(uT * 1.7 + p.x * 3.0) * 0.006 * k + pow(c.x * c.y, 2.0) * 0.16 * k;   // more in the corners, and it breathes
  float f = reach - e + (fbm(p * 3.5 + uT * 0.04) - 0.5) * 0.05;
  // runs hanging from the top edge, a little longer the more there is, each with a round drop at its end
  float cx = p.x * 9.0 + w.x * 2.0, h = hash(vec2(floor(cx), 3.0)), h2 = hash(vec2(floor(cx), 11.0)), dxp = (fract(cx) - 0.3 - 0.4 * h2) / 9.0, top = 1.0 - p.y;
  float len = k * k * (0.04 + 0.6 * h2 * h2) * (0.85 + 0.15 * sin(uT * 0.6 + h * 9.0)), hw = (0.005 + 0.014 * h2) * (0.5 + 0.5 * k);
  float base = reach - 0.02;
  float run = base + len - top - max(0.0, abs(dxp) - hw * (1.0 - 0.4 * clamp((top - base) / max(len, 1e-3), 0.0, 1.0))) * 5.0;
  float drop = hw * 1.7 - length(vec2(dxp, top - base - len));
  if (h > 0.55) f = max(f, max(run, drop));   // only some places drip, each its own length
  return f;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes, px = 3.0 / uRes;
  float f = field(uv);
  float a = smoothstep(0.0, 0.008, f);
  if (a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // shade a smooth height (how far in from its own edge), not the noisy field itself
  float th = smoothstep(0.0, 0.09, f);
  float hx = smoothstep(0.0, 0.09, field(uv + vec2(px.x, 0.0))) - smoothstep(0.0, 0.09, field(uv - vec2(px.x, 0.0)));
  float hy = smoothstep(0.0, 0.09, field(uv + vec2(0.0, px.y))) - smoothstep(0.0, 0.09, field(uv - vec2(0.0, px.y)));
  vec3 n = normalize(vec3(-hx * 1.4, -hy * 1.4, 0.12));
  vec3 L = normalize(vec3(-0.3, 0.7, 0.65)), V = vec3(0.0, 0.0, 1.0);
  float r = max(dot(reflect(-L, n), V), 0.0);
  float spec = pow(r, 60.0) * 0.9 + pow(r, 8.0) * 0.06, fres = pow(1.0 - n.z, 2.0);
  vec3 col = vec3(0.003, 0.005, 0.004) + vec3(0.75, 0.86, 0.8) * spec + vec3(0.02, 0.05, 0.04) * fres;
  gl_FragColor = vec4(col * a, a * (0.86 + 0.14 * th));   // premultiplied
}`;
function makeSlime() {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;display:none';
  document.body.appendChild(cv);
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return { draw() {} };
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, SLIME_FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pr, 'uRes'), uK = gl.getUniformLocation(pr, 'uK'), uT = gl.getUniformLocation(pr, 'uT');
  let shown = false;
  return {
    draw(k, t) {
      if (k <= 0.001) { if (shown) { cv.style.display = 'none'; shown = false; } return; }
      if (!shown) { cv.style.display = 'block'; shown = true; }
      const w = Math.max(2, Math.round(innerWidth * 0.5)), h = Math.max(2, Math.round(innerHeight * 0.5));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, w, h); gl.uniform1f(uK, k); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
// a wet low rumble that swells with the slime
function makeGoo() {
  let ac = null, g = null, f = null;
  return (k, t) => {
    if (!ac) {
      if (k <= 0.001) return;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const len = ac.sampleRate * 3, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); let last = 0;
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }   // brown noise
        const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
        f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 6;
        g = ac.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
      } catch (e) { ac = { dead: true }; }
    }
    if (ac.dead || !g) return;
    if (ac.state === 'suspended' && k > 0.01) ac.resume();
    const now = ac.currentTime;
    g.gain.setTargetAtTime(0.5 * Math.pow(k, 1.4), now, 0.12);
    f.frequency.setTargetAtTime(120 + 160 * k + 70 * Math.sin(t * 5.3) * Math.sin(t * 2.1), now, 0.05);
  };
}

/* ------------------------------------------------------------------ */
/* building the mirror world                                           */
/* ------------------------------------------------------------------ */
// o: { renderer, scene, camera, a (the glass's plane, x = a), disc ([x, y, z] of the glass), skip (materials not to copy),
//      waters ([surface, underside] materials), glass (the material of the black pod windows), pool ({ x0, x1, z0, z1, y0, y1 }), maxY }
export function buildMirror(o) {
  const { renderer, scene, camera } = o, a = o.a, maxY = o.maxY === undefined ? 8 : o.maxY;
  const MM = new THREE.Matrix4().makeTranslation(2 * a, 0, 0).multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  const discAt = new V3(o.disc[0], o.disc[1], o.disc[2]);
  scene.updateMatrixWorld(true);

  // the real glass at the end of the tube
  let disc = null;
  scene.traverse((m) => { if (!disc && m.isMesh && m.geometry && m.geometry.type === 'CircleGeometry' && m.getWorldPosition(new V3()).distanceTo(discAt) < 0.05) disc = m; });
  const discUni = { uRefl: { value: null }, uRes: { value: new V2(1, 1) }, uMix: { value: 0 } };
  if (disc && o.discReflect) {   // off: in the real room the glass keeps the reflection it always had (o.discReflect would show the PS2 room in it)
    const dm = disc.material.clone();
    dm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, discUni);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uRefl; uniform vec2 uRes; uniform float uMix;')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  if (uMix > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, pow(texture2D(uRefl, gl_FragCoord.xy / uRes).rgb, vec3(2.2)) * 1.7, uMix);');
    };
    dm.customProgramCacheKey = () => 'mirror-glass-v1';
    disc.material = dm;
  }

  const P = o.pool;
  const SH = {
    uCam: { value: new V3() }, uTime: { value: 0 }, uSnap: { value: new V2(480, 270) },
    uFogCol: { value: new V3(FOG.r, FOG.g, FOG.b) }, uFogK: { value: 0.105 },
    uAmb: { value: new V3(0.03, 0.042, 0.038) }, uNear: { value: new V3(0.36, 0.42, 0.39) }, uNearK: { value: 0.26 },   // almost no light: only a little dim sight, close by
    uPoolMin: { value: new V3(Math.min(2 * a - P.x0, 2 * a - P.x1), P.y0, P.z0) }, uPoolMax: { value: new V3(Math.max(2 * a - P.x0, 2 * a - P.x1), P.y1, P.z1) },
    uPoolCol: { value: new V3(0, 0, 0) }, uPortal: { value: new THREE.Vector4(a, discAt.y, discAt.z, 0) },   // no lights in here: the pool's and the glass's terms stay at zero
    uWaterTex: { value: waterTex() }, uPTex: { value: null }, uPRes: { value: new V2(1, 1) }, uPMix: { value: 0 },
  };
  const generic = tileTex(), ident = new THREE.Matrix3(), white = new V3(1, 1, 1);
  const mats = new Map();
  const makeMat = (defines, extra, src) => new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SH, { uMap: { value: null }, uMapM: { value: ident }, uColor: { value: white.clone() }, uEmis: { value: new V3() }, uAlpha: { value: 1 } }, extra),
    defines, vertexShader: VERT, fragmentShader: FRAG, clipping: true, side: src ? src.side : THREE.FrontSide,
    transparent: !!(src && src.transparent), depthWrite: src ? (src.transparent ? false : src.depthWrite) : true, vertexColors: !!(src && src.vertexColors),
  });
  const portalMat = makeMat({ PORTAL: '' }, {}, null); portalMat.side = THREE.DoubleSide;
  function ps2Mat(src, mesh) {
    if (mesh === disc) return portalMat;
    if (mats.has(src)) return mats.get(src);
    let m;
    const waters = o.waters || [];
    if (waters.includes(src)) {
      m = makeMat({ WATER: '' }, { uAlpha: { value: src === waters[0] ? 0.62 : 0.78 } }, src); m.transparent = true; m.depthWrite = false; m.side = THREE.DoubleSide;
    } else if (src.isShaderMaterial) {
      m = makeMat({ WORLDUV: '', HAS_MAP: '' }, { uMap: { value: generic }, uColor: { value: new V3(0.6, 0.75, 0.72) } }, src);
    } else {
      const c = src.color ? src.color.clone().convertLinearToSRGB() : new THREE.Color(1, 1, 1), def = {}, extra = { uColor: { value: new V3(c.r, c.g, c.b) }, uAlpha: { value: src.opacity === undefined ? 1 : src.opacity } };
      if (src.isMeshBasicMaterial && Math.max(c.r, c.g, c.b) > 1.05) def.DEAD = '';   // a ceiling lamp, out
      else if (src.isMeshBasicMaterial) def.UNLIT = '';
      else if (src === o.glass) def.GLASS = '';
      else if (src.metalness > 0.6) def.METAL = '';
      if (src.map) { const t = ps2Tex(src.map); if (t) { def.HAS_MAP = ''; extra.uMap = { value: t }; src.map.updateMatrix(); extra.uMapM = { value: src.map.matrix.clone() }; } }
      if (src.emissive && src.emissiveIntensity > 0) { const e = src.emissive.clone().convertLinearToSRGB().multiplyScalar(src.emissiveIntensity * 0.5); extra.uEmis = { value: new V3(e.r, e.g, e.b) }; }
      m = makeMat(def, extra, src);
    }
    mats.set(src, m); return m;
  }

  // copy every mesh of the room (not the river hall far overhead, not the caustic overlays)
  const ps2Scene = new THREE.Scene(); ps2Scene.background = FOG.clone();
  ps2Scene.matrixAutoUpdate = false; ps2Scene.matrixWorldAutoUpdate = false;   // its pieces' matrices are set by hand (sync); left on, three.js would put them all back to their own
  const recs = [], skip = new Set(o.skip || []), box = new THREE.Box3(), _s = new V3();
  const list = []; scene.traverse((m) => { if (m.isMesh) list.push(m); });
  for (const src of list) {
    const ms = Array.isArray(src.material) ? src.material : [src.material];
    if (ms.some((m) => skip.has(m))) continue;
    if (src.isInstancedMesh) { src.computeBoundingBox(); box.copy(src.boundingBox).applyMatrix4(src.matrixWorld); }
    else { if (!src.geometry.boundingBox) src.geometry.computeBoundingBox(); box.copy(src.geometry.boundingBox).applyMatrix4(src.matrixWorld); }
    if (box.min.y > maxY) continue;
    let geo = src.geometry;
    if (!src.isInstancedMesh && !Array.isArray(src.material) && geo.attributes.position && geo.attributes.position.count < 240) {
      src.matrixWorld.decompose(new V3(), new THREE.Quaternion(), _s); const sc = Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z)) || 1;
      box.getSize(_s); if (Math.max(_s.x, _s.y, _s.z) > 1.2 && (geo.groups || []).length === 0) geo = tessellate(geo, 0.6 / sc);
    }
    const mat = Array.isArray(src.material) ? src.material.map((m) => ps2Mat(m, src)) : ps2Mat(src.material, src);
    let dst;
    if (src.isInstancedMesh) {
      dst = new THREE.InstancedMesh(geo, mat, src.count); dst.instanceMatrix = src.instanceMatrix; dst.instanceColor = src.instanceColor; dst.frustumCulled = false;
    } else { dst = new THREE.Mesh(geo, mat); dst.frustumCulled = src.frustumCulled; }
    dst.matrixAutoUpdate = false; dst.matrixWorldAutoUpdate = false; dst.renderOrder = src.renderOrder;
    const chain = []; for (let p = src; p && p !== scene; p = p.parent) chain.push(p);
    ps2Scene.add(dst); recs.push({ src, dst, chain, inst: src.isInstancedMesh });
  }
  function sync() {
    scene.updateMatrixWorld();
    for (const r of recs) {
      let vis = true; for (const p of r.chain) if (!p.visible) { vis = false; break; }
      r.dst.visible = vis; if (!vis) continue;
      r.dst.matrixWorld.multiplyMatrices(MM, r.src.matrixWorld);
      if (r.inst) r.dst.count = r.src.count;
    }
  }

  // render targets and passes
  const tgt = (w, h, o2) => new THREE.WebGLRenderTarget(w, h, Object.assign({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }, o2));
  let lowW = 0, lowH = 0, rtLow, hist = [], rtTmp, rtDisc, rtReal;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quadScene.add(quad); quad.frustumCulled = false;
  const matA = new THREE.ShaderMaterial({ uniforms: { tCur: { value: null }, tPrev: { value: null }, uRes: { value: new V2() }, uTrail: { value: 0 }, uSettle: { value: 0 } }, vertexShader: QV, fragmentShader: PASS_A, depthTest: false, depthWrite: false });
  const matB = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uLow: { value: new V2() }, uTime: { value: 0 }, uFrame: { value: 0 }, uGray: { value: 0 }, uUnder: { value: 0 }, uVig: { value: 0.55 }, uFade: { value: 0 } }, vertexShader: QV, fragmentShader: PASS_B, depthTest: false, depthWrite: false });
  const _db = new V2();
  function ensureSize() {
    renderer.getDrawingBufferSize(_db);
    const h = 270, w = Math.max(64, Math.round(h * _db.x / Math.max(1, _db.y)));
    if (w === lowW && h === lowH) return;
    lowW = w; lowH = h;
    [rtLow, rtTmp, rtDisc, rtReal, ...hist].forEach((t) => t && t.dispose());
    rtLow = tgt(w, h, { depthBuffer: true }); rtTmp = tgt(w, h, { type: THREE.HalfFloatType }); rtDisc = tgt(w, h);
    hist = [tgt(w, h, { type: THREE.HalfFloatType }), tgt(w, h, { type: THREE.HalfFloatType })];
    rtReal = tgt(Math.round(_db.x * 0.5), Math.round(_db.y * 0.5), { depthBuffer: true, type: THREE.HalfFloatType });
    SH.uSnap.value.set(w, h); SH.uPRes.value.set(w, h);
  }
  const clipPlus = new THREE.Plane(new V3(1, 0, 0), -a - 0.004), clipMinus = new THREE.Plane(new V3(-1, 0, 0), a - 0.004);   // a hair past the glass, so the glass itself is not in its own reflection
  let frameNo = 0;
  function guard(fn) {
    const nu = renderer.shadowMap.needsUpdate, ac = renderer.autoClear, cp = renderer.clippingPlanes, rt = renderer.getRenderTarget();
    renderer.shadowMap.needsUpdate = false; renderer.autoClear = true;
    try { fn(); } finally { renderer.clippingPlanes = cp; renderer.autoClear = ac; renderer.shadowMap.needsUpdate = nu; renderer.setRenderTarget(rt); }
  }
  function renderPS2(cam, clip, out, trail, look) {
    ensureSize();
    renderer.clippingPlanes = clip ? [clip] : [];
    renderer.setRenderTarget(rtLow); renderer.render(ps2Scene, cam);
    renderer.clippingPlanes = [];
    const write = out ? rtTmp : hist[frameNo & 1], read = out ? hist[0] : hist[(frameNo + 1) & 1];
    quad.material = matA; matA.uniforms.tCur.value = rtLow.texture; matA.uniforms.tPrev.value = read.texture; matA.uniforms.uRes.value.set(lowW, lowH);
    matA.uniforms.uTrail.value = out ? 0 : trail; matA.uniforms.uSettle.value = out ? 0 : settle;
    renderer.setRenderTarget(write); renderer.render(quadScene, quadCam);
    quad.material = matB; const u = matB.uniforms; u.tSrc.value = write.texture; u.uLow.value.set(lowW, lowH); u.uTime.value = SH.uTime.value; u.uFrame.value = frameNo;
    u.uGray.value = look.gray || 0; u.uUnder.value = look.under || 0; u.uVig.value = out ? 0 : 0.55; u.uFade.value = out ? 0 : (look.fade || 0);
    renderer.setRenderTarget(out || null); renderer.render(quadScene, quadCam);
  }
  const camM = new THREE.PerspectiveCamera();
  function mirrorCam(src) {
    if (camM.fov !== src.fov || camM.aspect !== src.aspect || camM.near !== src.near || camM.far !== src.far) { camM.fov = src.fov; camM.aspect = src.aspect; camM.near = src.near; camM.far = src.far; camM.updateProjectionMatrix(); }
    src.updateMatrixWorld(); const p = src.getWorldPosition(new V3()), q = src.getWorldQuaternion(new THREE.Quaternion());
    camM.position.set(2 * a - p.x, p.y, p.z); camM.quaternion.set(q.x, -q.y, -q.z, q.w); camM.updateMatrixWorld();
  }
  const _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _ds = new THREE.Sphere(discAt.clone(), 0.42);
  function seen(cam) { _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _f.setFromProjectionMatrix(_pm); return _f.intersectsSphere(_ds); }

  const slime = makeSlime(), goo = makeGoo();
  let build = 0, recede = false, settle = 0;
  const M = {
    on: false, sx: 1, a, disc: discAt, cool: 0,
    get slime() { return build; },
    // walking backwards into the glass: true once the slime has closed over the screen (then call cross())
    slimeStep(dt, backing, touching) {
      M.cool = Math.max(0, M.cool - dt);
      if (recede) { build = Math.max(0, build - dt / 1.5); if (build <= 0) recede = false; return false; }
      if (backing && M.cool <= 0) build = Math.min(1, build + dt / (touching ? 2.0 : 3.6));
      else build = Math.max(0, build - dt / 1.8);
      return build >= 1;
    },
    cross() { M.on = !M.on; M.sx = M.on ? -1 : 1; recede = true; build = 1; settle = 1; M.cool = 1.2; },
    enter() { if (!M.on) { M.on = true; M.sx = -1; settle = 1; } },
    exit() { if (M.on) { M.on = false; M.sx = 1; } recede = false; build = 0; },
    // each frame, instead of composer.render()
    frame(dt, time, look, composerRender) {
      SH.uTime.value = time; frameNo++;
      settle = Math.max(0, settle - dt / 0.9);
      const k = Math.pow(build, 1.25); slime.draw(k, time); goo(k, time);
      guard(() => {
        if (M.on) {
          mirrorCam(camera); sync(); SH.uCam.value.copy(camM.position);
          const d = camM.position.distanceTo(discAt), mix = camM.position.x > a && d < 1.9 && seen(camM) ? sstep(1.9, 0.45, d) * 0.9 : 0;
          SH.uPMix.value = mix;
          if (mix > 0.01) {   // from in here, the glass shows the real room
            ensureSize(); renderer.clippingPlanes = [clipMinus]; renderer.setRenderTarget(rtReal); renderer.render(scene, camM); renderer.clippingPlanes = [];
            SH.uPTex.value = rtReal.texture;
          }
          renderPS2(camM, null, null, 0.2, look);
        } else {
          const cp = camera.getWorldPosition(new V3()), d = cp.distanceTo(discAt);
          const mix = disc && o.discReflect && cp.x < a && d < 1.9 && seen(camera) ? sstep(1.9, 0.45, d) * 0.88 : 0;
          discUni.uMix.value = mix;
          if (mix > 0.01) {
            mirrorCam(camera); sync(); SH.uCam.value.copy(camM.position); SH.uPMix.value = 0;
            renderPS2(camera, clipPlus, rtDisc, 0, { gray: look.gray });
            discUni.uRefl.value = rtDisc.texture; renderer.getDrawingBufferSize(discUni.uRes.value);
          }
        }
      });
      if (!M.on) composerRender();
    },
  };
  return M;
}
