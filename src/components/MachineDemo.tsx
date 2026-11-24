import { nodeImg, tokenImg } from '../nodeMeta';
import type { ColorCode, NodeType } from '../types';

/**
 * A tiny looping cartoon of one machine at work — token images ride a
 * belt through the machine sprite so a new player SEES what the machine
 * does instead of reading about it. Pure SVG + CSS keyframes (the md-*
 * classes in styles.css); no JS loop, no state. Art follows the
 * chapter's reskin set; chapter 0 renders the default factory family.
 */
export default function MachineDemo({ type, chapter }: { type: NodeType; chapter: number }) {
  const tok = (color: ColorCode, cls: string) => (
    <g className={'md-tok ' + cls} key={cls + color}>
      <image href={tokenImg(chapter, color)} x={-11} y={-11} width={22} height={22} />
    </g>
  );
  return (
    <svg className="machine-demo" viewBox="0 0 176 76" aria-hidden="true">
      <rect x={0} y={48} width={176} height={9} fill="#343945" />
      <line x1={0} y1={52.5} x2={176} y2={52.5} stroke="#c8cdd6" strokeOpacity={0.3} strokeDasharray="7 6" />
      <image href={nodeImg(chapter, type)} x={64} y={4} width={48} height={48} />
      {type === 'filter' && (
        <>
          {tok('R', 'md-filter-pass')}
          {tok('B', 'md-filter-trash')}
        </>
      )}
      {type === 'transform' && (
        <>
          {tok('R', 'md-transform-in')}
          {tok('B', 'md-transform-out')}
        </>
      )}
      {type === 'split' && (
        <>
          {tok('R', 'md-split-r')}
          {tok('G', 'md-split-g')}
          {tok('B', 'md-split-b')}
        </>
      )}
      {type === 'tahan' && (
        <>
          {tok('R', 'md-tahan-1')}
          {tok('B', 'md-tahan-2')}
          {tok('G', 'md-tahan-3')}
        </>
      )}
      {type === 'sort' && (
        <>
          {tok('B', 'md-sort-b1')}
          {tok('R', 'md-sort-r')}
          {tok('B', 'md-sort-b2')}
        </>
      )}
      {type === 'merge' && (
        <>
          {tok('R', 'md-merge-r')}
          {tok('B', 'md-merge-b')}
          {tok('G', 'md-merge-out')}
        </>
      )}
    </svg>
  );
}
