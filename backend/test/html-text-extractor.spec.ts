import { BadRequestException } from '@nestjs/common';
import { HtmlTextExtractor } from '../src/modules/knowledge/extraction/html-text-extractor';

describe('HtmlTextExtractor', () => {
  const extractor = new HtmlTextExtractor();

  it('extracts readable text from html content', async () => {
    const result = await extractor.extract({
      contentType: 'html',
      text: '<html><body><h1>Acme &amp; Co</h1><p>Pipeline&nbsp;deal</p></body></html>',
    });

    expect(result).toContain('Acme & Co');
    expect(result).toContain('Pipeline deal');
  });

  it('drops script/style noise while extracting text', async () => {
    const result = await extractor.extract({
      contentType: 'html',
      text: '<style>.x{color:red}</style><script>alert(1)</script><p>Visible text</p>',
    });

    expect(result).toBe('Visible text');
  });

  it('throws when no text or buffer is provided', async () => {
    await expect(extractor.extract({ contentType: 'html' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
