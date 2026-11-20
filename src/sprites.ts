// Per-pixel alpha masks for the machine sprites, built once from the sprite
// images so pointer hit-testing can follow the actual machine silhouettes
// (a point only hits a machine when it lands on an opaque sprite pixel).

import { INPUT_IMG, NODE_IMG, OUTPUT_IMG } from './nodeMeta';
import type { NodeType } from './types';

export type SpriteKind = NodeType | 'input' | 'output';

const URLS: Record<SpriteKind, string> = {
  input: INPUT_IMG,
  output: OUTPUT_IMG,
  filter: NODE_IMG.filter,
  transform: NODE_IMG.transform,
  split: NODE_IMG.split,
  tahan: NODE_IMG.tahan,
  sort: NODE_IMG.sort,
  merge: NODE_IMG.merge,
};

interface Mask {
  w: number;
  h: number;
  alpha: Uint8Array;
}

const masks = new Map<SpriteKind, Mask>();
let loadPromise: Promise<void> | null = null;

export function ensureMasks(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all(
      (Object.keys(URLS) as SpriteKind[]).map(
        (kind) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                  const alpha = new Uint8Array(canvas.width * canvas.height);
                  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
                  masks.set(kind, { w: canvas.width, h: canvas.height, alpha });
                }
              } catch {
                // Mask unavailable for this sprite; hit-testing falls back to cells.
              }
              resolve();
            };
            img.onerror = () => resolve();
            img.src = URLS[kind];
          }),
      ),
    ).then(() => undefined);
  }
  return loadPromise;
}

export function masksReady(): boolean {
  return masks.size > 0;
}

/** True when the sprite pixel at relative position (u, v) in [0,1) is opaque (alpha >= 128). */
export function spriteOpaque(kind: SpriteKind, u: number, v: number): boolean {
  const m = masks.get(kind);
  if (!m) return false;
  const x = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)));
  const y = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h)));
  return m.alpha[y * m.w + x] >= 128;
}
