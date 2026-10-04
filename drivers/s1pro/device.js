import Homey from 'homey';
import { NotConnectedError } from '../../lib/core/errors.js';
import { loggerFrom } from '../../lib/core/logger.js';
import { Endpoint } from '../../lib/esphome/Endpoint.js';
import { EsphomeConnection } from '../../lib/esphome/EsphomeConnection.js';
import { CapabilityStore } from '../../lib/homey/CapabilityStore.js';
import { SettingsMirror } from '../../lib/homey/SettingsMirror.js';
import { ZoneCapabilities } from '../../lib/homey/ZoneCapabilities.js';
import { S1ProSensor } from '../../lib/sensor/S1ProSensor.js';

/** @typedef {import('../../app.js').default} SensyApp */
/** @typedef {import('./driver.js').default} S1ProDriver */
/** @typedef {import('../../lib/presentation/SensorPresenter.js').SensorView} SensorView */

/**
 * @typedef {object} DiscoveryResult
 * @property {string} id
 * @property {string} [address]
 * @property {number} [port]
 */

/**
 * Homey adapter for one S1 Pro. Wires the sensor model to capabilities,
 * settings, flow triggers and the realtime channels; holds no domain logic.
 */
export default class S1ProDevice extends Homey.Device {
  /** @type {S1ProSensor} */
  #sensor;

  /** @type {CapabilityStore} */
  #capabilities;

  /** @type {ZoneCapabilities} */
  #zoneCapabilities;

  /** @type {SettingsMirror} */
  #settings;

  async onInit() {
    const logger = loggerFrom(this);
    const { address, port } = this.getStore();

    const connection = new EsphomeConnection({
      endpoint: new Endpoint(address, port),
      logger,
    });

    this.#sensor = new S1ProSensor({
      connection,
      timers: this.homey,
    });
    this.#capabilities = new CapabilityStore(this, logger);
    this.#zoneCapabilities = new ZoneCapabilities(this.#capabilities);
    this.#settings = new SettingsMirror(this, this.#sensor);

    this.#bindSensorEvents();

    await this.setUnavailable(this.homey.__('device.connecting')).catch(this.error);
    this.#sensor.start();
  }

  async onUninit() {
    this.#sensor?.stop();
  }

  async onDeleted() {
    this.#sensor?.stop();
  }

  /**
   * The domain model; used by flow cards and the API.
   * @returns {S1ProSensor}
   */
  get sensor() {
    return this.#sensor;
  }

  /**
   * Read model for the presenter.
   * @returns {SensorView}
   */
  get view() {
    return {
      id: this.getData().id,
      name: this.getName(),
      sensor: this.#sensor,
      capabilityValue: (capability) => this.#capabilities.get(capability),
    };
  }

  // --- Homey hooks ----------------------------------------------------------

  /**
   * @param {{ newSettings: Record<string, any>, changedKeys: string[] }} event
   */
  async onSettings({ newSettings, changedKeys }) {
    try {
      this.#settings.push(newSettings, changedKeys);
    } catch (error) {
      if (error instanceof NotConnectedError) {
        throw new Error(this.homey.__('device.not_connected'));
      }

      throw error;
    }
  }

  // --- Discovery: follow the sensor when its IP address changes --------------

  /**
   * @param {DiscoveryResult} result
   * @returns {boolean}
   */
  onDiscoveryResult(result) {
    return result.id === this.getData().id;
  }

  /** @param {DiscoveryResult} result */
  async onDiscoveryAvailable(result) {
    await this.#followTo(result);
  }

  /** @param {DiscoveryResult} result */
  async onDiscoveryAddressChanged(result) {
    await this.#followTo(result);
  }

  /** @param {DiscoveryResult} result */
  async onDiscoveryLastSeenChanged(result) {
    if (!this.#sensor.connected) {
      await this.#followTo(result);
    }
  }

  /** @param {DiscoveryResult} result */
  async #followTo({ address, port }) {
    if (!address) {
      return;
    }

    const endpoint = new Endpoint(address, port);

    if (!endpoint.equals(this.#sensor.endpoint)) {
      this.log(`Sensor moved to ${endpoint}`);
      await this.setStoreValue('address', endpoint.host);
      await this.setStoreValue('port', endpoint.port);
    }

    await this.setSettings({ address: endpoint.host }).catch(this.error);
    this.#sensor.moveTo(endpoint);
  }

  // --- Sensor event wiring ----------------------------------------------------

  #bindSensorEvents() {
    const sensor = this.#sensor;

    sensor.on('connected', () => {
      this.#runSafely(() => this.#onConnected());
    });

    sensor.on('disconnected', () => {
      this.#runSafely(() => this.#onDisconnected());
    });

    sensor.on('firmware', (firmware) => {
      this.#runSafely(() => this.setSettings({ firmware }));
    });

    sensor.on('address', (address) => {
      this.#runSafely(() => this.setSettings({ address }));
    });

    sensor.on('bluetoothProxy', (enabled) => {
      this.#runSafely(() => this.#showBluetoothProxyWarning(enabled));
    });

    sensor.on('capability', (capability, value) => {
      this.#runSafely(() => this.#capabilities.set(capability, value));
    });

    sensor.on('zoneStatus', (zone, status) => {
      this.#runSafely(() => this.#zoneCapabilities.update(zone, status));
    });

    sensor.on('event', (event) => {
      this.#runSafely(() => this.#driver.flowCards.dispatch(this, event));
    });

    sensor.on('live', () => {
      this.#app.realtime.live(this.view);
    });

    sensor.on('settings', () => {
      this.#runSafely(() => this.#settings.pull());
    });

    sensor.on('zones', () => {
      this.#runSafely(() => this.#onZonesChanged());
    });
  }

  async #onConnected() {
    await this.setAvailable();
    this.#app.publishDevices();
  }

  async #onDisconnected() {
    await this.setUnavailable(this.homey.__('device.disconnected'));
    this.#app.publishDevices();
  }

  /**
   * @param {boolean} enabled
   */
  async #showBluetoothProxyWarning(enabled) {
    if (enabled) {
      await this.setWarning(this.homey.__('device.bluetooth_proxy_on'));
    } else {
      await this.unsetWarning();
    }
  }

  async #onZonesChanged() {
    const sensor = this.#sensor;

    await this.#zoneCapabilities.reconcile(
      (zone) => sensor.zoneOutline(zone),
      (zone) => sensor.zoneStatus(zone),
    );

    this.#app.realtime.zones(this.view);
  }

  /**
   * Runs an async side effect from an event listener and logs its failure,
   * so a rejected promise never goes unhandled.
   * @param {() => Promise<unknown>} task
   */
  #runSafely(task) {
    task().catch((error) => {
      this.error(error);
    });
  }

  /** @returns {SensyApp} */
  get #app() {
    return /** @type {SensyApp} */ (this.homey.app);
  }

  /** @returns {S1ProDriver} */
  get #driver() {
    return /** @type {S1ProDriver} */ (this.driver);
  }
}
