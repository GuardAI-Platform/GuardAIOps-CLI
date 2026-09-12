import { ContractMismatchError } from '../errors.js';
import { isValidSeverity } from '../verdict.js';

export const PROVISIONAL_SCAN_PATH = '/v1/scans';
export const PROVISIONAL_AUTH_HEADER = 'Authorization';
export const PROVISIONAL_AUTH_SCHEME = 'Bearer';
export const PROVISIONAL_CONTRACT_IS_UNVERIFIED = true;

export function buildScanRequestHeaders(apiKey, clientVersion) {
  return {
    [PROVISIONAL_AUTH_HEADER]: `${PROVISIONAL_AUTH_SCHEME} ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `guardai-cli/${clientVersion}`,
  };
}

export function buildScanRequestBody({ repository, ciContext, files, clientVersion }) {
  return {
    client: {
      name: 'guardai-cli',
      version: clientVersion,
    },
    repository: {
      slug: repository.slug,
      provider: repository.provider,
      branch: repository.branch,
      commit: repository.commit,
    },
    trigger: {
      ci: ciContext.provider,
      event: ciContext.eventName,
      pullRequestNumber: ciContext.pullRequestNumber,
      baseRef: ciContext.baseRef,
      headRef: ciContext.headRef,
    },
    files: files.map((file) => ({
      path: file.path,
      content: file.content,
    })),
  };
}

function normalizeSeverity(rawSeverity) {
  const severity = String(rawSeverity ?? '').toLowerCase();
  return isValidSeverity(severity) ? severity : 'medium';
}

function normalizeFinding(rawFinding) {
  if (!rawFinding || typeof rawFinding !== 'object') {
    throw new ContractMismatchError('a finding in the response was not an object');
  }

  const line = Number(rawFinding.line ?? rawFinding.lineNumber);

  return {
    severity: normalizeSeverity(rawFinding.severity),
    title: String(rawFinding.title ?? rawFinding.message ?? 'Untitled finding'),
    description: rawFinding.description ? String(rawFinding.description) : null,
    path: rawFinding.path ?? rawFinding.file ?? null,
    line: Number.isFinite(line) && line > 0 ? line : null,
    controlId: rawFinding.controlId ?? rawFinding.control ?? rawFinding.ruleId ?? null,
    remediation: rawFinding.remediation ?? null,
  };
}

export function normalizeScanResponse(body) {
  if (!body || typeof body !== 'object') {
    throw new ContractMismatchError('the response body was not a JSON object');
  }

  const rawFindings = body.findings ?? body.results ?? null;

  if (!Array.isArray(rawFindings)) {
    throw new ContractMismatchError('the response did not contain a findings array');
  }

  return {
    source: 'api',
    scanId: body.scanId ?? body.id ?? null,
    reportUrl: body.reportUrl ?? body.url ?? null,
    passed: typeof body.passed === 'boolean' ? body.passed : null,
    findings: rawFindings.map(normalizeFinding),
  };
}
