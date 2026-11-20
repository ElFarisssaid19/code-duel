import { useEffect, useId, useState } from 'react';
import ScaledStage from '@/components/frontend/ScaledStage.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { buildPreviewDocument, pageForTrack } from '@/lib/frontendCanvas.js';

const MODES = [
  { id: 'preview', label: 'Preview' },
  { id: 'slider', label: 'Slider' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'diff', label: 'Diff' },
];
const PREVIEW_DEBOUNCE_MS = 250;

/** The value, updated at most every `delay` ms (the preview iframe reloads on every change). */
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Live preview at the exact canvas size + compare tools:
 *   Slider  target on the left of the handle, your preview on the right
 *   Overlay the target at 50 % opacity over your preview
 *   Diff    the last official diff image (red = pixels that differ)
 */
export default function PreviewCompare({ problem, html, css, diffImage }) {
  const [mode, setMode] = useState('preview');
  const [split, setSplit] = useState(50);
  const sliderId = useId();
  const { width, height } = problem.canvas;
  const srcDoc = useDebounced(
    buildPreviewDocument(pageForTrack(problem, { html, css })),
    PREVIEW_DEBOUNCE_MS,
  );
  const showDiff = mode === 'diff' && diffImage;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          variant="pill"
          label="Compare mode"
          tabs={MODES}
          value={mode}
          onChange={setMode}
          renderTab={(tab) => (
            <>
              {tab.label}
              {tab.id === 'diff' && !diffImage && <span className="sr-only"> (submit first)</span>}
            </>
          )}
        />
        {mode === 'slider' && (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <label htmlFor={sliderId}>Target</label>
            <input
              id={sliderId}
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              className="w-28 accent-emerald-400"
              aria-valuetext={`${split}% target`}
            />
            <span aria-hidden="true">Yours</span>
          </div>
        )}
      </div>

      <ScaledStage width={width} height={height} label="Your preview">
        <iframe
          title="Your live preview"
          sandbox=""
          srcDoc={srcDoc}
          width={width}
          height={height}
          referrerPolicy="no-referrer"
          className="absolute inset-0 block border-0 bg-white"
          data-testid="live-preview"
        />
        {(mode === 'slider' || mode === 'overlay') && (
          <img
            src={problem.targetImageUrl}
            alt=""
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0 select-none"
            style={
              mode === 'overlay' ? { opacity: 0.5 } : { clipPath: `inset(0 ${100 - split}% 0 0)` }
            }
            draggable={false}
          />
        )}
        {mode === 'slider' && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
            style={{ left: `${split}%` }}
            aria-hidden="true"
          />
        )}
        {showDiff && (
          <img
            src={`data:image/png;base64,${diffImage}`}
            alt="Differences between your last submission and the target, in red"
            width={width}
            height={height}
            className="absolute inset-0 select-none"
            data-testid="diff-image"
          />
        )}
        {mode === 'diff' && !diffImage && (
          <div className="absolute inset-0 grid place-items-center bg-canvas/85 p-6 text-center text-sm text-ink-muted">
            Submit once to see the official diff: pixels that differ from the target show in red.
          </div>
        )}
      </ScaledStage>

      <p className="text-xs text-ink-subtle">
        The live preview runs in your browser and can differ slightly from the official render
        (Chromium, DejaVu fonts). Only the submitted score counts.
      </p>
    </div>
  );
}
