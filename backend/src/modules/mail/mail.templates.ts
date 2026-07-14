/**
 * Deliberately plain inline HTML (no external template engine/dependency)
 * — these are short, static transactional emails; a templating layer would
 * be pure overhead for two messages.
 */

function wrapper(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
            <tr><td>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0a0a0a;">Voltx</p>
              ${bodyHtml}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#0a0a0a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>`;
}

export function verifyEmailTemplate(verifyUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Verify your email address',
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:16px;color:#18181b;">Confirm your email address to finish setting up your Voltx account.</p>
      ${button(verifyUrl, 'Verify email')}
      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">If the button doesn't work, paste this link into your browser: ${verifyUrl}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">This link expires in 24 hours. If you didn't create a Voltx account, you can ignore this email.</p>
    `),
    text: `Confirm your email address to finish setting up your Voltx account: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create a Voltx account, you can ignore this email.`,
  };
}

export function passwordResetTemplate(resetUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Reset your Voltx password',
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:16px;color:#18181b;">We received a request to reset your Voltx password.</p>
      ${button(resetUrl, 'Reset password')}
      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">If the button doesn't work, paste this link into your browser: ${resetUrl}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email — your password won't change.</p>
    `),
    text: `We received a request to reset your Voltx password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request a password reset, you can ignore this email — your password won't change.`,
  };
}
