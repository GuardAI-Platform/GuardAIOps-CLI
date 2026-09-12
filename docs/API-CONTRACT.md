# GuardAI API Contract — Required Information

**Status: NOT PROVIDED. Phases 3 and 4 are blocked.**

The GuardAI backend/API is built by another team. Nothing in this repository has
verified knowledge of it. `context.md` describes intent but specifies no endpoint,
no authentication scheme, no request format, and no response schema.

Nothing here has been invented. Every provisional assumption is isolated in exactly
one file:

```
src/api/provisional-contract.js
```

When the contract arrives, that file is the only one that should need to change.

---

## What the CLI currently assumes (all unverified)

These placeholders exist purely so the code can be written and tested. **Each one is
a guess and should be treated as wrong until confirmed.**

| Assumption | Provisional value |
|------------|-------------------|
| Scan endpoint | `POST {GUARDAI_API_URL}/v1/scans` |
| Auth header | `Authorization: Bearer <key>` |
| Request content type | `application/json` |
| Request body | `{ client, repository, trigger, files[] }` with full file contents inline |
| Response body | `{ scanId, passed, reportUrl, findings[] }` |
| Finding fields | `severity`, `title`, `description`, `path`/`file`, `line`, `controlId`/`control`/`ruleId`, `remediation` |
| Severity values | `info`, `low`, `medium`, `high`, `critical` |
| Scan model | Synchronous — one request returns the result |
| Verdict owner | The client decides from severities unless the response contains a boolean `passed` |

If the response does not contain a findings array, the CLI raises a
`ContractMismatchError` and exits `3` rather than pretending the scan passed. This is
deliberate: a silent pass on a malformed response would be a security failure.

---

## Questions the backend team must answer

### Connection

1. What is the base URL? Are there separate staging and production URLs?
2. What is the endpoint path and HTTP method for starting a scan?
3. Is there an API version, and is it in the URL path or a header?
4. What is the expected request timeout, and are there rate limits?

### Authentication

5. What is the authentication method — `Authorization: Bearer`, `X-API-Key`, or
   something else?
6. What is the exact header name and token format?
7. How does a customer obtain a key, and is it per-organisation or per-repository?
8. Do keys expire or need rotation?

### Request

9. How is code sent? Options:
   - raw file contents inline in JSON
   - a multipart upload of a tar or zip archive
   - a git diff or patch
   - just a git reference that the backend clones itself
10. What is the maximum request size, maximum file count, and maximum single file size?
11. What encoding is expected for file contents?
12. Which repository metadata fields are required? (owner, repo name, provider,
    branch, commit SHA, default branch, clone URL)
13. Which pull request metadata fields are required? (PR number, base ref, head ref,
    base SHA, head SHA, list of changed files)
14. Should the client send only changed files for a pull request, or the full tree?
15. Which file types does the backend actually accept today? The CLI currently sends
    only `.tf` and `.tfvars`.

### Response

16. What is the exact response schema?
17. What is the exact finding schema, and what are the exact severity strings?
18. Does a finding carry a line number, a line range, or only a file?
19. Does the response contain a pass/fail verdict, or does the client decide?
20. If the client decides, is the threshold configurable, and where does that
    configuration live — the CLI, the API, or a policy in GuardAI?
21. Is there a report URL to link to from the pull request comment?

### Behaviour

22. Is scanning synchronous or asynchronous? If asynchronous:
    - what is returned immediately?
    - what is the polling endpoint?
    - what is the recommended poll interval and overall timeout?
    - what are the terminal states?
23. What are the error status codes and the error body format?
24. What happens when zero files are submitted?
25. Is there a health or version endpoint the CLI can use to verify connectivity?

---

## What to change when the answers arrive

1. Update `src/api/provisional-contract.js` with the real path, headers, request
   builder, and response normalizer.
2. Rename the file to `contract.js` and update the imports in `src/api/client.js`.
3. Remove `ContractMismatchError`'s reference to the provisional file if it no longer
   applies.
4. If scanning is asynchronous, add the polling loop to `src/api/client.js` only. No
   other module should change.
5. Update the "What the CLI currently assumes" table above with the confirmed values.
6. Add a test in `test/provisional-contract.test.js` using a **real** captured
   response.
7. Delete `src/api/mock-client.js` and the `--mock` flag once the real API is working,
   or keep it explicitly for offline development and say so in `README.md`.
8. Record the confirmed contract in `memory.md`.

---

## Why a mock exists

The mock in `src/api/mock-client.js` exists only to prove that the pipeline wiring
works: CLI to file discovery to a result to an exit code to a red or green CI job.

It is a throwaway pattern matcher over about five regular expressions. It is not a
policy engine, it does not implement GuardAI controls, and its findings carry no
meaning. It prints a warning on every run and labels its output in the terminal, the
job summary, and the PR comment.

It must never become the default, and it must never be presented to a customer as a
GuardAI scan result.
