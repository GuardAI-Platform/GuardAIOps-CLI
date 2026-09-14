# CLAUDE.md — GuardAI Integration Project

Persistent engineering instructions for this repository. Read this file **and** `memory.md`
at the start of every session, before writing any code.

---

## 1. Project Purpose

Build the **developer-facing integration layer** for GuardAI, starting with GitHub.

The single sentence that defines success:

> "Add GuardAI to your pipeline and have your infrastructure changes automatically
> evaluated before they reach production."

The target end-to-end flow:

```
GitHub Repository -> Pull Request -> GitHub Actions -> GuardAI integration
  -> Existing GuardAI API -> Scan result -> PASS / FAIL
```

Full background lives in `context.md`. That file is the source of truth for product
intent; this file is the source of truth for *how we build*.

---

## 2. Current Scope

This project owns:

- The `guardai` CLI (a reusable client, **not** a GitHub-only script)
- Git repository / working-directory detection
- Detecting relevant infrastructure files and changes
- The GuardAI API client (HTTP layer)
- Client-side authentication and configuration
- Formatting and printing scan results
- Process exit codes
- GitHub Actions integration
- Pull Request CI integration
- Later: PR checks/comments/annotations, reusable Action packaging, Marketplace, GitLab

This project does **NOT** own (another team builds these):

- Policy engine, control engine, compliance frameworks
- AI agents, business-impact analysis, dependency/infrastructure graph
- Cloud scanning engine, policy authoring, backend database
- The core GuardAI API implementation

If a needed backend capability is missing, **write it down as a dependency/question**.
Never quietly implement a second backend inside the CLI.

---

## 3. Architecture

Layering is deliberate. Keep these separated:

```
bin/guardai            entry point (shebang, argv -> run())
  src/cli.js           command routing, flag parsing, exit-code selection
    src/commands/*.js  one file per command (scan, version, ...)
      src/repo/*.js    repository + file discovery (no HTTP, no printing)
      src/api/*.js     GuardAI API client (HTTP only, no printing, no process.exit)
      src/output/*.js  human-readable rendering (no HTTP, no process.exit)
```

Hard rules:

- **API code never prints and never exits.** It returns data or throws typed errors.
- **Output code never performs I/O beyond writing to stdout/stderr.**
- **Only `src/cli.js` (or `bin/guardai`) decides the process exit code.**
- Repository/file logic must work identically on a laptop and on a CI runner.
- No provider-specific logic inside the CLI core. GitHub specifics live in
  `src/output/github.js`, GitLab specifics in `src/output/gitlab.js`, and provider
  detection in `src/ci/context.js`. Shared rendering belongs in `src/output/summary.js`.
  Adding a provider must not require touching `src/repo/`, `src/api/`, or `src/verdict.js`.

Runtime decision: **Node.js (ESM)**. Reason: GitHub Actions runs JavaScript actions
natively on every runner with no toolchain install, which makes Phase 9 (reusable
Action) straightforward. Revisit only with a concrete technical reason.

Dependency policy: start with **zero runtime dependencies**. Add one only when
hand-rolling it is clearly worse, and record the reason in `memory.md`.

---

## 4. Current Milestone

**Milestone 1 — end-to-end GitHub demo.** Complete when a Pull Request in a demo
repository triggers GitHub Actions, which runs the GuardAI CLI, which calls the real
GuardAI API, and the job visibly PASSES on clean infrastructure and FAILS on a
violation.

Phase sequence (do not jump ahead without a technical reason):

