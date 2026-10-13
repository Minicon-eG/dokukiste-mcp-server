#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { configuration } from './config.js';
import { createServer } from './server.js';

try {
  const config = configuration();
  const server = await createServer(config);
  const transport = new StdioServerTransport(undefined, undefined, { maxBufferSize: Math.ceil(config.maxBytes * 1.5) + 65536 });
  await server.connect(transport);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void server.close().finally(() => process.exit(0)); });
} catch (error) {
  const message = error instanceof Error ? error.message : 'Server startup failed';
  const key = process.env.DOKUKISTE_API_KEY;
  console.error(key ? message.split(key).join('[redacted]') : message);
  process.exitCode = 1;
}
