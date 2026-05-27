import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LspMessageFramer, encodeLspMessage } from './lsp-framing.js';
import { getLuaLsExecutable } from './platform.js';

export class LspClient {
  #process;
  #framer = new LspMessageFramer();
  #nextId = 1;
  #pending = new Map();
  #requestTimeoutMs;
  #stderrLines = [];

  constructor(options = {}) {
    this.#process = options.process ?? spawnLuaLs(options);
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 30_000;

    this.#framer.onMessage((message) => this.#handleMessage(message));
    this.#process.stdout.on('data', (chunk) => this.#framer.push(chunk));
    this.#process.stderr.on('data', (chunk) => {
      this.#stderrLines.push(chunk.toString('utf8'));
      if (this.#stderrLines.length > 100) {
        this.#stderrLines.shift();
      }
    });
    this.#process.on?.('exit', (code, signal) => {
      const error = new Error(`LuaLS process exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.#pending.clear();
    });
  }

  request(method, params = null, options = {}) {
    const id = this.#nextId++;
    const timeoutMs = options.timeoutMs ?? this.#requestTimeoutMs;
    const message = { jsonrpc: '2.0', id, method };
    if (params !== null && params !== undefined) {
      message.params = params;
    }

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`LuaLS request timed out after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this.#pending.set(id, { method, resolve, reject, timer });
    });

    this.#write(message);
    return promise;
  }

  notify(method, params = null) {
    const message = { jsonrpc: '2.0', method };
    if (params !== null && params !== undefined) {
      message.params = params;
    }
    this.#write(message);
  }

  close() {
    this.#process.kill?.();
  }

  stderrTail() {
    return this.#stderrLines.join('');
  }

  #write(message) {
    this.#process.stdin.write(encodeLspMessage(message));
  }

  #handleMessage(message) {
    if (!Object.hasOwn(message, 'id')) {
      return;
    }

    const pending = this.#pending.get(message.id);
    if (!pending) {
      return;
    }
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);

    if (message.error) {
      const error = new Error(message.error.message ?? `LuaLS request failed: ${pending.method}`);
      error.code = message.error.code;
      error.data = message.error.data;
      pending.reject(error);
      return;
    }

    pending.resolve(message.result);
  }
}

export function spawnLuaLs(options = {}) {
  const executableInfo = options.executableInfo ?? getLuaLsExecutable(options);
  const logPath = options.logPath ?? path.join(os.tmpdir(), 'luals-mcp-logs');
  fs.mkdirSync(logPath, { recursive: true });

  return spawn(executableInfo.executable, [`--logpath=${logPath}`], {
    cwd: executableInfo.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
