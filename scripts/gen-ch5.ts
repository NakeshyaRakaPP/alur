/**
 * Generator Chapter 5 (Master Systems) v6.0: enam level susah dengan
 * solusi utama + alternatif beda arsitektur, di-route memakai auto-path UI
 * dan disimulasikan sampai menang — pola yang sama dengan gen-levels.ts.
 * Keluaran: scripts/gen-out/chapter5.ts + fragmen CFG Expert.
 *
 * Jalankan: npx tsx scripts/gen-ch5.ts
 */
import { simulate } from '../src/engine';
import { beltGoalCells, findBeltPath, footprintCells, railsUsed } from '../src/geometry';
import { nodeKey } from '../src/nodeMeta';
import type { Conns, Level, NodeDef, Solution } from '../src/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Def = NodeDef;
const F = (color: 'R' | 'B' | 'G'): Def => ({ type: 'filter', color });
const T = (to: 'R' | 'B' | 'G'): Def => ({ type: 'transform', to });
const S = (color: 'R' | 'B' | 'G', side?: 'R' | 'B' | 'G'): Def =>
  side ? { type: 'split', color, side } : { type: 'split', color };
const B = (size: number): Def => ({ type: 'tahan', size });
const M = (to: 'R' | 'B' | 'G'): Def => ({ type: 'merge', to });
const SO: Def = { type: 'sort', order: ['R', 'B', 'G'] };

interface Build {
  placements: Record<string, Def>;
  links: [string, string][];
}

interface Ch5Spec {
  meta: Omit<Level, 'par' | 'refRails' | 'railLimit' | 'tray' | 'solution' | 'altSolution' | 'expert'>;
  tray: Def[];
  primary: Build;
  alt: Build;
}

