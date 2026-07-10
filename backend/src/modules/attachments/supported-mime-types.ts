/**
 * Every MIME type the attachment system accepts, and — for non-image
 * types — which TextExtractorRegistry contentType key extracts it (see
 * knowledge/extraction/text-extractor.registry.ts, reused here rather
 * than duplicated). Images are handled separately by
 * ImageProcessingService/vision, not text extraction.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
] as const;

export const DOCUMENT_MIME_TYPE_TO_EXTRACTOR_CONTENT_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'application/json': 'json',
};

export const SUPPORTED_MIME_TYPES: readonly string[] = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...Object.keys(DOCUMENT_MIME_TYPE_TO_EXTRACTOR_CONTENT_TYPE),
];

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

export function isImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}
