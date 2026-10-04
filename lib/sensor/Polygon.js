import { ValidationError } from '../errors.js';
import { clamp } from '../utils.js';

/**
 * A vertex in centimetres: x = left (−) / right (+), y = distance in front of the sensor.
 * @typedef {readonly [x: number, y: number]} Point
 */

/**
 * Immutable zone outline. Either empty (zone disabled) or 3–8 vertices in
 * whole centimetres, clamped to the radar's coordinate range.
 */
export class Polygon {
  static MIN_POINTS = 3;

  static MAX_POINTS = 8;

  static COORDINATE_LIMIT = 1800;

  /** @type {readonly Point[]} */
  #points;

  /**
   * Use {@link Polygon.from} for untrusted input.
   * @param {readonly (readonly number[])[]} points already validated
   */
  constructor(points) {
    const frozen = points.map(([x, y]) => {
      return /** @type {Point} */ (Object.freeze([x, y]));
    });

    this.#points = Object.freeze(frozen);
    Object.freeze(this);
  }

  static EMPTY = new Polygon([]);

  /**
   * Validates and normalises untrusted input (API bodies, flow arguments).
   * @param {unknown} input
   * @returns {Polygon}
   * @throws {ValidationError}
   */
  static from(input) {
    if (!Array.isArray(input)) {
      throw new ValidationError('Points must be a list');
    }

    if (input.length === 0) {
      return Polygon.EMPTY;
    }

    if (input.length < Polygon.MIN_POINTS || input.length > Polygon.MAX_POINTS) {
      throw new ValidationError(`A zone needs ${Polygon.MIN_POINTS} to ${Polygon.MAX_POINTS} points`);
    }

    return new Polygon(input.map((point) => Polygon.#normalise(point)));
  }

  /**
   * @param {unknown} point
   * @returns {Point}
   */
  static #normalise(point) {
    if (!Array.isArray(point) || point.length < 2) {
      throw new ValidationError('Invalid point');
    }

    const x = Math.round(Number(point[0]));
    const y = Math.round(Number(point[1]));

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new ValidationError('Invalid point');
    }

    const limit = Polygon.COORDINATE_LIMIT;

    return [clamp(x, -limit, limit), clamp(y, -limit, limit)];
  }

  /** @returns {readonly Point[]} */
  get points() {
    return this.#points;
  }

  /** @returns {number} */
  get size() {
    return this.#points.length;
  }

  /** @returns {boolean} */
  get isEmpty() {
    return this.#points.length === 0;
  }

  /**
   * @param {Polygon} other
   * @returns {boolean}
   */
  equals(other) {
    if (this.size !== other.size) {
      return false;
    }

    return this.#points.every(([x, y], index) => {
      const [otherX, otherY] = other.points[index];

      return x === otherX && y === otherY;
    });
  }

  /** @returns {number[][]} plain JSON for the API */
  toJSON() {
    return this.#points.map(([x, y]) => [x, y]);
  }
}
