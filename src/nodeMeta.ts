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

export const INPUT_IMG = ART + 'node_input.png';
export const OUTPUT_IMG = ART + 'node_output.png';

export const TOKEN_IMG: Record<ColorCode, string> = {
  R: ART + 'token_red.png',
  B: ART + 'token_blue.png',
  G: ART + 'token_green.png',
};

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
      return COLOR_HEX[n.color!];
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
