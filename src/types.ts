export type ColorCode = 'R' | 'B' | 'G';

export type PortIdx = 0 | 1 | 2;

/**
 * Routing for one SPLIT: which out port each token color leaves by
 * (0 = up, 1 = down, 2 = side). Colors missing from `byColor` follow
 * `other`. Several colors may share one port.
 */
export interface SplitRouting {
  byColor: Partial<Record<ColorCode, PortIdx>>;
  other: PortIdx;
}

export type OutputId = 'OUT' | 'A' | 'B';

export type NodeType = 'filter' | 'transform' | 'split' | 'tahan' | 'sort' | 'merge';

export interface NodeDef {
  type: NodeType;
  /** filter & split: the color this node recognizes */
  color?: ColorCode;
  /** split only: optional second named color, routed to out port 2 (the side end) */
  side?: ColorCode;
  /** transform & merge: the resulting color */
  to?: ColorCode;
  /** tahan: tokens per pack */
  size?: number;
  /** sort: color order used when tokens are released */
  order?: ColorCode[];
  /**
   * split only: explicit routing for this instance. On a placed machine it
   * is set by the player (Route editor) or stamped at placement time;
   * tray defs never carry one. Solution defs usually leave it unset — the
   * engine then derives the routing from the named colors (see
   * defaultSplitRouting) — but a solution whose belts leave by other sides
   * than the color default (v6.6: a port is a physical side) states its
   * routing explicitly here. Removing a machine discards it.
   */
  route?: SplitRouting;
}

export interface PlacedNode extends NodeDef {
  uid: number;
}

/** One belt connection: destination machine id + the grid cells the belt runs through. A null destination is an open-ended trail: the belt is laid and counted, but reaches no machine yet. */
export interface BeltConn {
  to: string | null;
  /** Cell keys ("c,r") in travel order, from just outside the source to just outside the destination. */
  path: string[];
}

/** Key: "fromId:outIdx" (e.g. "IN:0", "4,3:1"), value: the belt to the destination machine. */
export type Conns = Record<string, BeltConn>;

export interface Solution {
  /** Key: anchor cell key ("c,r") of the placed machine. */
  placements: Record<string, NodeDef>;
  connections: Conns;
}

/** Expert-mode override for a level: tighter rails, a limited rack, blocked cells, pre-placed locked machines. */
export interface ExpertSpec {
  /** Slimmer rail budget for the expert variant. */
  railLimit: number;
  /** The expert rack: each entry is one physical machine copy the player may place. */
  tray: NodeDef[];
  /** Blocked grid cells ("c,r"): cannot be occupied by machines or belts. */
  obstacles: string[];
  /** Machines pre-placed at level start (anchor cell key -> def). They cannot be moved or removed. */
  locked: Record<string, NodeDef>;
  /** Reference solution for the expert variant (locked machines included in placements). */
  solution: Solution;
}

export interface Level {
  id: string;
  chapter: number;
  name: string;
  /** Problem statement in English (default). */
  brief: string;
  /** Problem statement in Indonesian (shown via the translate toggle). */
  briefId: string;
  stream: ColorCode[];
  outputs: OutputId[];
  target: Partial<Record<OutputId, ColorCode[]>>;
  packageRule?: Partial<Record<OutputId, number>>;
  goalText?: string;
  goalTextId?: string;
  par: number;
  /** Rails used by the reference solution; the yardstick for star grades and roomy limits. */
  refRails?: number;
  /** Maximum total belt cells (rails) the player may lay down on this level. */
  railLimit: number;
  tray: NodeDef[];
  solution: Solution;
  /** A second, architecturally different winning build (verified in the harness). Proof the level is not single-solution. */
  altSolution?: Solution;
  /** Expert variant of this level (present on every level). */
  expert?: ExpertSpec;
}

export interface Metrics {
  node: number;
  ruang: number;
  langkah: number;
}
