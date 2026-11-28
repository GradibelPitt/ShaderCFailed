// The store. A supermarket at night with nobody in it: the dairy cases along one wall still lit, nearly every light overhead off,
// a few milk jugs lying in the first aisle where they fell. On the shelves, among everything else, two things you can take:
// a power strip (aisle 2) and an air pump (aisle 4, with the pool things). See js/equip.js for what they are for.
// It is where the ENTER hole on the left of the inverted pool (the side wall beside the water) leads, with no page change:
// js/poolflip.js imports this module in the background; nine metres into that tunnel, in the dark, the tunnel is the store's
// back corridor (window.__storeStart). Walk back out down the corridor and window.__storeReturn hands you back to the pool.
// store.html runs it on its own (there, walking back out down the corridor just turns you round).
// Same child-sized player as the pool and the bounce house, and the same size gun. Lit live (no baking): the cases and three
// ceiling panels are area lights; everything else is in the dark.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */
const SOLO = document.documentElement.dataset.store === 'solo';
const W = 9.2, D = 16, CEIL = 2.2;              // the shop floor: x 0..W, z 0..D (z runs from the back wall to the front windows)
const SHELF_H = 1.22, GZ0 = 2.0, GZ1 = 12.4;      // shelving height; where the long shelving runs start and end
const LEVELS = [0.1, 0.39, 0.68, 0.97];           // the tops of the shelves
const TUBE_HW = 0.5, TUBE_H = 0.95, TUBE_LEN = 8.5, HAND = 1.2, DOOR_X = 7.95;   // the back corridor, same section as the pool's tunnels
const G = 13, PS0 = 0.3, STEP = 0.13;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(19960412);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;

/* ------------------------------------------------------------------ */
/* renderer, scene                                                     */
/* ------------------------------------------------------------------ */
let canvas = document.getElementById('sc');
if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'sc'; canvas.tabIndex = 0; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;outline:none;cursor:pointer;z-index:5;background:#000'; const pc = document.getElementById('c'); if (pc && pc.parentNode) pc.parentNode.insertBefore(canvas, pc.nextSibling); else document.body.appendChild(canvas); }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
function pickPR() { const w = innerWidth, h = innerHeight; return Math.min(window.devicePixelRatio || 1, Math.sqrt(2.4e6 / Math.max(1, w * h)), 1.5); }
renderer.setPixelRatio(pickPR()); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
RectAreaLightUniformsLib.init();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const stage = new THREE.Scene(); stage.background = new THREE.Color(0x020304);
stage.fog = new THREE.FogExp2(0x030406, 0.13);
const camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.02, 60); camera.rotation.order = 'YXZ';
stage.add(new THREE.HemisphereLight(0x8a96a8, 0x1a1712, 0.035));

/* ------------------------------------------------------------------ */
/* textures (drawn here)                                               */
/* ------------------------------------------------------------------ */
function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
// floor: 30 cm vinyl tiles, cream and grey, worn, the odd darker one
const floorTex = canvasTex(512, 512, (g, w) => {
  const n = 4, s = w / n, pr = mulberry32(7);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = pr(), base = v < 0.1 ? [178, 174, 162] : v < 0.55 ? [214, 210, 198] : [204, 202, 193];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(i * s, j * s, s, s);
    for (let k = 0; k < 260; k++) { const c = 150 + pr() * 80; g.fillStyle = `rgba(${c},${c - 4},${c - 12},${0.25 + pr() * 0.3})`; g.fillRect(i * s + pr() * s, j * s + pr() * s, 1 + pr() * 2.5, 1 + pr() * 2.5); }
  }
  g.strokeStyle = 'rgba(70,64,52,0.55)'; g.lineWidth = 2; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  // scuffs
  for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(40,36,30,${0.05 + pr() * 0.08})`; g.lineWidth = 1 + pr() * 3; g.beginPath(); const x = pr() * w, y = pr() * w; g.moveTo(x, y); g.quadraticCurveTo(x + (pr() - 0.5) * 60, y + (pr() - 0.5) * 60, x + (pr() - 0.5) * 120, y + (pr() - 0.5) * 120); g.stroke(); }
}, true);
floorTex.repeat.set(W / 1.2, (D + TUBE_LEN) / 1.2);
const ceilTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#9d998c'; g.fillRect(0, 0, w, w); const pr = mulberry32(3);
  for (let k = 0; k < 2200; k++) { const c = 120 + pr() * 60; g.fillStyle = `rgba(${c},${c},${c - 8},0.5)`; g.fillRect(pr() * w, pr() * w, 1.5, 1.5); }
  g.fillStyle = '#6e6a60'; g.fillRect(0, 0, w, 5); g.fillRect(0, 0, 5, w);
}, true);
ceilTex.repeat.set(W / 0.6, D / 0.6);
// the printed front of a box: a band, a block, some lines of type. Each box takes a colour on top of this.
const labelTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, w * 0.62, w, w * 0.38);
  g.fillStyle = '#7a7a7a'; g.fillRect(w * 0.12, w * 0.12, w * 0.76, w * 0.18);
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(w * 0.5, w * 0.48, w * 0.13, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9a9a9a'; for (let i = 0; i < 4; i++) g.fillRect(w * 0.18, w * (0.7 + i * 0.065), w * (0.64 - i * 0.12), w * 0.03);
});
function signTex(lines, bg, fg, w = 512, h = 160) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lines.length === 1) { g.font = `bold ${h * 0.6}px "Trebuchet MS", Arial, sans-serif`; g.fillText(lines[0], w / 2, h / 2 + 4); }
    else { g.font = `bold ${h * 0.5}px "Trebuchet MS", Arial, sans-serif`; g.fillText(lines[0], w * 0.14, h / 2 + 4); g.font = `bold ${h * 0.2}px "Trebuchet MS", Arial, sans-serif`; g.textAlign = 'left'; g.fillText(lines[1], w * 0.3, h * 0.36); g.fillText(lines[2], w * 0.3, h * 0.68); }
  });
}

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */
const std = (o) => new THREE.MeshStandardMaterial(o);
const M = {
  floor: std({ map: floorTex, roughness: 0.2, metalness: 0, envMapIntensity: 0.9 }),
  wall: std({ color: 0xb4ae9e, roughness: 0.85 }),
  block: std({ color: 0x5e5a52, roughness: 0.95 }),
  ceil: std({ map: ceilTex, roughness: 0.95 }),
  metal: std({ color: 0x8f908a, roughness: 0.45, metalness: 0.35 }),
  dark: std({ color: 0x2a2b2e, roughness: 0.6, metalness: 0.2 }),
  peg: std({ color: 0x9c988c, roughness: 0.8 }),
  strip: std({ color: 0xbdb9ae, roughness: 0.5 }),
  mat: std({ color: 0x141416, roughness: 0.97 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe6ea, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.4 }),
  window: new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.2 }),
  caseBack: std({ color: 0xe6f2f0, emissive: 0xdff4f2, emissiveIntensity: 1.6, roughness: 0.6 }),
  tubeOn: std({ color: 0xffffff, emissive: 0xf2f7ff, emissiveIntensity: 2.4 }),
  panelOff: std({ color: 0x77766f, roughness: 0.5, emissive: 0x15161a, emissiveIntensity: 1 }),
  panelOn: std({ color: 0xffffff, emissive: 0xeef3ff, emissiveIntensity: 1.8 }),
  jug: std({ color: 0xf1efe8, roughness: 0.38 }),
  rubber: std({ color: 0x1d1d20, roughness: 0.8 }),
};
// what is behind the glass of the cases glows a little with the case's own light (instanced: the colour is per box)
const caseGoods = std({ map: labelTex, roughness: 0.5 });
caseGoods.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.42;\n#endif'); };

/* ------------------------------------------------------------------ */
/* building blocks                                                     */
/* ------------------------------------------------------------------ */
const solids = [];   // boxes the player cannot walk into: { x0, x1, z0, z1, y0, y1 }
const solid = (x0, x1, z0, z1, y0, y1) => { const s = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 }; solids.push(s); return s; };
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(x0, x1, y0, y1, z0, z1, mat, coll) {
  const m = new THREE.Mesh(boxGeo, mat); m.scale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.matrixAutoUpdate = false; m.updateMatrix(); stage.add(m); if (coll) solid(x0, x1, z0, z1, y0, y1); return m;
}
// boxes on shelves, as instances: collected first, made into meshes at the end
const goods = [], bottles = [], cgoods = [];
const PALETTE = ['#b8332b', '#d9a21e', '#2f5e9e', '#e8e2d0', '#4f8a3c', '#c96a2a', '#6b3f8a', '#a8272f', '#2d7d82', '#e4d4a2', '#3a3a3a', '#d8c43a', '#7fa9c9', '#c44b6b'];
const pick = (a) => a[Math.floor(rand() * a.length)];
// fill one shelf (side: +1 the products face +x, -1 they face -x) from z0 to z1; front: x of the shelf's front edge; depth: how deep it is
function fillShelf(front, side, y, z0, z1, depth, maxH, keep) {
  let z = z0 + 0.02;
  while (z < z1 - 0.06) {
    const run = 0.25 + rand() * 0.8, gap = rand() < 0.13;   // some runs are sold out: nothing, the pegboard showing
    if (gap) { z += run; continue; }
    const kind = rand() < 0.22 ? 'bottle' : 'box', col = new THREE.Color(pick(PALETTE));
    const w = kind === 'bottle' ? 0.045 + rand() * 0.03 : 0.05 + rand() * 0.09, h = Math.min(maxH, kind === 'bottle' ? 0.12 + rand() * 0.1 : 0.07 + rand() * 0.17), d = Math.min(depth - 0.02, kind === 'bottle' ? w : 0.06 + rand() * 0.24);
    const end = Math.min(z1 - 0.03, z + run);
    for (; z + w < end; z += w + 0.004 + (rand() < 0.08 ? 0.03 : 0)) {
      if (keep && z + w > keep[0] && z < keep[1]) continue;   // left clear around something you can take
      const c = col.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.04), pull = rand() < 0.15 ? rand() * 0.08 : 0;   // a few pulled forward, a few pushed back
      const x = front - side * (d / 2 + 0.01 + (rand() < 0.1 ? 0.06 : 0) - pull), lean = rand() < 0.04 ? (rand() - 0.5) * 0.5 : 0;
      (kind === 'bottle' ? bottles : goods).push({ x, y: y + h / 2, z: z + w / 2, sx: kind === 'bottle' ? w : d, sy: h, sz: w, c, lean });
    }
    z = end + 0.02;
  }
}
// a shelving run from z0 to z1, its back panel at x = bx, with shelves on the sides listed (+1: facing +x, -1: facing -x)
function shelving(bx, sides, z0, z1, depth, keeps) {
  box(bx - 0.02, bx + 0.02, 0.06, SHELF_H, z0, z1, M.peg);
  for (const sd of sides) {
    const front = bx + sd * depth;
    box(Math.min(bx, front), Math.max(bx, front), 0, 0.08, z0, z1, M.dark);   // kick plate
    for (let li = 0; li < LEVELS.length; li++) {
      const y = LEVELS[li];
      box(Math.min(bx, front), Math.max(bx, front), y - 0.016, y, z0, z1, M.metal);
      box(front - sd * 0.004, front + sd * 0.006, y - 0.035, y + 0.012, z0, z1, M.strip);   // price strip
      fillShelf(front, sd, y, z0, z1, depth, (li < LEVELS.length - 1 ? LEVELS[li + 1] - y : SHELF_H - y) - 0.03, keeps && keeps[sd + ':' + li]);
    }
    box(Math.min(bx, front), Math.max(bx, front), SHELF_H - 0.02, SHELF_H + 0.02, z0, z1, M.metal);
  }
  for (const z of [z0, z1]) box(bx - depth, bx + depth, 0, SHELF_H + 0.03, z - 0.012, z + 0.012, M.metal);   // ends
  const xs = sides.map((sd) => bx + sd * depth).concat([bx]); solid(Math.min(...xs) - 0.01, Math.max(...xs) + 0.01, z0, z1, 0, CEIL);
}
// a sign hanging from the ceiling over an aisle
function aisleSign(x, z, num, l1, l2) {
  const tex = signTex([num, l1, l2], '#21508f', '#f4f1e6');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.3), std({ map: tex, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 }));
  m.position.set(x, CEIL - 0.42, z); stage.add(m);
  for (const dx of [-0.4, 0.4]) box(x + dx - 0.003, x + dx + 0.003, CEIL - 0.27, CEIL, z - 0.003, z + 0.003, M.dark);
}

/* ------------------------------------------------------------------ */
/* the room                                                            */
/* ------------------------------------------------------------------ */
// floor and ceiling (the floor runs on under the back corridor)
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D + TUBE_LEN), M.floor); f.rotation.x = -Math.PI / 2; f.position.set(W / 2, 0, (D - TUBE_LEN) / 2); stage.add(f);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ceil); c.rotation.x = Math.PI / 2; c.position.set(W / 2, CEIL, D / 2); stage.add(c);
}
// walls: back (with the doorway the corridor comes in by), front (windows and doors, nothing behind them), sides
box(-0.2, 0, 0, CEIL, 0, D, M.wall, true); box(W, W + 0.2, 0, CEIL, 0, D, M.wall, true);
box(-0.2, DOOR_X - TUBE_HW, 0, CEIL, -0.2, 0, M.wall, true); box(DOOR_X + TUBE_HW, W + 0.2, 0, CEIL, -0.2, 0, M.wall, true); box(DOOR_X - TUBE_HW, DOOR_X + TUBE_HW, TUBE_H, CEIL, -0.2, 0, M.wall);
box(-0.2, W + 0.2, 0, 0.35, D, D + 0.2, M.wall, true); box(-0.2, W + 0.2, 1.75, CEIL, D, D + 0.2, M.wall);
box(0, W, 0.35, 1.75, D + 0.05, D + 0.1, M.window); solid(0, W, D, D + 0.2, 0, CEIL);
for (let x = 0; x <= W + 0.01; x += W / 6) box(x - 0.03, x + 0.03, 0.35, 1.75, D - 0.01, D + 0.06, M.dark);
// the front doors and the red EXIT over them (there is no outside)
box(3.9, 5.3, 0.02, 1.75, D - 0.03, D, M.dark); box(4.58, 4.62, 0.02, 1.75, D - 0.05, D - 0.02, M.metal);
{ const t = signTex(['EXIT'], '#160304', '#ff3a2e', 256, 96); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), std({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 2.2 })); m.position.set(4.6, 1.93, D - 0.02); m.rotation.y = Math.PI; stage.add(m);
  const l = new THREE.PointLight(0xff2a1e, 0.35, 4, 2); l.position.set(4.6, 1.85, D - 0.25); stage.add(l); }
// back corridor: block walls, low, dark; a strip curtain in the doorway
box(DOOR_X - TUBE_HW - 0.2, DOOR_X - TUBE_HW, 0, TUBE_H, -TUBE_LEN, 0, M.block, true); box(DOOR_X + TUBE_HW, DOOR_X + TUBE_HW + 0.2, 0, TUBE_H, -TUBE_LEN, 0, M.block, true);
box(DOOR_X - TUBE_HW - 0.2, DOOR_X + TUBE_HW + 0.2, TUBE_H, TUBE_H + 0.1, -TUBE_LEN, 0, M.block);
box(DOOR_X - TUBE_HW, DOOR_X + TUBE_HW, 0, TUBE_H, -TUBE_LEN - 0.2, -TUBE_LEN, M.block, true);
{ const sm = new THREE.MeshStandardMaterial({ color: 0xcfd8d6, roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, TUBE_H - 0.03), sm); m.position.set(DOOR_X - TUBE_HW + 0.07 + i * 0.143, (TUBE_H - 0.03) / 2 + 0.03, -0.1); m.rotation.y = (rand() - 0.5) * 0.25; stage.add(m); } }
// the dairy cases, all along the east wall: a lit back, wire shelves full of milk and juice, glass doors
const CASE_X = W - 0.62, CZ0 = 1.0, CZ1 = 13.6;
{
  box(CASE_X, W, 0, 0.14, CZ0, CZ1, M.dark); box(CASE_X, W, 1.38, 1.6, CZ0, CZ1, M.dark);
  box(W - 0.05, W, 0.14, 1.38, CZ0, CZ1, M.caseBack);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, CZ1 - CZ0), M.tubeOn); tl.position.set(CASE_X + 0.06, 1.36, (CZ0 + CZ1) / 2); stage.add(tl);
  const head = signTex(['DAIRY  ·  MILK  ·  EGGS  ·  JUICE'], '#173a6a', '#f3efe2', 1024, 64);
  const hm = new THREE.Mesh(new THREE.PlaneGeometry(CZ1 - CZ0 - 0.4, 0.13), std({ map: head, emissive: 0xffffff, emissiveMap: head, emissiveIntensity: 0.35 })); hm.rotation.y = -Math.PI / 2; hm.position.set(CASE_X - 0.003, 1.49, (CZ0 + CZ1) / 2); stage.add(hm);
  const shelvesY = [0.15, 0.44, 0.73, 1.02];
  for (const y of shelvesY) box(CASE_X + 0.04, W - 0.06, y - 0.01, y, CZ0, CZ1, M.metal);
  for (let z = CZ0; z < CZ1 - 0.01; z += 0.7) {
    box(CASE_X - 0.02, CASE_X + 0.02, 0.14, 1.38, z - 0.015, z + 0.015, M.dark);   // mullions
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.67, 1.22), M.glass); g.rotation.y = -Math.PI / 2; g.position.set(CASE_X - 0.01, 0.76, z + 0.35); stage.add(g);
    box(CASE_X - 0.05, CASE_X - 0.025, 0.55, 0.95, z + 0.62, z + 0.64, M.metal);   // door handles
  }
  for (const y of shelvesY) for (let z = CZ0 + 0.04; z < CZ1 - 0.08;) {
    const milk = rand() < 0.55, gap = rand() < 0.12, run = 0.3 + rand() * 0.6;
    if (gap) { z += run; continue; }
    const col = milk ? new THREE.Color(pick(['#f2f0ea', '#f2f0ea', '#e9e6dc'])) : new THREE.Color(pick(['#f0a33a', '#e8d24a', '#c8452e', '#7cb34a', '#f2f0ea']));
    const w = milk ? 0.1 : 0.065, h = milk ? 0.2 : 0.17;
    for (const end = z + run; z < end && z < CZ1 - 0.08; z += w + 0.01) for (let k = 0; k < 2; k++) cgoods.push({ x: CASE_X + 0.13 + k * 0.17, y: y + h / 2, z: z + w / 2, sx: w, sy: h, sz: w, c: col.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.03), lean: 0 });
    z += 0.02;
  }
  solid(CASE_X - 0.05, W, CZ0, CZ1, 0, CEIL);
}
// the long shelving runs (gondolas) and the wall shelving on the west side
const SOCKET_AT = new V3(5.08, LEVELS[1], 7.05), PUMP_AT = new V3(0.24, LEVELS[0], 10.2);
shelving(7.1, [1, -1], GZ0, GZ1, 0.36);                                         // between aisles 1 and 2
shelving(4.8, [1, -1], GZ0, GZ1, 0.36, { '1:1': [SOCKET_AT.z - 0.26, SOCKET_AT.z + 0.36] });   // aisle 2 side: the power strip
// The shelving between aisles 3 and 4 is built apart from the rest: once the power strip is taken, it comes down (see the end of this file's
// instanced goods), tipping over into aisle 3 and lying there. Its meshes, its goods and its solid are kept here for that.
const FALL = { bx: 2.5, px: 2.5 + 0.36, pivot: new THREE.Group(), t: -1, shake: 0, dark: 0, kids: null, goods: null, bottles: null, solid: null, cart: null, cartSolid: null, spill: [] };
{ const c0 = stage.children.length, g0 = goods.length, b0 = bottles.length;
  shelving(FALL.bx, [1, -1], GZ0, GZ1, 0.36);                                  // between aisles 3 and 4
  FALL.kids = stage.children.slice(c0); FALL.goods = goods.splice(g0); FALL.bottles = bottles.splice(b0); FALL.solid = solids[solids.length - 1]; }
shelving(0.02, [1], 1.0, 14.6, 0.42, { '1:0': [PUMP_AT.z - 0.3, PUMP_AT.z + 0.3] });           // the west wall: seasonal, pool things
// end caps at the front, a few tall stacks of the same thing
for (const bx of [7.1, 4.8, 2.5]) { box(bx - 0.36, bx + 0.36, 0, 0.08, GZ1 + 0.01, GZ1 + 0.4, M.dark); solid(bx - 0.36, bx + 0.36, GZ1, GZ1 + 0.4, 0, CEIL); const col = new THREE.Color(pick(PALETTE));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) goods.push({ x: bx - 0.24 + i * 0.16, y: 0.08 + 0.08 + j * 0.16, z: GZ1 + 0.2, sx: 0.15, sy: 0.15, sz: 0.3, c: col.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.05), lean: 0 }); }
// signs
aisleSign(7.95, 4.5, '1', 'DAIRY  ·  EGGS', 'BREAD'); aisleSign(5.95, 4.5, '2', 'HOME  ·  HARDWARE', 'BATTERIES'); aisleSign(3.65, 4.5, '3', 'SNACKS  ·  DRINKS', 'CANDY'); aisleSign(1.4, 4.5, '4', 'SEASONAL  ·  POOL', 'OUTDOOR');
// checkouts at the front, one lane light still on
for (const cx of [2.2, 5.6]) {
  box(cx - 0.32, cx + 0.32, 0, 0.62, 13.3, 14.7, M.dark, true); box(cx - 0.3, cx + 0.3, 0.62, 0.64, 13.32, 14.4, M.rubber);
  box(cx - 0.2, cx + 0.1, 0.64, 0.86, 14.42, 14.66, std({ color: 0x3b3d42, roughness: 0.5 }));
  box(cx + 0.29, cx + 0.31, 0.64, 1.25, 14.6, 14.62, M.metal);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), cx > 4 ? std({ color: 0x000, emissive: 0x6bff8a, emissiveIntensity: 1.6 }) : M.dark); lamp.position.set(cx + 0.3, 1.29, 14.61); stage.add(lamp);
}
// the first aisle, as in the photograph: a black mat, and milk jugs on the floor
{ const m = box(7.98, 8.52, 0, 0.008, 1.7, 4.6, M.mat); m.rotation.y = 0.03; m.updateMatrix(); }
{
  const jg = new RoundedBoxGeometry(0.1, 0.2, 0.1, 3, 0.025), cg = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), hg = new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI);
  const caps = [std({ color: 0xc8352a, roughness: 0.4 }), std({ color: 0x2a62c8, roughness: 0.4 }), std({ color: 0xe8c22a, roughness: 0.4 })];
  const label = std({ color: 0x3a77c4, roughness: 0.5 });
  const lg = new THREE.BoxGeometry(0.102, 0.06, 0.102);
  const spots = [[7.7, 1.5, 1.3, 0.3], [7.92, 1.7, 1.57, 1.1], [8.1, 1.42, 1.57, 2.4], [7.62, 1.95, 0.2, -0.6], [7.98, 2.1, 1.57, 0.4], [7.8, 2.4, 1.57, 2.9], [8.22, 1.95, 0, 0], [7.52, 1.62, 1.57, 1.9], [7.68, 2.7, 1.57, -1.2], [7.9, 3.05, 1.4, 0.8]];
  for (const [x, z, tip, yaw] of spots) {
    const g = new THREE.Group(); const j = new THREE.Mesh(jg, M.jug); g.add(j); const c = new THREE.Mesh(cg, pick(caps)); c.position.set(0.02, 0.11, 0.02); g.add(c);
    const h = new THREE.Mesh(hg, M.jug); h.position.set(-0.03, 0.06, 0); h.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(h); const l = new THREE.Mesh(lg, label); l.position.y = -0.01; g.add(l);
    const lying = tip > 0.5; g.rotation.set(0, yaw, 0); g.rotateZ(tip); g.position.set(x, lying ? 0.052 : 0.1, z); stage.add(g);
  }
}
// a cart left in aisle 3
{
  const cart = new THREE.Group(), wire = M.metal, t = 0.006;
  const bar = (x0, y0, z0, x1, y1, z1) => { const a = new V3(x0, y0, z0), b = new V3(x1, y1, z1), m = new THREE.Mesh(new THREE.CylinderGeometry(t, t, a.distanceTo(b), 5), wire); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()); cart.add(m); };
  const L = 0.62, Wc = 0.36, y0 = 0.24, y1 = 0.6;
  for (const sx of [-1, 1]) { bar(sx * Wc / 2, y0, 0, sx * Wc / 2, y1, -0.04); bar(sx * Wc / 2, y0, L, sx * Wc / 2, y1, L + 0.06); bar(sx * Wc / 2, y1, -0.04, sx * Wc / 2, y1, L + 0.06); bar(sx * Wc / 2, y0, 0, sx * Wc / 2, y0, L);
    for (let k = 1; k < 7; k++) { const z = k * L / 7; bar(sx * Wc / 2, y0, z, sx * Wc / 2, y1, z - 0.04 + 0.1 * z / L); }
    bar(sx * Wc / 2, 0.05, 0.02, sx * Wc / 2, y0, 0.02); bar(sx * Wc / 2, 0.05, L - 0.04, sx * Wc / 2, y0, L - 0.04); bar(sx * Wc / 2, 0.05, 0.02, sx * Wc / 2, 0.05, L - 0.04); }
  for (let k = 0; k <= 6; k++) { const x = -Wc / 2 + k * Wc / 6; bar(x, y0, 0, x, y0, L); bar(x, y0, 0, x, y1, -0.04); bar(x, y0, L, x, y1, L + 0.06); }
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, Wc + 0.04, 8), std({ color: 0xc23a2a, roughness: 0.5 })); h.rotation.z = Math.PI / 2; h.position.set(0, y1 + 0.1, L + 0.12); cart.add(h);
  for (const sx of [-1, 1]) bar(sx * Wc / 2, y1, L + 0.06, sx * Wc / 2, y1 + 0.1, L + 0.12);
  for (const [x, z] of [[-1, 0.02], [1, 0.02], [-1, L - 0.04], [1, L - 0.04]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), M.rubber); wh.rotation.z = Math.PI / 2; wh.position.set(x * Wc / 2, 0.035, z); cart.add(wh); }
  cart.position.set(3.55, 0, 8.4); cart.rotation.y = 0.5; stage.add(cart); FALL.cart = cart; FALL.cartSolid = solid(3.15, 3.95, 8.2, 9.2, 0, CEIL);
}
// ceiling panels on a grid; nearly all of them off
const panels = [];
for (const x of [7.95, 5.95, 3.65, 1.4]) for (let z = 1.2; z < D - 0.5; z += 2.4) {
  const on = (x === 5.95 && Math.abs(z - 6.0) < 0.1) || (x === 1.4 && Math.abs(z - 10.8) < 0.1) || (x === 3.65 && Math.abs(z - 13.2) < 0.1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.02, 1.18), on ? M.panelOn.clone() : M.panelOff); m.position.set(x, CEIL - 0.01, z); stage.add(m);
  panels.push({ m, on, x, z });
}

/* ------------------------------------------------------------------ */
/* up through the ceiling: a vent, a dropping ladder, a winding duct,  */
/* and at its far end, down through a box office's ceiling, a cinema   */
/* ------------------------------------------------------------------ */
// In the back corner by the EXIT, a vent in the ceiling: E opens it and an iron ladder drops. At the top, the duct is too narrow for you
// as you are (only shrunk do you fit). It winds over the shop and on beyond its west wall, lit by a few work lamps, to a grille in its
// floor with light coming up through it: the ceiling vent of an abandoned cinema's box office (E opens that one too, and a ladder drops).
// The box office stands just inside the cinema's front doors; behind it the foyer, the concession stand, the ticket check, a corridor,
// and at the end of that the one screen, a giant-screen hall. All in this same scene, west of the shop (x < 0) and over it (y > CEIL),
// shut off from it by its walls and ceiling. The cinema's street front faces +z; the hall is behind it, at -z.
const DUCT_Y = 2.52, DUCT_H = 0.3, DUCT_HW = 0.18, HATCH_HW = 0.15;
const DUCT_PATH = [[0.9, 15.35], [0.9, 13.2], [2.6, 13.2], [2.6, 10.4], [0.4, 10.4], [0.4, 8.0], [-1.6, 8.0], [-1.6, 12.4], [-3.4, 12.4]];
const DUCT_BB = { x0: -3.8, x1: 3.0, z0: 7.6, z1: 15.8 };           // the duct's whole footprint: only in here can you be up in it
const BOX = { x0: -6.0, x1: -2.2, z0: 10.2, z1: 14.6, c: 2.48 };     // the box office, in the front corner of the foyer, by the street doors
const FOYER = { x0: -18, x1: -2.2, z0: 5.0, z1: 14.6, c: 3.8 };
const CORR = { x0: -5.0, x1: -2.2, z0: -7.5, z1: 5.0, c: 3.2 };       // from the ticket check back along the side of the hall to its door
const HALL = { x0: -30, x1: -5.0, z0: -31, z1: -1.0, c: 18 };        // the screen: 25 m by 30, 18 high
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const cinemaCeil = (x, z) => (inR(BOX, x, z) ? BOX.c : inR(DWAY, x, z) ? DWAY.c : inR(DCOR, x, z) ? DCOR.c : inR(FOYER, x, z) ? FOYER.c : inR(CORR, x, z) ? CORR.c : inR(HALL, x, z) ? HALL.c : 3);
const ductMetalTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#9aa1a3'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 2600; i++) { const v = 140 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v + 4},${v + 6},0.25)`; g.fillRect(Math.random() * w, Math.random() * w, 1 + Math.random() * 3, 1); }   // the spangle of galvanised steel
  g.fillStyle = 'rgba(60,64,66,0.55)'; g.fillRect(0, 0, w, 3); g.fillRect(0, w / 2, w, 2);                                           // seams
  g.fillStyle = 'rgba(40,42,44,0.7)'; for (let x = 8; x < w; x += 24) { g.beginPath(); g.arc(x, 7, 2, 0, 7); g.fill(); g.beginPath(); g.arc(x, w / 2 + 6, 2, 0, 7); g.fill(); }   // rivets
  g.fillStyle = 'rgba(90,70,50,0.18)'; for (let i = 0; i < 6; i++) g.fillRect(Math.random() * w, Math.random() * w, 30 + Math.random() * 60, 6 + Math.random() * 16);   // old stains
}, [3, 3]);
const MC = {
  duct: std({ map: ductMetalTex, color: 0xe4e8ea, roughness: 0.5, metalness: 0.3, emissive: 0xffffff, emissiveMap: ductMetalTex, emissiveIntensity: 0.16 }),   // never quite black in there
  frame: std({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.5 }),
  seam: std({ color: 0x9aa0a2, roughness: 0.45, metalness: 0.3, emissive: 0x202224 }),
  iron: std({ color: 0x55575a, roughness: 0.45, metalness: 0.7 }),
  boWall: std({ color: 0x8a8270, roughness: 0.9 }),
  boFloor: std({ map: canvasTex(256, 256, (g, w) => { g.fillStyle = '#6b6658'; g.fillRect(0, 0, w, w); for (let x = 0; x < w; x += 64) for (let y = 0; y < w; y += 64) { g.fillStyle = ((x + y) / 64) % 2 ? '#77715f' : '#5f5a4d'; g.fillRect(x, y, 64, 64); } g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * w, 20 + Math.random() * 50, 3); }, [6, 6]), roughness: 0.75 }),
  carpet: std({ map: canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#3a0d14'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#7a5a1e'; g.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = i * 64 + 32, cy = j * 64 + 32; g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx + 22, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 22, cy); g.closePath(); g.stroke(); }
    g.fillStyle = '#1f5c5a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(i * 64 + 32, j * 64 + 32, 6, 0, 7); g.fill(); g.beginPath(); g.arc(i * 64, j * 64, 4, 0, 7); g.fill(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
  }, [5, 5]), roughness: 0.97 }),
  maroon: std({ color: 0x4a1c22, roughness: 0.85 }),
  gold: std({ color: 0x9a7a3a, roughness: 0.45, metalness: 0.6 }),
  fabric: std({ color: 0x1e1a22, roughness: 0.98 }),
  velvet: std({ color: 0x6a1420, roughness: 0.9 }),
  seatDark: std({ color: 0x241417, roughness: 0.8 }),
  ceilDark: std({ color: 0x1a1a1d, roughness: 0.95 }),
  glassDark: new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
  ticketGlass: new THREE.MeshPhysicalMaterial({ color: 0xb8c8c6, roughness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
  paper: std({ color: 0xd9d2bd, roughness: 0.9 }),
};
MC.carpet.map.repeat.set(9, 9); MC.boFloor.map.repeat.set(4, 4); ductMetalTex.repeat.set(1, 1);
const vbox = (x0, x1, y0, y1, z0, z1, mat) => box(x0, x1, y0, y1, z0, z1, mat, false);
// a floor or ceiling plane over a rectangle, with an optional square hole [cx, cz, hw]
function slab(x0, x1, z0, z1, y, mat, down, hole) {
  const put = (a0, a1, b0, b1) => { if (a1 - a0 < 1e-3 || b1 - b0 < 1e-3) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(a1 - a0, b1 - b0), mat); m.rotation.x = down ? Math.PI / 2 : -Math.PI / 2; m.position.set((a0 + a1) / 2, y, (b0 + b1) / 2); stage.add(m); };
  if (!hole) return put(x0, x1, z0, z1);
  const [cx, cz, hw] = hole; put(x0, cx - hw, z0, z1); put(cx + hw, x1, z0, z1); put(cx - hw, cx + hw, z0, cz - hw); put(cx - hw, cx + hw, cz + hw, z1);
}
// the store's own ceiling, cut round the vent (it replaces the single plane made above)
const VENT = { x: DUCT_PATH[0][0], z: DUCT_PATH[0][1] };
stage.children.filter((o) => o.isMesh && o.material === M.ceil).forEach((o) => stage.remove(o));
slab(0, W, 0, D, CEIL, M.ceil, true, [VENT.x, VENT.z, HATCH_HW]);

