import { BadRequestException } from '@nestjs/common';

export interface ParsedScimFilter {
  attribute: string;
  value: string;
}

const FILTER_PATTERN = /^\s*([a-zA-Z0-9_.]+)\s+eq\s+"([^"]*)"\s*$/i;

/**
 * Minimal SCIM filter parser covering the one form every IdP actually sends
 * for provisioning lookups: `<attribute> eq "<value>"` (e.g. `userName eq
 * "jane@example.com"`). Anything else (and/or, co/sw/ew, group filters) is
 * explicitly rejected with a clear 400 rather than silently ignored or
 * best-effort guessed.
 */
export function parseScimEqFilter(filter: string | undefined): ParsedScimFilter | undefined {
  if (!filter) {
    return undefined;
  }
  const match = FILTER_PATTERN.exec(filter);
  if (!match) {
    throw new BadRequestException(
      `Unsupported SCIM filter — only "<attribute> eq \\"<value>\\"" is supported: ${filter}`,
    );
  }
  return { attribute: match[1].toLowerCase(), value: match[2] };
}
