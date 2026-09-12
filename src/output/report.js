import { SEVERITY_ORDER, severityRank } from '../verdict.js';

function sortFindings(findings) {
  return [...findings].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }
    return String(left.path ?? '').localeCompare(String(right.path ?? ''));
  });
}

export function formatLocation(finding) {
  if (!finding.path) {
    return 'location not reported';
  }
  return finding.line ? `${finding.path}:${finding.line}` : finding.path;
}

export function formatSummaryCounts(counts) {
  const parts = [...SEVERITY_ORDER]
    .reverse()
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`);
  return parts.length === 0 ? 'none' : parts.join(', ');
}

export function renderHeader({ repository, files, isMock, changedOnly, baseRef }) {
  const lines = ['', 'GuardAI Infrastructure Scan', ''];

  lines.push(`Repository:  ${repository.slug ?? repository.root}`);
  if (repository.branch) {
    lines.push(`Branch:      ${repository.branch}`);
  }
  if (repository.commit) {
    lines.push(`Commit:      ${repository.commit.slice(0, 8)}`);
  }
  lines.push(`Source:      ${isMock ? 'MOCK (not the GuardAI API)' : 'GuardAI API'}`);
  if (changedOnly) {
    lines.push(`Scope:       files changed since ${baseRef}`);
  } else {
    lines.push('Scope:       all infrastructure files');
  }
  lines.push('');
  lines.push(`Found ${files.length} file${files.length === 1 ? '' : 's'} to scan.`);
  lines.push('');

  return lines.join('\n');
}

export function renderResult(scanResult, verdict) {
  const lines = [];
  const findings = sortFindings(scanResult.findings);

  if (findings.length === 0) {
    lines.push('Scan complete.');
    lines.push('');
    lines.push('PASS - no violations found');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`${findings.length} finding${findings.length === 1 ? '' : 's'} detected.`);
  lines.push('');

  for (const finding of findings) {
    lines.push(`  ${finding.severity.toUpperCase()}  ${finding.title}`);
    lines.push(`    ${formatLocation(finding)}`);
    if (finding.controlId) {
      lines.push(`    control: ${finding.controlId}`);
    }
    if (finding.remediation) {
      lines.push(`    fix: ${finding.remediation}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${formatSummaryCounts(verdict.counts)}`);

  if (verdict.decidedBy === 'client') {
    lines.push(`Failing on severity ${verdict.failOn} or higher.`);
  }

  if (scanResult.reportUrl) {
    lines.push(`Full report: ${scanResult.reportUrl}`);
  }

  lines.push('');
  lines.push(
    verdict.passed
      ? 'PASS - no findings at or above the failure threshold'
      : `FAIL - ${verdict.blocking.length} blocking finding${verdict.blocking.length === 1 ? '' : 's'}`,
  );
  lines.push('');

  return lines.join('\n');
}
