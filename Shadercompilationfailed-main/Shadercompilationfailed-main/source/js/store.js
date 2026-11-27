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
shelving(2.5, [1, -1], GZ0, GZ1, 0.36);                                         // between aisles 3 and 4
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
  cart.position.set(3.55, 0, 8.4); cart.rotation.y = 0.5; stage.add(cart); solid(3.15, 3.95, 8.2, 9.2, 0, CEIL);
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
// The box office opens onto the lobby, and the lobby onto the one screen. The duct, the box office, the lobby and the screen are all
// in this same scene, west of the shop (x < 0) and over it (y > CEIL), shut off from it by its walls and ceiling.
const DUCT_Y = 2.52, DUCT_H = 0.3, DUCT_HW = 0.18, HATCH_HW = 0.15;
const DUCT_PATH = [[0.9, 15.35], [0.9, 13.2], [2.6, 13.2], [2.6, 10.4], [0.4, 10.4], [0.4, 8.0], [-1.6, 8.0], [-1.6, 9.6], [-3.4, 9.6]];
const BOX = { x0: -6.4, x1: -2.2, z0: 7.4, z1: 11.8, c: 2.48 };     // the box office
const LOBBY = { x0: -12, x1: -6.4, z0: 4.0, z1: 14.0, c: 3.4 };
const HALL = { x0: -13.5, x1: -5.0, z0: -8.5, z1: 3.85, c: 4.0 };   // the screen
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const cinemaCeil = (x, z) => (inR(BOX, x, z) ? BOX.c : inR(LOBBY, x, z) ? LOBBY.c : inR(HALL, x, z) ? HALL.c : 3);
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
  for (const [sx, sz, yb] of [[P[0][0], P[0][1], CEIL], [P[last][0], P[last][1], 2.48]]) { const h = HATCH_HW;
    vbox(sx - h - t, sx - h, yb, y0, sz - h, sz + h, MC.duct); vbox(sx + h, sx + h + t, yb, y0, sz - h, sz + h, MC.duct);
    vbox(sx - h - t, sx + h + t, yb, y0, sz - h - t, sz - h, MC.duct); vbox(sx - h - t, sx + h + t, yb, y0, sz + h, sz + h + t, MC.duct); }
  // work lamps: little caged bulbs clipped to the duct roof, so the metal can be seen all the way along
  const bulbM = std({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 2.2 });
  for (const [x, z, k] of [[0.9, 14.2, 1.0], [1.7, 13.2, 0.8], [2.6, 11.6, 0.95], [1.5, 10.4, 0.85], [0.4, 9.0, 0.85], [-0.6, 8.0, 0.8], [-1.6, 9.0, 0.7]]) {
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
// walls of a room with gaps: each gap [a0, a1, y0, y1] along the wall (y1 = top of the gap)
function wallX(x, z0, z1, top, mat, gaps = [], th = 0.15) {   // a wall along z at x
  let z = z0; const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
  for (const [a, b, y0, y1] of gs) { if (a > z) box(x - th / 2, x + th / 2, 0, top, z, a, mat, true); if (y0 > 0) box(x - th / 2, x + th / 2, 0, y0, a, b, mat, true); if (y1 < top) box(x - th / 2, x + th / 2, y1, top, a, b, mat, y0 > 0); z = b; }
  if (z < z1) box(x - th / 2, x + th / 2, 0, top, z, z1, mat, true);
}
function wallZ(z, x0, x1, top, mat, gaps = [], th = 0.15) {   // a wall along x at z
  let x = x0; const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
  for (const [a, b, y0, y1] of gs) { if (a > x) box(x, a, 0, top, z - th / 2, z + th / 2, mat, true); if (y0 > 0) box(a, b, 0, y0, z - th / 2, z + th / 2, mat, true); if (y1 < top) box(a, b, y1, top, z - th / 2, z + th / 2, mat, y0 > 0); x = b; }
  if (x < x1) box(x, x1, 0, top, z - th / 2, z + th / 2, mat, true);
}
const HATCH2 = { x: DUCT_PATH[DUCT_PATH.length - 1][0], z: DUCT_PATH[DUCT_PATH.length - 1][1] };
// -- box office: beige walls, linoleum, a counter under the ticket windows, one hanging lamp that cannot hold steady
slab(BOX.x0, BOX.x1, BOX.z0, BOX.z1, 0.002, MC.boFloor, false);
slab(BOX.x0, BOX.x1, BOX.z0, BOX.z1, BOX.c, M.ceil, true, [HATCH2.x, HATCH2.z, HATCH_HW]);
wallX(BOX.x1, BOX.z0, BOX.z1, BOX.c, MC.boWall);
wallZ(BOX.z0, BOX.x0, BOX.x1, BOX.c, MC.boWall); wallZ(BOX.z1, BOX.x0, BOX.x1, BOX.c, MC.boWall);
wallX(BOX.x0, BOX.z0, BOX.z1, BOX.c, MC.boWall, [[7.8, 8.6, 0, 1.6], [9.4, 11.4, 0.72, 1.42]]);   // the door out, and the ticket windows
box(BOX.x0 - 0.01, BOX.x0 + 0.01, 0.72, 1.42, 9.4, 11.4, MC.ticketGlass);
for (const z of [10.06, 10.73]) vbox(BOX.x0 - 0.03, BOX.x0 + 0.03, 0.72, 1.42, z - 0.025, z + 0.025, MC.frame);
for (const zc of [9.73, 10.4, 11.07]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), MC.frame); m.position.set(BOX.x0 + 0.012, 1.08, zc); m.rotation.y = Math.PI / 2; stage.add(m); }   // speaking holes
{ const t = signTex(['TICKETS'], '#2a1410', '#e8c46a', 512, 128); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 })); m.position.set(BOX.x0 - 0.09, 1.7, 10.4); m.rotation.y = -Math.PI / 2; stage.add(m); }
box(BOX.x0 + 0.08, BOX.x0 + 0.62, 0, 0.66, 9.2, 11.6, MC.boWall, true); vbox(BOX.x0 + 0.06, BOX.x0 + 0.66, 0.66, 0.7, 9.18, 11.62, MC.frame);   // the counter
vbox(BOX.x0 + 0.2, BOX.x0 + 0.5, 0.7, 0.9, 10.2, 10.6, std({ color: 0x3a3836, roughness: 0.5, metalness: 0.3 }));   // the till
vbox(BOX.x0 + 0.22, BOX.x0 + 0.48, 0.9, 0.98, 10.28, 10.52, std({ color: 0x1a2a20, emissive: 0x1a3a22, emissiveIntensity: 0.5 }));
{ const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), std({ color: 0xc94a3a, roughness: 0.7 })); roll.rotation.z = Math.PI / 2; roll.position.set(BOX.x0 + 0.35, 0.76, 9.6); stage.add(roll); }   // a roll of tickets
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), MC.paper); m.rotation.x = -Math.PI / 2; m.rotation.z = rand() * 6; m.position.set(BOX.x0 + 0.8 + rand() * 2.6, 0.004 + i * 0.0003, 8.0 + rand() * 3.4); stage.add(m); }   // torn stubs on the floor
{ const st = new THREE.Group(); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), MC.velvet); seat.position.y = 0.52; st.add(seat); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 8), MC.iron); leg.position.y = 0.26; st.add(leg); st.position.set(BOX.x0 + 1.0, 0, 10.9); st.rotation.z = 1.45; st.position.y = 0.14; stage.add(st); }   // the stool, knocked over
vbox(BOX.x1 - 0.5, BOX.x1 - 0.08, 0, 1.1, 10.6, 11.6, std({ color: 0x5a5c4e, roughness: 0.6, metalness: 0.4 })); solid(BOX.x1 - 0.5, BOX.x1 - 0.08, 10.6, 11.6, 0, 1.1);   // a filing cabinet
const boLamp = { l: new THREE.PointLight(0xffc98a, 3.6, 8, 1.0), bulb: null, f: 1, next: 0 };
{ const cord = vbox(-4.6 - 0.004, -4.6 + 0.004, 1.9, BOX.c, 9.2 - 0.004, 9.2 + 0.004, MC.frame); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 16, 1, true), std({ color: 0x2e4a3a, side: THREE.DoubleSide, roughness: 0.6 })); shade.position.set(-4.6, 1.86, 9.2); stage.add(shade);
  boLamp.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std({ color: 0xffffff, emissive: 0xffd09a, emissiveIntensity: 2 })); boLamp.bulb.position.set(-4.6, 1.8, 9.2); stage.add(boLamp.bulb);
  boLamp.l.position.set(-4.6, 1.76, 9.2); stage.add(boLamp.l); void cord; }
