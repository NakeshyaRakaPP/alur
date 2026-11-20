// Isometric grid core for the ALUR board: projection, machine footprints,
// and the pure belt-drag logic. Ported from the v6.5 iso proof (DRAGCORE +
// ISO blocks) — no DOM access in this module.

import type { BeltConn, Conns, NodeDef, NodeType } from './types';

export interface Point {
  x: number;
  y: number;
}

export const COLS = 12;
export const ROWS = 7;

export function cellKey(c: number, r: number): string {
  return c + ',' + r;
}

export function parseCell(k: string): { c: number; r: number } {
  const p = k.split(',');
  return { c: parseInt(p[0], 10), r: parseInt(p[1], 10) };
}

// ---- Camera projection (2:1 iso, free azimuth) ----
// The board is an isometric grid seen by a camera that orbits the vertical
// axis: angle 0 is the classic view (+c runs down-right, +r down-left) and
// any other angle rotates both screen axes around the board's centre, so
// angle 0 keeps the exact classic framing. Machine sprites stay upright
// billboards — only their anchor points travel with the projection.
export const ISO_TW = 84;
export const ISO_TH = 42;
export const ISO_OX = 375;
export const ISO_OY = 130;

export interface CamBasis {
  /** Screen step per +1 grid c. */
  ax: number;
  ay: number;
  /** Screen step per +1 grid r. */
  bx: number;
  by: number;
  /** Screen position of grid (0, 0). */
  ox: number;
  oy: number;
}

