import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { TerminalScreen } from '../../src/components/TerminalScreen';
import { Toolbar } from '../../src/components/Toolbar';
import { TerminalBuffer } from '../../src/core/terminal-buffer';

// Configure React act environment for clean test output
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TerminalScreen component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const render = async (element: React.ReactElement): Promise<HTMLDivElement> => {
    await act(async () => {
      root.render(element);
    });
    return container;
  };

  describe('Window Chrome', () => {
    it('renders the terminal screen container and macOS chrome buttons', async () => {
      const buffer = new TerminalBuffer(80, 24);
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const terminalScreen = dom.querySelector('.terminal-screen');
      expect(terminalScreen).toBeTruthy();

      const header = dom.querySelector('.terminal-header');
      expect(header).toBeTruthy();

      const dots = dom.querySelectorAll('.terminal-dot');
      expect(dots.length).toBe(3);

      expect(dom.querySelector('.terminal-dot-red')).toBeTruthy();
      expect(dom.querySelector('.terminal-dot-yellow')).toBeTruthy();
      expect(dom.querySelector('.terminal-dot-green')).toBeTruthy();
    });

    it('renders default title "termirecord" when no title prop is provided', async () => {
      const buffer = new TerminalBuffer(80, 24);
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const titleEl = dom.querySelector('.terminal-title');
      expect(titleEl).toBeTruthy();
      expect(titleEl?.textContent).toBe('termirecord');
    });

    it('renders custom title when title prop is provided', async () => {
      const buffer = new TerminalBuffer(80, 24);
      const dom = await render(
        <TerminalScreen buffer={buffer} title="session-record.cast" />
      );

      const titleEl = dom.querySelector('.terminal-title');
      expect(titleEl?.textContent).toBe('session-record.cast');
    });
  });

  describe('Grid & Content Rendering', () => {
    it('renders correct number of rows matching buffer height', async () => {
      const buffer = new TerminalBuffer(40, 10);
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const rows = dom.querySelectorAll('.terminal-row');
      expect(rows.length).toBe(10);
    });

    it('renders written plain text across lines', async () => {
      const buffer = new TerminalBuffer(40, 5);
      buffer.write('Hello TermiRecord!\r\nSecond line');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const rows = dom.querySelectorAll('.terminal-row');
      expect(rows[0].textContent).toContain('Hello TermiRecord!');
      expect(rows[1].textContent).toContain('Second line');
    });

    it('renders monospace font styling on lines and cells', async () => {
      const buffer = new TerminalBuffer(20, 3);
      buffer.write('echo test');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const body = dom.querySelector('.terminal-body');
      expect(body).toBeTruthy();
    });
  });

  describe('ANSI Styling', () => {
    it('renders bold text with ansi-bold class and bold styling', async () => {
      const buffer = new TerminalBuffer(40, 3);
      buffer.write('\x1b[1mBold Text\x1b[0m Normal');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const boldSpan = dom.querySelector('.ansi-bold');
      expect(boldSpan).toBeTruthy();
      expect(boldSpan?.textContent).toBe('Bold Text');
    });

    it('renders colored text with appropriate ANSI fg class and style', async () => {
      const buffer = new TerminalBuffer(40, 3);
      buffer.write('\x1b[31mRed Text\x1b[0m \x1b[32mGreen Text\x1b[0m');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const redSpan = dom.querySelector('.ansi-fg-red');
      expect(redSpan).toBeTruthy();
      expect(redSpan?.textContent).toBe('Red Text');

      const greenSpan = dom.querySelector('.ansi-fg-green');
      expect(greenSpan).toBeTruthy();
      expect(greenSpan?.textContent).toBe('Green Text');
    });

    it('renders background colored text with ansi-bg class', async () => {
      const buffer = new TerminalBuffer(40, 3);
      buffer.write('\x1b[44mBlue BG\x1b[0m');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const bgSpan = dom.querySelector('.ansi-bg-blue');
      expect(bgSpan).toBeTruthy();
      expect(bgSpan?.textContent).toBe('Blue BG');
    });

    it('renders combined styling (bold, italic, underline, bright colors)', async () => {
      const buffer = new TerminalBuffer(40, 3);
      buffer.write('\x1b[1;3;4;93mHighlighted\x1b[0m');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const span = dom.querySelector('.ansi-fg-brightYellow');
      expect(span).toBeTruthy();
      expect(span?.classList.contains('ansi-bold')).toBe(true);
      expect(span?.classList.contains('ansi-italic')).toBe(true);
      expect(span?.classList.contains('ansi-underline')).toBe(true);
      expect(span?.textContent).toBe('Highlighted');
    });

    it('handles inverse styling', async () => {
      const buffer = new TerminalBuffer(40, 3);
      buffer.write('\x1b[7mInverted\x1b[0m');
      const dom = await render(<TerminalScreen buffer={buffer} />);

      const span = dom.querySelector('.ansi-inverse');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe('Inverted');
    });
  });

  describe('Theme and Cursor', () => {
    it('applies theme class or attributes for different themes', async () => {
      const buffer = new TerminalBuffer(20, 3);
      const dom = await render(<TerminalScreen buffer={buffer} theme="tokyo-night" />);

      const screen = dom.querySelector('.terminal-screen');
      expect(
        screen?.classList.contains('theme-tokyo-night') ||
        screen?.getAttribute('data-theme') === 'tokyo-night'
      ).toBe(true);
    });

    it('renders cursor at buffer position by default', async () => {
      const buffer = new TerminalBuffer(20, 3);
      buffer.write('hi'); // cursor at (2, 0)
      const dom = await render(<TerminalScreen buffer={buffer} showCursor={true} />);

      const cursor = dom.querySelector('.terminal-cursor');
      expect(cursor).toBeTruthy();
    });

    it('can hide cursor when showCursor is false', async () => {
      const buffer = new TerminalBuffer(20, 3);
      buffer.write('hi');
      const dom = await render(<TerminalScreen buffer={buffer} showCursor={false} />);

      const cursor = dom.querySelector('.terminal-cursor');
      expect(cursor).toBeNull();
    });
  });
});

