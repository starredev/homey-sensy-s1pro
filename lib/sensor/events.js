/**
 * Domain events raised by the sensor model. They describe *what happened* in
 * the room; the Homey layer decides which flow cards they translate to.
 */

/** @typedef {import('./Zone.js').Zone} Zone */

/**
 * Base class of all domain events.
 */
export class SensorEvent {
  /** Stable identifier used for dispatching. */
  static type = 'sensor';

  /** @returns {string} */
  get type() {
    const eventClass = /** @type {typeof SensorEvent} */ (this.constructor);

    return eventClass.type;
  }
}

/**
 * The room became occupied, or became empty.
 */
export class PresenceChanged extends SensorEvent {
  static type = 'presence';

  /**
   * @param {boolean} present
   * @param {number} people number of people detected when the change happened
   */
  constructor(present, people) {
    super();
    this.present = present;
    this.people = people;
  }
}

/**
 * The number of people in the room changed.
 */
export class PeopleCountChanged extends SensorEvent {
  static type = 'people';

  /**
   * @param {number} people
   * @param {number} previous
   */
  constructor(people, previous) {
    super();
    this.people = people;
    this.previous = previous;
  }
}

/**
 * Someone entered a zone, or the zone became empty.
 */
export class ZonePresenceChanged extends SensorEvent {
  static type = 'zone-presence';

  /**
   * @param {Zone} zone
   * @param {boolean} present
   * @param {number} people number of people in the zone
   */
  constructor(zone, present, people) {
    super();
    this.zone = zone;
    this.present = present;
    this.people = people;
  }
}

/**
 * Movement started or stopped inside a zone.
 */
export class ZoneMovementChanged extends SensorEvent {
  static type = 'zone-movement';

  /**
   * @param {Zone} zone
   * @param {boolean} moving
   */
  constructor(zone, moving) {
    super();
    this.zone = zone;
    this.moving = moving;
  }
}
