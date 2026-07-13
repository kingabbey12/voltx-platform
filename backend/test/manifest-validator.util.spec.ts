import { validateExtensionManifest } from '../src/modules/extensions/utils/manifest-validator.util';

describe('validateExtensionManifest', () => {
  it('accepts an empty manifest', () => {
    expect(validateExtensionManifest({})).toEqual([]);
  });

  it('rejects a non-object manifest', () => {
    expect(validateExtensionManifest('not an object')).toEqual(['manifest must be an object']);
  });

  it('accepts a fully-populated, internally-consistent manifest', () => {
    const errors = validateExtensionManifest({
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
      navEntries: [{ label: 'My App', targetPath: '/dashboard' }],
      aiTools: [
        {
          name: 'lookup_order',
          description: 'Looks up an order by id',
          parametersSchema: { type: 'object', properties: { orderId: { type: 'string' } } },
          responseSchema: { type: 'object', properties: { status: { type: 'string' } } },
          endpointUrl: 'https://acme.example/tools/lookup-order',
        },
      ],
    });
    expect(errors).toEqual([]);
  });

  it('rejects an unknown component type in the palette', () => {
    const errors = validateExtensionManifest({
      pages: [{ path: '/x', title: 'X', root: { type: 'iframe' } }],
    });
    expect(errors.some((error) => error.includes('pages[0].root.type'))).toBe(true);
  });

  it('rejects a page path that does not start with "/"', () => {
    const errors = validateExtensionManifest({
      pages: [{ path: 'dashboard', title: 'Dashboard', root: { type: 'section' } }],
    });
    expect(errors.some((error) => error.includes('pages[0].path'))).toBe(true);
  });

  it('rejects duplicate page paths', () => {
    const errors = validateExtensionManifest({
      pages: [
        { path: '/a', title: 'A', root: { type: 'section' } },
        { path: '/a', title: 'A again', root: { type: 'section' } },
      ],
    });
    expect(errors.some((error) => error.includes('duplicate page path'))).toBe(true);
  });

  it('rejects a nav entry whose targetPath does not reference a declared page', () => {
    const errors = validateExtensionManifest({
      pages: [{ path: '/a', title: 'A', root: { type: 'section' } }],
      navEntries: [{ label: 'Nowhere', targetPath: '/b' }],
    });
    expect(errors.some((error) => error.includes('navEntries[0].targetPath'))).toBe(true);
  });

  it('rejects a widget with an unknown placement', () => {
    const errors = validateExtensionManifest({
      widgets: [{ placement: 'EVERYWHERE', root: { type: 'text' } }],
    });
    expect(errors.some((error) => error.includes('widgets[0].placement'))).toBe(true);
  });

  it('rejects a data source path that is not a relative path', () => {
    const errors = validateExtensionManifest({
      widgets: [
        {
          placement: 'DASHBOARD',
          root: {
            type: 'table',
            dataSource: { method: 'GET', path: 'https://evil.example/steal' },
          },
        },
      ],
    });
    expect(errors.some((error) => error.includes('dataSource.path'))).toBe(true);
  });

  it('rejects duplicate AI tool names', () => {
    const tool = {
      name: 'lookup_order',
      description: 'x',
      parametersSchema: { type: 'object' },
      responseSchema: { type: 'object' },
      endpointUrl: 'https://acme.example/tool',
    };
    const errors = validateExtensionManifest({ aiTools: [tool, tool] });
    expect(errors.some((error) => error.includes('duplicate tool name'))).toBe(true);
  });

  it('rejects a non-https AI tool endpoint URL', () => {
    const errors = validateExtensionManifest({
      aiTools: [
        {
          name: 'lookup_order',
          description: 'x',
          parametersSchema: { type: 'object' },
          responseSchema: { type: 'object' },
          endpointUrl: 'http://acme.example/tool',
        },
      ],
    });
    expect(errors.some((error) => error.includes('aiTools[0].endpointUrl'))).toBe(true);
  });

  it('rejects a non-snake_case AI tool name', () => {
    const errors = validateExtensionManifest({
      aiTools: [
        {
          name: 'LookupOrder',
          description: 'x',
          parametersSchema: { type: 'object' },
          responseSchema: { type: 'object' },
          endpointUrl: 'https://acme.example/tool',
        },
      ],
    });
    expect(errors.some((error) => error.includes('aiTools[0].name'))).toBe(true);
  });
});
