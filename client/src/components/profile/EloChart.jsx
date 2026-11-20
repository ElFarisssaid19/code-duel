import { useId, useState } from 'react';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * ELO history line chart (hand-written SVG, no chart library). Points are evenly spaced by
 * match; hovering (or touching) shows the date and ELO of the nearest point.
 */
export default function EloChart({ points }) {
  const gradientId = useId();
  const [active, setActive] = useState(null);

  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-zinc-500">No ranked matches yet.</p>;
  }

  const elos = points.map((p) => p.elo);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  const span = Math.max(max - min, 20);
  const lo = Math.floor((min - span * 0.15) / 10) * 10;
  const hi = Math.ceil((max + span * 0.15) / 10) * 10;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (elo) => PAD.top + (1 - (elo - lo) / (hi - lo)) * innerH;
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((vx - PAD.left) / innerW) * (points.length - 1));
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  }

  const point = active === null ? null : points[active];
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label={`ELO history: ${points.length - 1} ranked matches, from ${points[0].elo} to ${points.at(-1).elo}`}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="rgb(39 39 42)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-zinc-500 font-mono text-[11px]"
            >
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 8} className="fill-zinc-500 text-[11px]">
          start
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-zinc-500 text-[11px]"
        >
          {points.length - 1} matches
        </text>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.length <= 60 &&
          points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.elo)} r="3" className="fill-emerald-400" />
          ))}
        {point && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="rgb(113 113 122)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(active)}
              cy={y(point.elo)}
              r="5.5"
              className="fill-zinc-950 stroke-emerald-300"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>
      {point && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (x(active) / WIDTH) * 100))}%` }}
          role="status"
        >
          <span className="font-mono font-semibold text-emerald-300">{point.elo}</span>
          {point.delta !== 0 && (
            <span
              className={`ml-1.5 font-mono ${point.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              ({point.delta > 0 ? '+' : ''}
              {point.delta})
            </span>
          )}
          <span className="ml-2 text-zinc-400">
            {point.matchId ? formatDate(point.date) : `Joined ${formatDate(point.date)}`}
          </span>
        </div>
      )}
    </div>
  );
}
