# GuardAI Integration Project Context

## 1. Project Overview

GuardAI is a cloud infrastructure governance and AI-assisted remediation platform.

The broader GuardAI product is intended to help organizations govern infrastructure and infrastructure-as-code across multiple platforms. It will eventually define standards, policies, controls, and guardrails, continuously evaluate infrastructure, identify risks, explain their impact, and eventually provide AI-assisted remediation.

However, this project is NOT responsible for building the GuardAI backend, policy engine, control engine, or AI intelligence.

Those components are being developed by another team.

My responsibility is the **developer-facing integration layer**, starting with GitHub.

---

# 2. The Broader GuardAI Concept

The broader GuardAI system can be thought of as:

    Standards
        ↓
    Policies
        ↓
    Controls
        ↓
    Guardrails
        ↓
    Automated enforcement
        ↓
    Infrastructure / CI/CD

The long-term goal is to make infrastructure governance continuously enforceable.

A major differentiator is intended to be AI.

Traditional tools may identify a problem:

    "This infrastructure configuration violates rule X."

GuardAI eventually wants to go further:

    "This PR changes resource X.
     Resource X is used by Y.
     If this change is merged, Y may be affected.
     Here is the likely infrastructure/application/business impact.
     Here is a recommended remediation."

The AI should eventually understand not only whether infrastructure violates a control, but also the context and potential downstream impact of a change.

This intelligence is NOT the first implementation task for this project.

---

# 3. The Platforms GuardAI Eventually Wants to Support

The broader product may eventually integrate with:

- Databricks
- Snowflake
- Data Lakes
- AWS CDK
- AWS CloudFormation / CFT
- Azure ARM Templates
- Azure Bicep
- GitHub Actions
- GitLab CI/CD
- Azure DevOps
- Kubernetes
- OpenShift
- Ansible
- Harness
- Dynatrace
- AWS CloudWatch
- Datadog
- Grafana
- Helm Charts
- Kubernetes YAML

These represent the broader future scope.

DO NOT attempt to implement all of these now.

The immediate implementation target is:

1. GitHub
2. GitHub repositories
3. GitHub Actions
4. Pull Request integration
5. GuardAI API communication

GitLab comes later after GitHub is working properly.

---

# 4. My Assignment

My responsibility is to build the integration that allows developers and CI/CD pipelines to use GuardAI.

The most important requirement from the project discussion is:

> A customer should be able to add a simple GuardAI stage/step to their CI/CD pipeline and have their infrastructure code scanned by GuardAI.

The first target platform is GitHub.

The desired eventual developer experience should be approximately:

