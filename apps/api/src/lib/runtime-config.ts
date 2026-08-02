const REQUIRED_SERVER_CONFIGURATION = [
  'DATABASE_URL',
  'CORS_ORIGINS',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'RATE_LIMIT_KEY_SECRET',
  'USDA_FDC_API_KEY',
] as const;

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

function isConfigured(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function isHostedEnvironment(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'staging' || normalized === 'production';
}

function hostedAiConfigurationErrors(
  environment: Record<string, string | undefined>,
): string[] {
  const provider = environment.AI_PROVIDER?.trim().toLowerCase() || 'disabled';
  const errors: string[] = [];

  if (provider !== 'disabled' && provider !== 'gemini') {
    errors.push(
      'AI_PROVIDER must be disabled or gemini outside test environments.',
    );
  }

  const booleanFlags = [
    'PHOTO_CANDIDATE_ADJUDICATION_ENABLED',
    'PHOTO_NUTRITION_ESTIMATION_ENABLED',
    'PHOTO_ESTIMATE_CONFIRMATION_ENABLED',
  ] as const;
  const enabledFlags: string[] = [];

  for (const name of booleanFlags) {
    const value = environment[name]?.trim().toLowerCase();
    if (
      value !== undefined &&
      value !== '' &&
      value !== 'true' &&
      value !== 'false'
    ) {
      errors.push(`${name} must be true or false.`);
    }
    if (value === 'true') enabledFlags.push(name);
  }

  const mockControls = [
    'PHOTO_CANDIDATE_ADJUDICATION_MOCK_DECISION',
    'PHOTO_NUTRITION_ESTIMATION_MOCK',
  ] as const;
  for (const name of mockControls) {
    if (isConfigured(environment[name])) {
      errors.push(`${name} is not allowed outside test environments.`);
    }
  }

  if (provider === 'gemini' && !isConfigured(environment.GEMINI_API_KEY)) {
    errors.push('GEMINI_API_KEY is required when AI_PROVIDER is gemini.');
  }

  if (enabledFlags.length > 0) {
    if (provider !== 'gemini') {
      errors.push(
        'Enabled photo AI features require AI_PROVIDER to be gemini.',
      );
    }
    if (!isConfigured(environment.GEMINI_API_KEY)) {
      errors.push('Enabled photo AI features require GEMINI_API_KEY.');
    }
  }

  if (
    environment.PHOTO_ESTIMATE_CONFIRMATION_ENABLED?.trim().toLowerCase() ===
    'true'
  ) {
    const proofSecret = environment.PHOTO_ESTIMATE_PROOF_SECRET?.trim();
    if (
      proofSecret === undefined ||
      Buffer.byteLength(proofSecret, 'utf8') < 32
    ) {
      errors.push(
        'PHOTO_ESTIMATE_PROOF_SECRET must contain at least 32 bytes when photo estimate confirmation is enabled.',
      );
    }
  }

  return errors;
}

export function validateServerEnvironment(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!isHostedEnvironment(environment.APP_ENV)) return;

  const missing = REQUIRED_SERVER_CONFIGURATION.filter(
    (name) => !isConfigured(environment[name]),
  );
  if (missing.length > 0) {
    throw new RuntimeConfigurationError(
      `Missing required server configuration: ${missing.join(', ')}`,
    );
  }

  const origins = environment
    .CORS_ORIGINS!.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0 || origins.includes('*')) {
    throw new RuntimeConfigurationError(
      'CORS_ORIGINS must contain explicit browser origins outside development.',
    );
  }

  const aiErrors = hostedAiConfigurationErrors(environment);
  if (aiErrors.length > 0) {
    throw new RuntimeConfigurationError(aiErrors.join(' '));
  }
}
