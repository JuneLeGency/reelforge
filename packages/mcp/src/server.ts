/**
 * MCP server wiring. Uses @modelcontextprotocol/sdk's low-level Server class
 * so we stay framework-minimal — no React, no decorators, no magic.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  rfCompileDsl,
  rfCompileDslInline,
  rfCompileHtml,
  rfPlanDuration,
} from './tools';

export const SERVER_INFO = {
  name: '@reelforge/mcp',
  version: '0.0.0',
} as const;

export const TOOLS: Tool[] = [
  {
    name: 'rf_compile_html',
    description:
      'Compile an HTML composition file at the given path into a Reelforge IR VideoProject JSON. ' +
      'Returns the project plus the total duration in ms.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to an HTML composition file (absolute or relative to the agent cwd).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'rf_compile_dsl',
    description:
      'Compile a JSON / JSON5 DSL config file into a Reelforge IR VideoProject. ' +
      'Returns the project + total duration. Writes a sibling __reelforge-dsl-<name>.html as a side effect.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to a .json or .json5 DSL config.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'rf_compile_dsl_inline',
    description:
      'Compile a JSON5-encoded DSL config string into an IR VideoProject. Useful when the agent has generated a config in-memory and does not want to write it to disk. baseDir defaults to cwd.',
    inputSchema: {
      type: 'object',
      properties: {
        json5: {
          type: 'string',
          description: 'JSON5 source for the DSL config.',
        },
        baseDir: {
          type: 'string',
          description: 'Directory to resolve asset paths against. Defaults to cwd.',
        },
      },
      required: ['json5'],
    },
  },
  {
    name: 'rf_plan_duration',
    description:
      'Given a Reelforge IR VideoProject, return its total duration in ms. Uses `config.duration` (seconds) if set, otherwise derives from the latest clip end.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'object',
          description: 'A VideoProject IR — shape per @reelforge/ir.',
        },
      },
      required: ['project'],
    },
  },
];

export function createServer(): Server {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;
    try {
      let result: unknown;
      switch (name) {
        case 'rf_compile_html':
          result = await rfCompileHtml({ path: args.path as string });
          break;
        case 'rf_compile_dsl':
          result = await rfCompileDsl({ path: args.path as string });
          break;
        case 'rf_compile_dsl_inline':
          result = await rfCompileDslInline({
            json5: args.json5 as string,
            ...(typeof args.baseDir === 'string' ? { baseDir: args.baseDir } : {}),
          });
          break;
        case 'rf_plan_duration':
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = rfPlanDuration({ project: args.project as any });
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: message }],
      };
    }
  });

  return server;
}

export async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
