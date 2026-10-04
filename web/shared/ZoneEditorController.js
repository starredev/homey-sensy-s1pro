import { DraftLayer } from './layers.js';
import { ZoneDraft } from './ZoneDraft.js';

/** @typedef {import('./RadarView.js').RadarView} RadarView */

/**
 * Lets the user draw a zone on a {@link RadarView}: tap to add a point, drag
 * a handle to move it.
 */
export class ZoneEditorController {
  /** @type {RadarView} */
  #view;

  /** @type {ZoneDraft} */
  #draft = new ZoneDraft();

  /** @type {string | null} */
  #zoneKey = null;

  /** @type {number | null} */
  #dragIndex = null;

  /** Suppresses the click that follows the end of a drag. */
  #justDragged = false;

  /** @type {() => void} */
  #onDraftChange = () => {
    this.#render();
  };

  /**
   * @param {RadarView} view
   */
  constructor(view) {
    this.#view = view;
    this.#bindPointer(view.element);
  }

  /** @returns {ZoneDraft} */
  get draft() {
    return this.#draft;
  }

  /**
   * Starts editing a zone from its saved points.
   * @param {string} zoneKey
   * @param {readonly (readonly number[])[]} points
   * @returns {ZoneDraft}
   */
  edit(zoneKey, points) {
    this.#draft.removeEventListener('change', this.#onDraftChange);
    this.#draft = new ZoneDraft(points);
    this.#draft.addEventListener('change', this.#onDraftChange);
    this.#zoneKey = zoneKey;
    this.#render();

    return this.#draft;
  }

  #render() {
    this.#view.showDraft(this.#zoneKey, this.#draft.points);
  }

  /**
   * @param {SVGSVGElement} svg
   */
  #bindPointer(svg) {
    svg.style.touchAction = 'none';

    svg.addEventListener('pointerdown', (event) => {
      this.#onPointerDown(svg, event);
    });

    svg.addEventListener('pointermove', (event) => {
      this.#onPointerMove(event);
    });

    svg.addEventListener('pointerup', () => {
      this.#onPointerUp();
    });

    svg.addEventListener('click', (event) => {
      this.#onClick(event);
    });
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {PointerEvent} event
   */
  #onPointerDown(svg, event) {
    const index = DraftLayer.handleIndex(event.target);

    if (this.#zoneKey === null || index === null) {
      return;
    }

    this.#dragIndex = index;
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  /**
   * @param {PointerEvent} event
   */
  #onPointerMove(event) {
    if (this.#dragIndex === null) {
      return;
    }

    this.#draft.move(this.#dragIndex, this.#view.positionOf(event));
    this.#render();
  }

  #onPointerUp() {
    if (this.#dragIndex === null) {
      return;
    }

    this.#dragIndex = null;
    this.#justDragged = true;
    this.#draft.commit();
  }

  /**
   * @param {MouseEvent} event
   */
  #onClick(event) {
    if (this.#justDragged) {
      this.#justDragged = false;

      return;
    }

    if (this.#zoneKey === null || DraftLayer.handleIndex(event.target) !== null) {
      return;
    }

    this.#draft.add(this.#view.positionOf(event));
  }
}
