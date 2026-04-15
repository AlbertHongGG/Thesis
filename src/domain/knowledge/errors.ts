export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class InfrastructureError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InfrastructureError';
  }
}
