# memory.md — GuardAI Integration Project Memory

Persistent project memory. Every session: read this after `CLAUDE.md`.
Update it whenever something is **actually built** or **actually tested**.
Never record something as working that was not run.

Last updated: 2026-09-12

---

## 1. Current Status

**Phase: 1 (Basic CLI) — skeleton implemented and run by Claude; awaiting the
developer's own test run.**

Repository state at the start of this session:

- Project root: `C:\Users\ADMIN\OneDrive\Desktop\GuardAI CLI`
- Only file present: `context.md` (973 lines, product/assignment context)
- **Not** a git repository (`git status` -> fatal: not a git repository) — still true;
  `git init` has not been run
- No `package.json`, no source code, no tests, no CI configuration
- Local tooling verified this session: Node `v24.15.0`, npm `11.7.0`,
  git `2.53.0.windows.3`, gh `2.95.0`, Python `3.14.6`

The CLI skeleton now exists (see §2) and all four of its code paths were executed
successfully (see §3). No repository detection, no API calls, no findings logic yet.

---

## 2. What Has Been Built

| Item | Status |
|------|--------|
| `CLAUDE.md` | Created this session |
| `memory.md` | Created this session (this file) |
| `package.json` | Created. ESM (`"type": "module"`), bin `guardai` -> `bin/guardai.js`, `test` script = `node --test`, **zero dependencies**, `private: true`. |
| `bin/guardai.js` | Created. Shebang entry point; slices `process.argv`, awaits `run(args)`, sets `process.exitCode`; catches throws and maps them to exit 3. |
| `src/exit-codes.js` | Created. `EXIT.OK=0`, `VIOLATIONS_FOUND=1`, `USAGE_ERROR=2`, `GUARDAI_ERROR=3`. |
| `src/cli.js` | Created. Routes `help`/`--help`/`-h`/no-args -> usage (0), `version`/`--version`/`-v` -> version from package.json (0), `scan` -> scan command, anything else -> usage on **stderr** (2). Returns codes, never exits. |
| `src/commands/scan.js` | Created. **Phase 1 placeholder only** — prints a banner + cwd + an explicit "not implemented yet: no files were read and no scan was performed" line, returns 0. No file I/O, no HTTP, no fake findings. |
| `.gitignore` | Created. `node_modules/`, `.env*`, `*.pem`, `*.key`, logs, editor/OS noise. |
| Automated tests | Not written yet (planned once `scan` has real behaviour to assert). |

---

## 3. What Has Been Tested

### 2026-09-12 — Phase 1 skeleton, run by Claude (bash, project root)

All four code paths executed; output and exit codes observed directly:

| Command | Observed output | Exit code |
|---------|-----------------|-----------|
| `node bin/guardai.js scan` | Banner, `Working directory: C:\Users\...\GuardAI CLI`, "Not implemented yet..." | `0` |
| `node bin/guardai.js version` | `0.1.0` | `0` |
| `node bin/guardai.js` (no args) | Usage block on stdout | `0` |
| `node bin/guardai.js bogus` | `guardai: unknown command 'bogus'` + usage, on stderr | `2` |

Not yet tested: the developer's own run on PowerShell (`$LASTEXITCODE`), and
`npm link` / global `guardai` invocation.

Testing rule in force: a step is only "done" when its output was observed.
Record here exactly what command was run, what came back, and the exit code.

---

## 4. Current Architecture

Planned layering (see `CLAUDE.md` §3 for the rules that keep it honest):

```
bin/guardai.js       entry point                      [EXISTS]
  src/cli.js         command routing + exit codes     [EXISTS]
  src/exit-codes.js  shared exit-code constants       [EXISTS]
    src/commands/    one file per command             [EXISTS: scan.js placeholder]
    src/repo/        repository & file discovery      [Phase 2 - not created]
    src/api/         GuardAI API client (HTTP only)   [Phase 3 - not created]
    src/output/      rendering                        [Phase 4 - not created]
```

Invariant already enforced in code: `src/cli.js` and the command modules **return**
an exit code; only `bin/guardai.js` assigns `process.exitCode`. Keep it that way —
it is what makes the whole CLI callable from a test without killing the test process.

---

## 5. Important Decisions

