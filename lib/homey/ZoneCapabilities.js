import { Zone } from '../sensor/Zone.js';

/** @typedef {import('./CapabilityStore.js').CapabilityStore} CapabilityStore */
/** @typedef {import('../sensor/Polygon.js').Polygon} Polygon */
/** @typedef {import('../sensor/S1ProSensor.js').ZoneStatus} ZoneStatus */

/**
 * One kind of per-zone sub-capability, e.g. `sensy_zone_presence.zone2`.
 */
class ZoneCapabilityKind {
  /**
   * @param {string} base capability id without the `.zoneN` suffix
   * @param {keyof ZoneStatus} field the status field that feeds it
   * @param {(n: number) => Record<string, string>} title localised title per zone number
   */
  constructor(base, field, title) {
    this.base = base;
    this.field = field;
    this.title = title;
    Object.freeze(this);
  }

  /**
   * @param {Zone} zone
   * @returns {string}
   */
  idFor(zone) {
    return `${this.base}.zone${zone.number}`;
  }

  /**
   * @param {Zone} zone
   * @returns {{ title: Record<string, string> }}
   */
  optionsFor(zone) {
    return { title: this.title(Number(zone.number)) };
  }
}

const KINDS = Object.freeze([
  new ZoneCapabilityKind('sensy_zone_presence', 'presence', (n) => {
    return { en: `Zone ${n} presence`, nl: `Aanwezigheid zone ${n}` };
  }),
  new ZoneCapabilityKind('sensy_zone_movement', 'movement', (n) => {
    return { en: `Zone ${n} movement`, nl: `Beweging zone ${n}` };
  }),
  new ZoneCapabilityKind('sensy_zone_people', 'people', (n) => {
    return { en: `People in zone ${n}`, nl: `Personen in zone ${n}` };
  }),
]);

/**
 * Keeps the per-zone sub-capabilities in line with the zones that actually
 * have an outline, so the device tile only shows zones the user drew.
 */
export class ZoneCapabilities {
  /** @type {CapabilityStore} */
  #store;

  /**
   * @param {CapabilityStore} store
   */
  constructor(store) {
    this.#store = store;
  }

  /**
   * Adds or removes capabilities per zone. Zones whose outline is not fully
   * known yet (`null`) are left alone.
   * @param {(zone: Zone) => Polygon | null} outlineOf
   * @param {(zone: Zone) => ZoneStatus} statusOf
   */
  async reconcile(outlineOf, statusOf) {
    for (const zone of Zone.DETECTION) {
      const outline = outlineOf(zone);

      if (outline === null) {
        continue;
      }

      if (outline.isEmpty) {
        await this.#removeAll(zone);
      } else {
        await this.#addAll(zone);
        await this.update(zone, statusOf(zone));
      }
    }
  }

  /**
   * @param {Zone} zone
   * @param {ZoneStatus} status
   */
  async update(zone, status) {
    for (const kind of KINDS) {
      await this.#store.set(kind.idFor(zone), status[kind.field]);
    }
  }

  /**
   * @param {Zone} zone
   */
  async #addAll(zone) {
    for (const kind of KINDS) {
      await this.#store.add(kind.idFor(zone), kind.optionsFor(zone));
    }
  }

  /**
   * @param {Zone} zone
   */
  async #removeAll(zone) {
    for (const kind of KINDS) {
      await this.#store.remove(kind.idFor(zone));
    }
  }
}
