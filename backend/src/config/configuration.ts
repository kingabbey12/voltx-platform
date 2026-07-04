export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  databaseUrl: process.env.DATABASE_URL,
  database: {
    connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT ?? '10', 10),
    poolTimeoutSeconds: parseInt(process.env.DATABASE_POOL_TIMEOUT_SECONDS ?? '10', 10),
    queryLoggingEnabled: process.env.DATABASE_QUERY_LOGGING_ENABLED === 'true',
    slowQueryThresholdMs: parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD_MS ?? '500', 10),
    transactionMaxWaitMs: parseInt(process.env.DATABASE_TRANSACTION_MAX_WAIT_MS ?? '5000', 10),
    transactionTimeoutMs: parseInt(process.env.DATABASE_TRANSACTION_TIMEOUT_MS ?? '10000', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  },
  security: {
    rateLimitTtlSeconds: parseInt(process.env.RATE_LIMIT_TTL_SECONDS ?? '60', 10),
    rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '120', 10),
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '1mb',
  },
  tracing: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'voltx-backend',
    exporterUrl:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      '',
  },
});
