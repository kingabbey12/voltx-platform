import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

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
