import assert from 'node:assert/strict';
import test from 'node:test';

import { LspMessageFramer, encodeLspMessage } from '../src/lsp-framing.js';

test('encodes a JSON-RPC message with Content-Length framing', () => {
  const encoded = encodeLspMessage({ jsonrpc: '2.0', id: 1, method: 'shutdown' });

  assert.match(encoded.toString('utf8'), /^Content-Length: \d+\r\n\r\n/);
  assert.ok(encoded.toString('utf8').endsWith('{"jsonrpc":"2.0","id":1,"method":"shutdown"}'));
});

test('decodes complete LSP messages split across chunks', () => {
  const framer = new LspMessageFramer();
  const received = [];
  framer.onMessage((message) => received.push(message));

  const first = encodeLspMessage({ jsonrpc: '2.0', method: 'window/logMessage', params: { message: 'hello' } });
  const second = encodeLspMessage({ jsonrpc: '2.0', id: 2, result: { ok: true } });
  const combined = Buffer.concat([first, second]);

  framer.push(combined.subarray(0, 12));
  framer.push(combined.subarray(12, 41));
  framer.push(combined.subarray(41));

  assert.deepEqual(received, [
    { jsonrpc: '2.0', method: 'window/logMessage', params: { message: 'hello' } },
    { jsonrpc: '2.0', id: 2, result: { ok: true } },
  ]);
});
