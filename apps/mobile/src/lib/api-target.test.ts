import { describe, expect, it } from 'vitest';
import {
  classifyApiTarget,
  resolveApiRuntimeConfig,
  validateApiTarget,
} from './api-target';

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
    expect(classifyApiTarget('https://api.example.com/wrong', 'staging')).toBe(
      'invalid/missing',
    );
    expect(
      classifyApiTarget('https://api.example.com/api/v1?debug=true', 'staging'),
    ).toBe('invalid/missing');
    expect(classifyApiTarget('https://api.local/api/v1', 'staging')).toBe(
      'invalid/missing',
    );
    expect(classifyApiTarget('https://0.0.0.0/api/v1', 'staging')).toBe(
      'invalid/missing',
    );
  });

  it.each([
    'https://localhost/api/v1',
    'https://127.0.0.1/api/v1',
    'https://10.0.0.4/api/v1',
    'https://172.16.0.4/api/v1',
    'https://192.168.1.4/api/v1',
    'https://169.254.1.4/api/v1',
    'https://100.64.0.4/api/v1',
    'https://[::1]/api/v1',
    'https://[fd00::1]/api/v1',
    'https://[fe80::1]/api/v1',
    'https://[::ffff:192.168.1.4]/api/v1',
    'https://[::127.0.0.1]/api/v1',
    'https://[::192.168.1.4]/api/v1',
    'https://[ff02::1]/api/v1',
    'https://[2001:db8::1]/api/v1',
    'https://192.0.2.4/api/v1',
    'https://198.51.100.4/api/v1',
    'https://999.1.1.1/api/v1',
  ])('rejects non-public staging target %s', (value) => {
    expect(() => validateApiTarget(value, 'staging')).toThrow();
  });

  it('rejects an unknown runtime environment', () => {
    expect(() =>
      validateApiTarget('https://api.example.com/api/v1', 'preview'),
    ).toThrow();
    expect(classifyApiTarget('https://api.example.com/api/v1', 'preview')).toBe(
      'invalid/missing',
    );
  });

  it('normalizes a valid target without retaining a trailing slash', () => {
    expect(
      validateApiTarget('https://staging.example.com/api/v1/', 'staging'),
    ).toBe('https://staging.example.com/api/v1');
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
