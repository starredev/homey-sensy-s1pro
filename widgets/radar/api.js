/** @typedef {import('../../app.js').default} SensyApp */

export default {
  /**
   * State of the sensor selected in the widget settings (or the first one).
   * @param {{ homey: { app: unknown }, query?: Record<string, string> }} request
   */
  async getState({ homey, query }) {
    const app = /** @type {SensyApp} */ (homey.app);

    return app.api.getSnapshot(query?.id);
  },
};
