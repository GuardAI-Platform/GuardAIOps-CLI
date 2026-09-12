import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runMockScanner } from '../src/api/mock-client.js';

function loadFixture(relativePath) {
  const absolutePath = path.join(process.cwd(), 'examples', 'demo-repo', relativePath);
  return [{ path: 'main.tf', content: readFileSync(absolutePath, 'utf8') }];
}

test('the failing fixture produces findings', () => {
  const findings = runMockScanner(loadFixture(path.join('failing', 'main.tf')));
  assert.ok(findings.length >= 4);

  const controls = findings.map((finding) => finding.controlId);
  assert.ok(controls.includes('MOCK-001'));
  assert.ok(controls.includes('MOCK-002'));
  assert.ok(controls.includes('MOCK-003'));
});

test('the passing fixture produces no findings', () => {
  const findings = runMockScanner(loadFixture(path.join('passing', 'main.tf')));
  assert.deepEqual(findings, []);
});

test('findings carry a path and a positive line number', () => {
  const findings = runMockScanner(loadFixture(path.join('failing', 'main.tf')));
  for (const finding of findings) {
    assert.equal(finding.path, 'main.tf');
    assert.ok(Number.isInteger(finding.line) && finding.line > 0);
  }
});

test('a variable reference is not treated as a hardcoded credential', () => {
  const findings = runMockScanner([
    { path: 'x.tf', content: 'password = var.database_password\n' },
  ]);
  assert.deepEqual(findings, []);
});
