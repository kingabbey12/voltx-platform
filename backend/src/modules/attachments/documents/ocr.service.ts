import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

/**
 * Image-to-text OCR (tesseract.js — pure JS, no cloud OCR dependency, no
 * native binary) backing the "OCR" workflow/AI action. Distinct from the
 * existing pdf/docx/pptx/xlsx TextExtractorRegistry, which reads text
 * that's already embedded in a document; this reads text that only exists
 * as pixels.
 *
 * Operational note: tesseract.js downloads its language traineddata (a
 * multi-MB file) on first use per language and caches it — the first OCR
 * call in a freshly-deployed environment needs network access to
 * tesseract.js's CDN (or a pre-provisioned local langPath) the same way
 * any lazy-loaded model weights would. This is a known, documented
 * limitation rather than a silent one — see the v2.0 remediation report.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      return text.trim();
    } catch (error) {
      this.logger.error({ err: error }, 'OCR extraction failed');
      throw new Error('OCR extraction failed — the image may be unreadable or corrupted');
    } finally {
      await worker.terminate();
    }
  }
}
