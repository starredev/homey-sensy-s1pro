import { RadarGeometry } from './RadarGeometry.js';
import { Svg } from './Svg.js';
import { Theme, ZONE_DRAW_ORDER } from './theme.js';

/** @typedef {[number, number] | null} TargetPosition */

/**
 * @typedef {object} ZoneShape
 * @property {number[][]} points
 */

/**
 * @typedef {object} LiveZone
 * @property {number} zone
 * @property {boolean} presence
 * @property {boolean} movement
 */

/**
 * A `<g>` element of the radar that is redrawn as a unit.
 */
export class Layer {
  /**
   * @param {Element} parent
   */
  constructor(parent) {
    this.group = Svg.element('g', {}, parent);
  }

  clear() {
    Svg.clear(this.group);
  }
}

/**
 * Distance grid, distance labels and the field-of-view sector.
 */
export class GridLayer extends Layer {
  /**
   * @param {RadarGeometry} geometry
   */
  render(geometry) {
    this.clear();
    this.#renderDistanceLines(geometry);
    this.#renderBearingLines(geometry);

    Svg.element('path', {
      'd': geometry.fieldOfViewPath(),
      'fill': Theme.sensor,
      'fill-opacity': 0.05,
      'stroke': 'currentColor',
      'stroke-opacity': 0.15,
      'stroke-dasharray': '5 5',
    }, this.group);
  }

  /**
   * @param {RadarGeometry} geometry
   */
  #renderDistanceLines(geometry) {
    const step = geometry.gridStep;

    for (let distance = step; distance <= geometry.range; distance += step) {
      const [x1, y1] = geometry.toPixels(-geometry.halfWidth, distance);
      const [x2, y2] = geometry.toPixels(geometry.halfWidth, distance);

      Svg.element('line', {
        x1,
        y1,
        x2,
        y2,
        'stroke': 'currentColor',
        'stroke-opacity': 0.08,
      }, this.group);

      Svg.text(`${distance / 100} m`, {
        'x': x1 + 4,
        'y': y1 - 4,
        'font-size': 11,
        'fill': 'currentColor',
        'fill-opacity': 0.4,
      }, this.group);
    }
  }

  /**
   * @param {RadarGeometry} geometry
   */
  #renderBearingLines(geometry) {
    const step = geometry.gridStep;
    const first = -Math.floor(geometry.halfWidth / step) * step;

    for (let x = first; x <= geometry.halfWidth; x += step) {
      const [x1, y1] = geometry.toPixels(x, 0);
      const [x2, y2] = geometry.toPixels(x, geometry.range);
      const isCentre = x === 0;

      Svg.element('line', {
        x1,
        y1,
        x2,
        y2,
        'stroke': 'currentColor',
        'stroke-opacity': isCentre ? 0.12 : 0.05,
        'stroke-dasharray': isCentre ? '' : '3 5',
      }, this.group);
    }
  }
}

/**
 * The sensor itself, drawn at the origin.
 */
export class SensorLayer extends Layer {
  /**
   * @param {RadarGeometry} geometry
   */
  render(geometry) {
    const { originX: x, originY: y } = geometry;

    this.clear();

    Svg.element('circle', {
      cx: x,
      cy: y,
      r: 7,
      fill: Theme.sensor,
    }, this.group);

    Svg.element('path', {
      d: `M ${x} ${y - 17} L ${x - 9} ${y - 1} L ${x + 9} ${y - 1} Z`,
      fill: Theme.sensor,
    }, this.group);
  }
}

/**
 * Saved zone outlines, shaded by their live presence and movement.
 */
export class ZoneLayer extends Layer {
  /** Fill opacity per activity level: idle, presence, movement. */
  static #FILL = Object.freeze([0.08, 0.28, 0.45]);

