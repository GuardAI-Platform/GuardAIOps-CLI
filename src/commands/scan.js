import path from 'node:path';
import { EXIT } from '../exit-codes.js';
import { parseArgs } from '../args.js';
import { GuardAiError } from '../errors.js';
import { detectRepository } from '../repo/detect.js';
import { discoverInfrastructureFiles } from '../repo/discover.js';
import { discoverChangedInfrastructureFiles } from '../repo/changed.js';
import { detectCiContext } from '../ci/context.js';
import { resolveApiConfig } from '../api/config.js';
import { createApiClient } from '../api/client.js';
import { createMockClient } from '../api/mock-client.js';
import { DEFAULT_FAIL_ON, decideVerdict, isValidSeverity, SEVERITY_ORDER } from '../verdict.js';
import { renderHeader, renderResult } from '../output/report.js';
import { buildMarkdownSummary } from '../output/summary.js';
import {
  postPullRequestComment,
  writeAnnotations,
  writeJobSummary,
  writeStepOutputs,
} from '../output/github.js';
import { postMergeRequestNote, writeCodeQualityReport } from '../output/gitlab.js';

const SCAN_USAGE = `Usage:
  guardai scan [options]

Options:
  --path <dir>        Directory to scan (default: current directory)
  --changed           Only scan infrastructure files changed since the base branch
  --base <ref>        Base git reference for --changed
  --fail-on <level>   Minimum severity that fails the scan (default: ${DEFAULT_FAIL_ON})
                      One of: ${SEVERITY_ORDER.join(', ')}
  --mock              Use the local mock scanner instead of the GuardAI API
  --comment           Post or update a result comment on the pull or merge request
                      (--pr-comment and --mr-comment do the same thing)
  --code-quality-file <path>
                      GitLab only: write a Code Quality report artifact
  --json              Print the result as JSON instead of text
  --help              Show this message

Environment:
  GUARDAI_API_URL     Base URL of the GuardAI API
  GUARDAI_API_KEY     GuardAI API key (never printed)
  GUARDAI_MOCK        Set to 1 to force mock mode
  GITHUB_TOKEN        GitHub token used to post the pull request comment
  GITLAB_TOKEN        GitLab token with api scope, used to post the merge request note

Exit codes:
  0  passed
  1  violations found
  2  usage error
  3  GuardAI failed to run
`;

function selectClient(flags) {
  const useMock = flags.mock === true || process.env.GUARDAI_MOCK === '1';
  if (useMock) {
    return createMockClient();
  }
  return createApiClient(resolveApiConfig(flags));
}

export async function scan(argv) {
  const { flags, errors } = parseArgs(argv);

  if (flags.help) {
    console.log(SCAN_USAGE);
    return EXIT.OK;
  }

  if (errors.length > 0) {
    for (const message of errors) {
      console.error(`guardai scan: ${message}`);
    }
    console.error('');
    console.error(SCAN_USAGE);
    return EXIT.USAGE_ERROR;
  }

  const failOn = flags['fail-on'] ?? DEFAULT_FAIL_ON;
  if (!isValidSeverity(failOn)) {
    console.error(`guardai scan: invalid --fail-on value '${failOn}'`);
    console.error(`Expected one of: ${SEVERITY_ORDER.join(', ')}`);
    return EXIT.USAGE_ERROR;
  }

  const startDirectory = path.resolve(flags.path ?? process.cwd());
  const repository = detectRepository(startDirectory);
  const ciContext = detectCiContext();

  try {
    let collected;
    let baseRef = null;

    if (flags.changed) {
      if (!repository.isGitRepository) {
        console.error('guardai scan: --changed requires a git repository');
        return EXIT.USAGE_ERROR;
      }
      const changed = discoverChangedInfrastructureFiles(repository.root, flags.base);
      collected = changed;
      baseRef = changed.baseRef;
    } else {
      const walkDirectory = flags.path ? startDirectory : repository.root;
      collected = discoverInfrastructureFiles(walkDirectory, repository.root);
    }

    const client = selectClient(flags);

    if (!flags.json) {
      console.log(
        renderHeader({
          repository,
          files: collected.files,
          isMock: client.isMock,
          changedOnly: Boolean(flags.changed),
          baseRef,
        }),
      );

      for (const skippedFile of collected.skipped) {
        console.log(`  skipped ${skippedFile.path} (${skippedFile.reason})`);
      }
      if (collected.skipped.length > 0) {
        console.log('');
      }
    }

    if (collected.files.length === 0) {
      if (flags.json) {
        console.log(JSON.stringify({ passed: true, findings: [], filesScanned: 0 }, null, 2));
      } else {
        console.log('No infrastructure files matched. Nothing was scanned.');
        console.log('');
        console.log('PASS - nothing to scan');
        console.log('');
      }
      return EXIT.OK;
    }

    const scanResult = await client.submitScan({
      repository,
      ciContext,
      files: collected.files,
    });

    const verdict = decideVerdict(scanResult, failOn);

    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            source: scanResult.source,
            passed: verdict.passed,
            failOn: verdict.failOn,
            decidedBy: verdict.decidedBy,
            filesScanned: collected.files.length,
            counts: verdict.counts,
            findings: scanResult.findings,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(renderResult(scanResult, verdict));
    }

    const commentRequested =
      flags.comment === true || flags['pr-comment'] === true || flags['mr-comment'] === true;

    if (ciContext.provider !== 'none') {
      const markdown = buildMarkdownSummary(scanResult, verdict, {
        repository,
        files: collected.files,
      });

      if (ciContext.provider === 'github') {
        writeAnnotations(scanResult.findings, verdict.failOn);
        writeJobSummary(markdown);
        writeStepOutputs({
          passed: String(verdict.passed),
          'findings-count': String(scanResult.findings.length),
        });

        if (commentRequested) {
          const commentResult = await postPullRequestComment(markdown, ciContext);
          if (!commentResult.posted) {
            console.log(`GuardAI: pull request comment skipped (${commentResult.reason}).`);
          }
        }
      }

      if (ciContext.provider === 'gitlab') {
        if (flags['code-quality-file']) {
          const reportResult = writeCodeQualityReport(
            scanResult.findings,
            flags['code-quality-file'],
          );
          if (reportResult.written) {
            console.log(`GuardAI: code quality report written to ${reportResult.path}`);
          } else {
            console.log(`GuardAI: code quality report not written (${reportResult.reason}).`);
          }
        }

        if (commentRequested) {
          const noteResult = await postMergeRequestNote(markdown, ciContext);
          if (!noteResult.posted) {
            console.log(`GuardAI: merge request note skipped (${noteResult.reason}).`);
          }
        }
      }
    }

    return verdict.passed ? EXIT.OK : EXIT.VIOLATIONS_FOUND;
  } catch (error) {
    if (error instanceof GuardAiError) {
      console.error(`guardai scan: ${error.message}`);
      if (error.hint) {
        console.error(error.hint);
      }
      return EXIT.GUARDAI_ERROR;
    }
    throw error;
  }
}
