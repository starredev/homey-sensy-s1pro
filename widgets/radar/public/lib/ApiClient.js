// Generated from web/shared by scripts/sync-web.js. Do not edit.
/** @typedef {(error: unknown, result?: unknown) => void} ApiCallback */

/**
 * @typedef {object} HomeyBridge
 * The `Homey` object Homey passes to `onHomeyReady` in a web view.
 * @property {(method: string, path: string, body?: unknown, callback?: ApiCallback) => unknown} api
 * @property {(event: string, handler: (data: any) => void) => void} on
 */

/**
 * Talks to the app's web API from a web view. The settings page and the
 * dashboard widget expose different `Homey.api` signatures, so each has its
 * own subclass.
 * @abstract
 */
export class ApiClient {
  /** @type {HomeyBridge} */
  homey;

  /**
   * @param {HomeyBridge} homey
   */
  constructor(homey) {
    if (new.target === ApiClient) {
      throw new TypeError('ApiClient is abstract');
    }

    this.homey = homey;
  }

  /**
   * @abstract
   * @param {string} _method
   * @param {string} _path
   * @param {unknown} [_body]
   * @returns {Promise<any>}
   */
  request(_method, _path, _body) {
    throw new TypeError('Not implemented');
  }

  /**
   * @param {string} path
   * @returns {Promise<any>}
   */
  get(path) {
    return this.request('GET', path);
  }

  /**
   * @param {string} path
   * @param {unknown} body
   * @returns {Promise<any>}
   */
  put(path, body) {
    return this.request('PUT', path, body);
  }

  /**
   * Subscribes to a realtime event of the app.
   * @param {string} event
   * @param {(data: any) => void} handler
   */
  on(event, handler) {
    this.homey.on(event, handler);
  }
}

/**
 * Settings page: `Homey.api(method, path, body, callback)`.
 */
export class SettingsApiClient extends ApiClient {
  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<any>}
   */
  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      this.homey.api(method, path, body, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }
}

/**
 * Dashboard widget: `Homey.api(method, path, body)` returns a promise.
 */
export class WidgetApiClient extends ApiClient {
  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<any>}
   */
  async request(method, path, body = {}) {
    return this.homey.api(method, path, body);
  }
}

/**
 * @param {unknown} error
 * @returns {string} a message suitable for the user
 */
export function messageOf(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