/* ---- the duct ---- */
const ductRects = [];   // where you can be inside it: the corner squares and the straight runs between them (x0,x1,z0,z1)
{
  const hw = DUCT_HW, t = 0.02, y0 = DUCT_Y, y1 = DUCT_Y + DUCT_H, P = DUCT_PATH, last = P.length - 1;
  const dirOf = (a, b) => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
  const piece = (x0, x1, z0, z1, hole) => {   // floor (with the hatch hole, if any) and ceiling over one rectangle; the floor is solid
    if (hole) { const [cx, cz] = hole, h = HATCH_HW; vbox(x0, x1, y0 - t, y0, z0, cz - h, MC.duct); vbox(x0, x1, y0 - t, y0, cz + h, z1, MC.duct); vbox(x0, cx - h, y0 - t, y0, cz - h, cz + h, MC.duct); vbox(cx + h, x1, y0 - t, y0, cz - h, cz + h, MC.duct); }
    else vbox(x0, x1, y0 - t, y0, z0, z1, MC.duct);
    vbox(x0, x1, y1, y1 + t, z0, z1, MC.duct); solid(x0, x1, z0, z1, y0 - t, y0);
  };
  for (let i = 0; i <= last; i++) {
    const [cx, cz] = P[i], open = new Set();
    if (i > 0) open.add(dirOf(P[i], P[i - 1]).join()); if (i < last) open.add(dirOf(P[i], P[i + 1]).join());
    piece(cx - hw, cx + hw, cz - hw, cz + hw, i === 0 || i === last ? [cx, cz] : null);
    if (i < last) { const [nx, nz] = P[i + 1]; ductRects.push({ x0: Math.min(cx, nx) - hw, x1: Math.max(cx, nx) + hw, z0: Math.min(cz, nz) - hw, z1: Math.max(cz, nz) + hw }); }   // where you can be: each run from corner to corner, overlapping at the corners
    if (!open.has('1,0')) vbox(cx + hw, cx + hw + t, y0 - t, y1 + t, cz - hw - t, cz + hw + t, MC.duct);
    if (!open.has('-1,0')) vbox(cx - hw - t, cx - hw, y0 - t, y1 + t, cz - hw - t, cz + hw + t, MC.duct);
    if (!open.has('0,1')) vbox(cx - hw - t, cx + hw + t, y0 - t, y1 + t, cz + hw, cz + hw + t, MC.duct);
    if (!open.has('0,-1')) vbox(cx - hw - t, cx + hw + t, y0 - t, y1 + t, cz - hw - t, cz - hw, MC.duct);
    if (i < last) {
      const [dx, dz] = dirOf(P[i], P[i + 1]), [nx, nz] = P[i + 1];
      if (dx) { const a = Math.min(cx, nx) + hw, b = Math.max(cx, nx) - hw; piece(a, b, cz - hw, cz + hw); vbox(a, b, y0 - t, y1 + t, cz - hw - t, cz - hw, MC.duct); vbox(a, b, y0 - t, y1 + t, cz + hw, cz + hw + t, MC.duct);
        for (let x = a + 0.6; x < b; x += 0.6) for (const s of [-1, 1]) vbox(x - 0.006, x + 0.006, y0, y1, cz + s * (hw - 0.003) - 0.003, cz + s * (hw - 0.003) + 0.003, MC.seam); }   // seam bands
      else { const a = Math.min(cz, nz) + hw, b = Math.max(cz, nz) - hw; piece(cx - hw, cx + hw, a, b); vbox(cx - hw - t, cx - hw, y0 - t, y1 + t, a, b, MC.duct); vbox(cx + hw, cx + hw + t, y0 - t, y1 + t, a, b, MC.duct);
        for (let z = a + 0.6; z < b; z += 0.6) for (const s of [-1, 1]) vbox(cx + s * (hw - 0.003) - 0.003, cx + s * (hw - 0.003) + 0.003, y0, y1, z - 0.006, z + 0.006, MC.seam); }
    }
  }
  // the short square shafts down from the duct floor through the ceilings below (the shop's, and the box office's at the far end)
  for (const [sx, sz, yb] of [[P[0][0], P[0][1], CEIL], [P[last][0], P[last][1], BOX.c]]) { const h = HATCH_HW;
    vbox(sx - h - t, sx - h, yb, y0, sz - h, sz + h, MC.duct); vbox(sx + h, sx + h + t, yb, y0, sz - h, sz + h, MC.duct);
    vbox(sx - h - t, sx + h + t, yb, y0, sz - h - t, sz - h, MC.duct); vbox(sx - h - t, sx + h + t, yb, y0, sz + h, sz + h + t, MC.duct); }
  // work lamps: little caged bulbs clipped to the duct roof, so the metal can be seen all the way along
  const bulbM = std({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 2.2 });
  for (const [x, z, k] of [[0.9, 14.2, 1.0], [1.7, 13.2, 0.8], [2.6, 11.6, 0.95], [1.5, 10.4, 0.85], [0.4, 9.0, 0.85], [-0.6, 8.0, 0.8], [-1.6, 10.2, 0.7], [-2.6, 12.4, 0.6]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), bulbM); b.position.set(x, y1 - 0.03, z); stage.add(b);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, wireframe: true })); cage.position.copy(b.position); stage.add(cage);
    const l = new THREE.PointLight(0xffd8a8, k, 3.2, 1.2); l.position.copy(b.position); stage.add(l);
  }
}
function inDuctRects(x, z, r) { for (const R of ductRects) if (x >= R.x0 + r - 1e-6 && x <= R.x1 - r + 1e-6 && z >= R.z0 + r - 1e-6 && z <= R.z1 - r + 1e-6) return true; return false; }
function clampToDuct(p, r) {   // the duct's walls, for whoever is in it: back to the nearest point you can be at
  if (inDuctRects(p.x, p.z, r)) return;
  let bx = p.x, bz = p.z, bd = 1e9;
  for (const R of ductRects) { const x = clamp(p.x, R.x0 + r, R.x1 - r), z = clamp(p.z, R.z0 + r, R.z1 - r), d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; bx = x; bz = z; } }
  const dx = bx - p.x, dz = bz - p.z, l = Math.hypot(dx, dz); p.x = bx; p.z = bz;
  if (l > 1e-6) { const v = player.vel, vn = (v.x * dx + v.z * dz) / l; if (vn < 0) { v.x -= vn * dx / l; v.z -= vn * dz / l; } }
}

