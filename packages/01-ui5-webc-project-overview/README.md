# 01 UI5 Web Components Project Overview

This sample keeps the MCP Apps lifecycle from sample 00 and replaces the plain HTML view with
a custom UI made from UI5 Web Components. It renders a fixture describing an Orders UI5
project: metadata, libraries, file counts, and project checks.

## What You Will Learn

- How UI5 Web Components can run inside an MCP App's sandboxed iframe.
- How to import only the components an app uses.
- How to define a stable `structuredContent` contract and render it imperatively.
- How to map the MCP host's light/dark context to a UI5 theme.
- How a self-contained UI bundle avoids unnecessary CSP domain permissions.
- Why UI5 Web Components are a strong default for portable, custom MCP App interfaces.

## The Tool and Result

The server exposes one UI tool:

```text
show_ui5_project_overview
```

It takes no arguments. `buildProjectOverviewResult()` loads the local fixture and returns:

- `content`: a compact project summary for the model and text-only hosts;
- `structuredContent.overview`: the complete typed `Ui5ProjectOverview` object;
- result `_meta.source`: a note explaining that this demo uses fixture data.

The tool's `_meta.ui.resourceUri` points to:

```text
ui://ui5-webc-project-overview/index.html
```

The source note is useful for provenance, but the app does not depend on it. The primary UI
contract is `structuredContent.overview`.

## How the UI Works

`app/src/main.ts` imports only the UI5 Web Components used by this view: `Card`, `CardHeader`,
`MessageStrip`, `Tag`, `Text`, `Title`, `List`, and `ListItemStandard`. Importing individual
modules registers their custom elements in the browser without loading an entire control
catalogue.

The app registers its `toolresult` and `hostcontextchanged` listeners before calling
`App.connect()`, so early host notifications are not missed. The result handler reads the
overview and maps it into fixed UI elements:

- project title and description → card header properties;
- tool-versus-fixture provenance → a semantic message strip;
- version and theme → compact tags;
- view and controller counts → text-based summary metrics;
- metadata and section headings → text and title components;
- libraries → UI5 list items;
- checks → list items with Positive, Critical, Negative, or Information states.

Dynamic list items are created with `document.createElement()` and configured through UI5
component properties. This keeps project values as data instead of constructing HTML strings.
The surrounding CSS uses SAP theme variables, so the custom layout follows the active UI5
theme alongside the Web Components themselves.

The app also listens for the MCP Apps `hostcontextchanged` event. It maps the host's `light`
or `dark` value to `sap_horizon` or `sap_horizon_dark`, applies it to the document and UI5,
and reads the initial host context after `connect()`. Registering the listener before
connecting avoids missing an early host notification. The UI5 asset import bundles the theme
resources needed for this runtime switch.

## End-to-End Flow

1. The model calls `show_ui5_project_overview`.
2. The server builds the project overview and returns it under `structuredContent.overview`.
3. The host reads `ui://ui5-webc-project-overview/index.html`.
4. The resource response requests the host's border treatment with `prefersBorder: true`. It
   declares no external CSP domains because Vite bundles the imported UI5 components.
5. The host renders the bundled HTML in an iframe.
6. The app connects to the host bridge and receives the original tool result.
7. Host context selects the matching light or dark UI5 theme.
8. `renderOverview()` updates the prebuilt UI5 Web Components layout.

The `catch` branch renders the bundled fixture if the app is opened outside an MCP host. That
is convenient for local visual work, but a real MCP Apps run should use the bridge data.

## Why Compare This with Sample 02?

Samples 01 and 02 use the same dataset. The difference is presentation:

| Sample 01 | Sample 02 |
| --- | --- |
| Custom HTML layout using UI5 Web Components | Declarative UI Integration Card manifests |
| Rendering logic lives in `app/src/main.ts` | Most presentation lives in JSON manifests |
| Full control over layout and interactions | Faster for standard card-shaped summaries |
| UI dependency is bundled by Vite | SAPUI5 card runtime loads from `ui5.sap.com` |

This controlled comparison helps you choose a UI technology without confusing it with a data
or MCP transport change.

## Files to Read in Order

1. `src/project-overview.ts` — types, fixture, and model-readable summary.
2. `src/register.ts` — tool, result, `ui://` resource, and presentation metadata.
3. `app/index.html` — fixed semantic layout and UI5 custom elements.
4. `app/src/main.ts` — bridge handler and data-to-component mapping.
5. `app/src/styles.css` — responsive layout inside the host iframe.
6. `src/stdio.ts` and `src/server.ts` — stdio and HTTP entrypoints.

## Build and Run

From the repository root:

```bash
npm run build
```

### Stdio for Cursor or MCPJam

```text
command: node
args: /absolute/path/to/UI5con_2026_MCPApps/dist/packages/01-ui5-webc-project-overview/src/stdio.js
```

Prompt:

```text
Call show_ui5_project_overview.
```

### Streamable HTTP

```bash
npm run start:01
```

Endpoint:

```text
http://127.0.0.1:3011/mcp
```

## What to Observe

1. The text summary and visual UI describe the same project but serve different consumers.
2. The card layout is fixed even if the model phrases its surrounding response differently.
3. Status mapping happens in app code, not in the model.
4. The app needs no backend request after the tool result arrives; all project data is already
   in `structuredContent`.
5. Resize the host panel and observe how the same prebuilt UI adapts inside the iframe.
6. Switch the host between light and dark mode and observe the UI5 theme follow it.

## Common Problems

- **Blank or unstyled custom elements:** build the app first and check the browser console for
  a blocked or failed resource.
- **Text appears but the MCP App does not:** verify the host read the exact `ui://` URI and
  recognized the MCP Apps resource MIME type.
- **Fixture appears during local preview:** that is the intentional bridge-failure fallback;
  it does not prove a host delivered `structuredContent`.

Next: [`02-ui5-card-project-overview`](../02-ui5-card-project-overview/README.md) renders the
same object as declarative UI Integration Cards.
