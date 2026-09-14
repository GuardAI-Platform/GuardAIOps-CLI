import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCodeQualityReport, writeCodeQualityReport } from '../src/output/gitlab.js';
import { detectCiContext } from '../src/ci/context.js';

const findings = [
  {
    severity: 'high',
    title: 'Bucket is public',
    path: 'infra/main.tf',
    line: 11,
    controlId: 'CTL-1',
    remediation: 'Make it private.',
  },
  { severity: 'low', title: 'Missing tag', path: 'infra/main.tf', line: 3, controlId: null },
];

function withEnvironment(variables, callback) {
  const saved = {};
  for (const [key, value] of Object.entries(variables)) {
    saved[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('maps guardai severities onto gitlab code quality severities', () => {
  const report = buildCodeQualityReport(findings);
  assert.equal(report[0].severity, 'critical');
  assert.equal(report[1].severity, 'minor');
});

test('code quality entries carry path, line and check name', () => {
  const report = buildCodeQualityReport(findings);
  assert.equal(report[0].location.path, 'infra/main.tf');
  assert.equal(report[0].location.lines.begin, 11);
  assert.equal(report[0].check_name, 'CTL-1');
  assert.match(report[0].description, /Suggested fix/);
});

test('fingerprints are stable and unique per finding', () => {
  const first = buildCodeQualityReport(findings);
  const second = buildCodeQualityReport(findings);
  assert.equal(first[0].fingerprint, second[0].fingerprint);
  assert.notEqual(first[0].fingerprint, first[1].fingerprint);
});

test('writes the report to disk as valid json', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'guardai-gitlab-'));
  const filePath = path.join(directory, 'nested', 'gl-code-quality-report.json');
  try {
    const result = writeCodeQualityReport(findings, filePath);
    assert.equal(result.written, true);

    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].location.path, 'infra/main.tf');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('detects a gitlab merge request pipeline', () => {
  const context = withEnvironment(
    {
      GITHUB_ACTIONS: undefined,
      GITLAB_CI: 'true',
      CI_PROJECT_PATH: 'acme/infra',
      CI_PROJECT_ID: '42',
      CI_MERGE_REQUEST_IID: '7',
      CI_API_V4_URL: 'https://gitlab.com/api/v4',
      CI_MERGE_REQUEST_TARGET_BRANCH_NAME: 'main',
      CI_COMMIT_SHA: 'abcdef1234',
      CI_PIPELINE_SOURCE: 'merge_request_event',
    },
    () => detectCiContext(),
  );

  assert.equal(context.provider, 'gitlab');
  assert.equal(context.repositorySlug, 'acme/infra');
  assert.equal(context.projectId, '42');
  assert.equal(context.mergeRequestId, 7);
  assert.equal(context.baseRef, 'main');
});

test('github takes precedence and gitlab fields stay null', () => {
  const context = withEnvironment(
    {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'acme/infra',
      GITHUB_EVENT_PATH: undefined,
      GITLAB_CI: undefined,
    },
    () => detectCiContext(),
  );

  assert.equal(context.provider, 'github');
  assert.equal(context.mergeRequestId, null);
});

test('outside ci the provider is none', () => {
  const context = withEnvironment(
    { GITHUB_ACTIONS: undefined, GITLAB_CI: undefined, CI: undefined },
    () => detectCiContext(),
  );

  assert.equal(context.provider, 'none');
});
