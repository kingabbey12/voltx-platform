import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolExecutionError, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { AttachmentService } from '../attachment.service';
import { streamToBuffer } from '../stream-to-buffer.util';
import { OcrService } from './ocr.service';
import { PdfGenerationService, PdfSection } from './pdf-generation.service';

const PDF_MIME_TYPE = 'application/pdf';

/**
 * Document actions (Generate PDF, Generate contract, Convert file, OCR)
 * for the AI agent runtime and, via the TOOL step type, workflows. Every
 * generated file is stored through the existing attachment upload
 * pipeline (AttachmentService.uploadSingle) — same storage, quarantine,
 * and virus-scan path as a human-uploaded file, not a side channel.
 */
@Injectable()
export class DocumentToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly attachmentService: AttachmentService,
    private readonly pdfGenerationService: PdfGenerationService,
    private readonly ocrService: OcrService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildGeneratePdfTool(),
      this.buildGenerateContractTool(),
      this.buildConvertFileTool(),
      this.buildOcrImageTool(),
    ];
  }

  private buildGeneratePdfTool(): AITool {
    const attachmentService = this.attachmentService;
    const pdfGenerationService = this.pdfGenerationService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        fileName: {
          type: 'string',
          description: 'File name for the generated PDF, e.g. "report.pdf".',
          required: true,
        },
        title: { type: 'string', description: 'Document title.', required: true },
        sections: {
          type: 'array',
          description: 'Array of { heading?: string, body: string } sections, in order.',
          required: true,
        },
      },
    };

    return {
      name: 'generate_pdf',
      description:
        'Generate a real PDF document from a title and a list of sections, and store it as a real attachment. Returns the new attachment id.',
      inputSchema: schema,
      async execute(input: { fileName: string; title: string; sections: PdfSection[] }) {
        if (!input.fileName?.trim() || !input.title?.trim()) {
          throw new Error('fileName and title are required');
        }
        if (!Array.isArray(input.sections) || input.sections.length === 0) {
          throw new Error('sections must be a non-empty array');
        }
        const buffer = await pdfGenerationService.generatePdf(input.title, input.sections);
        const attachment = await attachmentService.uploadSingle({
          fileName: input.fileName.endsWith('.pdf') ? input.fileName : `${input.fileName}.pdf`,
          mimeType: PDF_MIME_TYPE,
          buffer,
        });
        return { attachmentId: attachment.id, fileName: attachment.fileName };
      },
    };
  }

  private buildGenerateContractTool(): AITool {
    const attachmentService = this.attachmentService;
    const pdfGenerationService = this.pdfGenerationService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        fileName: {
          type: 'string',
          description: 'File name for the generated contract PDF.',
          required: true,
        },
        contractTitle: { type: 'string', description: 'Contract document title.', required: true },
        templateBody: {
          type: 'string',
          description: 'Contract template text with {{variable}} placeholders.',
          required: true,
        },
        variables: {
          type: 'object',
          description: 'Key/value map used to fill {{variable}} placeholders in templateBody.',
        },
      },
    };

    return {
      name: 'generate_contract',
      description:
        'Generate a real contract PDF by merging {{variable}} placeholders into a template and storing the result as a real attachment. Returns the new attachment id.',
      inputSchema: schema,
      async execute(input: {
        fileName: string;
        contractTitle: string;
        templateBody: string;
        variables?: Record<string, string>;
      }) {
        if (
          !input.fileName?.trim() ||
          !input.contractTitle?.trim() ||
          !input.templateBody?.trim()
        ) {
          throw new Error('fileName, contractTitle, and templateBody are required');
        }
        const buffer = await pdfGenerationService.generateContract(
          input.contractTitle,
          input.templateBody,
          input.variables ?? {},
        );
        const attachment = await attachmentService.uploadSingle({
          fileName: input.fileName.endsWith('.pdf') ? input.fileName : `${input.fileName}.pdf`,
          mimeType: PDF_MIME_TYPE,
          buffer,
        });
        return { attachmentId: attachment.id, fileName: attachment.fileName };
      },
    };
  }

  /**
   * Deliberately narrower than "convert file" might imply: source ->
   * PDF only, driven by the source's already-extracted text (the same
   * field TextExtractorRegistry populates at upload time for pdf/docx/
   * pptx/xlsx/txt) rather than a general N-to-M format converter.
   */
  private buildConvertFileTool(): AITool {
    const attachmentService = this.attachmentService;
    const pdfGenerationService = this.pdfGenerationService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        attachmentId: {
          type: 'string',
          description: 'Source attachment id to convert.',
          required: true,
        },
        fileName: { type: 'string', description: 'File name for the converted PDF.' },
      },
    };

    return {
      name: 'convert_file',
      description:
        "Convert a document (docx/pptx/xlsx/txt) to PDF, using its already-extracted text. Image formats aren't supported here — use ocr_image first. Returns the new attachment id.",
      inputSchema: schema,
      async execute(input: { attachmentId: string; fileName?: string }) {
        if (!input.attachmentId?.trim()) {
          throw new Error('attachmentId is required');
        }
        const source = await attachmentService.getById(input.attachmentId);
        if (source.status === 'QUARANTINED') {
          throw new ToolExecutionError(
            'This file failed a virus scan and cannot be converted.',
            'attachment_quarantined',
          );
        }
        if (!source.extractedText?.trim()) {
          throw new Error(
            'This attachment has no extracted text to convert — for images, use ocr_image first.',
          );
        }

        const buffer = await pdfGenerationService.generatePdf(source.fileName, [
          { body: source.extractedText },
        ]);
        const targetName =
          input.fileName?.trim() || `${source.fileName.replace(/\.[^.]+$/, '')}.pdf`;
        const attachment = await attachmentService.uploadSingle({
          fileName: targetName.endsWith('.pdf') ? targetName : `${targetName}.pdf`,
          mimeType: PDF_MIME_TYPE,
          buffer,
        });
        return { attachmentId: attachment.id, fileName: attachment.fileName };
      },
    };
  }

  private buildOcrImageTool(): AITool {
    const attachmentService = this.attachmentService;
    const ocrService = this.ocrService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        attachmentId: {
          type: 'string',
          description: 'Image attachment id to OCR.',
          required: true,
        },
      },
    };

    return {
      name: 'ocr_image',
      description:
        "Extract text from an image attachment via OCR and save it as the attachment's extracted text (so it also flows into knowledge search). Returns the extracted text.",
      inputSchema: schema,
      async execute(input: { attachmentId: string }) {
        if (!input.attachmentId?.trim()) {
          throw new Error('attachmentId is required');
        }
        const { stream, attachment } = await attachmentService.getReadStreamForDownload(
          input.attachmentId,
        );
        if (!attachment.mimeType.startsWith('image/')) {
          throw new Error(
            `ocr_image only supports image attachments, got "${attachment.mimeType}"`,
          );
        }

        const buffer = await streamToBuffer(stream);
        const text = await ocrService.extractText(buffer);
        await attachmentService.updateExtractedText(attachment.id, text);
        return { attachmentId: attachment.id, extractedText: text };
      },
    };
  }
}
