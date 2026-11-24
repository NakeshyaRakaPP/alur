import type { Level } from '../types';

export const chapter4: Level[] = [
  {
    id: 'c4-1',
    chapter: 4,
    name: 'Bottle Meets Cap',
    nameId: 'Botol Bertemu Tutup',
    brief:
      'On the assembly line, two parts become one. Pair <b>one red + one blue</b> → one <b>green</b>.',
    briefId:
      'Di lini perakitan, dua bagian menjadi satu. Pasangkan <b>satu merah + satu biru</b> → jadi satu <b>hijau</b>.',
    concept: 'Assembly — two parts, arriving together, become one product.',
    conceptId: 'Perakitan — dua bagian yang datang bersama menjadi satu produk.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 2,
    refRails: 10,
    railLimit: 16,
    tray: [{ type: 'split' }, { type: 'split' }, { type: 'merge', to: 'G' }],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'R', route: { byColor: { R: 2 }, other: 1 } },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:2': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'B' },
        '6,3': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c4-2',
    chapter: 4,
    name: 'Box the Pairs',
    nameId: 'Masukkan ke Boks',
    brief:
      'Assemble first, then box them up. Pair red + blue → green. Then pack: <b>packs of 3</b>.',
    briefId:
      'Rakit dulu, baru masukkan ke boks. Pasangkan merah + biru → hijau. Lalu paketkan: <b>paket isi 3</b>.',
    concept: 'Assembly, then batching — build the product, then pack it.',
    conceptId: 'Perakitan, lalu pengemasan — buat produknya, lalu paketkan.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G', 'G', 'G'] },
    packageRule: { OUT: 3 },
    goalText:
      'Target: <b>Output</b> = 2 packs of 3 Green',
    goalTextId:
      'Target: <b>Output</b> = 2 paket Hijau isi 3',
    par: 3,
    refRails: 12,
    railLimit: 20,
    tray: [
      { type: 'split' },
      { type: 'split' },
      { type: 'merge', to: 'G' },
      { type: 'tahan', size: 3 },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'R' },
        '6,3': { type: 'merge', to: 'G' },
        '8,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: '8,1', path: ['8,3', '8,2'] },
        '8,1:0': { to: 'OUT', path: ['9,2', '10,2'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'B' },
        '6,3': { type: 'merge', to: 'G' },
        '8,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: '8,1', path: ['8,3', '8,2'] },
        '8,1:0': { to: 'OUT', path: ['9,2', '10,2'] },
      },
    },
  },
  {
    id: 'c4-3',
    chapter: 4,
    name: 'Two Lines In',
    nameId: 'Dua Lini Masuk',
    brief:
      'The line eats from two sides. Green is trash. Pair <b>red + blue</b> → green — fed by <b>two belts</b>.',
    briefId:
      'Lini ini makan dari dua sisi. Hijau dibuang. Pasangkan <b>merah + biru</b> → hijau — masuk lewat <b>dua belt</b>.',
    concept: 'Balanced inputs — a merge starves when one side runs dry.',
    conceptId: 'Masukan seimbang — gabungan akan kelaparan kalau satu sisi kering.',
    stream: ['R', 'B', 'G', 'R', 'B', 'G', 'R', 'B', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 3,
    refRails: 12,
    railLimit: 20,
    tray: [
      { type: 'split' },
      { type: 'filter', color: 'B' },
      { type: 'merge', to: 'G' },
      { type: 'split' },
      { type: 'filter', color: 'R' },
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
        '3,3:0': { to: '4,1', path: ['3,2', '4,2'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'R', side: 'B', route: { byColor: { R: 2, B: 1 }, other: 0 } },
        '6,3': { type: 'merge', to: 'G' },
        '4,1': { type: 'filter', color: 'R' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:2': { to: '6,3', path: ['4,3', '5,3'] },
        '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
        '3,3:0': { to: '4,1', path: ['3,2', '4,2'] },
      },
    },
  },
  {
    id: 'c4-4',
    chapter: 4,
    name: 'The Whole Line',
    nameId: 'Seluruh Lini',
    brief:
      'The whole plant line, end to end. <b>Output A:</b> packs of 3 green. <b>Output B:</b> green from red + blue pairs.',
    briefId:
      'Seluruh lini pabrik, dari ujung ke ujung. <b>Output A:</b> paket hijau isi 3. <b>Output B:</b> hijau dari pasangan merah + biru.',
    concept: 'Synchronization — many parts moving in one rhythm.',
    conceptId: 'Sinkronisasi — banyak bagian bergerak dalam satu irama.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'R', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['G', 'G', 'G'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Green × 3 (Red + Blue pairs)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Hijau × 3 (pasangan Merah + Biru)',
    par: 3,
    refRails: 19,
    railLimit: 31,
    tray: [
      { type: 'split' },
      { type: 'tahan', size: 3 },
      { type: 'merge', to: 'G' },
      { type: 'split' },
      { type: 'split' },
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
        '3,3:0': { to: '5,1', path: ['3,2', '4,2', '5,2'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '7,3:0': { to: 'B', path: ['9,3', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'G' },
        '5,1': { type: 'tahan', size: 3 },
        '5,5': { type: 'split', color: 'R', route: { byColor: { R: 2 }, other: 1 } },
        '7,4': { type: 'merge', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '5,1', path: ['4,3', '5,3', '5,2'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '3,3:1': { to: '5,5', path: ['3,4', '4,4', '5,4'] },
        '5,5:2': { to: '7,4', path: ['6,5', '7,5'] },
        '5,5:1': { to: '7,4', path: ['5,6', '6,6', '7,6', '8,6', '8,5'] },
        '7,4:0': { to: 'B', path: ['9,4', '10,4'] },
      },
    },
  },
];
