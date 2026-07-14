// Shared MCP host plumbing for every sample.
//
// A sample only needs to write its tool + UI (see any packages/<n>/src/register.ts).
// The HTTP/session boilerplate, the stdio launcher, and reading the built UI resource
// are identical for all of them, so they live here once instead of in every package.

import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

/** Each sample registers its tools + UI resources through this callback. */
export type RegisterSample = (server: McpServer) => void;

/**
 * Return a sample's built UI as its `ui://` resource. The UI is bundled to
 * `packages/<packageName>/app/dist/index.html`; `uiMeta` carries MCP Apps UI
 * metadata (CSP, prefersBorder, …).
 */
export function readBuiltAppResource(
  packageName: string,
  uri: URL,
  options: { uiMeta?: Record<string, unknown> } = {}
) {
  const html = readFileSync(
    resolveRepoPath('packages', packageName, 'app', 'dist', 'index.html'),
    'utf-8'
  );

  return {
    contents: [
      {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        ...(options.uiMeta ? { _meta: { ui: options.uiMeta } } : {})
      }
    ]
  };
}

/** Resolve a repository file independently of the process working directory. */
export function resolveRepoPath(...segments: string[]): string {
  return path.join(repoRoot(), ...segments);
}

/** Run one or more samples as a stdio MCP server (for command-launched hosts). */
export async function startStdioMcpServer(name: string, register: RegisterSample): Promise<void> {
  const server = new McpServer({ name, version: '0.1.0' });
  register(server);
  await server.connect(new StdioServerTransport());
}

/** Run one or more samples as a Streamable HTTP MCP server (for URL-based hosts). */
export function startHttpMcpServer(name: string, port: number, register: RegisterSample): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const app = express();

  app.use(cors({
    origin: true,
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'MCP-Protocol-Version']
  }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.type('text/plain').send(`${name}\n\nMCP endpoint: http://localhost:${port}/mcp`);
  });

  app.post('/mcp', async (req, res) => {
    const sessionId = getSessionId(req);
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Missing or unknown MCP session. Send initialize first.' },
          id: null
        });
        return;
      }

      const server = new McpServer({ name, version: '0.1.0' });
      register(server);

      const created: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: false,
        onsessioninitialized: (id) => {
          transports.set(id, created);
        }
      });
      created.onclose = () => {
        if (created.sessionId) {
          transports.delete(created.sessionId);
        }
      };
      await server.connect(created);
      transport = created;
    }

    await transport.handleRequest(req, res, req.body);
  });

  const handleBySession = async (req: express.Request, res: express.Response) => {
    const sessionId = getSessionId(req);
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send('Missing or unknown MCP session ID');
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get('/mcp', handleBySession);
  app.delete('/mcp', handleBySession);

  app.listen(port, () => {
    console.log(`${name} listening on http://localhost:${port}/mcp`);
  });
}

function getSessionId(req: express.Request): string | undefined {
  const raw = req.headers['mcp-session-id'];
  return Array.isArray(raw) ? raw[0] : raw;
}

// Walk up to the repo root (the directory with package.json) so the UI resource
// path resolves whether the server runs from dist/ or via tsx.
function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}
