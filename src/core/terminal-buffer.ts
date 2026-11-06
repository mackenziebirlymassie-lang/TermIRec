import { AsciicastHeader } from './types';

export interface CellStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface TerminalCell {
  char: string;
  style: CellStyle;
}

const STANDARD_FG: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
};

const BRIGHT_FG: Record<number, string> = {
  90: 'brightBlack',
  91: 'brightRed',
  92: 'brightGreen',
  93: 'brightYellow',
  94: 'brightBlue',
  95: 'brightMagenta',
  96: 'brightCyan',
  97: 'brightWhite',
};

const STANDARD_BG: Record<number, string> = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white',
};

const BRIGHT_BG: Record<number, string> = {
  100: 'brightBlack',
  101: 'brightRed',
  102: 'brightGreen',
  103: 'brightYellow',
  104: 'brightBlue',
  105: 'brightMagenta',
  106: 'brightCyan',
  107: 'brightWhite',
};

function parse256Color(n: number): string | undefined {
  if (isNaN(n) || n < 0 || n > 255) return undefined;
  if (n < 8) {
    return STANDARD_FG[30 + n];
  }
  if (n < 16) {
    return BRIGHT_FG[90 + (n - 8)];
  }
  if (n <= 231) {
    // 6x6x6 color cube
    const cubeVal = [0, 95, 135, 175, 215, 255];
    const index = n - 16;
    const r = cubeVal[Math.floor(index / 36)];
    const g = cubeVal[Math.floor((index % 36) / 6)];
    const b = cubeVal[index % 6];
    return `rgb(${r}, ${g}, ${b})`;
  }
  // 232 - 255: grayscale ramp
  const gray = 8 + (n - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

enum ParserState {
  GROUND,
  ESCAPE,
  CSI,
  OSC,
  CHARSET,
}

export class TerminalBuffer {
  cols: number;
  rows: number;
  cursorX: number = 0;
  cursorY: number = 0;
  grid: TerminalCell[][] = [];

  private savedCursorX: number = 0;
  private savedCursorY: number = 0;
  private currentStyle: CellStyle = {};

  private state: ParserState = ParserState.GROUND;
  private csiBuffer: string = '';
  private oscBuffer: string = '';

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, cols);
    this.rows = Math.max(1, rows);
    this.initGrid();
  }

  static fromHeader(header: AsciicastHeader): TerminalBuffer {
    return new TerminalBuffer(header.width, header.height);
  }

  private initGrid(): void {
    this.grid = [];
    for (let y = 0; y < this.rows; y++) {
      this.grid.push(this.createEmptyRow());
    }
  }

  private createEmptyRow(): TerminalCell[] {
    const row: TerminalCell[] = [];
    for (let x = 0; x < this.cols; x++) {
      row.push({ char: ' ', style: {} });
    }
    return row;
  }

  private scroll(): void {
    this.grid.shift();
    this.grid.push(this.createEmptyRow());
  }

  private eraseInLine(y: number, startX: number, endX: number): void {
    if (y < 0 || y >= this.rows) return;
    const start = Math.max(0, startX);
    const end = Math.min(this.cols, endX);
    for (let x = start; x < end; x++) {
      this.grid[y][x] = { char: ' ', style: {} };
    }
  }

  write(text: string): void {
    let i = 0;
    while (i < text.length) {
      const code = text.codePointAt(i)!;
      const ch = String.fromCodePoint(code);
      i += ch.length;

      switch (this.state) {
        case ParserState.GROUND: {
          if (ch === '\x1b') {
            this.state = ParserState.ESCAPE;
          } else if (ch === '\r') {
            this.cursorX = 0;
          } else if (ch === '\n') {
            this.cursorY++;
            if (this.cursorY >= this.rows) {
              this.scroll();
              this.cursorY = this.rows - 1;
            }
          } else if (ch === '\b') {
            if (this.cursorX > 0) {
              this.cursorX--;
            }
          } else if (ch === '\t') {
            const nextCol = (Math.floor(this.cursorX / 8) + 1) * 8;
            this.cursorX = Math.min(this.cols - 1, nextCol);
          } else if (code < 32) {
            // Ignore other unhandled control codes (BEL, NUL, etc.)
          } else {
            // Printable character
            if (this.cursorX >= this.cols) {
              this.cursorX = 0;
              this.cursorY++;
              if (this.cursorY >= this.rows) {
                this.scroll();
                this.cursorY = this.rows - 1;
              }
            }

            this.grid[this.cursorY][this.cursorX] = {
              char: ch,
              style: { ...this.currentStyle },
            };
            this.cursorX++;
          }
          break;
        }

        case ParserState.ESCAPE: {
          if (ch === '[') {
            this.state = ParserState.CSI;
            this.csiBuffer = '';
          } else if (ch === ']') {
            this.state = ParserState.OSC;
            this.oscBuffer = '';
          } else if (ch === '7') {
            this.savedCursorX = this.cursorX;
            this.savedCursorY = this.cursorY;
            this.state = ParserState.GROUND;
          } else if (ch === '8') {
            this.cursorX = Math.min(this.cols - 1, Math.max(0, this.savedCursorX));
            this.cursorY = Math.min(this.rows - 1, Math.max(0, this.savedCursorY));
            this.state = ParserState.GROUND;
          } else if (ch === 'M') {
            if (this.cursorY > 0) {
              this.cursorY--;
            }
            this.state = ParserState.GROUND;
          } else if (ch === 'c') {
            this.clear();
            this.state = ParserState.GROUND;
          } else if (ch === '(' || ch === ')' || ch === '*' || ch === '+') {
            this.state = ParserState.CHARSET;
          } else {
            this.state = ParserState.GROUND;
          }
          break;
        }

        case ParserState.CHARSET: {
          this.state = ParserState.GROUND;
          break;
        }

        case ParserState.CSI: {
          if ((ch >= '0' && ch <= '9') || ch === ';' || ch === '?' || ch === ':') {
            this.csiBuffer += ch;
          } else if (ch >= '@' && ch <= '~') {
            this.executeCsi(ch, this.csiBuffer);
            this.state = ParserState.GROUND;
          } else {
            this.state = ParserState.GROUND;
          }
          break;
        }

        case ParserState.OSC: {
          if (ch === '\x07') {
            this.state = ParserState.GROUND;
          } else if (ch === '\x1b') {
            if (i < text.length && text[i] === '\\') {
              i++;
            }
            this.state = ParserState.GROUND;
          } else {
            this.oscBuffer += ch;
          }
          break;
        }
      }
    }
  }

  private executeCsi(command: string, paramStr: string): void {
    if (paramStr.startsWith('?')) {
      // DEC private modes (e.g. ?25h, ?25l, ?1049h) - safely ignored
      return;
    }

    switch (command) {
      case 'm': {
        this.executeSgr(paramStr);
        break;
      }

      case 'H':
      case 'f': {
        const parts = paramStr.split(';');
        const r = parts[0] ? parseInt(parts[0], 10) : 1;
        const c = parts[1] ? parseInt(parts[1], 10) : 1;
        this.cursorY = Math.max(0, Math.min(this.rows - 1, (isNaN(r) ? 1 : r) - 1));
        this.cursorX = Math.max(0, Math.min(this.cols - 1, (isNaN(c) ? 1 : c) - 1));
        break;
      }

      case 'A': {
        const n = parseInt(paramStr, 10) || 1;
        this.cursorY = Math.max(0, this.cursorY - n);
        break;
      }

      case 'B': {
        const n = parseInt(paramStr, 10) || 1;
        this.cursorY = Math.min(this.rows - 1, this.cursorY + n);
        break;
      }

      case 'C': {
        const n = parseInt(paramStr, 10) || 1;
        this.cursorX = Math.min(this.cols - 1, this.cursorX + n);
        break;
      }

      case 'D': {
        const n = parseInt(paramStr, 10) || 1;
        this.cursorX = Math.max(0, this.cursorX - n);
        break;
      }

      case 'G': {
        const col = parseInt(paramStr, 10) || 1;
        this.cursorX = Math.max(0, Math.min(this.cols - 1, col - 1));
        break;
      }

      case 'd': {
        const row = parseInt(paramStr, 10) || 1;
        this.cursorY = Math.max(0, Math.min(this.rows - 1, row - 1));
        break;
      }

      case 'J': {
        const n = parseInt(paramStr, 10) || 0;
        if (n === 0) {
          this.eraseInLine(this.cursorY, this.cursorX, this.cols);
          for (let y = this.cursorY + 1; y < this.rows; y++) {
            this.eraseInLine(y, 0, this.cols);
          }
        } else if (n === 1) {
          for (let y = 0; y < this.cursorY; y++) {
            this.eraseInLine(y, 0, this.cols);
          }
          this.eraseInLine(this.cursorY, 0, this.cursorX + 1);
        } else if (n === 2 || n === 3) {
          for (let y = 0; y < this.rows; y++) {
            this.eraseInLine(y, 0, this.cols);
          }
        }
        break;
      }

      case 'K': {
        const n = parseInt(paramStr, 10) || 0;
        if (n === 0) {
          this.eraseInLine(this.cursorY, this.cursorX, this.cols);
        } else if (n === 1) {
          this.eraseInLine(this.cursorY, 0, this.cursorX + 1);
        } else if (n === 2) {
          this.eraseInLine(this.cursorY, 0, this.cols);
        }
        break;
      }

      case 's': {
        this.savedCursorX = this.cursorX;
        this.savedCursorY = this.cursorY;
        break;
      }

      case 'u': {
        this.cursorX = Math.min(this.cols - 1, Math.max(0, this.savedCursorX));
        this.cursorY = Math.min(this.rows - 1, Math.max(0, this.savedCursorY));
        break;
      }
    }
  }

  private executeSgr(paramStr: string): void {
    if (paramStr.length === 0 || paramStr === '0') {
      this.currentStyle = {};
      return;
    }

    const params = paramStr.split(';').map((p) => (p === '' ? 0 : parseInt(p, 10)));
    for (let i = 0; i < params.length; i++) {
      const code = params[i];
      if (isNaN(code) || code === 0) {
        this.currentStyle = {};
      } else if (code === 1) {
        this.currentStyle.bold = true;
      } else if (code === 2) {
        this.currentStyle.dim = true;
      } else if (code === 3) {
        this.currentStyle.italic = true;
      } else if (code === 4) {
        this.currentStyle.underline = true;
      } else if (code === 7) {
        this.currentStyle.inverse = true;
      } else if (code === 21 || code === 22) {
        delete this.currentStyle.bold;
        delete this.currentStyle.dim;
      } else if (code === 23) {
        delete this.currentStyle.italic;
      } else if (code === 24) {
        delete this.currentStyle.underline;
      } else if (code === 27) {
        delete this.currentStyle.inverse;
      } else if (code >= 30 && code <= 37) {
        this.currentStyle.fg = STANDARD_FG[code];
      } else if (code === 38) {
        if (params[i + 1] === 5 && i + 2 < params.length) {
          const color = parse256Color(params[i + 2]);
          if (color) this.currentStyle.fg = color;
          i += 2;
        } else if (params[i + 1] === 2 && i + 4 < params.length) {
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          this.currentStyle.fg = `rgb(${r}, ${g}, ${b})`;
          i += 4;
        }
      } else if (code === 39) {
        delete this.currentStyle.fg;
      } else if (code >= 40 && code <= 47) {
        this.currentStyle.bg = STANDARD_BG[code];
      } else if (code === 48) {
        if (params[i + 1] === 5 && i + 2 < params.length) {
          const color = parse256Color(params[i + 2]);
          if (color) this.currentStyle.bg = color;
          i += 2;
        } else if (params[i + 1] === 2 && i + 4 < params.length) {
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          this.currentStyle.bg = `rgb(${r}, ${g}, ${b})`;
          i += 4;
        }
      } else if (code === 49) {
        delete this.currentStyle.bg;
      } else if (code >= 90 && code <= 97) {
        this.currentStyle.fg = BRIGHT_FG[code];
      } else if (code >= 100 && code <= 107) {
        this.currentStyle.bg = BRIGHT_BG[code];
      }
    }
  }

  resize(cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) return;
    const oldGrid = this.grid;
    const oldRows = this.rows;
    const oldCols = this.cols;

    this.cols = cols;
    this.rows = rows;

    const newGrid: TerminalCell[][] = [];
    for (let y = 0; y < rows; y++) {
      const newRow: TerminalCell[] = [];
      for (let x = 0; x < cols; x++) {
        if (y < oldRows && x < oldCols) {
          newRow.push({
            char: oldGrid[y][x].char,
            style: { ...oldGrid[y][x].style },
          });
        } else {
          newRow.push({ char: ' ', style: {} });
        }
      }
      newGrid.push(newRow);
    }

    this.grid = newGrid;
    this.cursorX = Math.min(this.cols - 1, Math.max(0, this.cursorX));
    this.cursorY = Math.min(this.rows - 1, Math.max(0, this.cursorY));
  }

  clear(): void {
    this.cursorX = 0;
    this.cursorY = 0;
    this.currentStyle = {};
    this.state = ParserState.GROUND;
    this.csiBuffer = '';
    this.oscBuffer = '';
    this.initGrid();
  }

  getLines(trim: boolean = true): string[] {
    return this.grid.map((row) => {
      const line = row.map((cell) => cell.char).join('');
      return trim ? line.trimEnd() : line;
    });
  }

  snapshot(): TerminalCell[][] {
    return this.grid.map((row) =>
      row.map((cell) => ({
        char: cell.char,
        style: { ...cell.style },
      }))
    );
  }
}
