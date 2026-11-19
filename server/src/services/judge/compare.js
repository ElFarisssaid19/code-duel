export const FLOAT_TOLERANCE = 1e-6;

function numbersEqual(actual, expected) {
  if (Number.isInteger(actual) && Number.isInteger(expected)) return actual === expected;
  const diff = Math.abs(actual - expected);
  // Absolute tolerance, or relative tolerance for large magnitudes.
  return (
    diff <= FLOAT_TOLERANCE ||
    diff <= FLOAT_TOLERANCE * Math.max(Math.abs(actual), Math.abs(expected))
  );
}

/**
 * Deep JSON equality between the function's actual return value and the expected one.
 * Numbers compare with a 1e-6 tolerance unless both are integers; booleans never equal numbers;
 * object key order doesn't matter; array order does.
 */
export function outputsEqual(actual, expected) {
  if (typeof expected === 'number') {
    return typeof actual === 'number' && numbersEqual(actual, expected);
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, i) => outputsEqual(actual[i], item))
    );
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const keys = Object.keys(expected);
    return (
      keys.length === Object.keys(actual).length &&
      keys.every((key) => Object.hasOwn(actual, key) && outputsEqual(actual[key], expected[key]))
    );
  }
  return actual === expected; // strings, booleans, null
}
