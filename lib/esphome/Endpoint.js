import { ValidationError } from '../core/errors.js';

/** Hostnames and IPv4 addresses: letters, digits, dots and hyphens. */
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

/** Network address of an ESPHome device. Immutable value object. */
export class Endpoint {
  static DEFAULT_PORT = 6053;

  /** @type {string} */
  host;

  /** @type {number} */
  port;

  /**
   * @param {string} host
   * @param {number} [port]
   */
  constructor(host, port = Endpoint.DEFAULT_PORT) {
    if (!host) {
      throw new ValidationError('An ESPHome endpoint needs a host');
    }

    this.host = host;
    this.port = Number(port) || Endpoint.DEFAULT_PORT;
    Object.freeze(this);
  }

  /**
   * Parses what a user types as a sensor address, such as `192.168.1.20`,
   * `192.168.1.20:6053`, `s1-pro-multi-sense-2cd9f0.local` or a URL copied
   * from the browser (`http://192.168.1.20/`).
   * @param {unknown} input
   * @returns {Endpoint}
   * @throws {ValidationError} when the input is not a host name or IP address
   */
  static parse(input) {
    const text = String(input ?? '')
      .trim()
      .replace(/^[a-z]+:\/\//i, '')
      .replace(/\/.*$/, '');

    const [host = '', port, ...rest] = text.split(':');

    if (!HOST_PATTERN.test(host) || rest.length > 0) {
      throw new ValidationError(`Not a valid address: ${String(input ?? '')}`);
    }

    if (port === undefined) {
      return new Endpoint(host.toLowerCase());
    }

    const number = Number(port);

    if (!Number.isInteger(number) || number < 1 || number > 65_535) {
      throw new ValidationError(`Not a valid port: ${port}`);
    }

    return new Endpoint(host.toLowerCase(), number);
  }

  /**
   * @param {Endpoint | null | undefined} other
   * @returns {boolean}
   */
  equals(other) {
    return other?.host === this.host && other?.port === this.port;
  }

  toString() {
    return `${this.host}:${this.port}`;
  }
}
