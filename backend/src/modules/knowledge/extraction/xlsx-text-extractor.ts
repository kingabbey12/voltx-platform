import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

/**
 * Spreadsheet → plain text for the knowledge pipeline.
 *
 * Backed by exceljs rather than `xlsx` (SheetJS). SheetJS's npm package is
 * abandoned at 0.18.5 and carries prototype-pollution and ReDoS advisories with
 * **no patched version published to npm** — the vendor moved distribution to
 * their own CDN. This extractor parses attacker-supplied uploads, so an
 * unpatchable parser on that path was not acceptable.
 *
 * Output shape is deliberately unchanged (`Sheet: <name>` followed by CSV rows)
 * so already-indexed documents chunk and embed identically after the swap.
 */
@Injectable()
export class XlsxTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['xlsx', 'csv'];

  async extract(input: ExtractTextInput): Promise<string> {
    if (!input.buffer) {
      throw new BadRequestException('XLSX extraction requires a file buffer');
    }

    // CSV is already the target format — decoding it beats round-tripping it
    // through a spreadsheet parser, and removes a parser from the upload path.
    if (input.contentType === 'csv') {
      return `Sheet: Sheet1\n${input.buffer.toString('utf8')}`;
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(input.buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('File is not a readable XLSX workbook');
    }

    const sheets: string[] = [];
    workbook.eachSheet((worksheet) => {
      const rows: string[] = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        // exceljs row.values is 1-based with a hole at index 0.
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map((cell) => toCsvField(cell)).join(','));
      });
      sheets.push(`Sheet: ${worksheet.name}\n${rows.join('\n')}`);
    });

    return sheets.join('\n\n');
  }
}

/** Flattens one exceljs cell to its text, then applies RFC-4180 quoting. */
function toCsvField(cell: unknown): string {
  const text = cellToText(cell);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  if (typeof cell === 'object') {
    // exceljs models formulas, hyperlinks, errors and rich text as objects
    // rather than scalars; take the displayed value in each case.
    const value = cell as {
      result?: unknown;
      text?: unknown;
      hyperlink?: unknown;
      error?: unknown;
      richText?: { text?: string }[];
    };
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('');
    }
    if (value.result !== undefined) {
      return cellToText(value.result);
    }
    if (value.text !== undefined) {
      return cellToText(value.text);
    }
    if (value.error !== undefined) {
      return scalarToText(value.error);
    }
    if (value.hyperlink !== undefined) {
      return scalarToText(value.hyperlink);
    }
    return '';
  }
  return scalarToText(cell);
}

/** Stringifies only genuine primitives — anything else would serialise to
 *  "[object Object]", which is worse than an empty cell for indexed text. */
function scalarToText(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      return '';
  }
}