/* ---- the cinema ---- */
// Laid out the way a real one is, in the order you would come to it from the street: the front doors (chained, dark glass, nothing
// behind them), the box office just inside them on the right, the foyer with the concession stand at its back, the ticket check, a
// corridor, and only then, behind all of it, the one screen: a giant-screen hall, 25 m across, 30 deep, 18 high, the screen itself
// 22 m by 15, curved, seats rising steeply away from it. The foyer's walls are bare: walnut to the rail, maroon above, nothing hung.
// walls of a room with gaps: each gap [a0, a1, y0, y1] along the wall (y1 = top of the gap). mk: box, or mbox (merged, world UVs)
function wallX(x, z0, z1, top, mat, gaps = [], th = 0.15, mk = box) {   // a wall along z at x
  let z = z0; const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
  for (const [a, b, y0, y1] of gs) { if (a > z) mk(x - th / 2, x + th / 2, 0, top, z, a, mat, true); if (y0 > 0) mk(x - th / 2, x + th / 2, 0, y0, a, b, mat, true); if (y1 < top) mk(x - th / 2, x + th / 2, y1, top, a, b, mat, y0 > 0); z = b; }
  if (z < z1) mk(x - th / 2, x + th / 2, 0, top, z, z1, mat, true);
}
function wallZ(z, x0, x1, top, mat, gaps = [], th = 0.15, mk = box) {   // a wall along x at z
  let x = x0; const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
  for (const [a, b, y0, y1] of gs) { if (a > x) mk(x, a, 0, top, z - th / 2, z + th / 2, mat, true); if (y0 > 0) mk(a, b, 0, y0, z - th / 2, z + th / 2, mat, true); if (y1 < top) mk(a, b, y1, top, z - th / 2, z + th / 2, mat, y0 > 0); x = b; }
  if (x < x1) mk(x, x1, 0, top, z - th / 2, z + th / 2, mat, true);
}
// Most of the cinema is merged into one mesh per material (there is a lot of it), with UVs in metres so the textures keep their size.
const mbins = new Map();
const mpush = (mat, g) => { if (!mbins.has(mat)) mbins.set(mat, []); mbins.get(mat).push(g); };
function mbox(x0, x1, y0, y1, z0, z1, mat, coll) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0); if (w < 1e-4 || h < 1e-4 || d < 1e-4) return;
  const g = new THREE.BoxGeometry(w, h, d), s = mat.userData.uvS || 1, uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) { const i = f * 4 + j; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mpush(mat, g); if (coll) solid(x0, x1, z0, z1, y0, y1);
}
function mplane(x0, x1, z0, z1, y, mat, down) {   // a floor (or, down, a ceiling) over a rectangle
  const w = x1 - x0, d = z1 - z0; if (w < 1e-3 || d < 1e-3) return; const g = new THREE.PlaneGeometry(w, d), s = mat.userData.uvS || 1, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * d / s);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); mpush(mat, g);
}
function mgeo(mat, g, x, y, z, rx = 0, ry = 0, rz = 0) { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); mpush(mat, g); }
function flushMerged() { for (const [mat, gs] of mbins) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.matrixAutoUpdate = false; m.updateMatrix(); stage.add(m); gs.forEach((g) => g.dispose()); } mbins.clear(); }
const wmat = (o, s) => { const m = std(o); m.userData.uvS = s; return m; };
const MX = {
  carpet: wmat({ map: (() => { const t = MC.carpet.map.clone(); t.repeat.set(1, 1); t.needsUpdate = true; return t; })(), roughness: 0.97 }, 1.8),
  hallCarpet: wmat({ map: canvasTex(256, 256, (g, w) => {   // the hall's: charcoal with a small blue-grey figure, worn paler down the aisles
    g.fillStyle = '#17181f'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const cx = i * 32 + 16, cy = j * 32 + 16; g.fillStyle = (i + j) % 2 ? '#262a3a' : '#20232e'; g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 9); g.lineTo(cx - 9, cy); g.closePath(); g.fill(); g.fillStyle = '#3a2c1c'; g.fillRect(i * 32 - 1, j * 32 - 1, 3, 3); }
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '90,90,110'},${Math.random() * 0.18})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
  }, true), roughness: 0.98 }, 1.6),
  acoustic: wmat({ map: canvasTex(256, 256, (g, w) => {   // fabric-wrapped acoustic panels, 1.2 m square, dark reveals between
    g.fillStyle = '#0b0c10'; g.fillRect(0, 0, w, w); g.fillStyle = '#20222b'; g.fillRect(5, 5, w - 10, w - 10);
    for (let i = 0; i < 5000; i++) { const v = Math.random() < 0.5 ? 14 : 44; g.fillStyle = `rgba(${v},${v},${v + 8},0.18)`; g.fillRect(5 + Math.random() * (w - 10), 5 + Math.random() * (w - 10), 1, 1); }
    for (let y = 8; y < w - 8; y += 3) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(5, y, w - 10, 1); }
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(5, 5, w - 10, 2);
  }, true), roughness: 0.96 }, 1.2),
  wood: wmat({ map: canvasTex(256, 256, (g, w) => {   // walnut panelling: two panels to 1.2 m, a bevel at each seam
    g.fillStyle = '#3a2316'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,10,4' : '90,56,32'},${0.1 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (Math.random() - 0.5) * 14, w * 0.3, x + (Math.random() - 0.5) * 14, w * 0.7, x + (Math.random() - 0.5) * 10, w); g.stroke(); }
    for (const x of [0, w / 2]) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, 0, 3, w); g.fillStyle = 'rgba(150,100,60,0.25)'; g.fillRect(x + 3, 0, 2, w); }
  }, true), roughness: 0.55 }, 1.2),
  maroon: wmat({ color: 0x4a1c22, roughness: 0.85 }, 1),
  ceil: wmat({ color: 0x1b191b, roughness: 0.95 }, 1),
  beam: wmat({ color: 0x2a1a18, roughness: 0.8 }, 1),
  marble: wmat({ color: 0xcdc3b0, roughness: 0.28 }, 1),
  black: wmat({ color: 0x050506, roughness: 1 }, 1),
  hallCeil: wmat({ color: 0x0c0c0f, roughness: 1 }, 1),
  fin: wmat({ color: 0x2b231d, roughness: 0.7 }, 1),
  steel: wmat({ color: 0xa8aaa8, roughness: 0.3, metalness: 0.8 }, 1),
  doorGrey: wmat({ color: 0x3a3c40, roughness: 0.6, metalness: 0.3 }, 1),
  mat: wmat({ color: 0x141416, roughness: 0.98 }, 1),
  lampOn: std({ color: 0xffffff, emissive: 0xffc890, emissiveIntensity: 1.3, side: THREE.DoubleSide }),
  lampDim: std({ color: 0xffffff, emissive: 0xffc890, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
  lampOff: std({ color: 0x4a4440, roughness: 0.5, side: THREE.DoubleSide }),
  nose: std({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 1.5 }),
  led: std({ color: 0x000000, emissive: 0x5a78c8, emissiveIntensity: 0.8 }),
  seat: std({ color: 0xffffff, roughness: 0.9 }),
  plastic: std({ color: 0x1a1a1c, roughness: 0.5 }),
};
const exitMat = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: signTex(['EXIT'], '#160304', '#ff3a2e', 256, 96), emissiveIntensity: 2.2 });
function exitSign(x, y, z, ry) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), exitMat); m.position.set(x, y, z); m.rotation.y = ry; stage.add(m); }
function sign(text, bg, fg, w, h, x, y, z, ry, ei = 0.4, px = 512) { const t = signTex([text], bg, fg, px, Math.max(32, Math.round(px * h / w))); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: ei, roughness: 0.6 })); m.position.set(x, y, z); m.rotation.y = ry; stage.add(m); return m; }
// a wall sconce: half a drum of frosted glass against the wall. side: which way it faces ('+x', '-x', '+z', '-z')
function sconce(x, y, z, side, mat) { const g = new THREE.CylinderGeometry(0.09, 0.12, 0.24, 12, 1, false, 0, Math.PI); const ry = { '+x': 0, '-x': Math.PI, '+z': -Math.PI / 2, '-z': Math.PI / 2 }[side]; mgeo(mat, g, x, y, z, 0, ry); }
function downlight(x, y, z, mat, r = 0.11) { mgeo(mat, new THREE.CircleGeometry(r, 16), x, y, z, Math.PI / 2); mgeo(MC.gold, new THREE.RingGeometry(r, r + 0.025, 16), x, y - 0.001, z, Math.PI / 2); }
// a queue post: weighted base, chrome pole; belts (or ropes) are strung between them
function qpost(x, z, fallen) {
  if (fallen) { mgeo(MX.steel, new THREE.CylinderGeometry(0.025, 0.025, 0.95, 10), x, 0.16, z, 0, 0.6, Math.PI / 2 - 0.12); mgeo(MX.plastic, new THREE.CylinderGeometry(0.15, 0.16, 0.03, 18), x - 0.45, 0.15, z + 0.3, 0, 0, Math.PI / 2 - 0.12); return; }
  mgeo(MX.plastic, new THREE.CylinderGeometry(0.15, 0.16, 0.03, 18), x, 0.015, z); mgeo(MX.steel, new THREE.CylinderGeometry(0.025, 0.025, 0.95, 10), x, 0.475, z); mgeo(MX.steel, new THREE.CylinderGeometry(0.035, 0.03, 0.05, 10), x, 0.97, z); solid(x - 0.04, x + 0.04, z - 0.04, z + 0.04, 0, 1.0);
}
const belt = std({ color: 0x5a1218, roughness: 0.6 });
function qbelt(x0, z0, x1, z1) { const l = Math.hypot(x1 - x0, z1 - z0); mgeo(belt, new THREE.BoxGeometry(l, 0.05, 0.006), (x0 + x1) / 2, 0.88, (z0 + z1) / 2, 0, -Math.atan2(z1 - z0, x1 - x0)); }
function qrope(x0, z0, x1, z1) { stage.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(x0, 0.9, z0), new V3((x0 + x1) / 2, 0.7, (z0 + z1) / 2), new V3(x1, 0.9, z1)]), 14, 0.014, 6), MC.velvet)); }

const HATCH2 = { x: DUCT_PATH[DUCT_PATH.length - 1][0], z: DUCT_PATH[DUCT_PATH.length - 1][1] };
const FC = FOYER.c, WH = 1.0;   // the foyer's ceiling; the height of its panelling

// -- the box office, in the front corner: beige walls, linoleum, a counter under three ticket windows, one hanging lamp that cannot hold steady
slab(BOX.x0, BOX.x1, BOX.z0, BOX.z1, 0.002, MC.boFloor, false);
slab(BOX.x0, BOX.x1, BOX.z0, BOX.z1, BOX.c, M.ceil, true, [HATCH2.x, HATCH2.z, HATCH_HW]);
wallX(BOX.x1, BOX.z0, BOX.z1, BOX.c, MC.boWall); wallZ(BOX.z1, BOX.x0, BOX.x1, BOX.c, MC.boWall);
wallZ(BOX.z0, BOX.x0, BOX.x1, BOX.c, MC.boWall, [[-3.1, -2.4, 0, 2.1]]);                       // its door, into the foyer
wallX(BOX.x0, BOX.z0, BOX.z1, BOX.c, MC.boWall, [[11.3, 13.7, 0.72, 1.42]]);                     // the ticket windows, onto the foyer
box(BOX.x0 - 0.01, BOX.x0 + 0.01, 0.72, 1.42, 11.3, 13.7, MC.ticketGlass);
for (const z of [12.1, 12.9]) mbox(BOX.x0 - 0.04, BOX.x0 + 0.04, 0.72, 1.42, z - 0.025, z + 0.025, MC.frame);
for (const zc of [11.7, 12.5, 13.3]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), MC.frame); m.position.set(BOX.x0 + 0.012, 1.08, zc); m.rotation.y = Math.PI / 2; stage.add(m);   // speaking holes
  mbox(BOX.x0 - 0.2, BOX.x0 + 0.2, 0.72, 0.745, zc - 0.16, zc + 0.16, MC.frame); }                                                  // and the trays under the glass
// its foyer side: walnut, a marble sill, a brass band, the maroon bulkhead up to the foyer's ceiling, and the sign
wallX(BOX.x0 - 0.09, BOX.z0, BOX.z1, BOX.c, MX.wood, [[11.3, 13.7, 0.72, 1.42]], 0.03, mbox);
wallZ(BOX.z0 - 0.09, BOX.x0 - 0.105, BOX.x1, BOX.c, MX.wood, [[-3.1, -2.4, 0, 2.1]], 0.03, mbox);
mbox(BOX.x0 - 0.075, BOX.x0 + 0.075, BOX.c, FC, BOX.z0, BOX.z1, MX.maroon); mbox(BOX.x0, BOX.x1, BOX.c, FC, BOX.z0 - 0.075, BOX.z0 + 0.075, MX.maroon);
mbox(BOX.x0 - 0.13, BOX.x0 - 0.075, 2.42, 2.5, BOX.z0 - 0.13, BOX.z1, MC.gold); mbox(BOX.x0 - 0.13, BOX.x1, 2.42, 2.5, BOX.z0 - 0.13, BOX.z0 - 0.075, MC.gold);
mbox(BOX.x0 - 0.42, BOX.x0 - 0.075, 0.72, 0.76, 11.2, 13.8, MX.marble);
sign('TICKETS', '#2a1410', '#e8c46a', 1.6, 0.4, BOX.x0 - 0.085, 2.95, 12.5, -Math.PI / 2, 0.3);
for (const zc of [11.7, 12.5, 13.3]) { const t = signTex([String((zc - 11.7) / 0.8 + 1 | 0)], '#1a0c0a', '#e8c46a', 64, 64); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 })); m.position.set(BOX.x0 - 0.11, 1.56, zc); m.rotation.y = -Math.PI / 2; stage.add(m); }   // window numbers
{ const pv = new THREE.Group(); pv.position.set(-2.4, 0, BOX.z0 - 0.1); pv.rotation.y = -1.2; const d = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.08, 0.04), MX.wood); d.position.set(-0.35, 1.05, 0); pv.add(d); const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), MC.gold); k.position.set(-0.6, 1.0, -0.04); pv.add(k); stage.add(pv); }   // its door, left open
// inside it
box(BOX.x0 + 0.08, BOX.x0 + 0.62, 0, 0.66, 11.1, 13.9, MC.boWall, true); vbox(BOX.x0 + 0.06, BOX.x0 + 0.66, 0.66, 0.7, 11.08, 13.92, MC.frame);   // the counter
vbox(BOX.x0 + 0.2, BOX.x0 + 0.5, 0.7, 0.9, 12.3, 12.7, std({ color: 0x3a3836, roughness: 0.5, metalness: 0.3 }));                              // the till
vbox(BOX.x0 + 0.22, BOX.x0 + 0.48, 0.9, 0.98, 12.38, 12.62, std({ color: 0x1a2a20, emissive: 0x1a3a22, emissiveIntensity: 0.5 }));
{ const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), std({ color: 0xc94a3a, roughness: 0.7 })); roll.rotation.z = Math.PI / 2; roll.position.set(BOX.x0 + 0.35, 0.76, 11.5); stage.add(roll); }   // a roll of tickets
for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), MC.paper); m.rotation.x = -Math.PI / 2; m.rotation.z = rand() * 6; m.position.set(BOX.x0 + 0.2 + rand() * 0.35, 0.702 + i * 0.0003, 13.0 + rand() * 0.8); stage.add(m); }   // stubs on the counter
for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), MC.paper); m.rotation.x = -Math.PI / 2; m.rotation.z = rand() * 6; m.position.set(BOX.x0 + 0.8 + rand() * 2.6, 0.004 + i * 0.0003, 10.6 + rand() * 3.6); stage.add(m); }   // and torn ones on the floor
{ const st = new THREE.Group(); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), MC.velvet); seat.position.y = 0.52; st.add(seat); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 8), MC.iron); leg.position.y = 0.26; st.add(leg); st.position.set(BOX.x0 + 1.0, 0.14, 13.2); st.rotation.z = 1.45; stage.add(st); }   // the stool, knocked over
vbox(BOX.x1 - 0.5, BOX.x1 - 0.08, 0, 1.1, 13.5, 14.5, std({ color: 0x5a5c4e, roughness: 0.6, metalness: 0.4 })); solid(BOX.x1 - 0.5, BOX.x1 - 0.08, 13.5, 14.5, 0, 1.1);   // a filing cabinet
for (let i = 0; i < 3; i++) vbox(BOX.x1 - 0.51, BOX.x1 - 0.5, 0.12 + i * 0.34, 0.4 + i * 0.34, 13.6, 14.4, std({ color: 0x4a4c40, roughness: 0.5, metalness: 0.4 }));
vbox(BOX.x0 + 0.1, BOX.x0 + 0.5, 0.05, 0.6, 13.95, 14.45, std({ color: 0x2c2e30, roughness: 0.4, metalness: 0.6 })); solid(BOX.x0 + 0.1, BOX.x0 + 0.5, 13.95, 14.45, 0, 0.6);   // the safe
{ const c = new THREE.Group(); c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24), std({ color: 0xe8e2d0, roughness: 0.5 }))); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 6, 24), MC.frame); rim.rotation.x = Math.PI / 2; c.add(rim);   // the clock, stopped
  for (const [l, a] of [[0.11, 0.6], [0.14, 3.5]]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, l), MC.frame); h.position.set(Math.sin(a) * l / 2, 0.025, Math.cos(a) * l / 2); h.rotation.y = a; c.add(h); }
  c.rotation.z = Math.PI / 2; c.position.set(BOX.x1 - 0.1, 1.95, 11.4); stage.add(c); }
