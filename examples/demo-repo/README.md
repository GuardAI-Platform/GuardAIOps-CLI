# Demo fixtures

Two tiny Terraform files used to prove that GuardAI blocks bad infrastructure and
allows good infrastructure.

| Path | Purpose |
|------|---------|
| `passing/main.tf` | Encrypted bucket, restricted ingress, private database, password from a variable. Expected result: PASS. |
| `failing/main.tf` | Public bucket ACL, ingress from `0.0.0.0/0`, publicly accessible database, hardcoded password, no encryption. Expected result: FAIL. |
| `guardai-workflow.yml` | The workflow a customer copies into their own repository. |

Try them:

```bash
node bin/guardai.js scan --mock --path examples/demo-repo/passing
node bin/guardai.js scan --mock --path examples/demo-repo/failing
```

The first exits `0`, the second exits `1`.

These are run in mock mode, so the findings come from the throwaway pattern matcher
in `src/api/mock-client.js`, not from GuardAI. See `docs/API-CONTRACT.md`.

## Using the workflow template

1. Create a repository called `guardai-demo`.
2. Copy `guardai-workflow.yml` to `.github/workflows/guardai.yml` in it.
3. Replace `YOUR-ORG/guardai-cli@main` with the real location of this repository.
4. Add `GUARDAI_API_URL` and `GUARDAI_API_KEY` as repository secrets, or set
   `mock: 'true'` until the API contract is available.
5. Add infrastructure code, open a pull request, and watch the check.
