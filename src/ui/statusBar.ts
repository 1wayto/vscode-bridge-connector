import * as vscode from 'vscode';

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'bridgeConnector.showMenu';
    this.setRunning(false);
    this.item.show();
  }

  setRunning(isRunning: boolean) {
    if (isRunning) {
      this.item.text = '$(plug) Bridge: Running';
      this.item.tooltip = 'Bridge Connector server is running – click for options';
    } else {
      this.item.text = '$(debug-disconnect) Bridge: Stopped';
      this.item.tooltip = 'Bridge Connector server is stopped – click for options';
    }
  }

  dispose() {
    this.item.dispose();
  }
}
