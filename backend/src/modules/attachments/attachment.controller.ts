import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { AttachmentService, MULTIPART_PART_SIZE_BYTES } from './attachment.service';
import {
  AttachmentResponseDto,
  CompleteMultipartUploadDto,
  CreateAttachmentReferenceDto,
  InitiateMultipartUploadDto,
  InitiateMultipartUploadResponseDto,
  ListAttachmentsQueryDto,
  PaginatedAttachmentsDto,
  SignedDownloadUrlResponseDto,
} from './dto/attachment.dto';
import { AttachmentUrlSignerService } from './storage/attachment-url-signer.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage-provider.interface';

@ApiTags('Attachments')
@ApiBearerAuth('JWT')
@Controller('attachments')
export class AttachmentController {
  constructor(
    private readonly attachmentService: AttachmentService,
    private readonly urlSigner: AttachmentUrlSignerService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.read')
  @ApiOperation({
    summary: 'List attachments, optionally scoped to a conversation/CRM/AI reference',
  })
  @ApiOkResponse({ type: PaginatedAttachmentsDto })
  async list(@Query() query: ListAttachmentsQueryDto): Promise<PaginatedAttachmentsDto> {
    const result = await this.attachmentService.listByReference({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      referenceType: query.referenceType,
      referenceId: query.referenceId,
    });
    return {
      items: result.items.map((item) => AttachmentResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Post('upload')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a single file (small/medium — use multipart for large files)' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  async uploadSingle(@UploadedFile() file?: Express.Multer.File): Promise<AttachmentResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const attachment = await this.attachmentService.uploadSingle({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    return AttachmentResponseDto.fromEntity(attachment);
  }

  @Post('multipart/initiate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @ApiOperation({ summary: 'Start a multipart upload for a large file' })
  @ApiOkResponse({ type: InitiateMultipartUploadResponseDto })
  async initiateMultipart(
    @Body() dto: InitiateMultipartUploadDto,
  ): Promise<InitiateMultipartUploadResponseDto> {
    const result = await this.attachmentService.initiateMultipartUpload(
      dto.fileName,
      dto.mimeType,
      dto.sizeBytes,
    );
    return { ...result, partSizeBytes: MULTIPART_PART_SIZE_BYTES };
  }

  @Post('multipart/:attachmentId/parts/:partNumber')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTIPART_PART_SIZE_BYTES } }))
  @ApiOperation({ summary: 'Upload one part of a multipart upload' })
  async uploadPart(
    @Param('attachmentId') attachmentId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
    @Query('uploadId') uploadId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ partNumber: number; etag: string }> {
    if (!file) {
      throw new BadRequestException('No part data provided');
    }
    if (!uploadId) {
      throw new BadRequestException('uploadId query parameter is required');
    }
    return this.attachmentService.uploadPart(attachmentId, uploadId, partNumber, file.buffer);
  }

  @Post('multipart/:attachmentId/complete')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @ApiOperation({ summary: 'Finalize a multipart upload once every part has been uploaded' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  async completeMultipart(
    @Param('attachmentId') attachmentId: string,
    @Query('uploadId') uploadId: string,
    @Body() dto: CompleteMultipartUploadDto,
  ): Promise<AttachmentResponseDto> {
    if (!uploadId) {
      throw new BadRequestException('uploadId query parameter is required');
    }
    const attachment = await this.attachmentService.completeMultipartUpload(
      attachmentId,
      uploadId,
      dto.parts,
    );
    return AttachmentResponseDto.fromEntity(attachment);
  }

  @Post('multipart/:attachmentId/abort')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @ApiOperation({ summary: 'Cancel an in-progress multipart upload' })
  async abortMultipart(
    @Param('attachmentId') attachmentId: string,
    @Query('uploadId') uploadId: string,
  ): Promise<{ aborted: true }> {
    if (!uploadId) {
      throw new BadRequestException('uploadId query parameter is required');
    }
    await this.attachmentService.abortMultipartUpload(attachmentId, uploadId);
    return { aborted: true };
  }

  @Get('raw')
  @ApiOperation({
    summary:
      'Unauthenticated but signature-verified file access, used by local-storage signed download URLs (mirrors an S3 presigned URL) — never call this directly from a client.',
  })
  async raw(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const expiresAtEpochSeconds = Number(expires);
    if (!key || !sig || !Number.isFinite(expiresAtEpochSeconds)) {
      throw new BadRequestException('Missing or malformed signed URL parameters');
    }
    if (!this.urlSigner.verify(key, expiresAtEpochSeconds, sig)) {
      throw new BadRequestException('Signature invalid or expired');
    }

    const stream = await this.storageProvider.getReadStream(key);
    stream.pipe(res);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.read')
  @ApiOperation({ summary: 'Get attachment metadata' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  async getById(@Param('id') id: string): Promise<AttachmentResponseDto> {
    const attachment = await this.attachmentService.getById(id);
    return AttachmentResponseDto.fromEntity(attachment);
  }

  @Get(':id/download-url')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.read')
  @ApiOperation({
    summary: 'Get a short-lived signed URL for direct download (no auth header needed)',
  })
  @ApiOkResponse({ type: SignedDownloadUrlResponseDto })
  getDownloadUrl(@Param('id') id: string): Promise<SignedDownloadUrlResponseDto> {
    return this.attachmentService.getSignedDownloadUrl(id);
  }

  @Get(':id/download')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.read')
  @ApiOperation({ summary: 'Stream the file directly through the API (authenticated)' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { stream, attachment } = await this.attachmentService.getReadStreamForDownload(id);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    stream.pipe(res);
  }

  @Get(':id/thumbnail')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.read')
  @ApiOperation({ summary: 'Stream the generated thumbnail, if one exists' })
  async downloadThumbnail(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const attachment = await this.attachmentService.getById(id);
    if (!attachment.thumbnailKey) {
      throw new NotFoundException('This attachment has no thumbnail');
    }
    const stream = await this.storageProvider.getReadStream(attachment.thumbnailKey);
    res.setHeader('Content-Type', 'image/webp');
    stream.pipe(res);
  }

  @Post(':id/references')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.create')
  @ApiOperation({ summary: 'Link an attachment to a conversation, CRM record, or AI session' })
  async addReference(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentReferenceDto,
  ): Promise<{ linked: true }> {
    await this.attachmentService.addReference(id, dto.referenceType, dto.referenceId);
    return { linked: true };
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('attachment.delete')
  @ApiOperation({ summary: 'Soft-delete an attachment' })
  async delete(@Param('id') id: string): Promise<{ deleted: true }> {
    await this.attachmentService.delete(id);
    return { deleted: true };
  }
}
