/** Only the fields a track lets the player write (the server refuses the others). */
export function submissionPayload(problem, { html, css }) {
  if (problem.track === 'CSS') return { css };
  if (problem.track === 'HTML') return { html };
  return { html, css };
}
