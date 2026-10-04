import { EventEmitter } from 'node:events';
import { clamp, toFiniteNumber } from '../utils.js';
import { Debouncer, delay } from '../timers.js';
import {
  PeopleCountChanged,
  PresenceChanged,
  ZoneMovementChanged,
  ZonePresenceChanged,
} from './events.js';
import { TargetTracker } from './TargetTracker.js';
import { ValueTracker } from './ValueTracker.js';
import { Zone } from './Zone.js';
import { S1ProProfile } from './S1ProProfile.js';
import { StateRouter } from './StateRouter.js';
import { ZoneRepository } from './ZoneRepository.js';

/** @typedef {import('../esphome/EsphomeConnection.js').EsphomeConnection} EsphomeConnection */
/** @typedef {import('../esphome/Endpoint.js').Endpoint} Endpoint */
/** @typedef {import('../timers.js').Timers} Timers */
/** @typedef {import('./Polygon.js').Polygon} Polygon */
/** @typedef {import('./events.js').SensorEvent} SensorEvent */
/** @typedef {import('./TargetTracker.js').TargetPosition} TargetPosition */
/** @typedef {import('./ZoneRepository.js').ZoneOptions} ZoneOptions */
/** @typedef {import('./bindings.js').CapabilityBinding} CapabilityBinding */
/** @typedef {import('./bindings.js').TargetFeed} TargetFeed */
/** @typedef {import('./bindings.js').SettingValue} SettingValue */

/**
 * @typedef {object} ZoneStatus
 * @property {boolean} presence
 * @property {boolean} movement
 * @property {number} people
 */

/**
 * @typedef {object} SensorEvents
 * @property {[]} connected
 * @property {[]} disconnected
 * @property {[firmware: string]} firmware
 * @property {[capability: string, value: number | boolean]} capability a bound capability received a value
 * @property {[zone: Zone, status: ZoneStatus]} zoneStatus
 * @property {[event: SensorEvent]} event something happened in the room
 * @property {[]} live targets or presence changed (high frequency)
 * @property {[]} zones zone outlines changed (debounced)
 * @property {[]} settings setting entities changed (debounced)
 * @property {[address: string]} address the sensor reported its IP address
 * @property {[enabled: boolean]} bluetoothProxy the Bluetooth proxy was switched on or off
 */

/** Zone state entity kinds, as named by the firmware. */
const ZONE_KINDS = Object.freeze({
  presence: 'presence',
  movement: 'movement',
  people: 'target_count',
});

/**
 * Entities whose changes are shown live on the radar.
 * @type {ReadonlySet<string>}
 */
const LIVE_ENTITIES = new Set([
  S1ProProfile.entities.presence,
  S1ProProfile.entities.movement,
  S1ProProfile.entities.people,
]);

/**
 * Domain model of one S1 Pro. Turns the raw entity stream of the connection
 * into meaningful state, queries and {@link SensorEvent}s, and offers the
 * commands the rest of the app needs. Knows nothing about Homey.
 *
 * @augments {EventEmitter<SensorEvents>}
 */
export class S1ProSensor extends EventEmitter {
  /** Quiet time before zone outlines are considered settled. */
  static ZONE_SETTLE_MS = 800;

  /** Quiet time before setting values are considered settled. */
  static SETTINGS_SETTLE_MS = 1000;

  /** @type {EsphomeConnection} */
  #connection;

  /** @type {Timers} */
  #timers;

  /** @type {ZoneRepository} */
  #zones;

  /** @type {ValueTracker} */
  #values = new ValueTracker();

  /** @type {TargetTracker} */
  #targets = new TargetTracker();

  /** @type {StateRouter} */
  #router;

  /** @type {Debouncer} */
  #zonesSettled;

  /** @type {Debouncer} */
  #settingsSettled;

