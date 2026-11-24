import { useEffect, useState } from 'react';
import {
  BELT_TILE_CX,
  BELT_TILE_CY,
  BELT_TILE_H,
  BELT_TILE_W,
  beltEndKey,
  beltTileKey,
  dirBetween,
  parseCell,
} from '../geometry';
import { BELT_IMG, COLOR_HEX, MACHINE_NOTE, inputImg, nodeImg, outputImg, tokenImg } from '../nodeMeta';
import type { ColorCode, NodeType } from '../types';

/**
 * The Guide Book: an open book, one spread per machine. The left page
 * explains the machine; the right page shows it working — not a cartoon,
 * but the machine's real sprite on a real belt strip, running its real
 * behavior on a loop. Turning to the next machine flips the page; there
 * is no scrolling inside the book.
 */

const K = (c: number, r: number) => c + ',' + r;

/** Local iso projection for the demo strip (fixed camera, angle 0). */
function iso(c: number, r: number): { x: number; y: number } {
  return { x: 280 + (c - r) * 42, y: 58 + (c + r) * 21 };
}
function cellPt(key: string): { x: number; y: number } {
  const p = parseCell(key);
  return iso(p.c, p.r);
}
function diamond(key: string): string {
  const c = cellPt(key);
  return `${c.x},${c.y - 21} ${c.x + 42},${c.y} ${c.x},${c.y + 21} ${c.x - 42},${c.y}`;
}

/* ------------------------------------------------------------------ */
/* Demo choreography — every loop follows the machine's true rules.    */
/* ------------------------------------------------------------------ */

interface DemoActor {
  color: ColorCode;
  route: string[];
  start: number;
  speed: number;
  colorAfter?: { at: number; color: ColorCode };
  endFx?: 'shred' | 'fade';
  tank?: string;
  tankRole?: 'in' | 'out';
}

interface DemoFx {
  t: number;
  cell: string;
  kind: 'shred' | 'spark';
  color?: ColorCode;
}

interface DemoMachine {
  kind: 'input' | 'output' | NodeType;
  cell: string;
  chipColor?: ColorCode;
  tank?: string;
}

interface Demo {
  cols: number;
  rows: number;
  duration: number;
  machines: DemoMachine[];
  paths: { cells: string[]; openEnd?: boolean }[];
  actors: DemoActor[];
  fx: DemoFx[];
}

const STRAIGHT = [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(4, 2), K(5, 2), K(6, 2)];

