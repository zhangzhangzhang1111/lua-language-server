import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LUALS_VERSION = '3.18.2';

const SUPPORTED_RUNTIMES = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-ia32',
  'win32-x64',
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

export function supportedRuntimeKeys() {
  return [...SUPPORTED_RUNTIMES].sort();
}

export function normalizePlatformArch(platform = process.platform, arch = process.arch) {
  const runtimeKey = `${platform}-${arch}`;
  if (!SUPPORTED_RUNTIMES.has(runtimeKey)) {
    throw new Error(
      `Unsupported LuaLS runtime ${runtimeKey}. Supported runtimes: ${supportedRuntimeKeys().join(', ')}`,
    );
  }
  return runtimeKey;
}

export function getLuaLsExecutable(options = {}) {
  const runtimeKey = normalizePlatformArch(options.platform ?? process.platform, options.arch ?? process.arch);
  const vendorRoot = options.vendorRoot ?? path.join(REPO_ROOT, 'vendor', 'luals');
  const cwd = path.join(vendorRoot, LUALS_VERSION, runtimeKey);
  const executableName = runtimeKey.startsWith('win32-') ? 'lua-language-server.exe' : 'lua-language-server';
  const executable = path.join(cwd, 'bin', executableName);

  if (options.mustExist !== false && !fs.existsSync(executable)) {
    throw new Error(`LuaLS executable not found for ${runtimeKey}: ${executable}`);
  }

  return {
    version: LUALS_VERSION,
    runtimeKey,
    cwd,
    executable,
  };
}
