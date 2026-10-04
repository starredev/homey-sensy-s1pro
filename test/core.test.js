import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NotConnectedError,
  NotFoundError,
  SensyError,
  ValidationError,
} from '../lib/errors.js';
import {
  clamp,
  loggerFrom,
  roundTo,
  silentLogger,
  toFiniteNumber,
} from '../lib/utils.js';
import { Debouncer, KeyedThrottle, delay } from '../lib/timers.js';
import { FakeTimers } from './fakes.js';

describe('errors', () => {
  it('carries a stable code and the subclass name', () => {
    const error = new ValidationError('bad input');

    assert.ok(error instanceof SensyError);
    assert.equal(error.code, 'VALIDATION');
    assert.equal(error.name, 'ValidationError');
  });

  it('describes which entity was unreachable', () => {
    assert.equal(new NotConnectedError('zone_1_p1_x').message, 'Sensor not connected (zone_1_p1_x)');
    assert.equal(new NotConnectedError().message, 'Sensor not connected');
    assert.equal(new NotFoundError('gone').code, 'NOT_FOUND');
  });

  it('defaults the code of the base class', () => {
    assert.equal(new SensyError('x').code, 'SENSY_ERROR');
  });
});

describe('math', () => {
  it('clamps into a range', () => {
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
    assert.equal(clamp(7, 0, 10), 7);
  });

  it('rounds to a number of decimals', () => {
    assert.equal(roundTo(1)(21.349), 21.3);
    assert.equal(roundTo(0)('415.6'), 416);
  });

  it('falls back for non-numeric input', () => {
    assert.equal(toFiniteNumber('12', 0), 12);
    assert.equal(toFiniteNumber('abc', 3), 3);
    assert.equal(toFiniteNumber(Infinity, 3), 3);
  });
});

describe('logger', () => {
  it('forwards to the source', () => {
    const calls = [];
    const logger = loggerFrom({
      log: (...args) => {
        calls.push(['log', ...args]);
      },
      error: (...args) => {
        calls.push(['error', ...args]);
      },
    });

    logger.log('a', 1);
    logger.error('b');

    assert.deepEqual(calls, [['log', 'a', 1], ['error', 'b']]);
  });

  it('has a silent default', () => {
    assert.doesNotThrow(() => {
      silentLogger.log('ignored');
      silentLogger.error('ignored');
    });
  });
});

describe('Debouncer', () => {
  it('runs once after the quiet period', () => {
    const timers = new FakeTimers();
    let runs = 0;
    const debouncer = new Debouncer(timers, 100, () => {
      runs += 1;
    });

    debouncer.schedule();
    timers.tick(60);
    debouncer.schedule();
    timers.tick(60);

    assert.equal(runs, 0);
    assert.equal(debouncer.pending, true);

    timers.tick(40);

    assert.equal(runs, 1);
    assert.equal(debouncer.pending, false);
  });

  it('can be cancelled', () => {
    const timers = new FakeTimers();
    let runs = 0;
    const debouncer = new Debouncer(timers, 100, () => {
      runs += 1;
    });

    debouncer.schedule();
    debouncer.cancel();
    debouncer.cancel();
    timers.tick(500);

    assert.equal(runs, 0);
  });
});

describe('KeyedThrottle', () => {
  it('flushes the latest item per key once per interval', () => {
    const timers = new FakeTimers();
    const flushes = [];
    const throttle = new KeyedThrottle(timers, 200, (items) => {
      flushes.push(items);
    });

    throttle.push('a', 1);
    throttle.push('a', 2);
    throttle.push('b', 3);

    assert.equal(timers.pendingCount, 1);

    timers.tick(200);

    assert.deepEqual(flushes, [[2, 3]]);
  });

  it('drops queued items when cancelled', () => {
    const timers = new FakeTimers();
    const flushes = [];
    const throttle = new KeyedThrottle(timers, 200, (items) => {
      flushes.push(items);
    });

    throttle.push('a', 1);
    throttle.cancel();
    timers.tick(500);

    assert.deepEqual(flushes, []);
  });
});

describe('delay', () => {
  it('resolves after the given time', async () => {
    const timers = new FakeTimers();
    let resolved = false;
    const promise = delay(timers, 50).then(() => {
      resolved = true;
    });

    timers.tick(50);
    await promise;

    assert.equal(resolved, true);
  });
});
