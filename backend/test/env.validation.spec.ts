import 'reflect-metadata';
import { validate } from '../src/config/env.validation';

function baseEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/voltx',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    INTEGRATIONS_ENCRYPTION_KEY: 'b'.repeat(32),
    ...overrides,
  };
}

describe('env.validation', () => {
  it('accepts a minimally-valid production config', () => {
    expect(() => validate(baseEnv())).not.toThrow();
  });

  describe('JWT_ACCESS_SECRET', () => {
    it('rejects a secret shorter than 32 characters', () => {
      expect(() => validate(baseEnv({ JWT_ACCESS_SECRET: 'too-short' }))).toThrow();
    });
  });

  describe('AI provider keys', () => {
    it.each(['OPENAI', 'ANTHROPIC', 'GOOGLE_AI'])(
      'rejects %s enabled without its API key',
      (prefix) => {
        expect(() => validate(baseEnv({ [`${prefix}_ENABLED`]: 'true' }))).toThrow();
      },
    );

    it.each(['OPENAI', 'ANTHROPIC', 'GOOGLE_AI'])(
      'accepts %s enabled with its API key set',
      (prefix) => {
        expect(() =>
          validate(baseEnv({ [`${prefix}_ENABLED`]: 'true', [`${prefix}_API_KEY`]: 'key-123' })),
        ).not.toThrow();
      },
    );

    it('accepts a provider left disabled with no key', () => {
      expect(() => validate(baseEnv({ OPENAI_ENABLED: 'false' }))).not.toThrow();
    });
  });

  describe('OAuth client id/secret pairing', () => {
    it('rejects a client id set without its client secret', () => {
      expect(() => validate(baseEnv({ GOOGLE_OAUTH_CLIENT_ID: 'id-only' }))).toThrow();
    });

    it('rejects a client secret set without its client id', () => {
      expect(() => validate(baseEnv({ GOOGLE_OAUTH_CLIENT_SECRET: 'secret-only' }))).toThrow();
    });

    it('accepts a fully-configured pair', () => {
      expect(() =>
        validate(baseEnv({ GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'secret' })),
      ).not.toThrow();
    });

    it('accepts neither half configured', () => {
      expect(() => validate(baseEnv())).not.toThrow();
    });

    it('requires SLACK_SIGNING_SECRET whenever Slack OAuth is configured', () => {
      expect(() =>
        validate(baseEnv({ SLACK_OAUTH_CLIENT_ID: 'id', SLACK_OAUTH_CLIENT_SECRET: 'secret' })),
      ).toThrow();

      expect(() =>
        validate(
          baseEnv({
            SLACK_OAUTH_CLIENT_ID: 'id',
            SLACK_OAUTH_CLIENT_SECRET: 'secret',
            SLACK_SIGNING_SECRET: 'signing-secret',
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('S3 storage fields', () => {
    it('rejects ATTACHMENTS_STORAGE_PROVIDER=s3 without bucket/region/credentials', () => {
      expect(() => validate(baseEnv({ ATTACHMENTS_STORAGE_PROVIDER: 's3' }))).toThrow();
    });

    it('accepts s3 with every required field set', () => {
      expect(() =>
        validate(
          baseEnv({
            ATTACHMENTS_STORAGE_PROVIDER: 's3',
            ATTACHMENTS_S3_BUCKET: 'my-bucket',
            ATTACHMENTS_S3_REGION: 'us-east-1',
            ATTACHMENTS_S3_ACCESS_KEY_ID: 'access-key',
            ATTACHMENTS_S3_SECRET_ACCESS_KEY: 'secret-key',
          }),
        ),
      ).not.toThrow();
    });

    it('accepts local storage with no S3 fields set', () => {
      expect(() => validate(baseEnv({ ATTACHMENTS_STORAGE_PROVIDER: 'local' }))).not.toThrow();
    });
  });

  describe('Redis URL', () => {
    it('rejects REDIS_ENABLED=true without REDIS_URL', () => {
      expect(() => validate(baseEnv({ REDIS_ENABLED: 'true' }))).toThrow();
    });

    it('accepts REDIS_ENABLED=true with REDIS_URL set', () => {
      expect(() =>
        validate(baseEnv({ REDIS_ENABLED: 'true', REDIS_URL: 'redis://localhost:6379' })),
      ).not.toThrow();
    });

    it('accepts Redis disabled with no URL', () => {
      expect(() => validate(baseEnv({ REDIS_ENABLED: 'false' }))).not.toThrow();
    });
  });
});
