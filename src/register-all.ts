import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerHtmlTimeSample } from '../packages/00-html-time/src/register.js';
import { registerUi5WebcProjectOverviewSample } from '../packages/01-ui5-webc-project-overview/src/register.js';
import { registerUi5CardProjectOverviewSample } from '../packages/02-ui5-card-project-overview/src/register.js';
import { registerUi5LintFindingsSample } from '../packages/03-ui5-lint-findings/src/register.js';
import { registerArc1TransportSample } from '../packages/04-arc1-transport/src/register.js';

/** Register every sample onto one server, in presentation order. */
export function registerAll(server: McpServer): void {
  registerHtmlTimeSample(server);
  registerUi5WebcProjectOverviewSample(server);
  registerUi5CardProjectOverviewSample(server);
  registerUi5LintFindingsSample(server);
  registerArc1TransportSample(server);
}
