# GitLab CI integration

**Status: written and unit-tested, but never run on a real GitLab project.**
Treat it as unproven until a real merge request pipeline has been observed.

---

## How GitLab differs from GitHub

The CLI is the same. Only the reporting layer differs, because the two platforms
expose different features.

| Concept | GitHub | GitLab |
|---------|--------|--------|
| Config file | `.github/workflows/guardai.yml` | `.gitlab-ci.yml` |
| Change request | Pull Request (PR) | Merge Request (MR) |
| Reusable package | Action (`uses:`) | No direct equivalent; clone or use a container image |
| Inline findings on the diff | Workflow command annotations | Code Quality report artifact |
| Comment | PR comment via `GITHUB_TOKEN` | MR note via `GITLAB_TOKEN` |
| Pass/fail | exit code | exit code |

The exit code works identically on both. That is the whole reason the CLI was built
provider-neutral.

---

## Quick start

Copy `examples/demo-repo/gitlab-ci-template.yml` to `.gitlab-ci.yml` in the customer's
repository:

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

Key lines:

- `rules: if $CI_PIPELINE_SOURCE == "merge_request_event"` — run only on merge
  requests. GitLab's equivalent of GitHub's `on: pull_request`.
- `GIT_DEPTH: 0` — fetch the full history. Required by `--changed`, exactly like
  `fetch-depth: 0` on GitHub.
- `artifacts.reports.codequality` — this is what makes findings appear inline on the
  MR diff. Without it the JSON file is just a file.

---

## Required CI/CD variables

Set these in **Settings → CI/CD → Variables**. Mark them *Masked* and *Protected*.

| Variable | Purpose |
|----------|---------|
| `GUARDAI_API_URL` | Base URL of the GuardAI API |
| `GUARDAI_API_KEY` | GuardAI API key |
| `GITLAB_TOKEN` | Only needed for `--comment` |

**Important:** `CI_JOB_TOKEN`, the token GitLab injects automatically, **cannot post
merge request notes.** Its API scope does not cover the notes endpoint. A Project
Access Token or Personal Access Token with `api` scope is required, stored as
`GITLAB_TOKEN`. If it is missing, the CLI skips the note and says so — it does not
fail the scan.

---

## Severity mapping

GitLab's Code Quality format uses its own severity words, so GuardAI severities are
translated:

| GuardAI | GitLab |
|---------|--------|
| `info` | `info` |
| `low` | `minor` |
| `medium` | `major` |
| `high` | `critical` |
| `critical` | `blocker` |

The `--fail-on` threshold still uses **GuardAI** severity names, not GitLab's.

---

## Why there is no "GitLab Action"

GitLab has no exact equivalent of a reusable GitHub Action. The realistic options are:

1. **Clone the CLI in `before_script`** — what the template does. Simple, no publishing
   step, works today.
2. **Publish a container image** with the CLI preinstalled, then use it as the job
   `image:`. Faster and cleaner, but requires a registry and a release process.
3. **A CI/CD component or `include:` template** — the closest thing to an Action.
   Worth doing once the CLI is stable.

Option 1 is deliberate for now. Options 2 and 3 are packaging improvements, not
functionality, and should wait until GitHub is proven against the real API.

---

## What is not implemented for GitLab

- No published container image.
- No CI/CD component / `include:` template.
- No GitLab merge request approval rules or blocking policies.
- No inline single-line discussion threads (the Code Quality report covers the diff
  view instead).

---

## How to test it for real

1. Create a GitLab project with a `.tf` file and the template above.
2. Set the CI/CD variables.
3. Create a branch, add a violation, open a merge request.
4. Expected: the pipeline fails, findings appear in the MR's **Code Quality** widget
   and on the changed lines, and an MR note appears if `GITLAB_TOKEN` is set.
5. Fix the violation, push again. Expected: pipeline passes, the existing note is
   updated rather than duplicated.

Record the real result in `memory.md` §3. Until then it stays listed as unproven.
