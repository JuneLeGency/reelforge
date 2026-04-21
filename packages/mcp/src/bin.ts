#!/usr/bin/env bun
import { runStdio } from './server';

runStdio().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[@reelforge/mcp] fatal: ${msg}\n`);
  process.exit(1);
});
