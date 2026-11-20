// Unit tests for the auto-path belt router (v4.3).
// findBeltPath is the pure BFS Board.tsx runs on every pointer move: shortest
// orthogonal route from a source machine's footprint to the cursor cell (or
// to a target machine's doorstep cells), with a rail-budget verdict.
// Run: npx tsx scripts/test-auto-path.ts
import {
  beltGoalCells,
  cellsAdjacent,
  findBeltPath,
  footprintCells,
} from '../src/geometry';

let failures = 0;

function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok: ' + msg);
  } else {
    failures++;
    console.log('  GAGAL: ' + msg);
  }
}

function chainValid(path: string[], srcCells: string[], blocked: Set<string>): boolean {
  for (let i = 0; i < path.length; i++) {
    if (blocked.has(path[i])) return false;
    if (i === 0) {
      if (!srcCells.some((sc) => cellsAdjacent(sc, path[i]))) return false;
    } else if (!cellsAdjacent(path[i - 1], path[i])) {
      return false;
    }
  }
  return true;
}

// INPUT feeder footprint: the single cell 0,3. Blocked always contains the
// source footprint itself, exactly like Board's computeBlocked.
const SRC = ['0,3'];

console.log('(a) grid terbuka: jalur = jarak Manhattan, lurus ke tujuan');
{
  const blocked = new Set(SRC);
  const res = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: Infinity });
  expect(res.path !== null, 'rute ditemukan');
  expect(res.path!.length === 5, 'panjang jalur 5 = Manhattan 0,3 -> 5,3 (dapat ' + (res.path?.length ?? -1) + ')');
  expect(res.path![res.path!.length - 1] === '5,3', 'sel terakhir = sel tujuan');
  expect(chainValid(res.path!, SRC, blocked), 'rantai jalur ortogonal & bersih');
  expect(!res.overBudget, 'anggaran tak terbatas -> tidak over-budget');
}

console.log('(b) menghindari sel terblokir');
{
  const wall = ['3,1', '3,2', '3,3', '3,4', '3,5'];
  const blocked = new Set([...SRC, ...wall]);
  const res = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: Infinity });
  expect(res.path !== null, 'rute memutar ditemukan');
  expect(res.path!.length > 5, 'panjang jalur ' + res.path!.length + ' > Manhattan 5 (memutar tembok)');
  expect(res.path!.every((c) => !blocked.has(c)), 'tidak ada sel jalur yang terblokir');
  expect(res.path![res.path!.length - 1] === '5,3', 'tetap berakhir di tujuan');
  expect(chainValid(res.path!, SRC, blocked), 'rantai jalur ortogonal & bersih');
}

console.log('(c) tujuan terkurung: tidak ada rute');
{
  const ring = ['4,3', '6,3', '5,2', '5,4'];
  const blocked = new Set([...SRC, ...ring]);
  const res = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: Infinity });
  expect(res.path === null, 'path = null untuk tujuan yang terkurung');
  expect(!res.overBudget, 'tanpa rute -> overBudget tetap false');
}

console.log('(d) over-budget terdeteksi dari rute terpendek');
{
  const blocked = new Set(SRC);
  const over = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: 4 });
  expect(over.path !== null && over.path.length === 5, 'rute terpendek tetap dikembalikan (5 sel)');
  expect(over.overBudget, 'budget 4 < 5 -> overBudget = true');
  const exact = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: 5 });
  expect(exact.path !== null && !exact.overBudget, 'budget 5 = 5 -> overBudget = false');
  const none = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: 0 });
  expect(none.overBudget, 'budget 0 -> overBudget = true');
}

console.log('(e) deterministik: dua panggilan identik');
{
  const wall = ['3,1', '3,2', '3,3', '3,4', '3,5', '7,2', '7,3', '7,4'];
  const blocked = new Set([...SRC, ...wall]);
  const a = findBeltPath({ srcCells: SRC, goalCells: ['9,3'], blocked, budget: Infinity });
  const b = findBeltPath({ srcCells: SRC, goalCells: ['9,3'], blocked, budget: Infinity });
  expect(a.path !== null && b.path !== null, 'kedua panggilan menemukan rute');
  expect(a.path!.join(' ') === b.path!.join(' '), 'jalur kedua panggilan persis sama');
}

console.log('(f) mesin bersebelahan langsung: jalur kosong sah');
{
  const res = findBeltPath({
    srcCells: SRC,
    goalCells: [],
    directCells: ['1,3'],
    blocked: new Set(SRC),
    budget: Infinity,
  });
  expect(res.path !== null && res.path.length === 0, 'sumber menempel tujuan -> path = []');
  expect(!res.overBudget, 'jalur kosong tidak over-budget');
}

console.log('(g) doorstep mesin target lewat beltGoalCells');
{
  const outCells = footprintCells('OUT', {});
  const blocked = new Set([...SRC, ...outCells]);
  const goals = beltGoalCells(outCells, blocked);
  expect(goals.length > 0, 'ada sel doorstep di sekeliling OUTPUT');
  expect(goals.every((c) => !blocked.has(c)), 'doorstep tidak memuat sel terblokir/footprint');
  const res = findBeltPath({ srcCells: SRC, goalCells: goals, directCells: outCells, blocked, budget: Infinity });
  expect(res.path !== null && res.path.length === 9, 'rute ke doorstep OUTPUT = 9 sel (dapat ' + (res.path?.length ?? -1) + ')');
  const last = res.path![res.path!.length - 1];
  expect(outCells.some((oc) => cellsAdjacent(oc, last)), 'sel terakhir menempel footprint OUTPUT');
}

console.log('(h) sel tujuan yang terblokir tidak bisa dimasuki');
{
  const blocked = new Set([...SRC, '5,3']);
  const res = findBeltPath({ srcCells: SRC, goalCells: ['5,3'], blocked, budget: Infinity });
  expect(res.path === null, 'tujuan terblokir -> path = null');
}

console.log(failures === 0 ? 'SEMUA LULUS' : failures + ' KEGAGALAN');
process.exit(failures === 0 ? 0 : 1);
