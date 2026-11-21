import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Board from './Board';
import { computeMetrics, isBetter, simulate, starsFor, starsForExpert } from '../engine';
import type { Emit, Verdict } from '../engine';
import { sfx } from '../audio/sfx';
import { anchorOf, camBasis, connPoints, portPos, railsUsed, screenToGridFloat } from '../geometry';
import { COLOR_HEX, COLOR_NAME, COLOR_NAME_ID, BELT_IMG, NODE_IMG, TOKEN_IMG, nodeKey, nodeLabel, nodeName, splitRoutingOf } from '../nodeMeta';
import type { ColorCode, Conns, Level, Metrics, NodeDef, OutputId, PlacedNode, PortIdx, SplitRouting } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FIRST_LEVEL_ID = 'c1-1';
const TRASH_Y = 512;
const CONFETTI_COLORS = ['#E5534B', '#2E6FDB', '#35A852', '#FF8C1A', '#FFA02E'];
const COACH_STEPS = [
  '1 · Pick a machine from the rack',
  '2 · Place it on the board',
  '3 · Connect INPUT → OUTPUT',
  '4 · Press RUN',
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type ResultState =
  | { win: true; metrics: Metrics; stars: number; rails: number; par: number; refRails: number; isNewBest: boolean; prevBest: Metrics | null }
  | { win: false; verdict: Verdict; placed: Record<string, NodeDef> };

type Lang = 'en' | 'id';

interface Confetto {
  left: number;
  background: string;
  width: number;
  height: number;
  duration: number;
  delay: number;
}

interface TokenVis {
  g: SVGGElement;
  img: SVGImageElement;
  x: number;
  y: number;
  lift: number;
  s: number;
  color: ColorCode;
}

export type GameMode = 'base' | 'expert';

interface GameScreenProps {
  level: Level;
  mode: GameMode;
  demo: boolean;
  /** Expert unlocks once the base level is completed. */
  expertUnlocked: boolean;
  best: Metrics | null;
  nextLabel: string | null;
  onWin: (level: Level, stars: number, metrics: Metrics, mode: GameMode) => void;
  onModeChange: (mode: GameMode) => void;
  onNext: () => void;
  onBack: () => void;
}

function goalTextFor(level: Level, lang: Lang): string {
  if (lang === 'id' && level.goalTextId) return level.goalTextId;
  if (lang === 'en' && level.goalText) return level.goalText;
  const names = lang === 'id' ? COLOR_NAME_ID : COLOR_NAME;
  return (
    'Target: ' +
    level.outputs
      .map(
        (o) =>
          '<b>' +
          (o === 'OUT' ? 'Output' : 'Output ' + o) +
          '</b> = ' +
          (level.target[o] ?? []).map((c) => names[c]).join(', '),
      )
      .join(' &nbsp;|&nbsp; ')
  );
}

export default function GameScreen({
  level,
  mode,
  demo,
  expertUnlocked,
  best,
  nextLabel,
  onWin,
  onModeChange,
  onNext,
  onBack,
}: GameScreenProps) {
  const expert = mode === 'expert' ? level.expert : undefined;
  const effLevel: Level = expert ? { ...level, railLimit: expert.railLimit } : level;
  const expertRefNodes = expert ? Object.keys(expert.solution.placements).length : 0;
  const expertRefRails = expert ? railsUsed(expert.solution.connections) : 0;
  const isFirst = level.id === FIRST_LEVEL_ID && mode === 'base';
  const uidRef = useRef(1);
  const freshTray = () =>
    (expert ? expert.tray : level.tray).map((d) => ({ ...d, uid: uidRef.current++ }));
  const lockedInit = (): Record<string, PlacedNode> => {
    const out: Record<string, PlacedNode> = {};
    if (expert) {
      for (const [k, d] of Object.entries(expert.locked)) out[k] = { ...d, uid: uidRef.current++ };
    }
    return out;
  };

  const [trayState, setTrayState] = useState<PlacedNode[]>(freshTray);
  const [placed, setPlaced] = useState<Record<string, PlacedNode>>(lockedInit);
  const [conns, setConns] = useState<Conns>({});
  const [selTray, setSelTray] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [collected, setCollected] = useState<Partial<Record<string, ColorCode[]>>>({});
  const [bufLabels, setBufLabels] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultState | null>(null);
  const [won, setWon] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [hint, setHint] = useState<string>(
    isFirst ? 'Click the FILTER machine in the rack.' : '',
  );
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<Confetto[]>([]);
  const [ranOnce, setRanOnce] = useState(false);
  const [dragRails, setDragRails] = useState<number | null>(null);
  const [routeEditId, setRouteEditId] = useState<string | null>(null);
  const [camAngle, setCamAngle] = useState(0);

  const runIdRef = useRef(0);
  const angleRef = useRef(0);
  const camTweenRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tokenLayerRef = useRef<SVGGElement>(null);
  const tokensRef = useRef(new Map<number, TokenVis>());
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const connsRef = useRef(conns);
  connsRef.current = conns;

  useEffect(() => {
    return () => {
      runIdRef.current++;
    };
  }, []);

  // The camera starts at the classic view on every level / mode switch.
  useEffect(() => {
    if (camTweenRef.current) cancelAnimationFrame(camTweenRef.current);
    angleRef.current = 0;
    setCamAngle(0);
  }, [level.id, expert]);

  function applyAngle(deg: number) {
    const norm = ((deg % 360) + 360) % 360;
    angleRef.current = norm;
    setCamAngle(norm);
  }

  function rotateBy(delta: number) {
    if (running) return;
    if (camTweenRef.current) cancelAnimationFrame(camTweenRef.current);
    const from = angleRef.current;
    const to = from + delta;
    const t0 = performance.now();
    const DUR = 260;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DUR);
      const e = 1 - Math.pow(1 - k, 3);
      applyAngle(from + (to - from) * e);
      if (k < 1) camTweenRef.current = requestAnimationFrame(step);
      else camTweenRef.current = null;
    };
    camTweenRef.current = requestAnimationFrame(step);
  }

  function hintSay(txt: string) {
    if (!isFirst) return;
    setHint(txt);
  }

  function flashNode(id: string | null) {
    setFlashNodeId(id);
    if (id) window.setTimeout(() => setFlashNodeId((cur) => (cur === id ? null : cur)), 950);
  }

  // ---- token visuals (imperative, inside the board's token layer) ----
  function clearTokens() {
    tokensRef.current.forEach((v) => v.g.remove());
    tokensRef.current.clear();
    tokenLayerRef.current?.replaceChildren();
  }

  function applyTransform(vis: TokenVis) {
    vis.g.setAttribute('transform', `translate(${vis.x} ${vis.y - vis.lift}) scale(${vis.s})`);
  }

  function updateTokenDepth(vis: TokenVis) {
    const parent = vis.g.parentNode;
    if (!parent) return;
    const ang = angleRef.current;
    const f = screenToGridFloat(vis.x, vis.y, ang);
    const B = camBasis(ang);
    const depth = (f.c * B.ay + f.r * B.by) / 21 + 0.4;
    vis.g.setAttribute('data-depth', String(depth));
    parent.removeChild(vis.g);
    let ref: ChildNode | null = null;
    for (let n = parent.firstChild; n; n = n.nextSibling) {
      const d = (n as Element).getAttribute ? (n as Element).getAttribute('data-depth') : null;
      if (d !== null && parseFloat(d) > depth) {
        ref = n;
        break;
      }
    }
    parent.insertBefore(vis.g, ref);
  }

  function createToken(x: number, y: number, color: ColorCode): TokenVis | null {
    const layer = tokenLayerRef.current;
    if (!layer) return null;
    const g = document.createElementNS(SVG_NS, 'g') as unknown as SVGGElement;
    const img = document.createElementNS(SVG_NS, 'image') as unknown as SVGImageElement;
    img.setAttribute('x', '-20');
    img.setAttribute('y', '-38');
    img.setAttribute('width', '40');
    img.setAttribute('height', '40');
    img.setAttribute('clip-path', 'url(#tokClip)');
    img.setAttribute('href', TOKEN_IMG[color]);
    g.appendChild(img);
    const vis: TokenVis = { g, img, x, y, lift: 0, s: 1, color };
    applyTransform(vis);
    layer.appendChild(g);
    updateTokenDepth(vis);
    return vis;
  }

  function dropToken(token: number) {
    tokensRef.current.get(token)?.g.remove();
    tokensRef.current.delete(token);
  }

  function moveVisual(vis: TokenVis, x: number, y: number, endScale?: number): Promise<boolean> {
    return new Promise((resolve) => {
      const x0 = vis.x;
      const y0 = vis.y;
      const s0 = vis.s;
      const s1 = endScale == null ? s0 : endScale;
      const l0 = vis.lift;
      const t0 = performance.now();
      const DUR = 150;
      function frame(t: number) {
        if (!vis.g.isConnected) {
          resolve(false);
          return;
        }
        const k = Math.min(1, (t - t0) / DUR);
        const e = 1 - Math.pow(1 - k, 2);
        vis.x = x0 + (x - x0) * e;
        vis.y = y0 + (y - y0) * e;
        vis.s = s0 + (s1 - s0) * k;
        vis.lift = l0 * (1 - k);
        applyTransform(vis);
        updateTokenDepth(vis);
        if (k < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function moveAlong(vis: TokenVis, pts: { x: number; y: number; l: number }[]): Promise<boolean> {
    return new Promise((resolve) => {
      if (pts.length < 2) {
        resolve(true);
        return;
      }
      const segs: { x0: number; y0: number; dx: number; dy: number; len: number; acc: number; l0: number; dl: number }[] = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const len = Math.hypot(dx, dy);
        segs.push({ x0: pts[i].x, y0: pts[i].y, dx, dy, len, acc: total, l0: pts[i].l || 0, dl: (pts[i + 1].l || 0) - (pts[i].l || 0) });
        total += len;
      }
      const DUR = Math.max(120, total / 1.45);
      const t0 = performance.now();
      function frame(t: number) {
        if (!vis.g.isConnected) {
          resolve(false);
          return;
        }
        const k = Math.min(1, (t - t0) / DUR);
        const d = k * total;
        let s = segs[segs.length - 1];
        for (const sg of segs) {
          if (d <= sg.acc + sg.len) {
            s = sg;
            break;
          }
        }
        const f = s.len ? Math.min(1, Math.max(0, (d - s.acc) / s.len)) : 1;
        vis.x = s.x0 + s.dx * f;
        vis.y = s.y0 + s.dy * f;
        vis.lift = s.l0 + s.dl * f;
        applyTransform(vis);
        updateTokenDepth(vis);
        if (k < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function pulseToken(vis: TokenVis): Promise<boolean> {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const DUR = 150;
      function frame(t: number) {
        if (!vis.g.isConnected) {
          resolve(false);
          return;
        }
        const k = Math.min(1, (t - t0) / DUR);
        vis.s = 1 + Math.sin(k * Math.PI) * 0.24;
        applyTransform(vis);
        if (k < 1) requestAnimationFrame(frame);
        else {
          vis.s = 1;
          applyTransform(vis);
          resolve(true);
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function setBeltLive(key: string, on: boolean) {
    const svg = svgRef.current;
    if (!svg) return;
    const g = svg.querySelector(`g[data-conn="${key}"]`);
    if (!g) return;
    g.classList.toggle('live', on);
    g.querySelectorAll('image[data-tile]').forEach((img) => {
      const t = img.getAttribute('data-tile');
      if (t) img.setAttribute('href', on ? BELT_IMG.live[t] : BELT_IMG.steel[t]);
    });
  }

  const emit: Emit = async (e) => {
    switch (e.type) {
      case 'spawn': {
        const p = anchorOf('IN', angleRef.current);
        const vis = createToken(p.x, p.y, e.color);
        if (vis) tokensRef.current.set(e.token, vis);
        break;
      }
      case 'spawnAt': {
        const p = anchorOf(e.nodeId, angleRef.current);
        const vis = createToken(p.x, p.y, e.color);
        if (vis) {
          tokensRef.current.set(e.token, vis);
          await pulseToken(vis);
        }
        break;
      }
      case 'move': {
        const vis = tokensRef.current.get(e.token);
        if (!vis) break;
        sfx.hop();
        const key = e.fromId + ':' + e.outIdx;
        const conn = connsRef.current[key];
        if (conn) {
          setBeltLive(key, true);
          const ok = await moveAlong(vis, connPoints(e.fromId, conn, angleRef.current));
          setBeltLive(key, false);
          if (!ok) break;
        }
        const dest = placedRef.current[e.toId];
        if (dest && (dest.type === 'split' || (dest.type === 'filter' && vis.color === dest.color))) {
          await pulseToken(vis);
        }
        break;
      }
      case 'moveOpen': {
        const vis = tokensRef.current.get(e.token);
        if (!vis) break;
        sfx.hop();
        const key = e.fromId + ':' + e.outIdx;
        const conn = connsRef.current[key];
        if (conn) {
          setBeltLive(key, true);
          const ok = await moveAlong(vis, connPoints(e.fromId, conn, angleRef.current));
          setBeltLive(key, false);
          if (!ok) break;
        }
        dropToken(e.token);
        break;
      }
      case 'moveToPort': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          const fp = portPos(e.fromId, e.outIdx, placedRef.current, angleRef.current);
          await moveVisual(vis, fp.x, fp.y);
          dropToken(e.token);
        }
        break;
      }
      case 'trash': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          const p = anchorOf(e.atId, angleRef.current);
          await moveVisual(vis, p.x, TRASH_Y, 0.35);
          vis.g.setAttribute('opacity', '0.3');
          window.setTimeout(() => vis.g.remove(), 80);
          tokensRef.current.delete(e.token);
        }
        break;
      }
      case 'arrive': {
        const vis = tokensRef.current.get(e.token);
        if (vis) await pulseToken(vis);
        dropToken(e.token);
        sfx.collect();
        setCollected((prev) => ({ ...prev, [e.output]: [...(prev[e.output] ?? []), e.color] }));
        break;
      }
      case 'store': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          await moveVisual(vis, vis.x, vis.y, 0.3);
          dropToken(e.token);
        }
        setBufLabels((prev) => ({
          ...prev,
          [e.nodeId]: e.capacity ? `stored ${e.held}/${e.capacity}` : `stored ${e.held}`,
        }));
        break;
      }
      case 'releaseStart':
        sfx.bufferRelease();
        setBufLabels((prev) => ({ ...prev, [e.nodeId]: '' }));
        break;
      case 'transformed': {
        sfx.transform();
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          vis.color = e.color;
          vis.img.setAttribute('href', TOKEN_IMG[e.color]);
          await pulseToken(vis);
        }
        break;
      }
      case 'pause':
        await sleep(e.ms);
        break;
    }
  };

  function placedDefs(): Record<string, NodeDef> {
    const defs: Record<string, NodeDef> = {};
    for (const [k, v] of Object.entries(placed)) {
      const { uid, ...def } = v;
      void uid;
      defs[k] = def;
    }
    return defs;
  }

  async function doRun() {
    if (running) return;
    sfx.runStart();
    const myRun = ++runIdRef.current;
    setRunning(true);
    setResult(null);
    setWon(false);
    setShowStamp(false);
    setConfetti([]);
    setFlashNodeId(null);
    setCollected({});
    setBufLabels({});
    clearTokens();
    const defs = placedDefs();
    const res = await simulate(effLevel, defs, conns, {
      emit,
      isCancelled: () => runIdRef.current !== myRun,
    });
    if (runIdRef.current !== myRun || res.aborted) return;
    setRunning(false);
    setRanOnce(true);
    if (res.verdict.kind === 'win') {
      sfx.win();
      const metrics = computeMetrics(defs, res.hops);
      const stars = expert
        ? starsForExpert(expertRefNodes, expertRefRails, expert.railLimit, metrics, railsUsed(conns))
        : starsFor(level, metrics, railsUsed(conns));
      setResult({
        win: true,
        metrics,
        stars,
        rails: railsUsed(conns),
        par: expert ? expertRefNodes : level.par,
        refRails: expert ? expertRefRails : (level.refRails ?? railsUsed(level.solution.connections)),
        isNewBest: isBetter(metrics, best),
        prevBest: best,
      });
      setWon(true);
      setShowStamp(true);
      setConfetti(
        Array.from({ length: 26 }, (_, i) => ({
          left: 2 + ((i * 37) % 96),
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: 7 + (i % 4),
          height: 10 + (i % 5),
          duration: 1.6 + (i % 7) * 0.2,
          delay: (i % 5) * 0.09,
        })),
      );
      onWin(level, stars, metrics, mode);
    } else {
      sfx.error();
      setResult({ win: false, verdict: res.verdict, placed: defs });
      const v = res.verdict;
      if (v.kind === 'stuck' && defs[v.at]) flashNode(v.at);
      else if (v.kind === 'leftover') flashNode(v.nodeId);
      else if (v.kind === 'package') {
        const tahanCell = Object.keys(defs).find((id) => defs[id].type === 'tahan');
        if (tahanCell) flashNode(tahanCell);
      }
    }
  }

  function resetAll() {
    runIdRef.current++;
    setRunning(false);
    clearTokens();
    setPlaced(lockedInit());
    setConns({});
    setTrayState(freshTray());
    setSelTray(null);
    setCollected({});
    setBufLabels({});
    setResult(null);
    setWon(false);
    setShowStamp(false);
    setConfetti([]);
    setFlashNodeId(null);
    setRanOnce(false);
    setDragRails(null);
    setRouteEditId(null);
    setHint(isFirst ? 'Click the FILTER machine in the rack.' : '');
  }

  function touchEdit() {
    if (won) {
      setWon(false);
      setShowStamp(false);
      setResult(null);
      setConfetti([]);
    }
    setFlashNodeId(null);
  }

  function placeAt(cell: string, splice: Conns | null) {
    if (running) return;
    const i = trayState.findIndex((n) => n.uid === selTray);
    if (i < 0) return;
    const node = trayState[i];
    setTrayState(trayState.filter((_, j) => j !== i));
    setPlaced({ ...placed, [cell]: node });
    // Dropped onto a running belt: the board already split the belt around
    // the machine — adopt the spliced connections as-is.
    if (splice) setConns(splice);
    sfx.place();
    setSelTray(null);
    hintSay('Now hold INPUT until the ring fills, then drag a belt to this machine.');
    touchEdit();
  }

  function moveNode(id: string, newAnchor: string, next: Conns) {
    if (running) return;
    const n = placed[id];
    if (!n) return;
    const nextPlaced = { ...placed };
    delete nextPlaced[id];
    nextPlaced[newAnchor] = n;
    setPlaced(nextPlaced);
    setConns(next);
    if (routeEditId === id) setRouteEditId(newAnchor);
    sfx.place();
    touchEdit();
  }

  function unplace(id: string) {
    if (running) return;
    if (expert && expert.locked[id]) return;
    const n = placed[id];
    if (!n) return;
    const nextPlaced = { ...placed };
    delete nextPlaced[id];
    setPlaced(nextPlaced);
    // Returning a machine to the rack discards its per-instance settings
    // (a customized SPLIT routing goes with it — re-placing starts default).
    const clean = { ...n };
    delete clean.route;
    setTrayState([...trayState, clean]);
    if (routeEditId === id) setRouteEditId(null);
    const nextConns: Conns = {};
    for (const [k, v] of Object.entries(conns)) {
      if (k.split(':')[0] !== id && v.to !== id) nextConns[k] = v;
    }
    setConns(nextConns);
    sfx.remove();
    touchEdit();
  }

  function handleConnsChange(next: Conns, kind: 'connect' | 'delete') {
    if (running) return;
    setConns(next);
    if (kind === 'connect') {
      sfx.connect();
      hintSay('Connect everything to an OUTPUT, then press RUN.');
    } else {
      sfx.remove();
    }
    touchEdit();
  }

  function clickTray(n: PlacedNode) {
    if (running) return;
    const selecting = selTray !== n.uid;
    setSelTray(selecting ? n.uid : null);
    if (selecting) sfx.select();
    else sfx.click();
    hintSay(selecting ? 'Click an empty cell to place it.' : '');
  }

  // ---- SPLIT route editor ----
  function openRouteEditor(id: string) {
    if (running) return;
    if (expert && expert.locked[id]) return; // locked splits keep their routing
    if (!placed[id] || placed[id].type !== 'split') return;
    sfx.click();
    setRouteEditId(id);
  }

  function updateRoute(key: ColorCode | 'other', port: PortIdx) {
    if (!routeEditId) return;
    setPlaced((prev) => {
      const n = prev[routeEditId];
      if (!n || n.type !== 'split') return prev;
      const cur = splitRoutingOf(n);
      const next: SplitRouting = { byColor: { ...cur.byColor }, other: cur.other };
      if (key === 'other') next.other = port;
      else next.byColor[key] = port;
      return { ...prev, [routeEditId]: { ...n, route: next } };
    });
    sfx.select();
    touchEdit();
  }

  const editNode = routeEditId ? placed[routeEditId] ?? null : null;
  const editRouting = editNode && editNode.type === 'split' ? splitRoutingOf(editNode) : null;
  /** Colors worth a row in the editor: the incoming stream plus every color a CHANGE/MERGE in this level can produce (plus the split's own named colors). */
  const routeColors = ((): ColorCode[] => {
    const set = new Set<ColorCode>(level.stream);
    const defs = [
      ...(expert ? expert.tray : level.tray),
      ...(expert ? Object.values(expert.locked) : []),
      ...Object.values(placed),
    ];
    for (const d of defs) {
      if ((d.type === 'transform' || d.type === 'merge') && d.to) set.add(d.to);
    }
    if (editNode?.color) set.add(editNode.color);
    if (editNode?.side) set.add(editNode.side);
    return (['R', 'B', 'G'] as ColorCode[]).filter((c) => set.has(c));
  })();

  const selNode = selTray !== null ? trayState.find((n) => n.uid === selTray) ?? null : null;
  const railsNow = dragRails ?? railsUsed(conns);
  const placedAny = Object.keys(placed).length > 0;
  const hasInConn = Object.keys(conns).some((k) => k.startsWith('IN:'));
  const hasOutConn = Object.values(conns).some(
    (c) => c.to !== null && (level.outputs as string[]).includes(c.to),
  );
  const coachDone = [selTray !== null || placedAny, placedAny, hasInConn && hasOutConn, ranOnce];
  const coachNow = coachDone.indexOf(false);

  return (
    <div className="game-card">
      <div className="topbar">
        <button
          className="ghost"
          onClick={() => {
            sfx.click();
            onBack();
          }}
        >
          ← Level Menu
        </button>
        <span className="topbar-chapter">Chapter {level.chapter}</span>
        {!demo && level.expert && (
          <span className="mode-toggle" role="group" aria-label="Difficulty mode">
            <button
              className={mode === 'base' ? 'active' : ''}
              onClick={() => {
                if (mode !== 'base') {
                  sfx.click();
                  onModeChange('base');
                }
              }}
            >
              Base
            </button>
            <button
              className={mode === 'expert' ? 'active' : ''}
              disabled={!expertUnlocked}
              title={expertUnlocked ? 'Expert variant of this level' : 'Finish the base level to unlock Expert'}
              onClick={() => {
                if (mode !== 'expert') {
                  sfx.click();
                  onModeChange('expert');
                }
              }}
            >
              Expert
            </button>
          </span>
        )}
      </div>

      <div className="brief">
        <h2>{level.name}</h2>
        <p dangerouslySetInnerHTML={{ __html: lang === 'en' ? level.brief : level.briefId }} />
        <div className="stream">
          <span>
            <b>Incoming flow:</b>
          </span>
          <span>
            {level.stream.map((c, i) => (
              <img key={i} className="tok-mini" src={TOKEN_IMG[c]} alt={COLOR_NAME[c]} />
            ))}
          </span>
          <span style={{ marginLeft: 10 }} dangerouslySetInnerHTML={{ __html: goalTextFor(level, lang) }} />
        </div>
        <button
          className="ghost translate-btn"
          onClick={() => {
            sfx.click();
            setLang(lang === 'en' ? 'id' : 'en');
          }}
        >
          {lang === 'en' ? 'Translate to Indonesian' : 'Show English'}
        </button>
        {isFirst && (
          <div className="coach">
            {COACH_STEPS.map((s, i) => (
              <span key={s} className={'step' + (coachDone[i] ? ' done' : i === coachNow ? ' now' : '')}>
                {coachDone[i] ? '✓ ' : ''}
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="sandbox-card">
        <div className="rack-row">
          <span className="tray-label">
            {expert
              ? 'MACHINE RACK — EXPERT (limited stock):'
              : 'MACHINE RACK:'}
          </span>
          <span className="rack-items">
            {trayState.map((n) => {
              const lb = nodeLabel(n);
              const left = trayState.filter((m) => nodeKey(m) === nodeKey(n)).length;
              return (
                <button
                  key={n.uid}
                  className={'tray-item' + (selTray === n.uid ? ' selected' : '')}
                  onClick={() => clickTray(n)}
                >
                  <img src={NODE_IMG[n.type]} alt={lb.title} />
                  <span>
                    {lb.title}
                    {expert && left > 1 && <span className="count">×{left}</span>}
                    <br />
                    <span className="sub">{lb.sub}</span>
                  </span>
                </button>
              );
            })}
            {!trayState.length && (
              <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>(rack empty)</span>
            )}
          </span>
        </div>

        {isFirst && <div className="hint">{hint}</div>}

        <div className="sandbox-meta">
          <span className={'rails' + (railsNow >= effLevel.railLimit ? ' over' : '')}>
            <svg className="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5.2" width="18" height="2.4" rx="1" fillOpacity="0.45" />
              <rect x="3" y="10.8" width="18" height="2.4" rx="1" fillOpacity="0.45" />
              <rect x="3" y="16.4" width="18" height="2.4" rx="1" fillOpacity="0.45" />
              <rect x="7.4" y="3" width="2.6" height="18" rx="1" />
              <rect x="14" y="3" width="2.6" height="18" rx="1" />
            </svg>
            Rails: {railsNow} / {effLevel.railLimit}
          </span>
          {expert && (
            <span className="expert-note">
              EXPERT — fewer rails · limited rack · blocked cells · locked machines
            </span>
          )}
          <span className="cam-controls">
            <button className="cam-btn" onClick={() => rotateBy(-45)} disabled={running} title="Rotate camera left">
              ⟲
            </button>
            <span className="cam-label">CAMERA — drag the floor to spin</span>
            <button className="cam-btn" onClick={() => rotateBy(45)} disabled={running} title="Rotate camera right">
              ⟳
            </button>
          </span>
        </div>

        <div className="board-wrap">
          <Board
            level={effLevel}
            placed={placed}
            conns={conns}
            ghost={selNode}
            running={running}
            bufLabels={bufLabels}
            flashNodeId={flashNodeId}
            obstacles={expert?.obstacles}
            lockedIds={expert ? Object.keys(expert.locked) : []}
            stuckCell={
              result && !result.win && result.verdict.kind === 'stuck' ? result.verdict.cell ?? null : null
            }
            svgRef={svgRef}
            tokenLayerRef={tokenLayerRef}
            angle={camAngle}
            onAngleChange={applyAngle}
            onPlace={placeAt}
            onPlaceRejected={() => hintSay('Pick a machine from the rack first.')}
            onUnplace={unplace}
            onMoveNode={moveNode}
            onEditRoute={openRouteEditor}
            onConnsChange={handleConnsChange}
            onDragRails={setDragRails}
          />
          {confetti.map((c, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: c.left + '%',
                background: c.background,
                width: c.width,
                height: c.height,
                animationDuration: c.duration + 's',
                animationDelay: c.delay + 's',
              }}
            />
          ))}
          <div className={'stamp' + (showStamp ? ' show' : '')}>
            <span>SYSTEM SHIPPED.</span>
          </div>
          {routeEditId && editNode && editRouting && (
            <div
              className="route-overlay"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setRouteEditId(null);
              }}
            >
              <div className="route-panel">
                <div className="route-panel-head">
                  <b>SPLIT ROUTING</b>
                  <span className="route-panel-sub">Which color leaves by which end?</span>
                  <button
                    className="route-close"
                    aria-label="Close route editor"
                    onClick={() => {
                      sfx.click();
                      setRouteEditId(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {routeColors.map((c) => (
                  <div className="route-row" key={c}>
                    <span className="route-color">
                      <span className="route-swatch" style={{ background: COLOR_HEX[c] }} />
                      {COLOR_NAME[c]}
                    </span>
                    <span className="route-seg" role="group" aria-label={COLOR_NAME[c] + ' exit port'}>
                      {(['UP', 'DOWN', 'SIDE'] as const).map((label, i) => (
                        <button
                          key={label}
                          className={(editRouting.byColor[c] ?? editRouting.other) === i ? 'active' : ''}
                          onClick={() => updateRoute(c, i as PortIdx)}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
                <div className="route-row">
                  <span className="route-color">
                    <span className="route-swatch any" />
                    Any other color
                  </span>
                  <span className="route-seg" role="group" aria-label="Any other color exit port">
                    {(['UP', 'DOWN', 'SIDE'] as const).map((label, i) => (
                      <button
                        key={label}
                        className={editRouting.other === i ? 'active' : ''}
                        onClick={() => updateRoute('other', i as PortIdx)}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="controls">
        <button className="run" onClick={doRun} disabled={running}>
          ▶ RUN
        </button>
        <button
          className="ghost"
          onClick={() => {
            sfx.click();
            resetAll();
          }}
        >
          Reset Level
        </button>
        {won && nextLabel && (
          <button
            className="ghost"
            onClick={() => {
              sfx.click();
              onNext();
            }}
          >
            {nextLabel}
          </button>
        )}
        {won && (
          <button className="ghost" onClick={doRun}>
            ↻ Replay Solution
          </button>
        )}
      </div>

      <div className="collected">
        {level.outputs.map((o) => (
          <span className="grp" key={o}>
            <b>{o === 'OUT' ? 'Output' : 'Output ' + o}:</b>{' '}
            {(collected[o] ?? []).length ? (
              (collected[o] ?? []).map((c, i) => (
                <img key={i} className="tok-mini" src={TOKEN_IMG[c]} alt={COLOR_NAME[c]} />
              ))
            ) : (
              <span style={{ color: 'var(--ink-soft)' }}>(none yet)</span>
            )}
          </span>
        ))}
      </div>

      {result && (result.win ? renderWin(result) : renderFail(result))}

    </div>
  );
}

function renderWin(
  r: { metrics: Metrics; stars: number; rails: number; par: number; refRails: number; isNewBest: boolean; prevBest: Metrics | null },
): ReactNode {
  const m = r.metrics;
  const nodeOver = m.node > r.par;
  const railOver = r.rails > r.refRails + Math.max(1, Math.ceil(r.refRails * 0.15));
  const hint =
    r.stars === 3
      ? ' — clean build: few machines, short belts.'
      : nodeOver && railOver
        ? ' — try fewer machines and shorter belts for full stars.'
        : nodeOver
          ? ' — try fewer machines for full stars.'
          : railOver
            ? ' — try shorter belts for full stars.'
            : ' — almost clean. Small tweaks earn full stars.';
  return (
    <div className="result win">
      <span className="stars">
        {[0, 1, 2].map((i) => (
          <span key={i} className={'star' + (i < r.stars ? '' : ' off')} style={{ animationDelay: i * 0.13 + 's' }}>
            ★
          </span>
        ))}
      </span>
      <br />
      <b>It works.</b> All tokens on target
      {hint}
      <br />
      <span className="metrics">
        Node: <b>{m.node}</b> · Space: <b>{m.ruang} cells</b> · Token steps: <b>{m.langkah}</b>
        {r.isNewBest ? (
          <>
            {' '}
            — <b>new best for this level.</b>
          </>
        ) : r.prevBest ? (
          <>
            {' '}
            — your best: Nodes {r.prevBest.node} · Space {r.prevBest.ruang} · Steps {r.prevBest.langkah}.
          </>
        ) : null}
      </span>
    </div>
  );
}

function renderFail(r: { verdict: Verdict; placed: Record<string, NodeDef> }): ReactNode {
  const v = r.verdict;
  let msg: ReactNode = null;
  if (v.kind === 'stuck') {
    msg = v.cell ? (
      <>
        The <b>{COLOR_NAME[v.color]}</b> token stopped at the open end of the belt from{' '}
        <b>{nodeName(v.at, r.placed)}</b>. That belt ends in nowhere.
      </>
    ) : (
      <>
        The <b>{COLOR_NAME[v.color]}</b> token stopped at <b>{nodeName(v.at, r.placed)}</b>. Its way out is
        not connected.
      </>
    );
  } else if (v.kind === 'leftover') {
    const n = r.placed[v.nodeId];
    const title = n ? nodeLabel(n).title : 'BUFFER';
    msg =
      n && n.type === 'merge' ? (
        <>
          <b>{v.count} token(s)</b> stuck inside <b>{title}</b> — no partner came.
        </>
      ) : n && n.type === 'sort' ? (
        <>
          <b>{v.count} token(s)</b> stuck inside <b>{title}</b> — never sent to an Output.
        </>
      ) : (
        <>
          <b>{v.count} token(s)</b> stuck inside <b>{title}</b> — the pack never filled.
        </>
      );
  } else if (v.kind === 'package') {
    const label = v.output === 'OUT' ? 'Output' : 'Output ' + v.output;
    msg = (
      <>
        <b>{label}</b> takes <b>packs of {v.size}</b> only. Something arrived unpacked.
      </>
    );
  } else if (v.kind === 'mismatch') {
    const label = v.output === 'OUT' ? 'Output' : 'Output ' + v.output;
    msg = (
      <>
        <b>{label}</b> got: {v.got.length ? v.got.map((c) => COLOR_NAME[c]).join(', ') : '(nothing)'}.
        Need: {v.want.map((c) => COLOR_NAME[c]).join(', ')}.
      </>
    );
  }
  return <div className="result fail">{msg}</div>;
}
