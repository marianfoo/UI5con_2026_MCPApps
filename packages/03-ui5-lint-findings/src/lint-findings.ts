export const SEVERITY = {
  fatal: 3,
  error: 2,
  warning: 1,
  info: 0
} as const;

export type SeverityLabel = 'fatal' | 'error' | 'warning' | 'info';
export type FindingStatus = 'active' | 'ignored';

export interface RawLintMessage {
  ruleId: string;
  severity: number;
  line: number;
  column: number;
  message: string;
}

export interface RawLintFileResult {
  filePath: string;
  messages: RawLintMessage[];
  errorCount?: number;
  warningCount?: number;
  fatalErrorCount?: number;
}

export interface IgnoreLine {
  filePath: string;
  line: number;
}

export interface IgnoreFileRule {
  filePath: string;
  ruleId: string;
}

export interface IgnoreState {
  files: string[];
  rules: string[];
  lines: IgnoreLine[];
  fileRules: IgnoreFileRule[];
}

export interface LintMessage extends RawLintMessage {
  id: string;
  severityLabel: SeverityLabel;
  status: FindingStatus;
  ignoredBy?: 'file' | 'rule' | 'line' | 'file-rule';
}

export interface LintFileResult {
  filePath: string;
  messages: LintMessage[];
  activeCount: number;
  ignoredCount: number;
  errorCount: number;
  warningCount: number;
  fatalErrorCount: number;
}

export interface LintRuleCount {
  ruleId: string;
  count: number;
}

export interface LintReport {
  appName: string;
  source: string;
  generatedAt: string;
  files: LintFileResult[];
  ignoreState: IgnoreState;
  summary: {
    fileCount: number;
    findingCount: number;
    activeFindingCount: number;
    ignoredCount: number;
    errorCount: number;
    warningCount: number;
    fatalErrorCount: number;
    ruleCounts: LintRuleCount[];
  };
}

export const EMPTY_IGNORE_STATE: IgnoreState = {
  files: [],
  rules: [],
  lines: [],
  fileRules: []
};

export function parseUi5LintJson(value: string): RawLintFileResult[] {
  return extractRawLintResults(JSON.parse(value));
}

export function extractRawLintResults(value: unknown): RawLintFileResult[] {
  if (Array.isArray(value)) {
    return normalizeRawFiles(value);
  }

  if (!value || typeof value !== 'object') {
    throw new Error('UI5 linter input must be a JSON array or object containing file results.');
  }

  const candidate = value as {
    files?: unknown;
    report?: unknown;
    result?: unknown;
    results?: unknown;
    structuredContent?: unknown;
  };

  for (const nested of [
    candidate.files,
    candidate.report,
    candidate.result,
    candidate.results,
    candidate.structuredContent
  ]) {
    if (!nested) {
      continue;
    }

    try {
      return extractRawLintResults(nested);
    } catch {
      // Try the next common wrapper shape.
    }
  }

  throw new Error('Could not find UI5 linter file results in the provided input.');
}

export function buildLintReport(options: {
  appName?: string;
  source?: string;
  rawFiles: RawLintFileResult[];
  ignoreState?: Partial<IgnoreState>;
  generatedAt?: string;
}): LintReport {
  const ignoreState = normalizeIgnoreState(options.ignoreState);
  const files = normalizeRawFiles(options.rawFiles)
    .map((file) => buildFileResult(file, ignoreState))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const findingCount = files.reduce((sum, file) => sum + file.messages.length, 0);
  const ignoredCount = files.reduce((sum, file) => sum + file.ignoredCount, 0);
  const errorCount = files.reduce((sum, file) => sum + file.errorCount, 0);
  const warningCount = files.reduce((sum, file) => sum + file.warningCount, 0);
  const fatalErrorCount = files.reduce((sum, file) => sum + file.fatalErrorCount, 0);
  const activeFindingCount = findingCount - ignoredCount;

  const ruleCountMap = new Map<string, number>();
  for (const file of files) {
    for (const message of file.messages) {
      if (message.status === 'ignored') {
        continue;
      }
      ruleCountMap.set(message.ruleId, (ruleCountMap.get(message.ruleId) ?? 0) + 1);
    }
  }

  const ruleCounts = [...ruleCountMap.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId));

  return {
    appName: options.appName ?? 'UI5 Demo App',
    source: options.source ?? 'ui5lint --format json',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    files,
    ignoreState,
    summary: {
      fileCount: files.length,
      findingCount,
      activeFindingCount,
      ignoredCount,
      errorCount,
      warningCount,
      fatalErrorCount,
      ruleCounts
    }
  };
}

export function applyIgnoreStateToReport(report: LintReport, ignoreState: Partial<IgnoreState>): LintReport {
  return buildLintReport({
    appName: report.appName,
    source: report.source,
    generatedAt: report.generatedAt,
    rawFiles: report.files.map((file) => ({
      filePath: file.filePath,
      messages: file.messages.map(({ ruleId, severity, line, column, message }) => ({
        ruleId,
        severity,
        line,
        column,
        message
      }))
    })),
    ignoreState
  });
}

export function normalizeIgnoreState(value?: Partial<IgnoreState>): IgnoreState {
  return {
    files: uniqueStrings(value?.files),
    rules: uniqueStrings(value?.rules),
    lines: uniqueLines(value?.lines),
    fileRules: uniqueFileRules(value?.fileRules)
  };
}

