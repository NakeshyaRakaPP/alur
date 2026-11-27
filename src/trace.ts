import type { SimEvent, Verdict } from './engine';
import { COLOR_NAME, COLOR_NAME_ID, nodeLabel, nodeName, splitPortFor } from './nodeMeta';
import type { ColorCode, Level, NodeDef, OutputId } from './types';

export interface TraceStep {
  en: string;
  id: string;
}

export interface TraceSummary {
  depth: number;
  rules: number;
  steps: TraceStep[];
  analysisEn: string[];
  analysisId: string[];
  suggestionEn: string;
  suggestionId: string;
}

interface TokenState {
  color: ColorCode;
  depth: number;
}

function outputLabel(output: OutputId): string {
  return output === 'OUT' ? 'OUTPUT' : 'OUTPUT ' + output;
}

function portLabel(port: number, lang: 'en' | 'id'): string {
  if (lang === 'id') return port === 0 ? 'atas' : port === 1 ? 'bawah' : 'samping';
  return port === 0 ? 'up' : port === 1 ? 'down' : 'side';
}

function firstDifference(got: ColorCode[], want: ColorCode[]): number {
  const n = Math.min(got.length, want.length);
  for (let i = 0; i < n; i++) {
    if (got[i] !== want[i]) return i;
  }
  return n;
}