const SPECS: Ch5Spec[] = [
  {
    meta: {
      id: 'c5-1',
      chapter: 5,
      name: 'Two Terminals',
      nameId: 'Dua Terminal',
      brief: '<b>Output A:</b> packs of 2 blue, made from red. <b>Output B:</b> green. Real blue is trash.',
      briefId: '<b>Output A:</b> paket biru isi 2, dari merah. <b>Output B:</b> hijau. Biru asli dibuang.',
      concept: 'Parallel systems — two lines can run side by side without mixing.',
      conceptId: 'Sistem paralel — dua jalur bisa berjalan berdampingan tanpa bercampur.',
      stream: ['R', 'G', 'B', 'R', 'G', 'B', 'R', 'G', 'B', 'R', 'G', 'B'],
      outputs: ['A', 'B'],
      target: { A: ['B', 'B', 'B', 'B'], B: ['G', 'G', 'G', 'G'] },
      packageRule: { A: 2 },
      goalText: 'Target: <b>Output A</b> = 2 packs of 2 Blue (from Red) &nbsp;|&nbsp; <b>Output B</b> = Green × 4',
      goalTextId: 'Target: <b>Output A</b> = 2 paket Biru isi 2 (dari Merah) &nbsp;|&nbsp; <b>Output B</b> = Hijau × 4',
    },
    tray: [S('R', 'G'), T('B'), B(2), F('G'), S('B', 'R')],
    primary: {
      placements: { '3,3': S('R', 'G'), '3,1': T('B'), '7,1': B(2), '3,5': F('G') },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '3,1'], ['3,1:0', '7,1'], ['7,1:0', 'A'],
        ['3,3:1', '3,5'], ['3,3:2', 'B'],
      ],
    },
    alt: {
      placements: { '3,3': S('B', 'R'), '3,1': F('G'), '6,3': T('B'), '8,2': B(2) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '3,1'], ['3,3:2', '6,3'], ['6,3:0', '8,2'],
        ['8,2:0', 'A'], ['3,3:1', 'B'],
      ],
    },
  },
  {
    meta: {
      id: 'c5-2',
      chapter: 5,
      name: 'Flight Rescheduled',
      nameId: 'Penerbangan Dijadwal Ulang',
      brief: 'Pair <b>red + blue</b> → green. Green must become <b>red</b> first.',
      briefId: 'Pasangkan <b>merah + biru</b> → hijau. Hijau harus jadi <b>merah</b> dulu.',
      concept: 'Adaptation — when plans change, a good system reroutes.',
      conceptId: 'Adaptasi — saat rencana berubah, sistem yang baik mengubah rutenya.',
      stream: ['G', 'B', 'G', 'B', 'G', 'B'],
      outputs: ['OUT'],
      target: { OUT: ['G', 'G', 'G'] },
    },
    tray: [S('B'), S('G'), T('R'), M('G')],
    primary: {
      placements: { '3,3': S('B'), '5,5': T('R'), '6,3': M('G') },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '6,3'], ['3,3:1', '5,5'], ['5,5:0', '6,3'], ['6,3:0', 'OUT'],
      ],
    },
    alt: {
      placements: { '3,3': S('G'), '5,1': T('R'), '6,3': M('G') },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '5,1'], ['5,1:0', '6,3'], ['3,3:1', '6,3'], ['6,3:0', 'OUT'],
      ],
    },
  },
  {
    meta: {
      id: 'c5-3',
      chapter: 5,
      name: 'Checked & Carry-On',
      nameId: 'Bagasi & Kabin',
      brief: '<b>Output A:</b> one pack of 3 green. <b>Output B:</b> blue — real blue and red-turned-blue.',
      briefId: '<b>Output A:</b> satu paket hijau isi 3. <b>Output B:</b> biru — biru asli dan merah yang dijadikan biru.',
      concept: 'Mixed rules — one system can hold several contracts at once.',
      conceptId: 'Aturan campuran — satu sistem bisa memegang beberapa aturan sekaligus.',
      stream: ['B', 'R', 'G', 'B', 'R', 'G', 'B', 'R', 'G'],
      outputs: ['A', 'B'],
      target: { A: ['G', 'G', 'G'], B: ['B', 'B', 'B', 'B', 'B', 'B'] },
      packageRule: { A: 3 },
      goalText: 'Target: <b>Output A</b> = 1 pack of 3 Green &nbsp;|&nbsp; <b>Output B</b> = Blue × 6',
      goalTextId: 'Target: <b>Output A</b> = 1 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = Biru × 6',
    },
    tray: [S('G', 'R'), B(3), T('B'), S('G'), S('R')],
    primary: {
      placements: { '4,3': S('G', 'R'), '2,1': B(3), '6,5': T('B') },
      links: [
        ['IN:0', '4,3'], ['4,3:0', '2,1'], ['2,1:0', 'A'], ['4,3:2', '6,5'],
        ['6,5:0', 'B'], ['4,3:1', 'B'],
      ],
    },
    alt: {
      placements: { '4,3': S('G'), '2,1': B(3), '4,5': S('R'), '7,5': T('B') },
      links: [
        ['IN:0', '4,3'], ['4,3:0', '2,1'], ['2,1:0', 'A'], ['4,3:1', '4,5'],
        ['4,5:0', '7,5'], ['7,5:0', 'B'], ['4,5:1', 'B'],
      ],
    },
  },
  {
    meta: {
      id: 'c5-4',
      chapter: 5,
      name: 'Rush Hour',
      nameId: 'Jam Sibuk',
      brief: '<b>Output A:</b> packs of 2 green, made from red. <b>Output B:</b> blue. <b>Output:</b> real green.',
      briefId: '<b>Output A:</b> paket hijau isi 2, dari merah. <b>Output B:</b> biru. <b>Output:</b> hijau asli.',
      concept: 'Cascade — long chains where every step depends on the one before.',
      conceptId: 'Rangkaian — rantai panjang di mana setiap langkah bergantung pada langkah sebelumnya.',
      stream: ['R', 'B', 'G', 'G', 'R', 'B', 'B', 'G', 'R', 'G', 'B', 'R'],
      outputs: ['OUT', 'A', 'B'],
      target: { A: ['G', 'G', 'G', 'G'], B: ['B', 'B', 'B', 'B'], OUT: ['G', 'G', 'G', 'G'] },
      packageRule: { A: 2 },
      goalText:
        'Target: <b>Output A</b> = 2 packs of 2 Green (from Red) &nbsp;|&nbsp; <b>Output B</b> = Blue × 4 &nbsp;|&nbsp; <b>Output</b> = Green × 4',
      goalTextId:
        'Target: <b>Output A</b> = 2 paket Hijau isi 2 (dari Merah) &nbsp;|&nbsp; <b>Output B</b> = Biru × 4 &nbsp;|&nbsp; <b>Output</b> = Hijau × 4',
    },
    tray: [SO, S('R', 'B'), T('G'), B(2)],
    primary: {
      placements: { '3,3': SO, '6,3': S('R', 'B'), '6,1': T('G'), '8,1': B(2) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '6,3'], ['6,3:0', '6,1'], ['6,1:0', '8,1'],
        ['8,1:0', 'A'], ['6,3:1', 'OUT'], ['6,3:2', 'B'],
      ],
    },
    alt: {
      placements: { '3,3': S('R', 'B'), '3,1': T('G'), '7,1': B(2) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '3,1'], ['3,1:0', '7,1'], ['7,1:0', 'A'],
        ['3,3:1', 'OUT'], ['3,3:2', 'B'],
      ],
    },
  },
  {
    meta: {
      id: 'c5-5',
      chapter: 5,
      name: 'Odd Pairs',
      nameId: 'Pasangan Ganjil',
      brief: 'Pairs of <b>red + blue</b> → green, packed by 2. Green is trash.',
      briefId: 'Pasangan <b>merah + biru</b> → hijau, dipaket isi 2. Hijau dibuang.',
      concept: 'Edge cases — real systems always meet leftovers.',
      conceptId: 'Kasus tepi — sistem nyata selalu bertemu sisa-sisa.',
      stream: ['R', 'R', 'B', 'G', 'R', 'B', 'G', 'B', 'R', 'B'],
      outputs: ['OUT'],
      target: { OUT: ['G', 'G', 'G', 'G'] },
      packageRule: { OUT: 2 },
      goalText: 'Target: <b>Output</b> = 2 packs of 2 Green (Red + Blue pairs)',
      goalTextId: 'Target: <b>Output</b> = 2 paket Hijau isi 2 (pasangan Merah + Biru)',
    },
    tray: [S('G', 'R'), F('B'), M('G'), B(2), S('R', 'B'), F('R')],
    primary: {
      placements: { '3,3': S('G', 'R'), '4,1': F('B'), '6,3': M('G'), '8,3': B(2) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '4,1'], ['3,3:2', '6,3'], ['3,3:1', '6,3'],
        ['6,3:0', '8,3'], ['8,3:0', 'OUT'],
      ],
    },
    alt: {
      placements: { '3,3': S('R', 'B'), '3,5': F('R'), '6,3': M('G'), '8,3': B(2) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '6,3'], ['3,3:1', '3,5'], ['3,3:2', '6,3'],
        ['6,3:0', '8,3'], ['8,3:0', 'OUT'],
      ],
    },
  },
  {
    meta: {
      id: 'c5-6',
      chapter: 5,
      name: 'The Whole Airport',
      nameId: 'Seluruh Bandara',
      brief: '<b>Output A:</b> packs of 3 green. <b>Output B:</b> one pack of 3 blue, made from red + blue pairs.',
      briefId: '<b>Output A:</b> paket hijau isi 3. <b>Output B:</b> satu paket biru isi 3, dari pasangan merah + biru.',
      concept: 'The whole system — you just modeled a whole working airport.',
      conceptId: 'Sistem utuh — kamu baru saja memodelkan satu bandara yang bekerja utuh.',
      stream: ['G', 'R', 'G', 'B', 'G', 'R', 'G', 'B', 'G', 'R', 'G', 'B'],
      outputs: ['A', 'B'],
      target: { A: ['G', 'G', 'G', 'G', 'G', 'G'], B: ['B', 'B', 'B'] },
      packageRule: { A: 3, B: 3 },
      goalText:
        'Target: <b>Output A</b> = 2 packs of 3 Green &nbsp;|&nbsp; <b>Output B</b> = 1 pack of 3 Blue (Red + Blue pairs)',
      goalTextId:
        'Target: <b>Output A</b> = 2 paket Hijau isi 3 &nbsp;|&nbsp; <b>Output B</b> = 1 paket Biru isi 3 (pasangan Merah + Biru)',
    },
    tray: [S('G', 'R'), B(3), M('B'), B(3), S('G'), S('R')],
    primary: {
      placements: { '3,3': S('G', 'R'), '3,1': B(3), '6,4': M('B'), '8,5': B(3) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '3,1'], ['3,1:0', 'A'], ['3,3:2', '6,4'],
        ['3,3:1', '6,4'], ['6,4:0', '8,5'], ['8,5:0', 'B'],
      ],
    },
    alt: {
      placements: { '3,3': S('G'), '3,1': B(3), '4,5': S('R'), '6,5': M('B'), '8,5': B(3) },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '3,1'], ['3,1:0', 'A'], ['3,3:1', '4,5'],
        ['4,5:0', '6,5'], ['4,5:1', '6,5'], ['6,5:0', '8,5'], ['8,5:0', 'B'],
      ],
    },
  },
];

