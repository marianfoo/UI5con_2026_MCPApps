import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import {
  type IgnoreState,
  type RawLintFileResult,
  EMPTY_IGNORE_STATE,
  buildLintReport,
  extractRawLintResults,
  normalizeIgnoreState,
  parseUi5LintJson,
  summarizeLintReport
} from './lint-findings.js';
import { applyPersistentIgnore } from './ignore-writer.js';
import { readBuiltAppResource, resolveRepoPath } from '../../../src/mcp-host.js';

const execFileAsync = promisify(execFile);

const UI5_LINT_FINDINGS_RESOURCE_URI = 'ui://ui5-lint-findings/index.html';
const UI5_LINT_FINDINGS_RESOURCE_META = {
  csp: {
    resourceDomains: ['https://cdn.jsdelivr.net']
  },
  prefersBorder: true
};

// Hosts may launch a stdio server from any cwd, so locate the fixture from the repository root.
const DEMO_APP_DIR = resolveRepoPath('packages', '03-ui5-lint-findings', 'demo_app');
const UI5_MCP_TIMEOUT_MS = Number(process.env.UI5_MCP_TIMEOUT_MS ?? 15000);

const ignoreStateSchema = z.object({
  files: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  lines: z.array(z.object({
    filePath: z.string(),
    line: z.number().int().positive()
  })).optional(),
  fileRules: z.array(z.object({
    filePath: z.string(),
    ruleId: z.string()
  })).optional()
}).optional();

export function registerUi5LintFindingsSample(server: McpServer): void {
  // The initial mode tells the app whether to autoload live linter data or render passed data.
  registerAppTool(
    server,
    'show_ui5_lint_findings',
    {
      title: 'Show UI5 Lint Findings',
      description: [
        'Open a UI5 Web Components MCP App that visualizes UI5 linter findings.',
        'Pass JSON from @ui5/mcp-server run_ui5_linter or from ui5lint --format json.',
        'If no report is passed, this tool tries @ui5/mcp-server for the bundled demo_app, then falls back to ui5lint CLI.'
      ].join(' '),
      inputSchema: {
        ui5LintJson: z.string().optional()
          .describe('Raw JSON text from ui5lint --format json or @ui5/mcp-server run_ui5_linter.'),
        projectDir: z.string().optional()
          .describe('Absolute UI5 project path to lint when ui5LintJson is not passed. Defaults to this package demo_app.'),
        filePatterns: z.array(z.string()).optional()
          .describe('Optional file paths or glob patterns to pass to the linter.'),
        appName: z.string().optional()
          .describe('Display name for the linted UI5 app.'),
        ignoreState: ignoreStateSchema
          .describe('Current ignore state: files, rules, file/rule pairs, and file/line pairs.')
      },
      _meta: {
        ui: {
          resourceUri: UI5_LINT_FINDINGS_RESOURCE_URI
        }
      }
    },
    async (args) => buildUi5LintFindingsResult(args)
  );

  // These workflow helpers declare no UI resource; the iframe calls them without opening another app.
  server.registerTool(
    'rerun_ui5_linter_demo_app',
    {
      title: 'Rerun Local UI5 Linter Demo App',
      description: [
        'Rerun the linter against packages/03-ui5-lint-findings/demo_app.',
        'This tries @ui5/mcp-server run_ui5_linter first, then falls back to ui5lint CLI.'
      ].join(' '),
      inputSchema: {
        ignoreState: ignoreStateSchema
          .describe('Current ignore state: files, rules, file/rule pairs, and file/line pairs.'),
        projectDir: z.string().optional()
          .describe('Absolute UI5 project path to lint. Defaults to this package demo_app.'),
        appName: z.string().optional()
          .describe('Display name for the linted UI5 app.'),
        filePatterns: z.array(z.string()).optional()
          .describe('Optional ui5lint file patterns, for example ["webapp/**/*.xml"].')
      }
    },
    async (args) => runProjectLintResult({
      projectDir: args.projectDir,
      filePatterns: args.filePatterns,
      appName: args.appName,
      ignoreState: args.ignoreState
    })
  );

  server.registerTool(
    'apply_ui5_lint_ignore',
    {
      title: 'Apply UI5 Lint Ignore',
      description: [
        'Persist an ignore decision for the bundled demo app.',
        'File ignores are written to ui5lint.config.cjs.',
        'Line and file-rule ignores insert ui5lint directive comments into supported source files.'
      ].join(' '),
      inputSchema: {
        action: z.enum(['file', 'line', 'fileRule'])
          .describe('file = ignore the whole file via config, line = disable one rule on one line, fileRule = disable one rule for the file.'),
        filePath: z.string()
          .describe('Relative path from the UI5 demo app root, for example webapp/controller/List.controller.js.'),
        ruleId: z.string().optional()
          .describe('UI5 linter rule ID, required for line and fileRule actions.'),
        line: z.number().int().positive().optional()
          .describe('1-based line number, required for line action.'),
        ignoreState: ignoreStateSchema
          .describe('Current ignore state from the UI, so the tool can return the updated state.')
      }
    },
    async (args) => buildApplyIgnoreResult(args)
  );

  // One ui:// resource serves every state of the workflow: loading, report, write result, and error.
  registerAppResource(
    server,
    'UI5 Lint Findings Demo',
    UI5_LINT_FINDINGS_RESOURCE_URI,
    {
      title: 'UI5 Lint Findings Demo',
      description: 'UI5 Web Components view of ui5lint findings with rule filters and persistent ignore actions.',
      _meta: {
        ui: UI5_LINT_FINDINGS_RESOURCE_META
      }
    },
    async (uri) => readBuiltAppResource('03-ui5-lint-findings', uri, {
      uiMeta: UI5_LINT_FINDINGS_RESOURCE_META
    })
  );
}

