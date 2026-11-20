import { simulate } from '../src/engine';
import type { ColorCode, Conns, Level, NodeDef, OutputId } from '../src/types';

let failures = 0;

function fail(msg: string) {
  failures++;
  console.log('  GAGAL: ' + msg);
}

function ok(msg: string) {
  console.log('  OK — ' + msg);
}

function colorsOf(arrivals: Partial<Record<OutputId, { color: ColorCode }[]>>, out: OutputId) {
  return (arrivals[out] ?? []).map((a) => a.color);
}

function sameSeq(a: ColorCode[], b: ColorCode[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

function fakeLevel(partial: Partial<Level>): Level {
  return {
    id: 'synthetic',
    chapter: 4,
    name: 'Synthetic',
    brief: '',
    briefId: '',
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

async function runSim(level: Level, placements: Record<string, NodeDef>, connections: Conns) {
  return simulate(level, placements, connections, { emit: async () => {} });
}

// Satu SPLIT di 3,3; port 0 -> A, port 1 -> OUT, port 2 -> B.
function layout(splitDef: NodeDef): { placements: Record<string, NodeDef>; conns: Conns } {
  return {
    placements: { '3,3': splitDef },
    conns: {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: 'A', path: ['3,2', '3,1'] },
      '3,3:1': { to: 'OUT', path: ['3,4', '3,5'] },
      '3,3:2': { to: 'B', path: ['4,3', '5,3'] },
    },
  };
}

const OUTPUTS: OutputId[] = ['OUT', 'A', 'B'];

async function main() {
  console.log('Menguji routing SPLIT yang bisa diatur pemain...\n');

  // 0) Paritas bawaan: def tanpa route == def dengan route eksplisit bawaan.
  {
    const level = fakeLevel({ stream: ['G', 'R', 'B', 'G', 'R', 'B'], outputs: OUTPUTS });
    const plain = layout({ type: 'split', color: 'G', side: 'R' });
    const explicit = layout({
      type: 'split',
      color: 'G',
      side: 'R',
      route: { byColor: { G: 0, R: 2 }, other: 1 },
    });
    const a = await runSim(level, plain.placements, plain.conns);
    const b = await runSim(level, explicit.placements, explicit.conns);
    const same = OUTPUTS.every((o) => sameSeq(colorsOf(a.arrivals, o), colorsOf(b.arrivals, o)));
    if (
      same &&
      sameSeq(colorsOf(a.arrivals, 'A'), ['G', 'G']) &&
      sameSeq(colorsOf(a.arrivals, 'B'), ['R', 'R']) &&
      sameSeq(colorsOf(a.arrivals, 'OUT'), ['B', 'B'])
    ) {
      ok('routing bawaan (tanpa route) persis perilaku lama: G->UP, R->SIDE, sisa->DOWN.');
    } else {
      fail('paritas bawaan: arrivals plain vs eksplisit berbeda atau tidak sesuai pola lama');
    }
  }

  // (a) Mengubah routing satu warna dari UP ke DOWN memindahkan keluarnya.
  {
    const level = fakeLevel({ stream: ['G', 'R'], outputs: OUTPUTS, target: { OUT: ['G', 'R'] } });
    const defRun = layout({ type: 'split', color: 'G' });
    const defRes = await runSim(level, defRun.placements, defRun.conns);
    const routed = layout({ type: 'split', color: 'G', route: { byColor: { G: 1 }, other: 1 } });
    const routedRes = await runSim(level, routed.placements, routed.conns);
    if (
      sameSeq(colorsOf(defRes.arrivals, 'A'), ['G']) &&
      sameSeq(colorsOf(defRes.arrivals, 'OUT'), ['R']) &&
      defRes.verdict.kind !== 'win' &&
      sameSeq(colorsOf(routedRes.arrivals, 'OUT'), ['G', 'R']) &&
      colorsOf(routedRes.arrivals, 'A').length === 0 &&
      routedRes.verdict.kind === 'win'
    ) {
      ok('(a) G dipindah UP->DOWN: token G keluar port DOWN, verdict berubah mismatch -> win.');
    } else {
      fail(
        '(a) ubah routing: bawaan A=' + JSON.stringify(colorsOf(defRes.arrivals, 'A')) +
          ' OUT=' + JSON.stringify(colorsOf(defRes.arrivals, 'OUT')) +
          '; diatur OUT=' + JSON.stringify(colorsOf(routedRes.arrivals, 'OUT')) +
          ' verdict=' + routedRes.verdict.kind,
      );
    }
  }

  // (b) Warna tak terdaftar mengikuti entri "Any other color".
  {
    const level = fakeLevel({ stream: ['B'], outputs: OUTPUTS });
    const { placements, conns } = layout({
      type: 'split',
      color: 'G',
      route: { byColor: { G: 0 }, other: 2 },
    });
    const res = await runSim(level, placements, conns);
    if (sameSeq(colorsOf(res.arrivals, 'B'), ['B']) && colorsOf(res.arrivals, 'OUT').length === 0) {
      ok('(b) warna tak terdaftar (B) mengikuti "Any other color" -> port SIDE.');
    } else {
      fail('(b) other: B arrivals=' + JSON.stringify(colorsOf(res.arrivals, 'B')));
    }
  }

  // (c) Dua warna berbagi satu port.
  {
    const level = fakeLevel({ stream: ['R', 'B', 'G'], outputs: OUTPUTS });
    const { placements, conns } = layout({
      type: 'split',
      color: 'R',
      route: { byColor: { R: 0, B: 0 }, other: 1 },
    });
    const res = await runSim(level, placements, conns);
    if (sameSeq(colorsOf(res.arrivals, 'A'), ['R', 'B']) && sameSeq(colorsOf(res.arrivals, 'OUT'), ['G'])) {
      ok('(c) R dan B berbagi port UP: keduanya keluar dari port yang sama.');
    } else {
      fail(
        '(c) berbagi port: A=' + JSON.stringify(colorsOf(res.arrivals, 'A')) +
          ' OUT=' + JSON.stringify(colorsOf(res.arrivals, 'OUT')),
      );
    }
  }

  // (d) Routing instance hilang saat mesin dihapus: def yang sama setelah
  // field route dibuang (operasi yang sama dengan unplace di GameScreen)
  // kembali berperilaku bawaan.
  {
    const level = fakeLevel({ stream: ['G', 'R'], outputs: OUTPUTS });
    const routedDef: NodeDef = { type: 'split', color: 'G', route: { byColor: { G: 1 }, other: 1 } };
    const withRoute = layout(routedDef);
    const routedRes = await runSim(level, withRoute.placements, withRoute.conns);
    const cleanDef: NodeDef = { ...routedDef };
    delete cleanDef.route;
    const clean = layout(cleanDef);
    const cleanRes = await runSim(level, clean.placements, clean.conns);
    if (
      sameSeq(colorsOf(routedRes.arrivals, 'OUT'), ['G', 'R']) &&
      sameSeq(colorsOf(cleanRes.arrivals, 'A'), ['G']) &&
      sameSeq(colorsOf(cleanRes.arrivals, 'OUT'), ['R'])
    ) {
      ok('(d) route dibuang (mesin dihapus) -> routing kembali bawaan level.');
    } else {
      fail('(d) buang route: arrivals=' + JSON.stringify(cleanRes.arrivals));
    }
  }

  console.log('');
  if (failures > 0) {
    console.log('HASIL: ' + failures + ' kegagalan.');
    process.exit(1);
  }
  console.log('HASIL: semua uji routing SPLIT lulus.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
