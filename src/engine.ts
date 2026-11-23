import type { ColorCode, Conns, Level, Metrics, NodeDef, OutputId } from './types';
import { footprintCells, parseCell, railsUsed } from './geometry';
import { splitPortFor } from './nodeMeta';

export interface Arrival {
  color: ColorCode;
  batchId: number;
}

export type SimEvent =
  | { type: 'spawn'; token: number; color: ColorCode }
  | { type: 'spawnAt'; token: number; color: ColorCode; nodeId: string }
  | { type: 'move'; token: number; fromId: string; outIdx: number; toId: string }
  | { type: 'moveOpen'; token: number; fromId: string; outIdx: number }
  | { type: 'moveToPort'; token: number; fromId: string; outIdx: number }
  | { type: 'trash'; token: number; atId: string }
  | { type: 'arrive'; token: number; output: OutputId; color: ColorCode }
  | { type: 'store'; token: number; nodeId: string; held: number; capacity: number | null }
  | { type: 'held'; nodeId: string; held: number }
  | { type: 'releaseStart'; nodeId: string }
  | { type: 'transformed'; token: number; color: ColorCode }
  | { type: 'pause'; ms: number };

export type Emit = (e: SimEvent) => Promise<void>;

/** A leak: output was still produced, but part of the stream never made it out. */
export type Leak =
  | { kind: 'stuck'; color: ColorCode; at: string; cell?: string }
  | { kind: 'leftover'; nodeId: string; count: number };

export type Verdict =
  | { kind: 'win'; leak?: Leak }
  | { kind: 'stuck'; color: ColorCode; at: string; cell?: string }
  | { kind: 'leftover'; nodeId: string; count: number }
  | { kind: 'package'; output: OutputId; size: number }
  | { kind: 'mismatch'; output: OutputId; got: ColorCode[]; want: ColorCode[] };

export interface SimResult {
  arrivals: Partial<Record<OutputId, Arrival[]>>;
  hops: number;
  verdict: Verdict;
  aborted: boolean;
}

export interface SimHooks {
  emit: Emit;
  isCancelled?: () => boolean;
}

const OUTPUT_IDS: OutputId[] = ['OUT', 'A', 'B'];
const MAX_JOURNEY_HOPS = 250;
const MAX_FLUSH_ROUNDS = 50;

interface Tok {
  id: number;
  color: ColorCode;
  batchId: number;
}

/**
 * Simulasi satu run. Semantik mengikuti proof of concept:
 * token berjalan satu per satu menelusuri sambungan; SARING membuang token
 * yang tidak cocok ke tempat sampah; UBAH mengganti warna; PISAH mengarahkan
 * token mengikuti routing instance-nya (bawaan: warna cocok ke port 0, warna
 * kedua yang disebut (bila ada) ke port 2, dan sisanya ke port 1; pemain
 * dapat mengubahnya per mesin lewat editor Route); TAHAN menahan token dan
 * melepasnya sebagai paket (dengan batchId) begitu isinya penuh; URUTKAN
 * menahan semua token dan melepasnya terurut pada fase flush setelah aliran
 * masuk habis. Token yang port keluarnya tidak tersambung tercatat stuck.
 * GABUNG (MERGE) menampung token per sambungan masuk; begitu dua antrean
 * berisi, satu token dari tiap antrean dikonsumsi dan satu token baru
 * berwarna parameter mesin dipancarkan keluar.
 */
