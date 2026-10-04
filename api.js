/**
 * Web API of the app (see `api` in `.homeycompose/app.json`).
 * Each handler is a thin adapter onto {@link import('./lib/homey/SensyApi.js').SensyApi}.
 */

/** @typedef {import('./app.js').default} SensyApp */

/**
 * @typedef {object} ApiRequest
 * @property {{ app: unknown }} homey
 * @property {Record<string, string>} [params]
 * @property {Record<string, string>} [query]
 * @property {unknown} [body]
 */

/**
 * @param {ApiRequest} request
 */
const sensyApi = ({ homey }) => /** @type {SensyApp} */ (homey.app).api;

export default {
  /** @param {ApiRequest} request */
  async getDevices(request) {
    return sensyApi(request).listDevices();
  },

  /** @param {ApiRequest} request */
  async getDevice(request) {
    return sensyApi(request).getSnapshot(request.params?.id);
  },

  /** @param {ApiRequest} request */
  async setZone(request) {
    const { id, zone } = request.params ?? {};

    return sensyApi(request).setZone(id, zone, request.body);
  },

  /** @param {ApiRequest} request */
  async setZoneOptions(request) {
    const { id, zone } = request.params ?? {};

    return sensyApi(request).setZoneOptions(id, zone, request.body);
  },
};
