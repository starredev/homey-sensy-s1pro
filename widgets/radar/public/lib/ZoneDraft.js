// Generated from web/shared by scripts/sync-web.js. Do not edit.
/**
 * The outline being drawn in the zone editor. Emits `change` whenever the
 * user adds, moves or removes a point.
 */
export class ZoneDraft extends EventTarget {
  static MAX_POINTS = 8;

  static MIN_POINTS = 3;

  /** @type {[number, number][]} */
  #points = [];

  /**
   * @param {readonly (readonly number[])[]} [points]
   */
  constructor(points = []) {
    super();
    this.#points = ZoneDraft.#copy(points);
  }

  /** @returns {[number, number][]} a copy of the points */
  get points() {
    return ZoneDraft.#copy(this.#points);
  }

  /** @returns {number} */
  get size() {
    return this.#points.length;
  }

  /** @returns {boolean} whether more points can be added */
  get canAdd() {
    return this.#points.length < ZoneDraft.MAX_POINTS;
  }

  /** @returns {boolean} empty (clears the zone) or a valid polygon */
  get isSavable() {
    return this.#points.length === 0 || this.#points.length >= ZoneDraft.MIN_POINTS;
  }

  /** @returns {number} points still needed for a valid polygon */
  get missing() {
    return Math.max(0, ZoneDraft.MIN_POINTS - this.#points.length);
  }

  /**
   * @param {[number, number]} point
   * @returns {boolean} whether the point was added
   */
  add(point) {
    if (!this.canAdd) {
      return false;
    }

    this.#points.push([point[0], point[1]]);
    this.#changed();

    return true;
  }

  /**
   * Moves a point without announcing it; call {@link ZoneDraft#commit} when the drag ends.
   * @param {number} index
   * @param {[number, number]} point
   */
  move(index, point) {
    if (index < 0 || index >= this.#points.length) {
      return;
    }

    this.#points[index] = [point[0], point[1]];
  }

  /** Announces the result of a drag. */
  commit() {
    this.#changed();
  }

  undo() {
    if (this.#points.length === 0) {
      return;
    }

    this.#points.pop();
    this.#changed();
  }

  clear() {
    this.#points = [];
    this.#changed();
  }

  #changed() {
    this.dispatchEvent(new Event('change'));
  }

  /**
   * @param {readonly (readonly number[])[]} points
   * @returns {[number, number][]}
   */
  static #copy(points) {
    return points.map(([x, y]) => [x, y]);
  }
}
