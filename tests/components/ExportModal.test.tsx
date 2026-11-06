import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ExportModal } from '../../src/components/ExportModal';
import { AsciicastRecording } from '../../src/core/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ExportModal component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleRecording: AsciicastRecording = {
    header: { version: 2, width: 80, height: 24, title: 'Demo Recording' },
    events: [
      { time: 0, type: 'o', data: 'echo "hello"\r\n' },
      { time: 1, type: 'o', data: 'hello\r\n' },
    ],
    duration: 2,
  };

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

  it('renders nothing when isOpen is false', async () => {
    const dom = await render(
      <ExportModal isOpen={false} onClose={vi.fn()} recording={sampleRecording} />
    );

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeNull();
  });

  it('renders modal dialog and preview when isOpen is true', async () => {
    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
    );

    const modal = dom.querySelector('[data-testid="export-modal"]');
    expect(modal).toBeTruthy();

    const preview = dom.querySelector('[data-testid="svg-preview"]');
    expect(preview).toBeTruthy();
    expect(preview?.querySelector('svg')).toBeTruthy();

    const themeSelect = dom.querySelector('[data-testid="theme-select"]') as HTMLSelectElement;
    expect(themeSelect).toBeTruthy();
    expect(themeSelect.value).toBe('dark');

    const loopCheckbox = dom.querySelector('[data-testid="loop-checkbox"]') as HTMLInputElement;
    expect(loopCheckbox).toBeTruthy();
    expect(loopCheckbox.checked).toBe(true);

    const chromeCheckbox = dom.querySelector('[data-testid="chrome-checkbox"]') as HTMLInputElement;
    expect(chromeCheckbox).toBeTruthy();
    expect(chromeCheckbox.checked).toBe(true);

    const fontSizeInput = dom.querySelector('[data-testid="fontsize-input"]') as HTMLInputElement;
    expect(fontSizeInput).toBeTruthy();
    expect(fontSizeInput.value).toBe('14');
  });

  it('triggers onClose when clicking close button or backdrop', async () => {
    const onClose = vi.fn();
    const dom = await render(
      <ExportModal isOpen={true} onClose={onClose} recording={sampleRecording} />
    );

    const closeBtn = dom.querySelector('[data-testid="modal-close"]') as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = dom.querySelector('[data-testid="modal-backdrop"]') as HTMLDivElement;
    await act(async () => {
      backdrop.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not trigger onClose when clicking inside the modal dialog container', async () => {
    const onClose = vi.fn();
    const dom = await render(
      <ExportModal isOpen={true} onClose={onClose} recording={sampleRecording} />
    );

    const dialog = dom.querySelector('[data-testid="export-modal"]') as HTMLDivElement;
    await act(async () => {
      dialog.click();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('triggers onClose when pressing Escape key', async () => {
    const onClose = vi.fn();
    await render(
      <ExportModal isOpen={true} onClose={onClose} recording={sampleRecording} />
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates SVG preview when changing theme', async () => {
    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
    );

    const themeSelect = dom.querySelector('[data-testid="theme-select"]') as HTMLSelectElement;
    const preview = dom.querySelector('[data-testid="svg-preview"]') as HTMLDivElement;

    // Dark theme should contain dark background #1e1e2e
    expect(preview.innerHTML).toContain('#1e1e2e');

    await act(async () => {
      themeSelect.value = 'light';
      themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Light theme background #eff1f5
    expect(preview.innerHTML).toContain('#eff1f5');
  });

  it('updates SVG preview when toggling loop option', async () => {
    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
    );

    const loopCheckbox = dom.querySelector('[data-testid="loop-checkbox"]') as HTMLInputElement;
    const preview = dom.querySelector('[data-testid="svg-preview"]') as HTMLDivElement;

    expect(preview.innerHTML).toContain('infinite');

    await act(async () => {
      loopCheckbox.click();
    });

    expect(preview.innerHTML).toContain('1 forwards');
  });

  it('updates SVG preview when toggling window chrome option', async () => {
    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
    );

    const chromeCheckbox = dom.querySelector('[data-testid="chrome-checkbox"]') as HTMLInputElement;
    const preview = dom.querySelector('[data-testid="svg-preview"]') as HTMLDivElement;

    // With chrome, traffic light dots are present
    expect(preview.innerHTML).toContain('#ff5f56');

    await act(async () => {
      chromeCheckbox.click();
    });

    expect(preview.innerHTML).not.toContain('#ff5f56');
  });

  it('triggers download when Download SVG button is clicked', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    let clickedDownloadAnchor: HTMLAnchorElement | null = null;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedDownloadAnchor = this;
    };

    try {
      const dom = await render(
        <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
      );

      const downloadBtn = dom.querySelector('[data-testid="download-svg-button"]') as HTMLButtonElement;
      await act(async () => {
        downloadBtn.click();
      });

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(clickedDownloadAnchor).not.toBeNull();
      const anchor = clickedDownloadAnchor as unknown as HTMLAnchorElement;
      expect(anchor.download).toBe('recording.svg');
      expect(anchor.href).toBe('blob:http://localhost/test-uuid');
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it('copies SVG markup to clipboard when Copy SVG button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={sampleRecording} />
    );

    const copyBtn = dom.querySelector('[data-testid="copy-svg-button"]') as HTMLButtonElement;
    await act(async () => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('<svg');
    expect(copiedText).toContain('</svg>');
  });

  it('handles null recording gracefully without crashing', async () => {
    const dom = await render(
      <ExportModal isOpen={true} onClose={vi.fn()} recording={null} />
    );

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeTruthy();
    const preview = dom.querySelector('[data-testid="svg-preview"]');
    expect(preview?.textContent).toContain('No recording available');

    const downloadBtn = dom.querySelector('[data-testid="download-svg-button"]') as HTMLButtonElement;
    expect(downloadBtn.disabled).toBe(true);

    const copyBtn = dom.querySelector('[data-testid="copy-svg-button"]') as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
  });
});
