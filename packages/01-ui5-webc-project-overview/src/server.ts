import { startHttpMcpServer } from '../../../src/mcp-host.js';
import { registerUi5WebcProjectOverviewSample } from './register.js';

// All the HTTP/session plumbing lives once in src/mcp-host.ts — see LEARNING.md.
startHttpMcpServer('ui5con-01-ui5-webc-project-overview', 3011, registerUi5WebcProjectOverviewSample);
