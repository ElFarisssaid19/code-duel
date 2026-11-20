import Badge from '@/components/ui/Badge.jsx';

const TONES = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' };
const LABELS = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

export default function DifficultyBadge({ difficulty }) {
  return <Badge tone={TONES[difficulty] ?? 'neutral'}>{LABELS[difficulty] ?? difficulty}</Badge>;
}
