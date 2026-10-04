/**
 * @typedef {string | ((...args: any[]) => string)} Phrase
 */

/**
 * Picks a language from the browser and looks up phrases. Phrases may be
 * functions for text with values in it.
 */
export class Translator {
  /** @type {Record<string, Phrase>} */
  #phrases;

  /** @type {string} */
  language;

  /**
   * @param {Record<string, Record<string, Phrase>>} catalog phrases per language; must contain `en`
   * @param {string} [locale] defaults to the browser language
   */
  constructor(catalog, locale = globalThis.navigator?.language ?? 'en') {
    const language = locale.toLowerCase().slice(0, 2);

    this.language = Object.hasOwn(catalog, language) ? language : 'en';
    this.#phrases = catalog[this.language];
  }

  /**
   * @param {string} key
   * @param {...any} args values for phrases that are functions
   * @returns {string}
   */
  t(key, ...args) {
    const phrase = this.#phrases[key];

    if (typeof phrase === 'function') {
      return phrase(...args);
    }

    return phrase ?? key;
  }

  /**
   * Fills every element with a `data-t` attribute with its phrase.
   * @param {ParentNode} root
   */
  apply(root) {
    for (const node of root.querySelectorAll('[data-t]')) {
      node.textContent = this.t(node.getAttribute('data-t') ?? '');
    }
  }
}
