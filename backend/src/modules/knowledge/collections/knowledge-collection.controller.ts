import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import {
  CreateKnowledgeCollectionDto,
  KnowledgeCollectionResponseDto,
  KnowledgeCollectionSuccessResponseDto,
  ListKnowledgeCollectionsQueryDto,
  PaginatedKnowledgeCollectionsDto,
  PaginatedKnowledgeCollectionsResponseDto,
  UpdateKnowledgeCollectionDto,
} from '../dto/knowledge-collection.dto';
import { KnowledgeCollectionService } from './knowledge-collection.service';

@ApiTags('Knowledge')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
@Controller('knowledge/collections')
export class KnowledgeCollectionController {
  constructor(private readonly service: KnowledgeCollectionService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.read')
  @ApiOperation({ summary: "List the organization's knowledge collections" })
  @ApiOkResponse({ type: PaginatedKnowledgeCollectionsResponseDto })
  async list(
    @Query() query: ListKnowledgeCollectionsQueryDto,
  ): Promise<PaginatedKnowledgeCollectionsDto> {
    const result = await this.service.list(query);
    return {
      ...result,
      items: result.items.map((item) => KnowledgeCollectionResponseDto.fromEntity(item)),
    };
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.source.read')
  @ApiOperation({ summary: 'Get a knowledge collection' })
  @ApiOkResponse({ type: KnowledgeCollectionSuccessResponseDto })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<KnowledgeCollectionResponseDto> {
    return KnowledgeCollectionResponseDto.fromEntity(await this.service.get(id));
  }

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.collection.manage')
  @ApiOperation({ summary: 'Create a knowledge collection' })
  @ApiCreatedResponse({ type: KnowledgeCollectionSuccessResponseDto })
  async create(@Body() dto: CreateKnowledgeCollectionDto): Promise<KnowledgeCollectionResponseDto> {
    return KnowledgeCollectionResponseDto.fromEntity(await this.service.create(dto));
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.collection.manage')
  @ApiOperation({ summary: 'Update a knowledge collection' })
  @ApiOkResponse({ type: KnowledgeCollectionSuccessResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeCollectionDto,
  ): Promise<KnowledgeCollectionResponseDto> {
    return KnowledgeCollectionResponseDto.fromEntity(await this.service.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('knowledge.collection.manage')
  @ApiOperation({ summary: 'Soft-delete a knowledge collection (documents are detached)' })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
