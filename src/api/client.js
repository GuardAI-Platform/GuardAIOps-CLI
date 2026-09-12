import { ApiError } from '../errors.js';
import { readVersion } from '../version.js';
import { redactUrl } from './config.js';
import {
  PROVISIONAL_SCAN_PATH,
  buildScanRequestBody,
  buildScanRequestHeaders,
  normalizeScanResponse,
} from './provisional-contract.js';

export function createApiClient(config) {
  const clientVersion = readVersion();

  async function submitScan({ repository, ciContext, files }) {
    const endpoint = `${config.baseUrl}${PROVISIONAL_SCAN_PATH}`;
    const body = buildScanRequestBody({ repository, ciContext, files, clientVersion });

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: buildScanRequestHeaders(config.apiKey, clientVersion),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const reason = error.name === 'TimeoutError' ? 'request timed out' : 'network request failed';
      throw new ApiError(
        `${reason} while contacting ${redactUrl(endpoint)}`,
        'Check network access from this machine or CI runner, and confirm GUARDAI_API_URL.',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        `GuardAI API rejected the credentials (HTTP ${response.status})`,
        'Check that GUARDAI_API_KEY is set to a valid key. The key value is never printed.',
      );
    }

    if (!response.ok) {
      throw new ApiError(
        `GuardAI API returned HTTP ${response.status} from ${redactUrl(endpoint)}`,
        'See docs/API-CONTRACT.md. The response body is not printed because it may contain infrastructure code.',
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('GuardAI API returned a response that was not valid JSON');
    }

    return normalizeScanResponse(payload);
  }

  return { submitScan, isMock: false };
}
