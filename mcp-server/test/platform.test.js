import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLuaLsExecutable,
  normalizePlatformArch,
  supportedRuntimeKeys,
} from '../src/platform.js';

test('normalizes Node platform and arch to bundled LuaLS release keys', () => {
  assert.equal(normalizePlatformArch('darwin', 'arm64'), 'darwin-arm64');
  assert.equal(normalizePlatformArch('darwin', 'x64'), 'darwin-x64');
  assert.equal(normalizePlatformArch('linux', 'arm64'), 'linux-arm64');
  assert.equal(normalizePlatformArch('linux', 'x64'), 'linux-x64');
  assert.equal(normalizePlatformArch('win32', 'x64'), 'win32-x64');
  assert.equal(normalizePlatformArch('win32', 'ia32'), 'win32-ia32');
});

test('reports all bundled platform keys', () => {
  assert.deepEqual(supportedRuntimeKeys(), [
    'darwin-arm64',
    'darwin-x64',
    'linux-arm64',
    'linux-x64',
    'win32-ia32',
    'win32-x64',
  ]);
});

test('returns executable path and cwd for the selected platform', () => {
  const info = getLuaLsExecutable({ platform: 'win32', arch: 'x64' });

  assert.equal(info.version, '3.18.2');
  assert.equal(info.runtimeKey, 'win32-x64');
  assert.match(info.executable, /vendor[/\\]luals[/\\]3\.18\.2[/\\]win32-x64[/\\]bin[/\\]lua-language-server\.exe$/);
  assert.match(info.cwd, /vendor[/\\]luals[/\\]3\.18\.2[/\\]win32-x64$/);
});

test('throws a useful error for unsupported platforms', () => {
  assert.throws(
    () => normalizePlatformArch('freebsd', 'x64'),
    /Unsupported LuaLS runtime freebsd-x64/,
  );
});
