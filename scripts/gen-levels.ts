/**
 * Generator rombak level v5.0 (SYSTEM THINKER): solusi utama di-route ulang
 * memakai auto-path UI, solusi ALTERNATIF dibangun dari spesifikasi
 * (penempatan + ujung sambungan), keduanya disimulasikan sampai menang.
 * Keluaran: scripts/gen-out/chapter{1..4}.ts + laporan ringkas.
 *
 * Jalankan: npx tsx scripts/gen-levels.ts
 */
import { simulate } from '../src/engine';
import { beltGoalCells, findBeltPath, footprintCells, railsUsed } from '../src/geometry';
import { LEVELS } from '../src/levels';
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

interface AltSpec {
  placements: Record<string, Def>;
  links: [string, string][];
}

interface LevelSpec {
  tray: Def[];
  alt: AltSpec;
}

/** Rak longgar (persediaan fisik persis) + arsitektur alternatif per level. */
const SPECS: Record<string, LevelSpec> = {
  'c1-1': {
    tray: [F('R'), S('R'), F('G')],
    alt: {
      placements: { '4,3': S('R'), '4,5': F('G') },
      links: [['IN:0', '4,3'], ['4,3:0', 'OUT'], ['4,3:1', '4,5']],
    },
  },
  'c1-2': {
    tray: [T('G'), F('B'), F('G')],
    alt: {
      placements: { '4,3': T('G'), '7,3': F('G') },
      links: [['IN:0', '4,3'], ['4,3:0', '7,3'], ['7,3:0', 'OUT']],
    },
  },
  'c1-3': {
    tray: [F('R'), T('G'), S('R'), F('G')],
    alt: {
      placements: { '3,3': S('R'), '6,3': T('G'), '3,5': F('G') },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['6,3:0', 'OUT'], ['3,3:1', '3,5']],
    },
  },
  'c1-4': {
    tray: [F('R'), S('R'), F('G'), T('G'), F('B')],
    alt: {
      placements: { '4,3': S('R'), '4,5': F('G') },
      links: [['IN:0', '4,3'], ['4,3:0', 'OUT'], ['4,3:1', '4,5']],
    },
  },
  'c1-5': {
    tray: [F('R'), T('B'), S('R'), F('G'), F('B')],
    alt: {
      placements: { '3,3': S('R'), '6,3': T('B'), '3,5': F('G') },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['6,3:0', 'OUT'], ['3,3:1', '3,5']],
    },
  },
  'c2-1': {
    tray: [S('R'), S('B'), F('R'), F('B')],
    alt: {
      placements: { '6,3': S('B') },
      links: [['IN:0', '6,3'], ['6,3:0', 'B'], ['6,3:1', 'A']],
    },
  },
  'c2-2': {
    tray: [S('R'), S('B'), T('G')],
    alt: {
      placements: { '4,3': S('B'), '7,5': T('G') },
      links: [['IN:0', '4,3'], ['4,3:1', '7,5'], ['7,5:0', 'A'], ['4,3:0', 'B']],
    },
  },
  'c2-3': {
    tray: [S('R'), S('B'), T('G')],
    alt: {
      placements: { '4,3': S('B'), '6,4': T('G') },
      links: [['IN:0', '4,3'], ['4,3:1', '6,4'], ['6,4:0', 'OUT'], ['4,3:0', 'OUT']],
    },
  },
  'c2-4': {
    tray: [SO, B(3)],
    alt: {
      placements: { '4,3': SO, '7,3': B(3) },
      links: [['IN:0', '4,3'], ['4,3:0', '7,3'], ['7,3:0', 'OUT']],
    },
  },
  'c2-5': {
    tray: [S('G'), S('R', 'G'), T('B')],
    alt: {
      placements: { '4,3': S('R', 'G'), '6,5': T('B') },
      links: [['IN:0', '4,3'], ['4,3:2', 'OUT'], ['4,3:0', '6,5'], ['6,5:0', 'OUT'], ['4,3:1', 'OUT']],
    },
  },
  'c3-1': {
    tray: [B(3), B(2), F('R')],
    alt: {
      placements: { '3,3': F('R'), '6,3': B(3) },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['6,3:0', 'OUT']],
    },
  },
  'c3-2': {
    tray: [F('G'), B(3), S('G')],
    alt: {
      placements: { '3,3': S('G'), '6,3': B(3), '3,5': F('G') },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['6,3:0', 'OUT'], ['3,3:1', '3,5']],
    },
  },
  'c3-3': {
    tray: [S('G'), S('B'), B(3)],
    alt: {
      placements: { '4,3': S('B'), '6,1': B(3) },
      links: [['IN:0', '4,3'], ['4,3:1', '6,1'], ['6,1:0', 'A'], ['4,3:0', 'B']],
    },
  },
  'c3-4': {
    tray: [S('G', 'R'), B(3), F('R'), T('B'), S('G'), S('R'), F('G')],
    alt: {
      placements: { '3,3': S('G'), '5,1': B(3), '5,5': S('R'), '7,5': T('B'), '4,6': F('G') },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '5,1'], ['5,1:0', 'A'], ['3,3:1', '5,5'],
        ['5,5:0', '7,5'], ['7,5:0', 'B'], ['5,5:1', '4,6'],
      ],
    },
  },
  'c4-1': {
    tray: [S('R'), S('B'), M('G')],
    alt: {
      placements: { '3,3': S('B'), '6,3': M('G') },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['3,3:1', '6,3'], ['6,3:0', 'OUT']],
    },
  },
  'c4-2': {
    tray: [S('R'), S('B'), M('G'), B(3)],
    alt: {
      placements: { '3,3': S('B'), '6,3': M('G'), '8,1': B(3) },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['3,3:1', '6,3'], ['6,3:0', '8,1'], ['8,1:0', 'OUT']],
    },
  },
  'c4-3': {
    tray: [S('G', 'R'), F('B'), M('G'), S('R', 'B'), F('R')],
    alt: {
      placements: { '3,3': S('R', 'B'), '6,3': M('G'), '4,1': F('R') },
      links: [['IN:0', '3,3'], ['3,3:0', '6,3'], ['3,3:2', '6,3'], ['6,3:0', 'OUT'], ['3,3:1', '4,1']],
    },
  },
  'c4-4': {
    tray: [S('G', 'R'), B(3), M('G'), S('G'), S('R')],
    alt: {
      placements: { '3,3': S('G'), '5,1': B(3), '5,5': S('R'), '7,4': M('G') },
      links: [
        ['IN:0', '3,3'], ['3,3:0', '5,1'], ['5,1:0', 'A'], ['3,3:1', '5,5'],
        ['5,5:0', '7,4'], ['5,5:1', '7,4'], ['7,4:0', 'B'],
      ],
    },
  },
};

