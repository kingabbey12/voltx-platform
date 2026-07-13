import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { REQUEST_ID_HEADER } from '../common/constants/request-id.constants';
import { toOpenApi31 } from './openapi-3.1.util';

export const SWAGGER_PATH = 'api';

const API_DESCRIPTION = `REST API for the Voltx platform.

## Versioning

Every route is served under a URI version segment (e.g. \`/api/v1/...\`). The
current stable version is **v1**. A version is never changed in place —
a breaking change ships as a new version (\`/api/v2/...\`) with the prior
version kept serving under its original path for at least 12 months
after the new version's release, announced via the Developer Portal
changelog. Non-breaking additions (new optional fields, new endpoints)
land within the existing version without bumping it.`;

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Voltx Platform API')
    .setDescription(API_DESCRIPTION)
    .setVersion('v1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Api-Key',
        in: 'header',
        description:
          'v2.2 Security Center API key — a JWT-alternative for machine-to-machine callers (see ApiKeyGuard)',
      },
      'ApiKey',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Personal-Access-Token',
        in: 'header',
        description:
          "v2.3 Developer Platform — a developer's own bearer token. Also requires " +
          'X-Organization-Id (see PersonalAccessTokenGuard) since a token is not bound to one org.',
      },
      'PersonalAccessToken',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Service-Account-Token',
        in: 'header',
        description: 'v2.3 Developer Platform — a machine-to-machine service account token.',
      },
      'ServiceAccountToken',
    )
    .addGlobalParameters({
      name: REQUEST_ID_HEADER,
      in: 'header',
      required: false,
      description: 'Unique request identifier for tracing. Generated if omitted.',
      schema: { type: 'string', format: 'uuid' },
    })
    .build();

  const document = toOpenApi31(SwaggerModule.createDocument(app, config));
  document.openapi = '3.1.0';

  return document;
}

export function setupSwagger(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
  });
}
