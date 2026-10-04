import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  PeopleCountChanged,
  PresenceChanged,
  ZoneMovementChanged,
  ZonePresenceChanged,
} from '../../lib/domain/events.js';
import { Polygon } from '../../lib/domain/Polygon.js';
import { Zone } from '../../lib/domain/Zone.js';
import { Endpoint } from '../../lib/esphome/Endpoint.js';
import { NumberSettingBinding, SettingBinding, SwitchSettingBinding } from '../../lib/sensor/bindings.js';
import { S1ProSensor } from '../../lib/sensor/S1ProSensor.js';
import { StateRouter } from '../../lib/sensor/StateRouter.js';
import { ZoneRepository } from '../../lib/sensor/ZoneRepository.js';
import { FakeConnection, ZONE_ONE_TRIANGLE } from '../support/FakeConnection.js';
import { FakeTimers } from '../support/FakeTimers.js';

describe('StateRouter', () => {
  it('prefers exact routes, then patterns in order', () => {
    const calls = [];
    const router = new StateRouter()
      .on('a', (value) => {
        calls.push(['exact', value]);
      })
      .on(['b', 'c'], (value, groups, id) => {
        calls.push(['list', id]);
      })
      .on(/^x_(\d)$/, (value, groups) => {
        calls.push(['pattern', groups[0]]);
      });

    assert.equal(router.dispatch('a', 1), true);
    assert.equal(router.dispatch('c', 2), true);
    assert.equal(router.dispatch('x_7', 3), true);
    assert.equal(router.dispatch('unknown', 4), false);
    assert.deepEqual(calls, [['exact', 1], ['list', 'c'], ['pattern', '7']]);
  });
});

describe('setting bindings', () => {
  it('cannot instantiate the abstract base', () => {
    assert.throws(() => new SettingBinding('a', 'b'), TypeError);
  });

  it('rounds numbers and writes them as numbers', () => {
    const connection = new FakeConnection();
    const binding = new NumberSettingBinding('detection_range', 'detection_range');

    assert.equal(binding.read(connection), undefined);

    connection.preload({ detection_range: 599.96 });
    connection.connected = true;
    binding.write(connection, '450');

    assert.equal(binding.read(connection), 600);
    assert.deepEqual(connection.commands, [{ kind: 'number', objectId: 'detection_range', value: 450 }]);
  });

  it('mirrors switches as booleans', () => {
    const connection = new FakeConnection();
    const binding = new SwitchSettingBinding('single_target', 'radar___single_target');

    connection.preload({ radar___single_target: 1 });
    connection.connected = true;
    binding.write(connection, 0);

    assert.equal(binding.read(connection), true);
    assert.deepEqual(connection.commands, [{ kind: 'switch', objectId: 'radar___single_target', value: false }]);
  });
});

describe('ZoneRepository', () => {
  /** @type {FakeConnection} */
  let connection;

  /** @type {ZoneRepository} */
  let zones;

  beforeEach(() => {
    connection = new FakeConnection();
    connection.connected = true;
    zones = new ZoneRepository(connection);
  });

  it('reads nothing until the point count arrives', () => {
    assert.equal(zones.read(Zone.ONE), null);
    assert.equal(zones.isConfigured(Zone.ONE), false);
  });

  it('reads an outline once all points are known', () => {
    connection.preload({ zone_1_points_count: 3, zone_1_p1_x: 0, zone_1_p1_y: 0 });

    assert.equal(zones.read(Zone.ONE), null);

    connection.preload(ZONE_ONE_TRIANGLE);

    assert.deepEqual(zones.read(Zone.ONE)?.toJSON(), [[-100, 100], [100, 100], [0, 300]]);
    assert.equal(zones.isConfigured(Zone.ONE), true);
  });

  it('treats fewer than three points as an empty zone', () => {
    connection.preload({ exclusion_zone_points_count: 2 });

    assert.equal(zones.read(Zone.EXCLUSION), Polygon.EMPTY);
  });

  it('disables a zone while its points are rewritten', () => {
    zones.write(Zone.TWO, Polygon.from([[1, 2], [3, 4], [5, 6]]));

    const written = connection.commands.map(({ objectId, value }) => `${objectId}=${value}`);

    assert.deepEqual(written, [
      'zone_2_points_count=0',
      'zone_2_p1_x=1',
      'zone_2_p1_y=2',
      'zone_2_p2_x=3',
      'zone_2_p2_y=4',
      'zone_2_p3_x=5',
      'zone_2_p3_y=6',
      'zone_2_points_count=3',
    ]);
  });

  it('clears a zone by writing only a zero count', () => {
    zones.write(Zone.TWO, Polygon.EMPTY);

    assert.equal(connection.commands.length, 1);
  });

  it('reads options with defaults and writes them clamped', () => {
    assert.deepEqual(zones.readOptions(Zone.ONE), { presenceDelay: 0, movementThreshold: 0 });

    zones.writeOptions(Zone.ONE, { presenceDelay: 99_999, movementThreshold: -5 });
    zones.writeOptions(Zone.ONE, { presenceDelay: null });

    assert.deepEqual(connection.commands, [
      { kind: 'number', objectId: 'zone_1_presence_delay', value: 3600 },
      { kind: 'number', objectId: 'zone_1_movement_threshold', value: 0 },
    ]);
  });
});

