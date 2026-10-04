// Generated from web/shared by scripts/sync-web.js. Do not edit.
import {
  DraftLayer,
  GridLayer,
  SensorLayer,
  TargetLayer,
  ZoneLayer,
} from './layers.js';
import { RadarGeometry } from './RadarGeometry.js';

/** @typedef {import('./layers.js').ZoneShape} ZoneShape */
/** @typedef {import('./layers.js').LiveZone} LiveZone */
/** @typedef {import('./layers.js').TargetPosition} TargetPosition */

/**
 * @typedef {object} LiveState
 * @property {TargetPosition[]} [targets]
 * @property {LiveZone[]} [zones]
 */

/**
 * Top-down radar map of one sensor: grid, zones, an optional zone being
 * edited, and the live targets. Used by both the dashboard widget and the
 * zone editor.
 */
export class RadarView {
  /** @type {SVGSVGElement} */
  #svg;

  /** @type {string} */
  #exclusionLabel;

  /** @type {RadarGeometry} */
  #geometry = new RadarGeometry(RadarGeometry.DEFAULT_RANGE);

  /** @type {Record<string, ZoneShape>} */
  #zones = {};

  /** @type {LiveState} */
  #live = {};

  /** @type {string | null} */
  #editing = null;

  /** @type {[number, number][]} */
  #draft = [];

  /** @type {GridLayer} */
  #grid;

  /** @type {ZoneLayer} */
  #zoneLayer;

  /** @type {DraftLayer} */
  #draftLayer;

  /** @type {TargetLayer} */
  #targets;

  /** @type {SensorLayer} */
  #sensor;

  /**
   * @param {SVGSVGElement} svg
   * @param {{ exclusionLabel?: string }} [options]
   */
  constructor(svg, { exclusionLabel = 'Exclusion' } = {}) {
    this.#svg = svg;
    this.#exclusionLabel = exclusionLabel;

    // Layers are stacked in creation order.
    this.#grid = new GridLayer(svg);
    this.#zoneLayer = new ZoneLayer(svg);
    this.#draftLayer = new DraftLayer(svg);
    this.#targets = new TargetLayer(svg);
    this.#sensor = new SensorLayer(svg);

    this.#rebuild();
  }

  /** @returns {SVGSVGElement} */
  get element() {
    return this.#svg;
  }

  /**
   * @param {number} centimetres detection range of the sensor
   */
  setRange(centimetres) {
    const geometry = new RadarGeometry(centimetres);

    if (geometry.range === this.#geometry.range) {
      return;
    }

    this.#geometry = geometry;
    this.#rebuild();
  }

  /**
   * @param {Record<string, ZoneShape>} zones
   */
  setZones(zones) {
    this.#zones = zones ?? {};
    this.#renderZones();
  }

  /**
   * @param {LiveState} live
   */
  setLive(live) {
    this.#live = live ?? {};
    this.#renderZones();
    this.#targets.render(this.#geometry, this.#live.targets ?? []);
  }

  /**
   * Shows an outline being edited; its saved version is hidden meanwhile.
   * @param {string | null} zoneKey null to stop editing
   * @param {[number, number][]} points
   */
  showDraft(zoneKey, points) {
    this.#editing = zoneKey;
    this.#draft = points;
    this.#renderZones();
    this.#draftLayer.render(this.#geometry, this.#editing, this.#draft);
  }

  /**
   * @param {MouseEvent} event
   * @returns {[number, number]} the radar position under the pointer, in centimetres
   */
  positionOf(event) {
    const point = this.#svg.createSVGPoint();

    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = this.#svg.getScreenCTM()?.inverse();
    const local = matrix ? point.matrixTransform(matrix) : point;

    return this.#geometry.toCentimetres(local.x, local.y);
  }

  #rebuild() {
    this.#svg.setAttribute('viewBox', this.#geometry.viewBox);
    this.#grid.render(this.#geometry);
    this.#sensor.render(this.#geometry);
    this.#targets.reset();
    this.#renderZones();
    this.#draftLayer.render(this.#geometry, this.#editing, this.#draft);
    this.#targets.render(this.#geometry, this.#live.targets ?? []);
  }

  #renderZones() {
    this.#zoneLayer.render(this.#geometry, {
      zones: this.#zones,
      liveZones: this.#liveZones(),
      editing: this.#editing,
      exclusionLabel: this.#exclusionLabel,
    });
  }

  /**
   * A full snapshot also carries `zones`, but keyed by zone with outlines;
   * only the list form of a live frame holds zone activity.
   * @returns {LiveZone[]}
   */
  #liveZones() {
    const zones = this.#live.zones;

    if (Array.isArray(zones)) {
      return zones;
    }

    return [];
  }
}
