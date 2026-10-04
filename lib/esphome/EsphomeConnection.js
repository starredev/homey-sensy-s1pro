import { EventEmitter } from 'node:events';
import esphome from '@2colors/esphome-native-api';
import { NotConnectedError, ValidationError } from '../errors.js';
import { silentLogger } from '../utils.js';
import { skipUnknownMessages } from './compat.js';

/** @typedef {import('./Endpoint.js').Endpoint} Endpoint */
/** @typedef {import('../utils.js').Logger} Logger */

/**
 * @typedef {object} EsphomeEntity
 * Structural view of an entity of `@2colors/esphome-native-api`.
 * @property {string} type e.g. `Sensor`, `Number`, `Switch`, `Button`
 * @property {{ objectId: string }} config
 * @property {(event: 'state', listener: (state: EntityState) => void) => void} on
 * @property {(value: unknown) => void} [setState]
 * @property {() => void} [push]
 */

/**
 * @typedef {object} EntityState
 * @property {unknown} state
 * @property {boolean} [missingState]
 */

/**
 * @typedef {object} EsphomeClient
 * Structural view of the library's `Client`, so tests can inject a fake.
 * @property {boolean} initialized
 * @property {EventEmitter} connection
 * @property {(event: string, listener: (...args: any[]) => void) => unknown} on
 * @property {() => void} connect
 * @property {() => void} disconnect
 * @property {() => void} removeAllListeners
 */

/** @typedef {(endpoint: Endpoint) => EsphomeClient} ClientFactory */

/**
 * @typedef {object} ConnectionEvents
 * @property {[]} connected the device finished the handshake and listed its entities
 * @property {[]} disconnected
 * @property {[info: Record<string, unknown>]} deviceInfo
 * @property {[objectId: string, value: unknown]} state
 */

/** Entity types that accept commands, as named by the library. */
const EntityType = Object.freeze({
  NUMBER: 'Number',
  SWITCH: 'Switch',
  BUTTON: 'Button',
});

/**
 * Creates a client of the ESPHome native API library.
 * @type {ClientFactory}
 */
function createLibraryClient({ host, port }) {
  skipUnknownMessages();

  const client = new esphome.Client({
    host,
    port,
    clientInfo: 'Homey Sensy S1 Pro',
    reconnect: true,
    reconnectInterval: 10_000,
    pingInterval: 15_000,
    pingAttempts: 3,
  });

  // The library ships loose typings; it is used through the structural EsphomeClient view.
  return /** @type {EsphomeClient} */ (/** @type {unknown} */ (client));
}

/**
 * Connection to an ESPHome device over the native API (plain-text, port 6053).
 *
 * Entities are addressed by their ESPHome object id (e.g. `zone_1_presence`).
 * The last reported value of every entity is cached, so the domain layer can
 * read state synchronously.
 *
 * @augments {EventEmitter<ConnectionEvents>}
 */
export class EsphomeConnection extends EventEmitter {
  /** @type {Endpoint} */
  #endpoint;

  /** @type {ClientFactory} */
  #createClient;

  /** @type {Logger} */
  #logger;

  /** @type {EsphomeClient | null} */
  #client = null;

  /** @type {Map<string, EsphomeEntity>} */
  #entities = new Map();

  /** @type {Map<string, unknown>} */
  #values = new Map();

  /**
   * @param {object} options
   * @param {Endpoint} options.endpoint
   * @param {Logger} [options.logger]
   * @param {ClientFactory} [options.clientFactory] injectable for tests
   */
  constructor({ endpoint, logger = silentLogger, clientFactory = createLibraryClient }) {
    super();
    this.#endpoint = endpoint;
    this.#logger = logger;
    this.#createClient = clientFactory;
  }

  /** @returns {Endpoint} */
  get endpoint() {
    return this.#endpoint;
  }

  /** @returns {boolean} true once the handshake completed and entities are known */
  get connected() {
    return this.#client?.initialized === true;
  }

  start() {
    if (this.#client) {
      return;
    }

    const client = this.#createClient(this.#endpoint);

    // Every entity attaches its own listener to the shared socket.
    client.connection.setMaxListeners(0);

    this.#bindClient(client);
    this.#client = client;
    client.connect();
  }

  stop() {
    const client = this.#client;

    this.#client = null;
    this.#entities.clear();

    if (!client) {
      return;
    }

    client.removeAllListeners();

    // The socket may still emit an error while closing; it must never crash the app.
    client.on('error', () => {});

    try {
      client.disconnect();
    } catch {
      // Already closed.
    }
  }

  /**
   * Points the connection at a new address, reconnecting only when it changed.
   * @param {Endpoint} endpoint
   */
  moveTo(endpoint) {
    if (endpoint.equals(this.#endpoint) && this.#client) {
      return;
    }

    this.#endpoint = endpoint;
    this.stop();
    this.start();
  }

  /**
   * @param {string} objectId
   * @returns {unknown} the last reported value, or `undefined` when none was received
   */
  get(objectId) {
    return this.#values.get(objectId);
  }

  /**
   * @param {string} objectId
   * @param {number} value
   */
  setNumber(objectId, value) {
    const entity = this.#commandable(objectId, EntityType.NUMBER);

    entity.setState?.(Number(value));
  }

  /**
   * @param {string} objectId
   * @param {boolean} on
   */
  setSwitch(objectId, on) {
    const entity = this.#commandable(objectId, EntityType.SWITCH);

    entity.setState?.(Boolean(on));
  }

  /**
   * @param {string} objectId
   */
  pressButton(objectId) {
    const entity = this.#commandable(objectId, EntityType.BUTTON);

    entity.push?.();
  }

  /**
   * @param {EsphomeClient} client
   */
  #bindClient(client) {
    client.on('connected', () => {
      this.#logger.log(`Connected to ${this.#endpoint}`);
    });

    client.on('initialized', () => {
      this.emit('connected');
    });

    client.on('disconnected', () => {
      this.#entities.clear();
      this.emit('disconnected');
    });

    client.on('deviceInfo', (info) => {
      this.emit('deviceInfo', info);
    });

    client.on('newEntity', (entity) => {
      this.#register(entity);
    });

    client.on('error', (error) => {
      this.#logger.error(`ESPHome ${this.#endpoint}:`, error?.message ?? error);
    });
  }

  /**
   * @param {EsphomeEntity} entity
   */
  #register(entity) {
    const { objectId } = entity.config;

    this.#entities.set(objectId, entity);

    entity.on('state', ({ state, missingState }) => {
      if (missingState) {
        return;
      }

      this.#values.set(objectId, state);
      this.emit('state', objectId, state);
    });
  }

  /**
   * @param {string} objectId
   * @param {string} type
   * @returns {EsphomeEntity}
   * @throws {NotConnectedError} when the sensor is offline or the entity is unknown
   * @throws {ValidationError} when the entity has a different type
   */
  #commandable(objectId, type) {
    const entity = this.#entities.get(objectId);

    if (!entity || !this.connected) {
      throw new NotConnectedError(objectId);
    }

    if (entity.type !== type) {
      throw new ValidationError(`${objectId} is a ${entity.type}, not a ${type}`);
    }

    return entity;
  }
}