function buildConns(
  label: string,
  placements: Record<string, Def>,
  links: [string, string][],
  railBudget: number,
): { conns: Conns; rails: number } {
  const machineCells = new Set<string>();
  for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, placements).forEach((c) => machineCells.add(c));
  for (const anchor of Object.keys(placements)) {
    footprintCells(anchor, placements).forEach((c) => machineCells.add(c));
  }
  const built: Conns = {};
  let used = 0;
  for (const [key, to] of links) {
    const srcId = key.split(':')[0];
    const blocked = new Set<string>(machineCells);
    for (const c2 of Object.values(built)) c2.path.forEach((c) => blocked.add(c));
    const res = findBeltPath({
      srcCells: footprintCells(srcId, placements),
      goalCells: beltGoalCells(footprintCells(to, placements), blocked),
      directCells: footprintCells(to, placements),
      blocked,
      budget: railBudget - used,
    });
    if (!res.path) throw new Error(label + ': ' + key + ' -> ' + to + ': auto-path gagal');
    if (res.overBudget) throw new Error(label + ': ' + key + ' -> ' + to + ': rute melebihi sisa anggaran');
    built[key] = { to, path: res.path };
    used += res.path.length;
  }
  return { conns: built, rails: railsUsed(built) };
}

function multisetKey(defs: Def[]): string {
  const m = new Map<string, number>();
  for (const d of defs) m.set(nodeKey(d), (m.get(nodeKey(d)) ?? 0) + 1);
  return [...m.entries()].sort().map(([k, v]) => k + '×' + v).join(' ');
}