const boLamp = { l: new THREE.PointLight(0xffc98a, 3.6, 8, 1.0), bulb: null, f: 1, next: 0 };
{ vbox(-4.6 - 0.004, -4.6 + 0.004, 1.9, BOX.c, 12.0 - 0.004, 12.0 + 0.004, MC.frame); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 16, 1, true), std({ color: 0x2e4a3a, side: THREE.DoubleSide, roughness: 0.6 })); shade.position.set(-4.6, 1.86, 12.0); stage.add(shade);
  boLamp.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std({ color: 0xffffff, emissive: 0xffd09a, emissiveIntensity: 2 })); boLamp.bulb.position.set(-4.6, 1.8, 12.0); stage.add(boLamp.bulb);
  boLamp.l.position.set(-4.6, 1.76, 12.0); stage.add(boLamp.l); }

// -- the foyer: patterned carpet, walnut to a brass rail, maroon above, coffered ceiling with most of its downlights dead
mplane(FOYER.x0, BOX.x0, FOYER.z0, FOYER.z1, 0.003, MX.carpet); mplane(BOX.x0, FOYER.x1, FOYER.z0, BOX.z0, 0.003, MX.carpet);
mplane(FOYER.x0, BOX.x0, FOYER.z0, FOYER.z1, FC, MX.ceil, true); mplane(BOX.x0, FOYER.x1, FOYER.z0, BOX.z0, FC, MX.ceil, true);
const DOORS = [-15.2, -8.2];   // the bank of front doors in the street wall
wallZ(FOYER.z1, FOYER.x0, BOX.x0, FC, MX.maroon, [[DOORS[0], DOORS[1], 0.04, 2.6]], 0.15, mbox);
wallX(FOYER.x0, FOYER.z0, FOYER.z1, FC, MX.maroon, [], 0.15, mbox);
wallZ(FOYER.z0, FOYER.x0, CORR.x0, FC, MX.maroon, [], 0.15, mbox); mbox(CORR.x0, FOYER.x1, CORR.c, FC, FOYER.z0 - 0.075, FOYER.z0 + 0.075, MX.maroon);   // the back wall, and the header over the way to the screen
wallX(FOYER.x1, FOYER.z0, BOX.z0, FC, MX.maroon, [], 0.15, mbox);
// panelling and rails, all round
{ const runs = [['x', FOYER.x0 + 0.075, FOYER.z0 + 0.075, FOYER.z1 - 0.075, 1], ['z', FOYER.z0 + 0.075, FOYER.x0 + 0.075, CORR.x0, 1], ['z', FOYER.z1 - 0.075, FOYER.x0 + 0.075, DOORS[0] - 0.05, -1], ['z', FOYER.z1 - 0.075, DOORS[1] + 0.05, BOX.x0 - 0.105, -1], ['x', FOYER.x1 - 0.075, FOYER.z0 + 0.075, BOX.z0 - 0.105, -1]];
  for (const [ax, p, a0, a1, s] of runs) {
    const pan = (t0, t1, y0, y1, out, m) => ax === 'x' ? mbox(Math.min(p, p + s * out), Math.max(p, p + s * out), y0, y1, a0, a1, m) : mbox(a0, a1, y0, y1, Math.min(p, p + s * out), Math.max(p, p + s * out), m);
    pan(0, 0, 0, WH, 0.03, MX.wood); pan(0, 0, WH, WH + 0.04, 0.05, MC.gold); pan(0, 0, 0, 0.12, 0.045, MX.beam); pan(0, 0, FC - 0.14, FC, 0.07, MX.beam);
  } }
// the front doors: dark glass in brass frames, a chain through the middle pair of handles
box(DOORS[0], DOORS[1], 0.04, 2.6, FOYER.z1 - 0.02, FOYER.z1 + 0.02, MC.glassDark, true);
for (let i = 0; i <= 4; i++) { const x = DOORS[0] + i * (DOORS[1] - DOORS[0]) / 4; mbox(x - 0.045, x + 0.045, 0.04, 2.6, FOYER.z1 - 0.06, FOYER.z1 + 0.03, MC.gold); }
mbox(DOORS[0] - 0.05, DOORS[1] + 0.05, 2.56, 2.68, FOYER.z1 - 0.06, FOYER.z1 + 0.03, MC.gold); mbox(DOORS[0], DOORS[1], 0.04, 0.22, FOYER.z1 - 0.05, FOYER.z1 - 0.02, MC.gold);
for (let i = 0; i < 4; i++) { const x0 = DOORS[0] + i * 1.75; if (i === 1 || i === 2) mbox(x0 + (i === 1 ? 1.55 : 0.12), x0 + (i === 1 ? 1.63 : 0.2), 0.85, 1.35, FOYER.z1 - 0.12, FOYER.z1 - 0.06, MC.gold); else mbox(x0 + 0.25, x0 + 1.5, 1.0, 1.05, FOYER.z1 - 0.1, FOYER.z1 - 0.05, MC.gold); }   // pulls on the middle pair, push bars on the others
{ const cx = (DOORS[0] + DOORS[1]) / 2; for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 12), MC.iron); l.position.set(cx - 0.28 + i * 0.07, 1.1 + Math.sin(i * 0.7) * 0.04 - (i > 2 && i < 6 ? 0.05 : 0), FOYER.z1 - 0.15); l.rotation.y = i % 2 ? Math.PI / 2 : 0; stage.add(l); }
  vbox(cx - 0.05, cx + 0.05, 0.92, 1.02, FOYER.z1 - 0.17, FOYER.z1 - 0.13, MC.iron); }   // the chain and its padlock
mbox(DOORS[0] + 0.4, DOORS[1] - 0.4, 0, 0.012, FOYER.z1 - 1.3, FOYER.z1 - 0.1, MX.mat);   // the door mat
// coffered ceiling
for (const z of [6.9, 8.8, 10.7, 12.7]) mbox(FOYER.x0, z < BOX.z0 ? FOYER.x1 : BOX.x0, FC - 0.24, FC, z - 0.12, z + 0.12, MX.beam);
for (const x of [-16.0, -13.6, -11.2, -8.8, -6.4, -4.1]) mbox(x - 0.12, x + 0.12, FC - 0.24, FC, FOYER.z0, x > BOX.x0 ? BOX.z0 : FOYER.z1, MX.beam);
{ const xs = [-17.0, -14.8, -12.4, -10.0, -7.6, -5.2, -3.15], zs = [5.95, 7.85, 9.75, 11.7, 13.65]; let n = 0;
  for (const x of xs) for (const z of zs) { if (inR(BOX, x, z)) continue; n++; downlight(x, FC - 0.25, z, n % 7 === 3 ? MX.lampDim : MX.lampOff); } }
// a pendant over the middle (the foyer's one working light), sconces on the bare walls
const lobbyLamp = new THREE.PointLight(0xffb070, 7.0, 15, 1.0); lobbyLamp.position.set(-11.0, 2.85, 9.8); stage.add(lobbyLamp);
{ vbox(-11.004, -10.996, 3.0, FC - 0.24, 9.796, 9.804, MC.frame); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.26, 20, 1, true), std({ color: 0xffe0b0, emissive: 0xffc070, emissiveIntensity: 0.9, side: THREE.DoubleSide })); sh.position.set(-11.0, 2.9, 9.8); stage.add(sh); }
for (const z of [7.2, 9.8, 12.4]) sconce(FOYER.x0 + 0.105, 2.3, z, '+x', z === 9.8 ? MX.lampOn : MX.lampDim);
sconce(-8.0, 2.3, FOYER.z0 + 0.105, '+z', MX.lampOn); sconce(-6.0, 2.3, FOYER.z0 + 0.105, '+z', MX.lampOff);
// two round columns with brass bands
for (const x of [-14.2, -7.8]) { const z = 9.4; mgeo(MX.maroon, new THREE.CylinderGeometry(0.28, 0.28, FC - 0.24, 20), x, (FC - 0.24) / 2, z); mgeo(MX.beam, new THREE.CylinderGeometry(0.33, 0.35, 0.3, 20), x, 0.15, z);
  for (const y of [WH + 0.02, FC - 0.55]) mgeo(MC.gold, new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), x, y, z); mgeo(MX.beam, new THREE.CylinderGeometry(0.38, 0.3, 0.2, 20), x, FC - 0.34, z); solid(x - 0.33, x + 0.33, z - 0.33, z + 0.33, 0, FC); }
// benches along the west wall
for (const [z0, z1] of [[6.4, 8.4], [10.6, 12.6]]) { mbox(FOYER.x0 + 0.15, FOYER.x0 + 0.62, 0.38, 0.46, z0, z1, MX.maroon, true); mbox(FOYER.x0 + 0.105, FOYER.x0 + 0.2, 0.46, 0.92, z0, z1, MX.maroon);
  for (const z of [z0 + 0.1, z1 - 0.1]) mbox(FOYER.x0 + 0.2, FOYER.x0 + 0.58, 0, 0.38, z - 0.03, z + 0.03, MC.gold); }
// the box office queue: belt posts (one knocked down)
qpost(-7.4, 10.9); qpost(-7.4, 12.4); qpost(-7.4, 13.9); qpost(-8.6, 12.4); qpost(-8.6, 13.9); qpost(-8.6, 10.9, true);
qbelt(-7.4, 10.9, -7.4, 12.4); qbelt(-7.4, 12.4, -7.4, 13.9); qbelt(-8.6, 12.4, -8.6, 13.9);
mgeo(belt, new THREE.BoxGeometry(1.0, 0.05, 0.006), -8.1, 0.01, 11.5, Math.PI / 2, 0.7);   // its belt, lying on the carpet
{ // the concession stand along the back wall: a back counter with the drinks machine, the front counter with the candy case, menus above
  const X0 = -16.8, X1 = -10.8;
  mbox(X0, X1, 0, 0.9, FOYER.z0 + 0.075, 5.65, MX.wood, true); mbox(X0 - 0.02, X1 + 0.02, 0.9, 0.94, FOYER.z0 + 0.075, 5.68, MX.marble);
  mbox(X0, X1 - 0.8, 0, 0.12, 6.75, 7.45, MX.beam, true); mbox(X0, X1 - 0.8, 0.12, 0.98, 6.75, 7.2, MX.maroon, true);   // the front counter, open at its east end
  mbox(X0 - 0.03, X1 - 0.77, 0.98, 1.02, 6.72, 7.48, MX.marble); mbox(X0, X1 - 0.8, 0.12, 0.98, 7.2, 7.215, MX.black); solid(X0, X1 - 0.8, 6.75, 7.45, 0, 1.02);
  mbox(X0, X1 - 0.8, 0.5, 0.52, 7.21, 7.43, MX.steel);
  box(X0 + 0.05, X1 - 0.85, 0.14, 0.96, 7.45, 7.47, MC.glassDark);
  for (const y of [0.15, 0.53]) for (let x = X0 + 0.15; x < X1 - 1.0; x += 0.17 + rand() * 0.05) if (rand() > 0.3) goods.push({ x, y: y + 0.09, z: 7.32, sx: 0.12, sy: 0.18, sz: 0.06, c: new THREE.Color(pick(PALETTE)), lean: (rand() - 0.5) * 0.2 });   // candy boxes behind the glass
  // the drinks machine on the back counter: a steel body, six nozzles, the drip tray, the backlit panel long dead
  mbox(-15.8, -14.2, 0.94, 1.7, 5.15, 5.6, MX.steel); mbox(-15.75, -14.25, 1.32, 1.66, 5.6, 5.62, std({ color: 0x1a2430, emissive: 0x2a4060, emissiveIntensity: 0.15 }));
  for (let i = 0; i < 6; i++) mgeo(MX.plastic, new THREE.CylinderGeometry(0.02, 0.025, 0.08, 8), -15.6 + i * 0.24, 1.16, 5.66);
  mbox(-15.75, -14.25, 0.94, 0.97, 5.55, 5.82, MX.steel);
  for (let i = 0; i < 3; i++) mgeo(std({ color: [0xe8e4da, 0xc83a2a, 0x2a62c8][i], roughness: 0.5 }), new THREE.CylinderGeometry(0.05, 0.04, 0.4, 12, 1, true), -13.8 + i * 0.16, 1.14, 5.4);   // cup stacks
  // the till, napkins, straws on the front counter
  mbox(-14.7, -14.3, 1.02, 1.12, 6.85, 7.15, MX.plastic); mbox(-14.66, -14.34, 1.12, 1.32, 6.95, 6.98, std({ color: 0x0e1812, emissive: 0x143020, emissiveIntensity: 0.35 }));
  mbox(-16.3, -16.1, 1.02, 1.2, 7.0, 7.2, MX.steel); mgeo(MX.steel, new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12, 1, true), -15.9, 1.13, 7.1);
  // the popcorn machine, still half full
  const pm = new THREE.Group(), red = std({ color: 0xa8241e, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.46), red); base.position.y = 0.1; pm.add(base);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.46), MC.ticketGlass); cab.position.y = 0.48; pm.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.5), red); roof.position.y = 0.82; pm.add(roof);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.56, 0.02), MC.gold); p.position.set(sx * 0.29, 0.48, sz * 0.22); pm.add(p); }
  const corn = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.42), std({ color: 0xe8d28a, roughness: 0.95 })); corn.position.y = 0.28; pm.add(corn);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.1, 14), MX.steel); kettle.position.y = 0.66; pm.add(kettle);
  pm.position.set(-12.0, 1.02, 7.05); stage.add(pm);
  // the menus over the back counter: three boards of sizes and prices, one gone dark
  const board = (title, lines, x, lit) => { const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
    g.fillStyle = '#120a08'; g.fillRect(0, 0, 512, 320); g.strokeStyle = '#7a5a1e'; g.lineWidth = 4; g.strokeRect(8, 8, 496, 304);
    g.fillStyle = '#e8c46a'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.fillText(title, 256, 76);
    g.font = '30px Georgia, serif'; lines.forEach(([a, b], i) => { g.textAlign = 'left'; g.fillStyle = '#d8cdb0'; g.fillText(a, 44, 140 + i * 52); g.textAlign = 'right'; g.fillText(b, 468, 140 + i * 52); g.fillStyle = 'rgba(216,205,176,0.35)'; for (let x = 44 + g.measureText(a).width + 60; x < 380; x += 14) g.fillRect(x, 134 + i * 52, 4, 4); });
    for (let k = 0; k < 2000; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; g.fillRect(Math.random() * 512, Math.random() * 320, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.125), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: lit, roughness: 0.4 })); m.position.set(x, 2.35, FOYER.z0 + 0.12); stage.add(m);
    mbox(x - 0.94, x + 0.94, 1.75, 2.95, FOYER.z0 + 0.075, FOYER.z0 + 0.11, MX.beam); };
  board('POPCORN', [['SMALL', '3.50'], ['MEDIUM', '4.75'], ['LARGE', '5.95']], -15.6, 0.5);
  board('SODA', [['SMALL', '2.75'], ['MEDIUM', '3.50'], ['LARGE', '4.25']], -13.7, 0.06);
  board('CANDY', [['BOX', '2.50'], ['BAG', '3.25'], ['NACHOS', '4.50']], -11.8, 0.5);
  sign('CONCESSIONS', '#3a0d14', '#e8c46a', 2.4, 0.26, -13.7, 3.22, FOYER.z0 + 0.12, 0, 0.18, 1024);
  const l3 = new THREE.PointLight(0xffd0a0, 2.6, 7, 1.0); l3.position.set(-13.8, 2.5, 6.6); stage.add(l3);
}
{ // the ticket check, where the foyer gives onto the corridor: a lectern, brass posts and velvet rope making two lanes
  const x = (CORR.x0 + CORR.x1) / 2;
  mbox(x - 0.25, x + 0.25, 0, 1.0, 5.6, 5.95, MX.wood, true); mbox(x - 0.3, x + 0.3, 1.0, 1.04, 5.55, 6.0, MC.gold); mbox(x - 0.2, x + 0.05, 1.04, 1.06, 5.65, 5.85, MC.paper);
  mgeo(MC.ticketGlass, new THREE.BoxGeometry(0.22, 0.26, 0.22), x + 0.4, 0.13, 6.2); solid(x + 0.29, x + 0.51, 6.09, 6.31, 0, 0.26);   // the stub box
  const bp = (px, pz) => { mgeo(MC.gold, new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16), px, 0.02, pz); mgeo(MC.gold, new THREE.CylinderGeometry(0.022, 0.022, 0.9, 10), px, 0.47, pz); mgeo(MC.gold, new THREE.SphereGeometry(0.045, 10, 8), px, 0.95, pz); solid(px - 0.04, px + 0.04, pz - 0.04, pz + 0.04, 0, 1.0); };
  for (const px of [CORR.x0 - 0.3, CORR.x1 - 0.35]) { bp(px, 6.4); bp(px, 7.9); qrope(px, 6.4, px, 7.9); }
  sign('SCREEN 1', '#1a0a0c', '#e8c46a', 1.6, 0.4, x, 3.5, FOYER.z0 + 0.085, 0, 0.45);
  sconce(CORR.x0 - 0.3, 2.4, FOYER.z0 + 0.105, '+z', MX.lampOn);
  const l2 = new THREE.PointLight(0xffa860, 2.6, 8, 1.0); l2.position.set(x, 2.8, 6.0); stage.add(l2);
}

// -- the corridor: carpet, panelling, sconces every few metres, down the side of the hall to its door near the screen end
mplane(CORR.x0, CORR.x1, CORR.z0, CORR.z1, 0.003, MX.carpet); mplane(CORR.x0, CORR.x1, CORR.z0, CORR.z1, CORR.c, MX.ceil, true);
const HDOOR = [-6.4, -4.0];   // the door into the hall, in its east wall
wallX(CORR.x1, CORR.z0, CORR.z1, CORR.c, MX.maroon, [], 0.15, mbox); wallX(CORR.x0, HALL.z1, CORR.z1, CORR.c, MX.maroon, [], 0.15, mbox); wallZ(CORR.z0, CORR.x0, CORR.x1, CORR.c, MX.maroon, [], 0.15, mbox);
mbox(CORR.x0 + 0.075, CORR.x0 + 0.1, 0, CORR.c, CORR.z0 + 0.075, HDOOR[0], MX.maroon); mbox(CORR.x0 + 0.075, CORR.x0 + 0.1, 0, CORR.c, HDOOR[1], CORR.z1, MX.maroon); mbox(CORR.x0 + 0.075, CORR.x0 + 0.1, 2.9, CORR.c, HDOOR[0], HDOOR[1], MX.maroon);   // the hall's wall, faced on this side
for (const [x, s, segs] of [[CORR.x0 + 0.1, 1, [[CORR.z0 + 0.075, HDOOR[0]], [HDOOR[1], CORR.z1]]], [CORR.x1 - 0.075, -1, [[CORR.z0 + 0.075, CORR.z1]]]]) for (const [a, b] of segs) {
  mbox(Math.min(x, x + s * 0.03), Math.max(x, x + s * 0.03), 0, WH, a, b, MX.wood); mbox(Math.min(x, x + s * 0.05), Math.max(x, x + s * 0.05), WH, WH + 0.04, a, b, MC.gold); mbox(Math.min(x, x + s * 0.06), Math.max(x, x + s * 0.06), CORR.c - 0.12, CORR.c, a, b, MX.beam); }
