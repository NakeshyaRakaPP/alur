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
  findSplitExitPath,
  findTrailExtension,
  footprintCells,
  footprintCellsAt,
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
  rerouteMovedConns,
  spliceConns,
  splitLivePort3,
  splitPortAngles,
  splitPortDirs,
} from '../geometry';
import type { DragCtx, DragHover, Point } from '../geometry';
import { BELT_IMG, COLOR_HEX, FLOOR_TEX_IMG, inputImg, nodeImg, nodeLabel, outputImg, splitRoutingOf, tokenImg } from '../nodeMeta';
import { ensureMasks, masksReady, spriteOpaque } from '../sprites';
import { ASM_GRID, ASM_MS, blockAnim, easeOutCubic, peekBlocks, sampleSprite } from '../assembly';
import type { SpriteBlock } from '../assembly';
import type { SpriteKind } from '../sprites';
import type { ColorCode, Conns, Level, NodeDef, PlacedNode, PortIdx } from '../types';

export interface BoardProps {
  level: Level;
  placed: Record<string, PlacedNode>;
  conns: Conns;
  /** The rack machine currently selected for placement (drives the ghost preview), or null. */
  ghost: NodeDef | null;
  running: boolean;
  bufLabels: Record<string, string>;
  bufFill: Record<string, { held: number; cap: number }>;
  activeMachines: ReadonlySet<string>;
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
  /** Self-assembly trigger: the machine at `id` builds itself pixel by
   *  pixel; fromCell set = its blocks stream in from that old anchor. */
  assembly: { id: string; fromCell: string | null; nonce: number } | null;
  /** Visual tutorial (Level 1): a pulsing marker + hand on this cell. */
  coachCell?: string | null;
  /** Visual tutorial: an animated hand travelling between two nodes. */
  coachPath?: { from: string; to: string } | null;
  /** Reports camera rotations from floor drags; the owner keeps the angle so the token layer shares it. */
  onAngleChange: (deg: number) => void;
  onPlace: (cell: string, splice: Conns | null) => void;
  onPlaceRejected: (cell: string) => void;
  onUnplace: (id: string) => void;
  /** Commits a machine move (machine menu → Move): new anchor + rebuilt conns. */
  onMoveNode: (id: string, newAnchor: string, next: Conns) => void;
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
  /**
   * Hands-free follow mode: the belt follows the cursor on its own and
   * the NEXT click plants it (Esc / right-click cancels). Only drags
   * born from the machine menu's Belt action start in follow mode; a
   * drag drawn directly from a machine plants when the press is
   * released.
   */
  follow: boolean;
}

interface DownInfo {
  x: number;
  y: number;
  t: number;
  conn: string | null;
  mach: string | null;
  cell: string | null;
  /** Connection key when the press landed on the end cell of an open-ended trail (a drag from here continues that trail). */
  trailKey: string | null;
}

type MenuAction = 'delete' | 'move' | 'rail';

/**
 * The action menu on a placed machine: a plain CLICK on the machine (a
 * press that never turned into a belt drag) opens it — three actions fan
 * out around the machine (Delete above, Move top-right, Belt right) and
 * each fires on its own click. Delete removes at once, Move lifts the
 * machine into hands-free follow mode, Belt starts a follow-mode belt
 * drag. Pressing anywhere else closes the menu. This menu is the only
 * way to remove or move a placed machine.
 */
interface MenuState {
  id: string;
  pointerId: number;
  active: MenuAction | null;
  heldTile: string | null;
}

/** What the press that started the current drag landed on, kept so the release can tell a belt drag from a plain click on a machine. */
interface PressInfo {
  mach: string;
  menuEligible: boolean;
  heldTile: string | null;
  x: number;
  y: number;
}

/**
 * A machine being carried to a new anchor (machine menu → Move). It follows
 * the cursor hands-free once picked from the menu; the next click drops
 * it (Esc / right-click cancels). Nothing is committed until the drop.
 */
