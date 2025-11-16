# VSCode Bridge Connector - Setup Instructions

## 🚀 Quick Start

1. **Create .env File**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and set your API key
   VSCODE_API_KEY=your-secret-key-here
   ```

2. **Build the Extension**
   ```shell
   # Install dependencies
   npm install
   npm run build
   ```

3. **Test the Extension**
   - Press `F5` in VSCode to launch Extension Development Host
   - Look for "Bridge: Stopped" in the bottom-right status bar
   - Click it to open the popup menu and start the bridge
   - Optional: pick **🛠️ Initiate Project** to scaffold `package.json` + `.env`, copy `main-panel/`, push `.vscode/mcp.json`, and auto-start the Node server powering the main panel
   - The generated `main-panel` server now serves static assets from `main-panel/public/` and refreshes `/config.json` on each request, so `.env` tweaks (API key, ports) take effect immediately.
   - Curious about which VS Code commands you can call? Choose **📜 Search VS Code Commands** (or run the same command from the palette) to filter them interactively and copy the IDs.

4. **Test External API**
   ```powershell
   # The example script now uses CommonJS (require) for better Node.js compatibility
   node example-usage.js
   ```

## 🧪 **Alternative Test Setup**

For testing in a separate project directory:

1. **Quick test setup**:
   ```bash
   mkdir bridge-test && cd bridge-test
   cp ../test-client-package.json package.json
   npm install
   echo "VSCODE_API_KEY=your-secret-key-here" > .env
   cp ../example-usage.js test.js
   node test.js
   ```

## 📁 Project Structure

```
vscode-bridge-connector/
├── src/
│   └── extension.ts          # Main extension code
├── out/                      # Compiled JavaScript
├── .vscode/                  # VSCode configuration
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript config
├── README.md                # Documentation
├── example-usage.js         # Working CommonJS example
├── test-client-package.json # Test setup helper
├── .env.example             # Environment template
├── .vscodeignore            # Package exclusions
└── SETUP.md                 # This file
```

## 🔧 **New in v0.0.3:**
- 🌐 Embedded Main Panel webview plus auto-started local Node server when running Initiate Project
- 🛠️ Initiate Project now copies `.vscode/mcp.json`, `main-panel/`, and restarts the panel server with log streaming
- 🧾 `.env.example` expanded with `BRIDGE_PORT`, `MAIN_PANEL_PORT`, and updated defaults for panel URLs
- 🧹 Menu hides Initiate Project once `.env` + `package.json` exist, reducing clutter

_See `CHANGELOG.md` for previous releases._

## 🔧 Configuration

Access via Command Palette → "Preferences: Open Settings (UI)" → Search "Bridge Connector"

- **Port**: Change the HTTP server port (default: 8282)
- **Enable**: Auto-start bridge when VSCode opens

## 📜 Command Explorer

- Launch via the status-bar menu entry **📜 Search VS Code Commands** or via Command Palette → `Bridge Connector: Search VS Code Commands`.
- Enter any substring (for example `workbench.action.chat`) and the extension will call `vscode.commands.getCommands(true)` and filter the results locally.
- Pick a command from the QuickPick list to copy the ID to your clipboard—handy for crafting `/command` payloads or spotting the exact identifier exposed by another extension.

## 🧪 Testing Commands

Try these VSCode commands through the API:

```javascript
// Insert a new line
{ command: "editor.action.insertLineAfter" }

// Show command palette
{ command: "workbench.action.showCommands" }

// Open settings
{ command: "workbench.action.openSettings" }

// Format document
{ command: "editor.action.formatDocument" }

// Scaffold project assets from templates
{ command: "bridgeConnector.initiateProject" }
```

To restart the generated main panel server manually:

```shell
npm run panel
```

## 📦 Publishing

When ready to publish:

1. Install vsce: `npm install -g vsce`
2. Package: `vsce package`
3. Publish: `vsce publish`

## 🛠️ Development

- `npm run watch` - Watch mode for development
- `F5` - Launch Extension Development Host
- `Ctrl+Shift+P` → "Developer: Reload Window" to reload changes

Created by Eric Lee (hello@1wayto.com) 🚀