for (const z of [3.2, 0.2, -2.8]) sconce(CORR.x0 + 0.1, 2.15, z, '+x', z === 0.2 ? MX.lampOff : MX.lampDim);
for (const z of [1.7, -1.3, -4.3]) sconce(CORR.x1 - 0.075, 2.15, z, '-x', z === -4.3 ? MX.lampOn : MX.lampDim);
for (const z of [3.8, 1.3, -1.2, -3.7, -6.2]) downlight((CORR.x0 + CORR.x1) / 2, CORR.c - 0.004, z, z === -3.7 || z === 1.3 ? MX.lampDim : MX.lampOff);
{ const l = new THREE.PointLight(0xffc890, 1.6, 7, 1.0); l.position.set((CORR.x0 + CORR.x1) / 2, CORR.c - 0.3, 1.3); stage.add(l); }   // one downlight halfway along still working
// the door: a brass frame, the sign over it
mbox(CORR.x0 + 0.1, CORR.x0 + 0.15, 0, 2.95, HDOOR[0] - 0.08, HDOOR[0], MC.gold); mbox(CORR.x0 + 0.1, CORR.x0 + 0.15, 0, 2.95, HDOOR[1], HDOOR[1] + 0.08, MC.gold); mbox(CORR.x0 + 0.1, CORR.x0 + 0.15, 2.9, 2.98, HDOOR[0] - 0.08, HDOOR[1] + 0.08, MC.gold);
sign('SCREEN 1', '#1a0a0c', '#e8c46a', 0.72, 0.18, CORR.x0 + 0.16, 3.08, (HDOOR[0] + HDOOR[1]) / 2, Math.PI / 2, 0.5);
{ const l = new THREE.PointLight(0xffb070, 3.2, 9, 1.0); l.position.set(CORR.x1 - 0.5, 2.5, -4.3); stage.add(l); }
// a caution sign and a mop bucket someone left
{ const y = std({ color: 0xe8c22a, roughness: 0.5 }); for (const s of [-1, 1]) mgeo(y, new THREE.BoxGeometry(0.3, 0.6, 0.012), CORR.x1 - 0.45, 0.29, 1.6 + s * 0.09, s * 0.3); mgeo(y, new THREE.CylinderGeometry(0.17, 0.15, 0.32, 16), CORR.x1 - 0.4, 0.16, 0.9); solid(CORR.x1 - 0.6, CORR.x1 - 0.2, 0.7, 1.75, 0, 0.62);
  mgeo(MC.iron, new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6), CORR.x1 - 0.42, 0.75, 0.85, 0.2, 0, -0.25); }

// -- the hall
const ROWS = 18, ROW0 = -8.2, ROWD = 1.15, RISE = 0.42;   // rows from the front (A, at floor level, 7 m from the screen) to the back (R, 7 m up)
const rz = (k) => ROW0 - k * ROWD, rE = (k) => rz(k) + ROWD / 2, rh = (k) => k * RISE;   // row k: its seats' line, the front edge of its tier, its height
const HX0 = HALL.x0 + 0.075, HX1 = HALL.x1 - 0.075, HZ0 = HALL.z0 + 0.075, HZ1 = HALL.z1 - 0.075;   // the inside faces of its walls
const AISLES = [[HX0, HX0 + 1.2], [-23.525, -22.325], [-12.675, -11.475], [HX1 - 1.2, HX1]];
const BLOCKS = [[HX0 + 1.2, -23.525], [-22.325, -12.675], [-11.475, HX1 - 1.2]];
// the exit door at the top of the hall (E opens it), and the bare corridor behind it, which some way in, in the dark, is the corridor behind
// the white door in the river hall (js/riverhall.js); w: how far in from the door, DCW0: where the one becomes the other
const XD0 = HX0 + 0.5, XD1 = HX0 + 1.9, XDM = (XD0 + XD1) / 2, YD = rh(ROWS - 1), DCL = 9.2, DCW0 = 8;
const DCOR = { x0: XDM - 0.8, x1: XDM + 0.8, z0: HALL.z0 - 0.075 - DCL, z1: HALL.z0 - 0.075, c: YD + 2.7 };
const DWAY = { x0: XD0 - 0.1, x1: XD1 + 0.1, z0: HALL.z0 - 0.12, z1: HALL.z0 + 0.12, c: YD + 2.5 };   // the doorway itself, through the thickness of the wall
const floorAt = (z) => (z > rE(1) ? 0 : rh(Math.min(ROWS - 1, Math.floor((rE(1) - z) / ROWD) + 1)));
mplane(HALL.x0, HALL.x1, HALL.z0, HALL.z1, 0.003, MX.hallCarpet); mplane(HALL.x0, HALL.x1, HALL.z0, HALL.z1, HALL.c, MX.hallCeil, true);
wallZ(HALL.z1, HALL.x0, HALL.x1, HALL.c, MX.black, [], 0.15, mbox);                                   // the screen wall
wallX(HALL.x1, HALL.z0, HALL.z1, HALL.c, MX.acoustic, [[HDOOR[0], HDOOR[1], 0, 2.9]], 0.15, mbox);     // the side the corridor comes in by
wallX(HALL.x0, HALL.z0, HALL.z1, HALL.c, MX.acoustic, [], 0.15, mbox); wallZ(HALL.z0, HALL.x0, HALL.x1, HALL.c, MX.acoustic, [[XD0, XD1, YD, YD + 2.5]], 0.15, mbox);
// the stage under the screen, its lip picked out by a dim strip
mbox(HX0, HX1, 0, 0.9, -2.75, HZ1, MX.black, true); mbox(HX0, HX1, 0.86, 0.885, -2.77, -2.75, MX.led);
// the tiers and the stepped aisles: each row 42 cm above the one in front; in the aisles, three steps between rows and a landing at each
const noses = [];
for (const [x0, x1] of BLOCKS) for (let k = 1; k < ROWS; k++) mbox(x0, x1, 0, rh(k), k === ROWS - 1 ? HZ0 : rE(k + 1), rE(k), MX.hallCarpet, true);
{ const Q = (0.22 + ROWD / 2) / 3;
  for (const [x0, x1] of AISLES) {
    for (let k = 1; k < ROWS; k++) { mbox(x0, x1, 0, rh(k), k === ROWS - 1 ? HZ0 : rz(k) + 0.22, rE(k), MX.hallCarpet, true); noses.push([x0, x1, rh(k), rE(k)]); }
    for (let k = 0; k < ROWS - 1; k++) for (let j = 1; j <= 3; j++) { const zf = rz(k) + 0.22 - (j - 1) * Q, y = rh(k) + j * RISE / 4; mbox(x0, x1, 0, y, zf - Q, zf, MX.hallCarpet, true); noses.push([x0, x1, y, zf]); }
  } }
{ const im = new THREE.InstancedMesh(boxGeo, MX.nose, noses.length), o = new THREE.Object3D();   // a lit nosing on every step
  noses.forEach(([x0, x1, y, z], i) => { o.position.set((x0 + x1) / 2, y - 0.005, z - 0.01); o.scale.set(x1 - x0 - 0.12, 0.012, 0.025); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); stage.add(im); }
// the seats: red velvet gone dull, tall backs, armrests with cupholders; a few gone, a third folded up
{
  const seatG = new RoundedBoxGeometry(0.46, 0.1, 0.42, 2, 0.03), backG = new RoundedBoxGeometry(0.46, 0.68, 0.09, 2, 0.035), armG = new RoundedBoxGeometry(0.06, 0.05, 0.46, 1, 0.02), stdG = new THREE.BoxGeometry(0.05, 0.42, 0.44), cupG = new THREE.CylinderGeometry(0.042, 0.036, 0.06, 10, 1, true);
  const seats = [], backs = [], arms = [], stds = [], cups = [];
  for (let k = 0; k < ROWS; k++) {
    const y = rh(k), z = rz(k);
    for (const [x0, x1] of BLOCKS) {
      const n = Math.floor((x1 - x0) / 0.52 + 1e-6), p = (x1 - x0) / n;
      for (let i = 0; i < n; i++) { const cx = x0 + (i + 0.5) * p; if (rand() < 0.03) continue; const up = rand() < 0.3, c = new THREE.Color(0x7a1a24).offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.05);
        seats.push([cx, y + (up ? 0.47 : 0.3), z + (up ? -0.08 : 0.03), up ? -1.3 : 0, c]); backs.push([cx, y + 0.66, z - 0.21, -0.14 + (rand() - 0.5) * 0.06, c]); }
      for (let i = 0; i <= n; i++) { const ax = x0 + i * p; arms.push([ax, y + 0.47, z + 0.01]); stds.push([ax, y + 0.21, z - 0.02]); cups.push([ax, y + 0.47, z + 0.21]); }
      solid(x0, x1, rE(k + 1), z + 0.22, y, y + 0.95);
    }
  }
  const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); list.forEach((s, i) => { o.position.set(s[0], s[1], s[2]); o.rotation.set(s[3] || 0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (s[4]) im.setColorAt(i, s[4]); }); if (im.instanceColor) im.instanceColor.needsUpdate = true; stage.add(im); };
  inst(seatG, MX.seat, seats); inst(backG, MX.seat, backs); inst(armG, MC.seatDark, arms); inst(stdG, MX.plastic, stds); inst(cupG, MX.plastic, cups);
  // the row letters, lit on the ends of the rows that meet the two inner aisles
  const lt = canvasTex(64 * ROWS, 64, (g, w, h) => { g.fillStyle = '#120806'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8b45a'; g.font = 'bold 44px "Trebuchet MS", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let k = 0; k < ROWS; k++) g.fillText(String.fromCharCode(65 + k), k * 64 + 32, 34); });
  const lm = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: 0.9 });
  for (let k = 0; k < ROWS; k++) for (const [ax, s] of [[BLOCKS[0][1], 1], [BLOCKS[1][0], -1], [BLOCKS[1][1], 1], [BLOCKS[2][0], -1]]) {
    const g = new THREE.PlaneGeometry(0.11, 0.11), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / ROWS);
    mgeo(lm, g, ax + s * 0.028, rh(k) + 0.3, rz(k) - 0.02, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2); }
}
// brass handrails up the middle of the two inner aisles
for (const xc of [(AISLES[1][0] + AISLES[1][1]) / 2, (AISLES[2][0] + AISLES[2][1]) / 2]) {
  const a = new V3(xc, rh(1) + 0.85, rz(1) + 0.4), b = new V3(xc, rh(ROWS - 1) + 0.85, rz(ROWS - 1) + 0.4), g = new THREE.CylinderGeometry(0.022, 0.022, a.distanceTo(b), 10);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); mpush(MC.gold, g);
  for (let k = 1; k < ROWS; k += 2) { mgeo(MC.gold, new THREE.CylinderGeometry(0.018, 0.024, 0.85, 8), xc, rh(k) + 0.425, rz(k) + 0.4); solid(xc - 0.025, xc + 0.025, rz(k) + 0.375, rz(k) + 0.425, rh(k), rh(k) + 0.85); }
}
// the side walls: tall timber fins standing off the panels, sconces climbing with the rows, the surround speakers
for (const [x, s] of [[HX0, 1], [HX1, -1]]) {
  for (let z = -3.2; z > HZ0 + 0.5; z -= 2.4) mbox(Math.min(x, x + s * 0.2), Math.max(x, x + s * 0.2), floorAt(z) + 2.6, HALL.c - 0.4, z - 0.06, z + 0.06, MX.fin);
  for (let k = 2; k < ROWS; k += 3) { const z = rz(k) + 0.1; sconce(x + s * 0.02, rh(k) + 2.5, z, s > 0 ? '+x' : '-x', k === 8 ? MX.lampOff : MX.lampDim); mbox(Math.min(x, x + s * 0.4), Math.max(x, x + s * 0.4), rh(k) + 4.6, rh(k) + 5.3, z - 0.24, z + 0.24, MX.black); }
}
// acoustic clouds hung under the ceiling, with a few small lights in them
{ let n = 0; for (const [za, zb] of [[-3.5, -9.5], [-11, -17], [-18.5, -24.5], [-26, -30.2]]) { mbox(HX0 + 2.5, HX1 - 2.5, 16.4, 16.6, zb, za, MX.fin);
  for (let x = HX0 + 3.6; x < HX1 - 3; x += 2.4) for (const z of [za - 1.5, zb + 1.5]) { n++; downlight(x, 16.39, z, n % 5 === 2 ? MX.lampDim : MX.lampOff, 0.09); } } }
// the screen: 22 m by 15.4, curved toward the seats, black all round it, the side curtains drawn back
const SCR = { w: 22, h: 15.4, y: 8.75, x: (HALL.x0 + HALL.x1) / 2, z: HZ1 - 0.25, R: 60 };
const scrCv = document.createElement('canvas'); scrCv.width = 256; scrCv.height = 160; const scrG = scrCv.getContext('2d');
const scrTex = new THREE.CanvasTexture(scrCv); scrTex.colorSpace = THREE.SRGBColorSpace;
function paintScreen() { const id = scrG.createImageData(256, 160), d = id.data; const b = 150 + Math.random() * 40; for (let i = 0; i < d.length; i += 4) { const n = b + (Math.random() - 0.5) * 90; d[i] = n * 0.86; d[i + 1] = n * 0.92; d[i + 2] = n; d[i + 3] = 255; } scrG.putImageData(id, 0, 0); scrTex.needsUpdate = true; }
paintScreen();
{
  const ang = SCR.w / SCR.R, m = new THREE.Mesh(new THREE.CylinderGeometry(SCR.R, SCR.R, SCR.h, 64, 1, true, -ang / 2, ang), new THREE.MeshBasicMaterial({ map: scrTex, color: 0xc8d0dc, side: THREE.DoubleSide }));
  m.position.set(SCR.x, SCR.y, SCR.z - SCR.R); stage.add(m);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const x = SCR.x + s * (SCR.w / 2 + 0.35 + i * 0.16); mbox(x - 0.09, x + 0.09, 0.9, HALL.c - 0.5, HZ1 - 0.5 - (i % 2) * 0.12, HZ1 - 0.2 - (i % 2) * 0.12, MC.velvet); }   // the curtains, in folds
  mbox(HX0, HX1, HALL.c - 1.2, HALL.c, HZ1 - 0.9, HZ1, MX.black);   // the valance over it
  // the projection ports in the back wall, high over the top row, and the beams still coming out of them though nothing is showing
  const PY = rh(ROWS - 1) + 3.6, ports = [SCR.x - 1.1, SCR.x + 1.1];
  for (const px of ports) { mbox(px - 0.45, px + 0.45, PY - 0.4, PY + 0.4, HZ0, HZ0 + 0.06, MX.black); const g = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), std({ color: 0x000000, emissive: 0x9fb4d8, emissiveIntensity: 0.7 })); g.position.set(px, PY, HZ0 + 0.065); stage.add(g); }
  mbox(SCR.x - 3.2, SCR.x + 3.2, PY - 0.7, PY - 0.62, HZ0, HZ0 + 0.3, MX.steel);
  const hw = SCR.w / 2, hh = SCR.h / 2, zc = SCR.z - 0.5, C = [[SCR.x - hw, SCR.y - hh, zc], [SCR.x + hw, SCR.y - hh, zc], [SCR.x + hw, SCR.y + hh, zc], [SCR.x - hw, SCR.y + hh, zc]];
  const beamM = new THREE.MeshBasicMaterial({ color: 0x8090a8, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const px of ports) { const A = [px, PY, HZ0 + 0.1], pos = []; for (let i = 0; i < 4; i++) pos.push(...A, ...C[i], ...C[(i + 1) % 4]); const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); stage.add(new THREE.Mesh(bg, beamM)); }
}
const SCR_I = 1.5, scrLight = new THREE.RectAreaLight(0xb8c8e0, SCR_I, SCR.w, SCR.h); scrLight.position.set(SCR.x, SCR.y, SCR.z - 0.6); scrLight.lookAt(SCR.x, SCR.y, -100); stage.add(scrLight);
for (const z of [-7, -17, -27]) { const hl = new THREE.PointLight(0xd8b088, 15.0, 36, 1.0); hl.position.set(SCR.x, 15.6, z); stage.add(hl); }   // the house lights, left on low
// the doors: the one from the corridor, both leaves standing open into the hall; an emergency exit across the front; one at the top
for (const z of HDOOR) { mbox(HX1 - 1.18, HX1 - 0.02, 0, 2.86, z - 0.025, z + 0.025, MX.doorGrey, true); mbox(HX1 - 1.0, HX1 - 0.2, 1.0, 1.05, z - (z === HDOOR[0] ? -0.06 : 0.06), z - (z === HDOOR[0] ? -0.03 : 0.03), MX.steel); }
mbox(HX1 - 0.02, HX1 + 0.01, 2.86, 2.96, HDOOR[0] - 0.08, HDOOR[1] + 0.08, MX.steel);
exitSign(HX1 - 0.02, 3.15, (HDOOR[0] + HDOOR[1]) / 2, -Math.PI / 2);
{ const l = new THREE.PointLight(0xff2a1e, 0.6, 5, 2); l.position.set(HX1 - 0.4, 3.0, (HDOOR[0] + HDOOR[1]) / 2); stage.add(l); }
mbox(HX0, HX0 + 0.04, 0, 2.6, HDOOR[0] + 0.05, HDOOR[1] - 0.05, MX.doorGrey); mbox(HX0 + 0.04, HX0 + 0.05, 0, 2.6, -5.215, -5.185, MX.black); mbox(HX0 + 0.04, HX0 + 0.09, 1.0, 1.06, HDOOR[0] + 0.25, HDOOR[1] - 0.25, MX.steel);
exitSign(HX0 + 0.02, 2.85, (HDOOR[0] + HDOOR[1]) / 2, Math.PI / 2);
exitSign(XDM, YD + 2.75, HZ0 + 0.02, 0);
for (const x of [XD0 - 0.07, XD1]) mbox(x, x + 0.07, YD, YD + 2.57, HZ0, HZ0 + 0.03, MX.steel); mbox(XD0 - 0.07, XD1 + 0.07, YD + 2.5, YD + 2.57, HZ0, HZ0 + 0.03, MX.steel);   // its frame
const cdoor = { open: !!(window.SCF_SAVE && window.SCF_SAVE.get('cinemaDoor')), t: 0, pivot: new THREE.Group(), shut: null };
{ const pv = cdoor.pivot; pv.position.set(XD0, YD, HALL.z0); stage.add(pv);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(XD1 - XD0 - 0.02, 2.48, 0.05), MX.doorGrey); leaf.position.set((XD1 - XD0) / 2, 1.24, 0); pv.add(leaf);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(XD1 - XD0 - 0.4, 0.06, 0.05), MX.steel); bar.position.set((XD1 - XD0) / 2, 1.0, 0.05); pv.add(bar);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.04), MX.steel); pull.position.set(XD1 - XD0 - 0.18, 1.0, -0.05); pv.add(pull);
  if (cdoor.open) { cdoor.t = 1; pv.rotation.y = 1.5; solid(XD0 - 0.03, XD0 + 0.06, HALL.z0 - 1.42, HALL.z0 - 0.08, YD, YD + 2.5); }
  else cdoor.shut = solid(XD0, XD1, HALL.z0 - 0.075, HALL.z0 + 0.075, YD, YD + 2.5); }
{ // behind it: a bare service corridor, painted block, a caged bulb by the door, a conduit along the ceiling, and then only the dark
  const svc = wmat({ color: 0x585a52, roughness: 0.92 }, 1), lino = wmat({ color: 0x33342f, roughness: 0.55 }, 1), { x0, x1, z0, z1, c } = DCOR;
  mbox(x0 - 0.15, x1 + 0.15, YD - 0.2, YD, z0 - 0.15, z1, lino, true);
  mbox(x0 - 0.15, x0, YD, c, z0, z1, svc, true); mbox(x1, x1 + 0.15, YD, c, z0, z1, svc, true); mbox(x0, x1, YD, c, z0 - 0.15, z0, svc, true);
  mbox(x0 - 0.15, x1 + 0.15, c, c + 0.15, z0 - 0.15, z1, svc);
  mbox(x0, x1, YD, YD + 0.1, z0, z1 - 0.02, MX.beam);   // skirting, both sides (the floor shows between)
  mgeo(MX.steel, new THREE.CylinderGeometry(0.03, 0.03, DCL, 8), x1 - 0.12, c - 0.12, (z0 + z1) / 2, Math.PI / 2);
  for (let z = z1 - 1.5; z > z0; z -= 1.5) mgeo(MX.steel, new THREE.BoxGeometry(0.1, 0.02, 0.04), x1 - 0.12, c - 0.08, z);
  const bz = z1 - 1.2, b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), std({ color: 0xffffff, emissive: 0xffd8a8, emissiveIntensity: 1.6 })); b.position.set(XDM, c - 0.22, bz); stage.add(b);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, wireframe: true })); cage.position.copy(b.position); stage.add(cage);
  vbox(XDM - 0.004, XDM + 0.004, c - 0.16, c, bz - 0.004, bz + 0.004, MC.frame);
  const l = new THREE.PointLight(0xffd8a8, 1.6, 6, 1.2); l.position.set(XDM, c - 0.3, bz); stage.add(l); }