| Phase | Goal |
|-------|------|
| 1  | Basic CLI — `guardai scan` runs and exits cleanly |
| 2  | Repository / file detection |
| 3  | GuardAI API client |
| 4  | Real scan results |
| 5  | Correct exit codes |
| 6  | Run CLI inside GitHub Actions |
| 7  | Trigger from Pull Requests |
| 8  | End-to-end PASS/FAIL demonstration |
| 9  | Package as a reusable GitHub Action |
| 10 | Improve PR reporting |
| 11 | GitHub distribution / Marketplace |
| 12 | GitLab integration (implemented ahead of order at the developer's explicit request) |

The current phase and the exact next task are recorded in `memory.md`. That file wins
on "where are we"; this file wins on "how do we work".

---

## 5. Important Constraints

- The GuardAI backend API contract is **not** in this repository. Until it is provided,
  any API behaviour is unknown.
- A mock is allowed **only** to prove CLI architecture, and it must be:
  - in a file whose name contains `mock`,
  - printing or otherwise making clear that results are mock data,
  - never the default once the real client exists.
- The developer on this project is learning CLI development and CI/CD. Do not silently
  introduce complex systems. Explain what, why, and how to test.
- Windows is the development machine; GitHub Actions runners are Linux. Code and paths
  must work on both (use `path.posix` for repo-relative paths, normalise separators).

---

## 6. Engineering Rules

1. **Build incrementally.** small feature -> test -> verify -> document -> next.
2. **Inspect before modifying.** Read existing code, package config, docs, tests, git
   status before changing anything.
3. **Preserve working functionality.** Do not rewrite working code without a reason.
4. **Never hallucinate backend behaviour.** Unknown API contract -> stop and document.
5. **Keep the architecture simple.** No frameworks, dashboards, daemons, or cloud
   infrastructure that the current phase does not require.
6. **Every command must solve a real integration problem.** Do not add commands or
   flags because they look professional.
7. **Explain unfamiliar concepts** (Actions, runners, exit codes, YAML triggers) in
   plain language when introducing them.
8. **One major step at a time.** Implement, hand over a test procedure, and wait for the
   user's result before starting the next major step.
9. **NO COMMENTS IN CODE.** This is mandatory and non-negotiable.

---

## 6a. Code Style — No Comments (mandatory)

Source files contain **zero comments**. This applies to `.js`, `.json`, `.yml`/`.yaml`,
and any other code or configuration file in this repository.

- No `//`, no `/* */`, no `#` comment lines, no JSDoc blocks, no TODO comments.
- The only permitted exception is the `#!/usr/bin/env node` shebang, which is an
  executable directive, not a comment.
- When editing an existing file, remove any comment found in it.

Because comments are banned, meaning must be carried by:

- **Names.** Files, functions, and variables must be self-describing
  (`decideVerdict`, `provisional-contract.js`, `mock-client.js`).
- **File names as labels.** Anything mock or unverified says so in its filename.
- **Runtime output.** Warnings, banners, and error messages explain state to the user.
- **Markdown docs.** All explanation, rationale, caveats, and "why" belongs in
  `README.md`, `docs/`, `CLAUDE.md`, or `memory.md` — never inline in code.

If something genuinely needs explaining, it goes in `docs/`, and the code is renamed
until it no longer needs the explanation.

---

## 7. Testing Rules

- A feature is done when it has been **run**, not when it has been written.
- Never state that something works unless its actual output was observed in this session.
  If it was not run, say "not yet tested".
- Automated tests use the built-in `node:test` runner (`node --test`). No test framework
  dependency unless there is a concrete reason.
- Every phase must have a **manual test procedure** the user can copy-paste, plus the
  exact expected output and expected exit code.
- Exit codes are part of the contract and must be asserted explicitly
  (`echo $LASTEXITCODE` in PowerShell, `echo $?` in bash).
- CI behaviour is only proven by a real workflow run in GitHub Actions, not by reading
  the YAML.

---

## 8. Security Rules

This is a security product. Treat it as one.

- Never print, log, or echo API keys, tokens, or credentials — including in error
  messages, debug output, and HTTP error dumps.
- Secrets come from environment variables (e.g. `GUARDAI_API_KEY`) or GitHub Actions
  secrets. Never hardcode, never commit.
- Config files that could hold secrets must be gitignored; prefer env vars over files.
- Infrastructure code sent to the API is customer-sensitive: do not write it to
  temporary files unnecessarily, and do not dump payloads to the console.
- Validate and bound anything read from disk (file count, file size) before uploading.
- Redact URLs/headers before logging. Assume CI logs are readable by many people.
- Keep the dependency surface small; every added package is supply-chain risk.

---

## 9. Git Workflow

- The repository is initialised locally; a GitHub remote is added when Phase 6 needs it.
- `main` is the stable branch. Work happens on short-lived branches:
  `phase-1-basic-cli`, `phase-2-file-detection`, ...
- Commit only when a step is stable **and tested**. Commit messages: imperative subject,
  body explaining why.
- Never commit: `node_modules/`, `.env`, API keys, scan payloads, customer code.
- Do not run destructive git operations (`reset --hard`, `push --force`, branch/repo
  deletion) without explicit confirmation from the user.
- Never push, open PRs, or create remote repositories without asking first.

---

## 10. Backend / API Boundary

The CLI talks to the GuardAI API through **one** module (`src/api/`). Nothing else in
the codebase performs HTTP.

Before the real client can be written, the backend team must supply:

- Base URL (and per-environment URLs)
- Endpoint path(s) and HTTP method(s)
- Authentication method (header name, scheme, token format, how keys are issued)
- Required headers, API version / versioning scheme
- Request schema — including how code is sent (raw files? archive? diff? git ref?),
  size limits, and encoding
- Repository metadata fields expected (name, owner, branch, commit SHA, provider)
- Pull Request metadata fields expected (PR number, base ref, head ref, changed files)
- Response schema, including finding shape (severity, file, line, control id, message)
- Semantics: what counts as "pass" vs "fail" — is it severity-based? policy-based?
  does the API decide, or does the client?
- Synchronous vs asynchronous scanning (if async: job id, polling endpoint, timeout)
- Error response format and status codes
- Rate limits and timeouts

Until each of these is answered, the corresponding code is not written. Open questions
live in `memory.md` under "Open API questions".

---

## 11. Things Claude Must Never Assume

- Never assume an API endpoint, header, auth scheme, payload shape, or response field.
- Never assume the API decides pass/fail — that is an open question.
- Never assume scanning is synchronous.
- Never assume the repository is a git repository, has a remote, or has a clean tree.
- Never assume GitHub — the CLI core must stay provider-neutral.
- Never assume Terraform is the only input format, but do not implement others yet.
- Never assume a test passed. Run it, or say it was not run.
- Never assume the user wants a feature from the "future" sections of `context.md`.
- Never assume network access exists in a CI runner beyond what is configured.

---

## 12. Explicitly Out of Scope (now)

Do not build any of these until the phase table reaches them:

- Policy/control/rule engines or any local scanning logic
- AI explanation, remediation, dependency or business-impact analysis
- Web dashboards, UIs, servers, databases, containers, cloud infrastructure
- Azure DevOps, Harness, or any CI beyond GitHub and GitLab
- Marketplace publishing
- Support for CDK / CloudFormation / ARM / Bicep / Helm / Ansible / K8s parsing
- Auth login flows, config file formats, caching, baselines, telemetry
- Extra CLI commands beyond what the current phase requires

---

## 13. How Future Work Should Be Approached

For every major step:

1. Read `CLAUDE.md` and `memory.md`.
2. Inspect the current state of the repository.
3. Explain: **what** we are building, **why** it is needed.
4. Implement the smallest version that works.
5. Give the user an exact, copy-pasteable test procedure with expected output and exit code.
6. **Wait for the user's result.**
7. Update `memory.md` with what was actually built and actually tested.
8. Commit when stable.
9. Only then move to the next step.

If a step reveals a missing API fact, stop and add it to "Open API questions" rather
than guessing.
