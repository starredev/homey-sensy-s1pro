import { SettingsApiClient, messageOf } from './lib/ApiClient.js';
import { RadarView } from './lib/RadarView.js';
import { Translator } from './lib/Translator.js';
import { ZoneEditorController } from './lib/ZoneEditorController.js';

/** @typedef {import('./lib/ZoneDraft.js').ZoneDraft} ZoneDraft */

const PHRASES = {
  en: {
    title: 'Zone editor',
    intro: 'Walk around the room to see where you are. Tap the map to place 3 to 8 corner points, '
      + 'drag them to move them, then save.',
    sensor: 'Sensor',
    exclusion: 'Exclusion',
    undo: 'Undo point',
    clear: 'Clear zone',
    save: 'Save',
    zoneSettings: 'Settings for this zone',
    delay: 'Presence hold time (s)',
    threshold: 'Movement threshold (cm/s)',
    saveOptions: 'Save settings',
    pointsNeeded: (n) => `${n} more point(s) needed`,
    unsaved: (n) => `${n} points · not saved`,
    saved: (n) => `${n} points saved`,
    noZone: 'No zone drawn yet',
    offline: 'Sensor offline',
    present: (n) => `${n} present`,
    presentMoving: (n) => `${n} present · moving`,
    nobody: 'Nobody present',
    confirmSwitch: 'Your changes to this zone are not saved. Switch anyway?',
    tooFew: 'A zone needs at least 3 points.',
    saving: 'Saving…',
    zoneSaved: 'Zone saved to the sensor',
    zoneCleared: 'Zone cleared',
    saveFailed: (message) => `Saving failed: ${message}`,
    optionsSaved: 'Zone settings saved',
    addFirst: 'Add a Sensy S1 Pro as a device first.',
    offlineSuffix: ' (offline)',
  },
  nl: {
    title: 'Zone-editor',
    intro: 'Loop door de ruimte om te zien waar je staat. Tik op de kaart om 3 tot 8 hoekpunten te plaatsen, '
      + 'sleep ze om te verplaatsen, en sla op.',
    sensor: 'Sensor',
    exclusion: 'Uitsluiting',
    undo: 'Punt terug',
    clear: 'Zone wissen',
    save: 'Opslaan',
    zoneSettings: 'Instellingen voor deze zone',
    delay: 'Aanwezigheid vasthouden (s)',
    threshold: 'Bewegingsdrempel (cm/s)',
    saveOptions: 'Instellingen opslaan',
    pointsNeeded: (n) => `Nog ${n} punt(en) nodig`,
    unsaved: (n) => `${n} punten · niet opgeslagen`,
    saved: (n) => `${n} punten opgeslagen`,
    noZone: 'Nog geen zone getekend',
    offline: 'Sensor offline',
    present: (n) => `${n} aanwezig`,
    presentMoving: (n) => `${n} aanwezig · beweging`,
    nobody: 'Niemand aanwezig',
    confirmSwitch: 'Je wijzigingen aan deze zone zijn nog niet opgeslagen. Toch wisselen?',
    tooFew: 'Een zone heeft minstens 3 punten nodig.',
    saving: 'Opslaan…',
    zoneSaved: 'Zone opgeslagen op de sensor',
    zoneCleared: 'Zone gewist',
    saveFailed: (message) => `Opslaan mislukt: ${message}`,
    optionsSaved: 'Zone-instellingen opgeslagen',
    addFirst: 'Voeg eerst een Sensy S1 Pro toe als apparaat.',
    offlineSuffix: ' (offline)',
  },
};

/**
 * App settings page: draw zones and tune them per sensor.
 */
class ZoneEditorPage {
  /** @type {any} */
  #homey;

  /** @type {SettingsApiClient} */
  #api;

  /** @type {Translator} */
  #i18n = new Translator(PHRASES);

  /** @type {RadarView} */
  #radar;

  /** @type {ZoneEditorController} */
  #editor;

  /** @type {string | null} */
  #deviceId = null;

  /** @type {any} */
  #snapshot = null;

