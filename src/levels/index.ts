import type { Level } from '../types';
import { chapter1 } from './chapter1';
import { chapter2 } from './chapter2';
import { chapter3 } from './chapter3';
import { chapter4 } from './chapter4';
import { chapter5 } from './chapter5';
import { attachExpert } from './expert';

export interface ChapterMeta {
  n: number;
  title: string;
}

export const CHAPTERS: ChapterMeta[] = [
  { n: 1, title: 'Chapter 1 — The Bakery' },
  { n: 2, title: 'Chapter 2 — The Parcel Hub' },
  { n: 3, title: 'Chapter 3 — The Warehouse' },
  { n: 4, title: 'Chapter 4 — The Assembly Plant' },
  { n: 5, title: 'Chapter 5 — The Airport' },
];

export const LEVELS: Level[] = attachExpert([
  ...chapter1,
  ...chapter2,
  ...chapter3,
  ...chapter4,
  ...chapter5,
]);

export function levelsOfChapter(n: number): Level[] {
  return LEVELS.filter((l) => l.chapter === n);
}

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(level: Level): Level | undefined {
  const i = LEVELS.findIndex((l) => l.id === level.id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : undefined;
}
