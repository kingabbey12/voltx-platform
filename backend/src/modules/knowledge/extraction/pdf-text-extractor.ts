import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

@Injectable()
export class PdfTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['pdf'];

  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('PDF extraction requires a file buffer');
    }

    const parser = new PDFParse({ data: input.buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
}
