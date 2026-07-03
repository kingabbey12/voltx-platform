import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { REQUEST_ID_HEADER } from '../common/constants/request-id.constants';

export const SWAGGER_PATH = 'api';

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Voltx Platform API')
    .setDescription('REST API for the Voltx platform')
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
    .addGlobalParameters({
      name: REQUEST_ID_HEADER,
      in: 'header',
      required: false,
      description: 'Unique request identifier for tracing. Generated if omitted.',
      schema: { type: 'string', format: 'uuid' },
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.openapi = '3.1.0';

  return document;
}

export function setupSwagger(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
  });
}
