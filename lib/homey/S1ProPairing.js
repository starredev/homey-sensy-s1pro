import { AlreadyAddedError, UnsupportedDeviceError } from '../core/errors.js';
import { Endpoint } from '../esphome/Endpoint.js';
import { S1ProProfile } from '../sensor/S1ProProfile.js';

/** @typedef {import('../esphome/DeviceProbe.js').DeviceProbe} DeviceProbe */

/**
 * @typedef {object} MdnsDiscoveryResult
 * @property {string} id the sensor's MAC address (lower-case hex)
 * @property {string} address
 * @property {number} [port]
 * @property {Record<string, string>} [txt]
 */

/**
 * @typedef {object} PairableDevice
 * The object Homey's pairing views turn into a device.
 * @property {string} name
 * @property {{ id: string }} data
 * @property {{ address: string, port: number }} store
 * @property {{ address: string }} settings
 */

/**
 * Turns sensors found on the network into devices Homey can add: either from
 * mDNS discovery, or from an address the user typed when mDNS found nothing.
 * Both paths produce the same device id (the MAC address), so a sensor added
 * by address is still followed by mDNS later.
 */
export class S1ProPairing {
  /** @type {DeviceProbe} */
  #probe;

  /**
   * @param {DeviceProbe} probe
   */
  constructor(probe) {
    this.#probe = probe;
  }

  /**
   * @param {Iterable<MdnsDiscoveryResult>} results sensors found through mDNS
   * @param {Set<string>} pairedIds ids of sensors that are already added
   * @returns {PairableDevice[]} sensors that can still be added
   */
  discovered(results, pairedIds) {
    const devices = [];

    for (const result of results) {
      if (pairedIds.has(result.id) || !result.address) {
        continue;
      }

      const name = result.txt?.friendly_name || S1ProProfile.defaultName;

      devices.push(S1ProPairing.#pairable(result.id, name, new Endpoint(result.address, result.port)));
    }

    return devices;
  }

  /**
   * Connects to an address the user typed and checks that an S1 Pro answers.
   * @param {unknown} address e.g. `192.168.1.20` or `s1-pro-multi-sense-2cd9f0.local`
   * @param {Set<string>} pairedIds ids of sensors that are already added
   * @returns {Promise<PairableDevice>}
   * @throws {import('../core/errors.js').ValidationError} for input that is not an address
   * @throws {import('../core/errors.js').NotReachableError} when nothing answers
   * @throws {UnsupportedDeviceError} when another ESPHome device answers
   * @throws {AlreadyAddedError} when the sensor is already added
   */
  async byAddress(address, pairedIds) {
    const endpoint = Endpoint.parse(address);
    const identity = await this.#probe.identify(endpoint);

    if (identity.projectName !== S1ProProfile.projectName) {
      throw new UnsupportedDeviceError(identity.projectName);
    }

    if (pairedIds.has(identity.id)) {
      throw new AlreadyAddedError(identity.id);
    }

    return S1ProPairing.#pairable(identity.id, identity.name || S1ProProfile.defaultName, endpoint);
  }

  /**
   * @param {string} id
   * @param {string} name
   * @param {Endpoint} endpoint
   * @returns {PairableDevice}
   */
  static #pairable(id, name, endpoint) {
    return {
      name,
      data: {
        id,
      },
      store: {
        address: endpoint.host,
        port: endpoint.port,
      },
      settings: {
        address: endpoint.host,
      },
    };
  }
}
