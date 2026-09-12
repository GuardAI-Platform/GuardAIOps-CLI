import { execFileSync } from 'node:child_process';

function runGit(args, cwd) {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const trimmed = output.trim();
    return trimmed === '' ? null : trimmed;
  } catch {
    return null;
  }
}

function parseRemoteSlug(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }
  const sshMatch = remoteUrl.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }
  try {
    const parsed = new URL(remoteUrl);
    return parsed.pathname.replace(/^\//, '').replace(/\.git$/, '') || null;
  } catch {
    return null;
  }
}

function detectProvider(remoteUrl) {
  if (!remoteUrl) {
    return null;
  }
  if (remoteUrl.includes('github.com')) {
    return 'github';
  }
  if (remoteUrl.includes('gitlab.com')) {
    return 'gitlab';
  }
  if (remoteUrl.includes('dev.azure.com') || remoteUrl.includes('visualstudio.com')) {
    return 'azure-devops';
  }
  return 'unknown';
}

export function detectRepository(startDirectory = process.cwd()) {
  const root = runGit(['rev-parse', '--show-toplevel'], startDirectory);

  if (!root) {
    return {
      isGitRepository: false,
      root: startDirectory,
      branch: null,
      commit: null,
      remoteUrl: null,
      slug: null,
      provider: null,
      hasCommits: false,
    };
  }

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], startDirectory);
  const commit = runGit(['rev-parse', 'HEAD'], startDirectory);
  const remoteUrl = runGit(['remote', 'get-url', 'origin'], startDirectory);

  return {
    isGitRepository: true,
    root,
    branch: branch === 'HEAD' ? null : branch,
    commit,
    remoteUrl,
    slug: parseRemoteSlug(remoteUrl),
    provider: detectProvider(remoteUrl),
    hasCommits: commit !== null,
  };
}
