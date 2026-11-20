import { useState } from 'react';
import GameScreen from './components/GameScreen';
import type { GameMode } from './components/GameScreen';
import HomeScreen from './components/HomeScreen';
import { isBetter } from './engine';
import { isMuted, setMuted, sfx } from './audio/sfx';
import { LEVELS, levelById, levelsOfChapter, nextLevel } from './levels';
import { loadExpertProgress, loadProgress, saveExpertProgress, saveProgress } from './progress';
import type { ProgressMap } from './progress';
import type { Level, Metrics } from './types';

const DEMO = import.meta.env.VITE_DEMO === '1';

type Screen = { kind: 'home' } | { kind: 'game'; levelId: string; mode: GameMode } | { kind: 'gate' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [expertProgress, setExpertProgress] = useState<ProgressMap>(() => loadExpertProgress());
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isMuted());

  function toggleMute() {
    const next = !soundMuted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) sfx.click();
  }

  function handleWin(level: Level, stars: number, metrics: Metrics, mode: GameMode) {
    const apply = (prev: ProgressMap): ProgressMap => {
      const cur = prev[level.id];
      const best = isBetter(metrics, cur?.best ?? null) ? metrics : cur?.best ?? null;
      return {
        ...prev,
        [level.id]: { stars: Math.max(cur?.stars ?? 0, stars), best },
      };
    };
    if (mode === 'expert') {
      setExpertProgress((prev) => {
        const next = apply(prev);
        saveExpertProgress(next);
        return next;
      });
    } else {
      setProgress((prev) => {
        const next = apply(prev);
        saveProgress(next);
        return next;
      });
    }
  }

  function handleNext(level: Level) {
    if (DEMO && level.id === 'c1-5') {
      setScreen({ kind: 'gate' });
      return;
    }
    const nx = nextLevel(level);
    if (nx) setScreen({ kind: 'game', levelId: nx.id, mode: 'base' });
    else setScreen({ kind: 'home' });
  }

  function nextLabelFor(level: Level): string | null {
    if (DEMO && level.id === 'c1-5') return 'Finish Chapter 1 →';
    if (nextLevel(level)) return 'Next Level →';
    return null;
  }

  const gameLevel = screen.kind === 'game' ? levelById(screen.levelId) : undefined;

  return (
    <div className="wrap">
      <header>
        <img className="logo" src="/art/iso/logo_alur.png" alt="ALUR" />
        <div className="tag">
          A system-building puzzle — place machines, connect the pipes, run the flow, and watch your system
          work.
        </div>
        {DEMO && <div className="proof-badge">DEMO VERSION</div>}
        <button
          className="mute-btn"
          onClick={toggleMute}
          aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          title={soundMuted ? 'Sound: off' : 'Sound: on'}
        >
          {soundMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 9v6h4l5 4V5L8 9H4z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 9v6h4l5 4V5L8 9H4z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M16 9.2a4 4 0 010 5.6M18.6 7a7.6 7.6 0 010 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </header>

      {screen.kind === 'home' && (
        <HomeScreen
          progress={progress}
          expertProgress={expertProgress}
          demo={DEMO}
          onPlay={(id, mode) => {
            sfx.select();
            setScreen({ kind: 'game', levelId: id, mode });
          }}
        />
      )}

      {screen.kind === 'game' && gameLevel && (
        <GameScreen
          key={gameLevel.id + ':' + screen.mode}
          level={gameLevel}
          mode={screen.mode}
          demo={DEMO}
          expertUnlocked={(progress[gameLevel.id]?.stars ?? 0) > 0}
          best={
            (screen.mode === 'expert' ? expertProgress : progress)[gameLevel.id]?.best ?? null
          }
          nextLabel={screen.mode === 'expert' ? null : nextLabelFor(gameLevel)}
          onWin={handleWin}
          onModeChange={(m) => setScreen({ kind: 'game', levelId: gameLevel.id, mode: m })}
          onNext={() => handleNext(gameLevel)}
          onBack={() => setScreen({ kind: 'home' })}
        />
      )}

      {screen.kind === 'gate' && (
        <GateScreen progress={progress} onHome={() => setScreen({ kind: 'home' })} />
      )}

      <footer className="foot">
        ALUR — one game, {LEVELS.length} levels, four chapters, plus an Expert variant of every level. Every
        finished level is one shipped system.
      </footer>
    </div>
  );
}

function GateScreen({ progress, onHome }: { progress: ProgressMap; onHome: () => void }) {
  const ch1 = levelsOfChapter(1);
  const done = ch1.filter((l) => (progress[l.id]?.stars ?? 0) > 0).length;
  const stars = ch1.reduce((s, l) => s + (progress[l.id]?.stars ?? 0), 0);
  return (
    <div className="gate-box">
      <div className="gate-stamp">CHAPTER 1 COMPLETE</div>
      <p>
        You have finished Chapter 1 — Basic Flow in this demo version ({done} of {ch1.length} levels, {stars}{' '}
        stars). Chapter 2 — Split &amp; Merge and Chapter 3 — Real Systems are available in the full ALUR app.
      </p>
      <p className="gate-next">Chapter 1 complete — continue in the app to unlock the next chapters.</p>
      <button
        className="run"
        onClick={() => {
          sfx.click();
          onHome();
        }}
      >
        Back to Level Menu
      </button>
    </div>
  );
}
