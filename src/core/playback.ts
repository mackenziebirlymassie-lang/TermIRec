import { AsciicastEvent, AsciicastRecording } from './types';
import { TerminalBuffer } from './terminal-buffer';

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'ended';

/**
 * Headless controller and timeline state machine for asciicast playback.
 * Maintains timeline clock, playback status, event dispatching to TerminalBuffer,
 * and deterministic seek reconstruction.
 */
export class PlaybackController {
  private recording: AsciicastRecording;
  private buffer: TerminalBuffer;
  private events: AsciicastEvent[];
  private currentTime: number = 0;
  private speed: number = 1;
  private status: PlaybackStatus = 'idle';
  private eventIndex: number = 0;
  private listeners: Set<() => void> = new Set();

  constructor(recording: AsciicastRecording, buffer: TerminalBuffer) {
    this.recording = recording;
    this.buffer = buffer;
    // Internal events sorted monotonically by timestamp
    this.events = [...recording.events].sort((a, b) => a.time - b.time);
  }

  /**
   * Starts or resumes playback.
   * If the recording has ended or is at the end, restarts from the beginning.
   */
  play(): void {
    if (this.status === 'ended' || this.currentTime >= this.recording.duration) {
      this.seek(0);
    }
    this.status = 'playing';
  }

  /**
   * Pauses active playback.
   */
  pause(): void {
    if (this.status !== 'ended') {
      this.status = 'paused';
    }
  }

  /**
   * Advances timeline clock by deltaTime scaled by current speed.
   * Feeds terminal output and resize events to the buffer, triggers frame callbacks,
   * and transitions to 'ended' when the recording duration is reached.
   *
   * @param deltaTime Elapsed real-time seconds since last tick.
   */
  tick(deltaTime: number): void {
    if (this.status !== 'playing') {
      return;
    }
    if (deltaTime <= 0 || !Number.isFinite(deltaTime)) {
      return;
    }

    const duration = this.recording.duration;
    const newTime = this.currentTime + deltaTime * this.speed;
    const targetTime = duration > 0 ? Math.min(newTime, duration) : 0;

    while (
      this.eventIndex < this.events.length &&
      this.events[this.eventIndex].time <= targetTime
    ) {
      this.applyEvent(this.events[this.eventIndex]);
      this.eventIndex++;
    }

    this.currentTime = targetTime;

    if (this.currentTime >= duration) {
      this.status = 'ended';
    }

    this.notifyFrame();
  }

  /**
   * Seeks to a specific timestamp in seconds.
   * Clamps targetTime to [0, duration].
   * - Forward seeking applies incremental events between current and target time.
   * - Backward seeking resets the buffer to initial header state and replays from 0
   *   for 100% deterministic terminal state.
   * Triggers frame callbacks.
   *
   * @param targetTime Destination timestamp in seconds.
   */
  seek(targetTime: number): void {
    const duration = this.recording.duration;
    const clampedTime = Math.max(0, Math.min(targetTime, duration));

    if (clampedTime < this.currentTime) {
      // Seeking backward: restore initial buffer dimensions and clear state
      this.buffer.resize(this.recording.header.width, this.recording.header.height);
      this.buffer.clear();
      this.eventIndex = 0;
    }

    // Apply events up to target timestamp
    while (
      this.eventIndex < this.events.length &&
      this.events[this.eventIndex].time <= clampedTime
    ) {
      this.applyEvent(this.events[this.eventIndex]);
      this.eventIndex++;
    }

    this.currentTime = clampedTime;

    if (duration > 0 && this.currentTime >= duration) {
      this.status = 'ended';
    } else if (this.status === 'ended') {
      this.status = 'paused';
    }

    this.notifyFrame();
  }

  /**
   * Sets the playback speed multiplier.
   *
   * @param speed Positive finite multiplier (e.g. 0.5, 1, 1.5, 2).
   */
  setSpeed(speed: number): void {
    if (speed > 0 && Number.isFinite(speed)) {
      this.speed = speed;
    }
  }

  /**
   * Returns current playback time in seconds.
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Returns current playback speed multiplier.
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Returns current state machine status.
   */
  getStatus(): PlaybackStatus {
    return this.status;
  }

  /**
   * Returns the underlying recording.
   */
  getRecording(): AsciicastRecording {
    return this.recording;
  }

  /**
   * Returns the underlying terminal buffer.
   */
  getBuffer(): TerminalBuffer {
    return this.buffer;
  }

  /**
   * Registers a callback invoked whenever the buffer or timeline updates
   * (on tick during playback or on seek).
   *
   * @param callback Listener function.
   * @returns Unsubscribe function to remove the listener.
   */
  onFrame(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyFrame(): void {
    const callbacks = Array.from(this.listeners);
    for (const callback of callbacks) {
      try {
        callback();
      } catch {
        // Prevent listener failures from disrupting the playback state machine
      }
    }
  }

  private applyEvent(event: AsciicastEvent): void {
    if (event.type === 'o') {
      this.buffer.write(event.data);
    } else if (event.type === 'r') {
      const parts = event.data.split('x');
      if (parts.length === 2) {
        const cols = parseInt(parts[0].trim(), 10);
        const rows = parseInt(parts[1].trim(), 10);
        if (!isNaN(cols) && !isNaN(rows) && cols > 0 && rows > 0) {
          this.buffer.resize(cols, rows);
        }
      }
    }
    // Type 'i' (stdin input) is intentionally ignored for terminal visual playback
  }
}
