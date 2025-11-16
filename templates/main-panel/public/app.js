const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const titleEl = document.getElementById('panelTitle');
const hiButton = document.getElementById('hiButton');

let cachedConfig;

function appendLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch config (status ${response.status})`);
  }
  cachedConfig = await response.json();
  if (cachedConfig.title) {
    titleEl.textContent = cachedConfig.title;
  }
  return cachedConfig;
}

async function triggerChat() {
  try {
    const config = await loadConfig();
    const { apiKey, bridgePort, bridgeHost, bridgeProtocol } = config;
    if (!apiKey) {
      statusEl.textContent = 'Missing VSCODE_API_KEY in .env';
      appendLog('Cannot send request: API key missing.');
      return;
    }

    statusEl.textContent = 'Sending chat command...';
    appendLog('Invoking workbench.action.chat.open');

    const response = await fetch(`${bridgeProtocol}://${bridgeHost}:${bridgePort}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vscode-key': apiKey
      },
      body: JSON.stringify({
        command: 'workbench.action.chat.open',
        args: {
          query: 'hi',
          mode: 'I.D.E.A.S',
          model: 'GPT-5 mini (copilot)'
        }
      })
    });

    const payload = await response.json().catch(() => ({ message: 'Invalid JSON response' }));

    if (response.ok) {
      statusEl.textContent = 'Chat command executed successfully!';
      appendLog(`Success: ${JSON.stringify(payload)}`);
    } else {
      statusEl.textContent = 'Chat command failed. Check log for details.';
      appendLog(`Error: ${JSON.stringify(payload)}`);
    }
  } catch (error) {
    statusEl.textContent = 'Chat command failed. Bridge unreachable?';
    appendLog(`Network error: ${error.message}`);
  }
}

hiButton.addEventListener('click', triggerChat);

loadConfig()
  .then(() => appendLog('Configuration loaded. Ready.'))
  .catch(error => {
    statusEl.textContent = 'Unable to load config.json';
    appendLog(`Config error: ${error.message}`);
  });
