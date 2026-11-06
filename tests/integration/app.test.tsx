import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { App } from '../../src/App';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('App Integration', () => {
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
    vi.restoreAllMocks();
  });

  const renderApp = async (): Promise<HTMLDivElement> => {
    await act(async () => {
      root.render(<App />);
    });
    return container;
  };

  it('mounts successfully with bundled demo recording and renders all major regions', async () => {
    const dom = await renderApp();

    // Verify main components rendered
    const toolbar = dom.querySelector('[data-testid="toolbar"]');
    const terminalScreen = dom.querySelector('[data-testid="terminal-screen"]');
    const controlBar = dom.querySelector('[data-testid="control-bar"]');

    expect(toolbar).toBeTruthy();
    expect(terminalScreen).toBeTruthy();
    expect(controlBar).toBeTruthy();

    // Verify demo filename and title
    const filenameEl = dom.querySelector('.toolbar-filename');
    expect(filenameEl?.textContent).toBe('demo.cast');

    const titleEl = dom.querySelector('[data-testid="terminal-title"]');
    expect(titleEl?.textContent).toBe('termirecord build demo');
  });

  it('displays initial demo terminal output on startup', async () => {
    const dom = await renderApp();

    const bodyEl = dom.querySelector('[data-testid="terminal-body"]');
    expect(bodyEl).toBeTruthy();

    // First line should have prompt
    const firstRow = dom.querySelector('.terminal-row[data-row="0"]');
    expect(firstRow?.textContent).toContain('termirecord-app');
    expect(firstRow?.textContent).toContain('git:(main)');
  });

  it('toggles playback status between play and pause from ControlBar', async () => {
    const dom = await renderApp();

    const playBtn = dom.querySelector('[data-testid="play-pause-button"]') as HTMLButtonElement;
    expect(playBtn).toBeTruthy();
    expect(playBtn.getAttribute('aria-label')).toBe('Play');

    // Click Play
    await act(async () => {
      playBtn.click();
    });
    expect(playBtn.getAttribute('aria-label')).toBe('Pause');

    // Click Pause
    await act(async () => {
      playBtn.click();
    });
    expect(playBtn.getAttribute('aria-label')).toBe('Play');
  });

  it('opens and closes ExportModal from Toolbar button', async () => {
    const dom = await renderApp();

    // Modal is initially not in DOM
    expect(dom.querySelector('[data-testid="export-modal"]')).toBeNull();

    // Click Export SVG button
    const exportBtn = dom.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
    expect(exportBtn).toBeTruthy();

    await act(async () => {
      exportBtn.click();
    });

    const modal = dom.querySelector('[data-testid="export-modal"]');
    expect(modal).toBeTruthy();

    // Close via close button
    const closeBtn = dom.querySelector('[data-testid="modal-close"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    await act(async () => {
      closeBtn.click();
    });

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeNull();
  });

  it('opens ExportModal via Ctrl+E keyboard shortcut and closes on Escape', async () => {
    const dom = await renderApp();

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeNull();

    // Trigger Ctrl+E
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true })
      );
    });

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeTruthy();

    // Trigger Escape
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })
      );
    });

    expect(dom.querySelector('[data-testid="export-modal"]')).toBeNull();
  });

  it('manages drag-and-drop state when hovering files over the app', async () => {
    const dom = await renderApp();
    const appRoot = dom.querySelector('[data-testid="app-root"]') as HTMLElement;

    expect(dom.querySelector('[data-testid="drop-overlay"]')).toBeNull();

    // Drag enter with items
    await act(async () => {
      const enterEvent = new Event('dragenter', { bubbles: true });
      Object.defineProperty(enterEvent, 'dataTransfer', {
        value: { items: [{ kind: 'file' }] },
      });
      appRoot.dispatchEvent(enterEvent);
    });

    expect(dom.querySelector('[data-testid="drop-overlay"]')).toBeTruthy();

    // Drag leave
    await act(async () => {
      const leaveEvent = new Event('dragleave', { bubbles: true });
      appRoot.dispatchEvent(leaveEvent);
    });

    expect(dom.querySelector('[data-testid="drop-overlay"]')).toBeNull();
  });

  it('loads new recording via file drop and can restore demo using Load Sample button', async () => {
    const customCast = [
      JSON.stringify({ version: 2, width: 60, height: 15, title: 'Custom Recording' }),
      JSON.stringify([0.0, 'o', 'Custom Terminal Session\r\n']),
      JSON.stringify([1.0, 'o', 'Second Line\r\n']),
    ].join('\n');

    const dom = await renderApp();
    const appRoot = dom.querySelector('[data-testid="app-root"]') as HTMLElement;

    // Simulate drop with custom cast file
    const file = new File([customCast], 'custom-test.cast', { type: 'text/plain' });

    // Mock FileReader to synchronously trigger onload in test
    const originalFileReader = globalThis.FileReader;
    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsText(_f: Blob) {
        setTimeout(() => {
          this.onload?.({ target: { result: customCast } });
        }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      await act(async () => {
        const dropEvent = new Event('drop', { bubbles: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
          value: { files: [file] },
        });
        appRoot.dispatchEvent(dropEvent);
      });

      // Wait for mock FileReader callback
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      // Check that custom file is now loaded
      expect(dom.querySelector('.toolbar-filename')?.textContent).toBe('custom-test.cast');
      expect(dom.querySelector('[data-testid="terminal-title"]')?.textContent).toBe('Custom Recording');

      // Click "Load Sample" button to reload demo
      const sampleBtn = dom.querySelector('[data-testid="sample-button"]') as HTMLButtonElement;
      expect(sampleBtn).toBeTruthy();

      await act(async () => {
        sampleBtn.click();
      });

      // Verify demo is restored
      expect(dom.querySelector('.toolbar-filename')?.textContent).toBe('demo.cast');
      expect(dom.querySelector('[data-testid="terminal-title"]')?.textContent).toBe('termirecord build demo');
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  it('displays and allows dismissing error banner when malformed recording is loaded', async () => {
    const dom = await renderApp();
    const fileInput = dom.querySelector('[data-testid="file-input"]') as HTMLInputElement;

    const invalidContent = 'not valid json at all';
    const badFile = new File([invalidContent], 'corrupt.cast', { type: 'text/plain' });

    const originalFileReader = globalThis.FileReader;
    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsText(_f: Blob) {
        setTimeout(() => {
          this.onload?.({ target: { result: invalidContent } });
        }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      await act(async () => {
        // Mock files property on input
        Object.defineProperty(fileInput, 'files', {
          value: [badFile],
          configurable: true,
        });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      // Error banner should be rendered
      const errorBanner = dom.querySelector('[data-testid="app-error-banner"]');
      expect(errorBanner).toBeTruthy();
      expect(errorBanner?.textContent).toContain('Invalid asciicast recording');

      // Dismiss error
      const dismissBtn = dom.querySelector('.app-error-close') as HTMLButtonElement;
      await act(async () => {
        dismissBtn.click();
      });

      expect(dom.querySelector('[data-testid="app-error-banner"]')).toBeNull();
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });
});
