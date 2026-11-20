import type { Level } from '../types';

export const chapter4: Level[] = [
  {
    id: 'c4-1',
    chapter: 4,
    name: 'Level 15 — First Merge',
    brief:
      'Pair <b>one red + one blue</b> → one <b>green</b>.',
    briefId:
      'Pasangkan <b>satu merah + satu biru</b> → jadi satu <b>hijau</b>.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 2,
    railLimit: 17,
    tray: [{ type: 'split', color: 'R' }, { type: 'merge', to: 'G' }],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'R' },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['3,2', '3,1', '4,1', '5,1', '5,2', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c4-2',
    chapter: 4,
    name: 'Level 16 — Merge, Then Pack',
    brief:
      'Pair red + blue → green. Then pack: <b>packs of 3</b>.',
    briefId:
      'Pasangkan merah + biru → hijau. Lalu paketkan: <b>paket isi 3</b>.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G', 'G', 'G'] },
    packageRule: { OUT: 3 },
    goalText: 'Target: <b>Output</b> = 2 packs of 3 Green',
    goalTextId: 'Target: <b>Output</b> = 2 paket Hijau isi 3',
    par: 3,
    railLimit: 20,
    tray: [{ type: 'split', color: 'R' }, { type: 'merge', to: 'G' }, { type: 'tahan', size: 3 }],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'R' },
        '6,3': { type: 'merge', to: 'G' },
        '8,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['3,2', '3,1', '4,1', '5,1', '5,2', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: '8,1', path: ['7,2', '7,1'] },
        '8,1:0': { to: 'OUT', path: ['9,2', '9,3'] },
      },
    },
  },
  {
    id: 'c4-3',
    chapter: 4,
    name: 'Level 17 — Feed Both Sides',
    brief:
      'Green is trash. Pair <b>red + blue</b> → green — fed by <b>two belts</b>.',
    briefId:
      'Hijau dibuang. Pasangkan <b>merah + biru</b> → hijau — masuk lewat <b>dua belt</b>.',
    stream: ['R', 'B', 'G', 'R', 'B', 'G', 'R', 'B', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 3,
    railLimit: 18,
    tray: [
      { type: 'split', color: 'G', side: 'R' },
      { type: 'filter', color: 'B' },
      { type: 'merge', to: 'G' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'G', side: 'R' },
        '4,1': { type: 'filter', color: 'B' },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:1': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:2': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '3,3:0': { to: '4,1', path: ['3,2', '3,1'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c4-4',
    chapter: 4,
    name: 'Level 18 — Full Merge System',
    brief:
      '<b>Output A:</b> packs of 3 green. <b>Output B:</b> green from red + blue pairs.',
    briefId:
      '<b>Output A:</b> paket hijau isi 3. <b>Output B:</b> hijau dari pasangan merah + biru.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'R', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['G', 'G', 'G'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Green × 3 (Red + Blue pairs)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Hijau × 3 (pasangan Merah + Biru)',
    par: 3,
    railLimit: 27,
    tray: [
      { type: 'split', color: 'G', side: 'R' },
      { type: 'tahan', size: 3 },
      { type: 'merge', to: 'G' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'G', side: 'R' },
        '5,1': { type: 'tahan', size: 3 },
        '7,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:1': { to: '7,3', path: ['4,3', '5,3', '6,3'] },
        '3,3:2': { to: '7,3', path: ['3,4', '4,4', '5,4', '6,4', '7,4'] },
        '3,3:0': { to: '5,1', path: ['3,2', '3,1', '4,1'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '7,3:0': { to: 'B', path: ['8,4', '8,5', '9,5'] },
      },
    },
  },
];
