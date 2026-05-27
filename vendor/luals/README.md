# Bundled LuaLS releases

This directory contains prebuilt release artifacts from
[`LuaLS/lua-language-server`](https://github.com/LuaLS/lua-language-server).

Bundled version: `3.18.2`

The Node.js MCP service selects one of these runtime directories at startup:

- `3.18.2/darwin-arm64`
- `3.18.2/darwin-x64`
- `3.18.2/linux-arm64`
- `3.18.2/linux-x64`
- `3.18.2/win32-ia32`
- `3.18.2/win32-x64`

Temporary downloaded archives are intentionally ignored under
`vendor/luals/downloads/`; only extracted runtime artifacts are needed to run
the service.
