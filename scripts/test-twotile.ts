// Unit tests for the two-tile machine fix (v4.7).
// Perbaikan A: a 2x1 machine (BUFFER / SORT / OUTPUT / MERGE) connects
// through BOTH of its tiles — a belt may enter through a doorstep of either
// tile, and a belt out of it departs from the tile the player actually held
// (heldTileOf + findBeltPath with the held tile as the only origin).
// Perbaikan B: the white port boxes are gone from the board code and CSS,
// while the SPLIT port markers and the routing dots stay.
// Run: npx tsx scripts/test-twotile.ts
import { readFileSync } from 'node:fs';
import {
  beltGoalCells,
  cellCenter,
  cellsAdjacent,
  dragBegin,
  dragFinish,
  findBeltPath,
  footprintCells,
  heldTileOf,
} from '../src/geometry';
import type { DragHover } from '../src/geometry';
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

function shares(a: string[], b: string[]): string[] {
  const s = new Set(b);
  return a.filter((c) => s.has(c));
}

/** Board-style blocked set: every machine footprint plus extra occupied cells. */
function blockedFor(placed: Record<string, NodeDef>, extra: string[] = []): Set<string> {
  const blocked = new Set<string>(extra);
  for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, placed).forEach((c) => blocked.add(c));
  Object.keys(placed).forEach((k) => footprintCells(k, placed).forEach((c) => blocked.add(c)));
  return blocked;
}

console.log('(a) BUFFER: sisi keluar tile pertama terhalang -> hold tile kedua berangkat dari tile kedua');
{
  const placed: Record<string, NodeDef> = { '4,2': { type: 'tahan', size: 3 } };
  const bufCells = footprintCells('4,2', placed);
  expect(bufCells.join(' ') === '4,2 5,2', 'footprint BUFFER = 4,2 + 5,2 (dapat ' + bufCells.join(' ') + ')');

  // The held tile follows the press: on tile 2's centre -> tile 2; on tile
  // 1's centre -> tile 1; a press on the sprite overhang above tile 2
  // (projection outside the footprint) falls to the nearest tile.
  expect(heldTileOf(bufCells, cellCenter('5,2')) === '5,2', 'tekan di pusat tile kedua -> tile kedua');
  expect(heldTileOf(bufCells, cellCenter('4,2')) === '4,2', 'tekan di pusat tile pertama -> tile pertama');
  const c2 = cellCenter('5,2');
  expect(heldTileOf(bufCells, { x: c2.x, y: c2.y - 40 }) === '5,2', 'tekan di overhang sprite di atas tile kedua -> tile terdekat (kedua)');

  // Every exit of tile 1 is walled off (its east neighbour is tile 2 itself).
  const blocked = blockedFor(placed, ['3,2', '4,1', '4,3']);
  const fromTile1 = findBeltPath({ srcCells: ['4,2'], goalCells: ['7,2'], blocked, budget: Infinity });
  expect(fromTile1.path === null, 'asal tile pertama (terhalang) -> tidak ada rute, TIDAK meminjam tile kedua');
  const fromTile2 = findBeltPath({ srcCells: ['5,2'], goalCells: ['7,2'], blocked, budget: Infinity });
  expect(fromTile2.path !== null && fromTile2.path.join(' ') === '6,2 7,2', 'asal tile kedua -> rute 6,2 7,2 (dapat ' + (fromTile2.path ?? []).join(' ') + ')');
  expect(
    fromTile2.path !== null && cellsAdjacent('5,2', fromTile2.path[0]) && !cellsAdjacent('4,2', fromTile2.path[0]),
    'sel pertama berangkat dari tepi tile kedua, bukan tile pertama',
  );
}

console.log('(b) belt masuk lewat doorstep tile kedua ter-commit');
{
  // The real OUTPUT: with tile 1's doorsteps occupied, the goal set is
  // exactly tile 2's doorsteps — they ARE offered as belt targets.
  const placed: Record<string, NodeDef> = {};
  const outCells = footprintCells('OUT', placed);
  expect(outCells.join(' ') === '10,3 11,3', 'footprint OUTPUT = 10,3 + 11,3');
  const blockedOut = blockedFor(placed, ['9,3', '10,2', '10,4']);
  const goalsOut = beltGoalCells(outCells, blockedOut);
  expect(
    goalsOut.length === 2 && goalsOut.every((g) => cellsAdjacent(g, '11,3') && !cellsAdjacent(g, '10,3')),
    'goal OUTPUT hanya doorstep tile kedua (dapat ' + goalsOut.join(' ') + ')',
  );

  // End-to-end on an open-space 2-tile machine (SORT at 5,2): tile 1's
  // doorsteps are all occupied, so the belt must end on tile 2's doorstep
  // and commit. (On the real board, OUT's tile-2 doorsteps are only
  // reachable through 10,2 / 10,4 — A's and B's footprints fence the rest —
  // so the commit is proven here where the approach corridor exists.)
  const placed2: Record<string, NodeDef> = { '5,2': { type: 'sort', order: ['R', 'B', 'G'] } };
  const sortCells = footprintCells('5,2', placed2);
  const blocked = blockedFor(placed2, ['4,2', '5,1', '5,3']);
  const goals = beltGoalCells(sortCells, blocked);
  expect(
    goals.length === 3 && goals.every((g) => cellsAdjacent(g, '6,2') && !cellsAdjacent(g, '5,2')),
    'goal SORT hanya doorstep tile kedua (dapat ' + goals.join(' ') + ')',
  );
  const res = findBeltPath({ srcCells: ['0,3'], goalCells: goals, directCells: sortCells, blocked, budget: Infinity });
  expect(res.path !== null && res.path.length > 0, 'rute ke SORT ditemukan');
  if (res.path) {
    const end = res.path[res.path.length - 1];
    expect(cellsAdjacent(end, '6,2') && !cellsAdjacent(end, '5,2'), 'rute berakhir di doorstep tile kedua (' + end + ')');
    const ctx = dragBegin({}, 'IN:0', '0,3', null, ['0,3']);
    ctx.path = [...res.path];
    const hover: DragHover = {
      machineId: '5,2',
      targets: {
        '5,2': { cell: '5,2', cells: sortCells, hasIn: true },
        IN: { cell: '0,3', cells: ['0,3'], hasIn: false },
      },
      srcId: 'IN',
    };
    expect(dragFinish(ctx, hover) === '5,2', 'dragFinish commit ke SORT lewat doorstep tile kedua');
  }
}