function rawBasis(angleDeg: number): { ax: number; ay: number; bx: number; by: number } {
  const t = ((angleDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return {
    ax: (ISO_TW / 2) * (cos - sin),
    ay: (ISO_TH / 2) * (cos + sin),
    bx: (ISO_TW / 2) * (-sin - cos),
    by: (ISO_TH / 2) * (cos - sin),
  };
}

function boardCenter(b: { ax: number; ay: number; bx: number; by: number }): { x: number; y: number } {
  const corners: [number, number][] = [
    [-0.5, -0.5],
    [COLS - 0.5, -0.5],
    [-0.5, ROWS - 0.5],
    [COLS - 0.5, ROWS - 0.5],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [c, r] of corners) {
    const x = c * b.ax + r * b.bx;
    const y = c * b.ay + r * b.by;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function camBasis(angleDeg: number): CamBasis {
  const b = rawBasis(angleDeg);
  const c = boardCenter(b);
  const c0 = boardCenter(rawBasis(0));
  return { ...b, ox: ISO_OX + (c0.x - c.x), oy: ISO_OY + (c0.y - c.y) };
}

/**
 * The affine warp that carries the whole angle-0 board painting (floor,
 * belt tiles — pixel art drawn for the classic view) into the current
 * camera view: p' = O(θ) + M · (p − O(0)), with M sending the classic
 * basis vectors to the rotated ones. Applied as one SVG group transform,
 * it keeps the pixel tileset pixel-true at any azimuth while billboards
 * (machine sprites, tokens, labels) stay outside the group, unwarped.
 */
export function boardWarp(angleDeg: number): { m11: number; m12: number; m21: number; m22: number; ox: number; oy: number } {
  const B = camBasis(angleDeg);
  const b0 = rawBasis(0);
  const det = b0.ax * b0.by - b0.ay * b0.bx;
  // M = [aθ bθ] · [a0 b0]^-1
  const m11 = (B.ax * b0.by - B.bx * b0.ay) / det;
  const m12 = (B.bx * b0.ax - B.ax * b0.bx) / det;
  const m21 = (B.ay * b0.by - B.by * b0.ay) / det;
  const m22 = (B.by * b0.ax - B.ay * b0.bx) / det;
  return { m11, m12, m21, m22, ox: B.ox, oy: B.oy };
}

export function boardWarpTransform(angleDeg: number): string {
  const w = boardWarp(angleDeg);
  return (
    `translate(${w.ox} ${w.oy}) ` +
    `matrix(${w.m11} ${w.m21} ${w.m12} ${w.m22} 0 0) ` +
    `translate(${-ISO_OX} ${-ISO_OY})`
  );
}

export function isoCenter(c: number, r: number, angleDeg = 0): Point {
  const B = camBasis(angleDeg);
  return { x: B.ox + c * B.ax + r * B.bx, y: B.oy + c * B.ay + r * B.by };
}

export function screenToGridFloat(x: number, y: number, angleDeg = 0): { c: number; r: number } {
  const B = camBasis(angleDeg);
  const dx = x - B.ox;
  const dy = y - B.oy;
  const det = B.ax * B.by - B.ay * B.bx;
  return { c: (dx * B.by - dy * B.bx) / det, r: (B.ax * dy - B.ay * dx) / det };
}

export function pickCell(x: number, y: number, angleDeg = 0): string | null {
  const f = screenToGridFloat(x, y, angleDeg);
  const c = Math.round(f.c);
  const r = Math.round(f.r);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return cellKey(c, r);
}

export function cellCenter(k: string, angleDeg = 0): Point {
  const p = parseCell(k);
  return isoCenter(p.c, p.r, angleDeg);
}

export function cellsAdjacent(a: string, b: string): boolean {
  const pa = parseCell(a);
  const pb = parseCell(b);
  return Math.abs(pa.c - pb.c) + Math.abs(pa.r - pb.r) === 1;
}

export function leftCellOf(k: string): string {
  const p = parseCell(k);
  return cellKey(p.c - 1, p.r);
}

export function depthOfCell(k: string, angleDeg = 0): number {
  const p = parseCell(k);
  const B = camBasis(angleDeg);
  return (p.c * B.ay + p.r * B.by) / (ISO_TH / 2);
}

export function diamondAt(cx: number, cy: number, hw: number, hh: number): string {
  return cx + ',' + (cy - hh) + ' ' + (cx + hw) + ',' + cy + ' ' + cx + ',' + (cy + hh) + ' ' + (cx - hw) + ',' + cy;
}

/** The four corners of a grid cell around its centre, in the current camera view (top, right, bottom, left at angle 0). */
export function diamondPoints(c: Point, inset: number, angleDeg = 0): string {
  const B = camBasis(angleDeg);
  const f = 1 - (inset || 0) / (ISO_TW / 2);
  const ax = (B.ax / 2) * f;
  const ay = (B.ay / 2) * f;
  const bx = (B.bx / 2) * f;
  const by = (B.by / 2) * f;
  const pts: [number, number][] = [
    [c.x - ax - bx, c.y - ay - by],
    [c.x + ax - bx, c.y + ay - by],
    [c.x + ax + bx, c.y + ay + by],
    [c.x - ax + bx, c.y - ay + by],
  ];
  return pts.map(([x, y]) => x + ',' + y).join(' ');
}

/** Projected outline of a machine's whole footprint (used as its ground shadow): the four footprint corners, slightly inset. */
export function footprintQuad(id: string, placed: Record<string, NodeDef>, angleDeg = 0, insetCells = 0.07): string {
  const a = parseCell(machineCell(id));
  const fp = footprintOf(id, placed);
  const c0 = a.c - 0.5 + insetCells;
  const r0 = a.r - 0.5 + insetCells;
  const c1 = a.c + fp.w - 0.5 - insetCells;
  const r1 = a.r + fp.d - 0.5 - insetCells;
  const corners: [number, number][] = [
    [c0, r0],
    [c1, r0],
    [c1, r1],
    [c0, r1],
  ];
  return corners
    .map(([c, r]) => {
      const p = isoCenter(c, r, angleDeg);
      return p.x + ',' + p.y;
    })
    .join(' ');
}

// ---- Fixed machines (INPUT / OUTPUT anchors) ----
export const FIXED: Record<string, string> = {
  IN: cellKey(0, 3),
  OUT: cellKey(10, 3),
  A: cellKey(10, 1),
  B: cellKey(10, 5),
};

export function isFixed(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIXED, id);
}

/** The anchor cell a machine stands on: fixed machines use FIXED, placed machines are keyed by their anchor cell. */
export function machineCell(id: string): string {
  return isFixed(id) ? FIXED[id] : id;
}

export function anchorOf(id: string, angleDeg = 0): Point {
  return cellCenter(machineCell(id), angleDeg);
}

// ---- Footprints (in grid cells, cols x rows; id = anchor / top-left cell) ----
export type FootprintType = NodeType | 'input' | 'output';

export const FOOTPRINTS: Record<FootprintType, { w: number; d: number }> = {
  input: { w: 1, d: 1 },
  output: { w: 2, d: 1 },
  filter: { w: 1, d: 1 },
  transform: { w: 1, d: 1 },
  split: { w: 1, d: 1 },
  tahan: { w: 2, d: 1 },
  sort: { w: 2, d: 1 },
  merge: { w: 2, d: 1 },
};

export function footprintTypeOf(id: string, placed: Record<string, NodeDef>): FootprintType | null {
  if (id === 'IN') return 'input';
  if (isFixed(id)) return 'output';
  return placed[id] ? placed[id].type : null;
}

export function footprintOf(id: string, placed: Record<string, NodeDef>): { w: number; d: number } {
  const t = footprintTypeOf(id, placed);
  return (t && FOOTPRINTS[t]) || { w: 1, d: 1 };
}

export function footprintOfType(type: FootprintType): { w: number; d: number } {
  return FOOTPRINTS[type] || { w: 1, d: 1 };
}

export function footprintCellsAt(anchorKey: string, type: FootprintType): string[] {
  const a = parseCell(anchorKey);
  const fp = footprintOfType(type);
  const cells: string[] = [];
  for (let dc = 0; dc < fp.w; dc++) {
    for (let dr = 0; dr < fp.d; dr++) cells.push(cellKey(a.c + dc, a.r + dr));
  }
  return cells;
}

export function footprintCells(id: string, placed: Record<string, NodeDef>): string[] {
  const t = footprintTypeOf(id, placed);
  return footprintCellsAt(machineCell(id), t ?? 'filter');
}

export function fpCenterOf(id: string, placed: Record<string, NodeDef>, angleDeg = 0): Point {
  const a = parseCell(machineCell(id));
  const fp = footprintOf(id, placed);
  return isoCenter(a.c + (fp.w - 1) / 2, a.r + (fp.d - 1) / 2, angleDeg);
}

export function machineDepth(id: string, placed: Record<string, NodeDef>, angleDeg = 0): number {
  const a = parseCell(machineCell(id));
  const fp = footprintOf(id, placed);
  const B = camBasis(angleDeg);
  return ((a.c + fp.w - 1) * B.ay + (a.r + fp.d - 1) * B.by) / (ISO_TH / 2);
}

export function machineAtCell(cell: string, placed: Record<string, NodeDef>): string | null {
  for (const id in FIXED) if (footprintCells(id, placed).indexOf(cell) >= 0) return id;
  for (const a in placed) if (footprintCells(a, placed).indexOf(cell) >= 0) return a;
  return null;
}

/**
 * The footprint tile a press on a machine belongs to: the tile whose cell
 * contains the press point's grid projection, or — when the projection
 * lands outside the footprint (a press on the sprite's overhang) — the
 * nearest footprint tile by screen distance. A belt drag out of a machine
 * departs from THIS tile's edge, so a 2-tile machine (BUFFER / SORT /
 * MERGE) can be drawn from whichever half the player actually grabbed:
 * holding the far tile works even when the anchor tile's exits are crowded.
 */
export function heldTileOf(cells: string[], pt: Point, angleDeg = 0): string {
  const f = screenToGridFloat(pt.x, pt.y, angleDeg);
  const key = cellKey(Math.round(f.c), Math.round(f.r));
  if (cells.indexOf(key) >= 0) return key;
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    const ctr = cellCenter(c, angleDeg);
    const d = (ctr.x - pt.x) * (ctr.x - pt.x) + (ctr.y - pt.y) * (ctr.y - pt.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** A cell is placeable for a machine type when its whole footprint is on the board, off machines, off belts, and off any extra blocked cells (expert obstacles). */
export function cellPlaceable(
  cell: string,
  type: FootprintType,
  placed: Record<string, NodeDef>,
  conns: Conns,
  extraBlocked?: Set<string>,
): boolean {
  const cells = footprintCellsAt(cell, type);
  for (const c of cells) {
    const p = parseCell(c);
    if (p.c < 0 || p.c >= COLS || p.r < 0 || p.r >= ROWS) return false;
    if (extraBlocked && extraBlocked.has(c)) return false;
    if (machineAtCell(c, placed)) return false;
    for (const k in conns) if (conns[k].path.indexOf(c) >= 0) return false;
  }
  return true;
}

// ---- Ports (screen positions, for the port markers and stuck-token anim) ----
// The SPLIT sprite is a billboard: it never rotates, but the belt ends its
// ports feed DO travel with the camera. Port 0 leaves by the grid-north
// step, port 1 by grid-south, port 2 by grid-east — so each port's screen
// position and direction are the camera-projected grid steps: 40px from
// the anchor along the step's unit vector.
function unitOf(x: number, y: number): Point {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

/** Unit screen directions of the SPLIT out ports in the current view: 0 = grid north step, 1 = grid south, 2 = grid east. */
export function splitPortDirs(angleDeg = 0): [Point, Point, Point] {
  const B = camBasis(angleDeg);
  const ua = unitOf(B.ax, B.ay);
  const ub = unitOf(B.bx, B.by);
  return [{ x: -ub.x, y: -ub.y }, ub, ua];
}

export function portPos(id: string, idx: number, placed: Record<string, NodeDef>, angleDeg = 0): Point {
  const a = anchorOf(id, angleDeg);
  const n = placed[id];
  if (n && n.type === 'split') {
    const d = splitPortDirs(angleDeg)[idx];
    return { x: a.x + d.x * 40, y: a.y + d.y * 40 };
  }
  const ap = parseCell(machineCell(id));
  const fp = footprintOf(id, placed);
  const rc = isoCenter(ap.c + fp.w - 1, ap.r, angleDeg);
  return { x: rc.x + 38, y: rc.y };
}

export function inPortPos(id: string, angleDeg = 0): Point {
  const a = anchorOf(id, angleDeg);
  return { x: a.x - 38, y: a.y };
}

/**
 * Screen direction of each SPLIT out port, as angles (degrees, atan2
 * convention: 0 = east on screen, positive = clockwise/downward) of the
 * grid step that leaves by that port, in the current camera view.
 */
export function splitPortAngles(angleDeg = 0): [number, number, number] {
  return splitPortDirs(angleDeg).map((d) => (Math.atan2(d.y, d.x) * 180) / Math.PI) as [number, number, number];
}

export const SPLIT_PORT_ANGLES: [number, number, number] = splitPortAngles(0);

function angDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Which SPLIT output port a hold starts drawing from (ports 0, 1, 2).
 * The port whose exit direction is closest to the pointer's direction from
 * the machine anchor wins, with the v4.1 semantics generalized to sectors:
 * - a press deep inside a taken port's sector (within 20° of its axis) is a
 *   deliberate redraw of that port;
 * - a press in a taken port's outer sector falls to the angularly nearest
 *   free port instead;
 * - in the dead band near a sector boundary (over 40° from every axis), or
 *   with the pointer basically on the anchor, the current port is kept when
 *   it is free, otherwise the nearest free port is preselected.
 * `current` is the session's port so far (-1 when there is none yet).
 */
export function pickSplitPort3(
  has: [boolean, boolean, boolean],
  angleDeg: number,
  distPx: number,
  current: number,
  portAngles: [number, number, number] = SPLIT_PORT_ANGLES,
): 0 | 1 | 2 {
  const dists = portAngles.map((a) => angDist(angleDeg, a));
  const nearest = dists.indexOf(Math.min(...dists)) as 0 | 1 | 2;
  if (distPx >= 14 && dists[nearest] <= 40) {
    if (!has[nearest]) return nearest;
    if (dists[nearest] <= 20) return nearest;
    const free = ([0, 1, 2] as const).filter((i) => !has[i]).sort((a, b) => dists[a] - dists[b]);
    if (free.length) return free[0];
    return nearest;
  }
  // Dead band / on the anchor: keep a free current port, else preselect the
  // angularly nearest free port, else keep current, else the nearest port.
  if (current >= 0 && current <= 2 && distPx < 14) return current as 0 | 1 | 2;
  if (current >= 0 && current <= 2 && !has[current]) return current as 0 | 1 | 2;
  const free = ([0, 1, 2] as const).filter((i) => !has[i]).sort((a, b) => dists[a] - dists[b]);
  if (free.length) return free[0];
  if (current >= 0 && current <= 2) return current as 0 | 1 | 2;
  return nearest;
}

/**
 * The active SPLIT port during a drag session. While no belt cell has been
 * laid yet the port follows the pointer's direction sector live
 * (pickSplitPort3, with the hold-time preselection as the starting value);
 * once the preview path is non-empty the port is locked to the session's
 * current port — it can only change again after the preview empties (the
 * cursor returning over the source machine), and never after commit.
 */
export function splitLivePort3(
  pathLength: number,
  has: [boolean, boolean, boolean],
  angleDeg: number,
  distPx: number,
  current: number,
  portAngles: [number, number, number] = SPLIT_PORT_ANGLES,
): 0 | 1 | 2 {
  if (pathLength > 0) return (current >= 0 && current <= 2 ? current : 0) as 0 | 1 | 2;
  return pickSplitPort3(has, angleDeg, distPx, current, portAngles);
}

/**
 * Dragging the pointer back into the source SPLIT's own footprint mid-drag
 * abandons the uncommitted path: the session returns to live port selection
 * so the player can walk out the other side and draw the other port, all
 * without lifting the pointer. Only SPLIT sources reset this way; for any
 * other machine (or an empty path, or a cell outside the footprint) this
 * stays false and the drag keeps its current semantics.
 */
export function splitDragReset(
  isSplit: boolean,
  pathLength: number,
  cell: string | null,
  srcCells: string[],
): boolean {
  if (!isSplit || pathLength === 0 || !cell) return false;
  return srcCells.indexOf(cell) >= 0;
}

// ---- Belt tiles ----
export const BELT_TILE_W = 112;
export const BELT_TILE_H = 80;
export const BELT_TILE_CX = 56;
export const BELT_TILE_CY = 42;
export const BELT_LIFT = 9;

const BELT_TILE_BY_PAIR: Record<string, string> = { EW: 'ew', NS: 'ns', ES: 'es', SW: 'sw', NW: 'wn', EN: 'ne' };

export function dirBetween(a: string, b: string): string | null {
  const pa = parseCell(a);
  const pb = parseCell(b);
  const dc = pb.c - pa.c;
  const dr = pb.r - pa.r;
  if (dc === 1 && dr === 0) return 'E';
  if (dc === -1 && dr === 0) return 'W';
  if (dc === 0 && dr === 1) return 'S';
  if (dc === 0 && dr === -1) return 'N';
  return null;
}

export function beltTileKey(edgeA: string | null, edgeB: string | null): string | null {
  if (!edgeA || !edgeB) return null;
  return BELT_TILE_BY_PAIR[[edgeA, edgeB].sort().join('')] || null;
}

export function beltEndKey(edgeIn: string | null): string | null {
  return edgeIn ? 'end_' + edgeIn.toLowerCase() : null;
}

export function edgeRefCell(cells: string[], cell: string, fallback: string): string {
  for (const sc of cells) if (cellsAdjacent(sc, cell)) return sc;
  return fallback;
}

/** Polyline a token rides for one connection: machine anchor, belt cells (lifted), destination anchor. An open-ended trail (to = null) ends on its last belt cell instead. */
export function connPoints(fromId: string, conn: BeltConn, angleDeg = 0): { x: number; y: number; l: number }[] {
  const pa = anchorOf(fromId, angleDeg);
  const pts: { x: number; y: number; l: number }[] = [{ x: pa.x, y: pa.y, l: 0 }];
  conn.path.forEach((cell) => {
    const cc = cellCenter(cell, angleDeg);
    pts.push({ x: cc.x, y: cc.y, l: BELT_LIFT });
  });
  if (conn.to !== null) {
    const pb = anchorOf(conn.to, angleDeg);
    pts.push({ x: pb.x, y: pb.y, l: 0 });
  }
  return pts;
}

// ---- Rail accounting + drag core ----
export function railsUsed(conns: Conns): number {
  return Object.keys(conns).reduce((s, k) => s + conns[k].path.length, 0);
}

export interface DragCtx {
  srcKey: string;
  srcCell: string;
  srcCells: string[];
  path: string[];
  base: number;
  limit: number;
}

export function dragBegin(
  conns: Conns,
  srcKey: string,
  srcCell: string,
  railLimit: number | null,
  srcCells?: string[],
): DragCtx {
  const base = Object.keys(conns).reduce((s, k) => s + (k === srcKey ? 0 : conns[k].path.length), 0);
  return {
    srcKey,
    srcCell,
    srcCells: srcCells && srcCells.length ? srcCells : [srcCell],
    path: [],
    base,
    limit: railLimit == null ? Infinity : railLimit,
  };
}

export function dragExtend(ctx: DragCtx, cell: string, blocked: Set<string>): boolean {
  const path = ctx.path;
  if (path.length && path[path.length - 1] === cell) return true;
  if (path.length >= 2 && path[path.length - 2] === cell) {
    path.pop();
    return true;
  }
  if (path.indexOf(cell) >= 0) return false;
  if (blocked.has(cell)) return false;
  if (path.length) {
    if (!cellsAdjacent(path[path.length - 1], cell)) return false;
  } else if (!(ctx.srcCells || [ctx.srcCell]).some((sc) => cellsAdjacent(sc, cell))) {
    return false;
  }
  if (ctx.base + path.length + 1 > ctx.limit) return false;
  path.push(cell);
  return true;
}

export function cellsAdjAny(aCells: string[], bCells: string[]): boolean {
  return aCells.some((a) => bCells.some((b) => cellsAdjacent(a, b)));
}

export interface DragTarget {
  cell: string;
  cells: string[];
  hasIn: boolean;
}

// ---- Auto-path (BFS shortest route for the belt drag) ----
// The belt no longer has to be guided cell by cell: on every pointer move the
// preview is the shortest orthogonal route from the source machine's
// footprint to the cell under the cursor (or to the doorstep of the machine
// under the cursor). Neighbour order is fixed (E, S, W, N) so the result is
// deterministic: the same inputs always yield the same route.

const BELT_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Free cells directly beside any of `targetCells` — the doorstep cells a belt may end on when it runs into that machine. */
export function beltGoalCells(targetCells: string[], blocked: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cell of targetCells) {
    const p = parseCell(cell);
    for (const [dc, dr] of BELT_DIRS) {
      const c = p.c + dc;
      const r = p.r + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const k = cellKey(c, r);
      if (blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export interface BeltPathResult {
  /** Route cells in travel order (first cell sits beside the source footprint, last cell is a goal cell), or null when no legal route exists. */
  path: string[] | null;
  /** True when a route exists but is longer than the remaining rail budget. The route is still returned so the UI can show it in the over-budget style; it must not be committed. */
  overBudget: boolean;
}

export function findBeltPath(opts: {
  /** Footprint cells of the source machine; the belt starts on a free cell beside one of them. */
  srcCells: string[];
  /** Acceptable final belt cells (free cells, e.g. the cursor cell or a target machine's doorstep cells). */
  goalCells: string[];
  /** When the belt runs straight into a machine: if a source cell already touches one of these cells, an empty path is the valid route. */
  directCells?: string[];
  /** Cells the belt may never enter (machine footprints, other belts, obstacles, off-board is implicit). */
  blocked: Set<string>;
  /** Remaining rails the route may use; may be Infinity. */
  budget: number;
}): BeltPathResult {
  const { srcCells, goalCells, blocked, budget } = opts;
  if (opts.directCells && cellsAdjAny(srcCells, opts.directCells)) {
    return { path: [], overBudget: false };
  }
  const goalSet = new Set(goalCells);
  if (!goalSet.size) return { path: null, overBudget: false };

  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const sc of srcCells) {
    const p = parseCell(sc);
    for (const [dc, dr] of BELT_DIRS) {
      const c = p.c + dc;
      const r = p.r + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const k = cellKey(c, r);
      if (blocked.has(k) || parent.has(k)) continue;
      parent.set(k, null);
      queue.push(k);
    }
  }

  let found: string | null = null;
  for (let i = 0; i < queue.length && !found; i++) {
    const cur = queue[i];
    if (goalSet.has(cur)) {
      found = cur;
      break;
    }
    const p = parseCell(cur);
    for (const [dc, dr] of BELT_DIRS) {
      const c = p.c + dc;
      const r = p.r + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const k = cellKey(c, r);
      if (blocked.has(k) || parent.has(k)) continue;
      parent.set(k, cur);
      queue.push(k);
    }
  }
  if (!found) return { path: null, overBudget: false };

  const path: string[] = [];
  let cur: string | null = found;
  while (cur) {
    path.push(cur);
    cur = parent.get(cur) ?? null;
  }
  path.reverse();
  return { path, overBudget: path.length > budget };
}

/**
 * Route a belt OUT of a machine. The belt may leave the footprint by
 * whichever edge is shortest — a 2-tile machine's own body never forces a
 * detour, because the token is still "inside" the machine until it steps
 * onto the first belt cell. The tile the player actually held keeps
 * priority whenever its route is no longer than the footprint-wide best,
 * so exits still follow the held half when both work equally well.
 */
export function findMachineExitPath(opts: {
  /** Footprint cells of the source machine. */
  srcCells: string[];
  /** The footprint cell the player held to start this drag, when known. */
  heldTile?: string | null;
  /** Acceptable final belt cells (free cells, e.g. the cursor cell or a target machine's doorstep cells). */
  goalCells: string[];
  /** When the belt runs straight into a machine: if a source cell already touches one of these cells, an empty path is the valid route. */
  directCells?: string[];
  /** Cells the belt may never enter (machine footprints, other belts, obstacles, off-board is implicit). */
  blocked: Set<string>;
  /** Remaining rails the route may use; may be Infinity. */
  budget: number;
}): BeltPathResult {
  const wide = findBeltPath(opts);
  const held = opts.heldTile;
  if (!held || opts.srcCells.length < 2 || !opts.srcCells.includes(held)) return wide;
  const fromHeld = findBeltPath({ ...opts, srcCells: [held] });
  if (fromHeld.path && wide.path && fromHeld.path.length <= wide.path.length) return fromHeld;
  return wide;
}

export interface TrailExtensionResult {
  /** Full path: the frozen prefix followed by the new segment. Equals the prefix alone when no route was found or the extension is empty. */
  path: string[];
  /** Only the newly routed cells (empty when nothing was added). */
  segment: string[];
  /** True when a route to the goal exists. When false, the caller must fall back to the untouched prefix. */
  routed: boolean;
  /** True when a route exists but the COMBINED path (prefix + segment) is longer than the total budget. The combined route is still returned so the UI can show it in the over-budget style; it must not be committed. */
  overBudget: boolean;
}

/**
 * Continue an open-ended trail from its tip. The laid path is a frozen
 * prefix: it is never re-routed and never appears in the result twice. Only
 * the segment from the last prefix cell (the tip) to the goal is searched,
 * with the plain belt BFS, so the segment inherits every belt rule —
 * shortest legal route, deterministic, and it can never share a cell with
 * anything in `blocked`. The caller puts every prefix cell into `blocked`,
 * which is what stops the extension from folding back over its own trail;
 * the tip still works as the BFS origin because the search starts from the
 * tip's neighbours, never from the tip cell itself.
 */
export function findTrailExtension(opts: {
  /** The laid path of the open trail; its last cell is the tip the extension grows from. Never modified. */
  prefix: string[];
  /** Acceptable final belt cells for the new segment (free cells, e.g. the cursor cell or a target machine's doorstep cells). */
  goalCells: string[];
  /** When the tip already touches one of these cells (a target machine's footprint), an empty segment is the valid route. */
  directCells?: string[];
  /** Cells the new segment may never enter: every prefix cell, every other connection's path, machine footprints, obstacles. */
  blocked: Set<string>;
  /** Total rails the COMBINED path (prefix + segment) may use; may be Infinity. */
  budget: number;
}): TrailExtensionResult {
  const { prefix, goalCells, directCells, blocked, budget } = opts;
  if (!prefix.length || !goalCells.length) {
    return { path: [...prefix], segment: [], routed: false, overBudget: false };
  }
  const tip = prefix[prefix.length - 1];
  const res = findBeltPath({
    srcCells: [tip],
    goalCells,
    directCells,
    blocked,
    budget: budget - prefix.length,
  });
  if (res.path === null) {
    return { path: [...prefix], segment: [], routed: false, overBudget: false };
  }
  return {
    path: [...prefix, ...res.path],
    segment: res.path,
    routed: true,
    overBudget: res.overBudget,
  };
}

export interface DragHover {
  machineId: string | null;
  targets: Record<string, DragTarget>;
  srcId: string;
}

// NOTE: unlike the 2-level proof, the full app allows several belts into one
// machine (merge levels c2-3 / c2-5 are built on it), so dragFinish does not
// require the destination's in port to be free — only that it has one.
export function dragFinish(ctx: DragCtx, hover: DragHover): string | null {
  const path = ctx.path;
  const end = path.length ? path[path.length - 1] : null;
  const srcCells = ctx.srcCells || [ctx.srcCell];
  if (hover.machineId) {
    const t = hover.targets[hover.machineId];
    if (t && t.hasIn && hover.machineId !== hover.srcId) {
      const tCells = t.cells || [t.cell];
      if (!path.length) {
        if (cellsAdjAny(srcCells, tCells)) return hover.machineId;
      } else if (cellsAdjAny([end!], tCells)) {
        return hover.machineId;
      }
    }
  }
  if (end) {
    for (const id in hover.targets) {
      const t = hover.targets[id];
      if (id === hover.srcId || !t.hasIn) continue;
      if (leftCellOf(t.cell) === end) return id;
    }
  }
  return null;
}

/**
 * Whether releasing the drag on an empty cell commits an open-ended trail
 * (a laid belt that reaches no machine yet). Requires a non-empty preview
 * whose last cell is exactly the cell under the cursor, no machine under
 * the cursor, and that cell not blocked. The over-budget gate stays with
 * the caller (an over-budget preview never commits anything).
 */
export function dragOpenEnd(
  ctx: DragCtx,
  cell: string | null,
  hoverMachineId: string | null,
  blocked: Set<string>,
): string | null {
  if (!ctx.path.length) return null;
  if (hoverMachineId) return null;
  if (!cell || blocked.has(cell)) return null;
  return ctx.path[ctx.path.length - 1] === cell ? cell : null;
}
