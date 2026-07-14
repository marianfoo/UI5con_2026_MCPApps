import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import { readBuiltAppResource } from '../../../src/mcp-host.js';

const HTML_TIME_RESOURCE_URI = 'ui://html-time/index.html';

export function registerHtmlTimeSample(server: McpServer): void {
  // registerAppTool is a normal MCP tool plus a link to the UI resource the host should render.
  registerAppTool(
    server,
    'show_time',
    {
      title: 'Show Time',
      description: [
        'Open a tiny MCP App that displays the current time.',
        'Use this tool when the user asks for the basic MCP Apps time demo.'
      ].join(' '),
      inputSchema: {
        offsetHours: z.number().int().min(-24).max(24).optional()
          .describe('Optional hour offset to apply to the current server time.')
      },
      _meta: {
        ui: {
          resourceUri: HTML_TIME_RESOURCE_URI
        }
      }
    },
    async (args) => buildTimeResult(args.offsetHours ?? 0)
  );

  // This helper has no UI of its own. The already-open app calls it through the host bridge.
  server.registerTool(
    'add_hour',
    {
      title: 'Add Hour',
      description: [
        'Read-only helper for the HTML time MCP App.',
        'The app button calls this tool to add hours to the displayed time.'
      ].join(' '),
      inputSchema: {
        isoTime: z.string().datetime().optional()
          .describe('Base ISO timestamp. Defaults to the current server time.'),
        hours: z.number().int().min(-12).max(12).optional()
          .describe('Number of hours to add. Defaults to 1.')
      }
    },
    async (args) => buildAddHourResult(args.isoTime, args.hours ?? 1)
  );

  // The host resolves the ui:// URI after a tool call and receives this prebuilt HTML app.
  registerAppResource(
    server,
    'HTML Time Demo',
    HTML_TIME_RESOURCE_URI,
    {
      title: 'HTML Time Demo',
      description: 'Plain HTML MCP App used to explain tool calls, UI resources, and app-triggered tool calls.'
    },
    async (uri) => readBuiltAppResource('00-html-time', uri)
  );
}

function buildTimeResult(offsetHours: number): CallToolResult {
  const base = new Date();
  const display = addHours(base, offsetHours);

  return buildTimeToolResult(display, offsetHours, `Current server time plus ${offsetHours} hour(s).`);
}

function buildAddHourResult(isoTime: string | undefined, hours: number): CallToolResult {
  const base = isoTime ? new Date(isoTime) : new Date();
  const display = addHours(base, hours);

  return buildTimeToolResult(display, hours, `Added ${hours} hour(s) to ${base.toISOString()}.`);
}

function buildTimeToolResult(display: Date, offsetHours: number, summary: string): CallToolResult {
  const isoTime = display.toISOString();

  return {
    // content keeps the tool useful to the model and to hosts that cannot render MCP Apps.
    content: [
      {
        type: 'text',
        text: `${summary} Result: ${isoTime}.`
      }
    ],
    // structuredContent is the stable data contract consumed by app/src/main.ts.
    structuredContent: {
      isoTime,
      offsetHours,
      formattedTime: new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC'
      }).format(display)
    }
  };
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
