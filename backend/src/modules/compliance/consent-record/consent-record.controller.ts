import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ConsentRecordResponseDto, CreateConsentRecordDto } from '../dto/consent-record.dto';
import { ConsentRecordService } from './consent-record.service';

class ConsentHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  consentType?: string;
}

@ApiTags('Compliance — Consent Records')
@ApiBearerAuth('JWT')
@Controller('compliance/consent-records')
export class ConsentRecordController {
  constructor(private readonly consentRecordService: ConsentRecordService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.consent.manage')
  @ApiOperation({
    summary: 'Record a consent grant or revocation for a user (append-only history)',
  })
  async record(@Body() dto: CreateConsentRecordDto): Promise<ConsentRecordResponseDto> {
    const record = await this.consentRecordService.record(dto);
    return ConsentRecordResponseDto.fromModel(record);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.consent.read')
  @ApiOperation({
    summary: 'View consent grant/revoke history, optionally filtered by user and/or consent type',
  })
  async history(@Query() query: ConsentHistoryQueryDto): Promise<ConsentRecordResponseDto[]> {
    const records = await this.consentRecordService.history(query);
    return records.map((record) => ConsentRecordResponseDto.fromModel(record));
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.consent.read')
  @ApiOperation({ summary: 'Get one consent record' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ConsentRecordResponseDto> {
    const record = await this.consentRecordService.getOrThrow(id);
    return ConsentRecordResponseDto.fromModel(record);
  }
}
