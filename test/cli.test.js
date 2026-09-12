import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';
import { EXIT } from '../src/exit-codes.js';

async function runQuietly(args) {
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];

  console.log = (...parts) => output.push(parts.join(' '));
  console.error = (...parts) => output.push(parts.join(' '));

  try {
    const code = await run(args);
    return { code, output: output.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('no arguments prints usage and passes', async () => {
  const { code, output } = await runQuietly([]);
  assert.equal(code, EXIT.OK);
  assert.match(output, /Usage:/);
});

test('version prints a semantic version', async () => {
  const { code, output } = await runQuietly(['version']);
  assert.equal(code, EXIT.OK);
  assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
});

test('an unknown command is a usage error', async () => {
  const { code, output } = await runQuietly(['definitely-not-a-command']);
  assert.equal(code, EXIT.USAGE_ERROR);
  assert.match(output, /unknown command/);
});

test('an unknown scan option is a usage error', async () => {
  const { code } = await runQuietly(['scan', '--nope']);
  assert.equal(code, EXIT.USAGE_ERROR);
});

test('an invalid severity threshold is a usage error', async () => {
  const { code } = await runQuietly(['scan', '--mock', '--fail-on', 'banana']);
  assert.equal(code, EXIT.USAGE_ERROR);
});

test('the failing fixture exits with the violations code', async () => {
  const { code } = await runQuietly([
    'scan',
    '--mock',
    '--path',
    'examples/demo-repo/failing',
  ]);
  assert.equal(code, EXIT.VIOLATIONS_FOUND);
});

test('the passing fixture exits zero', async () => {
  const { code } = await runQuietly([
    'scan',
    '--mock',
    '--path',
    'examples/demo-repo/passing',
  ]);
  assert.equal(code, EXIT.OK);
});

test('a missing api configuration is a guardai error, not a violation', async () => {
  const savedUrl = process.env.GUARDAI_API_URL;
  const savedKey = process.env.GUARDAI_API_KEY;
  const savedMock = process.env.GUARDAI_MOCK;
  delete process.env.GUARDAI_API_URL;
  delete process.env.GUARDAI_API_KEY;
  delete process.env.GUARDAI_MOCK;

  try {
    const { code, output } = await runQuietly([
      'scan',
      '--path',
      'examples/demo-repo/passing',
    ]);
    assert.equal(code, EXIT.GUARDAI_ERROR);
    assert.doesNotMatch(output, /GUARDAI_API_KEY=/);
  } finally {
    if (savedUrl !== undefined) process.env.GUARDAI_API_URL = savedUrl;
    if (savedKey !== undefined) process.env.GUARDAI_API_KEY = savedKey;
    if (savedMock !== undefined) process.env.GUARDAI_MOCK = savedMock;
  }
});
