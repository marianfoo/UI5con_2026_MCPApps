import { App } from '@modelcontextprotocol/ext-apps';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';
import '@ui5/webcomponents/dist/MessageStrip.js';

import type {
  IgnoreState,
  LintFileResult,
  LintMessage,
  LintReport
} from '../../src/lint-findings';
import {
  applyIgnoreStateToReport,
  compareMessages,
  normalizeIgnoreState
} from '../../src/lint-findings';
import './styles.css';

type LintRunRequest = {
  projectDir?: string;
  filePatterns?: string[];
  appName?: string;
};

type ToolPayload = {
  mode?: string;
  message?: string;
  report?: LintReport;
  ignoreState?: IgnoreState;
  projectDir?: string;
  filePatterns?: string[];
  appName?: string;
};

const app = new App({ name: 'UI5 Lint Findings Demo', version: '0.1.0' });

let currentReport: LintReport | undefined;
let ignoreState: IgnoreState = normalizeIgnoreState();
let currentRunRequest: LintRunRequest = {};
let showIgnored = false;
let selectedRuleIds = new Set<string>();

bindControls();
renderMissing('Waiting for a UI5 linter report from @ui5/mcp-server run_ui5_linter.');

// This event receives the host's original UI-tool result; callback results are handled at their call sites.
app.addEventListener('toolresult', (result) => {
  applyToolPayload(result.structuredContent as ToolPayload | undefined, {
    allowAutoload: true
  });
});

try {
  await app.connect();
} catch {
  renderMissing('Open this app through an MCP Apps host. Standalone mode cannot call the rerun tool.');
}

function applyToolPayload(
  payload: ToolPayload | undefined,
  options: { allowAutoload?: boolean } = {}
): void {
  if (payload?.ignoreState) {
    ignoreState = normalizeIgnoreState(payload.ignoreState);
  }

  if (payload?.projectDir || payload?.appName || payload?.filePatterns) {
    currentRunRequest = {
      projectDir: payload.projectDir,
      filePatterns: payload.filePatterns,
      appName: payload.appName
    };
  }

  if (payload?.mode === 'autoload') {
    renderMissing(payload.message ?? 'Opening UI5 lint findings and running the linter.');
    if (options.allowAutoload) {
      // The first result opens the UI; the UI then starts the long-running work through the bridge.
      void rerunLinter();
    }
    return;
  }

  if (payload?.report) {
    currentReport = applyIgnoreStateToReport(payload.report, ignoreState);
    renderReport(currentReport);
    return;
  }

  renderMissing(payload?.message ?? 'No UI5 linter data was passed to this MCP App.');
}

function bindControls(): void {
  document.getElementById('show-ignored')?.addEventListener('change', (event) => {
    showIgnored = Boolean((event.target as HTMLInputElement).checked);
    if (currentReport) renderReport(currentReport);
  });

  document.getElementById('rerun-button')?.addEventListener('click', () => {
    void rerunLinter();
  });

  document.getElementById('clear-ignores-button')?.addEventListener('click', () => {
    selectedRuleIds = new Set();
    showIgnored = false;
    const showIgnoredInput = document.getElementById('show-ignored') as HTMLInputElement | null;
    if (showIgnoredInput) {
      showIgnoredInput.checked = false;
    }
    if (currentReport) {
      currentReport = applyIgnoreStateToReport(currentReport, ignoreState);
      renderReport(currentReport);
    }
  });

  document.getElementById('rule-chips')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const chip = target.closest<HTMLButtonElement>('[data-rule-filter]');
    const ruleId = chip?.dataset.ruleFilter;
    if (!ruleId || !currentReport) {
      return;
    }

    selectedRuleIds = new Set(selectedRuleIds);
    if (selectedRuleIds.has(ruleId)) {
      selectedRuleIds.delete(ruleId);
    } else {
      selectedRuleIds.add(ruleId);
    }
    renderReport(currentReport);
  });

  document.getElementById('file-list')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const actionButton = target.closest<HTMLElement>('[data-action]');
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    const filePath = actionButton.dataset.file;
    const ruleId = actionButton.dataset.rule;
    const line = Number(actionButton.dataset.line);

    void applyPersistentIgnoreAction({ action, filePath, ruleId, line });
  });
}