export async function simulate(
  level: Level,
  placed: Record<string, NodeDef>,
  conns: Conns,
  hooks: SimHooks,
): Promise<SimResult> {
  const emit = hooks.emit;
  const cancelled = () => hooks.isCancelled?.() ?? false;

  const run = {
    arrivals: {} as Partial<Record<OutputId, Arrival[]>>,
    stuck: null as { color: ColorCode; at: string; cell?: string } | null,
    hops: 0,
    batchSeq: 0,
    tokenSeq: 0,
    arrivalSeq: 0,
  };
  const tahanBuffers = new Map<string, { color: ColorCode }[]>();
  const sortBuffers = new Map<string, { color: ColorCode }[]>();
  const mergeQueues = new Map<string, Map<string, { color: ColorCode; seq: number }[]>>();

  function mergeWaiting(nodeId: string): number {
    const qs = mergeQueues.get(nodeId);
    if (!qs) return 0;
    let total = 0;
    qs.forEach((q) => (total += q.length));
    return total;
  }

  async function travel(tok: Tok, fromId: string, outIdx: number, journey: { n: number }): Promise<void> {
    if (cancelled()) return;
    if (journey.n > MAX_JOURNEY_HOPS) {
      // Pengaman siklus tak berujung: token dibuang di titik ini.
      await emit({ type: 'trash', token: tok.id, atId: fromId });
      return;
    }
    const conn = conns[fromId + ':' + outIdx];
    if (!conn) {
      await emit({ type: 'moveToPort', token: tok.id, fromId, outIdx });
      if (!run.stuck) run.stuck = { color: tok.color, at: fromId };
      return;
    }
    if (conn.to === null) {
      // Open-ended trail: the token rides to the last belt cell and stops
      // there — the belt reaches no machine, so the run is stuck at its end.
      if (conn.path.length) {
        await emit({ type: 'moveOpen', token: tok.id, fromId, outIdx });
        if (cancelled()) return;
        run.hops++;
        journey.n++;
        if (!run.stuck) {
          run.stuck = { color: tok.color, at: fromId, cell: conn.path[conn.path.length - 1] };
        }
      } else {
        await emit({ type: 'moveToPort', token: tok.id, fromId, outIdx });
        if (!run.stuck) run.stuck = { color: tok.color, at: fromId };
      }
      return;
    }
    const toId = conn.to;
    await emit({ type: 'move', token: tok.id, fromId, outIdx, toId });
    if (cancelled()) return;
    run.hops++;
    journey.n++;

    if ((OUTPUT_IDS as string[]).includes(toId)) {
      const out = toId as OutputId;
      (run.arrivals[out] = run.arrivals[out] || []).push({ color: tok.color, batchId: tok.batchId });
      await emit({ type: 'arrive', token: tok.id, output: out, color: tok.color });
      return;
    }

    const n = placed[toId];
    if (!n) return;

    if (n.type === 'filter') {
      if (tok.color === n.color) {
        await travel(tok, toId, 0, journey);
      } else {
        await emit({ type: 'trash', token: tok.id, atId: toId });
      }
      return;
    }
    if (n.type === 'transform') {
      tok.color = n.to!;
      await emit({ type: 'transformed', token: tok.id, color: tok.color });
      await travel(tok, toId, 0, journey);
      return;
    }
    if (n.type === 'split') {
      const outIdx = splitPortFor(n, tok.color);
      await travel(tok, toId, outIdx, journey);
      return;
    }
    if (n.type === 'tahan') {
      const buf = tahanBuffers.get(toId) ?? [];
      buf.push({ color: tok.color });
      tahanBuffers.set(toId, buf);
      await emit({ type: 'store', token: tok.id, nodeId: toId, held: buf.length, capacity: n.size ?? null });
      if (buf.length >= (n.size ?? Number.POSITIVE_INFINITY)) {
        const batchId = ++run.batchSeq;
        const released = buf.splice(0, buf.length);
        await emit({ type: 'releaseStart', nodeId: toId });
        for (const s of released) {
          if (cancelled()) return;
          const nt: Tok = { id: ++run.tokenSeq, color: s.color, batchId };
          await emit({ type: 'spawnAt', token: nt.id, color: nt.color, nodeId: toId });
          await travel(nt, toId, 0, { n: 0 });
          await emit({ type: 'pause', ms: 60 });
        }
      }
      return;
    }
    if (n.type === 'sort') {
      const buf = sortBuffers.get(toId) ?? [];
      buf.push({ color: tok.color });
      sortBuffers.set(toId, buf);
      await emit({ type: 'store', token: tok.id, nodeId: toId, held: buf.length, capacity: null });
      return;
    }
    if (n.type === 'merge') {
      const inKey = fromId + ':' + outIdx;
      let qs = mergeQueues.get(toId);
      if (!qs) {
        qs = new Map();
        mergeQueues.set(toId, qs);
      }
      let q = qs.get(inKey);
      if (!q) {
        q = [];
        qs.set(inKey, q);
      }
      q.push({ color: tok.color, seq: ++run.arrivalSeq });
      await emit({ type: 'store', token: tok.id, nodeId: toId, held: mergeWaiting(toId), capacity: null });
      // Pancarkan pasangan selama sekurang-kurangnya dua antrean berisi:
      // konsumsi kepala dua antrean yang paling dulu terisi.
      let paired = false;
      for (;;) {
        if (cancelled()) return;
        const ready = [...qs.entries()]
          .filter(([, a]) => a.length > 0)
          .sort((a, b) => a[1][0].seq - b[1][0].seq);
        if (ready.length < 2) break;
        ready[0][1].shift();
        ready[1][1].shift();
        paired = true;
        const nt: Tok = { id: ++run.tokenSeq, color: n.to!, batchId: 0 };
        await emit({ type: 'spawnAt', token: nt.id, color: nt.color, nodeId: toId });
        await emit({ type: 'transformed', token: nt.id, color: nt.color });
        await travel(nt, toId, 0, { n: 0 });
        await emit({ type: 'pause', ms: 60 });
      }
      // Pairing drained the queues without any new 'store' event — refresh
      // the held count so the on-board label never shows a stale number.
      if (paired) await emit({ type: 'held', nodeId: toId, held: mergeWaiting(toId) });
      return;
    }
  }

  // Fase utama: token masuk satu per satu mengikuti aliran.
  for (const color of level.stream) {
    if (cancelled()) break;
    const tok: Tok = { id: ++run.tokenSeq, color, batchId: 0 };
    await emit({ type: 'spawn', token: tok.id, color });
    await travel(tok, 'IN', 0, { n: 0 });
    if (cancelled()) break;
    await emit({ type: 'pause', ms: 110 });
  }

  // Fase flush: node URUTKAN melepas token yang ditahan, terurut warnanya.
  if (!cancelled()) {
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round++) {
      const pending = Object.keys(placed)
        .filter((id) => placed[id].type === 'sort' && (sortBuffers.get(id)?.length ?? 0) > 0)
        .sort();
      if (!pending.length) break;
      for (const nodeId of pending) {
        if (cancelled()) break;
        const n = placed[nodeId];
        const buf = sortBuffers.get(nodeId)!;
        const held = buf.splice(0, buf.length);
        const order = n.order ?? [];
        const rank = (c: ColorCode) => {
          const i = order.indexOf(c);
          return i < 0 ? order.length : i;
        };
        const sorted = held
          .map((t, i) => ({ color: t.color, i }))
          .sort((a, b) => rank(a.color) - rank(b.color) || a.i - b.i);
        await emit({ type: 'releaseStart', nodeId });
        for (const s of sorted) {
          if (cancelled()) break;
          const nt: Tok = { id: ++run.tokenSeq, color: s.color, batchId: 0 };
          await emit({ type: 'spawnAt', token: nt.id, color: nt.color, nodeId });
          await travel(nt, nodeId, 0, { n: 0 });
          await emit({ type: 'pause', ms: 60 });
        }
      }
    }
  }

  function checkTargets(): Verdict {
    for (const o of level.outputs) {
      const got = (run.arrivals[o] ?? []).map((a) => a.color);
      const want = level.target[o] ?? [];
      if (got.length !== want.length || got.some((c, i) => c !== want[i])) {
        return { kind: 'mismatch', output: o, got, want };
      }
    }
    return { kind: 'win' };
  }

  // Kebocoran: token yang berhenti di tengah jalan (port keluarnya tidak
  // tersambung / ujung belt terbuka), atau sisa token di dalam mesin.
  const slotOrder = Object.keys(placed).sort();
  const leftoverTahan = slotOrder.find(
    (id) => placed[id].type === 'tahan' && (tahanBuffers.get(id)?.length ?? 0) > 0,
  );
  const leftoverSort = slotOrder.find(
    (id) => placed[id].type === 'sort' && (sortBuffers.get(id)?.length ?? 0) > 0,
  );
  const leftoverMerge = slotOrder.find(
    (id) => placed[id].type === 'merge' && mergeWaiting(id) > 0,
  );
  const leftoverId = leftoverTahan ?? leftoverSort ?? leftoverMerge;
  const leak: Leak | undefined = run.stuck
    ? { kind: 'stuck', color: run.stuck.color, at: run.stuck.at, cell: run.stuck.cell }
    : leftoverId
      ? {
          kind: 'leftover',
          nodeId: leftoverId,
          count:
            (tahanBuffers.get(leftoverId)?.length ?? 0) +
            (sortBuffers.get(leftoverId)?.length ?? 0) +
            mergeWaiting(leftoverId),
        }
      : undefined;

  // Aturan paket adalah bagian dari kontrak output itu sendiri (kedatangan
  // harus berkelompok persis), jadi pelanggarannya tetap menggagalkan.
  let pkg: Verdict | null = null;
  if (level.packageRule) {
    for (const o of Object.keys(level.packageRule) as OutputId[]) {
      const size = level.packageRule[o]!;
      const arr = run.arrivals[o] ?? [];
      const groups = new Map<number, number>();
      let bad = false;
      for (const a of arr) {
        if (!a.batchId) bad = true;
        else groups.set(a.batchId, (groups.get(a.batchId) ?? 0) + 1);
      }
      for (const v of groups.values()) if (v !== size) bad = true;
      if (bad) {
        pkg = { kind: 'package', output: o, size };
        break;
      }
    }
  }

  // Kontrak level adalah outputnya: target tercapai persis (dan aturan
  // paket utuh) berarti LOLOS — kebocoran hanya dicatat sebagai catatan
  // bocor, bukan kegagalan. Bila target meleset, laporan kegagalan tetap
  // menunjuk sebab paling berguna: bocor berhenti, sisa mesin, paket, lalu
  // selisih output.
  const target = checkTargets();
  let verdict: Verdict;
  if (target.kind === 'win' && !pkg) {
    verdict = leak ? { kind: 'win', leak } : { kind: 'win' };
  } else if (leak) {
    verdict = leak;
  } else {
    verdict = pkg ?? target;
  }

  return { arrivals: run.arrivals, hops: run.hops, verdict, aborted: cancelled() };
}

