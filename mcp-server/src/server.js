#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { LspClient } from './lsp-client.js';
import { getLuaLsExecutable, supportedRuntimeKeys } from './platform.js';

let client;

function getClient() {
  if (!client) {
    client = new LspClient();
  }
  return client;
}

function jsonContent(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function registerTools(server) {
  server.registerTool(
    'luals_executable_info',
    {
      title: 'LuaLS executable information',
      description: 'Return the bundled LuaLS version, supported runtimes, and executable selected for this Node.js platform.',
      inputSchema: {},
    },
    async () => jsonContent({
      selected: getLuaLsExecutable(),
      supportedRuntimes: supportedRuntimeKeys(),
    }),
  );

  server.registerTool(
    'luals_initialize',
    {
      title: 'Initialize LuaLS',
      description: 'Initialize the Lua language server for a workspace and send the required initialized notification.',
      inputSchema: {
        rootUri: z.string().optional(),
        processId: z.number().int().nullable().optional(),
        capabilities: z.record(z.string(), z.unknown()).optional(),
        initializationOptions: z.record(z.string(), z.unknown()).optional(),
        workspaceFolders: z.array(z.object({
          uri: z.string(),
          name: z.string(),
        })).nullable().optional(),
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      const result = await getClient().request('initialize', {
        processId: args.processId ?? process.pid,
        rootUri: args.rootUri ?? null,
        capabilities: args.capabilities ?? {},
        initializationOptions: args.initializationOptions ?? {},
        workspaceFolders: args.workspaceFolders ?? null,
      }, { timeoutMs: args.timeoutMs });
      getClient().notify('initialized', {});
      return jsonContent(result);
    },
  );

  server.registerTool(
    'luals_request',
    {
      title: 'Send LuaLS LSP request',
      description: 'Send any JSON-RPC request method to LuaLS. This exposes the full LuaLS LSP feature surface.',
      inputSchema: {
        method: z.string().min(1),
        params: z.unknown().optional(),
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      const result = await getClient().request(args.method, args.params, { timeoutMs: args.timeoutMs });
      return jsonContent(result ?? null);
    },
  );

  server.registerTool(
    'luals_notify',
    {
      title: 'Send LuaLS LSP notification',
      description: 'Send any JSON-RPC notification method to LuaLS, such as textDocument/didOpen or workspace/didChangeConfiguration.',
      inputSchema: {
        method: z.string().min(1),
        params: z.unknown().optional(),
      },
    },
    async (args) => {
      getClient().notify(args.method, args.params);
      return jsonContent({ ok: true });
    },
  );

  server.registerTool(
    'luals_open_document',
    {
      title: 'Open Lua document',
      description: 'Send textDocument/didOpen to LuaLS.',
      inputSchema: {
        uri: z.string(),
        text: z.string(),
        languageId: z.string().default('lua'),
        version: z.number().int().default(1),
      },
    },
    async (args) => {
      getClient().notify('textDocument/didOpen', {
        textDocument: {
          uri: args.uri,
          languageId: args.languageId,
          version: args.version,
          text: args.text,
        },
      });
      return jsonContent({ ok: true });
    },
  );

  server.registerTool(
    'luals_change_document',
    {
      title: 'Change Lua document',
      description: 'Send a full-text textDocument/didChange notification to LuaLS.',
      inputSchema: {
        uri: z.string(),
        text: z.string(),
        version: z.number().int(),
      },
    },
    async (args) => {
      getClient().notify('textDocument/didChange', {
        textDocument: {
          uri: args.uri,
          version: args.version,
        },
        contentChanges: [{ text: args.text }],
      });
      return jsonContent({ ok: true });
    },
  );

  server.registerTool(
    'luals_close_document',
    {
      title: 'Close Lua document',
      description: 'Send textDocument/didClose to LuaLS.',
      inputSchema: {
        uri: z.string(),
      },
    },
    async (args) => {
      getClient().notify('textDocument/didClose', {
        textDocument: {
          uri: args.uri,
        },
      });
      return jsonContent({ ok: true });
    },
  );

  server.registerTool(
    'luals_shutdown',
    {
      title: 'Shutdown LuaLS',
      description: 'Send shutdown and exit to LuaLS, then stop the child process.',
      inputSchema: {
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      if (!client) {
        return jsonContent({ ok: true, alreadyStopped: true });
      }
      await client.request('shutdown', null, { timeoutMs: args.timeoutMs });
      client.notify('exit');
      client.close();
      client = undefined;
      return jsonContent({ ok: true });
    },
  );
}

export async function main() {
  const server = new McpServer({
    name: 'lua-language-server-mcp',
    version: '0.1.0',
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on('SIGINT', () => {
  client?.close();
  process.exit(130);
});

process.on('SIGTERM', () => {
  client?.close();
  process.exit(143);
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
