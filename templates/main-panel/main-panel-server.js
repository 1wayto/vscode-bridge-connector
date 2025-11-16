const http = require('http');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, 'public');

function readEnv(workspaceRoot) {
  const envPath = path.join(workspaceRoot, '.env');
  const result = {};

  if (!fs.existsSync(envPath)) {
    return result;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  }

  return result;
}

function startServer() {
  const workspaceRoot = path.join(__dirname, '..');
  const initialConfig = buildConfig(workspaceRoot);
  const port = initialConfig.mainPanelPort;

  if (!initialConfig.apiKey) {
    console.warn('[Bridge Main Panel] VSCODE_API_KEY missing in .env. Button actions will fail.');
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/config.json') {
      const configPayload = JSON.stringify(buildConfig(workspaceRoot));
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
      res.end(configPayload);
      return;
    }

    if (req.method === 'GET') {
      const safePath = sanitizePath(req.url || '/');
      const filePath = resolveFilePath(safePath);
      if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          const status = err.code === 'ENOENT' ? 404 : 500;
          res.writeHead(status, { 'Content-Type': 'text/plain' });
          res.end(status === 404 ? 'Not Found' : 'Server Error');
          return;
        }

        res.writeHead(200, {
          'Content-Type': getContentType(filePath),
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Bridge Main Panel] Listening on http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    console.error('[Bridge Main Panel] Server error:', err);
  });
}

startServer();

function buildConfig(workspaceRoot) {
  const env = readEnv(workspaceRoot);
  const bridgePort = Number(env.BRIDGE_PORT || env.BRIDGE_CONNECTOR_PORT || 8282) || 8282;
  const mainPanelPort = Number(env.MAIN_PANEL_PORT || 3000) || 3000;
  return {
    title: env.MAIN_PANEL_TITLE || 'Main Panel',
    bridgePort,
    bridgeHost: env.BRIDGE_HOST || '127.0.0.1',
    bridgeProtocol: env.BRIDGE_PROTOCOL || 'http',
    apiKey: env.VSCODE_API_KEY || '',
    mainPanelPort
  };
}

function sanitizePath(requestUrl) {
  try {
    const parsedUrl = new URL(requestUrl, 'http://localhost');
    return decodeURIComponent(parsedUrl.pathname);
  } catch (error) {
    return '/';
  }
}

function resolveFilePath(requestPath) {
  const normalized = requestPath === '/' ? '/index.html' : requestPath;
  const candidate = path.join(PUBLIC_DIR, normalized);
  if (!candidate.startsWith(PUBLIC_DIR)) {
    return null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return path.join(candidate, 'index.html');
  }
  return candidate;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
