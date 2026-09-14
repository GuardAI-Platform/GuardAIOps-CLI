import { appendFileSync } from 'node:fs';
import { severityRank } from '../verdict.js';
import { RESULT_COMMENT_MARKER } from './summary.js';

function escapeAnnotationValue(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function escapeAnnotationMessage(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function writeAnnotations(findings, failOn) {
  const threshold = severityRank(failOn);

  for (const finding of findings) {
    const command = severityRank(finding.severity) >= threshold ? 'error' : 'warning';
    const properties = [`title=${escapeAnnotationValue(`GuardAI: ${finding.title}`)}`];

    if (finding.path) {
      properties.push(`file=${escapeAnnotationValue(finding.path)}`);
    }
    if (finding.line) {
      properties.push(`line=${finding.line}`);
    }

    const detail = finding.remediation ? ` Suggested fix: ${finding.remediation}` : '';
    const message = `[${finding.severity.toUpperCase()}] ${finding.title}.${detail}`;

    console.log(`::${command} ${properties.join(',')}::${escapeAnnotationMessage(message)}`);
  }
}

export function writeJobSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return false;
  }
  try {
    appendFileSync(summaryPath, `${markdown}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function writeStepOutputs(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return false;
  }
  try {
    const lines = Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    appendFileSync(outputPath, `${lines}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function findExistingComment(apiBase, slug, pullRequestNumber, token) {
  const response = await fetch(
    `${apiBase}/repos/${slug}/issues/${pullRequestNumber}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const comments = await response.json();
  if (!Array.isArray(comments)) {
    return null;
  }

  const existing = comments.find((comment) =>
    String(comment.body ?? '').includes(RESULT_COMMENT_MARKER),
  );
  return existing ? existing.id : null;
}

export async function postPullRequestComment(markdown, ciContext) {
  const token = process.env.GITHUB_TOKEN;
  const apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com';

  if (!token) {
    return { posted: false, reason: 'GITHUB_TOKEN is not available to this step' };
  }
  if (!ciContext.repositorySlug || !ciContext.pullRequestNumber) {
    return { posted: false, reason: 'not running on a pull request' };
  }

  try {
    const existingId = await findExistingComment(
      apiBase,
      ciContext.repositorySlug,
      ciContext.pullRequestNumber,
      token,
    );

    const url = existingId
      ? `${apiBase}/repos/${ciContext.repositorySlug}/issues/comments/${existingId}`
      : `${apiBase}/repos/${ciContext.repositorySlug}/issues/${ciContext.pullRequestNumber}/comments`;

    const response = await fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: markdown }),
    });

    if (!response.ok) {
      return { posted: false, reason: `GitHub API returned HTTP ${response.status}` };
    }

    return { posted: true, updated: Boolean(existingId) };
  } catch {
    return { posted: false, reason: 'the GitHub API request failed' };
  }
}