async function applyPersistentIgnoreAction(options: {
  action: string | undefined;
  filePath: string | undefined;
  ruleId: string | undefined;
  line: number;
}): Promise<void> {
  const action = options.action === 'ignore-file'
    ? 'file'
    : options.action === 'ignore-line'
      ? 'line'
      : options.action === 'ignore-rule-in-file'
        ? 'fileRule'
        : undefined;

  if (!action || !options.filePath) {
    return;
  }

  try {
    // callServerTool is proxied by the host and returns directly to this existing iframe.
    const result = await app.callServerTool({
      name: 'apply_ui5_lint_ignore',
      arguments: {
        action,
        filePath: options.filePath,
        ruleId: options.ruleId,
        line: Number.isFinite(options.line) ? options.line : undefined,
        ignoreState
      }
    });
    const payload = result.structuredContent as ToolPayload | undefined;

    if (result.isError || payload?.mode === 'ignore-error') {
      renderStatus(payload?.message ?? 'Could not apply the UI5 linter ignore.', 'Negative');
      return;
    }

    if (payload?.ignoreState) {
      ignoreState = normalizeIgnoreState(payload.ignoreState);
    }
    if (currentReport) {
      currentReport = applyIgnoreStateToReport(currentReport, ignoreState);
      renderReport(currentReport);
    }
    renderStatus(payload?.message ?? 'Applied persistent UI5 linter ignore.', 'Positive');
  } catch (error) {
    renderStatus(error instanceof Error ? error.message : String(error), 'Negative');
  }
}

