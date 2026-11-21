/**
 * Share card markup, rendered by the renderer service (Chromium, JavaScript off, DejaVu fonts
 * only). Trusted template: every piece of user content goes through escapeHtml. Self-contained:
 * no external resources (the logo is inline SVG).
 */
import { escapeHtml as e } from './escape.js';

export const CARD_FORMATS = {
  og: { width: 1200, height: 630 }, // link previews (Open Graph / Twitter)
  story: { width: 1080, height: 1920 }, // Instagram / WhatsApp stories
};

const OUTCOME_COLORS = { VICTORY: '#34eaa2', DEFEAT: '#f87171', DRAW: '#c6cddf' };

const LOGO =
  '<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M12 8 4 16l8 8" fill="none" stroke="#34eaa2" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="m20 8 8 8-8 8" fill="none" stroke="#52bcff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:var(--w);height:var(--h);overflow:hidden;color:#eef1f7;font-family:"DejaVu Sans",sans-serif;
  background:radial-gradient(900px 500px at 0% 0%,rgba(52,234,162,.16),transparent 70%),
  radial-gradient(800px 500px at 100% 100%,rgba(82,188,255,.14),transparent 70%),#07090f}
.card{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-weight:bold}
.logo-mark{width:1.25em;height:1.25em}
.brand b{color:#34eaa2}
.chip{display:inline-block;border:2px solid #2c3448;border-radius:999px;color:#c6cddf;background:rgba(15,19,29,.8)}
.outcome{font-weight:bold;letter-spacing:.04em;color:var(--outcome)}
.reason{color:#c6cddf}
.problem{font-weight:bold}
.muted{color:#8a95b3}
.players{display:flex;align-items:center}
.player{flex:1;border:2px solid #2c3448;border-radius:22px;background:rgba(15,19,29,.85);min-width:0}
.player.me{border-color:rgba(52,234,162,.55)}
.player .name{font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.player .elo{font-family:"DejaVu Sans Mono",monospace;color:#a7b0c8}
.badge{display:inline-block;border-radius:8px;font-weight:bold;letter-spacing:.06em;color:#07090f;background:#93d6ff}
.badge.bot{background:#fbbf24}
.vs{font-weight:bold;color:#8a95b3;text-align:center}
.stats{display:flex;justify-content:space-between;align-items:flex-end}
.stat strong{display:block;font-family:"DejaVu Sans Mono",monospace;color:#eef1f7}
.delta.up{color:#34eaa2}.delta.down{color:#f87171}.delta.zero{color:#c6cddf}
.url{font-family:"DejaVu Sans Mono",monospace;color:#52bcff}
`;

const OG_CSS = `
:root{--w:1200px;--h:630px}
.card{padding:48px 60px}
.brand{font-size:34px}
.top{display:flex;justify-content:space-between;align-items:center}
.chip{font-size:20px;padding:8px 18px}
.middle{margin-top:34px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
.outcome{font-size:92px;line-height:1}
.reason{font-size:26px;margin-top:10px}
.problem{font-size:30px;text-align:right}
.meta{font-size:22px;margin-top:8px;text-align:right}
.players{margin-top:34px;gap:24px}
.player{padding:20px 26px}
.player .name{font-size:32px}
.player .elo{font-size:22px;margin-top:6px}
.badge{font-size:16px;padding:4px 10px;margin-left:10px;vertical-align:middle}
.vs{font-size:30px;width:60px}
.stats{margin-top:auto;font-size:20px}
.stat strong{font-size:28px;margin-top:4px}
.url{font-size:22px}
`;

const STORY_CSS = `
:root{--w:1080px;--h:1920px}
.card{padding:110px 80px 100px;align-items:center;text-align:center}
.brand{font-size:56px}
.chip{font-size:30px;padding:12px 28px;margin-top:44px}
.outcome{font-size:150px;line-height:1;margin-top:110px}
.reason{font-size:40px;margin-top:24px}
.problem{font-size:50px;margin-top:70px}
.meta{font-size:34px;margin-top:16px}
.players{flex-direction:column;width:100%;gap:22px;margin-top:70px}
.player{width:100%;padding:34px 40px}
.player .name{font-size:52px}
.player .elo{font-size:34px;margin-top:10px}
.badge{font-size:24px;padding:6px 14px;margin-left:14px;vertical-align:middle}
.vs{font-size:40px}
.stats{margin-top:auto;width:100%;font-size:28px;flex-direction:column;align-items:center;gap:26px}
.stat strong{font-size:40px;margin-top:6px}
.url{font-size:34px;margin-top:44px}
`;

function badge(kind) {
  if (kind === 'ghost') return '<span class="badge">GHOST · REPLAY</span>';
  if (kind === 'bot') return '<span class="badge bot">BOT</span>';
  return '';
}

function player(p, cls) {
  return `<div class="player ${cls}"><div class="name">@${e(p.username)}${badge(p.badge)}</div><div class="elo">${e(p.elo)} ELO</div></div>`;
}

function delta(change) {
  if (change === null || change === undefined) return '<strong class="delta zero">Unrated</strong>';
  const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'zero';
  return `<strong class="delta ${cls}">${change > 0 ? '+' : ''}${e(change)} ELO</strong>`;
}

/** → { html, css, width, height } for the renderer. */
export function buildCard(summary, format, { appHost }) {
  const size = CARD_FORMATS[format];
  if (!size) throw new Error(`Unknown card format ${format}`);
  const css =
    BASE_CSS +
    (format === 'og' ? OG_CSS : STORY_CSS) +
    `:root{--outcome:${OUTCOME_COLORS[summary.outcome] ?? '#eef1f7'}}`;
  const brand = `<div class="brand">${LOGO}<span>Code <b>Duel</b></span></div>`;
  const chip = `<span class="chip">${e(summary.mode)} · ${e(summary.category)}</span>`;
  const outcome = `<div><div class="outcome">${e(summary.outcome)}</div><div class="reason">${e(summary.reason)}</div></div>`;
  const problem = `<div><div class="problem">${e(summary.problem)}</div><div class="meta muted">${e(summary.category)} · ${e(summary.difficulty)}</div></div>`;
  const players = `<div class="players">${player(summary.me, 'me')}<div class="vs">VS</div>${player(summary.opponent, 'them')}</div>`;
  const stats = `<div class="stats"><div class="stat muted">Result<strong>${e(summary.stat)}</strong></div><div class="stat muted">Rating${delta(summary.eloChange)}</div><div class="stat muted">Date<strong>${e(summary.date)}</strong></div></div>`;
  const url = `<div class="url">${e(appHost)}</div>`;

  const html =
    format === 'og'
      ? `<div class="card"><div class="top">${brand}${chip}</div><div class="middle">${outcome}${problem}</div>${players}${stats}<div style="margin-top:18px;text-align:right">${url}</div></div>`
      : `<div class="card">${brand}${chip}${outcome}${problem}${players}${stats}${url}</div>`;
  return { html, css, ...size };
}
