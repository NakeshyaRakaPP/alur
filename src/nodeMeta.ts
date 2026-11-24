import type { ColorCode, NodeDef, NodeType, PortIdx, SplitRouting } from './types';

/** Asset base: resolved against the deployment base so the same build works
 *  at a domain root or under any subpath (GitHub Pages, portfolio embed). */
const ART = (import.meta.env?.BASE_URL ?? '/') + 'art/iso/';

export const LOGO_IMG = ART + 'logo_alur.png';

export const COLOR_HEX: Record<ColorCode, string> = {
  R: '#E5534B',
  B: '#2E6FDB',
  G: '#35A852',
};

export const COLOR_NAME: Record<ColorCode, string> = {
  R: 'Red',
  B: 'Blue',
  G: 'Green',
};

export const COLOR_NAME_ID: Record<ColorCode, string> = {
  R: 'Merah',
  B: 'Biru',
  G: 'Hijau',
};

export const NODE_IMG: Record<NodeType, string> = {
  filter: ART + 'node_filter.png',
  transform: ART + 'node_change.png',
  split: ART + 'node_split.png',
  tahan: ART + 'node_buffer.png',
  sort: ART + 'node_sort.png',
  merge: ART + 'node_merge.png',
};

/** Deck-plate floor texture sampled by every floor cell (SVG pattern). */
export const FLOOR_TEX_IMG = ART + 'floor_deck.png';
/** Painted backdrop per chapter world (level select + game card). The
 *  Assembly Plant reuses the menu's factory platform painting. */
export const CHAPTER_BG: Record<number, string> = {
  1: ART + 'bg_bakery.jpg',
  2: ART + 'bg_parcel.jpg',
  3: ART + 'bg_warehouse.jpg',
  4: ART + 'backdrop_menu.png',
  5: ART + 'bg_airport.jpg',
};
/** Painted platform scene behind the main menu. */
export const BACKDROP_MENU_IMG = ART + 'backdrop_menu.png';
/** Painted dark deck behind the level select. */
export const BACKDROP_DECK_IMG = ART + 'backdrop_deck.png';

/**
 * One-line behavior note per machine type — mechanics only, in the game's
 * baby language. Shown on demand behind the rack's "Machine notes"
 * button, and listed in How to Play. Never a placement clue.
 */
export const MACHINE_NOTE: Record<NodeType, string> = {
  filter: 'Passes one color. Every other color is thrown away.',
  transform: 'Turns every token into a new color.',
  split: 'Each color leaves by its own end. Use Route to swap ends.',
  tahan: 'Holds tokens, then sends them out in packs.',
  sort: 'Holds tokens, then lets them out color by color, in its order.',
  merge: 'Takes one token from each belt in, joins them into a new color.',
};

export const INPUT_IMG = ART + 'node_input.png';
export const OUTPUT_IMG = ART + 'node_output.png';

export const TOKEN_IMG: Record<ColorCode, string> = {
  R: ART + 'token_red.png',
  B: ART + 'token_blue.png',
  G: ART + 'token_green.png',
};

/**
 * Per-chapter reskin sets: the same machines and tokens dressed as the
 * chapter's world (bakery, parcel hub, warehouse, assembly plant,
 * airport). Mechanics never change — only the art. The default set
 * above stays the family the main menu's How to Play shows.
 */
const NODE_FILE: Record<NodeType, string> = {
  filter: 'node_filter.png',
  transform: 'node_change.png',
  split: 'node_split.png',
  tahan: 'node_buffer.png',
  sort: 'node_sort.png',
  merge: 'node_merge.png',
};
const TOKEN_FILE: Record<ColorCode, string> = { R: 'token_red.png', B: 'token_blue.png', G: 'token_green.png' };

export const NODE_IMG_CH: Record<number, Record<NodeType, string>> = {};
export const TOKEN_IMG_CH: Record<number, Record<ColorCode, string>> = {};
export const INPUT_IMG_CH: Record<number, string> = {};
export const OUTPUT_IMG_CH: Record<number, string> = {};
for (const ch of [1, 2, 3, 4, 5]) {
  NODE_IMG_CH[ch] = Object.fromEntries(
    (Object.keys(NODE_FILE) as NodeType[]).map((t) => [t, `${ART}ch${ch}/${NODE_FILE[t]}`]),
  ) as Record<NodeType, string>;
  TOKEN_IMG_CH[ch] = Object.fromEntries(
    (Object.keys(TOKEN_FILE) as ColorCode[]).map((c) => [c, `${ART}ch${ch}/${TOKEN_FILE[c]}`]),
  ) as Record<ColorCode, string>;
  INPUT_IMG_CH[ch] = `${ART}ch${ch}/node_input.png`;
  OUTPUT_IMG_CH[ch] = `${ART}ch${ch}/node_output.png`;
}

export function nodeImg(chapter: number, type: NodeType): string {
  return NODE_IMG_CH[chapter]?.[type] ?? NODE_IMG[type];
}
export function tokenImg(chapter: number, color: ColorCode): string {
  return TOKEN_IMG_CH[chapter]?.[color] ?? TOKEN_IMG[color];
}
export function inputImg(chapter: number): string {
  return INPUT_IMG_CH[chapter] ?? INPUT_IMG;
}
export function outputImg(chapter: number): string {
  return OUTPUT_IMG_CH[chapter] ?? OUTPUT_IMG;
}