flushMerged();

/* ---- the two vents, each with its grille and its ladder ---- */
// grille: slats you can see light through, hinged on one edge; ladder: an iron ladder that drops out of the opening to the floor below
const slatTex = canvasTex(128, 128, (g, w) => { g.clearRect(0, 0, w, w); g.fillStyle = '#c9cdcf'; g.fillRect(0, 0, w, 10); g.fillRect(0, w - 10, w, 10); g.fillRect(0, 0, 10, w); g.fillRect(w - 10, 0, 10, w); for (let y = 18; y < w - 12; y += 14) g.fillRect(10, y, w - 20, 7); });
slatTex.wrapS = slatTex.wrapT = THREE.ClampToEdgeWrapping; slatTex.repeat.set(1, 1);
const hatches = [];
function makeHatch(id, x, z, ceilY, floorY, n, ductYaw, saveKey) {
  const h = HATCH_HW, H = { id, x, z, ceilY, floorY, n, ductYaw, saveKey, open: !!(window.SCF_SAVE && window.SCF_SAVE.get(saveKey)), t: 0, lt: 0 };
  H.t = H.lt = H.open ? 1 : 0;
  vbox(x - h - 0.03, x + h + 0.03, ceilY - 0.012, ceilY - 0.002, z - h - 0.03, z - h, MC.frame); vbox(x - h - 0.03, x + h + 0.03, ceilY - 0.012, ceilY - 0.002, z + h, z + h + 0.03, MC.frame);
  vbox(x - h - 0.03, x - h, ceilY - 0.012, ceilY - 0.002, z - h, z + h, MC.frame); vbox(x + h, x + h + 0.03, ceilY - 0.012, ceilY - 0.002, z - h, z + h, MC.frame);
  H.pivot = new THREE.Group(); H.pivot.position.set(x - h, ceilY - 0.006, z); stage.add(H.pivot);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(2 * h, 2 * h), std({ map: slatTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xa8adb0, roughness: 0.45, metalness: 0.6 }));
  gr.rotation.x = -Math.PI / 2; gr.position.x = h; H.pivot.add(gr);
  // the ladder
  const len = ceilY - floorY, L = new THREE.Group(), rw = 0.11;
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.018, len, 0.026), MC.iron); r.position.set(s * rw, len / 2, 0); L.add(r); }
  for (let y = 0.16; y < len - 0.05; y += 0.16) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2 * rw, 6), MC.iron); r.rotation.z = Math.PI / 2; r.position.set(0, y, 0); L.add(r); }
  L.rotation.y = Math.atan2(n[0], n[1]); L.position.set(x, floorY, z); stage.add(L); H.ladder = L; H.len = len;
  apply(H); hatches.push(H); return H;
}
function apply(H) {   // grille angle and ladder drop from H.t, H.lt
  H.pivot.rotation.z = -Math.min(1, H.t) * 1.75;
  const e = H.lt >= 1 ? 1 : 1 - Math.pow(1 - H.lt, 3);
  H.ladder.visible = H.lt > 0; H.ladder.position.y = H.floorY + (1 - e) * (H.len - 0.05);
}
const H1 = makeHatch('store', VENT.x, VENT.z, CEIL, 0, [0, -1], 0, 'storeVent');        // climb facing the EXIT wall; at the top, crawl off away from it
const H2 = makeHatch('cinema', HATCH2.x, HATCH2.z, BOX.c, 0, [0, 1], -Math.PI / 2, 'cinemaVent');  // in the box office; at the top, crawl back east
H1.into = [VENT.x, VENT.z - 0.36]; H2.into = [HATCH2.x + 0.36, HATCH2.z];

/* ------------------------------------------------------------------ */
/* the two things you can take                                         */
/* ------------------------------------------------------------------ */
const pickups = [];
// A soft warm glow so they can be found in the dark: a halo behind each, a little light on the shelf, and the thing itself
// brightening and dimming slowly. Each pulses (pulsePickups, every frame) only while it is still there to take.
const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,240,200,0.9)'); r.addColorStop(0.35, 'rgba(255,214,140,0.35)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
function glowFor(P, size, lightAt) {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffe2a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
  halo.scale.setScalar(size); halo.position.copy(P.at); stage.add(halo);
  const light = new THREE.PointLight(0xffd9a0, 0.3, 1.2, 2); light.position.copy(lightAt); stage.add(light);
  const mats = []; P.g.traverse((o) => { if (o.isMesh && o.material.emissive && !mats.includes(o.material)) mats.push(o.material); });
  for (const m of mats) { m.userData.e0 = m.emissive.clone(); m.userData.i0 = m.emissiveIntensity; }
  Object.assign(P, { halo, light, mats, ph: Math.random() * 6 });
}
function pulsePickups(t) {
  for (const P of pickups) {
    const on = P.g.visible, k = 0.5 + 0.5 * Math.sin(t * 2.2 + P.ph);
    P.halo.visible = on; P.light.intensity = on ? 0.22 + 0.22 * k : 0;
    if (!on) continue;
    P.halo.material.opacity = 0.3 + 0.3 * k;
    for (const m of P.mats) { if (m.userData.glow) { m.emissiveIntensity = m.userData.i0 * (0.7 + 0.5 * k); continue; } m.emissive.copy(m.color).multiplyScalar(0.08 + 0.14 * k); m.emissiveIntensity = 1; }
  }
}
const plastic = (c, r) => std({ color: c, roughness: r === undefined ? 0.42 : r });
{ // a white power strip on the second shelf of aisle 2: four sockets, a lit red switch, and its cord coiled beside it with the plug on the end
  const g = new THREE.Group(), white = plastic(0xeeeadf, 0.38), face = plastic(0xe2ddd0, 0.5), dark = plastic(0x1e1d1b, 0.7), metal = std({ color: 0xc9c4b4, roughness: 0.3, metalness: 0.9 });
  const L = 0.26, Wd = 0.06, Hh = 0.034;
  const body = new THREE.Mesh(new RoundedBoxGeometry(Wd, Hh, L, 3, 0.01), white); body.position.y = Hh / 2; g.add(body);
  const top = new THREE.Mesh(new RoundedBoxGeometry(Wd - 0.008, 0.004, L - 0.06, 2, 0.0018), face); top.position.set(0, Hh + 0.0005, -0.012); g.add(top);
  for (let i = 0; i < 4; i++) {   // each socket: a recessed face, two flat slots and a round earth hole
    const z = -0.088 + i * 0.05, s = new THREE.Group(); s.position.set(0, Hh + 0.002, z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.003, 24), plastic(0xd6d0c1, 0.55)); s.add(rim);
    for (const dx of [-0.0065, 0.0065]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.004, 0.009), dark); sl.position.set(dx, 0.0008, -0.002); s.add(sl); }
    const eh = new THREE.Mesh(new THREE.CylinderGeometry(0.0023, 0.0023, 0.004, 10), dark); eh.position.set(0, 0.0008, 0.008); s.add(eh);
    g.add(s);
  }
  // the switch, at the cord end: a dark bezel and a red rocker lit from inside
  const bez = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.006, 0.022, 2, 0.002), dark); bez.position.set(0, Hh + 0.002, L / 2 - 0.022); g.add(bez);
  const rockM = std({ color: 0xd83a22, roughness: 0.25, emissive: 0xff4a1e, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 }); rockM.userData.glow = true;
  const rock = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.007, 0.015, 2, 0.002), rockM); rock.position.set(0, Hh + 0.006, L / 2 - 0.022); rock.rotation.x = 0.18; g.add(rock);
  // the cord: out of the end, round in two loose loops on the shelf, and the plug lying at the end of it
  const pts = [new V3(0, 0.012, L / 2), new V3(0, 0.008, L / 2 + 0.03), new V3(-0.03, 0.006, L / 2 + 0.06)];
  for (let i = 0; i <= 40; i++) { const a = Math.PI * 0.5 + i / 40 * Math.PI * 3.6, r = 0.055 - i * 0.0004; pts.push(new V3(-0.085 + Math.cos(a) * r, 0.005 + (i % 9 === 0 ? 0.004 : 0), L / 2 - 0.02 + Math.sin(a) * r * 1.2)); }
  pts.push(new V3(-0.13, 0.006, 0.04), new V3(-0.12, 0.006, -0.02));
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.0042, 8), plastic(0xe58a2e, 0.5)); g.add(cord);
  const plug = new THREE.Group(); plug.position.set(-0.12, 0.012, -0.045); plug.rotation.y = 0.25;
  plug.add(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.036, 2, 0.005), white));
  for (const dx of [-0.0065, 0.0065]) { const pr = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.009, 0.016), metal); pr.position.set(dx, 0, -0.026); plug.add(pr); }
  const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.016, 8), metal); pe.rotation.x = Math.PI / 2; pe.position.set(0, -0.006, -0.026); plug.add(pe);
  g.add(plug);
  // a little price sticker on the side
  const st = signTex(['$4.99'], '#ffd23a', '#2a2208', 128, 48), sm = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.015), std({ map: st, roughness: 0.6 })); sm.rotation.y = Math.PI / 2; sm.position.set(Wd / 2 + 0.0008, Hh * 0.55, -0.04); g.add(sm);
  g.scale.setScalar(1.25); g.position.set(SOCKET_AT.x - 0.12, SOCKET_AT.y, SOCKET_AT.z); g.rotation.y = 0.18; stage.add(g);
  const P = { id: 'socket', g, at: new V3(SOCKET_AT.x - 0.12, SOCKET_AT.y + 0.035, SOCKET_AT.z), got: 'A power strip. The cord is still warm.' };
  pickups.push(P); glowFor(P, 0.8, new V3(SOCKET_AT.x + 0.15, SOCKET_AT.y + 0.2, SOCKET_AT.z));
}
{ // a red floor pump standing on the bottom shelf of the west wall, among boxed pool floats
  const g = new THREE.Group(), red = std({ color: 0xc8322a, roughness: 0.28, metalness: 0.15 }), blk = plastic(0x1f1e23, 0.6), chrome = std({ color: 0xd8d8d2, roughness: 0.18, metalness: 1 });
  // feet: a black T you stand on, with grip ridges
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.014, 0.045, 2, 0.005), blk); f.position.set(sx * 0.05, 0.007, 0); g.add(f);
    for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.038), plastic(0x2c2b31, 0.8)); r.position.set(sx * (0.025 + k * 0.016), 0.015, 0); g.add(r); } }
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.03, 20), blk); foot.position.y = 0.022; g.add(foot);
  // the barrel, with a black collar at each end and a white band with the maker's name
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.29, 24), red); barrel.position.y = 0.18; g.add(barrel);
  for (const y of [0.04, 0.322]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 24), blk); c.position.y = y; g.add(c); }
  const band = signTex(['AIR·MAX'], '#f4f1e8', '#c8322a', 256, 64); band.wrapS = THREE.RepeatWrapping;
  const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.0222, 0.0222, 0.05, 24, 1, true), std({ map: band, roughness: 0.4 })); bm.position.y = 0.22; g.add(bm);
  // the rod and the handle, its grips in black rubber
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.07, 10), chrome); rod.position.y = 0.365; g.add(rod);
  const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 12), blk); hbar.rotation.z = Math.PI / 2; hbar.position.y = 0.402; g.add(hbar);
  for (const sx of [-1, 1]) { const gr = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 4, 12), plastic(0x2a2930, 0.85)); gr.rotation.z = Math.PI / 2; gr.position.set(sx * 0.055, 0.402, 0); g.add(gr); }
  // the gauge low on the front: chrome bezel, white face, a red needle
  const gauge = new THREE.Group(); gauge.position.set(0, 0.075, 0.028); gauge.rotation.x = Math.PI / 2;
  gauge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.01, 24), chrome));
  const dial = signTex(['· · ·'], '#f7f4ea', '#333', 64, 64);
  const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.011, 24), std({ color: 0xf7f4ea, roughness: 0.3, map: dial })); gauge.add(fm);
  const nd = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.012, 0.014), std({ color: 0xd8261a, emissive: 0x8a1408, emissiveIntensity: 0.5 })); nd.position.set(0, 0.006, -0.004); nd.rotation.y = 0.7; gauge.add(nd);
  g.add(gauge);
  // the hose: out of the foot, up in a loop, clipped to the barrel, and the brass head hanging in its holder
  const hp = [new V3(0.03, 0.03, 0.0), new V3(0.075, 0.03, 0.02), new V3(0.09, 0.12, 0.03), new V3(0.06, 0.24, 0.03), new V3(0.03, 0.27, 0.02), new V3(0.026, 0.25, 0.0)];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 60, 0.0055, 8), blk));
  const clip = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.003, 6, 20), blk); clip.rotation.x = Math.PI / 2; clip.position.y = 0.25; g.add(clip);
  const brass = std({ color: 0xc9a24a, roughness: 0.25, metalness: 0.9 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.03, 12), brass); head.position.set(0.026, 0.232, 0.0); g.add(head);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.008), blk); lever.position.set(0.034, 0.24, 0.0); lever.rotation.z = -0.3; g.add(lever);
  g.position.set(PUMP_AT.x + 0.05, PUMP_AT.y, PUMP_AT.z); g.rotation.y = Math.PI / 2 + 0.3; stage.add(g);
  const P = { id: 'pump', g, at: new V3(PUMP_AT.x + 0.05, PUMP_AT.y + 0.2, PUMP_AT.z), got: 'An air pump. Something here was meant to be blown up.' };
  pickups.push(P); glowFor(P, 0.95, new V3(PUMP_AT.x + 0.35, PUMP_AT.y + 0.32, PUMP_AT.z));
  // the boxes of pool floats around it
  const fl = signTex(['SPLASH!'], '#3fb6c9', '#fff6c2', 256, 128);
  const fmb = std({ map: fl, roughness: 0.5 });
  for (const dz of [-0.62, -0.42, 0.42, 0.62]) { const b = new THREE.Mesh(boxGeo, fmb); b.scale.set(0.3, 0.24, 0.17); b.position.set(0.22, PUMP_AT.y + 0.12, PUMP_AT.z + dz); stage.add(b); }
}

