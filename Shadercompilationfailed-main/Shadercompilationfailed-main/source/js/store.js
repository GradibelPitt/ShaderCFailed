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
  const xs = sides.map((sd) => bx + sd * depth).concat([bx]); solid(Math.min(...xs) - 0.01, Math.max(...xs) + 0.01, z0, z1, 0, 99);
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
box(0, W, 0.35, 1.75, D + 0.05, D + 0.1, M.window); solid(0, W, D, D + 0.2, 0, 99);
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
  solid(CASE_X - 0.05, W, CZ0, CZ1, 0, 99);
}
// the long shelving runs (gondolas) and the wall shelving on the west side
const SOCKET_AT = new V3(5.08, LEVELS[1], 7.05), PUMP_AT = new V3(0.24, LEVELS[0], 10.2);
shelving(7.1, [1, -1], GZ0, GZ1, 0.36);                                         // between aisles 1 and 2
shelving(4.8, [1, -1], GZ0, GZ1, 0.36, { '1:1': [SOCKET_AT.z - 0.22, SOCKET_AT.z + 0.22] });   // aisle 2 side: the power strip
shelving(2.5, [1, -1], GZ0, GZ1, 0.36);                                         // between aisles 3 and 4
shelving(0.02, [1], 1.0, 14.6, 0.42, { '1:0': [PUMP_AT.z - 0.3, PUMP_AT.z + 0.3] });           // the west wall: seasonal, pool things
// end caps at the front, a few tall stacks of the same thing
for (const bx of [7.1, 4.8, 2.5]) { box(bx - 0.36, bx + 0.36, 0, 0.08, GZ1 + 0.01, GZ1 + 0.4, M.dark); solid(bx - 0.36, bx + 0.36, GZ1, GZ1 + 0.4, 0, 99); const col = new THREE.Color(pick(PALETTE));
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
  cart.position.set(3.55, 0, 8.4); cart.rotation.y = 0.5; stage.add(cart); solid(3.15, 3.95, 8.2, 9.2, 0, 99);
}
// ceiling panels on a grid; nearly all of them off
const panels = [];
for (const x of [7.95, 5.95, 3.65, 1.4]) for (let z = 1.2; z < D - 0.5; z += 2.4) {
  const on = (x === 5.95 && Math.abs(z - 6.0) < 0.1) || (x === 1.4 && Math.abs(z - 10.8) < 0.1) || (x === 3.65 && Math.abs(z - 13.2) < 0.1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.02, 1.18), on ? M.panelOn.clone() : M.panelOff); m.position.set(x, CEIL - 0.01, z); stage.add(m);
  panels.push({ m, on, x, z });
}

