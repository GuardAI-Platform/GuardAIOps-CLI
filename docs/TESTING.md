# Testing procedures

Every command here is copy-pasteable. Run them from the project root.

PowerShell reports the exit code of the last program in `$LASTEXITCODE`.
Bash uses `$?`.

---

## Automated tests

```powershell
npm test
```

Expected: all tests pass, `fail 0`.

---

## Phase 1 — the CLI runs and controls its exit code

```powershell
node bin/guardai.js scan --mock --path examples/demo-repo/passing
$LASTEXITCODE

node bin/guardai.js version
$LASTEXITCODE

node bin/guardai.js
$LASTEXITCODE

node bin/guardai.js bogus
$LASTEXITCODE
```

| Command | Expected output | Expected code |
|---------|-----------------|---------------|
| `scan --mock --path .../passing` | PASS, no violations | `0` |
| `version` | `0.1.0` | `0` |
| no arguments | usage | `0` |
| `bogus` | unknown command + usage | `2` |

---

## Phase 2 — repository and file detection

```powershell
node bin/guardai.js scan --mock
```

Expected: a header naming the repository, branch and commit, and a file count
covering every `.tf` and `.tfvars` file in the repository.

Check that noise is excluded:

```powershell
node bin/guardai.js scan --mock --json | Select-String '"filesScanned"'
```

Expected: the count excludes anything under `node_modules`, `.terraform`, `.git`.

---

## Phase 3 — API client configuration

The real API is not available. What is testable is that the CLI **refuses to invent
one** and reports the failure as a GuardAI error, not a policy failure.

```powershell
$env:GUARDAI_API_URL = $null
$env:GUARDAI_API_KEY = $null
node bin/guardai.js scan --path examples/demo-repo/passing
$LASTEXITCODE
```

Expected: a message naming the missing variables, and exit code `3`.

Check that an insecure URL is rejected:

```powershell
$env:GUARDAI_API_URL = "http://api.example.com"
$env:GUARDAI_API_KEY = "test"
node bin/guardai.js scan --path examples/demo-repo/passing
$LASTEXITCODE
```

Expected: "must use https", exit code `3`.

Clean up:

```powershell
Remove-Item Env:GUARDAI_API_URL -ErrorAction SilentlyContinue
Remove-Item Env:GUARDAI_API_KEY -ErrorAction SilentlyContinue
```

---

## Phase 4 — scan results

```powershell
node bin/guardai.js scan --mock --path examples/demo-repo/failing
```

Expected: 5 findings — 3 high, 2 medium — each with a file and line number, and a
loud mock-mode warning.

```powershell
node bin/guardai.js scan --mock --json --path examples/demo-repo/failing
```

Expected: valid JSON with `source: "mock"`, `passed: false`, and a `findings` array.

---

## Phase 5 — exit codes

```powershell
node bin/guardai.js scan --mock --path examples/demo-repo/passing
$LASTEXITCODE

node bin/guardai.js scan --mock --path examples/demo-repo/failing
$LASTEXITCODE

node bin/guardai.js scan --mock --path examples/demo-repo/failing --fail-on critical
$LASTEXITCODE

node bin/guardai.js scan --mock --fail-on banana
$LASTEXITCODE
```

| Case | Expected code |
|------|---------------|
| clean infrastructure | `0` |
| violations found | `1` |
| violations below the threshold | `0` |
| invalid option value | `2` |
| API not configured | `3` |

---

## Phases 6, 7, 9, 10 — GitHub Actions

These are only truly proven by a real run on GitHub. Before pushing, you can simulate
the runner environment locally.

### Simulating a runner (bash)

```bash
GITHUB_ACTIONS=true \
GITHUB_STEP_SUMMARY=/tmp/summary.md \
GITHUB_OUTPUT=/tmp/output.txt \
node bin/guardai.js scan --mock --path examples/demo-repo/failing

cat /tmp/output.txt
cat /tmp/summary.md
```

Expected:

- `::error ...` annotation lines in the output, one per finding, with `file=` and `line=`
- `/tmp/output.txt` contains `passed=false` and `findings-count=5`
- `/tmp/summary.md` contains a markdown findings table

### The real run

1. Push the repository to GitHub.
2. Open a pull request.
3. Open the **Actions** tab.

Expected:

| Job | Expected |
|-----|----------|
| CI / Unit tests | green |
| Clean infrastructure passes | green |
| Insecure infrastructure is blocked | green, having verified GuardAI failed |

---

## Phase 8 — the end-to-end demo

This is the milestone demonstration: a pull request blocked by GuardAI, then passing
after a fix.

1. Create a branch.
2. Copy `examples/demo-repo/failing/main.tf` to a new `demo/main.tf`.
3. Commit, push, open a pull request.
4. The GuardAI job fails, findings appear as inline annotations.
5. Replace `demo/main.tf` with `examples/demo-repo/passing/main.tf`.
6. Commit and push to the same branch.
7. The workflow re-runs automatically and the job passes.

This requires a workflow scanning `demo/` in the demo repository. Use
`examples/demo-repo/guardai-workflow.yml` as the template and set `path: demo`.

---

## What has actually been verified

See `memory.md` section 3. Nothing is recorded there unless its output was observed.
