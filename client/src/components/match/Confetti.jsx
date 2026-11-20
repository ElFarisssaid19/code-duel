import { useEffect, useRef } from 'react';

const COLORS = ['#34eaa2', '#79f8c6', '#52bcff', '#fbbf24', '#f7f8fb'];
const DURATION_MS = 3800;

/**
 * Lightweight confetti burst on a canvas (no library). Renders nothing interactive and stops by
 * itself. Don't mount it when the user prefers reduced motion.
 */
export default function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const pieces = Array.from({ length: 160 }, (_, i) => ({
      x: i % 2 ? w * 0.15 : w * 0.85,
      y: window.innerHeight * 0.55,
      vx: (i % 2 ? 1 : -1) * (2 + Math.random() * 7),
      vy: -(9 + Math.random() * 9),
      size: 5 + Math.random() * 6,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[i % COLORS.length],
    }));

    const start = performance.now();
    let frame;
    const draw = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION_MS);
      for (const p of pieces) {
        p.vy += 0.32; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="confetti"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  );
}
