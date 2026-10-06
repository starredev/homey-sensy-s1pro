/** @typedef {'moving' | 'stationary' | 'held' | null} TargetState */

/**
 * @typedef {object} MarkerStyle
 * @property {number} fillOpacity
 * @property {string} strokeDasharray `none` for a solid ring
 */

/**
 * How a target marker looks for what the person is doing. A person who stands
 * still gets a dashed ring; a person the radar holds while it briefly lost
 * them is drawn faded as well.
 */
export class TargetStyle {
  /** @type {Readonly<Record<string, MarkerStyle>>} */
  static #STYLES = Object.freeze({
    moving: Object.freeze({ fillOpacity: 1, strokeDasharray: 'none' }),
    stationary: Object.freeze({ fillOpacity: 1, strokeDasharray: '5 3' }),
    held: Object.freeze({ fillOpacity: 0.45, strokeDasharray: '5 3' }),
  });

  /**
   * @param {TargetState | undefined} state
   * @returns {MarkerStyle} moving looks like a firmware without states
   */
  static for(state) {
    return TargetStyle.#STYLES[state ?? 'moving'] ?? TargetStyle.#STYLES.moving;
  }
}
