export class AIRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIRuntimeConfigurationError';
  }
}

export class AIRuntimeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIRuntimeRequestError';
  }
}