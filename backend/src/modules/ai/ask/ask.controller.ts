import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { writeEventStreamToResponse } from '../streaming/write-event-stream-to-response';
import { AskStreamDto } from './dto/ask.dto';
import { AskService } from './ask.service';
import { RecordResolverService } from './record-resolver.service';

@ApiTags('Ask')
@ApiBearerAuth('JWT')
@Controller('ai/ask')
export class AskController {
  constructor(
    private readonly askService: AskService,
    private readonly recordResolverService: RecordResolverService,
  ) {}

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary:
      'Ask one turn and stream the answer: doing-lines, whole sentences, held work, and the grounded structured response',
  })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async stream(
    @Body() dto: AskStreamDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.askService.stream(
        {
          agentId: dto.agentId,
          conversationId: dto.conversationId,
          prompt: dto.prompt,
          workspaceContext: dto.workspaceContext,
        },
        user.permissions,
        signal,
      ),
    );
  }

  @Get('records/:type/:id')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({ summary: 'Resolve a door to its canonical record (label and route)' })
  @ApiOkResponse({ description: 'The canonical record descriptor' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  resolveRecord(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserInterface,
  ) {
    return this.recordResolverService.resolve(type, id, user.permissions);
  }
}
