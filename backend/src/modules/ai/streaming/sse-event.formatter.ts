export function formatSseEvent(event: string, data: unknown, id?: number): string {
  const idLine = id !== undefined ? `id: ${id}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
