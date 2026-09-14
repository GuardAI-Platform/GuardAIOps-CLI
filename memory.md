# memory.md — GuardAI Integration Project Memory

Persistent project memory. Every session: read this after `CLAUDE.md`.
Update it whenever something is **actually built** or **actually tested**.
Never record something as working that was not run.

Last updated: 2026-09-14

---

## 1. Current Status

**Phases 1, 2, 5, 6, 7, 9, 10, 12 are implemented and tested locally.
Phase 8 is proven in mock mode. Phases 3 and 4 are BLOCKED on the backend team.
Phase 11 is not started.**

| Phase | Goal | State |
|-------|------|-------|
| 1 | Basic CLI | Done, tested |
| 2 | Repository / file detection | Done, tested |
| 3 | GuardAI API client | Structure done. **BLOCKED: no API contract.** |
| 4 | Real scan results | **BLOCKED: no API contract.** Mock proves the path. |
| 5 | Correct exit codes | Done, all four verified |
| 6 | Run CLI inside GitHub Actions | **PROVEN on a real ubuntu-latest runner.** 39 tests pass on Linux. |
| 7 | Trigger from Pull Requests | **PROVEN.** PR #1 triggered both demo jobs. |
| 8 | End-to-end PASS/FAIL demo | **PROVEN in mock mode on a real PR.** Clean passes, insecure blocked with exit code 1. |
| 9 | Reusable GitHub Action | **PROVEN.** Composite action loads, runs, and propagates outputs even when the step fails. |
| 10 | PR reporting | Annotations **PROVEN** on a real PR (5 on correct file/lines). Job summary and outputs proven. PR comment still **never executed** against the GitHub API. |
| 11 | Marketplace distribution | Not started |
| 12 | GitLab | **Implemented at the developer's explicit request, ahead of phase order.** Unit-tested and verified against a simulated GitLab runner. **Never run on a real GitLab project.** |

**Lives at https://github.com/GuardAI-Platform/GuardAIOps-CLI (public).**

It sits alongside the other two org repos, which are private:
`GuardAIOps-Backend` (the API this CLI will call) and `GaurdAIOps-Frontend`.

History: first created 2026-09-14 as `prashantchawla3/GuardAI-CLI`, then transferred
into the `GuardAI-Platform` org and renamed to `GuardAIOps-CLI` the same day. Nothing
remains under the personal account. GitHub does not allow spaces in repository names,
so "GuardAIOps CLI" is `GuardAIOps-CLI`.

**This repo must stay public.** A GitHub Action inside a private repo cannot be used by
any other account, which would make the whole integration unusable for customers. The
GitLab template also clones it over plain https. If it is ever made private, both break.

---

## 2. What Has Been Built

### Documentation
| File | Contents |
|------|----------|
| `CLAUDE.md` | Engineering rules, architecture, boundaries, **the no-comments rule (§6a)** |
| `memory.md` | This file |
| `README.md` | Product overview, commands, exit codes, Action usage, layout |
| `docs/API-CONTRACT.md` | The 25 blocking questions, the provisional assumptions, the change plan |
| `docs/GITHUB-ACTIONS.md` | CI/CD explained from zero for a learner |
| `docs/TESTING.md` | Copy-pasteable test procedure for every phase |
| `docs/GITLAB.md` | GitLab CI integration, severity mapping, token caveat |
| `examples/demo-repo/README.md` | Demo fixture guide |

