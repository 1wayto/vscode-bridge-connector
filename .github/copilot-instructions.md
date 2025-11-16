# VSCode Bridge Connector – AI Agent Guide

## Architecture Snapshot
- Core logic lives in `src/extension.ts`: a singleton HTTP server (`startServer`/`stopServer`) plus a status-bar driven UX (`bridgeConnector.showMenu`, `updateStatus`).
- The bridge reads `VSCODE_API_KEY`, `MAIN_PANEL_URL`, and `MAIN_PANEL_TITLE` from the first workspace folder's `.env`; no dotenv is used inside the extension, so keep the manual fs-based parsing consistent.
- Requests hit `/health` (no auth) or `/command` (API key required). `/command` dispatches either directly to high-touch VS Code UI helpers (`showInformationMessage`, `showOpenDialog`, etc.) or falls back to `vscode.commands.executeCommand`.
- Security hardening already in place (localhost bind, 10KB payload cap, JSON errors with timestamps, verbose logging). Preserve these checks when adding endpoints.
- Main panel feature: optional `.env` config allows QuickPick menu to open a localhost URL inside a VS Code webview tab via `vscode.window.createWebviewPanel`.
- Project scaffolding: `bridgeConnector.initiateProject` uses `test-client-package.json`, `.env.example`, and `templates/main-panel/` to bootstrap client workspaces, prompting before overwriting existing files, then launches `node main-panel/main-panel-server.js` as the in-editor panel backend.
- Command aliases: `workbench.actions.chat.openChat` / `workbench.action.chat.openChat` are normalized to `workbench.action.chat.open` so older clients remain compatible—extend `normalizeCommand` for future aliases instead of duplicating logic.

## Key Files & Roles
- `src/extension.ts`: activation lifecycle, internal command registrations, HTTP routing, error handling, and main panel integration.
- `README.md` + `SETUP.md`: authoritative on API usage, expected .env contents (including optional `MAIN_PANEL_URL`/`MAIN_PANEL_TITLE`), and developer workflows; keep them synchronized when behavior changes.
- `example-usage.js` and `test-client-package.json`: runnable Node scripts that exercise the API surface; update these whenever endpoints or request shapes change.
- `.env.example`, `templates/main-panel/*`, and `templates/vscode/mcp.json`: template sources for Initiate Project—update in tandem with any new config, UI tweaks, or MCP defaults.

## Dev Workflow
- Install deps once (`npm install`), then iterate with `npm run watch` for TypeScript rebuilds; `npm run build` snapshots output for publishing.
- Press `F5` to launch the Extension Development Host; start/stop the bridge via the status bar menu (`Bridge: Stopped/Running`).
- Use `node example-usage.js` (from repo root) to sanity-check the HTTP surface while the bridge is running. The script expects `.env` with `VSCODE_API_KEY` in the same folder.
- `npm test` is wired to `./out/test/runTest.js`, but no tests ship yet; either add that harness or avoid invoking the script.
- To bootstrap client folders, run `Bridge Connector: Initiate Project` (or the status-bar menu entry). It copies `.env.example` → `.env`, clones `test-client-package.json` → workspace `package.json`, mirrors `templates/main-panel/` → `main-panel/`, copies `templates/vscode/mcp.json` → `.vscode/mcp.json`, prompts before overwrites, and starts the local main panel Node server (restart by re-running the command).

## Coding Patterns & Conventions
- Stick to the existing Node `http` server (no Express/Koa). Add middleware-style logic by extending the current request handler instead of swapping frameworks.
- Keep responses JSON-formatted with `{ success?, error?, message, timestamp }` to match the example clients and README docs.
- When introducing new commands, prefer explicit branches (like current `showInformationMessage` handler) for VS Code APIs that are not standard commands.
- All UX feedback goes through VS Code notifications or the status bar; avoid raw console-only signaling for user-facing events.
- Configuration values come from `vscode.workspace.getConfiguration('bridgeConnector')`. Read once per action so live setting tweaks take effect without reloads.

## Testing & Debugging Tips
- Reproduce auth issues by toggling `.env` or removing `x-vscode-key`; the server already logs invalid attempts—reuse the logging style (`[timestamp] ...`).
- For port conflicts or permission errors, rely on the existing `server.on('error')` branch; extend it instead of spinning up multiple servers.
- When adding endpoints, update the QuickPick status text or README "API Endpoints" section so users discover the new surface area promptly.

Let the maintainers know if any part of this guide is unclear or if additional workflows should be documented.