interface MoveState {
  id: string;
  pointerId: number;
  anchor: string | null;
  valid: boolean;
  follow: boolean;
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



export default function Board(props: BoardProps) {
  const { level, placed, conns, ghost, bufLabels, bufFill, activeMachines, flashNodeId } = props;
  const angle = props.angle;
  // Self-assembly animation state: driven by the owner's assembly
  // trigger; a rAF loop ticks `now` until the build completes.
  const [asmTick, setAsmTick] = useState<{ id: string; fromCell: string | null; start: number; now: number } | null>(null);
  const asmNonceRef = useRef(0);
  useEffect(() => {
    const req = props.assembly;
    if (!req || req.nonce === asmNonceRef.current) return;
    asmNonceRef.current = req.nonce;
    const t = props.placed[req.id]?.type;
    if (!t) return;
    if (!peekBlocks(props.level.chapter, t)) {
      void sampleSprite(props.level.chapter, t);
      return;
    }
    const start = performance.now();
    setAsmTick({ id: req.id, fromCell: req.fromCell, start, now: start });
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      if (now - start >= ASM_MS + 60) {
        setAsmTick(null);
        return;
      }
      setAsmTick({ id: req.id, fromCell: req.fromCell, start, now });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.assembly]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [flashCellKey, setFlashCellKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [moveSt, setMoveSt] = useState<MoveState | null>(null);
  const [, setMaskVersion] = useState(0);

  const propsRef = useRef(props);
  propsRef.current = props;
  const angleRef = useRef(angle);
  angleRef.current = angle;
  const camRef = useRef<{ pointerId: number; startX: number; startAngle: number; active: boolean } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const downRef = useRef<DownInfo | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const moveRef = useRef<MoveState | null>(null);
  const pressRef = useRef<PressInfo | null>(null);
  /** Whether the current press began inside the board SVG (a rack drag is the one legitimate press that begins outside it). */
  const boardPressRef = useRef(true);
  const flashTimerRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  // While a machine is being carried (machine menu → Move), it renders at the
  // hovered anchor and its own belts hide — they are re-routed on drop.
  const displayPlaced: Record<string, PlacedNode> = (() => {
    if (!moveSt) return placed;
    const dp: Record<string, PlacedNode> = { ...placed };
    const n = dp[moveSt.id];
    delete dp[moveSt.id];
    if (n && moveSt.anchor) dp[moveSt.anchor] = n;
    return dp;
  })();
  const placedDefs = displayPlaced as Record<string, NodeDef>;
  const allIds = ['IN', ...level.outputs, ...Object.keys(displayPlaced)];
  const obstacleSet = new Set(props.obstacles ?? []);
  const lockedSet = new Set(props.lockedIds ?? []);

  useEffect(() => {
    let alive = true;
    ensureMasks(props.level.chapter).then(() => {
      if (alive) setMaskVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [props.level.chapter]);

  function flashCell(cell: string) {
    setFlashCellKey(cell);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashCellKey(null), 420);
  }

  /** Place the machine in hand at `cell`: a free cell takes it directly; a belt cell splices it into the line; anything else flashes the cell. */
  function placeGhostAt(cell: string) {
    const p = propsRef.current;
    if (!p.ghost) return;
    if (cellPlaceable(cell, p.ghost.type, p.placed, p.conns, new Set(p.obstacles ?? []))) {
      p.onPlace(cell, null);
    } else {
      const spliced = spliceConns(p.conns, cell, p.ghost.type, p.placed, new Set(p.obstacles ?? []));
      if (spliced) p.onPlace(cell, spliced);
      else flashCell(cell);
    }
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
    if (!masksReady(p.level.chapter)) {
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
      if (u >= 0 && u < 1 && v >= 0 && v < 1 && spriteOpaque(p.level.chapter, spriteKindOf(id), u, v)) return id;
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
    follow = false,
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
    setDrag({ pointerId, srcId, idx, srcKey: portKey, ctx, blocked, hoverMachine: null, cell: null, over: false, fixedPort, frozen, srcTile, follow });
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
    // In follow mode the press is over: any pointer movement (and the
    // committing click, whatever its id) drives the preview.
    if (!d0 || (!d0.follow && pointerId !== d0.pointerId)) return;
    const p = propsRef.current;
    const pt = evtPoint(clientX, clientY);
    if (!pt) return;
    const key = pickCell(pt.x, pt.y, angleRef.current);
    let d = d0;

    const srcNode = p.placed[d.srcId];
    if (srcNode && srcNode.type === 'split' && !d.fixedPort) {
      // While the preview is empty, the active port follows the pointer's
      // direction sector around the machine anchor live (the press-time
      // preselection is only the start). The preview empties on its own
      // whenever the cursor comes back over the source machine, so walking
      // back in and out another end switches ports mid-drag — no second
      // press, no lifting the pointer. Trail-continuation sessions keep
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
      // A SPLIT belt leaves by its port's own side, always: the first cell
      // is the port's exit cell, so the port is readable from the belt.
      const res =
        srcNode && srcNode.type === 'split'
          ? findSplitExitPath({
              anchor: d.ctx.srcCells[0],
              port: d.idx as PortIdx,
              goalCells: beltGoalCells(dstCells, d.blocked),
              directCells: dstCells,
              blocked: d.blocked,
              budget,
            })
          : findMachineExitPath({
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
      const res =
        srcNode && srcNode.type === 'split'
          ? findSplitExitPath({
              anchor: d.ctx.srcCells[0],
              port: d.idx as PortIdx,
              goalCells: [key],
              blocked: d.blocked,
              budget,
            })
          : findMachineExitPath({
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

  // ---- Machine menu (Delete / Move / Belt) + machine carrying ----

  /** Screen centre of a machine's sprite + its pixel size (billboards sit above their footprint). */
  function spriteCenterOf(id: string): { x: number; y: number; s: number } {
    const p = propsRef.current;
    const c = fpCenterOf(id, p.placed, angleRef.current);
    const fp = footprintOf(id, p.placed);
    const s = 112 * (fp.w === 2 ? 1.25 : 1);
    return { x: c.x, y: c.y + 12 - s / 2, s };
  }

  /** The three menu options hugging the machine: Delete above, Move top-right, Rail exactly right. */
  function menuOptions(id: string): { key: MenuAction; x: number; y: number; label: string }[] {
    const { x, y, s } = spriteCenterOf(id);
    const top = y - s / 2;
    return [
      { key: 'delete', x, y: top - 14, label: 'Delete' },
      { key: 'move', x: x + s / 2 + 8, y: top - 8, label: 'Move' },
      { key: 'rail', x: x + s / 2 + 20, y, label: 'Belt' },
    ];
  }

  function menuActiveFor(id: string, pt: Point): MenuAction | null {
    let best: MenuAction | null = null;
    // Click hit test: the chip's own disc (r=21) plus a whisper of slack.
    // The wide radius from the slide-to-arm era would eat presses aimed
    // at the machine itself now that actions fire on a press.
    let bestDist = 23;
    for (const o of menuOptions(id)) {
      const d = Math.hypot(pt.x - o.x, pt.y - o.y);
      if (d < bestDist) {
        bestDist = d;
        best = o.key;
      }
    }
    return best;
  }

  function closeMenu() {
    menuRef.current = null;
    setMenu(null);
    const svg = propsRef.current.svgRef.current;
    if (svg) svg.style.cursor = '';
  }

  /** Run one action of the open click menu. Move and Belt start their follow-mode sessions from the menu press point, exactly where the player aimed. */
  function fireMenuAction(m: MenuState, act: MenuAction, clientX: number, clientY: number, pointerId: number) {
    const p = propsRef.current;
    closeMenu();
    if (act === 'delete') {
      p.onUnplace(m.id);
      return;
    }
    if (act === 'move') {
      const mv: MoveState = { id: m.id, pointerId, anchor: null, valid: false, follow: true };
      moveRef.current = mv;
      setMoveSt(mv);
      moveMove(clientX, clientY);
      return;
    }
    // Belt: the drag starts in follow mode — it tracks the cursor
    // hands-free and the next click plants it. For a SPLIT the port is
    // preselected from the press direction; the live sector switching in
    // dragMove keeps following the cursor from here.
    const pt = evtPoint(clientX, clientY);
    const n = p.placed[m.id];
    let idx = 0;
    if (n && n.type === 'split' && pt) {
      const a = anchorOf(m.id, angleRef.current);
      idx = pickSplitPort3(
        [!!p.conns[m.id + ':0'], !!p.conns[m.id + ':1'], !!p.conns[m.id + ':2']],
        (Math.atan2(pt.y - a.y, pt.x - a.x) * 180) / Math.PI,
        Math.hypot(pt.x - a.x, pt.y - a.y),
        -1,
        splitPortAngles(angleRef.current),
      );
    }
    startDrag(m.id + ':' + idx, pointerId, false, null, m.heldTile, true);
    dragMove(clientX, clientY, pointerId);
  }

  /** Can the machine be dropped at `anchor`? Free cells, or a footprint a foreign belt can be spliced through. Its own belts never block: they are re-routed after the drop. */
  function moveValidity(id: string, anchor: string | null): boolean {
    if (!anchor) return false;
    const p = propsRef.current;
    const node = p.placed[id];
    if (!node) return false;
    const placedWithout: Record<string, NodeDef> = { ...p.placed };
    delete placedWithout[id];
    const cells = footprintCellsAt(anchor, node.type);
    const obstacles = new Set(p.obstacles ?? []);
    for (const c of cells) {
      const pc = parseCell(c);
      if (pc.c < 0 || pc.c >= COLS || pc.r < 0 || pc.r >= ROWS) return false;
      if (obstacles.has(c)) return false;
      if (machineAtCell(c, placedWithout)) return false;
      for (const fid of ['IN', 'OUT', 'A', 'B']) {
        if (footprintCells(fid, placedWithout).includes(c)) return false;
      }
    }
    const foreign: Conns = {};
    let foreignTouch = false;
    for (const [k, v] of Object.entries(p.conns)) {
      if (k.split(':')[0] === id || v.to === id) continue;
      foreign[k] = v;
      if (v.path.some((c) => cells.includes(c))) foreignTouch = true;
    }
    if (!foreignTouch) return true;
    return spliceConns(foreign, anchor, node.type, placedWithout, obstacles) !== null;
  }

  function moveMove(clientX: number, clientY: number) {
    const mv = moveRef.current;
    if (!mv) return;
    const pt = evtPoint(clientX, clientY);
    if (!pt) return;
    const cell = pickCell(pt.x, pt.y, angleRef.current);
    if (cell === mv.anchor) return;
    const nm: MoveState = { ...mv, anchor: cell, valid: moveValidity(mv.id, cell) };
    moveRef.current = nm;
    setMoveSt(nm);
  }

  /** Drop the carried machine at the click point (follow-mode Move commit). An invalid or unchanged anchor just puts it back. */
  function commitFollowMove(clientX: number, clientY: number) {
    moveMove(clientX, clientY);
    const mv = moveRef.current;
    moveRef.current = null;
    setMoveSt(null);
    if (!mv || !mv.anchor || !mv.valid || mv.anchor === mv.id) return;
    const p = propsRef.current;
    const node = p.placed[mv.id];
    if (!node) return;
    const placedWithout: Record<string, NodeDef> = { ...p.placed };
    delete placedWithout[mv.id];
    const next = rerouteMovedConns(
      p.conns,
      placedWithout,
      mv.id,
      mv.anchor,
      node,
      p.level.railLimit,
      new Set(p.obstacles ?? []),
    );
    p.onMoveNode(mv.id, mv.anchor, next);
  }

  /** Abandon any follow-mode session (Esc / right-click): nothing was ever written, so the board is untouched. */
  function cancelFollow() {
    if (dragRef.current) {
      dragRef.current = null;
      setDrag(null);
      propsRef.current.onDragRails(null);
    }
    if (moveRef.current) {
      moveRef.current = null;
      setMoveSt(null);
    }
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (propsRef.current.running) return;
    // Follow mode: a belt or a carried machine is waiting, hands-free.
    // This click IS the action — it plants the belt / drops the machine at
    // the click point. A right-click cancels the session instead.
    if (dragRef.current?.follow || moveRef.current?.follow) {
      e.preventDefault();
      downRef.current = null;
      if (e.button === 2) {
        cancelFollow();
        return;
      }
      if (dragRef.current?.follow) {
        dragMove(e.clientX, e.clientY, e.pointerId);
        finishDrag();
      } else {
        commitFollowMove(e.clientX, e.clientY);
      }
      return;
    }
    if (dragRef.current) return;
    // The click menu is open: a press on one of its actions fires it; a
    // press anywhere else closes the menu and is then handled as a
    // fresh press in its own right.
    if (menuRef.current) {
      const m = menuRef.current;
      const pt0 = evtPoint(e.clientX, e.clientY);
      const act = pt0 ? menuActiveFor(m.id, pt0) : null;
      if (act) {
        fireMenuAction(m, act, e.clientX, e.clientY, e.pointerId);
        e.preventDefault();
        return;
      }
      closeMenu();
    }
    pressRef.current = null;
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
      // Pressing the END cell of an open-ended trail starts a drag that
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
      // The drag starts with the press itself — the trail's laid path is
      // the session's frozen prefix and only its tip may grow.
      const conn = p.conns[info.trailKey];
      if (conn && conn.to === null && conn.path.length) {
        startDrag(info.trailKey, e.pointerId, true, [...conn.path]);
        dragMove(e.clientX, e.clientY, e.pointerId);
      }
      e.preventDefault();
      return;
    }

    // A press on a machine body starts its belt drag at once — there is
    // no hold to fill. Whether the gesture was a drag or a plain click
    // is decided on release: a click on a placed, unlocked machine opens
    // its action menu (Delete / Move / Belt); INPUT and locked machines
    // have no menu, so for them a click simply does nothing.
    const isSource = mach !== null && (mach === 'IN' || !!p.placed[mach]);
    if (mach && isSource) {
      const n = p.placed[mach];
      const pointerId = e.pointerId;
      // The tile this press belongs to: a belt out of a 2-tile machine
      // departs from the pressed tile's edge, not always the anchor's.
      const heldTile = heldTileOf(footprintCells(mach, p.placed), pt, angleRef.current);
      let idx = 0;
      if (n && n.type === 'split') {
        // The port is preselected by the press direction sector (a free
        // port wins unless the press lands deep in a taken port's sector —
        // see pickSplitPort3); dragMove keeps switching it live while the
        // preview is empty, and the port markers show the choice for the
        // whole drag.
        const a = anchorOf(mach, angleRef.current);
        idx = pickSplitPort3(
          [!!p.conns[mach + ':0'], !!p.conns[mach + ':1'], !!p.conns[mach + ':2']],
          (Math.atan2(pt.y - a.y, pt.x - a.x) * 180) / Math.PI,
          Math.hypot(pt.x - a.x, pt.y - a.y),
          -1,
          splitPortAngles(angleRef.current),
        );
      }
      pressRef.current = {
        mach,
        menuEligible: !!n && !(p.lockedIds ?? []).includes(mach),
        heldTile,
        x: e.clientX,
        y: e.clientY,
      };
      startDrag(mach + ':' + idx, pointerId, false, null, heldTile);
      dragMove(e.clientX, e.clientY, pointerId);
    }
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      // The click menu's hover feedback: the chip under the cursor lights
      // up (and the cursor turns into a hand) so it reads as clickable.
      // The menu group itself is pointer-events: none, so this hit test
      // is the only hover channel it has.
      const mOpen = menuRef.current;
      if (mOpen) {
        const pt = evtPoint(e.clientX, e.clientY);
        const active = pt ? menuActiveFor(mOpen.id, pt) : null;
        if (active !== mOpen.active) {
          const nm: MenuState = { ...mOpen, active };
          menuRef.current = nm;
          setMenu(nm);
        }
        const svg = propsRef.current.svgRef.current;
        if (svg) svg.style.cursor = active ? 'pointer' : '';
      }
      if (moveRef.current) {
        moveMove(e.clientX, e.clientY);
        return;
      }
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
        const d = dragRef.current;
        // A follow-mode drag (born from the menu's Belt action) ignores
        // releases: it ends on the planting click, Esc, or right-click.
        if (d.follow) return;
        if (e.pointerId !== d.pointerId) return;
        // A press that never became a belt — no path laid, no other
        // machine reached, barely moved — was a plain CLICK on the
        // source machine: on a placed, unlocked machine it opens the
        // action menu instead of drawing anything.
        const pr = pressRef.current;
        pressRef.current = null;
        downRef.current = null;
        const moved = pr ? Math.hypot(e.clientX - pr.x, e.clientY - pr.y) : 99;
        if (
          pr &&
          pr.menuEligible &&
          pr.mach === d.srcId &&
          moved <= 6 &&
          d.ctx.path.length === 0 &&
          (!d.hoverMachine || d.hoverMachine === d.srcId)
        ) {
          dragRef.current = null;
          setDrag(null);
          propsRef.current.onDragRails(null);
          const m: MenuState = { id: pr.mach, pointerId: -1, active: null, heldTile: pr.heldTile };
          menuRef.current = m;
          setMenu(m);
          return;
        }
        // A real drag: releasing plants the belt — on the target machine
        // under the cursor, or as an open-ended trail on an empty cell.
        finishDrag();
        return;
      }
      if (moveRef.current) {
        // Follow-mode Move ignores releases: it ends on the planting
        // click (handlePointerDown), Esc, or a right-click.
        return;
      }
      // A drag that began on the rack ends here: the press landed
      // outside the board, so there is no press record — with a machine
      // in hand, releasing over the board drops it on that cell.
      if (!downRef.current && !boardPressRef.current && propsRef.current.ghost && !propsRef.current.running) {
        const svg = propsRef.current.svgRef.current;
        const pt = evtPoint(e.clientX, e.clientY);
        if (svg && pt) {
          const r = svg.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            const cell = pickCell(pt.x, pt.y, angleRef.current);
            if (cell) placeGhostAt(cell);
          }
        }
        return;
      }
      const info = downRef.current;
      downRef.current = null;
      if (!info || propsRef.current.running) return;
      const moved = Math.hypot(e.clientX - info.x, e.clientY - info.y);
      if (moved > 6 || performance.now() - info.t > 700) return;
      const p = propsRef.current;
      // With a machine in hand, a click PLACES — even on a belt cell: the
      // machine splices into the line (the belt splits around it, upstream
      // ends at the machine, its port 0 continues downstream, so all three
      // machines stay connected). Click-to-delete a belt only applies with
      // an empty hand, below.
      if (p.ghost && info.cell) {
        placeGhostAt(info.cell);
        return;
      }
      if (info.conn) {
        const next = { ...p.conns };
        delete next[info.conn];
        p.onConnsChange(next, 'delete');
        return;
      }
      // A plain click on a machine never reaches here (it opens the
      // machine's menu in the drag branch above); output machines and
      // other non-sources simply do nothing on a click.
      if (info.mach) return;
      if (info.cell) {
        p.onPlaceRejected(info.cell);
        flashCell(info.cell);
      }
    }
    function onDown(e: PointerEvent) {
      const svg = propsRef.current.svgRef.current;
      boardPressRef.current = !!(svg && e.target instanceof Node && svg.contains(e.target));
    }
    function onCancel() {
      camRef.current = null;
      closeMenu();
      moveRef.current = null;
      setMoveSt(null);
      pressRef.current = null;
      if (dragRef.current) {
        dragRef.current = null;
        setDrag(null);
        propsRef.current.onDragRails(null);
      }
      downRef.current = null;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (!menuRef.current && !dragRef.current && !moveRef.current) return;
      onCancel();
    }
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
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
    ghost && hoverCell
      ? cellPlaceable(hoverCell, ghost.type, placedDefs, conns, obstacleSet) ||
        spliceConns(conns, hoverCell, ghost.type, placedDefs, obstacleSet) !== null
      : false;

  return (
    <svg id="board" viewBox="0 0 960 560" ref={props.svgRef} onPointerDown={handlePointerDown} onContextMenu={(e) => e.preventDefault()}>
      <defs>
        <clipPath id="tokClip">
          <rect x={-20} y={-38} width={40} height={40} />
        </clipPath>
        <radialGradient id="machineGlow">
          <stop offset="0%" stopColor="#FFA02E" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFA02E" stopOpacity="0" />
        </radialGradient>
        <pattern id="floorTex" width="168" height="168" patternUnits="userSpaceOnUse">
          <image href={FLOOR_TEX_IMG} width="168" height="168" />
        </pattern>
      </defs>

      {/* World painting (floor + pixel belt tiles) is drawn for the classic
          view and carried into the camera's view by one affine warp, so the
          pixel 2.5D tileset survives any azimuth. Billboards (machines,
          tokens, labels) render outside this group, unwarped. */}
      <g transform={boardWarpTransform(angle)}>
        {(() => {
          const corners = [isoCenter(0, 0), isoCenter(COLS - 1, 0), isoCenter(COLS - 1, ROWS - 1), isoCenter(0, ROWS - 1)];
          const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
          const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
          const exp = (f: number, dy = 0) =>
            corners.map((p) => `${cx + (p.x - cx) * f},${cy + (p.y - cy) * f + dy}`).join(' ');
          return (
            <g className="board-rim">
              <polygon points={exp(1.22, 13)} fill="#0B0D10" />
              <polygon points={exp(1.16, 7)} fill="#14171C" />
              <polygon points={exp(1.1)} fill="#1E2229" />
              <polygon points={exp(1.1)} fill="none" stroke="#0F1114" strokeWidth={9} />
              <polygon points={exp(1.1)} fill="none" stroke="#C96A12" strokeWidth={9} strokeDasharray="15 11" opacity={0.5} />
              {corners.map((p, i) => (
                <circle
                  key={i}
                  cx={cx + (p.x - cx) * 1.1}
                  cy={cy + (p.y - cy) * 1.1}
                  r={3}
                  fill="#4A545F"
                  stroke="#101216"
                  strokeWidth={1.2}
                />
              ))}
            </g>
          );
        })()}
        {floorCells.map(({ c, r }) => {
          const ctr = isoCenter(c, r);
          return (
            <g key={c + ',' + r}>
              <polygon points={diamondPoints(ctr, 0.6)} className="floor-cell" fill="url(#floorTex)" />
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

        {moveSt && moveSt.anchor && placed[moveSt.id] && (
          <g>
            {footprintCellsAtSafe(moveSt.anchor, placed[moveSt.id].type).map((c) => (
              <polygon
                key={c}
                points={diamondPoints(cellCenter(c), 1.5)}
                className={'cell-outline' + (moveSt.valid ? ' ok' : ' bad')}
              />
            ))}
          </g>
        )}

        {Object.keys(conns).map((key) => {
          if (moveSt && (key.split(':')[0] === moveSt.id || conns[key].to === moveSt.id)) return null;
          return (
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
            <polyline
              className="flow-line"
              points={[
                machineCell(key.split(':')[0]),
                ...conns[key].path,
                ...(conns[key].to ? [machineCell(conns[key].to)] : []),
              ]
                .map((c) => {
                  const cc = cellCenter(c);
                  return `${cc.x},${cc.y}`;
                })
                .join(' ')}
            />
          </g>
          );
        })}

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

      {machineEntries.map(({ id }) => (
        <MachineSprite
          key={id}
          id={id}
          chapter={props.level.chapter}
          placed={displayPlaced}
          flash={flashNodeId === id}
          active={activeMachines.has(id)}
          angle={angle}
          asm={asmTick && asmTick.id === id ? { p: (asmTick.now - asmTick.start) / ASM_MS, fromCell: asmTick.fromCell } : null}
        />
      ))}
      {menu && (
        <g className="hold-menu">
          {menuOptions(menu.id).map((o) => (
            <g
              key={o.key}
              className={'hold-opt' + (menu.active === o.key ? ' active' : '')}
              transform={`translate(${o.x} ${o.y})`}
            >
              <circle r={21} />
              {o.key === 'delete' && <path d="M-7 -7 L7 7 M7 -7 L-7 7" />}
              {o.key === 'move' && (
                <path d="M0 -9 V9 M-9 0 H9 M0 -9 L-3.5 -4.5 M0 -9 L3.5 -4.5 M0 9 L-3.5 4.5 M0 9 L3.5 4.5 M-9 0 L-4.5 -3.5 M-9 0 L-4.5 3.5 M9 0 L4.5 -3.5 M9 0 L4.5 3.5" />
              )}
              {o.key === 'rail' && <path d="M-11 -4.5 H11 M-11 4.5 H11 M-6.5 -8.5 V8.5 M0 -8.5 V8.5 M6.5 -8.5 V8.5" />}
              <text y={35}>{o.label}</text>
            </g>
          ))}
        </g>
      )}
      {props.stuckCell && (
        <g className="stuck-cell">
          <polygon points={diamondPoints(cellCenter(props.stuckCell, angle), 1, angle)} />
        </g>
      )}
      {(() => {
        // SPLIT port markers: shown for the whole drag from a SPLIT. The
        // port that will be drawn glows orange, the others stay dim, so
        // the choice is never invisible.
        let splitId: string | null = null;
        let activeIdx: number | null = null;
        if (drag && placedDefs[drag.srcId]?.type === 'split') {
          splitId = drag.srcId;
          activeIdx = drag.idx;
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
      {props.coachCell && <CoachCellMark cell={props.coachCell} angle={angle} />}
      {props.coachPath && (
        <CoachHand
          from={fpCenterOf(props.coachPath.from, displayPlaced, angle)}
          to={fpCenterOf(props.coachPath.to, displayPlaced, angle)}
        />
      )}
      {ghost && hoverCell && ghostPlaceable && (
        <GhostSprite cell={hoverCell} type={ghost.type} angle={angle} chapter={props.level.chapter} />
      )}

      <g ref={props.tokenLayerRef} />

      {allIds.map((id) => (
        <MachineLabel key={'lb-' + id} id={id} placed={displayPlaced} bufLabels={bufLabels} bufFill={bufFill} locked={lockedSet.has(id)} angle={angle} />
      ))}

      {level.outputs.map((oid) => {
        const seq = level.target[oid];
        if (!seq || !seq.length) return null;
        return (
          <TargetPill
            key={'tp-' + oid}
            id={oid}
            seq={seq}
            pack={level.packageRule?.[oid] ?? null}
            label="TARGET"
            placed={displayPlaced}
            chapter={level.chapter}
            angle={angle}
          />
        );
      })}

      {level.stream.length > 0 && (
        <TargetPill
          id="IN"
          seq={level.stream}
          pack={null}
          label="INCOMING"
          placed={displayPlaced}
          chapter={level.chapter}
          angle={angle}
        />
      )}

      {Object.keys(displayPlaced)
        .filter((id) => displayPlaced[id].type === 'split')
        .map((id) => (
          <SplitExitDots key={'dots-' + id} id={id} def={placedDefs[id]} placed={placedDefs} angle={angle} />
        ))}
      {Object.keys(displayPlaced)
        .filter((id) => displayPlaced[id].type === 'split' && !lockedSet.has(id))
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

function GhostSprite({
  cell,
  type,
  angle,
  chapter,
}: {
  cell: string;
  type: NodeDef['type'];
  angle: number;
  chapter: number;
}) {
  const a = parseCell(cell);
  const fp = footprintOfType(type);
  const c = isoCenter(a.c + (fp.w - 1) / 2, a.r + (fp.d - 1) / 2, angle);
  const S = 112 * (fp.w === 2 ? 1.25 : 1);
  return (
    <image x={c.x - S / 2} y={c.y + 12 - S} width={S} height={S} opacity={0.45} href={nodeImg(chapter, type)} />
  );
}

/** The tutorial hand: a cursor arrow with a pulsing tip. Drawn at the
 *  local origin — callers position or motion-path it. */
function CoachHandGlyph() {
  return (
    <g>
      <circle r={7} className="coach-tip" />
      <polygon
        points="0,0 0,30.6 8.3,23.4 13,36.9 18.4,34.2 13.3,21.2 22.7,21.2"
        className="coach-hand-poly"
      />
    </g>
  );
}

/** Tutorial step "place it here": a pulsing ring on the suggested cell
 *  with the hand bobbing above it, pointing down. */
function CoachCellMark({ cell, angle }: { cell: string; angle: number }) {
  const a = parseCell(cell);
  const c = isoCenter(a.c, a.r, angle);
  return (
    <g className="coach-mark">
      <circle cx={c.x} cy={c.y} r={25} className="coach-ring-svg" />
      <g transform={`translate(${c.x + 9} ${c.y - 36})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 7; 0 0"
            dur="1.1s"
            repeatCount="indefinite"
          />
          <CoachHandGlyph />
        </g>
      </g>
    </g>
  );
}

/** Tutorial step "connect these": rings on both nodes, a marching
 *  dashed line between them, and the hand riding it on a loop — the
 *  exact gesture the player is about to make (press, then drag). */
function CoachHand({ from, to }: { from: Point; to: Point }) {
  const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return (
    <g className="coach-mark">
      <path d={d} className="coach-dash" />
      <circle cx={from.x} cy={from.y} r={25} className="coach-ring-svg" />
      <circle cx={to.x} cy={to.y} r={25} className="coach-ring-svg" />
      <g>
        <animateMotion dur="1.9s" repeatCount="indefinite" path={d} />
        <CoachHandGlyph />
      </g>
    </g>
  );
}

function MachineSprite({
  id,
  chapter,
  placed,
  flash,
  active,
  angle,
  asm,
}: {
  id: string;
  chapter: number;
  placed: Record<string, PlacedNode>;
  flash: boolean;
  active: boolean;
  angle: number;
  asm: { p: number; fromCell: string | null } | null;
}) {
  const n = placed[id] ?? null;
  const isFixedId = id === 'IN' || id === 'OUT' || id === 'A' || id === 'B';
  const sprite = id === 'IN' ? inputImg(chapter) : isFixedId ? outputImg(chapter) : nodeImg(chapter, n!.type);
  const ctr = fpCenterOf(id, placed, angle);
  const fp = footprintOf(id, placed);
  const S = 112 * (fp.w === 2 ? 1.25 : 1);
  const blocks = asm && n ? peekBlocks(chapter, n.type) : null;
  const fromCtr =
    asm?.fromCell && n ? fpCenterOf(asm.fromCell, { ...placed, [asm.fromCell]: n }, angle) : null;
  // The finished sprite fades in over the last stretch while the blocks
  // dissolve — no hard pop at the swap.
  const fade = asm ? Math.max(0, Math.min(1, (asm.p - 0.82) / 0.18)) : 0;
  return (
    <g data-depth={machineDepth(id, placed, angle)} {...(!isFixedId ? { 'data-mach': id } : {})}>
      <g className={'node-inner' + (flash ? ' errflash' : '')}>
        <polygon points={footprintQuad(id, placed, angle)} className="node-shadow" />
        {active && (
          <>
            <ellipse cx={ctr.x} cy={ctr.y + 9} rx={S * 0.44} ry={13} fill="url(#machineGlow)" className="machine-glow" />
            <circle cx={ctr.x + S * 0.31} cy={ctr.y + 5} r={3.4} fill="#FFA02E" className="machine-lamp" />
          </>
        )}
        <image
          x={ctr.x - S / 2}
          y={ctr.y + 12 - S}
          width={S}
          height={S}
          href={sprite}
          opacity={asm ? fade : undefined}
        />
        {asm && blocks && (
          <g opacity={1 - fade * 0.9}>
            {blocks.map((b) => (
              <AsmBlock key={b.bx + ',' + b.by} b={b} type={n!.type} ctr={ctr} S={S} p={asm.p} fromCtr={fromCtr} />
            ))}
          </g>
        )}
      </g>
    </g>
  );
}

/** One sampled sprite pixel-block of the self-assembly effect. */
function AsmBlock({
  b,
  type,
  ctr,
  S,
  p,
  fromCtr,
}: {
  b: SpriteBlock;
  type: PlacedNode['type'];
  ctr: Point;
  S: number;
  p: number;
  fromCtr: Point | null;
}) {
  const bs = S / ASM_GRID;
  const { rank, ox, oy } = blockAnim(type, b);
  const lt = Math.max(0, Math.min(1, (p - rank * 0.55) / 0.38));
  if (lt <= 0) return null;
  const e = easeOutCubic(lt);
  const tx = ctr.x - S / 2 + (b.bx + 0.5) * bs;
  const ty = ctr.y + 12 - S + (b.by + 0.5) * bs;
  let sx = tx + ox;
  let sy = ty + oy;
  if (fromCtr) {
    sx = fromCtr.x - S / 2 + (b.bx + 0.5) * bs;
    sy = fromCtr.y + 12 - S + (b.by + 0.5) * bs;
  }
  const x = sx + (tx - sx) * e;
  let y = sy + (ty - sy) * e;
  if (fromCtr) y -= Math.sin(e * Math.PI) * 12;
  return (
    <rect
      x={x - bs / 2}
      y={y - bs / 2}
      width={bs + 0.8}
      height={bs + 0.8}
      fill={b.color}
      opacity={Math.min(1, lt * 3)}
    />
  );
}

/**
 * A token sequence drawn on a fixed machine itself: a small pill above
 * the sprite holding the sequence in order. Above an output it is the
 * TARGET — what "done" looks like, readable without opening the brief;
 * above INPUT it is the INCOMING stream — what will flow in. Long
 * sequences wrap at six tokens per row; a packet rule draws a gold
 * outline around each packet group.
 */
function TargetPill({
  id,
  seq,
  pack,
  label,
  placed,
  chapter,
  angle,
}: {
  id: string;
  seq: ColorCode[];
  pack: number | null;
  label: string;
  placed: Record<string, NodeDef>;
  chapter: number;
  angle: number;
}) {
  const c = fpCenterOf(id, placed, angle);
  const TS = 17;
  const GAP = 2;
  const PER = 6;
  const rows: ColorCode[][] = [];
  for (let i = 0; i < seq.length; i += PER) rows.push(seq.slice(i, i + PER));
  const cols = Math.max(...rows.map((r) => r.length));
  const w = cols * (TS + GAP) - GAP + 12;
  const h = rows.length * (TS + 3) - 3 + 22;
  const x0 = c.x - w / 2;
  const y0 = c.y - 100 - 6 - h;
  return (
    <g className="target-pill" pointerEvents="none">
      <rect x={x0} y={y0} width={w} height={h} rx={6} />
      <text x={c.x} y={y0 + 11} className="target-pill-label">
        {label}
      </text>
      {rows.map((row, ri) => {
        const ry = y0 + 16 + ri * (TS + 3);
        return (
          <g key={ri}>
            {pack !== null &&
              pack > 1 &&
              Array.from({ length: Math.floor(row.length / pack) }, (_, gi) => (
                <rect
                  key={'pk' + gi}
                  className="target-pack"
                  x={x0 + 6 + gi * pack * (TS + GAP) - 2}
                  y={ry - 2}
                  width={pack * (TS + GAP) - GAP + 4}
                  height={TS + 4}
                  rx={4}
                />
              ))}
            {row.map((col, ci) => (
              <image
                key={ci}
                href={tokenImg(chapter, col)}
                x={x0 + 6 + ci * (TS + GAP)}
                y={ry}
                width={TS}
                height={TS}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function MachineLabel({
  id,
  placed,
  bufLabels,
  bufFill,
  locked,
  angle,
}: {
  id: string;
  placed: Record<string, PlacedNode>;
  bufLabels: Record<string, string>;
  bufFill: Record<string, { held: number; cap: number }>;
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
      {n && n.type === 'tahan' && bufFill[id] && bufFill[id].cap > 0 && (
        <g className="buf-bar">
          <rect x={a.x - 18} y={a.y + 43} width={36} height={5} rx={2} className="buf-bar-bg" />
          <rect
            x={a.x - 18}
            y={a.y + 43}
            width={36 * Math.min(1, bufFill[id].held / bufFill[id].cap)}
            height={5}
            rx={2}
            className="buf-bar-fill"
          />
        </g>
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
      transform={`translate(${a.x - 28} ${a.y - 97})`}
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
