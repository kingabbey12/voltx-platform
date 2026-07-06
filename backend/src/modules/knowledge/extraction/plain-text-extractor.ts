import { BadRequestException, Injectable } from '@nestjs/common';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

/**
 * Handles content that is already plain text: markdown/text files, and
 * "structured" sources (CRM records, emails, calendar events, tasks,
 * meetings) where the upstream system provides already-extracted text
 * rather than a binary file to parse.
 */
@Injectable()
export class PlainTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['markdown', 'text', 'structured'];

  // eslint-disable-next-line @typescript-eslint/require-await -- async is intentional: keeps the throw below a promise rejection, matching the TextExtractor interface contract.
  async extract(input: ExtractTextInput): Promise<string> {
    if (typeof input.text === 'string') {
      return input.text;
    }
    if (input.buffer) {
      return input.buffer.toString('utf-8');
    }
    throw new BadRequestException('Plain text extraction requires text or a buffer');
  }
}
