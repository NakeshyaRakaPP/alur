// Unit tests for the SPLIT exit rule (v6.6): a port is a physical side of
// the machine. A belt out of a SPLIT always starts on its port's own exit
// cell (port 0 north, port 1 south, port 2 east) and only then takes the
// shortest legal route — the router may never sneak a port's belt out of
// another side because that route is shorter.
// Run: npx tsx scripts/test-split-exit.ts
import { cellsAdjacent, findSplitExitPath, splitExitCell } from '../src/geometry';
import type { PortIdx } from '../src/types';

let failures = 0;

function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok: ' + msg);
  } else {
    failures++;
    console.log('  GAGAL: ' + msg);
  }
}

function legalWalk(path: string[]): boolean {
  for (let i = 1; i < path.length; i++) if (!cellsAdjacent(path[i - 1], path[i])) return false;
  return new Set(path).size === path.length;
}

const ANCHOR = '5,3';
const NO_BLOCK = new Set<string>();

console.log('== Sel keluar port ==');
expect(splitExitCell(ANCHOR, 0) === '5,2', 'port 0 (atas) keluar ke sel utara');
expect(splitExitCell(ANCHOR, 1) === '5,4', 'port 1 (bawah) keluar ke sel selatan');
expect(splitExitCell(ANCHOR, 2) === '6,3', 'port 2 (samping) keluar ke sel timur');
expect(splitExitCell('5,0', 0) === null, 'port atas di baris teratas: tidak ada sel keluar');

console.log('== Langkah pertama selalu sel port-nya ==');
{
  const res = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,0'], blocked: NO_BLOCK, budget: Infinity });
  expect(res.path !== null && res.path[0] === '5,2', 'belt port atas mulai di sel utara');
  expect(res.path !== null && res.path[res.path.length - 1] === '5,0' && res.path.length === 3, 'rute lurus ke tujuan: 3 sel');
  expect(res.path !== null && legalWalk(res.path), 'jalur legal (ortogonal, tanpa pengulangan)');
}
{
  // Tujuan di timur, port yang digambar port atas: rute bebas akan keluar
  // langsung ke timur (3 sel); aturan baru memaksa keluar utara dulu.
  const res = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['8,3'], blocked: NO_BLOCK, budget: Infinity });
  expect(res.path !== null && res.path[0] === '5,2', 'tujuan di timur pun belt port atas tetap keluar utara dulu');
  expect(res.path !== null && res.path.length > 3, 'rute memutar lebih panjang dari rute bebas (bukti sisi dikunci)');
  expect(res.path !== null && res.path[res.path.length - 1] === '8,3' && legalWalk(res.path), 'tetap sampai tujuan dengan jalur legal');
}

console.log('== Kasus tepi ==');
{
  const blocked = new Set(['5,2']);
  const res = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,0'], blocked, budget: Infinity });
  expect(res.path === null, 'sel keluar terhalang: port tidak bisa digambar (null)');
}
{
  const res = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,1'], directCells: ['5,2'], blocked: NO_BLOCK, budget: Infinity });
  expect(res.path !== null && res.path.length === 0, 'mesin tujuan persis di sel keluar port: jalur kosong (langsung)');
}
{
  const res = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,2'], blocked: NO_BLOCK, budget: Infinity });
  expect(res.path !== null && res.path.length === 1 && res.path[0] === '5,2', 'tujuan = sel keluar itu sendiri: jalur 1 sel');
}
{
  const over = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,0'], blocked: NO_BLOCK, budget: 2 });
  expect(over.path !== null && over.path.length === 3 && over.overBudget, 'anggaran 2 untuk rute 3 sel: tetap ditunjukkan tapi overBudget');
  const fit = findSplitExitPath({ anchor: ANCHOR, port: 0, goalCells: ['5,0'], blocked: NO_BLOCK, budget: 3 });
  expect(fit.path !== null && !fit.overBudget, 'anggaran 3: pas, tidak overBudget');
}
{
  // Port samping (timur) menuju target di barat: harus keluar timur dulu,
  // memutar, dan tidak boleh menembus badan mesinnya sendiri.
  const res = findSplitExitPath({ anchor: ANCHOR, port: 2 as PortIdx, goalCells: ['3,3'], blocked: NO_BLOCK, budget: Infinity });
  expect(res.path !== null && res.path[0] === '6,3', 'port samping keluar timur dulu walau tujuan di barat');
  expect(res.path !== null && !res.path.includes(ANCHOR), 'jalur tidak menembus mesin sumber');
  expect(res.path !== null && res.path[res.path.length - 1] === '3,3' && legalWalk(res.path), 'sampai di barat dengan jalur legal');
}

console.log('');
if (failures > 0) {
  console.log('HASIL: ' + failures + ' kegagalan.');
  process.exit(1);
}
console.log('HASIL: semua uji exit SPLIT lulus.');
