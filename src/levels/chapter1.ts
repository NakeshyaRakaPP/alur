import type { Level } from '../types';

export const chapter1: Level[] = [
  {
    id: 'c1-1',
    chapter: 1,
    name: 'Bad Dough',
    nameId: 'Adonan Basi',
    brief:
      'The bakery is open. Bad dough must not be served. <b>Only red</b> may reach the Output.',
    briefId:
      'Toko roti buka. Adonan basi tidak boleh disajikan. <b>Hanya merah</b> yang boleh sampai ke Output.',
    concept: 'Validation — every real system throws away what does not belong.',
    conceptId: 'Validasi — setiap sistem nyata membuang yang tidak seharusnya masuk.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R'] },
    par: 1,
    refRails: 8,
    railLimit: 14,
    tray: [{ type: 'filter', color: 'R' }, { type: 'split' }, { type: 'filter', color: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'filter', color: 'R' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '4,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
        '4,3:1': { to: '4,5', path: ['4,4'] },
      },
    },
  },
  {
    id: 'c1-2',
    chapter: 1,
    name: 'Into the Oven',
    nameId: 'Masuk Oven',
    brief:
      'Time to bake. <b>All tokens</b> reach the Output — <b>all green</b>.',
    briefId:
      'Waktunya memanggang. <b>Semua token</b> sampai ke Output — <b>semua hijau</b>.',
    concept: 'Transformation — a process changes what passes through it.',
    conceptId: 'Transformasi — sebuah proses mengubah apa yang melewatinya.',
    stream: ['B', 'R', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G'] },
    par: 1,
    refRails: 8,
    railLimit: 14,
    tray: [{ type: 'transform', to: 'G' }, { type: 'filter', color: 'B' }, { type: 'filter', color: 'G' }],
    solution: {
      placements: {
        '4,3': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'transform', to: 'G' },
        '7,3': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '7,3', path: ['5,3', '6,3'] },
        '7,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c1-3',
    chapter: 1,
    name: 'Mix, Then Bake',
    nameId: 'Aduk, Lalu Panggang',
    brief:
      'Pick the good dough first, then bake it. Only red may pass — and it must come out <b>green</b>.',
    briefId:
      'Pilih adonan yang bagus dulu, baru panggang. Hanya merah yang boleh lolos — dan harus keluar <b>hijau</b>.',
    concept: 'Sequence — the output of one step becomes the input of the next.',
    conceptId: 'Urutan — keluaran satu langkah menjadi masukan langkah berikutnya.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 2,
    refRails: 7,
    railLimit: 13,
    tray: [
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'G' },
      { type: 'split' },
      { type: 'filter', color: 'G' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'filter', color: 'R' },
        '6,3': { type: 'transform', to: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'R' },
        '6,3': { type: 'transform', to: 'G' },
        '3,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
        '3,3:1': { to: '3,5', path: ['3,4'] },
      },
    },
  },
  {
    id: 'c1-4',
    chapter: 1,
    name: 'The Extra Mixer',
    nameId: 'Mixer Cadangan',
    brief:
      'Not every tool gets used today. <b>Only pure red</b> reaches the Output. Nothing else.',
    briefId:
      'Tidak semua alat dipakai hari ini. <b>Hanya merah murni</b> yang sampai ke Output. Tidak ada yang lain.',
    concept: 'Necessity — a good system uses only what it needs.',
    conceptId: 'Kebutuhan — sistem yang baik hanya memakai yang diperlukan.',
    stream: ['B', 'R', 'B', 'R', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R'] },
    par: 1,
    refRails: 8,
    railLimit: 14,
    tray: [
      { type: 'filter', color: 'R' },
      { type: 'split' },
      { type: 'filter', color: 'G' },
      { type: 'transform', to: 'G' },
      { type: 'filter', color: 'B' },
    ],
    solution: {
      placements: {
        '4,3': { type: 'filter', color: 'R' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'R' },
        '4,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
        '4,3:1': { to: '4,5', path: ['4,4'] },
      },
    },
  },
  {
    id: 'c1-5',
    chapter: 1,
    name: 'Opening Day',
    nameId: 'Hari Pembukaan',
    brief:
      'Opening day at the bakery. Output gets <b>4 blue</b> — made <b>from red</b>. Real blue does not count.',
    briefId:
      'Hari pembukaan toko roti. Output menerima <b>4 biru</b> — hasil <b>dari merah</b>. Biru asli tidak dihitung.',
    concept: 'Systems — small steps, working together, make a whole system.',
    conceptId: 'Sistem — langkah-langkah kecil yang bekerja bersama membentuk satu sistem utuh.',
    stream: ['R', 'B', 'R', 'R', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['B', 'B', 'B', 'B'] },
    par: 2,
    refRails: 7,
    railLimit: 13,
    tray: [
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'B' },
      { type: 'split' },
      { type: 'filter', color: 'G' },
      { type: 'filter', color: 'B' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'filter', color: 'R' },
        '6,3': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'R' },
        '6,3': { type: 'transform', to: 'B' },
        '3,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
        '3,3:1': { to: '3,5', path: ['3,4'] },
      },
    },
  },
];
