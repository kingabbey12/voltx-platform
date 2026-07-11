import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ToolModule } from '../ai/tools/tool.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { GoogleGmailConnector } from './connectors/google/google-gmail.connector';
import { GoogleCalendarConnector } from './connectors/google/google-calendar.connector';
import { GoogleDriveConnector } from './connectors/google/google-drive.connector';
import { MicrosoftOutlookConnector } from './connectors/microsoft/microsoft-outlook.connector';
import { MicrosoftCalendarConnector } from './connectors/microsoft/microsoft-calendar.connector';
import { MicrosoftOneDriveConnector } from './connectors/microsoft/microsoft-onedrive.connector';
import { SlackConnector } from './connectors/slack/slack.connector';
import { MicrosoftTeamsConnector } from './connectors/teams/microsoft-teams.connector';
import { GitHubConnector } from './connectors/github/github.connector';
import { StripeConnector } from './connectors/stripe/stripe.connector';
import { GenericWebhookConnector } from './connectors/webhook/generic-webhook.connector';
import { GenericRestConnector } from './connectors/rest/generic-rest.connector';
import { IntegrationDispatcherService } from './dispatch/integration-dispatcher.service';
import { IntegrationEventBusService } from './events/integration-event-bus.service';
import { IntegrationEventStreamController } from './events/integration-event-stream.controller';
import { IntegrationEventStreamService } from './events/integration-event-stream.service';
import { IntegrationKnowledgeContributorService } from './knowledge/integration-knowledge-contributor.service';
import { OAuthService } from './oauth/oauth.service';
import { INTEGRATION_PROVIDERS, IntegrationProvider } from './provider/integration-provider.types';
import { IntegrationProviderRegistry } from './provider/integration-provider.registry';
import { IntegrationToolSourceService } from './tools/integration-tool-source.service';
import { IntegrationStepExecutor } from './workflow/integration-step-executor';
import { IntegrationWorkflowRegistrarService } from './workflow/integration-workflow-registrar.service';
import { IntegrationWorkflowEventBridgeService } from './workflow/integration-workflow-event-bridge.service';
import { IntegrationWebhookReceiverController } from './webhooks/integration-webhook-receiver.controller';
import { IntegrationWebhookReceiverService } from './webhooks/integration-webhook-receiver.service';
import { IntegrationStatsService } from './observability/integration-stats.service';
import { IntegrationApiUsageLogRepository } from './integration-api-usage-log.repository';
import { IntegrationConnectionController } from './integration-connection.controller';
import { IntegrationConnectionRepository } from './integration-connection.repository';
import { IntegrationConnectionService } from './integration-connection.service';
import { IntegrationCredentialRepository } from './integration-credential.repository';
import { IntegrationEventRepository } from './integration-event.repository';
import { IntegrationHealthCheckRepository } from './integration-health-check.repository';
import { IntegrationPollerService } from './integration-poller.service';
import { IntegrationSyncRunRepository } from './integration-sync-run.repository';
import { IntegrationWebhookEndpointRepository } from './integration-webhook-endpoint.repository';

const CONNECTORS = [
  GoogleGmailConnector,
  GoogleCalendarConnector,
  GoogleDriveConnector,
  MicrosoftOutlookConnector,
  MicrosoftCalendarConnector,
  MicrosoftOneDriveConnector,
  SlackConnector,
  MicrosoftTeamsConnector,
  GitHubConnector,
  StripeConnector,
  GenericWebhookConnector,
  GenericRestConnector,
];

@Module({
  imports: [AuthModule, ToolModule, KnowledgeModule, WorkflowModule],
  controllers: [
    IntegrationConnectionController,
    IntegrationWebhookReceiverController,
    IntegrationEventStreamController,
  ],
  providers: [
    ...CONNECTORS,
    {
      provide: INTEGRATION_PROVIDERS,
      useFactory: (...connectors: IntegrationProvider[]) => connectors,
      inject: CONNECTORS,
    },
    IntegrationProviderRegistry,
    OAuthService,
    IntegrationConnectionRepository,
    IntegrationCredentialRepository,
    IntegrationWebhookEndpointRepository,
    IntegrationEventRepository,
    IntegrationSyncRunRepository,
    IntegrationApiUsageLogRepository,
    IntegrationHealthCheckRepository,
    IntegrationEventBusService,
    IntegrationEventStreamService,
    IntegrationDispatcherService,
    IntegrationKnowledgeContributorService,
    IntegrationConnectionService,
    IntegrationStatsService,
    IntegrationPollerService,
    IntegrationWebhookReceiverService,
    IntegrationStepExecutor,
    IntegrationWorkflowRegistrarService,
    IntegrationWorkflowEventBridgeService,
    IntegrationToolSourceService,
  ],
  exports: [
    IntegrationDispatcherService,
    IntegrationEventBusService,
    OAuthService,
    GoogleGmailConnector,
    SlackConnector,
    MicrosoftOutlookConnector,
    MicrosoftTeamsConnector,
  ],
})
export class IntegrationModule {}
