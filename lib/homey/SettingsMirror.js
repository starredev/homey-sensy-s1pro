import { NotConnectedError } from '../errors.js';
import { S1ProProfile } from '../sensor/S1ProProfile.js';

/** @typedef {import('../sensor/S1ProSensor.js').S1ProSensor} S1ProSensor */
/** @typedef {import('../sensor/bindings.js').SettingValue} SettingValue */

/**
 * @typedef {object} SettingsHost
 * The subset of `Homey.Device` used for settings.
 * @property {() => Record<string, unknown>} getSettings
 * @property {(settings: Record<string, unknown>) => Promise<void>} setSettings
 */

/** Device settings that are backed by an entity on the sensor. */
const SENSOR_SETTINGS = new Set(S1ProProfile.settings.map((binding) => binding.key));

/**
 * Keeps the device settings and the sensor's configuration entities in sync,
 * in both directions: user edits are pushed to the sensor, and changes made on
 * the sensor itself (web UI, Home Assistant, another app) are pulled back.
 */
export class SettingsMirror {
  /** @type {SettingsHost} */
  #host;

  /** @type {S1ProSensor} */
  #sensor;

  /**
   * @param {SettingsHost} host
   * @param {S1ProSensor} sensor
   */
  constructor(host, sensor) {
    this.#host = host;
    this.#sensor = sensor;
  }

  /** Copies sensor values that differ from the current settings into the settings. */
  async pull() {
    const current = this.#host.getSettings();
    const changed = Object.fromEntries(
      [...this.#sensor.readSettings()].filter(([key, value]) => current[key] !== value),
    );

    if (Object.keys(changed).length > 0) {
      await this.#host.setSettings(changed);
    }
  }

  /**
   * Writes changed settings to the sensor. Called from `onSettings`, so a
   * thrown error is shown to the user and the change is rolled back.
   * @param {Record<string, SettingValue>} settings
   * @param {string[]} changedKeys
   */
  push(settings, changedKeys) {
    const keys = changedKeys.filter((key) => SENSOR_SETTINGS.has(key));

    if (keys.length === 0) {
      return;
    }

    if (!this.#sensor.connected) {
      throw new NotConnectedError();
    }

    this.#sensor.applySettings(keys.map((key) => [key, settings[key]]));
  }
}
