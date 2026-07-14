import { startStdioMcpServer } from '../../../src/mcp-host.js';
import { registerUi5LintFindingsSample } from './register.js';

// Command-based hosts start this process and exchange MCP messages over stdin/stdout.
await startStdioMcpServer('ui5con-03-ui5-lint-findings', registerUi5LintFindingsSample);
