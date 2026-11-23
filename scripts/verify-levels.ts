import { simulate } from '../src/engine';
import {
  COLS,
  ROWS,
  beltGoalCells,
  cellsAdjacent,
  cellsAdjAny,
  findBeltPath,
  findSplitExitPath,
  footprintCells,
  footprintCellsAt,
  parseCell,
  railsUsed,
  splitExitCell,
} from '../src/geometry';
import { LEVELS } from '../src/levels';
import { nodeKey } from '../src/nodeMeta';
import type { ColorCode, Conns, Level, NodeDef, OutputId, PortIdx } from '../src/types';

let failures = 0;

function fail(msg: string) {
  failures++;
  console.log('  GAGAL: ' + msg);
}

function colorsOf(arrivals: Partial<Record<OutputId, { color: ColorCode }[]>>, out: OutputId) {
  return (arrivals[out] ?? []).map((a) => a.color);
}

function sameSeq(a: ColorCode[], b: ColorCode[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

async function runSim(level: Level, placements: Record<string, NodeDef>, connections: Conns) {
  return simulate(level, placements, connections, { emit: async () => {} });
}

function inBoard(cell: string): boolean {
  const p = parseCell(cell);
  return p.c >= 0 && p.c < COLS && p.r >= 0 && p.r < ROWS;
}

interface GridOpts {
  label: string;
  outputs: OutputId[];
  placements: Record<string, NodeDef>;
  conns: Conns;
  railLimit: number;
  obstacles: Set<string>;
  /** Urutan pembangunan sambungan (kunci Conns). Default: urutan data solusi. */
  order?: string[];
}

/** Legalitas grid satu susunan: footprint sah, tiap sambungan bisa dibangun dengan auto-path UI dalam anggaran, dan jalur hasil bangun sah. Mengembalikan total rail + sambungan hasil bangun (yang kemudian disimulasikan untuk cek kemenangan). */
function checkGrid(opts: GridOpts): { rails: number; built: Conns } {
  const { label, placements, conns } = opts;
  const obstacles = opts.obstacles;

  const occupied = new Map<string, string>();
  for (const id of ['IN', 'OUT', 'A', 'B']) {
    for (const c of footprintCells(id, placements)) occupied.set(c, id);
  }
  for (const [anchor, def] of Object.entries(placements)) {
    if (!inBoard(anchor)) fail(label + ': jangkar mesin di luar papan: ' + anchor);
    for (const c of footprintCellsAt(anchor, def.type)) {
      if (!inBoard(c)) fail(label + ': footprint ' + anchor + ' keluar papan di ' + c);
      if (obstacles.has(c)) fail(label + ': footprint ' + anchor + ' menimpa rintangan di ' + c);
      const other = occupied.get(c);
      if (other) fail(label + ': footprint ' + anchor + ' menimpa ' + other + ' di ' + c);
      occupied.set(c, anchor);
    }
  }

  // Bangun tiap sambungan memakai auto-path persis seperti UI: dari
  // footprint sumber ke doorstep footprint tujuan, menghindari sel mesin,
  // rintangan, dan jalur sambungan yang sudah dibangun sebelumnya. Anggaran
  // tiap sambungan = sisa rail setelah sambungan sebelumnya.
  // Sejak v6.6 belt SPLIT wajib keluar lewat sel port-nya sendiri, jadi
  // urutan menggambar ikut menentukan terbangun-tidaknya satu solusi —
  // persis seperti di UI, tempat pemain bebas menggambar belt dalam urutan
  // apa pun, menghapus, dan menggambar ulang. Harness mencoba urutan data,
  // lalu sejumlah urutan acak deterministik (seed tetap), dan menerima
  // urutan pertama yang membangun semuanya; sel keluar tiap port SPLIT
  // yang belum digambar DIPESAN selama satu percobaan — belt lain
  // menghindarinya, sama seperti pemain yang tahu mulut port harus tetap
  // kosong.
  const machineCells = new Set(occupied.keys());
  const isSplitKey = (k: string) => {
    const d = placements[k.split(':')[0]];
    return !!d && d.type === 'split';
  };
  const validKeys: string[] = [];
  const preBuilt: Conns = {};
  for (const key of opts.order ?? Object.keys(conns)) {
    const conn = conns[key];
    if (!conn) continue;
    if (conn.to === null) {
      fail(label + ': ' + key + ': sambungan solusi berujung terbuka (solusi harus lengkap)');
      preBuilt[key] = { to: null, path: [] };
      continue;
    }
    const srcId = key.split(':')[0];
    let bad = false;
    if (srcId !== 'IN' && !placements[srcId]) {
      fail(label + ': sumber sambungan tidak ada: ' + key);
      bad = true;
    }
    if (!placements[conn.to] && !opts.outputs.includes(conn.to as OutputId)) {
      fail(label + ': tujuan sambungan tidak ada: ' + key + ' -> ' + conn.to);
      bad = true;
    }
    if (bad) {
      preBuilt[key] = { to: conn.to, path: [] };
      continue;
    }
    validKeys.push(key);
  }

  interface BuildAttempt {
    built: Conns;
    rails: number;
    failures: string[];
  }

  const tryBuild = (orderKeys: string[]): BuildAttempt => {
    const built: Conns = { ...preBuilt };
    const failures: string[] = [];
    let rails = 0;
    const reservedExits = new Set<string>();
    for (const k of orderKeys) {
      if (!isSplitKey(k)) continue;
      const e = splitExitCell(k.split(':')[0], parseInt(k.split(':')[1], 10) as PortIdx);
      if (e) reservedExits.add(e);
    }
    for (const key of orderKeys) {
      const conn = conns[key];
      const srcId = key.split(':')[0];
      const blocked = new Set<string>(machineCells);
      obstacles.forEach((c) => blocked.add(c));
      for (const c2 of Object.values(built)) c2.path.forEach((c) => blocked.add(c));
      reservedExits.forEach((c) => blocked.add(c));
      const srcCells = footprintCells(srcId, placements);
      const dstCells = footprintCells(conn.to!, placements);
      // Sambungan dari SPLIT dibangun persis seperti UI sejak v6.6: belt
      // wajib keluar lewat sel port-nya sendiri (port dibaca dari sisinya).
      const srcDef = placements[srcId];
      let ownExit: string | null = null;
      if (srcDef && srcDef.type === 'split') {
        ownExit = splitExitCell(srcId, parseInt(key.split(':')[1], 10) as PortIdx);
        if (ownExit) blocked.delete(ownExit);
      }
      const res =
        srcDef && srcDef.type === 'split'
          ? findSplitExitPath({
              anchor: srcId,
              port: parseInt(key.split(':')[1], 10) as PortIdx,
              goalCells: beltGoalCells(dstCells, blocked),
              directCells: dstCells,
              blocked,
              budget: opts.railLimit - rails,
            })
          : findBeltPath({
              srcCells,
              goalCells: beltGoalCells(dstCells, blocked),
              directCells: dstCells,
              blocked,
              budget: opts.railLimit - rails,
            });
      if (ownExit) reservedExits.delete(ownExit);
      if (!res.path) {
        failures.push(key + ': auto-path tidak menemukan rute ke ' + conn.to);
        built[key] = { to: conn.to, path: [] };
        continue;
      }
      if (res.overBudget) {
        failures.push(
          key + ': rute terpendek ' + res.path.length +
            ' rail melebihi sisa anggaran (limit total ' + opts.railLimit + ')',
        );
      }
      built[key] = { to: conn.to, path: res.path };
      rails += res.path.length;
    }
    return { built, rails, failures };
  };

  // PRNG deterministik (mulberry32): urutan acak yang sama di setiap run.
  const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = (keys: string[], seed: number): string[] => {
    const rnd = mulberry32(seed);
    const arr = [...keys];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const candidateOrders: string[][] = [
    validKeys,
    [...validKeys.filter(isSplitKey), ...validKeys.filter((k) => !isSplitKey(k))],
    [...validKeys.filter((k) => !isSplitKey(k)), ...validKeys.filter(isSplitKey)],
  ];
  for (let s = 1; s <= 300; s++) candidateOrders.push(shuffled(validKeys, s * 7919 + validKeys.length));

  let best: BuildAttempt | null = null;
  for (const order of candidateOrders) {
    const attempt = tryBuild(order);
    if (attempt.failures.length === 0) {
      best = attempt;
      break;
    }
    if (
      !best ||
      attempt.failures.length < best.failures.length ||
      (attempt.failures.length === best.failures.length && attempt.rails < best.rails)
    ) {
      best = attempt;
    }
  }
  const built: Conns = best!.built;
  for (const f of best!.failures) fail(label + ': ' + f);

  // Legalitas atas jalur hasil auto-path.
  const pathCells = new Map<string, string>();
  for (const [key, conn] of Object.entries(built)) {
    if (conn.to === null) continue;
    const srcId = key.split(':')[0];
    const srcCells = footprintCells(srcId, placements);
    const dstCells = footprintCells(conn.to, placements);
    conn.path.forEach((cell, i) => {
      if (!inBoard(cell)) fail(label + ': ' + key + ': sel jalur di luar papan ' + cell);
      if (obstacles.has(cell)) fail(label + ': ' + key + ': sel jalur menimpa rintangan di ' + cell);
      if (occupied.has(cell)) fail(label + ': ' + key + ': sel jalur menimpa mesin di ' + cell);
      const other = pathCells.get(cell);
      if (other) fail(label + ': ' + key + ': sel jalur tumpang tindih dengan ' + other + ' di ' + cell);
      pathCells.set(cell, key);
      if (i > 0 && !cellsAdjacent(conn.path[i - 1], cell)) {
        fail(label + ': ' + key + ': jalur tidak ortogonal di ' + cell);
      }
    });
    if (conn.path.length) {
      if (!cellsAdjAny(srcCells, [conn.path[0]])) {
        fail(label + ': ' + key + ': sel pertama tidak bersebelahan dengan sumber');
      }
      const srcDef2 = placements[srcId];
      if (srcDef2 && srcDef2.type === 'split') {
        const want = splitExitCell(srcId, parseInt(key.split(':')[1], 10) as PortIdx);
        if (conn.path[0] !== want) {
          fail(label + ': ' + key + ': sel pertama ' + conn.path[0] + ' bukan sel keluar port-nya (' + want + ')');
        }
      }
      if (!cellsAdjAny(dstCells, [conn.path[conn.path.length - 1]])) {
        fail(label + ': ' + key + ': sel terakhir tidak bersebelahan dengan tujuan');
      }
    } else if (!cellsAdjAny(srcCells, dstCells)) {
      fail(label + ': ' + key + ': jalur kosong tapi sumber dan tujuan tidak bersebelahan');
    }
  }

  const rails = railsUsed(built);
  if (rails > opts.railLimit) {
    fail(label + ': rail hasil auto-path ' + rails + ' melebihi railLimit ' + opts.railLimit);
  }

  return { rails, built };
}

function multiset(defs: NodeDef[], keyFn: (d: NodeDef) => string = nodeKey): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of defs) m.set(keyFn(d), (m.get(keyFn(d)) ?? 0) + 1);
  return m;
}

/**
 * Kunci perbandingan rak sejak v6.6: SPLIT di rak bersifat generik (tanpa
 * preset warna) dan menjadi SPLIT berwarna apa pun sesudah pemain mengatur
 * route-nya, jadi SPLIT dibandingkan menurut tipenya saja. Def di luar rak
 * (mesin terkunci, penempatan solusi) tetap dibandingkan persis lewat
 * pemeriksaan jangkarnya masing-masing.
 */
function trayKey(d: NodeDef): string {
  return d.type === 'split' ? 'split|' : nodeKey(d);
}

function checkTrayCovers(label: string, tray: NodeDef[], placements: Record<string, NodeDef>) {
  const left = multiset(tray, trayKey);
  for (const def of Object.values(placements)) {
    const k = trayKey(def);
    const n = left.get(k) ?? 0;
    if (n <= 0) fail(label + ': solusi memakai node di luar rak: ' + k);
    left.set(k, n - 1);
  }
}

async function checkWin(level: Level, placements: Record<string, NodeDef>, conns: Conns, label: string) {
  const res = await runSim(level, placements, conns);
  if (res.verdict.kind !== 'win') {
    fail(label + ': verdict solusi = ' + res.verdict.kind + ' (diharapkan win)');
    return;
  }
  for (const out of level.outputs) {
    const got = colorsOf(res.arrivals, out);
    const want = level.target[out] ?? [];
    if (!sameSeq(got, want)) {
      fail(label + ': output ' + out + ' = [' + got.join(',') + '], target [' + want.join(',') + ']');
    }
  }
}

interface Trap {
  name: string;
  levelId: string;
  placements: Record<string, NodeDef>;
  conns: Conns;
  expect: string;
}

const TRAPS: Trap[] = [
  {
    name: 'Final — hijau langsung ke A tanpa TAHAN',
    levelId: 'c3-4',
    placements: {},
    conns: {},
    expect: 'package',
  },
  {
    name: 'Level 11 — INPUT langsung ke Output tanpa TAHAN',
    levelId: 'c3-1',
    placements: {},
    conns: { 'IN:0': { to: 'OUT', path: ['1,3', '2,3', '3,3', '4,3', '5,3', '6,3', '7,3', '8,3', '9,3'] } },
    expect: 'package',
  },
  {
    name: 'Level 12 — TAHAN sebelum SARING (urutan terbalik)',
    levelId: 'c3-2',
    placements: { '3,3': { type: 'tahan', size: 3 }, '6,3': { type: 'filter', color: 'G' } },
    conns: {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: '6,3', path: ['5,3'] },
      '6,3:0': { to: 'OUT', path: ['7,3', '8,3', '9,3'] },
    },
    expect: 'leftover',
  },
  {
    name: 'Level 15 — MERGE hanya diberi satu belt masuk (biru langsung ke Output)',
    levelId: 'c4-1',
    placements: {},
    conns: {},
    expect: 'leftover',
  },
  {
    name: 'Level 16 — hasil MERGE langsung ke Output tanpa BUFFER',
    levelId: 'c4-2',
    placements: {},
    conns: {},
    expect: 'package',
  },
  {
    name: 'Level 17 — MERGE diberi satu belt campuran (tanpa PISAH kedua)',
    levelId: 'c4-3',
    placements: {},
    conns: {},
    expect: 'leftover',
  },
  {
    name: 'Level 18 — hijau langsung ke A tanpa BUFFER',
    levelId: 'c4-4',
    placements: {},
    conns: {},
    expect: 'package',
  },
];

