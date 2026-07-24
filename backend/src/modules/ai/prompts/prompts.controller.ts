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
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import {
  CreatePromptDto,
  ListPromptsQueryDto,
  PaginatedPromptsDto,
  PromptResponseDto,
  PromptTestResultDto,
  PromptVersionResponseDto,
  PublishPromptDto,
  RollbackPromptDto,
  TestPromptDto,
  UpdatePromptDto,
} from './dto/prompt.dto';
import { PromptsService } from './prompts.service';

@ApiTags('AI Prompts')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
@Controller('ai/prompts')
export class PromptsController {
  constructor(private readonly service: PromptsService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.create')
  @ApiOperation({ summary: 'Create a prompt and its first version (DRAFT)' })
  @ApiCreatedResponse({ type: PromptResponseDto })
  create(@Body() dto: CreatePromptDto): Promise<PromptResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.read')
  @ApiOperation({ summary: "List the organization's prompts (filter by status/category)" })
  @ApiOkResponse({ type: PaginatedPromptsDto })
  list(@Query() query: ListPromptsQueryDto): Promise<PaginatedPromptsDto> {
    return this.service.list(query);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.read')
  @ApiOperation({ summary: 'Read one prompt with its latest version' })
  @ApiOkResponse({ type: PromptResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PromptResponseDto> {
    return this.service.get(id);
  }

  @Get(':id/history')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.read')
  @ApiOperation({ summary: 'List every immutable version of a prompt, newest first' })
  @ApiOkResponse({ type: [PromptVersionResponseDto] })
  history(@Param('id', ParseUUIDPipe) id: string): Promise<PromptVersionResponseDto[]> {
    return this.service.history(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.update')
  @ApiOperation({
    summary: 'Update prompt metadata, advance the review workflow, and/or append a new version',
  })
  @ApiOkResponse({ type: PromptResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromptDto,
  ): Promise<PromptResponseDto> {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.publish')
  @ApiOperation({ summary: 'Publish a version, making it the live prompt the gateway resolves' })
  @ApiOkResponse({ type: PromptResponseDto })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishPromptDto,
  ): Promise<PromptResponseDto> {
    return this.service.publish(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.publish')
  @ApiOperation({ summary: 'Archive a prompt, retiring it from runtime resolution' })
  @ApiOkResponse({ type: PromptResponseDto })
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<PromptResponseDto> {
    return this.service.archive(id);
  }

  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.rollback')
  @ApiOperation({
    summary: 'Restore a previous version as a new version (history is preserved)',
  })
  @ApiOkResponse({ type: PromptResponseDto })
  rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackPromptDto,
  ): Promise<PromptResponseDto> {
    return this.service.rollback(id, dto);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.test')
  @ApiOperation({
    summary: 'Render a version with sample variables and run it through the AI Gateway',
  })
  @ApiOkResponse({ type: PromptTestResultDto })
  runTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestPromptDto,
  ): Promise<PromptTestResultDto> {
    return this.service.test(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.prompt.delete')
  @ApiOperation({ summary: 'Soft-delete a prompt' })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
