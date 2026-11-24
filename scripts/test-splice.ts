/**
 * Uji splice belt (mesin ditiban ke belt yang sedang jalan) dan re-route
 * mesin yang dipindah (hold menu → Move). Jalankan: npx tsx scripts/test-splice.ts
 */
import { simulate } from '../src/engine';
import { rerouteMovedConns, spliceConns } from '../src/geometry';
import type { Conns, Level, NodeDef } from '../src/types';

let passed = 0;
let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log('  OK — ' + msg);
  } else {
    failed++;
    console.log('  GAGAL — ' + msg);
  }
}

function fakeLevel(partial: Partial<Level>): Level {
  return {
    id: 'synthetic',
    chapter: 1,
    name: 'Synthetic',
    nameId: 'Sintetis',
    brief: '',
    briefId: '',
    concept: '',
    conceptId: '',
    stream: [],
    outputs: ['OUT'],
    target: {},
    par: 0,
    railLimit: 99,
    tray: [],
    solution: { placements: {}, connections: {} },
    ...partial,
  };
}

const STRAIGHT: Conns = {
  'IN:0': { to: 'OUT', path: ['1,3', '2,3', '3,3', '4,3', '5,3', '6,3', '7,3', '8,3', '9,3'] },
};

async function main() {
  console.log('== Splice: FILTER ditiban ke belt lurus IN→OUT ==');
  const s1 = spliceConns(STRAIGHT, '4,3', 'filter', {});
  ok(!!s1, 'splice diterima');
  ok(s1?.['IN:0'].to === '4,3' && s1['IN:0'].path.join(' ') === '1,3 2,3 3,3', 'hulu: IN → mesin, path terpotong di kaki mesin');
  ok(s1?.['4,3:0'].to === 'OUT' && s1['4,3:0'].path.join(' ') === '5,3 6,3 7,3 8,3 9,3', 'hilir: mesin → OUT, sisa path utuh');
  if (s1) {
    const lv = fakeLevel({ stream: ['R', 'B', 'R', 'B', 'R', 'B'], target: { OUT: ['R', 'R', 'R'] } });
    const res = await simulate(lv, { '4,3': { type: 'filter', color: 'R' } }, s1, { emit: async () => {} });
    ok(res.verdict.kind === 'win', 'simulasi: belt tersambung mesin di tengah tetap menang');
  }

  console.log('== Splice: BUFFER 2-tile melintasi dua sel belt ==');
  const s2 = spliceConns(STRAIGHT, '4,3', 'tahan', {});
  ok(!!s2 && s2['IN:0'].path.join(' ') === '1,3 2,3 3,3' && s2['4,3:0'].path.join(' ') === '6,3 7,3 8,3 9,3', 'kedua sel footprint termakan, hilir mulai sesudah tile kedua');
  if (s2) {
    const lv = fakeLevel({
      stream: ['R', 'R', 'R', 'R', 'R', 'R'],
      target: { OUT: ['R', 'R', 'R', 'R', 'R', 'R'] },
      packageRule: { OUT: 3 },
    });
    const res = await simulate(lv, { '4,3': { type: 'tahan', size: 3 } }, s2, { emit: async () => {} });
    ok(res.verdict.kind === 'win', 'simulasi: paket 3 lolos lewat BUFFER hasil splice');
  }

  console.log('== Splice: trail terbuka ==');
  const open: Conns = { 'IN:0': { to: null, path: ['1,3', '2,3', '3,3', '4,3'] } };
  const s3 = spliceConns(open, '2,3', 'filter', {});
  ok(!!s3 && s3['IN:0'].to === '2,3' && s3['2,3:0'].to === null && s3['2,3:0'].path.join(' ') === '3,3 4,3', 'ujung terbuka dipertahankan di hilir mesin');

  console.log('== Splice: kasus ditolak ==');
  ok(spliceConns(STRAIGHT, '4,2', 'filter', {}) === null, 'footprint tanpa belt → null');
  ok(spliceConns(STRAIGHT, '4,3', 'filter', { '4,3': { type: 'filter', color: 'B' } }) === null, 'footprint menimpa mesin lain → null');
  const two: Conns = {
    'IN:0': { to: 'OUT', path: ['1,3', '2,3', '3,3'] },
    '5,3:0': { to: 'OUT', path: ['4,3', '5,3', '6,3'] },
  };
  // footprint tahan di 3,3 menutupi sel milik dua belt berbeda (3,3 dan 4,3)
  ok(spliceConns(two, '3,3', 'tahan', { '5,3': { type: 'filter', color: 'R' } }) === null, 'footprint menyentuh dua belt → null');

  console.log('== Move: UBAH digeser satu baris, belt ikut ==');
  const chain: Conns = {
    'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
    '3,3:0': { to: '6,3', path: ['4,3', '5,3'] },
    '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
  };
  const placedWithout: Record<string, NodeDef> = { '3,3': { type: 'filter', color: 'R' } };
  const moved = rerouteMovedConns(chain, placedWithout, '6,3', '6,2', { type: 'transform', to: 'G' }, 99);
  ok(moved['IN:0'].path.join(' ') === '1,3 2,3', 'belt yang tidak menyentuh mesin dibiarkan');
  ok(moved['3,3:0']?.to === '6,2', 'belt masuk di-route ulang ke anchor baru');
  ok(moved['6,2:0']?.to === 'OUT', 'belt keluar memakai kunci anchor baru');
  const lv2 = fakeLevel({ stream: ['R', 'B', 'R', 'B', 'R', 'B'], target: { OUT: ['G', 'G', 'G'] } });
  const res2 = await simulate(
    lv2,
    { '3,3': { type: 'filter', color: 'R' }, '6,2': { type: 'transform', to: 'G' } },
    moved,
    { emit: async () => {} },
  );
  ok(res2.verdict.kind === 'win', 'simulasi: rantai tetap menang sesudah mesin digeser');

  console.log('== Move: mesin dijatuhkan ke atas belt asing (splice saat move) ==');
  const moved2 = rerouteMovedConns(STRAIGHT, {}, '4,5', '4,3', { type: 'filter', color: 'R' }, 99);
  ok(moved2['IN:0']?.to === '4,3' && moved2['4,3:0']?.to === 'OUT', 'belt asing tersplice oleh mesin yang dipindah');
  const lv3 = fakeLevel({ stream: ['R', 'B', 'R', 'B', 'R', 'B'], target: { OUT: ['R', 'R', 'R'] } });
  const res3 = await simulate(lv3, { '4,3': { type: 'filter', color: 'R' } }, moved2, { emit: async () => {} });
  ok(res3.verdict.kind === 'win', 'simulasi: hasil move+splice menang');

  console.log('\nHASIL: ' + passed + ' lulus, ' + failed + ' gagal.');
  if (failed) process.exit(1);
}

main();
