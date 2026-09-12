const MOCK_WARNING = [
  '',
  '  !! MOCK MODE - THESE RESULTS DID NOT COME FROM GUARDAI !!',
  '  Findings below are produced by a throwaway pattern matcher in',
  '  src/api/mock-client.js. It is not the GuardAI policy engine and',
  '  its results mean nothing. Use it only to exercise the pipeline.',
  '',
].join('\n');

const LINE_PATTERNS = [
  {
    pattern: /acl\s*=\s*"public-read(-write)?"/,
    severity: 'high',
    title: 'Storage ACL allows public access',
    controlId: 'MOCK-001',
    remediation: 'Set acl to "private" and grant access through explicit policies.',
  },
  {
    pattern: /cidr_blocks\s*=\s*\[\s*"0\.0\.0\.0\/0"/,
    severity: 'high',
    title: 'Ingress rule allows traffic from any address',
    controlId: 'MOCK-002',
    remediation: 'Restrict cidr_blocks to known networks.',
  },
  {
    pattern: /publicly_accessible\s*=\s*true/,
    severity: 'high',
    title: 'Database instance is publicly accessible',
    controlId: 'MOCK-003',
    remediation: 'Set publicly_accessible to false and use private networking.',
  },
  {
    pattern: /password\s*=\s*"[^"$][^"]*"/,
    severity: 'medium',
    title: 'Credential appears to be hardcoded',
    controlId: 'MOCK-004',
    remediation: 'Move the value to a secret manager and reference it as a variable.',
  },
];

function findLinePatternViolations(file) {
  const findings = [];
  const lines = file.content.split('\n');

  lines.forEach((lineText, index) => {
    for (const rule of LINE_PATTERNS) {
      if (rule.pattern.test(lineText)) {
        findings.push({
          severity: rule.severity,
          title: rule.title,
          description: `Matched the mock pattern for ${rule.controlId}.`,
          path: file.path,
          line: index + 1,
          controlId: rule.controlId,
          remediation: rule.remediation,
        });
      }
    }
  });

  return findings;
}

function findUnencryptedBuckets(file) {
  if (!file.content.includes('resource "aws_s3_bucket"')) {
    return [];
  }
  if (/server_side_encryption|aws_s3_bucket_server_side_encryption_configuration/.test(file.content)) {
    return [];
  }

  const lines = file.content.split('\n');
  const declarationIndex = lines.findIndex((line) => line.includes('resource "aws_s3_bucket"'));

  return [
    {
      severity: 'medium',
      title: 'S3 bucket does not declare server-side encryption',
      description: 'Matched the mock pattern for MOCK-005.',
      path: file.path,
      line: declarationIndex === -1 ? null : declarationIndex + 1,
      controlId: 'MOCK-005',
      remediation: 'Add an aws_s3_bucket_server_side_encryption_configuration resource.',
    },
  ];
}

export function runMockScanner(files) {
  const findings = [];
  for (const file of files) {
    findings.push(...findLinePatternViolations(file));
    findings.push(...findUnencryptedBuckets(file));
  }
  return findings;
}

export function createMockClient() {
  async function submitScan({ files }) {
    console.error(MOCK_WARNING);
    return {
      source: 'mock',
      scanId: null,
      reportUrl: null,
      passed: null,
      findings: runMockScanner(files),
    };
  }

  return { submitScan, isMock: true };
}
