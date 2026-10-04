import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import {
  AlreadyAddedError,
  NotReachableError,
  UnsupportedDeviceError,
  ValidationError,
} from '../../lib/core/errors.js';
import { DeviceIdentity, DeviceProbe } from '../../lib/esphome/DeviceProbe.js';
import { Endpoint } from '../../lib/esphome/Endpoint.js';
import { S1ProPairing } from '../../lib/homey/S1ProPairing.js';
import { FakeTimers } from '../support/FakeTimers.js';

const S1_PRO_INFO = Object.freeze({
  macAddress: '48:F6:EE:2C:D9:F0',
  name: 's1-pro-multi-sense-2cd9f0',
  friendlyName: 'S1 Pro Multi Sense 2cd9f0',
  projectName: 'Sensy-One.S1 Pro Multi Sense',
  projectVersion: 'v1.2.21',
});

/**
 * One-shot client that answers with the given device info, or an error.
 */
class FakeProbeClient extends EventEmitter {
  disconnected = false;

  /**
   * @param {{ info?: object, error?: Error, silent?: boolean }} behaviour
   */
  constructor(behaviour) {
    super();
    this.behaviour = behaviour;
  }

  connect() {
    queueMicrotask(() => {
      if (this.behaviour.error) {
        this.emit('error', this.behaviour.error);
      } else if (!this.behaviour.silent) {
        this.emit('deviceInfo', this.behaviour.info);
      }
    });
  }

  disconnect() {
    this.disconnected = true;
  }
}

/**
 * @param {{ info?: object, error?: Error, silent?: boolean }} behaviour
 * @param {FakeTimers} [timers]
 * @returns {{ probe: DeviceProbe, clients: FakeProbeClient[], endpoints: Endpoint[] }}
 */
function probeAnswering(behaviour, timers = new FakeTimers()) {
  const clients = [];
  const endpoints = [];
  const probe = new DeviceProbe({
    timers,
    clientFactory: (endpoint) => {
      const client = new FakeProbeClient(behaviour);

      clients.push(client);
      endpoints.push(endpoint);

      return client;
    },
  });

  return { probe, clients, endpoints };
}

describe('Endpoint.parse', () => {
  it('accepts IP addresses, host names, ports and pasted URLs', () => {
    assert.deepEqual({ ...Endpoint.parse(' 192.168.2.39 ') }, { host: '192.168.2.39', port: 6053 });
    assert.deepEqual({ ...Endpoint.parse('192.168.2.39:6054') }, { host: '192.168.2.39', port: 6054 });
    assert.deepEqual({ ...Endpoint.parse('http://192.168.2.39/') }, { host: '192.168.2.39', port: 6053 });
    assert.deepEqual({ ...Endpoint.parse('S1-Pro-Multi-Sense-2cd9f0.local') }, {
      host: 's1-pro-multi-sense-2cd9f0.local',
      port: 6053,
    });
  });

  it('rejects anything else', () => {
    for (const input of ['', null, 'not an address', '192.168.2.39:0', '192.168.2.39:99999', 'a:1:2', '-bad.local']) {
      assert.throws(() => Endpoint.parse(input), ValidationError, String(input));
    }
  });
});

describe('DeviceIdentity', () => {
  it('uses the MAC address in the same form mDNS reports it', () => {
    const identity = new DeviceIdentity(S1_PRO_INFO);

    assert.equal(identity.id, '48f6ee2cd9f0');
    assert.equal(identity.name, 'S1 Pro Multi Sense 2cd9f0');
    assert.equal(new DeviceIdentity({ macAddress: 'AA:BB', name: 'node' }).name, 'node');
  });
});

describe('DeviceProbe', () => {
  it('reads the device info and closes the connection', async () => {
    const { probe, clients, endpoints } = probeAnswering({ info: S1_PRO_INFO });
    const identity = await probe.identify(new Endpoint('192.0.2.5'));

    assert.equal(identity.projectName, 'Sensy-One.S1 Pro Multi Sense');
    assert.equal(String(endpoints[0]), '192.0.2.5:6053');
    assert.equal(clients[0].disconnected, true);
  });

  it('reports a connection error as unreachable', async () => {
    const { probe, clients } = probeAnswering({ error: new Error('ECONNREFUSED') });

    await assert.rejects(probe.identify(new Endpoint('192.0.2.5')), NotReachableError);
    assert.equal(clients[0].disconnected, true);
  });

  it('gives up after the timeout', async () => {
    const timers = new FakeTimers();
    const { probe } = probeAnswering({ silent: true }, timers);
    const result = probe.identify(new Endpoint('192.0.2.5'));

    timers.tick(DeviceProbe.TIMEOUT_MS);

    await assert.rejects(result, NotReachableError);
  });

  it('survives a client that throws while closing', async () => {
    const { probe, clients } = probeAnswering({ info: S1_PRO_INFO });

    const result = probe.identify(new Endpoint('192.0.2.5'));

    clients[0].disconnect = () => {
      throw new Error('already closed');
    };

    await assert.doesNotReject(result);
  });
});

describe('S1ProPairing', () => {
  it('lists discovered sensors that are not added yet', () => {
    const pairing = new S1ProPairing(probeAnswering({ info: S1_PRO_INFO }).probe);
    const devices = pairing.discovered([
      { id: 'aaa', address: '192.0.2.1', txt: { friendly_name: 'Living room' } },
      { id: 'bbb', address: '192.0.2.2', port: 6054 },
      { id: 'ccc', address: '192.0.2.3' },
      { id: 'ddd', address: '' },
    ], new Set(['ccc']));

    assert.deepEqual(devices, [
      {
        name: 'Living room',
        data: { id: 'aaa' },
        store: { address: '192.0.2.1', port: 6053 },
        settings: { address: '192.0.2.1' },
      },
      {
        name: 'Sensy S1 Pro',
        data: { id: 'bbb' },
        store: { address: '192.0.2.2', port: 6054 },
        settings: { address: '192.0.2.2' },
      },
    ]);
  });

  it('adds a sensor by address with the same id mDNS would give it', async () => {
    const pairing = new S1ProPairing(probeAnswering({ info: S1_PRO_INFO }).probe);
    const device = await pairing.byAddress('192.168.2.39', new Set());

    assert.deepEqual(device, {
      name: 'S1 Pro Multi Sense 2cd9f0',
      data: { id: '48f6ee2cd9f0' },
      store: { address: '192.168.2.39', port: 6053 },
      settings: { address: '192.168.2.39' },
    });
  });

  it('refuses a sensor that is already added', async () => {
    const pairing = new S1ProPairing(probeAnswering({ info: S1_PRO_INFO }).probe);

    await assert.rejects(pairing.byAddress('192.168.2.39', new Set(['48f6ee2cd9f0'])), AlreadyAddedError);
  });

  it('refuses other ESPHome devices and invalid input', async () => {
    const otherDevice = { ...S1_PRO_INFO, projectName: 'Acme.Plug' };
    const pairing = new S1ProPairing(probeAnswering({ info: otherDevice }).probe);

    await assert.rejects(pairing.byAddress('192.168.2.50', new Set()), UnsupportedDeviceError);
    await assert.rejects(pairing.byAddress('not an address', new Set()), ValidationError);
  });

  it('names a sensor without a name after the product', async () => {
    const nameless = { macAddress: '01:02:03:04:05:06', projectName: 'Sensy-One.S1 Pro Multi Sense' };
    const pairing = new S1ProPairing(probeAnswering({ info: nameless }).probe);

    assert.equal((await pairing.byAddress('192.0.2.9', new Set())).name, 'Sensy S1 Pro');
  });
});
