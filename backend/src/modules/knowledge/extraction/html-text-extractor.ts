import { BadRequestException, Injectable } from '@nestjs/common';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

@Injectable()
export class HtmlTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['html'];

  // eslint-disable-next-line @typescript-eslint/require-await -- async is intentional: keeps throw behavior consistent with the TextExtractor promise contract.
  async extract(input: ExtractTextInput): Promise<string> {
    const html = input.text ?? input.buffer?.toString('utf-8');
    if (!html) {
      throw new BadRequestException('HTML extraction requires text or a buffer');
    }

    // Remove non-content blocks before stripping tags to keep noisy scripts/styles out.
    const withoutScripts = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    const plain = withoutScripts
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return decodeHtmlEntities(plain);
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
}
