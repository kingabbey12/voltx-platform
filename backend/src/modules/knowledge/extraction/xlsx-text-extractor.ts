import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

/** Quote a cell the way CSV consumers expect, so extracted text stays
 * faithful to what the spreadsheet actually contained. */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class XlsxTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['xlsx', 'csv'];

  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('XLSX extraction requires a file buffer');
    }

    // A CSV upload is already text — decode it directly rather than round-
    // tripping it through a spreadsheet parser.
    if (input.contentType === 'csv') {
      return input.buffer.toString('utf-8').trim();
    }

    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(input.buffer as unknown as ArrayBuffer);
    } catch {
      // Untrusted uploads: a corrupt or non-xlsx file is a caller error,
      // not a server fault — surface a 400, never a 500.
      throw new BadRequestException('Could not parse the uploaded file as an XLSX workbook');
    }

    const sheets = workbook.worksheets.map((worksheet) => {
      const rows: string[] = [];
      worksheet.eachRow((row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          cells.push(csvEscape(cell.text ?? ''));
        });
        rows.push(cells.join(','));
      });
      return `Sheet: ${worksheet.name}\n${rows.join('\n')}`;
    });

    return sheets.join('\n\n');
  }
}
