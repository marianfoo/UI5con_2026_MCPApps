import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  type IgnoreState,
  normalizeIgnoreState
} from './lint-findings.js';

export type PersistentIgnoreAction = 'file' | 'line' | 'fileRule';

export interface PersistentIgnoreRequest {
  action: PersistentIgnoreAction;
  filePath: string;
  ruleId?: string;
  line?: number;
  ignoreState?: Partial<IgnoreState>;
}

export interface PersistentIgnoreResult {
  message: string;
  changedFile: string;
  ignoreState: IgnoreState;
}

const CONFIG_FILE = 'ui5lint.config.cjs';
const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.xml', '.html', '.yaml', '.yml']);

export async function applyPersistentIgnore(
  appRoot: string,
  request: PersistentIgnoreRequest
): Promise<PersistentIgnoreResult> {
  const safeFilePath = normalizeRelativeFilePath(request.filePath);
  const ignoreState = normalizeIgnoreState(request.ignoreState);

  if (request.action === 'file') {
    const changedFile = await addFileIgnore(appRoot, safeFilePath);
    return {
      changedFile,
      ignoreState: normalizeIgnoreState({
        ...ignoreState,
        files: [...ignoreState.files, safeFilePath]
      }),
      message: `Added ${safeFilePath} to ${CONFIG_FILE}.`
    };
  }

  if (!request.ruleId) {
    throw new Error('ruleId is required for line and fileRule ignores.');
  }

  if (request.action === 'line') {
    if (!request.line || request.line < 1) {
      throw new Error('A positive line number is required for line ignores.');
    }
    const changedFile = await addLineDirective(appRoot, safeFilePath, request.line, request.ruleId);
    return {
      changedFile,
      ignoreState: normalizeIgnoreState({
        ...ignoreState,
        lines: [...ignoreState.lines, { filePath: safeFilePath, line: request.line }]
      }),
      message: `Inserted ui5lint-disable-next-line for ${request.ruleId} in ${safeFilePath}:${request.line}.`
    };
  }

  const changedFile = await addFileRuleDirective(appRoot, safeFilePath, request.ruleId);
  return {
    changedFile,
    ignoreState: normalizeIgnoreState({
      ...ignoreState,
      fileRules: [...ignoreState.fileRules, { filePath: safeFilePath, ruleId: request.ruleId }]
    }),
    message: `Inserted file-level ui5lint-disable for ${request.ruleId} in ${safeFilePath}.`
  };
}

function normalizeRelativeFilePath(filePath: string): string {
  if (!filePath || path.isAbsolute(filePath)) {
    throw new Error('filePath must be a relative path inside the demo app.');
  }

  const normalized = filePath.replaceAll('\\', '/');
  if (normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error('filePath must not escape the demo app.');
  }

  return normalized;
}

async function addFileIgnore(appRoot: string, filePath: string): Promise<string> {
  const configPath = path.join(appRoot, CONFIG_FILE);
  const existing = await readOptional(configPath);
  const ignores = extractConfigIgnores(existing);

  if (!ignores.includes(filePath)) {
    ignores.push(filePath);
  }

  ignores.sort();
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, renderConfig(ignores), 'utf8');
  return CONFIG_FILE;
}

async function addLineDirective(
  appRoot: string,
  filePath: string,
  line: number,
  ruleId: string
): Promise<string> {
  const absolutePath = resolveSourcePath(appRoot, filePath);
  const source = await readFile(absolutePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const index = Math.min(line - 1, lines.length - 1);
  const target = lines[index] ?? '';
  const directive = buildLineDirective(filePath, target, ruleId);

  if (hasNearbyDirective(lines, index, directive)) {
    return filePath;
  }

  lines.splice(index, 0, directive);
  await writeFile(absolutePath, lines.join(eol), 'utf8');
  return filePath;
}

async function addFileRuleDirective(appRoot: string, filePath: string, ruleId: string): Promise<string> {
  const absolutePath = resolveSourcePath(appRoot, filePath);
  const source = await readFile(absolutePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const directive = buildFileDirective(filePath, ruleId);

  if (source.includes(`ui5lint-disable ${ruleId}`)) {
    return filePath;
  }

  lines.splice(findFileDirectiveInsertIndex(lines, filePath), 0, directive);
  await writeFile(absolutePath, lines.join(eol), 'utf8');
  return filePath;
}

function resolveSourcePath(appRoot: string, filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(extension)) {
    throw new Error([
      `UI5 linter directives are not supported for ${extension || 'extensionless'} files.`,
      'Use Ignore file to add an ignores entry to ui5lint.config.cjs.'
    ].join(' '));
  }

  const resolved = path.resolve(appRoot, filePath);
  const root = path.resolve(appRoot);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Resolved file path escapes the demo app.');
  }
  return resolved;
}

function buildLineDirective(filePath: string, targetLine: string, ruleId: string): string {
  const indentation = targetLine.match(/^\s*/)?.[0] ?? '';
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.js' || extension === '.ts') {
    return `${indentation}// ui5lint-disable-next-line ${ruleId} -- ignored from MCP App`;
  }
  if (extension === '.yaml' || extension === '.yml') {
    return `${indentation}# ui5lint-disable-next-line ${ruleId}`;
  }
  return `${indentation}<!-- ui5lint-disable-next-line ${ruleId} -->`;
}

function buildFileDirective(filePath: string, ruleId: string): string {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.js' || extension === '.ts') {
    return `/* ui5lint-disable ${ruleId} */`;
  }
  if (extension === '.yaml' || extension === '.yml') {
    return `# ui5lint-disable ${ruleId}`;
  }
  return `<!-- ui5lint-disable ${ruleId} -->`;
}

function findFileDirectiveInsertIndex(lines: string[], filePath: string): number {
  const extension = path.extname(filePath).toLowerCase();
  if ((extension === '.html' || extension === '.xml') && lines[0]?.startsWith('<?xml')) {
    return 1;
  }
  if (extension === '.html' && /^<!doctype/i.test(lines[0] ?? '')) {
    return 1;
  }
  return 0;
}

function hasNearbyDirective(lines: string[], index: number, directive: string): boolean {
  return lines.slice(Math.max(0, index - 2), index + 1).some((line) => line.trim() === directive.trim());
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function extractConfigIgnores(source: string | undefined): string[] {
  if (!source) {
    return [];
  }

  const ignoresBlock = source.match(/ignores\s*:\s*\[([\s\S]*?)\]/)?.[1];
  if (!ignoresBlock) {
    return [];
  }

  return [...ignoresBlock.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function renderConfig(ignores: string[]): string {
  return [
    'module.exports = {',
    '  ignores: [',
    ...ignores.map((ignore) => `    ${JSON.stringify(ignore)},`),
    '  ],',
    '};',
    ''
  ].join('\n');
}
