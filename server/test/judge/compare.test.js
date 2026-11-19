import { describe, expect, it } from 'vitest';
import { outputsEqual } from '../../src/services/judge/compare.js';

describe('outputsEqual', () => {
  it.each([
    ['equal integers', 3, 3],
    ['floats within 1e-6', 0.1 + 0.2, 0.3],
    ['float vs integer value', 2.0000000001, 2],
    ['large floats (relative tolerance)', 1e12 + 0.5, 1e12],
    ['equal strings', 'abc', 'abc'],
    ['booleans', true, true],
    ['null', null, null],
    [
      'nested arrays',
      [
        [1, 2],
        [3, [4.0000001]],
      ],
      [
        [1, 2],
        [3, [4]],
      ],
    ],
    ['objects in any key order', { b: [1], a: 'x' }, { a: 'x', b: [1] }],
    ['empty arrays', [], []],
  ])('accepts %s', (_label, actual, expected) => {
    expect(outputsEqual(actual, expected)).toBe(true);
  });

  it.each([
    ['different integers', 3, 4],
    ['integers off by one even if "close"', 1_000_000_001, 1_000_000_000],
    ['floats beyond 1e-6', 0.3001, 0.3],
    ['number vs numeric string', '3', 3],
    ['boolean vs number', true, 1],
    ['false vs 0', 0, false],
    ['null vs 0', null, 0],
    ['different array order', [1, 0], [0, 1]],
    ['different array length', [1, 2], [1, 2, 3]],
    ['array vs object', [1], { 0: 1 }],
    ['missing object key', { a: 1 }, { a: 1, b: 2 }],
    ['extra object key', { a: 1, b: 2 }, { a: 1 }],
    ['undefined vs null', undefined, null],
    ['different strings', 'abc', 'abd'],
  ])('rejects %s', (_label, actual, expected) => {
    expect(outputsEqual(actual, expected)).toBe(false);
  });
});
