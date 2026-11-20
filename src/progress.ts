import type { Metrics } from './types';

export interface LevelProgress {
  stars: number;
  best: Metrics | null;
}

export type ProgressMap = Record<string, LevelProgress>;

const KEY = 'alur.progress.v1';
const EXPERT_KEY = 'alur.progress.expert.v1';

function loadFrom(key: string): ProgressMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveTo(key: string, p: ProgressMap): void {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    // Penyimpanan tidak tersedia; progres sesi tetap berjalan.
  }
}

export function loadProgress(): ProgressMap {
  return loadFrom(KEY);
}

export function saveProgress(p: ProgressMap): void {
  saveTo(KEY, p);
}

/** Rekor Expert disimpan terpisah agar tidak mengganggu rekor mode dasar. */
export function loadExpertProgress(): ProgressMap {
  return loadFrom(EXPERT_KEY);
}

export function saveExpertProgress(p: ProgressMap): void {
  saveTo(EXPERT_KEY, p);
}
