import * as fs from 'fs';
import * as path from 'path';

export interface EnvValues {
  apiKey?: string;
  panelUrl?: string;
  panelTitle?: string;
  bridgePort?: number;
  mainPanelPort?: number;
}

export function readEnvValues(workspacePath: string): EnvValues {
  const values: EnvValues = {};

  if (!workspacePath) {
    return values;
  }

  const envPath = path.join(workspacePath, '.env');
  if (!fs.existsSync(envPath)) {
    return values;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = sanitizeValue(line.slice(equalsIndex + 1));

    switch (key) {
      case 'VSCODE_API_KEY':
        values.apiKey = value;
        break;
      case 'MAIN_PANEL_URL':
        values.panelUrl = value;
        break;
      case 'MAIN_PANEL_TITLE':
        values.panelTitle = value;
        break;
      case 'BRIDGE_PORT':
        values.bridgePort = safeNumber(value);
        break;
      case 'MAIN_PANEL_PORT':
        values.mainPanelPort = safeNumber(value);
        break;
      default:
        break;
    }
  }

  return values;
}

function sanitizeValue(input: string): string {
  return input.trim().replace(/^['"]|['"]$/g, '');
}

function safeNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}
