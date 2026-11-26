// Prologue: the playroom. Once the room has gone fully grey it caves in on the player in black and white blocks, then sends them to level1.html.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshBVH } from 'three-mesh-bvh';

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */
const V3 = THREE.Vector3;
const H = 3.6, RX = 7.2, Z0 = -5, Z1 = 7, Z2 = 25, TILE = 0.12;
const WATER_Y = -0.12, PX = 4.2, PZ0 = 10, PZ1 = 22, PSTEP = 11.6, PDEEP = -2.6, PSHALLOW = -1.25, PBOT = -2.64;
const G = 13;
const PIT = { x0: -1.1, x1: 1.9, z0: 0.7, z1: 3.3, rimH: 0.5, rimT: 0.32 };
const LAMP1 = [-0.3, -1.1], LAMP2 = [-0.3, 13.9], LAMP3 = [-0.3, 20.5];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(20261125);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ */
/* renderer                                                            */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
function pickPR() { const w = innerWidth, h = innerHeight; return Math.min(window.devicePixelRatio || 1, Math.sqrt(2.4e6 / Math.max(1, w * h)), 1.5); }
renderer.setPixelRatio(pickPR());
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
RectAreaLightUniformsLib.init();
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.02, 90);
camera.rotation.order = 'YXZ';

