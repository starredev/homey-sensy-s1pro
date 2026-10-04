import { KeyedThrottle } from '../core/timers.js';
import { SensorPresenter } from '../presentation/SensorPresenter.js';

/** @typedef {import('../core/timers.js').Timers} Timers */
/** @typedef {import('../core/logger.js').Logger} Logger */
/** @typedef {import('../presentation/SensorPresenter.js').SensorView} SensorView */

/**
 * @typedef {object} RealtimeApi
 * @property {(event: string, data: unknown) => unknown} realtime
 */

/** Realtime channels the widget and the settings page subscribe to. */
export const Channels = Object.freeze({
  LIVE: 'sensy.live',
  ZONES: 'sensy.zones',
  DEVICES: 'sensy.devices',
});

/**
 * Publishes sensor state to the web views over Homey's realtime API.
 * Live radar data is throttled per sensor, because the radar reports target
 * positions far faster than a dashboard needs to redraw.
 */
export class RealtimeHub {
  /** Minimum time between two live frames of the same sensor. */
  static LIVE_INTERVAL_MS = 200;

  /** @type {RealtimeApi} */
  #api;

  /** @type {Logger} */
  #logger;

  /** @type {KeyedThrottle<SensorView>} */
  #liveFrames;

  /**
   * @param {object} options
   * @param {RealtimeApi} options.api
   * @param {Timers} options.timers
   * @param {Logger} options.logger
   */
  constructor({ api, timers, logger }) {
    this.#api = api;
    this.#logger = logger;

    this.#liveFrames = new KeyedThrottle(timers, RealtimeHub.LIVE_INTERVAL_MS, (views) => {
      for (const view of views) {
        this.#publish(Channels.LIVE, SensorPresenter.live(view));
      }
    });
  }

  /**
   * Queues a live frame (targets, presence) of a sensor.
   * @param {SensorView} view
   */
  live(view) {
    this.#liveFrames.push(view.id, view);
  }

  /**
   * Publishes a full snapshot after the zones of a sensor changed.
   * @param {SensorView} view
   */
  zones(view) {
    this.#publish(Channels.ZONES, SensorPresenter.snapshot(view));
  }

  /**
   * Publishes the list of sensors and their connection status.
   * @param {SensorView[]} views
   */
  devices(views) {
    const summaries = views.map((view) => SensorPresenter.summary(view));

    this.#publish(Channels.DEVICES, summaries);
  }

  dispose() {
    this.#liveFrames.cancel();
  }

  /**
   * Fire-and-forget: a web view that is not open is not an error.
   * @param {string} channel
   * @param {unknown} data
   */
  async #publish(channel, data) {
    try {
      await this.#api.realtime(channel, data);
    } catch (error) {
      this.#logger.error(`Realtime ${channel} failed:`, error);
    }
  }
}
