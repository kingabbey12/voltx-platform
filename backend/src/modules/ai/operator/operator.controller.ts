import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { OperatorService, OperatorSessionResult } from './operator.service';

class OperatorSessionResponseDto {
  conversationId!: string;
  readOnlyAgentId!: string;
  fullAgentId!: string;
}

class OperatorSessionSuccessResponseDto extends ApiSuccessResponseDto<OperatorSessionResponseDto> {}

@ApiTags('AI Operator')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('ai/operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Post('session')
  @ApiOperation({
    summary:
      'Start (or resume) an AI Command Center session — ensures the Voltx Operator agents exist for this organization and returns a fresh conversation to run them against.',
  })
  @ApiCreatedResponse({ type: OperatorSessionSuccessResponseDto })
  createSession(): Promise<OperatorSessionResult> {
    return this.operatorService.createSession();
  }
}