async function winOrThrow(level: Level, sol: Solution, label: string) {
  const res = await simulate(level, sol.placements, sol.connections, { emit: async () => {} });
  if (res.verdict.kind !== 'win') throw new Error(label + ': verdict = ' + JSON.stringify(res.verdict));
}

const q = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
function defStr(d: Def): string {
  const parts: string[] = ["type: '" + d.type + "'"];
  if (d.color) parts.push("color: '" + d.color + "'");
  if (d.side) parts.push("side: '" + d.side + "'");
  if (d.to) parts.push("to: '" + d.to + "'");
  if (d.size) parts.push('size: ' + d.size);
  if (d.order) parts.push('order: [' + d.order.map((c) => "'" + c + "'").join(', ') + ']');
  return '{ ' + parts.join(', ') + ' }';
}
function solStr(sol: Solution, indent: string): string {
  const p = Object.entries(sol.placements)
    .map(([k, d]) => indent + '  ' + q(k) + ': ' + defStr(d) + ',')
    .join('\n');
  const c = Object.entries(sol.connections)
    .map(([k, conn]) => indent + '  ' + q(k) + ': { to: ' + q(conn.to ?? '') + ', path: [' + conn.path.map(q).join(', ') + '] },')
    .join('\n');
  return (
    '{\n' + indent + 'placements: {\n' + p + '\n' + indent + '},\n' +
    indent + 'connections: {\n' + c + '\n' + indent + '},\n' + indent.slice(2) + '}'
  );
}

