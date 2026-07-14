import { App } from '@modelcontextprotocol/ext-apps';
import {
  buildProjectCardManifests,
  type IntegrationCardManifest,
} from '../../src/card-manifests';
import type { Ui5ProjectOverview } from '../../src/project-overview';
import {
  getProjectOverview,
  summarizeProjectOverview,
} from '../../src/project-overview';
import './styles.css';

interface CardsPayload {
  overview: Ui5ProjectOverview;
  cardManifests: IntegrationCardManifest[];
}

const app = new App({
  name: 'UI Integration Cards Project Overview',
  version: '0.1.0',
});

// The bridge hydrates the fixed card elements with this tool call's structured payload.
app.addEventListener('toolresult', (result) => {
  const payload = result.structuredContent as unknown as
    | CardsPayload
    | undefined;
  if (payload?.overview && payload.cardManifests) {
    renderCards(payload);
  }
});

try {
  await app.connect();
} catch {
  const overview = getProjectOverview();
  renderCards({ overview, cardManifests: buildProjectCardManifests(overview) });
}

function renderCards(payload: CardsPayload): void {
  const summary = document.getElementById('summary');
  if (summary) summary.textContent = summarizeProjectOverview(payload.overview);

  setManifest('summary-card', payload.cardManifests[0]);
  setManifest('checks-card', payload.cardManifests[1]);
}

function setManifest(
  id: string,
  manifest: IntegrationCardManifest | undefined,
): void {
  const card = document.getElementById(id);
  if (!card || !manifest) return;

  // SAPUI5 interprets the declarative manifest; the MCP host only transports and embeds it.
  card.setAttribute('base-url', './');
  card.setAttribute('manifest', JSON.stringify(manifest));
}
