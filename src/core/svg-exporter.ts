import { AsciicastRecording, AsciicastEvent } from './types';
import { TerminalBuffer, TerminalCell, CellStyle } from './terminal-buffer';

export type SvgTheme = 'dark' | 'light' | 'tokyo-night';

export interface SvgExportOptions {
  theme?: SvgTheme;
  fontSize?: number;
  fontFamily?: string;
  loop?: boolean;
  windowChrome?: boolean;
  title?: string;
}

export interface ThemePalette {
  bg: string;
  fg: string;
  chromeBg: string;
  chromeBorder: string;
  titleColor: string;
  colors: Record<string, string>;
}

export const THEMES: Record<SvgTheme, ThemePalette> = {
  dark: {
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    chromeBg: '#181825',
    chromeBorder: '#313244',
    titleColor: '#a6adc8',
    colors: {
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#eba0ac',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89dceb',
      brightMagenta: '#f5bde6',
      brightCyan: '#89dceb',
      brightWhite: '#ffffff',
    },
  },
  light: {
    bg: '#eff1f5',
    fg: '#4c4f69',
    chromeBg: '#e6e9ef',
    chromeBorder: '#ccd0da',
    titleColor: '#5c5f77',
    colors: {
      black: '#5c5f77',
      red: '#d20f39',
      green: '#40a02b',
      yellow: '#df8e1d',
      blue: '#1e66f5',
      magenta: '#ea76cb',
      cyan: '#179299',
      white: '#acb0be',
      brightBlack: '#6c6f85',
      brightRed: '#e64553',
      brightGreen: '#40a02b',
      brightYellow: '#df8e1d',
      brightBlue: '#209fb5',
      brightMagenta: '#8839ef',
      brightCyan: '#04a5e5',
      brightWhite: '#4c4f69',
    },
  },
  'tokyo-night': {
    bg: '#1a1b26',
    fg: '#c0caf5',
    chromeBg: '#16161e',
    chromeBorder: '#24283b',
    titleColor: '#7aa2f7',
    colors: {
      black: '#32344a',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#c0caf5',
      brightBlack: '#444b6a',
      brightRed: '#ff7a93',
      brightGreen: '#b9f27c',
      brightYellow: '#ff9e64',
      brightBlue: '#7da6ff',
      brightMagenta: '#bb9af7',
      brightCyan: '#0db9d7',
      brightWhite: '#ffffff',
    },
  },
};

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveColor(
  colorNameOrRgb: string | undefined,
  defaultColor: string,
  palette: ThemePalette
): string {
  if (!colorNameOrRgb) return defaultColor;
  if (palette.colors[colorNameOrRgb]) {
    return palette.colors[colorNameOrRgb];
  }
  return colorNameOrRgb;
}

export interface SvgFrame {
  index: number;
  startTime: number;
  endTime: number;
  grid: TerminalCell[][];
}

function isSameGrid(a: TerminalCell[][], b: TerminalCell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    const rowA = a[y];
    const rowB = b[y];
    if (rowA.length !== rowB.length) return false;
    for (let x = 0; x < rowA.length; x++) {
      const cellA = rowA[x];
      const cellB = rowB[x];
      if (cellA.char !== cellB.char) return false;
      const sA = cellA.style;
      const sB = cellB.style;
      if (
        sA.fg !== sB.fg ||
        sA.bg !== sB.bg ||
        sA.bold !== sB.bold ||
        sA.dim !== sB.dim ||
        sA.italic !== sB.italic ||
        sA.underline !== sB.underline ||
        sA.inverse !== sB.inverse
      ) {
        return false;
      }
    }
  }
  return true;
}