async function main() {
  const outDir = path.resolve('scripts/gen-out');
  fs.mkdirSync(outDir, { recursive: true });
  const items: string[] = [];
  const report: string[] = [];

  for (const spec of SPECS) {
    const meta = spec.meta;
    const primBuilt = buildConns(meta.id + ' utama', spec.primary.placements, spec.primary.links, 999);
    const primary: Solution = { placements: spec.primary.placements, connections: primBuilt.conns };
    const refRails = primBuilt.rails;
    const railLimit = refRails + Math.max(6, Math.ceil(refRails * 0.6));
    const level: Level = {
      ...meta,
      par: Object.keys(primary.placements).length,
      refRails,
      railLimit,
      tray: spec.tray,
      solution: primary,
    };
    await winOrThrow(level, primary, meta.id + ' utama');

    const altBuilt = buildConns(meta.id + ' alt', spec.alt.placements, spec.alt.links, railLimit);
    const alt: Solution = { placements: spec.alt.placements, connections: altBuilt.conns };
    await winOrThrow(level, alt, meta.id + ' alt');
    if (multisetKey(Object.values(primary.placements)) === multisetKey(Object.values(alt.placements))) {
      throw new Error(meta.id + ': alt tidak beda arsitektur');
    }
    for (const [label, sol] of [['utama', primary], ['alt', alt]] as const) {
      const left = new Map<string, number>();
      for (const d of spec.tray) left.set(nodeKey(d), (left.get(nodeKey(d)) ?? 0) + 1);
      for (const d of Object.values(sol.placements)) {
        const k = nodeKey(d);
        if ((left.get(k) ?? 0) <= 0) throw new Error(meta.id + ' ' + label + ': rak tidak menutup ' + k);
        left.set(k, (left.get(k) ?? 0) - 1);
      }
    }

    const lines: string[] = [];
    lines.push('  {');
    lines.push("    id: '" + meta.id + "',");
    lines.push('    chapter: 5,');
    lines.push('    name: ' + q(meta.name) + ',');
    lines.push('    brief:\n      ' + q(meta.brief) + ',');
    lines.push('    briefId:\n      ' + q(meta.briefId) + ',');
    lines.push('    stream: [' + meta.stream.map(q).join(', ') + '],');
    lines.push('    outputs: [' + meta.outputs.map(q).join(', ') + '],');
    const tgt = Object.entries(meta.target)
      .map(([k, v]) => k + ': [' + (v ?? []).map(q).join(', ') + ']')
      .join(', ');
    lines.push('    target: { ' + tgt + ' },');
    if (meta.packageRule) {
      const pr = Object.entries(meta.packageRule).map(([k, v]) => k + ': ' + v).join(', ');
      lines.push('    packageRule: { ' + pr + ' },');
    }
    if (meta.goalText) lines.push('    goalText:\n      ' + q(meta.goalText) + ',');
    if (meta.goalTextId) lines.push('    goalTextId:\n      ' + q(meta.goalTextId) + ',');
    lines.push('    par: ' + level.par + ',');
    lines.push('    refRails: ' + refRails + ',');
    lines.push('    railLimit: ' + railLimit + ',');
    if (spec.tray.length <= 3) {
      lines.push('    tray: [' + spec.tray.map(defStr).join(', ') + '],');
    } else {
      lines.push('    tray: [');
      for (const d of spec.tray) lines.push('      ' + defStr(d) + ',');
      lines.push('    ],');
    }
    lines.push('    solution: ' + solStr(primary, '      ') + ',');
    lines.push('    altSolution: ' + solStr(alt, '      ') + ',');
    lines.push('  },');
    items.push(lines.join('\n'));
    report.push(
      meta.id.padEnd(6) + ' par ' + level.par + ' · refRail ' + String(refRails).padEnd(3) +
        ' · limit ' + String(railLimit).padEnd(3) + ' · alt: ' + Object.keys(alt.placements).length +
        ' mesin, ' + altBuilt.rails + ' rail',
    );
  }

  const body =
    "import type { Level } from '../types';\n\nexport const chapter5: Level[] = [\n" + items.join('\n') + '\n];\n';
  fs.writeFileSync(path.join(outDir, 'chapter5.ts'), body);
  console.log(report.join('\n'));
  console.log('\nOK — Chapter 5: 6 level × 2 arsitektur menang semua.');
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
