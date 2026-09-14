import { formatLocation, formatSummaryCounts } from './report.js';

export const RESULT_COMMENT_MARKER = '<!-- guardai-scan-result -->';

export function buildMarkdownSummary(scanResult, verdict, { repository, files }) {
  const lines = [RESULT_COMMENT_MARKER, '', '## GuardAI Infrastructure Scan', ''];

  if (scanResult.source === 'mock') {
    lines.push('> **Mock mode.** These results did not come from the GuardAI API.');
    lines.push('');
  }

  lines.push(verdict.passed ? '**Result: PASS**' : '**Result: FAIL**');
  lines.push('');
  lines.push(`- Files scanned: ${files.length}`);
  lines.push(`- Findings: ${formatSummaryCounts(verdict.counts)}`);
  lines.push(`- Failure threshold: ${verdict.failOn} and above`);
  if (repository.commit) {
    lines.push(`- Commit: \`${repository.commit.slice(0, 8)}\``);
  }
  lines.push('');

  if (scanResult.findings.length > 0) {
    lines.push('| Severity | Finding | Location | Control |');
    lines.push('| --- | --- | --- | --- |');
    for (const finding of scanResult.findings) {
      lines.push(
        `| ${finding.severity.toUpperCase()} | ${finding.title} | \`${formatLocation(finding)}\` | ${finding.controlId ?? '-'} |`,
      );
    }
    lines.push('');
  }

  if (scanResult.reportUrl) {
    lines.push(`[View the full GuardAI report](${scanResult.reportUrl})`);
    lines.push('');
  }

  return lines.join('\n');
}
