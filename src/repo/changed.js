import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ConfigurationError } from '../errors.js';
import { collectFiles, INFRASTRUCTURE_EXTENSIONS } from './discover.js';

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function resolveBaseRef(rootDirectory, requestedBase) {
  const candidates = [];

  if (requestedBase) {
    candidates.push(requestedBase, `origin/${requestedBase}`);
  } else {
    if (process.env.GITHUB_BASE_REF) {
      candidates.push(`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF);
    }
    if (process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME) {
      candidates.push(
        `origin/${process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`,
        process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME,
      );
    }
    if (process.env.CI_DEFAULT_BRANCH) {
      candidates.push(`origin/${process.env.CI_DEFAULT_BRANCH}`, process.env.CI_DEFAULT_BRANCH);
    }
    candidates.push('origin/main', 'main', 'origin/master', 'master');
  }

  for (const candidate of candidates) {
    if (runGit(['rev-parse', '--verify', '--quiet', candidate], rootDirectory)) {
      return candidate;
    }
  }

  return null;
}

export function discoverChangedInfrastructureFiles(rootDirectory, requestedBase) {
  const baseRef = resolveBaseRef(rootDirectory, requestedBase);

  if (!baseRef) {
    throw new ConfigurationError(
      'could not determine a base git reference to compare against',
      'Pass --base <ref>, or checkout with fetch-depth: 0 so the base branch is available.',
    );
  }

  const output = runGit(
    ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`],
    rootDirectory,
  );

  if (output === null) {
    throw new ConfigurationError(
      `git could not diff against '${baseRef}'`,
      'Ensure the repository history is available (actions/checkout with fetch-depth: 0).',
    );
  }

  const changedPaths = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .filter((line) => INFRASTRUCTURE_EXTENSIONS.some((extension) => line.endsWith(extension)))
    .map((line) => path.join(rootDirectory, line));

  const collected = collectFiles(rootDirectory, changedPaths);
  return { ...collected, baseRef };
}
