import {
  Body,
  Controller,
  Get,
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
  CreateLegalHoldDto,
  LegalHoldResponseDto,
  UpdateLegalHoldDto,
} from '../dto/legal-hold.dto';
import { LegalHoldService } from './legal-hold.service';

@ApiTags('Compliance — Legal Holds')
@ApiBearerAuth('JWT')
@Controller('compliance/legal-holds')
export class LegalHoldController {
  constructor(private readonly legalHoldService: LegalHoldService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.legalhold.manage')
  @ApiOperation({
    summary: 'Create a legal/litigation hold that blocks GDPR erasure for its target',
  })
  async create(@Body() dto: CreateLegalHoldDto): Promise<LegalHoldResponseDto> {
    const hold = await this.legalHoldService.create(dto);
    return LegalHoldResponseDto.fromModel(hold);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.legalhold.read')
  @ApiOperation({ summary: 'List legal holds for this organization' })
  async list(): Promise<LegalHoldResponseDto[]> {
    const holds = await this.legalHoldService.list();
    return holds.map((hold) => LegalHoldResponseDto.fromModel(hold));
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.legalhold.read')
  @ApiOperation({ summary: 'Get one legal hold' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<LegalHoldResponseDto> {
    const hold = await this.legalHoldService.getOrThrow(id);
    return LegalHoldResponseDto.fromModel(hold);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.legalhold.manage')
  @ApiOperation({ summary: 'Update an active legal hold' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalHoldDto,
  ): Promise<LegalHoldResponseDto> {
    const hold = await this.legalHoldService.update(id, dto);
    return LegalHoldResponseDto.fromModel(hold);
  }

  @Post(':id/release')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.legalhold.manage')
  @ApiOperation({ summary: 'Release a legal hold, re-enabling GDPR erasure for its target' })
  async release(@Param('id', ParseUUIDPipe) id: string): Promise<LegalHoldResponseDto> {
    const hold = await this.legalHoldService.release(id);
    return LegalHoldResponseDto.fromModel(hold);
  }
}
