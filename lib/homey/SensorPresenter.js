import { Zone } from '../sensor/Zone.js';

/** @typedef {import('../sensor/S1ProSensor.js').S1ProSensor} S1ProSensor */
/** @typedef {import('../sensor/TargetTracker.js').TargetPosition} TargetPosition */

/**
 * @typedef {object} SensorView
 * Read model the presenter needs from a device.
 * @property {string} id stable device id (the sensor's MAC address)
 * @property {string} name
 * @property {S1ProSensor} sensor
 * @property {(capability: string) => unknown} capabilityValue
 */

/**
 * @typedef {object} DeviceSummary
 * @property {string} id
 * @property {string} name
 * @property {boolean} connected
 */

/**
 * @typedef {object} LiveZone
 * @property {number} zone
 * @property {boolean} presence
 * @property {boolean} movement
 * @property {number} people
 */

/**
 * @typedef {object} LivePayload
 * Pushed on the `sensy.live` realtime channel, several times per second.
 * @property {string} id
 * @property {boolean} connected
 * @property {TargetPosition[]} targets
 * @property {boolean} presence
 * @property {boolean} moving
 * @property {number} people
 * @property {LiveZone[]} zones
 */

/**
 * @typedef {object} ZoneSnapshot
 * @property {number[][]} points
 * @property {number} [presenceDelay]
 * @property {number} [movementThreshold]
 */

/**
 * @typedef {object} Snapshot
 * Full state for the widget and the zone editor.
 * @property {string} id
 * @property {string} name
 * @property {boolean} connected
 * @property {TargetPosition[]} targets
 * @property {boolean} presence
 * @property {boolean} moving
 * @property {number} people
 * @property {number} detectionRange
 * @property {Record<string, ZoneSnapshot>} zones keyed by zone key (`1`, `2`, `3`, `exclusion`)
 * @property {Record<string, unknown>} env
 */

/** Environment readings included in a snapshot, keyed by their API name. */
const ENVIRONMENT = Object.freeze({
  temperature: 'measure_temperature',
  humidity: 'measure_humidity',
  co2: 'measure_co2',
  iaq: 'sensy_iaq',
  lux: 'measure_luminance',
});

/**
 * Maps the sensor model onto the JSON contracts of the web API and the
 * realtime channels. The widget and the zone editor consume these shapes,
 * so they are kept stable.
 */
export class SensorPresenter {
  /**
   * @param {SensorView} view
   * @returns {DeviceSummary}
   */
  static summary(view) {
    return {
      id: view.id,
      name: view.name,
      connected: view.sensor.connected,
    };
  }

  /**
   * @param {SensorView} view
   * @returns {LivePayload}
   */
  static live(view) {
    const { sensor } = view;

    return {
      id: view.id,
      connected: sensor.connected,
      targets: sensor.targets,
      presence: sensor.present,
      moving: sensor.moving,
      people: sensor.people,
      zones: Zone.DETECTION.map((zone) => SensorPresenter.#liveZone(sensor, zone)),
    };
  }

  /**
   * @param {SensorView} view
   * @returns {Snapshot}
   */
  static snapshot(view) {
    const live = SensorPresenter.live(view);

    return {
      ...live,
      name: view.name,
      detectionRange: view.sensor.detectionRange,
      zones: SensorPresenter.#zones(view.sensor),
      env: SensorPresenter.#environment(view),
    };
  }

  /**
   * @param {S1ProSensor} sensor
   * @param {Zone} zone
   * @returns {LiveZone}
   */
  static #liveZone(sensor, zone) {
    return {
      zone: Number(zone.number),
      ...sensor.zoneStatus(zone),
    };
  }

  /**
   * @param {S1ProSensor} sensor
   * @returns {Record<string, ZoneSnapshot>}
   */
  static #zones(sensor) {
    /** @type {Record<string, ZoneSnapshot>} */
    const zones = {};

    for (const zone of Zone.ALL) {
      const outline = sensor.zoneOutline(zone);
      const points = outline?.toJSON() ?? [];

      if (zone.isExclusion) {
        zones[zone.key] = { points };
      } else {
        zones[zone.key] = { points, ...sensor.zoneOptions(zone) };
      }
    }

    return zones;
  }

  /**
   * @param {SensorView} view
   * @returns {Record<string, unknown>}
   */
  static #environment(view) {
    /** @type {Record<string, unknown>} */
    const environment = {};

    for (const [key, capability] of Object.entries(ENVIRONMENT)) {
      environment[key] = view.capabilityValue(capability) ?? null;
    }

    return environment;
  }
}
