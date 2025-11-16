import * as vscode from 'vscode';
import * as http from 'http';
import { readEnvValues } from '../utils/env';
import { normalizeCommand } from '../utils/commandAliases';
import type { PanelConfig } from '../panel/mainPanelManager';

interface BridgeServerOptions {
  workspacePathProvider: () => string | undefined;
  onPanelConfigChange?: (config: PanelConfig) => void;
  onStatusChange?: (running: boolean) => void;
}

export class BridgeServer {
  private server: http.Server | null = null;
  private secret: string | undefined;

  constructor(private readonly options: BridgeServerOptions) {}

  isRunning() {
    return this.server !== null;
  }

  async start() {
    if (this.server) {
      vscode.window.showInformationMessage('ℹ️ Bridge Connector is already running.');
      return;
    }

    const workspacePath = this.options.workspacePathProvider();
    if (!workspacePath) {
      vscode.window.showErrorMessage('🚫 No workspace folder found - cannot locate .env file.');
      return;
    }

    let envValues;
    try {
      envValues = readEnvValues(workspacePath);
    } catch (error) {
      vscode.window.showErrorMessage(`🔑 Error reading .env file: ${error}`);
      return;
    }

    this.secret = envValues.apiKey;
    if (!this.secret) {
      vscode.window.showErrorMessage('🔑 VSCODE_API_KEY not found in .env file—cannot start bridge. Create a .env file with VSCODE_API_KEY=your-key');
      return;
    }

    this.options.onPanelConfigChange?.({
      url: envValues.panelUrl,
      title: envValues.panelTitle
    });

    const cfg = vscode.workspace.getConfiguration('bridgeConnector');
    const port = cfg.get<number>('port', envValues.bridgePort || 8282);

    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    this.server.listen(port, '127.0.0.1', () => {
      this.options.onStatusChange?.(true);
      console.log(`[${new Date().toISOString()}] Bridge Connector started on port ${port}`);
      vscode.window.showInformationMessage(`🔌 Bridge Connector running on port ${port}`);
    });

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      console.error(`[${new Date().toISOString()}] Server error:`, err);
      if (err.code === 'EADDRINUSE') {
        vscode.window.showErrorMessage('🚫 Port is already in use. Try a different port in settings.');
      } else if (err.code === 'EACCES') {
        vscode.window.showErrorMessage('🚫 Permission denied on selected port. Try a port above 1024.');
      } else {
        vscode.window.showErrorMessage(`🚫 Server error: ${err.message}`);
      }
      this.stop();
    });

    this.server.on('close', () => {
      console.log(`[${new Date().toISOString()}] Bridge Connector server closed`);
      this.options.onStatusChange?.(false);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.options.onStatusChange?.(false);
      vscode.window.showInformationMessage('🛑 Bridge Connector stopped');
    }
  }

  dispose() {
    this.stop();
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const timestamp = new Date().toISOString();
    const userAgent = req.headers['user-agent'] || 'Unknown';
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${userAgent} from ${req.socket.remoteAddress}`);

    if (req.method === 'POST') {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > 10000) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Request too large',
          message: 'Request body exceeds 10KB limit',
          timestamp
        }));
        return;
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vscode-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        version: '0.0.3',
        timestamp,
        uptime: Math.floor(process.uptime())
      }));
      return;
    }

    if (!this.isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
        timestamp
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/command') {
      this.handleCommandRequest(req, res, timestamp);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      timestamp,
      availableRoutes: [
        'GET /health - Health check (no auth required)',
        'POST /command - Execute VSCode command (requires x-vscode-key header)'
      ]
    }));
  }

  private isAuthorized(req: http.IncomingMessage) {
    const key = req.headers['x-vscode-key'];
    const provided = Array.isArray(key) ? key[0] : key;
    return provided === this.secret;
  }

  private handleCommandRequest(req: http.IncomingMessage, res: http.ServerResponse, timestamp: string) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        if (!body.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Bad Request',
            message: 'Empty request body',
            timestamp
          }));
          return;
        }

          let payload: unknown;
          try {
            payload = JSON.parse(body);
          } catch (parseError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Bad Request',
              message: 'Request body must be valid JSON',
              timestamp
            }));
            return;
          }

          if (!payload || typeof payload !== 'object') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Bad Request',
              message: 'Request payload must be an object',
              timestamp
            }));
            return;
          }

          const { command, args } = payload as { command?: unknown; args?: unknown };
          if (typeof command !== 'string' || !command.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Bad Request',
              message: 'Missing or invalid command field',
              timestamp
            }));
            return;
          }

        const normalizedCommand = normalizeCommand(command);
        if (normalizedCommand !== command) {
          console.log(`[${timestamp}] Normalized command '${command}' → '${normalizedCommand}'`);
        }

        const safeArgs = Array.isArray(args) ? args : args === undefined ? [] : [args];

        console.log(`[${timestamp}] Executing command: ${normalizedCommand} with args:`, safeArgs);

        if (normalizedCommand === 'vscode.window.showInformationMessage') {
          const [message, ...rest] = safeArgs;
          const messageText = message === undefined ? 'Message' : String(message);
          const result = await vscode.window.showInformationMessage(messageText, ...rest);
          return this.success(res, normalizedCommand, result, timestamp);
        }

        if (normalizedCommand === 'vscode.window.showWarningMessage') {
          const [message, ...rest] = safeArgs;
          const messageText = message === undefined ? 'Warning' : String(message);
          const result = await vscode.window.showWarningMessage(messageText, ...rest);
          return this.success(res, normalizedCommand, result, timestamp);
        }

        if (normalizedCommand === 'vscode.window.showErrorMessage') {
          const [message, ...rest] = safeArgs;
          const messageText = message === undefined ? 'Error' : String(message);
          const result = await vscode.window.showErrorMessage(messageText, ...rest);
          return this.success(res, normalizedCommand, result, timestamp);
        }

        if (normalizedCommand === 'vscode.window.showOpenDialog') {
          const dialogOptions = safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {};
          const result = await vscode.window.showOpenDialog(dialogOptions);
          return this.success(res, normalizedCommand, result, timestamp);
        }

        const result = await vscode.commands.executeCommand(normalizedCommand, ...safeArgs);
        this.success(res, normalizedCommand, result, timestamp);
      } catch (error) {
        console.error(`[${timestamp}] Command execution error:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal Server Error',
          message: String(error),
          timestamp,
          success: false
        }));
      }
    });

    req.on('timeout', () => {
      console.warn(`[${timestamp}] Request timeout`);
      if (!res.headersSent) {
        res.writeHead(408, { 'Content-Type': 'text/plain' });
        res.end('Request Timeout');
      }
    });
  }

  private success(res: http.ServerResponse, command: string, result: unknown, timestamp: string) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      result,
      timestamp,
      command,
      success: true
    }));
  }
}