### Source
| File | Role |
|------|------|
| `bin/guardai.js` | Entry point. Only place that sets `process.exitCode`. |
| `src/cli.js` | Routes `scan` / `version` / `help`. Returns codes, never exits. |
| `src/exit-codes.js` | `OK=0`, `VIOLATIONS_FOUND=1`, `USAGE_ERROR=2`, `GUARDAI_ERROR=3` |
| `src/args.js` | Zero-dependency flag parser. Rejects unknown options and missing values. |
| `src/errors.js` | `GuardAiError`, `ConfigurationError`, `ApiError`, `ContractMismatchError` |
| `src/verdict.js` | Severity ranking, counts, `decideVerdict`. API verdict wins over client threshold. |
| `src/version.js` | Reads version from `package.json` |
| `src/commands/scan.js` | Orchestrates detect -> discover -> client -> verdict -> output -> exit code |
| `src/repo/detect.js` | git root, branch, commit, remote, provider, slug. Degrades safely without git. |
| `src/repo/discover.js` | Walks for `.tf`/`.tfvars`; ignore-list; limits 500 files / 1 MB / 20 MB |
| `src/repo/changed.js` | `git diff --name-only --diff-filter=ACMR base...HEAD` |
| `src/ci/context.js` | Detects GitHub Actions **or** GitLab CI -> normalized context (PR/MR id, project id, base/head ref, run URL) |
| `src/api/config.js` | Env/flag config. **No invented defaults.** Enforces https except localhost. |
| `src/api/client.js` | The only HTTP code. Never prints keys or response bodies. |
| `src/api/provisional-contract.js` | **Every unverified API assumption, isolated here.** |
| `src/api/mock-client.js` | Labelled mock. 5 regex patterns. Warns loudly on every run. |
| `src/output/report.js` | Terminal rendering |
| `src/output/summary.js` | Provider-neutral markdown summary + comment marker |
| `src/output/github.js` | Annotations, job summary, step outputs, PR comment upsert |
| `src/output/gitlab.js` | Code Quality report artifact, MR note upsert |

### CI / packaging
| File | Role |
|------|------|
| `action.yml` | Composite reusable Action. Inputs passed via env, never interpolated into the shell. |
| `.github/workflows/ci.yml` | Runs `npm test` on push/PR |
| `.github/workflows/guardai-demo.yml` | Two jobs: clean passes; insecure is blocked and verified |
| `examples/demo-repo/guardai-workflow.yml` | GitHub workflow template for a customer repository |
| `examples/demo-repo/gitlab-ci-template.yml` | GitLab CI template for a customer repository |
| `examples/demo-repo/passing/main.tf` | Clean Terraform fixture |
| `examples/demo-repo/failing/main.tf` | Deliberately insecure Terraform fixture |
| `.gitattributes` | Forces LF so the Action's bash script works on Linux runners |
| `.gitignore` | `node_modules/`, `.env*`, keys, logs, editor noise |

### Tests
`test/args.test.js`, `test/cli.test.js`, `test/discover.test.js`,
`test/gitlab.test.js`, `test/mock-client.test.js`, `test/provisional-contract.test.js`,
`test/verdict.test.js`

---

## 3. What Has Been Tested

### 2026-09-12 — Phase 1 skeleton
Verified by Claude (bash) and independently **confirmed by the developer in PowerShell**:
`scan` -> 0, `version` -> `0.1.0` -> 0, no args -> usage -> 0, `bogus` -> usage -> 2.

### 2026-09-12 — Automated suite
`node --test` -> **32 tests, 32 pass, 0 fail.** Run twice, after the full build.

### 2026-09-14 — Automated suite after GitLab support
`node --test` -> **39 tests, 39 pass, 0 fail.**

### 2026-09-14 — GitLab, simulated runner
With `GITLAB_CI=true`, `CI_PROJECT_PATH`, `CI_PROJECT_ID`, `CI_MERGE_REQUEST_IID=7`,
`CI_API_V4_URL`, `CI_PIPELINE_SOURCE=merge_request_event`, scanning the failing fixture:
- exit code `1`
- Code Quality JSON artifact written; `high` mapped to `critical`, `medium` to `major`,
  with repo-relative `location.path` and `location.lines.begin`
- MR note **correctly skipped** with the message explaining `GITLAB_TOKEN` is required
  and that `CI_JOB_TOKEN` cannot post notes
