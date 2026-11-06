import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackController } from '../../src/core/playback';
import { TerminalBuffer } from '../../src/core/terminal-buffer';
import { AsciicastRecording } from '../../src/core/types';

describe('PlaybackController', () => {
  const createMockRecording = (
    overrides?: Partial<AsciicastRecording>
  ): AsciicastRecording => {
    const events = overrides?.events ?? [
      { time: 1.0, type: 'o', data: 'Hello ' },
      { time: 2.0, type: 'o', data: 'World' },
      { time: 3.0, type: 'r', data: '100x30' },
      { time: 4.0, type: 'o', data: '!' },
    ];
    return {
      header: {
        version: 2,
        width: 80,
        height: 24,
        ...overrides?.header,
      },
      events,
      duration: overrides?.duration ?? (events.length > 0 ? events[events.length - 1].time : 0),
    };
  };

  let recording: AsciicastRecording;
  let buffer: TerminalBuffer;
  let controller: PlaybackController;

  beforeEach(() => {
    recording = createMockRecording();
    buffer = TerminalBuffer.fromHeader(recording.header);
    controller = new PlaybackController(recording, buffer);
  });

  describe('Initial State', () => {
    it('initializes with idle status, time 0, and speed 1', () => {
      expect(controller.getStatus()).toBe('idle');
      expect(controller.getCurrentTime()).toBe(0);
      expect(controller.getSpeed()).toBe(1);
      expect(controller.getRecording()).toBe(recording);
      expect(controller.getBuffer()).toBe(buffer);
    });

    it('initializes terminal buffer with empty lines matching header dimensions', () => {
      expect(buffer.cols).toBe(80);
      expect(buffer.rows).toBe(24);
      expect(buffer.getLines()[0]).toBe('');
    });
  });

  describe('Play and Pause State Transitions', () => {
    it('sets status to playing on play()', () => {
      controller.play();
      expect(controller.getStatus()).toBe('playing');
    });

    it('sets status to paused on pause()', () => {
      controller.play();
      controller.pause();
      expect(controller.getStatus()).toBe('paused');
    });

    it('can resume playing after pause()', () => {
      controller.play();
      controller.pause();
      controller.play();
      expect(controller.getStatus()).toBe('playing');
    });

    it('calling pause() while idle sets status to paused', () => {
      controller.pause();
      expect(controller.getStatus()).toBe('paused');
    });
  });

  describe('Tick Behavior', () => {
    it('does not advance time or write to buffer when status is idle or paused', () => {
      controller.tick(1.5);
      expect(controller.getCurrentTime()).toBe(0);
      expect(buffer.getLines()[0]).toBe('');

      controller.pause();
      controller.tick(1.5);
      expect(controller.getCurrentTime()).toBe(0);
      expect(buffer.getLines()[0]).toBe('');
    });

    it('advances currentTime by deltaTime when playing at 1x speed', () => {
      controller.play();
      controller.tick(0.5);
      expect(controller.getCurrentTime()).toBeCloseTo(0.5);

      controller.tick(0.4);
      expect(controller.getCurrentTime()).toBeCloseTo(0.9);
    });

    it('feeds output events (type "o") to buffer.write at the appropriate timestamps', () => {
      controller.play();

      // At 0.8s, first event at 1.0s should not have fired yet
      controller.tick(0.8);
      expect(buffer.getLines()[0]).toBe('');

      // Advance past 1.0s, first event should fire
      controller.tick(0.3); // now 1.1s
      expect(controller.getCurrentTime()).toBeCloseTo(1.1);
      expect(buffer.getLines()[0]).toBe('Hello');

      // Advance past 2.0s, second event should fire
      controller.tick(1.0); // now 2.1s
      expect(buffer.getLines()[0]).toBe('Hello World');
    });

    it('fires multiple events in order if deltaTime encompasses them', () => {
      controller.play();
      // Advance directly to 2.5s, firing events at 1.0 and 2.0
      controller.tick(2.5);
      expect(buffer.getLines()[0]).toBe('Hello World');
    });

    it('ignores input events (type "i") during playback', () => {
      const rec = createMockRecording({
        events: [
          { time: 0.5, type: 'i', data: 'user_typed' },
          { time: 1.0, type: 'o', data: 'response' },
        ],
        duration: 1.0,
      });
      const buf = TerminalBuffer.fromHeader(rec.header);
      const ctrl = new PlaybackController(rec, buf);

      ctrl.play();
      ctrl.tick(1.0);
      expect(buf.getLines()[0]).toBe('response');
    });

    it('triggers onFrame callbacks on tick when playing', () => {
      const onFrameSpy = vi.fn();
      controller.onFrame(onFrameSpy);

      controller.play();
      controller.tick(0.5);

      expect(onFrameSpy).toHaveBeenCalledTimes(1);

      controller.tick(0.5);
      expect(onFrameSpy).toHaveBeenCalledTimes(2);
    });

    it('does not trigger onFrame callbacks on tick when not playing', () => {
      const onFrameSpy = vi.fn();
      controller.onFrame(onFrameSpy);

      controller.tick(0.5);
      expect(onFrameSpy).not.toHaveBeenCalled();
    });
  });

  describe('Speed Multiplier', () => {
    it('updates speed multiplier via setSpeed', () => {
      controller.setSpeed(1.5);
      expect(controller.getSpeed()).toBe(1.5);

      controller.setSpeed(2);
      expect(controller.getSpeed()).toBe(2);

      controller.setSpeed(0.5);
      expect(controller.getSpeed()).toBe(0.5);
    });

    it('advances currentTime scaled by speed multiplier on tick', () => {
      controller.setSpeed(2);
      controller.play();

      controller.tick(0.5); // 0.5 * 2 = 1.0s
      expect(controller.getCurrentTime()).toBeCloseTo(1.0);
      expect(buffer.getLines()[0]).toBe('Hello');
    });

    it('ignores non-positive or non-finite speed values', () => {
      controller.setSpeed(2);
      controller.setSpeed(0);
      expect(controller.getSpeed()).toBe(2);

      controller.setSpeed(-1);
      expect(controller.getSpeed()).toBe(2);

      controller.setSpeed(NaN);
      expect(controller.getSpeed()).toBe(2);

      controller.setSpeed(Infinity);
      expect(controller.getSpeed()).toBe(2);
    });
  });

  describe('Playback End and Replay', () => {
    it('transitions to ended status and clamps currentTime to duration when reached', () => {
      controller.play();
      controller.tick(3.9);
      expect(controller.getStatus()).toBe('playing');

      controller.tick(0.5); // 3.9 + 0.5 = 4.4, duration is 4.0
      expect(controller.getCurrentTime()).toBe(4.0);
      expect(controller.getStatus()).toBe('ended');
      expect(buffer.getLines()[0]).toBe('Hello World!');
    });

    it('does not advance further on tick once ended', () => {
      controller.play();
      controller.tick(5.0);
      expect(controller.getStatus()).toBe('ended');
      expect(controller.getCurrentTime()).toBe(4.0);

      controller.tick(1.0);
      expect(controller.getCurrentTime()).toBe(4.0);
      expect(controller.getStatus()).toBe('ended');
    });

    it('calling play() when ended wraps and restarts playback from time 0', () => {
      controller.play();
      controller.tick(5.0);
      expect(controller.getStatus()).toBe('ended');
      expect(buffer.getLines()[0]).toBe('Hello World!');

      // Replay
      controller.play();
      expect(controller.getStatus()).toBe('playing');
      expect(controller.getCurrentTime()).toBe(0);
      expect(buffer.getLines()[0]).toBe('');

      // Can tick forward again
      controller.tick(1.5);
      expect(controller.getCurrentTime()).toBeCloseTo(1.5);
      expect(buffer.getLines()[0]).toBe('Hello');
    });
  });

  describe('Seeking Behavior', () => {
    it('clamps seeking time to [0, duration]', () => {
      controller.seek(-5);
      expect(controller.getCurrentTime()).toBe(0);

      controller.seek(100);
      expect(controller.getCurrentTime()).toBe(4.0);
    });

    it('seeking forward executes intermediate events without clearing buffer', () => {
      const clearSpy = vi.spyOn(buffer, 'clear');

      controller.seek(1.5);
      expect(clearSpy).not.toHaveBeenCalled();
      expect(controller.getCurrentTime()).toBe(1.5);
      expect(buffer.getLines()[0]).toBe('Hello');

      controller.seek(2.5);
      expect(clearSpy).not.toHaveBeenCalled();
      expect(controller.getCurrentTime()).toBe(2.5);
      expect(buffer.getLines()[0]).toBe('Hello World');
    });

    it('seeking backward resets buffer to initial state and replays events from 0 deterministically', () => {
      // Seek forward first
      controller.seek(2.5);
      expect(buffer.getLines()[0]).toBe('Hello World');

      const clearSpy = vi.spyOn(buffer, 'clear');

      // Seek backward to 1.5
      controller.seek(1.5);
      expect(clearSpy).toHaveBeenCalled();
      expect(controller.getCurrentTime()).toBe(1.5);
      expect(buffer.getLines()[0]).toBe('Hello');

      // Seek backward to 0.5 (before any events)
      controller.seek(0.5);
      expect(controller.getCurrentTime()).toBe(0.5);
      expect(buffer.getLines()[0]).toBe('');
    });

    it('triggers onFrame callback on seek', () => {
      const onFrameSpy = vi.fn();
      controller.onFrame(onFrameSpy);

      controller.seek(1.5);
      expect(onFrameSpy).toHaveBeenCalledTimes(1);

      controller.seek(0.5);
      expect(onFrameSpy).toHaveBeenCalledTimes(2);
    });

    it('seeking to duration sets status to ended', () => {
      controller.play();
      controller.seek(4.0);
      expect(controller.getStatus()).toBe('ended');
      expect(controller.getCurrentTime()).toBe(4.0);
    });

    it('seeking backward when ended transitions status to paused', () => {
      controller.play();
      controller.tick(5.0);
      expect(controller.getStatus()).toBe('ended');

      controller.seek(2.0);
      expect(controller.getStatus()).toBe('paused');
      expect(controller.getCurrentTime()).toBe(2.0);
      expect(buffer.getLines()[0]).toBe('Hello World');
    });
  });

  describe('Resize Events', () => {
    it('handles resize event (type "r") with format "colsxrows"', () => {
      controller.play();

      // Before resize at 3.0s
      controller.tick(2.5);
      expect(buffer.cols).toBe(80);
      expect(buffer.rows).toBe(24);

      // Advance past resize event at 3.0s
      controller.tick(0.6); // 3.1s
      expect(buffer.cols).toBe(100);
      expect(buffer.rows).toBe(30);
    });

    it('seeking backward across a resize resets dimensions back to header dimensions', () => {
      controller.seek(3.5);
      expect(buffer.cols).toBe(100);
      expect(buffer.rows).toBe(30);

      // Seek back before the resize event
      controller.seek(1.5);
      expect(buffer.cols).toBe(80);
      expect(buffer.rows).toBe(24);
      expect(buffer.getLines()[0]).toBe('Hello');
    });
  });

  describe('Listener Management (onFrame)', () => {
    it('supports multiple listeners and calling all of them', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      controller.onFrame(fn1);
      controller.onFrame(fn2);

      controller.seek(1.0);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes listeners via the returned callback', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const unsub1 = controller.onFrame(fn1);
      controller.onFrame(fn2);

      controller.seek(1.0);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      unsub1();

      controller.seek(2.0);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(2);
    });

    it('survives exceptions thrown inside listener callbacks', () => {
      const throwingListener = vi.fn(() => {
        throw new Error('Listener failed');
      });
      const regularListener = vi.fn();

      controller.onFrame(throwingListener);
      controller.onFrame(regularListener);

      expect(() => controller.seek(1.0)).not.toThrow();
      expect(throwingListener).toHaveBeenCalledTimes(1);
      expect(regularListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles events at timestamp 0', () => {
      const rec = createMockRecording({
        events: [
          { time: 0, type: 'o', data: 'Prompt> ' },
          { time: 1.0, type: 'o', data: 'ls' },
        ],
        duration: 1.0,
      });
      const buf = TerminalBuffer.fromHeader(rec.header);
      const ctrl = new PlaybackController(rec, buf);

      // Seeking to 0 or tick advances to 0 should execute event at 0
      ctrl.seek(0);
      expect(buf.getLines()[0]).toBe('Prompt>');
    });

    it('handles empty recording with 0 events and 0 duration', () => {
      const rec = createMockRecording({
        events: [],
        duration: 0,
      });
      const buf = TerminalBuffer.fromHeader(rec.header);
      const ctrl = new PlaybackController(rec, buf);

      expect(ctrl.getCurrentTime()).toBe(0);
      expect(ctrl.getStatus()).toBe('idle');

      ctrl.play();
      // Tick with 0 duration should transition to ended
      ctrl.tick(0.1);
      expect(ctrl.getStatus()).toBe('ended');
      expect(ctrl.getCurrentTime()).toBe(0);
    });

    it('ignores non-positive deltaTime in tick()', () => {
      controller.play();
      controller.tick(0);
      expect(controller.getCurrentTime()).toBe(0);

      controller.tick(-1);
      expect(controller.getCurrentTime()).toBe(0);
    });
  });
});
