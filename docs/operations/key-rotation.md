# Encryption Key Rotation

`INTEGRATIONS_ENCRYPTION_KEY` encrypts every stored OAuth token, API key, and webhook secret at rest (`backend/src/modules/integrations/security/encryption.service.ts`). The application refuses to start if it is unset or shorter than 16 characters — there is no insecure fallback.

## Rotating to a new key

1. Generate a new key: `openssl rand -base64 32`.
2. Deploy with **both** keys set:
   - `INTEGRATIONS_ENCRYPTION_KEY` — the new key.
   - `INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS` — the key being retired.

   With both set, `EncryptionService.decrypt()` tries the new key first and automatically falls back to the previous key, so already-encrypted rows keep working without interruption during the rotation.
3. Run the re-encryption script against production, with both keys set in its environment:

   ```bash
   cd backend
   INTEGRATIONS_ENCRYPTION_KEY=<new-key> \
   INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS=<key-being-retired> \
   DATABASE_URL=<production-database-url> \
   pnpm reencrypt-secrets
   ```

   This re-encrypts every row in `integration_credentials`, `comms_channel_credentials`, and `integration_webhook_endpoints` under the new key, reusing the same production `EncryptionService.decrypt()`/`encrypt()` code path — nothing about the crypto is reimplemented in the script.
4. Confirm the app is healthy (integrations still connect, webhooks still verify) with both keys still set.
5. Remove `INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS` from the environment. Every row is now encrypted only under the new key.

## If you suspect the key has been compromised

Treat this the same as a rotation, but move quickly: every OAuth token protected by the old key should also be considered exposed. After completing the rotation above, additionally revoke and reconnect the affected integrations from their provider's side (Google/Microsoft/Slack), since re-encrypting a token does not invalidate the underlying credential.
