import { createRequire } from 'node:module';

/**
 * Compatibility fix for `@2colors/esphome-native-api` 1.3.6.
 *
 * Newer ESPHome firmware sends message types the library does not know, such
 * as 116 (`ListEntitiesUpdateResponse`, from the official S1 Pro firmware's
 * update entity). The library then drops the connection and cannot parse the
 * rest of the stream. This replaces its message builder so unknown types are
 * skipped instead. Remove it once the library handles unknown types itself.
 */

const require = createRequire(import.meta.url);
const FrameHelper = require('@2colors/esphome-native-api/lib/utils/frameHelper.js');
const { id_to_type: knownTypes } = require('@2colors/esphome-native-api/lib/utils/messages.js');

/**
 * Placeholder for a message the library cannot decode. It has the shape the
 * library expects of a message, and nothing listens for its type.
 */
export class UnknownMessage {
  static type = 'UnknownMessage';

  /**
   * @param {number} messageId
   */
  constructor(messageId) {
    this.messageId = messageId;
  }

  /** @returns {{ messageId: number }} */
  toObject() {
    return { messageId: this.messageId };
  }
}

let installed = false;

/**
 * Installs the fix once; safe to call from every module that creates clients.
 */
export function skipUnknownMessages() {
  if (installed) {
    return;
  }

  const buildKnownMessage = FrameHelper.prototype.buildMessage;

  /**
   * @this {unknown}
   * @param {number} messageId
   * @param {Uint8Array} bytes
   * @returns {unknown}
   */
  FrameHelper.prototype.buildMessage = function buildMessage(messageId, bytes) {
    if (knownTypes[messageId] === undefined) {
      return new UnknownMessage(messageId);
    }

    return buildKnownMessage.call(this, messageId, bytes);
  };

  installed = true;
}
