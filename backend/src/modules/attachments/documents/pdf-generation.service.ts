import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PdfSection {
  heading?: string;
  body: string;
}

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const TITLE_SIZE = 20;
const HEADING_SIZE = 14;
const BODY_SIZE = 11;
const LINE_HEIGHT = 16;

/**
 * Minimal, dependency-light PDF generator (pdf-lib — no headless browser,
 * no HTML rendering) backing the "Generate PDF" and "Generate contract"
 * workflow/AI actions. Renders a title + a list of heading/body sections,
 * wrapping body text to the page width and paginating automatically.
 * `generateContract` is the same renderer with a template-merge step in
 * front of it, not a separate document subsystem.
 */
@Injectable()
export class PdfGenerationService {
  async generatePdf(title: string, sections: PdfSection[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - PAGE_MARGIN;

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < PAGE_MARGIN) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - PAGE_MARGIN;
      }
    };

    ensureSpace(TITLE_SIZE);
    page.drawText(title, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: TITLE_SIZE,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursorY -= TITLE_SIZE + LINE_HEIGHT;

    for (const section of sections) {
      if (section.heading) {
        ensureSpace(HEADING_SIZE + LINE_HEIGHT);
        page.drawText(section.heading, {
          x: PAGE_MARGIN,
          y: cursorY,
          size: HEADING_SIZE,
          font: boldFont,
          color: rgb(0.15, 0.15, 0.15),
        });
        cursorY -= HEADING_SIZE + LINE_HEIGHT * 0.5;
      }

      const maxWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
      for (const line of wrapText(section.body, font, BODY_SIZE, maxWidth)) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, {
          x: PAGE_MARGIN,
          y: cursorY,
          size: BODY_SIZE,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        cursorY -= LINE_HEIGHT;
      }
      cursorY -= LINE_HEIGHT * 0.5;
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  /**
   * `{{key}}` interpolation over a stored template string, then rendered
   * through the same generatePdf() path — a contract is just a PDF whose
   * body came from a template preset, not a parallel document engine.
   */
  async generateContract(
    contractTitle: string,
    templateBody: string,
    variables: Record<string, string>,
  ): Promise<Buffer> {
    const merged = templateBody.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
    );
    return this.generatePdf(contractTitle, [{ body: merged }]);
  }
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize(t: string, size: number): number },
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim().length === 0) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
