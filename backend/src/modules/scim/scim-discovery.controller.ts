import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScimTokenGuard } from './guards/scim-token.guard';

/** Static SCIM discovery documents (RFC 7644 §4) — no organization-specific data, so a fixed shape is correct. */
@ApiTags('SCIM')
@UseGuards(ScimTokenGuard)
@Controller('scim/v2')
export class ScimDiscoveryController {
  @Get('ServiceProviderConfig')
  @ApiOperation({ summary: 'SCIM: service provider capabilities' })
  getServiceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Static bearer token issued per organization via /identity/scim-tokens',
        },
      ],
    };
  }

  @Get('ResourceTypes')
  @ApiOperation({ summary: 'SCIM: supported resource types' })
  getResourceTypes() {
    return [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/scim/v2/Users',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/scim/v2/Groups',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
      },
    ];
  }

  @Get('Schemas')
  @ApiOperation({ summary: 'SCIM: supported schemas' })
  getSchemas() {
    return [
      { id: 'urn:ietf:params:scim:schemas:core:2.0:User', name: 'User' },
      { id: 'urn:ietf:params:scim:schemas:core:2.0:Group', name: 'Group' },
    ];
  }
}
