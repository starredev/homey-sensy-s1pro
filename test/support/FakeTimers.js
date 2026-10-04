/**
 * Deterministic clock implementing the Timers port.
 */
export class FakeTimers {
  #now = 0;

  #nextHandle = 1;

  /** @type {Map<number, { at: number, callback: () => void }>} */
  #pending = new Map();

  /**
   * @param {() => void} callback
   * @param {number} ms
   * @returns {number}
   */
  setTimeout(callback, ms) {
    const handle = this.#nextHandle;

    this.#nextHandle += 1;
    this.#pending.set(handle, { at: this.#now + ms, callback });

    return handle;
  }

  /**
   * @param {unknown} handle
   */
  clearTimeout(handle) {
    this.#pending.delete(Number(handle));
  }

  /** @returns {number} */
  get pendingCount() {
    return this.#pending.size;
  }

  /**
   * Moves the clock forward and runs every timer that became due, in order.
   * @param {number} ms
   */
  tick(ms) {
    const target = this.#now + ms;

    for (;;) {
      const due = this.#nextDue(target);

      if (!due) {
        break;
      }

      this.#pending.delete(due.handle);
      this.#now = due.at;
      due.callback();
    }

    this.#now = target;
  }

  /**
   * @param {number} target
   * @returns {{ handle: number, at: number, callback: () => void } | null}
   */
  #nextDue(target) {
    let next = null;

    for (const [handle, timer] of this.#pending) {
      if (timer.at > target) {
        continue;
      }

      if (next === null || timer.at < next.at) {
        next = { handle, ...timer };
      }
    }

    return next;
  }
}