export function buildTrace(
  level: Level,
  placed: Record<string, NodeDef>,
  verdict: Verdict,
  events: SimEvent[],
): TraceSummary {
  const steps: TraceStep[] = [];
  const tokens = new Map<number, TokenState>();
  const storedDepths = new Map<string, { color: ColorCode; depth: number }[]>();
  let rules = 0;
  let depth = 0;

  const push = (en: string, id: string) => steps.push({ en, id });
  const bump = (token: number, by = 1) => {
    const t = tokens.get(token);
    if (!t) return;
    t.depth += by;
    depth = Math.max(depth, t.depth);
  };
  const rememberStored = (nodeId: string, color: ColorCode, d: number) => {
    const q = storedDepths.get(nodeId) ?? [];
    q.push({ color, depth: d });
    storedDepths.set(nodeId, q);
  };
  const takeStored = (nodeId: string, color?: ColorCode) => {
    const q = storedDepths.get(nodeId) ?? [];
    const i = color ? q.findIndex((x) => x.color === color) : 0;
    if (i < 0 || !q.length) return 0;
    const [item] = q.splice(i, 1);
    storedDepths.set(nodeId, q);
    return item.depth;
  };

  for (const e of events) {
    switch (e.type) {
      case 'spawn': {
        tokens.set(e.token, { color: e.color, depth: 0 });
        push(`INPUT sends ${COLOR_NAME[e.color]}.`, `INPUT mengirim ${COLOR_NAME_ID[e.color]}.`);
        break;
      }
      case 'spawnAt': {
        const def = placed[e.nodeId];
        const title = def ? nodeLabel(def).title : 'MACHINE';
        if (def?.type === 'merge') {
          const d = Math.max(takeStored(e.nodeId), takeStored(e.nodeId)) + 1;
          tokens.set(e.token, { color: e.color, depth: d });
          depth = Math.max(depth, d);
          rules++;
          push(
            `MERGE joins a pair into ${COLOR_NAME[e.color]}.`,
            `MERGE menggabungkan sepasang token menjadi ${COLOR_NAME_ID[e.color]}.`,
          );
        } else {
          const d = takeStored(e.nodeId, e.color);
          tokens.set(e.token, { color: e.color, depth: d });
          depth = Math.max(depth, d);
          push(
            `${title} releases ${COLOR_NAME[e.color]}.`,
            `${title} melepas ${COLOR_NAME_ID[e.color]}.`,
          );
        }
        break;
      }
      case 'move': {
        const t = tokens.get(e.token);
        const def = placed[e.toId];
        if (!t || !def) break;
        if (def.type === 'filter' && t.color === def.color) {
          rules++;
          bump(e.token);
          push(
            `FILTER rule passes ${COLOR_NAME[t.color]}.`,
            `Aturan FILTER meloloskan ${COLOR_NAME_ID[t.color]}.`,
          );
        } else if (def.type === 'split') {
          rules++;
          bump(e.token);
          const port = splitPortFor(def, t.color);
          push(
            `SPLIT rule sends ${COLOR_NAME[t.color]} ${portLabel(port, 'en')}.`,
            `Aturan SPLIT mengirim ${COLOR_NAME_ID[t.color]} ke ${portLabel(port, 'id')}.`,
          );
        }
        break;
      }
      case 'moveOpen': {
        const t = tokens.get(e.token);
        if (t) {
          push(
            `${COLOR_NAME[t.color]} stops at an open belt end.`,
            `${COLOR_NAME_ID[t.color]} berhenti di ujung belt yang terbuka.`,
          );
        }
        tokens.delete(e.token);
        break;
      }
      case 'moveToPort': {
        const t = tokens.get(e.token);
        if (t) {
          push(
            `${COLOR_NAME[t.color]} stops: no connected way out.`,
            `${COLOR_NAME_ID[t.color]} berhenti: tidak ada jalan keluar yang tersambung.`,
          );
        }
        tokens.delete(e.token);
        break;
      }
      case 'trash': {
        const t = tokens.get(e.token);
        const def = placed[e.atId];
        if (t && def?.type === 'filter') {
          rules++;
          bump(e.token);
          push(
            `FILTER rule removes ${COLOR_NAME[t.color]}.`,
            `Aturan FILTER membuang ${COLOR_NAME_ID[t.color]}.`,
          );
        } else if (t) {
          push(`${COLOR_NAME[t.color]} is removed.`, `${COLOR_NAME_ID[t.color]} dibuang.`);
        }
        tokens.delete(e.token);
        break;
      }
      case 'arrive': {
        push(
          `${outputLabel(e.output)} receives ${COLOR_NAME[e.color]}.`,
          `${outputLabel(e.output)} menerima ${COLOR_NAME_ID[e.color]}.`,
        );
        tokens.delete(e.token);
        break;
      }
      case 'store': {
        const t = tokens.get(e.token);
        const def = placed[e.nodeId];
        if (!t || !def) break;
        const title = nodeLabel(def).title;
        if (def.type === 'merge') {
          rememberStored(e.nodeId, t.color, t.depth);
          push(
            `MERGE receives ${COLOR_NAME[t.color]}.`,
            `MERGE menerima ${COLOR_NAME_ID[t.color]}.`,
          );
        } else {
          rules++;
          bump(e.token);
          rememberStored(e.nodeId, t.color, t.depth);
          const held = e.capacity ? ` (${e.held}/${e.capacity})` : '';
          push(
            `${title} holds ${COLOR_NAME[t.color]}${held}.`,
            `${title} menahan ${COLOR_NAME_ID[t.color]}${held}.`,
          );
        }
        tokens.delete(e.token);
        break;
      }
      case 'transformed': {
        const t = tokens.get(e.token);
        if (!t) break;
        const from = t.color;
        t.color = e.color;
        if (from !== e.color) {
          rules++;
          bump(e.token);
          push(
            `CHANGE rule turns ${COLOR_NAME[from]} into ${COLOR_NAME[e.color]}.`,
            `Aturan CHANGE mengubah ${COLOR_NAME_ID[from]} menjadi ${COLOR_NAME_ID[e.color]}.`,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  const analysisEn: string[] = [
    `Forward chain depth: ${depth} machine step(s); ${rules} rule(s) fired.`,
    'Backward view: the target is read first, then the build is designed back toward the incoming stream.',
  ];
  const analysisId: string[] = [
    `Kedalaman rantai maju: ${depth} tahap mesin; ${rules} aturan aktif.`,
    'Pandangan mundur: target dibaca lebih dulu, lalu susunan dirancang kembali ke aliran masuk.',
  ];
  let suggestionEn = 'Suggestion: read the trace from INPUT to OUTPUT and check the first step where the chain changes.';
  let suggestionId = 'Saran: baca jejaknya dari INPUT ke OUTPUT dan periksa tahap pertama saat rantainya berubah.';

  if (verdict.kind === 'win' && !verdict.leak) {
    analysisEn.push('Analysis: every target output matched and no token leaked.');
    analysisId.push('Analisis: semua output target cocok dan tidak ada token yang bocor.');
    suggestionEn = 'Suggestion: the chain is clean; a shorter chain can make the system neater.';
    suggestionId = 'Saran: rantainya bersih; rantai yang lebih pendek bisa membuat sistemnya lebih rapi.';
  } else if (verdict.kind === 'win' && verdict.leak?.kind === 'stuck') {
    const at = nodeName(verdict.leak.at, placed);
    analysisEn.push(`Analysis: the target matched, but a ${COLOR_NAME[verdict.leak.color]} token stopped at ${at}.`);
    analysisId.push(`Analisis: target cocok, tetapi token ${COLOR_NAME_ID[verdict.leak.color]} berhenti di ${at}.`);
    suggestionEn = `Suggestion: a clean system sends every token out; check the path after ${at}.`;
    suggestionId = `Saran: sistem yang bersih mengirim semua token keluar; periksa jalur setelah ${at}.`;
  } else if (verdict.kind === 'win' && verdict.leak?.kind === 'leftover') {
    const title = nodeLabel(placed[verdict.leak.nodeId]).title;
    analysisEn.push(`Analysis: the target matched, but ${verdict.leak.count} token(s) stayed inside ${title}.`);
    analysisId.push(`Analisis: target cocok, tetapi ${verdict.leak.count} token tertinggal di dalam ${title}.`);
    suggestionEn = `Suggestion: make sure ${title} can release every token it holds.`;
    suggestionId = `Saran: pastikan ${title} bisa melepas semua token yang ditahannya.`;
  } else if (verdict.kind === 'stuck') {
    const at = nodeName(verdict.at, placed);
    analysisEn.push(`Analysis: a ${COLOR_NAME[verdict.color]} token stopped at ${at}, so the chain could not finish.`);
    analysisId.push(`Analisis: token ${COLOR_NAME_ID[verdict.color]} berhenti di ${at}, jadi rantainya tidak bisa selesai.`);
    suggestionEn = 'Suggestion: every used way out needs a connected belt path.';
    suggestionId = 'Saran: setiap jalan keluar yang dipakai membutuhkan jalur belt yang tersambung.';
  } else if (verdict.kind === 'leftover') {
    const title = nodeLabel(placed[verdict.nodeId]).title;
    analysisEn.push(`Analysis: ${verdict.count} token(s) stayed inside ${title}; its release condition was not completed.`);
    analysisId.push(`Analisis: ${verdict.count} token tertinggal di dalam ${title}; syarat pelepasannya belum terpenuhi.`);
    suggestionEn = `Suggestion: check what ${title} still needs before it can release tokens.`;
    suggestionId = `Saran: periksa apa yang masih dibutuhkan ${title} sebelum bisa melepas token.`;
  } else if (verdict.kind === 'package') {
    analysisEn.push(`Analysis: ${outputLabel(verdict.output)} received tokens outside complete packs of ${verdict.size}.`);
    analysisId.push(`Analisis: ${outputLabel(verdict.output)} menerima token di luar paket lengkap berisi ${verdict.size}.`);
    suggestionEn = 'Suggestion: tokens for this output must arrive in complete packs.';
    suggestionId = 'Saran: token untuk output ini harus tiba dalam paket yang lengkap.';
  } else if (verdict.kind === 'mismatch') {
    const diff = firstDifference(verdict.got, verdict.want);
    analysisEn.push(
      `Analysis: ${outputLabel(verdict.output)} first differs at position ${diff + 1}; got ${verdict.got.length} token(s), target needs ${verdict.want.length}.`,
    );
    analysisId.push(
      `Analisis: ${outputLabel(verdict.output)} pertama kali berbeda pada posisi ${diff + 1}; hasil berisi ${verdict.got.length} token, target membutuhkan ${verdict.want.length}.`,
    );
    suggestionEn = 'Suggestion: compare the collected output with the target order, starting from the first difference.';
    suggestionId = 'Saran: bandingkan output yang terkumpul dengan urutan target, mulai dari perbedaan pertama.';
  }

  void level;
  return { depth, rules, steps, analysisEn, analysisId, suggestionEn, suggestionId };
}
