import React, { useMemo } from 'react';
import { TerminalBuffer, TerminalCell, CellStyle } from '../core/terminal-buffer';
import { THEMES, SvgTheme, ThemePalette } from '../core/svg-exporter';

export interface TerminalScreenProps {
  buffer: TerminalBuffer;
  title?: string;
  theme?: SvgTheme | string;
  showCursor?: boolean;
  className?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface CellRun {
  text: string;
  style: CellStyle;
  isCursor: boolean;
}

function resolveColor(colorName: string, palette: ThemePalette): string {
  if (palette.colors[colorName]) {
    return palette.colors[colorName];
  }
  if (THEMES.dark.colors[colorName]) {
    return THEMES.dark.colors[colorName];
  }
  return colorName;
}

function getStyleClasses(style: CellStyle, isCursor: boolean): string {
  const classes: string[] = ['terminal-span', 'terminal-cell'];
  if (style.bold) classes.push('ansi-bold');
  if (style.dim) classes.push('ansi-dim');
  if (style.italic) classes.push('ansi-italic');
  if (style.underline) classes.push('ansi-underline');
  if (style.inverse) classes.push('ansi-inverse');
  if (style.fg) classes.push(`ansi-fg-${style.fg}`);
  if (style.bg) classes.push(`ansi-bg-${style.bg}`);
  if (isCursor) classes.push('terminal-cursor');
  return classes.join(' ');
}

function getInlineStyle(
  style: CellStyle,
  palette: ThemePalette
): React.CSSProperties {
  const css: React.CSSProperties = {};

  let fg = style.fg ? resolveColor(style.fg, palette) : undefined;
  let bg = style.bg ? resolveColor(style.bg, palette) : undefined;

  if (style.inverse) {
    const tmp = fg || palette.fg;
    fg = bg || palette.bg;
    bg = tmp;
  }

  if (fg) css.color = fg;
  if (bg) css.backgroundColor = bg;
  if (style.bold) css.fontWeight = 'bold';
  if (style.dim) css.opacity = 0.6;
  if (style.italic) css.fontStyle = 'italic';
  if (style.underline) css.textDecoration = 'underline';

  return css;
}

function groupCellsInRow(
  row: TerminalCell[],
  cursorCol: number | null
): CellRun[] {
  const runs: CellRun[] = [];
  if (!row || row.length === 0) return runs;

  let currentRun: CellRun | null = null;

  for (let col = 0; col < row.length; col++) {
    const cell = row[col];
    const isCursor = cursorCol === col;

    if (!currentRun) {
      currentRun = { text: cell.char, style: cell.style, isCursor };
    } else {
      const sameStyle =
        !isCursor &&
        !currentRun.isCursor &&
        cell.style.fg === currentRun.style.fg &&
        cell.style.bg === currentRun.style.bg &&
        cell.style.bold === currentRun.style.bold &&
        cell.style.dim === currentRun.style.dim &&
        cell.style.italic === currentRun.style.italic &&
        cell.style.underline === currentRun.style.underline &&
        cell.style.inverse === currentRun.style.inverse;

      if (sameStyle) {
        currentRun.text += cell.char;
      } else {
        runs.push(currentRun);
        currentRun = { text: cell.char, style: cell.style, isCursor };
      }
    }
  }

  if (currentRun) {
    runs.push(currentRun);
  }

  return runs;
}

export function TerminalScreen({
  buffer,
  title = 'termirecord',
  theme = 'dark',
  showCursor = true,
  className = '',
  fontSize,
  fontFamily,
}: TerminalScreenProps) {
  const activeTheme: ThemePalette = useMemo(() => {
    if (theme && typeof theme === 'string' && THEMES[theme as SvgTheme]) {
      return THEMES[theme as SvgTheme];
    }
    return THEMES.dark;
  }, [theme]);

  return (
    <div
      className={`terminal-screen ${theme ? `theme-${theme}` : 'theme-dark'} ${className}`.trim()}
      data-theme={theme || 'dark'}
      data-testid="terminal-screen"
      style={{
        backgroundColor: activeTheme.bg,
        color: activeTheme.fg,
        fontFamily: fontFamily || 'var(--font-mono)',
        fontSize: fontSize ? `${fontSize}px` : undefined,
      }}
    >
      <div
        className="terminal-header terminal-chrome"
        data-testid="terminal-header"
        style={{
          backgroundColor: activeTheme.chromeBg,
          borderBottomColor: activeTheme.chromeBorder,
        }}
      >
        <div className="terminal-dots">
          <span className="terminal-dot terminal-dot-red" data-testid="dot-red" />
          <span className="terminal-dot terminal-dot-yellow" data-testid="dot-yellow" />
          <span className="terminal-dot terminal-dot-green" data-testid="dot-green" />
        </div>
        <div
          className="terminal-title"
          data-testid="terminal-title"
          style={{ color: activeTheme.titleColor }}
        >
          {title}
        </div>
        <div className="terminal-header-spacer">
          <span className="terminal-dim-info">
            {buffer.cols}x{buffer.rows}
          </span>
        </div>
      </div>

      <div
        className="terminal-body"
        data-testid="terminal-body"
        style={{
          backgroundColor: activeTheme.bg,
          color: activeTheme.fg,
        }}
      >
        {buffer.grid.map((row, rowIndex) => {
          const cursorCol =
            showCursor && buffer.cursorY === rowIndex ? buffer.cursorX : null;
          const runs = groupCellsInRow(row, cursorCol);

          return (
            <div
              key={rowIndex}
              className="terminal-row terminal-line"
              data-row={rowIndex}
            >
              {runs.length > 0 ? (
                runs.map((run, runIndex) => (
                  <span
                    key={runIndex}
                    className={getStyleClasses(run.style, run.isCursor)}
                    style={getInlineStyle(run.style, activeTheme)}
                  >
                    {run.text}
                  </span>
                ))
              ) : (
                <span className="terminal-span terminal-cell">{'\u00A0'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TerminalScreen;