- GitHub path re-verified unchanged after the refactor: 5 annotations, `passed=false`,
  `findings-count=5`, job summary written

### 2026-09-12 — Exit codes (all four observed)
| Command | Result | Code |
|---------|--------|------|
| `scan --mock --path examples/demo-repo/passing` | PASS, no violations | `0` |
| `scan --mock --path examples/demo-repo/failing` | 5 findings (3 high, 2 medium) | `1` |
| `scan --mock --path .../failing --fail-on critical` | PASS, below threshold | `0` |
| `scan --fail-on banana --mock` | invalid severity message | `2` |
| `scan --path .../passing` with no API env | "API is not configured", names missing vars | `3` |

### 2026-09-12 — File discovery
Full-repo scan found 2 `.tf` files and correctly excluded `.git`, `node_modules`,
`.terraform`. Per-file size limit and skip reporting covered by tests.

### 2026-09-12 — Changed-file detection
On a temporary branch with one added `.tf`: `scan --mock --changed --base main`
reported **1 file** (not all 3), branch `test-changed-detection`, commit `82b57d03`,
and the finding path was `examples/demo-repo/passing/extra.tf` — repo-relative with
forward slashes, which is what GitHub annotations require. Branch deleted afterwards.

### 2026-09-12 — GitHub Actions output, simulated locally
With `GITHUB_ACTIONS=true`, `GITHUB_STEP_SUMMARY` and `GITHUB_OUTPUT` set to temp files:
- 5 `::error title=...,file=main.tf,line=N::` annotation lines emitted
- `GITHUB_OUTPUT` received `passed=false` and `findings-count=5`
- job summary received the markdown table with the mock-mode warning banner

### 2026-09-12 — JSON output
`--json` produced valid JSON with `source`, `passed`, `failOn`, `decidedBy`,
`filesScanned`, `counts`, `findings`.

### 2026-09-12 — No-comments rule
`grep -rnE '^\s*(//|/\*|\*)'` over `src bin test` -> none.
`grep -rnE '^\s*#'` over `*.yml` -> none. Shebang in `bin/guardai.js` preserved.

### 2026-09-14 — REAL GitHub run, PR #1
Repo pushed public. Observed directly:

| Check | Result |
|-------|--------|
| CI / Unit tests | green, `39 pass / 0 fail` on `ubuntu-latest` |
| Clean infrastructure passes | green, `PASS - no violations found` |
| Insecure infrastructure is blocked | green, `outcome=failure exit-code=1 findings=5` |

Annotations confirmed via the check-runs API — 5 `failure` annotations on
`examples/demo-repo/failing/main.tf` at lines 9, 11, 22, 31, 33, each titled with the
GuardAI finding. Phases 6, 7, 8, 9 and the annotation half of 10 are now real, not simulated.

Also learned: composite action outputs **do** propagate to the caller even when the
inner step exits non-zero. The hardened verification depends on that and it held.

### NOT tested — be honest about these
- **Nothing has run on GitLab.** No real project, no MR pipeline, no Code Quality widget
  observed, and `postMergeRequestNote` has never reached the GitLab API.
- The **PR comment** code path has still never executed against the GitHub API.
  `--comment` was not enabled on PR #1. This is the last unproven piece of Phase 10.
- `src/api/client.js` has **never** made a real request — there is no API to call.
- Linux is now covered by the GitHub runner. GitLab remains entirely unproven.

---

## 4. Current Architecture

```
bin/guardai.js          entry point, the only place process.exitCode is set
  src/cli.js            routing, returns exit codes
  src/args.js           flag parsing
  src/verdict.js        findings -> pass/fail
    src/commands/scan.js    orchestration
      src/repo/           detect.js, discover.js, changed.js
      src/ci/             context.js
      src/api/            config.js, client.js, provisional-contract.js, mock-client.js
      src/output/         report.js, github.js
action.yml              composite Action wrapping the CLI
```

