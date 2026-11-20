import { createRandom } from './random.js';

/**
 * Cross-checks a fast oracle against a brute-force one on random inputs, so the expected values
 * of large tests (too big for brute force) are trustworthy. Throws on any mismatch.
 */
export function crossCheck(name, { fast, brute, generate, runs = 40, seed = 99 }) {
  const rand = createRandom(seed);
  for (let i = 0; i < runs; i++) {
    const args = generate(rand);
    const a = fast(...args);
    const b = brute(...args);
    if (a !== b)
      throw new Error(`${name}: oracle mismatch on ${JSON.stringify(args)}: ${a} vs ${b}`);
  }
}
