# GuardAI CLI

The developer-facing integration layer for GuardAI.

Add one step to your pipeline and have your infrastructure changes evaluated before
they reach production.

```
Pull / Merge Request -> CI -> GuardAI CLI -> GuardAI API -> PASS / FAIL
```

GitHub is the primary target. GitLab uses the same CLI.

This repository contains the CLI, the reusable GitHub Action that wraps it, a GitLab
CI template, and a demo showing a pull request being blocked and then passing.

It does **not** contain the GuardAI policy engine, controls, or API. Those are built
by the backend team.

---

## Status

| Phase | Goal | State |
|-------|------|-------|
| 1 | Basic CLI | Done |
| 2 | Repository and file detection | Done |
| 3 | GuardAI API client | Structure done, **blocked on the API contract** |
| 4 | Real scan results | Blocked on the API contract |
| 5 | Correct exit codes | Done |
| 6 | Run inside GitHub Actions | Done, verified on a real runner |
| 7 | Trigger from pull requests | Done |
| 8 | End-to-end PASS/FAIL demo | Done in mock mode |
| 9 | Reusable GitHub Action | Done |
| 10 | PR reporting | Done (annotations, job summary, PR comment) |
| 11 | Marketplace distribution | Not started |
| 12 | GitLab | Implemented, **not yet run on a real GitLab project** |

**Phases 3 and 4 cannot be completed until the backend team provides the API
contract.** See [docs/API-CONTRACT.md](docs/API-CONTRACT.md) for the exact list of
what is required. Nothing about the API has been invented; the single file holding
provisional assumptions is `src/api/provisional-contract.js`.

---

## Requirements

- Node.js 20 or newer
- git (optional, but required for `--changed`)

---

## Quick start

```bash
node bin/guardai.js scan --mock --path examples/demo-repo/failing
```

Mock mode runs a throwaway pattern matcher so you can exercise the whole pipeline
without the GuardAI API. It prints a loud warning and its findings mean nothing.

Against the real API:

```bash
export GUARDAI_API_URL="https://api.example.invalid"
export GUARDAI_API_KEY="..."
node bin/guardai.js scan
```

---

## Commands

```
guardai scan [options]
guardai version
guardai help
```

### Scan options

| Option | Meaning |
|--------|---------|
| `--path <dir>` | Directory to scan. Default: current directory. |
| `--changed` | Only scan infrastructure files changed since the base branch. |
| `--base <ref>` | Base git reference for `--changed`. |
| `--fail-on <level>` | Minimum severity that fails the scan. Default `medium`. One of `info`, `low`, `medium`, `high`, `critical`. |
| `--mock` | Use the local mock scanner instead of the API. |
| `--comment` | Post or update a result comment on the pull or merge request. `--pr-comment` and `--mr-comment` are aliases. |
| `--code-quality-file <path>` | GitLab only: write a Code Quality report artifact. |
| `--json` | Print machine-readable JSON instead of text. |
| `--help` | Show usage. |

### Environment variables

| Variable | Meaning |
|----------|---------|
| `GUARDAI_API_URL` | Base URL of the GuardAI API. |
| `GUARDAI_API_KEY` | GuardAI API key. Never printed or logged. |
| `GUARDAI_TIMEOUT_MS` | Request timeout. Default 60000. |
| `GUARDAI_MOCK` | Set to `1` to force mock mode. |
| `GITHUB_TOKEN` | GitHub token used to post the PR comment. |
| `GITLAB_TOKEN` | GitLab token with `api` scope, used to post the MR note. |

---

## Exit codes

Exit codes are the entire contract with CI. A pipeline decides pass or fail from
this number alone.

| Code | Meaning | What it tells you |
|------|---------|-------------------|
| `0` | Passed | No findings at or above the failure threshold. |
| `1` | Violations found | Your infrastructure code failed governance checks. |
| `2` | Usage error | The command was invoked incorrectly. |
| `3` | GuardAI failed to run | Network, auth, configuration, or API problem. |

`1` and `3` are deliberately different. "Your code is non-compliant" and "the scanner
is broken" must never look the same to a pipeline.

---

