import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import {
  type Arc1TransportDetail,
  type Arc1TransportListItem,
  buildMissingArc1Data,
  normalizeArc1TransportDetail,
  normalizeArc1TransportList,
  parseArc1Json,
  summarizeTransportList,
  summarizeTransportReview
} from './arc1-transport.js';
import { readBuiltAppResource } from '../../../src/mcp-host.js';

const ARC1_TRANSPORT_RESOURCE_URI = 'ui://arc1-transport/index.html';
const ARC1_TRANSPORT_RESOURCE_META = {
  csp: {
    resourceDomains: ['https://cdn.jsdelivr.net']
  },
  prefersBorder: true
};

// passthrough validates the fields this UI needs without discarding extra ARC-1 data.
const arc1TransportObjectSchema = z.object({
  pgmid: z.string().optional(),
  type: z.string(),
  name: z.string(),
  wbtype: z.string().optional(),
  description: z.string().optional(),
  locked: z.boolean().optional(),
  position: z.string().optional()
}).passthrough();

const arc1TransportTaskSummarySchema = z.object({
  id: z.string(),
  description: z.string(),
  owner: z.string(),
  status: z.string(),
  objectCount: z.number().optional()
}).passthrough();

const arc1TransportListItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  owner: z.string(),
  status: z.string(),
  type: z.string(),
  target: z.string().optional(),
  targetDesc: z.string().optional(),
  objectCount: z.number().optional(),
  tasks: z.array(arc1TransportTaskSummarySchema).optional()
}).passthrough();

const arc1TransportTaskDetailSchema = z.object({
  id: z.string(),
  description: z.string(),
  owner: z.string(),
  status: z.string(),
  objectCount: z.number().optional(),
  objects: z.array(arc1TransportObjectSchema).optional()
}).passthrough();

const arc1TransportDetailSchema = z.object({
  id: z.string(),
  description: z.string(),
  owner: z.string(),
  status: z.string(),
  type: z.string(),
  target: z.string().optional(),
  targetDesc: z.string().optional(),
  objectCount: z.number().optional(),
  tasks: z.array(arc1TransportTaskDetailSchema).optional()
}).passthrough();

export function registerArc1TransportSample(server: McpServer): void {
  // The model first calls ARC-1, then passes its list result into this UI-producing tool.
  registerAppTool(
    server,
    'show_arc1_transport_list',
    {
      title: 'Show ARC-1 Transport List',
      description: [
        'Open a UI5 Web Components MCP App that renders ARC-1 SAPTransport list output.',
        'Use this after calling ARC-1 SAPTransport with action list and summary true.'
      ].join(' '),
      inputSchema: {
        transports: z.array(arc1TransportListItemSchema).optional()
          .describe('Parsed ARC-1 SAPTransport action=list result.'),
        arc1TransportsJson: z.string().optional()
          .describe('Raw JSON text from ARC-1 SAPTransport action=list as a fallback input.')
      },
      _meta: {
        ui: {
          resourceUri: ARC1_TRANSPORT_RESOURCE_URI
        }
      }
    },
    async (args) => buildArc1TransportListResult(args)
  );

  // Detail data selects a richer mode while reusing the same ui:// app and iframe code.
  registerAppTool(
    server,
    'show_arc1_transport',
    {
      title: 'Show ARC-1 Transport',
      description: [
        'Open a UI5 Web Components MCP App that renders ARC-1 SAPTransport get output.',
        'Use this after calling ARC-1 SAPTransport with action get for a transport ID.'
      ].join(' '),
      inputSchema: {
        transport: arc1TransportDetailSchema.optional()
          .describe('Parsed ARC-1 SAPTransport action=get result.'),
        arc1TransportJson: z.string().optional()
          .describe('Raw JSON text from ARC-1 SAPTransport action=get as a fallback input.'),
        transports: z.array(arc1TransportListItemSchema).optional()
          .describe('Optional parsed ARC-1 SAPTransport action=list result for the full request tree.')
      },
      _meta: {
        ui: {
          resourceUri: ARC1_TRANSPORT_RESOURCE_URI
        }
      }
    },
    async (args) => buildArc1TransportResult(args)
  );

  registerAppResource(
    server,
    'ARC-1 Transport Organizer',
    ARC1_TRANSPORT_RESOURCE_URI,
    {
      title: 'ARC-1 Transport Organizer',
      description: 'SE10-style UI5 tree and detail view for ARC-1 SAPTransport list and get output.',
      _meta: {
        ui: ARC1_TRANSPORT_RESOURCE_META
      }
    },
    async (uri) => readBuiltAppResource('04-arc1-transport', uri, {
      uiMeta: ARC1_TRANSPORT_RESOURCE_META
    })
  );
}

