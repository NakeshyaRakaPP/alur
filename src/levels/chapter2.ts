import type { Level } from '../types';

export const chapter2: Level[] = [
  {
    id: 'c2-1',
    chapter: 2,
    name: 'Level 6 — Split',
    brief:
      '<b>Red → Output A. Blue → Output B.</b>',
    briefId:
      '<b>Merah → Output A. Biru → Output B.</b>',
    stream: ['R', 'B', 'B', 'R', 'B', 'R'],
    outputs: ['A', 'B'],
    target: { A: ['R', 'R', 'R'], B: ['B', 'B', 'B'] },
    par: 1,
    railLimit: 18,
    tray: [{ type: 'split', color: 'R' }],
    solution: {
      placements: { '6,3': { type: 'split', color: 'R' } },
      connections: {
        'IN:0': { to: '6,3', path: ['1,3', '2,3', '3,3', '4,3', '5,3'] },
        '6,3:0': { to: 'A', path: ['6,2', '6,1', '7,1', '8,1', '9,1'] },
        '6,3:1': { to: 'B', path: ['6,4', '6,5', '7,5', '8,5', '9,5'] },
      },
    },
  },
  {
    id: 'c2-2',
    chapter: 2,
    name: 'Level 7 — Different Fates',
    brief:
      'Red becomes <b>green</b> → Output A. Blue stays <b>blue</b> → Output B.',
    briefId:
      'Merah jadi <b>hijau</b> → Output A. Biru tetap <b>biru</b> → Output B.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G'], B: ['B', 'B', 'B'] },
    par: 2,
    railLimit: 20,
    tray: [{ type: 'split', color: 'R' }, { type: 'transform', to: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '7,1': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '7,1', path: ['4,2', '4,1', '5,1', '6,1'] },
        '7,1:0': { to: 'A', path: ['8,1', '9,1'] },
        '4,3:1': { to: 'B', path: ['4,4', '4,5', '5,5', '6,5', '7,5', '8,5', '9,5'] },
      },
    },
  },
  {
    id: 'c2-3',
    chapter: 2,
    name: 'Level 8 — Merge Back',
    brief:
      'Red becomes <b>green</b>. All tokens end in the <b>same Output</b>.',
    briefId:
      'Merah jadi <b>hijau</b>. Semua token berakhir di <b>Output yang sama</b>.',
    stream: ['R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'B', 'G', 'B'] },
    par: 2,
    railLimit: 20,
    tray: [{ type: 'split', color: 'R' }, { type: 'transform', to: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '6,2': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '6,2', path: ['4,2', '5,2'] },
        '6,2:0': { to: 'OUT', path: ['7,2', '8,2', '9,2', '9,3'] },
        '4,3:1': { to: 'OUT', path: ['4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
  },
  {
    id: 'c2-4',
    chapter: 2,
    name: 'Level 9 — Sort',
    brief:
      'Mixed colors in. <b>Grouped by color</b> out.',
    briefId:
      'Warna campur masuk. Keluar <b>berkelompok per warna</b>.',
    stream: ['G', 'R', 'B', 'G', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'B', 'B', 'G', 'G'] },
    par: 1,
    railLimit: 9,
    tray: [{ type: 'sort', order: ['R', 'B', 'G'] }],
    solution: {
      placements: { '4,3': { type: 'sort', order: ['R', 'B', 'G'] } },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['6,3', '7,3', '8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c2-5',
    chapter: 2,
    name: 'Level 10 — Chapter 2 Test',
    brief:
      '<b>Green</b> goes straight to the Output. The rest become <b>blue</b> first, then join it.',
    briefId:
      '<b>Hijau</b> langsung ke Output. Sisanya jadi <b>biru</b> dulu, lalu ikut ke sana.',
    stream: ['R', 'G', 'B', 'G', 'R', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['B', 'G', 'B', 'G', 'B', 'G'] },
    par: 2,
    railLimit: 20,
    tray: [{ type: 'split', color: 'G' }, { type: 'transform', to: 'B' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'G' },
        '7,4': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['4,2', '5,2', '6,2', '7,2', '8,2', '9,2', '10,2'] },
        '4,3:1': { to: '7,4', path: ['4,4', '5,4', '6,4'] },
        '7,4:0': { to: 'OUT', path: ['8,4', '9,4', '10,4'] },
      },
    },
  },
];
