import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { writeEventStreamToResponse } from '../ai/streaming/write-event-stream-to-response';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  IngestKnowledgeDocumentDto,
  KnowledgeDocumentResponseDto,
  KnowledgeDocumentSuccessResponseDto,
  KnowledgeIngestionResultDto,
  KnowledgeIngestionResultSuccessResponseDto,
  KnowledgeIngestionResultsSuccessResponseDto,
  ListKnowledgeDocumentsQueryDto,
  PaginatedKnowledgeDocumentsResponseDto,
} from './dto/knowledge-document.dto';
import {
  KnowledgeGraphNodeDto,
  KnowledgeGraphNodesSuccessResponseDto,
  LinkKnowledgeEntitiesDto,
  TraverseKnowledgeGraphQueryDto,
} from './dto/knowledge-graph.dto';
import {
  KnowledgeContextPreviewSuccessResponseDto,
  KnowledgeSearchResultDto,
  KnowledgeSearchResultsSuccessResponseDto,
  SearchKnowledgeDto,
} from './dto/knowledge-search.dto';
import {
  CreateKnowledgeSourceDto,
  KnowledgeSourceResponseDto,
  KnowledgeSourceSuccessResponseDto,
  ListKnowledgeSourcesQueryDto,
  PaginatedKnowledgeSourcesResponseDto,
  UpdateKnowledgeSourceDto,
} from './dto/knowledge-source.dto';
import {
  KnowledgeHealthSuccessResponseDto,
  KnowledgeStatsDto,
  KnowledgeStatsSuccessResponseDto,
} from './dto/knowledge-stats.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Knowledge')
@ApiBearerAuth('JWT')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('sources')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.create')
  @ApiOperation({ summary: 'Register a new knowledge source' })
  @ApiCreatedResponse({ type: KnowledgeSourceSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async createSource(@Body() dto: CreateKnowledgeSourceDto): Promise<KnowledgeSourceResponseDto> {
    const source = await this.knowledgeService.createSource(dto);
    return KnowledgeSourceResponseDto.fromEntity(source);
  }

  @Get('sources')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.read')
  @ApiOperation({ summary: 'List knowledge sources' })
  @ApiOkResponse({ type: PaginatedKnowledgeSourcesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listSources(@Query() query: ListKnowledgeSourcesQueryDto) {
    const result = await this.knowledgeService.listSources({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      status: query.status,
    });
    return {
      ...result,
      items: result.items.map((source) => KnowledgeSourceResponseDto.fromEntity(source)),
    };
  }

  @Get('sources/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.read')
  @ApiOperation({ summary: 'Get a knowledge source' })
  @ApiOkResponse({ type: KnowledgeSourceSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getSource(@Param('id') id: string): Promise<KnowledgeSourceResponseDto> {
    const source = await this.knowledgeService.getSourceOrThrow(id);
    return KnowledgeSourceResponseDto.fromEntity(source);
  }

  @Patch('sources/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.update')
  @ApiOperation({ summary: 'Update a knowledge source' })
  @ApiOkResponse({ type: KnowledgeSourceSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async updateSource(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeSourceDto,
  ): Promise<KnowledgeSourceResponseDto> {
    const source = await this.knowledgeService.updateSource(id, dto);
    return KnowledgeSourceResponseDto.fromEntity(source);
  }

  @Delete('sources/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.delete')
  @ApiOperation({ summary: 'Soft delete a knowledge source and its documents' })
  @ApiOkResponse({ type: KnowledgeSourceSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async deleteSource(@Param('id') id: string): Promise<KnowledgeSourceResponseDto> {
    const source = await this.knowledgeService.deleteSource(id);
    return KnowledgeSourceResponseDto.fromEntity(source);
  }

  @Post('sources/:id/reindex')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Re-chunk and re-embed every document under a source' })
  @ApiCreatedResponse({ type: KnowledgeIngestionResultsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async reindexSource(@Param('id') id: string): Promise<KnowledgeIngestionResultDto[]> {
    return this.knowledgeService.reindexSource(id);
  }

  @Post('sources/:id/reindex/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Re-index a source and stream indexing/embedding progress over SSE' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async reindexSourceStream(@Param('id') id: string, @Res() response: Response): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.knowledgeService.reindexSourceStream(id, signal),
    );
  }

  @Post('sources/:id/documents')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.document.create')
  @ApiOperation({ summary: 'Ingest a document (or re-ingest by externalId) under a source' })
  @ApiCreatedResponse({ type: KnowledgeIngestionResultSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async ingestDocument(
    @Param('id') sourceId: string,
    @Body() dto: IngestKnowledgeDocumentDto,
  ): Promise<KnowledgeIngestionResultDto> {
    return this.knowledgeService.ingestDocument({ sourceId, ...dto });
  }

  @Post('sources/:id/documents/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.document.create')
  @ApiOperation({
    summary: 'Ingest a document and stream extraction/chunking/embedding progress over SSE',
  })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async ingestDocumentStream(
    @Param('id') sourceId: string,
    @Body() dto: IngestKnowledgeDocumentDto,
    @Res() response: Response,
  ): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.knowledgeService.ingestDocumentStream({ sourceId, ...dto }, signal),
    );
  }

  @Get('documents')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.document.read')
  @ApiOperation({ summary: 'List knowledge documents' })
  @ApiOkResponse({ type: PaginatedKnowledgeDocumentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listDocuments(@Query() query: ListKnowledgeDocumentsQueryDto) {
    const result = await this.knowledgeService.listDocuments({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sourceId: query.sourceId,
      status: query.status,
    });
    return {
      ...result,
      items: result.items.map((document) => KnowledgeDocumentResponseDto.fromEntity(document)),
    };
  }

  @Get('documents/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.document.read')
  @ApiOperation({ summary: 'Get a knowledge document' })
  @ApiOkResponse({ type: KnowledgeDocumentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getDocument(@Param('id') id: string): Promise<KnowledgeDocumentResponseDto> {
    const document = await this.knowledgeService.getDocumentOrThrow(id);
    return KnowledgeDocumentResponseDto.fromEntity(document);
  }

  @Delete('documents/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.document.delete')
  @ApiOperation({ summary: 'Soft delete a knowledge document and its chunks' })
  @ApiOkResponse({ type: KnowledgeDocumentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async deleteDocument(@Param('id') id: string): Promise<KnowledgeDocumentResponseDto> {
    const document = await this.knowledgeService.deleteDocument(id);
    return KnowledgeDocumentResponseDto.fromEntity(document);
  }

  @Post('documents/:id/refresh')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Re-chunk and re-embed a document from its stored extracted text' })
  @ApiCreatedResponse({ type: KnowledgeIngestionResultSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async refreshDocument(@Param('id') id: string): Promise<KnowledgeIngestionResultDto> {
    return this.knowledgeService.refreshDocument(id);
  }

  @Post('documents/:id/refresh/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Refresh a document and stream chunking/embedding progress over SSE' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async refreshDocumentStream(@Param('id') id: string, @Res() response: Response): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.knowledgeService.refreshDocumentStream(id, signal),
    );
  }

  @Get('stats')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Knowledge index size, embedding, and retrieval statistics' })
  @ApiOkResponse({ type: KnowledgeStatsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getStats(): Promise<KnowledgeStatsDto> {
    const stats = await this.knowledgeService.getStats();
    return KnowledgeStatsDto.fromStats(stats);
  }

  @Get('health')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({ summary: 'Coarse knowledge platform health signal' })
  @ApiOkResponse({ type: KnowledgeHealthSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getHealth() {
    return this.knowledgeService.getHealth();
  }

  @Post('graph/link')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.admin')
  @ApiOperation({
    summary: 'Create (or update) two graph entities and the relationship between them',
  })
  @ApiCreatedResponse()
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async linkGraphEntities(@Body() dto: LinkKnowledgeEntitiesDto): Promise<{ linked: true }> {
    await this.knowledgeService.linkGraphEntities(dto);
    return { linked: true };
  }

  @Get('graph/traverse')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.search')
  @ApiOperation({
    summary:
      'Breadth-first traverse the knowledge graph from a record identified by type + externalId',
  })
  @ApiOkResponse({ type: KnowledgeGraphNodesSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async traverseGraph(
    @Query() query: TraverseKnowledgeGraphQueryDto,
  ): Promise<KnowledgeGraphNodeDto[]> {
    const nodes = await this.knowledgeService.traverseGraph(
      query.type,
      query.externalId,
      query.hops ?? 1,
    );
    return nodes.map((node) => KnowledgeGraphNodeDto.fromNode(node));
  }

  @Post('search')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.search')
  @ApiOperation({ summary: 'Hybrid semantic + keyword search over the knowledge graph' })
  @ApiCreatedResponse({ type: KnowledgeSearchResultsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async search(@Body() dto: SearchKnowledgeDto): Promise<KnowledgeSearchResultDto[]> {
    const results = await this.knowledgeService.search(dto.query, {
      topK: dto.topK,
      minConfidence: dto.minConfidence,
      filters: { sourceIds: dto.sourceIds, sourceTypes: dto.sourceTypes },
    });
    return results.map((result) => KnowledgeSearchResultDto.fromResult(result));
  }

  @Post('preview')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.search')
  @ApiOperation({ summary: 'Preview the context an autonomous agent would receive for a query' })
  @ApiCreatedResponse({ type: KnowledgeContextPreviewSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async preview(@Body() dto: SearchKnowledgeDto) {
    return this.knowledgeService.preview(dto.query, {
      topK: dto.topK,
      minConfidence: dto.minConfidence,
      filters: { sourceIds: dto.sourceIds, sourceTypes: dto.sourceTypes },
    });
  }

  @Post('preview/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.search')
  @ApiOperation({
    summary:
      'Preview context building and stream searching/ranking/context-built/citation events over SSE',
  })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async previewStream(@Body() dto: SearchKnowledgeDto, @Res() response: Response): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.knowledgeService.previewStream(
        dto.query,
        {
          topK: dto.topK,
          minConfidence: dto.minConfidence,
          filters: { sourceIds: dto.sourceIds, sourceTypes: dto.sourceTypes },
        },
        signal,
      ),
    );
  }
}
