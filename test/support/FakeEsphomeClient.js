import { EventEmitter } from 'node:events';

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
