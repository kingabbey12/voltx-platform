import { PrismaService } from '../../src/database/prisma.service';

export async function resetOrganizationsTable(prisma: PrismaService): Promise<void> {
  await prisma.system.membership.deleteMany();
  await prisma.system.organization.deleteMany();
}

export const createOrganizationPayload = {
  name: 'Acme Corporation',
  logoUrl: 'https://cdn.example.com/logos/acme.png',
  industry: 'Technology',
  country: 'US',
  timezone: 'America/New_York',
  settings: { theme: 'dark', notifications: true },
};
