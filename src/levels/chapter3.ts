import type { Level } from '../types';

export const chapter3: Level[] = [
  {
    id: 'c3-1',
    chapter: 3,
    name: 'The Loading Dock',
    nameId: 'Dermaga Muat',
    brief:
      'The truck comes later, so goods must wait. Output only takes <b>packs of 3</b>.',
    briefId:
      'Truk datang belakangan, jadi barang harus menunggu. Output hanya menerima <b>paket isi 3</b>.',
    concept: 'Queue — holding things for a while is a real step, not a delay.',
    conceptId: 'Antrean — menahan sesuatu sejenak adalah langkah nyata, bukan keterlambatan.',
    stream: ['R', 'R', 'R', 'R', 'R', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R', 'R', 'R', 'R'] },
    packageRule: { OUT: 3 },
    goalText:
      'Target: <b>Output</b> = 2 packs of 3 Red',
    goalTextId:
      'Target: <b>Output</b> = 2 paket Merah isi 3',
    par: 1,
    refRails: 7,
    railLimit: 13,
    tray: [{ type: 'tahan', size: 3 }, { type: 'tahan', size: 2 }, { type: 'filter', color: 'R' }],
    solution: {
      placements: {
        '4,3': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['6,3', '7,3', '8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'filter', color: 'R' },
        '6,3': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c3-2',
    chapter: 3,
    name: 'Quality Gate',
    nameId: 'Gerbang Kualitas',
    brief:
      'Check the goods before they ship. Pick the <b>green</b> out first. Then pack: <b>packs of 3</b>.',
    briefId:
      'Periksa barang sebelum dikirim. Ambil <b>hijau</b>nya dulu. Lalu paketkan: <b>paket isi 3</b>.',
    concept: 'Quality control — check first, then pack in fixed bundles.',
    conceptId: 'Kontrol kualitas — periksa dulu, lalu paketkan dalam jumlah tetap.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G', 'G', 'G'] },
    packageRule: { OUT: 3 },
    goalText:
      'Target: <b>Output</b> = 2 packs of 3 Green',
    goalTextId:
      'Target: <b>Output</b> = 2 paket Hijau isi 3',
    par: 2,
    refRails: 6,
    railLimit: 12,
    tray: [{ type: 'filter', color: 'G' }, { type: 'tahan', size: 3 }, { type: 'split' }],
    solution: {
      placements: {
        '3,3': { type: 'filter', color: 'G' },
        '6,3': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'G' },
        '6,3': { type: 'tahan', size: 3 },
        '3,5': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
        '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
        '3,3:1': { to: '3,5', path: ['3,4'] },
      },
    },
  },
  {
    id: 'c3-3',
    chapter: 3,
    name: 'Two Stores',
    nameId: 'Dua Toko',
    brief:
      'One warehouse restocks two stores. <b>Output A:</b> packs of 3 green. <b>Output B:</b> blue, one by one.',
    briefId:
      'Satu gudang memasok dua toko. <b>Output A:</b> paket hijau isi 3. <b>Output B:</b> biru, satu-satu.',
    concept: 'Allocation — one source can feed many places, each with its own rules.',
    conceptId: 'Alokasi — satu sumber bisa memasok banyak tempat, masing-masing dengan aturannya sendiri.',
    stream: ['G', 'B', 'G', 'B', 'G', 'B', 'G', 'B', 'G', 'B', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B', 'B', 'B', 'B'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Blue × 6',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Biru × 6',
    par: 2,
    refRails: 15,
    railLimit: 24,
    tray: [{ type: 'split' }, { type: 'split' }, { type: 'tahan', size: 3 }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'G' },
        '6,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '6,1', path: ['5,3', '6,3', '6,2'] },
        '6,1:0': { to: 'A', path: ['8,1', '9,1'] },
        '4,3:1': { to: 'B', path: ['4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
    altSolution: {
      placements: {
        '4,3': { type: 'split', color: 'B', route: { byColor: { B: 1 }, other: 2 } },
        '6,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:2': { to: '6,1', path: ['5,3', '6,3', '6,2'] },
        '6,1:0': { to: 'A', path: ['8,1', '9,1'] },
        '4,3:1': { to: 'B', path: ['4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
      },
    },
  },
  {
    id: 'c3-4',
    chapter: 3,
    name: 'Warehouse Day',
    nameId: 'Sehari di Gudang',
    brief:
      'A full day at the warehouse. <b>Output A:</b> packs of 3 green. <b>Output B:</b> blue made from red — real blue is trash.',
    briefId:
      'Sehari penuh di gudang. <b>Output A:</b> paket hijau isi 3. <b>Output B:</b> biru dari merah — biru asli dibuang.',
    concept: 'End to end — receive, check, hold, and ship in one system.',
    conceptId: 'Ujung ke ujung — menerima, memeriksa, menahan, dan mengirim dalam satu sistem.',
    stream: ['R', 'B', 'G', 'G', 'R', 'B', 'G', 'R', 'G', 'B', 'G', 'G'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Blue × 3 (from Red)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Biru × 3 (dari Merah)',
    par: 4,
    refRails: 17,
    railLimit: 28,
    tray: [
      { type: 'split' },
      { type: 'tahan', size: 3 },
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'B' },
      { type: 'split' },
      { type: 'split' },
      { type: 'filter', color: 'G' },
    ],
    solution: {
      placements: {
        '3,3': { type: 'split', color: 'G', side: 'R' },
        '5,1': { type: 'tahan', size: 3 },
        '4,5': { type: 'filter', color: 'R' },
        '7,5': { type: 'transform', to: 'B' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:2': { to: '7,5', path: ['4,3', '5,3', '6,3', '7,3', '7,4'] },
        '3,3:1': { to: '4,5', path: ['3,4', '4,4'] },
        '3,3:0': { to: '5,1', path: ['3,2', '4,2', '5,2'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '7,5:0': { to: 'B', path: ['8,5', '9,5'] },
      },
    },
    altSolution: {
      placements: {
        '3,3': { type: 'split', color: 'G' },
        '5,1': { type: 'tahan', size: 3 },
        '5,5': { type: 'split', color: 'R', route: { byColor: { R: 2 }, other: 1 } },
        '7,5': { type: 'transform', to: 'B' },
        '4,6': { type: 'filter', color: 'G' },
      },
      connections: {
        'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
        '3,3:0': { to: '5,1', path: ['4,3', '5,3', '5,2'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '3,3:1': { to: '5,5', path: ['3,4', '4,4', '5,4'] },
        '5,5:2': { to: '7,5', path: ['6,5'] },
        '7,5:0': { to: 'B', path: ['8,5', '9,5'] },
        '5,5:1': { to: '4,6', path: ['5,6'] },
      },
    },
  },
];
