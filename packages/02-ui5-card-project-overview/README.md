# 02 UI Integration Cards Project Overview

This sample renders the same Orders project data as sample 01, but uses declarative SAP UI
Integration Cards instead of a hand-built UI5 Web Components layout. It is the cleanest place
to compare imperative UI code with card manifests.

## What You Will Learn

- What a UI Integration Card manifest is and where it fits in an MCP App.
- How to generate Object and List Card manifests from typed server data.
- How card data binding keeps values separate from the visual definition.
- How an MCP App can load the SAPUI5 card runtime under host CSP controls.
- Which card types are a better portability fit than `sap.viz` Analytical Cards.

## The Tool and Result

The server exposes:

```text
show_ui5_project_cards
```

It takes no arguments and returns:

```text
content
structuredContent.overview
structuredContent.cardManifests
```

`overview` is the same logical fixture used in sample 01. `cardManifests` contains two plain
JSON objects built on the server:

1. An **Object Card** for project runtime and structure fields.
2. A **List Card** for project checks and their semantic states.

Returning the source overview as well as the derived manifests makes the contract explicit
and keeps the comparison with sample 01 inspectable.

## What Is a Card Manifest?

A manifest is a declarative description of a card. Instead of writing browser code for every
label and row, the server creates a JSON object with `sap.app` identity and `sap.card`
presentation sections.

A simplified example from this demo is:

```json
{
  "sap.app": {
    "id": "ui5con.project.overview.summary",
    "type": "card"
  },
  "sap.card": {
    "type": "Object",
    "header": {
      "title": "Orders",
      "status": { "text": "UI5 ..." }
    },
    "content": {
      "groups": []
    }
  }
}
```

For the List Card, data is included under `content.data.json`, a `path` selects the array, and
bindings such as `{title}` map each object to the list item template. The card runtime handles
the repetitive DOM creation.

## End-to-End Flow

1. The model calls `show_ui5_project_cards`.
2. The server loads the typed overview fixture.
3. `buildProjectCardManifests()` converts it into Object and List Card manifests.
4. The result returns both overview and manifests in `structuredContent`.
5. The host reads `ui://ui5-card-project-overview/index.html`.
6. Resource metadata allows `https://ui5.sap.com` as a resource and connection domain.
7. The iframe loads the SAPUI5 integration-card runtime and connects to the MCP Apps bridge.
8. The app's `toolresult` event listener reads the payload.
9. `setManifest()` serializes each manifest into the matching `ui-integration-card` element.
10. The UI Integration Card runtime interprets the JSON and renders the standard cards.

The model never writes or modifies the manifests. They are deterministic output from the
server's `card-manifests.ts` code.

## Why This Card Sample Is Portable

Object and List Cards use standard card rendering paths and do not require the `sap.viz`
charting runtime. They are therefore a safer MCP App portability baseline than an Analytical
Card. In cross-host experiments, the Analytical Card shell could load while its chart stayed
blank because the `sap.viz` runtime needed execution capabilities blocked by the host.

Network-domain metadata and JavaScript execution policy are different things:

- `resourceDomains` and `connectDomains` allow the card runtime to load or contact named
  origins.
- They do not grant `unsafe-eval`, worker, popup, or other browser privileges.

## Files to Read in Order

1. `src/project-overview.ts` — shared data shape and fixture.
2. `src/card-manifests.ts` — Object/List Card construction and semantic-state mapping.
3. `src/register.ts` — UI tool, result contract, resource, and CSP domain metadata.
4. `app/index.html` — two fixed `ui-integration-card` elements.
5. `app/src/main.ts` — bridge result handling and manifest assignment.
6. `src/stdio.ts` and `src/server.ts` — stdio and HTTP launchers.

## Build and Run

From the repository root:

```bash
npm run build
```

### Stdio for Cursor or MCPJam

```text
command: node
args: /absolute/path/to/UI5con_2026_MCPApps/dist/packages/02-ui5-card-project-overview/src/stdio.js
```

Prompt:

```text
Call show_ui5_project_cards.
```

### Streamable HTTP

```bash
npm run start:02
```

Endpoint:

```text
http://127.0.0.1:3012/mcp
```

## Experiments

1. Open samples 01 and 02 with the same host and compare their project values.
2. In `card-manifests.ts`, change one card header title, rebuild sample 02, and observe that
   no rendering code needed to change.
3. Add a new check to the fixture. The List Card should produce a row through its item
   template.
4. Inspect the tool result in MCPJam's raw view and find the two JSON manifests before looking
   at the rendered cards.

## Common Problems

- **The iframe appears but cards do not:** inspect whether the host allowed and loaded
  `https://ui5.sap.com`; CSP/resource failures happen after a successful MCP tool call.
- **Old card content remains after editing:** rebuild the Vite app so the single-file UI
  resource contains the current code.
- **An Analytical Card fails while these cards work:** loading a UI5 resource origin and
  permitting the chart runtime's `unsafe-eval` or Worker behavior are separate CSP concerns.

Next: [`03-ui5-lint-findings`](../03-ui5-lint-findings/README.md) turns the UI from a result
viewer into a multi-step developer workflow.
