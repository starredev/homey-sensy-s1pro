import { clamp, toFiniteNumber } from '../core/math.js';
import { Polygon } from '../domain/Polygon.js';
import { S1ProProfile } from './S1ProProfile.js';

/** @typedef {import('../esphome/EsphomeConnection.js').EsphomeConnection} EsphomeConnection */
/** @typedef {import('../domain/Zone.js').Zone} Zone */

/**
 * @typedef {object} ZoneOptions
 * @property {number} presenceDelay seconds presence is held after the last detection
 * @property {number} movementThreshold minimum speed (cm/s) that counts as movement
 */

/**
 * Persists zone outlines and per-zone options on the sensor. The firmware
 * stores a polygon as a point count plus up to eight `pN_x`/`pN_y` numbers.
 */
export class ZoneRepository {
  /** @type {EsphomeConnection} */
  #connection;

  /**
   * @param {EsphomeConnection} connection
   */
  constructor(connection) {
    this.#connection = connection;
  }

  /**
   * @param {Zone} zone
   * @returns {Polygon | null} the outline, or `null` while not all values have been received
   */
  read(zone) {
    const count = this.#connection.get(zone.entity('points_count'));

    if (count === undefined) {
      return null;
    }

    const size = Math.min(Math.round(toFiniteNumber(count, 0)), Polygon.MAX_POINTS);

    if (size < Polygon.MIN_POINTS) {
      return Polygon.EMPTY;
    }

    const points = [];

    for (let index = 1; index <= size; index++) {
      const x = this.#connection.get(zone.entity(`p${index}_x`));
      const y = this.#connection.get(zone.entity(`p${index}_y`));

      if (x === undefined || y === undefined) {
        return null;
      }

      points.push([Number(x), Number(y)]);
    }

    return Polygon.from(points);
  }

  /**
   * @param {Zone} zone
   * @returns {boolean} whether the zone has a usable outline
   */
  isConfigured(zone) {
    const polygon = this.read(zone);

    if (polygon === null) {
      return false;
    }

    return !polygon.isEmpty;
  }

  /**
   * Writes an outline. The zone is disabled while its points are rewritten so
   * the firmware never evaluates a half-updated polygon.
   * @param {Zone} zone
   * @param {Polygon} polygon
   */
  write(zone, polygon) {
    const connection = this.#connection;

    connection.setNumber(zone.entity('points_count'), 0);

    polygon.points.forEach(([x, y], index) => {
      connection.setNumber(zone.entity(`p${index + 1}_x`), x);
      connection.setNumber(zone.entity(`p${index + 1}_y`), y);
    });

    if (!polygon.isEmpty) {
      connection.setNumber(zone.entity('points_count'), polygon.size);
    }
  }

  /**
   * @param {Zone} zone a detection zone
   * @returns {ZoneOptions}
   */
  readOptions(zone) {
    const presenceDelay = this.#connection.get(zone.entity('presence_delay'));
    const movementThreshold = this.#connection.get(zone.entity('movement_threshold'));

    return {
      presenceDelay: toFiniteNumber(presenceDelay, 0),
      movementThreshold: toFiniteNumber(movementThreshold, 0),
    };
  }

  /**
   * Writes the given options; omitted (`undefined`/`null`) options are left untouched.
   * @param {Zone} zone a detection zone
   * @param {Partial<ZoneOptions>} options
   */
  writeOptions(zone, { presenceDelay, movementThreshold }) {
    const { limits } = S1ProProfile;

    if (presenceDelay != null) {
      const seconds = ZoneRepository.#bounded(presenceDelay, limits.presenceDelay);

      this.#connection.setNumber(zone.entity('presence_delay'), seconds);
    }

    if (movementThreshold != null) {
      const speed = ZoneRepository.#bounded(movementThreshold, limits.movementThreshold);

      this.#connection.setNumber(zone.entity('movement_threshold'), speed);
    }
  }

  /**
   * @param {unknown} value
   * @param {{ min: number, max: number }} range
   * @returns {number}
   */
  static #bounded(value, { min, max }) {
    return clamp(toFiniteNumber(value, min), min, max);
  }
}
