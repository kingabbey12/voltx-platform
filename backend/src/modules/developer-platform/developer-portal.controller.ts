import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { SWAGGER_PATH } from '../../config/swagger.config';
import { WEBHOOK_EVENT_CATALOG } from '../webhooks/webhook-event.catalog';
import { DeveloperPortalResponseDto } from './dto/developer-portal.dto';

class DeveloperPortalSuccessResponseDto extends ApiSuccessResponseDto<DeveloperPortalResponseDto> {}

@ApiTags('Developer Platform — Portal')
@Controller('developer/portal')
export class DeveloperPortalController {
  @Get()
  @ApiOperation({
    summary: 'Discover developer platform authentication methods, SDKs, and webhook events',
  })
  @ApiOkResponse({
    description: 'Developer platform discovery metadata',
    type: DeveloperPortalSuccessResponseDto,
  })
  discover(): DeveloperPortalResponseDto {
    return {
      apiVersion: 'v1',
      openApiDocumentPath: `/${SWAGGER_PATH}-json`,
      oauth: {
        authorizePath: '/api/v1/oauth/authorize',
        tokenPath: '/api/v1/oauth/token',
        revokePath: '/api/v1/oauth/revoke',
        introspectPath: '/api/v1/oauth/introspect',
      },
      authMethods: [
        {
          key: 'api-key',
          header: 'X-Api-Key',
          description: 'Org-scoped machine credential for server-to-server integrations.',
        },
        {
          key: 'personal-access-token',
          header: 'X-Personal-Access-Token + X-Organization-Id',
          description:
            "User-managed token for scripts/CLI usage; permissions are constrained to the user's own scopes.",
        },
        {
          key: 'service-account-token',
          header: 'X-Service-Account-Token',
          description: 'Dedicated machine identity tied to an organization membership role.',
        },
        {
          key: 'oauth2-bearer',
          header: 'Authorization: Bearer <access_token>',
          description: 'Third-party authorization via OAuth 2.0 authorization_code + PKCE.',
        },
      ],
      webhookEventCatalog: WEBHOOK_EVENT_CATALOG.map((event) => ({
        key: event.key,
        description: event.description,
      })),
      sdks: [
        {
          language: 'typescript',
          package: '@voltx/sdk',
          generationCommand: 'npm run generate:types (in packages/sdk-typescript)',
        },
        {
          language: 'python',
          package: 'voltx-sdk',
          generationCommand: 'python scripts/generate_models.py (in packages/sdk-python)',
        },
        {
          language: 'flutter',
          package: 'voltx_sdk',
          generationCommand: 'dart run tool/generate_models.dart (in packages/sdk-flutter)',
        },
      ],
    };
  }
}
