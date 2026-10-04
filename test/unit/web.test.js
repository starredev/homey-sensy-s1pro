import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findDrift } from '../../scripts/sync-web.js';
import {
  ApiClient,
  SettingsApiClient,
  WidgetApiClient,
  messageOf,
} from '../../web/shared/ApiClient.js';
import { RadarGeometry } from '../../web/shared/RadarGeometry.js';
import { Translator } from '../../web/shared/Translator.js';
import { ZoneDraft } from '../../web/shared/ZoneDraft.js';

describe('RadarGeometry', () => {
  it('fits the range into the canvas with the sensor at the bottom centre', () => {
    const geometry = new RadarGeometry(600);

    assert.equal(geometry.range, 600);
    assert.equal(geometry.halfWidth, 400);
    assert.deepEqual(geometry.toPixels(0, 0), [340, geometry.originY]);
    assert.deepEqual(geometry.toPixels(400, 600), [620, 30]);
    assert.equal(geometry.viewBox, `0 0 680 ${Math.round(geometry.height)}`);
  });

  it('clamps the range and widens the grid for large rooms', () => {
    assert.equal(new RadarGeometry(50).range, RadarGeometry.MIN_RANGE);
    assert.equal(new RadarGeometry(Number.NaN).range, RadarGeometry.DEFAULT_RANGE);
    assert.equal(new RadarGeometry(5000).range, RadarGeometry.COORDINATE_LIMIT);
    assert.equal(new RadarGeometry(600).gridStep, 100);
    assert.equal(new RadarGeometry(1200).gridStep, 200);
  });

  it('converts pixels back to snapped, clamped centimetres', () => {
    const geometry = new RadarGeometry(600);
    const [px, py] = geometry.toPixels(123, 456);

    assert.deepEqual(geometry.toCentimetres(px, py), [120, 460]);
    assert.deepEqual(geometry.toCentimetres(px, geometry.originY + 100), [120, 0]);
  });

  it('builds SVG paths', () => {
    const geometry = new RadarGeometry(600);

    assert.match(geometry.path([[0, 0], [100, 100], [0, 200]]), /^M 340 \S+ L \S+ \S+ L \S+ \S+ Z$/);
    assert.doesNotMatch(geometry.path([[0, 0], [100, 100]], false), /Z$/);
    assert.match(geometry.fieldOfViewPath(), /^M 340 \S+ L \S+ \S+ A /);
    assert.deepEqual(RadarGeometry.centroid([[0, 0], [30, 0], [0, 30]]), [10, 10]);
  });
});

describe('ZoneDraft', () => {
  it('adds up to eight points and reports what is missing', () => {
    const draft = new ZoneDraft();
    let changes = 0;

    draft.addEventListener('change', () => {
      changes += 1;
    });

    assert.equal(draft.isSavable, true);
    assert.equal(draft.add([0, 0]), true);
    assert.equal(draft.missing, 2);
    assert.equal(draft.isSavable, false);

    for (let i = 1; i < 8; i++) {
      draft.add([i, i]);
    }

    assert.equal(draft.add([9, 9]), false);
    assert.equal(draft.canAdd, false);
    assert.equal(draft.size, 8);
    assert.equal(changes, 8);
  });

  it('moves points silently until the drag is committed', () => {
    const draft = new ZoneDraft([[0, 0], [1, 1], [2, 2]]);
    let changes = 0;

    draft.addEventListener('change', () => {
      changes += 1;
    });

    draft.move(1, [5, 5]);
    draft.move(9, [5, 5]);

    assert.equal(changes, 0);

    draft.commit();

    assert.deepEqual(draft.points, [[0, 0], [5, 5], [2, 2]]);
    assert.equal(changes, 1);
  });

  it('undoes and clears', () => {
    const draft = new ZoneDraft([[0, 0], [1, 1]]);

    draft.undo();

    assert.equal(draft.size, 1);

    draft.clear();
    draft.undo();

    assert.equal(draft.size, 0);
  });

  it('never exposes its internal points', () => {
    const draft = new ZoneDraft([[0, 0], [1, 1], [2, 2]]);

    draft.points[0][0] = 99;

    assert.equal(draft.points[0][0], 0);
  });
});

describe('Translator', () => {
  const catalog = {
    en: { hello: 'Hello', count: (n) => `${n} items` },
    nl: { hello: 'Hallo', count: (n) => `${n} dingen` },
  };

  it('picks the browser language with an English fallback', () => {
    assert.equal(new Translator(catalog, 'nl-NL').t('hello'), 'Hallo');
    assert.equal(new Translator(catalog, 'de-DE').language, 'en');
  });

  it('formats phrases and falls back to the key', () => {
    const i18n = new Translator(catalog, 'en');

    assert.equal(i18n.t('count', 3), '3 items');
    assert.equal(i18n.t('missing'), 'missing');
  });

  it('fills elements marked with data-t', () => {
    const node = {
      textContent: '',
      getAttribute: () => 'hello',
    };
    const root = {
      querySelectorAll: () => [node],
    };

    new Translator(catalog, 'nl').apply(root);

    assert.equal(node.textContent, 'Hallo');
  });
});

describe('ApiClient', () => {
  it('is abstract', () => {
    assert.throws(() => new ApiClient({}), TypeError);
  });

  it('adapts the callback style of the settings page', async () => {
    const homey = {
      api: (method, path, body, callback) => {
        if (path === '/fail') {
          callback(new Error('nope'));
        } else {
          callback(null, { method, path, body });
        }
      },
      on() {},
    };
    const client = new SettingsApiClient(homey);

    assert.deepEqual(await client.get('/devices'), { method: 'GET', path: '/devices', body: null });
    assert.deepEqual(await client.put('/x', { a: 1 }), { method: 'PUT', path: '/x', body: { a: 1 } });
    await assert.rejects(client.get('/fail'), /nope/);
  });

  it('adapts the promise style of widgets and forwards events', async () => {
    const events = [];
    const homey = {
      api: async (method, path) => `${method} ${path}`,
      on: (event) => {
        events.push(event);
      },
    };
    const client = new WidgetApiClient(homey);

    client.on('sensy.live', () => {});

    assert.equal(await client.get('/'), 'GET /');
    assert.deepEqual(events, ['sensy.live']);
  });

  it('turns errors into messages', () => {
    assert.equal(messageOf(new Error('boom')), 'boom');
    assert.equal(messageOf('plain'), 'plain');
  });
});

describe('shared web modules', () => {
  it('are in sync with their copies in the web views', async () => {
    assert.deepEqual(await findDrift(), []);
  });
});