async function rerunLinter(): Promise<void> {
  setBusy(true, 'Running UI5 linter and refreshing the report.');
  try {
    // Reusing the same request keeps reruns tied to the project selected by the opening tool call.
    const result = await app.callServerTool({
      name: 'rerun_ui5_linter_demo_app',
      arguments: {
        ...currentRunRequest
      }
    });
    applyToolPayload(result.structuredContent as ToolPayload | undefined);
  } catch (error) {
    renderMissing(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

function renderReport(report: LintReport): void {
  updateRerunButton(false);
  pruneSelectedRules(report);

  const header = document.getElementById('card-header') as HTMLElement & {
    titleText: string;
    subtitleText: string;
  };

  const s = report.summary;
  header.titleText = report.appName;
  header.subtitleText = `${s.activeFindingCount} active · ${s.errorCount} errors · ${s.warningCount} warnings · ${s.ignoredCount} ignored`;

  const strip = document.getElementById('summary-strip') as HTMLElement & { design: string };
  if (strip) {
    strip.textContent = buildReportStatus(report);
    strip.design = 'Information';
  }

  const title = document.getElementById('findings-title');
  if (title) {
    const suffix = selectedRuleIds.size > 0 ? ` (${selectedRuleIds.size} rule filter${selectedRuleIds.size === 1 ? '' : 's'})` : '';
    title.textContent = `Findings by file${suffix}`;
  }

  renderRuleChips(report);
  renderFindings(report);
}

function renderMissing(message: string): void {
  updateRerunButton(false);

  const header = document.getElementById('card-header') as HTMLElement & {
    titleText: string;
    subtitleText: string;
  };
  if (header) {
    header.titleText = 'UI5 Lint Findings';
    header.subtitleText = 'Waiting for report data';
  }

  const strip = document.getElementById('summary-strip') as HTMLElement & { design: string };
  if (strip) {
    strip.textContent = message;
    strip.design = 'Information';
  }

  const chips = document.getElementById('rule-chips');
  if (chips) chips.innerHTML = '';

  const list = document.getElementById('file-list');
  if (list) {
    list.innerHTML = '<p class="empty">No lint report is loaded yet.</p>';
  }
}

function renderRuleChips(report: LintReport): void {
  const container = document.getElementById('rule-chips');
  if (!container) return;

  if (report.summary.ruleCounts.length === 0) {
    container.innerHTML = '<span class="empty">No active rules.</span>';
    return;
  }

  container.innerHTML = report.summary.ruleCounts.map((rule) => {
    const selected = selectedRuleIds.has(rule.ruleId);
    return [
      '<button',
      ' class="chip"',
      ' type="button"',
      ` data-rule-filter="${escapeAttr(rule.ruleId)}"`,
      ` aria-pressed="${selected ? 'true' : 'false'}"`,
      ` title="${selected ? 'Remove' : 'Add'} rule filter for ${escapeAttr(rule.ruleId)}"`,
      '>',
      `<code>${escapeHtml(rule.ruleId)}</code>`,
      `<b>${rule.count}</b>`,
      '</button>'
    ].join('');
  }).join('');
}

function renderFindings(report: LintReport): void {
  const container = document.getElementById('file-list');
  if (!container) return;

  const html = renderByFile(report.files);
  container.innerHTML = html || '<p class="empty">No findings match the current UI filters.</p>';
}

function renderByFile(files: LintFileResult[]): string {
  return files
    .map((file) => renderFileSection(file))
    .filter(Boolean)
    .join('');
}

function renderFileSection(file: LintFileResult): string {
  const messages = visibleMessages(file);
  if (messages.length === 0) {
    return '';
  }

  return [
    '<section class="file">',
    '<header class="file-head">',
    `<code>${escapeHtml(file.filePath)}</code>`,
    '<span class="file-actions">',
    `<span class="counts">${file.errorCount} errors · ${file.warningCount} warnings · ${file.ignoredCount} ignored</span>`,
    `<button class="link-button" data-action="ignore-file" data-file="${escapeAttr(file.filePath)}">Ignore file</button>`,
    '</span>',
    '</header>',
    '<div class="messages">',
    messages.map((message) => renderMessage(file.filePath, message)).join(''),
    '</div>',
    '</section>'
  ].join('');
}

function visibleMessages(file: LintFileResult): LintMessage[] {
  return file.messages
    .filter((message) => showIgnored || message.status === 'active')
    .filter((message) => selectedRuleIds.size === 0 || selectedRuleIds.has(message.ruleId))
    .sort(compareMessages);
}

function pruneSelectedRules(report: LintReport): void {
  if (selectedRuleIds.size === 0) {
    return;
  }

  const availableRules = new Set(report.summary.ruleCounts.map((rule) => rule.ruleId));
  selectedRuleIds = new Set([...selectedRuleIds].filter((ruleId) => availableRules.has(ruleId)));
}

function renderMessage(filePath: string, message: LintMessage): string {
  const label = message.severityLabel === 'warning' ? 'Warn' : message.severityLabel;
  const ignoredText = message.status === 'ignored'
    ? `<span class="ignored-note">ignored by ${message.ignoredBy}</span>`
    : '';

  return [
    `<div class="msg ${message.severityLabel} ${message.status}">`,
    `<span class="sev ${message.severityLabel}">${escapeHtml(label)}</span>`,
    `<span class="loc">${message.line}:${message.column}</span>`,
    `<span class="rule">${escapeHtml(message.ruleId)}</span>`,
    `<span class="text">${escapeHtml(message.message)} ${ignoredText}</span>`,
    '<span class="msg-actions">',
    `<button class="link-button" data-action="ignore-line" data-file="${escapeAttr(filePath)}" data-rule="${escapeAttr(message.ruleId)}" data-line="${message.line}">Ignore line</button>`,
    `<button class="link-button" data-action="ignore-rule-in-file" data-file="${escapeAttr(filePath)}" data-rule="${escapeAttr(message.ruleId)}">Ignore rule in file</button>`,
    '</span>',
    '</div>'
  ].join('');
}

function buildReportStatus(report: LintReport): string {
  const s = report.summary;
  const parts = [
    `Last run: ${formatSourceLabel(report.source)}.`,
    `${s.activeFindingCount} active finding${s.activeFindingCount === 1 ? '' : 's'} across ${s.fileCount} file${s.fileCount === 1 ? '' : 's'}.`
  ];

  if (s.ignoredCount > 0) {
    parts.push(`${s.ignoredCount} finding${s.ignoredCount === 1 ? '' : 's'} hidden by current UI ignore state.`);
  }

  return parts.join(' ');
}

function formatSourceLabel(source: string): string {
  if (source.includes('/ ui5lint JSON')) {
    return 'passed UI5 linter JSON';
  }
  if (source.includes('@ui5/mcp-server') && source.includes('fallback')) {
    return 'ui5lint CLI fallback';
  }
  if (source.startsWith('@ui5/mcp-server run_ui5_linter')) {
    return 'UI5 MCP server';
  }
  if (source.startsWith('ui5lint')) {
    return 'ui5lint CLI';
  }
  return source;
}

function setBusy(isBusy: boolean, message?: string): void {
  document.querySelector('.page')?.toggleAttribute('aria-busy', isBusy);
  updateRerunButton(isBusy);
  if (isBusy && message) {
    renderStatus(message, 'Information');
  }
}

function updateRerunButton(isBusy: boolean): void {
  const button = document.getElementById('rerun-button') as (HTMLElement & { loading?: boolean }) | null;
  if (!button) return;
  button.toggleAttribute('disabled', isBusy);
  button.textContent = isBusy ? 'Running...' : 'Rerun linter';
  button.setAttribute('title', 'Run @ui5/mcp-server run_ui5_linter, falling back to ui5lint CLI if the server is unavailable.');
}

function renderStatus(message: string, design: string): void {
  const strip = document.getElementById('summary-strip') as HTMLElement & { design: string };
  if (strip) {
    strip.textContent = message;
    strip.design = design;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
