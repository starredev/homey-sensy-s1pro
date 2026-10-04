import {
  PeopleCountChanged,
  PresenceChanged,
  ZoneMovementChanged,
  ZonePresenceChanged,
} from '../sensor/events.js';
import { Zone } from '../sensor/Zone.js';

/** @typedef {import('../sensor/events.js').SensorEvent} SensorEvent */
/** @typedef {import('../utils.js').Logger} Logger */
/** @typedef {import('../sensor/S1ProSensor.js').S1ProSensor} S1ProSensor */

/**
 * @typedef {object} FlowDevice
 * What flow cards need from a device.
 * @property {S1ProSensor} sensor
 */

/**
 * @typedef {object} TriggerCard
 * @property {(device: any, tokens?: object, state?: object) => Promise<unknown>} trigger
 * @property {(listener: (args: any, state: any) => Promise<boolean>) => unknown} registerRunListener
 */

/**
 * @typedef {object} RunListenerCard
 * @property {(listener: (args: any) => Promise<unknown>) => unknown} registerRunListener
 */

/**
 * @typedef {object} FlowManager
 * The subset of `homey.flow` used here.
 * @property {(id: string) => TriggerCard} getDeviceTriggerCard
 * @property {(id: string) => RunListenerCard} getConditionCard
 * @property {(id: string) => RunListenerCard} getActionCard
 */

/**
 * @typedef {object} TriggerInvocation
 * @property {string} card
 * @property {Record<string, unknown>} [tokens]
 * @property {{ zone: string }} [state]
 */

/** Flow card ids, as declared in `driver.flow.compose.json`. */
export const Cards = Object.freeze({
  ROOM_OCCUPIED: 'room_occupied',
  ROOM_EMPTY: 'room_empty',
  PEOPLE_CHANGED: 'people_changed',
  ZONE_ENTERED: 'zone_entered',
  ZONE_LEFT: 'zone_left',
  ZONE_MOVEMENT_STARTED: 'zone_movement_started',
  ZONE_MOVEMENT_STOPPED: 'zone_movement_stopped',

  IS_PRESENT: 'is_present',
  ZONE_OCCUPIED: 'zone_occupied',
  ZONE_MOVING: 'zone_moving',
  PEOPLE_ABOVE: 'people_above',

  SET_ZONE_DELAY: 'set_zone_delay',
  BEEP: 'beep',
});

/** Trigger cards with a zone dropdown; they only fire for the selected zone. */
const ZONE_TRIGGERS = Object.freeze([
  Cards.ZONE_ENTERED,
  Cards.ZONE_LEFT,
  Cards.ZONE_MOVEMENT_STARTED,
  Cards.ZONE_MOVEMENT_STOPPED,
]);

const TRIGGERS = Object.freeze([
  Cards.ROOM_OCCUPIED,
  Cards.ROOM_EMPTY,
  Cards.PEOPLE_CHANGED,
  ...ZONE_TRIGGERS,
]);

/**
 * Owns every flow card of the driver: registers run listeners for conditions
 * and actions, and fires triggers for domain events.
 */
export class FlowCards {
  /** @type {FlowManager} */
  #flow;

  /** @type {Logger} */
  #logger;

  /** @type {Map<string, TriggerCard>} */
  #triggers = new Map();

  /**
   * @param {FlowManager} flow
   * @param {Logger} logger
   */
  constructor(flow, logger) {
    this.#flow = flow;
    this.#logger = logger;
  }

  /** @returns {this} */
  register() {
    this.#registerTriggers();
    this.#registerConditions();
    this.#registerActions();

    return this;
  }

  /**
   * Fires the trigger card that corresponds to a domain event.
   * @param {FlowDevice} device
   * @param {SensorEvent} event
   * @returns {Promise<void>}
   */
  async dispatch(device, event) {
    const invocation = FlowCards.translate(event);

    if (!invocation) {
      return;
    }

    const { card, tokens = {}, state = {} } = invocation;

    try {
      await this.#triggers.get(card)?.trigger(device, tokens, state);
    } catch (error) {
      this.#logger.error(`Trigger ${card} failed:`, error);
    }
  }