/** Bangun Conns dari penempatan + daftar ujung sambungan, memakai auto-path UI persis seperti checkGrid di verify-levels. */
function buildConns(
  label: string,
  placements: Record<string, Def>,
  links: [string, string][],
  outputs: string[],
  railBudget: number,
): { conns: Conns; rails: number } {
  const machineCells = new Set<string>();
  for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, placements).forEach((c) => machineCells.add(c));
  for (const [anchor, def] of Object.entries(placements)) {
    footprintCells(anchor, placements).forEach((c) => machineCells.add(c));
    void def;
  }
  const built: Conns = {};
  let used = 0;
  for (const [key, to] of links) {
    const srcId = key.split(':')[0];
    const blocked = new Set<string>(machineCells);
    for (const c2 of Object.values(built)) c2.path.forEach((c) => blocked.add(c));
    const srcCells = footprintCells(srcId, placements);
    const dstCells = footprintCells(to, placements);
    const res = findBeltPath({
      srcCells,
      goalCells: beltGoalCells(dstCells, blocked),
      directCells: dstCells,
      blocked,
      budget: railBudget - used,
    });
    if (!res.path) throw new Error(label + ': ' + key + ' -> ' + to + ': auto-path gagal');
    if (res.overBudget) throw new Error(label + ': ' + key + ' -> ' + to + ': rute ' + res.path.length + ' melebihi sisa anggaran');
    built[key] = { to, path: res.path };
    used += res.path.length;
    void outputs;
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
  if (res.verdict.kind !== 'win') {
    throw new Error(label + ': verdict = ' + JSON.stringify(res.verdict));
  }
}

