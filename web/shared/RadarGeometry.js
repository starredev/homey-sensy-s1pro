/**
 * Maps radar coordinates (centimetres) onto SVG pixels and back.
 *
 * Radar space: x = left (−) / right (+) of the sensor, y = distance in front
 * of it. SVG space: a fixed 680 px wide canvas with the sensor at the bottom
 * centre, so the field of view fans out upwards.
 */
export class RadarGeometry {
  static CANVAS_WIDTH = 680;

  static DRAWING_WIDTH = 560;

  static COORDINATE_LIMIT = 1800;

  static MIN_RANGE = 200;

  static DEFAULT_RANGE = 600;

  /** Half of the sensor's field of view (±60°). */
  static HALF_FIELD_OF_VIEW = Math.PI / 3;

  /** Grid in which edited points snap, in centimetres. */
  static SNAP_CM = 10;

  /**
   * @param {number} range detection range in centimetres
   */
  constructor(range) {
    const limit = RadarGeometry.COORDINATE_LIMIT;
    const requested = Number(range) || RadarGeometry.DEFAULT_RANGE;

    /** Visible distance in centimetres. */
    this.range = Math.min(limit, Math.max(RadarGeometry.MIN_RANGE, requested));

    /** Visible half-width in centimetres. */
    this.halfWidth = (this.range * 2) / 3;

    /** Pixels per centimetre. */
    this.scale = RadarGeometry.DRAWING_WIDTH / (2 * this.halfWidth);

    const drawingHeight = this.range * this.scale;

    this.originX = RadarGeometry.CANVAS_WIDTH / 2;
    this.originY = drawingHeight + 30;
    this.height = drawingHeight + 50;
    Object.freeze(this);
  }

  /** @returns {string} the SVG viewBox for this geometry */
  get viewBox() {
    return `0 0 ${RadarGeometry.CANVAS_WIDTH} ${Math.round(this.height)}`;
  }

  /** @returns {number} distance between grid lines in centimetres */
  get gridStep() {
    if (this.range > 1000) {
      return 200;
    }

    return 100;
  }

  /**
   * @param {number} x centimetres
   * @param {number} y centimetres
   * @returns {[number, number]} SVG pixels
   */
  toPixels(x, y) {
    return [
      this.originX + x * this.scale,
      this.originY - y * this.scale,
    ];
  }

  /**
   * Converts an SVG position to radar coordinates, snapped and clamped to
   * what the firmware accepts.
   * @param {number} px
   * @param {number} py
   * @returns {[number, number]} centimetres
   */
  toCentimetres(px, py) {
    const limit = RadarGeometry.COORDINATE_LIMIT;
    const x = (px - this.originX) / this.scale;
    const y = (this.originY - py) / this.scale;

    return [
      RadarGeometry.#snap(Math.min(limit, Math.max(-limit, x))),
      RadarGeometry.#snap(Math.min(limit, Math.max(0, y))),
    ];
  }

  /**
   * @param {readonly (readonly number[])[]} points centimetres
   * @param {boolean} [closed]
   * @returns {string} SVG path data
   */
  path(points, closed = true) {
    const segments = points.map(([x, y], index) => {
      const [px, py] = this.toPixels(x, y);
      const command = index === 0 ? 'M' : 'L';

      return `${command} ${px} ${py}`;
    });

    if (closed) {
      segments.push('Z');
    }

    return segments.join(' ');
  }

  /**
   * @returns {string} SVG path data of the field-of-view sector
   */
  fieldOfViewPath() {
    const angle = RadarGeometry.HALF_FIELD_OF_VIEW;
    const radius = this.range * this.scale;
    const [leftX, leftY] = this.toPixels(-this.range * Math.sin(angle), this.range * Math.cos(angle));
    const [rightX, rightY] = this.toPixels(this.range * Math.sin(angle), this.range * Math.cos(angle));

    return [
      `M ${this.originX} ${this.originY}`,
      `L ${leftX} ${leftY}`,
      `A ${radius} ${radius} 0 0 1 ${rightX} ${rightY}`,
      'Z',
    ].join(' ');
  }

  /**
   * @param {readonly (readonly number[])[]} points
   * @returns {[number, number]} average of the points
   */
  static centroid(points) {
    let sumX = 0;
    let sumY = 0;

    for (const [x, y] of points) {
      sumX += x;
      sumY += y;
    }

    return [sumX / points.length, sumY / points.length];
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  static #snap(value) {
    return Math.round(value / RadarGeometry.SNAP_CM) * RadarGeometry.SNAP_CM;
  }
}