  /**
   * @param {object} options
   * @param {EsphomeConnection} options.connection
   * @param {Timers} options.timers
   */
  constructor({ connection, timers }) {
    super();
    this.#connection = connection;
    this.#timers = timers;
    this.#zones = new ZoneRepository(connection);
    this.#router = this.#createRouter();

    this.#zonesSettled = new Debouncer(timers, S1ProSensor.ZONE_SETTLE_MS, () => {
      this.emit('zones');
    });

    this.#settingsSettled = new Debouncer(timers, S1ProSensor.SETTINGS_SETTLE_MS, () => {
      this.emit('settings');
    });

    this.#bindConnection();
  }

  // --- Lifecycle --------------------------------------------------------------

  start() {
    this.#connection.start();
  }

  stop() {
    this.#zonesSettled.cancel();
    this.#settingsSettled.cancel();
    this.#connection.stop();
  }

  /**
   * Reconnects to a new address (the sensor got a new IP).
   * @param {Endpoint} endpoint
   */
  moveTo(endpoint) {
    this.#connection.moveTo(endpoint);
  }

  /** @returns {boolean} */
  get connected() {
    return this.#connection.connected;
  }

  /** @returns {Endpoint} */
  get endpoint() {
    return this.#connection.endpoint;
  }

  // --- Queries ----------------------------------------------------------------

  /** @returns {boolean} someone is in the room */
  get present() {
    return this.#values.get(S1ProProfile.entities.presence, false);
  }

  /** @returns {boolean} someone in the room is moving */
  get moving() {
    return this.#values.get(S1ProProfile.entities.movement, false);
  }

  /** @returns {number} number of people in the room */
  get people() {
    return this.#values.get(S1ProProfile.entities.people, 0);
  }

  /**
   * The Bluetooth proxy of the official firmware shares the radio with WiFi
   * and makes the connection unstable; Homey does not use it.
   * @returns {boolean} whether the proxy is switched on
   */
  get bluetoothProxyEnabled() {
    return this.#values.get(S1ProProfile.entities.bluetoothProxy, false);
  }

  /** @returns {TargetPosition[]} */
  get targets() {
    return this.#targets.positions;
  }

  /** @returns {number} maximum detection distance in centimetres */
  get detectionRange() {
    const reported = this.#connection.get(S1ProProfile.entities.detectionRange);

    return toFiniteNumber(reported, S1ProProfile.limits.defaultDetectionRange);
  }

  /**
   * @param {Zone} zone a detection zone
   * @returns {ZoneStatus}
   */
  zoneStatus(zone) {
    return {
      presence: this.#values.get(zone.entity(ZONE_KINDS.presence), false),
      movement: this.#values.get(zone.entity(ZONE_KINDS.movement), false),
      people: this.#values.get(zone.entity(ZONE_KINDS.people), 0),
    };
  }

  /**
   * @param {Zone} zone
   * @returns {boolean} true when the zone has an outline and someone is in it
   */
  isZoneOccupied(zone) {
    if (!this.#zones.isConfigured(zone)) {
      return false;
    }

    return this.zoneStatus(zone).presence;
  }

  /**
   * @param {Zone} zone
   * @returns {boolean} true when the zone has an outline and someone moves in it
   */
  isZoneMoving(zone) {
    if (!this.#zones.isConfigured(zone)) {
      return false;
    }

    return this.zoneStatus(zone).movement;
  }

  /**
   * @param {Zone} zone
   * @returns {Polygon | null} null while the outline has not been fully received
   */
  zoneOutline(zone) {
    return this.#zones.read(zone);
  }

  /**
   * @param {Zone} zone a detection zone
   * @returns {ZoneOptions}
   */
  zoneOptions(zone) {
    return this.#zones.readOptions(zone);
  }

  /**
   * @returns {Map<string, SettingValue>} setting values as reported by the sensor
   */
  readSettings() {
    const values = new Map();

    for (const binding of S1ProProfile.settings) {
      const value = binding.read(this.#connection);

      if (value !== undefined) {
        values.set(binding.key, value);
      }
    }

    return values;
  }

  // --- Commands ---------------------------------------------------------------

  /**
   * @param {Zone} zone
   * @param {Polygon} polygon an empty polygon disables the zone
   */
  setZoneOutline(zone, polygon) {
    this.#zones.write(zone, polygon);
  }

  /**
   * @param {Zone} zone a detection zone
   * @param {Partial<ZoneOptions>} options
   */
  setZoneOptions(zone, options) {
    this.#zones.writeOptions(zone, options);
  }

  /**
   * Writes settings to the sensor. Unknown keys are ignored.
   * @param {Iterable<[key: string, value: SettingValue]>} entries
   * @returns {string[]} the keys that were written
   */
  applySettings(entries) {
    const bindingsByKey = new Map(
      S1ProProfile.settings.map((binding) => [binding.key, binding]),
    );
    const written = [];

    for (const [key, value] of entries) {
      const binding = bindingsByKey.get(key);

      if (!binding) {
        continue;
      }

      binding.write(this.#connection, value);
      written.push(key);
    }

    return written;
  }

  /**
   * Sounds the buzzer for a while.
   * @param {number} seconds clamped to 0.1–5 seconds
   */
  async beep(seconds) {
    const { min, max, fallback } = S1ProProfile.limits.beepSeconds;
    const { buzzer } = S1ProProfile.entities;

    const requested = toFiniteNumber(seconds, fallback) || fallback;
    const duration = clamp(requested, min, max);

    this.#connection.setSwitch(buzzer, true);

    try {
      await delay(this.#timers, Math.round(duration * 1000));
    } finally {
      this.#connection.setSwitch(buzzer, false);
    }
  }

  // --- Connection events ------------------------------------------------------

  #bindConnection() {
    const connection = this.#connection;

    connection.on('connected', () => {
      this.#onConnected();
    });

    connection.on('disconnected', () => {
      this.#onDisconnected();
    });

    connection.on('deviceInfo', (info) => {
      this.emit('firmware', S1ProSensor.#describeFirmware(info));
    });

    connection.on('state', (objectId, value) => {
      this.#router.dispatch(objectId, value);
    });
  }

  #onConnected() {
    // Values re-sent after a reconnect must not fire flows.
    this.#values.reset();
    this.#zonesSettled.schedule();
    this.#settingsSettled.schedule();
    this.emit('connected');
  }

  #onDisconnected() {
    this.#targets.reset();
    this.#zonesSettled.cancel();
    this.#settingsSettled.cancel();
    this.emit('disconnected');
  }

  // --- State routing ----------------------------------------------------------

  /** @returns {StateRouter} */
  #createRouter() {
    const { entities, patterns, capabilities, settings } = S1ProProfile;
    const router = new StateRouter();

    for (const binding of capabilities) {
      router.on(binding.entity, (raw) => {
        this.#onCapabilityState(binding, raw);
      });
    }

    for (const feed of S1ProProfile.targetFeeds) {
      router.on(feed.pattern, (value, [slot, axis]) => {
        this.#onTargetPosition(feed, Number(slot) - 1, axis, value);
      });
    }

    router.on(patterns.zoneState, (value, [zone, kind]) => {
      this.#onZoneState(Zone.from(zone), kind, value);
    });

    router.on(patterns.zoneGeometry, () => {
      this.#zonesSettled.schedule();
    });

    router.on(settings.map((binding) => binding.entity), () => {
      this.#settingsSettled.schedule();
    });

    router.on(entities.bluetoothProxy, (value) => {
      this.#onBluetoothProxy(Boolean(value));
    });

    router.on(entities.ipAddress, (value) => {
      if (value) {
        this.emit('address', String(value));
      }
    });

    return router;
  }

  /**
   * @param {boolean} enabled
   */
  #onBluetoothProxy(enabled) {
    const change = this.#values.update(S1ProProfile.entities.bluetoothProxy, enabled);

    if (change.initial || change.changed) {
      this.emit('bluetoothProxy', enabled);
    }
  }

  /**
   * @param {CapabilityBinding} binding
   * @param {unknown} raw
   */
  #onCapabilityState(binding, raw) {
    const value = binding.convert(raw);
    const change = this.#values.update(binding.entity, value);

    this.emit('capability', binding.capability, value);

    if (LIVE_ENTITIES.has(binding.entity)) {
      this.emit('live');
    }

    if (!change.changed) {
      return;
    }

    const { entities } = S1ProProfile;

    if (binding.entity === entities.presence) {
      this.emit('event', new PresenceChanged(Boolean(value), this.people));
    }

    if (binding.entity === entities.people) {
      const previous = Number(change.previous ?? 0);

      this.emit('event', new PeopleCountChanged(Number(value), previous));
    }
  }

  /**
   * @param {TargetFeed} feed the entity family that reported the position
   * @param {number} slot 0-based target slot
   * @param {string} axis `x` or `y`
   * @param {unknown} value centimetres
   */
  #onTargetPosition(feed, slot, axis, value) {
    const changed = this.#targets.update(slot, /** @type {'x' | 'y'} */ (axis), Number(value), feed);

    // The official firmware repeats positions on every radar frame; only real moves count.
    if (changed) {
      this.emit('live');
    }
  }

  /**
   * @param {Zone} zone
   * @param {string} kind one of {@link ZONE_KINDS}
   * @param {unknown} raw
   */
  #onZoneState(zone, kind, raw) {
    const value = S1ProSensor.#parseZoneValue(kind, raw);
    const change = this.#values.update(zone.entity(kind), value);

    this.emit('zoneStatus', zone, this.zoneStatus(zone));
    this.emit('live');

    // Zones without an outline report stale values; never fire flows for them.
    if (!change.changed || !this.#zones.isConfigured(zone)) {
      return;
    }

    if (kind === ZONE_KINDS.presence) {
      this.#emitZonePresence(zone, Boolean(value));
    }

    if (kind === ZONE_KINDS.movement) {
      this.emit('event', new ZoneMovementChanged(zone, Boolean(value)));
    }
  }

  /**
   * @param {Zone} zone
   * @param {boolean} present
   */
  #emitZonePresence(zone, present) {
    // The people count can lag behind presence; someone entering is at least one person.
    let people = 0;

    if (present) {
      people = Math.max(1, this.zoneStatus(zone).people);
    }

    this.emit('event', new ZonePresenceChanged(zone, present, people));
  }

  /**
   * @param {string} kind
   * @param {unknown} raw
   * @returns {number | boolean}
   */
  static #parseZoneValue(kind, raw) {
    if (kind === ZONE_KINDS.people) {
      return Math.round(toFiniteNumber(raw, 0));
    }

    return Boolean(raw);
  }

  /**
   * @param {Record<string, unknown>} info
   * @returns {string}
   */
  static #describeFirmware(info) {
    const project = info.projectVersion || '?';
    const esphome = info.esphomeVersion || '?';

    return `${project} · ESPHome ${esphome}`;
  }
}
