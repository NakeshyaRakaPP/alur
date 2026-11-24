import { useEffect, useRef, useState } from 'react';
import GameScreen from './components/GameScreen';
import type { GameMode } from './components/GameScreen';
import HomeScreen from './components/HomeScreen';
import MenuScreen from './components/MenuScreen';
import { isBetter } from './engine';
import {
  BACKDROP_DECK_IMG,
  BACKDROP_MENU_IMG,
  BELT_IMG,
  CHAPTER_BG,
  FLOOR_TEX_IMG,
  HOST_POSES,
  LOGO_IMG,
  inputImg,
  nodeImg,
  outputImg,
  tokenImg,
} from './nodeMeta';
import { isMuted, setMuted, sfx } from './audio/sfx';
import { isMusicMuted, setMusicMuted, startMusic } from './audio/music';
import { CHAPTERS, LEVELS, levelById, levelsOfChapter, nextLevel } from './levels';
import { loadExpertProgress, loadProgress, saveExpertProgress, saveProgress } from './progress';
import type { ProgressMap } from './progress';
import type { Level, Metrics, NodeType } from './types';

/** Every image the game will ever draw, so the loading screen can pull
 *  them all in once — no sprite ever pops in mid-game afterwards. */
function preloadList(): string[] {
  const urls = new Set<string>();
  urls.add(LOGO_IMG);
  urls.add(BACKDROP_MENU_IMG);
  urls.add(BACKDROP_DECK_IMG);
  urls.add(FLOOR_TEX_IMG);
  Object.values(HOST_POSES).forEach((u) => urls.add(u));
  Object.values(CHAPTER_BG).forEach((u) => urls.add(u));
  Object.values(BELT_IMG.steel).forEach((u) => urls.add(u));
  Object.values(BELT_IMG.live).forEach((u) => urls.add(u));
  const types: NodeType[] = ['filter', 'transform', 'split', 'tahan', 'sort', 'merge'];
  for (let ch = 0; ch <= 5; ch++) {
    types.forEach((t) => urls.add(nodeImg(ch, t)));
    urls.add(inputImg(ch));
    urls.add(outputImg(ch));
    (['R', 'G', 'B'] as const).forEach((c) => urls.add(tokenImg(ch, c)));
  }
  return [...urls];
}

function LoadingScreen({ pct }: { pct: number }) {
  return (
    <div className="boot-screen">
      <img className="boot-pio" src={HOST_POSES.wave} alt="" />
      <img className="boot-logo" src={LOGO_IMG} alt="ALUR" />
      <div className="boot-tag">Place machines. Connect belts. Run the flow.</div>
      <div className="boot-bar">
        <div className="boot-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="boot-pct">Loading the factory… {pct}%</div>
    </div>
  );
}

/** The landscape-game standard on the web: from a player's tap, enter
 *  fullscreen and ask the OS to lock the screen to landscape. Works on
 *  Chrome/Android and Firefox; Safari has neither API on iPhone, where
 *  the PortraitToast below is the sanctioned fallback. Every failure is
 *  silent — desktop and unsupported browsers just carry on. */
function tryLockLandscape() {
  try {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const ori = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (!ori.lock) return;
    if (document.fullscreenElement) {
      ori.lock('landscape').catch(() => {});
      return;
    }
    const p = document.documentElement.requestFullscreen?.();
    if (p) p.then(() => ori.lock!('landscape')).catch(() => {});
  } catch {
    /* no lock available — the toast + responsive layout carry it */
  }
}

/** While a phone is held in portrait, this toast flashes "Turn your
 *  phone sideways" for a few seconds, at most 3 times per visit, and
 *  never blocks a tap. It is the fallback for browsers that cannot
 *  lock orientation (notably Safari on iPhone). */
