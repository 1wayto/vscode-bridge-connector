# VSCode Bridge Connector 🔌🌉

A secure HTTP bridge extension that allows external applications to communicate with VSCode through a local API.

## Features

- 🔐 **Secure API**: Uses local `.env` file for authentication
- � **Smart Menu**: Click status bar for a popup menu with options
- ⚙️ **Configurable**: Customize port and startup settings
- 🎯 **Command Execution**: Execute any VSCode command remotely

## Setup

1. Install the extension
2. Create a `.env` file in your workspace root with:
   ```
   VSCODE_API_KEY=your-secret-key-here
   ```
3. Click the bridge status in the status bar to open the menu:
   - **▶️ Start/⏸️ Stop** - Control the bridge server
   - **📊 Status** - View current status and port
   - **⚙️ Settings** - Access extension configuration
4. The bridge runs on port 8282 (configurable)

## Configuration

Access settings via Command Palette: `Bridge Connector: Open Settings`

- `bridgeConnector.port`: Port number (default: 8282)
- `bridgeConnector.enable`: Auto-start on VSCode launch (default: false)

## Usage

### From External Applications

```javascript
// Example external usage (CommonJS - works with Node.js)
// First install: npm install node-fetch@2.7.0 dotenv
const fetch = require('node-fetch');
require('dotenv').config();

const secret = process.env.VSCODE_API_KEY;

(async () => {
  const res = await fetch('http://localhost:8282/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vscode-key': secret
    },
    body: JSON.stringify({
      command: 'workbench.action.chat.open',
      args: ["Hello, can you help me with my code?"]    
    })
  });

  if (res.ok) {
    const { result } = await res.json();
    console.log('✅ Command executed:', result);
  } else {
    console.error('❌ Failed:', await res.text());
  }
})();
```

## Security

- Bridge only accepts connections from localhost (127.0.0.1)
- All requests must include the correct API key in the `x-vscode-key` header
- No API key = no access 🔐

## Commands

- `Bridge Connector: Show Menu` - Open the Bridge Connector popup menu
- `Bridge Connector: Toggle` - Start/stop the bridge directly
- `Bridge Connector: Open Settings` - Open extension settings

## 🆕 What's New in v0.0.2

- ✅ **Fixed CommonJS Issues**: Example scripts now use proper `require()` syntax
- ✅ **Better Node.js Compatibility**: No more module type warnings
- ✅ **Easier Testing**: Added `test-client-package.json` for quick setup
- ✅ **Cleaner Codebase**: Removed unnecessary files, optimized structure
- ✅ **Improved Documentation**: Better setup and testing instructions

## Files in This Package

- `example-usage.js` - Working CommonJS example script
- `test-client-package.json` - Quick test setup configuration
- `.env.example` - Environment variable template
- `icon.png` - Extension icon (128x128)

## Author

Created by **Eric Lee** (hello@1wayto.com)

## License

MIT
