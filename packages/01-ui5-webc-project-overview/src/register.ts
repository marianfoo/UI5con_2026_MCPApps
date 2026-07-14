import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import {
  getProjectOverview,
  summarizeProjectOverview
} from './project-overview.js';
import { readBuiltAppResource } from '../../../src/mcp-host.js';

const UI5_WEBC_RESOURCE_URI = 'ui://ui5-webc-project-overview/index.html';
// The bundle is self-contained, so this UI needs no external CSP domain permissions.
const UI5_WEBC_RESOURCE_META = {
  prefersBorder: true
};

export function registerUi5WebcProjectOverviewSample(server: McpServer): void {
  // The resourceUri joins this model-callable tool to the fixed UI registered below.
  registerAppTool(
    server,
    'show_ui5_project_overview',
    {
      title: 'Show UI5 Project Overview',
      description: [
        'Open a small UI5 Web Components MCP App for a UI5 project overview.',
        'Use this to demonstrate a custom UI5 layout before comparing it with the Integration Card sample.'
      ].join(' '),
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: UI5_WEBC_RESOURCE_URI
        }
      }
    },
    async () => buildProjectOverviewResult()
  );

  // UI code is built once and served as a resource; only structured data changes per tool call.
  registerAppResource(
    server,
    'UI5 Web Components Project Overview',
    UI5_WEBC_RESOURCE_URI,
    {
      title: 'UI5 Web Components Project Overview',
      description: 'Small UI5 Web Components view over a local UI5 project overview fixture.',
      _meta: {
        ui: UI5_WEBC_RESOURCE_META
      }
    },
    async (uri) => readBuiltAppResource('01-ui5-webc-project-overview', uri, {
      uiMeta: UI5_WEBC_RESOURCE_META
    })
  );
}

export function buildProjectOverviewResult(): CallToolResult {
  const overview = getProjectOverview();

  return {
    // The model gets a concise summary while the UI gets the full typed overview.
    content: [
      {
        type: 'text',
        text: summarizeProjectOverview(overview)
      }
    ],
    structuredContent: {
      overview
    },
    _meta: {
      source: {
        kind: 'fixture',
        note: 'The fixture describes the same UI5 demo project used by samples 02 and 03.'
      }
    }
  };
}
