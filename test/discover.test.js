import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverInfrastructureFiles, LIMITS } from '../src/repo/discover.js';

function createFixtureDirectory() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'guardai-discover-'));

  writeFileSync(path.join(root, 'main.tf'), 'resource "aws_s3_bucket" "a" {}\n');
  writeFileSync(path.join(root, 'values.tfvars'), 'region = "eu-west-1"\n');
  writeFileSync(path.join(root, 'README.md'), 'not infrastructure\n');

  mkdirSync(path.join(root, 'modules', 'network'), { recursive: true });
  writeFileSync(path.join(root, 'modules', 'network', 'vpc.tf'), 'resource "aws_vpc" "a" {}\n');

  mkdirSync(path.join(root, 'node_modules', 'junk'), { recursive: true });
  writeFileSync(path.join(root, 'node_modules', 'junk', 'ignored.tf'), 'ignored\n');

  mkdirSync(path.join(root, '.terraform'), { recursive: true });
  writeFileSync(path.join(root, '.terraform', 'cached.tf'), 'ignored\n');

  return root;
}

test('finds terraform files recursively and ignores noise directories', () => {
  const root = createFixtureDirectory();
  try {
    const { files } = discoverInfrastructureFiles(root);
    const paths = files.map((file) => file.path).sort();

    assert.deepEqual(paths, ['main.tf', 'modules/network/vpc.tf', 'values.tfvars']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses forward slashes in repository paths on every platform', () => {
  const root = createFixtureDirectory();
  try {
    const { files } = discoverInfrastructureFiles(root);
    for (const file of files) {
      assert.ok(!file.path.includes('\\'), `path contained a backslash: ${file.path}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skips files larger than the per-file limit', () => {
  const root = createFixtureDirectory();
  try {
    writeFileSync(path.join(root, 'huge.tf'), 'x'.repeat(LIMITS.maxFileBytes + 1));
    const { files, skipped } = discoverInfrastructureFiles(root);

    assert.ok(!files.some((file) => file.path === 'huge.tf'));
    assert.ok(skipped.some((entry) => entry.path === 'huge.tf' && entry.reason === 'file too large'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('returns an empty result for a directory with no infrastructure files', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'guardai-empty-'));
  try {
    const { files } = discoverInfrastructureFiles(root);
    assert.equal(files.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
