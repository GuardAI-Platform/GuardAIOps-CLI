import { ConfigurationError } from '../errors.js';

export const DEFAULT_TIMEOUT_MS = 60000;

export function resolveApiConfig(flags = {}, env = process.env) {
  const baseUrl = flags['api-url'] ?? env.GUARDAI_API_URL ?? null;
  const apiKey = env.GUARDAI_API_KEY ?? null;

  const missing = [];
  if (!baseUrl) {
    missing.push('GUARDAI_API_URL (or --api-url)');
  }
  if (!apiKey) {
    missing.push('GUARDAI_API_KEY');
  }

  if (missing.length > 0) {
    throw new ConfigurationError(
      `GuardAI API is not configured: missing ${missing.join(', ')}`,
      'Set the environment variables, or run with --mock to exercise the CLI without the API. See docs/API-CONTRACT.md.',
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new ConfigurationError('GUARDAI_API_URL is not a valid URL');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new ConfigurationError(
      'GuardAI API URL must use https',
      'Plain http is only permitted for localhost during development.',
    );
  }

  const timeoutMs = Number(env.GUARDAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

export function redactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '<invalid url>';
  }
}
