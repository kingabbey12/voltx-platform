/**
 * Split model output into prose paragraphs for the Today screen, stripping
 * any stray markdown produced despite instructions — the letter renders
 * plain typeset prose only.
 */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^[#>*-]+\s*/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\s*\n\s*/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);
}