const BELT_KEYS = ['ew', 'ns', 'es', 'sw', 'wn', 'ne', 'end_e', 'end_w', 'end_n', 'end_s'] as const;

/** Belt tileset (belt4): steel while idle, orange "live" set while a token rides the connection. */
export const BELT_IMG: { steel: Record<string, string>; live: Record<string, string> } = {
  steel: Object.fromEntries(BELT_KEYS.map((k) => [k, ART + 'belt/belt_' + k + '.png'])),
  live: Object.fromEntries(BELT_KEYS.map((k) => [k, ART + 'belt/belt_live_' + k + '.png'])),
};

export function nodeLabel(n: NodeDef): { title: string; sub: string } {
  switch (n.type) {
    case 'filter':
      return { title: 'FILTER', sub: 'passes: ' + COLOR_NAME[n.color!] };
    case 'transform':
      return { title: 'CHANGE', sub: 'becomes: ' + COLOR_NAME[n.to!] };
    case 'split':
      // A generic rack SPLIT carries no preset colors: the player routes it
      // per placed machine with the Route editor.
      if (!n.color && !n.side) return { title: 'SPLIT', sub: 'you set the route' };
      return n.side
        ? {
            title: 'SPLIT',
            sub: COLOR_NAME[n.color!] + ' up · ' + COLOR_NAME[n.side] + ' side · rest down',
          }
        : { title: 'SPLIT', sub: COLOR_NAME[n.color!] + ' goes up' };
    case 'tahan':
      return { title: 'BUFFER', sub: 'batch of ' + n.size };
    case 'sort':
      return { title: 'SORT', sub: 'group by color' };
    case 'merge':
      return { title: 'MERGE', sub: 'becomes: ' + COLOR_NAME[n.to!] };
    default:
      return { title: n.type, sub: '' };
  }
}

/**
 * The routing a SPLIT uses before the player customizes it: the named color
 * leaves by port 0 (up), the optional second named color by port 2 (side),
 * and every other color by port 1 (down) — exactly the pre-editor behavior.
 */
export function defaultSplitRouting(n: NodeDef): SplitRouting {
  const byColor: Partial<Record<ColorCode, PortIdx>> = {};
  if (n.color) byColor[n.color] = 0;
  if (n.side && n.side !== n.color) byColor[n.side] = 2;
  return { byColor, other: 1 };
}

/** The effective routing of a placed SPLIT: its player-set route, or the level default. */
export function splitRoutingOf(n: NodeDef): SplitRouting {
  return n.route ?? defaultSplitRouting(n);
}

/**
 * The routing as a strict one-color-per-end assignment: every color gets
 * exactly one end and no end repeats. Colors the raw routing leaves on
 * the shared "other" end are dealt onto the free ends in R, B, G order.
 * The Route editor works on this view; the engine keeps using the raw
 * routing until the player actually changes something.
 */
export function exclusiveSplitRouting(n: NodeDef): SplitRouting {
  const raw = splitRoutingOf(n);
  const order: ColorCode[] = ['R', 'B', 'G'];
  const byColor: Partial<Record<ColorCode, PortIdx>> = {};
  const used = new Set<PortIdx>();
  for (const c of order) {
    const p = raw.byColor[c];
    if (p !== undefined && !used.has(p)) {
      byColor[c] = p;
      used.add(p);
    }
  }
  for (const c of order) {
    if (byColor[c] !== undefined) continue;
    const eff = raw.byColor[c] ?? raw.other;
    if (!used.has(eff)) {
      byColor[c] = eff;
      used.add(eff);
    }
  }
  for (const c of order) {
    if (byColor[c] !== undefined) continue;
    const free = ([0, 2, 1] as PortIdx[]).find((p) => !used.has(p));
    byColor[c] = free ?? raw.other;
    if (free !== undefined) used.add(free);
  }
  return { byColor, other: raw.other };
}

/** The out port a token of `color` leaves a SPLIT by, under its effective routing. */
export function splitPortFor(n: NodeDef, color: ColorCode): PortIdx {
  const r = splitRoutingOf(n);
  return r.byColor[color] ?? r.other;
}

export function nodeColor(n: NodeDef): string {
  switch (n.type) {
    case 'filter':
      return COLOR_HEX[n.color!];
    case 'transform':
      return COLOR_HEX[n.to!];
    case 'split':
      return n.color ? COLOR_HEX[n.color] : '#F0A832';
    case 'tahan':
      return '#F0A832';
    case 'sort':
      return n.order && n.order.length ? COLOR_HEX[n.order[0]] : '#F0A832';
    case 'merge':
      return COLOR_HEX[n.to!];
    default:
      return '#888';
  }
}

export function nodeName(id: string, placed: Record<string, NodeDef>): string {
  if (id === 'IN') return 'INPUT';
  if (placed[id]) return nodeLabel(placed[id]).title;
  return id;
}

/** Canonical key for comparing NodeDef values (used to check rack vs solution). */
export function nodeKey(n: NodeDef): string {
  return [n.type, n.color ?? '', n.side ?? '', n.to ?? '', n.size ?? '', (n.order ?? []).join('')].join('|');
}
