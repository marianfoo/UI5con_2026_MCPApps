import { startHttpMcpServer } from '../../../src/mcp-host.js';
import { registerUi5LintFindingsSample } from './register.js';

// All the HTTP/session plumbing lives once in src/mcp-host.ts — see LEARNING.md.
startHttpMcpServer('ui5con-03-ui5-lint-findings', 3013, registerUi5LintFindingsSample);
