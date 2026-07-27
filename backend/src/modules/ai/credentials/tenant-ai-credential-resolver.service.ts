import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { AIProviderName } from '../models/ai-model.types';
import { TenantAiCredentialsRepository } from './tenant-ai-credentials.repository';

export interface ResolvedProviderCredential {
  apiKey: string;
  baseUrl?: string;
  metadata: Record<string, unknown>;
}

/**
 * The AI Gateway's extension point for "bring your own key": given an
 * organization and provider, returns the decrypted ACTIVE credential, or
 * null when the org has none (the gateway then falls back to the platform's
 * env-configured provider key). Decryption happens here and nowhere else on
 * the read path; callers receive plaintext transiently and must never persist
 * or log it.
 */
@Injectable()
export class TenantAiCredentialResolver {
  constructor(
    private readonly repository: TenantAiCredentialsRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async resolve(
    organizationId: string,
    provider: AIProviderName,
  ): Promise<ResolvedProviderCredential | null> {
    const credential = await this.repository.findActiveForProvider(organizationId, provider);
    if (!credential) {
      return null;
    }
    return {
      apiKey: this.encryptionService.decrypt(credential.encryptedApiKey),
      baseUrl: credential.baseUrl ?? undefined,
      metadata: credential.metadata,
    };
  }
}
