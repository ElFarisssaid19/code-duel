/** FRONTEND test fixtures: seed problem definitions, rendered targets, problem rows. */
import frontendProblems from '../prisma/seed/frontend/index.js';
import { frontendProblemData } from '../prisma/seed/frontendVerify.js';
import { targetImagePathFor, writeTarget } from '../src/services/frontend/targets.js';
import { renderPage } from '../src/services/renderer/index.js';

export const FRONTEND = Object.fromEntries(frontendProblems.map((p) => [p.slug, p]));

/** The page a definition's reference solution renders. */
export const referencePage = (p) => ({
  html: p.track === 'CSS' ? p.fixedHtml : p.reference.html,
  css: p.reference.css,
  width: p.canvas.width,
  height: p.canvas.height,
});

/** Renders a seed problem's target with the real renderer and creates its row (like the seed). */
export async function createFrontendProblem(prisma, slug) {
  const p = FRONTEND[slug];
  await writeTarget(targetImagePathFor(slug), await renderPage(referencePage(p)));
  return prisma.problem.create({ data: { slug, ...frontendProblemData(p) } });
}