Invariants enforced in code, do not break them:

- Only `bin/guardai.js` sets the exit code. Everything else returns a number.
- Only `src/api/` performs HTTP to GuardAI. Only `src/output/github.js` talks to GitHub.
- `src/api/` never prints and never exits.
- Repository paths are always repo-relative with forward slashes.
- Every unverified API assumption lives in `src/api/provisional-contract.js`.

---

## 5. Important Decisions

| # | Decision | Reason | Date |
|---|----------|--------|------|
| D1 | Node.js (ESM) | Runs natively on GitHub runners; makes the Action trivial | 2026-09-12 |
| D2 | Zero runtime dependencies | Learner-readable, no supply-chain surface; Node 24 has built-in `fetch` | 2026-09-12 |
| D3 | `node --test` for tests | No framework install | 2026-09-12 |
| D4 | CLI core stays provider-neutral | GitLab later; GitHub specifics confined to `src/ci/` and `src/output/github.js` | 2026-09-12 |
| D5 | Mock lives in `*mock*` file and announces itself everywhere | Can never be mistaken for a real GuardAI result | 2026-09-12 |
| D6 | **No comments in any code file** | Developer's explicit instruction. Meaning carried by names, runtime output and markdown docs. Recorded in `CLAUDE.md` §6a. | 2026-09-12 |
| D7 | Four exit codes, `1` != `3` | A pipeline must distinguish a non-compliant change from a broken scanner | 2026-09-12 |
| D8 | Default `--fail-on medium` | Matches the demo in `context.md`. **Open question: should the API own this threshold?** | 2026-09-12 |
| D9 | Composite Action, not a bundled JS Action | No build step, no `dist/`, no `@actions/core` dependency; readable YAML | 2026-09-12 |
| D10 | Action inputs passed as env vars, never interpolated into the bash script | Prevents script injection, a real vulnerability in many public Actions | 2026-09-12 |
| D11 | Only `.tf` and `.tfvars` scanned | Adding extensions would claim support the backend does not have | 2026-09-12 |
| D12 | Malformed API response -> `ContractMismatchError` -> exit 3 | A silent pass on an unparseable response would be a security failure | 2026-09-12 |
| D13 | PR comment upserts via a hidden marker | Re-runs update one comment instead of spamming the PR | 2026-09-12 |
| D14 | `.gitattributes` forces LF | The Action's bash script would break with CRLF on Linux runners | 2026-09-12 |
| D15 | GitLab built ahead of phase order | Developer asked for it explicitly. Concern raised that GitHub is still unproven on a real PR; developer proceeded. | 2026-09-14 |
| D16 | Markdown summary moved to `src/output/summary.js` | Both providers render the same table; keeps provider modules to transport only | 2026-09-14 |
| D17 | GitLab inline findings use a Code Quality report artifact | GitLab has no annotation commands; the Code Quality artifact is the supported way to show findings on an MR diff | 2026-09-14 |
| D18 | GitLab notes require `GITLAB_TOKEN`, not `CI_JOB_TOKEN` | `CI_JOB_TOKEN` has no access to the notes API. Missing token skips the note; it never fails the scan. | 2026-09-14 |
| D19 | No GitLab container image or CI/CD component yet | The clone-in-`before_script` template works without a release process; packaging is an improvement, not functionality | 2026-09-14 |
| D20 | Repository is **public** | An Action in a private repo cannot be used by any other account, which would defeat the product. Developer chose public knowingly. | 2026-09-14 |
| D21 | Demo assertions check the exact exit code, not just "did it fail" | A manifest error made the step fail, and the old assertion read that as success. A false green is worse than a red. | 2026-09-14 |

---

## 6. API Information Discovered

**Still none.** The contract has not been provided.

