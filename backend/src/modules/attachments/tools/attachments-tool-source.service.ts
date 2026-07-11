import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolExecutionError, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { AttachmentService } from '../attachment.service';

/**
 * Gives agents context-awareness over uploaded documents/files — search by
 * filename or extracted content, then read a specific file's extracted
 * text — by wrapping the exact same AttachmentService the REST controller
 * uses, same convention as SalesToolSourceService/FinanceToolSourceService.
 * Read-only: attachments are uploaded through the existing upload
 * endpoints, never created by an agent.
 */
@Injectable()
export class AttachmentsToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly attachmentService: AttachmentService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [this.buildSearchAttachmentsTool(), this.buildGetAttachmentTextTool()];
  }

  private buildSearchAttachmentsTool(): AITool {
    const attachmentService = this.attachmentService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional text to match against filename or extracted document content.',
        },
      },
    };

    return {
      name: 'search_attachments',
      description:
        'Search uploaded documents/files by filename or extracted content. Returns id, fileName, mimeType, and sizeBytes for each match — use get_attachment_text to read the actual content.',
      inputSchema: schema,
      async execute(input: { query?: string }) {
        const result = await attachmentService.search({ query: input.query, page: 1, limit: 25 });
        return {
          total: result.total,
          attachments: result.items.map((item) => ({
            id: item.id,
            fileName: item.fileName,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
          })),
        };
      },
    };
  }

  private buildGetAttachmentTextTool(): AITool {
    const attachmentService = this.attachmentService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        attachmentId: { type: 'string', description: 'Attachment id.', required: true },
      },
    };

    return {
      name: 'get_attachment_text',
      description:
        "Read a document's extracted text content by attachment id (from search_attachments). Returns an empty/short string if the file has no extractable text (e.g. an image).",
      inputSchema: schema,
      async execute(input: { attachmentId: string }) {
        const attachment = await attachmentService.getById(input.attachmentId);
        if (attachment.status === 'QUARANTINED') {
          throw new ToolExecutionError(
            'This file failed a virus scan and its content cannot be read.',
            'attachment_quarantined',
          );
        }
        return {
          id: attachment.id,
          fileName: attachment.fileName,
          extractedText: attachment.extractedText ?? '',
        };
      },
    };
  }
}
