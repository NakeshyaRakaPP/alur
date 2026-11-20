// Camera projection checks: angle 0 must reproduce the classic iso view
// EXACTLY (every pre-camera test and the approved look depend on it), and
// the projection must round-trip at any azimuth — pointer picking relies
// on pickCell(isoCenter(cell)) === cell for every angle.
import {
  SPLIT_PORT_ANGLES,
  boardWarp,
  camBasis,
  cellKey,
  diamondAt,
  diamondPoints,
  isoCenter,
  machineDepth,
  pickCell,
  portPos,
  screenToGridFloat,
  splitPortAngles,
} from '../src/geometry';
import type { NodeDef } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
}
function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

// (a) Angle 0 == the legacy formulas, cell by cell.
for (let r = 0; r < 7; r++) {
  for (let c = 0; c < 12; c++) {
    const p = isoCenter(c, r, 0);
    check(`iso0 ${c},${r}`, near(p.x, 375 + (c - r) * 42) && near(p.y, 130 + (c + r) * 21), JSON.stringify(p));
    const d = diamondPoints(p, 0.6, 0)
      .split(' ')
      .map((s) => s.split(',').map(Number));
    const legacy = diamondAt(p.x, p.y, 42 - 0.6, 21 - 0.3)
      .split(' ')
      .map((s) => s.split(',').map(Number));
    check(
      `diamond0 ${c},${r}`,
      d.every((pt, i) => near(pt[0], legacy[i][0], 1e-9) && near(pt[1], legacy[i][1], 1e-9)),
    );
  }
}
check(
  'port angles 0 == legacy',
  near(SPLIT_PORT_ANGLES[0], (Math.atan2(-21, 42) * 180) / Math.PI) &&
    near(SPLIT_PORT_ANGLES[1], (Math.atan2(21, -42) * 180) / Math.PI) &&
    near(SPLIT_PORT_ANGLES[2], (Math.atan2(21, 42) * 180) / Math.PI) &&
    near(splitPortAngles(0)[1], SPLIT_PORT_ANGLES[1]),
  JSON.stringify(SPLIT_PORT_ANGLES),
);
const splitPlaced = { '5,3': { type: 'split' } as NodeDef };
const anchor = isoCenter(5, 3, 0);
const pp0 = portPos('5,3', 0, splitPlaced, 0);
const pp1 = portPos('5,3', 1, splitPlaced, 0);
const pp2 = portPos('5,3', 2, splitPlaced, 0);
check('portPos0 legacy', near(pp0.x, anchor.x + 35.8, 0.6) && near(pp0.y, anchor.y - 17.9, 0.6), JSON.stringify(pp0));
check('portPos1 legacy', near(pp1.x, anchor.x - 35.8, 0.6) && near(pp1.y, anchor.y + 17.9, 0.6), JSON.stringify(pp1));
check('portPos2 legacy', near(pp2.x, anchor.x + 35.8, 0.6) && near(pp2.y, anchor.y + 17.9, 0.6), JSON.stringify(pp2));

// (b) Round-trip at many azimuths: every cell centre picks itself.
for (const ang of [0, 15, 30, 45, 90, 137, 180, 225, 270, 315, 359]) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 12; c++) {
      const p = isoCenter(c, r, ang);
      check(`roundtrip ${ang} ${c},${r}`, pickCell(p.x, p.y, ang) === cellKey(c, r));
      const f = screenToGridFloat(p.x, p.y, ang);
      check(`float ${ang} ${c},${r}`, near(f.c, c, 1e-6) && near(f.r, r, 1e-6));
    }
  }
}

// (c) The board rotates about its centre: the projected board-centre is
// the same screen point at every angle, and the basis determinant (cell
// area) never degenerates.
const centre0 = isoCenter(5.5, 3, 0);
for (const ang of [33, 90, 180, 271]) {
  const cc = isoCenter(5.5, 3, ang);
  check(`centre fixed ${ang}`, near(cc.x, centre0.x, 1e-6) && near(cc.y, centre0.y, 1e-6), JSON.stringify(cc));
  const B = camBasis(ang);
  check(`det ${ang}`, near(B.ax * B.by - B.ay * B.bx, 1764, 1e-3), String(B.ax * B.by - B.ay * B.bx));
}

// (d) Painter depth follows the view: at 180° the far corner at 0° is the
// near corner, so the ordering of two opposite machines flips.
const nearId = '0,0';
const farId = '11,6';
const placed: Record<string, NodeDef> = {
  [nearId]: { type: 'filter', color: 'R' } as NodeDef,
  [farId]: { type: 'filter', color: 'R' } as NodeDef,
};
check(
  'depth flips at 180',
  machineDepth(farId, placed, 0) > machineDepth(nearId, placed, 0) &&
    machineDepth(farId, placed, 180) < machineDepth(nearId, placed, 180),
);

// (e) The board warp (used to carry the pixel belt tiles into the camera
// view) maps every angle-0 screen point onto the true rotated projection,
// and is the identity at angle 0.
for (const ang of [0, 25, 90, 160, 180, 270, 340]) {
  const w = boardWarp(ang);
  for (let r = 0; r < 7; r += 3) {
    for (let c = 0; c < 12; c += 4) {
      const p0 = isoCenter(c, r, 0);
      const dx = p0.x - 375;
      const dy = p0.y - 130;
      const wx = w.ox + w.m11 * dx + w.m12 * dy;
      const wy = w.oy + w.m21 * dx + w.m22 * dy;
      const pt = isoCenter(c, r, ang);
      check(`warp ${ang} ${c},${r}`, near(wx, pt.x, 1e-6) && near(wy, pt.y, 1e-6), `${wx},${wy} vs ${pt.x},${pt.y}`);
    }
  }
}

console.log(`test-camera: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
