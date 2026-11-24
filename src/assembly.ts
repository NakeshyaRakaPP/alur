import { nodeImg } from './nodeMeta';
import type { NodeType } from './types';

/**
 * Self-assembly effect data: each machine sprite is sampled once into a
 * grid of colored blocks (its real pixels, averaged per cell). Placing a
 * machine plays its blocks flying into place; moving one streams the
 * same blocks from the old anchor to the new one. Every machine type
 * assembles with its own pattern — see blockAnim.
 */

export interface SpriteBlock {
  bx: number;
  by: number;
  color: string;
}

/** Blocks per sprite row/column. */
export const ASM_GRID = 20;
/** Total assembly duration, ms. */
export const ASM_MS = 640;

const SAMPLE = 40; // canvas px; each block averages a 2x2 px cell
const cache = new Map<string, SpriteBlock[]>();
const pending = new Map<string, Promise<SpriteBlock[]>>();

export function sampleSprite(chapter: number, type: NodeType): Promise<SpriteBlock[]> {
  const key = chapter + ':' + type;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const going = pending.get(key);
  if (going) return going;
  const job = new Promise<SpriteBlock[]>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = SAMPLE;
        cv.height = SAMPLE;
        const ctx = cv.getContext('2d');
        if (!ctx) return resolve([]);
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
        const cell = SAMPLE / ASM_GRID;
        const blocks: SpriteBlock[] = [];
        for (let by = 0; by < ASM_GRID; by++) {
          for (let bx = 0; bx < ASM_GRID; bx++) {
            let r = 0,
              g = 0,
              b = 0,
              a = 0,
              n = 0;
            for (let y = 0; y < cell; y++) {
              for (let x = 0; x < cell; x++) {
                const px = bx * cell + x;
                const py = by * cell + y;
                const i = (py * SAMPLE + px) * 4;
                const al = data[i + 3];
                if (al < 40) continue;
                r += data[i] * al;
                g += data[i + 1] * al;
                b += data[i + 2] * al;
                a += al;
                n++;
              }
            }
            if (n === 0 || a / n < 90) continue;
            blocks.push({
              bx,
              by,
              color: `rgb(${Math.round(r / a)},${Math.round(g / a)},${Math.round(b / a)})`,
            });
          }
        }
        cache.set(key, blocks);
        resolve(blocks);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = nodeImg(chapter, type);
  });
  pending.set(key, job);
  return job;
}

export function peekBlocks(chapter: number, type: NodeType): SpriteBlock[] | null {
  return cache.get(chapter + ':' + type) ?? null;
}

const PLACEABLE: NodeType[] = ['filter', 'transform', 'split', 'tahan', 'sort', 'merge'];

/** Warm the block cache for every rack machine (sprites are already
 *  loading for the rack icons, so this is cheap). */
export function preloadAssemblies(chapter: number): void {
  for (const t of PLACEABLE) void sampleSprite(chapter, t);
}

function hash(bx: number, by: number): number {
  const s = Math.sin(bx * 127.1 + by * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Per-type assembly choreography. rank 0 flies first, rank 1 last;
 * (ox, oy) is where a block starts relative to its home position, in
 * board units, when the machine is placed fresh (moves ignore the
 * offset — their blocks start at the old anchor instead).
 */
export function blockAnim(type: NodeType, b: SpriteBlock): { rank: number; ox: number; oy: number } {
  const x = (b.bx + 0.5) / ASM_GRID;
  const y = (b.by + 0.5) / ASM_GRID;
  switch (type) {
    case 'filter': {
      // Sift: blocks rain from above, lower rows settle first, with a
      // per-column jitter like grain through a sieve.
      const jitter = hash(b.bx, b.by) * 0.16;
      return { rank: (1 - y) * 0.78 + jitter, ox: (hash(b.by, b.bx) - 0.5) * 10, oy: -54 };
    }
    case 'transform': {
      // Spiral: the swirl lands outside-in, sweeping around the center.
      const dx = x - 0.5;
      const dy = y - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.9);
      const ang = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      return { rank: (1 - r) * 0.7 + ang * 0.3, ox: dx * 92 - dy * 34, oy: dy * 92 + dx * 34 };
    }
    case 'split': {
      // Three streams pour in from the three exit sides (up, down, east);
      // each block joins the stream of its nearest side.
      const ports: [number, number][] = [
        [0.5, -0.12],
        [0.5, 1.12],
        [1.12, 0.5],
      ];
      let best = ports[0];
      let bd = Infinity;
      for (const p of ports) {
        const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return { rank: Math.min(1, Math.sqrt(bd) * 0.95), ox: (best[0] - x) * 128, oy: (best[1] - y) * 128 };
    }
    case 'tahan': {
      // Stack: horizontal layers land bottom-up, quantized per row,
      // sliding in from alternating sides like crates on a shelf.
      const rowRank = (ASM_GRID - 1 - b.by) / (ASM_GRID - 1);
      return { rank: Math.floor(rowRank * 7) / 7, ox: b.by % 2 === 0 ? -30 : 30, oy: -7 };
    }
    case 'sort': {
      // Sorted sweep: blocks snap in left-to-right, top-weighted, like
      // bars settling into order.
      return { rank: x * 0.78 + y * 0.22, ox: -22, oy: -28 };
    }
    case 'merge': {
      // Two rivers: blocks stream in from both sides and meet at the
      // center seam, which completes last.
      return { rank: Math.min(0.85, Math.abs(x - 0.5) * 1.6) + y * 0.12, ox: x < 0.5 ? -56 : 56, oy: 0 };
    }
    default:
      return { rank: y, ox: 0, oy: -32 };
  }
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
