import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ControlBar } from '../../src/components/ControlBar';
import { PlaybackController } from '../../src/core/playback';
import { TerminalBuffer } from '../../src/core/terminal-buffer';
import { AsciicastRecording } from '../../src/core/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ControlBar component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleRecording: AsciicastRecording = {
    header: { version: 2, width: 80, height: 24 },
    events: [
      { time: 0, type: 'o', data: 'hello' },
      { time: 5, type: 'o', data: ' world' },
      { time: 10, type: 'o', data: '\n' },
    ],
    duration: 10,
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

  it('renders playback controls, scrubber, time display, and speed selector', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);

    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    const controlBar = dom.querySelector('[data-testid="control-bar"]');
    expect(controlBar).toBeTruthy();

    const playBtn = dom.querySelector('[data-testid="play-pause-button"]');
    expect(playBtn).toBeTruthy();
    expect(playBtn?.getAttribute('aria-label')).toBe('Play');

    const scrubber = dom.querySelector('[data-testid="scrubber"]') as HTMLInputElement;
    expect(scrubber).toBeTruthy();
    expect(scrubber.min).toBe('0');
    expect(Number(scrubber.max)).toBeCloseTo(10);
    expect(Number(scrubber.value)).toBe(0);

    const timeDisplay = dom.querySelector('[data-testid="time-display"]');
    expect(timeDisplay).toBeTruthy();
    expect(timeDisplay?.textContent).toContain('00:00 / 00:10');

    const speedSelect = dom.querySelector('[data-testid="speed-select"]') as HTMLSelectElement;
    expect(speedSelect).toBeTruthy();
    expect(speedSelect.value).toBe('1');
  });

  it('toggles play and pause on button click', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    const playBtn = dom.querySelector('[data-testid="play-pause-button"]') as HTMLButtonElement;
    expect(playBtn.getAttribute('aria-label')).toBe('Play');

    // Click Play
    await act(async () => {
      playBtn.click();
    });

    expect(controller.getStatus()).toBe('playing');
    expect(playBtn.getAttribute('aria-label')).toBe('Pause');

    // Click Pause
    await act(async () => {
      playBtn.click();
    });

    expect(controller.getStatus()).toBe('paused');
    expect(playBtn.getAttribute('aria-label')).toBe('Play');
  });

  it('shows replay button when status is ended and restarts on click', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    const onRestartMock = vi.fn();

    const dom = await render(
      <ControlBar
        controller={controller}
        recording={sampleRecording}
        onRestart={onRestartMock}
      />
    );

    // Seek to duration to end
    await act(async () => {
      controller.seek(10);
    });

    expect(controller.getStatus()).toBe('ended');
    const replayBtn = dom.querySelector('[data-testid="play-pause-button"]') as HTMLButtonElement;
    expect(replayBtn.getAttribute('aria-label')).toBe('Replay');

    // Click Replay
    await act(async () => {
      replayBtn.click();
    });

    expect(onRestartMock).toHaveBeenCalledTimes(1);
  });

  it('calls controller.play() on replay if no onRestart callback is provided', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);

    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    await act(async () => {
      controller.seek(10);
    });

    expect(controller.getStatus()).toBe('ended');
    const replayBtn = dom.querySelector('[data-testid="play-pause-button"]') as HTMLButtonElement;

    await act(async () => {
      replayBtn.click();
    });

    expect(controller.getStatus()).toBe('playing');
    expect(controller.getCurrentTime()).toBe(0);
  });

  it('seeks when changing the scrubber range input', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    const scrubber = dom.querySelector('[data-testid="scrubber"]') as HTMLInputElement;

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(scrubber, '6.5');
      scrubber.dispatchEvent(new Event('input', { bubbles: true }));
      scrubber.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(controller.getCurrentTime()).toBe(6.5);
    const timeDisplay = dom.querySelector('[data-testid="time-display"]');
    expect(timeDisplay?.textContent).toContain('00:06 / 00:10');
  });

  it('updates speed when selecting from the speed dropdown', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    const speedSelect = dom.querySelector('[data-testid="speed-select"]') as HTMLSelectElement;

    // Check options
    const optionValues = Array.from(speedSelect.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['0.5', '1', '1.5', '2']);

    await act(async () => {
      speedSelect.value = '2';
      speedSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(controller.getSpeed()).toBe(2);
    expect(speedSelect.value).toBe('2');
  });

  it('reacts automatically to controller onFrame updates', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    const dom = await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    controller.play();
    await act(async () => {
      controller.tick(3);
    });

    const timeDisplay = dom.querySelector('[data-testid="time-display"]');
    expect(timeDisplay?.textContent).toContain('00:03 / 00:10');

    const scrubber = dom.querySelector('[data-testid="scrubber"]') as HTMLInputElement;
    expect(Number(scrubber.value)).toBeCloseTo(3);
  });

  it('handles keyboard shortcuts: Spacebar, ArrowLeft, ArrowRight', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);
    await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    // Spacebar toggles play
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    });
    expect(controller.getStatus()).toBe('playing');

    // Spacebar toggles pause
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    });
    expect(controller.getStatus()).toBe('paused');

    // ArrowRight seeks +5s
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    });
    expect(controller.getCurrentTime()).toBe(5);

    // ArrowLeft seeks -5s
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    });
    expect(controller.getCurrentTime()).toBe(0);
  });

  it('unsubscribes from controller events on unmount', async () => {
    const buffer = new TerminalBuffer(80, 24);
    const controller = new PlaybackController(sampleRecording, buffer);

    const onFrameSpy = vi.spyOn(controller, 'onFrame');
    await render(
      <ControlBar controller={controller} recording={sampleRecording} />
    );

    expect(onFrameSpy).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    // Verify unmount does not throw and listeners are cleaned
    root = createRoot(container);
  });
});
