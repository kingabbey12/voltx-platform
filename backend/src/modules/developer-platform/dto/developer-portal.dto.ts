import { ApiProperty } from '@nestjs/swagger';

export class DeveloperPortalAuthMethodDto {
  @ApiProperty({ example: 'api-key' })
  key!: string;

  @ApiProperty({ example: 'X-Api-Key' })
  header!: string;

  @ApiProperty({
    example: 'Org-scoped machine credential for server-to-server integrations.',
  })
  description!: string;
}

export class DeveloperPortalSdkDto {
  @ApiProperty({ example: 'typescript' })
  language!: string;

  @ApiProperty({ example: '@voltx/sdk' })
  package!: string;

  @ApiProperty({
    example: 'npm run generate:types (in packages/sdk-typescript)',
  })
  generationCommand!: string;
}

export class DeveloperPortalWebhookEventDto {
  @ApiProperty({ example: 'workflow.run.completed' })
  key!: string;

  @ApiProperty({ example: 'A workflow run finished successfully' })
  description!: string;
}

export class DeveloperPortalResponseDto {
  @ApiProperty({ example: 'v1' })
  apiVersion!: string;

  @ApiProperty({ example: '/api-json' })
  openApiDocumentPath!: string;

  @ApiProperty({
    example: {
      authorizePath: '/api/v1/oauth/authorize',
      tokenPath: '/api/v1/oauth/token',
      revokePath: '/api/v1/oauth/revoke',
      introspectPath: '/api/v1/oauth/introspect',
    },
  })
  oauth!: {
    authorizePath: string;
    tokenPath: string;
    revokePath: string;
    introspectPath: string;
  };

  @ApiProperty({ type: [DeveloperPortalAuthMethodDto] })
  authMethods!: DeveloperPortalAuthMethodDto[];

  @ApiProperty({ type: [DeveloperPortalWebhookEventDto] })
  webhookEventCatalog!: DeveloperPortalWebhookEventDto[];

  @ApiProperty({ type: [DeveloperPortalSdkDto] })
  sdks!: DeveloperPortalSdkDto[];
}
