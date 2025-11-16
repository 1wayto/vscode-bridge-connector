# VSCode Bridge Connector 🔌🌉

A secure HTTP bridge extension that allows external applications to communicate with VSCode through a local API.

## Features
- 🔐 **Secure API**: Uses local `.env` file for authentication with localhost-only HTTP server
- 🧠 **Smart Menu**: Status-bar popup manages server state, project scaffolding, and quick navigation
- 🌐 **Embedded Main Panel**: Opens your localhost dashboard inside a VS Code webview tab with one click
- 🛠️ **Project Bootstrap**: Instantly scaffold `package.json`, `.env`, `.vscode/mcp.json`, and a runnable `main-panel/` Node server
- 🎯 **Command Execution**: Execute any VS Code command (plus special-case dialogs) remotely
- 📜 **Command Explorer**: Search every registered VS Code command ID directly from the bridge menu and copy matches to your clipboard

## Setup

1. Install the extension
2. Create a `.env` file in your workspace root with:
   ```
   VSCODE_API_KEY=your-secret-key-here
  BRIDGE_PORT=8282
   
   # Optional: Configure main panel
  MAIN_PANEL_URL=http://127.0.0.1:3000
   MAIN_PANEL_TITLE=Main Panel
  MAIN_PANEL_PORT=3000
   ```
3. Click the bridge status in the status bar to open the menu:
  - **🛠️ Initiate Project** – Scaffold `package.json`, `.env`, `.vscode/mcp.json`, and a `main-panel/` folder, then auto-start the Node server for the embedded panel
  - **▶️ Start/⏸️ Stop** – Control the bridge server
  - **🌐 Open Main Panel** – Open your configured panel URL inside a VS Code tab
  - **📜 Search VS Code Commands** – Prompt for a substring, list every matching command ID, and copy the selection to your clipboard
  - **📊 Status** – View current status and port
  - **⚙️ Settings** – Access extension configuration
4. The bridge runs on port 8282 (configurable)

## Configuration

Access settings via Command Palette: `Bridge Connector: Open Settings`

- `bridgeConnector.port`: Port number (default: 8282)
- `bridgeConnector.enable`: Auto-start on VSCode launch (default: false)

### Environment Variables (.env)

- `VSCODE_API_KEY`: Required API key for bridge authentication
- `BRIDGE_PORT`: Port used by the bridge HTTP server (`bridgeConnector.port`, default 8282)
- `MAIN_PANEL_URL`: (Optional) URL to open inside VS Code when clicking "Open Main Panel" (defaults to `http://127.0.0.1:3000` for the generated panel)
- `MAIN_PANEL_TITLE`: (Optional) Display name for the main panel menu item (default: "Main Panel")
- `MAIN_PANEL_PORT`: Port used by the generated Node main panel server (default 3000)

## Project Scaffolding

Need a ready-to-run client in the current workspace? Open the Bridge menu (status bar) and choose **🛠️ Initiate Project** or run the `Bridge Connector: Initiate Project` command. The extension will:

1. Prompt for a package name, then write `package.json` using `test-client-package.json` as the template (includes `node-fetch` + `dotenv`). Existing files are preserved unless you confirm an overwrite.
2. Copy `.env.example` from the extension folder into your workspace as `.env`, so you can immediately set `VSCODE_API_KEY` and optional panel settings.
3. Copy `templates/main-panel/` → `main-panel/` and automatically start `node main-panel/main-panel-server.js`. The server now serves static assets from `main-panel/public/` (HTML/CSS/JS) and exposes `/config.json`, which re-reads `.env` on every request so API keys and ports stay in sync. The default UI still ships with a "Say hi" button, but it now posts `{ query: "hi", mode: "I.D.E.A.S", model: "GPT-5 mini (copilot)" }` to `workbench.action.chat.open`, matching the payload we recommend for Copilot Chat integrations.
4. Copy `templates/vscode/mcp.json` → `.vscode/mcp.json` so MCP-compatible tools (like MarkItDown or Playwright MCP) are preconfigured for the workspace.

