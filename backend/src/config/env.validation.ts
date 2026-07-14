import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsString()
  DATABASE_URL!: string;

  /** Read only by the Prisma CLI (`prisma migrate deploy`/`dev`) via
   * schema.prisma's `directUrl`, never by the running app — declared here
   * purely so `pnpm prisma:migrate:*` fails loudly with a clear message
   * instead of a generic "environment variable not found" if it's unset in
   * an environment (like Neon) where DATABASE_URL is a pooled connection
   * that can't run migrations. */
  @IsOptional()
  @IsString()
  DIRECT_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_CONNECTION_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_POOL_TIMEOUT_SECONDS?: number;

  @IsOptional()
  @IsString()
  DATABASE_QUERY_LOGGING_ENABLED?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_SLOW_QUERY_THRESHOLD_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_TRANSACTION_MAX_WAIT_MS?: number;

  /** v2.2 Platform Scale — read-replica routing point (PrismaService.replica).
   * Unset today in every environment; wiring this to an actual replica is
   * future work, not something this readiness pass claims to have done. */
  @IsOptional()
  @IsString()
  DATABASE_REPLICA_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_TRANSACTION_TIMEOUT_MS?: number;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  RATE_LIMIT_LIMIT?: number;

  @IsOptional()
  @IsString()
  REQUEST_BODY_LIMIT?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_LIMIT?: number;

  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  TRUSTED_PROXY_COUNT?: number;

  @IsOptional()
  @IsString()
  MFA_TOTP_ISSUER?: string;

  @IsOptional()
  @IsString()
  MFA_CHALLENGE_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  MFA_BACKUP_CODE_COUNT?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  MFA_TRUSTED_DEVICE_DEFAULT_DAYS?: number;

  @IsOptional()
  @IsString()
  API_KEY_PREFIX?: string;

  @IsOptional()
  @IsString()
  PERSONAL_ACCESS_TOKEN_PREFIX?: string;

  @IsOptional()
  @IsString()
  SERVICE_ACCOUNT_TOKEN_PREFIX?: string;

  @IsOptional()
  @IsString()
  OAUTH_CLIENT_SECRET_PREFIX?: string;

  @IsOptional()
  @IsString()
  OAUTH_ACCESS_TOKEN_PREFIX?: string;

  @IsOptional()
  @IsString()
  OAUTH_REFRESH_TOKEN_PREFIX?: string;

  @IsOptional()
  @IsString()
  OAUTH_AUTHORIZATION_CODE_PREFIX?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  OAUTH_AUTHORIZATION_CODE_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  OAUTH_ACCESS_TOKEN_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  OAUTH_REFRESH_TOKEN_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  WEBHOOK_MAX_DELIVERY_ATTEMPTS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  WEBHOOK_RETRY_BASE_DELAY_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  WEBHOOK_REQUEST_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  MARKETPLACE_PLATFORM_FEE_BPS?: number;

  @IsOptional()
  @IsString()
  MARKETPLACE_STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  MARKETPLACE_CONNECT_RETURN_BASE_URL?: string;

  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsOptional()
  @IsString()
  SENTRY_ENVIRONMENT?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  SENTRY_TRACES_SAMPLE_RATE?: number;

  @IsOptional()
  @IsString()
  REDIS_ENABLED?: string;

  // Redis boot connectivity is separately hard-enforced by
  // assertRedisRequirement() (redis-requirement.check.ts); this just
  // ensures the URL itself isn't silently blank when REDIS_ENABLED=true.
  @ValidateIf((o: EnvironmentVariables) => o.REDIS_ENABLED === 'true')
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  OTEL_ENABLED?: string;

  @IsOptional()
  @IsString()
  OTEL_SERVICE_NAME?: string;

  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  AI_DEFAULT_PROVIDER?: string;

  @IsOptional()
  @IsString()
  AI_DEFAULT_MODEL?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  AI_MAX_RETRIES?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_RETRY_BASE_DELAY_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_RATE_LIMIT_REQUESTS_PER_MINUTE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_AGENT_LOOP_MAX_ITERATIONS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_AGENT_LOOP_MAX_TOOL_CALLS?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  AI_AGENT_LOOP_TIMEOUT_MS?: number;

  @IsOptional()
  @IsString()
  AI_HTTP_TOOL_ALLOWED_HOSTS?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_MULTI_AGENT_MAX_AGENTS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_MULTI_AGENT_MAX_DEPTH?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  AI_MULTI_AGENT_MAX_PARALLEL?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  AI_MULTI_AGENT_TIMEOUT_MS?: number;

  @IsOptional()
  @IsString()
  OPENAI_ENABLED?: string;

  // Required only when this provider is actually selected — an enabled
  // provider with no key would otherwise fail opaquely at first request
  // instead of at boot.
  @ValidateIf((o: EnvironmentVariables) => o.OPENAI_ENABLED === 'true')
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENAI_BASE_URL?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_ENABLED?: string;

  @ValidateIf((o: EnvironmentVariables) => o.ANTHROPIC_ENABLED === 'true')
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  GOOGLE_AI_ENABLED?: string;

  @ValidateIf((o: EnvironmentVariables) => o.GOOGLE_AI_ENABLED === 'true')
  @IsString()
  GOOGLE_AI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GOOGLE_AI_BASE_URL?: string;

  @IsOptional()
  @IsString()
  KNOWLEDGE_EMBEDDING_PROVIDER?: string;

  @IsOptional()
  @IsString()
  KNOWLEDGE_EMBEDDING_MODEL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_EMBEDDING_DIMENSIONS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_EMBEDDING_BATCH_SIZE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_CHUNK_SIZE_TOKENS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  KNOWLEDGE_CHUNK_OVERLAP_TOKENS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_RETRIEVAL_TOP_K?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_RETRIEVAL_MAX_TOP_K?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  KNOWLEDGE_RETRIEVAL_SEMANTIC_WEIGHT?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  KNOWLEDGE_RETRIEVAL_KEYWORD_WEIGHT?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  KNOWLEDGE_RETRIEVAL_MIN_CONFIDENCE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  KNOWLEDGE_RETRIEVAL_CONTEXT_TOKEN_BUDGET?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  KNOWLEDGE_RETRIEVAL_GRAPH_HOPS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  KNOWLEDGE_RETRIEVAL_CACHE_TTL_MS?: number;

  @IsOptional()
  @IsString()
  INVITATIONS_ACCEPT_BASE_URL?: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_ADDRESS?: string;

  @IsOptional()
  @IsString()
  WEB_APP_BASE_URL?: string;

  // Required in every environment (including dev/test) — this key encrypts
  // every stored OAuth token/API key/webhook secret at rest.
  // EncryptionService.onModuleInit() enforces the same requirement again at
  // boot with a clearer message; this class-validator check exists so a
  // missing key is caught before the app even starts wiring modules.
  @IsString()
  @MinLength(16)
  INTEGRATIONS_ENCRYPTION_KEY!: string;

  @IsOptional()
  @IsString()
  INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS?: string;

  @IsOptional()
  @IsString()
  INTEGRATIONS_WEBHOOK_BASE_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  INTEGRATIONS_POLL_INTERVAL_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  INTEGRATIONS_MAX_RETRIES?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  INTEGRATIONS_RETRY_BASE_DELAY_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  INTEGRATIONS_RATE_LIMIT_REQUESTS_PER_MINUTE?: number;

  // Each OAuth integration is legitimately optional per-deployment (a
  // platform may not offer every third-party connector), so these can't
  // be unconditionally required. What they can't be is half-set: setting
  // only one half of a client id/secret pair currently falls back to an
  // empty string for the other and silently produces a broken
  // authorization URL/token exchange at connect-time instead of failing
  // at boot — OAuthService.assertConfigured (oauth.service.ts) is the
  // matching runtime guard for the case where both are legitimately
  // unset.
  @ValidateIf((o: EnvironmentVariables) => !!o.GOOGLE_OAUTH_CLIENT_SECRET)
  @IsString()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.GOOGLE_OAUTH_CLIENT_ID)
  @IsString()
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.MICROSOFT_OAUTH_CLIENT_SECRET)
  @IsString()
  MICROSOFT_OAUTH_CLIENT_ID?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.MICROSOFT_OAUTH_CLIENT_ID)
  @IsString()
  MICROSOFT_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_OAUTH_TENANT_ID?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => !!o.SLACK_OAUTH_CLIENT_SECRET || !!o.SLACK_SIGNING_SECRET,
  )
  @IsString()
  SLACK_OAUTH_CLIENT_ID?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.SLACK_OAUTH_CLIENT_ID)
  @IsString()
  SLACK_OAUTH_CLIENT_SECRET?: string;

  // Required whenever the Slack app is connected at all — without it,
  // every inbound Slack webhook is silently rejected (see
  // slack-webhook.controller.ts's own `!signingSecret` guard).
  @ValidateIf((o: EnvironmentVariables) => !!o.SLACK_OAUTH_CLIENT_ID)
  @IsString()
  SLACK_SIGNING_SECRET?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_APP_SECRET?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.GITHUB_OAUTH_CLIENT_SECRET)
  @IsString()
  GITHUB_OAUTH_CLIENT_ID?: string;

  @ValidateIf((o: EnvironmentVariables) => !!o.GITHUB_OAUTH_CLIENT_ID)
  @IsString()
  GITHUB_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  STRIPE_API_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  PLATFORM_ADMIN_EMAILS?: string;

  @IsOptional()
  @IsIn(['local', 's3'])
  ATTACHMENTS_STORAGE_PROVIDER?: string;

  @IsOptional()
  @IsString()
  ATTACHMENTS_LOCAL_ROOT_DIR?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ATTACHMENTS_MAX_FILE_SIZE_BYTES?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ATTACHMENTS_SIGNED_URL_TTL_SECONDS?: number;

  // Required whenever S3 storage is selected; verifyProductionReadiness()
  // (s3-storage.provider.ts) separately confirms the bucket is actually
  // reachable at boot in production — this just ensures the fields
  // aren't silently blank in any environment that opts into S3.
  @ValidateIf((o: EnvironmentVariables) => o.ATTACHMENTS_STORAGE_PROVIDER === 's3')
  @IsString()
  ATTACHMENTS_S3_BUCKET?: string;

  @ValidateIf((o: EnvironmentVariables) => o.ATTACHMENTS_STORAGE_PROVIDER === 's3')
  @IsString()
  ATTACHMENTS_S3_REGION?: string;

  @IsOptional()
  @IsString()
  ATTACHMENTS_S3_ENDPOINT?: string;

  @ValidateIf((o: EnvironmentVariables) => o.ATTACHMENTS_STORAGE_PROVIDER === 's3')
  @IsString()
  ATTACHMENTS_S3_ACCESS_KEY_ID?: string;

  @ValidateIf((o: EnvironmentVariables) => o.ATTACHMENTS_STORAGE_PROVIDER === 's3')
  @IsString()
  ATTACHMENTS_S3_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  ATTACHMENTS_S3_FORCE_PATH_STYLE?: string;

  @IsOptional()
  @IsString()
  CLAMAV_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  CLAMAV_PORT?: number;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
