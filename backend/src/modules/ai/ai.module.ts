import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { ConversationController } from './conversations/conversation.controller';
import { ConversationRepository } from './conversations/conversation.repository';
import { ConversationService } from './conversations/conversation.service';
import { MemoryModule } from './memory/memory.module';
import { ModelRegistryService } from './models/model-registry.service';
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { AI_PROVIDERS } from './providers/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleAIProvider } from './providers/google-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AIRuntimeService } from './runtime/ai-runtime.service';
import { ToolModule } from './tools/tool.module';

@Module({
  imports: [ConfigModule, ToolModule, MemoryModule],
  controllers: [AIController, ConversationController],
  providers: [
    AIRuntimeService,
    ConversationRepository,
    ConversationService,
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
  exports: [AIRuntimeService, ModelRegistryService, ConversationService, ConversationRepository],
})
export class AIModule {}
