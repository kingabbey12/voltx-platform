import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ToolExecutionError } from './tool.interface';

const MAX_REDIRECTS = 3;

/**
 * Every outbound request the AI's http_get/http_post tools make is
 * attacker-influenced (the URL comes from model output, which is in turn
 * influenced by untrusted conversation/tool content) — this is the single
 * choke point that stops that from becoming SSRF against internal
 * infrastructure or a cloud metadata endpoint. Blocks apply regardless of
 * an allowlist being configured; the allowlist (if set) is an additional
 * restriction, never a bypass of the block-list.
 */
@Injectable()
export class OutboundHttpGuardService {
  private readonly logger = new Logger(OutboundHttpGuardService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validates the initial URL and every redirect hop by fetching with
   * `redirect: 'manual'` and re-validating each `Location` before
   * following it. Returns the final Response once redirects are
   * exhausted or a non-redirect status is reached.
   */
  async fetch(initialUrl: string, toolName: string, init: RequestInit): Promise<Response> {
    let currentUrl = initialUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await this.assertAllowedAndLog(currentUrl, toolName, hop);

      const response = await fetch(currentUrl, { ...init, redirect: 'manual' });

      if (!isRedirect(response.status)) {
        return response;
      }

      const location = response.headers.get('location');
      if (!location) {
        return response;
      }

      currentUrl = new URL(location, currentUrl).toString();

      if (hop === MAX_REDIRECTS) {
        throw new ToolExecutionError(
          `Too many redirects (max ${MAX_REDIRECTS}) while fetching ${initialUrl}`,
          'too_many_redirects',
        );
      }
    }

    throw new ToolExecutionError('Unreachable redirect loop', 'too_many_redirects');
  }

  /**
   * A narrower, non-AI-specific check reused by any feature that must
   * validate an attacker-influenced destination URL at *registration* time
   * rather than at fetch time — e.g. an OAuth redirect URI or a webhook
   * endpoint URL. Unlike `fetch()`/`assertAllowedAndLog`, this never
   * follows redirects, never consults the AI-tool host allowlist
   * (`ai.httpTool.allowedHosts` has no meaning for a third party's own
   * domain), and never audit-logs as an AI tool call — it only performs
   * the DNS-resolution/private-IP check that is the actual SSRF-prevention
   * primitive, plus a scheme check (only http/https are ever valid
   * redirect/webhook targets).
   */
  async assertUrlIsSafeDestination(rawUrl: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`"${rawUrl}" is not a valid URL`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`Unsupported URL scheme "${parsed.protocol}" in "${rawUrl}"`);
    }

    const blockedReason = await this.checkBlockedAddress(parsed.hostname.toLowerCase());
    if (blockedReason) {
      throw new BadRequestException(
        `"${rawUrl}" is not a permitted destination (${blockedReason})`,
      );
    }
  }

  private async assertAllowedAndLog(rawUrl: string, toolName: string, hop: number): Promise<void> {
    const parsedUrl = parseUrl(rawUrl);

    const allowedHosts = this.configService.get<string[]>('ai.httpTool.allowedHosts', []);
    const hostname = parsedUrl.hostname.toLowerCase();

    const allowlisted =
      allowedHosts.length === 0 ||
      allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));

    let blockedReason: string | null = null;

    if (!allowlisted) {
      blockedReason = 'host_not_allowlisted';
    } else {
      blockedReason = await this.checkBlockedAddress(hostname);
    }

    await this.logOutboundRequest(rawUrl, toolName, hop, blockedReason);

    if (blockedReason) {
      throw new ToolExecutionError(
        `Outbound request to "${hostname}" was blocked (${blockedReason})`,
        'outbound_request_blocked',
      );
    }
  }

  private async checkBlockedAddress(hostname: string): Promise<string | null> {
    if (isIPv4(hostname) || isIPv6(hostname)) {
      return isBlockedIp(hostname) ? 'blocked_ip_range' : null;
    }

    let addresses: { address: string }[];
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      return 'dns_resolution_failed';
    }

    if (addresses.length === 0) {
      return 'dns_resolution_failed';
    }

    return addresses.some((entry) => isBlockedIp(entry.address)) ? 'blocked_ip_range' : null;
  }

  private async logOutboundRequest(
    url: string,
    toolName: string,
    hop: number,
    blockedReason: string | null,
  ): Promise<void> {
    if (!this.tenantContextService.isComplete()) {
      return;
    }

    try {
      const parsed = parseUrl(url);
      await this.auditService.record({
        action: 'ai.tool.outbound_http',
        resource: 'ai_tool_outbound_request',
        metadata: {
          toolName,
          host: parsed.hostname,
          path: parsed.pathname,
          hop,
          outcome: blockedReason ? 'blocked' : 'allowed',
          ...(blockedReason ? { blockedReason } : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        { err: error, url, toolName },
        'Failed to audit-log outbound AI HTTP request',
      );
    }
  }
}

function parseUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new ToolExecutionError('Invalid URL', 'invalid_url');
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * True if `ip` falls in any range that must never be reachable from a
 * model-driven outbound request: loopback, link-local (including the
 * 169.254.169.254 cloud metadata address), RFC1918 private ranges,
 * carrier-grade NAT (100.64.0.0/10), unique-local IPv6, and 0.0.0.0/8.
 */
export function isBlockedIp(ip: string): boolean {
  if (isIPv4(ip)) {
    const octets = ip.split('.').map(Number);
    const [a, b] = octets;

    if (a === 127) return true; // loopback
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT

    return false;
  }

  if (isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true; // loopback
    if (normalized === '::') return true; // unspecified
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique-local (fc00::/7)
    if (normalized.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — recheck the embedded IPv4 address.
      const mapped = normalized.replace('::ffff:', '');
      if (isIPv4(mapped)) {
        return isBlockedIp(mapped);
      }
    }
    return false;
  }

  return true; // unparseable address — fail closed
}
