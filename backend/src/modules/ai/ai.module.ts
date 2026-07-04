import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { ConversationMemoryService } from './memory/conversation-memory.service';
import { ModelRegistryService } from './models/model-registry.service';
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { AI_PROVIDERS } from './providers/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleAIProvider } from './providers/google-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AIRuntimeService } from './runtime/ai-runtime.service';

@Module({
  imports: [ConfigModule],
  controllers: [AIController],
  providers: [
    AIRuntimeService,
    ConversationMemoryService,
    PromptBuilderService,
    ModelRegistryService,
    OpenAIProvider,
    AnthropicProvider,
    GoogleAIProvider,
    {
      provide: AI_PROVIDERS,
      useFactory: (
        openAiProvider: OpenAIProvider,
        anthropicProvider: AnthropicProvider,
        googleAiProvider: GoogleAIProvider,
      ) => [openAiProvider, anthropicProvider, googleAiProvider],
      inject: [OpenAIProvider, AnthropicProvider, GoogleAIProvider],
    },
  ],
  exports: [AIRuntimeService, ModelRegistryService],
})
export class AIModule {}
