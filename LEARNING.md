# Learn MCP Apps with UI5, Step by Step

This repository is a small hands-on course for developers who are new to the Model Context
Protocol (MCP). The five UI5con samples deliberately add one idea at a time. Work through
them in numeric order; later samples reuse the same patterns instead of hiding them behind a
framework.

Before starting, install Node.js 22, run `npm ci`, and then run `npm run build`. Use an MCP
Apps-capable host for the exercises. The browser fallback in some samples is helpful for
layout work, but it does not reproduce the host bridge or sandbox.

## Start with the Vocabulary

An **MCP server** makes capabilities available to an AI host. A capability can be a tool the
model calls, a resource the host reads, or another MCP primitive. An **MCP host** is the
application that runs the conversation, such as Cursor or MCPJam.

An **MCP App** adds an interactive, prebuilt web interface to a tool result. The important
separation is:

- The **model** decides which tool to call and supplies its arguments.
- The **server** validates the arguments, performs the operation, and returns data.
- The **host** reads the referenced UI resource and places it in a sandboxed iframe.
- The **app** renders the structured data and may call tools or send a message through the
  host-provided bridge.

The model does not write the HTML shown for each request. Every UI in this repository is
built ahead of time from the code under `packages/<sample>/app/`.

## One Complete Request

The first sample implements this entire sequence:

```text
user prompt
  -> model chooses an MCP tool
  -> host sends tools/call to the MCP server
  -> server returns content + structuredContent
  -> tool metadata points to a ui:// resource
  -> host reads that resource from the MCP server
  -> host renders the returned HTML in a sandboxed iframe
  -> host bridge delivers the tool result to the iframe
  -> prebuilt app renders structuredContent
  -> optional UI action calls a tool or messages the host through the bridge
```

There are two protocols in that picture:

1. MCP connects the **host and server**.
2. The MCP Apps bridge connects the **sandboxed app and host**.

Keeping those boundaries separate makes debugging much easier. A successful tool call does
not automatically mean the UI resource loaded, and a loaded UI shell does not automatically
mean a third-party UI library is compatible with the host's Content Security Policy (CSP).

## The Result Contract

Most UI tools in this repository return these fields:

| Field | Consumer | Purpose |
| --- | --- | --- |
| `content` | Model and non-UI hosts | Short summary and graceful text fallback. |
| `structuredContent` | Prebuilt app, and sometimes the model | Stable, typed data contract used for rendering. |
| `_meta` on the result | Host/app plumbing | Extra information that should not be the main user-facing answer. |
| `_meta.ui.resourceUri` on the tool | MCP host | Identifies the `ui://` resource to render for the result. |

The UI resource is registered separately. When the host reads it, the server returns bundled
HTML with the MCP Apps MIME type. Resource metadata can also declare preferences such as a
border and CSP network allowlists.

`structuredContent` is the key architectural seam. The server owns facts and side effects;
the app owns presentation. The model only needs to route the right data between them.

## Learning Path

| Step | Sample | New idea | Question it answers |
| --- | --- | --- | --- |
| 0 | [`00-html-time`](packages/00-html-time) | Plain HTML, one UI tool, and one app-to-server tool call | What is the smallest complete MCP App? |
| 1 | [`01-ui5-webc-project-overview`](packages/01-ui5-webc-project-overview) | Custom UI built with UI5 Web Components | How can an SAP-style UI render structured tool data? |
| 2 | [`02-ui5-card-project-overview`](packages/02-ui5-card-project-overview) | Declarative UI Integration Object and List Cards | When is a card manifest simpler than custom UI code? |
| 3 | [`03-ui5-lint-findings`](packages/03-ui5-lint-findings) | Real developer tooling, sibling MCP orchestration, callbacks, and persistence | How does an MCP App become an interactive workflow? |
| 4 | [`04-arc1-transport`](packages/04-arc1-transport) | Live SAP data supplied by ARC-1 and a confirmed write request | How can one MCP server visualize another server's data safely? |

## What to Notice in Each Sample

### 00: Separate data from presentation

Follow `show_time` from registration to result to the app's `toolresult` event listener. Then
follow the **Add 1 hour** button in the other direction: iframe → bridge → `add_hour` → result
→ iframe. This is the whole lifecycle without UI5 in the way.

### 01: Use UI5 Web Components as ordinary web components

The server returns a project overview object. The app imports only the UI5 components it
needs and maps the object to cards and lists. This approach gives the app full layout and
interaction control and has worked reliably under strict MCP App sandboxes.

### 02: Move presentation into card manifests

