import Badge from '@/components/ui/Badge.jsx';
import { TRACK_LABELS } from '@/lib/categories.js';

const TONES = { HTML: 'warning', CSS: 'info', HTML_CSS: 'accent' };

/** FRONTEND track pill: HTML, CSS or HTML + CSS. */
export default function TrackBadge({ track, className = '' }) {
  if (!track) return null;
  return (
    <Badge tone={TONES[track] ?? 'neutral'} className={className}>
      <span className="font-mono text-[0.7rem]" aria-hidden="true">
        {track === 'CSS' ? '{ }' : '</>'}
      </span>
      {TRACK_LABELS[track]}
    </Badge>
  );
}
