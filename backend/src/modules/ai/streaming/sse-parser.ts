export interface ParsedSseEvent {
  event?: string;
  data: string;
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<ParsedSseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separatorMatch = findEventSeparator(buffer);
    while (separatorMatch) {
      const rawEvent = buffer.slice(0, separatorMatch.index);
      buffer = buffer.slice(separatorMatch.nextIndex);

      const parsedEvent = parseSseEvent(rawEvent);
      if (parsedEvent) {
        yield parsedEvent;
      }

      separatorMatch = findEventSeparator(buffer);
    }
  }

  const remainingEvent = parseSseEvent(buffer);
  if (remainingEvent) {
    yield remainingEvent;
  }
}

function findEventSeparator(buffer: string): { index: number; nextIndex: number } | null {
  const match = /\r?\n\r?\n/u.exec(buffer);
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    index: match.index,
    nextIndex: match.index + match[0].length,
  };
}

function parseSseEvent(rawEvent: string): ParsedSseEvent | null {
  const normalized = rawEvent.trim();
  if (normalized.length === 0) {
    return null;
  }

  const dataLines: string[] = [];
  let eventName: string | undefined;

  for (const line of normalized.split(/\r?\n/u)) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event: eventName,
    data: dataLines.join('\n'),
  };
}
