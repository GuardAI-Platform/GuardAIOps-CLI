# GitHub Actions, explained from scratch

This document assumes you have never used CI/CD. It explains the ideas first, then
what this repository actually does.

---

## 1. The problem CI/CD solves

Without automation, "did anyone check this infrastructure change?" depends on a human
remembering. CI/CD means: **every time code changes, a computer automatically runs
your checks.** If a check fails, the change is visibly blocked.

GuardAI's job is to be one of those checks.

---

## 2. Vocabulary

| Term | Plain English |
|------|---------------|
| **Runner** | A fresh temporary computer GitHub rents you for a few minutes. It starts empty, does the work, and is destroyed. |
| **Workflow** | A YAML file in `.github/workflows/` describing what to run and when. |
| **Trigger / event** | What starts a workflow. For us: a pull request being opened or updated. |
| **Job** | A group of steps that runs on one runner. Jobs run in parallel by default. |
| **Step** | One thing to do: check out code, install Node, run a command. |
| **Action** | A reusable, packaged step someone else wrote. Used with `uses:`. |
| **Secret** | An encrypted value stored in GitHub settings. Available to workflows, hidden from logs. |
| **Exit code** | The number a program returns when it finishes. `0` means success. Anything else means failure. |

**The single most important idea:** a step passes or fails purely because of the exit
code of the command it ran. Zero is green. Non-zero is red. That is the entire
mechanism. Everything GuardAI does in CI ultimately reduces to choosing that number.

---

## 3. Reading a workflow file

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
        uses: GuardAI-Platform/GuardAIOps-CLI@main
        with:
          api-key: ${{ secrets.GUARDAI_API_KEY }}
```

Line by line:

- `on: pull_request` — run this when a PR is opened, updated, or reopened.
  `synchronize` is GitHub's word for "new commits were pushed to the PR".
- `permissions` — what the automatic token is allowed to do. `pull-requests: write`
  is needed only because we post a comment. Least privilege: grant nothing more.
- `runs-on: ubuntu-latest` — the kind of temporary computer to rent.
- `steps` — run in order, top to bottom. If one fails, the rest are skipped.
- `uses: actions/checkout@v4` — **downloads your repository onto the runner.** The
  runner starts empty, so without this step there is no code to scan. This is the
  single most commonly forgotten step.
- `fetch-depth: 0` — download the full git history instead of just the latest commit.
  Required for `changed-only`, because comparing against the base branch needs that
  branch to exist locally.
- `${{ secrets.GUARDAI_API_KEY }}` — read an encrypted value from repository settings.
  The literal key never appears in the file or the logs.

---

## 4. What this repository provides

### The CLI

`node bin/guardai.js scan` — finds infrastructure files, sends them to GuardAI, prints
results, returns an exit code.

### The Action

`action.yml` wraps the CLI so a customer writes four lines instead of ten. It is a
**composite** action, meaning it is just a list of steps in YAML — no build process,
no bundling, no dependencies. That keeps it readable.

What it does:

1. Installs Node.js on the runner.
2. Builds the CLI command from the inputs you passed.
3. Runs the CLI.
4. Records `passed` and `findings-count` as step outputs.
5. Exits with the CLI's exit code, so the job goes green or red correctly.

One detail worth understanding: inputs are passed to the shell through **environment
variables**, never pasted directly into the script text. Pasting untrusted input
straight into a shell command is a real injection vulnerability in many public
actions. This one avoids it deliberately.

---

## 5. What GuardAI shows on a pull request

Three layers of reporting, from cheapest to richest:

1. **Red or green check.** Always. Comes free from the exit code.
2. **Inline annotations.** The CLI prints special lines like
   `::error file=main.tf,line=11::...`. GitHub recognises this format and pins the
   message to that exact line in the "Files changed" tab. No token required.
3. **Job summary and PR comment.** A markdown table of findings. The summary appears
   on the run page automatically; the PR comment requires `pr-comment: 'true'`,
   `github-token`, and `pull-requests: write`. Re-running updates the existing
   comment instead of adding a new one, using a hidden marker in the comment body.

---

## 6. The two workflows in this repository

### `.github/workflows/ci.yml`

Tests the CLI itself. Runs `npm test` on every push and pull request. This is about
protecting our own code.

### `.github/workflows/guardai-demo.yml`

Proves the product works end to end, with two jobs:

- **Clean infrastructure passes** — scans `examples/demo-repo/passing`, expects green.
- **Insecure infrastructure is blocked** — scans `examples/demo-repo/failing` with
  `continue-on-error: true`, then a following step asserts that the GuardAI step
  actually failed.

That second pattern is worth learning. `continue-on-error: true` means "record the
failure but keep going", which lets us check that GuardAI failed *on purpose*. A
demo that only ever goes green proves nothing.

Both run in `mock: 'true'` because the real API contract is not available yet.

---

## 7. Running the demo yourself

1. Push this repository to GitHub.
2. Create a branch and open a pull request.
3. Open the **Actions** tab and watch both jobs.

Expected: the clean job is green, and the insecure job is green *because it correctly
verified that GuardAI failed*. Open the insecure job's log to see the findings and the
job summary.

---

## 8. Common failures and what they mean

| Symptom | Cause |
|---------|-------|
| "No infrastructure files matched" | The checkout step is missing, or `path` points somewhere wrong. |
| `--changed` fails with "could not determine a base git reference" | `fetch-depth: 0` was not set on checkout. |
| Exit code 3 with "API is not configured" | `api-url` or `api-key` was not passed, and `mock` was not enabled. |
| PR comment skipped | Missing `github-token`, or `pull-requests: write` permission, or the run is not on a pull request. |
| Annotations do not appear on a line | The finding's file path is not repo-relative, or the file is not part of the PR diff. |

---

## 9. What is deliberately not built yet

- Publishing to the GitHub Marketplace (Phase 11).
- Azure DevOps and other CI systems.
- A formal GitHub Check Run with its own UI panel. The current red/green check plus
  annotations covers the need without requiring extra permissions.

GitLab CI **is** supported. See [GITLAB.md](GITLAB.md).