const DEMOS: Record<NodeType, Demo> = {
  filter: {
    cols: 8,
    rows: 5,
    duration: 10,
    machines: [
      { kind: 'input', cell: K(0, 2) },
      { kind: 'filter', cell: K(3, 2), chipColor: 'R' },
      { kind: 'output', cell: K(6, 2) },
    ],
    paths: [{ cells: STRAIGHT }],
    actors: [
      { color: 'R', route: STRAIGHT, start: 0, speed: 1.6 },
      { color: 'G', route: STRAIGHT.slice(0, 4), start: 1.4, speed: 1.6, endFx: 'shred' },
      { color: 'R', route: STRAIGHT, start: 2.8, speed: 1.6 },
      { color: 'B', route: STRAIGHT.slice(0, 4), start: 4.2, speed: 1.6, endFx: 'shred' },
      { color: 'R', route: STRAIGHT, start: 5.6, speed: 1.6 },
    ],
    fx: [
      { t: 3.28, cell: K(3, 2), kind: 'shred', color: 'G' },
      { t: 6.08, cell: K(3, 2), kind: 'shred', color: 'B' },
    ],
  },
  transform: {
    cols: 8,
    rows: 5,
    duration: 10,
    machines: [
      { kind: 'input', cell: K(0, 2) },
      { kind: 'transform', cell: K(3, 2), chipColor: 'B' },
      { kind: 'output', cell: K(6, 2) },
    ],
    paths: [{ cells: STRAIGHT }],
    actors: [
      { color: 'R', route: STRAIGHT, start: 0, speed: 1.6, colorAfter: { at: 3, color: 'B' } },
      { color: 'G', route: STRAIGHT, start: 1.8, speed: 1.6, colorAfter: { at: 3, color: 'B' } },
      { color: 'R', route: STRAIGHT, start: 3.6, speed: 1.6, colorAfter: { at: 3, color: 'B' } },
      { color: 'G', route: STRAIGHT, start: 5.4, speed: 1.6, colorAfter: { at: 3, color: 'B' } },
    ],
    fx: [
      { t: 1.88, cell: K(3, 2), kind: 'spark' },
      { t: 3.68, cell: K(3, 2), kind: 'spark' },
      { t: 5.48, cell: K(3, 2), kind: 'spark' },
      { t: 7.28, cell: K(3, 2), kind: 'spark' },
    ],
  },
  split: {
    cols: 8,
    rows: 5,
    duration: 10,
    machines: [
      { kind: 'input', cell: K(0, 2) },
      { kind: 'split', cell: K(3, 2) },
    ],
    paths: [
      { cells: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(3, 1), K(3, 0)], openEnd: true },
      { cells: [K(3, 2), K(4, 2), K(5, 2), K(6, 2), K(7, 2)], openEnd: true },
      { cells: [K(3, 2), K(3, 3), K(3, 4)], openEnd: true },
    ],
    actors: [
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(3, 1), K(3, 0)], start: 0, speed: 1.8, endFx: 'fade' },
      { color: 'G', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(4, 2), K(5, 2), K(6, 2), K(7, 2)], start: 1.5, speed: 1.8, endFx: 'fade' },
      { color: 'B', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(3, 3), K(3, 4)], start: 3.0, speed: 1.8, endFx: 'fade' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(3, 1), K(3, 0)], start: 4.5, speed: 1.8, endFx: 'fade' },
      { color: 'G', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2), K(4, 2), K(5, 2), K(6, 2), K(7, 2)], start: 6.0, speed: 1.8, endFx: 'fade' },
    ],
    fx: [],
  },
  tahan: {
    cols: 8,
    rows: 5,
    duration: 11,
    machines: [
      { kind: 'input', cell: K(0, 2) },
      { kind: 'tahan', cell: K(3, 2), tank: 'buf' },
      { kind: 'output', cell: K(6, 2) },
    ],
    paths: [{ cells: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)] }, { cells: [K(4, 2), K(5, 2), K(6, 2)] }],
    actors: [
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 0, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 0.9, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 1.8, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 4.2, speed: 1.8, tank: 'buf', tankRole: 'out' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 4.45, speed: 1.8, tank: 'buf', tankRole: 'out' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 4.7, speed: 1.8, tank: 'buf', tankRole: 'out' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 5.4, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 6.3, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 7.2, speed: 1.8, tank: 'buf', tankRole: 'in' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 9.3, speed: 1.8, tank: 'buf', tankRole: 'out' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 9.55, speed: 1.8, tank: 'buf', tankRole: 'out' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 9.8, speed: 1.8, tank: 'buf', tankRole: 'out' },
    ],
    fx: [],
  },
  sort: {
    cols: 8,
    rows: 5,
    duration: 10,
    machines: [
      { kind: 'input', cell: K(0, 2) },
      { kind: 'sort', cell: K(3, 2), tank: 'srt' },
      { kind: 'output', cell: K(6, 2) },
    ],
    paths: [{ cells: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)] }, { cells: [K(4, 2), K(5, 2), K(6, 2)] }],
    actors: [
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 0, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'G', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 0.85, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'B', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 1.7, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'G', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 2.55, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'R', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 3.4, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'B', route: [K(0, 2), K(1, 2), K(2, 2), K(3, 2)], start: 4.25, speed: 1.8, tank: 'srt', tankRole: 'in' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 6.6, speed: 1.8, tank: 'srt', tankRole: 'out' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 6.88, speed: 1.8, tank: 'srt', tankRole: 'out' },
      { color: 'G', route: [K(4, 2), K(5, 2), K(6, 2)], start: 7.16, speed: 1.8, tank: 'srt', tankRole: 'out' },
      { color: 'G', route: [K(4, 2), K(5, 2), K(6, 2)], start: 7.44, speed: 1.8, tank: 'srt', tankRole: 'out' },
      { color: 'B', route: [K(4, 2), K(5, 2), K(6, 2)], start: 7.72, speed: 1.8, tank: 'srt', tankRole: 'out' },
      { color: 'B', route: [K(4, 2), K(5, 2), K(6, 2)], start: 8.0, speed: 1.8, tank: 'srt', tankRole: 'out' },
    ],
    fx: [],
  },
  merge: {
    cols: 8,
    rows: 5,
    duration: 10,
    machines: [
      { kind: 'input', cell: K(0, 0) },
      { kind: 'input', cell: K(0, 4) },
      { kind: 'merge', cell: K(3, 2), tank: 'mrg', chipColor: 'G' },
      { kind: 'output', cell: K(6, 2) },
    ],
    paths: [
      { cells: [K(0, 0), K(1, 0), K(2, 0), K(3, 0), K(3, 1), K(3, 2)] },
      { cells: [K(0, 4), K(1, 4), K(2, 4), K(3, 4), K(3, 3), K(3, 2)] },
      { cells: [K(4, 2), K(5, 2), K(6, 2)] },
    ],
    actors: [
      { color: 'R', route: [K(0, 0), K(1, 0), K(2, 0), K(3, 0), K(3, 1), K(3, 2)], start: 0, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'R', route: [K(0, 4), K(1, 4), K(2, 4), K(3, 4), K(3, 3), K(3, 2)], start: 0.5, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'G', route: [K(4, 2), K(5, 2), K(6, 2)], start: 3.6, speed: 1.8, tank: 'mrg', tankRole: 'out' },
      { color: 'G', route: [K(0, 0), K(1, 0), K(2, 0), K(3, 0), K(3, 1), K(3, 2)], start: 2.2, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'G', route: [K(0, 4), K(1, 4), K(2, 4), K(3, 4), K(3, 3), K(3, 2)], start: 2.7, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'R', route: [K(4, 2), K(5, 2), K(6, 2)], start: 5.8, speed: 1.8, tank: 'mrg', tankRole: 'out' },
      { color: 'B', route: [K(0, 0), K(1, 0), K(2, 0), K(3, 0), K(3, 1), K(3, 2)], start: 4.4, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'B', route: [K(0, 4), K(1, 4), K(2, 4), K(3, 4), K(3, 3), K(3, 2)], start: 4.9, speed: 1.8, tank: 'mrg', tankRole: 'in' },
      { color: 'G', route: [K(4, 2), K(5, 2), K(6, 2)], start: 8.0, speed: 1.8, tank: 'mrg', tankRole: 'out' },
    ],
    fx: [
      { t: 3.6, cell: K(4, 2), kind: 'spark' },
      { t: 5.8, cell: K(4, 2), kind: 'spark' },
      { t: 8.0, cell: K(4, 2), kind: 'spark' },
    ],
  },
};

