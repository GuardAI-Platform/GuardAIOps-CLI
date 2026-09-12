import test from 'node:test';
import assert from 'node:assert/strict';
import { countBySeverity, decideVerdict, severityRank } from '../src/verdict.js';

const findings = [
  { severity: 'low', title: 'a' },
  { severity: 'medium', title: 'b' },
  { severity: 'high', title: 'c' },
];

test('orders severities correctly', () => {
  assert.ok(severityRank('critical') > severityRank('high'));
  assert.ok(severityRank('high') > severityRank('medium'));
  assert.ok(severityRank('medium') > severityRank('low'));
  assert.ok(severityRank('low') > severityRank('info'));
});

test('passes when there are no findings', () => {
  const verdict = decideVerdict({ findings: [], passed: null }, 'medium');
  assert.equal(verdict.passed, true);
  assert.equal(verdict.blocking.length, 0);
});

test('fails on findings at or above the threshold', () => {
  const verdict = decideVerdict({ findings, passed: null }, 'medium');
  assert.equal(verdict.passed, false);
  assert.equal(verdict.blocking.length, 2);
  assert.equal(verdict.decidedBy, 'client');
});

test('passes when all findings are below the threshold', () => {
  const verdict = decideVerdict({ findings, passed: null }, 'critical');
  assert.equal(verdict.passed, true);
  assert.equal(verdict.blocking.length, 0);
});

test('an explicit verdict from the api wins over the client threshold', () => {
  const verdict = decideVerdict({ findings, passed: true }, 'low');
  assert.equal(verdict.passed, true);
  assert.equal(verdict.decidedBy, 'api');
});

test('counts findings by severity', () => {
  const counts = countBySeverity(findings);
  assert.equal(counts.high, 1);
  assert.equal(counts.medium, 1);
  assert.equal(counts.low, 1);
  assert.equal(counts.critical, 0);
});