This sample uses exactly the same project dataset as sample 01. The server converts that data
into an Object Card manifest and a List Card manifest; the app mostly passes the manifests to
`ui-integration-card`. Comparing 01 and 02 isolates the presentation choice from the data.

### 03: Build a workflow, not just a result view

The UI opens first, calls a linter tool through the bridge, filters the returned findings,
persists a narrowly scoped ignore, and reruns the linter. It also demonstrates server-to-server
composition: this demo can launch the official UI5 MCP server as a child client and normalize
its output for the UI.

### 04: Let the host orchestrate specialized servers

ARC-1 owns the SAP connection and SAP write controls. This UI server owns the SE01-style
presentation. The model calls ARC-1, then passes its structured result to the UI tool. A
confirmed **Release Task** action sends a new user message to the host; it does not smuggle SAP
credentials or execute an unreviewed write inside the iframe.

## Repository Shape

Each sample follows the same structure:

```text
packages/<sample>/
  src/register.ts       register tool(s), schemas, ui:// resource, and result builder
  src/<domain>.ts       types, fixture/normalizer, summaries, or manifest builders
  src/server.ts         standalone Streamable HTTP launcher
  src/stdio.ts          standalone stdio launcher for Cursor/MCPJam
  app/index.html        iframe document and static UI shell
  app/src/main.ts       MCP Apps bridge connection and rendering
  app/src/styles.css    app styling
  app/dist/index.html   generated single-file UI resource after the build

src/mcp-host.ts         shared HTTP/stdio and built-resource plumbing
src/register-all.ts     combines all samples into the root server
README.md               setup, sample index, and operational guardrails
LEARNING.md             repository-wide concepts and learning path
```

The browser bundle and the Node.js MCP server are built separately. Vite creates one HTML
file per app; TypeScript compiles the server code into `dist/`.

## Build and Verify

From the repository root:

```bash
npm ci
npm run build
```

What these commands prove:

- `npm ci` installs exactly the dependency versions recorded in `package-lock.json`.
- `npm run build` bundles all five iframe apps and compiles the server TypeScript.

To check the MCP Apps protocol, start `npm run start` in one terminal and run
`npm run test:mcpjam` in another. Build and conformance checks prove that the server and
resources are internally coherent. They cannot prove that every host uses the same sandbox
policy.

The samples intentionally avoid an Analytical Integration Card. Its `sap.viz` runtime can
require execution paths such as `unsafe-eval` and Web Workers that strict hosts may block.
Allowing `ui5.sap.com` as a resource domain is not the same as granting those browser
capabilities. Object and List Cards are used as the more portable baseline.

## Choose a Transport

The demos support two MCP transports:

- **stdio**: the host starts `node .../stdio.js` and communicates through the process's
  standard input/output. This is the normal setup for Cursor and MCPJam.
- **Streamable HTTP**: you start `npm run start:<number>` and connect the host to
  `http://127.0.0.1:301<number>/mcp`. This is convenient for protocol inspection and local
  conformance tests.

For example, after `npm run build`, sample 00 can be launched over stdio with:

```text
command: node
args: /absolute/path/to/UI5con_2026_MCPApps/dist/packages/00-html-time/src/stdio.js
```

Use the exact absolute path on your machine. Give each configured server a stable, unique
name; matching the package's server name avoids host-specific metadata lookup problems.

## A Practical Debugging Checklist

When a tool returns text but no UI appears, check the layers in order:

1. Did the host discover the tool?
2. Did `tools/call` succeed and return `structuredContent`?
3. Does the tool advertise the expected `_meta.ui.resourceUri`?
4. Can the host read that exact `ui://` resource and its MCP Apps MIME type?
5. Did the iframe connect to the MCP Apps bridge and receive the `toolresult` event?
6. Did CSP allow the scripts, resources, connections, workers, and runtime behavior used by
   the chosen UI library?

Use `content` as the fallback at every stage. A user should still receive a useful answer if
their host does not support MCP Apps or rejects a particular UI dependency.

## Design Rules Demonstrated by the Repo

- Return concise model-readable `content` and strict UI-oriented `structuredContent`.
- Register one stable, prebuilt UI resource instead of asking the model to generate markup.
- Validate all tool inputs on the server, even when the caller is your own app.
- Keep credentials and sensitive side effects out of the iframe.
- Ask for confirmation before consequential writes and route them through the system that
  owns authorization.
- Declare only the external domains the app actually needs.
- Test in more than one host; MCP compatibility does not imply identical web sandbox behavior.
- Prefer UI5 Web Components, basic Integration Cards, or CSP-safe SVG for portable MCP Apps.

Continue with [`00-html-time`](packages/00-html-time/README.md), then compare samples 01 and
02 side by side.
