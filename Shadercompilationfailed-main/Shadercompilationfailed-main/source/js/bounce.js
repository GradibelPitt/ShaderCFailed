// The bounce house. An empty inflatable castle, blower still running, nobody in it.
// It is where the ENTER hole beside the inverted pool leads: walk into that tunnel, and somewhere in the dark the tunnel becomes
// a vinyl crawl tube that opens into the first room. The other ENTER hole (the one on the back wall, by the first slide) is the
// far end of the same castle. There is no page change: js/poolflip.js imports this module in the background, everything is built
// and lit while the player is still in the pool, and window.__bounceStart() (called in the pitch black of the tunnel) shows this
// canvas and starts the loop. Walk back out through either tube and window.__bounceReturn() hands the player back to the pool.
// bounce.html runs the same module on its own (there the two tubes simply lead into each other).
//
// How it is drawn: every wall, tube, pad and ball is real geometry in one mesh. Light is not computed per frame: after the mesh is
// built, each vertex gets its light once (lamps with shadow rays, a few bounces of colour gathered over a hemisphere, contact
// shadow in the seams) and that is stored in the vertex. At run time only the sheen of the vinyl is live.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshBVH } from 'three-mesh-bvh';

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */
const SOLO = document.documentElement.dataset.bounce === 'solo';   // bounce.html: no pool around it
const CELL = 2.4, COLS = 6, ROWS = 5;
const CEIL = 1.42;            // underside of the roof seams
const WT = 0.44;              // an inflated wall is fat
const RIB = 0.225;            // height of one horizontal wall tube
const DECK = 0.72;            // the upper floor
const G = 13;
const PS0 = 0.3;              // same child-sized player as the pool, so the hand-over in the tunnel is exact
// ...and the same size gun (js/sizegun.js): 0.42 of that again when shrunk
let small = !!(window.SCF_SAVE && window.SCF_SAVE.get('small')), scaleK = small ? 0.42 : 1, PR, H_STAND, H_CROUCH, EYE;
function setScale(k) { scaleK = k; const PS = PS0 * k; PR = 0.28 * PS; H_STAND = 1.7 * PS; H_CROUCH = 0.86 * PS; EYE = 0.1 * PS; }
setScale(scaleK);
const STEP = 0.2;             // what the feet take without a jump
const TUBE_LEN = 8.5, TUBE_HW = 0.5, TUBE_H = 0.95, HAND = 5.0;   // crawl tubes: the hand-over point is HAND metres in from the wall

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(20261126);
const hash2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ */
/* the plan of the castle                                              */
/* ------------------------------------------------------------------ */
// x runs east (columns), z runs south (rows). One letter per cell:
//   .  floor      u  upper deck      <  stairs, rising to the west      a  slide, running down to the west      R  the rocket's room
const CELLS = [
  '.auu..',
  '.R.u<.',
  '......',
  '......',
  '......',
];
// Walls stand on the lines between cells.  #  wall   (space) nothing   D  doorway   W  window (a low sill to climb over)
//   r  parapet at the edge of the deck (look over it, or jump off)     T  a crawl tube leading out
const VE = [   // the lines running north-south: VE[row][col] is the west side of that cell
  '#   #D#',
  '##Dr DT',
  '#D # W#',
  '##WD#D#',
  'T # D #',
];
const HE = [   // the lines running east-west: HE[row][col] is the north side of that cell
  '######',
  'D#r #D',
  ' # r# ',
  '#D# D#',
  'D D# #',
  '######',
];
// how much light each cell's roof slit gives (0: none, the room lives on what spills in)
const LIGHT = [
  [0.9, 0.0, 0.7, 0.0, 0.3, 0.0],
  [0.0, 1.2, 0.0, 1.5, 0.7, 1.0],
  [0.6, 0.9, 0.0, 1.0, 0.0, 0.9],
  [0.0, 0.0, 0.7, 0.0, 0.6, 0.35],
  [0.7, 0.0, 0.5, 0.0, 0.0, 0.25],
];
const cellAt = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? null : CELLS[r][c];
const floorH = (c, r) => cellAt(c, r) === 'u' ? DECK : 0;
// over the stairs, the deck and the slide the roof is two wall tubes higher: a tower
const TALL = 2 * RIB, tallCell = (c, r) => { const k = cellAt(c, r); return k === 'u' || k === '<' || k === 'a' || k === 'R'; }, ceilOf = (c, r) => CEIL + (tallCell(c, r) ? TALL : 0);

/* ------------------------------------------------------------------ */
/* colours (the reference: deep teal walls, yolk yellow, orange posts,  */
/* a quilt of red, green, yellow, blue and purple underfoot)            */
/* ------------------------------------------------------------------ */
const C = (h) => new THREE.Color(h);
const CREAM = C('#e6dfcc'), CYAN = C('#8ed0d6'), TEAL = C('#1f8f96'), TEAL_D = C('#19767e'), YEL = C('#eec41c'), ORA = C('#dc621a'), NAVY = C('#262243'), RED_O = C('#cf4424');
const PADS = [C('#bd222b'), C('#2f9a3a'), C('#e2c018'), C('#2b3596'), C('#592c88')];
const BALLS = [C('#ee8a2e'), C('#2c5cc8'), C('#38a246'), C('#c6d03a'), C('#eea074'), C('#c4262e')];
const WHITE = C('#ffffff');

/* ------------------------------------------------------------------ */
/* geometry: everything goes into these arrays                         */
/* ------------------------------------------------------------------ */
const GP = [], GN = [], GC = [], GE = [], GI = [], GA = [], GR = [];   // position, normal, colour of the vinyl, own glow, triangles, how deep in a seam, how matt
let nv = 0, crease = 1, rough = 0.4, limp = 1;   // limp: 1 for what only stands because it is full of air, 0 for what the player walks on
function vert(x, y, z, nx, ny, nz, c, e) {
  GP.push(x, y, z); GN.push(nx, ny, nz); GC.push(c.r, c.g, c.b);
  if (e) GE.push(e[0], e[1], e[2]); else GE.push(0, 0, 0);
  GA.push(crease); GR.push(rough, limp); return nv++;
}
const quad = (a, b, c, d) => { GI.push(a, b, c, a, c, d); };

// what the player collides with: boxes with a top (possibly sloping), and places where the roof is lower
const solids = [], ceils = [], lamps = [];
const solid = (x0, x1, z0, z1, y0, y1, extra) => { const s = Object.assign({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 }, extra || null); solids.push(s); return s; };

// A fat tube from a to b with rounded ends. r1 is its radius sideways, r2 upward (for a level tube); cap: how long the round end is, in radii (0: open end).
function tube(ax, ay, az, bx, by, bz, r1, col, o) {
  o = o || {};
  const r2 = o.r2 === undefined ? r1 : o.r2, rs = o.rs || 12, capA = o.capA === undefined ? 0.8 : o.capA, capB = o.capB === undefined ? 0.8 : o.capB;
  let dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
  let e1x = uy * dz - uz * dy, e1y = uz * dx - ux * dz, e1z = ux * dy - uy * dx; { const l = Math.hypot(e1x, e1y, e1z); e1x /= l; e1y /= l; e1z /= l; }
  const e2x = dy * e1z - dz * e1y, e2y = dz * e1x - dx * e1z, e2z = dx * e1y - dy * e1x;
  const st = [];   // stations: distance along, scale of the ring, how far the normal leans along the axis
  const la = capA * r1, lb = capB * r1, nc = 4;
  if (capA > 0) for (let j = 0; j < nc; j++) { const f = (1 - j / nc) * Math.PI / 2; st.push([la - la * Math.sin(f), Math.max(0.02, Math.cos(f)), -Math.sin(f)]); }
  const nb = Math.max(1, Math.ceil((L - la - lb) / (o.seg || 0.3)));
  for (let j = 0; j <= nb; j++) st.push([la + (L - la - lb) * j / nb, 1, 0]);
  if (capB > 0) for (let j = 1; j <= nc; j++) { const f = (j / nc) * Math.PI / 2; st.push([L - lb + lb * Math.sin(f), Math.max(0.02, Math.cos(f)), Math.sin(f)]); }
  const base = nv;
  for (const [t, sc, ax2] of st) {
    const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
    for (let i = 0; i <= rs; i++) {
      const th = i / rs * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const px = (e1x * c * r1 + e2x * s * r2) * sc, py = (e1y * c * r1 + e2y * s * r2) * sc, pz = (e1z * c * r1 + e2z * s * r2) * sc;
      let nx = e1x * c / r1 + e2x * s / r2, ny = e1y * c / r1 + e2y * s / r2, nz = e1z * c / r1 + e2z * s / r2; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const k = Math.sqrt(Math.max(0, 1 - ax2 * ax2)); nx = nx * k + dx * ax2; ny = ny * k + dy * ax2; nz = nz * k + dz * ax2;
      vert(cx + px, cy + py, cz + pz, nx, ny, nz, col, o.em);
    }
  }
  for (let j = 0; j < st.length - 1; j++) for (let i = 0; i < rs; i++) { const a = base + j * (rs + 1) + i; quad(a, a + 1, a + rs + 2, a + rs + 1); }
}

