export interface ExtractTextInput {
  contentType: string;
  buffer?: Buffer;
  text?: string;
}

/**
 * Converts one raw input (a file buffer or already-extracted text) into
 * plain text ready for chunking. One implementation per content type,
 * selected by TextExtractorRegistry — this is the seam that lets new file
 * formats be added without touching chunking/embedding/retrieval.
 */
export interface TextExtractor {
  readonly supportedContentTypes: string[];
  extract(input: ExtractTextInput): Promise<string>;
}
