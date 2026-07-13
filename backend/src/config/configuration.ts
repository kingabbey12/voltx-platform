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
    // v2.2 Platform Scale — read-replica routing point (PrismaService.replica).
    // Inert today: unset, `replica` is just an alias for the primary client,
    // proven a true no-op by cache.service.spec.ts-adjacent regression
    // coverage. Wiring specific read-heavy repositories to actually use it
    // is future work, not claimed as done by this readiness pass.
    replicaUrl: process.env.DATABASE_REPLICA_URL ?? undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  },
  security: {
    rateLimitTtlSeconds: parseInt(process.env.RATE_LIMIT_TTL_SECONDS ?? '60', 10),
    rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '120', 10),
    authRateLimitTtlSeconds: parseInt(process.env.AUTH_RATE_LIMIT_TTL_SECONDS ?? '60', 10),
    authRateLimitLimit: parseInt(process.env.AUTH_RATE_LIMIT_LIMIT ?? '10', 10),
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '1mb',
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    // Number of trusted reverse-proxy hops in front of this API (e.g. 1 for
    // a single load balancer). Express only honors X-Forwarded-For up to
    // this many hops when resolving `request.ip` — defaults to 0 (trust
    // nothing, use the raw socket address) so IpAllowlistGuard can never be
    // spoofed via a forged header unless an operator explicitly opts in.
    trustedProxyCount: parseInt(process.env.TRUSTED_PROXY_COUNT ?? '0', 10),
  },
  mfa: {
    // TOTP issuer label shown in authenticator apps (Google Authenticator,
    // 1Password, Authy, etc.) next to the account name.
    totpIssuer: process.env.MFA_TOTP_ISSUER ?? 'Voltx',
    // Lifetime of the short-lived MFA challenge token returned by
    // AuthService.login() in place of full JWTs when a second factor is
    // required — long enough for a human to open their authenticator app,
    // short enough to bound the exposure window if intercepted.
    challengeExpiresIn: process.env.MFA_CHALLENGE_EXPIRES_IN ?? '5m',
    backupCodeCount: parseInt(process.env.MFA_BACKUP_CODE_COUNT ?? '10', 10),
    trustedDeviceDefaultDays: parseInt(process.env.MFA_TRUSTED_DEVICE_DEFAULT_DAYS ?? '30', 10),
  },
  apiKeys: {
    // Non-secret prefix embedded in every issued key (e.g. "vk_live_ab12...")
    // so admins can visually tell keys apart in the UI without the secret
    // ever being re-displayed after creation.
    prefix: process.env.API_KEY_PREFIX ?? 'vk',
  },
  // v2.3 Developer Platform — same non-secret-prefix convention as
  // apiKeys.prefix above, one per new credential kind so they're visually
  // distinguishable at a glance (vpat_ vs vsa_ vs vk_).
  developerPlatform: {
    personalAccessTokenPrefix: process.env.PERSONAL_ACCESS_TOKEN_PREFIX ?? 'vpat',
    serviceAccountTokenPrefix: process.env.SERVICE_ACCOUNT_TOKEN_PREFIX ?? 'vsa',
    // v2.3 Phase 2 — OAuth Applications (Voltx as an authorization server).
    oauthClientSecretPrefix: process.env.OAUTH_CLIENT_SECRET_PREFIX ?? 'vcs',
    oauthAccessTokenPrefix: process.env.OAUTH_ACCESS_TOKEN_PREFIX ?? 'voat',
    oauthRefreshTokenPrefix: process.env.OAUTH_REFRESH_TOKEN_PREFIX ?? 'vort',
    oauthAuthorizationCodePrefix: process.env.OAUTH_AUTHORIZATION_CODE_PREFIX ?? 'vac',
    // Deliberately short — an authorization code is exchanged by the
    // client's backend within seconds of the user approving consent; a
    // long-lived code would needlessly widen the window an intercepted
    // redirect could be replayed in.
    oauthAuthorizationCodeTtlSeconds: parseInt(
      process.env.OAUTH_AUTHORIZATION_CODE_TTL_SECONDS ?? '60',
      10,
    ),
    oauthAccessTokenTtlSeconds: parseInt(process.env.OAUTH_ACCESS_TOKEN_TTL_SECONDS ?? '3600', 10),
    oauthRefreshTokenTtlSeconds: parseInt(
      process.env.OAUTH_REFRESH_TOKEN_TTL_SECONDS ?? '2592000',
      10,
    ),
  },
  // v2.3 Developer Platform (Phase 3) — outbound webhooks.
  webhooks: {
    maxDeliveryAttempts: parseInt(process.env.WEBHOOK_MAX_DELIVERY_ATTEMPTS ?? '6', 10),
    retryBaseDelayMs: parseInt(process.env.WEBHOOK_RETRY_BASE_DELAY_MS ?? '5000', 10),
    requestTimeoutMs: parseInt(process.env.WEBHOOK_REQUEST_TIMEOUT_MS ?? '10000', 10),
  },
  // v2.3 Developer Platform (Phase 7) — Marketplace + Stripe Connect.
  // Registered as its own webhook endpoint in the Stripe dashboard (see
  // MarketplaceStripeWebhookController) — same Stripe account/API key as
  // billing.stripe.apiKey above, but a distinct signing secret since it's a
  // separate endpoint URL.
  marketplace: {
    platformFeeBps: parseInt(process.env.MARKETPLACE_PLATFORM_FEE_BPS ?? '2000', 10),
    stripeWebhookSecret: process.env.MARKETPLACE_STRIPE_WEBHOOK_SECRET ?? '',
    // Stripe Connect Express onboarding needs a return/refresh URL to send
    // the developer back to after the hosted onboarding flow — same
    // caller-is-the-web-app convention as invitations.acceptBaseUrl above.
    connectReturnBaseUrl:
      process.env.MARKETPLACE_CONNECT_RETURN_BASE_URL ??
      'https://app.voltx.example/developers/connect',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  tracing: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'voltx-backend',
    exporterUrl:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      '',
  },
  ai: {
    defaultProvider: process.env.AI_DEFAULT_PROVIDER ?? 'openai',
    defaultModel: process.env.AI_DEFAULT_MODEL ?? 'gpt-5-mini',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES ?? '2', 10),
    retryBaseDelayMs: parseInt(process.env.AI_RETRY_BASE_DELAY_MS ?? '250', 10),
    rateLimit: {
      requestsPerMinute: parseInt(process.env.AI_RATE_LIMIT_REQUESTS_PER_MINUTE ?? '120', 10),
    },
    agentLoop: {
      maxIterations: parseInt(process.env.AI_AGENT_LOOP_MAX_ITERATIONS ?? '8', 10),
      maxToolCalls: parseInt(process.env.AI_AGENT_LOOP_MAX_TOOL_CALLS ?? '12', 10),
      timeoutMs: parseInt(process.env.AI_AGENT_LOOP_TIMEOUT_MS ?? '120000', 10),
    },
    httpTool: {
      // Comma-separated hostnames/domain suffixes. Empty means "allow any
      // public host" — subject to the mandatory private/loopback/metadata
      // block-list enforced by OutboundHttpGuardService regardless.
      allowedHosts: (process.env.AI_HTTP_TOOL_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    },
    multiAgent: {
      maxAgents: parseInt(process.env.AI_MULTI_AGENT_MAX_AGENTS ?? '10', 10),
      maxDepth: parseInt(process.env.AI_MULTI_AGENT_MAX_DEPTH ?? '3', 10),
      maxParallelExecutions: parseInt(process.env.AI_MULTI_AGENT_MAX_PARALLEL ?? '4', 10),
      timeoutMs: parseInt(process.env.AI_MULTI_AGENT_TIMEOUT_MS ?? '300000', 10),
    },
    providers: {
      openai: {
        enabled: process.env.OPENAI_ENABLED === 'true',
        apiKey: process.env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      },
      anthropic: {
        enabled: process.env.ANTHROPIC_ENABLED === 'true',
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
      },
      google: {
        enabled: process.env.GOOGLE_AI_ENABLED === 'true',
        apiKey: process.env.GOOGLE_AI_API_KEY ?? '',
        baseUrl:
          process.env.GOOGLE_AI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
      },
    },
  },
  knowledge: {
    embeddingProvider: process.env.KNOWLEDGE_EMBEDDING_PROVIDER ?? 'openai',
    embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimensions: parseInt(process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS ?? '1536', 10),
    embeddingBatchSize: parseInt(process.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE ?? '64', 10),
    chunking: {
      chunkSizeTokens: parseInt(process.env.KNOWLEDGE_CHUNK_SIZE_TOKENS ?? '400', 10),
      chunkOverlapTokens: parseInt(process.env.KNOWLEDGE_CHUNK_OVERLAP_TOKENS ?? '60', 10),
    },
    retrieval: {
      defaultTopK: parseInt(process.env.KNOWLEDGE_RETRIEVAL_TOP_K ?? '8', 10),
      maxTopK: parseInt(process.env.KNOWLEDGE_RETRIEVAL_MAX_TOP_K ?? '50', 10),
      semanticWeight: parseFloat(process.env.KNOWLEDGE_RETRIEVAL_SEMANTIC_WEIGHT ?? '0.65'),
      keywordWeight: parseFloat(process.env.KNOWLEDGE_RETRIEVAL_KEYWORD_WEIGHT ?? '0.35'),
      minConfidence: parseFloat(process.env.KNOWLEDGE_RETRIEVAL_MIN_CONFIDENCE ?? '0.15'),
      contextTokenBudget: parseInt(
        process.env.KNOWLEDGE_RETRIEVAL_CONTEXT_TOKEN_BUDGET ?? '2000',
        10,
      ),
      graphExpansionHops: parseInt(process.env.KNOWLEDGE_RETRIEVAL_GRAPH_HOPS ?? '1', 10),
      cacheTtlMs: parseInt(process.env.KNOWLEDGE_RETRIEVAL_CACHE_TTL_MS ?? '30000', 10),
    },
  },
  invitations: {
    // The mobile app's deep-link scheme (or a web app's URL) that opens the
    // "accept invitation" screen with ?token=... appended — there is no
    // email-sending infrastructure in this backend, so the invitation
    // response hands this link to the inviter to share directly.
    acceptBaseUrl: process.env.INVITATIONS_ACCEPT_BASE_URL ?? 'voltx://invitations/accept',
  },
  integrations: {
    encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY ?? '',
    // Set only while rotating to a new key — see docs/operations/key-rotation.md.
    encryptionKeyPrevious: process.env.INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS ?? '',
    webhookBaseUrl: process.env.INTEGRATIONS_WEBHOOK_BASE_URL ?? '',
    pollIntervalMs: parseInt(process.env.INTEGRATIONS_POLL_INTERVAL_MS ?? '300000', 10),
    maxRetries: parseInt(process.env.INTEGRATIONS_MAX_RETRIES ?? '3', 10),
    retryBaseDelayMs: parseInt(process.env.INTEGRATIONS_RETRY_BASE_DELAY_MS ?? '500', 10),
    rateLimit: {
      requestsPerMinute: parseInt(
        process.env.INTEGRATIONS_RATE_LIMIT_REQUESTS_PER_MINUTE ?? '60',
        10,
      ),
    },
    providers: {
      google: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      },
      microsoft: {
        clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
        tenantId: process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common',
      },
      slack: {
        clientId: process.env.SLACK_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.SLACK_OAUTH_CLIENT_SECRET ?? '',
        signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
      },
      teams: {
        clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
        tenantId: process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common',
      },
      whatsapp: {
        // One Meta App's secret covers every connected WhatsApp Business
        // phone number — unlike Twilio, where each connection signs
        // webhooks with its own Auth Token.
        appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
        webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '',
      },
      github: {
        clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '',
      },
      stripe: {
        apiKey: process.env.STRIPE_API_KEY ?? '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      },
    },
  },
  attachments: {
    // "local" (filesystem, dev default) or "s3" (any S3-compatible
    // endpoint: AWS S3, Cloudflare R2, Supabase Storage, MinIO).
    storageProvider: process.env.ATTACHMENTS_STORAGE_PROVIDER ?? 'local',
    localRootDir: process.env.ATTACHMENTS_LOCAL_ROOT_DIR ?? '.attachments-storage',
    maxFileSizeBytes: parseInt(
      process.env.ATTACHMENTS_MAX_FILE_SIZE_BYTES ?? `${25 * 1024 * 1024}`,
      10,
    ),
    signedUrlTtlSeconds: parseInt(process.env.ATTACHMENTS_SIGNED_URL_TTL_SECONDS ?? '900', 10),
    s3: {
      // For R2/Supabase/MinIO, set endpoint + forcePathStyle=true; leave
      // endpoint unset for real AWS S3.
      bucket: process.env.ATTACHMENTS_S3_BUCKET ?? '',
      region: process.env.ATTACHMENTS_S3_REGION ?? 'auto',
      endpoint: process.env.ATTACHMENTS_S3_ENDPOINT ?? undefined,
      accessKeyId: process.env.ATTACHMENTS_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.ATTACHMENTS_S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: process.env.ATTACHMENTS_S3_FORCE_PATH_STYLE === 'true',
    },
    virusScan: {
      // If unset, uploads skip real scanning (NoopVirusScanProvider) —
      // safe for local dev, must be configured before production use.
      clamavHost: process.env.CLAMAV_HOST ?? '',
      clamavPort: parseInt(process.env.CLAMAV_PORT ?? '3310', 10),
    },
  },
  billing: {
    // Voltx's OWN Stripe account, billing organizations for their
    // subscription — distinct from integrations.providers.stripe above,
    // which is a customer's own connected Stripe account (per-org OAuth/
    // API-key credential, used by the AI tool catalog). Same env var
    // names as that pre-existing (never-wired-up) declaration since
    // nothing else reads them, but a dedicated config path here so the
    // two concerns never collide.
    stripe: {
      apiKey: process.env.STRIPE_API_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    },
    // Comma-separated allowlist of emails granted cross-organization
    // Super Admin Billing Console access — checked (and self-healed
    // onto User.isPlatformAdmin) at login, never self-service.
    platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  },
  customerSuccess: {
    // Lifetime of an impersonation access token (v2.2 SupportSession) —
    // deliberately short since it grants full 'admin'-role access to
    // whichever organization it targets; a platform admin who needs more
    // time starts a fresh, separately-audited session rather than this
    // being extended.
    supportSessionDurationMinutes: parseInt(
      process.env.SUPPORT_SESSION_DURATION_MINUTES ?? '45',
      10,
    ),
  },
});
