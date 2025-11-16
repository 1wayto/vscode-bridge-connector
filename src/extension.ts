import * as vscode from 'vscode';
import { StatusBarManager } from './ui/statusBar';
import { MainPanelManager } from './panel/mainPanelManager';
import { readEnvValues } from './utils/env';
import { BridgeServer } from './server/bridgeServer';
import { ProjectInitializer, shouldShowInitiateProject } from './init/projectInitializer';

let statusBarManager: StatusBarManager;
let mainPanelManager: MainPanelManager;
let projectInitializer: ProjectInitializer;
let bridgeServer: BridgeServer;
let extensionRoot: string;

export function activate(context: vscode.ExtensionContext) {
  extensionRoot = context.extensionUri.fsPath;

  const workspacePathProvider = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  statusBarManager = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBarManager.dispose() });

  mainPanelManager = new MainPanelManager(context);
  context.subscriptions.push({ dispose: () => mainPanelManager.dispose() });

  projectInitializer = new ProjectInitializer({
    workspacePathProvider,
    extensionRoot,
    onPanelConfigChange: config => mainPanelManager.setConfig(config)
  });
  context.subscriptions.push({ dispose: () => projectInitializer.dispose() });

  bridgeServer = new BridgeServer({
    workspacePathProvider,
    onPanelConfigChange: config => mainPanelManager.setConfig(config),
    onStatusChange: isRunning => statusBarManager.setRunning(isRunning)
  });
  context.subscriptions.push({ dispose: () => bridgeServer.dispose() });

  const toggleServer = async () => {
    if (bridgeServer.isRunning()) {
      bridgeServer.stop();
    } else {
      await bridgeServer.start();
    }
  };

  const searchCommands = async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter part of a command ID to search for',
      placeHolder: 'workbench.action.chat',
      value: 'workbench.action.chat'
    });

    if (input === undefined) {
      return;
    }

    const needle = input.trim();
    if (!needle) {
      vscode.window.showInformationMessage('Enter at least one character to filter command IDs.');
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Fetching VS Code commands…'
    }, async progress => {
      progress.report({ increment: 0 });
      const commands = await vscode.commands.getCommands(true);
      const lowerNeedle = needle.toLowerCase();
      const matches = commands.filter(cmd => cmd.toLowerCase().includes(lowerNeedle)).sort();

      if (!matches.length) {
        vscode.window.showInformationMessage(`No commands matched "${needle}".`);
        return;
      }

      const maxResults = 200;
      const items = matches.slice(0, maxResults).map(label => ({
        label,
        description: matches.length > maxResults ? 'More results available beyond first 200' : undefined
      }));

      const pick = await vscode.window.showQuickPick(items, {
        title: `Commands matching "${needle}" (${matches.length} found)`,
        placeHolder: 'Select a command to copy it to your clipboard'
      });

      if (pick) {
        await vscode.env.clipboard.writeText(pick.label);
        vscode.window.showInformationMessage(`Copied "${pick.label}" to clipboard.`);
      }
    });
  };

  const showMenu = async () => {
    refreshPanelConfig();

    const cfg = vscode.workspace.getConfiguration('bridgeConnector');
    const port = cfg.get<number>('port', 8282);
    const isRunning = bridgeServer.isRunning();
    const statusText = isRunning ? '🟢 Running' : '🔴 Stopped';
    const toggleText = isRunning ? '⏸️ Stop Bridge' : '▶️ Start Bridge';

    const workspacePath = workspacePathProvider();
    const canInit = shouldShowInitiateProject(workspacePath);
    const panelConfig = mainPanelManager.getConfig();

    const items: Array<{ label: string; description?: string; action: string }> = [];

    if (canInit) {
      items.push({
        label: '🛠️ Initiate Project',
        description: 'Create package.json and .env from templates',
        action: 'initProject'
      });
    }

    items.push(
      { label: toggleText, description: `Bridge is currently ${isRunning ? 'running' : 'stopped'}`, action: 'toggle' },
      { label: `📊 Status: ${statusText}`, description: `Port: ${port} | Click to refresh status`, action: 'status' }
    );

    if (panelConfig.url) {
      items.splice(2, 0, {
        label: `🌐 ${panelConfig.title || 'Open Main Panel'}`,
        description: panelConfig.url,
        action: 'openPanel'
      });
    }

    items.push({
      label: '📜 Search VS Code Commands',
      description: 'Filter command IDs via substring match',
      action: 'searchCommands'
    });

    items.push({
      label: '⚙️ Extension Settings',
      description: 'Configure port and startup options',
      action: 'settings'
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '🔌 Bridge Connector Menu',
      title: 'VSCode Bridge Connector 🔌🌉'
    });

    if (!selected) {
      return;
    }

    switch (selected.action) {
      case 'toggle':
        await toggleServer();
        break;
      case 'status':
        vscode.window.showInformationMessage(
          isRunning ? `🟢 Bridge is running on port ${port}` : '🔴 Bridge is stopped'
        );
        break;
      case 'openPanel':
        mainPanelManager.open();
        break;
      case 'searchCommands':
        await searchCommands();
        break;
      case 'initProject':
        await projectInitializer.run();
        break;
      case 'settings':
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:1WAYTO.vscode-bridge-connector');
        break;
      default:
        break;
    }
  };

  const openMainPanel = () => {
    refreshPanelConfig();
    mainPanelManager.open();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('bridgeConnector.showMenu', showMenu),
    vscode.commands.registerCommand('bridgeConnector.toggle', toggleServer),
    vscode.commands.registerCommand('bridgeConnector.initiateProject', () => projectInitializer.run()),
    vscode.commands.registerCommand('bridgeConnector.openMainPanel', openMainPanel),
    vscode.commands.registerCommand('bridgeConnector.searchCommands', searchCommands),
    vscode.commands.registerCommand('bridgeConnector.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:1WAYTO.vscode-bridge-connector');
    })
  );

  statusBarManager.setRunning(false);

  const cfg = vscode.workspace.getConfiguration('bridgeConnector');
  if (cfg.get<boolean>('enable')) {
    bridgeServer.start();
  }
}

export function deactivate() {
  bridgeServer?.dispose();
  projectInitializer?.dispose();
  mainPanelManager?.dispose();
  statusBarManager?.dispose();
}

function refreshPanelConfig() {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    mainPanelManager.setConfig({ url: undefined, title: undefined });
    return;
  }

  try {
    const env = readEnvValues(workspacePath);
    mainPanelManager.setConfig({ url: env.panelUrl, title: env.panelTitle });
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] Failed to read main panel config:`, error);
  }
}
