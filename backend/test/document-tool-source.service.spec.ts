import { DocumentToolSourceService } from '../src/modules/attachments/documents/document-tool-source.service';
import { AITool, ToolExecutionContext } from '../src/modules/ai/tools/tool.interface';
import { Readable } from 'node:stream';

function toolContext(): ToolExecutionContext {
  return { conversationId: 'conversation-1', signal: new AbortController().signal };
}

describe('DocumentToolSourceService', () => {
  let toolRegistry: { registerDynamicSource: jest.Mock };
  let attachmentService: {
    uploadSingle: jest.Mock;
    getById: jest.Mock;
    getReadStreamForDownload: jest.Mock;
    updateExtractedText: jest.Mock;
  };
  let pdfGenerationService: { generatePdf: jest.Mock; generateContract: jest.Mock };
  let ocrService: { extractText: jest.Mock };
  let service: DocumentToolSourceService;

  function findTool(name: string): AITool {
    const tool = service.listTools().find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  beforeEach(() => {
    toolRegistry = { registerDynamicSource: jest.fn() };
    attachmentService = {
      uploadSingle: jest.fn(),
      getById: jest.fn(),
      getReadStreamForDownload: jest.fn(),
      updateExtractedText: jest.fn(),
    };
    pdfGenerationService = { generatePdf: jest.fn(), generateContract: jest.fn() };
    ocrService = { extractText: jest.fn() };

    service = new DocumentToolSourceService(
      toolRegistry as never,
      attachmentService as never,
      pdfGenerationService,
      ocrService as never,
    );
  });

  it('registers itself as a dynamic tool source on module init', () => {
    service.onModuleInit();
    expect(toolRegistry.registerDynamicSource).toHaveBeenCalledWith(service);
  });

  it('exposes the four document action tools', () => {
    const names = service.listTools().map((tool) => tool.name);
    expect(names).toEqual(['generate_pdf', 'generate_contract', 'convert_file', 'ocr_image']);
  });

  describe('generate_pdf', () => {
    it('generates a PDF and stores it as a real attachment', async () => {
      pdfGenerationService.generatePdf.mockResolvedValue(Buffer.from('%PDF-fake'));
      attachmentService.uploadSingle.mockResolvedValue({ id: 'att-1', fileName: 'report.pdf' });

      const result = await findTool('generate_pdf').execute(
        { fileName: 'report', title: 'Report', sections: [{ body: 'Hello' }] },
        toolContext(),
      );

      expect(pdfGenerationService.generatePdf).toHaveBeenCalledWith('Report', [{ body: 'Hello' }]);
      expect(attachmentService.uploadSingle).toHaveBeenCalledWith({
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-fake'),
      });
      expect(result).toEqual({ attachmentId: 'att-1', fileName: 'report.pdf' });
    });

    it('rejects an empty sections array', async () => {
      await expect(
        findTool('generate_pdf').execute(
          { fileName: 'x', title: 'T', sections: [] },
          toolContext(),
        ),
      ).rejects.toThrow('sections must be a non-empty array');
    });
  });

  describe('generate_contract', () => {
    it('merges variables and stores the result as a real attachment', async () => {
      pdfGenerationService.generateContract.mockResolvedValue(Buffer.from('%PDF-contract'));
      attachmentService.uploadSingle.mockResolvedValue({ id: 'att-2', fileName: 'agreement.pdf' });

      const result = await findTool('generate_contract').execute(
        {
          fileName: 'agreement',
          contractTitle: 'Service Agreement',
          templateBody: 'Between {{client}} and us.',
          variables: { client: 'Acme' },
        },
        toolContext(),
      );

      expect(pdfGenerationService.generateContract).toHaveBeenCalledWith(
        'Service Agreement',
        'Between {{client}} and us.',
        { client: 'Acme' },
      );
      expect(result).toEqual({ attachmentId: 'att-2', fileName: 'agreement.pdf' });
    });
  });

  describe('convert_file', () => {
    it('converts a source attachment with extracted text into a new PDF attachment', async () => {
      attachmentService.getById.mockResolvedValue({
        id: 'src-1',
        fileName: 'notes.docx',
        status: 'READY',
        extractedText: 'Meeting notes content.',
      });
      pdfGenerationService.generatePdf.mockResolvedValue(Buffer.from('%PDF-converted'));
      attachmentService.uploadSingle.mockResolvedValue({ id: 'att-3', fileName: 'notes.pdf' });

      const result = await findTool('convert_file').execute(
        { attachmentId: 'src-1' },
        toolContext(),
      );

      expect(pdfGenerationService.generatePdf).toHaveBeenCalledWith('notes.docx', [
        { body: 'Meeting notes content.' },
      ]);
      expect(result).toEqual({ attachmentId: 'att-3', fileName: 'notes.pdf' });
    });

    it('rejects a quarantined source attachment', async () => {
      attachmentService.getById.mockResolvedValue({ id: 'src-1', status: 'QUARANTINED' });
      await expect(
        findTool('convert_file').execute({ attachmentId: 'src-1' }, toolContext()),
      ).rejects.toThrow('failed a virus scan');
    });

    it('rejects a source attachment with no extracted text', async () => {
      attachmentService.getById.mockResolvedValue({
        id: 'src-1',
        status: 'READY',
        extractedText: null,
      });
      await expect(
        findTool('convert_file').execute({ attachmentId: 'src-1' }, toolContext()),
      ).rejects.toThrow('use ocr_image first');
    });
  });

  describe('ocr_image', () => {
    it('OCRs an image attachment and persists the extracted text', async () => {
      attachmentService.getReadStreamForDownload.mockResolvedValue({
        stream: Readable.from([Buffer.from('fake-image-bytes')]),
        attachment: { id: 'img-1', mimeType: 'image/png' },
      });
      ocrService.extractText.mockResolvedValue('Invoice #1234');
      attachmentService.updateExtractedText.mockResolvedValue({ id: 'img-1' });

      const result = await findTool('ocr_image').execute({ attachmentId: 'img-1' }, toolContext());

      expect(ocrService.extractText).toHaveBeenCalledWith(Buffer.from('fake-image-bytes'));
      expect(attachmentService.updateExtractedText).toHaveBeenCalledWith('img-1', 'Invoice #1234');
      expect(result).toEqual({ attachmentId: 'img-1', extractedText: 'Invoice #1234' });
    });

    it('rejects a non-image attachment', async () => {
      attachmentService.getReadStreamForDownload.mockResolvedValue({
        stream: Readable.from([Buffer.from('x')]),
        attachment: { id: 'doc-1', mimeType: 'application/pdf' },
      });
      await expect(
        findTool('ocr_image').execute({ attachmentId: 'doc-1' }, toolContext()),
      ).rejects.toThrow('only supports image attachments');
    });
  });
});
