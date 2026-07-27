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
  AiCredentialResponseDto,
  AiCredentialTestResultDto,
  CreateAiCredentialDto,
  ListAiCredentialsQueryDto,
  PaginatedAiCredentialsDto,
  RotateAiCredentialDto,
  UpdateAiCredentialDto,
} from './dto/ai-credential.dto';
import { TenantAiCredentialsService } from './tenant-ai-credentials.service';

@ApiTags('AI Credentials')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
@Controller('ai/credentials')
export class TenantAiCredentialsController {
  constructor(private readonly service: TenantAiCredentialsService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.create')
  @ApiOperation({ summary: 'Store a new encrypted AI provider credential for the organization' })
  @ApiCreatedResponse({ type: AiCredentialResponseDto })
  create(@Body() dto: CreateAiCredentialDto): Promise<AiCredentialResponseDto> {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.read')
  @ApiOperation({ summary: "List the organization's AI provider credentials (keys masked)" })
  @ApiOkResponse({ type: PaginatedAiCredentialsDto })
  list(@Query() query: ListAiCredentialsQueryDto): Promise<PaginatedAiCredentialsDto> {
    return this.service.list(query);
  }

  @Get('health')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.test')
  @ApiOperation({ summary: 'Health-check every stored credential by calling each provider' })
  @ApiOkResponse({ type: [AiCredentialTestResultDto] })
  health(): Promise<AiCredentialTestResultDto[]> {
    return this.service.healthCheckAll();
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.read')
  @ApiOperation({ summary: 'Read one AI provider credential (key masked)' })
  @ApiOkResponse({ type: AiCredentialResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AiCredentialResponseDto> {
    return this.service.get(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.update')
  @ApiOperation({
    summary: 'Update a credential (label, base URL, status, metadata — not the key)',
  })
  @ApiOkResponse({ type: AiCredentialResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiCredentialDto,
  ): Promise<AiCredentialResponseDto> {
    return this.service.update(id, dto);
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.update')
  @ApiOperation({ summary: 'Rotate the API key: re-encrypt a new key in place, on the record' })
  @ApiOkResponse({ type: AiCredentialResponseDto })
  rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotateAiCredentialDto,
  ): Promise<AiCredentialResponseDto> {
    return this.service.rotate(id, dto);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.test')
  @ApiOperation({ summary: 'Health-check one credential with a live provider call' })
  @ApiOkResponse({ type: AiCredentialTestResultDto })
  test(@Param('id', ParseUUIDPipe) id: string): Promise<AiCredentialTestResultDto> {
    return this.service.test(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.credential.delete')
  @ApiOperation({ summary: 'Soft-delete an AI provider credential' })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.delete(id);
  }
}
