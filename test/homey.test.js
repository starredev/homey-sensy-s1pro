import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { NotConnectedError, NotFoundError, ValidationError } from '../lib/errors.js';
import {
  PeopleCountChanged,
  PresenceChanged,
  SensorEvent,
  ZoneMovementChanged,
  ZonePresenceChanged,
} from '../lib/sensor/events.js';
import { Zone } from '../lib/sensor/Zone.js';
import { CapabilityStore } from '../lib/homey/CapabilityStore.js';
import { Cards, FlowCards } from '../lib/homey/FlowCards.js';
import { Channels, RealtimeHub } from '../lib/homey/RealtimeHub.js';
import { SensyApi } from '../lib/homey/SensyApi.js';
import { SettingsMirror } from '../lib/homey/SettingsMirror.js';
import { ZoneCapabilities } from '../lib/homey/ZoneCapabilities.js';
import { SensorPresenter } from '../lib/homey/SensorPresenter.js';
import { S1ProSensor } from '../lib/sensor/S1ProSensor.js';
import { FakeConnection, ZONE_ONE_TRIANGLE } from './fakes.js';
import { FakeHomeyDevice } from './fakes.js';
import { FakeTimers } from './fakes.js';

const silent = {
  log() {},
  error() {},
};

/**
 * @returns {{ connection: FakeConnection, timers: FakeTimers, sensor: S1ProSensor }}
 */
function connectedSensor() {
  const connection = new FakeConnection();
  const timers = new FakeTimers();
  const sensor = new S1ProSensor({ connection, timers });

  connection.connect();

  return { connection, timers, sensor };
}

/**
 * @param {S1ProSensor} sensor
 * @param {string} [id]
 * @returns {import('../lib/homey/SensorPresenter.js').SensorView}
 */
function viewOf(sensor, id = 'aa:bb') {
  return {
    id,
    name: 'Living room',
    sensor,
    capabilityValue: (capability) => {
      return capability === 'measure_temperature' ? 21.5 : null;
    },
  };
}

describe('CapabilityStore', () => {
  it('skips writes that would not change anything', async () => {
    const device = new FakeHomeyDevice(['alarm_motion']);
    const store = new CapabilityStore(device, silent);

    await store.set('alarm_motion', true);
    await store.set('alarm_motion', true);
    await store.set('missing', 1);

    assert.deepEqual(device.log, ['set alarm_motion=true']);
    assert.equal(store.has('alarm_motion'), true);
    assert.equal(store.get('alarm_motion'), true);
    assert.equal(store.get('missing'), null);
  });

  it('logs failed writes instead of throwing', async () => {
    const errors = [];
    const device = new FakeHomeyDevice(['alarm_motion']);

    device.setCapabilityValue = async () => {
      throw new Error('boom');
    };

    const store = new CapabilityStore(device, {
      log() {},
      error: (...args) => {
        errors.push(args);
      },
    });

    await store.set('alarm_motion', true);

    assert.equal(errors.length, 1);
  });

  it('adds and removes capabilities idempotently', async () => {
    const device = new FakeHomeyDevice();
    const store = new CapabilityStore(device, silent);

    await store.add('x', { title: 'X' });
    await store.add('x', { title: 'X' });
    await store.remove('x');
    await store.remove('x');

    assert.deepEqual(device.log, ['add x', 'remove x']);
  });
});

describe('ZoneCapabilities', () => {
  it('adds capabilities for drawn zones and removes them for empty ones', async () => {
    const device = new FakeHomeyDevice(['sensy_zone_presence.zone2']);
    const zones = new ZoneCapabilities(new CapabilityStore(device, silent));
    const { connection, sensor } = connectedSensor();

    connection.preload({ ...ZONE_ONE_TRIANGLE, zone_2_points_count: 0 });
    connection.report('zone_1_presence', true);

    await zones.reconcile(
      (zone) => sensor.zoneOutline(zone),
      (zone) => sensor.zoneStatus(zone),
    );

    assert.equal(device.hasCapability('sensy_zone_presence.zone1'), true);
    assert.equal(device.getCapabilityValue('sensy_zone_presence.zone1'), true);
    assert.equal(device.hasCapability('sensy_zone_presence.zone2'), false);
    assert.equal(device.hasCapability('sensy_zone_presence.zone3'), false);
    assert.deepEqual(device.capabilityOptions.get('sensy_zone_people.zone1'), {
      title: { en: 'People in zone 1', nl: 'Personen in zone 1' },
    });
  });
});

