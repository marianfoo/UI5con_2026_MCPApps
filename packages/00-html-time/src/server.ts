import { startHttpMcpServer } from '../../../src/mcp-host.js';
import { registerHtmlTimeSample } from './register.js';

// All the HTTP/session plumbing lives once in src/mcp-host.ts — see LEARNING.md.
startHttpMcpServer('ui5con-00-html-time', 3010, registerHtmlTimeSample);
