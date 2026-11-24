import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Board from './Board';
import DustOverlay from './DustOverlay';
import GuideBook from './GuideBook';
import { preloadAssemblies } from '../assembly';
import { computeMetrics, isBetter, simulate, starsFor, starsForExpert } from '../engine';
import type { Emit, Verdict } from '../engine';
import { sfx } from '../audio/sfx';
import { anchorOf, camBasis, cellCenter, connPoints, fpCenterOf, pickCell, portPos, railsUsed, screenToGridFloat } from '../geometry';
import { CHAPTER_BG, COLOR_HEX, COLOR_NAME, COLOR_NAME_ID, BELT_IMG, HOST_POSES, MACHINE_NOTE, nodeImg, tokenImg, nodeKey, nodeLabel, nodeName, splitRoutingOf, exclusiveSplitRouting } from '../nodeMeta';
import type { ColorCode, Conns, Level, Metrics, NodeDef, NodeType, OutputId, PlacedNode, PortIdx, SplitRouting } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FIRST_LEVEL_ID = 'c1-1';
const CONFETTI_COLORS = ['#E5534B', '#2E6FDB', '#35A852', '#FF8C1A', '#FFA02E'];
/** First-visit tutorial: Pio the foreman greets the player on Level 1,
 *  spotlights each part of the job, and only moves on when the player
 *  has actually done the step. Stored once done (or skipped). */
