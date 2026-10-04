import { roundTo } from '../utils.js';

/** @typedef {import('../esphome/EsphomeConnection.js').EsphomeConnection} EsphomeConnection */
/** @typedef {string | number | boolean} SettingValue */

/** Maps an ESPHome entity onto a Homey capability. */
export class CapabilityBinding {
  /**
   * @param {string} entity ESPHome object id
   * @param {string} capability Homey capability id
   * @param {(raw: unknown) => number | boolean} convert
   */
  constructor(entity, capability, convert) {
    this.entity = entity;
    this.capability = capability;
    this.convert = convert;
    Object.freeze(this);
  }
}

/**
 * A family of entities that reports live target positions, one per axis and
 * target slot. Firmware variants name these entities differently and mark an
 * empty slot differently, so each variant gets its own feed.
 */
export class TargetFeed {
  /**
   * @param {object} options
   * @param {string} options.name for logs and tests
   * @param {RegExp} options.pattern object id pattern; group 1 = slot (1–3), group 2 = axis (`x`/`y`)
   * @param {(x: number, y: number) => boolean} options.isEmpty whether a position means "no target"
   * @param {'x' | 'y' | null} [options.completeOn] for feeds that always send both axes in a fixed
   *   order: the axis that completes a position. Until it arrives, a half-updated position is not shown.
   */
  constructor({ name, pattern, isEmpty, completeOn = null }) {
    this.name = name;
    this.pattern = pattern;
    this.isEmpty = isEmpty;
    this.completeOn = completeOn;
    Object.freeze(this);
  }

  /**
   * @param {'x' | 'y'} axis
   * @returns {boolean} whether an update of this axis completes a position
   */
  completes(axis) {
    if (this.completeOn === null) {
      return true;
    }

    return axis === this.completeOn;
  }
}

/**
 * Two-way binding between a Homey device setting and an ESPHome entity.
 * Subclasses implement how the value is read from and written to the sensor.
 * @abstract
 */
export class SettingBinding {
  /**
   * @param {string} key Homey setting id (Homey reserves the `zone_` prefix, hence `zone1_…`)
   * @param {string} entity ESPHome object id
   */
  constructor(key, entity) {
    if (new.target === SettingBinding) {
      throw new TypeError('SettingBinding is abstract');
    }

    this.key = key;
    this.entity = entity;
    Object.freeze(this);
  }

  /**
   * @abstract
   * @param {unknown} _raw value reported by the sensor
   * @returns {SettingValue}
   */
  fromSensor(_raw) {
    throw new TypeError('Not implemented');
  }

  /**
   * @abstract
   * @param {EsphomeConnection} _connection
   * @param {SettingValue} _value
   */
  write(_connection, _value) {
    throw new TypeError('Not implemented');
  }

  /**
   * @param {EsphomeConnection} connection
   * @returns {SettingValue | undefined} undefined while the sensor has not reported the entity
   */
  read(connection) {
    const raw = connection.get(this.entity);

    return raw === undefined ? undefined : this.fromSensor(raw);
  }
}

/** A `number:` entity, mirrored with one decimal. */
export class NumberSettingBinding extends SettingBinding {
  static #round = roundTo(1);

  /** @param {unknown} raw */
  fromSensor(raw) {
    return NumberSettingBinding.#round(raw);
  }

  /**
   * @param {EsphomeConnection} connection
   * @param {SettingValue} value
   */
  write(connection, value) {
    connection.setNumber(this.entity, Number(value));
  }
}

/** A `switch:` entity, mirrored as a checkbox. */
export class SwitchSettingBinding extends SettingBinding {
  /** @param {unknown} raw */
  fromSensor(raw) {
    return Boolean(raw);
  }

  /**
   * @param {EsphomeConnection} connection
   * @param {SettingValue} value
   */
  write(connection, value) {
    connection.setSwitch(this.entity, Boolean(value));
  }
}
