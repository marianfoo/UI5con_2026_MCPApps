import { App } from '@modelcontextprotocol/ext-apps';
import './styles.css';

interface TimePayload {
  isoTime: string;
  offsetHours: number;
  formattedTime: string;
}

const timeValue = document.getElementById('time-value') as HTMLTimeElement;
const note = document.getElementById('time-note') as HTMLParagraphElement;
const addHourButton = document.getElementById('add-hour') as HTMLButtonElement;

let currentIsoTime = new Date().toISOString();
let mcpApp: App | undefined;

const app = new App({ name: 'HTML Time Demo', version: '0.1.0' });

// The host forwards the result of show_time to this sandboxed iframe after the bridge connects.
app.addEventListener('toolresult', (result) => {
  renderTime(result.structuredContent as unknown as TimePayload);
});

try {
  // connect performs the MCP Apps ui/initialize handshake over window.postMessage.
  await app.connect();
  mcpApp = app;
} catch {
  // This branch supports standalone browser previews; it is not the normal MCP Apps path.
  renderTime({
    isoTime: currentIsoTime,
    offsetHours: 0,
    formattedTime: new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(currentIsoTime))
  });
  note.textContent = 'Fallback mode: open this through an MCP Apps host to see the bridge call the server.';
}

addHourButton.addEventListener('click', async () => {
  if (!mcpApp) {
    currentIsoTime = addHours(currentIsoTime, 1);
    renderTime({
      isoTime: currentIsoTime,
      offsetHours: 1,
      formattedTime: new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC'
      }).format(new Date(currentIsoTime))
    });
    return;
  }

  addHourButton.disabled = true;
  try {
    // The iframe cannot call the stdio/HTTP server directly; the host proxies this tool call.
    const result = await mcpApp.callServerTool({
      name: 'add_hour',
      arguments: {
        isoTime: currentIsoTime,
        hours: 1
      }
    });
    renderTime(result.structuredContent as unknown as TimePayload);
  } finally {
    addHourButton.disabled = false;
  }
});

function renderTime(payload: TimePayload): void {
  currentIsoTime = payload.isoTime;
  timeValue.dateTime = payload.isoTime;
  timeValue.textContent = payload.formattedTime;
  note.textContent = `ISO: ${payload.isoTime}`;
}

function addHours(isoTime: string, hours: number): string {
  const date = new Date(isoTime);
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}
