import { readFileSync } from 'node:fs';

function readGitHubEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch {
    return null;
  }
}

function readPullRequestNumber(payload) {
  const fromPayload = payload?.pull_request?.number ?? payload?.number ?? null;
  if (typeof fromPayload === 'number') {
    return fromPayload;
  }
  const refMatch = (process.env.GITHUB_REF ?? '').match(/^refs\/pull\/(\d+)\//);
  return refMatch ? Number(refMatch[1]) : null;
}

export function isGitHubActions() {
  return process.env.GITHUB_ACTIONS === 'true';
}

export function detectCiContext() {
  if (!isGitHubActions()) {
    return {
      provider: 'none',
      isCi: process.env.CI === 'true',
      eventName: null,
      repositorySlug: null,
      pullRequestNumber: null,
      baseRef: null,
      headRef: null,
      commit: null,
      runUrl: null,
    };
  }

  const payload = readGitHubEventPayload();
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const repositorySlug = process.env.GITHUB_REPOSITORY ?? null;
  const runId = process.env.GITHUB_RUN_ID ?? null;

  return {
    provider: 'github',
    isCi: true,
    eventName: process.env.GITHUB_EVENT_NAME ?? null,
    repositorySlug,
    pullRequestNumber: readPullRequestNumber(payload),
    baseRef: process.env.GITHUB_BASE_REF || null,
    headRef: process.env.GITHUB_HEAD_REF || null,
    commit: process.env.GITHUB_SHA ?? null,
    runUrl:
      repositorySlug && runId ? `${serverUrl}/${repositorySlug}/actions/runs/${runId}` : null,
  };
}
