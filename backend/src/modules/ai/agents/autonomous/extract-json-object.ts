/**
 * Defensively extracts the first top-level JSON object from model output
 * that is expected to be JSON but may arrive wrapped in markdown code
 * fences or surrounding prose despite instructions. Returns null rather
 * than throwing so callers can fall back gracefully instead of crashing an
 * autonomous run over a formatting slip.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const withoutFences = stripCodeFences(text);
  const objectText = findFirstBalancedObject(withoutFences);

  if (!objectText) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(objectText);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stripCodeFences(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(text);
  return fenced ? fenced[1] : text;
}

function findFirstBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}