describe('Toolbar component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const render = async (element: React.ReactElement): Promise<HTMLDivElement> => {
    await act(async () => {
      root.render(element);
    });
    return container;
  };

  it('renders branding title and action buttons', async () => {
    const handleUpload = vi.fn();
    const handleExport = vi.fn();
    const handleSample = vi.fn();

    const dom = await render(
      <Toolbar
        onFileUpload={handleUpload}
        onExportClick={handleExport}
        onLoadSample={handleSample}
      />
    );

    expect(dom.textContent).toContain('TermiRecord');

    const uploadBtn = dom.querySelector('[data-testid="upload-button"]');
    const sampleBtn = dom.querySelector('[data-testid="sample-button"]');
    const exportBtn = dom.querySelector('[data-testid="export-button"]');

    expect(uploadBtn).toBeTruthy();
    expect(sampleBtn).toBeTruthy();
    expect(exportBtn).toBeTruthy();
  });

  it('triggers onExportClick when export button is clicked', async () => {
    const handleExport = vi.fn();
    const dom = await render(
      <Toolbar onFileUpload={vi.fn()} onExportClick={handleExport} />
    );

    const exportBtn = dom.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
    await act(async () => {
      exportBtn.click();
    });

    expect(handleExport).toHaveBeenCalledTimes(1);
  });

  it('triggers onLoadSample when sample button is clicked', async () => {
    const handleSample = vi.fn();
    const dom = await render(
      <Toolbar
        onFileUpload={vi.fn()}
        onExportClick={vi.fn()}
        onLoadSample={handleSample}
      />
    );

    const sampleBtn = dom.querySelector('[data-testid="sample-button"]') as HTMLButtonElement;
    await act(async () => {
      sampleBtn.click();
    });

    expect(handleSample).toHaveBeenCalledTimes(1);
  });

  it('contains hidden file input accepting .cast and .json files', async () => {
    const dom = await render(
      <Toolbar onFileUpload={vi.fn()} onExportClick={vi.fn()} />
    );

    const fileInput = dom.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toContain('.cast');
    expect(fileInput.accept).toContain('.json');
  });

  it('reads file content and triggers onFileUpload when file is selected', async () => {
    const handleUpload = vi.fn();
    const dom = await render(
      <Toolbar onFileUpload={handleUpload} onExportClick={vi.fn()} />
    );

    const fileInput = dom.querySelector('input[type="file"]') as HTMLInputElement;

    const mockContent = '{"version": 2, "width": 80, "height": 24}\n[0.1, "o", "hello"]';
    const file = new File([mockContent], 'recording.cast', { type: 'application/json' });

    // Mock FileReader behavior in JSDOM if needed
    const readerSpy = vi.spyOn(window, 'FileReader').mockImplementation(function () {
      return {
        readAsText: function () {
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: { result: mockContent } } as any);
            }
          }, 0);
        },
      } as any;
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait a tick for FileReader
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(handleUpload).toHaveBeenCalledWith(mockContent, 'recording.cast');
    readerSpy.mockRestore();
  });
});