// A line on the ground that a wall stands on. s runs along it, "off" is sideways toward side A.
function line(x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  return { x0, z0, dx, dz, nx: -dz, nz: dx, L, px: (s, off) => x0 + dx * s - dz * off, pz: (s, off) => z0 + dz * s + dx * off };
}
const TEAL_RIB = { h: RIB, col: TEAL, t: WT }, NAVY_RIB = { h: 0.33, col: NAVY, t: 0.3 };
const wallRibs = (band, tall) => [TEAL_RIB, TEAL_RIB, TEAL_RIB, TEAL_RIB, band ? { h: RIB, col: YEL, t: WT } : TEAL_RIB].concat(tall ? [TEAL_RIB, TEAL_RIB] : [], [NAVY_RIB]);
const FILL = [{ h: 0.24, col: TEAL, t: WT }, { h: 0.24, col: TEAL, t: WT }, NAVY_RIB];   // what closes the gap where a low roof meets the tower
// A piece of inflated wall: horizontal tubes stacked from y0 up, pinched where they meet. o.a / o.b: build the face on side A / side B.
function ribWall(E, s0, s1, y0, ribs, o) {
  o = o || {};
  const m = Math.max(2, Math.ceil((s1 - s0) / 0.3) + 1), K = 6, SEAM = 0.065;
  for (const sg of [1, -1]) {
    if (sg > 0 ? o.a === false : o.b === false) continue;
    let yb = y0;
    for (const rb of ribs) {
      const base = nv;
      for (let j = 0; j < m; j++) {
        const s = s0 + (s1 - s0) * j / (m - 1);
        for (let k = 0; k <= K; k++) {
          const tt = k / K, td = clamp(tt, 0.06, 0.94), sn = Math.sin(Math.PI * tt), snd = Math.sin(Math.PI * td);
          const off = rb.t / 2 - SEAM * (1 - Math.sqrt(Math.max(0, sn)));
          const dody = SEAM * 0.5 / Math.sqrt(snd) * Math.cos(Math.PI * td) * Math.PI / rb.h;
          let nx = sg * E.nx, ny = -dody, nz = sg * E.nz; const nl = Math.hypot(nx, ny, nz);
          crease = 0.45 + 0.55 * Math.sqrt(Math.max(0, sn));
          vert(E.px(s, sg * off), yb + rb.h * tt, E.pz(s, sg * off), nx / nl, ny / nl, nz / nl, rb.col);
        }
      }
      crease = 1;
      for (let j = 0; j < m - 1; j++) for (let k = 0; k < K; k++) {
        const a = base + j * (K + 1) + k, b = a + K + 1, c = b + 1, d = a + 1;
        if (sg > 0) quad(a, b, c, d); else quad(a, d, c, b);
      }
      yb += rb.h;
    }
  }
  if (o.top) {   // a flat lid (a roll usually lies on it)
    let yt = y0, t = 0; for (const rb of ribs) { yt += rb.h; t = rb.t / 2 - SEAM; }
    const col = ribs[ribs.length - 1].col, base = nv;
    for (let j = 0; j < m; j++) { const s = s0 + (s1 - s0) * j / (m - 1); vert(E.px(s, t), yt, E.pz(s, t), 0, 1, 0, col); vert(E.px(s, -t), yt, E.pz(s, -t), 0, 1, 0, col); }
    for (let j = 0; j < m - 1; j++) { const a = base + j * 2; quad(a, a + 2, a + 3, a + 1); }
  }
}
// The box a piece of wall takes up, for collision.
function lineBox(E, s0, s1, o0, o1, y0, y1, extra) { return solid(E.px(s0, o0), E.px(s1, o1), E.pz(s0, o0), E.pz(s1, o1), y0, y1, extra); }

// A quilt of pillows over a rectangle. yFn gives the height of the sheet under the pillows; down: it is a roof, pillows hang.
// The pads lie on one lattice for the whole castle, so the pattern runs on from room to room.
function quilt(x0, z0, x1, z1, yFn, o) {
  const padX = o.padX, padZ = o.padZ, hgt = o.hgt, down = !!o.down, res = o.res || 0.13;
  for (let kz = Math.floor(z0 / padZ + 1e-6); kz * padZ < z1 - 1e-6; kz++) {
    const sh = o.stagger && (kz & 1) ? padX / 2 : 0;
    for (let kx = Math.floor((x0 - sh) / padX + 1e-6); kx * padX + sh < x1 - 1e-6; kx++) {
      const ax = Math.max(x0, kx * padX + sh), bx = Math.min(x1, (kx + 1) * padX + sh), az = Math.max(z0, kz * padZ), bz = Math.min(z1, (kz + 1) * padZ);
      if (bx - ax < 0.04 || bz - az < 0.04) continue;
      rough = o.rough || 0.4; limp = o.firm ? 0 : 1;
      const col = o.col(kx, kz), nx = Math.max(4, Math.round((bx - ax) / res)), nz = Math.max(4, Math.round((bz - az) / res)), base = nv;
      const hh = Math.min(hgt, hgt * Math.min(bx - ax, bz - az) / Math.min(padX, padZ) * 1.2);
      const H = (i, j) => { const u = i / nx, v = j / nz; return Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.4) * hh; };
      const P = (i, j) => { const x = ax + (bx - ax) * i / nx, z = az + (bz - az) * j / nz; return [x, yFn(x, z) + (down ? -H(i, j) : H(i, j)), z]; };
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
        const p = P(i, j), ex = 0.3;
        // normal from the slope of the sheet (taken just inside the pad at its edges, so the seams read as creases)
        const ia = clamp(i - ex, 0.12, nx - 0.12), ib = clamp(i + ex, 0.12, nx - 0.12), ja = clamp(j - ex, 0.12, nz - 0.12), jb = clamp(j + ex, 0.12, nz - 0.12);
        const qa = P(ia, j), qb = P(ib, j), qc = P(i, ja), qd = P(i, jb);
        const tx = [qb[0] - qa[0], qb[1] - qa[1], 0], tz = [0, qd[1] - qc[1], qd[2] - qc[2]];
        let n0 = tz[1] * tx[2] - tz[2] * tx[1], n1 = tz[2] * tx[0] - tz[0] * tx[2], n2 = tz[0] * tx[1] - tz[1] * tx[0]; const nl = Math.hypot(n0, n1, n2) || 1;
        n0 /= nl; n1 /= nl; n2 /= nl; if (down) { n0 = -n0; n1 = -n1; n2 = -n2; }
        crease = 0.34 + 0.66 * sstep(0, 0.085, Math.min(Math.min(i, nx - i) / nx * (bx - ax), Math.min(j, nz - j) / nz * (bz - az)));
        vert(p[0], p[1], p[2], n0, n1, n2, col, o.em ? o.em(col) : null);
      }
      crease = 1; rough = 0.4; limp = 1;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const a = base + i * (nz + 1) + j, b = a + 1, c = a + nz + 2, d = a + nz + 1;
        if (down) quad(a, d, c, b); else quad(a, b, c, d);
      }
    }
  }
}
function ball(x, y, z, r, col) {
  const base = nv, ws = 12, hs = 8; rough = 0.24;
  for (let j = 0; j <= hs; j++) { const ph = j / hs * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph); for (let i = 0; i <= ws; i++) { const th = i / ws * Math.PI * 2, nx = Math.cos(th) * sr, nz = -Math.sin(th) * sr; vert(x + nx * r, y + sy * r, z + nz * r, nx, sy, nz, col); } }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = base + j * (ws + 1) + i, b = a + ws + 1; quad(a, b, b + 1, a + 1); }
  rough = 0.4;
}

// The inflatable rocket: a body turned on a lathe and sewn from eight gores, a red nose, four fins, portholes, standing on a ring.
// It is in the far dead-end room and does nothing yet; window.__bounce.rocket says where it is, for whatever comes later.
const rocket = { x: 0, z: 0, r: 0.26, y0: 0.22, y1: 1.56 };
function buildRocket(cx, cz) {
  rocket.x = cx; rocket.z = cz;
  const prof = [[0.1, 0.22], [0.16, 0.26], [0.205, 0.33], [0.24, 0.43], [0.257, 0.56], [0.26, 0.7], [0.255, 0.84], [0.24, 0.96], [0.215, 1.07], [0.18, 1.18], [0.18, 1.18], [0.15, 1.27], [0.115, 1.36], [0.078, 1.44], [0.042, 1.51], [0.006, 1.56]];
  const rs = 40, base = nv; rough = 0.3;
  for (let j = 0; j < prof.length; j++) {
    const [r, y] = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)], nose = j >= 10;
    let dr = b[0] - a[0], dy = b[1] - a[1]; if (j === 9) { dr = r - a[0]; dy = y - a[1]; } if (j === 10) { dr = b[0] - r; dy = b[1] - y; } const l = Math.hypot(dr, dy) || 1;
    const col = nose ? RED_O : (y > 0.4 && y < 0.5 ? ORA : CREAM);
    for (let i = 0; i <= rs; i++) {
      const th = i / rs * Math.PI * 2, seam = Math.sqrt(Math.abs(Math.sin(th * 4))), rr = r * (0.95 + 0.05 * seam), sx = Math.sin(th), sz = Math.cos(th);
      crease = 0.5 + 0.5 * seam;
      vert(cx + sx * rr, y, cz + sz * rr, sx * dy / l, -dr / l, sz * dy / l, col);
    }
  }
  crease = 1;
  for (let j = 0; j < prof.length - 1; j++) if (j !== 9) for (let i = 0; i < rs; i++) { const a = base + j * (rs + 1) + i; quad(a, a + 1, a + rs + 2, a + rs + 1); }
  tube(cx, 0.08, cz, cx, 0.27, cz, 0.12, NAVY, { capA: 0, capB: 0, rs: 14, seg: 0.1 });   // the nozzle
  for (let k = 0; k < 4; k++) {   // fins
    const a = k * Math.PI / 2 + Math.PI / 4, dx = Math.sin(a), dz = Math.cos(a);
    tube(cx + dx * 0.17, 0.62, cz + dz * 0.17, cx + dx * 0.5, 0.1, cz + dz * 0.5, 0.045, ORA, { r2: 0.15, rs: 12, seg: 0.12, capA: 0.6, capB: 1.2 });
  }
  for (let k = 0; k < 4; k++) {   // portholes: a yellow rim and a pale window in it
    const a = k * Math.PI / 2, dx = Math.sin(a), dz = Math.cos(a);
    ball(cx + dx * 0.195, 0.84, cz + dz * 0.195, 0.085, YEL); ball(cx + dx * 0.232, 0.84, cz + dz * 0.232, 0.062, CYAN);
  }
  for (let k = 0; k < 8; k++) {   // the ring it stands in
    const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4, R = 0.6;
    tube(cx + Math.sin(a0) * R, 0.1, cz + Math.cos(a0) * R, cx + Math.sin(a1) * R, 0.1, cz + Math.cos(a1) * R, 0.11, k & 1 ? YEL : ORA, { capA: 0.5, capB: 0.5, seg: 0.16, rs: 10 });
  }
  rough = 0.4;
  solid(cx - 0.24, cx + 0.24, cz - 0.24, cz + 0.24, 0, 99);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) solid(cx + dx * 0.6 - 0.14 - Math.abs(dz) * 0.4, cx + dx * 0.6 + 0.14 + Math.abs(dz) * 0.4, cz + dz * 0.6 - 0.14 - Math.abs(dx) * 0.4, cz + dz * 0.6 + 0.14 + Math.abs(dx) * 0.4, 0, 0.2);
}