function sampleTimelineFrames(
  recording: AsciicastRecording,
  initialCols: number,
  initialRows: number
): { frames: SvgFrame[]; totalDuration: number } {
  const buffer = new TerminalBuffer(initialCols, initialRows);

  const relevantEvents = recording.events
    .filter((e) => e.type === 'o' || e.type === 'r')
    .slice()
    .sort((a, b) => a.time - b.time);

  const lastEventTime =
    relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1].time : 0;
  const totalDuration = Math.max(0, recording.duration, lastEventTime);

  if (relevantEvents.length === 0) {
    return {
      frames: [
        {
          index: 0,
          startTime: 0,
          endTime: totalDuration,
          grid: buffer.snapshot(),
        },
      ],
      totalDuration,
    };
  }

  // Group events occurring at the exact same timestamp
  const timeGroups: { time: number; events: AsciicastEvent[] }[] = [];
  for (const ev of relevantEvents) {
    const lastGroup = timeGroups[timeGroups.length - 1];
    if (lastGroup && Math.abs(lastGroup.time - ev.time) < 0.0001) {
      lastGroup.events.push(ev);
    } else {
      timeGroups.push({ time: ev.time, events: [ev] });
    }
  }

  const rawSnapshots: { time: number; grid: TerminalCell[][] }[] = [];

  // If first event is after time 0, snapshot the initial empty buffer at time 0
  if (timeGroups[0].time > 0.0001) {
    rawSnapshots.push({ time: 0, grid: buffer.snapshot() });
  }

  for (const group of timeGroups) {
    for (const ev of group.events) {
      if (ev.type === 'o') {
        buffer.write(ev.data);
      } else if (ev.type === 'r') {
        const [c, r] = ev.data.split('x').map(Number);
        if (c && r) buffer.resize(c, r);
      }
    }
    rawSnapshots.push({ time: group.time, grid: buffer.snapshot() });
  }

  // Build SvgFrames, merging consecutive frames with identical visual output
  const frames: SvgFrame[] = [];
  let frameIndex = 0;

  for (let i = 0; i < rawSnapshots.length; i++) {
    const cur = rawSnapshots[i];
    const startTime = cur.time;
    const nextTime = i + 1 < rawSnapshots.length ? rawSnapshots[i + 1].time : totalDuration;
    const endTime = Math.max(startTime, nextTime);

    if (frames.length > 0 && isSameGrid(frames[frames.length - 1].grid, cur.grid)) {
      frames[frames.length - 1].endTime = endTime;
    } else {
      frames.push({
        index: frameIndex++,
        startTime,
        endTime,
        grid: cur.grid,
      });
    }
  }

  // Ensure last frame ends at totalDuration
  if (frames.length > 0) {
    frames[frames.length - 1].endTime = totalDuration;
  }

  return {
    frames: frames.length > 0
      ? frames
      : [
          {
            index: 0,
            startTime: 0,
            endTime: totalDuration,
            grid: buffer.snapshot(),
          },
        ],
    totalDuration,
  };
}

interface SpanGroup {
  text: string;
  style: CellStyle;
  effectiveFg: string;
  effectiveBg?: string;
}

