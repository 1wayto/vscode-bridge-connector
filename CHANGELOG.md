# Changelog

All notable changes to the "VSCode Bridge Connector" extension will be documented in this file.

## [0.0.3] - 2025-11-15

### Added
- **Command Explorer**: New `Bridge Connector: Search VS Code Commands` command + menu item that fetches every registered command via `vscode.commands.getCommands(true)`, filters them, and copies the selected ID to the clipboard.
- **Embedded Main Panel Webview**: The main panel now opens inside VS Code using a reusable webview tab instead of launching an external browser.
- **Project Scaffolding Enhancements**: `Bridge Connector: Initiate Project` now copies `.vscode/mcp.json`, mirrors `templates/main-panel/`, and auto-starts `node main-panel/main-panel-server.js` with logs streamed to the "Bridge Main Panel" output channel.
- **Main Panel Template**: Added a welcome UI with a "Say hi" button that triggers `workbench.action.chat.open` via the bridge, plus default env values (`BRIDGE_PORT`, `MAIN_PANEL_PORT`, improved `MAIN_PANEL_URL`).

### Changed
- **Main Panel Server**: Static assets now live in `main-panel/public/`, `/config.json` re-reads `.env` on every request, and the default POST payload now includes `query`, `mode`, and `model` so Copilot Chat receives richer context.
- **Docs & Examples**: README/SETUP updated to highlight the command explorer, static panel workflow, and Node 18+ built-in `fetch` usage (with guidance for older runtimes). Unused runtime dependencies were removed from the extension package, and `npm test` now reports that automated tests are pending instead of failing.
- **QuickPick Menu**: Initiate Project entry is hidden once both `.env` and `package.json` exist to reduce clutter; menu always refreshes `.env`-driven panel settings before rendering.
- **Open Main Panel Action**: Both the QuickPick item and dedicated command now reuse the same webview helper for consistent behavior.

### Fixed
- **Command Validation**: `/command` returns `400 Bad Request` for malformed JSON or payload shapes instead of `500`, and message dialog helpers now forward every argument (buttons, modal options, etc.). Mixed or non-array `args` payloads are normalized automatically.
- **Command Consistency**: Main panel button now targets `workbench.action.chat.open`, matching the API example and ensuring chat opens reliably.


## [0.0.2] - 2025-07-24

### Added
- **Health Check Endpoint**: New `GET /health` endpoint for monitoring bridge status (no authentication required)
- **VSCode API Handlers**: Direct support for `vscode.window.showInformationMessage`, `showWarningMessage`, `showErrorMessage`, and `showOpenDialog`
- **Enhanced Request Validation**: Content-length validation with 10KB limit for security
- **CORS Support**: Cross-origin request handling for web applications
- **Comprehensive Error Responses**: All errors now return JSON with timestamps and detailed messages
- **Enhanced Example Script**: Complete rewrite with comprehensive testing, error handling, and dotenv integration

### Fixed
- **Critical Authentication Bug**: Fixed health endpoint requiring authentication when it should be public
- **Command Execution Order**: Proper handling of VSCode API calls vs regular commands
- **Request Routing**: Authentication check now happens after health endpoint check for proper access control
- **Environment Variable Loading**: Example script now uses `dotenv` for secure API key management

### Enhanced
- **Improved Logging**: Better request logging with user agent, timestamps, and detailed debugging information
- **Security**: Enhanced unauthorized access handling with proper JSON error responses and detailed logging
- **Example Script**: Completely rewritten with comprehensive examples including:
  - Health check testing (no authentication required)
  - VSCode API message dialogs
  - File operations and dialog handling
  - Error handling and validation tests
  - Proper environment variable usage with dotenv
- **Documentation**: Updated README with new API endpoints, enhanced examples, and improved troubleshooting

### Technical Improvements
- **Error Handling**: Server-level error handling for port conflicts, permission issues, and request timeouts
- **Response Format**: Consistent JSON responses across all endpoints with timestamps
- **Request Timeout**: Added timeout handling for long-running requests
- **Input Validation**: Better validation for empty requests, malformed JSON, and oversized payloads
- **API Architecture**: Separated VSCode API calls from command execution for better reliability

### Dependencies
- Added dotenv for environment variable loading in examples
- Extension itself remains dependency-free for optimal performance

## [0.0.1] - 2025-07-23

### Added
- Initial release of VSCode Bridge Connector
- Secure HTTP bridge for external VSCode communication
- Local `.env` file authentication
- Smart popup menu with start/stop, status, and settings
- Configurable port settings
- Status bar integration
- Command execution API endpoint

### Security
- Localhost-only connections (127.0.0.1)
- API key authentication required
- No system environment variable dependencies
