import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

@Injectable()
export class XlsxTextExtractor implements TextExtractor {
  // 'csv' is handled by the dedicated CsvTextExtractor (which also accepts
  // already-extracted text, not just a workbook buffer) — this extractor owns
  // the binary spreadsheet format only.
  readonly supportedContentTypes = ['xlsx'];

  // eslint-disable-next-line @typescript-eslint/require-await -- async is intentional: keeps the throw below a promise rejection, matching the TextExtractor interface contract.
  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('XLSX extraction requires a file buffer');
    }

    const workbook = XLSX.read(input.buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return `Sheet: ${name}\n${csv}`;
    });

    return sheets.join('\n\n');
  }
}
