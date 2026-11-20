import Badge from '@/components/ui/Badge.jsx';
import { verdictOf } from '@/lib/verdicts.js';

const TONES = { success: 'success', danger: 'danger', warning: 'warning', muted: 'neutral' };

/** Judge verdict pill, e.g. "Accepted" in green. */
export default function StatusBadge({ status }) {
  const { label, tone } = verdictOf(status);
  return <Badge tone={TONES[tone]}>{label}</Badge>;
}