function renderFrame(
  frame: SvgFrame,
  charWidth: number,
  lineHeight: number,
  paddingX: number,
  paddingY: number,
  chromeHeight: number,
  palette: ThemePalette,
  fontSize: number
): string {
  const parts: string[] = [];
  parts.push(`  <g id="frame-${frame.index}" class="frame">`);

  // Background rects layer
  const bgRects: string[] = [];
  for (let y = 0; y < frame.grid.length; y++) {
    const row = frame.grid[y];
    let bgStartCol = -1;
    let currentBg: string | undefined = undefined;

    for (let x = 0; x <= row.length; x++) {
      const cell = x < row.length ? row[x] : null;
      let effectiveBg: string | undefined = undefined;
      if (cell) {
        if (cell.style.inverse) {
          effectiveBg = cell.style.fg || palette.fg;
        } else {
          effectiveBg = cell.style.bg;
        }
      }

      if (effectiveBg && effectiveBg !== palette.bg) {
        if (currentBg === effectiveBg) {
          // Continue existing bg span
        } else {
          if (bgStartCol >= 0 && currentBg) {
            const rx = paddingX + bgStartCol * charWidth;
            const ry = chromeHeight + paddingY + y * lineHeight;
            const rw = (x - bgStartCol) * charWidth;
            const fill = resolveColor(currentBg, palette.bg, palette);
            bgRects.push(
              `    <rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${lineHeight.toFixed(2)}" fill="${fill}" />`
            );
          }
          bgStartCol = x;
          currentBg = effectiveBg;
        }
      } else {
        if (bgStartCol >= 0 && currentBg) {
          const rx = paddingX + bgStartCol * charWidth;
          const ry = chromeHeight + paddingY + y * lineHeight;
          const rw = (x - bgStartCol) * charWidth;
          const fill = resolveColor(currentBg, palette.bg, palette);
          bgRects.push(
            `    <rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${lineHeight.toFixed(2)}" fill="${fill}" />`
          );
          bgStartCol = -1;
          currentBg = undefined;
        }
      }
    }
  }

  if (bgRects.length > 0) {
    parts.push(bgRects.join('\n'));
  }

  // Text layer
  const baselineOffset = Math.round(fontSize * 0.9 * 10) / 10;
  for (let y = 0; y < frame.grid.length; y++) {
    const row = frame.grid[y];
    // Find last non-space cell to trim trailing blank spaces
    let lastNonEmpty = row.length - 1;
    while (
      lastNonEmpty >= 0 &&
      row[lastNonEmpty].char === ' ' &&
      !row[lastNonEmpty].style.inverse &&
      !row[lastNonEmpty].style.bg
    ) {
      lastNonEmpty--;
    }

    if (lastNonEmpty < 0) continue; // Skip completely empty line

    const textY = chromeHeight + paddingY + y * lineHeight + baselineOffset;
    const spans: SpanGroup[] = [];
    let currentSpan: SpanGroup | null = null;

    for (let x = 0; x <= lastNonEmpty; x++) {
      const cell = row[x];
      const effectiveFg = cell.style.inverse
        ? cell.style.bg || palette.bg
        : cell.style.fg || palette.fg;
      const effectiveBg = cell.style.inverse
        ? cell.style.fg || palette.fg
        : cell.style.bg;

      if (
        currentSpan &&
        currentSpan.effectiveFg === effectiveFg &&
        currentSpan.effectiveBg === effectiveBg &&
        Boolean(currentSpan.style.bold) === Boolean(cell.style.bold) &&
        Boolean(currentSpan.style.italic) === Boolean(cell.style.italic) &&
        Boolean(currentSpan.style.underline) === Boolean(cell.style.underline) &&
        Boolean(currentSpan.style.dim) === Boolean(cell.style.dim)
      ) {
        currentSpan.text += cell.char;
      } else {
        if (currentSpan) {
          spans.push(currentSpan);
        }
        currentSpan = {
          text: cell.char,
          style: { ...cell.style },
          effectiveFg,
          effectiveBg,
        };
      }
    }
    if (currentSpan) {
      spans.push(currentSpan);
    }

    const tspanStrings = spans.map((span) => {
      const attrs: string[] = [];
      const resolvedFg = resolveColor(span.effectiveFg, palette.fg, palette);
      if (resolvedFg !== palette.fg) {
        attrs.push(`fill="${resolvedFg}"`);
      }
      if (span.style.bold) {
        attrs.push('font-weight="bold"');
      }
      if (span.style.italic) {
        attrs.push('font-style="italic"');
      }
      if (span.style.underline) {
        attrs.push('text-decoration="underline"');
      }
      if (span.style.dim) {
        attrs.push('opacity="0.6"');
      }

      const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      return `<tspan${attrStr}>${escapeXml(span.text)}</tspan>`;
    });

    parts.push(
      `    <text x="${paddingX}" y="${textY.toFixed(2)}">${tspanStrings.join('')}</text>`
    );
  }

  parts.push('  </g>');
  return parts.join('\n');
}