  /**
   * @param {RadarGeometry} geometry
   * @param {object} state
   * @param {Record<string, ZoneShape>} state.zones
   * @param {LiveZone[]} state.liveZones
   * @param {string | null} state.editing zone hidden because it is being edited
   * @param {string} state.exclusionLabel
   */
  render(geometry, { zones, liveZones, editing, exclusionLabel }) {
    this.clear();

    for (const key of ZONE_DRAW_ORDER) {
      const points = zones[key]?.points ?? [];

      if (points.length < 3 || key === editing) {
        continue;
      }

      const live = liveZones.find((zone) => String(zone.zone) === key);
      const label = key === 'exclusion' ? exclusionLabel : `Zone ${key}`;

      this.#renderZone(geometry, {
        key,
        points,
        label,
        level: ZoneLayer.#activityLevel(live),
        dimmed: editing !== null,
      });
    }
  }

  /**
   * @param {RadarGeometry} geometry
   * @param {{ key: string, points: number[][], label: string, level: number, dimmed: boolean }} zone
   */
  #renderZone(geometry, { key, points, label, level, dimmed }) {
    const color = Theme.zone[key];
    const isExclusion = key === 'exclusion';
    const fill = isExclusion ? 0.1 : ZoneLayer.#FILL[level];
    const dimFactor = dimmed ? 0.5 : 1;

    Svg.element('path', {
      'd': geometry.path(points),
      'fill': color,
      'fill-opacity': fill * dimFactor,
      'stroke': color,
      'stroke-opacity': dimmed ? 0.35 : 0.9,
      'stroke-width': level === 2 ? 3 : 2,
      'stroke-dasharray': isExclusion ? '6 4' : '',
    }, this.group);

    const [cx, cy] = RadarGeometry.centroid(points);
    const [px, py] = geometry.toPixels(cx, cy);

    Svg.text(label, {
      'x': px,
      'y': py + 4,
      'text-anchor': 'middle',
      'font-size': 13,
      'font-weight': 600,
      'fill': color,
      'fill-opacity': dimmed ? 0.45 : 1,
    }, this.group);
  }

  /**
   * @param {LiveZone | undefined} live
   * @returns {number} 0 idle, 1 presence, 2 movement
   */
  static #activityLevel(live) {
    if (live?.movement) {
      return 2;
    }

    if (live?.presence) {
      return 1;
    }

    return 0;
  }
}

/**
 * The outline being edited, with draggable handles.
 */
export class DraftLayer extends Layer {
  /** Attribute that marks a handle and holds its point index. */
  static HANDLE_ATTRIBUTE = 'data-point';

  /**
   * @param {RadarGeometry} geometry
   * @param {string | null} zoneKey
   * @param {[number, number][]} points
   */
  render(geometry, zoneKey, points) {
    this.clear();

    if (zoneKey === null) {
      return;
    }

    const color = Theme.zone[zoneKey];

    if (points.length >= 2) {
      this.#renderOutline(geometry, zoneKey, points, color);
    }

    points.forEach((point, index) => {
      this.#renderHandle(geometry, point, index, color);
    });
  }

  /**
   * @param {EventTarget | null} target
   * @returns {number | null} the point index when the target is a handle
   */
  static handleIndex(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const index = target.getAttribute(DraftLayer.HANDLE_ATTRIBUTE);

    if (index === null) {
      return null;
    }

    return Number(index);
  }

  /**
   * @param {RadarGeometry} geometry
   * @param {string} zoneKey
   * @param {[number, number][]} points
   * @param {string} color
   */
  #renderOutline(geometry, zoneKey, points, color) {
    const closed = points.length >= 3;

    Svg.element('path', {
      'd': geometry.path(points, closed),
      'fill': color,
      'fill-opacity': closed ? 0.22 : 0,
      'stroke': color,
      'stroke-width': 2.5,
      'stroke-dasharray': zoneKey === 'exclusion' ? '6 4' : '',
    }, this.group);
  }

  /**
   * @param {RadarGeometry} geometry
   * @param {[number, number]} point
   * @param {number} index
   * @param {string} color
   */
  #renderHandle(geometry, [x, y], index, color) {
    const [px, py] = geometry.toPixels(x, y);

    Svg.element('circle', {
      'cx': px,
      'cy': py,
      'r': 10,
      'fill': '#fff',
      'stroke': color,
      'stroke-width': 3,
      'style': 'cursor: grab; touch-action: none;',
      [DraftLayer.HANDLE_ATTRIBUTE]: index,
    }, this.group);

    Svg.text(`${x}, ${y}`, {
      'x': px + 13,
      'y': py - 11,
      'font-size': 11,
      'fill': 'currentColor',
      'fill-opacity': 0.65,
    }, this.group);
  }
}

