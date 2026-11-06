import { describe, it, expect } from 'vitest';
import { exportToAnimatedSvg } from '../../src/core/svg-exporter';
import { AsciicastRecording } from '../../src/core/types';

describe('Headless Animated SVG Exporter', () => {
  const createMockRecording = (
    overrides?: Partial<AsciicastRecording>
  ): AsciicastRecording => ({
    header: {
      version: 2,
      width: 80,
      height: 24,
      title: 'Test Session',
    },
    events: [
      { time: 0.0, type: 'o', data: 'echo "Hello World"\r\n' },
      { time: 1.0, type: 'o', data: 'Hello World\r\n' },
      { time: 2.0, type: 'o', data: '$ ' },
    ],
    duration: 3.0,
    ...overrides,
  });

  describe('Root SVG Structure & Dimensions', () => {
    it('generates valid SVG XML string with xmlns, viewBox, width, and height', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording);

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(svg).toMatch(/width="\d+"/);
      expect(svg).toMatch(/height="\d+"/);
    });

    it('calculates width and height proportionally from cols, rows, and font size', () => {
      const recSmall = createMockRecording({
        header: { version: 2, width: 40, height: 10 },
        duration: 1.0,
        events: [{ time: 0, type: 'o', data: 'hi' }],
      });
      const recLarge = createMockRecording({
        header: { version: 2, width: 80, height: 24 },
        duration: 1.0,
        events: [{ time: 0, type: 'o', data: 'hi' }],
      });

      const svgSmall = exportToAnimatedSvg(recSmall, { fontSize: 14 });
      const svgLarge = exportToAnimatedSvg(recLarge, { fontSize: 14 });

      const getDims = (str: string) => {
        const wMatch = str.match(/width="(\d+)"/);
        const hMatch = str.match(/height="(\d+)"/);
        return {
          w: parseInt(wMatch![1], 10),
          h: parseInt(hMatch![1], 10),
        };
      };

      const dimSmall = getDims(svgSmall);
      const dimLarge = getDims(svgLarge);

      expect(dimLarge.w).toBeGreaterThan(dimSmall.w);
      expect(dimLarge.h).toBeGreaterThan(dimSmall.h);
    });

    it('scales dimensions when custom fontSize is provided', () => {
      const recording = createMockRecording();
      const svg14 = exportToAnimatedSvg(recording, { fontSize: 14 });
      const svg20 = exportToAnimatedSvg(recording, { fontSize: 20 });

      const w14 = parseInt(svg14.match(/width="(\d+)"/)![1], 10);
      const w20 = parseInt(svg20.match(/width="(\d+)"/)![1], 10);

      expect(w20).toBeGreaterThan(w14);
    });
  });

  describe('Window Chrome & Header', () => {
    it('renders window chrome with traffic light dots by default', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording);

      // Red, yellow, green macOS-style dots
      expect(svg).toContain('#ff5f56'); // red
      expect(svg).toContain('#ffbd2e'); // yellow
      expect(svg).toContain('#27c93f'); // green
    });

    it('displays the title in the window header', () => {
      const recording = createMockRecording({
        header: { version: 2, width: 80, height: 24, title: 'My Terminal Session' },
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('My Terminal Session');
    });

    it('prefers options.title over recording.header.title', () => {
      const recording = createMockRecording({
        header: { version: 2, width: 80, height: 24, title: 'Header Title' },
      });
      const svg = exportToAnimatedSvg(recording, { title: 'Overridden Title' });

      expect(svg).toContain('Overridden Title');
      expect(svg).not.toContain('Header Title');
    });

    it('escapes XML special characters in title', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording, {
        title: '<Termi & "Record" \'Test\'>',
      });

      expect(svg).toContain('&lt;Termi &amp; &quot;Record&quot; &apos;Test&apos;&gt;');
    });

    it('omits window chrome and traffic lights when windowChrome is false', () => {
      const recording = createMockRecording();
      const svgWithChrome = exportToAnimatedSvg(recording, { windowChrome: true });
      const svgNoChrome = exportToAnimatedSvg(recording, { windowChrome: false });

      expect(svgWithChrome).toContain('#ff5f56');
      expect(svgNoChrome).not.toContain('#ff5f56');
      expect(svgNoChrome).not.toContain('#ffbd2e');
      expect(svgNoChrome).not.toContain('#27c93f');

      const hWith = parseInt(svgWithChrome.match(/height="(\d+)"/)![1], 10);
      const hNo = parseInt(svgNoChrome.match(/height="(\d+)"/)![1], 10);
      expect(hWith).toBeGreaterThan(hNo);
    });
  });

  describe('Themes & Typography', () => {
    it('applies dark theme by default', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording);

      // Dark background default
      expect(svg).toMatch(/#1e1e2e|#181825/);
    });

    it('applies light theme when requested', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording, { theme: 'light' });

      // Light background
      expect(svg).toMatch(/#eff1f5|#e6e9ef/);
    });

    it('applies tokyo-night theme when requested', () => {
      const recording = createMockRecording();
      const svg = exportToAnimatedSvg(recording, { theme: 'tokyo-night' });

      // Tokyo Night background and accents
      expect(svg).toMatch(/#1a1b26|#16161e/);
    });

    it('embeds monospace font family and configurable font family', () => {
      const recording = createMockRecording();
      const svgDefault = exportToAnimatedSvg(recording);
      expect(svgDefault).toContain('monospace');

      const svgCustom = exportToAnimatedSvg(recording, {
        fontFamily: '"Fira Code", monospace',
      });
      expect(svgCustom).toContain('"Fira Code", monospace');
    });
  });

  describe('Timeline Sampling & Frame Groups', () => {
    it('creates frame groups with id="frame-i"', () => {
      const recording = createMockRecording({
        duration: 3.0,
        events: [
          { time: 0.0, type: 'o', data: 'step 1' },
          { time: 1.0, type: 'o', data: ' -> step 2' },
          { time: 2.0, type: 'o', data: ' -> step 3' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('id="frame-0"');
      expect(svg).toContain('id="frame-1"');
      expect(svg).toContain('id="frame-2"');
    });

    it('ignores stdin ("i") events and only creates frames from output changes', () => {
      const recording = createMockRecording({
        duration: 2.0,
        events: [
          { time: 0.0, type: 'o', data: 'hello' },
          { time: 0.5, type: 'i', data: 'user keypress' },
          { time: 1.0, type: 'o', data: ' world' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('id="frame-0"');
      expect(svg).toContain('id="frame-1"');
      expect(svg).not.toContain('id="frame-2"');
    });

    it('handles resize ("r") events during playback', () => {
      const recording = createMockRecording({
        duration: 2.0,
        events: [
          { time: 0.0, type: 'o', data: 'hello' },
          { time: 1.0, type: 'r', data: '100x30' },
          { time: 1.5, type: 'o', data: ' resized' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('id="frame-0"');
      expect(svg).toContain('id="frame-1"');
    });

    it('merges consecutive events with identical visual output into single frame duration', () => {
      const recording = createMockRecording({
        duration: 3.0,
        events: [
          { time: 0.0, type: 'o', data: 'hello' },
          { time: 1.0, type: 'o', data: '' }, // empty output, no visual change
          { time: 2.0, type: 'o', data: ' world' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('id="frame-0"');
      expect(svg).toContain('id="frame-1"');
      expect(svg).not.toContain('id="frame-2"');
    });
  });

  describe('CSS Keyframes Animation Generation', () => {
    it('generates @keyframes rules controlling frame step visibility', () => {
      const recording = createMockRecording({
        duration: 4.0,
        events: [
          { time: 0.0, type: 'o', data: 'A' },
          { time: 1.0, type: 'o', data: 'B' },
          { time: 2.0, type: 'o', data: 'C' },
          { time: 3.0, type: 'o', data: 'D' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('@keyframes');
      // Frame 0 active in first slice [0%, 25%]
      expect(svg).toMatch(/@keyframes\s+frame-anim-0/);
      expect(svg).toMatch(/opacity:\s*1/);
      expect(svg).toMatch(/display:\s*inline/);
      expect(svg).toMatch(/opacity:\s*0/);
      expect(svg).toMatch(/display:\s*none/);
    });

    it('binds frame elements to keyframe animations with total duration', () => {
      const recording = createMockRecording({
        duration: 3.0,
        events: [
          { time: 0.0, type: 'o', data: 'one' },
          { time: 1.5, type: 'o', data: 'two' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toMatch(/#frame-0\s*\{[^}]*animation:[^}]*3(\.0+)?s/);
      expect(svg).toMatch(/#frame-1\s*\{[^}]*animation:[^}]*3(\.0+)?s/);
    });

    it('respects loop: true (infinite) and loop: false (1 forwards)', () => {
      const recording = createMockRecording({
        duration: 2.0,
        events: [
          { time: 0.0, type: 'o', data: 'a' },
          { time: 1.0, type: 'o', data: 'b' },
        ],
      });

      const svgLoop = exportToAnimatedSvg(recording, { loop: true });
      expect(svgLoop).toContain('infinite');

      const svgNoLoop = exportToAnimatedSvg(recording, { loop: false });
      expect(svgNoLoop).not.toContain('infinite');
      expect(svgNoLoop).toMatch(/forwards/);
    });
  });

  describe('Text Rendering & ANSI Styling', () => {
    it('renders monospace <text> and <tspan> elements', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [{ time: 0.0, type: 'o', data: 'echo test\r\n' }],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('<text');
      expect(svg).toContain('<tspan');
      expect(svg).toContain('echo test');
    });

    it('escapes XML special characters in terminal text (&, <, >, ", \')', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [{ time: 0.0, type: 'o', data: 'if (x < 10 && y > 20) { "quote" + \'single\' }' }],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('&lt;');
      expect(svg).toContain('&amp;&amp;');
      expect(svg).toContain('&gt;');
      expect(svg).toContain('&quot;quote&quot;');
      expect(svg).toContain('&apos;single&apos;');
      expect(svg).not.toContain('if (x < 10');
    });

    it('applies ANSI standard foreground colors to <tspan>', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [
          // Red text (\x1b[31m) then Green text (\x1b[32m) then reset (\x1b[0m)
          { time: 0.0, type: 'o', data: '\x1b[31mError\x1b[0m \x1b[32mSuccess\x1b[0m' },
        ],
      });
      const svg = exportToAnimatedSvg(recording, { theme: 'dark' });

      // Theme red #f38ba8 and green #a6e3a1 on dark theme
      expect(svg).toMatch(/<tspan[^>]*fill="#f38ba8"[^>]*>Error<\/tspan>/);
      expect(svg).toMatch(/<tspan[^>]*fill="#a6e3a1"[^>]*>Success<\/tspan>/);
    });

    it('applies ANSI text attributes (bold, italic, underline, dim)', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [
          {
            time: 0.0,
            type: 'o',
            data: '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m \x1b[4mUnder\x1b[0m \x1b[2mDim\x1b[0m',
          },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toMatch(/font-weight="bold"[^>]*>Bold<\/tspan>/);
      expect(svg).toMatch(/font-style="italic"[^>]*>Italic<\/tspan>/);
      expect(svg).toMatch(/text-decoration="underline"[^>]*>Under<\/tspan>/);
      expect(svg).toMatch(/opacity="0\.6"[^>]*>Dim<\/tspan>/);
    });

    it('renders cell background colors using background <rect> elements', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [
          // Red background (\x1b[41m)
          { time: 0.0, type: 'o', data: '\x1b[41mAlert\x1b[0m' },
        ],
      });
      const svg = exportToAnimatedSvg(recording, { theme: 'dark' });

      // Has a rect with red fill
      expect(svg).toMatch(/<rect[^>]*fill="#f38ba8"/);
      expect(svg).toContain('Alert');
    });

    it('handles ANSI 256-color and 24-bit truecolor RGB codes', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [
          // Truecolor fg rgb(123, 45, 67)
          { time: 0.0, type: 'o', data: '\x1b[38;2;123;45;67mTrueColor\x1b[0m' },
        ],
      });
      const svg = exportToAnimatedSvg(recording);

      expect(svg).toContain('rgb(123, 45, 67)');
      expect(svg).toContain('TrueColor');
    });

    it('handles ANSI inverse video (\x1b[7m) by swapping fg and bg', () => {
      const recording = createMockRecording({
        duration: 1.0,
        events: [
          // Inverse video with red fg: fg becomes bg, default bg becomes fg
          { time: 0.0, type: 'o', data: '\x1b[31;7mInverted\x1b[0m' },
        ],
      });
      const svg = exportToAnimatedSvg(recording, { theme: 'dark' });

      // Red is swapped to background rect
      expect(svg).toMatch(/<rect[^>]*fill="#f38ba8"/);
      expect(svg).toContain('Inverted');
    });
  });

  describe('Edge Cases & Robustness', () => {
    it('handles empty recording (0 duration, 0 events) without dividing by zero', () => {
      const emptyRecording: AsciicastRecording = {
        header: { version: 2, width: 80, height: 24 },
        events: [],
        duration: 0,
      };

      expect(() => exportToAnimatedSvg(emptyRecording)).not.toThrow();
      const svg = exportToAnimatedSvg(emptyRecording);

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('Infinity');
      expect(svg).toContain('id="frame-0"');
    });

    it('handles recording with single event and 0 duration', () => {
      const singleEventZeroDuration: AsciicastRecording = {
        header: { version: 2, width: 80, height: 24 },
        events: [{ time: 0, type: 'o', data: 'static test' }],
        duration: 0,
      };

      const svg = exportToAnimatedSvg(singleEventZeroDuration);

      expect(svg).not.toContain('NaN');
      expect(svg).toContain('static test');
      expect(svg).toContain('id="frame-0"');
      // Should not generate broken animation
      expect(svg).not.toContain('@keyframes');
    });

    it('handles recording with 1 event and positive duration as static frame', () => {
      const singleEvent: AsciicastRecording = {
        header: { version: 2, width: 80, height: 24 },
        events: [{ time: 0, type: 'o', data: 'only frame' }],
        duration: 5.0,
      };

      const svg = exportToAnimatedSvg(singleEvent);

      expect(svg).toContain('only frame');
      expect(svg).toContain('id="frame-0"');
      expect(svg).not.toContain('id="frame-1"');
      expect(svg).not.toContain('NaN');
    });

    it('handles recording with events starting after time 0', () => {
      const delayedStart: AsciicastRecording = {
        header: { version: 2, width: 80, height: 24 },
        events: [
          { time: 1.0, type: 'o', data: 'first output' },
          { time: 2.0, type: 'o', data: ' second output' },
        ],
        duration: 3.0,
      };

      const svg = exportToAnimatedSvg(delayedStart);

      // Frame 0: [0, 1.0] (initial blank)
      // Frame 1: [1.0, 2.0]
      // Frame 2: [2.0, 3.0]
      expect(svg).toContain('id="frame-0"');
      expect(svg).toContain('id="frame-1"');
      expect(svg).toContain('id="frame-2"');
      expect(svg).not.toContain('NaN');
    });

    it('handles extreme terminal sizes gracefully', () => {
      const tiny: AsciicastRecording = {
        header: { version: 2, width: 10, height: 2 },
        events: [{ time: 0, type: 'o', data: 'hi' }],
        duration: 1.0,
      };
      const large: AsciicastRecording = {
        header: { version: 2, width: 200, height: 60 },
        events: [{ time: 0, type: 'o', data: 'large screen' }],
        duration: 1.0,
      };

      const svgTiny = exportToAnimatedSvg(tiny);
      const svgLarge = exportToAnimatedSvg(large);

      expect(svgTiny).toContain('<svg');
      expect(svgLarge).toContain('<svg');
    });
  });
});
