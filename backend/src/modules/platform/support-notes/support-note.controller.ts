import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentAuthPrincipal } from '../../auth/decorators/current-auth-principal.decorator';
import { AuthPrincipal } from '../../auth/interfaces/auth-principal.interface';
import { CreateSupportNoteDto, SupportNoteResponseDto } from './dto/support-note.dto';
import { SupportNoteService } from './support-note.service';

@ApiTags('Platform Admin — Customer Success')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/organizations/:organizationId/support-notes')
export class SupportNoteController {
  constructor(private readonly service: SupportNoteService) {}

  @Post()
  @ApiOperation({ summary: 'Platform admin: leave a support note on an organization' })
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateSupportNoteDto,
  ): Promise<SupportNoteResponseDto> {
    const note = await this.service.create(organizationId, principal.userId, dto.note);
    return SupportNoteResponseDto.fromEntity(note);
  }

  @Get()
  @ApiOperation({ summary: 'Platform admin: list support notes for an organization' })
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<SupportNoteResponseDto[]> {
    const notes = await this.service.list(organizationId);
    return notes.map((note) => SupportNoteResponseDto.fromEntity(note));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin: delete a support note' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.service.delete(id);
    return { message: 'Support note deleted' };
  }
}
