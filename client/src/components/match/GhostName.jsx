import UserLink from '@/components/UserLink.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { formatDay } from '@/components/match/format.js';

/**
 * The honest name of a ghost/bot opponent, everywhere it appears:
 *   👻 Ghost of @username (replay from <date>)   or   🤖 Bot <name>
 * always with a "replay" badge. Bots never link to a profile.
 */
export default function GhostName({ ghost, compact = false, className = '' }) {
  const isBot = ghost.kind === 'bot';
  return (
    <span
      className={`inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`}
      data-testid="ghost-name"
    >
      <span aria-hidden="true">{isBot ? '🤖' : '👻'}</span>
      {isBot ? (
        <span className="truncate font-semibold">Bot {ghost.name}</span>
      ) : (
        <span className="truncate font-semibold">
          Ghost of <UserLink username={ghost.username} newTab className="text-inherit" />
        </span>
      )}
      <Badge
        tone="info"
        className="!px-1.5 !py-0 text-[0.65rem] uppercase"
        data-testid="replay-badge"
      >
        replay
      </Badge>
      {!isBot && !compact && ghost.replayOf && (
        <span className="text-xs font-normal text-ink-subtle">
          (replay from {formatDay(ghost.replayOf)})
        </span>
      )}
    </span>
  );
}