/* ------------------------------------------------------------------ */
/* procedural textures                                                 */
/* ------------------------------------------------------------------ */
function gridTex(cols, rows, fn) {
  const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(cols, rows); const d = img.data;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const c = fn(i, j); const o = ((rows - 1 - j) * cols + i) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = maxAniso;
  return t;
}
// one repeating block of set x set tiles: bevel + per-tile tilt as a normal map, grout/tile roughness
function makeDetail({ set = 8, px = 64, grout = 0.04, bevel = 0.07, hb = 0.012, tilt = 0.012, rTile = 0.14, rVar = 0.08, rGrout = 0.85, seed = 7 }) {
  const S = set * px, r = mulberry32(seed);
  const tx = [], ty = [], tr = [];
  for (let k = 0; k < set * set; k++) { tx.push((r() - 0.5) * 2 * tilt); ty.push((r() - 0.5) * 2 * tilt); tr.push((r() - 0.5) * 2 * rVar); }
  const hgt = new Float32Array(S * S);
  const cvR = document.createElement('canvas'); cvR.width = cvR.height = S; const cR = cvR.getContext('2d'); const iR = cR.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ti = (x / px) | 0, tj = (y / px) | 0, k = tj * set + ti;
    const u = (x % px + 0.5) / px, v = (y % px + 0.5) / px;
    const e = Math.min(u, 1 - u, v, 1 - v);
    const m = sstep(grout, grout + bevel, e);
    hgt[y * S + x] = m * (hb + tx[k] * (u - 0.5) + ty[k] * (v - 0.5));
    const rough = rGrout + (clamp(rTile + tr[k], 0.03, 1) - rGrout) * sstep(grout * 0.6, grout * 1.3, e);
    const o = (y * S + x) * 4, b = Math.round(rough * 255);
    iR.data[o] = b; iR.data[o + 1] = b; iR.data[o + 2] = b; iR.data[o + 3] = 255;
  }
  cR.putImageData(iR, 0, 0);
  const cvN = document.createElement('canvas'); cvN.width = cvN.height = S; const cN = cvN.getContext('2d'); const iN = cN.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const xl = (x + S - 1) % S, xr = (x + 1) % S, yu = (y + S - 1) % S, yd = (y + 1) % S;
    const dx = (hgt[y * S + xr] - hgt[y * S + xl]) * px * 0.5;
    const dy = (hgt[yd * S + x] - hgt[yu * S + x]) * px * 0.5;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * S + x) * 4;
    iN.data[o] = Math.round((nx * 0.5 + 0.5) * 255); iN.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); iN.data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255); iN.data[o + 3] = 255;
  }
  cN.putImageData(iN, 0, 0);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; return t; };
  return { normal: mk(cvN), rough: mk(cvR), set };
}
function tileMat({ cols, rows, fn, detail, groutW = 0.04, groutC = 0x66706a, env = 0.7, nScale = 1 }) {
  const map = gridTex(cols, rows, fn);
  const nm = detail.normal.clone(); nm.repeat.set(cols / detail.set, rows / detail.set); nm.needsUpdate = true;
  const rm = detail.rough.clone(); rm.repeat.set(cols / detail.set, rows / detail.set); rm.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: nm, roughnessMap: rm, roughness: 1, metalness: 0, envMapIntensity: env, normalScale: new THREE.Vector2(nScale, nScale) });
  const gc = new THREE.Color(groutC);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTileN = { value: new THREE.Vector2(cols, rows) };
    sh.uniforms.uGroutW = { value: groutW };
    sh.uniforms.uGroutC = { value: gc };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uTileN;\nuniform float uGroutW;\nuniform vec3 uGroutC;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 tuv = vMapUv * uTileN;
        vec2 fw = fwidth(tuv) * 0.75 + 1e-4;
        vec2 e = abs(fract(tuv) - 0.5);
        float gx = smoothstep(0.5 - uGroutW - fw.x, 0.5 - uGroutW + fw.x, e.x);
        float gy = smoothstep(0.5 - uGroutW - fw.y, 0.5 - uGroutW + fw.y, e.y);
        float fade = clamp(1.0 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
        float gm = mix(4.0 * uGroutW, max(gx, gy), fade);
        diffuseColor.rgb = mix(diffuseColor.rgb, uGroutC, gm);
      }`);
  };
  mat.customProgramCacheKey = () => 'grout-v1';
  return mat;
}
function wallPattern(cols, rows, seed, pal) {
  const r = mulberry32(seed), out = new Array(cols * rows);
  const bh = []; let b = pal.band, dir = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < cols; i++) {
    if (r() < 0.12) dir = -dir;
    if (r() < 0.3) b += dir;
    b = clamp(b, pal.band - 3, pal.band + 4); bh.push(b);
  }
  const pick = (a) => a[(r() * a.length) | 0];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const t = j - bh[i]; let c;
    if (t < -1.5) c = r() < 0.025 ? pick(pal.bandAccent) : pal.bandCol;
    else if (t < 2.5) c = r() < 0.55 - t * 0.2 ? pal.bandCol : pal.base;
    else c = r() < pal.accentP ? pick(pal.accent) : pal.base;
    const v = (r() - 0.5) * pal.vary;
    out[j * cols + i] = [clamp(c[0] + v, 0, 255), clamp(c[1] + v, 0, 255), clamp(c[2] + v, 0, 255)];
  }
  return (i, j) => out[j * cols + i];
}
function ceilingTex(cols, rows) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); const r = mulberry32(99);
  c.fillStyle = '#8f988f'; c.fillRect(0, 0, S, S);
  for (let k = 0; k < 16000; k++) { c.fillStyle = `rgba(${30 + r() * 30 | 0},${40 + r() * 30 | 0},${34 + r() * 30 | 0},${0.12 + r() * 0.3})`; const s = 1 + r() * 1.6; c.fillRect(r() * S, r() * S, s, s); }
  for (let k = 0; k < 2500; k++) { c.fillStyle = `rgba(220,235,225,${0.05 + r() * 0.12})`; c.fillRect(r() * S, r() * S, 1.5, 1.5); }
  for (let k = 0; k < 2; k++) {
    const p = k * 256;
    c.fillStyle = '#39413b'; c.fillRect(p - 4, 0, 8, S); c.fillRect(0, p - 4, S, 8); c.fillRect(S - 4, 0, 4, S); c.fillRect(0, S - 4, S, 4);
    c.fillStyle = '#6d766f'; c.fillRect(p - 1.5, 0, 3, S); c.fillRect(0, p - 1.5, S, 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(cols / 2, rows / 2); t.anisotropy = maxAniso;
  return t;
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */
const std = (o) => new THREE.MeshStandardMaterial(o);
const M = {
  yg: std({ color: 0xb9c82a, roughness: 0.42 }),
  ygPad: std({ color: 0xc3cf3a, roughness: 0.5 }),
  pink: std({ color: 0xe08fca, roughness: 0.4 }),
  pinkDeep: std({ color: 0xc472ab, roughness: 0.42 }),
  orange: std({ color: 0xe06a2a, roughness: 0.5 }),
  mint: new THREE.MeshPhysicalMaterial({ color: 0x74e3a0, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.18, side: THREE.DoubleSide }),
  mintPod: std({ color: 0x7fe5aa, roughness: 0.3 }),
  mintPad: std({ color: 0x86dba6, roughness: 0.5 }),
  mintPale: std({ color: 0xcfeedd, roughness: 0.45 }),
  chrome: std({ color: 0xd3dbd6, metalness: 1, roughness: 0.17 }),
  glass: std({ color: 0x050908, roughness: 0.05, metalness: 0.25, envMapIntensity: 1.7 }),
  rim: std({ color: 0x9a6a92, roughness: 0.55 }),
  white: std({ color: 0xe6ece6, roughness: 0.45 }),
  red: std({ color: 0xc8302a, roughness: 0.3, metalness: 0.3 }),
  trim: std({ color: 0xdfe8e1, roughness: 0.5 }),
  step: std({ color: 0xbfe6de, roughness: 0.3 }),
  frameDark: new THREE.MeshBasicMaterial({ color: 0x1b201d }),
};
const C = { white: [228, 234, 226], mint: [78, 198, 140], orange: [226, 112, 48], red: [206, 62, 44], green: [62, 168, 84], lime: [172, 202, 60], aqua: [84, 192, 186], teal: [40, 142, 150], paleAqua: [176, 228, 220] };
const detWall = makeDetail({ set: 8, px: 64, seed: 11 });
const detFloor = makeDetail({ set: 4, px: 128, grout: 0.012, bevel: 0.02, hb: 0.004, tilt: 0.004, rTile: 0.1, rVar: 0.06, rGrout: 0.7, seed: 5 });
const detPool = makeDetail({ set: 8, px: 64, grout: 0.045, bevel: 0.08, hb: 0.014, tilt: 0.015, rTile: 0.12, rVar: 0.08, seed: 23 });
const palPlay = { band: 10, bandCol: C.mint, bandAccent: [C.white, C.green, C.lime], base: C.white, accent: [C.orange, C.red, C.green, C.mint, C.lime], accentP: 0.035, vary: 12 };
const palPool = { band: 13, bandCol: C.aqua, bandAccent: [C.white, C.teal], base: [230, 238, 234], accent: [C.aqua, C.teal, C.mint], accentP: 0.03, vary: 10 };

/* ------------------------------------------------------------------ */
/* build helpers + collider collection                                 */
/* ------------------------------------------------------------------ */
const colParts = []; let colVerts = 0;
const ceilMeshes = [], wallGroups = [];   // the room shell, swapped for black-and-white blocks when the playroom caves in
const _v = new V3();
function addCollider(geom, mw) {
  const g = geom.index ? geom.toNonIndexed() : geom; const src = g.attributes.position; const out = new Float32Array(src.count * 3);
  for (let i = 0; i < src.count; i++) { _v.fromBufferAttribute(src, i); if (mw) _v.applyMatrix4(mw); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; }
  colParts.push(out); colVerts += src.count;
}
function solid(mesh, cg) { mesh.updateWorldMatrix(true, false); addCollider(cg || mesh.geometry, mesh.matrixWorld); return mesh; }
function add(geom, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  (o.parent || scene).add(m);
  if (o.col) solid(m, o.col === true ? null : o.col);
  return m;
}
function rbox(w, h, d, r, mat, x, y, z, o = {}) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return add(new RoundedBoxGeometry(w, h, d, 4, rr), mat, x, y, z, Object.assign({}, o, { col: o.col === false ? false : new THREE.BoxGeometry(w, h, d) }));
}
const UP = new V3(0, 1, 0);
function tube(a, b, r, mat, o = {}) {
  const A = new V3(a[0], a[1], a[2]), B = new V3(b[0], b[1], b[2]); const d = B.clone().sub(A); const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, o.seg || 28, 1, !!o.open), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  m.castShadow = o.cast !== false; m.receiveShadow = true; scene.add(m);
  if (o.col) solid(m, new THREE.CylinderGeometry(r, r, len, 10, 1));
  return m;
}
function ring(x, y, z, R, r, mat, axis) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, 40), mat); m.position.set(x, y, z);
  m.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(axis[0], axis[1], axis[2]).normalize()); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
// padded post: chrome core, foam sleeves between pink ball joints
function post(x, z, y0, joints, o = {}) {
  const top = joints[joints.length - 1];
  let prev = y0;
  for (const j of joints) {
    const span = (j - 0.085) - (prev + (prev === y0 ? 0.0 : 0.085));
    const start = prev + (prev === y0 ? 0.0 : 0.085);
    if (span > 0.2) add(new THREE.CapsuleGeometry(0.083, span - 0.166, 8, 20), o.mat || M.yg, x, start + span / 2, z);
    add(new THREE.SphereGeometry(0.108, 24, 16), M.pink, x, j, z);
    prev = j;
  }
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.19, top - y0, 0.19)); c.position.set(x, (top + y0) / 2, z); solid(c);
}
function bar(a, b, o = {}) { return tube(a, b, 0.022, M.chrome, { seg: 12, col: o.col !== false }); }
function quadGeo(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0], 2));
  g.computeVertexNormals(); return g;
}
// tiled wall as a group of rectangles sharing one UV space; optional single hole [u0,v0,u1,v1] in wall-local coords
function wall({ x, z, y0 = 0, ry, W, Hh = H, mat, hole }) {
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; scene.add(g);
  const piece = (a0, b0, a1, b1) => {
    if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4) return;
    const geo = new THREE.PlaneGeometry(a1 - a0, b1 - b0); const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (a0 + uv.getX(k) * (a1 - a0) + W / 2) / W, (b0 + uv.getY(k) * (b1 - b0)) / Hh);
    const m = new THREE.Mesh(geo, mat); m.position.set((a0 + a1) / 2, (b0 + b1) / 2, 0); m.receiveShadow = true; g.add(m); solid(m);
  };
  wallGroups.push(g);
  if (!hole) piece(-W / 2, 0, W / 2, Hh);
  else { const [u0, v0, u1, v1] = hole; piece(-W / 2, 0, u0, Hh); piece(u1, 0, W / 2, Hh); piece(u0, 0, u1, v0); piece(u0, v1, u1, Hh); }
  return g;
}
function floorPiece(x0, z0, x1, z1, y, mat, reg, col = true) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (pos.getX(k) + cx - reg.x0) / reg.w, (pos.getZ(k) + cz - reg.z0) / reg.d);
  return add(geo, mat, cx, y, cz, { cast: false, col });
}

/* ------------------------------------------------------------------ */
/* room shell                                                          */
/* ------------------------------------------------------------------ */
const wallCols = Math.round(2 * RX / TILE), wallRows = Math.round(H / TILE);
const matBack = tileMat({ cols: wallCols, rows: wallRows, fn: wallPattern(wallCols, wallRows, 3, palPlay), detail: detWall });
const sideCols = Math.round((Z1 - Z0) / TILE);
const matSideL = tileMat({ cols: sideCols, rows: wallRows, fn: wallPattern(sideCols, wallRows, 4, palPlay), detail: detWall });
const matSideR = tileMat({ cols: sideCols, rows: wallRows, fn: wallPattern(sideCols, wallRows, 5, palPlay), detail: detWall });
const poolCols = Math.round((Z2 - Z1) / TILE);
const matPoolL = tileMat({ cols: poolCols, rows: wallRows, fn: wallPattern(poolCols, wallRows, 6, palPool), detail: detWall });
const matPoolR = tileMat({ cols: poolCols, rows: wallRows, fn: wallPattern(poolCols, wallRows, 7, palPool), detail: detWall });
const matPoolF = tileMat({ cols: wallCols, rows: wallRows, fn: wallPattern(wallCols, wallRows, 8, palPool), detail: detWall });

const HOLE1 = { x: -1.5, y0: 1.94, y1: 2.95, hw: 0.5 };            // slide hole in the back wall
const HOLE2 = { z: 15, y0: 1.94, y1: 2.95, hw: 0.5 };              // exit hole above the pool
wall({ x: 0, z: Z0, ry: 0, W: 2 * RX, mat: matBack, hole: [HOLE1.x - HOLE1.hw, HOLE1.y0, HOLE1.x + HOLE1.hw, HOLE1.y1] });
wall({ x: -RX, z: (Z0 + Z1) / 2, ry: Math.PI / 2, W: Z1 - Z0, mat: matSideL });
wall({ x: RX, z: (Z0 + Z1) / 2, ry: -Math.PI / 2, W: Z1 - Z0, mat: matSideR });
wall({ x: -RX, z: (Z1 + Z2) / 2, ry: Math.PI / 2, W: Z2 - Z1, mat: matPoolL });
{ const zc = (Z1 + Z2) / 2; wall({ x: RX, z: zc, ry: -Math.PI / 2, W: Z2 - Z1, mat: matPoolR, hole: [HOLE2.z - zc - HOLE2.hw, HOLE2.y0, HOLE2.z - zc + HOLE2.hw, HOLE2.y1] }); }
wall({ x: 0, z: Z2, ry: Math.PI, W: 2 * RX, mat: matPoolF });

// floors
const fCols = Math.round(2 * RX / 0.4), fRows = Math.round((Z1 - Z0) / 0.4);
const frnd = mulberry32(41);
const matFloor = tileMat({ cols: fCols, rows: fRows, detail: detFloor, groutW: 0.012, groutC: 0x2a2f2c, env: 1.0,
  fn: (i, j) => { const v = (frnd() - 0.5) * 10; return (i + j) % 2 ? [232 + v, 237 + v, 229 + v] : [17 + v * 0.4, 21 + v * 0.4, 19 + v * 0.4]; } });
floorPiece(-RX, Z0, RX, Z1, 0, matFloor, { x0: -RX, z0: Z0, w: 2 * RX, d: Z1 - Z0 });
const dCols = Math.round(2 * RX / 0.2), dRows = Math.round((Z2 - Z1) / 0.2);
const drnd = mulberry32(42);
const matDeck = tileMat({ cols: dCols, rows: dRows, detail: detFloor, groutW: 0.03, groutC: 0x7d8a84, env: 0.9,
  fn: () => { const v = (drnd() - 0.5) * 9; const c = drnd() < 0.06 ? [150, 212, 190] : [212, 224, 218]; return [c[0] + v, c[1] + v, c[2] + v]; } });
const deckReg = { x0: -RX, z0: Z1, w: 2 * RX, d: Z2 - Z1 };
floorPiece(-RX, Z1, RX, PZ0, 0, matDeck, deckReg);
floorPiece(-RX, PZ1, RX, Z2, 0, matDeck, deckReg);
floorPiece(-RX, PZ0, -PX, PZ1, 0, matDeck, deckReg);
floorPiece(PX, PZ0, RX, PZ1, 0, matDeck, deckReg);

// ceilings
function ceiling(z0, z1) {
  const cols = Math.round(2 * RX / 0.6), rows = Math.round((z1 - z0) / 0.6);
  const mat = std({ map: ceilingTex(cols, rows), roughness: 0.96, color: 0xa9b3ab });
  const geo = new THREE.PlaneGeometry(2 * RX, z1 - z0); geo.rotateX(Math.PI / 2);
  ceilMeshes.push(add(geo, mat, 0, H, (z0 + z1) / 2, { cast: false, col: true }));
}
ceiling(Z0, Z1); ceiling(Z1, Z2);
// portal between the two halls
rbox(0.5, H, 0.5, 0.06, M.trim, -RX + 0.25, H / 2, Z1);
rbox(0.5, H, 0.5, 0.06, M.trim, RX - 0.25, H / 2, Z1);
rbox(2 * RX, 0.34, 0.5, 0.05, M.trim, 0, H - 0.17, Z1, { col: false });

/* ------------------------------------------------------------------ */
/* lights                                                              */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0x22362b, 0x1b2a22, 0.3));
const panels = [];
const lamps = [];
function lamp(x, z, { shadow = 2048, power = 1 } = {}) {
  const col = 0xf1fff3;
  const ra = new THREE.RectAreaLight(col, 40 * power, 0.58, 0.58); ra.position.set(x, H - 0.02, z); ra.rotation.x = -Math.PI / 2; scene.add(ra);
  const sp = new THREE.SpotLight(col, 46 * power, 24, 1.25, 1.0, 2); sp.position.set(x, H - 0.06, z); sp.target.position.set(x, 0, z); scene.add(sp); scene.add(sp.target);
  if (shadow) { sp.castShadow = true; sp.shadow.mapSize.set(shadow, shadow); sp.shadow.camera.near = 0.25; sp.shadow.camera.far = 22; sp.shadow.bias = -0.0006; sp.shadow.normalBias = 0.03; }
  const bounce = new THREE.PointLight(0xc4efd0, 6 * power, 0, 2); bounce.position.set(x, -2.5, z); scene.add(bounce);
  const fg = new THREE.PlaneGeometry(0.6, 0.6); fg.rotateX(Math.PI / 2); ceilMeshes.push(add(fg, M.frameDark, x, H - 0.003, z, { cast: false, recv: false }));
  const pg = new THREE.PlaneGeometry(0.55, 0.55); pg.rotateX(Math.PI / 2);
  const p = add(pg, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6 * power, 3.0 * power, 2.7 * power) }), x, H - 0.006, z, { cast: false, recv: false });
  ceilMeshes.push(p); panels.push(p); lamps.push({ ra, sp, bounce, p, b: [ra.intensity, sp.intensity, bounce.intensity], c: p.material.color.clone(), f: 1, next: 0 });
}
lamp(LAMP1[0], LAMP1[1]);
lamp(LAMP2[0], LAMP2[1], { shadow: 1024 });
lamp(LAMP3[0], LAMP3[1], { shadow: 0, power: 0.8 });

/* ------------------------------------------------------------------ */
/* slides                                                              */
/* ------------------------------------------------------------------ */
const slides = [];
function buildSlide(ctrl, { w = 0.42, h = 0.26, r = 0.14, t = 0.045, seg = 96, rideStart = 0.35, legsAt = [] }) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new V3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 400;
  const L = curve.getLength();
  const inner = [[-w, h]];
  for (let a = 0; a <= 6; a++) { const ang = Math.PI + (Math.PI / 2) * (a / 6); inner.push([-w + r + r * Math.cos(ang), r + r * Math.sin(ang)]); }
  inner.push([0, 0]);
  for (let a = 0; a <= 6; a++) { const ang = 1.5 * Math.PI + (Math.PI / 2) * (a / 6); inner.push([w - r + r * Math.cos(ang), r + r * Math.sin(ang)]); }
  inner.push([w, h]);
  const K = inner.length, outer = [];
  for (let k = 0; k < K; k++) {
    const a = inner[Math.max(0, k - 1)], b = inner[Math.min(K - 1, k + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
    outer.push([inner[k][0] + ty * t, inner[k][1] - tx * t]);
  }
  const VPF = 2 * K + 4, pos = [], idx = [];
  const P = new V3(), T = new V3(), R = new V3(), N = new V3();
  const frame = (u) => { curve.getPointAt(u, P); curve.getTangentAt(u, T); R.crossVectors(T, UP).normalize(); N.crossVectors(R, T).normalize(); };
  const put = (p) => { pos.push(P.x + R.x * p[0] + N.x * p[1], P.y + R.y * p[0] + N.y * p[1], P.z + R.z * p[0] + N.z * p[1]); };
  for (let i = 0; i <= seg; i++) {
    frame(i / seg);
    for (let k = 0; k < K; k++) put(inner[k]);
    for (let k = 0; k < K; k++) put(outer[k]);
    put(inner[0]); put(outer[0]); put(inner[K - 1]); put(outer[K - 1]);
  }
  for (let i = 0; i < seg; i++) {
    const a0 = i * VPF, a1 = (i + 1) * VPF;
    for (let k = 0; k < K - 1; k++) {
      idx.push(a0 + k, a1 + k, a1 + k + 1, a0 + k, a1 + k + 1, a0 + k + 1);
      idx.push(a0 + K + k, a1 + K + k + 1, a1 + K + k, a0 + K + k, a0 + K + k + 1, a1 + K + k + 1);
    }
    idx.push(a0 + 2 * K, a0 + 2 * K + 1, a1 + 2 * K + 1, a0 + 2 * K, a1 + 2 * K + 1, a1 + 2 * K);
    idx.push(a0 + 2 * K + 2, a1 + 2 * K + 3, a0 + 2 * K + 3, a0 + 2 * K + 2, a1 + 2 * K + 2, a1 + 2 * K + 3);
  }
  for (const u of [0, 1]) { // end caps
    frame(u); const base = pos.length / 3;
    for (let k = 0; k < K; k++) { put(inner[k]); put(outer[k]); }
    for (let k = 0; k < K - 1; k++) { const a = base + 2 * k; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = add(geo, M.mint, 0, 0, 0);
  // collider: flat-bottom trough
  const cp = [], cs = 48, prof = [[-w, h], [-w, 0], [w, 0], [w, h]]; let prevRow = null, skirtOn = false;
  for (let i = 0; i <= cs; i++) {
    frame(i / cs); const row = prof.map((p) => [P.x + R.x * p[0] + N.x * p[1], P.y + R.y * p[0] + N.y * p[1], P.z + R.z * p[0] + N.z * p[1]]);
    if (prevRow) for (let k = 0; k < 3; k++) cp.push(...prevRow[k], ...row[k], ...row[k + 1], ...prevRow[k], ...row[k + 1], ...prevRow[k + 1]);
    const low = Math.min(row[1][1], row[2][1]) < 1.8, dn = (q) => [q[0], 0, q[2]];
    const vq = (a, b) => cp.push(...a, ...b, ...dn(b), ...a, ...dn(b), ...dn(a));
    if (low) { if (prevRow) { vq(prevRow[1], row[1]); vq(prevRow[2], row[2]); } if (!skirtOn || i === cs) vq(row[1], row[2]); skirtOn = true; }
    prevRow = row;
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); addCollider(cg, null);
  // ride samples
  const NS = 180, samples = [];
  for (let i = 0; i <= NS; i++) { frame(i / NS); samples.push({ x: P.x, y: P.y, z: P.z, tx: T.x, ty: T.y, tz: T.z, s: L * i / NS }); }
  for (const u of legsAt) {
    frame(u);
    for (const sgn of [-1, 1]) { const lx = P.x + R.x * sgn * (w + 0.1), lz = P.z + R.z * sgn * (w + 0.1); tube([lx, 0, lz], [lx, P.y + 0.12, lz], 0.03, M.chrome, { seg: 14, col: true }); add(new THREE.SphereGeometry(0.06, 16, 12), M.pink, lx, P.y + 0.14, lz); }
    tube([P.x - R.x * (w + 0.1), P.y - 0.09, P.z - R.z * (w + 0.1)], [P.x + R.x * (w + 0.1), P.y - 0.09, P.z + R.z * (w + 0.1)], 0.025, M.chrome, { seg: 12 });
  }
  const sl = { curve, L, mesh, samples, rideStart }; slides.push(sl); return sl;
}
const slide1 = buildSlide([
  [-1.5, 2.0, -5.02], [-1.5, 2.0, -4.6], [-1.42, 1.84, -4.15], [-1.15, 1.42, -3.55], [-0.78, 1.18, -2.95],
  [-0.36, 0.76, -2.3], [0.02, 0.42, -1.75], [0.33, 0.2, -1.3], [0.62, 0.1, -0.8],
], { rideStart: 0.45, legsAt: [0.36, 0.6] });
const slide2 = buildSlide([
  [7.22, 2.0, 15], [6.8, 2.0, 15], [6.3, 1.8, 15], [5.7, 1.27, 15], [5.1, 0.74, 15], [4.6, 0.44, 15], [4.12, 0.34, 15],
], { rideStart: 0.3, legsAt: [0.42, 0.72] });

// frames around the two holes
function holeFrame(cx, cy0, cy1, hw, at, axis) {
  const t = 0.13, d = 0.12, hh = cy1 - cy0;
  const mk = (w, h, ox, oy) => {
    if (axis === 'z') rbox(w, h, d, 0.04, M.mintPod, cx + ox, oy, at + d / 2 - 0.02, { col: false });
    else rbox(d, h, w, 0.04, M.mintPod, at - d / 2 + 0.02, oy, cx + ox, { col: false });
  };
  mk(t, hh + 2 * t, -hw - t / 2, (cy0 + cy1) / 2); mk(t, hh + 2 * t, hw + t / 2, (cy0 + cy1) / 2);
  mk(2 * hw, t, 0, cy1 + t / 2); mk(2 * hw, t, 0, cy0 - t / 2);
}
holeFrame(HOLE1.x, HOLE1.y0, HOLE1.y1, HOLE1.hw, Z0, 'z');
holeFrame(HOLE2.z, HOLE2.y0, HOLE2.y1, HOLE2.hw, RX, 'x');

/* ------------------------------------------------------------------ */
/* two pitch-black tunnels, one behind each slide, folded together     */
/* ------------------------------------------------------------------ */
// Walk PORTAL_D metres into either one and you are, without a seam, the same distance inside the other one facing its mouth.
const TLEN = 14, PORTAL_D = 9, BALL_D = 5.5;
const TUN = [{ mx: -1.5, mz: Z0, ix: 0, iz: -1 }, { mx: RX, mz: 15, ix: 1, iz: 0 }];
for (const t of TUN) t.yawIn = Math.atan2(-t.ix, -t.iz);
function tunnelOf(x, y, z) { if (y < 1.9 || y > 3.05) return -1; if (z < Z0 && Math.abs(x + 1.5) < 0.6) return 0; if (x > RX && Math.abs(z - 15) < 0.6) return 1; return -1; }
for (const T of TUN) {
  const y0 = 2.0, hh = 0.95, hw = 0.5;
  const raw = [[T.mx, T.mz], [T.mx + T.ix * TLEN, T.mz + T.iz * TLEN]];
  const pts = [];
  for (let s = 0; s < raw.length - 1; s++) {
    const a = raw[s], b = raw[s + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / 0.8);
    for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  pts.push(raw[raw.length - 1]);
  const n = pts.length, Ls = [], Rs = [];
  const dirOf = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; };
  for (let k = 0; k < n; k++) {
    const dp = k > 0 ? dirOf(pts[k - 1], pts[k]) : dirOf(pts[0], pts[1]);
    const dn = k < n - 1 ? dirOf(pts[k], pts[k + 1]) : dp;
    const np = [dp[1], -dp[0]], nn = [dn[1], -dn[0]];
    let mx = np[0] + nn[0], mz = np[1] + nn[1]; const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;
    const len = hw / (mx * np[0] + mz * np[1]);
    Ls.push([pts[k][0] + mx * len, pts[k][1] + mz * len]); Rs.push([pts[k][0] - mx * len, pts[k][1] - mz * len]);
  }
  const pos = [], colr = [], idx = [];
  const e1 = [-1.5, y0 + 0.45, Z0], e2 = [RX, y0 + 0.45, 15];
  const glow = (x, y, z) => 0.05 * Math.exp(-Math.hypot(x - e1[0], y - e1[1], z - e1[2]) / 1.0) + 0.05 * Math.exp(-Math.hypot(x - e2[0], y - e2[1], z - e2[2]) / 1.0);
  for (let k = 0; k < n; k++) for (const [p, y] of [[Ls[k], y0], [Ls[k], y0 + hh], [Rs[k], y0], [Rs[k], y0 + hh]]) {
    pos.push(p[0], y, p[1]); const g = glow(p[0], y, p[1]); colr.push(g * 0.72, g, g * 0.82);
  }
  for (let k = 0; k < n - 1; k++) {
    const a = k * 4, b = a + 4;
    idx.push(a, a + 2, b + 2, a, b + 2, b);             // floor
    idx.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3); // ceiling
    idx.push(a, b, b + 1, a, b + 1, a + 1);             // left
    idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2); // right
  }
  { const a = (n - 1) * 4; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }   // dead end, never reached
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); scene.add(m); solid(m);
}

/* ------------------------------------------------------------------ */
/* ball pit                                                            */
/* ------------------------------------------------------------------ */
(function buildPit() {
  const { x0, x1, z0, z1, rimH: h, rimT: t } = PIT; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  rbox(w + 2 * t, h, t, 0.13, M.rim, cx, h / 2, z0 - t / 2);
  rbox(w + 2 * t, h, t, 0.13, M.rim, cx, h / 2, z1 + t / 2);
  rbox(t, h, d + 2 * t, 0.13, M.rim, x0 - t / 2, h / 2, cz);
  rbox(t, h, d + 2 * t, 0.13, M.rim, x1 + t / 2, h / 2, cz);
  const mats = [M.mintPad, M.ygPad, M.ygPad, M.mintPad]; let k = 0;
  for (const a of [0, 1]) for (const b of [0, 1]) rbox(w / 2 - 0.015, 0.07, d / 2 - 0.015, 0.03, mats[k++], x0 + w / 2 * (a + 0.5), 0.035, z0 + d / 2 * (b + 0.5), { col: false });
  const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d)); c.position.set(cx, 0.035, cz); solid(c);
  // foam wedges to walk in and out
  const wedge = (len, hh, wid, mat, x, z, ry) => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, hh); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: wid, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3 });
    add(g, mat, x, 0, z, { ry, col: new THREE.ExtrudeGeometry(sh, { depth: wid, bevelEnabled: false }) });
  };
  wedge(1.1, h, 1.0, M.ygPad, x0 + 0.05, z1 + t + 1.1, Math.PI / 2);
  wedge(1.0, h, 1.0, M.mintPad, x0 + 1.05, z1 - 1.0, -Math.PI / 2);
})();

/* ------------------------------------------------------------------ */
/* play structures                                                     */
/* ------------------------------------------------------------------ */
function pod(x, y, z, r, mat, wdir, wr, woff, ringMat) {
  add(new THREE.SphereGeometry(r, 56, 36), mat, x, y, z, { col: new THREE.IcosahedronGeometry(r, 1) });
  const d = new V3(wdir[0], wdir[1], wdir[2]).normalize();
  add(new THREE.SphereGeometry(wr, 48, 32), M.glass, x + d.x * woff, y + d.y * woff, z + d.z * woff);
  const a = (r * r - wr * wr + woff * woff) / (2 * woff), rr = Math.sqrt(Math.max(0.0001, r * r - a * a));
  ring(x + d.x * a, y + d.y * a, z + d.z * a, rr, 0.03, ringMat || mat, [d.x, d.y, d.z]);
}
function pinkTube(a, b, r = 0.42) {
  tube(a, b, r, M.pink, { seg: 40, col: true });
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  for (const f of [0.02, 0.5, 0.98]) ring(a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f, r + 0.005, 0.035, M.pinkDeep, d);
}
function panel(w, h, x, y, z, ry = 0) { return rbox(w, h, 0.045, 0.02, M.orange, x, y, z, { ry }); }

// mint dome behind the slide
(function () {
  const xs = [0.25, 1.45], zs = [-4.3, -3.1];
  for (const x of xs) for (const z of zs) post(x, z, 0, [1.3]);
  for (const z of zs) bar([xs[0], 1.12, z], [xs[1], 1.12, z]);
  for (const x of xs) bar([x, 1.12, zs[0]], [x, 1.12, zs[1]]);
  rbox(1.34, 0.09, 1.34, 0.04, M.mintPod, 0.85, 1.12, -3.7);
  panel(1.0, 0.82, 0.85, 0.6, -3.1);
  panel(1.0, 0.82, 1.45, 0.6, -3.7, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.52, 0.56, 0.3, 48), M.mintPod, 0.85, 1.31, -3.7, { col: new THREE.CylinderGeometry(0.54, 0.54, 0.3, 12) });
  pod(0.85, 1.86, -3.7, 0.6, M.mintPod, [0.1, 0.5, 0.86], 0.44, 0.3);
})();

// right-hand frame with the big yellow junction sphere
(function () {
  const xs = [3.0, 4.6, 6.2], zs = [-4.4, -2.8, -1.2];
  for (const x of xs) for (const z of zs) post(x, z, 0, [1.35, 2.75]);
  for (const y of [1.35, 2.75]) {
    for (const z of zs) for (let i = 0; i < 2; i++) bar([xs[i], y, z], [xs[i + 1], y, z]);
    for (const x of xs) for (let i = 0; i < 2; i++) bar([x, y, zs[i]], [x, y, zs[i + 1]]);
  }
  panel(1.38, 1.0, 3.8, 0.72, -1.2);
  panel(1.38, 1.05, 5.4, 2.05, -1.2);
  panel(1.38, 1.0, 5.4, 0.72, -4.4);
  panel(1.38, 1.0, 3.0, 0.72, -3.6, Math.PI / 2);
  panel(1.38, 1.05, 6.2, 2.05, -3.6, Math.PI / 2);
  pinkTube([3.6, 2.05, -2.0], [RX, 2.05, -2.0]);
  pinkTube([4.2, 0.62, -2.0], [RX, 0.62, -2.0]);
  ring(4.2, 0.62, -2.0, 0.36, 0.07, M.pinkDeep, [1, 0, 0]);
  add(new THREE.CircleGeometry(0.36, 40), M.glass, 4.195, 0.62, -2.0, { ry: -Math.PI / 2, cast: false });
  pod(3.3, 2.05, -2.0, 0.64, M.yg, [-0.35, -0.12, 0.93], 0.47, 0.3);
  tube([3.3, 2.5, -2.0], [3.3, H, -2.0], 0.4, M.pink, { seg: 40, col: true });
  ring(3.3, 2.62, -2.0, 0.405, 0.035, M.pinkDeep, [0, 1, 0]);
  rbox(1.5, 0.08, 1.5, 0.03, M.mintPale, 5.4, 1.35, -3.6);
})();

// the little booklet leaning on the pink cushion — it flashes until it has been picked up once
const bookMats = []; let bookPivot = null, bookArrow = null, bookSeen = false;   // the book turns slowly; a short white arrow bobs over it until it has been read
(function () {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 332; const c = cv.getContext('2d');
  c.fillStyle = '#ffd84a'; c.fillRect(0, 0, 256, 332); c.fillStyle = '#fff8dc'; c.fillRect(16, 16, 224, 300);
  for (const [x, y, r, col] of [[70, 215, 40, '#d993c2'], [150, 235, 48, '#7fe3a8'], [200, 180, 30, '#e8742e'], [112, 170, 26, '#c4d232']]) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.22, 0, 7); c.fill(); }
  c.fillStyle = '#e0692a'; c.textAlign = 'center'; c.font = 'bold 40px "Comic Sans MS", "Trebuchet MS", sans-serif'; c.fillText('WELCOME', 128, 70); c.fillText('BACK!', 128, 112);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
  const paper = std({ color: 0xfff3cf, roughness: 0.8, emissive: 0xffd84a, emissiveIntensity: 0 }), cover = std({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  bookMats.push(paper, cover);
  bookPivot = new THREE.Group(); bookPivot.position.set(-5.32, 0, 5.25); bookPivot.rotation.y = Math.PI / 2 - 0.25; scene.add(bookPivot);
  const m = add(new THREE.BoxGeometry(0.2, 0.26, 0.014), [paper, paper, paper, paper, cover, paper], 0, 0.128, 0, { parent: bookPivot, cast: false });
  m.rotateX(-0.3);
  // the arrow: a short white shaft and head, pointing down at the book
  const am = std({ color: 0xffffff, roughness: 0.35 });
  bookArrow = new THREE.Group(); bookArrow.position.set(-5.32, 0.42, 5.25); scene.add(bookArrow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 20), am); shaft.position.y = 0.075; bookArrow.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.075, 28), am); head.rotation.x = Math.PI; head.position.y = 0.0; bookArrow.add(head);
})();

// left: tall ladder posts, a foam roller, loose bits
(function () {
  post(-5.7, -1.7, 0, [1.2, 2.4, 3.42]); post(-4.7, -1.7, 0, [1.2, 2.4, 3.42]); post(-5.7, 0.3, 0, [1.2, 2.4, 3.42]);
  for (let y = 2.62; y < 3.3; y += 0.22) bar([-5.7, y, -1.7], [-4.7, y, -1.7], { col: false });
  bar([-5.7, 1.2, -1.7], [-4.7, 1.2, -1.7]); bar([-5.7, 2.4, -1.7], [-4.7, 2.4, -1.7]);
  bar([-5.7, 1.2, -1.7], [-5.7, 1.2, 0.3]); bar([-5.7, 2.4, -1.7], [-5.7, 2.4, 0.3]);
  bar([-5.7, 1.2, 0.3], [-RX, 1.2, 0.3]); bar([-5.7, 2.4, 0.3], [-RX, 2.4, 0.3]);
  const rg = new THREE.CapsuleGeometry(0.52, 0.5, 10, 40); rg.rotateX(Math.PI / 2);
  add(rg, M.mintPale, -5.5, 0.52, 2.4, { col: new THREE.CylinderGeometry(0.52, 0.52, 1.3, 12).rotateX(Math.PI / 2) });
  rbox(1.7, 0.06, 1.05, 0.025, M.orange, -1.25, 0.03, -0.35, { ry: 0.12 });
  rbox(0.22, 0.16, 0.3, 0.06, M.red, -4.3, 0.08, 0.9, { ry: 0.5 });
  rbox(0.9, 0.42, 0.9, 0.1, M.pink, -5.9, 0.21, 5.2, { ry: 0.3 });
  rbox(0.8, 0.4, 0.8, 0.1, M.ygPad, 6.1, 0.2, 4.4, { ry: -0.2 });
  // cups, a can, a plate
  const cup = new THREE.CylinderGeometry(0.04, 0.03, 0.095, 20);
  add(cup, M.white, 1.25, PIT.rimH + 0.047, PIT.z0 - 0.16);
  add(cup, M.white, 2.75, 0.04, 1.9, { rz: Math.PI / 2, ry: 0.7 });
  add(cup, M.white, 2.55, 0.047, 2.3);
  add(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 20), M.red, -0.9, 0.094, -0.2, { rz: Math.PI / 2, ry: 0.4 });
  add(new THREE.CylinderGeometry(0.11, 0.08, 0.016, 28), M.white, 2.9, 0.008, 2.5);
})();

/* ------------------------------------------------------------------ */
/* pool                                                                */
/* ------------------------------------------------------------------ */
const CAUSTIC = `
float caus(vec2 p, float t){
  const float TAU = 6.28318530718;
  vec2 pp = mod(p * TAU, TAU) - 250.0;
  vec2 i = pp; float c = 1.0; const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = pp + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(pp.x / (sin(i.x + tt) / inten), pp.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
float lampLit(vec3 w, vec3 l){ vec3 d = l - w; float r2 = dot(d, d); return max(d.y, 0.0) / sqrt(r2) * 14.0 / r2; }
`;
const WVERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const wUni = { uTime: { value: 0 }, uCam: { value: new V3() }, uL1: { value: new V3(LAMP2[0], H, LAMP2[1]) }, uL2: { value: new V3(LAMP3[0], H, LAMP3[1]) } };
const waterTop = new THREE.ShaderMaterial({
  uniforms: wUni, vertexShader: WVERT,
  fragmentShader: `uniform float uTime; uniform vec3 uCam, uL1, uL2; varying vec3 vW; ${CAUSTIC}
  float panel(vec3 r, vec3 l){ if (r.y < 0.02) return 0.0; float t = (l.y - vW.y) / r.y; vec2 q = vW.xz + r.xz * t - l.xz; float d = max(abs(q.x), abs(q.y)); return smoothstep(0.62, 0.22, d); }
  void main(){
    vec2 p = vW.xz;
    float c1 = caus(p * 0.36, uTime * 0.42);
    float c2 = caus(p * 0.21 + 0.37, uTime * 0.3 + 1.7);
    vec2 g = vec2(sin(p.x * 2.1 + uTime * 0.9) + 0.6 * sin(p.y * 3.3 - uTime * 0.7 + p.x), cos(p.y * 1.9 + uTime * 0.8) + 0.6 * cos(p.x * 2.9 + uTime * 0.6 - p.y)) * 0.03;
    g += (c1 - 0.2) * 0.02;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 v = normalize(uCam - vW);
    vec3 r = reflect(-v, n);
    float lit = 0.1 + lampLit(vW, uL1) + 0.8 * lampLit(vW, uL2);
    float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
    vec3 base = mix(vec3(0.03, 0.34, 0.33), vec3(0.10, 0.55, 0.48), clamp(c2 * 1.4 + 0.25, 0.0, 1.0));
    vec3 col = base * lit + vec3(0.72, 1.0, 0.88) * c1 * 0.5 * lit;
    col += vec3(0.10, 0.16, 0.13) * fres;
    col += vec3(2.4, 2.8, 2.5) * (panel(r, uL1) + 0.8 * panel(r, uL2)) * (0.25 + 0.75 * fres);
    gl_FragColor = vec4(col, 1.0);
  }`,
});
const waterUnder = new THREE.ShaderMaterial({
  uniforms: wUni, vertexShader: WVERT, transparent: true, depthWrite: false,
  fragmentShader: `uniform float uTime; uniform vec3 uCam, uL1, uL2; varying vec3 vW; ${CAUSTIC}
  void main(){
    vec2 p = vW.xz; float c1 = caus(p * 0.36, uTime * 0.42);
    vec3 v = normalize(vW - uCam);
    float cone = smoothstep(0.60, 0.74, v.y + (c1 - 0.2) * 0.05);   // Snell's window
    float lit = 0.15 + lampLit(vW, uL1) + 0.8 * lampLit(vW, uL2);
    vec3 mirror = vec3(0.05, 0.36, 0.36) * (0.5 + 0.5 * lit) + vec3(0.6, 1.0, 0.9) * c1 * 0.25;
    vec3 win = vec3(0.75, 1.0, 0.92) * (0.25 + c1 * 0.9);
    gl_FragColor = vec4(mix(mirror, win, cone), mix(0.92, 0.16 + 0.3 * c1, cone));
  }`,
});
const causticMat = new THREE.ShaderMaterial({
  uniforms: wUni, vertexShader: WVERT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  fragmentShader: `uniform float uTime; uniform vec3 uL1, uL2; varying vec3 vW; ${CAUSTIC}
  void main(){
    vec2 p = vW.xz + vW.y * 0.35;
    float c = caus(p * 0.5, uTime * 0.5) + 0.5 * caus(p * 0.31 + 0.5, uTime * 0.37 + 2.0);
    float lit = 0.12 + lampLit(vW, uL1) + 0.8 * lampLit(vW, uL2);
    gl_FragColor = vec4(vec3(0.55, 1.0, 0.85) * c * 0.42 * min(lit, 1.6), 1.0);
  }`,
});
// What carries over between scenes (js/save.js). Shrunk on the little stairs in the checkerboard rooms, you come here shrunk too.
const SAVE = window.SCF_SAVE || { get: () => undefined, set() {}, add() {} };
const SMALL = !!SAVE.get('small');
// Behind the pool: a round mesh door hanging open low on the deep-end wall, and behind it a pipe and a small flooded maze under the deck.
// The way in is a circle GR.r across: someone your usual size (taller than it is wide) does not fit; shrunk, you swim straight in.
const GR = { x: 2.0, y: -2.2, r: 0.24 };
const MZ = { C: 0.7, NX: 7, NZ: 8, IN: 3, y0: -2.5, y1: -1.95, z0: PZ1 + 0.5 };
MZ.x0 = GR.x - (MZ.IN + 0.5) * MZ.C; MZ.x1 = MZ.x0 + MZ.NX * MZ.C; MZ.z1 = MZ.z0 + MZ.NZ * MZ.C;
const inMaze = (x, z) => z > PZ1 - 0.02 && z < MZ.z1 + 0.05 && x > MZ.x0 - 0.05 && x < MZ.x1 + 0.05;
let lifebuoy;
(function buildPool() {
  const rows = Math.round(-PBOT / TILE), lenCols = Math.round((PZ1 - PZ0) / TILE), widCols = Math.round(2 * PX / TILE);
  const brnd = mulberry32(77);
  const bfn = () => { const v = (brnd() - 0.5) * 16; const c = brnd() < 0.12 ? [118, 204, 198] : C.paleAqua; return [c[0] + v, c[1] + v, c[2] + v]; };
  const mk = (cols, rws) => tileMat({ cols, rows: rws, fn: bfn, detail: detPool, groutW: 0.045, groutC: 0x8fb5ae, env: 0.5 });
  wall({ x: -PX, z: (PZ0 + PZ1) / 2, y0: PBOT, ry: Math.PI / 2, W: PZ1 - PZ0, Hh: -PBOT, mat: mk(lenCols, rows) });
  wall({ x: PX, z: (PZ0 + PZ1) / 2, y0: PBOT, ry: -Math.PI / 2, W: PZ1 - PZ0, Hh: -PBOT, mat: mk(lenCols, rows) });
  wall({ x: 0, z: PZ1, y0: PBOT, ry: Math.PI, W: 2 * PX, Hh: -PBOT, mat: mk(widCols, rows), hole: [-(GR.x + GR.r + 0.06), GR.y - GR.r - 0.06 - PBOT, -(GR.x - GR.r - 0.06), GR.y + GR.r + 0.06 - PBOT] });   // the hole for the round door (see below)
  const fl = [[-PX, PSHALLOW, PSTEP], [-PX, PDEEP, PZ1], [PX, PDEEP, PZ1], [PX, PSHALLOW, PSTEP]];
  const fcols = widCols, frows = Math.round((PZ1 - PSTEP) / TILE);
  const lane = (i, j) => { const c = (i % 18 === 8 || i % 18 === 9) && j > 4 && j < frows - 5 ? [34, 120, 132] : bfn(); return c; };
  const fgeo = quadGeo(...fl); { const uv = fgeo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getY(k), uv.getX(k)); }
  add(fgeo, tileMat({ cols: frows, rows: fcols, fn: (i, j) => lane(j, i), detail: detPool, groutW: 0.045, groutC: 0x8fb5ae, env: 0.5 }), 0, 0, 0, { cast: false, col: true });
  add(quadGeo(...fl.map((p) => [p[0], p[1] + 0.012, p[2]])), causticMat, 0, 0, 0, { cast: false, recv: false });
  // steps (visual) + one smooth ramp (collision)
  const n = 5, tread = (PSTEP - PZ0) / n, rise = -PSHALLOW / n;
  for (let k = 0; k < n; k++) { const top = -rise * (k + 1); rbox(2 * PX, top - PBOT, tread, 0.02, M.step, 0, (top + PBOT) / 2, PZ0 + tread * (k + 0.5), { col: false, cast: false }); }
  addCollider(quadGeo([-PX, 0, PZ0], [-PX, PSHALLOW, PSTEP], [PX, PSHALLOW, PSTEP], [PX, 0, PZ0]), null);
  // coping
  rbox(0.32, 0.09, PZ1 - PZ0 + 0.6, 0.04, M.mintPod, -PX - 0.15, 0.0, (PZ0 + PZ1) / 2, { col: false });
  rbox(0.32, 0.09, PZ1 - PZ0 + 0.6, 0.04, M.mintPod, PX + 0.15, 0.0, (PZ0 + PZ1) / 2, { col: false });
  rbox(2 * PX + 0.6, 0.09, 0.32, 0.04, M.mintPod, 0, 0.0, PZ1 + 0.15, { col: false });
  // water
  const tg = new THREE.PlaneGeometry(2 * PX, PZ1 - PZ0); tg.rotateX(-Math.PI / 2); add(tg, waterTop, 0, WATER_Y, (PZ0 + PZ1) / 2, { cast: false, recv: false });
  const ug = new THREE.PlaneGeometry(2 * PX, PZ1 - PZ0); ug.rotateX(Math.PI / 2); add(ug, waterUnder, 0, WATER_Y - 0.002, (PZ0 + PZ1) / 2, { cast: false, recv: false });
  // handrails
  for (const x of [-2.1, 2.1]) {
    const c = new THREE.CatmullRomCurve3([new V3(x, 0, 9.35), new V3(x, 0.75, 9.4), new V3(x, 0.95, 9.75), new V3(x, 0.7, 10.3), new V3(x, -0.1, 11.2), new V3(x, -0.9, 11.55), new V3(x, -1.25, 11.6)]);
    add(new THREE.TubeGeometry(c, 60, 0.028, 12), M.chrome);
  }
  lifebuoy = add(new THREE.TorusGeometry(0.36, 0.11, 18, 44), M.orange, -2.3, WATER_Y + 0.03, 17.6, { rx: Math.PI / 2 });
  const rg = new THREE.CapsuleGeometry(0.2, 1.1, 8, 28); rg.rotateZ(Math.PI / 2);
  add(rg, M.pink, -5.9, 0.2, 13.2, { ry: 0.25 }); add(rg, M.ygPad, -5.75, 0.2, 13.75, { ry: 0.12 });
  rbox(0.5, 0.045, 0.32, 0.02, M.mintPad, 5.6, 0.023, 19.4, { ry: 0.4, col: false });
  rbox(0.5, 0.045, 0.32, 0.02, M.orange, 5.3, 0.023, 19.9, { ry: -0.3, col: false });
})();

/* ------------------------------------------------------------------ */
/* behind the round grate: the pipe, the flooded maze, the USB stick  */
/* ------------------------------------------------------------------ */
const usb = { x: 0, y: 0, z: 0, group: null, got: !!SAVE.get('usb') };
const mazeUni = { uTime: wUni.uTime, uCam: wUni.uCam };
const mazeMat = new THREE.ShaderMaterial({
  uniforms: mazeUni,
  vertexShader: `attribute vec3 light; varying vec3 vW; varying vec3 vN; varying vec3 vC;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = light; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uCam; varying vec3 vW; varying vec3 vN; varying vec3 vC; ${CAUSTIC}
  void main(){
    vec3 n = abs(vN);
    vec2 q = n.y > 0.5 ? vW.xz : (n.x > 0.5 ? vW.zy : vW.xy);
    vec2 t = q / 0.05, f = fract(t), id = floor(t);
    float tile = step(0.07, f.x) * step(0.07, f.y);
    float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
    vec3 tc = mix(vec3(0.62, 0.80, 0.76), vec3(0.36, 0.70, 0.68), step(0.88, h)) * (0.88 + 0.22 * h);
    vec3 base = mix(vec3(0.26, 0.36, 0.34), tc, tile);
    float c = caus(vW.xz * 0.9 + vW.y * 0.4, uTime * 0.5);
    vec3 col = base * vC * (1.0 + 1.6 * c);
    float fog = 1.0 - exp(-distance(uCam, vW) * 1.3);
    gl_FragColor = vec4(mix(col, vec3(0.004, 0.032, 0.034), fog), 1.0);
  }`,
});
const mazePipeMat = mazeMat.clone(); mazePipeMat.uniforms = mazeUni; mazePipeMat.side = THREE.BackSide;
(function buildMaze() {
  const { C, NX, NZ, IN, y0, y1, z0, x0 } = MZ, rnd = mulberry32(2611);
  // a perfect maze, carved from the cell the pipe comes into
  const wx = new Uint8Array((NX + 1) * NZ).fill(1), wz = new Uint8Array(NX * (NZ + 1)).fill(1);   // walls on the x = const and z = const lines
  const seen = new Uint8Array(NX * NZ), stack = [IN]; seen[IN] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1], i = c % NX, j = (c / NX) | 0, opts = [];
    if (i > 0 && !seen[c - 1]) opts.push(0); if (i < NX - 1 && !seen[c + 1]) opts.push(1); if (j > 0 && !seen[c - NX]) opts.push(2); if (j < NZ - 1 && !seen[c + NX]) opts.push(3);
    if (!opts.length) { stack.pop(); continue; }
    const d = opts[(rnd() * opts.length) | 0];
    if (d === 0) { wx[j * (NX + 1) + i] = 0; stack.push(c - 1); seen[c - 1] = 1; }
    else if (d === 1) { wx[j * (NX + 1) + i + 1] = 0; stack.push(c + 1); seen[c + 1] = 1; }
    else if (d === 2) { wz[j * NX + i] = 0; stack.push(c - NX); seen[c - NX] = 1; }
    else { wz[(j + 1) * NX + i] = 0; stack.push(c + NX); seen[c + NX] = 1; }
  }
  const open = (a, b) => { const ia = a % NX, ja = (a / NX) | 0, ib = b % NX, jb = (b / NX) | 0;
    if (ja === jb) return !wx[ja * (NX + 1) + Math.max(ia, ib)]; return !wz[Math.max(ja, jb) * NX + ia]; };
  const nbrs = (c) => { const i = c % NX, j = (c / NX) | 0, o = []; if (i > 0) o.push(c - 1); if (i < NX - 1) o.push(c + 1); if (j > 0) o.push(c - NX); if (j < NZ - 1) o.push(c + NX); return o.filter((b) => open(c, b)); };
  // the stick lies in the dead end farthest from the way in
  const dist = new Int16Array(NX * NZ).fill(-1), prev = new Int16Array(NX * NZ).fill(-1), q = [IN]; dist[IN] = 0;
  for (let k = 0; k < q.length; k++) for (const b of nbrs(q[k])) if (dist[b] < 0) { dist[b] = dist[q[k]] + 1; prev[b] = q[k]; q.push(b); }
  let far = IN; for (let c = 0; c < NX * NZ; c++) if (dist[c] > dist[far]) far = c;
  const path = []; for (let c = far; c >= 0; c = prev[c]) path.unshift(c);
  const cx = (c) => x0 + (c % NX + 0.5) * C, cz = (c) => z0 + (((c / NX) | 0) + 0.5) * C, ym = (y0 + y1) / 2;
  usb.x = cx(far); usb.z = cz(far); usb.y = y0 + 0.008;
  // light, baked into the tiles: the pool's glow coming in at the pipe, a few dim green portholes along the way, the stick's blue LED glow
  const lights = [{ x: GR.x, y: GR.y, z: z0 - 0.15, c: [0.42, 0.85, 0.78], r: 0.5, cell: IN }];
  const lamps = [];
  for (const f of [0.28, 0.52, 0.76]) { const c = path[Math.max(1, Math.min(path.length - 2, Math.round(f * (path.length - 1))))]; if (!lamps.includes(c)) lamps.push(c); }
  lamps.forEach((c, k) => { const fade = 1 - 0.28 * k; lights.push({ x: cx(c), y: y1 - 0.1, z: cz(c), c: [0.20 * fade, 0.55 * fade, 0.36 * fade], r: 0.42, cell: c, lamp: true }); });
  if (!usb.got) lights.push({ x: usb.x, y: usb.y + 0.05, z: usb.z, c: [0.18, 0.42, 0.95], r: 0.3, cell: far });
  const near = (a, b) => a === b || nbrs(a).includes(b);
  const lightAt = (x, y, z, cell) => {
    let r = 0.022, g = 0.05, b = 0.05;
    for (const L of lights) { if (!near(L.cell, cell)) continue; const k = Math.exp(-Math.hypot(x - L.x, y - L.y, z - L.z) / L.r); r += L.c[0] * k; g += L.c[1] * k; b += L.c[2] * k; }
    return [r, g, b];
  };
  // geometry: every face belongs to one cell and faces into it, finely split so the baked light comes out smooth
  const P = [], N = [], Lc = [], col = [];
  const tri = (a, b, c, n, cell) => { for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); Lc.push(...lightAt(v[0], v[1], v[2], cell)); } };
  const quad = (o, u, v, n, cell, seg = 4) => {   // o + s*u + t*v, s,t in [0,1]; wound so its front faces along n
    const at = (s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    for (let a = 0; a < seg; a++) for (let b = 0; b < seg; b++) {
      const p00 = at(a / seg, b / seg), p10 = at((a + 1) / seg, b / seg), p11 = at((a + 1) / seg, (b + 1) / seg), p01 = at(a / seg, (b + 1) / seg);
      if (flip) { tri(p00, p11, p10, n, cell); tri(p00, p01, p11, n, cell); } else { tri(p00, p10, p11, n, cell); tri(p00, p11, p01, n, cell); }
    }
    col.push(o, at(1, 0), at(1, 1), at(0, 1));
  };
  const H2 = y1 - y0;
  for (let c = 0; c < NX * NZ; c++) {
    const i = c % NX, j = (c / NX) | 0, xa = x0 + i * C, za = z0 + j * C;
    quad([xa, y0, za], [C, 0, 0], [0, 0, C], [0, 1, 0], c);            // floor
    quad([xa, y1, za], [C, 0, 0], [0, 0, C], [0, -1, 0], c);           // ceiling
    if (wx[j * (NX + 1) + i]) quad([xa, y0, za], [0, 0, C], [0, H2, 0], [1, 0, 0], c);
    if (wx[j * (NX + 1) + i + 1]) quad([xa + C, y0, za], [0, 0, C], [0, H2, 0], [-1, 0, 0], c);
    if (wz[(j + 1) * NX + i]) quad([xa, y0, za + C], [C, 0, 0], [0, H2, 0], [0, 0, -1], c);
    if (wz[j * NX + i] && c !== IN) quad([xa, y0, za], [C, 0, 0], [0, H2, 0], [0, 0, 1], c);
  }
  // the way in: the entrance cell's front wall with a round hole where the pipe comes through
  {
    const xa = x0 + IN * C, sh = new THREE.Shape(); sh.moveTo(xa, y0); sh.lineTo(xa + C, y0); sh.lineTo(xa + C, y1); sh.lineTo(xa, y1); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(GR.x, GR.y, GR.r, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ShapeGeometry(sh, 24).toNonIndexed(), pa = g.attributes.position.array, cp = [];
    for (let k = 0; k < pa.length; k += 9) {
      const v = [0, 1, 2].map((m) => [pa[k + m * 3], pa[k + m * 3 + 1], z0]);
      tri(v[0], v[1], v[2], [0, 0, 1], IN); cp.push(...v[0], ...v[1], ...v[2]);
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); addCollider(cg, null);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('light', new THREE.Float32BufferAttribute(Lc, 3));
  add(geo, mazeMat, 0, 0, 0, { cast: false, recv: false });
  { const cp = []; for (let k = 0; k < col.length; k += 4) { const [a, b, c, d] = col.slice(k, k + 4); cp.push(...a, ...b, ...c, ...a, ...c, ...d); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); addCollider(cg, null); }
  // the pipe from the pool wall to the maze
  {
    const len = z0 - PZ1, pg = new THREE.CylinderGeometry(GR.r, GR.r, len, 28, 6, true); pg.rotateX(Math.PI / 2); pg.translate(GR.x, GR.y, PZ1 + len / 2);
    const pa = pg.attributes.position.array, la = new Float32Array(pa.length);
    for (let k = 0; k < pa.length; k += 3) { const t = clamp((pa[k + 2] - PZ1) / len, 0, 1), L = lightAt(pa[k], pa[k + 1], pa[k + 2], IN);
      la[k] = L[0] + 0.25 * (1 - t); la[k + 1] = L[1] + 0.5 * (1 - t); la[k + 2] = L[2] + 0.45 * (1 - t); }
    pg.setAttribute('light', new THREE.BufferAttribute(la, 3));
    add(pg, mazePipeMat, 0, 0, 0, { cast: false, recv: false });
    const cg = new THREE.CylinderGeometry(GR.r, GR.r, len + 0.02, 16, 1, true); cg.rotateX(Math.PI / 2); cg.translate(GR.x, GR.y, PZ1 + len / 2); addCollider(cg, null);
  }
  // portholes: small round lamps set in the ceiling, each a little dimmer than the one before
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.0, 0.72) });
  for (const L of lights) if (L.lamp) { const m = add(new THREE.CircleGeometry(0.05, 20), lampMat, L.x, y1 - 0.002, L.z, { rx: Math.PI / 2, cast: false, recv: false }); m.material = lampMat.clone(); m.material.color.multiplyScalar(L.c[1] / 0.55); }
  // the USB stick
  if (!usb.got) {
    const gp = new THREE.Group(); gp.position.set(usb.x + 0.08, usb.y, usb.z - 0.05); gp.rotation.y = 0.7; scene.add(gp); usb.group = gp;
    const bm = (c) => new THREE.MeshBasicMaterial({ color: c });
    const piece = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.3), bm(c)); m.position.set(x, y, z); gp.add(m); return m; };
    piece(0.032, 0.012, 0.07, 0x1d3c86, 0, 0.006, 0);              // body
    piece(0.033, 0.0125, 0.012, 0x13285c, 0, 0.0062, 0.03);        // the end you hold
    piece(0.02, 0.0004, 0.03, 0xdfe4e6, 0, 0.0122, -0.004);        // label
    piece(0.022, 0.008, 0.026, 0xb9c4ca, 0, 0.005, -0.046);        // metal plug
    piece(0.004, 0.003, 0.004, 0xff3a2c, 0.01, 0.0125, 0.026);     // LED
    usb.x = gp.position.x; usb.z = gp.position.z;
  }
  // the round mesh door on the pool side, and its collar
  {
    const rim = std({ color: 0xc7d6d2, roughness: 0.35, metalness: 0.55 });
    const sq = new THREE.Shape(); const s = GR.r + 0.06; sq.moveTo(-s, -s); sq.lineTo(s, -s); sq.lineTo(s, s); sq.lineTo(-s, s); sq.closePath();
    const hh = new THREE.Path(); hh.absarc(0, 0, GR.r, 0, Math.PI * 2, true); sq.holes.push(hh);
    const collar = add(new THREE.ShapeGeometry(sq, 28), std({ color: 0x9fbdb6, roughness: 0.5, metalness: 0.25 }), GR.x, GR.y, PZ1 - 0.003, { ry: Math.PI, cast: false, col: true });
    ring(GR.x, GR.y, PZ1 - 0.01, GR.r + 0.012, 0.016, rim, [0, 0, 1]);
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.beginPath(); g.arc(128, 128, 127, 0, Math.PI * 2); g.clip(); g.strokeStyle = '#e8f0ee'; g.lineWidth = 5;
    for (let k = -256; k < 512; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const pivot = new THREE.Group(); pivot.position.set(GR.x + GR.r + 0.012, GR.y, PZ1 - 0.012); scene.add(pivot);
    const door = new THREE.Mesh(new THREE.CircleGeometry(GR.r + 0.005, 40), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5, color: 0xb8c9c5 }));
    door.position.set(-(GR.r + 0.012), 0, 0); door.rotation.y = Math.PI; pivot.add(door);
    const dr = new THREE.Mesh(new THREE.TorusGeometry(GR.r + 0.005, 0.014, 10, 40), rim); dr.position.copy(door.position); pivot.add(dr);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12), rim); pivot.add(hinge);
    pivot.rotation.y = -1.95;   // hanging open, out into the pool
    for (const m of [door, dr, hinge]) { m.castShadow = true; m.receiveShadow = true; }
    // at your usual size, the round way in is too small: an invisible plate in the hole keeps you out
    if (!SMALL) addCollider(quadGeo([GR.x - GR.r, GR.y - GR.r, PZ1 + 0.03], [GR.x - GR.r, GR.y + GR.r, PZ1 + 0.03], [GR.x + GR.r, GR.y + GR.r, PZ1 + 0.03], [GR.x + GR.r, GR.y - GR.r, PZ1 + 0.03]), null);
  }
})();
// near the round door and swimming at it: you are drawn into the middle of the opening, the way water pulls at a drain
function grateAssist(dt) {
  if (!SMALL || !player.swim) return;
  const p = player.pos, f = clamp((p.z - (PZ1 - 0.8)) / 0.8, 0, 1);
  if (f <= 0 || p.z > MZ.z0 + 0.1 || Math.abs(p.x - GR.x) > 0.5 || p.y < GR.y - 0.6 || p.y > GR.y + 0.5) return;
  const k = Math.min(1, dt * 4 * f); p.x += (GR.x - p.x) * k; p.y += (GR.y - H_STAND / 2 - p.y) * k;
}
const usbNear = () => !usb.got && usb.group && Math.hypot(camera.position.x - usb.x, camera.position.y - usb.y, camera.position.z - usb.z) < 0.42;
let usbMsg = null;
function takeUsb() {
  usb.got = true; SAVE.set('usb', true); scene.remove(usb.group); epEl.style.display = 'none';
  if (AC) try { const t = AC.currentTime; for (const [f, d] of [[880, 0], [1320, 0.12], [1760, 0.24]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.07, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.9); o.connect(g); g.connect(acOut); o.start(t + d); o.stop(t + d + 1); } } catch (e) { /* sound is optional */ }
  if (!usbMsg) { usbMsg = document.createElement('div'); usbMsg.style.cssText = "position:fixed;left:50%;top:22%;transform:translateX(-50%) rotate(-1.5deg);padding:14px 22px;border-radius:10px;background:#fff8dc;color:#35424a;font:26px/1.3 'Gochi Hand','Comic Sans MS',cursive;box-shadow:0 12px 40px rgba(0,0,0,.5),inset 0 0 0 5px #7fd0e8;text-align:center;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .6s;z-index:9"; document.body.appendChild(usbMsg); }
  usbMsg.innerHTML = 'You found a USB stick.<br><span style="font-size:19px;color:#5b6b70">Someone hid it down here a long time ago.</span>';
  requestAnimationFrame(() => { usbMsg.style.opacity = '1'; }); setTimeout(() => { usbMsg.style.opacity = '0'; }, 4200);
}

/* ------------------------------------------------------------------ */
/* collision BVH                                                       */
/* ------------------------------------------------------------------ */
const colGeo = new THREE.BufferGeometry();
{ const all = new Float32Array(colVerts * 3); let o = 0; for (const p of colParts) { all.set(p, o); o += p.length; } colGeo.setAttribute('position', new THREE.BufferAttribute(all, 3)); }
const bvh = new MeshBVH(colGeo);

const _sph = new THREE.Sphere(), _tv = new V3(), _tv2 = new V3(), _seg = new THREE.Line3(), _box = new THREE.Box3();
let _sphHit = false;
const sphCast = {
  intersectsBounds: (b) => b.intersectsSphere(_sph),
  intersectsTriangle: (tri) => {
    tri.closestPointToPoint(_sph.center, _tv); _tv.sub(_sph.center); const d = _tv.length();
    if (d < _sph.radius && d > 1e-7) { _sph.center.addScaledVector(_tv, (d - _sph.radius) / d); _sphHit = true; }
  },
};
let _capR = 0.28;
const capCast = {
  intersectsBounds: (b) => b.intersectsBox(_box),
  intersectsTriangle: (tri) => {
    const d = tri.closestPointToSegment(_seg, _tv, _tv2);
    if (d < _capR) { const dir = _tv2.sub(_tv).normalize(); _seg.start.addScaledVector(dir, _capR - d); _seg.end.addScaledVector(dir, _capR - d); }
  },
};
let _capBlocked = false;
const capTest = {
  intersectsBounds: (b) => b.intersectsBox(_box),
  intersectsTriangle: (tri) => { if (tri.closestPointToSegment(_seg, _tv, _tv2) < _capR) { _capBlocked = true; return true; } return false; },
};
const inBasin = (x, z) => x > -PX && x < PX && z > PZ0 && z < PZ1;

/* ------------------------------------------------------------------ */
/* player                                                              */
/* ------------------------------------------------------------------ */
const PS = 0.3 * (SMALL ? 0.42 : 1);   // player scale: a third of adult size so the room looms; less than half that again when shrunk
const PR = 0.28 * PS, H_STAND = 1.7 * PS, H_CROUCH = 0.86 * PS, EYE = 0.1 * PS;
const player = {
  pos: new V3(0.55, 0.08, 2.35), vel: new V3(), yaw: 0.27, pitch: 0.0, h: H_STAND, crouch: false, onGround: false, ground: 0,
  swim: false, mode: 'walk', slip: 0, bob: 0, rideCool: 0, frozen: false, blocked: 0, hop: 0, mantle: null,
};
const ride = { sl: null, s: 0, v: 0, heading: 0, t: 0 };
let blink = null, fade = 0, under = 0, held = -1, heldSnap = false;
const keys = Object.create(null);
let cDownAt = 0, cToggledOn = false;

const _rayUp = new THREE.Ray();
function segPierced() {
  _rayUp.origin.copy(_seg.start); _rayUp.direction.subVectors(_seg.end, _seg.start); const len = _rayUp.direction.length(); if (len < 1e-4) return false;
  _rayUp.direction.multiplyScalar(1 / len); const hit = bvh.raycastFirst(_rayUp, THREE.DoubleSide); return !!hit && hit.distance < len;
}
function groundMin(x, z) {
  if (inBasin(x, z)) return z < PSTEP ? PSHALLOW * (z - PZ0) / (PSTEP - PZ0) : PSHALLOW + (PDEEP - PSHALLOW) * (z - PSTEP) / (PZ1 - PSTEP);
  if (inMaze(x, z)) return -2.7;   // under the deck, the flooded maze: its own floor holds you
  if (z < Z0 || x > RX) return 2.0;
  return 0;
}
function canStand() {
  const p = player.pos; _capR = PR * 0.85; _capBlocked = false;
  _seg.start.set(p.x, p.y + PR + 0.12 * PS, p.z); _seg.end.set(p.x, p.y + H_STAND - PR, p.z);
  _box.makeEmpty(); _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end); _box.min.addScalar(-_capR); _box.max.addScalar(_capR);
  bvh.shapecast(capTest); return !_capBlocked && !segPierced();
}
function capFree(x, y, z, h) {
  _capR = PR * 0.9; _capBlocked = false; _seg.start.set(x, y + PR, z); _seg.end.set(x, y + h - PR, z);
  _box.makeEmpty(); _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end); _box.min.addScalar(-_capR); _box.max.addScalar(_capR);
  bvh.shapecast(capTest); return !_capBlocked && !segPierced();
}
function freeAt(x, y, z, h) {
  const px = player.pos.x, pz = player.pos.z;
  if (!capFree(x, y, z, h) || !capFree(px, y, pz, h)) return false;
  for (const hy of [PR, h * 0.5, h - PR]) { _seg.start.set(px, y + hy, pz); _seg.end.set(x, y + hy, z); if (segPierced()) return false; }
  return true;
}
// climb onto / over anything up to chest-and-a-bit high in the direction of travel
function tryMantle(dx, dz) {
  const p = player.pos, fwd = PR * 2 + 0.07;
  for (let hy = 0.06; hy <= 0.8; hy += 0.07) {
    if (freeAt(p.x + dx * fwd, p.y + hy, p.z + dz * fwd, player.h)) { player.mantle = { t: 0, dur: 0.2 + hy * 0.5, from: p.clone(), to: new V3(p.x + dx * fwd, p.y + hy + 0.005, p.z + dz * fwd) }; return true; }
  }
  return false;
}
function collidePlayer(dt) {
  const p = player.pos, v = player.vel, r = PR; _capR = r;
  const top = Math.max(player.h - r, r + 0.005);
  _seg.start.set(p.x, p.y + r, p.z); _seg.end.set(p.x, p.y + top, p.z);
  _box.makeEmpty(); _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end); _box.min.addScalar(-r); _box.max.addScalar(r);
  bvh.shapecast(capCast);
  const dx = _seg.start.x - p.x, dy = _seg.start.y - (p.y + r), dz = _seg.start.z - p.z;
  let grounded = dy > Math.abs(dt * v.y * 0.25);
  p.x += dx; p.y += dy; p.z += dz;
  const gy = groundMin(p.x, p.z) - 0.01; if (p.y < gy) { p.y = gy; grounded = true; }
  const len = Math.hypot(dx, dy, dz);
  if (grounded) { if (v.y < 0) v.y = 0; }
  else if (len > 1e-6) { const nx = dx / len, ny = dy / len, nz = dz / len, dot = v.x * nx + v.y * ny + v.z * nz; if (dot < 0) { v.x -= nx * dot; v.y -= ny * dot; v.z -= nz * dot; } }
  return grounded;
}
function nearestOnSlide(sl, p, maxD) {
  let best = -1, bd = maxD * maxD;
  for (let k = 0; k < sl.samples.length; k++) { const S = sl.samples[k], dy = p.y - S.y; if (dy < -0.3 || dy > 0.5) continue; const dx = p.x - S.x, dz = p.z - S.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = k; } }
  return best;
}
function startRide(sl, s, v0) {
  ride.sl = sl; ride.s = clamp(s, sl.rideStart, sl.L - 0.2); ride.v = Math.max(v0, 1.4); ride.t = 0;
  const T = sl.curve.getTangentAt(ride.s / sl.L, _tv); ride.heading = Math.atan2(-T.x, -T.z);
  player.mode = 'ride'; player.crouch = true; player.swim = false; player.vel.set(0, 0, 0);
}
function endRide() {
  const sl = ride.sl, T = sl.curve.getTangentAt(1, _tv), P = sl.curve.getPointAt(1, _tv2);
  const hl = Math.hypot(T.x, T.z) || 1;
  player.pos.set(P.x + T.x / hl * 0.3, P.y + 0.03, P.z + T.z / hl * 0.3);
  player.vel.set(T.x / hl * ride.v, 0, T.z / hl * ride.v);
  player.mode = 'walk'; player.crouch = false; cToggledOn = false; player.slip = 0.9; player.rideCool = 0.6; ride.sl = null;
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function updateRide(dt) {
  const sl = ride.sl; ride.t += dt;
  const T = sl.curve.getTangentAt(clamp(ride.s / sl.L, 0, 1), _tv);
  const a = 9.8 * (-T.y) - 0.9 - 0.035 * ride.v * ride.v;
  ride.v = clamp(ride.v + a * dt, 1.4, 9); ride.s += ride.v * dt;
  if (ride.s >= sl.L) { endRide(); return; }
  const u = ride.s / sl.L; sl.curve.getPointAt(u, player.pos);
  sl.curve.getTangentAt(u, _tv); const hd = Math.atan2(-_tv.x, -_tv.z);
  player.yaw += angDiff(hd, ride.heading); ride.heading = hd;
  if (ride.t < 0.5) player.yaw += angDiff(hd, player.yaw) * Math.min(1, dt * 7);
  player.bob += ride.v * dt;
}
function stepPlayer(dt) {
  const p = player.pos, v = player.vel;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const il = Math.hypot(fw, st); if (il > 1) { fw /= il; st /= il; }
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const depth = inBasin(p.x, p.z) || inMaze(p.x, p.z) ? WATER_Y - p.y : -1;
  if (!player.swim && depth > 1.1 * PS) { player.swim = true; v.y *= 0.35; player.crouch = false; cToggledOn = false; }
  else if (player.swim && depth < 0.95 * PS) player.swim = false;

  if (player.swim) {
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    let wx = (-sy * cp) * fw + cy * st, wy = sp * fw, wz = (-cy * cp) * fw - sy * st;
    if (keys.Space) wy += 1; if (keys.KeyC) wy -= 1;
    const wl = Math.hypot(wx, wy, wz); if (wl > 1) { wx /= wl; wy /= wl; wz /= wl; }
    const floatY = WATER_Y - 1.3 * PS;
    if (p.y > floatY && wy > 0) wy = 0;
    const spd = (sprint ? 2.0 : 1.2) * (SMALL ? 0.7 : 1), k = 1 - Math.exp(-3.2 * dt);
    v.x += (wx * spd - v.x) * k; v.y += (wy * spd - v.y) * k; v.z += (wz * spd - v.z) * k;
    if (p.y < floatY) { if (!keys.KeyC && wy >= -0.05 && (!SMALL || p.z < PZ1 - 0.9)) v.y += 1.6 * dt; } else v.y -= 5 * dt;   // no drift up by the deep-end wall and in the flooded maze
    const sx0 = p.x, sz0 = p.z, sw = Math.hypot(v.x, v.z) * dt;
    p.addScaledVector(v, dt);
    collidePlayer(dt); player.onGround = false;
    player.bob += Math.hypot(v.x, v.z) * dt * 0.5;
    // pushing against the pool edge at the surface: climb out
    const hl = Math.hypot(wx, wz);
    if (hl > 0.3 && p.y > floatY - 0.25 && sw > 1e-5 && Math.hypot(p.x - sx0, p.z - sz0) < sw * 0.45) {
      player.blocked += dt;
      if (player.blocked > 0.15) {
        player.blocked = 0; const tx = p.x + wx / hl * 0.6, tz = p.z + wz / hl * 0.6;
        if (!inBasin(tx, tz) && freeAt(tx, 0.06, tz, H_STAND)) player.mantle = { t: 0, dur: 0.55, from: p.clone(), to: new V3(tx, 0.03, tz) };
      }
    } else player.blocked = 0;
    return;
  }
  const wantCrouch = player.crouch;
  let spd = wantCrouch || player.h < H_STAND * 0.76 ? (sprint ? 1.5 : 0.8) : (sprint ? 3.0 : 1.5);
  if (depth > 0.35 * PS) spd *= 0.6;
  const wx = (-sy * fw + cy * st) * spd, wz = (-cy * fw - sy * st) * spd;
  const acc = player.onGround ? (player.slip > 0 && il === 0 ? 1.3 : 11) : (player.hop > 0 ? 9 : 4), k = 1 - Math.exp(-acc * dt);
  player.hop = Math.max(0, player.hop - dt);
  v.x += (wx - v.x) * k; v.z += (wz - v.z) * k;
  v.y -= G * dt;
  if (keys.Space && player.ground > 0 && v.y <= 0.01 && player.h > H_STAND * 0.9) { v.y = 3.2; player.ground = 0; }
  const px0 = p.x, pz0 = p.z, want = Math.hypot(v.x, v.z) * dt;
  p.addScaledVector(v, dt);
  player.onGround = collidePlayer(dt);
  player.ground = player.onGround ? 0.12 : Math.max(0, player.ground - dt);
  // walking into something low (pit rim, slide lip, mats): climb it automatically
  if (il > 0 && player.onGround && want > 1e-5 && Math.hypot(p.x - px0, p.z - pz0) < want * 0.45) {
    player.blocked += dt;
    if (player.blocked > 0.09) { player.blocked = 0; const l = Math.hypot(wx, wz) || 1; if (tryMantle(wx / l, wz / l)) return; }
  } else if (player.onGround) player.blocked = 0;
  if (player.onGround) player.bob += Math.hypot(v.x, v.z) * dt;
  // stepping onto a slide heading downhill starts the ride
  if (player.rideCool <= 0) for (const sl of slides) {
    const k2 = nearestOnSlide(sl, p, 0.42); if (k2 < 0) continue; const S = sl.samples[k2];
    if (p.y - S.y > 0.16) continue;
    if (S.s < sl.rideStart || S.s > sl.L - 0.6) continue;
    const along = v.x * S.tx + v.z * S.tz; if (along > 0.4) { startRide(sl, S.s, along); break; }
  }
  if (p.y < -9) { p.set(0.55, 0.3, 2.35); v.set(0, 0, 0); }
}
function portalPlayer() {
  const p = player.pos, k = tunnelOf(p.x, p.y, p.z); if (k < 0) return;
  const a = TUN[k], b = TUN[1 - k], s = (p.x - a.mx) * a.ix + (p.z - a.mz) * a.iz; if (s < PORTAL_D) return;
  const u = (p.x - a.mx) * -a.iz + (p.z - a.mz) * a.ix, s2 = Math.max(2 * PORTAL_D - s, PORTAL_D - 0.5);
  p.x = b.mx + b.ix * s2 + b.iz * u; p.z = b.mz + b.iz * s2 - b.ix * u;
  const d = b.yawIn + Math.PI - a.yawIn, c = Math.cos(d), sn = Math.sin(d), v = player.vel, vx = v.x * c + v.z * sn, vz = -v.x * sn + v.z * c;
  v.x = vx; v.z = vz; player.yaw += d; heldSnap = true;
}
function updatePlayer(dt) {
  if (player.frozen) return;
  player.slip = Math.max(0, player.slip - dt); player.rideCool = Math.max(0, player.rideCool - dt);
  if (blink) {
    blink.t += dt / 0.2;
    if (blink.phase === 0) { fade = Math.min(1, blink.t); if (blink.t >= 1) { const sl = blink.sl; sl.curve.getPointAt(sl.rideStart / sl.L, player.pos); startRide(sl, sl.rideStart, 1.6); player.yaw = ride.heading; player.pitch = -0.15; player.h = H_CROUCH; blink.phase = 1; blink.t = 0; } }
    else { fade = Math.max(0, 1 - blink.t); if (blink.t >= 1) { blink = null; fade = 0; } }
    if (blink && blink.phase === 0) return;
  }
  if (player.mantle) {
    const m = player.mantle; m.t = Math.min(1, m.t + dt / m.dur); const e = m.t * m.t * (3 - 2 * m.t);
    player.pos.set(m.from.x + (m.to.x - m.from.x) * e * e, m.from.y + (m.to.y - m.from.y) * Math.min(1, e * 1.35), m.from.z + (m.to.z - m.from.z) * e * e);
    if (m.t >= 1) { player.mantle = null; player.swim = false; player.vel.set(0, 0, 0); }
    return;
  }
  if (player.mode === 'ride') updateRide(dt);
  else { const n = 4; for (let i = 0; i < n; i++) { if (player.mode !== 'walk' || player.mantle) break; stepPlayer(dt / n); } if (player.mode === 'walk') { portalPlayer(); grateAssist(dt); } }
  // crouch height
  let target = player.crouch ? H_CROUCH : H_STAND;
  if (target > player.h + 0.01 && player.mode === 'walk' && !player.swim && !canStand()) target = player.h;
  const dh = target - player.h, stepH = 2.4 * dt; player.h += clamp(dh, -stepH, stepH);
}
const BOOK = new V3(-5.32, 0.13, 5.25), bookEl = document.getElementById('book'), epEl = document.getElementById('ep'), _bp = new V3();
function bookAim() { camera.getWorldDirection(_cd); const c = camera.position, dx = BOOK.x - c.x, dy = BOOK.y - c.y, dz = BOOK.z - c.z, d = Math.hypot(dx, dy, dz); return d < 1.5 && (dx * _cd.x + dy * _cd.y + dz * _cd.z) / d > 0.6; } let bookOpen = false;
function setBook(on) { bookOpen = on; if (on && !bookSeen) { bookSeen = true; bookArrow.visible = false; epEl.style.display = 'none'; } bookEl.style.display = on ? 'block' : 'none'; bookEl.style.filter = `grayscale(${grade.uniforms.uGray.value.toFixed(2)})`; }
function interact() {
  if (player.frozen) return;
  if (bookOpen) { setBook(false); return; }
  if (usbNear()) { takeUsb(); return; }
  if (held >= 0) { throwBall(); return; }
  if (bookAim()) { setBook(true); return; }
  const b = pickBall(); if (b >= 0) { held = b; bsleep[b] = 0; return; }
  if (player.mode !== 'walk' || blink) return;
  for (const sl of slides) { const k = nearestOnSlide(sl, player.pos, 0.5); if (k >= 0 && sl.samples[k].s < sl.L - 0.5) { startRide(sl, sl.samples[k].s, 1.6); return; } }
  camera.getWorldDirection(_cd); const c = camera.position; let bestSl = null, bestA = 0.5;
  for (const sl of slides) for (let k = 0; k < sl.samples.length; k += 3) {
    const S = sl.samples[k], dx = S.x - c.x, dy = S.y + 0.1 - c.y, dz = S.z - c.z, d = Math.hypot(dx, dy, dz); if (d > 1.3 || d < 0.05) continue;
    const a = Math.acos(clamp((dx * _cd.x + dy * _cd.y + dz * _cd.z) / d, -1, 1)); if (a < bestA) { bestA = a; bestSl = sl; }
  }
  if (bestSl) blink = { t: 0, phase: 0, sl: bestSl };
}
const _ray = new THREE.Raycaster(), _c0 = new THREE.Vector2(0, 0);

/* ------------------------------------------------------------------ */
/* balls: position-based dynamics on a spatial hash + the same BVH     */
/* ------------------------------------------------------------------ */
const NB = 440, BR = 0.086, BD = BR * 2, BD2 = BD * BD;
const bp = new Float32Array(NB * 3), bq = new Float32Array(NB * 3), bv = new Float32Array(NB * 3), bb = new Float32Array(NB * 3);
const bsleep = new Uint8Array(NB), bcalm = new Uint16Array(NB), bspd = new Float32Array(NB), bhit = new Uint8Array(NB);
const HS = 4096, hHead = new Int32Array(HS), hNext = new Int32Array(NB), CELL = 1 / (BD * 1.05);
const hsh = (ix, iy, iz) => (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & (HS - 1);
const ballGeo = new THREE.SphereGeometry(BR, 22, 16);
const ballMesh = new THREE.InstancedMesh(ballGeo, std({ color: 0xffffff, roughness: 0.32 }), NB);
ballMesh.castShadow = true; ballMesh.receiveShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);
{
  const pal = [0xd993c2, 0xc4d232, 0x7fe3a8, 0xe8742e, 0xe8eee8, 0xd993c2, 0xc4d232, 0x7fe3a8];
  const col = new THREE.Color(), m4 = new THREE.Matrix4(); let n = 0;
  for (let layer = 0; n < NB; layer++) { const off = (layer % 2) * BD * 0.52; for (let z = PIT.z0 + BR + 0.02 + off; z < PIT.z1 - BR - 0.01 && n < NB; z += BD * 1.04) for (let x = PIT.x0 + BR + 0.02 + off; x < PIT.x1 - BR - 0.01 && n < NB; x += BD * 1.04) {
    bp[n * 3] = x + (rand() - 0.5) * 0.012; bp[n * 3 + 1] = 0.075 + BR + layer * BD * 0.76; bp[n * 3 + 2] = z + (rand() - 0.5) * 0.012;
    col.setHex(pal[(rand() * pal.length) | 0]); ballMesh.setColorAt(n, col); m4.makeTranslation(bp[n * 3], bp[n * 3 + 1], bp[n * 3 + 2]); ballMesh.setMatrixAt(n, m4); n++;
  } }
  ballMesh.instanceColor.needsUpdate = true;
}
let ballsAwake = NB, ballMaxV2 = 0, thrown = -1, thrownT = 0;
const BG = 8, THROW = 15;   // light plastic balls, strong throw: reaches the slide hole from anywhere in the pit
function wake(i) { bsleep[i] = 0; bcalm[i] = 0; }
const bIn = new Uint8Array(NB), bOut = new Uint8Array(NB), bcol = new Float32Array(ballMesh.instanceColor.array);
function tintBall(i, f) { const a = ballMesh.instanceColor.array, o = i * 3; a[o] = bcol[o] * f; a[o + 1] = bcol[o + 1] * f; a[o + 2] = bcol[o + 2] * f; ballMesh.instanceColor.needsUpdate = true; }
function ballStep(dt) {
  if (dt < 1e-5) return;
  thrownT = Math.max(0, thrownT - dt);
  const pp = player.pos, pTop = pp.y + Math.max(player.h - PR, PR), pBot = pp.y + PR, RR = PR + BR, RR2 = RR * RR;
  // player touch wakes sleepers
  for (let i = 0; i < NB; i++) { if (!bsleep[i]) continue; const o = i * 3, dx = bp[o] - pp.x, dz = bp[o + 2] - pp.z; if (dx * dx + dz * dz > RR2) continue; const cyy = clamp(bp[o + 1], pBot, pTop), dy = bp[o + 1] - cyy; if (dx * dx + dy * dy + dz * dz < RR2) wake(i); }
  let awake = 0;
  for (let i = 0; i < NB; i++) {
    if (bsleep[i] || i === held) continue; awake++; const o = i * 3;
    bv[o + 1] -= BG * dt;
    const tk = tunnelOf(bp[o], bp[o + 1], bp[o + 2]);
    if (tk >= 0) {
      const T = TUN[tk], dirn = bOut[i] ? -1 : 1;
      bv[o] += T.ix * 3.2 * dirn * dt; bv[o + 2] += T.iz * 3.2 * dirn * dt;        // something draws it in, then lets it go
      if (!bIn[i]) { bIn[i] = 1; tintBall(i, 0.015); if (!bOut[i]) { if (dread >= 8 && grade.uniforms.uGray.value > 0.97) startTeleport(); dread++; if (dread === 1) { musicDead = true; tapeStop(); grade.uniforms.uGray.value = 0.38; grade.uniforms.uHappy.value = 0; } try { wail(tk); } catch (e) { /* sound is optional */ } } }
      if (!bOut[i] && (bp[o] - T.mx) * T.ix + (bp[o + 2] - T.mz) * T.iz > BALL_D) {
        const B = TUN[1 - tk], u = (bp[o] - T.mx) * -T.iz + (bp[o + 2] - T.mz) * T.ix, sp = Math.max(2.4, Math.hypot(bv[o], bv[o + 2]));
        bp[o] = B.mx + B.ix * BALL_D + B.iz * u; bp[o + 2] = B.mz + B.iz * BALL_D - B.ix * u; bv[o] = -B.ix * sp; bv[o + 2] = -B.iz * sp; bOut[i] = 1;
      }
    } else if (bIn[i]) { bIn[i] = 0; bOut[i] = 0; tintBall(i, 1); }
    if (bp[o + 1] - BR < WATER_Y && inBasin(bp[o], bp[o + 2])) {
      const sub = Math.min(1, (WATER_Y - (bp[o + 1] - BR)) / BD); bv[o + 1] += BG * 1.9 * sub * dt;
      const f = 1 - Math.min(1, 3.2 * sub * dt); bv[o] *= f; bv[o + 1] *= f; bv[o + 2] *= f;
    }
    bspd[i] = Math.hypot(bv[o], bv[o + 1], bv[o + 2]);
    bq[o] = bp[o]; bq[o + 1] = bp[o + 1]; bq[o + 2] = bp[o + 2];
    bp[o] += bv[o] * dt; bp[o + 1] += bv[o + 1] * dt; bp[o + 2] += bv[o + 2] * dt;
    bb[o] = bb[o + 1] = bb[o + 2] = 0; bhit[i] = 0;
  }
  ballsAwake = awake;
  if (awake === 0) return;
  hHead.fill(-1);
  for (let i = 0; i < NB; i++) { const o = i * 3, h = hsh(Math.floor(bp[o] * CELL), Math.floor(bp[o + 1] * CELL), Math.floor(bp[o + 2] * CELL)); hNext[i] = hHead[h]; hHead[h] = i; }
  for (let it = 0; it < 2; it++) for (let i = 0; i < NB; i++) {
    if (bsleep[i] || i === held) continue; const o = i * 3;
    const cx = Math.floor(bp[o] * CELL), cyy = Math.floor(bp[o + 1] * CELL), cz = Math.floor(bp[o + 2] * CELL);
    for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) for (let az = -1; az <= 1; az++) {
      let j = hHead[hsh(cx + ax, cyy + ay, cz + az)];
      while (j >= 0) {
        if (j !== i) {
          let stat = bsleep[j] === 1 || j === held;
          if ((stat || j > i) && !(thrownT > 0 && (i === thrown || j === thrown))) {
            const q = j * 3, dx = bp[q] - bp[o], dy = bp[q + 1] - bp[o + 1], dz = bp[q + 2] - bp[o + 2], d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < BD2 * 1.12 && d2 > 1e-10) {
              const d = Math.sqrt(d2), ov = BD - d;
              if (stat && j !== held && (bspd[i] > 0.45 || ov > 0.012)) { wake(j); stat = false; }
              if (ov > 0) {
                const nx = dx / d, ny = dy / d, nz = dz / d;
                if (stat) { bp[o] -= nx * ov; bp[o + 1] -= ny * ov; bp[o + 2] -= nz * ov; }
                else { const hlf = ov * 0.5; bp[o] -= nx * hlf; bp[o + 1] -= ny * hlf; bp[o + 2] -= nz * hlf; bp[q] += nx * hlf; bp[q + 1] += ny * hlf; bp[q + 2] += nz * hlf; }
              }
            }
          }
        }
        j = hNext[j];
      }
    }
  }
  for (let i = 0; i < NB; i++) {
    if (bsleep[i] || i === held) continue; const o = i * 3;
    // world
    _sph.center.set(bp[o], bp[o + 1], bp[o + 2]); _sph.radius = BR; _sphHit = false; bvh.shapecast(sphCast);
    if (_sphHit) {
      let nx = _sph.center.x - bp[o], ny = _sph.center.y - bp[o + 1], nz = _sph.center.z - bp[o + 2]; const l = Math.hypot(nx, ny, nz);
      if (l > 1e-7) { nx /= l; ny /= l; nz /= l; const vn = bv[o] * nx + bv[o + 1] * ny + bv[o + 2] * nz; if (vn < -1.3) { const e = -vn * 0.55; bb[o] = nx * e; bb[o + 1] = ny * e; bb[o + 2] = nz * e; } }
      bp[o] = _sph.center.x; bp[o + 1] = _sph.center.y; bp[o + 2] = _sph.center.z; bhit[i] = 1;
    }
    // player capsule
    let touched = false, pux = 0, puy = 0, puz = 0;
    const dx = bp[o] - pp.x, dz = bp[o + 2] - pp.z;
    if (dx * dx + dz * dz < RR2) {
      const cyy = clamp(bp[o + 1], pBot, pTop), dy = bp[o + 1] - cyy, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < RR2 && d2 > 1e-8) {
        const d = Math.sqrt(d2), push = Math.min(RR - d, 0.04); pux = dx / d; puy = dy / d * 0.5; puz = dz / d; touched = true;
        bp[o] += pux * push; bp[o + 1] += puy * push; bp[o + 2] += puz * push; bq[o] += pux * push; bq[o + 1] += puy * push; bq[o + 2] += puz * push;
      }
    }
    // velocity from displacement
    let vx = (bp[o] - bq[o]) / dt, vy = (bp[o + 1] - bq[o + 1]) / dt, vz = (bp[o + 2] - bq[o + 2]) / dt;
    { const m = Math.hypot(vx, vy, vz), lim = bspd[i] + 0.9; if (m > lim) { const s = lim / m; vx *= s; vy *= s; vz *= s; } }
    vx += bb[o]; vy += bb[o + 1]; vz += bb[o + 2];
    if (touched) { const vn = vx * pux + vy * puy + vz * puz, want = 0.5 + Math.max(0, player.vel.x * pux + player.vel.z * puz) * 1.1; if (vn < want) { vx += pux * (want - vn); vy += puy * (want - vn); vz += puz * (want - vn); } }
    if (bhit[i]) { const f = 1 - Math.min(1, 1.6 * dt); vx *= f; vz *= f; }
    const sp2 = vx * vx + vy * vy + vz * vz;
    if (sp2 > 400) { const s = 20 / Math.sqrt(sp2); vx *= s; vy *= s; vz *= s; }
    if (sp2 > ballMaxV2) ballMaxV2 = sp2;
    bv[o] = vx; bv[o + 1] = vy; bv[o + 2] = vz;
    if (sp2 < 0.006) { if (++bcalm[i] > 36) { bsleep[i] = 1; bv[o] = bv[o + 1] = bv[o + 2] = 0; } } else bcalm[i] = 0;
    if (bp[o + 1] < -8) { bp[o] = 0.4 + (rand() - 0.5); bp[o + 1] = 1.2; bp[o + 2] = 2 + (rand() - 0.5); bv[o] = bv[o + 1] = bv[o + 2] = 0; }
  }
}
function syncBalls() { const a = ballMesh.instanceMatrix.array; for (let i = 0; i < NB; i++) { a[i * 16 + 12] = bp[i * 3]; a[i * 16 + 13] = bp[i * 3 + 1]; a[i * 16 + 14] = bp[i * 3 + 2]; } ballMesh.instanceMatrix.needsUpdate = true; }
const _cd = new V3();
function pickBall() {
  camera.getWorldDirection(_cd); const c = camera.position; let best = -1, bt = 1.6;
  for (let i = 0; i < NB; i++) { const o = i * 3, ox = bp[o] - c.x, oy = bp[o + 1] - c.y, oz = bp[o + 2] - c.z, t = ox * _cd.x + oy * _cd.y + oz * _cd.z; if (t < 0.06 || t > bt) continue; const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 < BR * BR * 3.2) { bt = t; best = i; } }
  return best;
}
function throwBall() {
  camera.getWorldDirection(_cd); const o = held * 3, c = camera.position;
  bp[o] = c.x + _cd.x * 0.05; bp[o + 1] = c.y + _cd.y * 0.05; bp[o + 2] = c.z + _cd.z * 0.05;   // release from the body line: never starts inside a wall or the pit rim
  bv[o] = _cd.x * THROW + player.vel.x * 0.5; bv[o + 1] = _cd.y * THROW + 2.0; bv[o + 2] = _cd.z * THROW + player.vel.z * 0.5; ballMaxV2 = 400;
  wake(held); thrown = held; thrownT = 0.3; held = -1;
}
function holdBall(dt) {
  if (held < 0) return; camera.getWorldDirection(_cd); const c = camera.position, o = held * 3;
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const tx = c.x + _cd.x * 0.32 + rx * 0.13, ty = c.y + _cd.y * 0.32 - 0.1, tz = c.z + _cd.z * 0.32 + rz * 0.13, k = heldSnap ? 1 : 1 - Math.exp(-22 * dt); heldSnap = false;
  bp[o] += (tx - bp[o]) * k; bp[o + 1] += (ty - bp[o + 1]) * k; bp[o + 2] += (tz - bp[o + 2]) * k; bv[o] = bv[o + 1] = bv[o + 2] = 0;
}

/* ------------------------------------------------------------------ */
/* the voice in the tunnels (synthesised: low wail + sobbing, far off) */
/* ------------------------------------------------------------------ */
let AC = null, acOut = null, acRev = null, acNoise = null, wailAt = -99, dread = 0;   // dread = balls swallowed so far
const AH = [[620, 5, 1], [1050, 7, 0.5], [2500, 8, 0.06]], OO = [[320, 6, 1], [800, 8, 0.45], [2400, 8, 0.05]], SCR = [[1150, 4, 1], [2300, 5, 0.8], [3300, 6, 0.45]];
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.3; comp.connect(AC.destination);
    acOut = AC.createGain(); acOut.gain.value = 1.0; acOut.connect(comp);
    const len = Math.floor(AC.sampleRate * 5), ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) - lp) * 0.14; d[i] = lp * 1.6; } }
    acRev = AC.createConvolver(); acRev.buffer = ir; acRev.connect(acOut);
    acNoise = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); { const d = acNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  } catch (e) { AC = null; }
}
function voice(dst, t, dur, f0, f1, peak, vowel, rough = 0) {
  const o = AC.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.94, t); o.frequency.linearRampToValueAtTime(f0, t + dur * 0.2); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 4.6 + Math.random() * 1.4 + rough * 3;
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f0 * (0.022 + rough * 0.03), t + dur * 0.5); vib.connect(vg); vg.connect(o.frequency);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.5, dur * 0.25)); g.gain.setValueAtTime(peak, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [f, q, a] of vowel) { const bf = AC.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f; bf.Q.value = q; const ga = AC.createGain(); ga.gain.value = a; o.connect(bf); bf.connect(ga); ga.connect(g); }
  if (rough > 0) {   // guttural rattle: fast amplitude tearing
    const am = AC.createGain(); am.gain.value = 1 - rough * 0.5; const l = AC.createOscillator(); l.type = 'sawtooth'; l.frequency.value = 24 + Math.random() * 20;
    const lg = AC.createGain(); lg.gain.value = rough * 0.5; l.connect(lg); lg.connect(am.gain); g.connect(am); am.connect(dst); l.start(t); l.stop(t + dur + 0.05);
  } else g.connect(dst);
  o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
function breath(dst, t, dur, freq, peak) {
  const src = AC.createBufferSource(); src.buffer = acNoise; src.loop = true; const bf = AC.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = freq; bf.Q.value = 1.4;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bf); bf.connect(g); g.connect(dst); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
// k = 0 for the second ball, 1 from the eighth on: lower, longer, nearer, more of them, then the screaming starts
function wail(tk) {
  if (!AC || AC.state !== 'running' || dread < 2) return;   // the first ball only kills the music
  const k = clamp((dread - 2) / 6, 0, 1);
  if (AC.currentTime < wailAt + 8 - 5 * k) return; wailAt = AC.currentTime;
  const T = TUN[tk], c = camera.position, dx = T.mx - c.x, dz = T.mz - c.z, dist = Math.hypot(dx, dz) || 1;
  const pan0 = clamp((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / dist, -1, 1) * 0.7;
  const vol = clamp(1.7 / (1 + dist * 0.14), 0.3, 1) * (1 - k) + 1.25 * k;
  const mkBus = (pan, gain) => {
    const bus = AC.createGain(); bus.gain.value = gain; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 780 + 2200 * k * k; lp.Q.value = 0.3; bus.connect(lp);
    let tail = lp; if (AC.createStereoPanner) { const pn = AC.createStereoPanner(); pn.pan.value = pan; lp.connect(pn); tail = pn; }
    tail.connect(acRev); const dry = AC.createGain(); dry.gain.value = 0.18 + 0.4 * k; tail.connect(dry); dry.connect(acOut); return bus;
  };
  const bus = mkBus(pan0, vol), t = AC.currentTime + 0.3, r = () => 0.94 + Math.random() * 0.12, rnd = Math.random;
  const pm = 1 - 0.24 * k, dm = 1 + 0.4 * k, rg = k > 0.2 ? k * 0.85 : 0;
  voice(bus, t, 3.2 * dm, 172 * r() * pm, 98 * pm, 0.5, AH, rg); voice(bus, t + 0.25, 3.4 * dm, 116 * r() * pm, 70 * pm, 0.4, OO, rg);          // long falling wail
  let ts = t + 3.3 * dm, f = 150 * r() * pm;
  for (let i = 0; i < 6; i++) { voice(bus, ts, 0.26, f * 1.15, f * 0.82, 0.42, OO, rg * 0.6); ts += 0.27 + rnd() * 0.12; f *= 0.95; }                // sobs
  voice(bus, ts + 0.2, 3.8 * dm, 150 * r() * pm, 82 * pm, 0.5, AH, rg); voice(bus, ts + 0.5, 3.6 * dm, 99 * r() * pm, 62 * pm, 0.36, OO, rg);
  ts += 4.2 * dm; f = 128 * r() * pm;
  for (let i = 0; i < 4; i++) { voice(bus, ts, 0.34, f * 1.1, f * 0.8, 0.3 - i * 0.05, OO, rg * 0.6); ts += 0.4 + rnd() * 0.15; f *= 0.93; }
  const total = ts - t + 1;
  // more of them, out of tune with each other, all around you
  const extra = Math.round(k * 5), ratios = [1.06, 0.943, 1.414, 0.707, 1.335];
  for (let i = 0; i < extra; i++) { const b2 = mkBus((rnd() * 2 - 1) * 0.9, vol * 0.8), st = t + 0.4 + rnd() * total * 0.6; voice(b2, st, (2.6 + rnd() * 2.2) * dm, 160 * ratios[i] * r() * pm, 85 * ratios[i] * pm, 0.34, i % 2 ? OO : AH, rg); }
  if (k > 0.25) {   // something very large underneath
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(46, t); o.frequency.linearRampToValueAtTime(34, t + total);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * k, t + total * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + total + 2);
    o.connect(g); g.connect(acOut); o.start(t); o.stop(t + total + 2.1);
  }
  if (k > 0.4) { const n = 3 + Math.round(k * 6), b3 = mkBus(-pan0, vol * 0.7); for (let i = 0; i < n; i++) breath(b3, t + rnd() * total, 0.5 + rnd() * 0.8, 800 + rnd() * 1500, 0.1 + 0.14 * k); }   // wet breathing, on the wrong side
  if (k > 0.55) {   // the screaming
    const b4 = mkBus((rnd() * 2 - 1) * 0.8, vol), st = t + 2.0 * dm + rnd();
    voice(b4, st, 1.7 + k, 760 * r(), 290, 0.16 + 0.24 * k, SCR, 0.8); breath(b4, st, 1.6 + k, 2700, 0.07 + 0.1 * k);
  }
  if (k > 0.85) {
    const b5 = mkBus((rnd() * 2 - 1) * 0.8, vol), st = t + total * 0.62;
    voice(b5, st, 2.9, 900 * r(), 240, 0.42, SCR, 0.9); breath(b5, st, 2.8, 3000, 0.16);
    voice(bus, t + total * 0.35, 4.2, 84, 46, 0.6, AH, 1); voice(bus, t + total * 0.36, 4.2, 59, 33, 0.45, OO, 1);   // and one that is not crying at all
  }
}

/* ------------------------------------------------------------------ */
/* music: plays from the first click until the first ball is swallowed */
/* ------------------------------------------------------------------ */
// Default is an original ambient piece: slow pad chords, a low hum, a far-off bell now and then, and air like the hush of a big tiled room.
// It was made with the code below and rendered once to audio/pool_ambient_loop.ogg (76.8 s, eight chords, cut to loop without a seam),
// which plays on a loop; if that file cannot be loaded, the same piece is played live from the code. Drop an audio file on the page (or press M to pick one)
// and that file is used instead; it is kept in this browser only (IndexedDB), never uploaded.
let music = null, userTrack = null, musicDead = false;
const AMB = [[48, 55, 64, 71], [45, 52, 60, 67, 74], [41, 48, 57, 64], [43, 50, 59, 62, 69]], BELLS = [72, 74, 76, 79, 83, 86, 88];   // Cmaj7, Am9, Fmaj7, G6/9; the bells' notes
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function pluck(m, t, f, peak, dec, type, h, hg) {
  const o = AC.createOscillator(); o.type = type; o.frequency.value = f; const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  o.connect(g); if (h) { const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * h; const g2 = AC.createGain(); g2.gain.value = hg; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dec + 0.05); }
  g.connect(m.bus); o.start(t); o.stop(t + dec + 0.05);
}
// one pad voice: two slightly detuned triangles that swell in slowly and fade out long after the next chord has come in
function padNote(m, t, f, dur, peak) {
  for (const det of [-5, 5]) {
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det + (Math.random() - 0.5) * 4; const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.35); g.gain.linearRampToValueAtTime(peak * 0.75, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(m.bus); o.start(t); o.stop(t + dur + 0.1);
  }
}
function musicSchedule(until) {
  const m = music; if (!m || m.el || !m.bus) return; const BAR = 9.6;
  while (m.next < until) {
    const ch = AMB[m.idx % AMB.length], t = m.next;
    ch.forEach((n, i) => padNote(m, t + i * 0.4, mtof(n), BAR * 1.5, i ? 0.016 : 0.024));                                            // the chord, rolled very slowly
    { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(ch[0] - 12); const g = AC.createGain();               // a low hum under it
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 3.5); g.gain.linearRampToValueAtTime(0.0001, t + BAR * 1.3); o.connect(g); g.connect(m.bus); o.start(t); o.stop(t + BAR * 1.3 + 0.1); }
    const nb = 1 + ((Math.random() * 3) | 0);                                                                                       // one to three far-off bells, wandering
    for (let i = 0; i < nb; i++) { m.mel = clamp(m.mel + ((Math.random() * 5) | 0) - 2, 0, BELLS.length - 1); pluck(m, t + 1 + Math.random() * (BAR - 2), mtof(BELLS[m.mel]), 0.04, 5, 'sine', 2.76, 0.22); }
    m.next += BAR; m.idx++;
  }
}
// the air of the room: filtered noise, breathing slowly, under everything for as long as the music plays
function musicAir(m) {
  const src = AC.createBufferSource(); src.buffer = acNoise; src.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.linearRampToValueAtTime(0.05, AC.currentTime + 6);
  const l = AC.createOscillator(); l.frequency.value = 0.07; const lg = AC.createGain(); lg.gain.value = 220; l.connect(lg); lg.connect(bp.frequency);
  src.connect(bp); bp.connect(g); g.connect(m.bus); src.start(); l.start(); m.air = [src, l];
}
// Music drifts in and out like it is coming from another room: slow, irregular swells in level and brightness.
function musicChain(level, faint) {
  const t0 = AC.currentTime, bus = AC.createGain(); bus.gain.setValueAtTime(0.0001, t0); bus.gain.exponentialRampToValueAtTime(level, t0 + 3);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.4;
  const swell = AC.createGain(); swell.gain.value = 0.55;
  const mk = (f, amt, target) => { const o = AC.createOscillator(); o.frequency.value = f; const g = AC.createGain(); g.gain.value = amt; o.connect(g); g.connect(target); o.start(); return o; };
  // faint: the swells go deeper and slower, so it comes and goes rather than sitting there
  const lfos = faint ? [mk(0.019, 0.32, swell.gain), mk(0.053, 0.18, swell.gain), mk(0.037, 700, lp.frequency), mk(0.09, 300, lp.frequency)]
    : [mk(0.031, 0.3, swell.gain), mk(0.083, 0.15, swell.gain), mk(0.047, 900, lp.frequency), mk(0.11, 350, lp.frequency)];
  const rev = AC.createConvolver(); rev.buffer = acRev.buffer; const wet = AC.createGain(); wet.gain.value = 0.55; const dry = AC.createGain(); dry.gain.value = 0.7;
  const out = AC.createGain(); out.gain.value = 1;
  bus.connect(lp); lp.connect(swell); swell.connect(dry); swell.connect(wet); wet.connect(rev); rev.connect(out); dry.connect(out); out.connect(AC.destination);
  return { bus, out, lfos };
}
const AMB_FILE = 'audio/pool_ambient_loop.ogg';
let ambBuf = null, ambLoading = null;   // null: not loaded yet; false: could not be loaded
function loadAmb() {
  if (!ambLoading && ambBuf === null && AC) ambLoading = fetch(AMB_FILE).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then((a) => AC.decodeAudioData(a)).then((b) => { ambBuf = b; }).catch(() => { ambBuf = false; });
  return ambLoading;
}
function startMusic() {
  if (musicDead || music) return;
  const live = AC && AC.state === 'running' && acRev;
  if (userTrack) {
    const el = new Audio(URL.createObjectURL(userTrack)); el.loop = true; const me = { el }; music = me;
    if (live) { try { const ch = musicChain(0.5); AC.createMediaElementSource(el).connect(ch.bus); Object.assign(me, ch); } catch (e) { el.volume = 0.3; } } else el.volume = 0.3;
    el.play().catch(() => { if (music === me) music = null; }); return;
  }
  if (!live) return;
  if (ambBuf) {   // the rendered loop, sample-accurate and seamless
    // quiet: there one moment, almost gone the next
    const ch = musicChain(0.2, true), src = AC.createBufferSource(); src.buffer = ambBuf; src.loop = true; src.connect(ch.bus); src.start();
    music = Object.assign(ch, { src, timer: 0 }); return;
  }
  if (ambBuf === null) { const p = loadAmb(); if (p) p.then(() => { if (!music && !musicDead) startMusic(); }); return; }   // still on its way: start when it arrives
  music = Object.assign(musicChain(0.45, true), { next: AC.currentTime + 0.2, idx: 0, mel: 3, timer: 0 }); musicAir(music); musicSchedule(AC.currentTime + 6);
  music.timer = setInterval(() => { if (AC) musicSchedule(AC.currentTime + 6); }, 1000);
}
function haltMusic() {   // dead stop: no fade, no reverb tail
  if (!music) return; const m = music; music = null;
  if (m.el) { try { m.el.pause(); } catch (e) {} }
  clearInterval(m.timer);
  if (m.air) for (const o of m.air) try { o.stop(); } catch (e) {}
  if (m.src) try { m.src.stop(); } catch (e) {}
  if (m.out) { try { m.out.gain.value = 0; m.out.disconnect(); } catch (e) {} for (const o of m.lfos) try { o.stop(); } catch (e) {} }
}
// first ball: the tape jams — the music drags down and dies with a mechanical clunk
function tapeStop() {
  const m = music;
  if (m && m.el) {   // a real track: actually slow the tape down
    try { m.el.preservesPitch = false; m.el.mozPreservesPitch = false; m.el.webkitPreservesPitch = false; } catch (e) {}
    const t0 = performance.now(), step = () => { const k = (performance.now() - t0) / 450; if (k >= 1 || music !== m) { haltMusic(); return; } try { m.el.playbackRate = Math.max(0.07, 1 - k * 0.95); } catch (e) {} requestAnimationFrame(step); };
    step();
  } else if (m && m.src && AC) {   // the rendered loop: the same drag down, on the buffer's playback rate
    const t = AC.currentTime; m.src.playbackRate.setValueAtTime(1, t); m.src.playbackRate.linearRampToValueAtTime(0.07, t + 0.45);
    setTimeout(() => { if (music === m) haltMusic(); }, 460);
  } else haltMusic();
  if (!AC || AC.state !== 'running') return;
  const t = AC.currentTime, out = AC.createGain(); out.gain.value = 0.9; out.connect(AC.destination);
  if (!(m && (m.el || m.src))) for (const f of [261.63, 329.63, 392.0, 130.81]) {   // the tune itself winding down
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(150, t + 0.5);
    const g = AC.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.52); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.55);
  }
  const burst = (at, dur, freq, q, peak) => {   // clicks, clunks and the scrape of the tape
    const src = AC.createBufferSource(); src.buffer = acNoise; const bf = AC.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = freq; bf.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); src.connect(bf); bf.connect(g); g.connect(out); src.start(at, Math.random()); src.stop(at + dur + 0.02);
  };
  burst(t + 0.05, 0.42, 1800, 0.8, 0.12);          // tape drag
  burst(t + 0.52, 0.035, 2600, 2, 0.9);            // click
  burst(t + 0.55, 0.09, 420, 1.5, 0.8);            // clunk
  const th = AC.createOscillator(); th.frequency.setValueAtTime(110, t + 0.55); th.frequency.exponentialRampToValueAtTime(40, t + 0.7);
  const tg = AC.createGain(); tg.gain.setValueAtTime(0.6, t + 0.55); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75); th.connect(tg); tg.connect(out); th.start(t + 0.55); th.stop(t + 0.8);
  burst(t + 0.7, 0.025, 3200, 3, 0.35);            // a last small click as the mechanism settles
}
function setUserTrack(file, save) {
  if (!file) return; userTrack = file;
  if (save) kv('readwrite', (st) => st.put(file, 'music')).catch(() => {});
  if (!musicDead) { haltMusic(); startMusic(); }
}
function kv(mode, fn) {
  return new Promise((res, rej) => {
    try {
      const rq = indexedDB.open('playroom', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onerror = () => rej(rq.error);
      rq.onsuccess = () => { try { const tx = rq.result.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } };
    } catch (e) { rej(e); }
  });
}
kv('readonly', (st) => st.get('music')).then((b) => { if (b && !userTrack) setUserTrack(b, false); }).catch(() => {});
const isAudio = (f) => f && ((f.type || '').startsWith('audio') || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(f.name || ''));
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (isAudio(f)) { initAudio(); setUserTrack(f, true); } });
const musicPick = document.getElementById('mf');
musicPick.addEventListener('change', () => { const f = musicPick.files && musicPick.files[0]; if (isAudio(f)) setUserTrack(f, true); musicPick.value = ''; });

/* ------------------------------------------------------------------ */
/* from the third ball on: the hum; once fully grey: the way out        */
/* ------------------------------------------------------------------ */
let hum = null, leaving = 0;
function startHum() {
  if (hum || !AC || AC.state !== 'running') return;
  const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let b = 0;
  for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }   // brown noise
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 0.7;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.35, AC.currentTime + 6);
  const o = AC.createOscillator(); o.frequency.value = 49; const og = AC.createGain(); og.gain.value = 0.18;
  const w = AC.createOscillator(); w.frequency.value = 0.07; const wg = AC.createGain(); wg.gain.value = 0.12; w.connect(wg); wg.connect(g.gain);
  src.connect(lp); lp.connect(g); o.connect(og); og.connect(g); g.connect(acOut);
  src.start(); o.start(); w.start(); hum = { g, nodes: [src, o, w] };
}
function startTeleport() {
  if (leaving) return; leaving = performance.now();
  if (hum) { try { hum.g.gain.value = 0; } catch (e) {} }
  startCollapse();   // the playroom caves in on you in black and white blocks; the collapse section below sends you on to level1.html
}
function updateDread(dt, now) {
  const wild = dread >= 3 && !leaving;
  if (wild) {
    startHum();
    for (const L of lamps) {
      if (now >= L.next) { L.f = Math.random() < 0.35 ? 0.03 + Math.random() * 0.1 : 0.55 + Math.random() * 0.5; L.next = now + 25 + Math.random() * 110; }
      L.ra.intensity = L.b[0] * L.f; L.sp.intensity = L.b[1] * L.f; L.bounce.intensity = L.b[2] * L.f; L.p.material.color.copy(L.c).multiplyScalar(L.f);
    }
    if (hum) hum.g.gain.value = Math.max(hum.g.gain.value, 0.0001);
  }
  const target = wild ? 0.45 + 0.55 * grade.uniforms.uGray.value : 0;
  grade.uniforms.uNoise.value += (target - grade.uniforms.uNoise.value) * Math.min(1, dt * 1.5);
}

/* ------------------------------------------------------------------ */
/* the collapse: once the ninth ball is gone the playroom shows what   */
/* it was built of — black and white blocks — and comes down on you    */
/* ------------------------------------------------------------------ */
const CS = 0.6, CB = 0.58;                                   // grid cell, block edge
const CNX = Math.round(2 * RX / CS), CNZ = Math.round((Z2 - Z0) / CS);
const T_SWAP = 0.45, T_HIT = 4.1, T_FINAL = 6.0;            // seconds after the collapse starts
let CL = null;                                               // collapse state, null until it starts
const _cq = new THREE.Quaternion(), _cq2 = new THREE.Quaternion(), _cs = new V3(), _cm = new THREE.Matrix4(), _cax = new V3(), _cRay = new THREE.Ray(), _cDown = new V3(0, -1, 0);
function groundBelow(x, y, z) { _cRay.origin.set(x, y, z); _cRay.direction.copy(_cDown); const h = bvh.raycastFirst(_cRay, THREE.DoubleSide); return h ? h.point.y : -3; }
const cellOf = (x, z) => { const i = Math.floor((x + RX) / CS), j = Math.floor((z - Z0) / CS); return i < 0 || j < 0 || i >= CNX || j >= CNZ ? -1 : j * CNX + i; };
function startCollapse() {
  const cam = camera.position.clone();
  player.frozen = true; held = -1; if (bookOpen) setBook(false); epEl.style.display = 'none';
  const feet = player.mode === 'walk' && !player.swim ? player.pos.y : groundBelow(cam.x, cam.y + 0.05, cam.z);
  const pc = cellOf(cam.x, cam.z);
  const B = [];   // blocks: {p, v, q, w, kind, state, delay, white, col}
  const inCam = (x, y, z) => Math.abs(x - cam.x) < CB / 2 + 0.12 && Math.abs(y - cam.y) < CB / 2 + 0.12 && Math.abs(z - cam.z) < CB / 2 + 0.12;
  const delayFor = (x, z, extra) => { const d = Math.hypot(x - cam.x, z - cam.z); return 1.0 + 2.5 * Math.pow(1 - clamp(d / 22, 0, 1), 1.6) + rand() * 0.75 + extra; };
  // ceiling: one block per column, falling straight down its own column
  for (let j = 0; j < CNZ; j++) for (let i = 0; i < CNX; i++) {
    const x = -RX + (i + 0.5) * CS, z = Z0 + (j + 0.5) * CS, y = H - CB / 2 - 0.01, c = j * CNX + i;
    if (c === pc || inCam(x, y, z)) continue;   // the one over your head is the hit block below
    const d = Math.hypot(x - cam.x, z - cam.z);
    let delay = delayFor(x, z, 0);
    if (d < 1.45) delay = T_HIT + 0.25 + rand() * 1.1;           // the ring around you comes down after you have been hit
    else if (d < 3) delay = Math.min(delay, 2.9 + rand() * 0.9);
    B.push({ p: new V3(x, y, z), v: new V3(), q: new THREE.Quaternion(), w: new V3(), kind: 0, state: 0, delay, white: (i + j) % 2 === 0, col: c, near: d < 1.8 });
  }
  // walls: rows of blocks that tip inwards, top rows first
  const rows = Math.round(H / CS);
  const wallRun = (x0, z0, x1, z1, nx, nz, skip) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / CS);
    for (let k = 0; k < n; k++) for (let r = 0; r < rows; r++) {
      const u = (k + 0.5) / n, x = x0 + (x1 - x0) * u + nx * CB / 2, z = z0 + (z1 - z0) * u + nz * CB / 2, y = (r + 0.5) * CS;
      if ((skip && skip(x, y, z)) || inCam(x, y, z)) continue;
      B.push({ p: new V3(x, y, z), v: new V3(), q: new THREE.Quaternion(), w: new V3(), kind: 1, state: 0, delay: delayFor(x, z, -0.12 * r + 0.25), white: (k + r) % 2 === 1, nx, nz });
    }
  };
  wallRun(-RX, Z0, RX, Z0, 0, 1, (x, y) => Math.abs(x - HOLE1.x) < HOLE1.hw + 0.2 && y > HOLE1.y0 - 0.25 && y < HOLE1.y1 + 0.25);
  wallRun(RX, Z2, -RX, Z2, 0, -1);
  wallRun(-RX, Z0, -RX, Z2, 1, 0);
  wallRun(RX, Z0, RX, Z2, -1, 0, (x, y, z) => Math.abs(z - HOLE2.z) < HOLE2.hw + 0.2 && y > HOLE2.y0 - 0.25 && y < HOLE2.y1 + 0.25);
  // the block that hits you, and the one that buries you
  const cx = pc >= 0 ? -RX + ((pc % CNX) + 0.5) * CS : cam.x, cz = pc >= 0 ? Z0 + (Math.floor(pc / CNX) + 0.5) * CS : cam.z;
  const hitY = pc >= 0 ? H - CB / 2 - 0.01 : Math.min(H - CB / 2 - 0.01, cam.y + 2.4), dropH = Math.max(0.1, hitY - CB / 2 - (cam.y + 0.05));
  const hit = { p: new V3(pc >= 0 ? cx : cam.x, hitY, pc >= 0 ? cz : cam.z), v: new V3(), q: new THREE.Quaternion(), w: new V3(), kind: 2, state: 0, delay: T_HIT - Math.sqrt(2 * dropH / G) - 0.18, white: true, col: -1 };
  const fin = { p: new V3(cx, Math.max(H + 0.9, cam.y + 3), cz), v: new V3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.6, -0.04)), w: new V3(), kind: 3, state: 0, delay: T_FINAL, white: true, col: -1, hidden: true };
  B.push(hit, fin);
  // the ground each column lands on (slides, the pit and the pool floor included)
  const colH = new Float32Array(CNX * CNZ);
  for (let j = 0; j < CNZ; j++) for (let i = 0; i < CNX; i++) colH[j * CNX + i] = groundBelow(-RX + (i + 0.5) * CS, H - CB - 0.05, Z0 + (j + 0.5) * CS);
  for (let i = 0; i < NB; i++) { const c = cellOf(bp[i * 3], bp[i * 3 + 2]); if (c >= 0 && bp[i * 3 + 1] > -1) colH[c] = Math.max(colH[c], bp[i * 3 + 1] + BR * 0.6); }   // blocks settle on top of the ball pit
  if (pc >= 0) colH[pc] = feet;
  const geo = new RoundedBoxGeometry(CB, CB, CB, 2, 0.025);
  const mat = std({ color: 0xffffff, roughness: 0.38, metalness: 0.02 });
  const mesh = new THREE.InstancedMesh(geo, mat, B.length); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const cw = new THREE.Color(0xeef1ee), ck = new THREE.Color(0x0d0f0e);
  B.forEach((b, i) => { mesh.setColorAt(i, b.white ? cw : ck); });
  mesh.instanceColor.needsUpdate = true; mesh.visible = false; scene.add(mesh);
  // sound: a rumble that builds, a bus everything goes through so it can be muffled once you are under
  let bus = null, rumble = null;
  if (AC && AC.state === 'running') {
    try {
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.5; const bg = AC.createGain(); bg.gain.value = 1; lp.connect(bg); bg.connect(acOut); bus = { lp, g: bg };
      const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let br = 0;
      for (let i = 0; i < len; i++) { br = (br + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = br * 3.5; }
      const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      const g = AC.createGain(); const t = AC.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1.2); g.gain.linearRampToValueAtTime(1.1, t + T_HIT);
      const o = AC.createOscillator(); o.frequency.value = 31; const og = AC.createGain(); og.gain.value = 0.35;
      src.connect(f); f.connect(g); o.connect(og); og.connect(g); g.connect(lp); src.start(); o.start(); rumble = { g, nodes: [src, o] };
    } catch (e) { bus = null; }
  }
  CL = { t: 0, B, mesh, colH, pc, cam0: cam, feet, cx, cz, hit, fin, swapped: false, shake: 0.02, kick: 0, hitAt: -1, buriedAt: -1, flash: 0, bus, rumble, thudAt: 0, look: null, done: false };
  setBlocks(true);
}
function setBlocks(all) {
  const { B, mesh } = CL;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (!all && b.state === 0 && !b.dirty) continue; b.dirty = false;
    if (b.hidden) _cs.setScalar(0); else _cs.setScalar(1);
    _cm.compose(b.p, b.q, _cs); mesh.setMatrixAt(i, _cm);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
function thud(x, y, z, big) {
  if (!CL.bus || !acNoise) return; const t = AC.currentTime; if (!big && t < CL.thudAt + 0.035) return; CL.thudAt = t;
  const c = camera.position, d = Math.hypot(x - c.x, y - c.y, z - c.z), vol = (big ? 1.4 : 0.9) / (1 + d * 0.35);
  if (vol < 0.04) return;
  try {
    const src = AC.createBufferSource(); src.buffer = acNoise; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 900 : 380 + Math.random() * 500;
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.6 : 0.22));
    const o = AC.createOscillator(); o.frequency.setValueAtTime(big ? 95 : 70 + Math.random() * 50, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.25);
    const og = AC.createGain(); og.gain.setValueAtTime(vol * 0.9, t); og.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.7 : 0.3));
    src.connect(f); f.connect(g); g.connect(CL.bus.lp); o.connect(og); og.connect(CL.bus.lp);
    src.start(t, Math.random()); src.stop(t + 0.8); o.start(t); o.stop(t + 0.8);
  } catch (e) { /* sound is optional */ }
}
function crack() {
  if (!CL.bus || !acNoise) return; const t = AC.currentTime;
  try {
    const src = AC.createBufferSource(); src.buffer = acNoise; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
    const g = AC.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); src.connect(f); f.connect(g); g.connect(CL.bus.lp); src.start(t); src.stop(t + 0.6);
    if (acRev) { const r = AC.createGain(); r.gain.value = 0.5; g.connect(r); r.connect(acRev); }
  } catch (e) {}
  thud(camera.position.x, H, camera.position.z, true);
}
function updateCollapse(dt, now) {
  const C = CL; C.t += dt; const t = C.t, cam = camera.position;
  // lights: stutter, black out for the swap, then hang on, dimmer and dimmer
  for (const L of lamps) {
    if (now >= L.next) { L.f = Math.random() < 0.3 ? 0.05 + Math.random() * 0.2 : 0.6 + Math.random() * 0.45; L.next = now + 30 + Math.random() * 140; }
    const blackout = t > T_SWAP - 0.12 && t < T_SWAP + 0.1 ? 0 : 1, decay = 1 - 0.45 * sstep(1, T_FINAL, t);
    const f = L.f * blackout * decay; L.ra.intensity = L.b[0] * f; L.sp.intensity = L.b[1] * f; L.bounce.intensity = L.b[2] * f; L.p.material.color.copy(L.c).multiplyScalar(f);
  }
  if (!C.swapped && t >= T_SWAP) {   // the room was blocks all along
    C.swapped = true; C.mesh.visible = true;
    for (const m of ceilMeshes) m.visible = false; for (const g of wallGroups) g.visible = false;
    for (const L of lamps) { L.sp.position.y = H - CB - 0.15; L.ra.position.y = H - CB - 0.08; }   // the light hangs on below the blocks
    C.kick = Math.max(C.kick, 0.05); crack();
  }
  // blocks
  if (C.swapped) {
    const { B, colH } = C;
    for (const b of B) {
      if (b.state === 0) {
        if (t < b.delay - 0.22) continue;
        if (t < b.delay) { b.q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.04)); b.dirty = true; continue; }   // works loose
        b.state = 1; b.dirty = true;
        if (b.kind === 3) b.hidden = false;
        if (b.kind === 1) { const sp = 0.5 + rand() * 1.5; b.v.set(b.nx * sp, rand() * 0.6, b.nz * sp); b.w.set(b.nz * (2 + rand() * 2.5), (rand() - 0.5) * 1.5, -b.nx * (2 + rand() * 2.5)); }
        else if (b.kind === 0) { const k = b.near ? 0.12 : 1; b.w.set((rand() - 0.5) * 2.2 * k, (rand() - 0.5) * 1.6 * k, (rand() - 0.5) * 2.2 * k); }
        else if (b.kind === 2) b.w.set(0.8, 0.3, -0.6);
        else b.w.set(0, 0.25, 0);
      }
      if (b.state === 1) {
        b.dirty = true;
        b.v.y -= G * dt; b.p.addScaledVector(b.v, dt);
        const wl = b.w.length(); if (wl > 1e-4) { _cq.setFromAxisAngle(_cax.copy(b.w).divideScalar(wl), wl * dt); b.q.premultiply(_cq); }
        if (b.kind === 2 && C.hitAt < 0 && b.p.y - CB / 2 < cam.y + 0.04) {   // it hits you
          C.hitAt = t; C.kick = 0.16; C.flash = 1; thud(cam.x, cam.y, cam.z, true);
          const dx = Math.cos(player.yaw), dz = -Math.sin(player.yaw); b.v.set(dx * 2.8, 0.6, dz * 2.8); b.w.set(dz * 4, 1, -dx * 4);
          for (let i = 0; i < NB; i++) { const o = i * 3; if (Math.abs(bp[o] - C.cx) < 0.42 && Math.abs(bp[o + 2] - C.cz) < 0.42 && bp[o + 1] < C.feet + 0.7) { bp[o + 1] = -60; bv[o] = bv[o + 1] = bv[o + 2] = 0; bsleep[i] = 1; } }   // you go down into the balls: clear your spot
          syncBalls();
          C.look = { from: { x: player.pos.x, z: player.pos.z, y: cam.y, pitch: player.pitch, yaw: player.yaw }, t: 0 };
        }
        if (b.kind === 3 && C.buriedAt < 0 && b.p.y - CB / 2 < cam.y + 0.03) {   // and this one buries you
          C.buriedAt = t; C.kick = 0.25; thud(cam.x, cam.y, cam.z, true);
          if (C.bus) { try { C.bus.lp.frequency.setTargetAtTime(220, AC.currentTime, 0.04); C.bus.g.gain.setTargetAtTime(0.7, AC.currentTime, 0.1); } catch (e) {} }
        }
        let c = b.kind === 3 ? C.pc : cellOf(b.p.x, b.p.z);
        if (c === C.pc && b.kind !== 3 && c >= 0) {   // nothing else lands in your spot: it is shoved on into the next one
          c = -2; let ox = b.p.x - C.cx, oz = b.p.z - C.cz; const ol = Math.hypot(ox, oz); if (ol < 1e-3) { ox = 1; oz = 0; } else { ox /= ol; oz /= ol; }
          b.p.x += ox * 3 * dt; b.p.z += oz * 3 * dt;
        }
        const floorY = b.kind === 3 ? C.feet : c >= 0 ? colH[c] : c === -2 ? -99 : groundBelow(b.p.x, b.p.y, b.p.z);
        if (b.p.y - CB / 2 <= floorY) {
          b.p.y = floorY + CB / 2; b.state = 2; b.settle = 0; b.v.set(0, 0, 0); b.w.set(0, 0, 0);
          if (c >= 0) { const ccx = -RX + ((c % CNX) + 0.5) * CS, ccz = Z0 + (Math.floor(c / CNX) + 0.5) * CS; b.p.x += (ccx - b.p.x) * 0.85; b.p.z += (ccz - b.p.z) * 0.85; colH[c] = floorY + CB * 0.98; }
          const e = new THREE.Euler(0, 0, 0, 'YXZ'); _cq2.copy(b.q); e.setFromQuaternion(_cq2); const yq = Math.round(e.y / (Math.PI / 2)) * (Math.PI / 2) + (rand() - 0.5) * 0.08;   // squared up, so nothing leans into the space you are lying in
          b.rest = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.1, yq, (rand() - 0.5) * 0.1, 'YXZ'));
          if (C.buriedAt < 0) { thud(b.p.x, b.p.y, b.p.z, false); const dd = Math.hypot(b.p.x - cam.x, b.p.z - cam.z); C.kick = Math.max(C.kick, 0.05 / (1 + dd * 0.8)); }
        }
      }
      if (b.state === 2) { b.dirty = true; b.settle += dt; b.q.slerp(b.rest, Math.min(1, dt * 14)); if (b.settle > 0.4) { b.q.copy(b.rest); b.state = 3; } }
    }
    setBlocks(false);
  }
  // shake, flash, the end
  C.shake = 0.004 + 0.02 * sstep(0, T_HIT, t) * (C.buriedAt < 0 ? 1 : 0.3);
  C.kick *= Math.exp(-dt * 5); C.flash *= Math.exp(-dt * 4.5);
  grade.uniforms.uNoise.value = Math.min(1, 0.55 + 0.4 * C.flash + 4 * C.kick);
  let fadeV = Math.max(C.flash * 0.85, 0);
  if (C.buriedAt >= 0) fadeV = 1;
  grade.uniforms.uFade.value = fadeV;
  if (C.buriedAt >= 0 && !C.done && t > C.buriedAt + 1.6) { C.done = true; location.href = 'level1.html'; }
  if (C.rumble && C.buriedAt >= 0 && t > C.buriedAt + 0.9) { try { C.rumble.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.25); } catch (e) {} }
}
// knocked flat, looking up at what is still coming down
function collapseCamera(dt) {
  const C = CL, sh = C.shake + C.kick;
  if (C.look) {
    const L = C.look; L.t = Math.min(1, L.t + dt / 0.55); const e = 1 - Math.pow(1 - L.t, 3);
    const x = L.from.x + (C.cx - L.from.x) * e, z = L.from.z + (C.cz - L.from.z) * e, y = L.from.y + (C.feet + 0.12 - L.from.y) * e;
    const pitch = L.from.pitch + (1.12 - L.from.pitch) * e, roll = 0.42 * e;
    camera.position.set(x, y, z); camera.rotation.set(pitch, L.from.yaw + 0.25 * e, roll);
  }
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh; camera.position.z += (Math.random() - 0.5) * sh;
  camera.rotation.z += (Math.random() - 0.5) * sh * 0.6;
  camera.updateMatrixWorld();
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
const locked = () => document.pointerLockElement === canvas;
let dragging = false;
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true; initAudio(); startMusic();
  if (e.code === 'KeyM') musicPick.click();
  if (e.code === 'Escape' && bookOpen) setBook(false);
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyC' && !player.swim && player.mode === 'walk') { cDownAt = performance.now(); if (player.crouch) { player.crouch = false; cToggledOn = false; } else { player.crouch = true; cToggledOn = true; } }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyC' && cToggledOn && player.mode === 'walk' && performance.now() - cDownAt > 380) { player.crouch = false; cToggledOn = false; }
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dragging = false; });
canvas.addEventListener('mousedown', (e) => {
  canvas.focus(); initAudio(); startMusic();
  if (locked()) { if (e.button === 0) interact(); return; }
  dragging = true;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* stay in drag-look */ }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (!locked() && !dragging) return;
  player.yaw -= (e.movementX || 0) * 0.0022; player.pitch = clamp(player.pitch - (e.movementY || 0) * 0.0022, -1.5, 1.5);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* post-processing                                                     */
/* ------------------------------------------------------------------ */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.75, 0.92); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uUnder: { value: 0 }, uFade: { value: 0 }, uDark: { value: 0 }, uGray: { value: 0 }, uHappy: { value: 1 }, uNoise: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uUnder, uFade, uDark, uGray, uHappy, uNoise; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec2 uv = vUv;
    uv += uUnder * 0.0035 * vec2(sin(uv.y * 28.0 + uTime * 2.1), cos(uv.x * 24.0 + uTime * 1.7));
    vec2 c = uv - 0.5; float r2 = dot(c, c);
    vec2 d = c * (0.0006 + r2 * 0.005);
    vec3 col = vec3(texture2D(tDiffuse, uv - d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d).b);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.95);
    col *= vec3(0.91, 1.02, 0.93);                                   // green cast of the reference
    col = col * 0.965 + vec3(0.010, 0.030, 0.019) * (1.0 - uDark);   // lifted, tinted blacks
    col = mix(col, col * vec3(0.55, 0.98, 1.02) + vec3(0.0, 0.025, 0.035), uUnder);
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 + 0.22 * uHappy) * (1.0 + 0.12 * uHappy);   // a brighter, friendlier start
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), uGray);              // colour drains with every ball the tunnels take
    col = mix(col, col * col * (3.0 - 2.0 * col), uGray * 0.35);
    col *= 1.0 - smoothstep(0.08, 0.62, r2) * (0.5 + 0.25 * uGray);
    float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(613.0, 271.0)) - 0.5;
    col += n * (0.05 + 0.13 * uNoise);
    col += (hash(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 24.0)) - 0.5) * 0.06 * uNoise;   // coarse crawling static
    col *= 1.0 - uFade;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`,
});
composer.addPass(grade);
addEventListener('resize', () => {
  const pr = pickPR(); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

/* ------------------------------------------------------------------ */
/* settle balls, capture the room as its own environment map           */
/* ------------------------------------------------------------------ */
for (let i = 0; i < 320 && ballsAwake > 0; i++) ballStep(1 / 120);
syncBalls();
function placeCamera(time) {
  const p = player.pos; let ey = p.y + player.h - EYE;
  if (player.mode !== 'ride' && !player.swim) ey += Math.sin(player.bob * 8) * 0.009 * clamp(Math.hypot(player.vel.x, player.vel.z) / 1.4, 0, 1);
  if (player.swim) ey += Math.sin(time * 1.6) * 0.01;
  camera.position.set(p.x, ey, p.z);
  const roll = player.mode === 'ride' ? Math.sin(player.bob * 2.2) * 0.012 : 0;
  camera.rotation.set(player.pitch, player.yaw, roll);
  camera.updateMatrixWorld();
}
placeCamera(0);
{
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.1, 60, cubeRT); cubeCam.position.set(0.4, 1.6, -0.2); scene.add(cubeCam);
  for (const p of panels) p.visible = false;
  wUni.uCam.value.copy(cubeCam.position);
  renderer.shadowMap.needsUpdate = true;
  cubeCam.update(renderer, scene);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromCubemap(cubeRT.texture).texture; pm.dispose();
  for (const p of panels) p.visible = true;
  scene.remove(cubeCam);
}


/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */

let last = -1, time = 0, frameNo = 0, usbHint = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (last < 0) last = now;
  const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; time += dt; frameNo++;
  if (keys.ArrowLeft) player.yaw += 1.8 * dt; if (keys.ArrowRight) player.yaw -= 1.8 * dt;
  if (keys.ArrowUp) player.pitch = Math.min(1.5, player.pitch + 1.3 * dt); if (keys.ArrowDown) player.pitch = Math.max(-1.5, player.pitch - 1.3 * dt);
  updatePlayer(dt);
  placeCamera(time);
  if (CL) collapseCamera(dt);
  holdBall(dt);
  const moving = ballsAwake > 0 || held >= 0;
  { // fast balls get more sub-steps so they never skip through a wall
    const n = clamp(Math.ceil(Math.sqrt(ballMaxV2) * dt / 0.05), 2, 8); ballMaxV2 = 0;
    for (let i = 0; i < n; i++) ballStep(dt / n);
  }
  if (moving || ballsAwake > 0) syncBalls();
  if (lifebuoy) { lifebuoy.position.y = WATER_Y + 0.03 + Math.sin(time * 1.3) * 0.012; lifebuoy.rotation.y = Math.sin(time * 0.4) * 0.05; lifebuoy.rotation.z = time * 0.05; }
  const cp = camera.position;
  const uw = cp.y < WATER_Y && (inBasin(cp.x, cp.z) || inMaze(cp.x, cp.z)) ? 1 : 0; under += (uw - under) * Math.min(1, dt * 10);
  const inTunnel = cp.y > 1.9 && (cp.z < Z0 - 0.3 || cp.x > RX + 0.3) ? 1 : 0;
  wUni.uTime.value = time; wUni.uCam.value.copy(cp);
  grade.uniforms.uTime.value = time; grade.uniforms.uUnder.value = under; grade.uniforms.uFade.value = leaving ? grade.uniforms.uFade.value : fade;
  if (!bookSeen) {
    bookArrow.position.y = 0.4 + Math.abs(Math.sin(time * 3.6)) * 0.07; bookArrow.rotation.y = time * 1.2;   // hop, hop
    if (bookAim()) { _bp.copy(BOOK).project(camera); epEl.style.display = 'block'; epEl.style.left = ((_bp.x * 0.5 + 0.5) * innerWidth) + 'px'; epEl.style.top = ((-_bp.y * 0.5 + 0.5) * innerHeight) + 'px'; }
    else epEl.style.display = 'none';
  }
  if (usbNear()) { _bp.set(usb.x, usb.y + 0.03, usb.z).project(camera); epEl.style.display = 'block'; epEl.style.left = ((_bp.x * 0.5 + 0.5) * innerWidth) + 'px'; epEl.style.top = ((-_bp.y * 0.5 + 0.5) * innerHeight) + 'px'; usbHint = true; }
  else if (usbHint) { usbHint = false; epEl.style.display = 'none'; }
  bookPivot.rotation.y = Math.PI / 2 - 0.25 + time * 0.45;   // the book turns slowly on the spot
  if (bookOpen && Math.hypot(BOOK.x - cp.x, BOOK.z - cp.z) > 2.2) setBook(false);
  grade.uniforms.uHappy.value += ((dread === 0 ? 1 : 0) - grade.uniforms.uHappy.value) * Math.min(1, dt * 6);
  grade.uniforms.uGray.value += ((dread === 0 ? 0 : Math.min(1, 0.38 + 0.62 * (dread - 1) / 7)) - grade.uniforms.uGray.value) * Math.min(1, dt * 0.8);
  updateDread(dt, now);
  grade.uniforms.uDark.value += (inTunnel - grade.uniforms.uDark.value) * Math.min(1, dt * 3);
  if (CL) updateCollapse(dt, now);
  if (moving || ballsAwake > 0 || frameNo < 6 || CL) renderer.shadowMap.needsUpdate = true;
  composer.render();
}
requestAnimationFrame(frame);
// playroom.html#collapse: skip the puzzle and watch the room come down (for testing the transition)
if (location.hash === '#collapse') setTimeout(() => { dread = 9; grade.uniforms.uGray.value = 1; startTeleport(); }, 1200);
