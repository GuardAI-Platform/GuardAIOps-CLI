export const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'];

export const DEFAULT_FAIL_ON = 'medium';

export function isValidSeverity(severity) {
  return SEVERITY_ORDER.includes(severity);
}

export function severityRank(severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? 0 : index;
}

export function countBySeverity(findings) {
  const counts = {};
  for (const severity of SEVERITY_ORDER) {
    counts[severity] = 0;
  }
  for (const finding of findings) {
    if (counts[finding.severity] === undefined) {
      counts[finding.severity] = 0;
    }
    counts[finding.severity] += 1;
  }
  return counts;
}

export function decideVerdict(scanResult, failOn = DEFAULT_FAIL_ON) {
  const findings = scanResult.findings ?? [];
  const threshold = severityRank(failOn);
  const blocking = findings.filter((finding) => severityRank(finding.severity) >= threshold);

  if (typeof scanResult.passed === 'boolean') {
    return {
      passed: scanResult.passed,
      decidedBy: 'api',
      failOn,
      blocking,
      counts: countBySeverity(findings),
    };
  }

  return {
    passed: blocking.length === 0,
    decidedBy: 'client',
    failOn,
    blocking,
    counts: countBySeverity(findings),
  };
}
