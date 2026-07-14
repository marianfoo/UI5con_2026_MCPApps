import { startStdioMcpServer } from '../../../src/mcp-host.js';
import { registerUi5WebcProjectOverviewSample } from './register.js';

// Command-based hosts start this process and exchange MCP messages over stdin/stdout.
await startStdioMcpServer('ui5con-01-ui5-webc-project-overview', registerUi5WebcProjectOverviewSample);
