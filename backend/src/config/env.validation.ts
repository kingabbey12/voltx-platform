import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
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

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_TRANSACTION_TIMEOUT_MS?: number;

  @IsString()
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

  @IsOptional()
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

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENAI_BASE_URL?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_ENABLED?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  GOOGLE_AI_ENABLED?: string;

  @IsOptional()
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
  INTEGRATIONS_ENCRYPTION_KEY?: string;

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

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_OAUTH_TENANT_ID?: string;

  @IsOptional()
  @IsString()
  SLACK_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  SLACK_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  SLACK_SIGNING_SECRET?: string;

  @IsOptional()
  @IsString()
  GITHUB_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GITHUB_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  STRIPE_API_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;
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
