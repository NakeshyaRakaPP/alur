import type { Level } from '../types';

export const chapter3: Level[] = [
  {
    id: 'c3-1',
    chapter: 3,
    name: 'Level 11 — Buffer',
    brief:
      'The BUFFER machine holds tokens until they reach its batch size, then releases them all at once as one <b>pack</b>. The Output of this level <b>only accepts packs of 3</b> — tokens that arrive one by one will be rejected. The flow is a single color; what is being practiced is how packs work.',
    briefId:
      'Node TAHAN menahan token sampai terkumpul sejumlah isinya, lalu melepasnya sekaligus sebagai satu <b>paket</b>. Output level ini <b>hanya menerima paket isi 3</b> — token yang datang satuan akan ditolak. Alirannya satu warna; yang dilatih adalah cara paket bekerja.',
    stream: ['R', 'R', 'R', 'R', 'R', 'R'],
    outputs: ['OUT'],
    target: { OUT: ['R', 'R', 'R', 'R', 'R', 'R'] },
    packageRule: { OUT: 3 },
    goalText: 'Target: <b>Output</b> = 2 packs of 3 Red (via BUFFER)',
    goalTextId: 'Target: <b>Output</b> = 2 paket Merah isi 3 (lewat TAHAN)',
    par: 1,
    railLimit: 9,
    tray: [{ type: 'tahan', size: 3 }],
    solution: {
      placements: { '4,3': { type: 'tahan', size: 3 } },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: 'OUT', path: ['6,3', '7,3', '8,3', '9,3'] },
      },
    },
  },
  {
    id: 'c3-2',
    chapter: 3,
    name: 'Level 12 — Filter First, Then Pack',
    brief:
      'The order of machines decides the result. <b>Filter the green tokens out of the mixed flow first, then pack them with BUFFER.</b> If they are packed before being filtered, the packs are mixed with other colors and rejected by the Output.',
    briefId:
      'Urutan node menentukan hasil. <b>Saring dulu token hijau dari aliran campuran, baru paketkan dengan TAHAN.</b> Kalau dipaketkan sebelum disaring, paketnya tercampur warna lain dan ditolak Output.',
    stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'G'],
    outputs: ['OUT'],
    target: { OUT: ['G', 'G', 'G', 'G', 'G', 'G'] },
    packageRule: { OUT: 3 },
    goalText: 'Target: <b>Output</b> = 2 packs of 3 Green (filtered, then via BUFFER)',
    goalTextId: 'Target: <b>Output</b> = 2 paket Hijau isi 3 (disaring, lalu lewat TAHAN)',
    par: 2,
    railLimit: 8,
    tray: [{ type: 'filter', color: 'G' }, { type: 'tahan', size: 3 }],
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
  },
  {
    id: 'c3-3',
    chapter: 3,
    name: 'Level 13 — Two Outputs, Two Treatments',
    brief:
      '<b>Output A accepts packs of 3 green via BUFFER</b> (2 packs in total), while <b>Output B accepts blue tokens directly</b> without being packed. Split the flow first, then treat each branch according to its destination.',
    briefId:
      '<b>Output A menerima paket hijau isi 3 lewat TAHAN</b> (total 2 paket), sedangkan <b>Output B menerima token biru langsung</b> tanpa dipaketkan. Pisahkan dulu alirannya, lalu perlakukan tiap cabang sesuai tujuannya.',
    stream: ['G', 'B', 'G', 'B', 'G', 'B', 'G', 'B', 'G', 'B', 'G', 'B'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B', 'B', 'B', 'B'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green (via BUFFER) &nbsp;|&nbsp; <b>Output B</b> = Blue × 6 (direct)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 (lewat TAHAN) &nbsp;|&nbsp; <b>Output B</b> = Biru × 6 (langsung)',
    par: 2,
    railLimit: 18,
    tray: [{ type: 'split', color: 'G' }, { type: 'tahan', size: 3 }],
    solution: {
      placements: {
        '4,3': { type: 'split', color: 'G' },
        '6,1': { type: 'tahan', size: 3 },
      },
      connections: {
        'IN:0': { to: '4,3', path: ['1,3', '2,3', '3,3'] },
        '4,3:0': { to: '6,1', path: ['4,2', '4,1', '5,1'] },
        '6,1:0': { to: 'A', path: ['8,1', '9,1'] },
        '4,3:1': { to: 'B', path: ['4,4', '4,5', '5,5', '6,5', '7,5', '8,5', '9,5'] },
      },
    },
  },
  {
    id: 'c3-4',
    chapter: 3,
    name: 'Final — Full System',
    brief:
      'The hardest level. <b>Output A</b> only accepts <b>packs of 3 green</b> released by the BUFFER machine — 2 packs in total. <b>Output B</b> accepts blue that <b>comes from red that was changed</b>; original blue from the incoming flow must be discarded. The rack holds exactly 4 machines, with no spares and no helpful decoys.',
    briefId:
      'Level tersulit. <b>Output A</b> hanya menerima <b>paket hijau isi 3</b> yang dilepas node TAHAN — total harus 2 paket. <b>Output B</b> menerima biru yang <b>berasal dari merah yang diubah</b>; biru asli dari aliran masuk harus dibuang. Rak berisi tepat 4 node, tidak ada cadangan dan tidak ada pengecoh yang membantu.',
    stream: ['R', 'B', 'G', 'G', 'R', 'B', 'G', 'R', 'G', 'B', 'G', 'G'],
    outputs: ['A', 'B'],
    target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B'] },
    packageRule: { A: 3 },
    goalText:
      'Target: <b>Output A</b> = 2 packs of 3 Green (via BUFFER) &nbsp;|&nbsp; <b>Output B</b> = Blue, Blue, Blue (changed from Red)',
    goalTextId:
      'Target: <b>Output A</b> = 2 paket Hijau isi 3 (lewat TAHAN) &nbsp;|&nbsp; <b>Output B</b> = Biru, Biru, Biru (dari Merah yang diubah)',
    par: 4,
    railLimit: 17,
    tray: [
      { type: 'split', color: 'G', side: 'R' },
      { type: 'tahan', size: 3 },
      { type: 'filter', color: 'R' },
      { type: 'transform', to: 'B' },
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
        '3,3:2': { to: '7,5', path: ['4,3', '4,4', '5,4', '6,4', '6,5'] },
        '3,3:1': { to: '4,5', path: ['3,4', '3,5'] },
        '3,3:0': { to: '5,1', path: ['3,2', '3,1', '4,1'] },
        '5,1:0': { to: 'A', path: ['7,1', '8,1', '9,1'] },
        '7,5:0': { to: 'B', path: ['8,5', '9,5'] },
      },
    },
  },
];
