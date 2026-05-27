import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { LspClient } from '../src/lsp-client.js';
import { encodeLspMessage } from '../src/lsp-framing.js';

function createFakeProcess() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const writes = [];

  stdin.on('data', (chunk) => writes.push(Buffer.from(chunk)));

  return {
    process: {
      stdin,
      stdout,
      stderr,
      kill() {},
    },
    writes,
  };
}

test('sends LSP requests and resolves matching responses', async () => {
  const fake = createFakeProcess();
  const client = new LspClient({ process: fake.process, requestTimeoutMs: 100 });

  const pending = client.request('workspace/symbol', { query: 'init' });
  fake.process.stdout.write(encodeLspMessage({ jsonrpc: '2.0', id: 1, result: [{ name: 'init' }] }));

  assert.deepEqual(await pending, [{ name: 'init' }]);
  assert.match(Buffer.concat(fake.writes).toString('utf8'), /"method":"workspace\/symbol"/);
});

test('sends notifications without allocating a request id', () => {
  const fake = createFakeProcess();
  const client = new LspClient({ process: fake.process, requestTimeoutMs: 100 });

  client.notify('textDocument/didOpen', { textDocument: { uri: 'file:///tmp/a.lua', text: 'print(1)' } });

  const output = Buffer.concat(fake.writes).toString('utf8');
  assert.match(output, /"method":"textDocument\/didOpen"/);
  assert.doesNotMatch(output, /"id":/);
});

test('rejects LSP requests that return JSON-RPC errors', async () => {
  const fake = createFakeProcess();
  const client = new LspClient({ process: fake.process, requestTimeoutMs: 100 });

  const pending = client.request('bad/request', {});
  fake.process.stdout.write(encodeLspMessage({
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32601, message: 'Method not found' },
  }));

  await assert.rejects(pending, /Method not found/);
});