// ---------- format TS ----------
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
function levelStr(lv: Level, sol: Solution, alt: Solution, refRails: number, railLimit: number, tray: Def[]): string {
  const lines: string[] = [];
  lines.push('  {');
  lines.push("    id: '" + lv.id + "',");
  lines.push('    chapter: ' + lv.chapter + ',');
  lines.push('    name: ' + q(lv.name) + ',');
  lines.push('    brief:\n      ' + q(lv.brief) + ',');
  lines.push('    briefId:\n      ' + q(lv.briefId) + ',');
  lines.push('    stream: [' + lv.stream.map(q).join(', ') + '],');
  lines.push('    outputs: [' + lv.outputs.map(q).join(', ') + '],');
  const tgt = Object.entries(lv.target)
    .map(([k, v]) => k + ': [' + (v ?? []).map(q).join(', ') + ']')
    .join(', ');
  lines.push('    target: { ' + tgt + ' },');
  if (lv.packageRule) {
    const pr = Object.entries(lv.packageRule).map(([k, v]) => k + ': ' + v).join(', ');
    lines.push('    packageRule: { ' + pr + ' },');
  }
  if (lv.goalText) lines.push('    goalText:\n      ' + q(lv.goalText) + ',');
  if (lv.goalTextId) lines.push('    goalTextId:\n      ' + q(lv.goalTextId) + ',');
  lines.push('    par: ' + Object.keys(sol.placements).length + ',');
  lines.push('    refRails: ' + refRails + ',');
  lines.push('    railLimit: ' + railLimit + ',');
  if (tray.length <= 3) {
    lines.push('    tray: [' + tray.map(defStr).join(', ') + '],');
  } else {
    lines.push('    tray: [');
    for (const d of tray) lines.push('      ' + defStr(d) + ',');
    lines.push('    ],');
  }
  lines.push('    solution: ' + solStr(sol, '      ') + ',');
  lines.push('    altSolution: ' + solStr(alt, '      ') + ',');
  lines.push('  },');
  return lines.join('\n');
}

async function main() {
  const outDir = path.resolve('scripts/gen-out');
  fs.mkdirSync(outDir, { recursive: true });
  const byChapter = new Map<number, string[]>();
  const report: string[] = [];

  for (const level of LEVELS) {
    const spec = SPECS[level.id];
    if (!spec) throw new Error('spec hilang: ' + level.id);

    // Solusi utama: penempatan + ujung sambungan dari solusi berjalan saat ini.
    const primLinks = Object.entries(level.solution.connections).map(
      ([k, v]) => [k, v.to as string] as [string, string],
    );
    const primBuilt = buildConns(level.id + ' utama', level.solution.placements, primLinks, level.outputs, 999);
    const primary: Solution = { placements: level.solution.placements, connections: primBuilt.conns };
    await winOrThrow(level, primary, level.id + ' utama');
    const refRails = primBuilt.rails;
    const railLimit = refRails + Math.max(6, Math.ceil(refRails * 0.6));

    // Solusi alternatif dalam anggaran baru.
    const altBuilt = buildConns(level.id + ' alt', spec.alt.placements, spec.alt.links, level.outputs, railLimit);
    const alt: Solution = { placements: spec.alt.placements, connections: altBuilt.conns };
    await winOrThrow(level, alt, level.id + ' alt');

    // Beda arsitektur: multiset tipe mesin beda ATAU jumlah mesin beda.
    const sameSet = multisetKey(Object.values(primary.placements)) === multisetKey(Object.values(alt.placements));
    if (sameSet) throw new Error(level.id + ': alt tidak beda arsitektur dari utama');

    // Rak harus menutup kedua arsitektur.
    for (const [label, sol] of [['utama', primary], ['alt', alt]] as const) {
      const left = new Map<string, number>();
      for (const d of spec.tray) left.set(nodeKey(d), (left.get(nodeKey(d)) ?? 0) + 1);
      for (const d of Object.values(sol.placements)) {
        const k = nodeKey(d);
        if ((left.get(k) ?? 0) <= 0) throw new Error(level.id + ' ' + label + ': rak tidak menutup ' + k);
        left.set(k, (left.get(k) ?? 0) - 1);
      }
    }

    report.push(
      level.id.padEnd(6) +
        ' par ' + String(Object.keys(primary.placements).length) +
        ' · refRail ' + String(refRails).padEnd(3) +
        ' · limit ' + String(railLimit).padEnd(3) +
        ' · alt: ' + Object.keys(alt.placements).length + ' mesin, ' + altBuilt.rails + ' rail [' +
        multisetKey(Object.values(alt.placements)) + ']',
    );
    const arr = byChapter.get(level.chapter) ?? [];
    arr.push(levelStr(level, primary, alt, refRails, railLimit, spec.tray));
    byChapter.set(level.chapter, arr);
  }

  for (const [ch, items] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
    const body =
      "import type { Level } from '../types';\n\nexport const chapter" + ch + ': Level[] = [\n' +
      items.join('\n') + '\n];\n';
    fs.writeFileSync(path.join(outDir, 'chapter' + ch + '.ts'), body);
  }
  console.log(report.join('\n'));
  console.log('\nOK — 18 level: solusi utama + alternatif menang semua, arsitektur beda, rak menutup.');
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
