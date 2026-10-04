/**
 * @typedef {object} Timers
 * Minimal timer port. Homey requires `homey.setTimeout` so timers are cleared
 * when the app stops; tests inject a fake clock.
 * @property {(callback: () => void, ms: number) => unknown} setTimeout
 * @property {(handle: unknown) => void} clearTimeout
 */

/**
 * Collapses bursts of calls into one trailing invocation.
 */
export class Debouncer {
  /** @type {Timers} */
  #timers;

  /** @type {() => unknown} */
  #task;

  /** @type {number} */
  #delay;

  /** @type {unknown} */
  #handle = null;

  /**
   * @param {Timers} timers
   * @param {number} delay milliseconds of quiet before the task runs
   * @param {() => unknown} task
   */
  constructor(timers, delay, task) {
    this.#timers = timers;
    this.#delay = delay;
    this.#task = task;
  }

  /** Restarts the quiet period. */
  schedule() {
    this.cancel();
    this.#handle = this.#timers.setTimeout(() => {
      this.#handle = null;
      this.#task();
    }, this.#delay);
  }

  cancel() {
    if (this.#handle === null) {
      return;
    }

    this.#timers.clearTimeout(this.#handle);
    this.#handle = null;
  }

  get pending() {
    return this.#handle !== null;
  }
}

/**
 * Collects keyed items and flushes the latest item per key at most once per
 * interval. Used to rate-limit realtime pushes of fast-moving radar data.
 * @template T
 */
export class KeyedThrottle {
  /** @type {Timers} */
  #timers;

  /** @type {number} */
  #interval;

  /** @type {(items: T[]) => void} */
  #flush;

  /** @type {Map<string, T>} */
  #queue = new Map();

  /** @type {unknown} */
  #handle = null;

  /**
   * @param {Timers} timers
   * @param {number} interval milliseconds between flushes
   * @param {(items: T[]) => void} flush
   */
  constructor(timers, interval, flush) {
    this.#timers = timers;
    this.#interval = interval;
    this.#flush = flush;
  }

  /**
   * @param {string} key
   * @param {T} item
   */
  push(key, item) {
    this.#queue.set(key, item);

    if (this.#handle !== null) {
      return;
    }

    this.#handle = this.#timers.setTimeout(() => {
      this.#drain();
    }, this.#interval);
  }

  cancel() {
    if (this.#handle !== null) {
      this.#timers.clearTimeout(this.#handle);
    }

    this.#handle = null;
    this.#queue.clear();
  }

  #drain() {
    const items = [...this.#queue.values()];

    this.#handle = null;
    this.#queue.clear();

    if (items.length > 0) {
      this.#flush(items);
    }
  }
}

/**
 * Resolves after `ms` milliseconds on the given timers.
 * @param {Timers} timers
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(timers, ms) {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}
