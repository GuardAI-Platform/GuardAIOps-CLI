#!/usr/bin/env node

import { run } from '../src/cli.js';
import { EXIT } from '../src/exit-codes.js';

const args = process.argv.slice(2);

try {
  process.exitCode = await run(args);
} catch (error) {
  console.error(`guardai: internal error: ${error.message}`);
  process.exitCode = EXIT.GUARDAI_ERROR;
}
