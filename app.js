import Homey from 'homey';
import { loggerFrom } from './lib/core/logger.js';
import { RealtimeHub } from './lib/homey/RealtimeHub.js';
import { SensyApi } from './lib/homey/SensyApi.js';

/** @typedef {import('./drivers/s1pro/driver.js').default} S1ProDriver */
/** @typedef {import('./lib/presentation/SensorPresenter.js').SensorView} SensorView */

/**
 * Composition root. Creates the app-wide services and exposes them to the
 * devices (realtime publishing) and to the web API modules.
 */
export default class SensyApp extends Homey.App {
  static DRIVER_ID = 's1pro';

  static WIDGET_ID = 'radar';

  /** @type {RealtimeHub} */
  #realtime;

  /** @type {SensyApi} */
  #api;

  async onInit() {
    this.#realtime = new RealtimeHub({
      api: this.homey.api,
      timers: this.homey,
      logger: loggerFrom(this),
    });
    this.#api = new SensyApi(() => this.#sensorViews());

    this.#registerWidgetSettings();
    this.log('Sensy S1 Pro app started');
  }

  async onUninit() {
    this.#realtime?.dispose();
  }

  /** @returns {RealtimeHub} */
  get realtime() {
    return this.#realtime;
  }

  /** @returns {SensyApi} */
  get api() {
    return this.#api;
  }

  /** Tells the web views that the list of sensors (or their status) changed. */
  publishDevices() {
    this.#realtime.devices(this.#sensorViews());
  }

  /** @returns {SensorView[]} */
  #sensorViews() {
    try {
      const driver = /** @type {S1ProDriver} */ (this.homey.drivers.getDriver(SensyApp.DRIVER_ID));

      return driver.sensors.map((device) => device.view);
    } catch {
      // The driver is not ready yet while the app is still starting.
      return [];
    }
  }

  #registerWidgetSettings() {
    try {
      const widget = this.homey.dashboards.getWidget(SensyApp.WIDGET_ID);

      widget.registerSettingAutocompleteListener('device', async (query) => this.#searchDevices(query));
    } catch (error) {
      this.error('Could not register the widget settings', error);
    }
  }

  /**
   * @param {string} query
   */
  #searchDevices(query) {
    const needle = String(query ?? '').toLowerCase();

    return this.#api
      .listDevices()
      .filter((device) => device.name.toLowerCase().includes(needle))
      .map((device) => ({
        id: device.id,
        name: device.name,
        description: device.connected ? 'Online' : 'Offline',
      }));
  }
}
