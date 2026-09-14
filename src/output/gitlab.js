import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULT_COMMENT_MARKER } from './summary.js';

const GITLAB_SEVERITY_BY_GUARDAI_SEVERITY = {
  info: 'info',
  low: 'minor',
  medium: 'major',
  high: 'critical',
  critical: 'blocker',
};

function buildFingerprint(finding) {
  const identity = [finding.path, finding.line, finding.controlId, finding.title].join('|');
  return createHash('sha256').update(identity).digest('hex').slice(0, 32);
}

export function buildCodeQualityReport(findings) {
  return findings.map((finding) => ({
    description: finding.remediation
      ? `${finding.title}. Suggested fix: ${finding.remediation}`
      : finding.title,
    check_name: finding.controlId ?? 'guardai',
    fingerprint: buildFingerprint(finding),
    severity: GITLAB_SEVERITY_BY_GUARDAI_SEVERITY[finding.severity] ?? 'major',
    location: {
      path: finding.path ?? '',
      lines: { begin: finding.line ?? 1 },
    },
  }));
}

export function writeCodeQualityReport(findings, filePath) {
  try {
    const directory = path.dirname(path.resolve(filePath));
    mkdirSync(directory, { recursive: true });
    writeFileSync(filePath, JSON.stringify(buildCodeQualityReport(findings), null, 2), 'utf8');
    return { written: true, path: filePath };
  } catch (error) {
    return { written: false, reason: error.message };
  }
}

function notesEndpoint(ciContext) {
  return `${ciContext.apiUrl}/projects/${encodeURIComponent(ciContext.projectId)}/merge_requests/${ciContext.mergeRequestId}/notes`;
}

async function findExistingNote(ciContext, token) {
  const response = await fetch(`${notesEndpoint(ciContext)}?per_page=100`, {
    headers: { 'PRIVATE-TOKEN': token },
  });

  if (!response.ok) {
    return null;
  }

  const notes = await response.json();
  if (!Array.isArray(notes)) {
    return null;
  }

  const existing = notes.find((note) => String(note.body ?? '').includes(RESULT_COMMENT_MARKER));
  return existing ? existing.id : null;
}

export async function postMergeRequestNote(markdown, ciContext) {
  const token = process.env.GUARDAI_GITLAB_TOKEN ?? process.env.GITLAB_TOKEN;

  if (!token) {
    return {
      posted: false,
      reason:
        'GITLAB_TOKEN is not set. CI_JOB_TOKEN cannot post merge request notes, so a project or personal access token with api scope is required.',
    };
  }
  if (!ciContext.projectId || !ciContext.mergeRequestId) {
    return { posted: false, reason: 'not running on a merge request pipeline' };
  }
  if (!ciContext.apiUrl) {
    return { posted: false, reason: 'CI_API_V4_URL is not set' };
  }

  try {
    const existingId = await findExistingNote(ciContext, token);
    const url = existingId ? `${notesEndpoint(ciContext)}/${existingId}` : notesEndpoint(ciContext);

    const response = await fetch(url, {
      method: existingId ? 'PUT' : 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: markdown }),
    });

    if (!response.ok) {
      return { posted: false, reason: `GitLab API returned HTTP ${response.status}` };
    }

    return { posted: true, updated: Boolean(existingId) };
  } catch {
    return { posted: false, reason: 'the GitLab API request failed' };
  }
}
