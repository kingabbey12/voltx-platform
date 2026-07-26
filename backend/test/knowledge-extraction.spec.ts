import ExcelJS from 'exceljs';
import { DocxTextExtractor } from '../src/modules/knowledge/extraction/docx-text-extractor';
import { PdfTextExtractor } from '../src/modules/knowledge/extraction/pdf-text-extractor';
import { PlainTextExtractor } from '../src/modules/knowledge/extraction/plain-text-extractor';
import { PptxTextExtractor } from '../src/modules/knowledge/extraction/pptx-text-extractor';
import { TextExtractorRegistry } from '../src/modules/knowledge/extraction/text-extractor.registry';
import { XlsxTextExtractor } from '../src/modules/knowledge/extraction/xlsx-text-extractor';

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: 'Extracted PDF text.' }),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'Extracted DOCX text.' }),
}));

describe('PdfTextExtractor', () => {
  it('extracts text from a buffer and always destroys the parser', async () => {
    const extractor = new PdfTextExtractor();
    const text = await extractor.extract({ contentType: 'pdf', buffer: Buffer.from('fake-pdf') });
    expect(text).toBe('Extracted PDF text.');
  });

  it('rejects when no buffer is provided', async () => {
    const extractor = new PdfTextExtractor();
    await expect(extractor.extract({ contentType: 'pdf' })).rejects.toThrow(
      'PDF extraction requires a file buffer',
    );
  });
});

describe('DocxTextExtractor', () => {
  it('extracts raw text from a buffer', async () => {
    const extractor = new DocxTextExtractor();
    const text = await extractor.extract({ contentType: 'docx', buffer: Buffer.from('fake-docx') });
    expect(text).toBe('Extracted DOCX text.');
  });

  it('rejects when no buffer is provided', async () => {
    const extractor = new DocxTextExtractor();
    await expect(extractor.extract({ contentType: 'docx' })).rejects.toThrow(
      'DOCX extraction requires a file buffer',
    );
  });
});

describe('XlsxTextExtractor', () => {
  async function buildWorkbook(sheets: { name: string; rows: unknown[][] }[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    for (const { name, rows } of sheets) {
      const worksheet = workbook.addWorksheet(name);
      for (const row of rows) {
        worksheet.addRow(row);
      }
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('extracts every sheet as CSV from a real workbook buffer', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'Deals',
        rows: [
          ['Name', 'Stage'],
          ['Acme Corp', 'Negotiation'],
        ],
      },
      { name: 'Notes', rows: [['Note'], ['Follow up next week']] },
    ]);

    const extractor = new XlsxTextExtractor();
    const text = await extractor.extract({ contentType: 'xlsx', buffer });

    expect(text).toContain('Sheet: Deals');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Negotiation');
    expect(text).toContain('Sheet: Notes');
    expect(text).toContain('Follow up next week');
  });

  it('quotes fields containing commas or quotes so rows stay parseable', async () => {
    const buffer = await buildWorkbook([
      { name: 'Deals', rows: [['Acme, Inc.', 'He said "yes"']] },
    ]);

    const extractor = new XlsxTextExtractor();
    const text = await extractor.extract({ contentType: 'xlsx', buffer });

    expect(text).toContain('"Acme, Inc."');
    expect(text).toContain('"He said ""yes"""');
  });

  it('reads CSV input without routing it through a spreadsheet parser', async () => {
    const extractor = new XlsxTextExtractor();
    const text = await extractor.extract({
      contentType: 'csv',
      buffer: Buffer.from('Name,Stage\nAcme Corp,Negotiation\n', 'utf8'),
    });

    expect(text).toBe('Sheet: Sheet1\nName,Stage\nAcme Corp,Negotiation\n');
  });

  it('rejects a buffer that is not a readable workbook rather than throwing raw', async () => {
    const extractor = new XlsxTextExtractor();
    await expect(
      extractor.extract({ contentType: 'xlsx', buffer: Buffer.from('not a workbook') }),
    ).rejects.toThrow('File is not a readable XLSX workbook');
  });

  it('rejects when no buffer is provided', async () => {
    const extractor = new XlsxTextExtractor();
    await expect(extractor.extract({ contentType: 'xlsx' })).rejects.toThrow(
      'XLSX extraction requires a file buffer',
    );
  });
});

describe('PlainTextExtractor', () => {
  it('returns provided text unchanged', async () => {
    const extractor = new PlainTextExtractor();
    const text = await extractor.extract({ contentType: 'text', text: 'hello world' });
    expect(text).toBe('hello world');
  });

  it('decodes a buffer as utf-8 when no text is provided', async () => {
    const extractor = new PlainTextExtractor();
    const text = await extractor.extract({
      contentType: 'markdown',
      buffer: Buffer.from('# Heading', 'utf-8'),
    });
    expect(text).toBe('# Heading');
  });

  it('rejects when neither text nor a buffer is provided', async () => {
    const extractor = new PlainTextExtractor();
    await expect(extractor.extract({ contentType: 'text' })).rejects.toThrow(
      'Plain text extraction requires text or a buffer',
    );
  });
});

describe('TextExtractorRegistry', () => {
  function buildRegistry(): TextExtractorRegistry {
    return new TextExtractorRegistry(
      new PdfTextExtractor(),
      new DocxTextExtractor(),
      new XlsxTextExtractor(),
      new PptxTextExtractor(),
      new PlainTextExtractor(),
    );
  }

  it('dispatches to the extractor supporting the given content type', async () => {
    const registry = buildRegistry();
    const text = await registry.extract({ contentType: 'structured', text: 'CRM note body' });
    expect(text).toBe('CRM note body');
  });

  it('throws a clear error for an unsupported content type', async () => {
    const registry = buildRegistry();
    await expect(registry.extract({ contentType: 'video/mp4', text: 'n/a' })).rejects.toThrow(
      /Unsupported knowledge content type/,
    );
  });

  it('lists every supported content type across all extractors', () => {
    const registry = buildRegistry();
    const types = registry.listSupportedContentTypes();
    expect(types).toEqual(
      expect.arrayContaining(['pdf', 'docx', 'xlsx', 'csv', 'markdown', 'text', 'structured']),
    );
  });
});
