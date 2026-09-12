import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const INFRASTRUCTURE_EXTENSIONS = ['.tf', '.tfvars'];

export const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.github',
  '.terraform',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.venv',
  '__pycache__',
]);

export const LIMITS = {
  maxFiles: 500,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
};

function hasInfrastructureExtension(fileName) {
  return INFRASTRUCTURE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function toRepositoryPath(rootDirectory, absolutePath) {
  return path.relative(rootDirectory, absolutePath).split(path.sep).join('/');
}

export function findInfrastructureFilePaths(rootDirectory) {
  const found = [];
  const queue = [rootDirectory];

  while (queue.length > 0) {
    const directory = queue.shift();

    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          queue.push(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && hasInfrastructureExtension(entry.name)) {
        found.push(absolutePath);
      }
    }
  }

  return found.sort();
}

export function collectFiles(rootDirectory, absolutePaths) {
  const files = [];
  const skipped = [];
  let totalBytes = 0;

  for (const absolutePath of absolutePaths) {
    const repositoryPath = toRepositoryPath(rootDirectory, absolutePath);

    if (files.length >= LIMITS.maxFiles) {
      skipped.push({ path: repositoryPath, reason: 'file limit reached' });
      continue;
    }

    let size;
    try {
      size = statSync(absolutePath).size;
    } catch {
      skipped.push({ path: repositoryPath, reason: 'unreadable' });
      continue;
    }

    if (size > LIMITS.maxFileBytes) {
      skipped.push({ path: repositoryPath, reason: 'file too large' });
      continue;
    }

    if (totalBytes + size > LIMITS.maxTotalBytes) {
      skipped.push({ path: repositoryPath, reason: 'total size limit reached' });
      continue;
    }

    let content;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch {
      skipped.push({ path: repositoryPath, reason: 'unreadable' });
      continue;
    }

    totalBytes += size;
    files.push({ path: repositoryPath, size, content });
  }

  return { files, skipped, totalBytes };
}

export function discoverInfrastructureFiles(walkDirectory, repositoryRoot = walkDirectory) {
  return collectFiles(repositoryRoot, findInfrastructureFilePaths(walkDirectory));
}