function PortraitToast() {
  const [visible, setVisible] = useState(false);
  const showsRef = useRef(0);
  const visibleRef = useRef(false);
  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      const portraitPhone = window.innerWidth <= 760 && window.innerHeight > window.innerWidth;
      if (portraitPhone && !visibleRef.current && showsRef.current < 3) {
        showsRef.current += 1;
        visibleRef.current = true;
        setVisible(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          visibleRef.current = false;
          setVisible(false);
        }, 2800);
      } else if (!portraitPhone) {
        visibleRef.current = false;
        setVisible(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      window.clearTimeout(timer);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="portrait-toast">
      <div className="rotate-phone" />
      <div className="portrait-toast-text">Turn your phone sideways</div>
    </div>
  );
}

const DEMO = import.meta.env.VITE_DEMO === '1';

type Screen =
  | { kind: 'menu' }
  | { kind: 'home' }
  | { kind: 'game'; levelId: string; mode: GameMode }
  | { kind: 'gate' };

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootPct, setBootPct] = useState(0);
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [expertProgress, setExpertProgress] = useState<ProgressMap>(() => loadExpertProgress());
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isMuted());
  const [musicOff, setMusicOff] = useState<boolean>(() => isMusicMuted());

  // Boot: preload every sprite once behind the loading screen. Errors
  // count as loaded (a missing file must never hang the boot), and a
  // hard 6-second cap boots the game regardless.
  useEffect(() => {
    const urls = preloadList();
    const started = performance.now();
    let done = 0;
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      const wait = Math.max(0, 900 - (performance.now() - started));
      window.setTimeout(() => {
        if (!cancelled) setBooted(true);
      }, wait);
    };
    const cap = window.setTimeout(finish, 6000);
    if (urls.length === 0) finish();
    urls.forEach((u) => {
      const img = new Image();
      const tick = () => {
        done += 1;
        if (!cancelled) setBootPct(Math.round((done / urls.length) * 100));
        if (done >= urls.length) {
          window.clearTimeout(cap);
          finish();
        }
      };
      img.onload = tick;
      img.onerror = tick;
      img.src = u;
    });
    return () => {
      cancelled = true;
      window.clearTimeout(cap);
    };
  }, []);

  // Music may only start after a user gesture (autoplay rules): the
  // first pointerdown anywhere starts it, unless the user muted it.
  useEffect(() => {
    const kick = () => startMusic();
    window.addEventListener('pointerdown', kick, { once: true });
    return () => window.removeEventListener('pointerdown', kick);
  }, []);

  function toggleMute() {
    const next = !soundMuted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) sfx.click();
  }

  function toggleMusic() {
    const next = !musicOff;
    setMusicMuted(next);
    setMusicOff(next);
  }

  function resetProgress() {
    setProgress({});
    saveProgress({});
    setExpertProgress({});
    saveExpertProgress({});
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

  if (!booted) {
    return (
      <>
        <LoadingScreen pct={bootPct} />
        <PortraitToast />
      </>
    );
  }

  return (
    <>
    <div className="wrap">
      {screen.kind !== 'menu' && (
        <header>
        <img className="logo" src={LOGO_IMG} alt="ALUR" />
        <div className="tag">Place machines. Connect belts. Run the flow.</div>
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
      )}

      {screen.kind === 'menu' && (
        <MenuScreen
          progress={progress}
          expertProgress={expertProgress}
          demo={DEMO}
          muted={soundMuted}
          musicMuted={musicOff}
          onPlay={() => {
            tryLockLandscape();
            setScreen({ kind: 'home' });
          }}
          onToggleMute={toggleMute}
          onToggleMusic={toggleMusic}
          onResetProgress={resetProgress}
        />
      )}

      {screen.kind === 'home' && (
        <HomeScreen
          progress={progress}
          expertProgress={expertProgress}
          demo={DEMO}
          onMenu={() => {
            sfx.click();
            setScreen({ kind: 'menu' });
          }}
          onPlay={(id, mode) => {
            tryLockLandscape();
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

      {screen.kind !== 'menu' && (
        <footer className="foot">
          ALUR — {LEVELS.length} levels, {CHAPTERS.length} chapters, plus an Expert variant of every level.
        </footer>
      )}
    </div>
    <PortraitToast />
    </>
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
        You finished Chapter 1 in this demo ({done} of {ch1.length} levels, {stars} stars). The rest is in
        the full app.
      </p>
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
