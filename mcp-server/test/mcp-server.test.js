import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

function readJsonLine(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline === -1) {
        return;
      }
      stream.off('data', onData);
      resolve(JSON.parse(buffer.slice(0, newline)));
    };
    stream.on('data', onData);
    stream.on('error', reject);
  });
}

function send(process, message) {
  process.stdin.write(`${JSON.stringify(message)}\n`);
}

test('MCP server exposes LuaLS bridge tools over stdio', async () => {
  const server = spawn(process.execPath, ['mcp-server/src/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  test.after(() => server.kill());

  send(server, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    },
  });
  const initialized = await readJsonLine(server.stdout);
  assert.equal(initialized.id, 1);
  assert.equal(initialized.result.serverInfo.name, 'lua-language-server-mcp');

  send(server, { jsonrpc: '2.0', method: 'notifications/initialized' });
  send(server, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await readJsonLine(server.stdout);
  const toolNames = tools.result.tools.map((tool) => tool.name).sort();

  assert.deepEqual(toolNames, [
    'luals_change_document',
    'luals_close_document',
    'luals_executable_info',
    'luals_initialize',
    'luals_notify',
    'luals_open_document',
    'luals_request',
    'luals_shutdown',
  ]);

  send(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'luals_executable_info',
      arguments: {},
    },
  });
  const executableInfo = await readJsonLine(server.stdout);
  const payload = JSON.parse(executableInfo.result.content[0].text);
  assert.equal(payload.selected.version, '3.18.2');
  assert.ok(payload.supportedRuntimes.includes('darwin-arm64'));
});
