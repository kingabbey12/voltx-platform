import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type FeatureUnit = 'COUNT' | 'TOKENS' | 'BYTES' | 'MINUTES';

interface FeatureSeed {
  key: string;
  name: string;
  unit: FeatureUnit;
  category: string;
}

const GB = 1024 * 1024 * 1024;

const FEATURE_SEEDS: FeatureSeed[] = [
  { key: 'users', name: 'Team members', unit: 'COUNT', category: 'Platform' },
  { key: 'storage', name: 'Storage', unit: 'BYTES', category: 'Platform' },
  { key: 'ai_requests', name: 'AI requests', unit: 'COUNT', category: 'AI' },
  { key: 'ai_tokens', name: 'AI tokens', unit: 'TOKENS', category: 'AI' },
  { key: 'workflow_executions', name: 'Workflow executions', unit: 'COUNT', category: 'Workflow' },
  { key: 'crm_records', name: 'CRM records', unit: 'COUNT', category: 'CRM' },
  { key: 'communications', name: 'Messages sent/received', unit: 'COUNT', category: 'Communications' },
  { key: 'email_accounts', name: 'Connected email accounts', unit: 'COUNT', category: 'Communications' },
  { key: 'whatsapp_messages', name: 'WhatsApp messages', unit: 'COUNT', category: 'Communications' },
  { key: 'voice_minutes', name: 'Voice minutes', unit: 'MINUTES', category: 'Communications' },
  { key: 'sms_messages', name: 'SMS messages', unit: 'COUNT', category: 'Communications' },
  { key: 'calendar_connections', name: 'Calendar connections', unit: 'COUNT', category: 'Platform' },
  { key: 'api_requests', name: 'API requests', unit: 'COUNT', category: 'Platform' },
  { key: 'attachments', name: 'Attachments', unit: 'COUNT', category: 'Platform' },
  { key: 'integrations', name: 'Active integrations', unit: 'COUNT', category: 'Platform' },
];

interface PlanSeed {
  key: string;
  name: string;
  description: string;
  priceMonthlyUsd: number | null;
  priceYearlyUsd: number | null;
  sortOrder: number;
  trialDays: number;
  /** null = unlimited (only Enterprise). */
  limits: Record<string, number | null>;
}

const PLAN_SEEDS: PlanSeed[] = [
  {
    key: 'free',
    name: 'Free',
    description: 'Get started with the essentials, no credit card required.',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    sortOrder: 0,
    trialDays: 14,
    limits: {
      users: 2,
      storage: 1 * GB,
      ai_requests: 50,
      ai_tokens: 100_000,
      workflow_executions: 10,
      crm_records: 100,
      communications: 50,
      email_accounts: 1,
      whatsapp_messages: 0,
      voice_minutes: 0,
      sms_messages: 0,
      calendar_connections: 1,
      api_requests: 1_000,
      attachments: 50,
      integrations: 1,
    },
  },
  {
    key: 'starter',
    name: 'Starter',
    description: 'For small teams getting real work done with AI and automation.',
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    sortOrder: 1,
    trialDays: 14,
    limits: {
      users: 5,
      storage: 10 * GB,
      ai_requests: 500,
      ai_tokens: 1_000_000,
      workflow_executions: 100,
      crm_records: 1_000,
      communications: 500,
      email_accounts: 2,
      whatsapp_messages: 100,
      voice_minutes: 30,
      sms_messages: 100,
      calendar_connections: 2,
      api_requests: 10_000,
      attachments: 500,
      integrations: 3,
    },
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'Full-featured plan for growing teams that live in Voltx daily.',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    sortOrder: 2,
    trialDays: 14,
    limits: {
      users: 20,
      storage: 50 * GB,
      ai_requests: 2_500,
      ai_tokens: 5_000_000,
      workflow_executions: 1_000,
      crm_records: 10_000,
      communications: 5_000,
      email_accounts: 5,
      whatsapp_messages: 1_000,
      voice_minutes: 200,
      sms_messages: 1_000,
      calendar_connections: 5,
      api_requests: 100_000,
      attachments: 5_000,
      integrations: 10,
    },
  },
  {
    key: 'business',
    name: 'Business',
    description: 'Higher limits and priority support for scaling organizations.',
    priceMonthlyUsd: 299,
    priceYearlyUsd: 2_990,
    sortOrder: 3,
    trialDays: 14,
    limits: {
      users: 100,
      storage: 250 * GB,
      ai_requests: 10_000,
      ai_tokens: 25_000_000,
      workflow_executions: 10_000,
      crm_records: 100_000,
      communications: 50_000,
      email_accounts: 20,
      whatsapp_messages: 10_000,
      voice_minutes: 1_000,
      sms_messages: 10_000,
      calendar_connections: 20,
      api_requests: 1_000_000,
      attachments: 50_000,
      integrations: 25,
    },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited usage, dedicated support, and custom contracts. Contact us.',
    priceMonthlyUsd: null,
    priceYearlyUsd: null,
    sortOrder: 4,
    trialDays: 14,
    // Every dimension unlimited.
    limits: Object.fromEntries(FEATURE_SEEDS.map((feature) => [feature.key, null])),
  },
];

async function seedBillingPlans(): Promise<void> {
  if (PLAN_SEEDS.length !== 5) {
    throw new Error(`Expected exactly 5 billing plans, found ${PLAN_SEEDS.length}`);
  }

  const featureIdByKey = new Map<string, string>();
  for (const feature of FEATURE_SEEDS) {
    const record = await prisma.feature.upsert({
      where: { key: feature.key },
      create: { key: feature.key, name: feature.name, unit: feature.unit, category: feature.category },
      update: { name: feature.name, unit: feature.unit, category: feature.category },
    });
    featureIdByKey.set(feature.key, record.id);
    console.log(`Seeded feature "${feature.key}"`);
  }

  for (const plan of PLAN_SEEDS) {
    const missingFeatures = Object.keys(plan.limits).filter((key) => !featureIdByKey.has(key));
    if (missingFeatures.length > 0) {
      throw new Error(`Plan "${plan.key}" references unknown feature(s): ${missingFeatures.join(', ')}`);
    }

    const record = await prisma.plan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        name: plan.name,
        description: plan.description,
        priceMonthlyUsd: plan.priceMonthlyUsd,
        priceYearlyUsd: plan.priceYearlyUsd,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthlyUsd: plan.priceMonthlyUsd,
        priceYearlyUsd: plan.priceYearlyUsd,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
    });

    for (const [featureKey, limit] of Object.entries(plan.limits)) {
      const featureId = featureIdByKey.get(featureKey);
      if (!featureId) continue;
      await prisma.featureLimit.upsert({
        where: { planId_featureId: { planId: record.id, featureId } },
        create: { planId: record.id, featureId, limit },
        update: { limit },
      });
    }

    console.log(`Seeded plan "${plan.key}" (${Object.keys(plan.limits).length} feature limits)`);
  }
}

if (require.main === module) {
  seedBillingPlans()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { seedBillingPlans, PLAN_SEEDS, FEATURE_SEEDS };
