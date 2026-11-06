import { describe, it, expect } from 'vitest';
import { parseAsciicast } from '../../src/core/parser';

describe('Asciicast v2 Parser', () => {
  describe('Header Parsing', () => {
    it('parses a basic asciicast v2 header', () => {
      const cast = '{"version": 2, "width": 80, "height": 24}\n';
      const result = parseAsciicast(cast);

      expect(result.header).toEqual({
        version: 2,
        width: 80,
        height: 24,
      });
      expect(result.events).toEqual([]);
      expect(result.duration).toBe(0);
    });

    it('parses header with optional metadata: title, timestamp, and theme', () => {
      const headerObj = {
        version: 2,
        width: 120,
        height: 36,
        timestamp: 1700000000,
        title: 'Demo Session',
        theme: {
          fg: '#ffffff',
          bg: '#1a1b26',
          palette: '#000000:#ff5555:#50fa7b:#f1fa8c:#bd93f9:#ff79c6:#8be9fd:#bfbfbf',
        },
      };
      const cast = `${JSON.stringify(headerObj)}\n`;
      const result = parseAsciicast(cast);

      expect(result.header.version).toBe(2);
      expect(result.header.width).toBe(120);
      expect(result.header.height).toBe(36);
      expect(result.header.title).toBe('Demo Session');
      expect(result.header.timestamp).toBe(1700000000);
      expect(result.header.theme).toEqual(headerObj.theme);
    });

    it('throws an error if input is empty or has no valid header', () => {
      expect(() => parseAsciicast('')).toThrow(/header/i);
      expect(() => parseAsciicast('   \n\n  \t  ')).toThrow(/header/i);
      expect(() => parseAsciicast('not a json header\n')).toThrow(/header/i);
      expect(() => parseAsciicast('{"width": 80}\n')).toThrow(/header/i);
    });

    it('handles leading whitespace and blank lines before header', () => {
      const cast = '\n\n  {"version": 2, "width": 80, "height": 24}  \n';
      const result = parseAsciicast(cast);
      expect(result.header.version).toBe(2);
      expect(result.header.width).toBe(80);
      expect(result.header.height).toBe(24);
    });
  });

  describe('Event Parsing', () => {
    it('parses output ("o"), input ("i"), and resize ("r") events', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '[0.123, "o", "Hello world!\\r\\n"]',
        '[1.045, "i", "ls\\r"]',
        '[2.500, "r", "100x30"]',
      ].join('\n');

      const result = parseAsciicast(cast);

      expect(result.events).toHaveLength(3);
      expect(result.events[0]).toEqual({
        time: 0.123,
        type: 'o',
        data: 'Hello world!\r\n',
      });
      expect(result.events[1]).toEqual({
        time: 1.045,
        type: 'i',
        data: 'ls\r',
      });
      expect(result.events[2]).toEqual({
        time: 2.5,
        type: 'r',
        data: '100x30',
      });
    });

    it('handles carriage returns in line breaks (CRLF Windows style)', () => {
      const cast = '{"version": 2, "width": 80, "height": 24}\r\n[0.5, "o", "test"]\r\n[1.2, "o", "done"]\r\n';
      const result = parseAsciicast(cast);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].data).toBe('test');
      expect(result.events[1].data).toBe('done');
      expect(result.duration).toBe(1.2);
    });
  });

  describe('Duration Computation', () => {
    it('computes total duration based on the last event timestamp', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '[0.5, "o", "first"]',
        '[2.345, "o", "second"]',
        '[5.82, "o", "last"]',
      ].join('\n');

      const result = parseAsciicast(cast);
      expect(result.duration).toBe(5.82);
    });

    it('returns duration 0 when recording has 0 events', () => {
      const cast = '{"version": 2, "width": 80, "height": 24}\n';
      const result = parseAsciicast(cast);
      expect(result.events).toEqual([]);
      expect(result.duration).toBe(0);
    });
  });

  describe('Resilience and Malformed Lines', () => {
    it('skips empty lines and whitespace lines cleanly', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '',
        '   ',
        '[0.5, "o", "line 1"]',
        '',
        '  \t  ',
        '[1.0, "o", "line 2"]',
        '',
      ].join('\n');

      const result = parseAsciicast(cast);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].data).toBe('line 1');
      expect(result.events[1].data).toBe('line 2');
    });

    it('skips invalid non-JSON lines and malformed event arrays without crashing', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '# This is a comment or invalid line',
        'corrupted json {[[',
        '[0.5, "o", "valid event 1"]',
        '{"not": "an event array"}',
        '[1.0]', // too short
        '["not-a-number", "o", "invalid time"]',
        '[2.0, "unknown_type", "data"]', // invalid type
        '[3.0, "o", "valid event 2"]',
        'another junk line',
      ].join('\n');

      const result = parseAsciicast(cast);
      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toEqual({
        time: 0.5,
        type: 'o',
        data: 'valid event 1',
      });
      expect(result.events[1]).toEqual({
        time: 3.0,
        type: 'o',
        data: 'valid event 2',
      });
      expect(result.duration).toBe(3.0);
    });
  });

  describe('Edge Cases', () => {
    it('sorts out-of-order event timestamps monotonically', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '[3.0, "o", "third"]',
        '[0.5, "o", "first"]',
        '[1.8, "o", "second"]',
      ].join('\n');

      const result = parseAsciicast(cast);
      expect(result.events.map((e) => e.time)).toEqual([0.5, 1.8, 3.0]);
      expect(result.events.map((e) => e.data)).toEqual(['first', 'second', 'third']);
      expect(result.duration).toBe(3.0);
    });

    it('handles events starting at time 0.0', () => {
      const cast = [
        '{"version": 2, "width": 80, "height": 24}',
        '[0.0, "o", "start immediately"]',
        '[1.5, "o", "later"]',
      ].join('\n');

      const result = parseAsciicast(cast);
      expect(result.events[0].time).toBe(0.0);
      expect(result.duration).toBe(1.5);
    });
  });
});