/** Susun jebakan yang diturunkan dari solusi levelnya (agar tetap sinkron dengan data level). */
function buildTrap(trap: Trap, expert = false): { placements: Record<string, NodeDef>; conns: Conns } {
  const level = LEVELS.find((l) => l.id === trap.levelId)!;
  const sol = level.solution;
  if (trap.levelId === 'c3-4') {
    const conns: Conns = {
      ...sol.connections,
      '3,3:0': { to: 'A', path: ['3,2', '3,1', '4,1', '5,1', '6,1', '7,1', '8,1', '9,1'] },
    };
    delete conns['5,1:0'];
    if (!expert) return { placements: sol.placements, conns };
    // Di Expert, varian yang bisa digambar: TAHAN tidak dipasang, jadi belt
    // hijau boleh melewati selnya yang kosong langsung menuju A.
    const placements: Record<string, NodeDef> = { ...sol.placements };
    delete placements['5,1'];
    return { placements, conns };
  }
  if (trap.levelId === 'c4-1') {
    const conns: Conns = {
      ...sol.connections,
      '3,3:1': { to: 'OUT', path: ['3,4', '4,4', '5,4', '6,4', '7,4', '8,4', '9,4', '10,4'] },
    };
    // Cabang bawah langsung ke Output; MERGE hanya menerima cabang atas dan
    // keluarnya tidak tersambung, jadi token merah menunggu tanpa pasangan.
    delete conns['6,3:0'];
    return { placements: sol.placements, conns };
  }
  if (trap.levelId === 'c4-2') {
    const placements: Record<string, NodeDef> = {
      '3,3': { type: 'split', color: 'R' },
      '6,3': { type: 'merge', to: 'G' },
    };
    const conns: Conns = {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: '6,3', path: ['3,2', '3,1', '4,1', '5,1', '5,2', '5,3'] },
      '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
      '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
    };
    return { placements, conns };
  }
  if (trap.levelId === 'c4-3') {
    const placements: Record<string, NodeDef> = {
      '3,3': { type: 'split', color: 'G' },
      '4,1': { type: 'filter', color: 'B' },
      '6,3': { type: 'merge', to: 'G' },
    };
    const conns: Conns = {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: '4,1', path: ['3,2', '3,1'] },
      '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
      '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
    };
    return { placements, conns };
  }
  if (trap.levelId === 'c4-4') {
    // SPLIT pertama kini menyebut dua warna (samakan dengan def terkunci di
    // Expert): merah keluar port SIDE, biru port bawah — keduanya ke PISAH
    // kedua, seperti jebakan aslinya.
    const placements: Record<string, NodeDef> = {
      '3,3': { type: 'split', color: 'G', side: 'R' },
      '5,5': { type: 'split', color: 'R' },
      '7,3': { type: 'merge', to: 'G' },
    };
    const conns: Conns = {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: 'A', path: ['3,2', '3,1', '4,1', '5,1', '6,1', '7,1', '8,1', '9,1'] },
      '3,3:1': { to: '5,5', path: ['3,4', '4,4', '4,5'] },
      '3,3:2': { to: '5,5', path: ['4,3', '4,4', '4,5'] },
      '5,5:0': { to: '7,3', path: ['5,4', '5,3', '6,3'] },
      '5,5:1': { to: '7,3', path: ['5,6', '6,6', '7,6', '7,5', '7,4'] },
      '7,3:0': { to: 'B', path: ['8,4', '8,5', '9,5'] },
    };
    return { placements, conns };
  }
  return { placements: trap.placements, conns: trap.conns };
}

