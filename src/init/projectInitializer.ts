import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { readEnvValues } from '../utils/env';
import type { PanelConfig } from '../panel/mainPanelManager';

interface ProjectInitializerOptions {
  workspacePathProvider: () => string | undefined;
  extensionRoot: string;
  onPanelConfigChange?: (config: PanelConfig) => void;
}

export class ProjectInitializer {
  private mainPanelProcess?: cp.ChildProcess;
  private outputChannel?: vscode.OutputChannel;

  constructor(private readonly options: ProjectInitializerOptions) {}

  async run() {
    const workspacePath = this.options.workspacePathProvider();
    if (!workspacePath) {
      vscode.window.showErrorMessage('🚫 Cannot initiate project without an open workspace folder.');
      return;
    }

    const projectName = await this.promptForPackageName(workspacePath);
    if (!projectName) {
      return;
    }

    try {
      const created: string[] = [];
      if (await this.ensurePackageJson(workspacePath, projectName)) {
        created.push('package.json');
      }
      if (await this.ensureEnvFile(workspacePath)) {
        created.push('.env');
      }
      if (await this.ensureMainPanelAssets(workspacePath)) {
        created.push('main-panel');
      }
      if (await this.ensureMcpConfiguration(workspacePath)) {
        created.push('.vscode/mcp.json');
      }

      if (created.length) {
        vscode.window.showInformationMessage(`✅ Created ${created.join(' & ')} from templates.`);
      } else {
        vscode.window.showInformationMessage('ℹ️ Project already initialized. No files were changed.');
      }

      this.updatePanelConfig(workspacePath);
      await this.startMainPanelProcess(workspacePath);
    } catch (error) {
      vscode.window.showErrorMessage(`🚫 Failed to initiate project: ${String(error)}`);
    }
  }

  dispose() {
    if (this.mainPanelProcess) {
      this.mainPanelProcess.kill();
      this.mainPanelProcess = undefined;
    }
    this.outputChannel?.dispose();
    this.outputChannel = undefined;
  }

  private async promptForPackageName(workspacePath: string): Promise<string | undefined> {
    const defaultName = sanitizePackageName(path.basename(workspacePath)) || 'bridge-client';
    const input = await vscode.window.showInputBox({
      title: 'Bridge Connector: Initiate Project',
      prompt: 'Enter the package name to use for package.json',
      value: defaultName
    });
    return input ? sanitizePackageName(input) : undefined;
  }