/* ------------------------------------------------------------------ */
/* build the castle                                                    */
/* ------------------------------------------------------------------ */
const padCol = (kx, kz) => PADS[(((kz * 2 + kx * 3 + (hash2(kx, kz) < 0.22 ? 1 : 0)) % 5) + 5) % 5];
const FLOOR_Q = { padX: 0.8, padZ: 0.4, hgt: 0.07, stagger: true, col: padCol, res: 0.1, rough: 0.3, firm: true };
const roofCol = (kx, kz) => { const c = YEL.clone(); c.offsetHSL((hash2(kx + 31, kz + 7) - 0.5) * 0.012, 0, (hash2(kx, kz + 91) - 0.5) * 0.04); return c; };
const GLOW = 0.33;  // daylight coming through the yellow roof
const ROOF_Q = { padX: 1.2, padZ: 1.2, hgt: 0.11, rough: 0.8, down: true, col: roofCol, em: (c) => [c.r * GLOW * 1.15, c.g * GLOW * 0.9, c.b * GLOW * 0.55], res: 0.15 };
const ports = [];   // the two crawl tubes

// floors, the deck, the stairs, the slide, the roof and its slits
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const k = CELLS[r][c], x0 = c * CELL, x1 = x0 + CELL, z0 = r * CELL, z1 = z0 + CELL, cx = x0 + CELL / 2, cz = z0 + CELL / 2;
  if (k === 'u') { quilt(x0, z0, x1, z1, () => DECK, FLOOR_Q); solid(x0, x1, z0, z1, 0, DECK); }
  else if (k === 'a') { limp = 0;   // the slide: from the deck on the east side down to the floor on the west
    const yS = (x) => DECK * sstep(0, 1, clamp((x - x0 - 0.25) / (CELL - 0.5), 0, 1)) * 0.5 + DECK * clamp((x - x0 - 0.25) / (CELL - 0.5), 0, 1) * 0.5;
    quilt(x0, z0 + 0.2, x1, z1 - 0.2, (x) => yS(x), { padX: 0.6, padZ: 1.2, hgt: 0.03, col: () => RED_O, res: 0.1, firm: true }); limp = 0;
    for (const zz of [z0 + 0.36, cz, z1 - 0.36]) {   // rolls along the lanes
      let px = x0 + 0.05, py = yS(px) + 0.09;
      for (let i = 1; i <= 8; i++) { const qx = x0 + 0.05 + (CELL - 0.1) * i / 8, qy = yS(qx) + 0.09; tube(px, py, zz, qx, qy, zz, 0.13, YEL, { capA: i === 1 ? 0.8 : 0, capB: i === 8 ? 0.8 : 0, seg: 0.2, rs: 10 }); px = qx; py = qy; }
    }
    solid(x0, x1, z0, z1, 0, DECK, { ramp: (x) => yS(x), slide: [-1, 0] }); limp = 1;
  } else {
    quilt(x0, z0, x1, z1, () => 0, FLOOR_Q);
    if (k === 'R') buildRocket(cx, cz);
    if (k === '<') {   // stairs: five fat teal rolls, each a step, rising to the west
      const n = 4, rise = DECK / n, run = 0.45; limp = 0;
      for (let i = 0; i < n; i++) {
        const xa = x1 - 0.2 - run * i, top = rise * (i + 1);
        tube(xa - 0.2, top - 0.13, z0 + 0.12, xa - 0.2, top - 0.13, z1 - 0.12, 0.27, i & 1 ? TEAL : TEAL_D, { r2: 0.15, capA: 0, capB: 0, seg: 0.24, rs: 14 });
        if (i > 0) tube(xa - 0.05, top - rise - 0.18, z0 + 0.12, xa - 0.05, top - rise - 0.18, z1 - 0.12, 0.24, TEAL_D, { r2: 0.2, capA: 0, capB: 0, seg: 0.3, rs: 10 });
        solid(x0, xa, z0, z1, 0, top);
      }
      quilt(x0, z0, x0 + 0.24, z1, () => DECK - 0.02, { padX: 0.6, padZ: 0.6, hgt: 0.04, col: () => TEAL, firm: true }); limp = 1;
    }
  }
  const top = ceilOf(c, r);
  quilt(x0, z0, x1, z1, () => top, ROOF_Q);
  const I = LIGHT[r][c];
  if (I > 0) {   // a slit of daylight in the roof seam
    const alongX = hash2(c * 3 + 1, r * 5 + 2) < 0.5, hl = 0.62, w = 0.035, y = top - 0.012;
    const warm = k === 'u' || k === '<' ? [1.0, 0.84, 0.42] : [1.0, 0.95, 0.84], em = [2.2 * I * warm[0] + 0.6, 2.2 * I * warm[1] + 0.6, 2.2 * I * warm[2] + 0.5];
    const a = vert(cx - (alongX ? hl : w), y, cz - (alongX ? w : hl), 0, -1, 0, WHITE, em), b = vert(cx + (alongX ? hl : w), y, cz - (alongX ? w : hl), 0, -1, 0, WHITE, em);
    const d = vert(cx - (alongX ? hl : w), y, cz + (alongX ? w : hl), 0, -1, 0, WHITE, em), e = vert(cx + (alongX ? hl : w), y, cz + (alongX ? w : hl), 0, -1, 0, WHITE, em);
    quad(a, b, e, d);
    lamps.push({ x: cx, y: top - 0.17, z: cz, ax: alongX ? 0.45 : 0, az: alongX ? 0 : 0.45, col: warm, I });
  }
}