  /**
   * Maps a domain event onto the trigger card invocation it stands for.
   * @param {SensorEvent} event
   * @returns {TriggerInvocation | null} null for events without a trigger card
   */
  static translate(event) {
    if (event instanceof PresenceChanged) {
      return FlowCards.#presence(event);
    }

    if (event instanceof PeopleCountChanged) {
      return FlowCards.#peopleCount(event);
    }

    if (event instanceof ZonePresenceChanged) {
      return FlowCards.#zonePresence(event);
    }

    if (event instanceof ZoneMovementChanged) {
      return FlowCards.#zoneMovement(event);
    }

    return null;
  }

  /**
   * @param {PresenceChanged} event
   * @returns {TriggerInvocation}
   */
  static #presence(event) {
    if (!event.present) {
      return { card: Cards.ROOM_EMPTY };
    }

    return {
      card: Cards.ROOM_OCCUPIED,
      tokens: { people: event.people },
    };
  }

  /**
   * @param {PeopleCountChanged} event
   * @returns {TriggerInvocation}
   */
  static #peopleCount(event) {
    return {
      card: Cards.PEOPLE_CHANGED,
      tokens: {
        people: event.people,
        previous: event.previous,
      },
    };
  }

  /**
   * @param {ZonePresenceChanged} event
   * @returns {TriggerInvocation}
   */
  static #zonePresence(event) {
    const state = { zone: event.zone.key };

    if (!event.present) {
      return { card: Cards.ZONE_LEFT, state };
    }

    return {
      card: Cards.ZONE_ENTERED,
      tokens: { people: event.people },
      state,
    };
  }

  /**
   * @param {ZoneMovementChanged} event
   * @returns {TriggerInvocation}
   */
  static #zoneMovement(event) {
    const state = { zone: event.zone.key };

    if (event.moving) {
      return { card: Cards.ZONE_MOVEMENT_STARTED, state };
    }

    return { card: Cards.ZONE_MOVEMENT_STOPPED, state };
  }

  // --- Registration -----------------------------------------------------------

  #registerTriggers() {
    for (const id of TRIGGERS) {
      this.#triggers.set(id, this.#flow.getDeviceTriggerCard(id));
    }

    for (const id of ZONE_TRIGGERS) {
      const card = this.#triggers.get(id);

      card?.registerRunListener(async (args, state) => {
        return String(args.zone) === state.zone;
      });
    }
  }

  #registerConditions() {
    this.#onCondition(Cards.IS_PRESENT, ({ device }) => {
      return device.sensor.present;
    });

    this.#onCondition(Cards.ZONE_OCCUPIED, ({ device, zone }) => {
      return device.sensor.isZoneOccupied(Zone.from(zone));
    });

    this.#onCondition(Cards.ZONE_MOVING, ({ device, zone }) => {
      return device.sensor.isZoneMoving(Zone.from(zone));
    });

    this.#onCondition(Cards.PEOPLE_ABOVE, ({ device, count }) => {
      return device.sensor.people > Number(count);
    });
  }

  #registerActions() {
    this.#onAction(Cards.SET_ZONE_DELAY, ({ device, zone, seconds }) => {
      device.sensor.setZoneOptions(Zone.detection(zone), { presenceDelay: seconds });
    });

    this.#onAction(Cards.BEEP, async ({ device, duration }) => {
      await device.sensor.beep(duration);
    });
  }

  /**
   * @param {string} id
   * @param {(args: any) => boolean} evaluate
   */
  #onCondition(id, evaluate) {
    this.#flow.getConditionCard(id).registerRunListener(async (args) => {
      return evaluate(args);
    });
  }

  /**
   * @param {string} id
   * @param {(args: any) => unknown} run
   */
  #onAction(id, run) {
    this.#flow.getActionCard(id).registerRunListener(async (args) => {
      await run(args);
    });
  }
}
