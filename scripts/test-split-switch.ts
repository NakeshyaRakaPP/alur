// Unit tests for the SPLIT 3-port selection + open-ended trail commit (v4.4).
// Exercises the exact pure helpers Board.tsx composes during a drag:
//   pickSplitPort3  — pointer direction sector -> port 0/1/2 (preselection)
//   splitLivePort3  — live sector selection while the preview is empty
//   splitDragReset  — dragging back into the source footprint clears the path
//   dragOpenEnd     — releasing on an empty cell commits an open-ended trail
//   dragBegin / dragExtend / dragFinish — the drag core + commit
// Run: npx tsx scripts/test-split-switch.ts
import {
  SPLIT_PORT_ANGLES,
  dragBegin,
  dragExtend,
  dragFinish,
  dragOpenEnd,
  footprintCells,
  pickSplitPort3,
  splitDragReset,
  splitLivePort3,
} from '../src/geometry';
import type { DragHover } from '../src/geometry';
import type { Conns } from '../src/types';

let failures = 0;

function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok: ' + msg);
  } else {
    failures++;
    console.log('  GAGAL: ' + msg);
  }
}

// A SPLIT standing on cell 5,3 (footprint 1x1). Its three out ports leave by
// the sprite's three belt ends: port 0 north (up-right on screen), port 1
// south (down-left), port 2 east (down-right).
const SPLIT = '5,3';
const SRC_CELLS = footprintCells(SPLIT, { [SPLIT]: { type: 'split', color: 'G' } });
const [A0, A1, A2] = SPLIT_PORT_ANGLES;
const NONE: [boolean, boolean, boolean] = [false, false, false];
// 80 degrees sits in the dead band between the SIDE (26.6) and DOWN (153.4)
// sector axes: over 40 degrees away from every axis.
const DEAD = 80;

// Blocked set the way Board builds it: machine footprints (source + a target
// machine at 7,3) may not be entered by belt cells.
const TARGET = '7,3';
const BLOCKED = new Set<string>([...SRC_CELLS, TARGET]);

console.log('(a) jalur kosong: port aktif mengikuti sektor arah pointer secara live');
expect(pickSplitPort3(NONE, A0, 60, -1) === 0, 'arah port 0 (utara) -> port 0');
expect(pickSplitPort3(NONE, A2, 60, -1) === 2, 'arah port 2 (timur) -> port 2');
expect(pickSplitPort3(NONE, A1, 60, -1) === 1, 'arah port 1 (selatan) -> port 1');
// Live following: no re-hold needed to move between any of the three ports.
let port: 0 | 1 | 2 = pickSplitPort3(NONE, A0, 60, -1);
port = splitLivePort3(0, NONE, A1, 60, port);
expect(port === 1, 'pointer pindah ke sektor selatan (jalur kosong) -> port aktif 1');
port = splitLivePort3(0, NONE, A2, 60, port);
expect(port === 2, 'pointer pindah ke sektor timur -> port aktif 2');
port = splitLivePort3(0, NONE, A0, 60, port);
expect(port === 0, 'pointer kembali ke sektor utara -> port aktif 0 lagi');
// Preselection: with port 0 taken, a press in the dead band picks the
// angularly nearest free port (SIDE), not the taken one.
expect(
  pickSplitPort3([true, false, false], DEAD, 60, -1) === 2,
  'port 0 terisi + tekan di pita mati -> praseleksi port kosong terdekat (2)',
);
// With two ports taken, the single free port is preselected from the dead band.
expect(
  pickSplitPort3([true, true, false], DEAD, 60, -1) === 2,
  'port 0+1 terisi + pita mati -> praseleksi satu-satunya port kosong (2)',
);
// ...but pressing deep inside the taken port's own sector is a deliberate redraw.
expect(
  pickSplitPort3([true, false, false], A0, 60, -1) === 0,
  'port 0 terisi + tekan tepat di sumbu port 0 -> gambar ulang port 0',
);
// Pressing in the taken port's outer sector (not deep) falls to the nearest free port.
expect(
  pickSplitPort3([true, false, false], A0 + 30, 60, -1) === 2,
  'port 0 terisi + tekan di tepi luar sektornya -> port kosong terdekat (2)',
);
// Pointer basically on the anchor carries no direction: the current port stays.
expect(pickSplitPort3(NONE, A0, 5, 2) === 2, 'pointer menempel anchor -> port saat ini dipertahankan');
// Once a belt cell exists, live selection is locked to the session port.
expect(splitLivePort3(2, NONE, A1, 60, 0) === 0, 'jalur sudah 2 sel -> ganti sektor TIDAK mengganti port');
expect(splitLivePort3(1, NONE, A2, 60, 1) === 1, 'jalur sudah 1 sel -> port 1 terkunci juga');

