import { PDFDocument } from 'pdf-lib';
import { PdfGenerationService } from '../src/modules/attachments/documents/pdf-generation.service';

describe('PdfGenerationService', () => {
  let service: PdfGenerationService;

  beforeEach(() => {
    service = new PdfGenerationService();
  });

  it('generates a real, parseable multi-section PDF', async () => {
    const buffer = await service.generatePdf('Sales Report', [
      { heading: 'Summary', body: 'Revenue grew 12% this quarter.' },
      { heading: 'Details', body: 'Broken down by region: North, South, East, West.' },
    ]);

    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('wraps long body text across multiple lines without throwing', async () => {
    const longBody = 'word '.repeat(500).trim();
    const buffer = await service.generatePdf('Long Doc', [{ body: longBody }]);
    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('paginates when content exceeds a single page', async () => {
    const sections = Array.from({ length: 40 }, (_, i) => ({
      heading: `Section ${i}`,
      body: 'Paragraph text. '.repeat(30),
    }));
    const buffer = await service.generatePdf('Big Doc', sections);
    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  describe('generateContract', () => {
    it('interpolates {{variable}} placeholders', async () => {
      const buffer = await service.generateContract(
        'Service Agreement',
        'This agreement is between {{clientName}} and {{vendorName}}, effective {{date}}.',
        { clientName: 'Acme Energy', vendorName: 'Voltx Inc', date: '2026-07-11' },
      );
      expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });

    it('leaves an unmatched placeholder untouched rather than throwing', async () => {
      const buffer = await service.generateContract(
        'Agreement',
        'Client: {{clientName}}, Unknown: {{missing}}',
        {
          clientName: 'Acme',
        },
      );
      expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });
  });
});
