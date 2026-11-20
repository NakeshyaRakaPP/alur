import type { Level } from '../types';
import { chapter1 } from './chapter1';
import { chapter2 } from './chapter2';
import { chapter3 } from './chapter3';
import { chapter4 } from './chapter4';
import { attachExpert } from './expert';

export interface ChapterMeta {
  n: number;
  title: string;
}

export const CHAPTERS: ChapterMeta[] = [
  { n: 1, title: 'Chapter 1 — Basic Flow' },
  { n: 2, title: 'Chapter 2 — Split & Merge' },
  { n: 3, title: 'Chapter 3 — Real Systems' },
  { n: 4, title: 'Chapter 4 — Merge Machines' },
];

export const LEVELS: Level[] = attachExpert([...chapter1, ...chapter2, ...chapter3, ...chapter4]);

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
