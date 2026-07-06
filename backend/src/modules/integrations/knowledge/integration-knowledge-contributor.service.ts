import { Injectable, Logger } from '@nestjs/common';
import { drainToReturnValue } from '../../ai/streaming/drain-generator';
import { KnowledgeIngestionService } from '../../knowledge/ingestion/knowledge-ingestion.service';
import { KnowledgeSourceRepository } from '../../knowledge/sources/knowledge-source.repository';
import { IntegrationConnectionRepository } from '../integration-connection.repository';
import { IntegrationConnectionEntity } from '../entities/integration-connection.entity';
import { IntegrationParsedEvent } from '../provider/integration-provider.types';

/**
 * Maps a connector's normalized events into the Enterprise Knowledge
 * Graph — entirely by calling KnowledgeIngestionService.ingestDocument
 * (VT-023), never touching chunking/embedding/retrieval directly. One
 * KnowledgeSource is created per connection (its id cached on the
 * connection's `config.knowledgeSourceId`) rather than per event, since a
 * connector's `knowledgeContribution.sourceType` is fixed for its
 * lifetime (Gmail always contributes EMAIL, Drive always UPLOADED_FILE,
 * etc.) — so there is exactly one source to find-or-create, ever.
 */
@Injectable()
export class IntegrationKnowledgeContributorService {
  private readonly logger = new Logger(IntegrationKnowledgeContributorService.name);

  constructor(
    private readonly knowledgeSourceRepository: KnowledgeSourceRepository,
    private readonly knowledgeIngestionService: KnowledgeIngestionService,
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
  ) {}

  async contribute(
    connection: IntegrationConnectionEntity,
    event: IntegrationParsedEvent,
  ): Promise<void> {
    if (!event.knowledgeContribution) {
      return;
    }

    try {
      const sourceId = await this.resolveKnowledgeSourceId(connection, event);
      await drainToReturnValue(
        this.knowledgeIngestionService.ingestDocument({
          sourceId,
          externalId: event.externalId,
          title: event.knowledgeContribution.title,
          contentType: event.knowledgeContribution.contentType,
          text: event.knowledgeContribution.text,
          metadata: event.knowledgeContribution.metadata,
        }),
      );
    } catch (error) {
      this.logger.error(
        { err: error, connectionId: connection.id, eventType: event.type },
        'Failed to contribute integration event to the knowledge graph',
      );
    }
  }

  private async resolveKnowledgeSourceId(
    connection: IntegrationConnectionEntity,
    event: IntegrationParsedEvent,
  ): Promise<string> {
    const cachedSourceId = connection.config.knowledgeSourceId;
    if (typeof cachedSourceId === 'string') {
      return cachedSourceId;
    }

    const source = await this.knowledgeSourceRepository.create({
      type: event.knowledgeContribution!.sourceType,
      name: `${connection.displayName} (${connection.provider})`,
      config: { integrationConnectionId: connection.id },
    });

    await this.integrationConnectionRepository.update(connection.id, {
      config: { ...connection.config, knowledgeSourceId: source.id },
    });

    return source.id;
  }
}
