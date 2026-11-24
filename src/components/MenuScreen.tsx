import { useEffect, useState } from 'react';
import { BACKDROP_MENU_IMG, BELT_IMG, LOGO_IMG, MACHINE_NOTE, NODE_IMG, TOKEN_IMG, nodeLabel } from '../nodeMeta';
import { SYSTEMS_NOTES, SYSTEMS_NOTES_INTRO, SYSTEMS_NOTES_OUTRO } from '../systemsNotes';
import MachineDemo from './MachineDemo';
import { CHAPTERS, LEVELS } from '../levels';
import type { NodeType } from '../types';
import type { ProgressMap } from '../progress';
import { sfx } from '../audio/sfx';

interface MenuScreenProps {
  progress: ProgressMap;
  expertProgress: ProgressMap;
  demo: boolean;
  muted: boolean;
  musicMuted: boolean;
  onPlay: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onResetProgress: () => void;
}

type Panel = 'settings' | 'howto' | 'about' | 'notes' | null;

/**
 * Title screen — the front door every offline puzzle game has: logo,
 * one dominant Play button, then Settings / How to Play / About behind
 * their own buttons. Level select lives one tap behind Play.
 */
export default function MenuScreen(props: MenuScreenProps) {
  const { progress, expertProgress, demo, muted, musicMuted } = props;
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const done = LEVELS.filter((l) => (progress[l.id]?.stars ?? 0) > 0).length;
  const stars = LEVELS.reduce((s, l) => s + (progress[l.id]?.stars ?? 0), 0);
  const expStars = LEVELS.reduce((s, l) => s + (expertProgress[l.id]?.stars ?? 0), 0);
  const maxStars = LEVELS.length * 3;

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  function openPanel(p: Panel) {
    sfx.click();
    setConfirmReset(false);
    setPanel(p);
  }

  return (
    <div className="menu-screen">
      <img className="menu-backdrop" src={BACKDROP_MENU_IMG} alt="" />
      <img className="menu-logo" src={LOGO_IMG} alt="ALUR" />
      <div className="menu-tag">Place machines. Connect belts. Run the flow.</div>
      {demo && <div className="proof-badge">DEMO VERSION</div>}
      {done > 0 && (
        <div className="menu-progress">
          <b>★ {stars}</b> / {maxStars} · {done} of {LEVELS.length} systems shipped
          {expStars > 0 && (
            <>
              {' '}· Expert <b>★ {expStars}</b>
            </>
          )}
        </div>
      )}

      <div className="menu-buttons">
        <button
          className="run menu-btn"
          onClick={() => {
            sfx.select();
            props.onPlay();
          }}
        >
          ▶ PLAY
        </button>
        <button className="ghost menu-btn" onClick={() => openPanel('settings')}>
          ⚙ SETTINGS
        </button>
        <button className="ghost menu-btn" onClick={() => openPanel('howto')}>
          ? HOW TO PLAY
        </button>
        <button className="ghost menu-btn" onClick={() => openPanel('notes')}>
          ☰ SYSTEMS NOTES
        </button>
        <button className="ghost menu-btn" onClick={() => openPanel('about')}>
          ⓘ ABOUT
        </button>
      </div>

      <div className="menu-foot">An offline system-building puzzle · progress saves in this browser</div>

      {panel && (
        <div
          className="menu-overlay"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <div className="menu-panel">
            <div className="menu-panel-head">
              <b>
                {panel === 'settings'
                  ? 'SETTINGS'
                  : panel === 'howto'
                    ? 'HOW TO PLAY'
                    : panel === 'notes'
                      ? 'SYSTEMS NOTES'
                      : 'ABOUT'}
              </b>
              <button
                className="ghost menu-x"
                onClick={() => {
                  sfx.click();
                  setPanel(null);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {panel === 'settings' && (
              <div>
                <div className="set-row">
                  <span>Sound effects</span>
                  <span className="route-seg">
                    <button className={!muted ? 'active' : ''} onClick={() => muted && props.onToggleMute()}>
                      ON
                    </button>
                    <button className={muted ? 'active' : ''} onClick={() => !muted && props.onToggleMute()}>
                      OFF
                    </button>
                  </span>
                </div>
                <div className="set-row">
                  <span>Music</span>
                  <span className="route-seg">
                    <button
                      className={!musicMuted ? 'active' : ''}
                      onClick={() => musicMuted && props.onToggleMusic()}
                    >
                      ON
                    </button>
                    <button
                      className={musicMuted ? 'active' : ''}
                      onClick={() => !musicMuted && props.onToggleMusic()}
                    >
                      OFF
                    </button>
                  </span>
                </div>
                <div className="set-row">
                  <span>Progress</span>
                  {!confirmReset ? (
                    <button
                      className="ghost menu-small"
                      onClick={() => {
                        sfx.click();
                        setConfirmReset(true);
                      }}
                    >
                      Reset progress
                    </button>
                  ) : (
                    <button
                      className="ghost menu-small danger"
                      onClick={() => {
                        sfx.click();
                        props.onResetProgress();
                        setPanel(null);
                      }}
                    >
                      Tap again — erase all stars
                    </button>
                  )}
                </div>
                <p className="menu-note">Reset erases every star and best run, in Base and Expert.</p>
              </div>
            )}

            {panel === 'howto' && (
              <div>
                <div className="howto-row">
                  <img src={NODE_IMG.filter} alt="" />
                  <span>Place machines on the grid.</span>
                </div>
                <div className="howto-row">
                  <img src={BELT_IMG.steel.ew} alt="" />
                  <span>Hold a machine, pick Rail, click the target to lay a belt.</span>
                </div>
                <div className="howto-row">
                  <img src={TOKEN_IMG.R} alt="" />
                  <span>Press RUN — the output must match the target.</span>
                </div>
                <div className="howto-row">
                  <span className="howto-glyph">⟳</span>
                  <span>Drag the empty floor to spin the camera.</span>
                </div>
                <div className="howto-sub">THE MACHINES — WATCH THEM WORK</div>
                {(['filter', 'transform', 'split', 'tahan', 'sort', 'merge'] as NodeType[]).map((t) => (
                  <div className="howto-demo" key={t}>
                    <div className="machine-note-title">
                      <img src={NODE_IMG[t]} alt="" />
                      <b>{nodeLabel({ type: t }).title}</b>
                    </div>
                    <MachineDemo type={t} chapter={0} />
                    <span>{MACHINE_NOTE[t]}</span>
                  </div>
                ))}
              </div>
            )}

            {panel === 'notes' && (
              <div>
                <p className="menu-note">{SYSTEMS_NOTES_INTRO}</p>
                {SYSTEMS_NOTES.map((n) => (
                  <div className="note-row" key={n.name}>
                    <div className="note-head">
                      <b>{n.name}</b>
                      <span className="note-levels">{n.levels}</span>
                    </div>
                    <p>{n.means}</p>
                    <p className="note-real">
                      <span className="note-real-tag">IN THE REAL WORLD</span>
                      {n.real}
                    </p>
                  </div>
                ))}
                <p className="menu-note">{SYSTEMS_NOTES_OUTRO}</p>
              </div>
            )}

            {panel === 'about' && (
              <div className="about-body">
                <p>
                  ALUR is a system-building puzzle. Tokens flow in, your machines process them, and the
                  output has to match the target — exactly.
                </p>
                <p>
                  Every level is a real system in disguise — a bakery, a parcel hub, a warehouse, an
                  assembly plant, an airport. Beat one and the game names the systems idea you just used.
                </p>
                <p>
                  {LEVELS.length} levels · {CHAPTERS.length} chapters · an Expert variant of every level, with fewer
                  rails, blocked cells and locked machines.
                </p>
                <p>Made by Nakeshya Raka Putra Priyatna.</p>
                <p>Fully offline. No account — your progress lives in this browser.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
