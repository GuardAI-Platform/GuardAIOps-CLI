export class GuardAiError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'GuardAiError';
    this.hint = hint ?? null;
  }
}

export class ConfigurationError extends GuardAiError {
  constructor(message, hint) {
    super(message, hint);
    this.name = 'ConfigurationError';
  }
}

export class ApiError extends GuardAiError {
  constructor(message, hint) {
    super(message, hint);
    this.name = 'ApiError';
  }
}

export class ContractMismatchError extends GuardAiError {
  constructor(message) {
    super(
      message,
      'The GuardAI API response did not match the provisional contract in src/api/provisional-contract.js. See docs/API-CONTRACT.md.',
    );
    this.name = 'ContractMismatchError';
  }
}
