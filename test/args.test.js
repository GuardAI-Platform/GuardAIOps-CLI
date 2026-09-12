import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('parses boolean flags', () => {
  const { flags, errors } = parseArgs(['--mock', '--changed']);
  assert.equal(flags.mock, true);
  assert.equal(flags.changed, true);
  assert.deepEqual(errors, []);
});

test('parses value flags in both forms', () => {
  const spaced = parseArgs(['--fail-on', 'high']);
  const equals = parseArgs(['--fail-on=high']);
  assert.equal(spaced.flags['fail-on'], 'high');
  assert.equal(equals.flags['fail-on'], 'high');
});

test('reports a missing value instead of swallowing the next flag', () => {
  const { errors, flags } = parseArgs(['--fail-on', '--mock']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /requires a value/);
  assert.equal(flags['fail-on'], undefined);
});

test('reports unknown options', () => {
  const { errors } = parseArgs(['--not-a-real-flag']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unknown option/);
});

test('collects positional arguments', () => {
  const { positional } = parseArgs(['alpha', '--mock', 'beta']);
  assert.deepEqual(positional, ['alpha', 'beta']);
});