## Which files are scanned

Currently `.tf` and `.tfvars`. The list lives in `INFRASTRUCTURE_EXTENSIONS` in
`src/repo/discover.js`.

Other formats (CloudFormation, ARM, Bicep, Kubernetes, Helm) are **not** supported.
Adding an extension to that list would only claim support the backend does not have.

These directories are skipped: `.git`, `.github`, `.terraform`, `node_modules`,
`vendor`, `dist`, `build`, `coverage`, `.venv`, `__pycache__`.

Safety limits: 500 files, 1 MB per file, 20 MB total. Skipped files are reported.

---

## Use in GitHub Actions

```yaml
name: GuardAI

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  guardai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: GuardAI Scan
        uses: prashantchawla3/GuardAI-CLI@main
        with:
          api-url: ${{ secrets.GUARDAI_API_URL }}
          api-key: ${{ secrets.GUARDAI_API_KEY }}
          fail-on: medium
          changed-only: 'true'
          pr-comment: 'true'
          github-token: ${{ github.token }}
```

Full explanation for newcomers to CI/CD: [docs/GITHUB-ACTIONS.md](docs/GITHUB-ACTIONS.md).

### Action inputs

| Input | Default | Meaning |
|-------|---------|---------|
| `api-url` | `''` | Base URL of the GuardAI API. |
| `api-key` | `''` | API key. Always pass from a secret. |
| `path` | `.` | Directory to scan. |
| `fail-on` | `medium` | Minimum severity that fails the job. |
| `changed-only` | `false` | Scan only files changed in the PR. Requires `fetch-depth: 0`. |
| `pr-comment` | `false` | Post or update a PR comment. |
| `github-token` | `''` | Token for the PR comment. Pass `${{ github.token }}`. |
| `mock` | `false` | Use the mock scanner. Testing only. |
| `node-version` | `20` | Node.js version used to run the CLI. |

### Action outputs

| Output | Meaning |
|--------|---------|
| `passed` | `true` or `false`. |
| `findings-count` | Total findings returned. |

---

## Use in GitLab CI

Copy `examples/demo-repo/gitlab-ci-template.yml` to `.gitlab-ci.yml`. Findings appear
in the merge request Code Quality widget. See [docs/GITLAB.md](docs/GITLAB.md).

GitLab support is implemented and unit-tested but **has not yet been run on a real
GitLab project**.

---

## Repository layout

```
bin/guardai.js                      entry point, sets the exit code
src/cli.js                          command routing
src/exit-codes.js                   the four exit codes
src/args.js                         flag parsing
src/errors.js                       typed errors
src/verdict.js                      findings -> pass or fail
src/version.js                      version lookup
src/commands/scan.js                the scan command
src/repo/detect.js                  git repository metadata
src/repo/discover.js                infrastructure file discovery
src/repo/changed.js                 changed-file discovery
src/ci/context.js                   CI and pull request context
src/api/config.js                   API configuration, no invented defaults
src/api/client.js                   HTTP client
src/api/provisional-contract.js     every unverified API assumption
src/api/mock-client.js              labelled mock, not a real scanner
src/output/report.js                terminal output
src/output/summary.js               provider-neutral markdown summary
src/output/github.js                annotations, job summary, PR comment
src/output/gitlab.js                code quality report, MR note
test/                               node --test suite
examples/demo-repo/                 passing and failing demo fixtures
action.yml                          the reusable GitHub Action
```

Layering rules: the API layer never prints and never exits, the output layer never
makes network calls, and only `bin/guardai.js` sets the process exit code.

---

## Testing

```bash
npm test
```

Manual procedures for every phase: [docs/TESTING.md](docs/TESTING.md).

---

## Security

- API keys come from environment variables or GitHub secrets. They are never printed,
  logged, or included in error messages.
- API error messages never echo the response body, because it can contain
  infrastructure code.
- The API URL must use `https`, except for `localhost`.
- File count and size are bounded before anything is uploaded.

---

## Conventions

Source files in this repository contain **no comments**. All explanation lives in
markdown. See `CLAUDE.md` for the full engineering rules, and `memory.md` for the
current project state.
