# UI5con 2026 MCP Apps Samples

Five runnable samples for learning how MCP tools can return deterministic, interactive UIs.
The examples progress from plain HTML to UI5 Web Components, UI Integration Cards, a UI5
linter workflow, and host-orchestrated SAP transport data.

This repository contains the reusable sample code and learning material. Speaker notes,
presentation files, editor-specific MCP configuration, generated output, helper scripts, and
the original test suite are intentionally not part of this publication copy.

## What an MCP App Adds

An ordinary MCP tool can return text and structured data. MCP Apps adds a prebuilt web UI that
the host renders in a sandboxed iframe:

```text
user asks for something
  -> model chooses an MCP tool
  -> server returns content + structuredContent
  -> tool metadata points to a ui:// resource
  -> host loads the prebuilt UI
  -> host bridge delivers the tool result to the iframe
  -> app renders structuredContent and may call another tool
```

The model chooses and connects tools; it does not generate the interface for each request.
That separation keeps the UI predictable and lets non-UI hosts fall back to `content`.

## Learning Path

| Step | Package | Main tool | What it demonstrates |
| --- | --- | --- | --- |
| 00 | [`00-html-time`](packages/00-html-time/README.md) | `show_time` | Smallest complete MCP App and an app-to-server callback. |
| 01 | [`01-ui5-webc-project-overview`](packages/01-ui5-webc-project-overview/README.md) | `show_ui5_project_overview` | UI5 Web Components, host theme synchronization, and structured rendering. |
| 02 | [`02-ui5-card-project-overview`](packages/02-ui5-card-project-overview/README.md) | `show_ui5_project_cards` | Declarative Object and List UI Integration Cards. |
| 03 | [`03-ui5-lint-findings`](packages/03-ui5-lint-findings/README.md) | `show_ui5_lint_findings` | Live developer tooling, server composition, callbacks, and a narrow file write. |
| 04 | [`04-arc1-transport`](packages/04-arc1-transport/README.md) | `show_arc1_transport_list`, `show_arc1_transport` | Host-orchestrated ARC-1 data and confirmation-gated SAP actions. |

New to MCP or MCP Apps? Read [`LEARNING.md`](LEARNING.md) first, then work through the package
READMEs in numeric order.

## Prerequisites

- Node.js 22 and npm.
- An MCP host that supports MCP Apps, such as Cursor, Claude Desktop, or MCPJam.
- Network access for installing npm dependencies.
- Sample 03 additionally launches `@ui5/mcp-server` with `npx` and can use a local `ui5lint`
  fallback.
- Sample 04 needs a separately configured ARC-1 server for live SAP data. Its `demo-data/`
  directory provides an explicitly labelled offline rehearsal fallback.

## Install and Build

```bash
git clone https://github.com/marianfoo/UI5con_2026_MCPApps.git
cd UI5con_2026_MCPApps
npm ci
npm run build
```

The build has two outputs:

- Vite bundles every iframe app into a single `packages/<sample>/app/dist/index.html`.
- TypeScript compiles the MCP servers into `dist/`.

Rebuild after changing app or server source. Generated build output is ignored by Git.

## Connect an MCP Host

### Stdio: all samples

Use the root aggregator when exploring the repository:

```text
command: node
args: /absolute/path/to/UI5con_2026_MCPApps/dist/src/stdio.js
```

The exact configuration screen differs by host. This repository intentionally does not ship
an `mcp.json`, because absolute paths and local server credentials are machine-specific.

For a focused demo, expose only one sample by using its compiled entrypoint:

| Sample | Command after `npm run build` |
| --- | --- |
| 00 | `npm run start:stdio:00` |
| 01 | `npm run start:stdio:01` |
| 02 | `npm run start:stdio:02` |
| 03 | `npm run start:stdio:03` |
| 04 | `npm run start:stdio:04` |

When the host starts the process itself, configure `node` with the corresponding absolute
`dist/packages/<sample>/src/stdio.js` path instead of running the npm command manually.

### Streamable HTTP

Start the aggregate server:

```bash
npm run start
```

Then connect an HTTP-capable client to:

```text
http://127.0.0.1:3000/mcp
```

Each package also has a standalone HTTP command from `npm run start:00` through
`npm run start:04`; their ports are `3010` through `3014`.

## First Prompts to Try

```text
Call show_time.
```

```text
Call show_ui5_project_overview.
```

```text
Call show_ui5_project_cards.
```

```text
Call show_ui5_lint_findings.
```

Sample 04 needs ARC-1 data first; its README contains the complete safe orchestration prompt.

## Verify the Publication Copy

The essential local verification is:

```bash
npm ci
npm run build
```

For MCP Apps protocol conformance, start the aggregate HTTP server in one terminal and run
the MCPJam check in another:

```bash
npm run start
npm run test:mcpjam
```

Conformance verifies protocol behavior, but it cannot guarantee identical rendering or CSP
behavior in every host. Test the samples in the hosts you intend to support.

## Repository Structure

```text
packages/<sample>/
  README.md             sample concepts, flow, setup, and experiments
  src/register.ts       tools, schemas, ui:// resource, and result builder
  src/<domain>.ts       types, normalization, fixtures, or manifests
  src/server.ts         standalone Streamable HTTP entrypoint
  src/stdio.ts          standalone stdio entrypoint
  app/index.html        fixed iframe document
  app/src/main.ts       MCP Apps bridge and rendering logic
  app/src/styles.css    app-specific presentation

src/mcp-host.ts         shared server and resource plumbing
src/register-all.ts     aggregate tool registration
src/server.ts           aggregate HTTP server
src/stdio.ts            aggregate stdio server
```

## Security and Portability Rules

- Treat `structuredContent` as a typed application contract, not generated markup.
- Validate every server tool input, including calls originating from your own iframe.
- Keep credentials and system connections on the server that owns them.
- Preserve useful `content` for hosts without MCP Apps support.
- Request only the CSP domains and iframe permissions a UI actually requires.
- Require explicit confirmation for consequential writes.
- Re-read authoritative data after a write rather than trusting optimistic UI state.
- Test strict and permissive hosts separately; MCP compatibility does not make their browser
  sandbox policies identical.

## Technology

- [`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps)
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)
- [UI5 Web Components](https://ui5.github.io/webcomponents/)
- [UI Integration Cards](https://ui5.sap.com/test-resources/sap/ui/integration/demokit/cardExplorer/index.html)
- [UI5 MCP Server](https://www.npmjs.com/package/@ui5/mcp-server)
