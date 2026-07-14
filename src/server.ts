import { startHttpMcpServer } from './mcp-host.js';
import { registerAll } from './register-all.js';

// Root aggregator: every sample on one Streamable HTTP endpoint (easiest for MCPJam/Claude).
const port = Number(process.env.PORT ?? 3000);
startHttpMcpServer('ui5con-mcp-apps-samples', port, registerAll);