// the walls on the lines between the cells
const kindAt = (vertical, c, r) => vertical ? ((r < 0 || r >= ROWS || c < 0 || c > COLS) ? ' ' : VE[r][c]) : ((r < 0 || r > ROWS || c < 0 || c >= COLS) ? ' ' : HE[r][c]);
// a post stands on every corner where walls meet or end; only a straight run of plain wall goes without
function postAt(c, r) {
  const n = kindAt(true, c, r - 1), s = kindAt(true, c, r), w = kindAt(false, c - 1, r), e = kindAt(false, c, r);
  const cnt = (n !== ' ') + (s !== ' ') + (w !== ' ') + (e !== ' ');
  if (cnt === 0) return false;
  if (cnt === 2 && ((n === '#' && s === '#') || (w === '#' && e === '#'))) return false;
  return true;
}
for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) if (postAt(c, r)) {
  const x = c * CELL, z = r * CELL, navy = hash2(c * 7 + 3, r * 11 + 5) < 0.18;
  const top = Math.max(ceilOf(c - 1, r - 1), ceilOf(c, r - 1), ceilOf(c - 1, r), ceilOf(c, r));
  tube(x, -0.03, z, x, top + 0.06, z, 0.2, navy ? NAVY : ORA, { capA: 0, capB: 0, rs: 14, seg: 0.22 });
  solid(x - 0.18, x + 0.18, z - 0.18, z + 0.18, 0, 99);
}
function buildEdge(vertical, c, r) {
  const kind = kindAt(vertical, c, r);
  const E = vertical ? line(c * CELL, r * CELL, c * CELL, (r + 1) * CELL) : line(c * CELL, r * CELL, (c + 1) * CELL, r * CELL);
  // side A of a north-south line is its west side, of an east-west line its south side
  const A = vertical ? [c - 1, r] : [c, r], B = vertical ? [c, r] : [c, r - 1];
  const inA = cellAt(A[0], A[1]) !== null, inB = cellAt(B[0], B[1]) !== null, fA = floorH(A[0], A[1]), fB = floorH(B[0], B[1]);
  const p0 = vertical ? postAt(c, r) : postAt(c, r), p1 = vertical ? postAt(c, r + 1) : postAt(c + 1, r);
  const s0 = p0 ? 0.1 : 0, s1 = CELL - (p1 ? 0.1 : 0), band = hash2(c * 13 + (vertical ? 5 : 0), r * 17 + 1) < 0.42;
  const tA = tallCell(A[0], A[1]), tB = tallCell(B[0], B[1]), top = CEIL + (tA || tB ? TALL : 0);
  const ribs = wallRibs(band, tA || tB), faces = { a: inA, b: inB }, upper = { a: tA, b: tB };
  if (kind === ' ') {   // no wall: but where the tower stands next to a low roof, the tower's wall still comes down to that roof
    if (tA !== tB) { ribWall(E, s0, s1, CEIL - 0.03, FILL, upper); tube(E.px(s0, 0), CEIL - 0.05, E.pz(s0, 0), E.px(s1, 0), CEIL - 0.05, E.pz(s1, 0), 0.13, NAVY, { capA: 0, capB: 0, seg: 0.25, rs: 10 }); }
    return;
  }
  const bolster = (sa, sb) => { for (const [sg, inside, fh] of [[1, inA, fA], [-1, inB, fB]]) if (inside) {
    tube(E.px(sa, sg * 0.29), fh + 0.16, E.pz(sa, sg * 0.29), E.px(sb, sg * 0.29), fh + 0.16, E.pz(sb, sg * 0.29), 0.17, YEL, { r2: 0.165, rs: 12, seg: 0.28 });
    lineBox(E, sa + 0.05, sb - 0.05, 0, sg * 0.44, 0, fh + 0.31);
  } };
  if (kind === '#') {
    ribWall(E, s0, s1, 0, ribs, faces); lineBox(E, 0, CELL, -0.18, 0.18, 0, 99);
    bolster(p0 ? 0.3 : 0.05, CELL - (p1 ? 0.3 : 0.05));
  } else if (kind === 'D' || kind === 'W') {
    const j0 = 0.5, j1 = CELL - 0.5;
    ribWall(E, s0, j0 - 0.1, 0, ribs, faces); ribWall(E, j1 + 0.1, s1, 0, ribs, faces);
    lineBox(E, 0, j0, -0.18, 0.18, 0, 99); lineBox(E, j1, CELL, -0.18, 0.18, 0, 99);
    if (tA || tB) ribWall(E, j0 + 0.1, j1 - 0.1, CEIL - 0.03, FILL, upper);
    for (const s of [j0, j1]) { tube(E.px(s, 0), -0.03, E.pz(s, 0), E.px(s, 0), top + 0.06, E.pz(s, 0), 0.2, ORA, { capA: 0, capB: 0, rs: 14, seg: 0.22 }); lineBox(E, s - 0.18, s + 0.18, -0.18, 0.18, 0, 99); }
    tube(E.px(j0 + 0.1, 0), 1.1, E.pz(j0 + 0.1, 0), E.px(j1 - 0.1, 0), 1.1, E.pz(j1 - 0.1, 0), 0.13, YEL, { capA: 0, capB: 0, seg: 0.2 });
    tube(E.px(j0 + 0.1, 0), 1.32, E.pz(j0 + 0.1, 0), E.px(j1 - 0.1, 0), 1.32, E.pz(j1 - 0.1, 0), 0.15, NAVY, { r2: 0.14, capA: 0, capB: 0, seg: 0.2 });
    ceils.push({ x0: Math.min(E.px(j0, -0.22), E.px(j1, 0.22)), x1: Math.max(E.px(j0, -0.22), E.px(j1, 0.22)), z0: Math.min(E.pz(j0, -0.22), E.pz(j1, 0.22)), z1: Math.max(E.pz(j0, -0.22), E.pz(j1, 0.22)), y: 0.97 });
    if (kind === 'W') {   // the sill: two wall tubes and a yellow roll
      ribWall(E, j0 + 0.1, j1 - 0.1, 0, [TEAL_RIB, TEAL_RIB], { top: true });
      tube(E.px(j0 + 0.12, 0), 2 * RIB + 0.05, E.pz(j0 + 0.12, 0), E.px(j1 - 0.12, 0), 2 * RIB + 0.05, E.pz(j1 - 0.12, 0), 0.11, YEL, { capA: 0, capB: 0, seg: 0.2 });
      lineBox(E, j0, j1, -0.17, 0.17, 0, 2 * RIB + 0.15);
    }
  } else if (kind === 'r') {   // the side of the deck and a low parapet on top of it
    const rr = { h: DECK / 3, col: TEAL, t: WT }; limp = 0;
    ribWall(E, s0, s1, 0, [rr, rr, rr, { h: RIB, col: YEL, t: WT }], { top: true });
    tube(E.px(s0 + 0.08, 0), DECK + RIB + 0.05, E.pz(s0 + 0.08, 0), E.px(s1 - 0.08, 0), DECK + RIB + 0.05, E.pz(s1 - 0.08, 0), 0.1, NAVY, { capA: 0, capB: 0, seg: 0.25, rs: 10 });
    lineBox(E, 0, CELL, -0.18, 0.18, 0, DECK + RIB + 0.14); limp = 1;
    if (tA !== tB) { ribWall(E, s0, s1, CEIL - 0.03, FILL, upper); tube(E.px(s0, 0), CEIL - 0.05, E.pz(s0, 0), E.px(s1, 0), CEIL - 0.05, E.pz(s1, 0), 0.13, NAVY, { capA: 0, capB: 0, seg: 0.25, rs: 10 }); }
    for (const [sg, fh] of [[1, fA], [-1, fB]]) if (fh === 0) { tube(E.px(0.3, sg * 0.29), 0.16, E.pz(0.3, sg * 0.29), E.px(CELL - 0.3, sg * 0.29), 0.16, E.pz(CELL - 0.3, sg * 0.29), 0.17, YEL, { r2: 0.165, seg: 0.28 }); lineBox(E, 0.35, CELL - 0.35, 0, sg * 0.44, 0, 0.31); }
  } else if (kind === 'T') {   // a crawl tube leaves through this wall
    const mid = CELL / 2, j0 = mid - TUBE_HW - 0.12, j1 = mid + TUBE_HW + 0.12, out = inA ? -1 : 1;   // out: which way is outside, as a multiple of the line's side-A normal
    ribWall(E, s0, j0, 0, ribs, faces); ribWall(E, j1, s1, 0, ribs, faces);
    lineBox(E, 0, mid - TUBE_HW, -0.18, 0.18, 0, 99); lineBox(E, mid + TUBE_HW, CELL, -0.18, 0.18, 0, 99);
    ribWall(E, j0, j1, 4 * RIB, ribs.slice(4), faces);
    for (const s of [j0 + 0.01, j1 - 0.01]) tube(E.px(s, 0), -0.03, E.pz(s, 0), E.px(s, 0), TUBE_H + 0.2, E.pz(s, 0), 0.14, ORA, { capA: 0, capB: 0, rs: 12, seg: 0.2 });
    tube(E.px(j0 - 0.1, 0), TUBE_H + 0.13, E.pz(j0 - 0.1, 0), E.px(j1 + 0.1, 0), TUBE_H + 0.13, E.pz(j1 + 0.1, 0), 0.13, YEL, { seg: 0.2 });
    // the tube itself, running straight out from the wall
    const ox = E.nx * out, oz = E.nz * out, mx = E.px(mid, 0), mz = E.pz(mid, 0), ex = mx + ox * TUBE_LEN, ez = mz + oz * TUBE_LEN;
    const xa = Math.min(mx, ex) - Math.abs(oz) * TUBE_HW, xb = Math.max(mx, ex) + Math.abs(oz) * TUBE_HW, za = Math.min(mz, ez) - Math.abs(ox) * TUBE_HW, zb = Math.max(mz, ez) + Math.abs(ox) * TUBE_HW;
    quilt(xa - Math.abs(oz) * 0.12, za - Math.abs(ox) * 0.12, xb + Math.abs(oz) * 0.12, zb + Math.abs(ox) * 0.12, () => 0, { padX: 0.6, padZ: 0.6, hgt: 0.04, col: () => TEAL_D, firm: true });
    quilt(xa - Math.abs(oz) * 0.12, za - Math.abs(ox) * 0.12, xb + Math.abs(oz) * 0.12, zb + Math.abs(ox) * 0.12, () => TUBE_H + 0.05, { padX: 0.6, padZ: 0.6, hgt: 0.05, down: true, col: () => TEAL });
    const tr = { h: TUBE_H / 4 + 0.013, col: TEAL, t: 0.22 };
    for (const sd of [-1, 1]) {   // its two sides, ribbed like the walls, facing in
      const lx = mx + E.dx * sd * (TUBE_HW + 0.11), lz = mz + E.dz * sd * (TUBE_HW + 0.11);
      const S = line(lx + ox * 0.1, lz + oz * 0.1, lx + ox * TUBE_LEN, lz + oz * TUBE_LEN), toMid = (mx + ox - S.x0) * S.nx + (mz + oz - S.z0) * S.nz;
      ribWall(S, 0, S.L, 0, [tr, tr, tr, tr], { a: toMid > 0, b: toMid < 0 });
      solid(mx + E.dx * sd * TUBE_HW, mx + E.dx * sd * (TUBE_HW + 0.6) + ox * TUBE_LEN, mz + E.dz * sd * TUBE_HW, mz + E.dz * sd * (TUBE_HW + 0.6) + oz * TUBE_LEN, 0, 99);
    }
    solid(ex - 0.3 * Math.abs(ox) - 0.8 * Math.abs(oz), ex + 0.3 * Math.abs(ox) + 0.8 * Math.abs(oz), ez - 0.3 * Math.abs(oz) - 0.8 * Math.abs(ox), ez + 0.3 * Math.abs(oz) + 0.8 * Math.abs(ox), 0, 99);
    ceils.push({ x0: xa - 0.2, x1: xb + 0.2, z0: za - 0.2, z1: zb + 0.2, y: TUBE_H });
    // the hand-over point, and the way a player arriving through it is walking
    ports.push({ mx, mz, ox, oz, hx: mx + ox * HAND, hz: mz + oz * HAND, dx: -ox, dz: -oz, yawIn: Math.atan2(ox, oz), x0: xa - 0.3, x1: xb + 0.3, z0: za - 0.3, z1: zb + 0.3 });
  }
}
for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) buildEdge(true, c, r);
for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) buildEdge(false, c, r);
ports.sort((a, b) => b.mx - a.mx);   // port 0: the east tube (the room of the photograph); port 1: the west tube, the far end

// a dark beam under the roof wherever two cells are one room
for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS; c++) if (VE[r][c] === ' ' && tallCell(c - 1, r) === tallCell(c, r)) { const y = ceilOf(c, r) - 0.07;
  tube(c * CELL, y, r * CELL + 0.1, c * CELL, y, (r + 1) * CELL - 0.1, 0.13, NAVY, { capA: 0, capB: 0, seg: 0.25, rs: 10 }); }
for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (HE[r][c] === ' ' && tallCell(c, r - 1) === tallCell(c, r)) { const y = ceilOf(c, r) - 0.07;
  tube(c * CELL + 0.1, y, r * CELL, (c + 1) * CELL - 0.1, y, r * CELL, 0.13, NAVY, { capA: 0, capB: 0, seg: 0.25, rs: 10 }); }

// balls. Some lie where they rolled to. Some are simply in the air, and stay there.
{
  const R = 0.075, put = (x, y, z, i) => ball(x, y, z, R, BALLS[i]);
  // the first room (cells 5,1 and 5,2): a row of them up under the dark beam, a few lower, as in the photograph
  put(12.36, 1.1, 5.25, 0); put(12.38, 1.13, 5.56, 1); put(12.4, 1.06, 5.92, 2); put(12.36, 1.15, 6.2, 2); put(12.42, 1.1, 6.55, 3);
  put(12.5, 0.92, 5.4, 0); put(12.62, 0.7, 5.95, 4); put(13.1, 1.12, 6.86, 3); put(13.5, 1.05, 6.84, 1);
  // over the stairs, red, where the light is
  put(10.9, 1.38, 3.1, 5); put(10.45, 1.52, 3.85, 5); put(11.3, 1.22, 4.15, 5); put(10.2, 1.3, 3.2, 5);
  // the rest of the castle
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const k = CELLS[r][c]; if (k === 'a' || k === '<' || k === 'R' || (c === 5 && (r === 1 || r === 2))) continue;
    const n = Math.floor(rand() * 3.4), fh = floorH(c, r);
    for (let i = 0; i < n; i++) {
      const air = rand() < 0.3, x = c * CELL + 0.55 + rand() * (CELL - 1.1), z = r * CELL + 0.55 + rand() * (CELL - 1.1);
      put(x, air ? fh + 0.62 + rand() * (ceilOf(c, r) - 0.25 - fh - 0.62) : fh + R + 0.03, z, Math.floor(rand() * BALLS.length));
    }
  }
}

