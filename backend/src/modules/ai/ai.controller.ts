import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { RequireFeature } from '../billing/decorators/require-feature.decorator';
import { FeatureGateGuard } from '../billing/guards/feature-gate.guard';
import { AIChatRequestDto } from './dto/ai-chat.dto';
import { AIGatewayService } from './gateway/ai-gateway.service';
import { formatSseEvent } from './streaming/sse-event.formatter';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('ai')
export class AIController {
  constructor(private readonly aiGatewayService: AIGatewayService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FeatureGateGuard)
  @RequireFeature('ai_requests')
  @ApiOperation({ summary: 'Stream a chat completion over Server-Sent Events' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  async chat(@Body() dto: AIChatRequestDto, @Res() response: Response): Promise<void> {
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    const abortController = new AbortController();
    response.on('close', () => {
      abortController.abort();
    });

    try {
      for await (const event of this.aiGatewayService.streamChat({
        requestType: 'CHAT',
        conversationId: dto.conversationId,
        provider: dto.provider,
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        workspaceContext: dto.workspaceContext,
        conversationHistory: dto.conversationHistory,
        userPrompt: dto.userPrompt,
        toolResults: dto.toolResults,
        temperature: dto.temperature,
        maxOutputTokens: dto.maxOutputTokens,
        signal: abortController.signal,
      })) {
        response.write(formatSseEvent(event.type, event));
      }

      response.write(formatSseEvent('done', { status: 'completed' }));
    } catch (error) {
      response.write(
        formatSseEvent('error', {
          code: error instanceof Error ? error.name : 'AIRuntimeError',
          message: error instanceof Error ? error.message : 'AI runtime failed',
        }),
      );
    } finally {
      response.end();
    }
  }
}
