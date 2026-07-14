import { startHttpMcpServer } from '../../../src/mcp-host.js';
import { registerArc1TransportSample } from './register.js';

// All the HTTP/session plumbing lives once in src/mcp-host.ts — see LEARNING.md.
startHttpMcpServer('ui5con-04-arc1-transport', 3014, registerArc1TransportSample);
