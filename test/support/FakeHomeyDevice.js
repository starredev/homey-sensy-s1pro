/**
 * Records what the Homey layer does to a device's capabilities and settings.
 */
export class FakeHomeyDevice {
  /** @type {Map<string, unknown>} */
  capabilities = new Map();

  /** @type {Map<string, object>} */
  capabilityOptions = new Map();

  /** @type {Record<string, unknown>} */
  settings = {};

  /** @type {string[]} */
  log = [];

  /**
   * @param {string[]} capabilities
   */
  constructor(capabilities = []) {
    for (const id of capabilities) {
      this.capabilities.set(id, null);
    }
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasCapability(id) {
    return this.capabilities.has(id);
  }

  /**
   * @param {string} id
   * @returns {unknown}
   */
  getCapabilityValue(id) {
    return this.capabilities.get(id);
  }

  /**
   * @param {string} id
   * @param {unknown} value
   */
  async setCapabilityValue(id, value) {
    this.log.push(`set ${id}=${value}`);
    this.capabilities.set(id, value);
  }

  /**
   * @param {string} id
   */
  async addCapability(id) {
    this.log.push(`add ${id}`);
    this.capabilities.set(id, null);
  }

  /**
   * @param {string} id
   */
  async removeCapability(id) {
    this.log.push(`remove ${id}`);
    this.capabilities.delete(id);
  }

  /**
   * @param {string} id
   * @param {object} options
   */
  async setCapabilityOptions(id, options) {
    this.capabilityOptions.set(id, options);
  }

  /** @returns {Record<string, unknown>} */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * @param {Record<string, unknown>} settings
   */
  async setSettings(settings) {
    this.log.push(`settings ${JSON.stringify(settings)}`);
    Object.assign(this.settings, settings);
  }
}
