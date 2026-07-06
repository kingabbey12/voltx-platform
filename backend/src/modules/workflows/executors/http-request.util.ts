import { BadRequestException } from '@nestjs/common';

/** Validates and normalizes a step-configured URL — HTTP(S) only, same restriction as the http_get/http_post tools. */
export function normalizeStepUrl(rawUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Invalid URL: "${rawUrl}"`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new BadRequestException(`Only HTTP and HTTPS URLs are allowed: "${rawUrl}"`);
  }

  return parsedUrl.toString();
}

export async function parseHttpResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text };
    }
  }

  return { raw: text };
}