  private async ensurePackageJson(workspacePath: string, packageName: string): Promise<boolean> {
    const templatePath = path.join(this.options.extensionRoot, 'test-client-package.json');
    if (!fs.existsSync(templatePath)) {
      throw new Error('Template file test-client-package.json not found inside the extension.');
    }

    const targetPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(targetPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'A package.json already exists in this workspace. Overwrite with the Bridge Connector template?',
        { modal: true },
        'Overwrite'
      );
      if (overwrite !== 'Overwrite') {
        return false;
      }
    }

    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    template.name = packageName;
    fs.writeFileSync(targetPath, JSON.stringify(template, null, 2) + '\n', 'utf8');
    return true;
  }

  private async ensureEnvFile(workspacePath: string): Promise<boolean> {
    const sourcePath = path.join(this.options.extensionRoot, '.env.example');
    if (!fs.existsSync(sourcePath)) {
      throw new Error('.env.example not found inside the extension.');
    }

    const targetPath = path.join(workspacePath, '.env');
    if (fs.existsSync(targetPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'A .env file already exists. Overwrite with the template?',
        { modal: true },
        'Overwrite'
      );
      if (overwrite !== 'Overwrite') {
        return false;
      }
    }

    fs.copyFileSync(sourcePath, targetPath);
    return true;
  }

  private async ensureMainPanelAssets(workspacePath: string): Promise<boolean> {
    const templateDir = path.join(this.options.extensionRoot, 'templates', 'main-panel');
    const targetDir = path.join(workspacePath, 'main-panel');

    if (!fs.existsSync(templateDir)) {
      throw new Error('Main panel template folder missing inside the extension package.');
    }

    if (fs.existsSync(targetDir)) {
      const overwrite = await vscode.window.showWarningMessage(
        'A main-panel folder already exists. Overwrite with the latest template?',
        { modal: true },
        'Overwrite'
      );
      if (overwrite !== 'Overwrite') {
        return false;
      }
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    copyDirectory(templateDir, targetDir);
    return true;
  }

  private async ensureMcpConfiguration(workspacePath: string): Promise<boolean> {
    const templatePath = path.join(this.options.extensionRoot, 'templates', 'vscode', 'mcp.json');
    if (!fs.existsSync(templatePath)) {
      throw new Error('Template file templates/vscode/mcp.json not found inside the extension.');
    }

    const vscodeDir = path.join(workspacePath, '.vscode');
    const targetPath = path.join(vscodeDir, 'mcp.json');

    if (fs.existsSync(targetPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'A .vscode/mcp.json already exists. Overwrite with the Bridge Connector template?',
        { modal: true },
        'Overwrite'
      );
      if (overwrite !== 'Overwrite') {
        return false;
      }
    }

    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.copyFileSync(templatePath, targetPath);
    return true;
  }

  private updatePanelConfig(workspacePath: string) {
    try {
      const env = readEnvValues(workspacePath);
      this.options.onPanelConfigChange?.({
        url: env.panelUrl,
        title: env.panelTitle
      });
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Failed to read panel config:`, error);
    }
  }

  private async startMainPanelProcess(workspacePath: string): Promise<void> {
    const scriptPath = path.join(workspacePath, 'main-panel', 'main-panel-server.js');
    if (!fs.existsSync(scriptPath)) {
      vscode.window.showWarningMessage('⚠️ main-panel/main-panel-server.js not found. Run Initiate Project again to regenerate templates.');
      return;
    }

    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Bridge Main Panel');
    }

    if (this.mainPanelProcess) {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Restarting main panel server...`);
      this.mainPanelProcess.kill();
      this.mainPanelProcess = undefined;
    }

    this.outputChannel.appendLine(`[${new Date().toISOString()}] Starting main panel server via ${scriptPath}`);
    this.mainPanelProcess = cp.spawn(process.execPath, [scriptPath], {
      cwd: workspacePath,
      env: { ...process.env },
      stdio: 'pipe'
    });

    this.mainPanelProcess.stdout?.on('data', chunk => {
      this.outputChannel?.append(chunk.toString());
    });

    this.mainPanelProcess.stderr?.on('data', chunk => {
      this.outputChannel?.append(chunk.toString());
    });

    this.mainPanelProcess.on('error', error => {
      this.outputChannel?.appendLine(`[${new Date().toISOString()}] Main panel process error: ${String(error)}`);
      vscode.window.showErrorMessage(`🚫 Main panel process failed: ${String(error)}`);
    });

    this.mainPanelProcess.on('exit', (code, signal) => {
      this.outputChannel?.appendLine(`[${new Date().toISOString()}] Main panel process exited (code: ${code ?? 'null'}, signal: ${signal ?? 'null'})`);
      this.mainPanelProcess = undefined;
    });

    vscode.window.showInformationMessage('🚀 Main panel server started. Use the Open Main Panel item to view it.', 'Show Logs').then(choice => {
      if (choice === 'Show Logs') {
        this.outputChannel?.show(true);
      }
    });
  }
}

export function shouldShowInitiateProject(workspacePath?: string): boolean {
  if (!workspacePath) {
    return false;
  }

  const hasPackage = fs.existsSync(path.join(workspacePath, 'package.json'));
  const hasEnv = fs.existsSync(path.join(workspacePath, '.env'));
  return !(hasPackage && hasEnv);
}

function sanitizePackageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    || 'bridge-client';
}

function copyDirectory(source: string, destination: string) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