describe('SettingsMirror', () => {
  /** @type {FakeHomeyDevice} */
  let device;

  /** @type {FakeConnection} */
  let connection;

  /** @type {SettingsMirror} */
  let mirror;

  beforeEach(() => {
    const setup = connectedSensor();

    connection = setup.connection;
    device = new FakeHomeyDevice();
    device.settings = { detection_range: 600, single_target: false };
    mirror = new SettingsMirror(device, setup.sensor);
  });

  it('pulls only values that differ', async () => {
    connection.preload({ detection_range: 600, radar___single_target: true });

    await mirror.pull();

    assert.deepEqual(device.log, ['settings {"single_target":true}']);

    await mirror.pull();

    assert.equal(device.log.length, 1);
  });

  it('pushes changed sensor settings and ignores the rest', () => {
    mirror.push({ detection_range: 300, address: 'x' }, ['detection_range', 'address']);
    mirror.push({ address: 'x' }, ['address']);

    assert.deepEqual(connection.commands, [{ kind: 'number', objectId: 'detection_range', value: 300 }]);
  });

  it('refuses to push while the sensor is offline', () => {
    connection.disconnect();

    assert.throws(() => mirror.push({ detection_range: 1 }, ['detection_range']), NotConnectedError);
  });
});

describe('FlowCards', () => {
  /**
   * @returns {{ flow: object, fired: unknown[][], listeners: Map<string, (...args: any[]) => Promise<unknown>> }}
   */
  function fakeFlow() {
    const fired = [];
    const listeners = new Map();
    const card = (id) => {
      return {
        trigger: async (device, tokens, state) => {
          fired.push([id, tokens, state]);
        },
        registerRunListener: (listener) => {
          listeners.set(id, listener);
        },
      };
    };

    return {
      fired,
      listeners,
      flow: {
        getDeviceTriggerCard: card,
        getConditionCard: card,
        getActionCard: card,
      },
    };
  }

  it('translates domain events into trigger invocations', () => {
    assert.deepEqual(FlowCards.translate(new PresenceChanged(true, 2)), {
      card: Cards.ROOM_OCCUPIED,
      tokens: { people: 2 },
    });
    assert.deepEqual(FlowCards.translate(new PresenceChanged(false, 0)), { card: Cards.ROOM_EMPTY });
    assert.deepEqual(FlowCards.translate(new PeopleCountChanged(3, 1)), {
      card: Cards.PEOPLE_CHANGED,
      tokens: { people: 3, previous: 1 },
    });
    assert.deepEqual(FlowCards.translate(new ZonePresenceChanged(Zone.TWO, true, 1)), {
      card: Cards.ZONE_ENTERED,
      tokens: { people: 1 },
      state: { zone: '2' },
    });
    assert.deepEqual(FlowCards.translate(new ZonePresenceChanged(Zone.TWO, false, 0)), {
      card: Cards.ZONE_LEFT,
      state: { zone: '2' },
    });
    assert.equal(FlowCards.translate(new ZoneMovementChanged(Zone.ONE, true)).card, Cards.ZONE_MOVEMENT_STARTED);
    assert.equal(FlowCards.translate(new ZoneMovementChanged(Zone.ONE, false)).card, Cards.ZONE_MOVEMENT_STOPPED);
    assert.equal(FlowCards.translate(new SensorEvent()), null);
  });

  it('fires triggers and filters zone triggers by the chosen zone', async () => {
    const { flow, fired, listeners } = fakeFlow();
    const cards = new FlowCards(flow, silent).register();

    await cards.dispatch({}, new ZoneMovementChanged(Zone.THREE, true));
    await cards.dispatch({}, new SensorEvent());

    const zoneFilter = listeners.get(Cards.ZONE_MOVEMENT_STARTED);

    assert.deepEqual(fired, [[Cards.ZONE_MOVEMENT_STARTED, {}, { zone: '3' }]]);
    assert.equal(await zoneFilter({ zone: '3' }, { zone: '3' }), true);
    assert.equal(await zoneFilter({ zone: '1' }, { zone: '3' }), false);
  });

  it('logs a failing trigger instead of throwing', async () => {
    const errors = [];
    const { flow } = fakeFlow();

    flow.getDeviceTriggerCard = () => {
      return {
        trigger: async () => {
          throw new Error('nope');
        },
        registerRunListener() {},
      };
    };

    const cards = new FlowCards(flow, {
      log() {},
      error: (...args) => {
        errors.push(args);
      },
    }).register();

    await cards.dispatch({}, new PresenceChanged(true, 1));

    assert.equal(errors.length, 1);
  });

  it('evaluates conditions and runs actions against the sensor', async () => {
    const { flow, listeners } = fakeFlow();
    const { connection, timers, sensor } = connectedSensor();
    const device = { sensor };

    new FlowCards(flow, silent).register();
    connection.preload(ZONE_ONE_TRIANGLE);
    connection.report('any_presence', true);
    connection.report('all_targets_count', 2);
    connection.report('zone_1_presence', true);

    assert.equal(await listeners.get(Cards.IS_PRESENT)({ device }), true);
    assert.equal(await listeners.get(Cards.ZONE_OCCUPIED)({ device, zone: '1' }), true);
    assert.equal(await listeners.get(Cards.ZONE_MOVING)({ device, zone: '1' }), false);
    assert.equal(await listeners.get(Cards.PEOPLE_ABOVE)({ device, count: 1 }), true);

    await listeners.get(Cards.SET_ZONE_DELAY)({ device, zone: '2', seconds: 15 });

    const beep = listeners.get(Cards.BEEP)({ device, duration: 0.5 });

    timers.tick(500);
    await beep;

    assert.deepEqual(connection.commands.map((command) => command.objectId), [
      'zone_2_presence_delay',
      'mlt8530___buzzer',
      'mlt8530___buzzer',
    ]);
  });
});

