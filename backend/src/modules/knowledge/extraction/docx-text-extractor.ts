import { BadRequestException, Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

@Injectable()
export class DocxTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['docx'];

  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('DOCX extraction requires a file buffer');
    }

    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return result.value;
  }
}
