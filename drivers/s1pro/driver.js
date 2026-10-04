import Homey from 'homey';
import { SensyError } from '../../lib/errors.js';
import { loggerFrom } from '../../lib/utils.js';
import { DeviceProbe } from '../../lib/esphome/DeviceProbe.js';
import { FlowCards } from '../../lib/homey/FlowCards.js';
import { S1ProPairing } from '../../lib/homey/S1ProPairing.js';

/** @typedef {import('./device.js').default} S1ProDevice */
/** @typedef {import('../../lib/homey/S1ProPairing.js').MdnsDiscoveryResult} MdnsDiscoveryResult */

/** Pairing errors with a message for the user, by error code. */
const PAIRING_MESSAGES = Object.freeze({
  VALIDATION: 'pair.manual.invalid_address',
  NOT_REACHABLE: 'pair.manual.not_reachable',
  UNSUPPORTED_DEVICE: 'pair.manual.unsupported',
  ALREADY_ADDED: 'pair.manual.already_added',
});

/** Driver for the Sensy-One S1 Pro Multi Sense. */
export default class S1ProDriver extends Homey.Driver {
  /** Pairing view where the user enters an address when mDNS finds nothing. */
  static MANUAL_VIEW = 'manual';

  /** @type {FlowCards} */
  #flowCards;

  /** @type {S1ProPairing} */
  #pairing;

  async onInit() {
    this.#flowCards = new FlowCards(this.homey.flow, loggerFrom(this));
    this.#flowCards.register();
    this.#pairing = new S1ProPairing(new DeviceProbe({ timers: this.homey }));
  }

  /** @returns {FlowCards} */
  get flowCards() {
    return this.#flowCards;
  }

  /** @returns {S1ProDevice[]} */
  get sensors() {
    return /** @type {S1ProDevice[]} */ (this.getDevices());
  }

  /**
   * @param {Parameters<Homey.Driver['onPair']>[0]} session
   */
  async onPair(session) {
    session.setHandler('list_devices', async () => {
      const devices = this.#pairing.discovered(this.#discoveryResults(), this.#pairedIds());

      if (devices.length === 0) {
        await session.showView(S1ProDriver.MANUAL_VIEW);
      }

      return devices;
    });

    session.setHandler('add_by_address', async ({ address }) => {
      return this.#addByAddress(address);
    });
  }

  /**
   * @param {unknown} address
   */
  async #addByAddress(address) {
    try {
      return await this.#pairing.byAddress(address, this.#pairedIds());
    } catch (error) {
      throw this.#toUserError(error);
    }
  }

  /**
   * @param {unknown} error
   * @returns {Error}
   */
  #toUserError(error) {
    if (!(error instanceof SensyError)) {
      return /** @type {Error} */ (error);
    }

    const key = PAIRING_MESSAGES[/** @type {keyof typeof PAIRING_MESSAGES} */ (error.code)];

    if (!key) {
      return error;
    }

    this.log(`Adding by address failed: ${error.message}`);

    return new Error(this.homey.__(key));
  }

  /** @returns {MdnsDiscoveryResult[]} */
  #discoveryResults() {
    const results = this.getDiscoveryStrategy().getDiscoveryResults();

    return /** @type {MdnsDiscoveryResult[]} */ (Object.values(results));
  }

  /** @returns {Set<string>} */
  #pairedIds() {
    return new Set(this.sensors.map((device) => device.getData().id));
  }
}
