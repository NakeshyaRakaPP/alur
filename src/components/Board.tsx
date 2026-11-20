import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import {
  BELT_TILE_CX,
  BELT_TILE_CY,
  BELT_TILE_H,
  BELT_TILE_W,
  COLS,
  ROWS,
  anchorOf,
  beltEndKey,
  beltGoalCells,
  beltTileKey,
  boardWarpTransform,
  cellCenter,
  cellPlaceable,
  diamondAt,
  diamondPoints,
  dirBetween,
  dragBegin,
  dragFinish,
  dragOpenEnd,
  edgeRefCell,
  findMachineExitPath,
  findTrailExtension,
  footprintCells,
  footprintOf,
  footprintOfType,
  footprintQuad,
  fpCenterOf,
  heldTileOf,
  isoCenter,
  machineAtCell,
  machineCell,
  machineDepth,
  parseCell,
  pickCell,
  pickSplitPort3,
  portPos,
  splitLivePort3,
  splitPortAngles,
  splitPortDirs,
} from '../geometry';
import type { DragCtx, DragHover, Point } from '../geometry';
import { BELT_IMG, COLOR_HEX, INPUT_IMG, NODE_IMG, OUTPUT_IMG, nodeLabel, splitRoutingOf } from '../nodeMeta';
import { ensureMasks, masksReady, spriteOpaque } from '../sprites';
import type { SpriteKind } from '../sprites';
import type { ColorCode, Conns, Level, NodeDef, PlacedNode } from '../types';

export interface BoardProps {
  level: Level;
  placed: Record<string, PlacedNode>;
  conns: Conns;
  /** The rack machine currently selected for placement (drives the ghost preview), or null. */
  ghost: NodeDef | null;
  running: boolean;
  bufLabels: Record<string, string>;
  flashNodeId: string | null;
  svgRef: RefObject<SVGSVGElement>;
  tokenLayerRef: RefObject<SVGGElement>;
  /** Blocked cells (expert obstacles): rendered inactive, rejected for placement and belts. */
  obstacles?: string[];
  /** Anchor ids of locked machines (expert): pre-placed, cannot be removed. */
  lockedIds?: string[];
  /** End cell of an open trail where a token stopped (failed run): pulsed on the board. */
  stuckCell?: string | null;
  /** Camera azimuth in degrees (0 = classic view). The board re-projects everything from it. */
  angle: number;
  /** Reports camera rotations from floor drags; the owner keeps the angle so the token layer shares it. */
  onAngleChange: (deg: number) => void;
  onPlace: (cell: string) => void;
  onPlaceRejected: (cell: string) => void;
  onUnplace: (id: string) => void;
  /** Opens the Route editor for a placed SPLIT (chip tap). Locked splits get no chip. */
  onEditRoute: (id: string) => void;
  onConnsChange: (next: Conns, kind: 'connect' | 'delete') => void;
  onDragRails: (used: number | null) => void;
}

interface DragState {
  pointerId: number;
  srcId: string;
  idx: number;
  srcKey: string;
  ctx: DragCtx;
  blocked: Set<string>;
  hoverMachine: string | null;
  cell: string | null;
  /** The auto-path preview exists but is longer than the remaining rail budget: shown red, never committed. */
  over: boolean;
  /** Trail-continuation session: the source port is fixed (no live SPLIT port switching). */
  fixedPort: boolean;
  /** Trail-continuation session: the trail's laid path, kept as a frozen prefix the drag may only extend from its tip. Null for ordinary drags. */
  frozen: string[] | null;
  /** The footprint tile the player held to start this drag: the exit route prefers it whenever it costs no extra rails. */
  srcTile: string | null;
}

interface DownInfo {
  x: number;
  y: number;
  t: number;
  conn: string | null;
  mach: string | null;
  cell: string | null;
  /** Connection key when the press landed on the end cell of an open-ended trail (hold continues that trail). */
  trailKey: string | null;
}

function beltTilesFor(
  key: string,
  conn: Conns[string],
  placed: Record<string, NodeDef>,
): { cell: string; tile: string | null }[] {
  const srcId = key.split(':')[0];
  const srcCell = machineCell(srcId);
  const srcCells = footprintCells(srcId, placed);
  const dstCells = conn.to !== null ? footprintCells(conn.to, placed) : null;
  const dstCell = conn.to !== null ? machineCell(conn.to) : null;
  return conn.path.map((cell, i) => {
    const prev = i === 0 ? edgeRefCell(srcCells, cell, srcCell) : conn.path[i - 1];
    if (i === conn.path.length - 1 && !dstCells) {
      // Open-ended trail: the last cell wears an end cap.
      return { cell, tile: beltEndKey(dirBetween(cell, prev)) };
    }
    const next =
      i === conn.path.length - 1 ? edgeRefCell(dstCells!, cell, dstCell!) : conn.path[i + 1];
    return { cell, tile: beltTileKey(dirBetween(cell, prev), dirBetween(cell, next)) };
  });
}