/* ------------------------------------------------------------------ */
/* the mesh                                                            */
/* ------------------------------------------------------------------ */
const geo = new THREE.BufferGeometry();
const posA = new Float32Array(GP), norA = new Float32Array(GN), litA = new Float32Array(nv * 3);
geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
geo.setAttribute('normal', new THREE.BufferAttribute(norA, 3));
geo.setAttribute('aLit', new THREE.BufferAttribute(litA, 3));
geo.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(GR), 2));
geo.setIndex(new THREE.BufferAttribute(new Uint32Array(GI), 1));
const bvh = new MeshBVH(geo, { maxLeafTris: 6 });

/* ------------------------------------------------------------------ */
/* light, worked out once                                              */
/* ------------------------------------------------------------------ */
// dir[]: the directions light is gathered from, spread over the hemisphere so that each counts the same
const NG = 12, GD = []; for (let i = 0; i < NG; i++) { const rr = Math.sqrt((i + 0.5) / NG), ph = i * 2.399963; GD.push([rr * Math.cos(ph), rr * Math.sin(ph), Math.sqrt(1 - rr * rr)]); }
let bakeProgress = 0;
// The light takes a few seconds to work out, so it is kept (IndexedDB) and only worked out again when the castle or the method changes.
function kv(mode, fn) {
  return new Promise((res, rej) => {
    try {
      const rq = indexedDB.open('bounce', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onerror = () => rej(rq.error);
      rq.onsuccess = () => { try { const tx = rq.result.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } };
    } catch (e) { rej(e); }
  });
}
function lightKey() {
  let h = 2166136261 >>> 0; const mix = (x) => { h ^= x; h = Math.imul(h, 16777619) >>> 0; };
  const f = new Float32Array(1), u = new Uint32Array(f.buffer), eat = (arr) => { for (let i = 0; i < arr.length; i++) { f[0] = arr[i]; mix(u[0]); } };
  eat(GP); eat(GC); eat(GE); eat(GA); for (const L of lamps) eat([L.x, L.y, L.z, L.ax, L.az, L.I, L.col[0], L.col[1], L.col[2]]);
  const src = bake.toString(); for (let i = 0; i < src.length; i++) mix(src.charCodeAt(i));
  return 'light-' + nv + '-' + GI.length + '-' + h.toString(16);
}
async function light() {
  let key = null;
  try { key = lightKey(); const got = await kv('readonly', (st) => st.get(key)); if (got && got.length === litA.length) { litA.set(got); geo.attributes.aLit.needsUpdate = true; bakeProgress = 1; return; } } catch (e) { /* no store: work it out */ }
  await bake();
  try { if (key) await kv('readwrite', (st) => { st.clear(); st.put(litA.slice(), key); }); } catch (e) { /* not kept; it will be worked out again next time */ }
}
async function bake() {
  const alb = GC, emi = GE, idx = GI, ray = new THREE.Ray(), o = ray.origin, d = ray.direction;
  const direct = new Float32Array(nv * 3), hitV = new Int32Array(nv * NG), ao = new Float32Array(nv);
  const slice = SOLO ? 30 : 6; let t0 = performance.now();   // inside the game this runs behind the pool, a few milliseconds at a time
  const breathe = async () => { if (performance.now() - t0 > slice) { await new Promise((res) => setTimeout(res, 0)); t0 = performance.now(); } };
  for (let v = 0; v < nv; v++) {
    if ((v & 127) === 0) { bakeProgress = v / nv; await breathe(); }
    const px = posA[v * 3], py = posA[v * 3 + 1], pz = posA[v * 3 + 2], nx = norA[v * 3], ny = norA[v * 3 + 1], nz = norA[v * 3 + 2];
    const ox = px + nx * 0.014, oy = py + ny * 0.014, oz = pz + nz * 0.014;
    // the lamps: two points along each slit, a shadow ray to each
    let dr = 0, dg = 0, db = 0;
    for (const L of lamps) {
      const ddx = L.x - px, ddz = L.z - pz; if (ddx * ddx + ddz * ddz > 42) continue;
      for (const sg of [-1, 1]) {
        const lx = L.x + L.ax * sg - ox, ly = L.y - oy, lz = L.z + L.az * sg - oz, dist = Math.hypot(lx, ly, lz), ndl = (nx * lx + ny * ly + nz * lz) / dist;
        const w = Math.max(0, 0.78 * ndl + 0.22); if (w <= 0) continue;
        o.set(ox, oy, oz); d.set(lx / dist, ly / dist, lz / dist);
        const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, dist - 0.03); if (h && h.distance < dist - 0.03) continue;
        const f = 0.54 * L.I * w / (1 + dist * dist / 1.1); dr += L.col[0] * f; dg += L.col[1] * f; db += L.col[2] * f;
      }
    }
    direct[v * 3] = dr; direct[v * 3 + 1] = dg; direct[v * 3 + 2] = db;
    // what this point sees around it
    let tx, ty, tz; if (Math.abs(ny) < 0.9) { const l = Math.hypot(nz, nx); tx = nz / l; ty = 0; tz = -nx / l; } else { const l = Math.hypot(ny, nz); tx = 0; ty = -nz / l; tz = ny / l; }
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    let occ = 0;
    for (let k = 0; k < NG; k++) {
      const g = GD[k]; o.set(ox, oy, oz); d.set(tx * g[0] + bx * g[1] + nx * g[2], ty * g[0] + by * g[1] + ny * g[2], tz * g[0] + bz * g[1] + nz * g[2]);
      const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 5);
      if (h && h.distance < 5) { hitV[v * NG + k] = idx[h.faceIndex * 3 + (k % 3)]; if (h.distance < 0.2) occ += 1 - h.distance / 0.2; } else hitV[v * NG + k] = -1;
    }
    ao[v] = 1 - occ / NG;
  }
  // colour bouncing between the surfaces, three times round
  let rad = new Float32Array(nv * 3), ind = new Float32Array(nv * 3);
  for (let v = 0; v < nv * 3; v++) rad[v] = alb[v] * direct[v] + emi[v];
  for (let b = 0; b < 3; b++) {
    const next = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      let r = 0, g = 0, bl = 0;
      for (let k = 0; k < NG; k++) { const h = hitV[v * NG + k]; if (h >= 0) { r += rad[h * 3]; g += rad[h * 3 + 1]; bl += rad[h * 3 + 2]; } }
      ind[v * 3] = r / NG; ind[v * 3 + 1] = g / NG; ind[v * 3 + 2] = bl / NG;
      const a = 0.35 + 0.65 * ao[v];
      for (let j = 0; j < 3; j++) next[v * 3 + j] = alb[v * 3 + j] * (direct[v * 3 + j] * a + ind[v * 3 + j]) + emi[v * 3 + j];
    }
    rad = next; await breathe();
  }
  // seams and corners go a little darker than the light alone makes them; the tubes go black toward the hand-over
  for (let v = 0; v < nv; v++) {
    let f = (0.5 + 0.5 * ao[v]) * GA[v];
    const x = posA[v * 3], z = posA[v * 3 + 2];
    for (const P of ports) if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) { const dep = (x - P.mx) * P.ox + (z - P.mz) * P.oz; if (dep > 0.05) f *= Math.pow(clamp(1 - (dep - 0.2) / (HAND - 1.4), 0, 1), 1.6); }
    litA[v * 3] = rad[v * 3] * f; litA[v * 3 + 1] = rad[v * 3 + 1] * f; litA[v * 3 + 2] = rad[v * 3 + 2] * f;
  }
  geo.attributes.aLit.needsUpdate = true; bakeProgress = 1;
}