You can rerun the command at any time—overwrites require explicit confirmation.

### Main Panel Workflow

- Inspect logs via `View → Output → Bridge Main Panel`.
- Restart the panel server by re-running `Bridge Connector: Initiate Project` (existing files can be overwritten).
- The served UI lives at `MAIN_PANEL_URL` (defaults to `http://127.0.0.1:3000`) and is displayed inside VS Code via the **🌐 Open Main Panel** menu entry.
- Editing `.env` while the server runs? Just refresh the panel or reload `/config.json`—the server re-reads environment values for every request, so API keys and port tweaks take effect immediately.

### Command Explorer

- Launch via the status-bar menu (**📜 Search VS Code Commands**) or run `Bridge Connector: Search VS Code Commands` from the Command Palette.
- Provide any substring (for example `workbench.action.chat`) and the bridge will call `vscode.commands.getCommands(true)`, filter everything client-side, and show the matches in a QuickPick.
- Selecting an entry copies the full command ID to your clipboard so you can drop it directly into HTTP requests or scripts.

## API Endpoints

### Health Check (No Authentication Required)
```http
GET /health
```

Returns bridge status without requiring authentication:
```json
{
  "status": "healthy",
  "version": "0.0.3", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Execute Commands (Authentication Required)
```http
POST /command
```

Headers:
- `Content-Type: application/json`  
- `x-vscode-key: your-api-key`

Body:
```json
{
  "command": "vscode.window.showInformationMessage",
  "args": ["Hello World!"]
}
```

## Usage

### Enhanced Example Script (`example-usage.js`)

```javascript
// VSCode Bridge Connector - Enhanced Example Usage
// Make sure your .env file contains: VSCODE_API_KEY=your-secret-key

const http = require('http');
require('dotenv').config();

const API_KEY = process.env.VSCODE_API_KEY;
const PORT = 8282; // Default port, adjust if changed in settings

// Helper function to make HTTP requests (using built-in http module)
function makeRequest(method, path, data = null, requiresAuth = true) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add authentication header for protected endpoints
    if (requiresAuth) {
      options.headers['x-vscode-key'] = API_KEY;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || parsed.error}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Health check example (no authentication required)
