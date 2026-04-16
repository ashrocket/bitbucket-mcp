#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  BitbucketClient,
  BitbucketApiError,
  BitbucketAuthError,
  allTools,
} from '@ashrocket/bitbucket-mcp-core';

async function main() {
  let client: BitbucketClient;
  try {
    client = BitbucketClient.fromEnv(process.env);
  } catch (err) {
    if (err instanceof BitbucketAuthError) {
      process.stderr.write(`[bitbucket-mcp] ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const server = new Server(
    { name: 'bitbucket-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const byName = new Map(allTools.map((t) => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = byName.get(name);
    if (!tool) {
      return errorResponse(`Unknown tool: ${name}`);
    }
    try {
      const result = await tool.handler(client, (args ?? {}) as Record<string, unknown>);
      return {
        content: [
          {
            type: 'text',
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return errorResponse(formatError(err));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    transport.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function errorResponse(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

function formatError(err: unknown): string {
  if (err instanceof BitbucketApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

main().catch((err) => {
  process.stderr.write(`[bitbucket-mcp] fatal: ${formatError(err)}\n`);
  process.exit(1);
});
