import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationModule } from '../integrations/integration.module';
import { AgentModule } from '../ai/agents/agent.module';
import { AIModule } from '../ai/ai.module';
import { ToolModule } from '../ai/tools/tool.module';
import { SalesModule } from '../sales/sales.module';
import { AttachmentsModule } from '../attachments/attachments.module';
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
import { NoteRepository } from './conversation/note.repository';
import { CommunicationEventRepository } from './conversation/communication-event.repository';
import { AIConversationSummaryRepository } from './conversation/ai-conversation-summary.repository';
import { GmailChannelProvider } from './email/gmail-channel.provider';
import { OutlookChannelProvider } from './email/outlook-channel.provider';
import { SlackChannelProvider } from './slack/slack-channel.provider';
import { SlackWebhookController } from './slack/slack-webhook.controller';
import { TeamsChannelProvider } from './teams/teams-channel.provider';
import { TeamsSubscriptionService } from './teams/teams-subscription.service';
import { TeamsWebhookController } from './teams/teams-webhook.controller';
import { WhatsAppChannelProvider } from './whatsapp/whatsapp-channel.provider';
import { WhatsAppWebhookController } from './whatsapp/whatsapp-webhook.controller';
import { TwilioSmsChannelProvider } from './twilio/twilio-sms-channel.provider';
import { TwilioSmsWebhookController } from './twilio/twilio-sms-webhook.controller';
import { TwilioVoiceChannelProvider } from './twilio/twilio-voice-channel.provider';
import { TwilioVoiceWebhookController } from './twilio/twilio-voice-webhook.controller';
import { CallController } from './calls/call.controller';
import { CallRepository } from './calls/call.repository';
import { CallService } from './calls/call.service';
import { CommsPollService } from './jobs/comms-poll.service';
import { AiProcessQueueService } from './jobs/ai-process-queue.service';
import { AiProcessProcessor } from './jobs/ai-process.processor';
import { CommsAiProcessingService } from './jobs/comms-ai-processing.service';
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
    AttachmentsModule,
    ...queueImports,
  ],
  controllers: [
    ChannelConnectionController,
    ConversationController,
    CallController,
    SlackWebhookController,
    TeamsWebhookController,
    WhatsAppWebhookController,
    TwilioSmsWebhookController,
    TwilioVoiceWebhookController,
  ],
  providers: [
    ChannelProviderRegistry,
    GmailChannelProvider,
    OutlookChannelProvider,
    SlackChannelProvider,
    TeamsChannelProvider,
    WhatsAppChannelProvider,
    TwilioSmsChannelProvider,
    TwilioVoiceChannelProvider,
    {
      provide: CHANNEL_PROVIDERS,
      useFactory: (
        gmail: GmailChannelProvider,
        outlook: OutlookChannelProvider,
        slack: SlackChannelProvider,
        teams: TeamsChannelProvider,
        whatsapp: WhatsAppChannelProvider,
        twilioSms: TwilioSmsChannelProvider,
        twilioVoice: TwilioVoiceChannelProvider,
      ) => [gmail, outlook, slack, teams, whatsapp, twilioSms, twilioVoice],
      inject: [
        GmailChannelProvider,
        OutlookChannelProvider,
        SlackChannelProvider,
        TeamsChannelProvider,
        WhatsAppChannelProvider,
        TwilioSmsChannelProvider,
        TwilioVoiceChannelProvider,
      ],
    },
    ChannelConnectionRepository,
    CommsChannelCredentialRepository,
    ChannelConnectionService,
    ConversationRepository,
    MessageRepository,
    NoteRepository,
    CommunicationEventRepository,
    AIConversationSummaryRepository,
    CallRepository,
    CallService,
    CommsGateway,
    ConversationService,
    CommsPollService,
    TeamsSubscriptionService,
    AiProcessQueueService,
    CommsAiProcessingService,
    CommsAiService,
    CommsToolSourceService,
    ...(redisEnabled ? [AiProcessProcessor] : []),
  ],
  exports: [ChannelProviderRegistry, ChannelConnectionService, ConversationService, CommsGateway],
})
export class CommunicationsModule {}
