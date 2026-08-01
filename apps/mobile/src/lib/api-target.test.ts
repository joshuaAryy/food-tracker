import { describe, expect, it } from 'vitest';
import { classifyApiTarget, resolveApiRuntimeConfig } from './api-target';

describe('API target classification', () => {
  it('classifies local development targets', () => {
    expect(
      classifyApiTarget('http://localhost:3000/api/v1', 'development'),
    ).toBe('local');
    expect(
      classifyApiTarget('http://192.168.1.10:3000/api/v1', 'development'),
    ).toBe('local');
  });

  it('classifies public HTTPS staging targets', () => {
    expect(
      classifyApiTarget('https://staging.example.com/api/v1', 'staging'),
    ).toBe('staging');
  });

  it('rejects missing or unsafe staging targets', () => {
    expect(classifyApiTarget(undefined, 'staging')).toBe('invalid/missing');
    expect(classifyApiTarget('http://localhost:3000/api/v1', 'staging')).toBe(
      'invalid/missing',
    );
    expect(classifyApiTarget('not-a-url', 'staging')).toBe('invalid/missing');
  });

  it('resolves the API target from Expo runtime extra', () => {
    expect(
      resolveApiRuntimeConfig({
        apiUrl: 'https://staging.example.com/api/v1',
        appEnvironment: 'staging',
      }),
    ).toEqual({
      apiUrl: 'https://staging.example.com/api/v1',
      category: 'staging',
      environment: 'staging',
    });
  });

  it('fails clearly when staging runtime extra is missing or local', () => {
    expect(() => resolveApiRuntimeConfig(undefined)).toThrow(
      'API runtime configuration is unavailable.',
    );
    expect(() =>
      resolveApiRuntimeConfig({
        apiUrl: 'http://localhost:3000/api/v1',
        appEnvironment: 'staging',
      }),
    ).toThrow('Staging API target must use a public HTTPS host.');
  });
});
