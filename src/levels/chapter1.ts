import type { Level } from '../types';

export const chapter1: Level[] = [
  {
    id: 'c1-1',
    chapter: 1,
    name: 'Level 1 — Filter',
    brief:
      'The incoming flow alternates red and blue tokens. <b>Only red tokens may reach the Output.</b> The FILTER machine only lets through the color written on it; every other token is discarded. Place the right machine and discard the rest.',
    briefId:
      'Aliran masuk berisi token merah dan biru bergantian. <b>Hanya token merah yang boleh sampai ke Output.</b> Node SARING hanya melewatkan warna yang tertulis padanya; token lain terbuang. Pasang node yang tepat dan buang sisanya.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R'] },
    par: 1,
    railLimit: 10,
    tray: [{ type: 'filter', color: 'R' }],
    solution: {
      placements: { '4,3': { type: 'filter', color: 'R' } },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c1-2',
    chapter: 1,
    name: 'Level 2 — Change',
    brief:
      'The CHANGE machine recolors every token that passes through it. This time <b>every token must reach the Output, and all of them must be green</b>. No token may be discarded. There is one decoy machine in the rack.',
    briefId:
      'Node UBAH mengganti warna setiap token yang melewatinya. Kali ini <b>semua token harus sampai ke Output, dan warnanya harus hijau semua</b>. Tidak boleh ada token yang dibuang. Ada satu node pengecoh di rak.',
    stream: ['B', 'R', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G'] },
    par: 1,
    railLimit: 10,
    tray: [{ type: 'transform', to: 'G' }, { type: 'filter', color: 'B' }],
    solution: {
      placements: { '4,3': { type: 'transform', to: 'G' } },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c1-3',
    chapter: 1,
    name: 'Level 3 — Two-Machine Chain',
    brief:
      'Machines can be chained: the output of one machine becomes the input of the next. <b>Only red tokens may pass, and after passing, their color must be changed to green.</b> Blue tokens must be discarded along the way.',
    briefId:
      'Node bisa dirangkai: keluaran satu node menjadi masukan node berikutnya. <b>Hanya token merah yang boleh lolos, dan setelah lolos warnanya harus diubah menjadi hijau.</b> Token biru harus terbuang di tengah jalan.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G'] },
    par: 2,
    railLimit: 9,
    tray: [{ type: 'filter', color: 'R' }, { type: 'transform', to: 'G' }],
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
  },
  {
    id: 'c1-4',
    chapter: 1,
    name: 'Level 4 — Not Every Machine Is Used',
    brief:
      'The rack may hold machines that are not needed. Placing the wrong machine only ruins the result. This target is simple: <b>only pure red tokens reach the Output</b>, unchanged and with nothing added.',
    briefId:
      'Rak boleh berisi node yang tidak dibutuhkan. Memasang node yang salah justru merusak hasil. Target kali ini sederhana: <b>hanya token merah murni yang sampai ke Output</b>, tanpa diubah dan tanpa tambahan apa pun.',
    stream: ['B', 'R', 'B', 'R', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R'] },
    par: 1,
    railLimit: 10,
    tray: [
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'G' },
      { type: 'filter', color: 'B' },
    ],
    solution: {
      placements: { '4,3': { type: 'filter', color: 'R' } },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['5,3', '6,3', '7,3', '8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c1-5',
    chapter: 1,
    name: 'Level 5 — Chapter 1 Test',
    brief:
      'Chapter 1 test. The Output must receive <b>four blue tokens that come from red tokens that were changed</b>. Original blue from the incoming flow may not join in — the counts differ too, so check the target carefully before you build.',
    briefId:
      'Ujian Chapter 1. Output harus menerima <b>empat token biru yang berasal dari token merah yang diubah</b>. Biru asli dari aliran masuk tidak boleh ikut — jumlahnya pun berbeda, jadi periksa targetnya baik-baik sebelum merangkai.',
    stream: ['R', 'B', 'R', 'R', 'B', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['B', 'B', 'B', 'B'] },
    par: 2,
    railLimit: 9,
    tray: [
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'B' },
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
  },
];