describe('SensorPresenter', () => {
  it('builds the live payload and the full snapshot', () => {
    const { connection, sensor } = connectedSensor();

    connection.preload({ ...ZONE_ONE_TRIANGLE, zone_1_presence_delay: 30, exclusion_zone_points_count: 0 });
    connection.report('any_presence', true);
    connection.report('zone_1_presence', true);

    const view = viewOf(sensor);
    const live = SensorPresenter.live(view);
    const snapshot = SensorPresenter.snapshot(view);

    assert.equal(live.presence, true);
    assert.deepEqual(live.zones[0], {
      zone: 1, presence: true, movement: false, people: 0,
    });
    assert.deepEqual(snapshot.zones['1'], {
      points: [[-100, 100], [100, 100], [0, 300]],
      presenceDelay: 30,
      movementThreshold: 0,
    });
    assert.deepEqual(snapshot.zones.exclusion, { points: [] });
    assert.equal(snapshot.env.temperature, 21.5);
    assert.equal(snapshot.env.co2, null);
    assert.deepEqual(SensorPresenter.summary(view), { id: 'aa:bb', name: 'Living room', connected: true });
  });
});

describe('RealtimeHub', () => {
  it('throttles live frames and publishes snapshots and device lists immediately', async () => {
    const published = [];
    const timers = new FakeTimers();
    const hub = new RealtimeHub({
      api: {
        realtime: (channel, data) => {
          published.push([channel, data.id ?? data.length]);
        },
      },
      timers,
      logger: silent,
    });
    const { sensor } = connectedSensor();
    const view = viewOf(sensor);

    hub.live(view);
    hub.live(view);
    hub.zones(view);
    hub.devices([view]);
    await Promise.resolve();

    assert.deepEqual(published, [[Channels.ZONES, 'aa:bb'], [Channels.DEVICES, 1]]);

    timers.tick(RealtimeHub.LIVE_INTERVAL_MS);
    await Promise.resolve();

    assert.deepEqual(published.at(-1), [Channels.LIVE, 'aa:bb']);
    assert.equal(published.length, 3);

    hub.dispose();
  });

  it('logs publishing failures', async () => {
    const errors = [];
    const hub = new RealtimeHub({
      api: {
        realtime: async () => {
          throw new Error('no listeners');
        },
      },
      timers: new FakeTimers(),
      logger: {
        log() {},
        error: (...args) => {
          errors.push(args);
        },
      },
    });

    hub.devices([]);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    assert.equal(errors.length, 1);
  });
});

describe('SensyApi', () => {
  /** @type {FakeConnection} */
  let connection;

  /** @type {SensyApi} */
  let api;

  beforeEach(() => {
    const setup = connectedSensor();

    connection = setup.connection;
    api = new SensyApi(() => [viewOf(setup.sensor)]);
  });

  it('lists devices and returns snapshots', () => {
    assert.deepEqual(api.listDevices(), [{ id: 'aa:bb', name: 'Living room', connected: true }]);
    assert.equal(api.getSnapshot('aa:bb')?.id, 'aa:bb');
    assert.equal(api.getSnapshot()?.id, 'aa:bb');
    assert.throws(() => api.getSnapshot('nope'), NotFoundError);
    assert.equal(new SensyApi(() => []).getSnapshot(), null);
  });

  it('validates and writes zones', () => {
    const result = api.setZone('aa:bb', 'exclusion', { points: [[0, 0], [10, 0], [0, 10]] });

    assert.deepEqual(result, { zone: 'exclusion', points: [[0, 0], [10, 0], [0, 10]] });
    assert.equal(connection.commands.at(-1)?.objectId, 'exclusion_zone_points_count');
    assert.deepEqual(api.setZone('aa:bb', '1', null), { zone: '1', points: [] });
    assert.throws(() => api.setZone('aa:bb', '1', [1, 2]), ValidationError);
    assert.throws(() => api.setZone('aa:bb', '1', 'text'), ValidationError);
    assert.throws(() => api.setZone('aa:bb', '9', {}), ValidationError);
  });

  it('writes zone options only for detection zones', () => {
    assert.deepEqual(api.setZoneOptions('aa:bb', '2', { presenceDelay: 12 }), { zone: '2' });
    assert.deepEqual(connection.commands, [{ kind: 'number', objectId: 'zone_2_presence_delay', value: 12 }]);
    assert.throws(() => api.setZoneOptions('aa:bb', 'exclusion', {}), ValidationError);
  });
});