export function computeMetrics(placed: Record<string, NodeDef>, hops: number): Metrics {
  const cellList: { c: number; r: number }[] = [];
  Object.keys(placed).forEach((id) => footprintCells(id, placed).forEach((k) => cellList.push(parseCell(k))));
  let ruang = 0;
  if (cellList.length) {
    const cs = cellList.map((p) => p.c);
    const rs = cellList.map((p) => p.r);
    ruang = (Math.max(...cs) - Math.min(...cs) + 1) * (Math.max(...rs) - Math.min(...rs) + 1);
  }
  return { node: Object.keys(placed).length, ruang, langkah: hops };
}

/**
 * Bintang mode dasar: efisiensi dua sumbu — mesin dan rail — dinilai dari
 * solusi referensi level. Nilai akhir = sumbu terburuk, jadi kemenangan
 * pertama yang masih boros wajar di bintang 2 dan bintang 3 adalah target
 * optimasi untuk main ulang.
 */
export function starsFor(level: Level, metrics: Metrics, rails: number): number {
  const ref = level.refRails ?? railsUsed(level.solution.connections);
  const rail3 = ref + Math.max(1, Math.ceil(ref * 0.15));
  const rail2 = ref + Math.max(3, Math.ceil(ref * 0.4));
  const nodeGrade = metrics.node <= level.par ? 0 : metrics.node === level.par + 1 ? 1 : 2;
  const railGrade = rails <= rail3 ? 0 : rails <= rail2 ? 1 : 2;
  return 3 - Math.max(nodeGrade, railGrade);
}

/**
 * Ambang bintang Expert (ketat): 3 bintang menuntut jumlah mesin pada nilai
 * referensi Expert dan rail nyaris pada nilai referensinya; 2 bintang memberi
 * kelonggaran satu mesin selama rail masih di dalam batas Expert.
 */
export function starsForExpert(
  refNodes: number,
  refRails: number,
  expertRailLimit: number,
  metrics: Metrics,
  rails: number,
): number {
  if (metrics.node <= refNodes && rails <= refRails + 1) return 3;
  if (metrics.node <= refNodes + 1 && rails <= expertRailLimit) return 2;
  return 1;
}

/** Aturan rekor dari proof: node lebih sedikit menang; seri node diputus langkah lebih sedikit. */
export function isBetter(a: Metrics, b: Metrics | null): boolean {
  if (!b) return true;
  return a.node < b.node || (a.node === b.node && a.langkah < b.langkah);
}