describe('S1ProSensor', () => {
  /** @type {FakeConnection} */
  let connection;

  /** @type {FakeTimers} */
  let timers;

  /** @type {S1ProSensor} */
  let sensor;

  /** @type {import('../../lib/domain/events.js').SensorEvent[]} */
  let events;

  beforeEach(() => {
    connection = new FakeConnection();
    timers = new FakeTimers();
    sensor = new S1ProSensor({ connection, timers });
    events = [];

    sensor.on('event', (event) => {
      events.push(event);
    });

    sensor.start();
    connection.connect();
  });

  it('controls the connection lifecycle', () => {
    assert.equal(connection.started, true);
    assert.equal(sensor.connected, true);

    sensor.moveTo(new Endpoint('192.0.2.99'));

    assert.equal(sensor.endpoint.host, '192.0.2.99');

    sensor.stop();

    assert.equal(connection.started, false);
  });

  it('maps bound entities onto capabilities with conversion', () => {
    const capabilities = [];

    sensor.on('capability', (id, value) => {
      capabilities.push([id, value]);
    });

    connection.report('bme688_temperature', 21.349);
    connection.report('any_presence', 1);

    assert.deepEqual(capabilities, [['measure_temperature', 21.3], ['alarm_motion', true]]);
  });

  it('does not fire events for the first value after connecting', () => {
    connection.report('any_presence', true);
    connection.report('all_targets_count', 1);

    assert.deepEqual(events, []);
  });

  it('fires presence and people events on changes', () => {
    connection.report('any_presence', false);
    connection.report('all_targets_count', 0);
    connection.report('all_targets_count', 2);
    connection.report('any_presence', true);
    connection.report('any_presence', false);

    assert.deepEqual(events, [
      new PeopleCountChanged(2, 0),
      new PresenceChanged(true, 2),
      new PresenceChanged(false, 2),
    ]);
  });

  it('only fires zone events for zones with an outline', () => {
    connection.report('zone_2_presence', false);
    connection.report('zone_2_presence', true);

    assert.deepEqual(events, []);

    connection.preload(ZONE_ONE_TRIANGLE);
    connection.report('zone_1_presence', false);
    connection.report('zone_1_movement', false);
    connection.report('zone_1_presence', true);
    connection.report('zone_1_movement', true);
    connection.report('zone_1_presence', false);

    assert.deepEqual(events, [
      new ZonePresenceChanged(Zone.ONE, true, 1),
      new ZoneMovementChanged(Zone.ONE, true),
      new ZonePresenceChanged(Zone.ONE, false, 0),
    ]);
  });

  it('answers zone queries', () => {
    connection.report('zone_1_presence', true);

    assert.equal(sensor.isZoneOccupied(Zone.ONE), false);

    connection.preload(ZONE_ONE_TRIANGLE);
    connection.report('zone_1_movement', true);
    connection.report('zone_1_target_count', '2.2');

    assert.equal(sensor.isZoneOccupied(Zone.ONE), true);
    assert.equal(sensor.isZoneMoving(Zone.ONE), true);
    assert.equal(sensor.isZoneMoving(Zone.TWO), false);
    assert.deepEqual(sensor.zoneStatus(Zone.ONE), { presence: true, movement: true, people: 2 });
  });

  it('reports live target positions', () => {
    let live = 0;

    sensor.on('live', () => {
      live += 1;
    });

    connection.report('live_t1_x', 120);
    connection.report('live_t1_y', 250);

    assert.equal(live, 1);
    assert.deepEqual(sensor.targets[0], [120, 250]);

    connection.disconnect();

    assert.deepEqual(sensor.targets, [null, null, null]);
  });

  it('reads live positions from the official firmware too', () => {
    let live = 0;

    sensor.on('live', () => {
      live += 1;
    });

    connection.report('target_2_x', -35.4);
    connection.report('target_2_y', 180);

    // The official firmware repeats the same position on every radar frame.
    connection.report('target_2_x', -35.4);
    connection.report('target_2_y', 180);

    assert.equal(live, 1);
    assert.deepEqual(sensor.targets[1], [-35, 180]);

    connection.report('target_2_x', 0);
    connection.report('target_2_y', 0);

    assert.equal(live, 2);
    assert.equal(sensor.targets[1], null);
  });

  it('debounces zone geometry and settings changes', () => {
    let zones = 0;
    let settings = 0;

    sensor.on('zones', () => {
      zones += 1;
    });
    sensor.on('settings', () => {
      settings += 1;
    });

    timers.tick(2000);
    connection.report('zone_1_p1_x', 10);
    connection.report('zone_1_p1_y', 10);
    connection.report('detection_range', 500);
    timers.tick(2000);

    assert.equal(zones, 2);
    assert.equal(settings, 2);
  });

  it('cancels pending work when disconnected', () => {
    let zones = 0;

    sensor.on('zones', () => {
      zones += 1;
    });

    connection.disconnect();
    timers.tick(2000);

    assert.equal(zones, 0);
  });

  it('reports the state of the Bluetooth proxy once per change', () => {
    const seen = [];

    sensor.on('bluetoothProxy', (enabled) => {
      seen.push(enabled);
    });

    assert.equal(sensor.bluetoothProxyEnabled, false);

    connection.report('ble___proxy', false);
    connection.report('ble___proxy', false);
    connection.report('ble___proxy', true);

    assert.deepEqual(seen, [false, true]);
    assert.equal(sensor.bluetoothProxyEnabled, true);
  });

  it('forwards address and firmware information', () => {
    const seen = [];

    sensor.on('address', (address) => {
      seen.push(address);
    });
    sensor.on('firmware', (firmware) => {
      seen.push(firmware);
    });

    connection.report('esp32___ip', '');
    connection.report('esp32___ip', '192.0.2.50');
    connection.emit('deviceInfo', { projectVersion: '2.1', esphomeVersion: '2026.9' });
    connection.emit('deviceInfo', {});

    assert.deepEqual(seen, ['192.0.2.50', '2.1 · ESPHome 2026.9', '? · ESPHome ?']);
  });

  it('exposes room state and the detection range', () => {
    assert.equal(sensor.present, false);
    assert.equal(sensor.detectionRange, 600);

    connection.report('any_movement', true);
    connection.report('detection_range', 450);

    assert.equal(sensor.moving, true);
    assert.equal(sensor.detectionRange, 450);
  });

  it('reads and applies settings', () => {
    connection.preload({ detection_range: 450, radar___single_target: true });

    assert.deepEqual(Object.fromEntries(sensor.readSettings()), {
      detection_range: 450,
      single_target: true,
    });

    const written = sensor.applySettings([['zone2_presence_delay', 30], ['unknown', 1]]);

    assert.deepEqual(written, ['zone2_presence_delay']);
    assert.deepEqual(connection.commands, [{ kind: 'number', objectId: 'zone_2_presence_delay', value: 30 }]);
  });

  it('writes zone outlines and options', () => {
    sensor.setZoneOutline(Zone.THREE, Polygon.EMPTY);
    sensor.setZoneOptions(Zone.THREE, { movementThreshold: 40 });

    assert.deepEqual(connection.commands.map((command) => command.objectId), [
      'zone_3_points_count',
      'zone_3_movement_threshold',
    ]);
    assert.equal(sensor.zoneOutline(Zone.THREE), null);
    assert.deepEqual(sensor.zoneOptions(Zone.THREE), { presenceDelay: 0, movementThreshold: 0 });
  });

  it('beeps for a clamped duration and always switches the buzzer off', async () => {
    const beep = sensor.beep(60);

    timers.tick(4999);

    assert.deepEqual(connection.commands.map((command) => command.value), [true]);

    timers.tick(1);
    await beep;

    assert.deepEqual(connection.commands.map((command) => command.value), [true, false]);
  });

  it('uses the default beep length for invalid input', async () => {
    const beep = sensor.beep(Number.NaN);

    timers.tick(300);
    await beep;

    assert.equal(connection.commands.length, 2);
  });
});
