import { readFileSync } from 'node:fs';

const EMPTY_CONTEXT = {
  provider: 'none',
  isCi: false,
  eventName: null,
  repositorySlug: null,
  pullRequestNumber: null,
  mergeRequestId: null,
  projectId: null,
  apiUrl: null,
  baseRef: null,
  headRef: null,
  commit: null,
  runUrl: null,
};

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

export function isGitLabCi() {
  return process.env.GITLAB_CI === 'true';
}

function detectGitHubContext() {
  const payload = readGitHubEventPayload();
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const repositorySlug = process.env.GITHUB_REPOSITORY ?? null;
  const runId = process.env.GITHUB_RUN_ID ?? null;

  return {
    ...EMPTY_CONTEXT,
    provider: 'github',
    isCi: true,
    eventName: process.env.GITHUB_EVENT_NAME ?? null,
    repositorySlug,
    pullRequestNumber: readPullRequestNumber(payload),
    baseRef: process.env.GITHUB_BASE_REF || null,
    headRef: process.env.GITHUB_HEAD_REF || null,
    commit: process.env.GITHUB_SHA ?? null,
    runUrl: repositorySlug && runId ? `${serverUrl}/${repositorySlug}/actions/runs/${runId}` : null,
  };
}

function detectGitLabContext() {
  const mergeRequestId = process.env.CI_MERGE_REQUEST_IID
    ? Number(process.env.CI_MERGE_REQUEST_IID)
    : null;

  return {
    ...EMPTY_CONTEXT,
    provider: 'gitlab',
    isCi: true,
    eventName: process.env.CI_PIPELINE_SOURCE ?? null,
    repositorySlug: process.env.CI_PROJECT_PATH ?? null,
    mergeRequestId: Number.isFinite(mergeRequestId) ? mergeRequestId : null,
    projectId: process.env.CI_PROJECT_ID ?? null,
    apiUrl: process.env.CI_API_V4_URL ?? null,
    baseRef: process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || null,
    headRef: process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || process.env.CI_COMMIT_REF_NAME || null,
    commit: process.env.CI_COMMIT_SHA ?? null,
    runUrl: process.env.CI_PIPELINE_URL ?? null,
  };
}

export function detectCiContext() {
  if (isGitHubActions()) {
    return detectGitHubContext();
  }

  if (isGitLabCi()) {
    return detectGitLabContext();
  }

  return { ...EMPTY_CONTEXT, isCi: process.env.CI === 'true' };
}
