import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const PlaintextFrameHelper = require('@2colors/esphome-native-api/lib/utils/plaintextFrameHelper.js');

/** Message id the library does not know: ListEntitiesUpdateResponse (ESPHome `update:` entity). */
const UNKNOWN_MESSAGE_ID = 116;

/** Message id the library knows: PingRequest. */
const PING_REQUEST_ID = 7;

/**
 * Builds a plaintext ESPHome API frame with an empty payload.
 * @param {number} messageId below 128, so it fits in one varint byte
 * @returns {number[]}
 */
function emptyFrame(messageId) {
  return [0, 0, messageId];
}

/**
 * These tests guard `patches/@2colors+esphome-native-api+*.patch`. Without the
 * patch, the official S1 Pro firmware (which has a firmware-update entity)
 * makes the client drop the connection right after connecting.
 */
describe('@2colors/esphome-native-api (patched)', () => {
  it('skips message types it does not know and keeps reading', () => {
    const helper = new PlaintextFrameHelper('192.0.2.1', 6053);
    const messages = [];
    const errors = [];

    helper.on('message', (message) => {
      messages.push(message);
    });
    helper.on('error', (error) => {
      errors.push(error);
    });

    helper.onData(Buffer.from([...emptyFrame(UNKNOWN_MESSAGE_ID), ...emptyFrame(PING_REQUEST_ID)]));

    const known = messages.filter((message) => !message.unknown);

    assert.deepEqual(errors, []);
    assert.equal(known.length, 1);
    assert.equal(known[0].constructor.type, 'PingRequest');
    assert.equal(helper.buffer.length, 0);

    helper.destroy();
  });
});