export function exportToAnimatedSvg(
  recording: AsciicastRecording,
  options?: SvgExportOptions
): string {
  const themeName = options?.theme ?? 'dark';
  const palette = THEMES[themeName] ?? THEMES.dark;
  const fontSize = options?.fontSize ?? 14;
  const fontFamily =
    options?.fontFamily ??
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
  const loop = options?.loop !== false;
  const windowChrome = options?.windowChrome !== false;
  const title = options?.title ?? recording.header.title ?? 'TermiRecord';

  const charWidth = Math.round(fontSize * 0.6 * 100) / 100;
  const lineHeight = Math.round(fontSize * 1.35 * 100) / 100;
  const paddingX = 16;
  const paddingY = 16;
  const chromeHeight = windowChrome ? 38 : 0;
  const borderRadius = 8;

  const cols = Math.max(1, recording.header.width);
  const rows = Math.max(1, recording.header.height);

  const contentWidth = Math.ceil(cols * charWidth);
  const contentHeight = Math.ceil(rows * lineHeight);
  const width = contentWidth + paddingX * 2;
  const height = chromeHeight + contentHeight + paddingY * 2;

  // Sample frames
  const { frames, totalDuration } = sampleTimelineFrames(recording, cols, rows);

  // CSS Animation rules
  const cssLines: string[] = [];
  cssLines.push(`    text { font-family: ${fontFamily}; font-size: ${fontSize}px; fill: ${palette.fg}; white-space: pre; }`);

  const hasAnimation = frames.length > 1 && totalDuration > 0;

  if (!hasAnimation) {
    cssLines.push('    .frame { display: inline; opacity: 1; }');
  } else {
    cssLines.push('    .frame { display: none; opacity: 0; }');
    cssLines.push('    #frame-0 { display: inline; opacity: 1; }');

    const durationStr = `${totalDuration.toFixed(2)}s`;
    const iterStr = loop ? 'infinite' : '1 forwards';

    for (const frame of frames) {
      cssLines.push(`    #frame-${frame.index} { animation: frame-anim-${frame.index} ${durationStr} ${iterStr}; }`);

      const pStart = (frame.startTime / totalDuration) * 100;
      const pEnd = (frame.endTime / totalDuration) * 100;

      const keyframeRules: string[] = [];

      if (pStart === 0 && pEnd >= 99.99) {
        keyframeRules.push('      0%, 100% { display: inline; opacity: 1; }');
      } else if (pStart === 0) {
        keyframeRules.push(`      0%, ${pEnd.toFixed(2)}% { display: inline; opacity: 1; }`);
        keyframeRules.push(`      ${Math.min(100, pEnd + 0.01).toFixed(2)}%, 100% { display: none; opacity: 0; }`);
      } else if (pEnd >= 99.99) {
        keyframeRules.push(`      0%, ${Math.max(0, pStart - 0.01).toFixed(2)}% { display: none; opacity: 0; }`);
        keyframeRules.push(`      ${pStart.toFixed(2)}%, 100% { display: inline; opacity: 1; }`);
      } else {
        keyframeRules.push(`      0%, ${Math.max(0, pStart - 0.01).toFixed(2)}% { display: none; opacity: 0; }`);
        keyframeRules.push(`      ${pStart.toFixed(2)}%, ${pEnd.toFixed(2)}% { display: inline; opacity: 1; }`);
        keyframeRules.push(`      ${Math.min(100, pEnd + 0.01).toFixed(2)}%, 100% { display: none; opacity: 0; }`);
      }

      cssLines.push(`    @keyframes frame-anim-${frame.index} {`);
      cssLines.push(keyframeRules.join('\n'));
      cssLines.push('    }');
    }
  }

  // Build SVG pieces
  const svgPieces: string[] = [];
  svgPieces.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
  svgPieces.push('  <style>');
  svgPieces.push(cssLines.join('\n'));
  svgPieces.push('  </style>');

  // Background rect
  svgPieces.push(`  <rect width="${width}" height="${height}" rx="${borderRadius}" fill="${palette.bg}" stroke="${palette.chromeBorder}" stroke-width="1" />`);

  // Window chrome header
  if (windowChrome) {
    const chromePath = `M 0,${borderRadius} A ${borderRadius},${borderRadius} 0 0 1 ${borderRadius},0 L ${width - borderRadius},0 A ${borderRadius},${borderRadius} 0 0 1 ${width},${borderRadius} L ${width},${chromeHeight} L 0,${chromeHeight} Z`;
    svgPieces.push(`  <path d="${chromePath}" fill="${palette.chromeBg}" />`);
    svgPieces.push(`  <line x1="0" y1="${chromeHeight}" x2="${width}" y2="${chromeHeight}" stroke="${palette.chromeBorder}" stroke-width="1" />`);

    // macOS traffic light buttons (red, yellow, green)
    const dotY = Math.round(chromeHeight / 2);
    svgPieces.push(`  <circle cx="18" cy="${dotY}" r="6" fill="#ff5f56" />`);
    svgPieces.push(`  <circle cx="38" cy="${dotY}" r="6" fill="#ffbd2e" />`);
    svgPieces.push(`  <circle cx="58" cy="${dotY}" r="6" fill="#27c93f" />`);

    // Title
    const titleFontSize = Math.max(11, fontSize - 2);
    svgPieces.push(
      `  <text x="${(width / 2).toFixed(1)}" y="${dotY}" text-anchor="middle" dominant-baseline="central" fill="${palette.titleColor}" font-family="${fontFamily}" font-size="${titleFontSize}" font-weight="500">${escapeXml(title)}</text>`
    );
  }

  // Render frames
  for (const frame of frames) {
    svgPieces.push(
      renderFrame(
        frame,
        charWidth,
        lineHeight,
        paddingX,
        paddingY,
        chromeHeight,
        palette,
        fontSize
      )
    );
  }

  svgPieces.push('</svg>');
  return svgPieces.join('\n');
}
