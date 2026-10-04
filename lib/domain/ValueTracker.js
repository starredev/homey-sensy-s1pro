/**
 * @template T
 * @typedef {object} Change
 * @property {T} value
 * @property {T | undefined} previous
 * @property {boolean} initial true for the first value after a (re)connect
 * @property {boolean} changed true when a primed key received a different value
 */

/**
 * Remembers the last value per key and reports how a new value relates to it.
 * The first value after {@link ValueTracker#reset} is flagged `initial`, so a
 * reconnect never fires flows for values that merely got re-sent.
 */
export class ValueTracker {
  /** @type {Map<string, unknown>} */
  #values = new Map();

  /** @type {Set<string>} */
  #primed = new Set();

  /**
   * @template T
   * @param {string} key
   * @param {T} value
   * @returns {Change<T>}
   */
  update(key, value) {
    const previous = /** @type {T | undefined} */ (this.#values.get(key));
    const initial = !this.#primed.has(key);

    this.#values.set(key, value);
    this.#primed.add(key);

    return {
      value,
      previous,
      initial,
      changed: !initial && previous !== value,
    };
  }

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback returned when the key has no value
   * @returns {T}
   */
  get(key, fallback) {
    const value = /** @type {T | undefined} */ (this.#values.get(key));

    return value ?? fallback;
  }

  /** Forgets which keys were seen, so the next value of each key is `initial`. Values are kept. */
  reset() {
    this.#primed.clear();
  }
}
