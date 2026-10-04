/**
 * Clamps a number into the inclusive range [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Creates a converter that rounds to a fixed number of decimals.
 * @param {number} decimals
 * @returns {(value: unknown) => number}
 */
export function roundTo(decimals) {
  const factor = 10 ** decimals;

  return (value) => {
    return Math.round(Number(value) * factor) / factor;
  };
}

/**
 * Parses a finite number, falling back when the input is not numeric.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function toFiniteNumber(value, fallback) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  return fallback;
}
