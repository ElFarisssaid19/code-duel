import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import Palette from '@/components/frontend/Palette.jsx';
import ScaledStage from '@/components/frontend/ScaledStage.jsx';
import TrackBadge from '@/components/frontend/TrackBadge.jsx';
import { renderMarkdown } from '@/lib/markdown.js';

/** FRONTEND brief: target image, canvas size, palette, track rules and the statement. */
export default function TargetPanel({ problem }) {
  const { width, height } = problem.canvas;
  return (
    <div className="space-y-5 p-5 lg:p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">{problem.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
          <DifficultyBadge difficulty={problem.difficulty} />
          <TrackBadge track={problem.track} />
          <span className="font-mono">
            {width} × {height} px
          </span>
          <span>· solved at {problem.threshold.toFixed(2)}%</span>
        </div>
      </div>

      <figure className="space-y-2">
        <ScaledStage width={width} height={height}>
          <img
            src={problem.targetImageUrl}
            width={width}
            height={height}
            alt={`Target for ${problem.title} (${width} × ${height} px)`}
            className="block select-none"
            draggable={false}
          />
        </ScaledStage>
        <figcaption className="text-center text-xs text-ink-subtle">
          Target · canvas {width} × {height} px
        </figcaption>
      </figure>

      <Palette colors={problem.palette} />

      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 text-sm text-sky-100">
        <p className="eyebrow mb-1 text-sky-300">Track rules</p>
        <p>{problem.trackRules}</p>
      </div>

      {/* Sanitized with DOMPurify in renderMarkdown */}
      <div
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.description) }}
      />
    </div>
  );
}
