import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../lib/core/errors.js';
import { PresenceChanged, SensorEvent } from '../../lib/domain/events.js';
import { Polygon } from '../../lib/domain/Polygon.js';
import { TargetTracker } from '../../lib/domain/TargetTracker.js';
import { ValueTracker } from '../../lib/domain/ValueTracker.js';
import { Zone } from '../../lib/domain/Zone.js';

describe('Zone', () => {
  it('resolves keys to shared instances', () => {
    assert.equal(Zone.from('2'), Zone.TWO);
    assert.equal(Zone.from(2), Zone.TWO);
    assert.equal(Zone.from('exclusion'), Zone.EXCLUSION);
  });

  it('rejects unknown zones', () => {
    assert.throws(() => Zone.from('4'), ValidationError);
  });

  it('only accepts detection zones where presence matters', () => {
    assert.equal(Zone.detection('3'), Zone.THREE);
    assert.throws(() => Zone.detection('exclusion'), ValidationError);
  });

  it('names its ESPHome entities', () => {
    assert.equal(Zone.ONE.entity('presence'), 'zone_1_presence');
    assert.equal(Zone.EXCLUSION.entity('points_count'), 'exclusion_zone_points_count');
  });

  it('serialises to its key', () => {
    assert.equal(JSON.stringify({ zone: Zone.THREE }), '{"zone":"3"}');
    assert.equal(String(Zone.EXCLUSION), 'exclusion');
    assert.equal(Zone.ALL.length, 4);
  });
});

describe('Polygon', () => {
  it('normalises points to whole, clamped centimetres', () => {
    const polygon = Polygon.from([[0.4, 10.6], [5000, -5000], ['20', 30]]);

    assert.deepEqual(polygon.toJSON(), [[0, 11], [1800, -1800], [20, 30]]);
    assert.equal(polygon.size, 3);
  });

  it('treats an empty list as a disabled zone', () => {
    assert.equal(Polygon.from([]), Polygon.EMPTY);
    assert.equal(Polygon.EMPTY.isEmpty, true);
  });

  it('rejects malformed input', () => {
    assert.throws(() => Polygon.from('nope'), /must be a list/);
    assert.throws(() => Polygon.from([[0, 0], [1, 1]]), /3 to 8 points/);
    assert.throws(() => Polygon.from(Array.from({ length: 9 }, () => [0, 0])), /3 to 8 points/);
    assert.throws(() => Polygon.from([[0, 0], [1, 1], [2]]), /Invalid point/);
    assert.throws(() => Polygon.from([[0, 0], [1, 1], ['x', 2]]), /Invalid point/);
  });

  it('is immutable', () => {
    const polygon = Polygon.from([[0, 0], [1, 1], [2, 2]]);

    assert.throws(() => {
      polygon.points[0][0] = 99;
    }, TypeError);
  });

  it('compares by value', () => {
    const triangle = [[0, 0], [1, 1], [2, 2]];

    assert.equal(Polygon.from(triangle).equals(Polygon.from(triangle)), true);
    assert.equal(Polygon.from(triangle).equals(Polygon.from([[0, 0], [1, 1], [2, 3]])), false);
    assert.equal(Polygon.from(triangle).equals(Polygon.EMPTY), false);
  });
});

describe('ValueTracker', () => {
  it('flags the first value as initial and later differences as changes', () => {
    const tracker = new ValueTracker();

    assert.deepEqual(tracker.update('a', 1), {
      value: 1,
      previous: undefined,
      initial: true,
      changed: false,
    });
    assert.equal(tracker.update('a', 1).changed, false);
    assert.equal(tracker.update('a', 2).changed, true);
  });

  it('treats values after a reset as initial but keeps them readable', () => {
    const tracker = new ValueTracker();

    tracker.update('a', true);
    tracker.reset();

    assert.equal(tracker.get('a', false), true);
    assert.equal(tracker.update('a', false).initial, true);
    assert.equal(tracker.get('missing', 7), 7);
  });
});

describe('TargetTracker', () => {
  const below = {
    isEmpty: (x, y) => {
      return x < -9000 || y < -9000;
    },
    completes: () => true,
  };

  it('waits for the completing axis of feeds that send both axes in order', () => {
    const tracker = new TargetTracker();
    const ordered = {
      isEmpty: (x, y) => {
        return x === 0 && y === 0;
      },
      completes: (axis) => axis === 'y',
    };

    tracker.update(0, 'x', 50, ordered);
    tracker.update(0, 'y', 100, ordered);

    assert.equal(tracker.update(0, 'x', 0, ordered), false);
    assert.deepEqual(tracker.positions[0], [50, 100]);
    assert.equal(tracker.update(0, 'y', 0, ordered), true);
    assert.equal(tracker.positions[0], null);
  });

  it('needs both axes before a position is known', () => {
    const tracker = new TargetTracker();

    assert.equal(tracker.update(0, 'x', 10.4, below), false);
    assert.equal(tracker.update(0, 'y', 200.6, below), true);
    assert.deepEqual(tracker.positions, [[10, 201], null, null]);
  });

  it('only reports a change when the rounded position moves', () => {
    const tracker = new TargetTracker();

    tracker.update(0, 'x', 10, below);
    tracker.update(0, 'y', 20, below);

    assert.equal(tracker.update(0, 'x', 10.2, below), false);
    assert.equal(tracker.update(0, 'x', 14, below), true);
  });

  it('maps an empty slot to null using the given rule', () => {
    const tracker = new TargetTracker();

    tracker.update(1, 'x', -9999, below);

    assert.equal(tracker.update(1, 'y', -9999, below), false);
    assert.equal(tracker.positions[1], null);
  });

  it('ignores slots that do not exist and clears on reset', () => {
    const tracker = new TargetTracker();

    assert.equal(tracker.update(5, 'x', 1, below), false);

    tracker.update(2, 'x', 1, below);
    tracker.update(2, 'y', 1, below);
    tracker.reset();

    assert.deepEqual(tracker.positions, [null, null, null]);
  });
});

describe('events', () => {
  it('expose their type through the instance', () => {
    assert.equal(new PresenceChanged(true, 1).type, 'presence');
    assert.equal(new SensorEvent().type, 'sensor');
  });
});
