import { toOpenApi31 } from '../src/config/openapi-3.1.util';

/**
 * @nestjs/swagger emits OpenAPI-3.0-shaped `nullable: true` regardless of
 * the document's declared `openapi` version. These tests prove
 * toOpenApi31() rewrites every shape that keyword can appear in, and that
 * the resulting document contains no leftover `nullable` key at all —
 * genuine 3.1 compliance, not just a relabeled 3.0 document.
 */
describe('toOpenApi31', () => {
  it('rewrites a nullable primitive type into a type array', () => {
    const result = toOpenApi31({ type: 'string', nullable: true });
    expect(result).toEqual({ type: ['string', 'null'] });
  });

  it('appends null to an existing type array without duplicating it', () => {
    const result = toOpenApi31({ type: ['string', 'number'], nullable: true });
    expect(result).toEqual({ type: ['string', 'number', 'null'] });

    const alreadyNullable = toOpenApi31({ type: ['string', 'null'], nullable: true });
    expect(alreadyNullable).toEqual({ type: ['string', 'null'] });
  });

  it('wraps a nullable $ref in an anyOf with a null branch', () => {
    const result = toOpenApi31({ $ref: '#/components/schemas/Foo', nullable: true });
    expect(result).toEqual({
      anyOf: [{ $ref: '#/components/schemas/Foo' }, { type: 'null' }],
    });
  });

  it('wraps a nullable allOf composition in an anyOf with a null branch', () => {
    const result = toOpenApi31({
      allOf: [{ $ref: '#/components/schemas/Foo' }],
      nullable: true,
    });
    expect(result).toEqual({
      anyOf: [{ allOf: [{ $ref: '#/components/schemas/Foo' }] }, { type: 'null' }],
    });
  });

  it('leaves a non-nullable schema untouched', () => {
    const result = toOpenApi31({ type: 'string', example: 'hi' });
    expect(result).toEqual({ type: 'string', example: 'hi' });
  });

  it('recurses through nested objects and arrays (a realistic document fragment)', () => {
    const document = {
      components: {
        schemas: {
          Widget: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              parentId: { type: 'string', nullable: true },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      paths: {
        '/widgets/{id}': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Widget', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = toOpenApi31(document);

    expect(result.components.schemas.Widget.properties.parentId).toEqual({
      type: ['string', 'null'],
    });
    expect(
      result.paths['/widgets/{id}'].get.responses['200'].content['application/json'].schema,
    ).toEqual({ anyOf: [{ $ref: '#/components/schemas/Widget' }, { type: 'null' }] });

    // No `nullable` key survives anywhere in the transformed document.
    expect(JSON.stringify(result)).not.toContain('"nullable"');
  });
});
