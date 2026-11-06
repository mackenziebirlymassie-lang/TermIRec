import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalBuffer } from '../../src/core/terminal-buffer';
import type { CellStyle, TerminalCell } from '../../src/core/terminal-buffer';

describe('TerminalBuffer', () => {
  let buffer: TerminalBuffer;

  beforeEach(() => {
    buffer = new TerminalBuffer(80, 24);
  });

  describe('Initialization', () => {
    it('initializes with specified cols and rows', () => {
      expect(buffer.cols).toBe(80);
      expect(buffer.rows).toBe(24);
      expect(buffer.cursorX).toBe(0);
      expect(buffer.cursorY).toBe(0);
      expect(buffer.grid.length).toBe(24);
      expect(buffer.grid[0].length).toBe(80);
    });

    it('initializes all cells with empty space and default style', () => {
      const cell = buffer.grid[0][0];
      expect(cell.char).toBe(' ');
      expect(cell.style).toEqual({});
    });

    it('creates buffer from AsciicastHeader via fromHeader()', () => {
      const bufFromHeader = TerminalBuffer.fromHeader({
        version: 2,
        width: 120,
        height: 36,
      });
      expect(bufFromHeader.cols).toBe(120);
      expect(bufFromHeader.rows).toBe(36);
    });

    it('returns empty lines from getLines() initially', () => {
      const lines = buffer.getLines();
      expect(lines.length).toBe(24);
      expect(lines.every((l) => l === '')).toBe(true);
    });
  });

  describe('Plain Text Output and Cursor Advancement', () => {
    it('writes plain text and advances cursorX', () => {
      buffer.write('Hello, World!');
      expect(buffer.cursorX).toBe(13);
      expect(buffer.cursorY).toBe(0);
      expect(buffer.getLines()[0]).toBe('Hello, World!');
    });

    it('stores individual characters in grid cells', () => {
      buffer.write('Hi');
      expect(buffer.grid[0][0].char).toBe('H');
      expect(buffer.grid[0][1].char).toBe('i');
      expect(buffer.grid[0][2].char).toBe(' ');
    });

    it('automatically wraps text to next line when exceeding cols', () => {
      const smallBuf = new TerminalBuffer(5, 3);
      smallBuf.write('ABCDEFGH');
      expect(smallBuf.getLines()[0]).toBe('ABCDE');
      expect(smallBuf.getLines()[1]).toBe('FGH');
      expect(smallBuf.cursorX).toBe(3);
      expect(smallBuf.cursorY).toBe(1);
    });
  });

  describe('CRLF, CR, and LF Behavior', () => {
    it('returns cursor to column 0 on carriage return (\\r)', () => {
      buffer.write('Loading...');
      expect(buffer.cursorX).toBe(10);
      buffer.write('\rDone');
      expect(buffer.cursorX).toBe(4);
      expect(buffer.cursorY).toBe(0);
      // 'Done' overwrites the first 4 chars of 'Loading...'
      expect(buffer.getLines()[0]).toBe('Doneing...');
    });

    it('advances cursor to next line on line feed (\\n)', () => {
      buffer.write('Hello');
      buffer.write('\n');
      expect(buffer.cursorY).toBe(1);
      expect(buffer.cursorX).toBe(5);
    });

    it('handles standard CRLF (\\r\\n) properly', () => {
      buffer.write('First line\r\nSecond line\r\nThird line');
      const lines = buffer.getLines();
      expect(lines[0]).toBe('First line');
      expect(lines[1]).toBe('Second line');
      expect(lines[2]).toBe('Third line');
      expect(buffer.cursorX).toBe(10);
      expect(buffer.cursorY).toBe(2);
    });
  });

  describe('Backspace Behavior', () => {
    it('moves cursor left on backspace (\\b)', () => {
      buffer.write('abc\b');
      expect(buffer.cursorX).toBe(2);
      buffer.write('Z');
      expect(buffer.getLines()[0]).toBe('abZ');
    });

    it('does not move cursor past column 0 on backspace', () => {
      buffer.write('\b\b\b');
      expect(buffer.cursorX).toBe(0);
    });
  });

  describe('Scrolling Behavior', () => {
    it('scrolls buffer lines up when writing past the bottom row', () => {
      const miniBuf = new TerminalBuffer(10, 3);
      miniBuf.write('Line 1\r\n');
      miniBuf.write('Line 2\r\n');
      miniBuf.write('Line 3\r\n');
      miniBuf.write('Line 4');

      const lines = miniBuf.getLines();
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('Line 2');
      expect(lines[1]).toBe('Line 3');
      expect(lines[2]).toBe('Line 4');
      expect(miniBuf.cursorY).toBe(2);
    });

    it('scrolls multiple times when large output is fed', () => {
      const miniBuf = new TerminalBuffer(10, 3);
      for (let i = 1; i <= 10; i++) {
        miniBuf.write(`Row ${i}\r\n`);
      }
      miniBuf.write('Final');
      const lines = miniBuf.getLines();
      expect(lines[0]).toBe('Row 9');
      expect(lines[1]).toBe('Row 10');
      expect(lines[2]).toBe('Final');
    });
  });

  describe('ANSI SGR Styling', () => {
    it('applies standard foreground colors (30-37)', () => {
      buffer.write('\x1b[31mRed\x1b[32mGreen\x1b[34mBlue');
      expect(buffer.grid[0][0].char).toBe('R');
      expect(buffer.grid[0][0].style.fg).toBe('red');
      expect(buffer.grid[0][3].char).toBe('G');
      expect(buffer.grid[0][3].style.fg).toBe('green');
      expect(buffer.grid[0][8].char).toBe('B');
      expect(buffer.grid[0][8].style.fg).toBe('blue');
    });

    it('applies bright foreground colors (90-97)', () => {
      buffer.write('\x1b[90mGray\x1b[91mBrightRed');
      expect(buffer.grid[0][0].style.fg).toBe('brightBlack');
      expect(buffer.grid[0][4].style.fg).toBe('brightRed');
    });

    it('applies background colors (40-47, 100-107)', () => {
      buffer.write('\x1b[42mGreenBG\x1b[104mBrightBlueBG');
      expect(buffer.grid[0][0].style.bg).toBe('green');
      expect(buffer.grid[0][7].style.bg).toBe('brightBlue');
    });

    it('applies text attributes: bold, dim, italic, underline', () => {
      buffer.write('\x1b[1mBold\x1b[2mDim\x1b[3mItalic\x1b[4mUnderline');
      expect(buffer.grid[0][0].style.bold).toBe(true);
      expect(buffer.grid[0][4].style.dim).toBe(true);
      expect(buffer.grid[0][7].style.italic).toBe(true);
      expect(buffer.grid[0][13].style.underline).toBe(true);
    });

    it('combines multiple styles in a single SGR escape sequence', () => {
      buffer.write('\x1b[1;31;44mCombined\x1b[0m');
      const cell = buffer.grid[0][0];
      expect(cell.style.bold).toBe(true);
      expect(cell.style.fg).toBe('red');
      expect(cell.style.bg).toBe('blue');
    });

    it('resets all styles with \\x1b[0m and \\x1b[m', () => {
      buffer.write('\x1b[1;31mStyled\x1b[0mPlain\x1b[32mColored\x1b[mReset');
      expect(buffer.grid[0][0].style.fg).toBe('red');
      expect(buffer.grid[0][0].style.bold).toBe(true);

      // 'Plain' starts at index 6
      expect(buffer.grid[0][6].style.fg).toBeUndefined();
      expect(buffer.grid[0][6].style.bold).toBeUndefined();

      // 'Reset' starts at index 18
      expect(buffer.grid[0][18].style.fg).toBeUndefined();
    });

    it('supports 256-color palette (\\x1b[38;5;Nm and \\x1b[48;5;Nm)', () => {
      buffer.write('\x1b[38;5;1mStandardRed\x1b[38;5;196mCubeRed\x1b[48;5;240mGrayBG');
      expect(buffer.grid[0][0].style.fg).toBe('red');
      expect(buffer.grid[0][11].style.fg).toBe('rgb(255, 0, 0)');
      expect(buffer.grid[0][18].style.bg).toBe('rgb(88, 88, 88)');
    });

    it('supports 24-bit TrueColor RGB (\\x1b[38;2;R;G;Bm and \\x1b[48;2;R;G;Bm)', () => {
      buffer.write('\x1b[38;2;255;128;64mTrueFG\x1b[48;2;10;20;30mTrueBG');
      expect(buffer.grid[0][0].style.fg).toBe('rgb(255, 128, 64)');
      expect(buffer.grid[0][6].style.bg).toBe('rgb(10, 20, 30)');
    });
  });

  describe('ANSI Cursor Movement & Screen Clearing', () => {
    it('sets cursor position with \\x1b[H and \\x1b[row;colH (1-based)', () => {
      buffer.write('\x1b[5;10HHello');
      expect(buffer.cursorY).toBe(4);
      expect(buffer.cursorX).toBe(14); // 9 + 5 chars
      expect(buffer.grid[4][9].char).toBe('H');

      buffer.write('\x1b[HHome');
      expect(buffer.cursorY).toBe(0);
      expect(buffer.cursorX).toBe(4);
      expect(buffer.grid[0][0].char).toBe('H');
    });

    it('supports relative cursor movements: Up (A), Down (B), Forward (C), Back (D)', () => {
      buffer.write('\x1b[10;10H'); // at (9, 9)
      buffer.write('\x1b[2A'); // up 2 -> row 7
      expect(buffer.cursorY).toBe(7);
      buffer.write('\x1b[3B'); // down 3 -> row 10
      expect(buffer.cursorY).toBe(10);
      buffer.write('\x1b[4C'); // right 4 -> col 13
      expect(buffer.cursorX).toBe(13);
      buffer.write('\x1b[5D'); // left 5 -> col 8
      expect(buffer.cursorX).toBe(8);
    });

    it('supports horizontal absolute cursor position \\x1b[nG', () => {
      buffer.write('ABCDEFGH');
      buffer.write('\x1b[3GZ'); // 1-based col 3 -> col index 2
      expect(buffer.grid[0][2].char).toBe('Z');
      expect(buffer.getLines()[0]).toBe('ABZDEFGH');
    });

    it('erases display with \\x1b[2J', () => {
      buffer.write('First line\r\nSecond line\r\nThird line');
      expect(buffer.getLines()[0]).toBe('First line');

      buffer.write('\x1b[2J');
      expect(buffer.getLines().every((l) => l === '')).toBe(true);
    });

    it('erases line with \\x1b[K, \\x1b[1K, \\x1b[2K', () => {
      buffer.write('0123456789');
      buffer.write('\x1b[5G'); // move to col 4 (char '4')
      buffer.write('\x1b[K'); // erase to end of line
      expect(buffer.getLines()[0]).toBe('0123');

      buffer.write('\r\n0123456789');
      buffer.write('\x1b[5G'); // move to col 4
      buffer.write('\x1b[1K'); // erase from start to cursor
      expect(buffer.grid[1][0].char).toBe(' ');
      expect(buffer.grid[1][4].char).toBe(' ');
      expect(buffer.grid[1][5].char).toBe('5');

      buffer.write('\r\n0123456789');
      buffer.write('\x1b[2K'); // erase whole line
      expect(buffer.getLines()[2]).toBe('');
    });

    it('saves and restores cursor position with \\x1b[s and \\x1b[u (or \\x1b7 and \\x1b8)', () => {
      buffer.write('Prompt: ');
      buffer.write('\x1b[s'); // save cursor at col 8, row 0
      buffer.write('temporary status');
      buffer.write('\x1b[u'); // restore cursor
      expect(buffer.cursorX).toBe(8);
      expect(buffer.cursorY).toBe(0);
      buffer.write('\x1b[Kuser input');
      expect(buffer.getLines()[0]).toBe('Prompt: user input');
    });

    it('safely ignores OSC title sequences and DEC private modes', () => {
      buffer.write('\x1b]0;Terminal Title\x07Text');
      buffer.write('\x1b[?25h\x1b[?25lMore');
      expect(buffer.getLines()[0]).toBe('TextMore');
    });
  });

  describe('Snapshot and State Isolation', () => {
    it('returns a deep cloned grid from snapshot()', () => {
      buffer.write('\x1b[31mInitial\x1b[0m');
      const snap: TerminalCell[][] = buffer.snapshot();
      const firstCell: TerminalCell = snap[0][0];
      const style: CellStyle = firstCell.style;

      expect(firstCell.char).toBe('I');
      expect(style.fg).toBe('red');

      // Modifying the buffer after snapshot
      buffer.write('\r\nModified');
      expect(snap[1][0].char).toBe(' '); // untouched in snapshot

      // Mutating snapshot cell does not affect buffer
      snap[0][0].char = 'X';
      expect(buffer.grid[0][0].char).toBe('I');
    });
  });

  describe('Resize and Clear', () => {
    it('resizes buffer and preserves existing content', () => {
      buffer.write('Hello\r\nWorld');
      buffer.resize(40, 10);
      expect(buffer.cols).toBe(40);
      expect(buffer.rows).toBe(10);
      expect(buffer.grid.length).toBe(10);
      expect(buffer.grid[0].length).toBe(40);
      expect(buffer.getLines()[0]).toBe('Hello');
      expect(buffer.getLines()[1]).toBe('World');
    });

    it('clamps cursor within new dimensions on resize', () => {
      buffer.write('\x1b[20;50H');
      expect(buffer.cursorY).toBe(19);
      expect(buffer.cursorX).toBe(49);

      buffer.resize(30, 10);
      expect(buffer.cursorY).toBe(9);
      expect(buffer.cursorX).toBe(29);
    });

    it('clears buffer and resets cursor with clear()', () => {
      buffer.write('\x1b[1;31mText on screen');
      expect(buffer.cursorX).toBe(14);
      buffer.clear();
      expect(buffer.cursorX).toBe(0);
      expect(buffer.cursorY).toBe(0);
      expect(buffer.getLines().every((l) => l === '')).toBe(true);

      // Writes after clear use clean default styles
      buffer.write('New');
      expect(buffer.grid[0][0].style.fg).toBeUndefined();
    });
  });

  describe('Streaming & Split Escape Sequences', () => {
    it('handles ANSI escape sequences split across multiple write() calls', () => {
      buffer.write('\x1b[');
      buffer.write('32');
      buffer.write('mSplit');
      buffer.write('\x1b[0');
      buffer.write('mNormal');

      expect(buffer.grid[0][0].char).toBe('S');
      expect(buffer.grid[0][0].style.fg).toBe('green');
      expect(buffer.grid[0][5].char).toBe('N');
      expect(buffer.grid[0][5].style.fg).toBeUndefined();
    });
  });
});