async function healthCheck() {
  console.log('🔍 Checking bridge health...');
  try {
    const result = await makeRequest('GET', '/health', null, false);
    console.log('✅ Bridge is healthy:', result);
    return result;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

// Show message examples
async function showMessage() {
  console.log('📢 Showing information message...');
  const result = await makeRequest('POST', '/command', {
    command: 'vscode.window.showInformationMessage',
    args: ['Hello from Bridge Connector! 🎉']
  });
  console.log('✅ Message shown:', result);
}

// File operations
async function openFile() {
  console.log('📂 Opening file dialog...');
  const result = await makeRequest('POST', '/command', {
    command: 'vscode.window.showOpenDialog',
    args: [{
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Text files': ['txt'],
        'All files': ['*']
      }
    }]
  });
  console.log('✅ File dialog result:', result);
}

// Main execution with comprehensive testing
async function main() {
  console.log('🚀 VSCode Bridge Connector - Enhanced Example Usage\n');
  
  try {
    // Health check (no auth required)
    await healthCheck();
    console.log('');
    
    // Test VSCode API calls
    await showMessage();
    console.log('');
    
    await openFile();
    console.log('');
    
    console.log('🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('💥 Example execution failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Make sure VSCode Bridge Connector extension is running');
    console.log('- Check that the API key matches your .env file');
    console.log('- Verify the port number (default: 8282)');
    console.log('- Ensure the bridge is enabled in VSCode settings');
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}
```

### From External Applications

```javascript
// Example external usage (CommonJS - works with Node 18+ where fetch is built-in)
// Install dotenv if you want to read secrets from a .env file: npm install dotenv
require('dotenv').config();

const secret = process.env.VSCODE_API_KEY;

(async () => {
  const res = await fetch('http://127.0.0.1:8282/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vscode-key': secret
    },
    body: JSON.stringify({
      command: 'workbench.action.chat.open',
      args: ['Hello, can you help me with my code?']
    })
  });

  if (res.ok) {
    const payload = await res.json();
    console.log('✅ Command executed:', payload);
  } else {
    console.error('❌ Failed:', await res.text());
  }
})();
```

> 💡 On Node.js versions earlier than 18, install a fetch polyfill such as `node-fetch@2` and replace the global `fetch` call with `const fetch = require('node-fetch');`.

## Security

- Bridge only accepts connections from localhost (127.0.0.1)
- All requests must include the correct API key in the `x-vscode-key` header
- No API key = no access 🔐

## Commands

- `Bridge Connector: Show Menu` - Open the Bridge Connector popup menu
- `Bridge Connector: Toggle` - Start/stop the bridge directly
- `Bridge Connector: Initiate Project` - Scaffold `package.json`, `.env`, `.vscode/mcp.json`, and `main-panel/` (auto-starts the local panel server)
- `Bridge Connector: Open Main Panel` - Render the configured main panel URL inside a VS Code tab
- `Bridge Connector: Search VS Code Commands` - Prompt for a substring, list all matching command IDs, copy the selection to your clipboard
- `Bridge Connector: Open Settings` - Open extension settings

## 🆕 What's New in v0.0.3

- 📜 **Command Explorer**: Added `Bridge Connector: Search VS Code Commands` so you can discover/copy any command ID directly from the bridge menu.
- 🌐 **Embedded Main Panel**: Opens configured localhost dashboards inside VS Code via `vscode.window.createWebviewPanel` instead of launching an external browser.
- 🛠️ **Initiate Project Upgrade**: QuickPick entry is hidden once `package.json` + `.env` exist, and the command now copies `.vscode/mcp.json`, `main-panel/`, and automatically launches `node main-panel/main-panel-server.js` with log streaming to the "Bridge Main Panel" output channel.
- 🧱 **Template Refresh**: Main panel server now serves static assets from `main-panel/public/`, refreshes `/config.json` on each request, and ships a Copilot-ready "Say hi" workflow you can customize.
- 📝 **Documentation & ENV Updates**: `.env.example` now includes `BRIDGE_PORT`, `MAIN_PANEL_PORT`, and better defaults for `MAIN_PANEL_URL`.

## 🆕 What's New in v0.0.2

- ✅ **Health Check Endpoint**: New `GET /health` endpoint for monitoring (no auth required)
- ✅ **VSCode API Support**: Direct handlers for message dialogs and file operations
- ✅ **Enhanced Error Handling**: Better error messages with JSON responses and timestamps  
- ✅ **Request Validation**: Input validation and 10KB request size limits
- ✅ **CORS Support**: Cross-origin request handling for web applications
- ✅ **Improved Logging**: Better request logging with user agent and detailed timestamps
- ✅ **Authentication Bug Fix**: Health endpoint now works without API key as intended
- ✅ **Environment Variables**: Example script now uses `dotenv` for better API key management
- ✅ **Security Enhancements**: Better unauthorized access handling and error responses

## Files in This Package

- `example-usage.js` - Working CommonJS example script
- `test-client-package.json` - Quick test setup configuration
- `.env.example` - Environment variable template
- `templates/main-panel/` - Node static server plus `public/` (HTML/CSS/JS) welcome experience copied by Initiate Project
- `templates/vscode/mcp.json` - Default MCP configuration copied into `.vscode/mcp.json`
- `icon.png` - Extension icon (128x128)

## Author

Created by **Eric Lee** (hello@1wayto.com)

## License

MIT
