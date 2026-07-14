import { startStdioMcpServer } from '../../../src/mcp-host.js';
import { registerArc1TransportSample } from './register.js';

// Command-based hosts start this process and exchange MCP messages over stdin/stdout.
await startStdioMcpServer('ui5con-04-arc1-transport', registerArc1TransportSample);
