// Generated from web/shared by scripts/sync-web.js. Do not edit.
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Small helper for building SVG trees.
 */
export class Svg {
  /**
   * Creates an SVG element with attributes and appends it to a parent.
   * @param {string} tag
   * @param {Record<string, string | number>} attributes
   * @param {Element} [parent]
   * @returns {SVGElement}
   */
  static element(tag, attributes, parent) {
    const node = /** @type {SVGElement} */ (document.createElementNS(SVG_NAMESPACE, tag));

    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }

    parent?.appendChild(node);

    return node;
  }

  /**
   * Creates a text element.
   * @param {string} content
   * @param {Record<string, string | number>} attributes
   * @param {Element} parent
   * @returns {SVGElement}
   */
  static text(content, attributes, parent) {
    const node = Svg.element('text', attributes, parent);

    node.textContent = content;

    return node;
  }

  /**
   * @param {Element} node
   */
  static clear(node) {
    node.replaceChildren();
  }
}