/**
 * Live target markers with a fading trail of recent positions.
 */
export class TargetLayer {
  static TRAIL_LENGTH = 30;

  static #TRANSITION = 'transform 220ms linear';

  /** @type {Layer} */
  #trailLayer;

  /** @type {Layer} */
  #markerLayer;

  /** @type {SVGElement[]} */
  #markers = [];

  /** @type {[number, number][][]} */
  #trails = [];

  /**
   * @param {Element} parent
   */
  constructor(parent) {
    this.#trailLayer = new Layer(parent);
    this.#markerLayer = new Layer(parent);
  }

  /** Recreates the markers, e.g. after the geometry changed. */
  reset() {
    this.#trailLayer.clear();
    this.#markerLayer.clear();
    this.#trails = Theme.targets.map(() => []);
    this.#markers = Theme.targets.map((color, index) => this.#createMarker(color, index));
  }

  /**
   * @param {RadarGeometry} geometry
   * @param {TargetPosition[]} targets
   */
  render(geometry, targets) {
    this.#trailLayer.clear();

    this.#markers.forEach((marker, slot) => {
      const target = targets[slot] ?? null;

      if (target === null) {
        this.#trails[slot] = [];
        marker.style.display = 'none';

        return;
      }

      const position = geometry.toPixels(target[0], target[1]);

      this.#extendTrail(slot, position);
      this.#renderTrail(slot);
      TargetLayer.#moveMarker(marker, position);
    });
  }

  /**
   * @param {string} color
   * @param {number} index
   * @returns {SVGElement}
   */
  #createMarker(color, index) {
    const marker = Svg.element('g', {
      style: `display: none; transition: ${TargetLayer.#TRANSITION};`,
    }, this.#markerLayer.group);

    Svg.element('circle', {
      'r': 13,
      'fill': color,
      'stroke': '#fff',
      'stroke-width': 3,
    }, marker);

    Svg.text(String(index + 1), {
      'y': 4.5,
      'text-anchor': 'middle',
      'font-size': 13,
      'font-weight': 700,
      'fill': '#fff',
    }, marker);

    return marker;
  }

  /**
   * @param {number} slot
   * @param {[number, number]} position
   */
  #extendTrail(slot, position) {
    const trail = this.#trails[slot];
    const last = trail.at(-1);

    if (last && last[0] === position[0] && last[1] === position[1]) {
      return;
    }

    trail.push(position);

    if (trail.length > TargetLayer.TRAIL_LENGTH) {
      trail.shift();
    }
  }

  /**
   * @param {number} slot
   */
  #renderTrail(slot) {
    const trail = this.#trails[slot];

    trail.forEach(([cx, cy], index) => {
      Svg.element('circle', {
        cx,
        cy,
        'r': 3.5,
        'fill': Theme.targets[slot],
        'fill-opacity': ((index + 1) / trail.length) * 0.4,
      }, this.#trailLayer.group);
    });
  }

  /**
   * Shows a marker at a position; a marker that just appeared jumps there,
   * afterwards it glides between positions.
   * @param {SVGElement} marker
   * @param {[number, number]} position
   */
  static #moveMarker(marker, [x, y]) {
    const appearing = marker.style.display === 'none';

    if (appearing) {
      marker.style.transition = 'none';
    }

    marker.style.transform = `translate(${x}px, ${y}px)`;
    marker.style.display = '';

    if (appearing) {
      // Force a style flush so the jump is not animated.
      marker.getBoundingClientRect();
      marker.style.transition = TargetLayer.#TRANSITION;
    }
  }
}
