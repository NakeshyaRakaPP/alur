import type { Level } from '../types';

export const chapter5: Level[] = [
  {
    id: 'c5-1',
    chapter: 5,
    name: 'Level 19 — Two Factories',
    brief:
      '<b>Output A:</b> packs of 2 blue, made from red. <b>Output B:</b> green. Real blue is trash.',
    briefId:
      '<b>Output A:</b> paket biru isi 2, dari merah. <b>Output B:</b> hijau. Biru asli dibuang.',
    stream: ['R', 'G', 'B', 'R', 'G', 'B', 'R', 'G', 'B', 'R', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['B', 'B', 'B', 'B'], B: ['G', 'G', 'G', 'G'] },
    packageRule: { A: 2 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 2 Blue (from Red) &nbsp;|&nbsp; <b>Output B</b> = Green × 4',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Biru isi 2 (dari Merah) &nbsp;|&nbsp; <b>Output B</b> = Hijau × 4',
    par: 4,
    refRails: 16,
    railLimit: 26,
    tray: [
      { type: 'split' },
      { type: 'transform', to: 'B' },
      { type: 'tahan', size: 2 },
      { type: 'filter', color: 'G' },
      { type: 'split' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'R', side: 'G' },
        '3,1': { type: 'transform', to: 'B' },
        '7,1': { type: 'tahan', size: 2 },
        '3,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '3,1', path: ['3,2'] },
        '3,1:0': { to: '7,1', path: ['4,1', '5,1', '6,1'] },
        '7,1:0': { to: 'A', path: ['9,1'] },
        '3,3:1': { to: '3,5', path: ['3,4'] },
        '3,3:2': { to: 'B', path: ['4,3', '5,3', '6,3', '7,3', '8,3', '9,3', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'B', side: 'R' },
        '3,1': { type: 'filter', color: 'G' },
        '6,3': { type: 'transform', to: 'B' },
        '8,2': { type: 'tahan', size: 2 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '3,1', path: ['3,2'] },
        '3,3:2': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: '8,2', path: ['7,3', '8,3'] },
        '8,2:0': { to: 'A', path: ['10,2'] },
        '3,3:1': { to: 'B', path: ['3,4', '4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
  },
  {
    id: 'c5-2',
    chapter: 5,
    name: 'Level 20 — Change of Plans',
    brief:
      'Pair <b>red + blue</b> → green. Green must become <b>red</b> first.',
    briefId:
      'Pasangkan <b>merah + biru</b> → hijau. Hijau harus jadi <b>merah</b> dulu.',
    stream: ['G', 'B', 'G', 'B', 'G', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 3,
    refRails: 11,
    railLimit: 18,
    tray: [
      { type: 'split' },
      { type: 'split' },
      { type: 'transform', to: 'R' },
      { type: 'merge', to: 'G' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'B' },
        '5,5': { type: 'transform', to: 'R' },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '5,5', path: ['3,4', '4,4', '5,4'] },
        '5,5:0': { to: '6,3', path: ['6,5', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'G' },
        '5,1': { type: 'transform', to: 'R' },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '5,1', path: ['4,3', '5,3', '5,2'] },
        '5,1:0': { to: '6,3', path: ['6,1', '6,2'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c5-3',
    chapter: 5,
    name: 'Level 21 — Packed & Plain',
    brief:
      '<b>Output A:</b> one pack of 3 green. <b>Output B:</b> blue — real blue and red-turned-blue.',
    briefId:
      '<b>Output A:</b> satu paket hijau isi 3. <b>Output B:</b> biru — biru asli dan merah yang dijadikan biru.',
    stream: ['B', 'R', 'G', 'B', 'R', 'G', 'B', 'R', 'G'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G'], B: ['B', 'B', 'B', 'B', 'B', 'B'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 1 pack of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Blue × 6',
    goalTextId:
      'Target: <b>Output A</b> = 1 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Biru × 6',
    par: 3,
    refRails: 26,
    railLimit: 42,
    tray: [
      { type: 'split' },
      { type: 'tahan', size: 3 },
      { type: 'transform', to: 'B' },
      { type: 'split' },
      { type: 'split' },
    ],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'G', side: 'R' },
        '2,1': { type: 'tahan', size: 3 },
        '6,5': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '2,1', path: ['4,2', '3,2'] },
        '2,1:0': { to: 'A', path: ['4,1', '5,1', '6,1', '7,1', '8,1', '9,1'] },
        '4,3:2': { to: '6,5', path: ['5,3', '6,3', '6,4'] },
        '6,5:0': { to: 'B', path: ['7,5', '8,5', '9,5'] },
        '4,3:1': { to: 'B', path: ['4,4', '5,4', '5,5', '5,6', '6,6', '7,6', '8,6', '9,6', '10,6'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'G' },
        '2,1': { type: 'tahan', size: 3 },
        '4,5': { type: 'split', color: 'R', route: { byColor: { R: 2 }, other: 1 } },
        '7,5': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '2,1', path: ['4,2', '3,2'] },
        '2,1:0': { to: 'A', path: ['4,1', '5,1', '6,1', '7,1', '8,1', '9,1'] },
        '4,3:1': { to: '4,5', path: ['4,4'] },
        '4,5:2': { to: '7,5', path: ['5,5', '6,5'] },
        '7,5:0': { to: 'B', path: ['8,5', '9,5'] },
        '4,5:1': { to: 'B', path: ['4,6', '5,6', '6,6', '7,6', '8,6', '9,6', '10,6'] },
      },
    },
  },
  {
    id: 'c5-4',
    chapter: 5,
    name: 'Level 22 — Full Cascade',
    brief:
      '<b>Output A:</b> packs of 2 green, made from red. <b>Output B:</b> blue. <b>Output:</b> real green.',
    briefId:
      '<b>Output A:</b> paket hijau isi 2, dari merah. <b>Output B:</b> biru. <b>Output:</b> hijau asli.',
    stream: ['R', 'B', 'G', 'G', 'R', 'B', 'B', 'G', 'R', 'G', 'B', 'R'],
    outputs: ['OUT', 'A', 'B'],
    target: { A: ['G', 'G', 'G', 'G'], B: ['B', 'B', 'B', 'B'], OUT: ['G', 'G', 'G', 'G'] },
    packageRule: { A: 2 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 2 Green (from Red) &nbsp;|&nbsp; <b>Output B</b> = Blue × 4 &nbsp;|&nbsp; <b>Output</b> = Green × 4',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 2 (dari Merah) &nbsp;|&nbsp; <b>Output B</b> = Biru × 4 &nbsp;|&nbsp; <b>Output</b> = Hijau × 4',
    par: 4,
    refRails: 13,
    railLimit: 21,
    tray: [
      { type: 'sort', order: ['R', 'B', 'G'] },
      { type: 'split' },
      { type: 'transform', to: 'G' },
      { type: 'tahan', size: 2 },
    ],
    solution: {
      placements: {
        '3,3': { type: 'sort', order: ['R', 'B', 'G'] },
        '6,3': { type: 'split', color: 'R', side: 'B', route: { byColor: { R: 0, B: 1 }, other: 2 } },
        '6,1': { type: 'transform', to: 'G' },
        '8,1': { type: 'tahan', size: 2 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['5,3'] },
        '6,3:0': { to: '6,1', path: ['6,2'] },
        '6,1:0': { to: '8,1', path: ['7,1'] },
        '8,1:0': { to: 'A', path: [] },
        '6,3:2': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
        '6,3:1': { to: 'B', path: ['6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'R', side: 'B', route: { byColor: { R: 0, B: 1 }, other: 2 } },
        '3,1': { type: 'transform', to: 'G' },
        '7,1': { type: 'tahan', size: 2 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '3,1', path: ['3,2'] },
        '3,1:0': { to: '7,1', path: ['4,1', '5,1', '6,1'] },
        '7,1:0': { to: 'A', path: ['9,1'] },
        '3,3:2': { to: 'OUT', path: ['4,3', '5,3', '6,3', '7,3', '8,3', '9,3'] },
        '3,3:1': { to: 'B', path: ['3,4', '4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
  },
  {
    id: 'c5-5',
    chapter: 5,
    name: 'Level 23 — Odd Pairs',
    brief:
      'Pairs of <b>red + blue</b> → green, packed by 2. Green is trash.',
    briefId:
      'Pasangan <b>merah + biru</b> → hijau, dipaket isi 2. Hijau dibuang.',
    stream: ['R', 'R', 'B', 'G', 'R', 'B', 'G', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G'] },
    packageRule: { OUT: 2 },
    goalText:
      'Target: <b>Output</b> = 2 packs of 2 Green (Red + Blue pairs)',
    goalTextId:
      'Target: <b>Output</b> = 2 paket Hijau isi 2 (pasangan Merah + Biru)',
    par: 4,
    refRails: 16,
    railLimit: 26,
    tray: [
      { type: 'split' },
      { type: 'filter', color: 'B' },
      { type: 'merge', to: 'G' },
      { type: 'tahan', size: 2 },
      { type: 'split' },
      { type: 'filter', color: 'R' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'G', side: 'R' },
        '4,1': { type: 'filter', color: 'B' },
        '6,3': { type: 'merge', to: 'G' },
        '8,3': { type: 'tahan', size: 2 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '4,1', path: ['4,3', '4,2'] },
        '3,3:2': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '3,3:1': { to: '6,3', path: ['3,2', '3,1', '3,0', '4,0', '5,0', '6,0', '6,1', '6,2'] },
        '6,3:0': { to: '8,3', path: [] },
        '8,3:0': { to: 'OUT', path: [] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'R', side: 'B' },
        '3,5': { type: 'filter', color: 'R' },
        '6,3': { type: 'merge', to: 'G' },
        '8,3': { type: 'tahan', size: 2 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '3,5', path: ['3,4'] },
        '3,3:2': { to: '6,3', path: ['3,2', '4,2', '5,2', '6,2'] },
        '6,3:0': { to: '8,3', path: [] },
        '8,3:0': { to: 'OUT', path: [] },
      },
    },
  },
  {
    id: 'c5-6',
    chapter: 5,
    name: 'Level 24 — The Whole Plant',
    brief:
      '<b>Output A:</b> packs of 3 green. <b>Output B:</b> one pack of 3 blue, made from red + blue pairs.',
    briefId:
      '<b>Output A:</b> paket hijau isi 3. <b>Output B:</b> satu paket biru isi 3, dari pasangan merah + biru.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'R', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B'] },
    packageRule: { A: 3, B: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = 1 pack of 3 Blue (Red + Blue pairs)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = 1 paket Biru isi 3 (pasangan Merah + Biru)',
    par: 4,
    refRails: 15,
    railLimit: 24,
    tray: [
      { type: 'split' },
      { type: 'tahan', size: 3 },
      { type: 'merge', to: 'B' },
      { type: 'tahan', size: 3 },
      { type: 'split' },
      { type: 'split' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'G', side: 'R' },
        '3,1': { type: 'tahan', size: 3 },
        '6,4': { type: 'merge', to: 'B' },
        '8,5': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '3,1', path: ['3,2'] },
        '3,1:0': { to: 'A', path: ['5,1', '6,1', '7,1', '8,1', '9,1'] },
        '3,3:2': { to: '6,4', path: ['4,3', '5,3', '6,3'] },
        '3,3:1': { to: '6,4', path: ['3,4', '4,4', '5,4'] },
        '6,4:0': { to: '8,5', path: ['8,4'] },
        '8,5:0': { to: 'B', path: [] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'G' },
        '3,1': { type: 'tahan', size: 3 },
        '4,5': { type: 'split', color: 'R', route: { byColor: { R: 2 }, other: 1 } },
        '6,5': { type: 'merge', to: 'B' },
        '8,5': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '3,1', path: ['3,2'] },
        '3,1:0': { to: 'A', path: ['5,1', '6,1', '7,1', '8,1', '9,1'] },
        '3,3:1': { to: '4,5', path: ['4,3', '4,4'] },
        '4,5:2': { to: '6,5', path: ['5,5'] },
        '4,5:1': { to: '6,5', path: ['4,6', '5,6', '6,6'] },
        '6,5:0': { to: '8,5', path: [] },
        '8,5:0': { to: 'B', path: [] },
      },
    },
  },
];