| # | Decision | Reason | Date |
|---|----------|--------|------|
| D1 | Implementation language: **Node.js (ESM)** | GitHub Actions runs JavaScript actions natively on all runners with no toolchain setup, which makes Phase 9 (reusable Action) simple. Node 24 is installed locally. | 2026-09-12 |
| D2 | **Zero runtime dependencies** to start (no commander/yargs/axios) | The developer is learning CLI development; a ~30-line hand-rolled arg parser is readable and teaches how CLIs actually work. Node 24 has built-in `fetch`. Revisit when flag handling genuinely outgrows it — record the reason here if so. | 2026-09-12 |
| D3 | Tests use the built-in **`node --test`** runner | No test-framework dependency; zero install. | 2026-09-12 |
| D4 | CLI core stays **provider-neutral** | GitLab/Azure DevOps come later (Phase 12+); GitHub specifics live in the Actions layer only. | 2026-09-12 |
| D5 | Any mock API lives in a file named `*mock*` and announces itself in output | Prevents a mock from ever being mistaken for the real GuardAI backend. | 2026-09-12 |

---

## 6. API Information Discovered

**None.** The GuardAI backend API contract is **not present in this repository**
and has not been provided.

Confirmed by inspection this session: the project root contains only `context.md`,
which describes intent but specifies **no** endpoints, schemas, or auth details.

### Open API questions (blocking Phase 3)

These must be answered by the backend team before the real API client is written.
Do not guess any of them.

1. **Base URL** — production, and any staging/dev environment?
2. **Endpoint path and HTTP method** for starting a scan?
3. **Authentication** — header name, scheme (Bearer? `X-API-Key`?), token format,
   and how a customer obtains a key?
4. **Required headers** — content type, API version header, correlation/request id?
5. **API versioning scheme** — URL path (`/v1/`), header, or none?
6. **Request payload** — how is code sent?
   - raw file contents in JSON?
   - multipart upload / tar or zip archive?
   - a git diff / patch?
   - or just a git reference the backend clones itself?
7. **Payload limits** — max request size, max file count, max single-file size, encoding.
8. **Repository metadata fields expected** — owner, repo name, provider, branch,
   commit SHA, default branch, clone URL?
9. **Pull Request metadata fields expected** — PR number, base ref, head ref, base SHA,
   head SHA, list of changed files?
10. **Response schema** — top-level shape of a scan result.
11. **Finding schema** — severity values (exact strings), file path, line/range, control
    or policy id, title, description, remediation field?
12. **Pass/fail semantics** — does the API return a verdict, or does the client decide
    from severities? Is there a configurable threshold, and where does it live?
13. **Synchronous or asynchronous?** If async: job id format, polling endpoint, poll
    interval, terminal states, timeout.
14. **Error responses** — status codes and error body format (auth failure, bad request,
    payload too large, server error).
15. **Rate limits** and recommended client timeout / retry behaviour.
16. **Which file types the backend actually accepts today** (Terraform only? others?).

Until these are answered, Phase 3 is blocked and any HTTP code would be invention.

---

## 7. GitHub Integration Details

Nothing configured yet.

- No git repository initialised locally yet.
- No GitHub remote.
- No demo repository (`guardai-demo`) created.
- No workflow file.
- `gh` CLI is installed (v2.95.0); auth status not yet checked.

Needed later (Phase 6+), to be filled in when known:

- Demo repo name / owner:
- Workflow file path: `.github/workflows/guardai.yml`
- Secret name for the API key: `GUARDAI_API_KEY` (proposed)
- How the CLI is installed on the runner (npm install from repo path? published package?
  bundled action?) — decision deferred to Phase 6.

---

## 8. Problems Encountered / Solutions

| Problem | Solution |
|---------|----------|
| Writing large files via bash heredoc failed in this shell wrapper (unexpected EOF). | Use the Write tool for multi-line file creation instead of heredocs. |

---

## 9. Next Exact Task

**Blocked on the developer confirming the Phase 1 test run** (PowerShell,
`$LASTEXITCODE` for each of the four commands in §3).

Once confirmed, the next step is **Phase 2, step 1: repository detection** — and
nothing more. Specifically, `guardai scan` should answer "where am I?":

- Is the working directory inside a git repository? (`git rev-parse --show-toplevel`)
- If yes: repository root, current branch, current commit SHA, and whether a remote
  exists. If no: fall back to the working directory and say so plainly.
- New module `src/repo/detect.js`. No file discovery yet, no HTTP, no exit-code change.
- Must not crash when git is absent, when there is no remote, or when the repo has no
  commits yet.

File discovery (which `.tf` files to send) is a **separate** step after that.

Decision deferred until Phase 2 is underway: whether to run `git init` on this project
and start committing per-phase branches. Ask the developer before running any git
command that writes.

---

## 10. Notes For Future Sessions

- The developer is **learning** CLI development and CI/CD. Explain each concept before
  building it, and hand over an explicit test procedure after building it. Then wait.
- Do not skip phases. The phase table is in `CLAUDE.md` §4.
- `context.md` contains a large future vision (AI remediation, 20+ platforms). It is
  context, **not** a backlog to start on.
- Development machine is Windows; CI runners are Linux. Watch path separators and
  line endings.
