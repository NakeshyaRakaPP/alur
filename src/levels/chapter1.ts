import type { Level } from '../types';

export const chapter1: Level[] = [
  {
    id: 'c1-1',
    chapter: 1,
    name: 'Level 1 — Filter',
    brief:
      '<b>Only red</b> may reach the Output.',
    briefId:
      '<b>Hanya merah</b> yang boleh sampai ke Output.',
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
      '<b>All tokens</b> reach the Output — <b>all green</b>.',
    briefId:
      '<b>Semua token</b> sampai ke Output — <b>semua hijau</b>.',
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
      'Only red may pass — and it must come out <b>green</b>.',
    briefId:
      'Hanya merah yang boleh lolos — dan harus keluar <b>hijau</b>.',
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
      '<b>Only pure red</b> reaches the Output. Nothing else.',
    briefId:
      '<b>Hanya merah murni</b> yang sampai ke Output. Tidak ada yang lain.',
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
      'Output gets <b>4 blue</b> — made <b>from red</b>. Real blue does not count.',
    briefId:
      'Output menerima <b>4 biru</b> — hasil <b>dari merah</b>. Biru asli tidak dihitung.',
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
