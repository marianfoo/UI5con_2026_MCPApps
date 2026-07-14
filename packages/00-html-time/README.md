# 00 HTML Time

This is the smallest complete MCP App in the repository. It uses plain HTML and TypeScript so
you can see the protocol lifecycle before adding UI5. Start here if tools, resources,
`structuredContent`, or the MCP Apps bridge are new to you.

## What You Will Learn

- How an MCP server advertises a tool to an AI host.
- How a tool result separates model-readable text from UI-oriented data.
- How a tool points the host to a prebuilt `ui://` resource.
- How the sandboxed app receives the result through the MCP Apps bridge.
- How a button inside the app can call a second server tool without generating a new UI.

## The Two Tools

### `show_time`

This is the UI-producing tool. It accepts an optional `offsetHours`, computes a timestamp, and
returns a result whose `structuredContent` looks like:

```json
{
  "isoTime": "2026-07-12T10:00:00.000Z",
  "offsetHours": 0,
  "formattedTime": "Jul 12, 2026, 10:00:00 AM"
}
```

Its tool metadata contains `_meta.ui.resourceUri: "ui://html-time/index.html"`. That tells an
MCP Apps host that this result has a visual companion.

### `add_hour`

This is a normal, read-only helper tool. The **Add 1 hour** button calls it through the app
bridge with the currently displayed ISO timestamp. The returned data has the same shape as
`show_time`, so the app can rerender without replacing the iframe.

## Data Flow from Prompt to UI

1. The host starts this MCP server and asks it to list tools.
2. The user asks for the time; the model selects `show_time` and supplies any offset.
3. `src/register.ts` validates the input and returns:
   - `content`, a short text answer for the model and non-UI hosts;
   - `structuredContent`, the timestamp fields used by the app.
4. The host sees the tool's `ui://html-time/index.html` reference.
5. The host reads that resource from the same MCP server.
6. The server returns the already-built `app/dist/index.html` with the MCP Apps MIME type.
7. The host places the HTML in a sandboxed iframe and provides the MCP Apps bridge.
8. `app/src/main.ts` connects an `App`, receives the `toolresult` event, and renders
   `structuredContent`.
9. Clicking **Add 1 hour** calls `add_hour` through `app.callServerTool(...)`.
10. The app receives the helper result and updates the existing UI.

The model chooses the first tool, but it does not create the clock markup or handle the
button. The UI is deterministic application code.

## MCP vs. MCP Apps in This Sample

| Part | Responsibility |
| --- | --- |
| MCP tool discovery and calls | Host ↔ Node.js server |
| `content` and `structuredContent` | Result contract returned by the server |
| `ui://html-time/index.html` | MCP resource read by the host |
| `App.connect()` and the `toolresult` listener | Sandboxed iframe ↔ host bridge |
| `callServerTool({ name: "add_hour", ... })` | App-initiated tool call routed by the host |

## Files to Read in Order

1. `src/register.ts` — registers both tools, their Zod input schemas, and the UI resource.
2. `app/src/main.ts` — connects to the bridge, renders the result, and handles the button.
3. `app/index.html` — fixed UI shell the browser bundle starts from.
4. `src/stdio.ts` — standalone stdio server used by Cursor and MCPJam.
5. `src/server.ts` — standalone Streamable HTTP server on port 3010.
6. `../../src/mcp-host.ts` — shared transport and built-resource implementation.

## Build and Run

From the repository root:

```bash
npm install
npm run build
```

### Stdio for Cursor or MCPJam

Configure a command-based MCP server:

```text
command: node
args: /absolute/path/to/UI5con_2026_MCPApps/dist/packages/00-html-time/src/stdio.js
```

Then prompt the host:

```text
Call show_time.
```

Or test input validation and model-selected arguments:

```text
Show the HTML time demo with an offset of 2 hours.
```

### Streamable HTTP

```bash
npm run start:00
```

Connect an HTTP-capable MCP client to:

```text
http://127.0.0.1:3010/mcp
```

## Experiments

1. Run `show_time` and confirm both a text answer and the visual clock appear.
2. Click **Add 1 hour** several times; the iframe should stay open while its data changes.
3. Ask for an offset outside `-24..24`; the server schema should reject it.
4. Use a host without MCP Apps support. The `content` fallback should still make the result
   useful even though no iframe is rendered.

## Common Problems

- **The tool exists but no UI appears:** verify the host supports MCP Apps, the build created
  `packages/00-html-time/app/dist/index.html`, and the tool metadata still references the
  registered URI exactly.
- **The host cannot start the server:** use an absolute path to the compiled `stdio.js` and run
  `npm run build` first.
- **The button cannot call `add_hour`:** the initial UI can render without a working callback;
  inspect whether the host supports app-initiated server tool calls.

Next: [`01-ui5-webc-project-overview`](../01-ui5-webc-project-overview/README.md) replaces the
plain HTML presentation with UI5 Web Components while keeping the same MCP Apps lifecycle.