// -- lobby: patterned carpet, maroon walls with a gold rail, the posters still up, the concession stand, the front doors chained
slab(LOBBY.x0, LOBBY.x1, LOBBY.z0, LOBBY.z1, 0.003, MC.carpet, false); slab(LOBBY.x0, LOBBY.x1, LOBBY.z0, LOBBY.z1, LOBBY.c, MC.ceilDark, true);
wallX(LOBBY.x0, LOBBY.z0, LOBBY.z1, LOBBY.c, MC.maroon, [[7.4, 10.6, 0.04, 2.3]]);
box(LOBBY.x0 - 0.02, LOBBY.x0 + 0.02, 0.04, 2.3, 7.4, 10.6, MC.glassDark, true);   // the front doors: dark glass, nothing behind
for (const z of [8.2, 9.0, 9.8]) vbox(LOBBY.x0 + 0.02, LOBBY.x0 + 0.05, 0.04, 2.3, z - 0.03, z + 0.03, MC.gold);
for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 12), MC.iron); l.position.set(LOBBY.x0 + 0.08, 1.05 + Math.sin(i * 0.7) * 0.05, 8.65 + i * 0.07); l.rotation.y = Math.PI / 2; l.rotation.x = i % 2 ? Math.PI / 2 : 0; stage.add(l); }   // the chain through the handles
wallX(LOBBY.x1, LOBBY.z0, BOX.z0, LOBBY.c, MC.maroon); wallX(LOBBY.x1, BOX.z1, LOBBY.z1, LOBBY.c, MC.maroon);
box(LOBBY.x1 - 0.075, LOBBY.x1 + 0.075, BOX.c, LOBBY.c, BOX.z0, BOX.z1, MC.maroon);   // over the box office
wallZ(LOBBY.z1, LOBBY.x0, LOBBY.x1, LOBBY.c, MC.maroon);
wallZ(LOBBY.z0, LOBBY.x0, LOBBY.x1, LOBBY.c, MC.maroon, [[-7.3, -6.5, 0, 2.8]]);   // the way in to the screen
for (let k = 1; k <= 5; k++) box(-7.35, -6.45, 0, k * 0.12, 3.7, 4.0 + (6 - k) * 0.3, MC.carpet, true);   // up five steps: the doorway is level with the back row
for (const [z0, z1, x] of [[LOBBY.z0, LOBBY.z1, LOBBY.x0 + 0.08]]) vbox(x - 0.01, x + 0.02, 0.9, 0.94, z0, z1, MC.gold);
vbox(LOBBY.x0, LOBBY.x1, 0.9, 0.94, LOBBY.z1 - 0.09, LOBBY.z1 - 0.07, MC.gold);
{ // posters in lightboxes, most of the tubes behind them dead
  const titles = [['THE LONG', 'HALLWAY', '#1c2a4a', '#e9d9a8'], ['NIGHT', 'POOL', '#0f3a3a', '#a8f0e0'], ['MOON', 'STATION', '#14141c', '#d8dce8'], ['GREY', 'STAIRS', '#3a3a3a', '#f0f0f0'], ['WELCOME', 'BACK', '#5a1a1a', '#ffd88a']];
  const spots = [[-11.0, 13.9, 0], [-9.4, 13.9, 0], [-7.8, 13.9, 0], [-11.9, 5.4, 1], [-11.9, 12.4, 1]];
  spots.forEach(([x, z, side], i) => {
    const [a, b, bg, fg] = titles[i], c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 384); const gr = g.createRadialGradient(128, 150, 10, 128, 150, 180); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.4)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
    g.fillStyle = fg; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.fillText(a, 128, 270); g.fillText(b, 128, 316); g.font = '14px Georgia, serif'; g.globalAlpha = 0.6; g.fillText('COMING SOON', 128, 352); g.globalAlpha = 1;
    g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 3; g.beginPath(); g.arc(128, 140, 60 + i * 6, 0, 7); g.stroke(); g.globalAlpha = 1;
    for (let k = 0; k < 2200; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; g.fillRect(Math.random() * 256, Math.random() * 384, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const lit = i === 2 ? 0.9 : 0.3, m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.93), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: lit, roughness: 0.4 }));
    if (side) { m.position.set(x + 0.06, 1.35, z); m.rotation.y = Math.PI / 2; vbox(x - 0.02, x + 0.05, 0.84, 1.86, z - 0.37, z + 0.37, MC.gold); }
    else { m.position.set(x, 1.35, z - 0.06); m.rotation.y = Math.PI; vbox(x - 0.37, x + 0.37, 0.84, 1.86, z - 0.05, z + 0.02, MC.gold); }
    stage.add(m);
  });
}
{ // the concession stand, the popcorn machine on it still half full
  box(-11.4, -8.8, 0, 0.95, 12.3, 13.1, MC.maroon, true); vbox(-11.45, -8.75, 0.95, 0.99, 12.25, 13.15, MC.gold);
  vbox(-11.38, -8.82, 0.1, 0.85, 12.28, 12.3, MC.glassDark);
  const pm = new THREE.Group(), red = std({ color: 0xa8241e, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), red); base.position.y = 0.09; pm.add(base);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), MC.ticketGlass); cab.position.y = 0.43; pm.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.44), red); roof.position.y = 0.73; pm.add(roof);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), MC.gold); p.position.set(sx * 0.24, 0.43, sz * 0.19); pm.add(p); }
  const corn = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.36), std({ color: 0xe8d28a, roughness: 0.95 })); corn.position.y = 0.25; pm.add(corn);
  pm.position.set(-10.5, 0.99, 12.7); stage.add(pm);
  { const t = signTex(['POPCORN · SODA · CANDY'], '#3a0d14', '#e8c46a', 1024, 96); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.2), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 })); m.position.set(-10.1, 2.3, 13.86); m.rotation.y = Math.PI; stage.add(m); }
}
for (const [x, z] of [[-7.9, 4.6], [-7.9, 5.6], [-5.95 - 0.9, 5.6]]) { vbox(x - 0.02, x + 0.02, 0, 0.62, z - 0.02, z + 0.02, MC.gold); const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), MC.gold); b.position.set(x, 0.64, z); stage.add(b); solid(x - 0.04, x + 0.04, z - 0.04, z + 0.04, 0, 0.66); }   // stanchions
{ const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-7.9, 0.6, 4.6), new V3(-7.9, 0.42, 5.1), new V3(-7.9, 0.6, 5.6)]), 12, 0.012, 6), MC.velvet); stage.add(rope); }
{ const t = signTex(['SCREEN 1'], '#1a0a0c', '#e8c46a', 512, 128); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 })); m.position.set(-6.9, 2.45, LOBBY.z0 + 0.09); stage.add(m); }
const lobbyLamp = new THREE.PointLight(0xffb070, 6.0, 12, 1.0); lobbyLamp.position.set(-9.4, 2.6, 8.5); stage.add(lobbyLamp);
{ const l2 = new THREE.PointLight(0xffa860, 3.0, 8, 1.0); l2.position.set(-7.6, 2.5, 5.0); stage.add(l2); const l3 = new THREE.PointLight(0xffd0a0, 2.5, 6, 1.0); l3.position.set(-10.1, 2.0, 12.6); stage.add(l3); }   // a sconce by the stairs to the screen; the concession stand's own light
{ const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.16, 12, 1, true), std({ color: 0xffe0b0, emissive: 0xffc070, emissiveIntensity: 0.9, side: THREE.DoubleSide })); sc.position.set(-9.4, 2.62, 8.5); stage.add(sc); }
// -- the screen: dark fabric walls, rows of red seats stepping up to the back, the screen still faintly lit by nothing
slab(HALL.x0, HALL.x1, HALL.z0, HALL.z1, 0.003, MC.carpet, false); slab(HALL.x0, HALL.x1, HALL.z0, HALL.z1, HALL.c, MC.ceilDark, true);
wallX(HALL.x0, HALL.z0, HALL.z1, HALL.c, MC.fabric); wallX(HALL.x1, HALL.z0, HALL.z1, HALL.c, MC.fabric);
wallZ(HALL.z0, HALL.x0, HALL.x1, HALL.c, MC.fabric);
wallZ(HALL.z1, HALL.x0, HALL.x1, HALL.c, MC.fabric, [[-7.3, -6.5, 0, 2.8], [-9.6, -9.0, 3.1, 3.5]]);   // the door in, and the projection window
box(-9.6, -9.0, 3.1, 3.5, HALL.z1 - 0.01, HALL.z1 + 0.01, MC.glassDark);
box(HALL.x0, HALL.x1, 0, 0.32, HALL.z0, -7.0, MC.fabric, true);   // the low stage under the screen
const ROWS = 6, ROW0 = -3.8, ROWD = 1.05, RISE = 0.12;
for (let k = 1; k < ROWS; k++) box(HALL.x0, HALL.x1, 0, k * RISE, ROW0 + k * ROWD - 0.5, HALL.z1, MC.carpet, true);   // the tiers: each step one rise higher
{
  const seatG = new RoundedBoxGeometry(0.4, 0.1, 0.38, 2, 0.03), backG = new RoundedBoxGeometry(0.4, 0.46, 0.08, 2, 0.03), armG = new THREE.BoxGeometry(0.05, 0.05, 0.4);
  const seats = [], backs = [], arms = [];
  for (let k = 0; k < ROWS; k++) {
    const y = k * RISE, z = ROW0 + k * ROWD;
    for (let x = -12.9; x < -7.5; x += 0.46) {
      if (rand() < 0.04) continue;   // a seat or two gone
      const up = rand() < 0.3;   // some folded up
      seats.push([x + 0.2, y + (up ? 0.42 : 0.3), z + (up ? 0.12 : 0), up ? 1.2 : 0]); backs.push([x + 0.2, y + 0.58, z + 0.2, -0.12 + (rand() - 0.5) * 0.06]); arms.push([x - 0.01, y + 0.45, z]);
    }
    arms.push([-7.5, y + 0.45, z]);
    solid(-12.95, -7.45, z - 0.22, z + 0.26, y, y + 0.82);
  }
  const inst = (geo, mat, list, rotAxis) => { const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); list.forEach((s, i) => { o.position.set(s[0], s[1], s[2]); o.rotation.set(rotAxis && s[3] ? s[3] : 0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); stage.add(im); };
  inst(seatG, MC.velvet, seats, true); inst(backG, MC.velvet, backs, true); inst(armG, MC.seatDark, arms);
  // a light in the riser of each step of the aisle
  const stepM = std({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 2.4 });
  for (const [x, z] of [[-11.5, -1.5], [-8.5, -1.5], [-10, 2.5]]) { const hl = new THREE.PointLight(0xd8b088, 4.0, 13, 1.0); hl.position.set(x, HALL.c - 0.3, z); stage.add(hl); }   // the house lights, left on low
  for (let k = 1; k < ROWS; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.01), stepM); m.position.set(-7.1, k * RISE - 0.05, ROW0 + k * ROWD - 0.505); stage.add(m); }
}
// the screen, and the dust in the beam that is still coming from the projection window though nothing is showing
const SCR = { w: 6.4, h: 2.8, y: 2.1, z: HALL.z0 + 0.12, x: -9.25 };
const scrCv = document.createElement('canvas'); scrCv.width = 128; scrCv.height = 64; const scrG = scrCv.getContext('2d');
const scrTex = new THREE.CanvasTexture(scrCv); scrTex.colorSpace = THREE.SRGBColorSpace;
function paintScreen() { const id = scrG.createImageData(128, 64), d = id.data; const b = 150 + Math.random() * 40; for (let i = 0; i < d.length; i += 4) { const n = b + (Math.random() - 0.5) * 90; d[i] = n * 0.86; d[i + 1] = n * 0.92; d[i + 2] = n; d[i + 3] = 255; } scrG.putImageData(id, 0, 0); scrTex.needsUpdate = true; }
paintScreen();
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), new THREE.MeshBasicMaterial({ map: scrTex, color: 0xc8d0dc })); m.position.set(SCR.x, SCR.y, SCR.z); stage.add(m);
  vbox(SCR.x - SCR.w / 2 - 0.25, SCR.x + SCR.w / 2 + 0.25, SCR.y - SCR.h / 2 - 0.12, SCR.y + SCR.h / 2 + 0.12, SCR.z - 0.06, SCR.z - 0.01, std({ color: 0x050505, roughness: 1 }));   // the black masking round it
  for (const s of [-1, 1]) vbox(SCR.x + s * (SCR.w / 2 + 0.6) - 0.3, SCR.x + s * (SCR.w / 2 + 0.6) + 0.3, 0.32, HALL.c - 0.2, HALL.z0 + 0.05, HALL.z0 + 0.3, MC.velvet);   // the curtains, drawn back
  const beamG = new THREE.BufferGeometry(), A = [-9.3, 3.3, HALL.z1 - 0.02], hw = SCR.w / 2, hh = SCR.h / 2;
  const C = [[SCR.x - hw, SCR.y - hh, SCR.z + 0.02], [SCR.x + hw, SCR.y - hh, SCR.z + 0.02], [SCR.x + hw, SCR.y + hh, SCR.z + 0.02], [SCR.x - hw, SCR.y + hh, SCR.z + 0.02]];
  const pos = []; for (let i = 0; i < 4; i++) pos.push(...A, ...C[i], ...C[(i + 1) % 4]); beamG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  stage.add(new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x8090a8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
}
const scrLight = new THREE.RectAreaLight(0xb8c8e0, 2.6, SCR.w, SCR.h); scrLight.position.set(SCR.x, SCR.y, SCR.z + 0.05); scrLight.lookAt(SCR.x, SCR.y, 0); stage.add(scrLight);
{ const t = signTex(['EXIT'], '#160304', '#ff3a2e', 256, 96); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), std({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 2.2 })); m.position.set(-6.9, 2.4, HALL.z1 - 0.09); m.rotation.y = Math.PI; stage.add(m);
  const l = new THREE.PointLight(0xff2a1e, 0.35, 4, 2); l.position.set(-6.9, 2.3, HALL.z1 - 0.4); stage.add(l); }

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
const ceilAt = (x, z, y = 0) => (inDuctY(y) ? DUCT_Y + DUCT_H - 0.02 : x < -0.3 ? cinemaCeil(x, z) - 0.05 : (z < 0 ? TUBE_H : CEIL) - 0.05);   // the shop, the corridor, the cinema's rooms, or (up there) the duct
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
  let target = player.crouch ? H_CROUCH : H_STAND; const room = ceilAt(player.pos.x, player.pos.z, player.pos.y) - player.pos.y; if (target > room) target = Math.min(player.h, room);
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
const inDuctY = (y) => y > CEIL - 0.25;
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
    if (scaleK > 0.5) { if (time - narrowSaid > 2.5) { narrowSaid = time; if (window.Equip) window.Equip.say('The vent is too narrow to crawl into.', 2.5); } return; }
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
function interact() {
  const Hv = hatchAimed(); if (Hv && !aimed()) { openHatch(Hv); return; }
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
  player.onGround = false; player.ground = 0; player.camY = p.y + player.h - EYE; player.mode = 'walk'; player.lad = null;
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
  const d = (player.pos.z - PORT.hz) * PORT.dz, inTube = player.pos.z < 0 && Math.abs(player.pos.x - DOOR_X) < TUBE_HW + 0.3;   // how far past the corridor's hand-over point (the cinema's screen also lies at z < 0, far to the west)
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
  // the bad tube
  for (const F of flick) {
    if (F.bad && now >= F.next) { const r = Math.random(); F.f = r < 0.3 ? 0.05 + Math.random() * 0.2 : r < 0.4 ? 0 : 0.8 + Math.random() * 0.25; F.next = now + (F.f < 0.3 ? 30 + Math.random() * 90 : 120 + Math.random() * 1600); }
    F.l.intensity = F.base * F.f; F.p.m.material.emissiveIntensity = 1.8 * F.f;
    if (F.bad && buzz) buzz.gain.value = 0.012 * (F.f > 0.3 ? 1 : 0.2) * sstep(6, 1.5, Math.hypot(player.pos.x - F.p.x, player.pos.z - F.p.z));
  }
  pulsePickups(time);
  for (const H of hatches) {
    if (!H.open || H.lt >= 1) continue;
    H.t = Math.min(1, H.t + dt / 0.45);
    if (H.t > 0.55) { const was = H.lt; H.lt = Math.min(1, H.lt + dt / 0.32); if (was < 1 && H.lt >= 1) clank(1); }   // the ladder comes down fast and lands with a bang
    apply(H);
  }
  if (now >= boLamp.next) { const r = Math.random(); boLamp.f = r < 0.25 ? 0.1 + Math.random() * 0.3 : 0.75 + Math.random() * 0.3; boLamp.next = now + (boLamp.f < 0.5 ? 40 + Math.random() * 120 : 300 + Math.random() * 2200); }
  boLamp.l.intensity = 3.6 * boLamp.f; boLamp.bulb.material.emissiveIntensity = 2 * boLamp.f;
  if (player.pos.x < -0.3 && (frame.scrT = (frame.scrT || 0) + dt) > 0.08) { frame.scrT = 0; paintScreen(); scrLight.intensity = 2.2 + Math.random() * 0.8; }
  const P = aimed(), Hv = P ? null : hatchAimed();
  if (window.Equip) {
    if (P) { _p.copy(P.at).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); }
    else if (Hv) { _p.set(Hv.x, Hv.ceilY - 0.02, Hv.z).project(camera); window.Equip.prompt((_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight); }
    else window.Equip.prompt(null);
  }
  grade.uniforms.uTime.value = time; since += dt; grade.uniforms.uFade.value = Math.max(1 - sstep(-0.6, -0.05, d), 1 - sstep(0, 0.5, since));   // half a second of black on arrival; dark again walking back out
  if (AC && acOut) acOut.gain.value += (sstep(-0.6, 1.2, d) * 0.9 - acOut.gain.value) * Math.min(1, dt * 6);
  composer.render();
}

/* ------------------------------------------------------------------ */
/* get ready                                                           */
/* ------------------------------------------------------------------ */
let ready = false;
window.__store = { player, camera, keys, pickups, solids, grade, interact, hatches, openHatch, H1, H2, get on() { return on; },
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
