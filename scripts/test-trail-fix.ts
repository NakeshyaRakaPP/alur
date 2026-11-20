// Unit tests for the trail fixes (v4.5).
// Koreksi 1: continuing an open-ended trail extends it FROM ITS TIP — the
// laid path is a frozen prefix (findTrailExtension) and only the new segment
// is routed. Koreksi 2: a belt route may never share a cell with another
// committed belt, including a target machine's doorstep cells.
// Run: npx tsx scripts/test-trail-fix.ts
import {
  beltGoalCells,
  cellsAdjacent,
  findBeltPath,
  findTrailExtension,
  footprintCells,
} from '../src/geometry';
import type { NodeDef } from '../src/types';

let failures = 0;

function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok: ' + msg);
  } else {
    failures++;
    console.log('  GAGAL: ' + msg);
  }
}

function eq(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function shares(a: string[], b: string[]): string[] {
  const s = new Set(b);
  return a.filter((c) => s.has(c));
}

/** Segment cells form an orthogonal chain out of the tip, enter no blocked cell, and never repeat. */
function chainFromTip(segment: string[], tip: string, blocked: Set<string>): boolean {
  const seen = new Set<string>();
  let prev = tip;
  for (const c of segment) {
    if (blocked.has(c) || seen.has(c)) return false;
    if (!cellsAdjacent(prev, c)) return false;
    seen.add(c);
    prev = c;
  }
  return true;
}

console.log('(a) ekstensi mempertahankan prefix persis + menempel segmen terpendek dari tip');
{
  const prefix = ['2,3', '3,3', '4,3'];
  const prefixArg = [...prefix];
  const blocked = new Set(['1,3', ...prefix]);
  const res = findTrailExtension({ prefix: prefixArg, goalCells: ['6,3'], blocked, budget: Infinity });
  expect(res.routed, 'rute ekstensi ditemukan');
  expect(eq(res.segment, ['5,3', '6,3']), 'segmen = rute terpendek dari tip 4,3 ke 6,3 (dapat ' + res.segment.join(' ') + ')');
  expect(eq(res.path, [...prefix, '5,3', '6,3']), 'path gabungan = prefix + segmen');
  expect(eq(res.path.slice(0, prefix.length), prefix), 'prefix utuh di awal path gabungan');
  expect(eq(prefixArg, prefix), 'array prefix milik pemanggil tidak diubah');
  expect(chainFromTip(res.segment, '4,3', blocked), 'segmen rantai ortogonal bersih dari tip');
  expect(!res.overBudget, 'anggaran tak terbatas -> tidak over-budget');
}

console.log('(b) skenario Raka: kolom tengah ditempati trail lain, ekstensi dari samping memutar');
{
  // Another trail already runs down column 5 (rows 0-5); the only gap is row 6.
  const wall = ['5,0', '5,1', '5,2', '5,3', '5,4', '5,5'];
  const prefix = ['2,3', '3,3', '4,3'];
  const blocked = new Set(['1,3', ...prefix, ...wall]);
  const res = findTrailExtension({ prefix, goalCells: ['6,3'], blocked, budget: Infinity });
  expect(res.routed, 'rute memutar ditemukan');
  expect(res.segment.length === 8, 'segmen memutar panjang 8 > Manhattan 2 (dapat ' + res.segment.length + ')');
  expect(shares(res.segment, wall).length === 0, 'nol sel bersama dengan trail tengah');
  expect(shares(res.segment, prefix).length === 0, 'nol sel bersama dengan prefix sendiri');
  expect(new Set(res.path).size === res.path.length, 'path gabungan tanpa sel ganda');
  expect(res.segment[res.segment.length - 1] === '6,3', 'tetap berakhir di tujuan 6,3');
  expect(chainFromTip(res.segment, '4,3', blocked), 'segmen rantai ortogonal bersih dari tip');
}

console.log('(c) ekstensi tidak bisa menimpa path-nya sendiri');
{
  // Goal is one of the trail's own cells: unreachable, prefix returned as-is.
  const prefix = ['2,2', '3,2', '3,3', '3,4'];
  const blocked = new Set(['1,2', ...prefix]);
  const res = findTrailExtension({ prefix, goalCells: ['2,2'], blocked, budget: Infinity });
  expect(!res.routed, 'tujuan = sel sendiri -> tidak ada rute');
  expect(res.segment.length === 0, 'segmen kosong');
  expect(eq(res.path, prefix), 'path = prefix persis');

  // The direct column back is the trail's own body: the extension detours.
  const prefix2 = ['4,1', '4,2', '4,3'];
  const blocked2 = new Set(['3,1', ...prefix2]);
  const res2 = findTrailExtension({ prefix: prefix2, goalCells: ['4,0'], blocked: blocked2, budget: Infinity });
  expect(res2.routed, 'rute memutar badan sendiri ditemukan');
  expect(res2.segment.length === 5, 'segmen 5 > Manhattan 3 (dapat ' + res2.segment.length + ')');
  expect(shares(res2.segment, prefix2).length === 0, 'segmen tidak menyentuh prefix');
  expect(res2.segment[res2.segment.length - 1] === '4,0', 'berakhir di tujuan 4,0');
  expect(chainFromTip(res2.segment, '4,3', blocked2), 'segmen rantai ortogonal bersih dari tip');
}

console.log('(d) tanpa rute bebas -> trail lama utuh');
{
  const prefix = ['2,3', '3,3'];
  // The goal cell 8,3 is fully enclosed by other belts' cells.
  const cage = ['7,3', '9,3', '8,2', '8,4'];
  const blocked = new Set(['1,3', ...prefix, ...cage]);
  const res = findTrailExtension({ prefix, goalCells: ['8,3'], blocked, budget: Infinity });
  expect(!res.routed, 'tujuan terkurung -> tidak ada rute');
  expect(res.segment.length === 0, 'segmen kosong');
  expect(eq(res.path, prefix), 'path dikembalikan = prefix byte-per-byte');
  expect(!res.overBudget, 'tanpa rute -> bukan over-budget');
}

console.log('(e) gambar baru tidak pernah berbagi sel, termasuk perebutan doorstep target');
{
  const placed: Record<string, NodeDef> = {};
  const outCells = footprintCells('OUT', placed);
  const base = new Set<string>();
  for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, placed).forEach((c) => base.add(c));

  // Source 1 (INPUT) draws into OUTPUT and takes a doorstep cell.
  const goals1 = beltGoalCells(outCells, base);
  const r1 = findBeltPath({ srcCells: ['0,3'], goalCells: goals1, directCells: outCells, blocked: base, budget: Infinity });
  expect(r1.path !== null && r1.path.length > 0, 'sumber pertama mendapat rute ke OUTPUT');
  const takenDoorstep = r1.path![r1.path!.length - 1];
  expect(goals1.indexOf(takenDoorstep) >= 0, 'rute pertama berakhir di doorstep OUTPUT (' + takenDoorstep + ')');

  // Source 2 draws afterwards: source 1's belt is now committed (blocked),
  // so the taken doorstep is no longer offered and the routes cannot overlap.
  const blocked2 = new Set([...base, ...r1.path!, '0,0']);
  const goals2 = beltGoalCells(outCells, blocked2);
  expect(goals2.indexOf(takenDoorstep) < 0, 'doorstep yang sudah ditempati tidak ditawarkan lagi');
  const r2 = findBeltPath({ srcCells: ['0,0'], goalCells: goals2, directCells: outCells, blocked: blocked2, budget: Infinity });
  expect(r2.path !== null && r2.path.length > 0, 'sumber kedua tetap mendapat rute (doorstep lain)');
  expect(shares(r2.path!, r1.path!).length === 0, 'dua rute tidak berbagi satu sel pun');
  expect(r2.path![r2.path!.length - 1] !== takenDoorstep, 'sumber kedua berakhir di doorstep berbeda');

  // Every doorstep occupied by other belts: no goals, no route — never an overlap.
  const blockedAll = new Set([...base, ...goals1]);
  expect(beltGoalCells(outCells, blockedAll).length === 0, 'semua doorstep terisi -> daftar tujuan kosong');
  const r3 = findBeltPath({ srcCells: ['0,3'], goalCells: beltGoalCells(outCells, blockedAll), directCells: outCells, blocked: blockedAll, budget: Infinity });
  expect(r3.path === null, 'semua doorstep terisi -> tidak ada rute (bukan menimpa)');
}

console.log('(f) over-budget pada total gabungan ditolak (flag over; gerbang commit di Board yang menahan trail lama)');
{
  const prefix = ['2,3', '3,3', '4,3'];
  const blocked = new Set(['1,3', ...prefix]);
  const over = findTrailExtension({ prefix, goalCells: ['8,3'], blocked, budget: 6 });
  expect(over.routed, 'rute ada (segmen 4, total gabungan 7)');
  expect(over.overBudget, 'total gabungan 7 > anggaran 6 -> over-budget');
  expect(over.path.length === 7, 'path gabungan yang ditolak panjangnya 7');
  const exact = findTrailExtension({ prefix, goalCells: ['8,3'], blocked, budget: 7 });
  expect(exact.routed && !exact.overBudget, 'anggaran pas 7 -> tidak over-budget');
}

if (failures) {
  console.log('\n' + failures + ' kegagalan');
  process.exit(1);
}
console.log('\nSemua uji trail-fix lulus.');