```yaml
steps:
  - uses: actions/checkout@v4

  - name: GuardAI
    uses: guardai/scan@v1

Or, during the earlier MVP stage, something equivalent to:

steps:
  - uses: actions/checkout@v4

  - name: GuardAI Scan
    run: guardai scan

The exact implementation can evolve.

The important concept is:

Developer
    ↓
Changes infrastructure code
    ↓
Pushes branch
    ↓
Creates / updates Pull Request
    ↓
GitHub Actions starts
    ↓
GuardAI integration runs
    ↓
GuardAI API receives the relevant code/change
    ↓
GuardAI returns findings
    ↓
Integration reports results
    ↓
PASS or FAIL
5. Important Architectural Boundary

Another team owns the GuardAI backend/API.

Therefore:

This project DOES NOT own:
GuardAI policy engine
GuardAI control engine
GuardAI AI agent
AI business-impact analysis
Infrastructure graph intelligence
Cloud scanning engine
Policy authoring system
Compliance framework implementation
Backend database
Core GuardAI API implementation
This project DOES own:
CLI
Git repository interaction
Detecting relevant files/changes
Sending data to the GuardAI API
Authentication/configuration for the client
Formatting scan results
Exit codes
GitHub Actions integration
Pull Request CI integration
Eventually PR annotations/comments/checks
Eventually reusable GitHub Action packaging
Eventually GitHub Marketplace distribution
Eventually GitLab CI/CD integration
Eventually other CI/CD integrations

Do not duplicate backend functionality.

If an API capability is missing, identify the requirement clearly instead of secretly implementing a second backend.

6. What Is a CLI?

A CLI is a command-line interface.

The intended first command is:

guardai scan

A developer should eventually be able to enter a repository containing infrastructure code and run:

guardai scan

The CLI should:

Understand the current repository.
Determine what should be scanned.
Collect relevant files/changes.
Communicate with the GuardAI API.
Receive structured results.
Display useful results.
Return an appropriate process exit code.

Conceptually:

guardai scan
      ↓
Current repository
      ↓
Identify relevant files/changes
      ↓
GuardAI API
      ↓
Scan result
      ↓
Terminal output
      ↓
Exit code
7. Why the CLI Exists

The CLI should become a reusable integration layer.

The same CLI should eventually be usable from:

Developer laptop
       ↓
guardai scan

GitHub Actions
       ↓
guardai scan

GitLab CI
       ↓
guardai scan

Azure DevOps
       ↓
guardai scan

Other CI/CD systems
       ↓
guardai scan

This is preferable to making every CI/CD integration independently implement the entire GuardAI client.

The CLI should therefore be designed as a reusable client, not as a GitHub-only script.

8. First MVP

The first MVP is deliberately small.

MVP goal

Prove this:

Local repository
      ↓
guardai scan
      ↓
GuardAI API
      ↓
Result
      ↓
Terminal

Then prove:

GitHub repository
      ↓
Pull Request
      ↓
GitHub Actions
      ↓
guardai scan
      ↓
GuardAI API
      ↓
Result
      ↓
GitHub Actions PASS/FAIL

The second flow is the main demonstration required for the first milestone.

9. MVP Phase 1: Basic CLI

Build a minimal CLI.

Expected command:

guardai scan

Initially the CLI can use a mock/local response if necessary to prove the CLI architecture.

Example output:

GuardAI Infrastructure Scan

Repository: example/infrastructure

Scanning...

Found 8 relevant files.

Scan complete.

✓ No violations found

Or:

GuardAI Infrastructure Scan

Repository: example/infrastructure

Scanning...

2 findings detected.

HIGH
S3 bucket encryption is not enabled
terraform/main.tf:42

MEDIUM
Public access is allowed
terraform/storage.tf:18

✗ Scan failed

The exact UI can evolve.

Keep it clean and professional.

10. MVP Phase 2: Real GuardAI API

Once the CLI works locally, connect it to the existing GuardAI API.

The backend team must provide the API contract.

Do NOT invent API endpoints, request formats, authentication formats, or response schemas if they have not been provided.

Before implementing the real API integration, determine:

Base URL
Endpoint
HTTP method
Authentication method
Required headers
Request schema
File/code payload format
Repository metadata requirements
PR metadata requirements
Response schema
Finding schema
Success/failure semantics
Rate limits if relevant
API version

If these are unknown, document them as dependencies/questions.

The CLI should communicate with the real API through a clean client module.

Conceptually:

CLI
 ↓
GuardAI Client
 ↓
HTTP
 ↓
GuardAI API

Keep API communication separated from CLI presentation.

11. MVP Phase 3: Exit Codes

Exit codes are critical for CI/CD.

The CLI should eventually use:

0 = scan passed
non-zero = scan failed / error

For example:

No policy violations
→ exit 0
Policy/control violations found
→ exit 1

Infrastructure/API/system errors may use another non-zero code if appropriate.

Do not mix "policy failure" with "GuardAI itself crashed" without thinking about the distinction.

CI/CD needs to know whether:

The code failed governance checks.
GuardAI itself failed to run.

These are different states.

12. MVP Phase 4: GitHub Actions

Create a GitHub Actions workflow.

Initial conceptual workflow:

name: GuardAI

on:
  pull_request:

jobs:
  guardai:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: GuardAI Scan
        run: guardai scan

The exact implementation should be determined during development.

The purpose is to prove:

Pull Request
    ↓
GitHub Actions
    ↓
GuardAI CLI
    ↓
GuardAI API
    ↓
Result
13. MVP Phase 5: Pull Request Behavior

Eventually, the workflow should run when a PR is:

Opened
Updated
Reopened

The integration should scan the relevant code/change.

Initially, simply failing or passing the GitHub Actions job is sufficient.

Later improvements may include:

PR check
PR comment
Inline annotations
Finding summaries
Links to GuardAI results
Severity information
Changed-file analysis
Baseline handling

Do not implement all of these in the first MVP.

14. The Main Demo

The first serious demo should be extremely simple.

Create a GitHub repository:

guardai-demo

Put infrastructure code inside it:

guardai-demo/
├── main.tf
└── .github/
    └── workflows/
        └── guardai.yml

Then:

Create a branch.
Modify infrastructure code.
Push the branch.
Create a Pull Request.
GitHub Actions automatically starts.
GuardAI runs.
GuardAI scans the relevant changes.
GuardAI returns findings.
GitHub Actions reports PASS or FAIL.

Example:

PR #1

GuardAI
✗ Failed

2 violations found

HIGH
Production database configuration violates control X.

MEDIUM
Storage configuration violates control Y.

Then fix the code.

Push again.

GitHub Actions runs again.

GuardAI
✓ Passed

0 violations found

This is the first complete end-to-end demonstration.

15. GitHub Action vs GitHub Marketplace

Understand the distinction.

GitHub Action

A reusable automation component that GitHub Actions workflows can execute.

Eventually we want something conceptually like:

- uses: guardai/scan@v1
GitHub Marketplace

A distribution/discovery mechanism where developers can find GitHub Actions.

Marketplace is NOT the first milestone.

The development order should be:

CLI
 ↓
CLI + real API
 ↓
CLI inside GitHub Actions
 ↓
Reusable GitHub Action
 ↓
Testing
 ↓
Documentation
 ↓
Marketplace/distribution

Do not begin by trying to publish to Marketplace.

16. Future GitHub Product

Once the MVP works, the GitHub experience should become as simple as possible.

Potential target:

- uses: guardai/scan@v1

The Action should handle things such as:

Installation/setup
Authentication
Repository context
PR context
Changed files
Calling GuardAI
Displaying results
Exit codes
CI failure when required
Optional PR reporting

The developer should not need to understand the internal GuardAI architecture.

17. Future CLI

Potential commands could eventually include:

guardai scan
guardai scan --changed
guardai scan --config guardai.yml
guardai auth login
guardai version
guardai init

But do not implement commands just because they look nice.

Every command must solve a real integration problem.

18. Future GitHub Features

After the basic scan works:

PR Checks

Show GuardAI as a formal GitHub check.

✓ GuardAI / Infrastructure Governance

or

✗ GuardAI / Infrastructure Governance
PR Comments

Example:

GuardAI found 3 issues.

2 High
1 Medium
Annotations

Eventually associate findings with:

file
line
resource
control
severity
Detailed Results

Potentially link to the GuardAI dashboard/API result.

19. Future AI Integration

This is NOT the first milestone.

Eventually GuardAI should go beyond static scanning.

Traditional scanner:

Code
 ↓
Rule
 ↓
Violation

GuardAI:

Code
 ↓
Controls
 ↓
Violation
 ↓
Context analysis
 ↓
Dependency analysis
 ↓
Infrastructure impact
 ↓
Application impact
 ↓
Business impact
 ↓
Explanation
 ↓
AI remediation

Example:

PR changes production database
        ↓
GuardAI identifies database dependency
        ↓
Analyzes downstream resources
        ↓
Determines potential impact
        ↓
Explains the impact in business/application context
        ↓
Suggests a safe remediation

The AI should eventually answer:

"What does this change actually mean?"

not merely:

"Which rule did this code violate?"

20. Future Multi-Platform Support

After GitHub works, the integration architecture should make it possible to support:

GitHub
GitLab
Azure DevOps
Harness
etc.

The core GuardAI API/client should remain reusable.

Conceptually:

                    GuardAI API
                         ▲
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        │                │                │
      GitHub           GitLab          Azure DevOps
        │                │                │
   GitHub Action      GitLab CI       Pipeline
        │                │                │
        └────────────────┼────────────────┘
                         │
                    GuardAI Client

The exact architecture can change if engineering evidence suggests something better.

21. Future Infrastructure Platform Support

GuardAI may eventually understand:

Terraform
AWS CDK
CloudFormation
ARM
Bicep
Kubernetes YAML
Helm
Ansible
OpenShift
Databricks
Snowflake
Data Lakes
Other infrastructure/configuration formats

Do not implement these merely to claim support.

Each integration should have:

Parser/input strategy
Relevant controls
Policy mapping
Testing
CI/CD integration
Useful findings
Remediation strategy
22. Security Requirements

This is a security product.

Therefore, never treat credentials casually.

The integration must eventually consider:

API key handling
GitHub secrets
Environment variables
Token exposure
Logs
Sensitive infrastructure code
API request security
Least privilege
Avoiding accidental secret printing
Secure temporary files
Dependency security
Input validation

Never print API keys or tokens.

Never commit credentials.

Never hardcode secrets.

23. Engineering Principles

Follow these rules throughout the project.

Rule 1: Build incrementally

Do not build the entire future product at once.

Build:

small feature
 ↓
test
 ↓
verify
 ↓
document
 ↓
next feature
Rule 2: Preserve working functionality

Do not rewrite working code unnecessarily.

Rule 3: Inspect before modifying

Before changing anything:

Read the existing code.
Understand the architecture.
Check package configuration.
Check existing documentation.
Check current tests.
Check Git status.
Understand previous work.
Rule 4: Do not hallucinate backend behavior

If the GuardAI API contract is unknown:

STOP and document what is missing.

Do not invent endpoints.

Rule 5: Keep the architecture simple

Avoid unnecessary frameworks and infrastructure.

Rule 6: Test every meaningful step

A feature is not complete because code was written.

It is complete when it has been tested.

Rule 7: Explain unfamiliar concepts

The developer using Claude Code is learning CI/CD and GitHub Actions.

When introducing unfamiliar infrastructure concepts, explain:

What it is.
Why it exists.
What we are doing.
How to test it.

Do not blindly execute commands without explaining what they accomplish.

Rule 8: Never make destructive changes without explicit confirmation

Especially:

deleting repositories
deleting branches
deleting production resources
rotating credentials
changing cloud infrastructure
24. Development Workflow

For each feature:

1. Inspect
2. Explain the plan
3. Implement the smallest version
4. Test locally
5. Test integration
6. Review output
7. Update memory.md
8. Update changelog/documentation if appropriate
9. Commit when stable
10. Move to the next feature

Do not skip directly from idea → huge implementation.

25. Definition of "Done" for the First Milestone

The first milestone is complete when we can demonstrate:

GitHub repository
      ↓
Infrastructure code
      ↓
Pull Request
      ↓
GitHub Actions
      ↓
GuardAI integration
      ↓
Existing GuardAI API
      ↓
Real scan result
      ↓
GitHub Actions PASS/FAIL

Preferably the demo should show both:

Failure
Bad infrastructure change
        ↓
GuardAI
        ↓
Violation
        ↓
CI fails
Success
Fixed infrastructure
        ↓
GuardAI
        ↓
No violations
        ↓
CI passes

That is the first major proof of the product.

26. Current Scope vs Future Scope
CURRENT
CLI
Repository detection
Relevant file/change detection
GuardAI API client
Authentication
Scan command
Structured result handling
Exit codes
GitHub Actions
Pull Request workflow
End-to-end GitHub demonstration
NEXT
Reusable GitHub Action
PR checks
PR comments
Annotations
Better configuration
Documentation
GitHub distribution
LATER
GitLab
Azure DevOps
Harness
More infrastructure formats
More controls
AI explanations
Dependency analysis
Infrastructure impact analysis
Business-context analysis
AI remediation
Continuous governance
Enterprise features
27. The Core Mental Model

Never lose sight of this:

                    GUARD AI
                       │
                       │ API
                       ▼
                 ┌───────────┐
                 │ CLI / SDK  │
                 └─────┬─────┘
                       │
             ┌─────────┴─────────┐
             │                   │
          Developer          CI/CD
             │                   │
       guardai scan        GitHub Actions
                                 │
                                 ▼
                              PR/MR
                                 │
                                 ▼
                            PASS / FAIL

The goal of this project is to make GuardAI easy for developers to plug into their development workflow.

The key sentence is:

"Add GuardAI to your pipeline and have your infrastructure changes automatically evaluated before they reach production."

28. Important Constraint

Do not confuse the MVP with the final product.

The final GuardAI vision is large.

The current assignment is intentionally narrow:

Make GuardAI callable from GitHub, starting with a CLI and GitHub Actions integration.

Everything else comes after that foundation works.