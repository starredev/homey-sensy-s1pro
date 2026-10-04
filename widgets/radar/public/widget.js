import { WidgetApiClient } from './lib/ApiClient.js';
import { RadarView } from './lib/RadarView.js';
import { Translator } from './lib/Translator.js';

/** @typedef {import('./lib/ApiClient.js').HomeyBridge} HomeyBridge */

const PHRASES = {
  en: {
    empty: 'No Sensy sensor found. Add one first.',
    nobody: 'Empty',
    present: 'present',
    moving: 'moving',
    exclusion: 'Exclusion',
  },
  nl: {
    empty: 'Geen Sensy-sensor gevonden. Voeg er eerst een toe.',
    nobody: 'Leeg',
    present: 'aanwezig',
    moving: 'beweging',
    exclusion: 'Uitsluiting',
  },
};

/**
 * Dashboard widget: live radar of one sensor with its zones.
 */
class RadarWidget {
  /** @type {HomeyBridge & { getSettings: () => any, ready: (options?: object) => void }} */
  #homey;

  /** @type {WidgetApiClient} */
  #api;

  /** @type {Translator} */
  #i18n = new Translator(PHRASES);

  /** @type {RadarView} */
  #radar;

  /** @type {string | null} */
  #deviceId;

  #announcedReady = false;

  /**
   * @param {any} homey
   */
  constructor(homey) {
    this.#homey = homey;
    this.#api = new WidgetApiClient(homey);
    this.#deviceId = homey.getSettings()?.device?.id ?? null;
    this.#radar = new RadarView(RadarWidget.#element('radar'), {
      exclusionLabel: this.#i18n.t('exclusion'),
    });
  }

  start() {
    this.#subscribe();
    this.#load();
  }

  #subscribe() {
    this.#api.on('sensy.live', (live) => {
      if (live?.id === this.#deviceId) {
        this.#showLive(live);
      }
    });

    this.#api.on('sensy.zones', (snapshot) => {
      if (snapshot?.id === this.#deviceId) {
        this.#showSnapshot(snapshot);
      }
    });

    this.#api.on('sensy.devices', () => {
      if (this.#deviceId === null) {
        this.#load();
      }
    });
  }

  async #load() {
    const query = this.#deviceId ? `?id=${encodeURIComponent(this.#deviceId)}` : '';

    try {
      const snapshot = await this.#api.get(`/${query}`);

      this.#showSnapshot(snapshot);
    } catch (error) {
      // eslint-disable-next-line no-console -- visible in the widget's developer tools
      console.error(error);
      this.#showSnapshot(null);
    }
  }

  /**
   * @param {any} snapshot
   */
  #showSnapshot(snapshot) {
    if (!snapshot) {
      this.#showEmpty();
      this.#announceReady();

      return;
    }

    this.#deviceId = snapshot.id;
    RadarWidget.#element('name').textContent = snapshot.name;
    this.#radar.setRange(snapshot.detectionRange);
    this.#radar.setZones(snapshot.zones);
    this.#showLive(snapshot);
    this.#announceReady();
  }

  /**
   * @param {any} live
   */
  #showLive(live) {
    const dot = RadarWidget.#element('dot');
    const pill = RadarWidget.#element('pill');

    dot.classList.toggle('on', Boolean(live.connected));

    if (live.presence) {
      const state = live.moving ? 'moving' : 'present';

      pill.className = `pill ${state}`;
      pill.textContent = `${live.people} ${this.#i18n.t(state)}`;
    } else {
      pill.className = 'pill';
      pill.textContent = this.#i18n.t('nobody');
    }

    this.#radar.setLive(live);
  }

  #showEmpty() {
    const empty = RadarWidget.#element('empty');

    RadarWidget.#element('radar').style.display = 'none';
    empty.hidden = false;
    empty.textContent = this.#i18n.t('empty');
  }

  /** Tells Homey the widget rendered, once, with its final height. */
  #announceReady() {
    if (this.#announcedReady) {
      return;
    }

    this.#announcedReady = true;
    this.#homey.ready({ height: Math.ceil(document.body.scrollHeight) });
  }

  /**
   * @param {string} id
   * @returns {any}
   */
  static #element(id) {
    return document.getElementById(id);
  }
}

const homey = await window.homeyReady;

new RadarWidget(homey).start();