/** Apakah jebakan masih bisa dicoba di varian Expert (tidak terhalang rintangan / mesin terkunci)? */
function trapDrawableInExpert(
  level: Level,
  placements: Record<string, NodeDef>,
  conns: Conns,
): { ok: boolean; placements: Record<string, NodeDef> } {
  const exp = level.expert!;
  const obstacles = new Set(exp.obstacles);
  const merged: Record<string, NodeDef> = { ...exp.locked, ...placements };
  // Penempatan jebakan tidak boleh mengganti mesin terkunci dengan def lain.
  for (const [anchor, def] of Object.entries(exp.locked)) {
    if (placements[anchor] && nodeKey(placements[anchor]) !== nodeKey(def)) return { ok: false, placements: merged };
  }
  const occupied = new Set<string>();
  for (const id of ['IN', 'OUT', 'A', 'B']) footprintCells(id, merged).forEach((c) => occupied.add(c));
  for (const [anchor, def] of Object.entries(merged)) {
    for (const c of footprintCellsAt(anchor, def.type)) {
      if (obstacles.has(c) || occupied.has(c)) return { ok: false, placements: merged };
      occupied.add(c);
    }
  }
  for (const conn of Object.values(conns)) {
    for (const c of conn.path) {
      if (obstacles.has(c) || occupied.has(c)) return { ok: false, placements: merged };
    }
  }
  return { ok: true, placements: merged };
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

/**
 * Penyesuaian urutan bangun khusus Expert. Dulu c4-3 & c4-4 membutuhkannya
 * (BFS rakus merebut koridor sambungan lain); sejak redesign SPLIT 3-port,
 * rute kedua level itu berpisah per port dan urutan data solusi cukup —
 * tidak ada entri yang tersisa.
 */
const EXPERT_BUILD_ORDER: Record<string, string[]> = {};

async function main() {
  console.log('Memverifikasi ' + LEVELS.length + ' level dasar + varian Expert + MERGE (model grid iso)...\n');

  // ---- 1) Level dasar ----
  console.log('== Level dasar ==');
  console.log('Level'.padEnd(38) + 'Rail'.padEnd(7) + 'Limit');
  for (const level of LEVELS) {
    const sol = level.solution;
    checkTrayCovers(level.id, level.tray, sol.placements);
    const { rails, built } = checkGrid({
      label: level.id,
      outputs: level.outputs,
      placements: sol.placements,
      conns: sol.connections,
      railLimit: level.railLimit,
      obstacles: new Set(),
    });
    console.log((level.name + ' [' + level.id + ']').padEnd(38) + String(rails).padEnd(7) + level.railLimit);
    await checkWin(level, sol.placements, built, level.id);
  }

  // ---- 1b) Solusi alternatif: setiap level wajib punya cara menang kedua
  // yang beda arsitektur (multiset mesin beda), di dalam rak dan anggaran
  // yang sama — bukti levelnya bukan satu-solusi. ----
  console.log('\n== Solusi alternatif ==');
  for (const level of LEVELS) {
    const alt = level.altSolution;
    if (!alt) {
      fail(level.id + ': altSolution tidak ada');
      continue;
    }
    checkTrayCovers(level.id + ' alt', level.tray, alt.placements);
    const { rails, built } = checkGrid({
      label: level.id + ' alt',
      outputs: level.outputs,
      placements: alt.placements,
      conns: alt.connections,
      railLimit: level.railLimit,
      obstacles: new Set(),
    });
    await checkWin(level, alt.placements, built, level.id + ' alt');
    const a = multiset(Object.values(level.solution.placements));
    const b = multiset(Object.values(alt.placements));
    const sameSet =
      a.size === b.size && [...a.entries()].every(([k, v]) => b.get(k) === v);
    if (sameSet) fail(level.id + ': altSolution memakai multiset mesin yang sama dengan solusi utama');
    console.log(
      '  OK — ' + level.id + ': alt menang dengan ' + Object.keys(alt.placements).length +
        ' mesin, ' + rails + ' rail (utama: ' + Object.keys(level.solution.placements).length + ' mesin).',
    );
  }

  // ---- 2) Fokus MERGE (uji engine sintetis) ----
  console.log('\n== Fokus MERGE ==');
  const mergeLayout = {
    placements: {
      '3,3': { type: 'split', color: 'R' } as NodeDef,
      '6,3': { type: 'merge', to: 'G' } as NodeDef,
    },
    connections: {
      'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
      '3,3:0': { to: '6,3', path: ['3,2', '3,1', '4,1', '5,1', '5,2', '5,3'] },
      '3,3:1': { to: '6,3', path: ['3,4', '4,4', '5,4', '6,4'] },
      '6,3:0': { to: 'OUT', path: ['8,3', '9,3'] },
    } as Conns,
  };
  const pairLevel = fakeLevel({ stream: ['R', 'B'], target: { OUT: ['G'] } });
  const pairRes = await runSim(pairLevel, mergeLayout.placements, mergeLayout.connections);
  if (pairRes.verdict.kind === 'win' && sameSeq(colorsOf(pairRes.arrivals, 'OUT'), ['G'])) {
    console.log('  OK — pasangan R+B terpancar sebagai satu token G.');
  } else {
    fail('uji pasangan MERGE: verdict = ' + pairRes.verdict.kind + ' (diharapkan win, output [G])');
  }
  const unpairedLevel = fakeLevel({ stream: ['R', 'R', 'B'], target: { OUT: ['G'] } });
  const unpairedRes = await runSim(unpairedLevel, mergeLayout.placements, mergeLayout.connections);
  if (
    unpairedRes.verdict.kind === 'win' &&
    unpairedRes.verdict.leak?.kind === 'leftover' &&
    unpairedRes.verdict.leak.nodeId === '6,3'
  ) {
    console.log('  OK — token tak berpasangan menunggu di MERGE: output tetap lolos, kebocoran tercatat (win + leak leftover).');
  } else {
    fail('uji tak berpasangan MERGE: verdict = ' + unpairedRes.verdict.kind + ' (diharapkan win dengan leak leftover di MERGE)');
  }

  // ---- 2b) Fokus SPLIT 3-port + trail terbuka (uji engine sintetis) ----
  console.log('\n== Fokus SPLIT 3-port ==');
  const split3Level = fakeLevel({
    stream: ['G', 'R', 'B', 'G', 'R', 'B'],
    outputs: ['OUT', 'A', 'B'],
    target: { A: ['G', 'G'], B: ['R', 'R'], OUT: ['B', 'B'] },
  });
  const split3Placements = { '3,3': { type: 'split', color: 'G', side: 'R' } as NodeDef };
  const split3Conns: Conns = {
    'IN:0': { to: '3,3', path: ['1,3', '2,3'] },
    '3,3:0': { to: 'A', path: ['3,2', '3,1'] },
    '3,3:2': { to: 'B', path: ['4,3', '5,3'] },
    '3,3:1': { to: 'OUT', path: ['3,4', '3,5'] },
  };
  const split3Res = await runSim(split3Level, split3Placements, split3Conns);
  if (split3Res.verdict.kind === 'win') {
    console.log('  OK — SPLIT 3-port: warna pertama ke port 0, warna kedua (side) ke port 2, sisanya ke port 1.');
  } else {
    fail('uji routing SPLIT 3-port: verdict = ' + split3Res.verdict.kind + ' (diharapkan win)');
  }

  console.log('\n== Fokus trail terbuka ==');
  // (a) Token yang memasuki trail terbuka berhenti di sel ujungnya.
  const openLevel = fakeLevel({ stream: ['R'], target: { OUT: ['R'] } });
  const openRes = await runSim(openLevel, {}, { 'IN:0': { to: null, path: ['1,3', '2,3'] } });
  if (
    openRes.verdict.kind === 'stuck' &&
    openRes.verdict.at === 'IN' &&
    openRes.verdict.cell === '2,3'
  ) {
    console.log('  OK — token masuk trail terbuka → stuck di sel ujung (2,3), sumber IN.');
  } else {
    fail(
      'uji trail terbuka (a): verdict = ' + JSON.stringify(openRes.verdict) +
        ' (diharapkan stuck di IN, sel 2,3)',
    );
  }
  // (b) Trail terbuka di port SPLIT yang tidak terpakai tidak mengganggu
  // solusi yang lengkap (port 2 tanpa warna side tidak pernah menerima token).
  const openUnusedConns: Conns = {
    ...mergeLayout.connections,
    '3,3:2': { to: null, path: ['4,3'] },
  };
  const openUnusedRes = await runSim(pairLevel, mergeLayout.placements, openUnusedConns);
  if (openUnusedRes.verdict.kind === 'win' && sameSeq(colorsOf(openUnusedRes.arrivals, 'OUT'), ['G'])) {
    console.log('  OK — trail terbuka di port tak terpakai: solusi lengkap tetap menang.');
  } else {
    fail('uji trail terbuka (b): verdict = ' + openUnusedRes.verdict.kind + ' (diharapkan win)');
  }

  // ---- 3) Jebakan (dasar) ----
  console.log('\n== Jebakan (mode dasar) ==');
  for (const trap of TRAPS) {
    const level = LEVELS.find((l) => l.id === trap.levelId)!;
    const built = buildTrap(trap);
    const res = await runSim(level, built.placements, built.conns);
    if (res.verdict.kind === trap.expect) {
      console.log('  OK — ' + trap.name + ' → verdict = ' + trap.expect + '.');
    } else {
      fail('jebakan "' + trap.name + '": verdict = ' + res.verdict.kind + ' (diharapkan ' + trap.expect + ')');
    }
  }

  // ---- 4) Varian Expert ----
  console.log('\n== Varian Expert ==');
  console.log('Level'.padEnd(38) + 'Rail'.padEnd(7) + 'Limit Expert');
  for (const level of LEVELS) {
    const exp = level.expert;
    if (!exp) {
      fail(level.id + ': varian Expert tidak ada');
      continue;
    }
    const label = level.id + ' expert';
    // Mesin terkunci harus persis bagian dari solusi referensi Expert.
    for (const [anchor, def] of Object.entries(exp.locked)) {
      const inSol = exp.solution.placements[anchor];
      if (!inSol || nodeKey(inSol) !== nodeKey(def)) {
        fail(label + ': mesin terkunci di ' + anchor + ' tidak cocok dengan solusi Expert');
      }
    }
    // Inventaris Expert (rak + terkunci) harus persis multiset solusi
    // (SPLIT dibandingkan menurut tipe saja — rak generik sejak v6.6;
    // kecocokan persis mesin terkunci sudah diperiksa per jangkar di atas).
    const inv = multiset([...exp.tray, ...Object.values(exp.locked)], trayKey);
    const need = multiset(Object.values(exp.solution.placements), trayKey);
    for (const k of new Set([...inv.keys(), ...need.keys()])) {
      if ((inv.get(k) ?? 0) !== (need.get(k) ?? 0)) {
        fail(label + ': inventaris Expert tidak persis solusi untuk ' + k +
          ' (rak+terkunci ' + (inv.get(k) ?? 0) + ' vs solusi ' + (need.get(k) ?? 0) + ')');
      }
    }
    const { rails, built } = checkGrid({
      label,
      outputs: level.outputs,
      placements: exp.solution.placements,
      conns: exp.solution.connections,
      railLimit: exp.railLimit,
      obstacles: new Set(exp.obstacles),
      order: EXPERT_BUILD_ORDER[level.id],
    });
    console.log((level.name + ' [' + level.id + ']').padEnd(38) + String(rails).padEnd(7) + exp.railLimit);
    await checkWin(level, exp.solution.placements, built, label);
  }

  // ---- 5) Jebakan di Expert (bila masih bisa dicoba) ----
  console.log('\n== Jebakan (mode Expert, bila masih bisa dicoba) ==');
  for (const trap of TRAPS) {
    const level = LEVELS.find((l) => l.id === trap.levelId)!;
    if (!level.expert) continue;
    const built = buildTrap(trap, true);
    const d = trapDrawableInExpert(level, built.placements, built.conns);
    if (!d.ok) {
      console.log('  LEWATI — ' + trap.name + ': terhalang rintangan/mesin terkunci di Expert.');
      continue;
    }
    const res = await runSim(level, d.placements, built.conns);
    if (res.verdict.kind === trap.expect) {
      console.log('  OK — ' + trap.name + ' → verdict = ' + trap.expect + ' (Expert).');
    } else {
      fail('jebakan Expert "' + trap.name + '": verdict = ' + res.verdict.kind + ' (diharapkan ' + trap.expect + ')');
    }
  }

  console.log('');
  if (failures > 0) {
    console.log('HASIL: ' + failures + ' kegagalan.');
    process.exit(1);
  }
  console.log('HASIL: semua level dasar, Expert, fokus MERGE, dan jebakan lulus.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
