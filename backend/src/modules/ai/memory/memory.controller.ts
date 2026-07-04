import { Controller, Delete, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import {
  CreateMemoryDto,
  MemorySuccessResponseDto,
  ListMemoriesQueryDto,
  PaginatedMemoriesSuccessResponseDto,
  MemoryResponseDto,
} from './dto/memory.dto';
import { MemoryService } from './memory.service';

@ApiTags('AI Memories')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('ai/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  @ApiOperation({ summary: 'List stored long-term memories for the current user' })
  @ApiOkResponse({ type: PaginatedMemoriesSuccessResponseDto })
  list(@Query() query: ListMemoriesQueryDto) {
    return this.memoryService.listMemories({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      category: query.category,
      conversationId: query.conversationId,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a long-term memory entry' })
  @ApiOkResponse({ type: MemorySuccessResponseDto })
  create(@Body() dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    return this.memoryService.createMemory(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a memory entry' })
  @ApiOkResponse({ type: MemorySuccessResponseDto })
  delete(@Param('id') id: string): Promise<MemoryResponseDto> {
    return this.memoryService.deleteMemory(id);
  }
}