/* ------------------------------------------------------------------ */
/* renderer, scene                                                     */
/* ------------------------------------------------------------------ */
let canvas = document.getElementById('bc');
if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'bc'; canvas.tabIndex = 0; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;outline:none;cursor:pointer;z-index:5;background:#000'; const pc = document.getElementById('c'); if (pc && pc.parentNode) pc.parentNode.insertBefore(canvas, pc.nextSibling); else document.body.appendChild(canvas); }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
function pickPR() { const w = innerWidth, h = innerHeight; return Math.min(window.devicePixelRatio || 1, Math.sqrt(2.4e6 / Math.max(1, w * h)), 1.5); }
renderer.setPixelRatio(pickPR());
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NoToneMapping;
const stage = new THREE.Scene(); stage.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(88, innerWidth / innerHeight, 0.02, 60); camera.rotation.order = 'YXZ';
const U = { uTime: { value: 0 }, uSag: { value: 0 }, uDim: { value: 1 } };
const vinyl = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.36, metalness: 0 });   // black: the colour comes from the stored light, the material only adds the sheen
// how far the air has gone out of it, at one place: 0.5 to 1 (it never comes down evenly). The same in the shader and for the player's head.
const LUMP = 'float lump = 0.75 + 0.25 * sin(transformed.x * 1.31 + 1.7) * sin(transformed.z * 1.13 + 0.4);';
const lumpAt = (x, z) => 0.75 + 0.25 * Math.sin(x * 1.31 + 1.7) * Math.sin(z * 1.13 + 0.4);
vinyl.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = U.uTime; sh.uniforms.uSag = U.uSag; sh.uniforms.uDim = U.uDim;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aLit;\nattribute vec2 aMat;\nvarying vec3 vLit;\nvarying vec3 vWp;\nvarying float vRough;\nuniform float uTime, uSag;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
    vLit = aLit; vRough = aMat.x; vWp = position;
    { // the whole thing is held up by air: it never quite stands still
      float hy = clamp(transformed.y / ${CEIL.toFixed(2)}, 0.0, 1.0), w = sin(transformed.x * 2.1 + uTime * 5.3) * cos(transformed.z * 1.7 - uTime * 4.1);
      transformed.xz += (0.003 + 0.012 * uSag) * hy * hy * vec2(w, -w) * aMat.y;
      // and when the air goes, it comes down
      ${LUMP}
      float s = uSag * aMat.y;
      transformed.xz += s * hy * hy * 0.22 * vec2(sin(transformed.z * 0.9 + transformed.y * 2.6), cos(transformed.x * 0.8 + transformed.y * 2.9));
      transformed.y *= 1.0 - s * lump * hy;
    }`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vLit; varying vec3 vWp; varying float vRough; uniform float uDim;
    float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
    // the skin is never smooth: small creases that only show where the light catches
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { vec3 q = vWp * vec3(26.0, 41.0, 26.0), w = vec3(n3(q), n3(q + 17.3), n3(q + 41.7)) - 0.5; q = vWp * 71.0; w += 0.5 * (vec3(n3(q), n3(q + 9.1), n3(q + 27.4)) - 0.5);
      normal = normalize(normal + (viewMatrix * vec4(w, 0.0)).xyz * 0.13); }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vRough;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vLit * uDim;');
};
const mesh = new THREE.Mesh(geo, vinyl); mesh.frustumCulled = false; stage.add(mesh);
// three lamps that only make highlights: each frame they sit in the nearest slits the eye can see
const glints = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xfff0d0, 0, 7, 2); stage.add(l); return { l, lamp: null, k: 0 }; });

/* ------------------------------------------------------------------ */
/* post-processing: the look of the photograph                          */
/* ------------------------------------------------------------------ */
const pr0 = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(innerWidth * pr0), Math.round(innerHeight * pr0), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(stage, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.8, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uGray: { value: 0 }, uBarrel: { value: 0.22 }, uPaint: { value: 1 }, uPx: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uGray, uBarrel, uPaint; uniform vec2 uPx; varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  // a brush: of the four patches around the point, take the calmest one (edges stay, the surface between them goes smooth)
  vec3 brush(vec2 uv){
    vec3 best = vec3(0.0); float bv = 1e9;
    for (int q = 0; q < 4; q++) {
      vec2 sg = vec2(q == 0 || q == 2 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0); vec3 m = vec3(0.0), m2 = vec3(0.0);
      for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) { vec3 c = min(texture2D(tDiffuse, uv + sg * vec2(float(i), float(j)) * uPx * uPaint).rgb, vec3(1.6)); m += c; m2 += c * c; }
      m /= 9.0; m2 = abs(m2 / 9.0 - m * m); float v = m2.r + m2.g + m2.b;
      if (v < bv) { bv = v; best = m; }
    }
    return best;
  }
  void main(){
    vec2 c = vUv - 0.5; float r2 = dot(c, c);
    vec2 uv = 0.5 + c * (1.0 - 0.5 * uBarrel + uBarrel * r2);          // the bulge of a wide lens
    vec2 d = (uv - 0.5) * (0.0008 + r2 * 0.006);
    vec3 col = uPaint > 0.0 ? brush(uv) : texture2D(tDiffuse, uv).rgb;
    col.r = mix(col.r, texture2D(tDiffuse, uv - d).r, 0.6); col.b = mix(col.b, texture2D(tDiffuse, uv + d).b, 0.6);
    col = max(col, 0.0); col = mix(col, 1.0 - 0.28 * exp(-(col - 0.72) / 0.28), step(0.72, col));   // highlights roll off instead of clipping
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.88);                                     // a touch under full colour
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.4);                // deeper shadows, the highlights kept
    col = col * 0.975 + vec3(0.008, 0.011, 0.018);                     // blacks never quite black, and a little cold
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), uGray);
    col *= 1.0 - smoothstep(0.05, 0.6, r2) * 0.66;                     // heavy corners
    float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(613.0, 271.0)) - 0.5;
    col += n * 0.03;
    col *= 1.0 - uFade;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`,
});
composer.addPass(grade);
function resize() {
  const pr = pickPR(); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); grade.uniforms.uPx.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); grade.uniforms.uPaint.value = Math.max(1, innerHeight * pr / 900);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ------------------------------------------------------------------ */
/* player                                                              */
/* ------------------------------------------------------------------ */
const V3 = THREE.Vector3;
const player = { pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, h: H_STAND, crouch: false, onGround: false, ground: 0, bob: 0, blocked: 0, mantle: null, dip: 0, dipV: 0, camY: 0, slide: 0 };
const keys = Object.create(null);
let cDownAt = 0, cToggledOn = false;
const X_MIN = -TUBE_LEN - 1, X_MAX = COLS * CELL + TUBE_LEN + 1;
const topOf = (s, x, z) => s.ramp ? s.ramp(clamp(x, s.x0, s.x1), clamp(z, s.z0, s.z1)) : s.y1;
function ceilAt(x, z) { let y = ceilOf(Math.floor(x / CELL), Math.floor(z / CELL)) - 0.15; for (const c of ceils) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y < y) y = c.y; return y * (1 - U.uSag.value * lumpAt(x, z) * Math.min(1, y / CEIL)); }
// the highest thing under this point that the feet (at height y) can be standing on
function groundAt(x, z, y, reach) { let g = 0, hit = null; for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) { const t = topOf(s, x, z); if (t <= y + reach && t > g) { g = t; hit = s; } } groundAt.hit = hit; return g; }
function blockedAt(x, z, y, h) {   // would a body standing at (x, y, z) be inside something
  for (const s of solids) { const t = topOf(s, x, z); if (t <= y + 0.02 || s.y0 >= y + h) continue; const cx = clamp(x, s.x0, s.x1), cz = clamp(z, s.z0, s.z1); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < PR * PR * 0.8) return true; }
  return false;
}
function collide() {
  const p = player.pos, v = player.vel;
  for (let it = 0; it < 2; it++) for (const s of solids) {
    if (p.x < s.x0 - PR || p.x > s.x1 + PR || p.z < s.z0 - PR || p.z > s.z1 + PR) continue;
    const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1);
    if (topOf(s, cx, cz) <= p.y + STEP || s.y0 >= p.y + player.h) continue;
    let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz; if (d2 >= PR * PR) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), push = PR - d; dx /= d; dz /= d; p.x += dx * push; p.z += dz * push; const vn = v.x * dx + v.z * dz; if (vn < 0) { v.x -= vn * dx * 1.25; v.z -= vn * dz * 1.25; } }   // vinyl gives a little back
    else {   // centre inside the box: out through the nearest side
      const a = p.x - s.x0, b = s.x1 - p.x, c = p.z - s.z0, e = s.z1 - p.z, m = Math.min(a, b, c, e);
      if (m === a) { p.x = s.x0 - PR; if (v.x > 0) v.x = 0; } else if (m === b) { p.x = s.x1 + PR; if (v.x < 0) v.x = 0; } else if (m === c) { p.z = s.z0 - PR; if (v.z > 0) v.z = 0; } else { p.z = s.z1 + PR; if (v.z < 0) v.z = 0; }
    }
  }
}
function tryMantle(wx, wz) {   // pushing against something low: climb onto it, the way a child goes over everything in here
  const p = player.pos;
  for (const reach of [PR + 0.14, PR + 0.3]) {
    const top = 0.8 * Math.max(scaleK, 0.5), tx = p.x + wx * reach, tz = p.z + wz * reach, g = groundAt(tx, tz, p.y, top);   // shrunk, you do not get over as much
    if (g - p.y < STEP || g - p.y > top) continue;
    if (ceilAt(tx, tz) - g < H_CROUCH + 0.05 || blockedAt(tx, tz, g, H_CROUCH)) continue;
    player.mantle = { t: 0, dur: 0.42, from: p.clone(), to: new V3(tx, g, tz) }; player.vel.set(0, 0, 0); return true;
  }
  return false;
}
function stepPlayer(dt) {
  const p = player.pos, v = player.vel;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), il = Math.hypot(fw, st), sprint = keys.ShiftLeft || keys.ShiftRight;
  let spd = player.crouch || player.h < H_STAND * 0.76 ? (sprint ? 1.5 : 0.8) : (sprint ? 3.0 : 1.5); if (il > 1) spd /= il;
  const wx = (-sy * fw + cy * st) * spd, wz = (-cy * fw - sy * st) * spd;
  const onSlide = player.slide > 0;
  const acc = player.onGround ? (onSlide ? 1.2 : 11) : 4, k = 1 - Math.exp(-acc * dt);
  v.x += (wx - v.x) * k; v.z += (wz - v.z) * k; v.y -= G * dt;
  if (keys.Space && player.ground > 0 && v.y <= 0.01 && player.h > H_STAND * 0.9) { v.y = 3.2; player.ground = 0; player.dipV -= 0.5; thump(0.5); }
  const px0 = p.x, pz0 = p.z, y0 = p.y, want = Math.hypot(v.x, v.z) * dt, wasOn = player.onGround;
  p.x = clamp(p.x + v.x * dt, X_MIN, X_MAX); p.z += v.z * dt; p.y += v.y * dt;
  collide();
  const g = groundAt(p.x, p.z, Math.max(p.y, y0), STEP), gs = groundAt.hit;
  if (p.y <= g || (wasOn && v.y <= 0 && p.y - g < STEP + 0.02)) {
    const hitV = -v.y; p.y = g;
    if (!wasOn && hitV > 1.6) {   // landing on an air floor
      player.dipV -= Math.min(1.6, hitV * 0.28); thump(clamp(hitV / 6, 0.2, 1));
      if (keys.Space && player.h > H_STAND * 0.9) { v.y = Math.min(4.7, Math.max(3.2, hitV * 0.9 + 0.75)); player.onGround = false; player.ground = 0; }   // keep jumping and it throws you higher
      else if (hitV > 2.6) { v.y = hitV * 0.3; player.onGround = false; }
      else { v.y = 0; player.onGround = true; }
    } else { v.y = 0; player.onGround = true; }
  } else player.onGround = false;
  player.ground = player.onGround ? 0.12 : Math.max(0, player.ground - dt);
  player.slide = player.onGround && gs && gs.slide ? 0.15 : Math.max(0, player.slide - dt);
  if (player.onGround && gs && gs.slide) { v.x += gs.slide[0] * 5.5 * dt; v.z += gs.slide[1] * 5.5 * dt; }   // the slide takes over
  const c = ceilAt(p.x, p.z); if (p.y + player.h > c && v.y > 0) { p.y = Math.max(g, c - player.h); v.y = -0.4 * v.y; }
  if (il > 0 && player.onGround && want > 1e-5 && Math.hypot(p.x - px0, p.z - pz0) < want * 0.45) {
    player.blocked += dt;
    if (player.blocked > 0.09) { player.blocked = 0; const l = Math.hypot(wx, wz) || 1; if (tryMantle(wx / l, wz / l)) return; }
  } else if (player.onGround) player.blocked = 0;
  if (player.onGround) { const b0 = player.bob; player.bob += Math.hypot(v.x, v.z) * dt; if (Math.floor(b0 * 8 / Math.PI) !== Math.floor(player.bob * 8 / Math.PI) && !onSlide) squeak(clamp(Math.hypot(v.x, v.z) / 3, 0.25, 1)); }
}
// The size gun in here. Smaller always works; bigger needs the room a full-size body takes, right where you stand.
window.__bounceSize = {
  can(toSmall) {
    if (!on || player.mantle) return false; if (toSmall) return true;
    const p = player.pos, r = 0.28 * PS0 * 0.9, h = 1.7 * PS0; if (ceilAt(p.x, p.z) - p.y < h + 0.02) return false;
    for (const s of solids) { if (topOf(s, p.x, p.z) <= p.y + 0.02 || s.y0 >= p.y + h) continue; const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1); if ((p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz) < r * r) return false; }
    return true;
  },
  apply(toSmall) { small = toSmall; },
};
if (SOLO && !window.__sizeGunScene) window.__sizeGunScene = window.__bounceSize;
function canStand() { const p = player.pos; return ceilAt(p.x, p.z) - p.y > player.h + 0.03; }
function updatePlayer(dt) {
  { const kt = small ? 0.42 : 1; if (scaleK !== kt) setScale(Math.abs(kt - scaleK) < dt * 1.6 ? kt : scaleK + Math.sign(kt - scaleK) * dt * 1.6); }   // the size gun: ease to the new size
  if (player.mantle) {
    const m = player.mantle; m.t = Math.min(1, m.t + dt / m.dur); const e = m.t * m.t * (3 - 2 * m.t);
    player.pos.set(m.from.x + (m.to.x - m.from.x) * e * e, m.from.y + (m.to.y - m.from.y) * Math.min(1, e * 1.35), m.from.z + (m.to.z - m.from.z) * e * e);
    if (m.t >= 1) { player.mantle = null; player.vel.set(0, 0, 0); player.onGround = true; }
  } else { const n = 4; for (let i = 0; i < n && !player.mantle; i++) stepPlayer(dt / n); }
  let target = player.crouch ? H_CROUCH : H_STAND; if (target > player.h + 0.01 && !canStand()) target = player.h;
  const dh = target - player.h, stepH = 2.4 * dt; player.h += clamp(dh, -stepH, stepH);
  { const room = ceilAt(player.pos.x, player.pos.z) - player.pos.y; if (room < player.h) player.h = Math.max(H_CROUCH * 0.7, room); }   // the roof on your head: down you go
  // the floor gives under the feet and comes back
  player.dipV += (-90 * player.dip - 11 * player.dipV) * dt; player.dip = clamp(player.dip + player.dipV * dt, -0.12, 0.06);
}
function placeCamera(dt) {
  const p = player.pos, sp = Math.hypot(player.vel.x, player.vel.z);
  let ey = p.y + player.h - EYE;
  player.camY += (ey - player.camY) * (Math.abs(ey - player.camY) > 0.6 ? 1 : Math.min(1, dt * 16));   // steps are taken smoothly
  ey = player.camY + player.dip + (player.onGround ? Math.abs(Math.sin(player.bob * 8)) * 0.012 * clamp(sp / 1.4, 0, 1.4) : 0);
  camera.position.set(p.x, ey, p.z);
  camera.rotation.set(player.pitch, player.yaw, player.onGround ? Math.sin(player.bob * 8) * 0.004 * clamp(sp / 1.5, 0, 1.5) : 0);
  camera.updateMatrixWorld();
}

