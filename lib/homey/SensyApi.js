import { NotFoundError, ValidationError } from '../core/errors.js';
import { Polygon } from '../domain/Polygon.js';
import { Zone } from '../domain/Zone.js';
import { SensorPresenter } from '../presentation/SensorPresenter.js';

/** @typedef {import('../presentation/SensorPresenter.js').SensorView} SensorView */
/** @typedef {import('../presentation/SensorPresenter.js').DeviceSummary} DeviceSummary */
/** @typedef {import('../presentation/SensorPresenter.js').Snapshot} Snapshot */

/**
 * Application service behind the web API (`api.js`) and the widget API.
 * Resolves sensors, validates untrusted input and delegates to the domain.
 */
export class SensyApi {
  /** @type {() => SensorView[]} */
  #sensors;

  /**
   * @param {() => SensorView[]} sensors lists the paired sensors
   */
  constructor(sensors) {
    this.#sensors = sensors;
  }

  /** @returns {DeviceSummary[]} */
  listDevices() {
    return this.#sensors().map((view) => SensorPresenter.summary(view));
  }

  /**
   * @param {string} [id] omit to get the first sensor (a widget without a selection)
   * @returns {Snapshot | null} null when no sensor is paired
   */
  getSnapshot(id) {
    const view = this.#findOrFirst(id);

    if (!view) {
      return null;
    }

    return SensorPresenter.snapshot(view);
  }

  /**
   * @param {string} id
   * @param {string} zone
   * @param {unknown} body `{ points: [[x, y], …] }`; an empty list clears the zone
   * @returns {{ zone: string, points: number[][] }}
   */
  setZone(id, zone, body) {
    const target = Zone.from(zone);
    const { points = [] } = SensyApi.#asObject(body);
    const polygon = Polygon.from(points);

    this.#find(id).sensor.setZoneOutline(target, polygon);

    return {
      zone: target.key,
      points: polygon.toJSON(),
    };
  }

  /**
   * @param {string} id
   * @param {string} zone
   * @param {unknown} body `{ presenceDelay?, movementThreshold? }`
   * @returns {{ zone: string }}
   */
  setZoneOptions(id, zone, body) {
    const target = Zone.detection(zone);
    const { presenceDelay, movementThreshold } = SensyApi.#asObject(body);

    this.#find(id).sensor.setZoneOptions(target, { presenceDelay, movementThreshold });

    return { zone: target.key };
  }

  /**
   * @param {string} id
   * @returns {SensorView}
   * @throws {NotFoundError}
   */
  #find(id) {
    const view = this.#sensors().find((candidate) => candidate.id === id);

    if (!view) {
      throw new NotFoundError('Sensor not found');
    }

    return view;
  }

  /**
   * @param {string | undefined} id
   * @returns {SensorView | undefined}
   */
  #findOrFirst(id) {
    if (id) {
      return this.#find(id);
    }

    return this.#sensors()[0];
  }

  /**
   * @param {unknown} body
   * @returns {Record<string, any>}
   * @throws {ValidationError} when the body is not a JSON object
   */
  static #asObject(body) {
    if (body == null) {
      return {};
    }

    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Expected a JSON object');
    }

    return /** @type {Record<string, any>} */ (body);
  }
}
