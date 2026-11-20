import type { Level } from '../types';

export const chapter4: Level[] = [
  {
    id: 'c4-1',
    chapter: 4,
    name: 'Level 15 — First Merge',
    brief:
      'The MERGE machine has <b>two in ports</b> and one out port. It holds every token that arrives in the queue of the belt it came from; as soon as <b>two queues each hold a token, one token from each queue is consumed and a single new token</b> — colored as written on the machine — is emitted. Split this alternating flow and merge every red with a blue.',
    briefId:
      'Node GABUNG punya <b>dua port masuk</b> dan satu port keluar. Ia menampung setiap token yang datang di antrean belt asalnya; begitu <b>dua antrean sama-sama berisi, satu token dari tiap antrean dikonsumsi dan satu token baru</b> — berwarna seperti yang tertulis pada node — dipancarkan keluar. Pisahkan aliran bergantian ini dan gabungkan setiap merah dengan sebuah biru.',
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
      'Merging is only half of this system. The merged tokens must then be <b>packed by BUFFER</b>: the Output only accepts <b>packs of 3</b>. Pair every red with a blue first, then pack what comes out of the MERGE machine.',
    briefId:
      'Menggabungkan baru separuh sistem ini. Token hasil gabungan kemudian harus <b>dipaketkan oleh TAHAN</b>: Output hanya menerima <b>paket isi 3</b>. Pasangkan dulu setiap merah dengan biru, lalu paketkan hasil keluar dari node GABUNG.',
    stream: ['R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B', 'R', 'B'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G', 'G', 'G'] },
    packageRule: { OUT: 3 },
    goalText: 'Target: <b>Output</b> = 2 packs of 3 Green (merged pairs, then via BUFFER)',
    goalTextId: 'Target: <b>Output</b> = 2 paket Hijau isi 3 (pasangan gabungan, lalu lewat TAHAN)',
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
      'A MERGE machine fed through a single belt can never pair anything: the tokens all wait in the same queue. This flow carries a third color that <b>must be discarded</b> along the way, while red and blue must reach the MERGE machine <b>through two separate belts</b>.',
    briefId:
      'Node GABUNG yang diberi makan lewat satu belt tidak akan pernah bisa memasangkan apa pun: semua token menunggu di antrean yang sama. Aliran ini membawa warna ketiga yang <b>harus dibuang</b> di tengah jalan, sedangkan merah dan biru harus sampai ke node GABUNG <b>lewat dua belt terpisah</b>.',
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
      'The full system. <b>Output A</b> only accepts <b>packs of 3 green</b> released by BUFFER — 2 packs in total. <b>Output B</b> accepts green tokens that are <b>merged from one red and one blue token each</b>. Split the flow by color, treat each branch its own way, and keep the two systems apart.',
    briefId:
      'Sistem penuh. <b>Output A</b> hanya menerima <b>paket hijau isi 3</b> yang dilepas TAHAN — total 2 paket. <b>Output B</b> menerima token hijau yang <b>digabungkan dari masing-masing satu token merah dan satu biru</b>. Pisahkan aliran berdasarkan warna, perlakukan tiap cabang dengan caranya sendiri, dan jaga kedua sistem tetap terpisah.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'R', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['G', 'G', 'G'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green (via BUFFER) &nbsp;|&nbsp; <b>Output B</b> = Green × 3 (merged from Red + Blue pairs)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 (lewat TAHAN) &nbsp;|&nbsp; <b>Output B</b> = Hijau × 3 (gabungan pasangan Merah + Biru)',
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
