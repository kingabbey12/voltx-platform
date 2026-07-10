import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationModule } from '../integrations/integration.module';
import { AgentModule } from '../ai/agents/agent.module';
import { AIModule } from '../ai/ai.module';
import { ToolModule } from '../ai/tools/tool.module';
import { SalesModule } from '../sales/sales.module';
import { CommsToolSourceService } from './tools/comms-tool-source.service';
import { ChannelProviderRegistry } from './channels/channel-provider.registry';
import { CHANNEL_PROVIDERS } from './channels/channel-provider.interface';
import { ChannelConnectionController } from './channel-connections/channel-connection.controller';
import { ChannelConnectionRepository } from './channel-connections/channel-connection.repository';
import { ChannelConnectionService } from './channel-connections/channel-connection.service';
import { CommsChannelCredentialRepository } from './channel-connections/channel-credential.repository';
import { ConversationController } from './conversation/conversation.controller';
import { ConversationRepository } from './conversation/conversation.repository';
import { ConversationService } from './conversation/conversation.service';
import { MessageRepository } from './conversation/message.repository';
import { AIConversationSummaryRepository } from './conversation/ai-conversation-summary.repository';
import { GmailChannelProvider } from './email/gmail-channel.provider';
import { SlackChannelProvider } from './slack/slack-channel.provider';
import { SlackWebhookController } from './slack/slack-webhook.controller';
import { GmailPollService } from './jobs/gmail-poll.service';
import { AiProcessQueueService } from './jobs/ai-process-queue.service';
import { AiProcessProcessor } from './jobs/ai-process.processor';
import { CommsAiService } from './jobs/comms-ai.service';
import { AI_PROCESS_QUEUE } from './jobs/communications-jobs.constants';
import { CommsGateway } from './realtime/comms.gateway';

// REDIS_ENABLED-gated at module-decoration time (not inside a factory) so
// the AiProcessProcessor's BullMQ Worker — which opens a real Redis
// connection on instantiation — is never even constructed when Redis
// isn't available, matching the graceful-degradation pattern the
// knowledge embedding cache already uses elsewhere in this codebase.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: AI_PROCESS_QUEUE }),
    ]
  : [];

@Module({
  imports: [
    AuthModule,
    IntegrationModule,
    AgentModule,
    AIModule,
    ToolModule,
    SalesModule,
    ...queueImports,
  ],
  controllers: [ChannelConnectionController, ConversationController, SlackWebhookController],
  providers: [
    ChannelProviderRegistry,
    GmailChannelProvider,
    SlackChannelProvider,
    {
      provide: CHANNEL_PROVIDERS,
      useFactory: (gmail: GmailChannelProvider, slack: SlackChannelProvider) => [gmail, slack],
      inject: [GmailChannelProvider, SlackChannelProvider],
    },
    ChannelConnectionRepository,
    CommsChannelCredentialRepository,
    ChannelConnectionService,
    ConversationRepository,
    MessageRepository,
    AIConversationSummaryRepository,
    CommsGateway,
    ConversationService,
    GmailPollService,
    AiProcessQueueService,
    CommsAiService,
    CommsToolSourceService,
    ...(redisEnabled ? [AiProcessProcessor] : []),
  ],
  exports: [ChannelProviderRegistry, ChannelConnectionService, ConversationService, CommsGateway],
})
export class CommunicationsModule {}
