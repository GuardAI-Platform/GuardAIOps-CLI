import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractMismatchError } from '../src/errors.js';
import {
  buildScanRequestBody,
  buildScanRequestHeaders,
  normalizeScanResponse,
} from '../src/api/provisional-contract.js';

test('the auth header carries the key without logging it', () => {
  const headers = buildScanRequestHeaders('secret-key-value', '0.1.0');
  assert.equal(headers.Authorization, 'Bearer secret-key-value');
  assert.equal(headers['User-Agent'], 'guardai-cli/0.1.0');
});

test('the request body carries repository, trigger and file data', () => {
  const body = buildScanRequestBody({
    repository: { slug: 'acme/infra', provider: 'github', branch: 'main', commit: 'abc123' },
    ciContext: {
      provider: 'github',
      eventName: 'pull_request',
      pullRequestNumber: 7,
      baseRef: 'main',
      headRef: 'feature',
    },
    files: [{ path: 'main.tf', content: 'resource "x" "y" {}' }],
    clientVersion: '0.1.0',
  });

  assert.equal(body.repository.slug, 'acme/infra');
  assert.equal(body.trigger.pullRequestNumber, 7);
  assert.equal(body.files.length, 1);
  assert.equal(body.files[0].path, 'main.tf');
});

test('a well formed response is normalized', () => {
  const result = normalizeScanResponse({
    scanId: 'scan_1',
    passed: false,
    findings: [
      {
        severity: 'HIGH',
        title: 'Bucket is public',
        file: 'main.tf',
        line: 11,
        control: 'CTL-1',
      },
    ],
  });

  assert.equal(result.source, 'api');
  assert.equal(result.scanId, 'scan_1');
  assert.equal(result.passed, false);
  assert.equal(result.findings[0].severity, 'high');
  assert.equal(result.findings[0].path, 'main.tf');
  assert.equal(result.findings[0].controlId, 'CTL-1');
});

test('a response without a findings array is rejected rather than guessed at', () => {
  assert.throws(() => normalizeScanResponse({ status: 'ok' }), ContractMismatchError);
  assert.throws(() => normalizeScanResponse(null), ContractMismatchError);
});

test('an unknown severity falls back to medium rather than crashing', () => {
  const result = normalizeScanResponse({ findings: [{ severity: 'spicy', title: 'x' }] });
  assert.equal(result.findings[0].severity, 'medium');
});