/* ------------------------------------------------------------------ */
/* sound: the blower, and feet on vinyl                                 */
/* ------------------------------------------------------------------ */
let AC = null, acOut = null, acNoise = null, blower = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = new Ctx();
    acOut = AC.createGain(); acOut.gain.value = 0; acOut.connect(AC.destination);
    acNoise = AC.createBuffer(1, AC.sampleRate * 3, AC.sampleRate); { const d = acNoise.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.2 + w * 0.05; } }
    // the fan: a wide low rush of air, a motor note under it, and the faint flutter of the skin
    const src = AC.createBufferSource(); src.buffer = acNoise; src.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
    const ag = AC.createGain(); ag.gain.value = 0.5;
    const mo = AC.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = 58; const mlp = AC.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 170; const mg = AC.createGain(); mg.gain.value = 0.085;
    const mo2 = AC.createOscillator(); mo2.type = 'sine'; mo2.frequency.value = 116.6; const mg2 = AC.createGain(); mg2.gain.value = 0.03;
    const fl = AC.createOscillator(); fl.frequency.value = 6.3; const fg = AC.createGain(); fg.gain.value = 0.05; fl.connect(fg); fg.connect(ag.gain);
    const dr = AC.createOscillator(); dr.frequency.value = 0.09; const dg = AC.createGain(); dg.gain.value = 1.4; dr.connect(dg); dg.connect(mo.frequency);
    const bus = AC.createGain(); bus.gain.value = 0.55;
    src.connect(lp); lp.connect(ag); ag.connect(bus); mo.connect(mlp); mlp.connect(mg); mg.connect(bus); mo2.connect(mg2); mg2.connect(bus); bus.connect(acOut);
    src.start(); mo.start(); mo2.start(); fl.start(); dr.start();
    blower = { bus, mo, mo2, lp };
  } catch (e) { AC = null; }
}
function thump(k) {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  const o = AC.createOscillator(); o.frequency.setValueAtTime(95 + 40 * k, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * k + 0.03, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(acOut); o.start(t); o.stop(t + 0.24);
}
function squeak(k) {   // a footfall: a soft thud and the rub of a sock on vinyl
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  const o = AC.createOscillator(); o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.08);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11); o.connect(g); g.connect(acOut); o.start(t); o.stop(t + 0.13);
  const s = AC.createBufferSource(); s.buffer = acNoise; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900 + Math.random() * 500, t); bp.frequency.linearRampToValueAtTime(1700 + Math.random() * 600, t + 0.07); bp.Q.value = 5;
  const sg = AC.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.5 * k, t + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); s.connect(bp); bp.connect(sg); sg.connect(acOut); s.start(t, Math.random() * 2); s.stop(t + 0.1);
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
let on = false, dragging = false;
const locked = () => !!document.pointerLockElement;
addEventListener('keydown', (e) => {
  if (!on) { if (!e.repeat) keys[e.code] = true; return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true; initAudio();
  if (e.code === 'KeyC') { cDownAt = performance.now(); if (player.crouch) { player.crouch = false; cToggledOn = false; } else { player.crouch = true; cToggledOn = true; } }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyC' && cToggledOn && performance.now() - cDownAt > 380) { player.crouch = false; cToggledOn = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dragging = false; });
canvas.addEventListener('mousedown', () => {
  canvas.focus(); initAudio(); if (locked()) return; dragging = true;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* stay in drag-look */ }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (!on || (!locked() && !dragging)) return; player.yaw -= (e.movementX || 0) * 0.0022; player.pitch = clamp(player.pitch - (e.movementY || 0) * 0.0022, -1.5, 1.5); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* coming and going                                                    */
/* ------------------------------------------------------------------ */
// A player in a tube is described the same way on both sides of the hand-over: d metres past the hand-over point (measured the way
// someone coming IN is walking), u metres to the side, y above the tube floor, and a heading and speed relative to that way in.
function fromPort(st) {
  if (st.small !== undefined) { small = !!st.small; setScale(st.scale || (small ? 0.42 : 1)); }
  const P = ports[st.port] || ports[0], p = player.pos, d = Math.max(0, st.d || 0), u = clamp(st.u || 0, -TUBE_HW + PR, TUBE_HW - PR);
  p.set(P.hx + P.dx * d - P.dz * u, Math.max(0, st.y || 0), P.hz + P.dz * d + P.dx * u);
  const vs = st.vs || 0, vu = st.vu || 0; player.vel.set(P.dx * vs - P.dz * vu, st.vy || 0, P.dz * vs + P.dx * vu);
  player.yaw = P.yawIn + (st.yaw || 0); player.pitch = st.pitch || 0; player.h = st.h || H_STAND; player.crouch = !!st.crouch; player.bob = st.bob || 0;
  player.mantle = null; player.onGround = false; player.ground = 0; player.dip = player.dipV = 0; player.camY = p.y + player.h - EYE; player.blocked = 0; player.slide = 0;
}
function portOf(p) { for (let i = 0; i < ports.length; i++) { const P = ports[i]; if (p.x > P.x0 && p.x < P.x1 && p.z > P.z0 && p.z < P.z1 && (p.x - P.mx) * P.ox + (p.z - P.mz) * P.oz > 0) return i; } return -1; }
function leaveBy(i) {
  const P = ports[i], p = player.pos, v = player.vel, d = (p.x - P.hx) * P.dx + (p.z - P.hz) * P.dz, u = (p.x - P.hx) * -P.dz + (p.z - P.hz) * P.dx;
  const st = { port: i, d, u, y: p.y, yaw: player.yaw - P.yawIn, pitch: player.pitch, vs: v.x * P.dx + v.z * P.dz, vu: v.x * -P.dz + v.z * P.dx, vy: v.y, h: player.h, crouch: player.crouch, bob: player.bob, small, scale: scaleK };
  if (SOLO || !window.__bounceReturn) {   // nothing outside: the far end of one tube is the far end of the other
    st.port = 1 - i; st.d = Math.max(0, -d); st.vs = -st.vs; st.vu = -st.vu; st.u = -u; st.yaw += Math.PI; fromPort(st); inflate(); entry = st.port; return;
  }
  on = false; inflate(); st.held = Object.keys(keys).filter((k) => keys[k]); for (const k in keys) keys[k] = false;
  try { if (AC && AC.state === 'running') AC.suspend(); } catch (e) {}
  canvas.style.display = 'none';
  window.__bounceReturn(st);
}
let last = -1, time = 0;
// When you are past the middle of the castle, the blower stops. The light goes with it, and the castle starts to come down.
// There is time to get out through either tube. If the roof gets you first: dark, and you are back in the tunnel you came by.
let entry = 0, inside = 0, fail = -1, hiss = null, creakAt = 0;
const FAIL_RAMP = 52, FAIL_END = 60;
function inflate() {
  fail = -1; inside = 0; U.uSag.value = 0; U.uDim.value = 1; grade.uniforms.uGray.value = 0;
  if (hiss) { try { hiss.g.gain.value = 0; hiss.src.stop(); } catch (e) {} hiss = null; }
  if (blower && AC) { try { blower.bus.gain.cancelScheduledValues(AC.currentTime); blower.bus.gain.value = 0.55; blower.mo.frequency.cancelScheduledValues(AC.currentTime); blower.mo.frequency.value = 58; blower.mo2.frequency.cancelScheduledValues(AC.currentTime); blower.mo2.frequency.value = 116.6; } catch (e) {} }
}
function powerCut() {
  fail = 0; creakAt = 6;
  if (!AC || AC.state !== 'running' || !blower) return; const t = AC.currentTime;
  try {   // the fan runs down
    blower.bus.gain.setValueAtTime(blower.bus.gain.value, t); blower.bus.gain.linearRampToValueAtTime(0.0001, t + 3.2);
    blower.mo.frequency.setValueAtTime(58, t); blower.mo.frequency.exponentialRampToValueAtTime(14, t + 3.0);
    blower.mo2.frequency.setValueAtTime(116.6, t); blower.mo2.frequency.exponentialRampToValueAtTime(28, t + 3.0);
    // and what is left is the air leaving, very quietly
    const src = AC.createBufferSource(); src.buffer = acNoise; src.loop = true; const hp = AC.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.6;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t + 2.5); g.gain.exponentialRampToValueAtTime(0.5, t + 6); g.gain.exponentialRampToValueAtTime(0.1, t + FAIL_END);
    src.connect(hp); hp.connect(g); g.connect(acOut); src.start(t + 2.4); hiss = { src, g };
  } catch (e) {}
}
function creak() {   // vinyl folding somewhere
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime, f = 140 + Math.random() * 160, dur = 0.5 + Math.random() * 0.9;
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.55 + Math.random() * 0.3), t + dur);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 7; const pan = AC.createStereoPanner ? AC.createStereoPanner() : null; if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); bp.connect(g); if (pan) { g.connect(pan); pan.connect(acOut); } else g.connect(acOut); o.start(t); o.stop(t + dur + 0.05);
}
function updateAir(dt) {
  const p = player.pos;
  if (fail < 0) {
    inside += dt;
    const mid = COLS * CELL / 2, past = entry === 0 ? p.x < mid - 0.5 : p.x > mid + 0.5;
    if (past && inside > 6 && p.x > 0 && p.x < COLS * CELL) powerCut();
    return 0;
  }
  fail += dt;
  const k = sstep(2.5, 2.5 + FAIL_RAMP, fail);
  U.uSag.value = 0.86 * Math.pow(k, 1.25);
  U.uDim.value = 1 - 0.62 * sstep(0.2, 5, fail) - 0.16 * k;
  grade.uniforms.uGray.value = 0.7 * sstep(1, 30, fail);
  creakAt -= dt; if (creakAt <= 0) { creak(); creakAt = 1.2 + Math.random() * 4.5 * (1 - 0.6 * k); }
  if (fail > FAIL_END + 2.2) {   // under the roof, in the dark: and then the tunnel again
    const P = ports[entry]; p.set(P.hx - P.dx * 0.7, 0, P.hz - P.dz * 0.7); player.vel.set(0, 0, 0); player.yaw = P.yawIn + Math.PI; player.pitch = 0; player.mantle = null; player.h = H_STAND; player.crouch = false;
    inflate(); for (const c in keys) keys[c] = false;
    return 1;
  }
  return sstep(FAIL_END - 1.5, FAIL_END + 0.4, fail);   // how black the picture is
}
window.__bounceStart = (st) => {
  if (on || !ready) return false; on = true; inflate(); entry = st && st.port === 1 ? 1 : 0;
  for (const k in keys) keys[k] = false; for (const c of (st && st.held) || []) keys[c] = true;
  fromPort(st || { port: 0, d: 1.6 }); last = -1; resize();
  canvas.style.display = 'block'; grade.uniforms.uFade.value = 1;
  initAudio();
  requestAnimationFrame(frame); return true;
};

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
const _ray = new THREE.Ray();
function updateGlints(dt) {
  const cp = camera.position;
  for (const gl of glints) gl.want = 0;
  // the three nearest slits with a clear line to the eye
  const near = lamps.map((L) => ({ L, d: Math.hypot(L.x - cp.x, L.y - cp.y, L.z - cp.z) })).filter((a) => a.d < 6.5).sort((a, b) => a.d - b.d);
  const seen = [];
  for (const a of near) { if (seen.length >= glints.length) break; _ray.origin.copy(cp); _ray.direction.set(a.L.x - cp.x, a.L.y - cp.y, a.L.z - cp.z).multiplyScalar(1 / a.d); const h = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, a.d - 0.05); if (!h || h.distance > a.d - 0.05) seen.push(a.L); }
  for (const gl of glints) { if (gl.lamp && seen.includes(gl.lamp)) { gl.want = 1; seen.splice(seen.indexOf(gl.lamp), 1); } }
  for (const gl of glints) { if (!gl.want && gl.k < 0.02 && seen.length) { gl.lamp = seen.shift(); gl.want = 1; gl.l.position.set(gl.lamp.x, gl.lamp.y - 0.22, gl.lamp.z); gl.l.color.setRGB(gl.lamp.col[0], gl.lamp.col[1], gl.lamp.col[2]); } }
  for (const gl of glints) { gl.k += ((gl.want ? 1 : 0) - gl.k) * Math.min(1, dt * 4); gl.l.intensity = gl.lamp ? gl.k * gl.lamp.I * 5.5 * U.uDim.value * U.uDim.value : 0; }
}
let dark = 0;
// one step of the world. Returns how far the player is past a tube's hand-over point (99: not in a tube).
function tick(dt) {
  if (keys.ArrowLeft) player.yaw += 1.8 * dt; if (keys.ArrowRight) player.yaw -= 1.8 * dt;
  if (keys.ArrowUp) player.pitch = Math.min(1.5, player.pitch + 1.3 * dt); if (keys.ArrowDown) player.pitch = Math.max(-1.5, player.pitch - 1.3 * dt);
  updatePlayer(dt); dark = updateAir(dt);
  let pi = portOf(player.pos); if (pi < 0) return 99;
  let P = ports[pi], d = (player.pos.x - P.hx) * P.dx + (player.pos.z - P.hz) * P.dz;
  if (d < -0.6) { leaveBy(pi); if (!on) return -1; pi = portOf(player.pos); if (pi < 0) return 99; P = ports[pi]; d = (player.pos.x - P.hx) * P.dx + (player.pos.z - P.hz) * P.dz; }
  return d;
}
function frame(now) {
  if (!on) return;
  requestAnimationFrame(frame);
  if (last < 0) last = now;
  const dt = clamp((now - last) / 1000, 0, 1 / 20); last = now; time += dt;
  const d = tick(dt); if (!on) return;
  placeCamera(dt);
  updateGlints(dt);
  U.uTime.value = time; grade.uniforms.uTime.value = time;
  grade.uniforms.uFade.value = Math.max(dark, 1 - sstep(0.1, 1.5, d));   // black at the hand-over point, the room's own light by a metre and a half in
  if (AC && acOut) acOut.gain.value += (sstep(-0.5, 4.5, d) * 0.9 - acOut.gain.value) * Math.min(1, dt * 6);
  composer.render();
}

