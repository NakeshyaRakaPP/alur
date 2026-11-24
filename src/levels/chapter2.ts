import type { Level } from '../types';

export const chapter2: Level[] = [
  {
    id: 'c2-1',
    chapter: 2,
    name: 'Two Cities',
    nameId: 'Dua Kota',
    brief:
      'One pile of parcels, two cities waiting. <b>Red → Output A. Blue → Output B.</b>',
    briefId:
      'Satu tumpukan paket, dua kota menunggu. <b>Merah → Output A. Biru → Output B.</b>',
    concept: 'Routing — one flow can feed many destinations.',
    conceptId: 'Routing — satu aliran bisa menuju banyak tujuan.',
    stream: ['R', 'B', 'B', 'R', 'B', 'R'],
    outputs: ['A', 'B'],
    target: { A: ['R', 'R', 'R'], B: ['B', 'B', 'B'] },
    par: 1,
    refRails: 15,
    railLimit: 24,
    tray: [
      { type: 'split' },
      { type: 'split' },
      { type: 'filter', color: 'R' },
      { type: 'filter', color: 'B' },
    ],
    solution: {
      placements: {
        '6,3': { type: 'split', color: 'R' },
      },
      connections: {
        'IN:0': { to: '6,3', path: ['1,3', '2,3', '3,3', '4,3', '5,3'] },
        '6,3:0': { to: 'A', path: ['7,3', '8,3', '9,3', '9,2', '10,2'] },
        '6,3:1': { to: 'B', path: ['6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '6,3': { type: 'split', color: 'B', route: { byColor: { B: 2 }, other: 0 } },
      },
      connections: {
        'IN:0': { to: '6,3', path: ['1,3', '2,3', '3,3', '4,3', '5,3'] },
        '6,3:2': { to: 'B', path: ['7,3', '8,3', '9,3', '9,4', '10,4'] },
        '6,3:0': { to: 'A', path: ['6,2', '7,2', '8,2', '9,2', '10,2'] },
      },
    },
  },
  {
    id: 'c2-2',
    chapter: 2,
    name: 'Fragile!',
    nameId: 'Mudah Pecah!',
    brief:
      'Handle with care. Red becomes <b>green</b> → Output A. Blue stays <b>blue</b> → Output B.',
    briefId:
      'Hati-hati, mudah pecah. Merah jadi <b>hijau</b> → Output A. Biru tetap <b>biru</b> → Output B.',
    concept: 'Conditional paths — what an item is decides where it goes.',
    conceptId: 'Jalur bersyarat — jenis barang menentukan ke mana ia pergi.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G'], B: ['B', 'B', 'B'] },
    par: 2,
    refRails: 16,
    railLimit: 26,
    tray: [{ type: 'split' }, { type: 'split' }, { type: 'transform', to: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '7,1': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '7,1', path: ['5,3', '6,3', '7,3', '7,2'] },
        '7,1:0': { to: 'A', path: ['8,1', '9,1'] },
        '4,3:1': { to: 'B', path: ['4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'B', route: { byColor: { B: 1 }, other: 2 } },
        '7,5': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:2': { to: '7,5', path: ['5,3', '6,3', '7,3', '7,4'] },
        '7,5:0': { to: 'A', path: ['8,5', '9,5', '9,4', '9,3', '9,2', '10,2'] },
        '4,3:1': { to: 'B', path: ['4,4', '5,4', '6,4', '6,5', '6,6', '7,6', '8,6', '9,6', '10,6'] },
      },
    },
  },
  {
    id: 'c2-3',
    chapter: 2,
    name: 'One Truck Out',
    nameId: 'Satu Truk Keluar',
    brief:
      'Two routes, one truck at the end. Red becomes <b>green</b>. All tokens end in the <b>same Output</b>.',
    briefId:
      'Dua rute, satu truk di ujung. Merah jadi <b>hijau</b>. Semua token berakhir di <b>Output yang sama</b>.',
    concept: 'Reconvergence — split paths can join back into one.',
    conceptId: 'Penggabungan kembali — jalur yang berpisah bisa menyatu lagi.',
    stream: ['R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'B', 'G', 'B'] },
    par: 2,
    refRails: 16,
    railLimit: 26,
    tray: [{ type: 'split' }, { type: 'split' }, { type: 'transform', to: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '6,2': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '6,2', path: ['5,3', '6,3'] },
        '6,2:0': { to: 'OUT', path: ['7,2', '8,2', '9,2', '10,2'] },
        '4,3:1': { to: 'OUT', path: ['4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'B' },
        '6,4': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:1': { to: '6,4', path: ['5,3', '6,3'] },
        '6,4:0': { to: 'OUT', path: ['7,4', '8,4', '9,4', '10,4'] },
        '4,3:0': { to: 'OUT', path: ['4,2', '5,2', '6,2', '7,2', '8,2', '9,2', '10,2'] },
      },
    },
  },
  {
    id: 'c2-4',
    chapter: 2,
    name: 'Sort the Mail',
    nameId: 'Sortir Surat',
    brief:
      'The morning pile is a mess. Mixed colors in. <b>Grouped by color</b> out.',
    briefId:
      'Tumpukan pagi berantakan. Warna campur masuk. Keluar <b>berkelompok per warna</b>.',
    concept: 'Classification — group things first, then handle them in batches.',
    conceptId: 'Klasifikasi — kelompokkan dulu, lalu tangani per kelompok.',
    stream: ['G', 'R', 'B', 'G', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'B', 'B', 'G', 'G'] },
    par: 1,
    refRails: 7,
    railLimit: 13,
    tray: [{ type: 'sort', order: ['R', 'B', 'G'] }, { type: 'tahan', size: 3 }],
    solution: {
      placements: {
        '4,3': { type: 'sort', order: ['R', 'B', 'G'] },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['6,3', '7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'sort', order: ['R', 'B', 'G'] },
        '7,3': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '7,3', path: ['6,3'] },
        '7,3:0': { to: 'OUT', path: ['9,3'] },
      },
    },
  },
  {
    id: 'c2-5',
    chapter: 2,
    name: 'Holiday Surge',
    nameId: 'Lonjakan Liburan',
    brief:
      'Holiday surge at the hub. <b>Green</b> goes straight to the Output. The rest become <b>blue</b> first, then join it.',
    briefId:
      'Lonjakan liburan di hub. <b>Hijau</b> langsung ke Output. Sisanya jadi <b>biru</b> dulu, lalu ikut ke sana.',
    concept: 'Distribution — getting every item to the right place.',
    conceptId: 'Distribusi — mengantar setiap barang ke tempat yang tepat.',
    stream: ['R', 'G', 'B', 'G', 'R', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['B', 'G', 'B', 'G', 'B', 'G'] },
    par: 2,
    refRails: 14,
    railLimit: 23,
    tray: [{ type: 'split' }, { type: 'split' }, { type: 'transform', to: 'B' }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'G' },
        '7,4': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
        '4,3:1': { to: '7,4', path: ['4,4', '5,4', '6,4'] },
        '7,4:0': { to: 'OUT', path: ['8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'R', side: 'G', route: { byColor: { R: 1, G: 2 }, other: 0 } },
        '6,5': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:2': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
        '4,3:1': { to: '6,5', path: ['4,4', '5,4', '6,4'] },
        '6,5:0': { to: 'OUT', path: ['7,5', '8,5', '9,5', '9,4', '10,4'] },
        '4,3:0': { to: 'OUT', path: ['4,2', '5,2', '6,2', '7,2', '8,2', '9,2', '10,2'] },
      },
    },
  },
];
