import type { Level } from '../types';

export const chapter2: Level[] = [
  {
    id: 'c2-1',
    chapter: 2,
    name: 'Level 6 — Split',
    brief:
      'The SPLIT machine has three out ports: the color named on it leaves by the top port, a second named color — when the machine names one — leaves by the side port, and everything else goes to the bottom port. This machine names only one color. <b>Red to Output A, blue to Output B</b>, with nothing swapped or discarded.',
    briefId:
      'Node PISAH punya tiga port keluar: warna yang tertulis padanya keluar lewat port atas, warna kedua yang disebut — bila node menyebutkannya — keluar lewat port samping, dan sisanya ke port bawah. Node ini hanya menyebut satu warna. <b>Merah ke Output A, biru ke Output B</b>, tanpa ada yang tertukar atau terbuang.',
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
      'Each branch may be processed on its own. <b>The top branch (red) must be changed to green before Output A</b>, while <b>the bottom branch (blue) goes straight to Output B unchanged</b>.',
    briefId:
      'Setiap cabang boleh diolah sendiri-sendiri. <b>Cabang atas (merah) harus diubah menjadi hijau sebelum ke Output A</b>, sedangkan <b>cabang bawah (biru) langsung ke Output B tanpa diubah</b>.',
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
      'One in port may accept more than one connection — that is how flows are merged. Split the flow, <b>change the red branch to green</b>, then <b>merge both branches back into the same Output</b>. The final token order must match the target exactly.',
    briefId:
      'Satu port masuk boleh menerima lebih dari satu sambungan — itulah cara menggabungkan aliran. Pisahkan aliran, <b>ubah cabang merah menjadi hijau</b>, lalu <b>gabungkan kedua cabang kembali ke Output yang sama</b>. Urutan akhir token harus persis seperti target.',
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
      'The SORT machine holds every token that enters and only releases them <b>after the incoming flow ends</b>, ordered by the color order written on it. Turn this mixed three-color flow into neat color groups.',
    briefId:
      'Node URUTKAN menampung semua token yang masuk dan baru melepasnya <b>setelah aliran masuk habis</b>, terurut mengikuti urutan warna yang tertulis padanya. Ubah aliran tiga warna yang acak ini menjadi kelompok warna yang rapi.',
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
      'Chapter 2 test: split, change, and merge combined. <b>Green tokens go straight to the Output. The remaining tokens must be changed to blue first, then merged into the same Output.</b> The final order must match the target exactly.',
    briefId:
      'Ujian Chapter 2: gabungan pisah, ubah, dan gabung. <b>Token hijau langsung ke Output. Token sisanya harus diubah menjadi biru dulu, lalu digabungkan ke Output yang sama.</b> Urutan akhir harus persis seperti target.',
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
