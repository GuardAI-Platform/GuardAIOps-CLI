# GuardAIOps CLI

[![CI](https://github.com/GuardAI-Platform/GuardAIOps-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/GuardAI-Platform/GuardAIOps-CLI/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-blue)](https://nodejs.org)
[![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)](package.json)

Infrastructure governance for your pull requests.

GuardAIOps CLI is the developer-facing integration layer for the GuardAI platform. It
evaluates infrastructure-as-code changes against your organisation's governance
controls and blocks non-compliant changes before they reach production.

```
Pull / Merge Request  ->  CI pipeline  ->  GuardAIOps CLI  ->  GuardAI API  ->  PASS / FAIL
```

Add one step to your pipeline. Every infrastructure change is evaluated automatically,
findings appear inline on the diff, and non-compliant changes fail the build.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [Command line reference](#command-line-reference)
- [Exit codes](#exit-codes)
- [Configuration](#configuration)
- [What gets scanned](#what-gets-scanned)
- [Security](#security)
- [Architecture](#architecture)
- [Development](#development)
- [Project status](#project-status)
- [Support](#support)

---

## Why this exists

Infrastructure misconfiguration is rarely caught in code review. A publicly readable
storage bucket, an ingress rule open to the internet, or a database reachable from
outside the VPC all look unremarkable in a diff - each is two or three lines of
otherwise ordinary Terraform.

Manual review does not scale, and governance applied after deployment is applied too
late: the change is already live by the time anyone evaluates it.

GuardAIOps CLI moves that evaluation into the pull request, where the cost of a fix is
a single push rather than an incident.

**Design principle:** the same binary runs on a developer laptop, in GitHub Actions, in
GitLab CI, and in any other pipeline. There is one client to maintain and one set of
behaviours to reason about, rather than a separate implementation per platform.

---

## How it works

1. **Discover** - identify infrastructure files in the repository, or only those
   changed relative to the target branch.
2. **Submit** - send them to the GuardAI API over HTTPS, authenticated with your
   organisation's API key.
3. **Evaluate** - GuardAI applies your controls and returns structured findings.
4. **Report** - render results in the terminal, annotate the affected lines on the
   change request, and publish a summary comment.
5. **Decide** - exit `0` or non-zero so the pipeline passes or fails accordingly.

Policy evaluation happens in the GuardAI platform. This client performs no local rule
evaluation; it is responsible for repository context, transport, presentation, and the
pass/fail contract with your CI system.

---

## Quick start

**Requirements:** Node.js 20 or newer. Git is required for change detection.

```bash
git clone https://github.com/GuardAI-Platform/GuardAIOps-CLI.git
cd GuardAIOps-CLI

export GUARDAI_API_URL="https://api.guardai.example"
export GUARDAI_API_KEY="your-api-key"

node bin/guardai.js scan
```

To evaluate the tool without API credentials, see [Mock mode](#mock-mode).

---

## GitHub Actions

Add `.github/workflows/guardai.yml` to your repository:

```yaml
name: GuardAI

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  governance:
    name: Infrastructure Governance
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: GuardAI Scan
        uses: GuardAI-Platform/GuardAIOps-CLI@main
        with:
          api-url: ${{ secrets.GUARDAI_API_URL }}
          api-key: ${{ secrets.GUARDAI_API_KEY }}
          fail-on: medium
          changed-only: 'true'
          pr-comment: 'true'
          github-token: ${{ github.token }}
```

Store `GUARDAI_API_URL` and `GUARDAI_API_KEY` under **Settings -> Secrets and variables
-> Actions**.

`fetch-depth: 0` is required when `changed-only` is enabled, so that the base branch is
available for comparison.

### Action inputs

| Input | Default | Description |
|-------|---------|-------------|
| `api-url` | empty | Base URL of the GuardAI API. |
| `api-key` | empty | GuardAI API key. Always supply from a secret. |
| `path` | `.` | Directory to scan. |
| `fail-on` | `medium` | Minimum severity that fails the job: `info`, `low`, `medium`, `high`, `critical`. |
| `changed-only` | `false` | Restrict the scan to files changed relative to the base branch. |
| `pr-comment` | `false` | Publish or update a result comment on the pull request. |
| `github-token` | empty | Token used for the comment. Requires `pull-requests: write`. |
| `mock` | `false` | Use the bundled mock scanner. Pipeline validation only. |
| `node-version` | `20` | Node.js version used to run the CLI. |

### Action outputs

| Output | Description |
|--------|-------------|
| `passed` | `true` when the scan passed, `false` when violations were found. |
| `findings-count` | Total number of findings returned. |
| `exit-code` | Raw CLI exit code. See [Exit codes](#exit-codes). |

### Reporting

Three layers of feedback, each independent of the others:

| Layer | Requires | Appearance |
|-------|----------|------------|
| Status check | nothing | The job passes or fails on the pull request. |
| Inline annotations | nothing | Findings pinned to the exact line under **Files changed**. |
| Summary comment | `pr-comment`, `github-token` | A severity table posted to the pull request, updated in place on subsequent pushes rather than duplicated. |

A full introduction to GitHub Actions concepts is available in
[docs/GITHUB-ACTIONS.md](docs/GITHUB-ACTIONS.md).

---

## GitLab CI

Add `.gitlab-ci.yml` to your repository:

```yaml
stages:
  - governance

guardai:
  stage: governance
  image: node:20-alpine

  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

  variables:
    GIT_DEPTH: 0

  before_script:
    - apk add --no-cache git
    - git clone --depth 1 https://github.com/GuardAI-Platform/GuardAIOps-CLI.git /opt/guardai

  script:
    - node /opt/guardai/bin/guardai.js scan
      --changed
      --fail-on medium
      --comment
      --code-quality-file gl-code-quality-report.json

  artifacts:
    when: always
    reports:
      codequality: gl-code-quality-report.json
```

Set `GUARDAI_API_URL`, `GUARDAI_API_KEY`, and - where merge request notes are required -
`GITLAB_TOKEN` under **Settings -> CI/CD -> Variables**, masked and protected.

GitLab surfaces findings on the merge request diff through the Code Quality report
artifact, which is why `artifacts.reports.codequality` is required.

> `CI_JOB_TOKEN` cannot post merge request notes; its API scope does not cover the
> notes endpoint. A project or personal access token with `api` scope is required. When
> absent, the note is skipped and the scan result is unaffected.

See [docs/GITLAB.md](docs/GITLAB.md) for severity mapping and packaging options.

---

## Command line reference

```
guardai scan [options]
guardai version
guardai help
```

### Scan options

| Option | Description |
|--------|-------------|
| `--path <dir>` | Directory to scan. Defaults to the working directory. |
| `--changed` | Restrict the scan to files changed relative to the base branch. |
| `--base <ref>` | Base git reference for `--changed`. Inferred from CI when omitted. |
| `--fail-on <level>` | Minimum severity that fails the scan. Default `medium`. |
| `--comment` | Publish or update a result comment on the pull or merge request. Aliases: `--pr-comment`, `--mr-comment`. |
| `--code-quality-file <path>` | Write a GitLab Code Quality report artifact. |
| `--json` | Emit machine-readable JSON instead of formatted text. |
| `--mock` | Use the bundled mock scanner. See [Mock mode](#mock-mode). |
| `--help` | Show usage. |

### Example

```console
$ guardai scan --changed --fail-on high

GuardAI Infrastructure Scan

Repository:  acme/platform-infrastructure
Branch:      feature/storage-migration
Commit:      4f2a9c31
Source:      GuardAI API
Scope:       files changed since origin/main

Found 3 files to scan.

2 findings detected.

  HIGH  Storage ACL allows public access
    terraform/storage.tf:42
    control: CTL-STORAGE-004
    fix: Set acl to "private" and grant access through explicit policies.

  MEDIUM  S3 bucket does not declare server-side encryption
    terraform/storage.tf:31
    control: CTL-STORAGE-011
    fix: Add an aws_s3_bucket_server_side_encryption_configuration resource.

Summary: 1 high, 1 medium
Failing on severity high or higher.

FAIL - 1 blocking finding
```

---

## Exit codes

The exit code is the contract with your CI system. A pipeline determines pass or fail
from this value alone.

| Code | Meaning | Interpretation |
|------|---------|----------------|
| `0` | Passed | No findings at or above the failure threshold. |
| `1` | Violations found | The change failed governance evaluation. |
| `2` | Usage error | The command was invoked incorrectly. |
| `3` | Execution failure | Network, authentication, configuration, or API error. |

Codes `1` and `3` are deliberately distinct. A non-compliant change and an unavailable
scanner require different responses, and a pipeline that cannot tell them apart will
either block deployments during an outage or, worse, treat a failed scan as a clean
result.

---

## Configuration

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GUARDAI_API_URL` | yes | Base URL of the GuardAI API. Must use HTTPS. |
| `GUARDAI_API_KEY` | yes | GuardAI API key. Never logged or printed. |
| `GUARDAI_TIMEOUT_MS` | no | Request timeout in milliseconds. Default `60000`. |
| `GUARDAI_MOCK` | no | Set to `1` to force mock mode. |
| `GITHUB_TOKEN` | no | Required for pull request comments. |
| `GITLAB_TOKEN` | no | Required for merge request notes. Needs `api` scope. |

Command line options take precedence over environment variables.

### Failure threshold

`--fail-on` sets the minimum severity that fails the scan. Findings below the threshold
are reported but do not block.

```
info  <  low  <  medium  <  high  <  critical
```

Teams adopting GuardAI incrementally typically begin at `high` or `critical` to
establish a baseline, then tighten the threshold as findings are resolved.

### Mock mode

`--mock` runs a small bundled pattern matcher instead of calling the API. It exists so
that pipeline wiring - triggers, permissions, exit codes, annotations, artifacts - can
be validated without credentials.

Mock mode is not a security scanner. It applies a handful of regular expressions, its
findings carry no analytical meaning, and it prints a warning on every invocation and
labels every report it produces. It must not be used to assess real infrastructure.

---

## What gets scanned

Terraform: `.tf` and `.tfvars`.

Additional infrastructure formats are added to the CLI only when the GuardAI platform
has corresponding controls for them. Declaring support the backend cannot honour would
produce silent false confidence.

**Excluded directories:** `.git`, `.github`, `.terraform`, `node_modules`, `vendor`,
`dist`, `build`, `coverage`, `.venv`, `__pycache__`.

**Submission limits:** 500 files, 1 MB per file, 20 MB in total. Files exceeding a
limit are skipped and reported by name, never silently dropped.

---

## Security

This is a security product and is built accordingly.

- **Credentials** are read from environment variables or CI secret stores. They are
  never written to logs, error messages, HTTP diagnostics, or terminal output.
- **Transport** requires HTTPS. Plain HTTP is rejected except for `localhost` during
  local development.
- **Response bodies are never echoed** in error messages, because they may contain
  infrastructure source.
- **Input is bounded** by file count and size before any submission.
- **Malformed API responses fail closed.** A response that cannot be parsed produces
  exit code `3`, never a pass. Treating an unreadable response as a clean result would
  be a security defect.
- **The GitHub Action passes inputs through environment variables** rather than shell
  interpolation, avoiding the script injection pattern common to composite actions.
- **Zero runtime dependencies**, removing the supply chain surface entirely.

To report a vulnerability, contact the GuardAI Platform team directly rather than
opening a public issue.

---

## Architecture

```
bin/guardai.js                   Entry point; the only place the exit code is set
  src/cli.js                     Command routing
    src/args.js                  Argument parsing
    src/verdict.js               Findings -> pass/fail decision
    src/commands/scan.js         Orchestration
      src/repo/                  Repository metadata and file discovery
      src/ci/                    CI provider and change request context
      src/api/                   GuardAI API client
      src/output/                Terminal, GitHub, and GitLab reporting
```

Enforced boundaries:

- The API layer produces no output and never terminates the process; it returns data or
  throws typed errors.
- The output layer makes no network calls to GuardAI.
- Only the entry point sets the process exit code; every other module returns a value.
- Repository paths are always repository-relative with forward slashes, so behaviour is
  identical on Windows and Linux.
- Provider-specific logic is confined to `src/ci/` and `src/output/`. Adding a CI
  platform requires no change to discovery, transport, or verdict logic.

---

## Development

```bash
npm test                 # Run the test suite (node --test)
node bin/guardai.js help # Inspect the command surface
```

The test suite uses the Node.js built-in test runner. There are no development
dependencies to install.

Manual verification procedures for every capability are documented in
[docs/TESTING.md](docs/TESTING.md).

### Conventions

Source files contain no comments. Rationale, caveats, and design context belong in
`docs/`; code is expected to be self-describing through naming. This convention is
enforced during review.

---

## Project status

The CLI, both CI integrations, and the reporting layers are implemented and verified.

| Capability | Status |
|------------|--------|
| CLI, file discovery, change detection | Complete |
| Exit code contract | Complete |
| GitHub Actions integration | Verified on live runners |
| Pull request triggers and annotations | Verified on live pull requests |
| Reusable GitHub Action | Verified via the published reference |
| GitLab CI integration | Implemented; not yet exercised on a live GitLab project |
| Pull request summary comments | Implemented; not yet exercised against the live API |
| GuardAI API client | Awaiting the published API contract |

**API integration is pending.** The GuardAI API contract has not yet been published by
the platform team. The client, transport, error handling, and response normalisation
are implemented, and every unconfirmed assumption is isolated in a single module so
that adopting the final contract is a contained change. The outstanding specification
requirements are enumerated in [docs/API-CONTRACT.md](docs/API-CONTRACT.md).

Until then, mock mode allows pipeline integration to be completed and validated in
advance, so that connecting the API becomes a configuration change rather than an
implementation effort.

---

## Support

| Resource | Location |
|----------|----------|
| GitHub Actions guide | [docs/GITHUB-ACTIONS.md](docs/GITHUB-ACTIONS.md) |
| GitLab CI guide | [docs/GITLAB.md](docs/GITLAB.md) |
| API contract requirements | [docs/API-CONTRACT.md](docs/API-CONTRACT.md) |
| Testing procedures | [docs/TESTING.md](docs/TESTING.md) |
| Example configurations | [examples/demo-repo/](examples/demo-repo/) |

---

Copyright GuardAI Platform. All rights reserved.
