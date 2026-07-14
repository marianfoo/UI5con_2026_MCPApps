import { startStdioMcpServer } from '../../../src/mcp-host.js';
import { registerHtmlTimeSample } from './register.js';

// Command-based hosts start this process and exchange MCP messages over stdin/stdout.
await startStdioMcpServer('ui5con-00-html-time', registerHtmlTimeSample);
