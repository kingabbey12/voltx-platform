import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttachmentsModule } from '../attachments/attachments.module';
import { BillingModule } from '../billing/billing.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AIController } from './ai.controller';
import { AgentApprovalRepository } from './approvals/agent-approval.repository';
import { AgentApprovalService } from './approvals/agent-approval.service';
import { ConversationController } from './conversations/conversation.controller';
import { ConversationRepository } from './conversations/conversation.repository';
import { ConversationService } from './conversations/conversation.service';
import { AIGatewayService } from './gateway/ai-gateway.service';
import { AiRateLimiterService } from './gateway/ai-rate-limiter.service';
import { AiToolPermissionService } from './gateway/ai-tool-permission.service';
import { AiUsageRepository } from './gateway/ai-usage.repository';
import { AiUsageService } from './gateway/ai-usage.service';
import { KnowledgeRetrieverService } from './gateway/knowledge-retriever.service';
import { MemoryModule } from './memory/memory.module';
import { ModelRegistryService } from './models/model-registry.service';
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { AI_PROVIDERS, AIProvider } from './providers/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleAIProvider } from './providers/google-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { XaiProvider } from './providers/xai.provider';
import { GroqProvider } from './providers/groq.provider';
import { MistralProvider } from './providers/mistral.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AzureOpenAIProvider } from './providers/azure-openai.provider';
import { AIRuntimeService } from './runtime/ai-runtime.service';
import { ToolModule } from './tools/tool.module';

@Module({
  imports: [
    ConfigModule,
    ToolModule,
    forwardRef(() => MemoryModule),
    forwardRef(() => KnowledgeModule),
    AttachmentsModule,
    BillingModule,
  ],
  controllers: [AIController, ConversationController],
  providers: [
    AIRuntimeService,
    AIGatewayService,
    AiRateLimiterService,
    AiToolPermissionService,
    AgentApprovalRepository,
    AgentApprovalService,
    AiUsageRepository,
    AiUsageService,
    KnowledgeRetrieverService,
    ConversationRepository,
    ConversationService,
    PromptBuilderService,
    ModelRegistryService,
    OpenAIProvider,
    AnthropicProvider,
    GoogleAIProvider,
    XaiProvider,
    GroqProvider,
    MistralProvider,
    DeepSeekProvider,
    OllamaProvider,
    OpenRouterProvider,
    AzureOpenAIProvider,
    {
      provide: AI_PROVIDERS,
      useFactory: (...providers: AIProvider[]) => providers,
      inject: [
        OpenAIProvider,
        AnthropicProvider,
        GoogleAIProvider,
        XaiProvider,
        GroqProvider,
        MistralProvider,
        DeepSeekProvider,
        OllamaProvider,
        OpenRouterProvider,
        AzureOpenAIProvider,
      ],
    },
  ],
  exports: [
    AIRuntimeService,
    AIGatewayService,
    AiUsageService,
    AgentApprovalService,
    ModelRegistryService,
    ConversationService,
    ConversationRepository,
  ],
})
export class AIModule {}