const TUT_KEY = 'alur.tutorial.done.v1';
const TUT_TEXT = [
  "Hi! I'm Pio, your foreman. Welcome to your first system — I'll show you the job. It takes one minute.",
  'This is the INPUT. Tokens come in here, from the left.',
  'Look closer — the INCOMING pill. That is exactly what arrives, in that order. Read it every level.',
  'And this is the OUTPUT, on the right. Tokens must leave here.',
  'The TARGET pill is the job: these tokens, in this order, must come out. Turn what comes in into what must come out.',
  'For this job you need the red FILTER. Take it from the rack — click it, or drag it onto the board.',
  'Now put it on the board. The glowing cell is a good home for it.',
  'Connect the belts: drag from the INPUT to your FILTER, then from the FILTER to the OUTPUT.',
  'Press RUN and watch your system work!',
  "You did it! That is the whole job, every level: read what comes in, build the system, match the target. If you forget how a machine works, this book shows you — it even shows them working.",
];
const TUT_RUNNING_TEXT = 'Look at the board — your system is working!';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type ResultState =
  | { win: true; metrics: Metrics; stars: number; rails: number; par: number; refRails: number; isNewBest: boolean; prevBest: Metrics | null; leakText?: string }
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
  const [carryPos, setCarryPos] = useState<{ x: number; y: number } | null>(null);
  const [dragUid, setDragUid] = useState<number | null>(null);
  const rackDragRef = useRef<{ x: number; y: number; uid: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [collected, setCollected] = useState<Partial<Record<string, ColorCode[]>>>({});
  const [bufLabels, setBufLabels] = useState<Record<string, string>>({});
  const [bufFill, setBufFill] = useState<Record<string, { held: number; cap: number }>>({});
  const [activeMachines, setActiveMachines] = useState<ReadonlySet<string>>(new Set());
  // Self-assembly trigger for the board: set on place (fromCell null)
  // and on move (fromCell = the anchor the machine just left).
  const [assembly, setAssembly] = useState<{ id: string; fromCell: string | null; nonce: number } | null>(null);
  useEffect(() => {
    preloadAssemblies(effLevel.chapter);
  }, [effLevel.chapter]);
  const activeTimersRef = useRef<Map<string, number>>(new Map());
  const tokenNodeRef = useRef<Map<number, string>>(new Map());
  const arrivalsRef = useRef<Record<string, number>>({});
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
  const [tutStep, setTutStep] = useState<number | null>(null);
  const [tutRect, setTutRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (isFirst && !localStorage.getItem(TUT_KEY)) setTutStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function endTutorial() {
    localStorage.setItem(TUT_KEY, '1');
    setTutStep(null);
    setTutRect(null);
  }
  const [dragRails, setDragRails] = useState<number | null>(null);
  const [routeEditId, setRouteEditId] = useState<string | null>(null);
  const [camAngle, setCamAngle] = useState(0);
  // The Guide Book lives behind its rack button, shown only when the
  // player asks.
  const [noteOpen, setNoteOpen] = useState(false);

  function toggleNote() {
    setNoteOpen((open) => !open);
    sfx.click();
  }

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

  // While a rack drag is alive, the carried machine follows the cursor
  // as a floating image and its rack slot stands empty. The image hands
  // over to the board's landing ghost only over a real grid cell — the
  // board SVG spans the whole card, grey surround included, so "inside
  // the SVG" would swallow the carried machine far too early.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const start = rackDragRef.current;
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 6) {
        setCarryPos(null);
        return;
      }
      setDragUid(start.uid);
      const svg = svgRef.current;
      let overCell = false;
      if (svg) {
        const r = svg.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          overCell =
            pickCell(((e.clientX - r.left) * 960) / r.width, ((e.clientY - r.top) * 560) / r.height, angleRef.current) !== null;
        }
      }
      setCarryPos(overCell ? null : { x: e.clientX, y: e.clientY });
    }
    function onUp() {
      rackDragRef.current = null;
      setCarryPos(null);
      setDragUid(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

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
    img.setAttribute('href', tokenImg(effLevel.chapter, color));
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

  function moveAlong(vis: TokenVis, pts: { x: number; y: number; l: number }[], onProgress?: (d: number) => void): Promise<boolean> {
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
        if (onProgress) onProgress(d);
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

  /** Pixel-crumb burst in the token layer; resolves when the last crumb dies. */
  function burstFx(x: number, y: number, fill: string, count: number): Promise<void> {
    return new Promise((resolve) => {
      const layer = tokenLayerRef.current;
      if (!layer) {
        resolve();
        return;
      }
      interface Crumb {
        n: SVGRectElement;
        px: number;
        py: number;
        vx: number;
        vy: number;
        life: number;
        max: number;
        size: number;
      }
      const crumbs: Crumb[] = [];
      for (let i = 0; i < count; i++) {
        const size = 3.5 + Math.random() * 3.5;
        const n = document.createElementNS(SVG_NS, 'rect') as unknown as SVGRectElement;
        n.setAttribute('fill', i % 4 === 3 ? '#8A929C' : fill);
        layer.appendChild(n);
        crumbs.push({
          n,
          px: x,
          py: y,
          vx: (Math.random() - 0.35) * 130,
          vy: -(40 + Math.random() * 110),
          life: 0,
          max: 210 + Math.random() * 100,
          size,
        });
      }
      let last = performance.now();
      function frame(t: number) {
        const dt = Math.min(50, t - last);
        last = t;
        let alive = false;
        for (const c of crumbs) {
          if (!c.n.isConnected) continue;
          c.life += dt;
          if (c.life >= c.max) {
            c.n.remove();
            continue;
          }
          alive = true;
          c.vy += 640 * (dt / 1000);
          c.px += c.vx * (dt / 1000);
          c.py += c.vy * (dt / 1000);
          const q = 1 - c.life / c.max;
          const s = Math.max(0.4, c.size * q);
          c.n.setAttribute('x', String(c.px - s / 2));
          c.n.setAttribute('y', String(c.py - s / 2));
          c.n.setAttribute('width', String(s));
          c.n.setAttribute('height', String(s));
          c.n.setAttribute('opacity', String(Math.min(1, q * 1.7)));
        }
        if (alive) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  /** FILTER shredding a token: a quick squash, then it comes apart in crumbs. */
  async function shredToken(vis: TokenVis): Promise<void> {
    const x = vis.x;
    const y = vis.y;
    const fill = COLOR_HEX[vis.color];
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const s0 = vis.s;
      function frame(t: number) {
        if (!vis.g.isConnected) {
          resolve();
          return;
        }
        const k = Math.min(1, (t - t0) / 55);
        vis.s = s0 * (1 - 0.18 * k);
        applyTransform(vis);
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    sfx.trash();
    vis.g.remove();
    await burstFx(x, y - 14, fill, 12);
  }

  /** Drives a belt's flow-line dash offset from the token's travelled distance. */
  function flowProgress(key: string): ((d: number) => void) | undefined {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const line = svg.querySelector(`g[data-conn="${key}"] .flow-line`);
    if (!line) return undefined;
    return (d: number) => line.setAttribute('stroke-dashoffset', String(-d * 0.5));
  }

  /** Lights a machine's glow + beacon for a moment while it works. */
  function markActive(id: string | undefined) {
    if (!id) return;
    setActiveMachines((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const timers = activeTimersRef.current;
    const old = timers.get(id);
    if (old) window.clearTimeout(old);
    timers.set(
      id,
      window.setTimeout(() => {
        timers.delete(id);
        setActiveMachines((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 750),
    );
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
        if (vis) {
          tokensRef.current.set(e.token, vis);
          tokenNodeRef.current.set(e.token, 'IN');
        }
        break;
      }
      case 'spawnAt': {
        const p = anchorOf(e.nodeId, angleRef.current);
        const vis = createToken(p.x, p.y, e.color);
        if (vis) {
          tokensRef.current.set(e.token, vis);
          tokenNodeRef.current.set(e.token, e.nodeId);
          markActive(e.nodeId);
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
          const ok = await moveAlong(vis, connPoints(e.fromId, conn, angleRef.current), flowProgress(key));
          setBeltLive(key, false);
          if (!ok) break;
        }
        tokenNodeRef.current.set(e.token, e.toId);
        markActive(e.toId);
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
          const ok = await moveAlong(vis, connPoints(e.fromId, conn, angleRef.current), flowProgress(key));
          setBeltLive(key, false);
          if (!ok) break;
        }
        dropToken(e.token);
        tokenNodeRef.current.delete(e.token);
        break;
      }
      case 'moveToPort': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          const fp = portPos(e.fromId, e.outIdx, placedRef.current, angleRef.current);
          await moveVisual(vis, fp.x, fp.y);
          dropToken(e.token);
          tokenNodeRef.current.delete(e.token);
        }
        break;
      }
      case 'trash': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          tokensRef.current.delete(e.token);
          tokenNodeRef.current.delete(e.token);
          markActive(e.atId);
          await shredToken(vis);
        }
        break;
      }
      case 'arrive': {
        const vis = tokensRef.current.get(e.token);
        if (vis) await pulseToken(vis);
        dropToken(e.token);
        tokenNodeRef.current.delete(e.token);
        markActive(e.output);
        const seenArrivals = (arrivalsRef.current[e.output] ?? 0) + 1;
        arrivalsRef.current[e.output] = seenArrivals;
        const wantArrivals = effLevel.target[e.output]?.length ?? 0;
        if (vis && wantArrivals > 0 && seenArrivals === wantArrivals) {
          void burstFx(vis.x, vis.y - 14, COLOR_HEX[e.color], 14);
        }
        sfx.collect();
        setCollected((prev) => ({ ...prev, [e.output]: [...(prev[e.output] ?? []), e.color] }));
        break;
      }
      case 'store': {
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          await moveVisual(vis, vis.x, vis.y + 5, 0.25);
          dropToken(e.token);
        }
        markActive(e.nodeId);
        if (e.capacity) {
          setBufFill((prev) => ({ ...prev, [e.nodeId]: { held: e.held, cap: e.capacity as number } }));
        }
        setBufLabels((prev) => ({
          ...prev,
          [e.nodeId]: e.capacity ? `stored ${e.held}/${e.capacity}` : `stored ${e.held}`,
        }));
        break;
      }
      case 'releaseStart':
        sfx.bufferRelease();
        markActive(e.nodeId);
        setBufLabels((prev) => ({ ...prev, [e.nodeId]: '' }));
        setBufFill((prev) => {
          const next = { ...prev };
          delete next[e.nodeId];
          return next;
        });
        break;
      case 'held':
        setBufLabels((prev) => ({
          ...prev,
          [e.nodeId]: e.held > 0 ? `stored ${e.held}` : '',
        }));
        setBufFill((prev) =>
          prev[e.nodeId] ? { ...prev, [e.nodeId]: { held: e.held, cap: prev[e.nodeId].cap } } : prev,
        );
        break;
      case 'transformed': {
        sfx.transform();
        markActive(tokenNodeRef.current.get(e.token));
        const vis = tokensRef.current.get(e.token);
        if (vis) {
          vis.color = e.color;
          vis.img.setAttribute('href', tokenImg(effLevel.chapter, e.color));
          void burstFx(vis.x, vis.y - 14, COLOR_HEX[e.color], 7);
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
    setBufFill({});
    setActiveMachines(new Set());
    arrivalsRef.current = {};
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
      // A win with a leak still passes — the output contract was met — but
      // it is not a clean system, so it caps at two stars.
      const leak = res.verdict.leak;
      let stars = expert
        ? starsForExpert(expertRefNodes, expertRefRails, expert.railLimit, metrics, railsUsed(conns))
        : starsFor(level, metrics, railsUsed(conns));
      if (leak) stars = Math.min(stars, 2);
      const leakText = !leak
        ? undefined
        : leak.kind === 'stuck'
          ? `But a ${COLOR_NAME[leak.color]} token stopped at ${nodeName(leak.at, defs)} — it never got out, so this run caps at two stars.`
          : `But ${leak.count} token(s) stayed inside ${nodeLabel(defs[leak.nodeId]).title} — never sent out, so this run caps at two stars.`;
      setResult({
        win: true,
        metrics,
        stars,
        rails: railsUsed(conns),
        par: expert ? expertRefNodes : level.par,
        refRails: expert ? expertRefRails : (level.refRails ?? railsUsed(level.solution.connections)),
        isNewBest: isBetter(metrics, best),
        prevBest: best,
        leakText,
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
    setBufFill({});
    setActiveMachines(new Set());
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
    // A generic rack SPLIT is born with a starter route that spreads the
    // colors one per end — the level's first color up, second by the
    // middle end, third down, and any color the level never produces
    // dealt onto an end still free — and the player adjusts it per
    // machine in the Route editor.
    let placedNode: PlacedNode = node;
    if (node.type === 'split' && !node.color && !node.route && level.stream.length) {
      const colorOrder: ColorCode[] = [];
      for (const c of level.stream) if (!colorOrder.includes(c)) colorOrder.push(c);
      const defs = [
        ...(expert ? expert.tray : level.tray),
        ...(expert ? Object.values(expert.locked) : []),
      ];
      for (const d of defs) {
        if ((d.type === 'transform' || d.type === 'merge') && d.to && !colorOrder.includes(d.to)) {
          colorOrder.push(d.to);
        }
      }
      const byColor: Partial<Record<ColorCode, PortIdx>> = {};
      const portOrder: PortIdx[] = [0, 2, 1];
      colorOrder.slice(0, 3).forEach((c, i) => {
        byColor[c] = portOrder[i];
      });
      // Deal any color the level never produces onto the ends still free,
      // so the machine's routing is a complete one-color-per-end spread.
      const usedPorts = new Set(Object.values(byColor));
      for (const c of ['R', 'B', 'G'] as ColorCode[]) {
        if (byColor[c] !== undefined) continue;
        const free = portOrder.find((p) => !usedPorts.has(p));
        if (free === undefined) break;
        byColor[c] = free;
        usedPorts.add(free);
      }
      placedNode = { ...node, route: { byColor, other: 1 } };
    }
    setPlaced({ ...placed, [cell]: placedNode });
    setAssembly({ id: cell, fromCell: null, nonce: Date.now() });
    // Dropped onto a running belt: the board already split the belt around
    // the machine — adopt the spliced connections as-is.
    if (splice) setConns(splice);
    sfx.place();
    setSelTray(null);
    hintSay('Now drag from INPUT to this machine to lay the belt.');
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
    setAssembly({ id: newAnchor, fromCell: id, nonce: Date.now() });
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

  // The rack press selects at once, so a drag that starts on the rack
  // already carries the machine: the board drops it where the press is
  // released. The click that ends a plain press is swallowed when the
  // press already selected (it would toggle the machine straight off);
  // clicking an already-selected machine still deselects it.
  const trayPressRef = useRef<number | null>(null);
  function pressTray(n: PlacedNode, x: number, y: number) {
    if (running) return;
    if (selTray === n.uid) {
      trayPressRef.current = null;
      return;
    }
    trayPressRef.current = n.uid;
    rackDragRef.current = { x, y, uid: n.uid };
    setSelTray(n.uid);
    sfx.select();
    hintSay('Click an empty cell to place it — or drag it onto the board.');
  }

  function clickTray(n: PlacedNode) {
    if (running) return;
    if (trayPressRef.current === n.uid) {
      trayPressRef.current = null;
      return;
    }
    const selecting = selTray !== n.uid;
    setSelTray(selecting ? n.uid : null);
    if (selecting) sfx.select();
    else sfx.click();
    hintSay(selecting ? 'Click an empty cell to place it — or drag it onto the board.' : '');
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
      if (key === 'other') {
        const cur = splitRoutingOf(n);
        return { ...prev, [routeEditId]: { ...n, route: { byColor: { ...cur.byColor }, other: port } } };
      }
      // One color per end: moving a color onto an occupied end swaps the
      // two colors — the displaced color takes the moved color's old end.
      const cur = exclusiveSplitRouting(n);
      const from = cur.byColor[key] ?? cur.other;
      if (from === port) return prev;
      const byColor = { ...cur.byColor };
      const occupant = (Object.keys(byColor) as ColorCode[]).find((c) => byColor[c] === port);
      byColor[key] = port;
      if (occupant && occupant !== key) byColor[occupant] = from;
      return { ...prev, [routeEditId]: { ...n, route: { byColor, other: cur.other } } };
    });
    sfx.select();
    touchEdit();
  }

  const editNode = routeEditId ? placed[routeEditId] ?? null : null;
  const editRouting = editNode && editNode.type === 'split' ? exclusiveSplitRouting(editNode) : null;
  /** The game has exactly three colors; the Route editor always offers all of them. */
  const ALL_COLORS: ColorCode[] = ['R', 'B', 'G'];

  const selNode = selTray !== null ? trayState.find((n) => n.uid === selTray) ?? null : null;
  const railsNow = dragRails ?? railsUsed(conns);
  const placedAny = Object.keys(placed).length > 0;
  const hasInConn = Object.keys(conns).some((k) => k.startsWith('IN:'));
  const hasOutConn = Object.values(conns).some(
    (c) => c.to !== null && (level.outputs as string[]).includes(c.to),
  );
  const coachDone = [selTray !== null || placedAny, placedAny, hasInConn && hasOutConn, ranOnce];
  // The tutorial borrows the board's own teaching visuals: a marker on
  // the suggested cell and a hand travelling the next connection. They
  // teach controls, never solutions — and only on the first level.
  const firstPlacedId = Object.keys(placed)[0] ?? null;
  const suggestedCell =
    Object.entries(level.solution.placements).find(([, d]) => d.type === 'filter')?.[0] ?? null;
  const coachCell = tutStep === 6 ? suggestedCell : null;
  const coachPath =
    tutStep === 7 && firstPlacedId
      ? !hasInConn
        ? { from: 'IN', to: firstPlacedId }
        : !hasOutConn
          ? { from: firstPlacedId, to: level.outputs[0] }
          : null
      : null;

  // Tutorial steps 5–8 advance on the player's own actions.
  useEffect(() => {
    if (tutStep === 5 && coachDone[0]) setTutStep(6);
    else if (tutStep === 6 && coachDone[1]) setTutStep(7);
    else if (tutStep === 7 && coachDone[2]) setTutStep(8);
    else if (tutStep === 8 && won) setTutStep(9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutStep, coachDone, won]);

  // Spotlight rectangle for the current tutorial step, in viewport
  // coordinates. DOM targets are measured directly; board targets are
  // converted from SVG space through the board's own bounding box.
  useEffect(() => {
    if (tutStep === null) {
      setTutRect(null);
      return;
    }
    const compute = () => {
      const pad = 10;
      const dom = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
      };
      const svgBox = (cx: number, cy: number, w: number, h: number) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const r = svg.getBoundingClientRect();
        const s = Math.min(r.width / 960, r.height / 560);
        const ox = r.left + (r.width - 960 * s) / 2;
        const oy = r.top + (r.height - 560 * s) / 2;
        return { x: ox + (cx - w / 2) * s, y: oy + (cy - h / 2) * s, w: w * s, h: h * s };
      };
      // Tight box around a machine's sequence pill (INCOMING / TARGET):
      // the pill floats above the sprite, its size follows the sequence.
      const pillBox = (id: string, seqLen: number) => {
        const c = fpCenterOf(id, placed, camAngle);
        const rows = Math.max(1, Math.ceil(seqLen / 6));
        const pillH = rows * 20 - 3 + 22;
        const pillW = Math.min(seqLen, 6) * 20 - 3 + 16;
        const pillTop = c.y - 106 - pillH;
        return svgBox(c.x, pillTop + pillH / 2, pillW + 34, pillH + 30);
      };
      let rect: { x: number; y: number; w: number; h: number } | null = null;
      if (tutStep === 1) {
        const c = fpCenterOf('IN', placed, camAngle);
        rect = svgBox(c.x, c.y - 34, 190, 200);
      } else if (tutStep === 2) {
        rect = pillBox('IN', level.stream.length);
      } else if (tutStep === 3) {
        const c = fpCenterOf(level.outputs[0], placed, camAngle);
        rect = svgBox(c.x, c.y - 34, 210, 200);
      } else if (tutStep === 4) {
        rect = pillBox(level.outputs[0], (level.target[level.outputs[0]] ?? []).length);
      } else if (tutStep === 5) {
        rect = dom('[data-tut="rack-filter"]');
      } else if (tutStep === 6 && suggestedCell) {
        const c = cellCenter(suggestedCell, camAngle);
        rect = svgBox(c.x, c.y - 30, 130, 130);
      } else if (tutStep === 7) {
        const a = fpCenterOf('IN', placed, camAngle);
        const b = fpCenterOf(level.outputs[0], placed, camAngle);
        const mid = firstPlacedId ? fpCenterOf(firstPlacedId, placed, camAngle) : a;
        const minX = Math.min(a.x, b.x, mid.x) - 95;
        const maxX = Math.max(a.x, b.x, mid.x) + 95;
        const minY = Math.min(a.y, b.y, mid.y) - 130;
        const maxY = Math.max(a.y, b.y, mid.y) + 45;
        rect = svgBox((minX + maxX) / 2, (minY + maxY) / 2, maxX - minX, maxY - minY);
      } else if (tutStep === 8) {
        // While the system runs, the light belongs on the board itself.
        rect = running ? svgBox(480, 280, 984, 584) : dom('[data-tut="run"]');
      } else if (tutStep === 9) {
        rect = dom('[data-tut="guide"]');
      }
      setTutRect(rect);
    };
    compute();
    const iv = window.setInterval(compute, 200);
    window.addEventListener('resize', compute);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('resize', compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutStep, camAngle, running]);

  return (
    <div className="game-card">
      <img className="game-backdrop" src={CHAPTER_BG[effLevel.chapter]} alt="" />
      <DustOverlay />
      {carryPos && selNode && (
        <img
          className="carry-img"
          src={nodeImg(effLevel.chapter, selNode.type)}
          alt=""
          style={{ left: carryPos.x, top: carryPos.y }}
        />
      )}
      <div className="vignette-overlay" />
      {tutStep !== null && (
        <div className="tut-root">
          {tutRect ? (
            <div
              className="tut-hole"
              style={{ left: tutRect.x, top: tutRect.y, width: tutRect.w, height: tutRect.h }}
            />
          ) : (
            <div className="tut-full" />
          )}
          {(tutStep <= 4 || tutStep === 9) && <div className="tut-blocker" />}
          <div className="tut-stage">
            <div className="tut-bubble">
              <div className="tut-name">PIO — YOUR FOREMAN</div>
              <p>{tutStep === 8 && running ? TUT_RUNNING_TEXT : TUT_TEXT[tutStep]}</p>
              <div className="tut-actions">
                {tutStep <= 4 && (
                  <button
                    className="tut-next"
                    onClick={() => {
                      sfx.click();
                      setTutStep(tutStep + 1);
                    }}
                  >
                    Next ▶
                  </button>
                )}
                {tutStep === 9 && (
                  <button
                    className="tut-next"
                    onClick={() => {
                      sfx.click();
                      endTutorial();
                    }}
                  >
                    Got it!
                  </button>
                )}
                {tutStep >= 5 && tutStep <= 8 && !(tutStep === 8 && running) && (
                  <span className="tut-do">Do it — I'm watching!</span>
                )}
                <button className="tut-skip" onClick={endTutorial}>
                  Skip tutorial
                </button>
              </div>
            </div>
            <img
              className="tut-pio"
              src={tutStep === 0 ? HOST_POSES.wave : tutStep === 9 ? HOST_POSES.cheer : HOST_POSES.point}
              alt=""
            />
          </div>
        </div>
      )}
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
        <h2>{lang === 'id' ? level.nameId : level.name}</h2>
        <p dangerouslySetInnerHTML={{ __html: lang === 'en' ? level.brief : level.briefId }} />
        <button
          className="ghost translate-btn"
          onClick={() => {
            sfx.click();
            setLang(lang === 'en' ? 'id' : 'en');
          }}
        >
          {lang === 'en' ? 'Translate to Indonesian' : 'Show English'}
        </button>
      </div>

      <div className="sandbox-card">
        {noteOpen && <GuideBook chapter={effLevel.chapter} onClose={toggleNote} />}
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
                  className={
                    'tray-item' +
                    (selTray === n.uid ? ' selected' : '') +
                    (dragUid === n.uid ? ' picked' : '') +
                    (tutStep === 5 && n.type === 'filter' && n.color === 'R' ? ' coach-ring' : '')
                  }
                  onClick={() => clickTray(n)}
                  onPointerDown={(e) => pressTray(n, e.clientX, e.clientY)}
                  data-tut={n.type === 'filter' && n.color === 'R' ? 'rack-filter' : undefined}
                >
                  <img src={nodeImg(effLevel.chapter, n.type)} alt={lb.title} draggable={false} />
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
          {isFirst && (
            <button
              className="ghost note-toggle"
              onClick={() => {
                sfx.click();
                setTutStep(0);
              }}
            >
              Tutorial
            </button>
          )}
          <button className="ghost note-toggle" data-tut="guide" onClick={toggleNote}>
            {noteOpen ? 'Hide guide' : 'Guide book'}
          </button>
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
            Belts: {railsNow} / {effLevel.railLimit}
          </span>
          {expert && (
            <span className="expert-note">
              EXPERT — fewer belts · limited rack · blocked cells · locked machines
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
          <div className="rotate-hint">Turn your phone sideways — the board gets much bigger.</div>
          <Board
            level={effLevel}
            placed={placed}
            conns={conns}
            ghost={selNode}
            running={running}
            bufLabels={bufLabels}
            bufFill={bufFill}
            activeMachines={activeMachines}
            assembly={assembly}
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
            coachCell={coachCell}
            coachPath={coachPath}
          />
          <div className="board-actions">
            <button
              className={'run' + (tutStep === 8 ? ' coach-ring' : '')}
              data-tut="run"
              onClick={doRun}
              disabled={running}
            >
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
          </div>
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
                {(
                  [
                    { port: 0 as PortIdx, label: 'UP' },
                    { port: 2 as PortIdx, label: 'MIDDLE' },
                    { port: 1 as PortIdx, label: 'DOWN' },
                  ]
                ).map(({ port, label }) => (
                  <div className="route-row" key={label}>
                    <span className="route-port">{label}</span>
                    <span className="route-seg" role="group" aria-label={label + ' end color'}>
                      {ALL_COLORS.map((c) => (
                        <button
                          key={c}
                          className={(editRouting.byColor[c] ?? editRouting.other) === port ? 'active' : ''}
                          onClick={() => updateRoute(c, port)}
                        >
                          <span className="route-swatch" style={{ background: COLOR_HEX[c] }} />
                          {COLOR_NAME[c]}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {won && (
      <div className="controls">
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
      )}

      <div className="collected">
        {level.outputs.map((o) => (
          <span className="grp" key={o}>
            <b>{o === 'OUT' ? 'Output' : 'Output ' + o}:</b>{' '}
            {(collected[o] ?? []).length ? (
              (collected[o] ?? []).map((c, i) => (
                <img key={i} className="tok-mini" src={tokenImg(effLevel.chapter, c)} alt={COLOR_NAME[c]} />
              ))
            ) : (
              <span style={{ color: 'var(--ink-soft)' }}>(none yet)</span>
            )}
          </span>
        ))}
      </div>

      {result && (result.win ? renderWin(result, effLevel, lang) : renderFail(result))}

    </div>
  );
}

function renderWin(
  r: { metrics: Metrics; stars: number; rails: number; par: number; refRails: number; isNewBest: boolean; prevBest: Metrics | null; leakText?: string },
  level: Level,
  lang: Lang,
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
      <b>It works.</b> {r.leakText ? 'All targets hit' : 'All tokens on target'}
      {hint}
      {r.leakText ? (
        <>
          <br />
          <span>{r.leakText}</span>
        </>
      ) : null}
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
      <span className="concept-line">
        <span className="concept-tag">{lang === 'id' ? 'SISTEM NYATA' : 'REAL SYSTEM'}</span>
        {lang === 'id' ? level.conceptId : level.concept}
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