/* ------------------------------------------------------------------ */

function actorPoint(a: DemoActor, now: number): { x: number; y: number; color: ColorCode } | null {
  const steps = a.route.length - 1;
  const d = (now - a.start) * a.speed;
  if (d < 0 || d > steps) return null;
  const i = Math.min(Math.floor(d), steps - 1);
  const f = d - i;
  const p0 = cellPt(a.route[i]);
  const p1 = cellPt(a.route[Math.min(i + 1, steps)]);
  const color = a.colorAfter && d >= a.colorAfter.at ? a.colorAfter.color : a.color;
  return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, color };
}

function tankCount(demo: Demo, tank: string, now: number): number {
  let n = 0;
  for (const a of demo.actors) {
    if (a.tank !== tank) continue;
    if (a.tankRole === 'in') {
      const vanishT = a.start + (a.route.length - 1) / a.speed;
      if (now >= vanishT) n += 1;
    } else if (now >= a.start) {
      n -= 1;
    }
  }
  return Math.max(0, n);
}

function DemoStage({ type, chapter }: { type: NodeType; chapter: number }) {
  const demo = DEMOS[type];
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      setNow(((t - t0) / 1000) % demo.duration);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [demo]);

  const beltTiles = new Map<string, string>();
  for (const path of demo.paths) {
    const last = path.openEnd ? path.cells.length - 1 : path.cells.length - 2;
    for (let i = 1; i <= last; i++) {
      const cell = path.cells[i];
      if (beltTiles.has(cell)) continue;
      const tile =
        path.openEnd && i === path.cells.length - 1
          ? beltEndKey(dirBetween(cell, path.cells[i - 1]))
          : beltTileKey(dirBetween(cell, path.cells[i - 1]), dirBetween(cell, path.cells[i + 1]));
      if (tile) beltTiles.set(cell, tile);
    }
  }

  const floor: string[] = [];
  for (let c = 0; c < demo.cols; c++) for (let r = 0; r < demo.rows; r++) floor.push(K(c, r));

  const spriteFor = (m: DemoMachine): { href: string; w: number } => {
    if (m.kind === 'input') return { href: inputImg(chapter), w: 1 };
    if (m.kind === 'output') return { href: outputImg(chapter), w: 2 };
    const wide = m.kind === 'tahan' || m.kind === 'sort' || m.kind === 'merge';
    return { href: nodeImg(chapter, m.kind), w: wide ? 2 : 1 };
  };

  return (
    <svg className="demo-stage" viewBox="0 0 640 330" role="img" aria-label={type + ' demonstration'}>
      <rect x={6} y={6} width={628} height={318} rx={12} className="demo-back" />
      {floor.map((cell) => (
        <polygon key={cell} points={diamond(cell)} className="demo-floor" />
      ))}
      {[...beltTiles.entries()].map(([cell, tile]) => {
        const c = cellPt(cell);
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
      {demo.actors.map((a, i) => {
        const pt = actorPoint(a, now);
        if (!pt) return null;
        return (
          <image
            key={i}
            x={pt.x - 17}
            y={pt.y - 26}
            width={34}
            height={34}
            href={tokenImg(chapter, pt.color)}
            opacity={a.endFx === 'fade' && now > a.start + (a.route.length - 1) / a.speed - 0.25 ? 0.45 : 1}
          />
        );
      })}
      {demo.machines.map((m, i) => {
        const a = parseCell(m.cell);
        const { href, w } = spriteFor(m);
        const c = iso(a.c + (w - 1) / 2, a.r);
        const S = 112 * (w === 2 ? 1.25 : 1);
        const count = m.tank ? tankCount(demo, m.tank, now) : 0;
        return (
          <g key={i}>
            <image x={c.x - S / 2} y={c.y + 12 - S} width={S} height={S} href={href} />
            {m.chipColor && <circle cx={c.x} cy={c.y - S + 16} r={7} fill={COLOR_HEX[m.chipColor]} stroke="#0c0d10" strokeWidth={2} />}
            {count > 0 && (
              <g>
                <circle cx={c.x + S / 2 - 10} cy={c.y - S + 22} r={11} fill="#f5a623" stroke="#0c0d10" strokeWidth={2} />
                <text x={c.x + S / 2 - 10} y={c.y - S + 26.5} className="demo-count">
                  {count}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {demo.fx.map((fx, i) => {
        const phase = (now - fx.t) / 0.45;
        if (phase < 0 || phase > 1) return null;
        const c = cellPt(fx.cell);
        return (
          <g key={i} opacity={1 - phase}>
            {Array.from({ length: 8 }, (_, j) => {
              const ang = (j * Math.PI) / 4 + (fx.kind === 'spark' ? 0.4 : 0);
              const dist = 6 + phase * 17;
              const px = c.x + Math.cos(ang) * dist;
              const py = c.y - 14 + Math.sin(ang) * dist * 0.6;
              return fx.kind === 'shred' ? (
                <rect key={j} x={px - 3} y={py - 3} width={6} height={6} fill={COLOR_HEX[fx.color ?? 'R']} />
              ) : (
                <circle key={j} cx={px} cy={py} r={2.6} fill="#ffc44d" />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const PAGE_ORDER: NodeType[] = ['filter', 'transform', 'split', 'tahan', 'sort', 'merge'];

const PAGE_TITLES: Record<NodeType, string> = {
  filter: 'FILTER',
  transform: 'CHANGE',
  split: 'SPLIT',
  tahan: 'BUFFER',
  sort: 'SORT',
  merge: 'MERGE',
};

const PAGE_POINTS: Record<NodeType, string[]> = {
  filter: [
    'Keeps the one color shown on its label.',
    'Every other color is shredded the moment it enters.',
    'Nothing waits inside — a token leaves at once, or not at all.',
  ],
  transform: [
    'Every token that enters leaves as the color on its label.',
    'The old color is gone — there is no way back.',
    'Tokens pass through one by one; none are kept.',
  ],
  split: [
    'Three ends: up, down, and the side.',
    'Each color leaves by its own end — set them with Route.',
    'A color whose end has no belt stays stuck inside.',
  ],
  tahan: [
    'Tokens wait inside until the pack is full.',
    'Then the whole pack leaves together, in order.',
    'The number on the machine shows how full it is.',
  ],
  sort: [
    'Tokens wait inside while they pile up.',
    'Then they leave grouped: all of one color, then the next.',
    'The color order is the machine’s own fixed order.',
  ],
  merge: [
    'Needs one token from EACH belt in.',
    'The pair joins into one token of a new color.',
    'A token that arrives alone waits inside for its partner.',
  ],
};

export default function GuideBook({ chapter, onClose }: { chapter: number; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<'next' | 'prev' | null>(null);

  const go = (dir: 1 | -1) => {
    if (turn) return;
    const target = page + dir;
    if (target < 0 || target >= PAGE_ORDER.length) return;
    setTurn(dir === 1 ? 'next' : 'prev');
    window.setTimeout(() => setPage(target), 230);
    window.setTimeout(() => setTurn(null), 500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const type = PAGE_ORDER[page];
  const sheetType = turn === 'next' ? PAGE_ORDER[Math.min(page + 1, PAGE_ORDER.length - 1)] : PAGE_ORDER[Math.max(page - 1, 0)];

  return (
    <div
      className="book-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="book">
        <button className="book-x" onClick={onClose} aria-label="Close guide book">
          ✕
        </button>
        <div className="book-page left">
          <div className="book-kicker">GUIDE BOOK</div>
          <img className="book-sprite" src={nodeImg(chapter, type)} alt="" />
          <h3 className="book-title">{PAGE_TITLES[type]}</h3>
          <p className="book-note">{MACHINE_NOTE[type]}</p>
          <ul className="book-points">
            {PAGE_POINTS[type].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="book-foot">
            {PAGE_TITLES[type]} · page {page + 1} of {PAGE_ORDER.length}
          </div>
        </div>
        <div className="book-spine" />
        <div className="book-page right">
          <DemoStage type={type} chapter={chapter} />
          <p className="book-caption">The real machine, at work on a test strip.</p>
          <div className="book-nav">
            <button className="book-nav-btn" onClick={() => go(-1)} disabled={page === 0 || !!turn}>
              ◀ Prev
            </button>
            <button className="book-nav-btn" onClick={() => go(1)} disabled={page === PAGE_ORDER.length - 1 || !!turn}>
              Next ▶
            </button>
          </div>
        </div>
        {turn && (
          <div className={'book-sheet ' + turn}>
            <img src={nodeImg(chapter, sheetType)} alt="" />
          </div>
        )}
      </div>
    </div>
  );
}
