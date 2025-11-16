import * as vscode from 'vscode';

export interface PanelConfig {
  url?: string;
  title?: string;
}

export class MainPanelManager {
  private panel?: vscode.WebviewPanel;
  private config: PanelConfig = {};

  constructor(private readonly context: vscode.ExtensionContext) {}

  setConfig(config: PanelConfig) {
    this.config = { ...config };
  }

  getConfig(): PanelConfig {
    return { ...this.config };
  }

  open(config?: PanelConfig) {
    const target = { ...this.config, ...config };

    if (!target.url) {
      vscode.window.showWarningMessage('⚠️ Main panel URL not configured. Set MAIN_PANEL_URL in your .env file.');
      return;
    }

    if (!this.isValidUrl(target.url)) {
      vscode.window.showErrorMessage('🌐 MAIN_PANEL_URL must start with http:// or https://');
      return;
    }

    const title = target.title || 'Main Panel';

    if (this.panel) {
      this.panel.title = title;
      this.panel.webview.html = this.buildHtml(title, target.url);
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bridgeConnectorMainPanel',
      title,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.buildHtml(title, target.url);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  dispose() {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private isValidUrl(candidate: string): boolean {
    return candidate.startsWith('http://') || candidate.startsWith('https://');
  }

  private buildHtml(title: string, url: string): string {
    const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const csp = `frame-src ${url} http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:*; default-src 'none'; style-src 'unsafe-inline'; script-src 'none'`;

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <style>
      html, body, iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: #1e1e1e;
      }
      iframe {
        background: #fff;
      }
    </style>
    <title>${escapedTitle}</title>
  </head>
  <body>
    <iframe src="${url}" allow="clipboard-read; clipboard-write" title="${escapedTitle}"></iframe>
  </body>
</html>`;
  }
}