export function summarizeLintReport(report: LintReport): string {
  const { summary } = report;
  const top = summary.ruleCounts[0];
  const ignored = summary.ignoredCount > 0
    ? ` ${summary.ignoredCount} finding(s) ignored.`
    : '';

  return [
    `${report.appName}: ${summary.activeFindingCount} active UI5 lint finding(s)`,
    `(${summary.errorCount} errors, ${summary.warningCount} warnings)`,
    `across ${summary.fileCount} files.`,
    top ? `Most common active rule: ${top.ruleId} (${top.count}).` : '',
    ignored
  ].join(' ').replace(/\s+/g, ' ').trim();
}

function buildFileResult(file: RawLintFileResult, ignoreState: IgnoreState): LintFileResult {
  const messages = file.messages
    .map((message) => buildMessage(file.filePath, message, ignoreState))
    .sort(compareMessages);

  const activeMessages = messages.filter((message) => message.status === 'active');

  return {
    filePath: file.filePath,
    messages,
    activeCount: activeMessages.length,
    ignoredCount: messages.length - activeMessages.length,
    errorCount: activeMessages.filter((message) => message.severityLabel === 'error').length,
    warningCount: activeMessages.filter((message) => message.severityLabel === 'warning').length,
    fatalErrorCount: activeMessages.filter((message) => message.severityLabel === 'fatal').length
  };
}

function buildMessage(filePath: string, message: RawLintMessage, ignoreState: IgnoreState): LintMessage {
  const ignoredBy = getIgnoredBy(filePath, message, ignoreState);

  return {
    ...message,
    id: `${filePath}:${message.line}:${message.column}:${message.ruleId}`,
    severityLabel: severityLabel(message.severity),
    status: ignoredBy ? 'ignored' : 'active',
    ignoredBy
  };
}

function getIgnoredBy(
  filePath: string,
  message: RawLintMessage,
  ignoreState: IgnoreState
): LintMessage['ignoredBy'] | undefined {
  if (ignoreState.files.includes(filePath)) {
    return 'file';
  }
  if (ignoreState.rules.includes(message.ruleId)) {
    return 'rule';
  }
  if (ignoreState.fileRules.some((rule) => rule.filePath === filePath && rule.ruleId === message.ruleId)) {
    return 'file-rule';
  }
  if (ignoreState.lines.some((line) => line.filePath === filePath && line.line === message.line)) {
    return 'line';
  }
  return undefined;
}

export function severityLabel(severity: number): SeverityLabel {
  if (severity >= SEVERITY.fatal) {
    return 'fatal';
  }
  if (severity === SEVERITY.error) {
    return 'error';
  }
  if (severity === SEVERITY.warning) {
    return 'warning';
  }
  return 'info';
}

export function compareMessages(a: LintMessage, b: LintMessage): number {
  if (a.status !== b.status) {
    return a.status === 'active' ? -1 : 1;
  }
  if (b.severity !== a.severity) {
    return b.severity - a.severity;
  }
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  if (a.column !== b.column) {
    return a.column - b.column;
  }
  return a.ruleId.localeCompare(b.ruleId);
}

function normalizeRawFiles(value: unknown[]): RawLintFileResult[] {
  return value.map((file) => {
    if (!file || typeof file !== 'object') {
      throw new Error('UI5 linter file result must be an object.');
    }

    const candidate = file as Partial<RawLintFileResult>;
    if (typeof candidate.filePath !== 'string' || !Array.isArray(candidate.messages)) {
      throw new Error('UI5 linter file result must include filePath and messages.');
    }

    return {
      filePath: candidate.filePath,
      messages: candidate.messages.map(normalizeRawMessage),
      errorCount: candidate.errorCount,
      warningCount: candidate.warningCount,
      fatalErrorCount: candidate.fatalErrorCount
    };
  });
}

function normalizeRawMessage(value: unknown): RawLintMessage {
  if (!value || typeof value !== 'object') {
    throw new Error('UI5 linter message must be an object.');
  }

  const candidate = value as Partial<RawLintMessage>;
  if (
    typeof candidate.ruleId !== 'string'
    || typeof candidate.severity !== 'number'
    || typeof candidate.line !== 'number'
    || typeof candidate.column !== 'number'
    || typeof candidate.message !== 'string'
  ) {
    throw new Error('UI5 linter message must include ruleId, severity, line, column, and message.');
  }

  return {
    ruleId: candidate.ruleId,
    severity: candidate.severity,
    line: candidate.line,
    column: candidate.column,
    message: candidate.message
  };
}

function uniqueStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

function uniqueLines(values: IgnoreLine[] | undefined): IgnoreLine[] {
  const seen = new Set<string>();
  const result: IgnoreLine[] = [];

  for (const value of values ?? []) {
    if (!value || typeof value.filePath !== 'string' || typeof value.line !== 'number') {
      continue;
    }

    const key = `${value.filePath}:${value.line}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ filePath: value.filePath, line: value.line });
  }

  return result.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line);
}

function uniqueFileRules(values: IgnoreFileRule[] | undefined): IgnoreFileRule[] {
  const seen = new Set<string>();
  const result: IgnoreFileRule[] = [];

  for (const value of values ?? []) {
    if (!value || typeof value.filePath !== 'string' || typeof value.ruleId !== 'string') {
      continue;
    }

    const key = `${value.filePath}:${value.ruleId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ filePath: value.filePath, ruleId: value.ruleId });
  }

  return result.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.ruleId.localeCompare(b.ruleId));
}
