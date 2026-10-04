/**
 * @typedef {object} Logger
 * @property {(...args: unknown[]) => void} log
 * @property {(...args: unknown[]) => void} error
 */

/**
 * Logger that discards everything; the default for components under test.
 * @type {Logger}
 */
export const silentLogger = Object.freeze({
  log() {},
  error() {},
});

/**
 * Binds the logging methods of a Homey App, Driver or Device into a plain Logger.
 * @param {Logger} source
 * @returns {Logger}
 */
export function loggerFrom(source) {
  return {
    log: (...args) => {
      source.log(...args);
    },
    error: (...args) => {
      source.error(...args);
    },
  };
}
