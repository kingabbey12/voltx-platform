/**
 * v1.9.1 hardening — re-encrypts every stored OAuth/webhook secret under a
 * new INTEGRATIONS_ENCRYPTION_KEY, so the previous key (kept only for the
 * duration of a rotation via INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS, see
 * docs/operations/key-rotation.md) can eventually be retired.
 *
 * Run with BOTH the new key and the key being retired set:
 *
 *   INTEGRATIONS_ENCRYPTION_KEY=<new-key> \
 *   INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS=<key-being-retired> \
 *   DATABASE_URL=<prod-database-url> \
 *   npx ts-node --transpile-only scripts/reencrypt-secrets.ts
 *
 * Reuses EncryptionService.decrypt()'s built-in current-key-then-previous-
 * key fallback unchanged, so this script never re-implements the crypto —
 * it just calls the same production code path against every row.
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';

const prisma = new PrismaClient();

function buildEncryptionService(): EncryptionService {
  const configService = {
    get: (path: string, defaultValue?: string) => {
      if (path === 'integrations.encryptionKey') {
        return process.env.INTEGRATIONS_ENCRYPTION_KEY ?? defaultValue ?? '';
      }
      if (path === 'integrations.encryptionKeyPrevious') {
        return process.env.INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS ?? defaultValue ?? '';
      }
      return defaultValue;
    },
  } as unknown as ConfigService;

  const service = new EncryptionService(configService);
  service.onModuleInit();
  return service;
}

async function reencryptTable<T extends { id: string; encryptedPayload: string }>(
  label: string,
  findMany: () => Promise<T[]>,
  update: (id: string, encryptedPayload: string) => Promise<unknown>,
  encryptionService: EncryptionService,
): Promise<void> {
  const rows = await findMany();
  console.log(`${label}: ${rows.length} row(s) to re-encrypt`);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const plaintext = encryptionService.decrypt(row.encryptedPayload);
      const reencrypted = encryptionService.encrypt(plaintext);
      await update(row.id, reencrypted);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(`  Failed to re-encrypt ${label} row ${row.id}:`, error);
    }
  }

  console.log(`${label}: ${succeeded} succeeded, ${failed} failed`);
}

async function reencryptWebhookSecrets(encryptionService: EncryptionService): Promise<void> {
  const rows = await prisma.integrationWebhookEndpoint.findMany({
    select: { id: true, encryptedSecret: true },
  });
  console.log(`integration_webhook_endpoints: ${rows.length} row(s) to re-encrypt`);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const plaintext = encryptionService.decrypt(row.encryptedSecret);
      const reencrypted = encryptionService.encrypt(plaintext);
      await prisma.integrationWebhookEndpoint.update({
        where: { id: row.id },
        data: { encryptedSecret: reencrypted },
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(`  Failed to re-encrypt integration_webhook_endpoints row ${row.id}:`, error);
    }
  }

  console.log(`integration_webhook_endpoints: ${succeeded} succeeded, ${failed} failed`);
}

async function main(): Promise<void> {
  if (!process.env.INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS) {
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS must be set to the key being retired — this script has nothing to decrypt with otherwise.',
    );
  }

  const encryptionService = buildEncryptionService();

  await reencryptTable(
    'integration_credentials',
    () => prisma.integrationCredential.findMany({ select: { id: true, encryptedPayload: true } }),
    (id, encryptedPayload) =>
      prisma.integrationCredential.update({ where: { id }, data: { encryptedPayload } }),
    encryptionService,
  );

  await reencryptTable(
    'comms_channel_credentials',
    () => prisma.commsChannelCredential.findMany({ select: { id: true, encryptedPayload: true } }),
    (id, encryptedPayload) =>
      prisma.commsChannelCredential.update({ where: { id }, data: { encryptedPayload } }),
    encryptionService,
  );

  await reencryptWebhookSecrets(encryptionService);

  console.log('\nDone. Once you have confirmed the app is healthy, remove');
  console.log('INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS from the environment.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