  #zoneKey = '1';

  /** Whether the draft differs from what is saved on the sensor. */
  #dirty = false;

  /**
   * @param {any} homey
   */
  constructor(homey) {
    this.#homey = homey;
    this.#api = new SettingsApiClient(homey);
    this.#radar = new RadarView(ZoneEditorPage.#element('radar'), {
      exclusionLabel: this.#i18n.t('exclusion'),
    });
    this.#editor = new ZoneEditorController(this.#radar);
  }

  async start() {
    this.#i18n.apply(document);
    this.#bindControls();
    this.#subscribe();

    try {
      await this.#loadDevices();
    } catch (error) {
      this.#status(messageOf(error), true);
    } finally {
      this.#homey.ready();
    }
  }

  // --- Loading ------------------------------------------------------------------

  async #loadDevices() {
    const devices = await this.#api.get('/devices');

    if (devices.length === 0) {
      this.#status(this.#i18n.t('addFirst'), true);

      return;
    }

    this.#fillDeviceSelect(devices);
    await this.#loadDevice(devices[0].id);
  }

  /**
   * @param {{ id: string, name: string, connected: boolean }[]} devices
   */
  #fillDeviceSelect(devices) {
    const select = ZoneEditorPage.#element('device');
    const options = devices.map((device) => {
      const suffix = device.connected ? '' : this.#i18n.t('offlineSuffix');

      return new Option(`${device.name}${suffix}`, device.id);
    });

    select.replaceChildren(...options);
    ZoneEditorPage.#element('deviceRow').classList.toggle('hidden', devices.length < 2);
  }

  /**
   * @param {string} id
   */
  async #loadDevice(id) {
    this.#deviceId = id;

    const snapshot = await this.#api.get(`/devices/${encodeURIComponent(id)}`);

    this.#applySnapshot(snapshot);
  }

  /**
   * @param {any} snapshot
   */
  #applySnapshot(snapshot) {
    this.#snapshot = snapshot;
    this.#radar.setRange(snapshot.detectionRange);
    this.#radar.setZones(snapshot.zones);
    this.#showLive(snapshot);

    if (!this.#dirty) {
      this.#startEditing();
    }
  }

  #subscribe() {
    this.#api.on('sensy.live', (live) => {
      if (live?.id === this.#deviceId) {
        this.#showLive(live);
      }
    });

    this.#api.on('sensy.zones', (snapshot) => {
      if (snapshot?.id === this.#deviceId) {
        this.#applySnapshot(snapshot);
      }
    });
  }

  // --- Editing ------------------------------------------------------------------

  #startEditing() {
    const zone = this.#savedZone();
    const points = zone?.points ?? [];
    const draft = this.#editor.edit(this.#zoneKey, points);

    draft.addEventListener('change', () => {
      this.#onDraftChanged(draft);
    });

    this.#dirty = false;
    this.#showZoneOptions(zone);

    if (points.length >= 3) {
      this.#status(this.#i18n.t('saved', points.length));
    } else {
      this.#status(this.#i18n.t('noZone'));
    }
  }

  /**
   * @param {ZoneDraft} draft
   */
  #onDraftChanged(draft) {
    this.#dirty = true;

    if (draft.missing > 0) {
      this.#status(this.#i18n.t('pointsNeeded', draft.missing));
    } else {
      this.#status(this.#i18n.t('unsaved', draft.size));
    }
  }

  /**
   * @param {any} zone
   */
  #showZoneOptions(zone) {
    const isExclusion = this.#zoneKey === 'exclusion';

    ZoneEditorPage.#element('options').classList.toggle('hidden', isExclusion);

    if (isExclusion || !zone) {
      return;
    }

    ZoneEditorPage.#element('delay').value = Math.round(zone.presenceDelay ?? 0);
    ZoneEditorPage.#element('threshold').value = Math.round(zone.movementThreshold ?? 0);
  }

  /**
   * @param {HTMLElement} tab
   */
  #switchTo(tab) {
    for (const other of document.querySelectorAll('.tab')) {
      other.classList.remove('on');
    }

    tab.classList.add('on');
    this.#zoneKey = tab.dataset.zone ?? '1';
    this.#dirty = false;
    this.#startEditing();
  }

  /**
   * @param {HTMLElement} tab
   */
  #requestSwitch(tab) {
    if (!this.#dirty) {
      this.#switchTo(tab);

      return;
    }

    this.#homey.confirm(this.#i18n.t('confirmSwitch'), 'warning', (error, confirmed) => {
      if (!error && confirmed) {
        this.#switchTo(tab);
      }
    });
  }

  // --- Saving -------------------------------------------------------------------

  async #saveZone() {
    const { draft } = this.#editor;

    if (!draft.isSavable) {
      this.#status(this.#i18n.t('tooFew'), true);

      return;
    }

    const points = draft.points;

    this.#status(this.#i18n.t('saving'));

    try {
      await this.#api.put(this.#zonePath(), { points });
    } catch (error) {
      this.#status(this.#i18n.t('saveFailed', messageOf(error)), true);

      return;
    }

    this.#dirty = false;
    this.#savedZone().points = points;
    this.#radar.setZones(this.#snapshot.zones);

    if (points.length > 0) {
      this.#status(this.#i18n.t('zoneSaved'));
    } else {
      this.#status(this.#i18n.t('zoneCleared'));
    }
  }

  async #saveOptions() {
    const options = {
      presenceDelay: Number(ZoneEditorPage.#element('delay').value),
      movementThreshold: Number(ZoneEditorPage.#element('threshold').value),
    };

    try {
      await this.#api.put(`${this.#zonePath()}/options`, options);
    } catch (error) {
      this.#status(this.#i18n.t('saveFailed', messageOf(error)), true);

      return;
    }

    Object.assign(this.#savedZone(), options);
    this.#status(this.#i18n.t('optionsSaved'));
  }

  // --- View helpers -------------------------------------------------------------

  #bindControls() {
    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => {
        this.#requestSwitch(/** @type {HTMLElement} */ (tab));
      });
    }

    ZoneEditorPage.#element('undo').addEventListener('click', () => {
      this.#editor.draft.undo();
    });

    ZoneEditorPage.#element('clear').addEventListener('click', () => {
      this.#editor.draft.clear();
    });

    ZoneEditorPage.#element('save').addEventListener('click', () => {
      this.#saveZone();
    });

    ZoneEditorPage.#element('saveOptions').addEventListener('click', () => {
      this.#saveOptions();
    });

    ZoneEditorPage.#element('device').addEventListener('change', (event) => {
      this.#onDeviceSelected(event.target.value);
    });
  }

  /**
   * @param {string} id
   */
  async #onDeviceSelected(id) {
    this.#dirty = false;

    try {
      await this.#loadDevice(id);
    } catch (error) {
      this.#status(messageOf(error), true);
    }
  }

  /**
   * @param {any} live
   */
  #showLive(live) {
    const label = ZoneEditorPage.#element('live');

    if (!live.connected) {
      label.textContent = this.#i18n.t('offline');

      return;
    }

    if (!live.presence) {
      label.textContent = this.#i18n.t('nobody');
    } else if (live.moving) {
      label.textContent = this.#i18n.t('presentMoving', live.people);
    } else {
      label.textContent = this.#i18n.t('present', live.people);
    }

    this.#radar.setLive(live);
  }

  /**
   * @param {string} text
   * @param {boolean} [isError]
   */
  #status(text, isError = false) {
    const status = ZoneEditorPage.#element('status');

    status.textContent = text;
    status.classList.toggle('err', isError);
  }

  /** @returns {any} the saved state of the zone being edited */
  #savedZone() {
    return this.#snapshot?.zones?.[this.#zoneKey];
  }

  /** @returns {string} */
  #zonePath() {
    return `/devices/${encodeURIComponent(this.#deviceId ?? '')}/zones/${this.#zoneKey}`;
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

await new ZoneEditorPage(homey).start();
