import { BadRequestException, Injectable } from '@nestjs/common';
import { OfficeParser } from 'officeparser';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

@Injectable()
export class PptxTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['pptx'];

  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('PPTX extraction requires a file buffer');
    }

    const ast = await OfficeParser.parseOffice(input.buffer, { fileType: 'pptx' });
    const { value } = await ast.to('text');
    return value;
  }
}