async function buildApplyIgnoreResult(args: {
  action: 'file' | 'line' | 'fileRule';
  filePath: string;
  ruleId?: string;
  line?: number;
  ignoreState?: Partial<IgnoreState>;
}): Promise<CallToolResult> {
  try {
    const applied = await applyPersistentIgnore(DEMO_APP_DIR, args);
    const text = [
      applied.message,
      'Rerun the linter to verify the persisted ignore.'
    ].join(' ');

    return {
      content: [
        {
          type: 'text',
          text
        }
      ],
      structuredContent: {
        mode: 'ignore-applied',
        message: text,
        changedFile: applied.changedFile,
        operation: {
          action: args.action,
          filePath: args.filePath,
          ruleId: args.ruleId,
          line: args.line
        },
        ignoreState: applied.ignoreState
      }
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Could not apply UI5 linter ignore: ${text}`
        }
      ],
      structuredContent: {
        mode: 'ignore-error',
        message: text,
        ignoreState: normalizeIgnoreState(args.ignoreState)
      },
      isError: true
    };
  }
}

async function buildUi5LintFindingsResult(args: {
  ui5LintJson?: string;
  projectDir?: string;
  filePatterns?: string[];
  appName?: string;
  ignoreState?: Partial<IgnoreState>;
}): Promise<CallToolResult> {
  const parsed = readLintInput(args);
  if (!parsed.ok) {
    if (parsed.message) {
      return buildMissingLintResult(parsed.message);
    }
    return buildAutoloadLintResult({
      projectDir: args.projectDir,
      filePatterns: args.filePatterns,
      appName: args.appName,
      ignoreState: args.ignoreState
    });
  }

  const report = buildLintReport({
    appName: args.appName ?? 'UI5 Demo App',
    source: parsed.source,
    rawFiles: parsed.rawFiles,
    ignoreState: args.ignoreState
  });

  return buildReportResult(report);
}

function buildAutoloadLintResult(args: {
  projectDir?: string;
  filePatterns?: string[];
  appName?: string;
  ignoreState?: Partial<IgnoreState>;
}): CallToolResult {
  const projectDir = args.projectDir ?? DEMO_APP_DIR;
  const appName = args.appName ?? (projectDir === DEMO_APP_DIR ? 'UI5 Linter Demo App' : path.basename(projectDir));
  const text = [
    `Opening the UI5 lint findings app for ${appName}.`,
    'The app will run @ui5/mcp-server run_ui5_linter and fall back to ui5lint CLI if needed.'
  ].join(' ');

  return {
    content: [
      {
        type: 'text',
        text
      }
    ],
    // Autoload defers the expensive linter run until the iframe is connected and can show progress.
    structuredContent: {
      mode: 'autoload',
      message: text,
      appName,
      projectDir,
      filePatterns: args.filePatterns ?? [],
      ignoreState: normalizeIgnoreState(args.ignoreState)
    },
    _meta: buildAppResultMeta()
  };
}

async function runProjectLintResult(options: {
  projectDir?: string;
  filePatterns?: string[];
  appName?: string;
  ignoreState?: Partial<IgnoreState>;
}): Promise<CallToolResult> {
  const projectDir = options.projectDir ?? DEMO_APP_DIR;
  const lintRun = await runPreferredUi5Lint(projectDir, options.filePatterns);
  const report = buildLintReport({
    appName: options.appName ?? (projectDir === DEMO_APP_DIR ? 'UI5 Linter Demo App' : path.basename(projectDir)),
    source: lintRun.source,
    rawFiles: lintRun.rawFiles,
    ignoreState: options.ignoreState
  });

  return buildReportResult(report);
}

function buildReportResult(report: ReturnType<typeof buildLintReport>): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: summarizeLintReport(report)
      }
    ],
    // A tagged mode keeps the UI independent from wording in the model-readable content field.
    structuredContent: {
      mode: 'report',
      report,
      ignoreState: report.ignoreState
    },
    _meta: buildAppResultMeta()
  };
}

function buildAppResultMeta(): Record<string, unknown> {
  return {
    ui: {
      resourceUri: UI5_LINT_FINDINGS_RESOURCE_URI
    },
    source: {
      kind: 'ui5-linter',
      note: 'Ignore actions can persist to the bundled demo app through ui5lint.config.cjs or ui5lint-disable comments.'
    }
  };
}

function buildMissingLintResult(message?: string): CallToolResult {
  const text = message
    ? `No UI5 linter report is available. ${message}`
    : [
        'No UI5 linter report was passed.',
        'Call show_ui5_lint_findings without input to lint the bundled demo_app through @ui5/mcp-server with ui5lint CLI fallback.'
      ].join(' ');

  return {
    content: [
      {
        type: 'text',
        text
      }
    ],
    structuredContent: {
      mode: 'missing',
      message: text,
      ignoreState: EMPTY_IGNORE_STATE
    }
  };
}

function readLintInput(args: {
  ui5LintJson?: string;
  appName?: string;
  ignoreState?: Partial<IgnoreState>;
}): { ok: true; rawFiles: RawLintFileResult[]; source: string } | { ok: false; message?: string } {
  try {
    if (args.ui5LintJson) {
      return {
        ok: true,
        rawFiles: parseUi5LintJson(args.ui5LintJson),
        source: '@ui5/mcp-server run_ui5_linter / ui5lint JSON'
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  return { ok: false };
}

async function runPreferredUi5Lint(
  projectDir: string,
  filePatterns?: string[]
): Promise<{ rawFiles: RawLintFileResult[]; source: string }> {
  try {
    return await runUi5McpServerLint(projectDir, filePatterns);
  } catch (ui5McpError) {
    try {
      const rawFiles = await runUi5LintCli(projectDir, filePatterns);
      return {
        rawFiles,
        source: [
          `ui5lint --format json${filePatterns?.length ? ` ${filePatterns.join(' ')}` : ''}`,
          `(fallback after @ui5/mcp-server failed: ${errorMessage(ui5McpError)})`
        ].join(' ')
      };
    } catch (cliError) {
      throw new Error([
        'Could not run UI5 linter.',
        `@ui5/mcp-server failed: ${errorMessage(ui5McpError)}`,
        `ui5lint CLI failed: ${errorMessage(cliError)}`
      ].join(' '));
    }
  }
}

async function runUi5McpServerLint(
  projectDir: string,
  filePatterns?: string[]
): Promise<{ rawFiles: RawLintFileResult[]; source: string }> {
  // This MCP server temporarily becomes an MCP client of the specialized UI5 server.
  const client = new Client({
    name: 'ui5con-ui5-linter-bridge',
    version: '0.1.0'
  });
  const transport = new StdioClientTransport({
    command: process.env.UI5_MCP_SERVER_COMMAND ?? 'npx',
    args: parseCommandArgs(process.env.UI5_MCP_SERVER_ARGS, ['-y', '@ui5/mcp-server']),
    stderr: 'pipe'
  });
  const stderr: string[] = [];
  transport.stderr?.on('data', (chunk) => {
    stderr.push(Buffer.from(chunk).toString('utf8'));
  });

  try {
    await withTimeout(client.connect(transport), UI5_MCP_TIMEOUT_MS, '@ui5/mcp-server connect timed out');
    const result = await withTimeout(
      client.callTool({
        name: 'run_ui5_linter',
        arguments: {
          projectDir,
          fix: false,
          provideContextInformation: false,
          ...(filePatterns?.length ? { filePatterns } : {})
        }
      }),
      UI5_MCP_TIMEOUT_MS,
      '@ui5/mcp-server run_ui5_linter timed out'
    );

    return {
      rawFiles: extractRawLintResults(result.structuredContent ?? result),
      source: `@ui5/mcp-server run_ui5_linter (${projectDir})`
    };
  } catch (error) {
    const details = stderr.join('').trim();
    throw new Error(details ? `${errorMessage(error)} (${details})` : errorMessage(error));
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function runUi5LintCli(projectDir: string, filePatterns?: string[]): Promise<RawLintFileResult[]> {
  const command = process.env.UI5_LINTER_BIN ?? 'ui5lint';
  const args = ['--format', 'json', ...(filePatterns ?? [])];

  try {
    const result = await execFileAsync(command, args, {
      cwd: projectDir,
      maxBuffer: 20 * 1024 * 1024
    });
    return parseUi5LintJson(result.stdout);
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string };
    if (failed.stdout?.trim()) {
      return parseUi5LintJson(failed.stdout);
    }

    throw new Error([
      `Failed to run ${command} ${args.join(' ')} in ${projectDir}.`,
      failed.stderr || failed.message || ''
    ].join(' ').trim());
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseCommandArgs(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    // Fall back to shell-like whitespace splitting for simple local overrides.
  }

  return value.split(/\s+/).filter(Boolean);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
