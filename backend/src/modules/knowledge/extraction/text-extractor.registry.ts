import { BadRequestException, Injectable } from '@nestjs/common';
import { DocxTextExtractor } from './docx-text-extractor';
import { PdfTextExtractor } from './pdf-text-extractor';
import { PlainTextExtractor } from './plain-text-extractor';
import { PptxTextExtractor } from './pptx-text-extractor';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';
import { XlsxTextExtractor } from './xlsx-text-extractor';

@Injectable()
export class TextExtractorRegistry {
  private readonly extractors: TextExtractor[];

  constructor(
    pdfTextExtractor: PdfTextExtractor,
    docxTextExtractor: DocxTextExtractor,
    xlsxTextExtractor: XlsxTextExtractor,
    pptxTextExtractor: PptxTextExtractor,
    plainTextExtractor: PlainTextExtractor,
  ) {
    this.extractors = [
      pdfTextExtractor,
      docxTextExtractor,
      xlsxTextExtractor,
      pptxTextExtractor,
      plainTextExtractor,
    ];
  }

  async extract(input: ExtractTextInput): Promise<string> {
    const extractor = this.extractors.find((candidate) =>
      candidate.supportedContentTypes.includes(input.contentType),
    );

    if (!extractor) {
      throw new BadRequestException(`Unsupported knowledge content type: "${input.contentType}"`);
    }

    return extractor.extract(input);
  }

  listSupportedContentTypes(): string[] {
    return this.extractors.flatMap((extractor) => extractor.supportedContentTypes);
  }
}
