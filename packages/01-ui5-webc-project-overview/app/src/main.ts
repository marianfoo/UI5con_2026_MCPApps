import { App, applyDocumentTheme, type McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import '@ui5/webcomponents-theming/dist/Assets.js';
import '@ui5/webcomponents/dist/generated/json-imports/Themes.js';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';
import '@ui5/webcomponents/dist/List.js';
import '@ui5/webcomponents/dist/ListItemStandard.js';
import '@ui5/webcomponents/dist/MessageStrip.js';
import '@ui5/webcomponents/dist/Tag.js';
import '@ui5/webcomponents/dist/Text.js';
import '@ui5/webcomponents/dist/Title.js';
import type { ProjectCheckState, Ui5ProjectOverview } from '../../src/project-overview';
import { getProjectOverview } from '../../src/project-overview';
import './styles.css';

const app = new App({ name: 'UI5 Web Components Project Overview', version: '0.1.0' });
type ListItemState = 'Positive' | 'Critical' | 'Negative' | 'Information';
type Ui5ListItem = HTMLElement & {
  text?: string;
  description?: string;
  additionalText?: string;
  additionalTextState: ListItemState;
  wrappingType: 'Normal' | 'None';
};

// MCP Apps delivers tool data separately from the prebuilt HTML and JavaScript bundle.
app.addEventListener('toolresult', (result) => {
  const payload = result.structuredContent as { overview?: Ui5ProjectOverview } | undefined;
  if (payload?.overview) {
    renderOverview(payload.overview, 'tool');
  }
});

app.addEventListener('hostcontextchanged', ({ theme }) => {
  syncHostTheme(theme);
});

try {
  await app.connect();
  syncHostTheme(app.getHostContext()?.theme);
} catch {
  // Keep local visual development possible without pretending that bridge data was received.
  renderOverview(getProjectOverview(), 'fixture');
}

function syncHostTheme(theme: McpUiTheme | undefined): void {
  if (!theme) return;

  applyDocumentTheme(theme);
  const ui5Theme = theme === 'dark' ? 'sap_horizon_dark' : 'sap_horizon';
  void setTheme(ui5Theme).catch((error: unknown) => {
    console.warn(`Could not apply UI5 theme ${ui5Theme}.`, error);
  });
}

function renderOverview(overview: Ui5ProjectOverview, source: 'tool' | 'fixture'): void {
  const header = document.getElementById('card-header') as HTMLElement & {
    titleText: string;
    subtitleText: string;
  };

  header.titleText = overview.project.title;
  header.subtitleText = overview.project.description;

  renderSourceNote(source);
  setText('ui5-version', overview.project.ui5Version);
  setText('theme', overview.project.theme);
  setText('view-count', String(overview.summary.viewCount));
  setText('controller-count', String(overview.summary.controllerCount));
  setText('project-id', overview.project.id);
  setText('template', overview.project.template);
  setText('service', overview.project.service);

  renderList('library-list', overview.libraries.map((library) => ({
    title: library.name,
    description: library.purpose
  })));

  const checks = document.getElementById('check-list');
  if (checks) {
    checks.replaceChildren(...overview.checks.map((check) => createListItem({
      title: check.name,
      description: check.detail,
      additionalText: check.value,
      state: mapState(check.state)
    })));
  }
}

function renderSourceNote(source: 'tool' | 'fixture'): void {
  const note = document.getElementById('source-note') as (HTMLElement & { design: string }) | null;
  if (!note) return;

  note.design = source === 'tool' ? 'Positive' : 'Information';
  note.textContent = source === 'tool'
    ? 'Rendered from structuredContent returned by show_ui5_project_overview.'
    : 'Standalone preview: rendered from the bundled project fixture.';
}

function renderList(id: string, items: Array<{ title: string; description: string }>): void {
  const list = document.getElementById(id);
  if (!list) return;

  list.replaceChildren(...items.map((item) => createListItem(item)));
}

function createListItem(item: {
  title: string;
  description: string;
  additionalText?: string;
  state?: ListItemState;
}): Ui5ListItem {
  const listItem = document.createElement('ui5-li') as Ui5ListItem;
  listItem.text = item.title;
  listItem.description = item.description;
  listItem.wrappingType = 'Normal';

  if (item.additionalText) listItem.additionalText = item.additionalText;
  if (item.state) listItem.additionalTextState = item.state;

  return listItem;
}

function mapState(state: ProjectCheckState): ListItemState {
  switch (state) {
    case 'success':
      return 'Positive';
    case 'warning':
      return 'Critical';
    case 'error':
      return 'Negative';
    default:
      return 'Information';
  }
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
