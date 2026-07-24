import { BadRequestException, Injectable } from '@nestjs/common';
import { ExtractTextInput, TextExtractor } from './text-extractor.interface';

/**
 * Normalizes CSV into retrieval-friendly text: each data row is rendered as
 * "header: value" pairs on one line, so a chunk keeps the column context a
 * bare comma-separated row would lose. Falls back to raw rows when the file
 * has no usable header. Parsing handles quoted fields, escaped quotes (""),
 * and embedded newlines/commas — no external dependency.
 */
@Injectable()
export class CsvTextExtractor implements TextExtractor {
  readonly supportedContentTypes = ['csv'];

  // eslint-disable-next-line @typescript-eslint/require-await -- async to satisfy the TextExtractor contract; parsing itself is synchronous.
  async extract(input: ExtractTextInput): Promise<string> {
    const raw = this.readRaw(input);
    const rows = parseCsv(raw);
    if (rows.length === 0) {
      return '';
    }

    const [header, ...dataRows] = rows;
    const headerIsUsable = header.some((cell) => cell.trim().length > 0);

    if (!headerIsUsable || dataRows.length === 0) {
      // No header (or a single row): emit the rows as-is, space-joined.
      return rows.map((row) => row.map((cell) => cell.trim()).join(' ')).join('\n');
    }

    return dataRows
      .map((row) =>
        header
          .map((column, index) => {
            const value = (row[index] ?? '').trim();
            return value.length > 0 ? `${column.trim()}: ${value}` : null;
          })
          .filter((pair): pair is string => pair !== null)
          .join(', '),
      )
      .filter((line) => line.length > 0)
      .join('\n');
  }

  private readRaw(input: ExtractTextInput): string {
    if (typeof input.text === 'string') {
      return input.text;
    }
    if (input.buffer) {
      return input.buffer.toString('utf-8');
    }
    throw new BadRequestException('CSV extraction requires text or a buffer');
  }
}

/**
 * Minimal RFC-4180-style CSV parser: comma-delimited, double-quote-quoted
 * fields with "" escaping, tolerant of both \n and \r\n line endings.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else if (char === '\r') {
      // Swallow — the paired \n (or EOF) closes the row.
    } else {
      field += char;
    }
  }

  // Flush the trailing field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows (e.g. a trailing blank line).
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}
