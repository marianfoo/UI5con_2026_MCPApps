import { startHttpMcpServer } from '../../../src/mcp-host.js';
import { registerUi5CardProjectOverviewSample } from './register.js';

// All the HTTP/session plumbing lives once in src/mcp-host.ts — see LEARNING.md.
startHttpMcpServer('ui5con-02-ui5-card-project-overview', 3012, registerUi5CardProjectOverviewSample);