export function buildArc1TransportListResult(args: {
  transports?: Arc1TransportListItem[];
  arc1TransportsJson?: string;
}): CallToolResult {
  const parsed = readTransportListInput(args);
  if (!parsed.ok) {
    return buildMissingResult('transport list', parsed.message);
  }

  const transports = normalizeArc1TransportList(parsed.transports);

  return {
    content: [
      {
        type: 'text',
        text: summarizeTransportList(transports)
      }
    ],
    // mode is a discriminant for the app; it never has to infer state from the text summary.
    structuredContent: {
      mode: 'list',
      transports
    },
    _meta: {
      source: {
        kind: 'arc1-host-orchestrated',
        note: 'The host or model calls ARC-1 SAPTransport first and passes the list result into this UI tool.'
      }
    }
  };
}

export function buildArc1TransportResult(args: {
  transport?: Arc1TransportDetail;
  arc1TransportJson?: string;
  transports?: Arc1TransportListItem[];
}): CallToolResult {
  const parsed = readTransportDetailInput(args);
  if (!parsed.ok) {
    return buildMissingResult('transport detail', parsed.message);
  }

  const review = normalizeArc1TransportDetail(parsed.transport);
  const transports = args.transports ? normalizeArc1TransportList(args.transports) : [];

  return {
    content: [
      {
        type: 'text',
        text: summarizeTransportReview(review)
      }
    ],
    // ARC-1 owns SAP access; this server returns only normalized presentation data.
    structuredContent: {
      mode: 'review',
      transports,
      review
    },
    _meta: {
      source: {
        kind: 'arc1-host-orchestrated',
        note: 'The host or model calls ARC-1 SAPTransport first and passes the get result into this UI tool.'
      }
    }
  };
}

function readTransportListInput(args: {
  transports?: Arc1TransportListItem[];
  arc1TransportsJson?: string;
}): { ok: true; transports: Arc1TransportListItem[] } | { ok: false; message?: string } {
  if (args.transports) {
    return { ok: true, transports: args.transports };
  }

  if (!args.arc1TransportsJson) {
    return { ok: false };
  }

  try {
    return {
      ok: true,
      transports: parseArc1Json<Arc1TransportListItem[]>(args.arc1TransportsJson, 'ARC-1 transport list')
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function readTransportDetailInput(args: {
  transport?: Arc1TransportDetail;
  arc1TransportJson?: string;
}): { ok: true; transport: Arc1TransportDetail } | { ok: false; message?: string } {
  if (args.transport) {
    return { ok: true, transport: args.transport };
  }

  if (!args.arc1TransportJson) {
    return { ok: false };
  }

  try {
    return {
      ok: true,
      transport: parseArc1Json<Arc1TransportDetail>(args.arc1TransportJson, 'ARC-1 transport detail')
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildMissingResult(expected: string, detail?: string): CallToolResult {
  const missing = buildMissingArc1Data(expected);
  const text = detail
    ? `${missing.message} ${detail}`
    : `${missing.message} Call ARC-1 SAPTransport first and pass its JSON result into this tool.`;

  return {
    content: [
      {
        type: 'text',
        text
      }
    ],
    structuredContent: {
      ...missing,
      message: text
    }
  };
}
