import { startStdioMcpServer } from '../../../src/mcp-host.js';
import { registerUi5CardProjectOverviewSample } from './register.js';

// Command-based hosts start this process and exchange MCP messages over stdin/stdout.
await startStdioMcpServer('ui5con-02-ui5-card-project-overview', registerUi5CardProjectOverviewSample);
