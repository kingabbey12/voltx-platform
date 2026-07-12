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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import {
  CreateRetentionPolicyDto,
  RetentionPolicyResponseDto,
  UpdateRetentionPolicyDto,
} from '../dto/retention-policy.dto';
import { RetentionPolicyService } from './retention-policy.service';

@ApiTags('Compliance — Retention Policies')
@ApiBearerAuth('JWT')
@Controller('compliance/retention-policies')
export class RetentionPolicyController {
  constructor(private readonly retentionPolicyService: RetentionPolicyService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.retention.manage')
  @ApiOperation({ summary: 'Create a data-retention policy for a resource type' })
  async create(@Body() dto: CreateRetentionPolicyDto): Promise<RetentionPolicyResponseDto> {
    const policy = await this.retentionPolicyService.create(dto);
    return RetentionPolicyResponseDto.fromModel(policy);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.retention.read')
  @ApiOperation({ summary: 'List retention policies for this organization' })
  async list(): Promise<RetentionPolicyResponseDto[]> {
    const policies = await this.retentionPolicyService.list();
    return policies.map((policy) => RetentionPolicyResponseDto.fromModel(policy));
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.retention.read')
  @ApiOperation({ summary: 'Get one retention policy' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<RetentionPolicyResponseDto> {
    const policy = await this.retentionPolicyService.getOrThrow(id);
    return RetentionPolicyResponseDto.fromModel(policy);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.retention.manage')
  @ApiOperation({ summary: 'Update a retention policy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetentionPolicyDto,
  ): Promise<RetentionPolicyResponseDto> {
    const policy = await this.retentionPolicyService.update(id, dto);
    return RetentionPolicyResponseDto.fromModel(policy);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.retention.manage')
  @ApiOperation({ summary: 'Delete a retention policy' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.retentionPolicyService.delete(id);
    return { message: 'Retention policy deleted' };
  }
}
