import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_PROVIDERS,
  IntegrationProvider,
  IntegrationProviderKey,
} from './integration-provider.types';

@Injectable()
export class IntegrationProviderRegistry {
  private readonly byKey: Map<IntegrationProviderKey, IntegrationProvider>;

  constructor(@Inject(INTEGRATION_PROVIDERS) providers: IntegrationProvider[]) {
    this.byKey = new Map(providers.map((provider) => [provider.key, provider]));
  }

  list(): IntegrationProvider[] {
    return Array.from(this.byKey.values());
  }

  get(key: IntegrationProviderKey): IntegrationProvider {
    const provider = this.byKey.get(key);
    if (!provider) {
      throw new NotFoundException(`Integration provider "${key}" is not registered`);
    }
    return provider;
  }
}
