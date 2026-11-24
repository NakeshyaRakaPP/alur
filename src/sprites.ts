// Per-pixel alpha masks for the machine sprites, built once per chapter
// from that chapter's sprite images so pointer hit-testing can follow
// the actual machine silhouettes (a point only hits a machine when it
// lands on an opaque sprite pixel).

import { inputImg, nodeImg, outputImg } from './nodeMeta';
import type { NodeType } from './types';

export type SpriteKind = NodeType | 'input' | 'output';

function urlsFor(chapter: number): Record<SpriteKind, string> {
  return {
    input: inputImg(chapter),
    output: outputImg(chapter),
    filter: nodeImg(chapter, 'filter'),
    transform: nodeImg(chapter, 'transform'),
    split: nodeImg(chapter, 'split'),
    tahan: nodeImg(chapter, 'tahan'),
    sort: nodeImg(chapter, 'sort'),
    merge: nodeImg(chapter, 'merge'),
  };
}

interface Mask {
  w: number;
  h: number;
  alpha: Uint8Array;
}

const masks = new Map<string, Mask>();
const loadPromises = new Map<number, Promise<void>>();

export function ensureMasks(chapter: number): Promise<void> {
  const going = loadPromises.get(chapter);
  if (going) return going;
  const urls = urlsFor(chapter);
  const job = Promise.all(
    (Object.keys(urls) as SpriteKind[]).map(
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
                masks.set(chapter + ':' + kind, { w: canvas.width, h: canvas.height, alpha });
              }
            } catch {
              // Mask unavailable for this sprite; hit-testing falls back to cells.
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = urls[kind];
        }),
    ),
  ).then(() => undefined);
  loadPromises.set(chapter, job);
  return job;
}

export function masksReady(chapter: number): boolean {
  for (const key of masks.keys()) if (key.startsWith(chapter + ':')) return true;
  return false;
}

/** True when the sprite pixel at relative position (u, v) in [0,1) is opaque (alpha >= 128). */
export function spriteOpaque(chapter: number, kind: SpriteKind, u: number, v: number): boolean {
  const m = masks.get(chapter + ':' + kind);
  if (!m) return false;
  const x = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)));
  const y = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h)));
  return m.alpha[y * m.w + x] >= 128;
}
