import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { NotConnectedError, ValidationError } from '../lib/errors.js';
import { Endpoint } from '../lib/esphome/Endpoint.js';
import { EsphomeConnection } from '../lib/esphome/EsphomeConnection.js';
import { FakeEntity, FakeEsphomeClient } from './fakes.js';

describe('Endpoint', () => {
  it('defaults to the native API port', () => {
    const endpoint = new Endpoint('192.0.2.1');

    assert.equal(endpoint.port, 6053);
    assert.equal(String(endpoint), '192.0.2.1:6053');
  });

  it('compares by value', () => {
    assert.equal(new Endpoint('a', 1).equals(new Endpoint('a', 1)), true);
    assert.equal(new Endpoint('a', 1).equals(new Endpoint('a', 2)), false);
    assert.equal(new Endpoint('a').equals(null), false);
  });

  it('requires a host', () => {
    assert.throws(() => new Endpoint(''), ValidationError);
  });
});

describe('EsphomeConnection', () => {
  /** @type {FakeEsphomeClient[]} */
  let clients;

  /** @type {EsphomeConnection} */
  let connection;

  /** @type {string[]} */
  let errors;

  beforeEach(() => {
    clients = [];
    errors = [];
    connection = new EsphomeConnection({
      endpoint: new Endpoint('192.0.2.1'),
      logger: {
        log() {},
        error: (...args) => {
          errors.push(args.join(' '));
        },
      },
      clientFactory: () => {
        const client = new FakeEsphomeClient();

        clients.push(client);

        return client;
      },
    });
  });

  it('connects once and reports when the handshake completes', () => {
    const events = [];

    connection.on('connected', () => {
      events.push('connected');
    });

    connection.start();
    connection.start();
    clients[0].handshake();

    assert.equal(clients.length, 1);
    assert.equal(clients[0].connectCalls, 1);
    assert.equal(connection.connected, true);
    assert.deepEqual(events, ['connected']);
  });

  it('caches and forwards entity states, skipping missing ones', () => {
    const presence = new FakeEntity('any_presence', 'BinarySensor');
    const states = [];

    connection.on('state', (id, value) => {
      states.push([id, value]);
    });

    connection.start();
    clients[0].handshake([presence]);
    presence.report(true);
    presence.emit('state', { state: false, missingState: true });

    assert.deepEqual(states, [['any_presence', true]]);
    assert.equal(connection.get('any_presence'), true);
  });

  it('sends commands to entities of the right type', () => {
    const number = new FakeEntity('detection_range', 'Number');
    const toggle = new FakeEntity('mlt8530___buzzer', 'Switch');
    const button = new FakeEntity('restart', 'Button');

    connection.start();
    clients[0].handshake([number, toggle, button]);

    connection.setNumber('detection_range', '450');
    connection.setSwitch('mlt8530___buzzer', 1);
    connection.pressButton('restart');

    assert.deepEqual(number.commands, [450]);
    assert.deepEqual(toggle.commands, [true]);
    assert.deepEqual(button.commands, ['push']);
    assert.throws(() => connection.setSwitch('detection_range', true), ValidationError);
  });

  it('refuses commands while offline', () => {
    const number = new FakeEntity('detection_range', 'Number');

    assert.throws(() => connection.setNumber('detection_range', 1), NotConnectedError);

    connection.start();
    clients[0].handshake([number]);
    clients[0].drop();

    assert.equal(connection.connected, false);
    assert.throws(() => connection.setNumber('detection_range', 1), NotConnectedError);
  });

  it('forwards device info and logs client errors', () => {
    const infos = [];

    connection.on('deviceInfo', (info) => {
      infos.push(info);
    });

    connection.start();
    clients[0].emit('deviceInfo', { projectVersion: '1.0' });
    clients[0].emit('error', new Error('socket closed'));

    assert.deepEqual(infos, [{ projectVersion: '1.0' }]);
    assert.match(errors[0], /socket closed/);
  });

  it('reconnects only when the endpoint changes', () => {
    connection.start();
    connection.moveTo(new Endpoint('192.0.2.1'));

    assert.equal(clients.length, 1);

    connection.moveTo(new Endpoint('192.0.2.2'));

    assert.equal(clients.length, 2);
    assert.equal(clients[0].disconnectCalls, 1);
    assert.equal(connection.endpoint.host, '192.0.2.2');
  });

  it('stops cleanly, even when the client throws while closing', () => {
    connection.stop();
    connection.start();
    clients[0].disconnect = () => {
      throw new Error('already closed');
    };

    assert.doesNotThrow(() => connection.stop());
    assert.doesNotThrow(() => clients[0].emit('error', new Error('late')));
  });
});
