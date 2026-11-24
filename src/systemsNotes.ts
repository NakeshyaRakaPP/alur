/**
 * Systems Notes — the game's reference sheet. Every level trains one
 * idea from systems thinking; this glossary names each idea, says what
 * it means in the game, and where it runs in the real world. It is the
 * "pegangan": what a player keeps after the puzzles are done.
 */
export interface SystemNote {
  name: string;
  /** Level(s) that train it, for cross-reference. */
  levels: string;
  means: string;
  real: string;
}

export const SYSTEMS_NOTES_INTRO =
  'Every level trains one idea from systems thinking. This sheet names them all — the same ideas run kitchens, post offices, hospitals and programs.';

export const SYSTEMS_NOTES: SystemNote[] = [
  {
    name: 'Validation',
    levels: 'Level 1 · Bad Dough',
    means: 'A gate that only lets the right things through. Everything else is thrown away.',
    real: 'Ticket checks at a station gate, form checks on a website, inspectors at a factory door.',
  },
  {
    name: 'Transformation',
    levels: 'Level 2 · Into the Oven',
    means: 'A step that changes what passes through it into something else.',
    real: 'Raw dough becomes bread. Raw data becomes a report. A photo becomes a thumbnail.',
  },
  {
    name: 'Sequence',
    levels: 'Level 3 · Mix, Then Bake',
    means: 'Steps in a fixed order — each step eats the output of the one before it.',
    real: 'A recipe. An assembly line. Wash, then dry, then fold.',
  },
  {
    name: 'Necessity',
    levels: 'Level 4 · The Extra Mixer',
    means: 'Use only the steps a job actually needs. Extra steps cost time, space and attention.',
    real: 'A good recipe has no pointless steps. A good form only asks what it really uses.',
  },
  {
    name: 'Systems',
    levels: 'Level 5 · Opening Day',
    means: 'Small steps, working together on one goal, become a system.',
    real: 'A bakery is not an oven — it is buying, mixing, baking, packing and selling, together.',
  },
  {
    name: 'Routing',
    levels: 'Level 6 · Two Cities',
    means: 'One flow, many destinations — each item is sent to the right one.',
    real: 'Mail sorting. Airport baggage belts. Internet routers sending packets around the world.',
  },
  {
    name: 'Conditional paths',
    levels: 'Level 7 · Fragile!',
    means: 'The route depends on what the item is, not just where it arrived.',
    real: 'Fragile parcels get padding, regular ones go straight. Members and guests take different lines.',
  },
  {
    name: 'Reconvergence',
    levels: 'Level 8 · One Truck Out',
    means: 'Paths that split for a while can join back into one flow.',
    real: 'Highway lanes merging back into one road. Separate queues feeding a single cashier.',
  },
  {
    name: 'Classification',
    levels: 'Level 9 · Sort the Mail',
    means: 'Group like with like first, then handle each group in batches.',
    real: 'Laundry sorted by color. Library books by genre. Files sorted by type.',
  },
  {
    name: 'Distribution',
    levels: 'Level 10 · Holiday Surge',
    means: 'Getting every item to its correct place — even when there are thousands of them.',
    real: 'A courier network in holiday week. One warehouse restocking many stores.',
  },
  {
    name: 'Queue',
    levels: 'Level 11 · The Loading Dock',
    means: 'A waiting place that holds items until the next step is ready. Holding is a real step.',
    real: 'Ticket lines. Printer queues. Goods on a dock, waiting for the truck.',
  },
  {
    name: 'Quality control & batching',
    levels: 'Level 12 · Quality Gate',
    means: 'Check first, then pack in fixed counts. The pack size is a contract.',
    real: 'Eggs checked, then boxed by twelve. Bottles inspected, then crated by twenty-four.',
  },
  {
    name: 'Allocation',
    levels: 'Level 13 · Two Stores',
    means: 'One source feeding several places, and each place may follow different rules.',
    real: 'One kitchen supplying two cafes. One teacher, many classrooms, different schedules.',
  },
  {
    name: 'End to end',
    levels: 'Level 14 · Warehouse Day',
    means: 'The whole journey of an item through one system, from entering to leaving.',
    real: 'A parcel’s life: received, checked, stored, shipped, delivered.',
  },
  {
    name: 'Assembly',
    levels: 'Levels 15–16 · Bottle Meets Cap',
    means: 'Two or more parts must arrive together to become one product — then it can be packed.',
    real: 'Bottle + cap. Phone + case. Burger + bun. Wheel + frame.',
  },
  {
    name: 'Balanced inputs',
    levels: 'Level 17 · Two Lines In',
    means: 'A step that eats from two sides starves when one side runs dry.',
    real: 'A mixer needs both ingredients flowing. A pair of cashiers needs both lines moving.',
  },
  {
    name: 'Synchronization',
    levels: 'Level 18 · The Whole Line',
    means: 'Many parts moving in one rhythm, so they meet at the right place at the right moment.',
    real: 'An orchestra. Traffic lights along one big road. A factory line at full speed.',
  },
  {
    name: 'Parallel systems',
    levels: 'Level 19 · Two Terminals',
    means: 'Two complete flows running side by side, never mixing.',
    real: 'Two airport terminals. A restaurant’s dine-in line and takeaway line.',
  },
  {
    name: 'Adaptation',
    levels: 'Level 20 · Flight Rescheduled',
    means: 'When plans change, a good system changes its routes instead of stopping.',
    real: 'Bags of a rescheduled flight get new tags. A delivery rerouted around a closed road.',
  },
  {
    name: 'Mixed rules',
    levels: 'Level 21 · Checked & Carry-On',
    means: 'One system can hold several different contracts at the same time.',
    real: 'Checked bags vs carry-on in one airport. Members vs guests in one booking system.',
  },
  {
    name: 'Cascade',
    levels: 'Level 22 · Rush Hour',
    means: 'A long chain where every step depends on the one before — a stop anywhere stops everything after it.',
    real: 'Dominoes. A long recipe. An approval chain in an office.',
  },
  {
    name: 'Edge cases',
    levels: 'Level 23 · Odd Pairs',
    means: 'The leftovers that do not divide neatly. Every real system meets them — plan for them.',
    real: 'The last half-empty box. One passenger left after the bus fills up.',
  },
  {
    name: 'The whole system',
    levels: 'Level 24 · The Whole Airport',
    means: 'Everything together: many small ideas composed into one big working system.',
    real: 'An airport is check-in + security + sorting + loading — a system made of systems.',
  },
];

export const SYSTEMS_NOTES_OUTRO =
  'Learn to see these, and you can read almost any system you meet — and sketch your own before you build it.';
