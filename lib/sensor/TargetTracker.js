/** @typedef {[x: number, y: number] | null} TargetPosition */

/**
 * @typedef {object} PositionSource
 * How a firmware reports positions; see `TargetFeed` in the sensor layer.
 * @property {(x: number, y: number) => boolean} isEmpty whether a position means "no target"
 * @property {(axis: 'x' | 'y') => boolean} completes whether an update of this axis completes a position
 */

/**
 * Assembles the per-axis position updates of the radar's three target slots
 * into complete positions. How positions are reported depends on the
 * firmware, so the caller passes its {@link PositionSource} with every update.
 */
export class TargetTracker {
  static SLOTS = 3;

  /** @type {{ x?: number, y?: number }[]} */
  #axes = TargetTracker.#emptyAxes();

  /** @type {TargetPosition[]} */
  #positions = TargetTracker.#emptyPositions();

  /**
   * @param {number} slot 0-based target slot
   * @param {'x' | 'y'} axis
   * @param {number} value centimetres
   * @param {PositionSource} source
   * @returns {boolean} whether the position of the slot changed
   */
  update(slot, axis, value, source) {
    const axes = this.#axes[slot];

    if (!axes) {
      return false;
    }

    axes[axis] = Number(value);

    const { x, y } = axes;

    if (x === undefined || y === undefined || !source.completes(axis)) {
      return false;
    }

    const next = TargetTracker.#toPosition(x, y, source.isEmpty);
    const changed = !TargetTracker.#samePosition(this.#positions[slot], next);

    this.#positions[slot] = next;

    return changed;
  }

  /** @returns {TargetPosition[]} a copy of the current positions */
  get positions() {
    return this.#positions.map((position) => {
      if (position === null) {
        return null;
      }

      return [position[0], position[1]];
    });
  }

  reset() {
    this.#axes = TargetTracker.#emptyAxes();
    this.#positions = TargetTracker.#emptyPositions();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {PositionSource['isEmpty']} isEmpty
   * @returns {TargetPosition}
   */
  static #toPosition(x, y, isEmpty) {
    if (isEmpty(x, y)) {
      return null;
    }

    return [Math.round(x), Math.round(y)];
  }

  /**
   * @param {TargetPosition} a
   * @param {TargetPosition} b
   * @returns {boolean}
   */
  static #samePosition(a, b) {
    if (a === null || b === null) {
      return a === b;
    }

    return a[0] === b[0] && a[1] === b[1];
  }

  /** @returns {{ x?: number, y?: number }[]} */
  static #emptyAxes() {
    return Array.from({ length: TargetTracker.SLOTS }, () => ({}));
  }

  /** @returns {TargetPosition[]} */
  static #emptyPositions() {
    return Array.from({ length: TargetTracker.SLOTS }, () => null);
  }
}
