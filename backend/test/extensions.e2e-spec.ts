import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface MarketplaceAppResponse {
  id: string;
}

interface MarketplaceAppVersionResponse {
  id: string;
}

interface InstallAppResult {
  install: { id: string } | null;
}

interface InstalledExtensionsResponse {
  pages: { path: string; manifest: unknown }[];
  widgets: { placement: string }[];
  navEntries: { label: string; targetPath: string }[];
}

interface ExtensionAiToolResponse {
  name: string;
  signingSecret: string;
  endpointUrl: string;
}

async function promoteToPlatformAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.system.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
}

const FULL_MANIFEST = {
  pages: [
    {
      path: '/dashboard',
      title: 'Dashboard',
      root: {
        type: 'section',
        children: [{ type: 'stat-card', props: { label: 'Revenue' } }],
      },
    },
  ],
  widgets: [
    {
      placement: 'DASHBOARD',
      root: { type: 'table', dataSource: { method: 'GET', path: '/api/v1/widget-data' } },
    },
  ],
  navEntries: [{ label: 'Acme App', targetPath: '/dashboard' }],
  aiTools: [
    {
      name: 'lookup_order',
      description: 'Looks up an order by id',
      parametersSchema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
      },
      responseSchema: {
        type: 'object',
        properties: { status: { type: 'string' } },
        required: ['status'],
      },
      endpointUrl: 'https://acme.example/tools/lookup-order',
    },
  ],
};

describe('Extension Framework (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('rejects a manifest referencing a component type outside the fixed palette', async () => {
    const developer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `extensions-invalid-dev-${Date.now()}@example.com`,
    });
    const devAuth = { Authorization: `Bearer ${developer.accessToken}` };

    const createAppResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${developer.organization.id}/marketplace/apps`)
      .set(devAuth)
      .send({ name: 'Bad App', category: 'OTHER' })
      .expect(201);
    const createdApp = (createAppResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data;

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/versions`,
      )
      .set(devAuth)
      .send({
        version: '1.0.0',
        manifest: { pages: [{ path: '/x', title: 'X', root: { type: 'iframe' } }] },
      })
      .expect(400);
  });

  it('materializes a full manifest on approval and serves it only to organizations with an active install', async () => {
    const developer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `extensions-dev-${Date.now()}@example.com`,
    });
    const platformAdmin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `extensions-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, platformAdmin.user.id);
    const installer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `extensions-installer-${Date.now()}@example.com`,
    });
    const bystander = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `extensions-bystander-${Date.now()}@example.com`,
    });

    const devAuth = { Authorization: `Bearer ${developer.accessToken}` };
    const adminAuth = { Authorization: `Bearer ${platformAdmin.accessToken}` };
    const installerAuth = { Authorization: `Bearer ${installer.accessToken}` };
    const bystanderAuth = { Authorization: `Bearer ${bystander.accessToken}` };

    const createAppResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${developer.organization.id}/marketplace/apps`)
      .set(devAuth)
      .send({ name: 'Acme Extension App', category: 'PRODUCTIVITY' })
      .expect(201);
    const createdApp = (createAppResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data;

    const submitVersionResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/versions`,
      )
      .set(devAuth)
      .send({ version: '1.0.0', manifest: FULL_MANIFEST })
      .expect(201);
    const version = (
      submitVersionResponse.body as ApiSuccessResponse<MarketplaceAppVersionResponse>
    ).data;

    await request(app.getHttpServer())
      .post(`/api/v1/platform/marketplace/versions/${version.id}/approve`)
      .set(adminAuth)
      .expect(201);

    // Developer can see the materialized AI tool and its signing secret.
    const devToolsResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/extensions/ai-tools`,
      )
      .set(devAuth)
      .expect(200);
    const devTools = (devToolsResponse.body as ApiSuccessResponse<ExtensionAiToolResponse[]>).data;
    expect(devTools).toHaveLength(1);
    expect(devTools[0].name).toBe('lookup_order');
    expect(devTools[0].signingSecret.length).toBeGreaterThan(0);

    // Before installing, the installer org sees nothing.
    const beforeInstallResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${installer.organization.id}/extensions/installed`)
      .set(installerAuth)
      .expect(200);
    expect(
      (beforeInstallResponse.body as ApiSuccessResponse<InstalledExtensionsResponse>).data.pages,
    ).toHaveLength(0);

    const installResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/install`,
      )
      .set(installerAuth)
      .send({})
      .expect(201);
    const installId = (installResponse.body as ApiSuccessResponse<InstallAppResult>).data.install
      ?.id;

    const installedResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${installer.organization.id}/extensions/installed`)
      .set(installerAuth)
      .expect(200);
    const installed = (installedResponse.body as ApiSuccessResponse<InstalledExtensionsResponse>)
      .data;
    expect(installed.pages).toHaveLength(1);
    expect(installed.pages[0].path).toBe('/dashboard');
    expect(installed.widgets).toHaveLength(1);
    expect(installed.widgets[0].placement).toBe('DASHBOARD');
    expect(installed.navEntries).toHaveLength(1);
    expect(installed.navEntries[0].targetPath).toBe('/dashboard');

    // A bystander organization that never installed the app sees nothing.
    const bystanderResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${bystander.organization.id}/extensions/installed`)
      .set(bystanderAuth)
      .expect(200);
    expect(
      (bystanderResponse.body as ApiSuccessResponse<InstalledExtensionsResponse>).data.pages,
    ).toHaveLength(0);

    // Uninstalling removes it from the installer's own view.
    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${installer.organization.id}/marketplace/installs/${installId}`,
      )
      .set(installerAuth)
      .expect(200);

    const afterUninstallResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${installer.organization.id}/extensions/installed`)
      .set(installerAuth)
      .expect(200);
    expect(
      (afterUninstallResponse.body as ApiSuccessResponse<InstalledExtensionsResponse>).data.pages,
    ).toHaveLength(0);
  });
});
