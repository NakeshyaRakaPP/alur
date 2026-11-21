import { railsUsed } from '../geometry';
import type { ExpertSpec, Level, NodeDef } from '../types';

interface ExpertCfg {
  obstacles: string[];
  locked?: Record<string, NodeDef>;
  tray: NodeDef[];
}

/**
 * Konfigurasi Expert per level. Solusi referensi Expert memakai ulang solusi
 * level dasar (mesin terkunci adalah bagian dari solusi itu), sedangkan
 * railLimit Expert dirumuskan seragam: rail referensi + max(1, 10% referensi).
 */
const CFG: Record<string, ExpertCfg> = {
  'c1-1': {
    obstacles: ['4,2', '4,4', '7,2'],
    tray: [{ type: 'filter', color: 'R' }],
  },
  'c1-2': {
    obstacles: ['4,2', '4,4', '7,4'],
    tray: [{ type: 'transform', to: 'G' }],
  },
  'c1-3': {
    obstacles: ['4,2', '5,4'],
    locked: { '3,3': { type: 'filter', color: 'R' } },
    tray: [{ type: 'transform', to: 'G' }],
  },
  'c1-4': {
    obstacles: ['4,2', '4,4'],
    tray: [{ type: 'filter', color: 'R' }],
  },
  'c1-5': {
    obstacles: ['4,2', '5,4', '7,2'],
    tray: [{ type: 'filter', color: 'R' }, { type: 'transform', to: 'B' }],
  },
  'c2-1': {
    obstacles: ['7,3', '8,2', '8,4'],
    tray: [{ type: 'split', color: 'R' }],
  },
  'c2-2': {
    obstacles: ['5,3', '8,3', '5,2'],
    locked: { '7,1': { type: 'transform', to: 'G' } },
    tray: [{ type: 'split', color: 'R' }],
  },
  'c2-3': {
    obstacles: ['10,2', '5,3', '3,2'],
    tray: [{ type: 'split', color: 'R' }, { type: 'transform', to: 'G' }],
  },
  'c2-4': {
    obstacles: ['3,2', '3,4'],
    tray: [{ type: 'sort', order: ['R', 'B', 'G'] }],
  },
  'c2-5': {
    obstacles: ['3,2', '3,4', '6,3'],
    locked: { '7,4': { type: 'transform', to: 'B' } },
    tray: [{ type: 'split', color: 'G' }],
  },
  'c3-1': {
    obstacles: ['3,2', '3,4', '7,2'],
    tray: [{ type: 'tahan', size: 3 }],
  },
  'c3-2': {
    obstacles: ['4,2', '4,4'],
    locked: { '3,3': { type: 'filter', color: 'G' } },
    tray: [{ type: 'tahan', size: 3 }],
  },
  'c3-3': {
    obstacles: ['5,3', '8,3', '3,5'],
    tray: [{ type: 'split', color: 'G' }, { type: 'tahan', size: 3 }],
  },
  'c3-4': {
    obstacles: ['5,3', '7,3', '6,2'],
    locked: { '3,3': { type: 'split', color: 'G', side: 'R' } },
    tray: [
      { type: 'tahan', size: 3 },
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'B' },
    ],
  },
  'c4-1': {
    // Rintangan dipindah dari koridor loop atas (4,2/4,3) di v5.0: rute
    // referensi hasil auto-path lebih pendek dari rute tangan lama, jadi
    // limit Expert menyusut dan loop atas tidak boleh ditutup lagi.
    obstacles: ['2,2', '8,2', '2,4'],
    locked: { '3,3': { type: 'split', color: 'R' } },
    tray: [{ type: 'merge', to: 'G' }],
  },
  'c4-2': {
    // Sama seperti c4-1: koridor loop atas dibuka, rintangan digeser ke
    // sel yang tidak dipakai rute referensi mana pun.
    obstacles: ['2,2', '2,4'],
    locked: { '6,3': { type: 'merge', to: 'G' } },
    tray: [{ type: 'split', color: 'R' }, { type: 'tahan', size: 3 }],
  },
  'c4-3': {
    // Rintangan '4,3' dipindah ke '2,2': di solusi 3-port, sel 4,3 adalah
    // koridor keluar port SIDE milik SPLIT pertama — menutupnya membuat
    // kedua belt ke MERGE berebut satu koridor dan total rail meledak
    // melewati limit Expert.
    obstacles: ['2,2', '5,2', '7,4'],
    locked: { '6,3': { type: 'merge', to: 'G' } },
    tray: [
      { type: 'split', color: 'G', side: 'R' },
      { type: 'filter', color: 'B' },
    ],
  },
  'c4-4': {
    // Sama seperti c4-3: '4,3' menutup koridor port SIDE SPLIT terkunci,
    // jadi rintangan digeser ke '4,2' (tidak dipakai rute referensi mana pun).
    obstacles: ['4,2', '5,2', '9,4'],
    locked: { '3,3': { type: 'split', color: 'G', side: 'R' } },
    tray: [
      { type: 'tahan', size: 3 },
      { type: 'merge', to: 'G' },
    ],
  },
  'c5-1': {
    obstacles: ['2,2', '2,4', '6,4'],
    tray: [
      { type: 'split', color: 'R', side: 'G' },
      { type: 'transform', to: 'B' },
      { type: 'tahan', size: 2 },
      { type: 'filter', color: 'G' },
    ],
  },
  'c5-2': {
    obstacles: ['2,2', '8,2', '8,4'],
    tray: [
      { type: 'split', color: 'B' },
      { type: 'transform', to: 'R' },
      { type: 'merge', to: 'G' },
    ],
  },
  'c5-3': {
    obstacles: ['2,2', '9,2', '2,4'],
    locked: { '4,3': { type: 'split', color: 'G', side: 'R' } },
    tray: [
      { type: 'tahan', size: 3 },
      { type: 'transform', to: 'B' },
    ],
  },
  'c5-4': {
    obstacles: ['2,2', '2,4', '9,2'],
    tray: [
      { type: 'sort', order: ['R', 'B', 'G'] },
      { type: 'split', color: 'R', side: 'B' },
      { type: 'transform', to: 'G' },
      { type: 'tahan', size: 2 },
    ],
  },
  'c5-5': {
    obstacles: ['2,2', '9,2', '2,4'],
    tray: [
      { type: 'split', color: 'G', side: 'R' },
      { type: 'filter', color: 'B' },
      { type: 'merge', to: 'G' },
      { type: 'tahan', size: 2 },
    ],
  },
  'c5-6': {
    obstacles: ['2,2', '9,2', '2,4'],
    locked: { '3,3': { type: 'split', color: 'G', side: 'R' } },
    tray: [
      { type: 'tahan', size: 3 },
      { type: 'merge', to: 'B' },
      { type: 'tahan', size: 3 },
    ],
  },
};

export function expertRailLimit(refRails: number): number {
  return refRails + Math.max(1, Math.ceil(refRails * 0.1));
}

export function attachExpert(levels: Level[]): Level[] {
  return levels.map((level) => {
    const cfg = CFG[level.id];
    if (!cfg) return level;
    const expert: ExpertSpec = {
      railLimit: expertRailLimit(railsUsed(level.solution.connections)),
      tray: cfg.tray,
      obstacles: cfg.obstacles,
      locked: cfg.locked ?? {},
      solution: level.solution,
    };
    return { ...level, expert };
  });
}
