import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Thin wrapper around Resend's HTTP API (https://resend.com) — same
 * provider/no-SDK-dependency pattern as apps/marketing's contact form
 * (see apps/marketing/src/app/contact/actions.ts), so the whole platform
 * shares one transactional-email account instead of two.
 *
 * Deliberately never throws: an unconfigured or failing mail provider
 * must not break auth flows that already have a well-defined, safe
 * fallback behavior without email (register()/requestPasswordReset()
 * still succeed and return their normal response either way — the
 * verification/reset token still exists and remains valid, so the flow
 * simply can't complete until the operator configures RESEND_API_KEY or
 * the user contacts support for a manually-issued link). This mirrors
 * ClamAV's "optional, log and continue" precedent (see 2e4e447) rather
 * than StripeClientService's "throw when actually used" precedent, since
 * unlike a billing action, a failed-to-send email has no user-facing
 * error to surface — the HTTP response was already going to be generic.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput): Promise<void> {
    const apiKey = this.configService.get<string>('mail.resendApiKey', '');
    if (!apiKey) {
      this.logger.warn(
        `Not sending "${input.subject}" to ${input.to} — RESEND_API_KEY is not configured.`,
      );
      return;
    }

    const from = this.configService.get<string>('mail.fromAddress', 'Voltx <noreply@usevoltx.com>');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Resend API error sending "${input.subject}" to ${input.to}: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send "${input.subject}" to ${input.to}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
