import { AsciicastEvent, AsciicastEventType, AsciicastHeader, AsciicastRecording } from './types';

/**
 * Parses an asciicast v2 formatted string into a structured AsciicastRecording.
 *
 * Asciicast v2 files are newline-delimited JSON (JSONL).
 * Line 1 (first non-empty line) is a JSON object with header metadata.
 * Subsequent lines are JSON arrays representing events: [time, type, data].
 *
 * @param content The raw string content of a .cast recording.
 * @returns Parsed AsciicastRecording with validated header, sorted events, and calculated duration.
 * @throws Error if the header is missing, malformed, or lacks required metadata (version, width, height).
 */
export function parseAsciicast(content: string): AsciicastRecording {
  if (!content || !content.trim()) {
    throw new Error('Invalid asciicast recording: empty content or missing header');
  }

  // Normalize all line break variants (\r\n, \r, \n)
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let header: AsciicastHeader | null = null;
  const events: AsciicastEvent[] = [];
  let headerIndex = -1;

  // Find and parse the first non-empty line as the header
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid asciicast recording: header is not valid JSON: "${trimmed}"`);
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Invalid asciicast recording: header must be a JSON object');
    }

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.version !== 'number' ||
      typeof candidate.width !== 'number' ||
      typeof candidate.height !== 'number'
    ) {
      throw new Error(
        'Invalid asciicast recording: header must include numeric version, width, and height'
      );
    }

    header = candidate as AsciicastHeader;
    headerIndex = i;
    break;
  }

  if (!header) {
    throw new Error('Invalid asciicast recording: empty or missing header');
  }

  // Parse remaining lines as events
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Non-JSON lines or comments are skipped gracefully
      continue;
    }

    if (!Array.isArray(parsed) || parsed.length < 3) {
      continue;
    }

    const [time, type, data] = parsed;

    if (typeof time !== 'number' || !Number.isFinite(time)) {
      continue;
    }

    if (type !== 'o' && type !== 'i' && type !== 'r') {
      continue;
    }

    if (typeof data !== 'string') {
      continue;
    }

    events.push({
      time,
      type: type as AsciicastEventType,
      data,
    });
  }

  // Sort events monotonically by timestamp
  events.sort((a, b) => a.time - b.time);

  // Compute duration based on the last event timestamp, or 0 if no events
  const duration = events.length > 0 ? events[events.length - 1].time : 0;

  return {
    header,
    events,
    duration,
  };
}