/* ------------------------------------------------------------------ */
/* get ready                                                           */
/* ------------------------------------------------------------------ */
let ready = false;
window.__bounce = { player, camera, keys, ports, solids, lamps, grade, U, rocket, powerCut, get fail() { return fail; }, set fail(v) { fail = v; }, get progress() { return bakeProgress; }, get on() { return on; }, get verts() { return nv; },
  // put the player somewhere and draw one frame (testing from the console)
  look(x, y, z, yaw, pitch) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.yaw = yaw; player.pitch = pitch || 0; player.camY = y + player.h - EYE; player.mantle = null; },
  // run the world for a while without drawing it
  sim(sec) { for (let t = 0; t < sec && on; t += 1 / 60) tick(1 / 60); const p = player.pos; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +player.yaw.toFixed(2)]; } };
(async () => {
  await light();
  // the room's own picture as what the vinyl reflects
  {
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), cubeCam = new THREE.CubeCamera(0.05, 30, cubeRT);
    cubeCam.position.set(13.2, 0.7, 4.4); stage.add(cubeCam); cubeCam.update(renderer, stage); stage.remove(cubeCam);
    const pm = new THREE.PMREMGenerator(renderer); stage.environment = pm.fromCubemap(cubeRT.texture).texture; pm.dispose(); cubeRT.dispose();
    vinyl.envMapIntensity = 0.5;
  }
  try { renderer.compile(stage, camera); } catch (e) {}
  ready = true; window.__bounceReady = true;
  if (SOLO) { const go = () => window.__bounceStart({ port: 0, d: 1.2 }); go(); }
})().catch((e) => { window.__bounceFailed = true; console.error('bounce house failed to build', e); if (window.__showErr) window.__showErr(e && e.message || e); });
