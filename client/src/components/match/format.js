/** 125000 → "2:05" */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const REASON_LABELS = {
  SOLVED: 'Solved',
  TIMEOUT: 'Time is up',
  FORFEIT: 'Forfeit',
  DISCONNECT: 'Disconnect',
  CANCELLED: 'Cancelled',
};