The full list of 25 blocking questions, the provisional assumptions, and the exact
change plan for when answers arrive now live in **`docs/API-CONTRACT.md`**. That file
is the single source of truth for this gap. Keep it updated.

Summary of what is provisional and unverified:
`POST {base}/v1/scans`, `Authorization: Bearer`, JSON body `{client, repository,
trigger, files[]}` with inline file contents, response `{scanId, passed, reportUrl,
findings[]}`, synchronous scanning.

**None of that is confirmed. Do not treat any of it as real.**

---

## 7. GitHub Integration Details

- Local repo: branch `main`, commit `4cbaed1`, clean tree.
- Local git identity set **repository-only**: `ironrim <ironriminc@gmail.com>`.
  Change with `git config user.name "..."` if wrong.
- **No remote configured. Nothing pushed. No GitHub repository created.**
  Claude must ask before creating or pushing to any remote.
- `gh` CLI v2.95.0 installed; auth status never checked.
- Secret names the workflows expect: `GUARDAI_API_URL`, `GUARDAI_API_KEY`.
- All Action references now point at `GuardAI-Platform/GuardAIOps-CLI@main`.

---

## 8. Problems Encountered / Solutions

| Problem | Solution |
|---------|----------|
| `action.yml` refused to load: `Unrecognized named-value: 'github'` | An input **description** contained a `${{ github.token }}` expression. GitHub evaluates expressions inside the manifest, and the `github` context is not available there. Reworded the description in prose. **Never put `${{ }}` in an action input description.** |
| The insecure-infrastructure demo job passed while the action was completely broken | The assertion only checked `outcome == 'failure'`, which a manifest error satisfies. Now it asserts `exit-code == 1` **and** `findings-count >= 1`, plus an independent direct CLI exit-code check. |
| Bash heredocs failed in this shell wrapper ("unexpected EOF") | Use the Write tool for multi-line files |
| `--path` was accepted but discovery still walked the git root | Split walk root from repo root: `discoverInfrastructureFiles(walkDir, repoRoot)`. Paths stay repo-relative so annotations land on the right file. |
| Git warned that LF would become CRLF on 39 files | Added `.gitattributes` with `eol=lf`. CRLF would break the Action's bash script on Linux runners. |
| No global git identity configured | Set repository-local identity; flagged to the developer |
| Scanning the whole project exits 1 because of the failing fixture | Expected. The demo workflow scans specific `--path` directories. |

---

## 9. Next Exact Task

PR #1 is merged and `main` carries the fixed `action.yml`. `demo/prove-pipeline` was
deleted after merge.

In order:

1. Prove the **PR comment** — the last unproven piece of Phase 10. Add
   `pr-comment: 'true'` and `github-token` to the demo workflow, open a PR, confirm the
   comment posts, then push a second commit and confirm it **updates** rather than
   duplicating.
2. **Send `docs/API-CONTRACT.md` to the backend team.** Phases 3 and 4 are blocked on
   those 25 answers and nothing can substitute for them.
3. Consider tagging `v1` so customers can pin `@v1` instead of `@main`. Pinning to a
   moving branch is poor practice for an Action.

**Do not start Phase 11 (Marketplace)** until the real API works end to end. Publishing
a scanner that only has a mock behind it would be misleading.

**GitLab (Phase 12) is implemented but completely unproven.** It needs a real GitLab
project, a merge request pipeline, and a `GITLAB_TOKEN` before any claim is made about
it. See `docs/GITLAB.md` for the test procedure.

---

## 10. Notes For Future Sessions

- The developer is **learning** CLI development and CI/CD. Explain in plain English,
  give exact test commands, and say what the expected output is.
- **No comments in code.** See `CLAUDE.md` §6a. Remove any comment found.
- Do not claim CI works until a real workflow run has been observed.
- `context.md` is the product vision, not a backlog. Do not start AI features,
  dashboards, or extra platforms.
- Development machine is Windows; runners are Linux. Watch path separators and line
  endings.
