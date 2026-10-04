import { EventEmitter } from 'node:events';
import { NotConnectedError } from '../../lib/core/errors.js';
import { Endpoint } from '../../lib/esphome/Endpoint.js';

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