console.log('(c) dua masukan MERGE masuk lewat dua tile berbeda');
{
  const placed: Record<string, NodeDef> = { '5,2': { type: 'merge', to: 'G' } };
  const mergeCells = footprintCells('5,2', placed);
  expect(mergeCells.join(' ') === '5,2 6,2', 'footprint MERGE = 5,2 + 6,2');
  const tile1Doors = ['4,2', '5,1', '5,3'];
  const tile2Doors = ['7,2', '6,1', '6,3'];

  // Input A comes from INPUT in the west and lands on a tile-1 doorstep.
  const blockedA = blockedFor(placed);
  const resA = findBeltPath({
    srcCells: ['0,3'],
    goalCells: beltGoalCells(mergeCells, blockedA),
    directCells: mergeCells,
    blocked: blockedA,
    budget: Infinity,
  });
  expect(resA.path !== null && resA.path.length > 0, 'masukan A mendapat rute ke MERGE');
  const endA = resA.path![resA.path!.length - 1];
  expect(tile1Doors.indexOf(endA) >= 0 && !cellsAdjacent(endA, '6,2'), 'masukan A berakhir di doorstep tile pertama (' + endA + ')');

  // Input B comes from the east; A's committed belt now blocks its cells.
  const blockedB = blockedFor(placed, [...resA.path!]);
  const resB = findBeltPath({
    srcCells: ['9,2'],
    goalCells: beltGoalCells(mergeCells, blockedB),
    directCells: mergeCells,
    blocked: blockedB,
    budget: Infinity,
  });
  expect(resB.path !== null && resB.path.length > 0, 'masukan B mendapat rute ke MERGE');
  const endB = resB.path![resB.path!.length - 1];
  expect(tile2Doors.indexOf(endB) >= 0 && !cellsAdjacent(endB, '5,2'), 'masukan B berakhir di doorstep tile kedua (' + endB + ')');
  expect(shares(resA.path!, resB.path!).length === 0, 'dua masukan tidak berbagi satu sel pun');

  // Both commit to the same MERGE machine, independently.
  const targets: DragHover['targets'] = {
    '5,2': { cell: '5,2', cells: mergeCells, hasIn: true },
    IN: { cell: '0,3', cells: ['0,3'], hasIn: false },
  };
  const ctxA = dragBegin({}, 'IN:0', '0,3', null, ['0,3']);
  ctxA.path = [...resA.path!];
  expect(dragFinish(ctxA, { machineId: '5,2', targets, srcId: 'IN' }) === '5,2', 'masukan A commit ke MERGE');
  const ctxB = dragBegin({}, '9,2:0', '9,2', null, ['9,2']);
  ctxB.path = [...resB.path!];
  expect(dragFinish(ctxB, { machineId: '5,2', targets, srcId: '9,2' }) === '5,2', 'masukan B commit ke MERGE yang sama lewat tile kedua');
}

console.log('(d) kotak putih port hilang total, penanda SPLIT + titik routing tetap ada');
{
  const board = readFileSync(new URL('../src/components/Board.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  expect(!board.includes('className="port"'), 'Board tidak lagi merender elemen kelas "port"');
  expect(!board.includes('"port"'), 'Board tidak mengandung string "port" sama sekali');
  expect(!/^\.port\s*\{/m.test(css), 'CSS tidak lagi punya aturan .port');
  expect(!css.includes('.port-hit'), 'CSS tidak lagi punya aturan .port-hit');
  expect(board.includes('port-marker') && css.includes('.port-marker'), 'penanda port SPLIT (port-marker) tetap ada');
  expect(board.includes('route-dots') && css.includes('.route-dot'), 'titik routing SPLIT (route-dots) tetap ada');
}

if (failures) {
  console.log('\n' + failures + ' kegagalan');
  process.exit(1);
}
console.log('\nSemua uji two-tile lulus.');
