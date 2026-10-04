import esphome from '@2colors/esphome-native-api';
import { NotReachableError } from '../core/errors.js';

/** @typedef {import('./Endpoint.js').Endpoint} Endpoint */
/** @typedef {import('../core/timers.js').Timers} Timers */

/**
 * @typedef {object} ProbeClient
 * Structural view of the library's `Client` for a one-shot connection.
 * @property {(event: string, listener: (...args: any[]) => void) => unknown} on
 * @property {() => void} connect
 * @property {() => void} disconnect
 * @property {() => void} removeAllListeners
 */

/** @typedef {(endpoint: Endpoint) => ProbeClient} ProbeClientFactory */

/**
 * What an ESPHome device says about itself.
 */
export class DeviceIdentity {
  /**
   * @param {object} info
   * @param {string} info.macAddress e.g. `48:F6:EE:2C:D9:F0`
   * @param {string} [info.name] ESPHome node name
   * @param {string} [info.friendlyName]
   * @param {string} [info.projectName]
   * @param {string} [info.projectVersion]
   */
  constructor({ macAddress, name = '', friendlyName = '', projectName = '', projectVersion = '' }) {
    /** Lower-case hex without separators: the same id mDNS discovery reports. */
    this.id = DeviceIdentity.normaliseMac(macAddress);
    this.name = friendlyName || name;
    this.projectName = projectName;
    this.projectVersion = projectVersion;
    Object.freeze(this);
  }

  /**
   * @param {string} macAddress
   * @returns {string}
   */
  static normaliseMac(macAddress) {
    return String(macAddress ?? '').replaceAll(':', '').toLowerCase();
  }
}

/**
 * Creates a library client that only fetches the device info.
 * @type {ProbeClientFactory}
 */
function createProbeClient({ host, port }) {
  const client = new esphome.Client({
    host,
    port,
    clientInfo: 'Homey Sensy S1 Pro (pairing)',
    reconnect: false,
    initializeListEntities: false,
    initializeSubscribeStates: false,
  });

  return /** @type {ProbeClient} */ (/** @type {unknown} */ (client));
}

/**
 * Connects to an address once to find out which ESPHome device is there.
 * Used when a sensor is added by IP address because mDNS did not find it.
 */
export class DeviceProbe {
  static TIMEOUT_MS = 8000;

  /** @type {Timers} */
  #timers;

  /** @type {ProbeClientFactory} */
  #createClient;

  /**
   * @param {object} options
   * @param {Timers} options.timers
   * @param {ProbeClientFactory} [options.clientFactory] injectable for tests
   */
  constructor({ timers, clientFactory = createProbeClient }) {
    this.#timers = timers;
    this.#createClient = clientFactory;
  }

  /**
   * @param {Endpoint} endpoint
   * @returns {Promise<DeviceIdentity>}
   * @throws {NotReachableError} when nothing answers in time
   */
  async identify(endpoint) {
    const client = this.#createClient(endpoint);

    try {
      const info = await this.#awaitDeviceInfo(client, endpoint);

      return new DeviceIdentity(info);
    } finally {
      DeviceProbe.#close(client);
    }
  }

  /**
   * @param {ProbeClient} client
   * @param {Endpoint} endpoint
   * @returns {Promise<any>}
   */
  #awaitDeviceInfo(client, endpoint) {
    return new Promise((resolve, reject) => {
      const timeout = this.#timers.setTimeout(() => {
        reject(new NotReachableError(String(endpoint)));
      }, DeviceProbe.TIMEOUT_MS);

      client.on('deviceInfo', (info) => {
        this.#timers.clearTimeout(timeout);
        resolve(info);
      });

      client.on('error', (error) => {
        this.#timers.clearTimeout(timeout);
        reject(new NotReachableError(String(endpoint), error));
      });

      client.connect();
    });
  }

  /**
   * @param {ProbeClient} client
   */
  static #close(client) {
    client.removeAllListeners();

    // A closing socket may still emit an error; it must never crash the app.
    client.on('error', () => {});

    try {
      client.disconnect();
    } catch {
      // Already closed.
    }
  }
}
