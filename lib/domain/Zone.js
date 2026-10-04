import { ValidationError } from '../core/errors.js';

/**
 * A detection area of the S1 Pro. Zones 1–3 report presence and movement;
 * the exclusion zone masks out an area (a fan, a curtain) and reports nothing.
 *
 * Instances are flyweights: `Zone.from('2') === Zone.from(2)`.
 */
export class Zone {
  /** @type {Map<string, Zone>} */
  static #registry = new Map();

  /** @type {string} */
  key;

  /** @type {number | null} */
  number;

  /**
   * @param {string} key
   * @param {number | null} number
   */
  constructor(key, number) {
    this.key = key;
    this.number = number;
    Object.freeze(this);
    Zone.#registry.set(key, this);
  }

  static ONE = new Zone('1', 1);

  static TWO = new Zone('2', 2);

  static THREE = new Zone('3', 3);

  static EXCLUSION = new Zone('exclusion', null);

  /** Zones that detect presence, in display order. */
  static DETECTION = Object.freeze([Zone.ONE, Zone.TWO, Zone.THREE]);

  /** Every zone, including the exclusion zone. */
  static ALL = Object.freeze([...Zone.DETECTION, Zone.EXCLUSION]);

  /**
   * @param {unknown} value a zone key such as `1`, `"2"` or `"exclusion"`
   * @returns {Zone}
   * @throws {ValidationError} for unknown zones
   */
  static from(value) {
    const zone = Zone.#registry.get(String(value));

    if (!zone) {
      throw new ValidationError(`Unknown zone: ${value}`);
    }

    return zone;
  }

  /**
   * Like {@link Zone.from}, but only accepts zones that detect presence.
   * @param {unknown} value
   * @returns {Zone}
   */
  static detection(value) {
    const zone = Zone.from(value);

    if (zone.isExclusion) {
      throw new ValidationError('The exclusion zone has no presence settings');
    }

    return zone;
  }

  get isExclusion() {
    return this.number === null;
  }

  /** Prefix of this zone's ESPHome object ids, e.g. `zone_1` or `exclusion_zone`. */
  get entityPrefix() {
    return this.isExclusion ? 'exclusion_zone' : `zone_${this.number}`;
  }

  /**
   * @param {string} suffix
   * @returns {string} the ESPHome object id, e.g. `zone_1_presence`
   */
  entity(suffix) {
    return `${this.entityPrefix}_${suffix}`;
  }

  toString() {
    return this.key;
  }

  toJSON() {
    return this.key;
  }
}