const HOLD_MS = 220;

export default function Board(props: BoardProps) {
  const { level, placed, conns, ghost, bufLabels, flashNodeId } = props;
  const angle = props.angle;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [flashCellKey, setFlashCellKey] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdIdx, setHoldIdx] = useState<number | null>(null);
  const [holdCell, setHoldCell] = useState<string | null>(null);
  const [, setMaskVersion] = useState(0);

  const propsRef = useRef(props);
  propsRef.current = props;
  const angleRef = useRef(angle);
  angleRef.current = angle;
  const camRef = useRef<{ pointerId: number; startX: number; startAngle: number; active: boolean } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const downRef = useRef<DownInfo | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const placedDefs = placed as Record<string, NodeDef>;
  const allIds = ['IN', ...level.outputs, ...Object.keys(placed)];
  const obstacleSet = new Set(props.obstacles ?? []);
  const lockedSet = new Set(props.lockedIds ?? []);

  useEffect(() => {
    let alive = true;
    ensureMasks().then(() => {
      if (alive) setMaskVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  function flashCell(cell: string) {
    setFlashCellKey(cell);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashCellKey(null), 420);
  }

  function evtPoint(clientX: number, clientY: number): Point | null {
    const svg = propsRef.current.svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * 960) / r.width,
      y: ((clientY - r.top) * 560) / r.height,
    };
  }

  function evtCell(clientX: number, clientY: number): string | null {
    const pt = evtPoint(clientX, clientY);
    return pt ? pickCell(pt.x, pt.y, angleRef.current) : null;
  }

  function spriteKindOf(id: string): SpriteKind {
    if (id === 'IN') return 'input';
    const p = propsRef.current;
    if (p.placed[id]) return p.placed[id].type;
    return 'output';
  }

  /**
   * Per-pixel machine hit test: the topmost machine (painter order) whose
   * sprite has an opaque pixel at the point wins. Falls back to the grid
   * cell lookup while the alpha masks are still loading.
   */
  function machineAtPoint(pt: Point): string | null {
    const p = propsRef.current;
    const ang = angleRef.current;
    if (!masksReady()) {
      const cell = pickCell(pt.x, pt.y, ang);
      return cell ? machineAtCell(cell, p.placed) : null;
    }
    const ids = ['IN', ...p.level.outputs, ...Object.keys(p.placed)];
    const ordered = ids
      .map((id) => ({ id, d: machineDepth(id, p.placed, ang) }))
      .sort((a, b) => b.d - a.d);
    for (const { id } of ordered) {
      const ctr = fpCenterOf(id, p.placed, ang);
      const fp = footprintOf(id, p.placed);
      const S = 112 * (fp.w === 2 ? 1.25 : 1);
      const u = (pt.x - (ctr.x - S / 2)) / S;
      const v = (pt.y - (ctr.y + 12 - S)) / S;
      if (u >= 0 && u < 1 && v >= 0 && v < 1 && spriteOpaque(spriteKindOf(id), u, v)) return id;
    }
    return null;
  }

  function connAtCell(cell: string): string | null {
    const p = propsRef.current;
    for (const k of Object.keys(p.conns)) if (p.conns[k].path.indexOf(cell) >= 0) return k;
    return null;
  }

  function dragHoverFor(d: DragState): DragHover {
    const p = propsRef.current;
    const targets: DragHover['targets'] = {};
    for (const id of ['IN', ...p.level.outputs, ...Object.keys(p.placed)]) {
      targets[id] = {
        cell: machineCell(id),
        cells: footprintCells(id, p.placed),
        hasIn: id !== 'IN',
      };
    }
    return { machineId: d.hoverMachine, targets, srcId: d.srcId };
  }

  /** Cells a new belt from portKey may not enter: every machine footprint, every obstacle, and every other connection's path. */
  function computeBlocked(portKey: string): Set<string> {
    const p = propsRef.current;
    const blocked = new Set<string>();
    for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, p.placed).forEach((c) => blocked.add(c));
    Object.keys(p.placed).forEach((k) => footprintCells(k, p.placed).forEach((c) => blocked.add(c)));
    (p.obstacles ?? []).forEach((c) => blocked.add(c));
    Object.keys(p.conns).forEach((k) => {
      if (k !== portKey) p.conns[k].path.forEach((c) => blocked.add(c));
    });
    return blocked;
  }

  function startDrag(
    portKey: string,
    pointerId: number,
    fixedPort = false,
    frozen: string[] | null = null,
    srcTile: string | null = null,
  ) {
    const p = propsRef.current;
    const [srcId, idxStr] = portKey.split(':');
    const idx = parseInt(idxStr, 10);
    const blocked = computeBlocked(portKey);
    // A drag may depart from any edge of the source footprint (a 2-tile
    // machine's own body never forces a detour); the held tile is kept on
    // the session and wins whenever its route costs no extra rails — see
    // findMachineExitPath.
    const originCells = footprintCells(srcId, p.placed);
    const ctx = dragBegin(p.conns, portKey, machineCell(srcId), p.level.railLimit, originCells);
    if (frozen) {
      // Trail continuation: the laid path is a frozen prefix, not a route to
      // recompute. Its own cells join the blocked set, so the extension
      // segment can never fold back over the trail it grows from (the tip
      // stays usable as the search origin only). Every other connection's
      // cells are already blocked by computeBlocked, as always.
      for (const c of frozen) blocked.add(c);
      ctx.path = [...frozen];
    }
    setDrag({ pointerId, srcId, idx, srcKey: portKey, ctx, blocked, hoverMachine: null, cell: null, over: false, fixedPort, frozen, srcTile });
    p.onDragRails(ctx.base + ctx.path.length);
  }

  /**
   * Rebind a still-empty drag session to another SPLIT port: the rail base
   * and the blocked set both depend on which connection key is being drawn,
   * so the drag context is rebuilt for the new port. Only ever called while
   * the path is empty (live port selection / preselection correction).
   */
  function switchDragPort(d: DragState, newIdx: 0 | 1 | 2): DragState {
    const p = propsRef.current;
    const srcKey = d.srcId + ':' + newIdx;
    const ctx = dragBegin(p.conns, srcKey, machineCell(d.srcId), p.level.railLimit, d.ctx.srcCells);
    return { ...d, idx: newIdx, srcKey, ctx, blocked: computeBlocked(srcKey) };
  }

  function dragMove(clientX: number, clientY: number, pointerId: number) {
    const d0 = dragRef.current;
    if (!d0 || pointerId !== d0.pointerId) return;
    const p = propsRef.current;
    const pt = evtPoint(clientX, clientY);
    if (!pt) return;
    const key = pickCell(pt.x, pt.y, angleRef.current);
    let d = d0;

    const srcNode = p.placed[d.srcId];
    if (srcNode && srcNode.type === 'split' && !d.fixedPort) {
      // While the preview is empty, the active port follows the pointer's
      // direction sector around the machine anchor live (the hold-time
      // preselection is only the start). The preview empties on its own
      // whenever the cursor comes back over the source machine, so walking
      // back in and out another end switches ports mid-drag — no second
      // hold, no lifting the pointer. Trail-continuation sessions keep
      // their origin port fixed and skip this entirely.
      const a = anchorOf(d.srcId, angleRef.current);
      const ang = (Math.atan2(pt.y - a.y, pt.x - a.x) * 180) / Math.PI;
      const dist = Math.hypot(pt.x - a.x, pt.y - a.y);
      const newIdx = splitLivePort3(
        d.ctx.path.length,
        [!!p.conns[d.srcId + ':0'], !!p.conns[d.srcId + ':1'], !!p.conns[d.srcId + ':2']],
        ang,
        dist,
        d.idx,
        splitPortAngles(angleRef.current),
      );
      if (newIdx !== d.idx) d = switchDragPort(d, newIdx);
    }

    // Auto-path: the belt follows the cursor freely (diagonals included) and
    // always takes the shortest legal route from the source footprint — to
    // the cursor cell, or to the doorstep of the machine under the cursor
    // when that machine is a valid target. No route, the source machine
    // itself, or an invalid cell under the cursor means an empty preview.
    const hoverMachine = machineAtPoint(pt);
    const budget = d.ctx.limit - d.ctx.base;
    let path: string[] = [];
    let over = false;
    if (d.frozen) {
      // Trail continuation: the laid path stays exactly as it was (the frozen
      // prefix) and only the segment from its tip to the cursor is routed.
      // No route, the cursor resting on the tip itself, or the cursor over a
      // blocked cell all leave the preview as the bare prefix — releasing
      // there then preserves the trail untouched (see finishDrag).
      path = d.frozen;
      const tip = d.frozen[d.frozen.length - 1];
      if (hoverMachine && hoverMachine !== d.srcId && hoverMachine !== 'IN') {
        const dstCells = footprintCells(hoverMachine, p.placed);
        const res = findTrailExtension({
          prefix: d.frozen,
          goalCells: beltGoalCells(dstCells, d.blocked),
          directCells: dstCells,
          blocked: d.blocked,
          budget,
        });
        path = res.path;
        over = res.overBudget;
      } else if (!hoverMachine && key && key !== tip && !d.blocked.has(key)) {
        const res = findTrailExtension({
          prefix: d.frozen,
          goalCells: [key],
          blocked: d.blocked,
          budget,
        });
        path = res.path;
        over = res.overBudget;
      }
    } else if (hoverMachine && hoverMachine !== d.srcId && hoverMachine !== 'IN') {
      const dstCells = footprintCells(hoverMachine, p.placed);
      const res = findMachineExitPath({
        srcCells: d.ctx.srcCells,
        heldTile: d.srcTile,
        goalCells: beltGoalCells(dstCells, d.blocked),
        directCells: dstCells,
        blocked: d.blocked,
        budget,
      });
      path = res.path ?? [];
      over = res.overBudget;
    } else if (!hoverMachine && key && !d.blocked.has(key)) {
      const res = findMachineExitPath({
        srcCells: d.ctx.srcCells,
        heldTile: d.srcTile,
        goalCells: [key],
        blocked: d.blocked,
        budget,
      });
      path = res.path ?? [];
      over = res.overBudget;
    }
    const pathChanged = path.join(' ') !== d.ctx.path.join(' ');
    d.ctx.path = path;

    if (pathChanged || over !== d.over || key !== d.cell || hoverMachine !== d.hoverMachine || d !== d0) {
      const next: DragState = { ...d, cell: key, hoverMachine, over };
      dragRef.current = next;
      setDrag(next);
      p.onDragRails(next.ctx.base + next.ctx.path.length);
    }
  }

  function finishDrag() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    const p = propsRef.current;
    p.onDragRails(null);
    // Trail continuation released back on its own tip with the path
    // unchanged: a true no-op — the trail stays byte-for-byte as it was.
    if (
      d.frozen &&
      d.cell === d.frozen[d.frozen.length - 1] &&
      d.ctx.path.join(' ') === d.frozen.join(' ')
    ) {
      return;
    }
    // An over-budget preview is shown red and never commits.
    const target = d.over ? null : dragFinish(d.ctx, dragHoverFor(d));
    if (target) {
      p.onConnsChange({ ...p.conns, [d.srcKey]: { to: target, path: [...d.ctx.path] } }, 'connect');
      return;
    }
    // Released on an empty cell with a valid in-budget preview: the trail
    // stays laid as an open-ended belt (to = null). Anything else cancels —
    // and since the drag never wrote to conns, a cancelled redraw or trail
    // continuation leaves the previous connection exactly as it was.
    if (!d.over && dragOpenEnd(d.ctx, d.cell, d.hoverMachine, d.blocked)) {
      p.onConnsChange({ ...p.conns, [d.srcKey]: { to: null, path: [...d.ctx.path] } }, 'connect');
    }
  }

  function cancelHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldId(null);
    setHoldIdx(null);
    setHoldCell(null);
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (propsRef.current.running || dragRef.current) return;
    const pt = evtPoint(e.clientX, e.clientY);
    if (!pt) return;
    lastPointerRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    const p = propsRef.current;
    const cell = pickCell(pt.x, pt.y, angleRef.current);
    const mach = machineAtPoint(pt);
    const info: DownInfo = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      conn: null,
      mach,
      cell,
      trailKey: null,
    };
    if (!mach && cell) {
      info.conn = connAtCell(cell);
      // Pressing the END cell of an open-ended trail arms a hold that
      // continues that trail from its original source port. Pressing any
      // other belt cell keeps the plain click-to-delete behavior.
      if (info.conn) {
        const c = p.conns[info.conn];
        if (c && c.to === null && c.path.length && c.path[c.path.length - 1] === cell) {
          info.trailKey = info.conn;
        }
      }
    }
    downRef.current = info;

    // A press on truly empty floor (no machine, no belt, no trail tip)
    // arms a camera drag: sliding sideways orbits the board. A press that
    // barely moves stays a click — the release handler's movement gate
    // already ignores drags, so the two never fight.
    if (!mach && !info.conn && !info.trailKey) {
      camRef.current = { pointerId: e.pointerId, startX: e.clientX, startAngle: p.angle, active: false };
    }

    if (info.trailKey) {
      const trailKey = info.trailKey;
      const pointerId = e.pointerId;
      setHoldCell(cell);
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        setHoldCell(null);
        downRef.current = null;
        if (propsRef.current.running || dragRef.current) return;
        const conn = propsRef.current.conns[trailKey];
        if (!conn || conn.to !== null || !conn.path.length) return;
        startDrag(trailKey, pointerId, true, [...conn.path]);
        const last = lastPointerRef.current;
        if (last) dragMove(last.x, last.y, pointerId);
      }, HOLD_MS);
      e.preventDefault();
      return;
    }

    // Hold-to-draw: pressing a machine body starts a hold; once it completes,
    // belt drawing begins from that machine. A short press stays a click.
    const isSource = mach !== null && (mach === 'IN' || !!p.placed[mach]);
    if (mach && isSource) {
      const n = p.placed[mach];
      let idx = 0;
      if (n && n.type === 'split') {
        // The port is preselected by the press direction sector (a free
        // port wins unless the press lands deep in a taken port's sector —
        // see pickSplitPort3); the port markers show the choice for as long
        // as the hold/drag lasts.
        const a = anchorOf(mach, angleRef.current);
        idx = pickSplitPort3(
          [!!p.conns[mach + ':0'], !!p.conns[mach + ':1'], !!p.conns[mach + ':2']],
          (Math.atan2(pt.y - a.y, pt.x - a.x) * 180) / Math.PI,
          Math.hypot(pt.x - a.x, pt.y - a.y),
          -1,
          splitPortAngles(angleRef.current),
        );
        setHoldIdx(idx);
      }
      const srcKey = mach + ':' + idx;
      const pointerId = e.pointerId;
      // The tile this press belongs to: a belt out of a 2-tile machine
      // departs from the held tile's edge, not always the anchor's.
      const heldTile = heldTileOf(footprintCells(mach, p.placed), pt, angleRef.current);
      setHoldId(mach);
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        setHoldId(null);
        setHoldIdx(null);
        downRef.current = null;
        if (propsRef.current.running || dragRef.current) return;
        startDrag(srcKey, pointerId, false, null, heldTile);
        const last = lastPointerRef.current;
        if (last) dragMove(last.x, last.y, pointerId);
      }, HOLD_MS);
    }
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      const cam = camRef.current;
      if (cam && e.pointerId === cam.pointerId && !dragRef.current) {
        const dx = e.clientX - cam.startX;
        if (Math.abs(dx) > 4) cam.active = true;
        if (cam.active) {
          const next = (((cam.startAngle + dx * 0.45) % 360) + 360) % 360;
          propsRef.current.onAngleChange(next);
          return;
        }
      }
      if (dragRef.current) {
        dragMove(e.clientX, e.clientY, e.pointerId);
        return;
      }
      if (propsRef.current.running) return;
      const key = evtCell(e.clientX, e.clientY);
      setHoverCell((prev) => (prev === key ? prev : key));
    }
    function onUp(e: PointerEvent) {
      if (camRef.current && e.pointerId === camRef.current.pointerId) camRef.current = null;
      if (dragRef.current) {
        finishDrag();
        return;
      }
      cancelHold();
      const info = downRef.current;
      downRef.current = null;
      if (!info || propsRef.current.running) return;
      const moved = Math.hypot(e.clientX - info.x, e.clientY - info.y);
      if (moved > 6 || performance.now() - info.t > 700) return;
      const p = propsRef.current;
      if (info.conn) {
        const next = { ...p.conns };
        delete next[info.conn];
        p.onConnsChange(next, 'delete');
        return;
      }
      if (info.mach) {
        if (p.placed[info.mach] && !(p.lockedIds ?? []).includes(info.mach)) p.onUnplace(info.mach);
        return;
      }
      if (info.cell) {
        if (!p.ghost) {
          p.onPlaceRejected(info.cell);
          flashCell(info.cell);
        } else if (cellPlaceable(info.cell, p.ghost.type, p.placed, p.conns, new Set(p.obstacles ?? []))) {
          p.onPlace(info.cell);
        } else {
          flashCell(info.cell);
        }
      }
    }
    function onCancel() {
      camRef.current = null;
      cancelHold();
      if (dragRef.current) {
        dragRef.current = null;
        setDrag(null);
        propsRef.current.onDragRails(null);
      }
      downRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- drag preview target (recomputed per render while dragging) ----
  const dragTarget = drag && !drag.over ? dragFinish(drag.ctx, dragHoverFor(drag)) : null;

  const floorCells: { c: number; r: number }[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) floorCells.push({ c, r });

  const machineEntries: { d: number; id: string }[] = allIds.map((id) => ({
    d: machineDepth(id, placedDefs, angle),
    id,
  }));
  machineEntries.sort((a, b) => a.d - b.d);

  const ghostPlaceable =
    ghost && hoverCell ? cellPlaceable(hoverCell, ghost.type, placedDefs, conns, obstacleSet) : false;

  return (
    <svg id="board" viewBox="0 0 960 560" ref={props.svgRef} onPointerDown={handlePointerDown}>
      <defs>
        <clipPath id="tokClip">
          <rect x={-20} y={-38} width={40} height={40} />
        </clipPath>
      </defs>

      <rect x={0} y={0} width={960} height={560} fill="#191C21" />

      {/* World painting (floor + pixel belt tiles) is drawn for the classic
          view and carried into the camera's view by one affine warp, so the
          pixel 2.5D tileset survives any azimuth. Billboards (machines,
          tokens, labels) render outside this group, unwarped. */}
      <g transform={boardWarpTransform(angle)}>
        {floorCells.map(({ c, r }) => {
          const ctr = isoCenter(c, r);
          return (
            <g key={c + ',' + r}>
              <polygon
                points={diamondPoints(ctr, 0.6)}
                className="floor-cell"
                fill={(c + r) % 2 === 0 ? '#262A31' : '#2B2F36'}
              />
              <circle cx={ctr.x} cy={ctr.y} r={1.7} className="floor-dot" />
            </g>
          );
        })}

        {(props.obstacles ?? []).map((k) => {
          const c = cellCenter(k);
          return (
            <g key={'obs-' + k} className="obstacle-cell">
              <polygon points={diamondPoints(c, 0.6)} />
              <line x1={c.x - 13} y1={c.y - 6.5} x2={c.x + 13} y2={c.y + 6.5} />
              <line x1={c.x - 13} y1={c.y + 6.5} x2={c.x + 13} y2={c.y - 6.5} />
            </g>
          );
        })}

        {ghost && hoverCell && (
          <g>
            {footprintCellsAtSafe(hoverCell, ghost.type).map((c) => (
              <polygon
                key={c}
                points={diamondPoints(cellCenter(c), 1.5)}
                className={'cell-outline' + (ghostPlaceable ? '' : ' bad')}
              />
            ))}
          </g>
        )}

        {Object.keys(conns).map((key) => (
          <g key={key} className="belt-conn" data-conn={key}>
            {beltTilesFor(key, conns[key], placedDefs).map(({ cell, tile }) => {
              if (!tile) return null;
              const c = cellCenter(cell);
              return (
                <g key={cell}>
                  <image
                    x={c.x - BELT_TILE_CX}
                    y={c.y - BELT_TILE_CY}
                    width={BELT_TILE_W}
                    height={BELT_TILE_H}
                    href={BELT_IMG.steel[tile]}
                    data-tile={tile}
                  />
                  <polygon points={diamondPoints(c, 2)} className="belt-hit" data-conn={key} />
                </g>
              );
            })}
          </g>
        ))}

        {drag && (
          <g className={'belt-preview' + (drag.over ? ' over' : '')}>
            {drag.ctx.path.map((cell, i) => {
              const srcCells = footprintCells(drag.srcId, placedDefs);
              const prev = i === 0 ? edgeRefCell(srcCells, cell, machineCell(drag.srcId)) : drag.ctx.path[i - 1];
              let tile: string | null;
              if (i === drag.ctx.path.length - 1 && !dragTarget) {
                tile = beltEndKey(dirBetween(cell, prev));
              } else {
                const next =
                  i === drag.ctx.path.length - 1
                    ? edgeRefCell(footprintCells(dragTarget!, placedDefs), cell, machineCell(dragTarget!))
                    : drag.ctx.path[i + 1];
                tile = beltTileKey(dirBetween(cell, prev), dirBetween(cell, next));
              }
              if (!tile) return null;
              const c = cellCenter(cell);
              return (
                <image
                  key={cell}
                  x={c.x - BELT_TILE_CX}
                  y={c.y - BELT_TILE_CY}
                  width={BELT_TILE_W}
                  height={BELT_TILE_H}
                  href={BELT_IMG.steel[tile]}
                />
              );
            })}
            {dragTarget && (
              <polygon
                points={diamondPoints(cellCenter(machineCell(dragTarget)), 1)}
                className="cell-outline ok"
              />
            )}
          </g>
        )}

        {flashCellKey && (
          <polygon
            points={diamondPoints(cellCenter(flashCellKey), 1)}
            fill="none"
            stroke="#FF6B5E"
            strokeWidth={3}
            opacity={0.9}
            className="flash-rect"
          />
        )}
      </g>

      <text x={480} y={545} className="trash-label">
        — filtered-out tokens are discarded here —
      </text>

      {machineEntries.map(({ id }) => (
        <MachineSprite key={id} id={id} placed={placed} flash={flashNodeId === id} angle={angle} />
      ))}
      {holdId &&
        (() => {
          const c = fpCenterOf(holdId, placedDefs, angle);
          return (
            <circle
              cx={c.x}
              cy={c.y - 34}
              r={17}
              className="hold-ring"
              pathLength={100}
              strokeDasharray={100}
            />
          );
        })()}
      {holdCell &&
        (() => {
          const c = cellCenter(holdCell, angle);
          return (
            <circle
              cx={c.x}
              cy={c.y - 26}
              r={15}
              className="hold-ring"
              pathLength={100}
              strokeDasharray={100}
            />
          );
        })()}
      {props.stuckCell && (
        <g className="stuck-cell">
          <polygon points={diamondPoints(cellCenter(props.stuckCell, angle), 1, angle)} />
        </g>
      )}
      {(() => {
        // SPLIT port markers: shown while a hold on a SPLIT is arming and for
        // the whole drag from it. The port that will be drawn glows orange,
        // the other stays dim, so the choice is never invisible again.
        let splitId: string | null = null;
        let activeIdx: number | null = null;
        if (drag && placedDefs[drag.srcId]?.type === 'split') {
          splitId = drag.srcId;
          activeIdx = drag.idx;
        } else if (holdId && holdIdx !== null && placedDefs[holdId]?.type === 'split') {
          splitId = holdId;
          activeIdx = holdIdx;
        }
        if (!splitId || activeIdx === null) return null;
        const PORT_LABELS = ['UP', 'DOWN', 'SIDE'];
        return (
          <g className="port-markers">
            {[0, 1, 2].map((idx) => {
              const pp = portPos(splitId, idx, placedDefs, angle);
              return (
                <g key={idx} className={'port-marker' + (idx === activeIdx ? ' active' : ' dim')}>
                  <polygon points={diamondAt(pp.x, pp.y, 13, 7)} />
                  <text x={pp.x} y={idx === 0 ? pp.y - 14 : pp.y + 22}>
                    {PORT_LABELS[idx]}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
      {ghost && hoverCell && ghostPlaceable && (
        <GhostSprite cell={hoverCell} type={ghost.type} angle={angle} />
      )}

      <g ref={props.tokenLayerRef} />

      {allIds.map((id) => (
        <MachineLabel key={'lb-' + id} id={id} placed={placed} bufLabels={bufLabels} locked={lockedSet.has(id)} angle={angle} />
      ))}

      {Object.keys(placed)
        .filter((id) => placed[id].type === 'split')
        .map((id) => (
          <SplitExitDots key={'dots-' + id} id={id} def={placedDefs[id]} placed={placedDefs} angle={angle} />
        ))}
      {Object.keys(placed)
        .filter((id) => placed[id].type === 'split' && !lockedSet.has(id))
        .map((id) => (
          <SplitRouteChip key={'chip-' + id} id={id} placed={placedDefs} onEdit={props.onEditRoute} angle={angle} />
        ))}
    </svg>
  );
}

function footprintCellsAtSafe(anchorKey: string, type: NodeDef['type']): string[] {
  const a = parseCell(anchorKey);
  const fp = footprintOfType(type);
  const cells: string[] = [];
  for (let dc = 0; dc < fp.w; dc++) {
    for (let dr = 0; dr < fp.d; dr++) {
      const c = a.c + dc;
      const r = a.r + dr;
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) cells.push(c + ',' + r);
    }
  }
  return cells;
}

function GhostSprite({ cell, type, angle }: { cell: string; type: NodeDef['type']; angle: number }) {
  const a = parseCell(cell);
  const fp = footprintOfType(type);
  const c = isoCenter(a.c + (fp.w - 1) / 2, a.r + (fp.d - 1) / 2, angle);
  const S = 112 * (fp.w === 2 ? 1.25 : 1);
  return (
    <image x={c.x - S / 2} y={c.y + 12 - S} width={S} height={S} opacity={0.45} href={NODE_IMG[type]} />
  );
}

function MachineSprite({
  id,
  placed,
  flash,
  angle,
}: {
  id: string;
  placed: Record<string, PlacedNode>;
  flash: boolean;
  angle: number;
}) {
  const n = placed[id] ?? null;
  const isFixedId = id === 'IN' || id === 'OUT' || id === 'A' || id === 'B';
  const sprite = id === 'IN' ? INPUT_IMG : isFixedId ? OUTPUT_IMG : NODE_IMG[n!.type];
  const ctr = fpCenterOf(id, placed, angle);
  const fp = footprintOf(id, placed);
  const S = 112 * (fp.w === 2 ? 1.25 : 1);
  return (
    <g data-depth={machineDepth(id, placed, angle)} {...(!isFixedId ? { 'data-mach': id } : {})}>
      <g className={'node-inner' + (flash ? ' errflash' : '')}>
        <polygon points={footprintQuad(id, placed, angle)} className="node-shadow" />
        <image x={ctr.x - S / 2} y={ctr.y + 12 - S} width={S} height={S} href={sprite} />
      </g>
    </g>
  );
}

function MachineLabel({
  id,
  placed,
  bufLabels,
  locked,
  angle,
}: {
  id: string;
  placed: Record<string, PlacedNode>;
  bufLabels: Record<string, string>;
  locked?: boolean;
  angle: number;
}) {
  const a = fpCenterOf(id, placed, angle);
  const n = placed[id] ?? null;
  let title: string;
  let sub: string;
  if (id === 'IN') {
    title = 'INPUT';
    sub = 'incoming flow';
  } else if (id === 'OUT' || id === 'A' || id === 'B') {
    title = 'OUTPUT' + (id === 'OUT' ? '' : ' ' + id);
    sub = 'target';
  } else {
    const lb = nodeLabel(n!);
    title = lb.title;
    sub = lb.sub;
  }
  return (
    <g>
      {(id === 'A' || id === 'B') && (
        <g>
          <rect x={a.x + 27} y={a.y - 97} width={20} height={20} className="io-plate" />
          <text x={a.x + 37} y={a.y - 82.5} className="io-plate-txt">
            {id}
          </text>
        </g>
      )}
      <text x={a.x} y={a.y + 25} className="node-title">
        {title}
      </text>
      <text x={a.x} y={a.y + 37} className="node-sub">
        {sub}
      </text>
      {n && (n.type === 'tahan' || n.type === 'sort' || n.type === 'merge') && (
        <text x={a.x + 36} y={a.y - 78} className="buf-label">
          {bufLabels[id] ?? ''}
        </text>
      )}
      {locked && (
        <g className="lock-badge" transform={`translate(${a.x + 34} ${a.y - 96})`}>
          <rect x={-6} y={-1} width={12} height={9} rx={1.6} />
          <path d="M -3.6 -1 v -2.4 a 3.6 3.6 0 0 1 7.2 0 V -1" fill="none" strokeWidth={1.8} />
        </g>
      )}
    </g>
  );
}

/**
 * Small colored dots just past each SPLIT end, showing which token colors
 * currently leave by that port under the machine's effective routing — the
 * split's map at a glance, updated the moment the routing changes.
 */
function SplitExitDots({
  id,
  def,
  placed,
  angle,
}: {
  id: string;
  def: NodeDef;
  placed: Record<string, NodeDef>;
  angle: number;
}) {
  const routing = splitRoutingOf(def);
  const dirs = splitPortDirs(angle);
  const byPort: Record<number, ColorCode[]> = { 0: [], 1: [], 2: [] };
  (['R', 'B', 'G'] as ColorCode[]).forEach((c) => {
    byPort[routing.byColor[c] ?? routing.other].push(c);
  });
  return (
    <g className="route-dots">
      {([0, 1, 2] as const).map((idx) => {
        const colors = byPort[idx];
        if (!colors.length) return null;
        const pp = portPos(id, idx, placed, angle);
        const d = dirs[idx];
        return colors.map((c, i) => {
          const off = (i - (colors.length - 1) / 2) * 10.5;
          return (
            <circle
              key={idx + '-' + c}
              cx={pp.x + d.x * 16 - d.y * off}
              cy={pp.y + d.y * 16 + d.x * off}
              r={4.3}
              fill={COLOR_HEX[c]}
              className="route-dot"
            />
          );
        });
      })}
    </g>
  );
}

/**
 * The "Route" chip on a placed SPLIT: its own click target (the press never
 * reaches the board, so the machine body's per-pixel hold is untouched).
 * Locked (expert) splits never get one — their routing is part of the puzzle.
 */
function SplitRouteChip({
  id,
  placed,
  onEdit,
  angle,
}: {
  id: string;
  placed: Record<string, NodeDef>;
  onEdit: (id: string) => void;
  angle: number;
}) {
  const a = fpCenterOf(id, placed, angle);
  return (
    <g
      className="route-chip"
      transform={`translate(${a.x - 66} ${a.y - 97})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(id);
      }}
    >
      <rect width={56} height={18} rx={4} />
      <path d="M6 9 H12 M12 9 L18 4.5 M12 9 H19 M12 9 L18 13.5" />
      <text x={37} y={12.5}>
        Route
      </text>
    </g>
  );
}
