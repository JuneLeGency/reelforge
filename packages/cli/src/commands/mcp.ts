import { defineCommand } from 'citty';
import { runStdio } from '@reelforge/mcp';

export const mcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description: 'Start the Reelforge MCP server on stdio (for AI agents like Claude Code)',
  },
  args: {},
  async run() {
    await runStdio();
  },
});
