import { startStdioMcpServer } from './mcp-host.js';
import { registerAll } from './register-all.js';

// Root aggregator over stdio (for command-launched MCP clients).
await startStdioMcpServer('ui5con-mcp-apps-samples', registerAll);
