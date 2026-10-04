/**
 * @callback RouteHandler
 * @param {unknown} value the reported state
 * @param {string[]} groups regex capture groups (empty for exact matches)
 * @param {string} objectId
 * @returns {void}
 */

/**
 * Dispatches entity state updates to handlers by object id. Exact ids are
 * resolved through a map in O(1); patterns are tried in registration order.
 * The first matching route wins.
 */
export class StateRouter {
  /** @type {Map<string, RouteHandler>} */
  #exact = new Map();

  /** @type {{ pattern: RegExp, handler: RouteHandler }[]} */
  #patterns = [];

  /**
   * @param {string | Iterable<string> | RegExp} matcher
   * @param {RouteHandler} handler
   * @returns {this}
   */
  on(matcher, handler) {
    if (matcher instanceof RegExp) {
      this.#patterns.push({ pattern: matcher, handler });
    } else {
      const ids = typeof matcher === 'string' ? [matcher] : matcher;

      for (const id of ids) {
        this.#exact.set(id, handler);
      }
    }

    return this;
  }

  /**
   * @param {string} objectId
   * @param {unknown} value
   * @returns {boolean} whether a route handled the update
   */
  dispatch(objectId, value) {
    const exact = this.#exact.get(objectId);

    if (exact) {
      exact(value, [], objectId);

      return true;
    }

    for (const { pattern, handler } of this.#patterns) {
      const match = pattern.exec(objectId);

      if (match) {
        handler(value, match.slice(1), objectId);

        return true;
      }
    }

    return false;
  }
}