console.log('(b) gambar port 0 -> seret balik ke footprint SPLIT -> jalur bersih -> keluar sektor lain');
{
  const conns: Conns = {};
  let active: 0 | 1 | 2 = pickSplitPort3(NONE, A0, 60, -1);
  let srcKey = SPLIT + ':' + active;
  let ctx = dragBegin(conns, srcKey, SPLIT, null, SRC_CELLS);
  expect(dragExtend(ctx, '5,2', BLOCKED), 'sel pertama port 0 diletakkan (5,2)');
  expect(dragExtend(ctx, '5,1', BLOCKED), 'sel kedua port 0 diletakkan (5,1)');
  expect(ctx.path.length === 2, 'jalur belum ter-commit berisi 2 sel');

  // Negative reset cases first: none of these may clear a path.
  expect(!splitDragReset(false, ctx.path.length, SPLIT, SRC_CELLS), 'sumber bukan SPLIT -> tidak reset');
  expect(!splitDragReset(true, 0, SPLIT, SRC_CELLS), 'jalur kosong -> tidak reset');
  expect(!splitDragReset(true, ctx.path.length, '5,4', SRC_CELLS), 'sel di luar footprint -> tidak reset');
  expect(!splitDragReset(true, ctx.path.length, null, SRC_CELLS), 'pointer di luar papan -> tidak reset');

  // The switch gesture: pointer re-enters the source footprint mid-drag.
  expect(splitDragReset(true, ctx.path.length, SPLIT, SRC_CELLS), 'pointer kembali ke footprint SPLIT -> reset berlaku');
  ctx.path.length = 0; // Board clears the uncommitted path here
  expect(ctx.path.length === 0, 'jalur yang belum ter-commit dibersihkan');

  // Session is back in live selection; walking out the south sector picks port 1.
  active = splitLivePort3(ctx.path.length, NONE, A1, 60, active);
  expect(active === 1, 'keluar lewat sektor selatan -> port aktif 1');
  srcKey = SPLIT + ':' + active;
  ctx = dragBegin(conns, srcKey, SPLIT, null, SRC_CELLS);
  expect(dragExtend(ctx, '5,4', BLOCKED), 'sel pertama port 1 diletakkan (5,4)');
  expect(dragExtend(ctx, '5,5', BLOCKED), 'sel kedua port 1 diletakkan (5,5)');
  expect(ctx.path.join(' ') === '5,4 5,5', 'jalur baru sepenuhnya milik sesi port 1');

  // And the third port draws east like any other.
  const ctx2 = dragBegin(conns, SPLIT + ':2', SPLIT, null, SRC_CELLS);
  expect(dragExtend(ctx2, '6,3', BLOCKED), 'sel pertama port 2 diletakkan (6,3)');
  expect(ctx2.path.join(' ') === '6,3', 'jalur port 2 bersih dari sesi port lain');
  expect(Object.keys(conns).length === 0, 'belum ada yang ter-commit selama sesi berjalan');
}

console.log('(c) commit ke mesin + commit trail terbuka di sel kosong');
{
  const conns: Conns = {};
  const active: 0 | 1 | 2 = 1;
  const srcKey = SPLIT + ':' + active;
  const ctx = dragBegin(conns, srcKey, SPLIT, null, SRC_CELLS);
  expect(dragExtend(ctx, '6,3', BLOCKED), 'sel port 1 menuju target diletakkan (6,3)');
  const hover: DragHover = {
    machineId: TARGET,
    targets: {
      [TARGET]: { cell: TARGET, cells: [TARGET], hasIn: true },
      [SPLIT]: { cell: SPLIT, cells: SRC_CELLS, hasIn: true },
    },
    srcId: SPLIT,
  };
  const target = dragFinish(ctx, hover);
  expect(target === TARGET, 'dragFinish menemukan mesin target');
  if (target) conns[srcKey] = { to: target, path: [...ctx.path] };
  const snapshot = JSON.stringify(conns);
  // Pointer keeps moving across all sectors after the commit: selection is a
  // pure read over conns, so nothing about the committed belt may change.
  for (const a of [A0, A1, A2, DEAD]) {
    splitLivePort3(0, [!!conns[SPLIT + ':0'], !!conns[SPLIT + ':1'], !!conns[SPLIT + ':2']], a, 60, active);
    pickSplitPort3([!!conns[SPLIT + ':0'], !!conns[SPLIT + ':1'], !!conns[SPLIT + ':2']], a, 60, -1);
  }
  expect(JSON.stringify(conns) === snapshot, 'conns tidak berubah oleh gerakan pointer pasca-commit');
  expect(conns[SPLIT + ':1']?.path.join(' ') === '6,3', 'belt ter-commit tetap di port 1 dengan jalur aslinya');
  expect(!(SPLIT + ':0' in conns) && !(SPLIT + ':2' in conns), 'tidak ada belt port lain yang tercipta diam-diam');

  // Open-ended commit: same path, but the pointer is released over the
  // path's own end cell with no machine under it.
  const open = dragBegin({}, SPLIT + ':0', SPLIT, null, SRC_CELLS);
  expect(dragExtend(open, '6,3', BLOCKED), 'sel trail terbuka diletakkan (6,3)');
  expect(dragOpenEnd(open, '6,3', null, BLOCKED) === '6,3', 'lepas di sel ujung tanpa mesin -> trail terbuka commit');
  expect(dragOpenEnd(open, '6,3', TARGET, BLOCKED) === null, 'mesin di bawah kursor -> bukan trail terbuka');
  expect(dragOpenEnd(open, '6,4', null, BLOCKED) === null, 'sel kursor bukan ujung jalur -> tidak commit');
  expect(dragOpenEnd(open, null, null, BLOCKED) === null, 'kursor di luar papan -> tidak commit');
  expect(dragOpenEnd(open, '6,3', null, new Set(['6,3'])) === null, 'sel ujung terblokir -> tidak commit');
  const empty = dragBegin({}, SPLIT + ':0', SPLIT, null, SRC_CELLS);
  expect(dragOpenEnd(empty, '6,3', null, BLOCKED) === null, 'jalur kosong -> tidak ada trail terbuka');
}

console.log(failures === 0 ? 'SEMUA LULUS' : failures + ' KEGAGALAN');
process.exit(failures === 0 ? 0 : 1);
