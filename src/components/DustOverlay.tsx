import { useEffect, useRef } from 'react';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  a: number;
  ph: number;
}

/**
 * Faint dust motes drifting over the game card. Screen-space and
 * pointer-free, so the board's 360° camera never interacts with them.
 * Particle count scales with card area and is hard-capped; the sprite is
 * a pre-rendered radial dot (no shadowBlur, no live gradients per frame).
 */
export default function DustOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dot = document.createElement('canvas');
    dot.width = 16;
    dot.height = 16;
    const dctx = dot.getContext('2d');
    if (!dctx) return;
    const grd = dctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grd.addColorStop(0, 'rgba(255,236,200,0.85)');
    grd.addColorStop(1, 'rgba(255,236,200,0)');
    dctx.fillStyle = grd;
    dctx.fillRect(0, 0, 16, 16);

    let motes: Mote[] = [];
    let raf = 0;
    let last = performance.now();
    let t = 0;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.max(1, Math.round(r.width * dpr));
      canvas!.height = Math.max(1, Math.round(r.height * dpr));
      const count = Math.round(Math.min(52, Math.max(24, (r.width * r.height) / 26000)));
      motes = [];
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          vx: (Math.random() - 0.5) * 0.006 * dpr,
          vy: -(0.002 + Math.random() * 0.005) * dpr,
          s: (3 + Math.random() * 6) * dpr,
          a: 0.08 + Math.random() * 0.13,
          ph: Math.random() * 6.28,
        });
      }
    }

    function frame(now: number) {
      const dt = Math.min(50, now - last);
      last = now;
      t += dt;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const m of motes) {
        m.x += m.vx * dt + Math.sin(t / 2400 + m.ph) * 0.0012 * dt;
        m.y += m.vy * dt;
        if (m.y < -10) {
          m.y = canvas!.height + 8;
          m.x = Math.random() * canvas!.width;
        }
        if (m.x < -10) m.x = canvas!.width + 8;
        if (m.x > canvas!.width + 10) m.x = -8;
        ctx!.globalAlpha = m.a * (0.75 + 0.25 * Math.sin(t / 1700 + m.ph));
        ctx!.drawImage(dot, m.x, m.y, m.s, m.s);
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="dust-overlay" aria-hidden="true" />;
}
