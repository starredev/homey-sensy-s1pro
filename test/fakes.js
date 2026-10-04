/** Test doubles: a clock, an ESPHome client, a connection and a Homey device. */

import { EventEmitter } from 'node:events';
import { NotConnectedError } from '../lib/errors.js';
import { Endpoint } from '../lib/esphome/Endpoint.js';

/**
 * Deterministic clock implementing the Timers port.
 */
export class FakeTimers {
  #now = 0;

  #nextHandle = 1;

  /** @type {Map<number, { at: number, callback: () => void }>} */
  #pending = new Map();

  /**
   * @param {() => void} callback
   * @param {number} ms
   * @returns {number}
   */
  setTimeout(callback, ms) {
    const handle = this.#nextHandle;

    this.#nextHandle += 1;
    this.#pending.set(handle, { at: this.#now + ms, callback });

    return handle;
  }

  /**
   * @param {unknown} handle
   */
  clearTimeout(handle) {
    this.#pending.delete(Number(handle));
  }

  /** @returns {number} */
  get pendingCount() {
    return this.#pending.size;
  }

  /**
   * Moves the clock forward and runs every timer that became due, in order.
   * @param {number} ms
   */
  tick(ms) {
    const target = this.#now + ms;

    for (;;) {
      const due = this.#nextDue(target);

      if (!due) {
        break;
      }

      this.#pending.delete(due.handle);
      this.#now = due.at;
      due.callback();
    }

    this.#now = target;
  }

  /**
   * @param {number} target
   * @returns {{ handle: number, at: number, callback: () => void } | null}
   */
  #nextDue(target) {
    let next = null;

    for (const [handle, timer] of this.#pending) {
      if (timer.at > target) {
        continue;
      }

      if (next === null || timer.at < next.at) {
        next = { handle, ...timer };
      }
    }

    return next;
  }
}

/**
 * In-memory replacement for EsphomeConnection: tests push states in and
 * inspect the commands the domain sends out.
 */
export class FakeConnection extends EventEmitter {
  connected = false;

  started = false;

  endpoint = new Endpoint('192.0.2.10');

  /** @type {Map<string, unknown>} */
  values = new Map();

  /** @type {{ kind: string, objectId: string, value?: unknown }[]} */
  commands = [];

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
  }

  /**
   * @param {Endpoint} endpoint
   */
  moveTo(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * @param {string} objectId
   * @returns {unknown}
   */
  get(objectId) {
    return this.values.get(objectId);
  }

  /**
   * @param {string} objectId
   * @param {number} value
   */
  setNumber(objectId, value) {
    this.#command('number', objectId, value);
  }

  /**
   * @param {string} objectId
   * @param {boolean} value
   */
  setSwitch(objectId, value) {
    this.#command('switch', objectId, value);
  }

  /**
   * @param {string} objectId
   */
  pressButton(objectId) {
    this.#command('button', objectId);
  }

  // --- Test helpers -------------------------------------------------------------

  connect() {
    this.connected = true;
    this.emit('connected');
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * Reports a state as the sensor would.
   * @param {string} objectId
   * @param {unknown} value
   */
  report(objectId, value) {
    this.values.set(objectId, value);
    this.emit('state', objectId, value);
  }

  /**
   * Stores values without emitting, to set up a known sensor state.
   * @param {Record<string, unknown>} values
   */
  preload(values) {
    for (const [objectId, value] of Object.entries(values)) {
      this.values.set(objectId, value);
    }
  }

  /**
   * @param {string} kind
   * @param {string} objectId
   * @param {unknown} [value]
   */
  #command(kind, objectId, value) {
    if (!this.connected) {
      throw new NotConnectedError(objectId);
    }

    this.commands.push({ kind, objectId, value });
  }
}

/**
 * Entity values that give zone 1 a triangular outline.
 * @type {Record<string, number>}
 */
export const ZONE_ONE_TRIANGLE = Object.freeze({
  zone_1_points_count: 3,
  zone_1_p1_x: -100,
  zone_1_p1_y: 100,
  zone_1_p2_x: 100,
  zone_1_p2_y: 100,
  zone_1_p3_x: 0,
  zone_1_p3_y: 300,
});

/**
 * Stand-in for an entity of the ESPHome library.
 */
export class FakeEntity extends EventEmitter {
  /** @type {unknown[]} */
  commands = [];

  /**
   * @param {string} objectId
   * @param {string} type
   */
  constructor(objectId, type) {
    super();
    this.type = type;
    this.config = { objectId };
  }

  /**
   * @param {unknown} value
   */
  setState(value) {
    this.commands.push(value);
  }

  push() {
    this.commands.push('push');
  }

  /**
   * @param {unknown} state
   */
  report(state) {
    this.emit('state', { state });
  }
}

/**
 * Stand-in for the library's `Client`, driven by the test.
 */
export class FakeEsphomeClient extends EventEmitter {
  initialized = false;

  connectCalls = 0;

  disconnectCalls = 0;

  connection = new EventEmitter();

  connect() {
    this.connectCalls += 1;
  }

  disconnect() {
    this.disconnectCalls += 1;
  }

  /**
   * Completes the handshake and announces the given entities.
   * @param {FakeEntity[]} entities
   */
  handshake(entities = []) {
    this.emit('connected');

    for (const entity of entities) {
      this.emit('newEntity', entity);
    }

    this.initialized = true;
    this.emit('initialized');
  }

  drop() {
    this.initialized = false;
    this.emit('disconnected');
  }
}

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
