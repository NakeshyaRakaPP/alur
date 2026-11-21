import { CHAPTERS, LEVELS, levelsOfChapter } from '../levels';
import type { ProgressMap } from '../progress';
import type { GameMode } from './GameScreen';

interface HomeScreenProps {
  progress: ProgressMap;
  expertProgress: ProgressMap;
  demo: boolean;
  onMenu: () => void;
  onPlay: (levelId: string, mode: GameMode) => void;
}

export default function HomeScreen({ progress, expertProgress, demo, onMenu, onPlay }: HomeScreenProps) {
  const done = LEVELS.filter((l) => (progress[l.id]?.stars ?? 0) > 0).length;

  return (
    <div>
      <button className="ghost menu-back" onClick={onMenu}>
        ← Main Menu
      </button>
      <div className="home-summary">
        <span>
          Systems shipped: <b>{done}</b> of <b>{LEVELS.length}</b> levels
        </span>
        {demo && <span className="demo-badge">DEMO — CHAPTER 1 ONLY</span>}
      </div>

      {CHAPTERS.map((ch) => {
        const locked = demo && ch.n > 1;
        return (
          <section key={ch.n} className="chapter-block">
            <h2>
              {ch.title}
              {locked && <span className="locked-note"> — full app only</span>}
            </h2>
            <div className="level-grid">
              {levelsOfChapter(ch.n).map((level) => {
                const p = progress[level.id];
                const stars = p?.stars ?? 0;
                const ep = expertProgress[level.id];
                const expStars = ep?.stars ?? 0;
                const expertOpen = !demo && !locked && stars > 0 && !!level.expert;
                return (
                  <div
                    key={level.id}
                    className={'level-card' + (locked ? ' locked' : '')}
                    role={locked ? undefined : 'button'}
                    tabIndex={locked ? undefined : 0}
                    onClick={() => {
                      if (!locked) onPlay(level.id, 'base');
                    }}
                    onKeyDown={(e) => {
                      if (!locked && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onPlay(level.id, 'base');
                      }
                    }}
                  >
                    <span className="level-name">{level.name}</span>
                    <span className="level-meta">
                      {locked ? (
                        'Full app only'
                      ) : stars > 0 ? (
                        <>
                          <span className="stars-sm">{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</span> Done
                        </>
                      ) : (
                        'New'
                      )}
                    </span>
                    {p?.best && !locked && (
                      <span className="level-best">
                        Best: Nodes {p.best.node} · Space {p.best.ruang} · Steps {p.best.langkah}
                      </span>
                    )}
                    {expertOpen && (
                      <span className="level-expert">
                        <span className="exp-stars">
                          Expert: {expStars > 0 ? '★'.repeat(expStars) + '☆'.repeat(3 - expStars) : 'unlocked'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlay(level.id, 'expert');
                          }}
                        >
                          Play Expert
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