/* ------------------------------------------------------------------ */
/* the two things you can take                                         */
/* ------------------------------------------------------------------ */
const pickups = [];
{ // a white power strip, its orange cord in a loose coil, on the second shelf of aisle 2
  const g = new THREE.Group(), white = std({ color: 0xf1eee4, roughness: 0.4 }), hole = std({ color: 0x2c2a26, roughness: 0.8 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.2, 2, 0.008), white); g.add(body);
  for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.024), hole); h.position.set(0, 0.016, -0.065 + i * 0.04); g.add(h); }
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.022), std({ color: 0xe2552c, emissive: 0xff4a1e, emissiveIntensity: 0.9 })); sw.position.set(0, 0.018, 0.092); g.add(sw);
  const pts = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 4.2, r = 0.05 + 0.012 * Math.sin(i * 0.7); pts.push(new V3(-0.07 + Math.cos(a) * r * 0.8, 0.004 + i * 0.0003, -0.16 + Math.sin(a) * r)); }
  pts.unshift(new V3(0, 0, -0.1)); const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.005, 6), std({ color: 0xe08a2e, roughness: 0.5 })); cord.position.y = -0.012; g.add(cord);
  g.position.set(SOCKET_AT.x - 0.06, SOCKET_AT.y + 0.016, SOCKET_AT.z); g.rotation.y = 0.12; stage.add(g);
  pickups.push({ id: 'socket', g, at: new V3(SOCKET_AT.x - 0.06, SOCKET_AT.y + 0.03, SOCKET_AT.z), got: 'A power strip. The cord is still warm.' });
}
{ // a red floor pump standing on the bottom shelf of the west wall, among boxed pool floats
  const g = new THREE.Group(), red = std({ color: 0xc8382a, roughness: 0.35, metalness: 0.1 }), blk = std({ color: 0x222127, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.05), blk); base.position.y = 0.006; g.add(base);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 16), red); barrel.position.y = 0.152; g.add(barrel);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), M.metal); rod.position.y = 0.32; g.add(rod);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), blk); handle.rotation.z = Math.PI / 2; handle.position.y = 0.355; g.add(handle);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16), std({ color: 0xf2efe6, roughness: 0.3 })); gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 0.07, 0.024); g.add(gauge);
  const pts = [new V3(0.02, 0.05, 0), new V3(0.07, 0.03, 0.01), new V3(0.09, 0.12, 0.02), new V3(0.06, 0.2, 0.01), new V3(0.03, 0.24, 0.0)];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.006, 6), blk));
  g.position.set(PUMP_AT.x + 0.05, PUMP_AT.y, PUMP_AT.z); g.rotation.y = Math.PI / 2 + 0.3; stage.add(g);
  pickups.push({ id: 'pump', g, at: new V3(PUMP_AT.x + 0.05, PUMP_AT.y + 0.18, PUMP_AT.z), got: 'An air pump. Something here was meant to be blown up.' });
  // the boxes of pool floats around it
  const fl = signTex(['SPLASH!'], '#3fb6c9', '#fff6c2', 256, 128);
  const fm = std({ map: fl, roughness: 0.5 });
  for (const dz of [-0.62, -0.42, 0.42, 0.62]) { const b = new THREE.Mesh(boxGeo, fm); b.scale.set(0.3, 0.24, 0.17); b.position.set(0.22, PUMP_AT.y + 0.12, PUMP_AT.z + dz); stage.add(b); }
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
const player = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, h: H_STAND, crouch: false, onGround: false, ground: 0, bob: 0, camY: 0 };
const keys = Object.create(null);
let cDownAt = 0, cToggledOn = false;
const ceilAt = (x, z) => (z < 0 ? TUBE_H : CEIL) - 0.05;
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
  const c = ceilAt(p.x, p.z); if (p.y + player.h > c && v.y > 0) { v.y = 0; p.y = Math.max(g, c - player.h); }
  if (player.onGround) { const b0 = player.bob; player.bob += Math.hypot(v.x, v.z) * dt; if (Math.floor(b0 * 8 / Math.PI) !== Math.floor(player.bob * 8 / Math.PI)) step(clamp(Math.hypot(v.x, v.z) / 3, 0.25, 1)); }
}
function updatePlayer(dt) {
  { const kt = small ? 0.42 : 1; if (scaleK !== kt) setScale(Math.abs(kt - scaleK) < dt * 1.6 ? kt : scaleK + Math.sign(kt - scaleK) * dt * 1.6); }
  for (let i = 0; i < 4; i++) stepPlayer(dt / 4);
  let target = player.crouch ? H_CROUCH : H_STAND; const room = ceilAt(player.pos.x, player.pos.z) - player.pos.y; if (target > room) target = Math.min(player.h, room);
  player.h += clamp(target - player.h, -2.4 * dt, 2.4 * dt);
}
function placeCamera(dt) {
  const p = player.pos, sp = Math.hypot(player.vel.x, player.vel.z); let ey = p.y + player.h - EYE;
  player.camY += (ey - player.camY) * (Math.abs(ey - player.camY) > 0.5 ? 1 : Math.min(1, dt * 16));
  ey = player.camY + (player.onGround ? Math.abs(Math.sin(player.bob * 8)) * 0.009 * clamp(sp / 1.4, 0, 1.4) : 0);
  camera.position.set(p.x, ey, p.z); camera.rotation.set(player.pitch, player.yaw, 0); camera.updateMatrixWorld();
}
window.__storeSize = {
  can(toSmall) {
    if (!on) return false; if (toSmall) return true;
    const p = player.pos, r = 0.28 * PS0 * 0.9, h = 1.7 * PS0; if (ceilAt(p.x, p.z) - p.y < h + 0.02) return false;
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
  for (const P of pickups) { if (!P.g.visible) continue; _v.copy(P.at).sub(camera.position); const dist = _v.length(); if (dist > 1.1) continue; const c = _v.dot(_d) / dist; if (c > bc) { bc = c; best = P; } }
  return best;
}
function interact() {
  const P = aimed(); if (!P) return;
  P.g.visible = false; if (window.Equip) { window.Equip.add(P.id); window.Equip.say(P.got, 3.5); } pickSound();
}
function syncPickups() { for (const P of pickups) P.g.visible = !(window.Equip && window.Equip.has(P.id)); }

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
  player.onGround = false; player.ground = 0; player.camY = p.y + player.h - EYE;
}
function leave() {
  const P = PORT, p = player.pos, v = player.vel, d = (p.x - P.hx) * P.dx + (p.z - P.hz) * P.dz, u = (p.x - P.hx) * -P.dz + (p.z - P.hz) * P.dx;
  const st = { port: 0, d, u, y: p.y, yaw: player.yaw - P.yawIn, pitch: player.pitch, vs: v.x * P.dx + v.z * P.dz, vu: v.x * -P.dz + v.z * P.dx, vy: v.y, h: player.h, crouch: player.crouch, bob: player.bob, small, scale: scaleK };
  if (SOLO || !window.__storeReturn) { st.d = Math.max(0, -d); st.vs = -st.vs; st.vu = -st.vu; st.u = -u; st.yaw += Math.PI; fromPort(st); return; }   // on its own: turned round, back in
  on = false; st.held = Object.keys(keys).filter((k) => keys[k]); for (const k in keys) keys[k] = false;
  try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {}
  if (window.Equip) window.Equip.prompt(null);
  canvas.style.display = 'none'; window.__storeReturn(st);
}
let last = -1, time = 0, since = 0;
const markVisited = (id) => { const s = window.SCF_SAVE; if (!s) return; const v = Array.isArray(s.get('visited')) ? s.get('visited').slice() : []; if (!v.includes(id)) { v.push(id); s.set('visited', v); } };   // the level-select hall shows a line for every place you have been to
window.__storeStart = (st) => {
  if (on || !ready) return false; on = true; markVisited('store');
  for (const k in keys) keys[k] = false; for (const c of (st && st.held) || []) keys[c] = true;
  fromPort(st || { d: 1.4 }); syncPickups(); last = -1; since = 0; resize();
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
  const d = (player.pos.z - PORT.hz) * PORT.dz;   // how far past the corridor's hand-over point
  if (player.pos.z < 0 && d < -0.6) { leave(); if (!on) return -1; return (player.pos.z - PORT.hz) * PORT.dz; }
  return player.pos.z < 0 ? d : 99;
}
const _p = new V3();
function frame(now) {
  if (!on) return;
  requestAnimationFrame(frame);
  if (last < 0) last = now;
  const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; time += dt;
  const d = tick(dt); if (!on) return;
  placeCamera(dt);
  // the bad tube
  for (const F of flick) {
    if (F.bad && now >= F.next) { const r = Math.random(); F.f = r < 0.3 ? 0.05 + Math.random() * 0.2 : r < 0.4 ? 0 : 0.8 + Math.random() * 0.25; F.next = now + (F.f < 0.3 ? 30 + Math.random() * 90 : 120 + Math.random() * 1600); }
    F.l.intensity = F.base * F.f; F.p.m.material.emissiveIntensity = 1.8 * F.f;
    if (F.bad && buzz) buzz.gain.value = 0.012 * (F.f > 0.3 ? 1 : 0.2) * sstep(6, 1.5, Math.hypot(player.pos.x - F.p.x, player.pos.z - F.p.z));
  }
  const P = aimed();
  if (window.Equip) { if (P) { _p.copy(P.at).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); } else window.Equip.prompt(null); }
  grade.uniforms.uTime.value = time; since += dt; grade.uniforms.uFade.value = Math.max(1 - sstep(-0.6, -0.05, d), 1 - sstep(0, 0.5, since));   // half a second of black on arrival; dark again walking back out
  if (AC && acOut) acOut.gain.value += (sstep(-0.6, 1.2, d) * 0.9 - acOut.gain.value) * Math.min(1, dt * 6);
  composer.render();
}

/* ------------------------------------------------------------------ */
/* get ready                                                           */
/* ------------------------------------------------------------------ */
let ready = false;
window.__store = { player, camera, keys, pickups, solids, grade, interact, get on() { return on; },
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
