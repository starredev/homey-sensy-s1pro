import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { UnknownMessage, skipUnknownMessages } from '../lib/esphome/compat.js';

const require = createRequire(import.meta.url);
const PlaintextFrameHelper = require('@2colors/esphome-native-api/lib/utils/plaintextFrameHelper.js');

/** Message id the library does not know: ListEntitiesUpdateResponse (ESPHome `update:` entity). */
const UNKNOWN_MESSAGE_ID = 116;

/** Message id the library knows: PingRequest. */
const PING_REQUEST_ID = 7;

/**
 * Feeds two plaintext frames with empty payloads (an unknown message, then a
 * ping) into a frame helper and records what comes out.
 * @returns {{ messages: any[], errors: Error[], leftover: number }}
 */
function readUnknownThenPing() {
  const helper = new PlaintextFrameHelper('192.0.2.1', 6053);
  const messages = [];
  const errors = [];

  helper.on('message', (message) => {
    messages.push(message);
  });
  helper.on('error', (error) => {
    errors.push(error);
  });

  helper.onData(Buffer.from([0, 0, UNKNOWN_MESSAGE_ID, 0, 0, PING_REQUEST_ID]));
  helper.destroy();

  return { messages, errors, leftover: helper.buffer.length };
}

// Node runs every test file in its own process, so the library starts unpatched here.
describe('skipUnknownMessages', () => {
  it('is needed: the library cannot read past an unknown message on its own', () => {
    const { messages, errors } = readUnknownThenPing();

    assert.equal(messages.length, 0);
    assert.ok(errors.length > 0);
  });

  it('skips unknown messages and keeps reading the stream', () => {
    skipUnknownMessages();
    skipUnknownMessages();

    const { messages, errors, leftover } = readUnknownThenPing();

    assert.deepEqual(errors, []);
    assert.equal(leftover, 0);
    assert.equal(messages.length, 2);
    assert.ok(messages[0] instanceof UnknownMessage);
    assert.deepEqual(messages[0].toObject(), { messageId: UNKNOWN_MESSAGE_ID });
    assert.equal(messages[1].constructor.type, 'PingRequest');
  });
});