/* ------------------------------------------------------------------ */
/* the instanced goods                                                 */
/* ------------------------------------------------------------------ */
function instances(list, geo, mat) {
  if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((b, i) => { o.position.set(b.x, b.y, b.z); o.rotation.set(b.lean, 0, 0); o.scale.set(b.sx, b.sy, b.sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, b.c); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; stage.add(im);
}
const goodsMat = std({ map: labelTex, roughness: 0.55 });
instances(goods, boxGeo, goodsMat);
instances(bottles, new THREE.CylinderGeometry(0.5, 0.5, 1, 10), std({ roughness: 0.3 }));
instances(cgoods, new RoundedBoxGeometry(1, 1, 1, 2, 0.12), caseGoods);

/* ------------------------------------------------------------------ */
/* the shelving that comes down                                        */
/* ------------------------------------------------------------------ */
// Take the power strip and, behind the shelving you took it from, the next run (between aisles 3 and 4; not the wall with the pump on it)
// groans, tips, and comes down into aisle 3 with a crash that shakes the floor: stock flying off it, the cart there knocked away down the
// aisle, the lights browning out. It stays down (SCF_SAVE shelfDown). It turns about its bottom edge on the aisle-3 side.
const bottleGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), bottleMat = std({ roughness: 0.3 });
{
  const P = FALL.pivot; P.position.set(FALL.px, 0, 0); stage.add(P);
  for (const m of FALL.kids) { stage.remove(m); m.position.x -= FALL.px; m.updateMatrix(); P.add(m); }
  const keep = { g: [], b: [] };
  for (const [k, list] of [['g', FALL.goods], ['b', FALL.bottles]]) for (const b of list) {
    if (b.x > FALL.bx && rand() < 0.3) {   // off the aisle-3 face as it goes over: onto the floor past it, or onto the fallen run itself
      const onTop = rand() < 0.55, ex = onTop ? FALL.px + 0.1 + rand() * 1.0 : FALL.px + 1.32 + rand() * 0.18, ey = (onTop ? 0.73 : 0) + Math.min(b.sx, b.sy, b.sz) / 2;
      FALL.spill.push({ k, b, s: null, e: new V3(ex, ey, clamp(b.z + (rand() - 0.5) * 0.8, GZ0 + 0.1, GZ1 - 0.1)), r: new THREE.Euler(Math.PI / 2 * (rand() < 0.6 ? 1 : 0), rand() * 6, rand() < 0.5 ? Math.PI / 2 : 0), at: 0.55 + rand() * 0.5, idx: 0 });
    } else keep[k].push(b);
  }
  const instIn = (parent, list, geo, mat, dx) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((b, i) => { o.position.set(b.x - dx, b.y, b.z); o.rotation.set(b.lean, 0, 0); o.scale.set(b.sx, b.sy, b.sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, b.c); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; parent.add(im); return im; };
  instIn(P, keep.g, boxGeo, goodsMat, FALL.px); instIn(P, keep.b, bottleGeo, bottleMat, FALL.px);
  for (const k of ['g', 'b']) { const L = FALL.spill.filter((q) => q.k === k); L.forEach((q, i) => { q.idx = i; }); FALL[k + 'Spill'] = instIn(stage, L.map((q) => q.b), k === 'g' ? boxGeo : bottleGeo, k === 'g' ? goodsMat : bottleMat, 0); if (FALL[k + 'Spill']) FALL[k + 'Spill'].instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
}
const _fo = new THREE.Object3D(), _fq = new THREE.Quaternion();
function placeSpill(q, u) {   // u: 0 where it left the shelf, 1 where it ends up
  const im = FALL[q.k + 'Spill']; if (!im) return; const b = q.b;
  if (u <= 0) { const a = FALL.pivot.rotation.z, dx = b.x - FALL.px, c = Math.cos(a), s = Math.sin(a); _fo.position.set(FALL.px + dx * c - b.y * s, dx * s + b.y * c, b.z); _fo.rotation.set(b.lean, 0, a); }
  else { const e = q.e, s0 = q.s; _fo.position.set(s0.x + (e.x - s0.x) * u, s0.y + (e.y - s0.y) * u * u, s0.z + (e.z - s0.z) * u); _fq.setFromEuler(q.r); _fo.quaternion.slerpQuaternions(q.q0, _fq, Math.min(1, u * 1.4)); }
  _fo.scale.set(b.sx, b.sy, b.sz); _fo.updateMatrix(); im.setMatrixAt(q.idx, _fo.matrix); im.instanceMatrix.needsUpdate = true;
}
function fallenSolids() {   // the run lying in aisle 3 (only its last 1.3 m of width, 0.74 high), and the cart where it was knocked to
  const i = solids.indexOf(FALL.solid); if (i >= 0) solids.splice(i, 1); FALL.solid = solid(FALL.px, FALL.px + 1.27, GZ0, GZ1, 0, 0.74);
  const j = solids.indexOf(FALL.cartSolid); if (j >= 0) solids.splice(j, 1); FALL.cartSolid = solid(3.25, 4.15, 12.5, 13.2, 0, 0.75);
}
function fallNow() {   // already down (come back later, or the strip was already taken)
  if (FALL.t >= 99) return; FALL.t = 99; FALL.pivot.rotation.z = -Math.PI / 2;
  for (const q of FALL.spill) { q.s = q.e.clone(); q.q0 = new THREE.Quaternion().setFromEuler(q.r); placeSpill(q, 1); }
  FALL.cart.position.set(3.7, 0, 12.85); FALL.cart.rotation.set(0, 2.1, 0); fallenSolids();
}
function startFall() { if (FALL.t >= 0) return; FALL.t = 0; if (window.SCF_SAVE) window.SCF_SAVE.set('shelfDown', true); groan(); }
const T_TIP = 0.45, T_HIT = 1.25;
function updateFall(dt) {
  if (FALL.t < 0 || FALL.t >= 99) return; const t0 = FALL.t; FALL.t += dt; const t = FALL.t, P = FALL.pivot;
  if (t < T_TIP) P.rotation.z = -0.05 * (t / T_TIP) - Math.sin(t * 46) * 0.012 * (t / T_TIP);                       // it rocks, groaning
  else if (t < T_HIT) { const u = (t - T_TIP) / (T_HIT - T_TIP); P.rotation.z = -(0.05 + (Math.PI / 2 - 0.05) * u * u); }   // and goes
  else { const u = t - T_HIT; P.rotation.z = -Math.PI / 2 + Math.abs(Math.sin(u * 22)) * 0.07 * Math.exp(-u * 9); }       // and bounces once, twice
  if (t0 < T_HIT && t >= T_HIT) { crash(); FALL.shake = 1; FALL.dark = 1.6; fallenSolids(); }
  for (const q of FALL.spill) {
    if (t < q.at) { placeSpill(q, 0); continue; }
    if (!q.s) { placeSpill(q, 0); q.s = _fo.position.clone(); q.q0 = _fo.quaternion.clone(); }
    placeSpill(q, Math.min(1, (t - q.at) / 0.42));
  }
  { const u = clamp((t - (T_HIT - 0.18)) / 0.5, 0, 1), e = 1 - Math.pow(1 - u, 3); FALL.cart.position.set(3.55 + 0.15 * e, 0, 8.4 + 4.45 * e); FALL.cart.rotation.y = 0.5 + 1.6 * e; }   // the cart, knocked away down the aisle
  if (t > T_HIT + 1.2) { P.rotation.z = -Math.PI / 2; FALL.t = 99; }
}

/* ------------------------------------------------------------------ */
/* light                                                               */
/* ------------------------------------------------------------------ */
// the cases light the aisle in front of them
for (const [z0, z1] of [[CZ0, (CZ0 + CZ1) / 2], [(CZ0 + CZ1) / 2, CZ1]]) {
  const l = new THREE.RectAreaLight(0xe4f4ff, 0.85, z1 - z0, 1.15); l.position.set(CASE_X - 0.04, 0.76, (z0 + z1) / 2); l.lookAt(0, 0.76, (z0 + z1) / 2); stage.add(l);
}
// the three panels still on overhead (the one over aisle 2 flickers)
const flick = [];
for (const p of panels) if (p.on) { const l = new THREE.RectAreaLight(0xeef2ff, 0.9, 0.56, 1.16); l.position.set(p.x, CEIL - 0.03, p.z); l.lookAt(p.x, 0, p.z); stage.add(l); flick.push({ p, l, base: l.intensity, f: 1, next: 0, bad: p.x === 5.95 }); }

/* ------------------------------------------------------------------ */
/* post-processing: like a cheap phone photo at night                  */
/* ------------------------------------------------------------------ */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(stage, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.7, 0.82));
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uBarrel: { value: 0.18 }, uPx: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uBarrel; uniform vec2 uPx; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main(){
    vec2 c = vUv - 0.5; float r2 = dot(c, c);
    vec2 uv = 0.5 + c * (1.0 - 0.5 * uBarrel + uBarrel * r2);
    vec2 d = (uv - 0.5) * (0.001 + r2 * 0.007);
    vec3 col = vec3(texture2D(tDiffuse, uv - d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d).b);
    vec3 soft = (texture2D(tDiffuse, uv + uPx * vec2(1.5, 0.5)).rgb + texture2D(tDiffuse, uv - uPx * vec2(1.5, 0.5)).rgb + texture2D(tDiffuse, uv + uPx * vec2(-0.5, 1.5)).rgb + texture2D(tDiffuse, uv - uPx * vec2(-0.5, 1.5)).rgb) * 0.25;
    col = mix(col, soft, 0.45);                                        // a small sensor: never quite sharp
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.86);
    col *= vec3(0.96, 1.0, 1.02);                                      // fluorescent: a little green-cold
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);
    col = col * 0.97 + vec3(0.012, 0.012, 0.016);
    col *= 1.0 - smoothstep(0.06, 0.62, r2) * 0.6;
    float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(613.0, 271.0)) - 0.5;
    col += n * (0.045 + 0.05 * (1.0 - l));                             // grain, worst in the dark
    col *= 1.0 - uFade;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`,
});
composer.addPass(grade);
function resize() {
  const pr = pickPR(); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); grade.uniforms.uPx.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ------------------------------------------------------------------ */
/* player (as in the bounce house, without the bounce)                 */
/* ------------------------------------------------------------------ */
let small = !!(window.SCF_SAVE && window.SCF_SAVE.get('small')), scaleK = small ? 0.42 : 1, PR, H_STAND, H_CROUCH, EYE;
function setScale(k) { scaleK = k; const PS = PS0 * k; PR = 0.28 * PS; H_STAND = 1.7 * PS; H_CROUCH = 0.86 * PS; EYE = 0.1 * PS; }
setScale(scaleK);
const player = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, h: H_STAND, crouch: false, onGround: false, ground: 0, bob: 0, camY: 0, mode: 'walk', lad: null };
const keys = Object.create(null);
let cDownAt = 0, cToggledOn = false;
const ceilAt = (x, z, y = 0) => (inDuctY(y, x, z) ? DUCT_Y + DUCT_H - 0.02 : x < -0.3 ? cinemaCeil(x, z) - 0.05 : (z < 0 ? TUBE_H : CEIL) - 0.05);   // the shop, the corridor, the cinema's rooms, or (up there) the duct
function groundAt(x, z, y, reach) { let g = 0; for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y1 <= y + reach && s.y1 > g) g = s.y1; return g; }
function collide() {
  const p = player.pos, v = player.vel;
  for (let it = 0; it < 2; it++) for (const s of solids) {
    if (p.x < s.x0 - PR || p.x > s.x1 + PR || p.z < s.z0 - PR || p.z > s.z1 + PR) continue;
    if (s.y1 <= p.y + STEP || s.y0 >= p.y + player.h) continue;
    const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1); let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz; if (d2 >= PR * PR) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), push = PR - d; dx /= d; dz /= d; p.x += dx * push; p.z += dz * push; const vn = v.x * dx + v.z * dz; if (vn < 0) { v.x -= vn * dx; v.z -= vn * dz; } }
    else { const a = p.x - s.x0, b = s.x1 - p.x, c = p.z - s.z0, e = s.z1 - p.z, m = Math.min(a, b, c, e); if (m === a) p.x = s.x0 - PR; else if (m === b) p.x = s.x1 + PR; else if (m === c) p.z = s.z0 - PR; else p.z = s.z1 + PR; }
  }
}
function stepPlayer(dt) {
  const p = player.pos, v = player.vel, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), il = Math.hypot(fw, st), sprint = keys.ShiftLeft || keys.ShiftRight;
  let spd = player.crouch || player.h < H_STAND * 0.76 ? (sprint ? 1.5 : 0.8) : (sprint ? 3.0 : 1.5); if (il > 1) spd /= il;
  const wx = (-sy * fw + cy * st) * spd, wz = (-cy * fw - sy * st) * spd, k = 1 - Math.exp(-(player.onGround ? 11 : 4) * dt);
  v.x += (wx - v.x) * k; v.z += (wz - v.z) * k; v.y -= G * dt;
  if (keys.Space && player.ground > 0 && v.y <= 0.01 && player.h > H_STAND * 0.9) { v.y = 3.0; player.ground = 0; }
  const wasOn = player.onGround, y0 = p.y;
  p.x += v.x * dt; p.z += v.z * dt; p.y += v.y * dt; collide();
  const g = groundAt(p.x, p.z, Math.max(p.y, y0), STEP);
  if (p.y <= g || (wasOn && v.y <= 0 && p.y - g < STEP + 0.02)) { if (!wasOn && v.y < -1.5) step(0.8); p.y = g; v.y = 0; player.onGround = true; } else player.onGround = false;
  player.ground = player.onGround ? 0.12 : Math.max(0, player.ground - dt);
  const c = ceilAt(p.x, p.z, p.y); if (p.y + player.h > c && v.y > 0) { v.y = 0; p.y = Math.max(g, c - player.h); }
  if (player.onGround) { const b0 = player.bob; player.bob += Math.hypot(v.x, v.z) * dt; if (Math.floor(b0 * 8 / Math.PI) !== Math.floor(player.bob * 8 / Math.PI)) step(clamp(Math.hypot(v.x, v.z) / 3, 0.25, 1)); }
}
function updatePlayer(dt) {
  { const kt = small ? 0.42 : 1; if (scaleK !== kt) setScale(Math.abs(kt - scaleK) < dt * 1.6 ? kt : scaleK + Math.sign(kt - scaleK) * dt * 1.6); }
  tryMountLadder();
  if (player.mode === 'ladder') updateLadder(dt);
  else for (let i = 0; i < 4; i++) { stepPlayer(dt / 4); ductStep(); if (player.mode !== 'walk') break; }
  let target = player.crouch ? H_CROUCH : H_STAND; const room = Math.max(0.12, ceilAt(player.pos.x, player.pos.z, player.pos.y) - player.pos.y); if (target > room) target = Math.min(player.h, room);   // (never squashed to nothing, whatever the ceiling says)
  player.h += clamp(target - player.h, -2.4 * dt, 2.4 * dt);
}
function placeCamera(dt) {
  const p = player.pos, sp = Math.hypot(player.vel.x, player.vel.z); let ey = p.y + player.h - EYE;
  player.camY += (ey - player.camY) * (Math.abs(ey - player.camY) > 0.5 ? 1 : Math.min(1, dt * 16));
  ey = player.camY + (player.onGround ? Math.abs(Math.sin(player.bob * 8)) * 0.009 * clamp(sp / 1.4, 0, 1.4) : 0);
  camera.position.set(p.x, ey, p.z); camera.rotation.set(player.pitch, player.yaw, 0); camera.updateMatrixWorld();
}
/* ---- climbing ladders, crawling the duct ---- */
// player.mode: 'walk' or 'ladder' (on H.ladder, H = player.lad). At the top of a ladder W takes you into the duct, if you fit.
// In the duct, step onto an open vent's opening and you are on the top of its ladder, facing it.
let ladLock = false, narrowSaid = -9;
const inDuctY = (y, x = player.pos.x, z = player.pos.z) => y > CEIL - 0.25 && inR(DUCT_BB, x, z);   // up in the duct (the hall's upper rows are higher, but nowhere near it)
const ladSpot = (H) => [H.x + H.n[0] * 0.12, H.z + H.n[1] * 0.12];
const ladTop = (H) => H.ceilY - player.h + 0.04;
function mountLadder(H, y) {
  player.mode = 'ladder'; player.lad = H; const [x, z] = ladSpot(H); player.pos.set(x, y, z); player.vel.set(0, 0, 0);
  player.crouch = false; cToggledOn = false; player.yaw = Math.atan2(H.n[0], H.n[1]);
}
function tryMountLadder() {   // walk up to a ladder that is down, facing it, and keep walking: you are on it
  if (player.mode !== 'walk' || !player.onGround || !keys.KeyW || inDuctY(player.pos.y)) return;
  for (const H of hatches) {
    if (H.lt < 1) continue; const [x, z] = ladSpot(H), p = player.pos;
    if (Math.hypot(p.x - (x + H.n[0] * 0.08), p.z - (z + H.n[1] * 0.08)) > 0.2 || Math.abs(p.y - H.floorY) > 0.2) continue;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); if (fx * -H.n[0] + fz * -H.n[1] < 0.6) continue;
    mountLadder(H, Math.max(p.y, H.floorY)); ladLock = false; return;
  }
}
function updateLadder(dt) {
  const H = player.lad, p = player.pos, fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  if (!keys.KeyW) ladLock = false;
  const [x, z] = ladSpot(H); p.x = x; p.z = z; player.vel.set(0, 0, 0);
  const top = ladTop(H), y0 = p.y; p.y = clamp(p.y + fw * (keys.ShiftLeft || keys.ShiftRight ? 1.3 : 0.8) * dt, H.floorY, top);
  if (Math.floor(y0 / 0.16) !== Math.floor(p.y / 0.16)) clank(0.25);
  player.bob += Math.abs(p.y - y0);
  if (fw > 0 && p.y >= top - 1e-4 && !ladLock) {   // the top: into the duct, if you are small enough
    if (scaleK > 0.5) { if (time - narrowSaid > 2.5) { narrowSaid = time; if (window.Equip) window.Equip.say('The vent is too narrow to crawl into.', 2.5); } return; }   // only shrunk do you fit
    player.mode = 'walk'; player.lad = null; p.set(H.into[0], DUCT_Y, H.into[1]); player.yaw = H.ductYaw; player.pitch = 0; player.onGround = true; player.ground = 0.12; return;
  }
  if (fw < 0 && p.y <= H.floorY + 1e-4) { player.mode = 'walk'; player.lad = null; p.x += H.n[0] * 0.2; p.z += H.n[1] * 0.2; player.onGround = true; return; }   // off the bottom, backwards
  if (keys.Space) { player.mode = 'walk'; player.lad = null; p.x += H.n[0] * 0.14; p.z += H.n[1] * 0.14; player.vel.set(H.n[0] * 0.5, 0, H.n[1] * 0.5); player.onGround = false; }   // let go
}
function ductStep() {   // after each step: the duct's walls, and its open vents
  const p = player.pos; if (!inDuctY(p.y) || player.mode !== 'walk') return;
  clampToDuct(p, PR);
  for (const H of hatches) if (H.lt >= 1 && Math.hypot(p.x - H.x, p.z - H.z) < HATCH_HW - PR * 0.5) { mountLadder(H, ladTop(H)); ladLock = !!keys.KeyW; return; }
}
window.__storeSize = {
  can(toSmall) {
    if (!on) return false; if (toSmall) return true;
    const p = player.pos, r = 0.28 * PS0 * 0.9, h = 1.7 * PS0; if (ceilAt(p.x, p.z, p.y) - p.y < h + 0.02) return false;   // no growing in the duct
    for (const s of solids) { if (s.y1 <= p.y + 0.02 || s.y0 >= p.y + h) continue; const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1); if ((p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz) < r * r) return false; }
    return true;
  },
  apply(toSmall) { small = toSmall; },
};
if (SOLO && !window.__sizeGunScene) window.__sizeGunScene = window.__storeSize;

/* ------------------------------------------------------------------ */
/* sound: the cases' compressors, the buzz of the one bad tube, feet   */
/* ------------------------------------------------------------------ */
let AC = null, acOut = null, acNoise = null, buzz = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx();
    acOut = AC.createGain(); acOut.gain.value = 0; acOut.connect(AC.destination);
    acNoise = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); { const d = acNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const hum = AC.createGain(); hum.gain.value = 0.05; hum.connect(acOut);
    for (const [f, a] of [[59.8, 1], [120.2, 0.5], [180.5, 0.18]]) { const o = AC.createOscillator(); o.frequency.value = f; const g = AC.createGain(); g.gain.value = a; o.connect(g); g.connect(hum); o.start(); }
    const src = AC.createBufferSource(); src.buffer = acNoise; src.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; const ng = AC.createGain(); ng.gain.value = 0.06; src.connect(lp); lp.connect(ng); ng.connect(acOut); src.start();
    const bz = AC.createOscillator(); bz.type = 'sawtooth'; bz.frequency.value = 120; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2; const bg = AC.createGain(); bg.gain.value = 0;
    bz.connect(bp); bp.connect(bg); bg.connect(acOut); bz.start(); buzz = bg;
  } catch (e) { AC = null; }
}
function step(k) {   // a small shoe on vinyl tile
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = acNoise; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 600; bp.Q.value = 1.4;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  s.connect(bp); bp.connect(g); g.connect(acOut); s.start(t, Math.random()); s.stop(t + 0.08);
}
function clank(k) {   // iron: a rung under a foot, a grille swinging, a ladder landing
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  for (const [f, a] of [[420 + Math.random() * 60, 1], [1130 + Math.random() * 90, 0.5], [2650, 0.2]]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * k * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + 0.5 * k); o.connect(g); g.connect(acOut); o.start(t); o.stop(t + 0.8); }
  const s = AC.createBufferSource(); s.buffer = acNoise; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; const g = AC.createGain(); g.gain.setValueAtTime(0.12 * k, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); s.connect(bp); bp.connect(g); g.connect(acOut); s.start(t, Math.random()); s.stop(t + 0.1);
}
function groan() {   // the shelving, starting to go: a long low metal groan, a few sharp ticks of bolts letting go
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t); o.frequency.linearRampToValueAtTime(48, t + 1.1);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(420, t); bp.frequency.linearRampToValueAtTime(260, t + 1.1); bp.Q.value = 4;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o.connect(bp); bp.connect(g); g.connect(acOut); o.start(t); o.stop(t + 1.25);
  for (const at of [0.05, 0.3, 0.42, 0.7]) { const s = AC.createBufferSource(); s.buffer = acNoise; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; const gg = AC.createGain(); gg.gain.setValueAtTime(0.25, t + at); gg.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.03); s.connect(hp); hp.connect(gg); gg.connect(acOut); s.start(t + at, Math.random()); s.stop(t + at + 0.05); }
}
function crash() {   // and down: a boom you feel, sheet metal, then everything on it going everywhere for a second or two
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  const th = AC.createOscillator(); th.frequency.setValueAtTime(70, t); th.frequency.exponentialRampToValueAtTime(30, t + 0.5); const tg = AC.createGain(); tg.gain.setValueAtTime(0.9, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); th.connect(tg); tg.connect(acOut); th.start(t); th.stop(t + 0.75);
  { const s = AC.createBufferSource(); s.buffer = acNoise; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(240, t + 1.4); const g = AC.createGain(); g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.connect(lp); lp.connect(g); g.connect(acOut); s.start(t); s.stop(t + 1.7); }
  for (let i = 0; i < 7; i++) { const o = AC.createOscillator(); o.type = 'triangle'; const f = 180 + Math.random() * 1500; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 1.5); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 + Math.random() * 1.2); o.connect(g); g.connect(acOut); o.start(t); o.stop(t + 2); }
  for (let i = 0; i < 34; i++) { const at = t + 0.05 + Math.pow(Math.random(), 1.6) * 2.2, s = AC.createBufferSource(); s.buffer = acNoise; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 3000; bp.Q.value = 2; const g = AC.createGain(), a = 0.05 + Math.random() * 0.14 * (1 - (at - t) / 2.6); g.gain.setValueAtTime(Math.max(0.01, a), at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04 + Math.random() * 0.06); s.connect(bp); bp.connect(g); g.connect(acOut); s.start(at, Math.random()); s.stop(at + 0.12); }
}
function pickSound() {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  for (const [f, at] of [[520, 0], [780, 0.08]]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.08, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.25); o.connect(g); g.connect(acOut); o.start(t + at); o.stop(t + at + 0.3); }
}

/* ------------------------------------------------------------------ */
/* taking things                                                       */
/* ------------------------------------------------------------------ */
const _v = new V3(), _d = new V3();
function aimed() {   // the thing in front of you, close enough to take
  camera.getWorldDirection(_d); let best = null, bc = 0.9;
  for (const P of pickups) { if (!P.g.visible || (P.id === 'socket' && player.pos.x < 4.85)) continue; _v.copy(P.at).sub(camera.position); const dist = _v.length(); if (dist > 1.1) continue; const c = _v.dot(_d) / dist; if (c > bc) { bc = c; best = P; } }
  return best;
}
function hatchAimed() {   // a shut vent you are looking up at from under it, or standing over in the duct
  const c = camera.position, inD = inDuctY(player.pos.y); camera.getWorldDirection(_d);
  for (const H of hatches) {
    if (H.open) continue;
    if (inD) { if (Math.hypot(player.pos.x - H.x, player.pos.z - H.z) < 0.42) return H; continue; }
    if (c.y > H.ceilY || Math.hypot(c.x - H.x, c.z - H.z) > 1.4) continue;
    _v.set(H.x - c.x, H.ceilY - c.y, H.z - c.z); const dist = _v.length(); if (dist < 2.8 && _v.dot(_d) / dist > 0.82) return H;
  }
  return null;
}
function openHatch(H) { H.open = true; if (window.SCF_SAVE) window.SCF_SAVE.set(H.saveKey, true); clank(0.7); }
function cdoorAimed() {   // the shut exit door at the top of the hall, from either side
  if (cdoor.open) return false; const c = camera.position; camera.getWorldDirection(_d); _v.set(XDM - c.x, YD + 1.1 - c.y, HALL.z0 - c.z); const d = _v.length();
  return d < 1.8 && (d < 0.6 || _v.dot(_d) / d > 0.6);
}
function openCDoor(quiet) {
  if (cdoor.open) return; cdoor.open = true; if (window.SCF_SAVE) window.SCF_SAVE.set('cinemaDoor', true);
  if (cdoor.shut) { const i = solids.indexOf(cdoor.shut); if (i >= 0) solids.splice(i, 1); cdoor.shut = null; }
  solid(XD0 - 0.03, XD0 + 0.06, HALL.z0 - 1.42, HALL.z0 - 0.08, YD, YD + 2.5);
  if (quiet) { cdoor.t = 1; cdoor.pivot.rotation.y = 1.5; } else clank(0.5);
}
const cinemaW = () => { const p = player.pos; return inR(DCOR, p.x, p.z) && p.y > YD - 0.4 && p.y < YD + 2.6 ? HALL.z0 - p.z : -1; };
function interact() {
  if (cdoorAimed() && !aimed()) { openCDoor(); return; }
  const Hv = hatchAimed(); if (Hv && !aimed()) { openHatch(Hv); return; }
  const P = aimed(); if (!P) return;
  P.g.visible = false; if (window.Equip) { window.Equip.add(P.id); window.Equip.say(P.got, 3.5); } pickSound();
  if (P.id === 'socket') startFall();
}
function syncPickups() { for (const P of pickups) P.g.visible = !(window.Equip && window.Equip.has(P.id)); if ((window.SCF_SAVE && window.SCF_SAVE.get('shelfDown')) || (window.Equip && window.Equip.has('socket'))) fallNow(); }

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
let on = false, dragging = false;
const locked = () => !!document.pointerLockElement;
addEventListener('keydown', (e) => {
  if (!on) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true; initAudio();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyC') { cDownAt = performance.now(); if (player.crouch) { player.crouch = false; cToggledOn = false; } else { player.crouch = true; cToggledOn = true; } }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyC' && cToggledOn && performance.now() - cDownAt > 380) { player.crouch = false; cToggledOn = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dragging = false; });
canvas.addEventListener('mousedown', (e) => {
  canvas.focus(); initAudio(); if (locked()) { if (e.button === 0) interact(); return; } dragging = true;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* stay in drag-look */ }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (!on || (!locked() && !dragging)) return; const sk = 0.0022 * (window.SCF_SETTINGS ? window.SCF_SETTINGS.get('sens') : 1); player.yaw -= (e.movementX || 0) * sk; player.pitch = clamp(player.pitch - (e.movementY || 0) * sk, -1.5, 1.5); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* coming and going (the same description of someone in a tunnel as js/bounce.js uses)                                  */
/* ------------------------------------------------------------------ */
const PORT = { mx: DOOR_X, mz: 0, ox: 0, oz: -1, hx: DOOR_X, hz: -HAND, dx: 0, dz: 1, yawIn: Math.PI };
function fromPort(st) {
  if (st.small !== undefined) { small = !!st.small; setScale(st.scale || (small ? 0.42 : 1)); }
  const P = PORT, p = player.pos, d = Math.max(0, st.d || 0), u = clamp(st.u || 0, -TUBE_HW + PR, TUBE_HW - PR);
  p.set(P.hx + P.dx * d - P.dz * u, Math.max(0, st.y || 0), P.hz + P.dz * d + P.dx * u);
  const vs = st.vs || 0, vu = st.vu || 0; player.vel.set(P.dx * vs - P.dz * vu, st.vy || 0, P.dz * vs + P.dx * vu);
  player.yaw = P.yawIn + (st.yaw || 0); player.pitch = st.pitch || 0; player.h = Math.min(st.h || H_STAND, H_STAND); player.crouch = !!st.crouch; player.bob = st.bob || 0;
  player.onGround = false; player.ground = 0; player.camY = p.y + player.h - EYE; player.mode = 'walk'; player.lad = null;
}
function leave() {
  const P = PORT, p = player.pos, v = player.vel, d = (p.x - P.hx) * P.dx + (p.z - P.hz) * P.dz, u = (p.x - P.hx) * -P.dz + (p.z - P.hz) * P.dx;
  const st = { port: 0, d, u, y: p.y, yaw: player.yaw - P.yawIn, pitch: player.pitch, vs: v.x * P.dx + v.z * P.dz, vu: v.x * -P.dz + v.z * P.dx, vy: v.y, h: player.h, crouch: player.crouch, bob: player.bob, small, scale: scaleK };
  if (!SOLO && !window.__storeReturn) {   // on the playroom's page (reached from the river hall through the cinema): to the pool on the level page
    on = false; for (const k in keys) keys[k] = false; try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {}
    if (window.SCF_SAVE) window.SCF_SAVE.set('small', small); (window.scfGo?scfGo('level1.html#store-exit'):(location.href='level1.html#store-exit')); return;
  }
  if (SOLO) { st.d = Math.max(0, -d); st.vs = -st.vs; st.vu = -st.vu; st.u = -u; st.yaw += Math.PI; fromPort(st); return; }   // on its own: turned round, back in
  on = false; st.held = Object.keys(keys).filter((k) => keys[k]); for (const k in keys) keys[k] = false;
  try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {}
  if (window.Equip) window.Equip.prompt(null);
  canvas.style.display = 'none'; window.__storeReturn(st);
}
let last = -1, time = 0, since = 0;
const markVisited = (id) => { const s = window.SCF_SAVE; if (!s) return; const v = Array.isArray(s.get('visited')) ? s.get('visited').slice() : []; if (!v.includes(id)) { v.push(id); s.set('visited', v); } };   // the level-select hall shows a line for every place you have been to
// Down the corridor behind the exit door, past where it becomes the river hall's: back to the river hall (handed over on the playroom's page,
// which builds this scene in the background), or, on a page without it (the level pages, store.html), to the playroom page, arriving there.
function toRiver(w) {
  const p = player.pos, v = player.vel, st = { w, u: p.x - XDM, y: Math.max(0, p.y - YD), yawRel: player.yaw, pitch: player.pitch, vin: -v.z, vlat: v.x, vy: v.y, h: player.h, crouch: player.crouch, small, scale: scaleK, held: Object.keys(keys).filter((k) => keys[k]) };
  on = false; for (const k in keys) keys[k] = false;
  try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {}
  if (window.Equip) window.Equip.prompt(null);
  if (window.__cinemaReturn) { canvas.style.display = 'none'; window.__cinemaReturn(st); return; }
  if (window.SCF_SAVE) { window.SCF_SAVE.set('small', small); window.SCF_SAVE.set('riverDoor', true); }
  (window.scfGo?scfGo('playroom.html#cinemadoor'):(location.href='playroom.html#cinemadoor'));
}
// From the river hall's corridor (js/playroom.js): out of this one, walking toward the exit door, which stands open.
window.__storeStartCinema = (st) => {
  if (on || !ready) return false; on = true; markVisited('store');
  small = !!st.small; setScale(st.scale || (small ? 0.42 : 1)); openCDoor(true);
  const w = Math.min(2 * DCW0 - st.w, DCW0 - 0.05), hw = (DCOR.x1 - DCOR.x0) / 2 - PR - 0.02, u = clamp(-(st.u || 0), -hw, hw), p = player.pos;
  p.set(XDM + u, YD + Math.max(0, st.y || 0) + 0.005, HALL.z0 - w); player.vel.set(-(st.vlat || 0), st.vy || 0, st.vin || 0);
  player.yaw = Math.PI + (st.yawRel || 0); player.pitch = st.pitch || 0; player.h = Math.min(st.h || H_STAND, H_STAND); player.crouch = !!st.crouch; player.bob = 0;
  player.onGround = false; player.ground = 0; player.camY = p.y + player.h - EYE; player.mode = 'walk'; player.lad = null;
  for (const k in keys) keys[k] = false; for (const c of st.held || []) keys[c] = true;
  syncPickups(); last = -1; since = 0; resize(); stage.fog.density = 0.06;
  canvas.style.display = 'block'; grade.uniforms.uFade.value = 1; initAudio();
  requestAnimationFrame(frame); return true;
};
window.__storeStart = (st) => {
  if (on || !ready) return false; on = true; markVisited('store');
  for (const k in keys) keys[k] = false; for (const c of (st && st.held) || []) keys[c] = true;
  fromPort(st || { d: 1.4 }); syncPickups(); stage.fog.density = 0.13; last = -1; since = 0; resize();
  canvas.style.display = 'block'; grade.uniforms.uFade.value = 1; initAudio();
  requestAnimationFrame(frame); return true;
};

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
function tick(dt) {
  if (keys.ArrowLeft) player.yaw += 1.8 * dt; if (keys.ArrowRight) player.yaw -= 1.8 * dt;
  if (keys.ArrowUp) player.pitch = Math.min(1.5, player.pitch + 1.3 * dt); if (keys.ArrowDown) player.pitch = Math.max(-1.5, player.pitch - 1.3 * dt);
  updatePlayer(dt);
  { const cw = cinemaW(); if (cw > DCW0) { toRiver(cw); if (!on) return -1; } }
  const d = (player.pos.z - PORT.hz) * PORT.dz, inTube = player.pos.z < 0 && Math.abs(player.pos.x - DOOR_X) < TUBE_HW + 0.3;   // how far past the corridor's hand-over point (the cinema's corridor and hall also lie at z < 0, far to the west)
  if (inTube && d < -0.6) { leave(); if (!on) return -1; return (player.pos.z - PORT.hz) * PORT.dz; }
  return inTube ? d : 99;
}
const _p = new V3();
function frame(now) {
  if (!on) return;
  requestAnimationFrame(frame);
  if (last < 0) last = now;
  const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; time += dt;
  const d = tick(dt); if (!on) return;
  placeCamera(dt);
  updateFall(dt);
  if (FALL.shake > 0) { const k = FALL.shake * FALL.shake * 0.035; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k; camera.updateMatrixWorld(); FALL.shake = Math.max(0, FALL.shake - dt * 1.3); }
  // the bad tube
  for (const F of flick) {
    if (F.bad && now >= F.next) { const r = Math.random(); F.f = r < 0.3 ? 0.05 + Math.random() * 0.2 : r < 0.4 ? 0 : 0.8 + Math.random() * 0.25; F.next = now + (F.f < 0.3 ? 30 + Math.random() * 90 : 120 + Math.random() * 1600); }
    F.l.intensity = F.base * F.f; F.p.m.material.emissiveIntensity = 1.8 * F.f;
    if (F.bad && buzz) buzz.gain.value = 0.012 * (F.f > 0.3 ? 1 : 0.2) * sstep(6, 1.5, Math.hypot(player.pos.x - F.p.x, player.pos.z - F.p.z));
  }
  if (FALL.dark > 0) { FALL.dark -= dt; const k = FALL.dark > 1.1 ? 0.05 : FALL.dark > 0.5 ? 0.35 + Math.random() * 0.4 : 0.8; for (const F of flick) { F.l.intensity *= k; F.p.m.material.emissiveIntensity *= k; } }   // the lights brown out
  pulsePickups(time);
  for (const H of hatches) {
    if (!H.open || H.lt >= 1) continue;
    H.t = Math.min(1, H.t + dt / 0.45);
    if (H.t > 0.55) { const was = H.lt; H.lt = Math.min(1, H.lt + dt / 0.32); if (was < 1 && H.lt >= 1) clank(1); }   // the ladder comes down fast and lands with a bang
    apply(H);
  }
  if (now >= boLamp.next) { const r = Math.random(); boLamp.f = r < 0.25 ? 0.1 + Math.random() * 0.3 : 0.75 + Math.random() * 0.3; boLamp.next = now + (boLamp.f < 0.5 ? 40 + Math.random() * 120 : 300 + Math.random() * 2200); }
  if (cdoor.open && cdoor.t < 1) { cdoor.t = Math.min(1, cdoor.t + dt / 0.8); cdoor.pivot.rotation.y = 1.5 * (1 - Math.pow(1 - cdoor.t, 3)); }
  boLamp.l.intensity = 3.6 * boLamp.f; boLamp.bulb.material.emissiveIntensity = 2 * boLamp.f;
  if (player.pos.x < -0.3 && (frame.scrT = (frame.scrT || 0) + dt) > 0.08) { frame.scrT = 0; paintScreen(); scrLight.intensity = SCR_I * (0.85 + Math.random() * 0.3); }
  { const p = player.pos, big = inR(HALL, p.x, p.z) || (inR(CORR, p.x, p.z) && p.z < HALL.z1), fd = big ? 0.016 : p.x < -0.3 && !inDuctY(p.y) ? 0.06 : 0.13;   // the haze: thick in the shop, thinner in the cinema, thin in the big hall
    stage.fog.density += (fd - stage.fog.density) * Math.min(1, dt * 1.5); }
  const P = aimed(), Hv = P ? null : hatchAimed();   // (and, failing both, the exit door at the top of the hall)
  if (window.Equip) {
    if (P) { _p.copy(P.at).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); }
    else if (Hv) { _p.set(Hv.x, Hv.ceilY - 0.02, Hv.z).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); }
    else if (cdoorAimed()) { _p.set(XDM, YD + 1.1, HALL.z0).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); }
    else window.Equip.prompt(null);
  }
  grade.uniforms.uTime.value = time; since += dt; grade.uniforms.uFade.value = Math.max(1 - sstep(-0.6, -0.05, d), 1 - sstep(0, 0.5, since), sstep(DCW0 - 3.5, DCW0 - 0.15, cinemaW()));   // half a second of black on arrival; dark again walking back out
  if (AC && acOut) acOut.gain.value += (sstep(-0.6, 1.2, d) * 0.9 - acOut.gain.value) * Math.min(1, dt * 6);
  composer.render();
}

/* ------------------------------------------------------------------ */
/* get ready                                                           */
/* ------------------------------------------------------------------ */
let ready = false;
window.__store = { player, camera, keys, pickups, solids, grade, interact, hatches, openHatch, H1, H2, FALL, startFall, updateFall, fallNow, get on() { return on; },
  look(x, y, z, yaw, pitch) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.yaw = yaw; player.pitch = pitch || 0; player.camY = y + player.h - EYE; },
  sim(sec) { for (let t = 0; t < sec && on; t += 1 / 60) tick(1 / 60); const p = player.pos; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +player.yaw.toFixed(2)]; } };
{
  // the room's own picture as what the floor and the glass reflect
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), cubeCam = new THREE.CubeCamera(0.05, 30, cubeRT);
  cubeCam.position.set(7.4, 0.4, 6.0); stage.add(cubeCam); cubeCam.update(renderer, stage); stage.remove(cubeCam);
  const pm = new THREE.PMREMGenerator(renderer); stage.environment = pm.fromCubemap(cubeRT.texture).texture; pm.dispose(); cubeRT.dispose();
  try { renderer.compile(stage, camera); } catch (e) {}
  ready = true; window.__storeReady = true;
  if (SOLO) window.__storeStart({ d: 1.2 });
}
