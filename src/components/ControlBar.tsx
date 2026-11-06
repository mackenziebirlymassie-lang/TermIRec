import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { PlaybackController, PlaybackStatus } from '../core/playback';
import { AsciicastRecording } from '../core/types';

export interface ControlBarProps {
  controller: PlaybackController;
  recording: AsciicastRecording;
  onRestart?: () => void;
  className?: string;
}

/**
 * Formats a time duration in seconds into MM:SS format.
 */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ControlBar({
  controller,
  recording,
  onRestart,
  className = '',
}: ControlBarProps) {
  const [currentTime, setCurrentTime] = useState<number>(() => controller.getCurrentTime());
  const [status, setStatus] = useState<PlaybackStatus>(() => controller.getStatus());
  const [speed, setSpeed] = useState<number>(() => controller.getSpeed());

  const syncState = useCallback(() => {
    setCurrentTime(controller.getCurrentTime());
    setStatus(controller.getStatus());
    setSpeed(controller.getSpeed());
  }, [controller]);

  useEffect(() => {
    syncState();
    const unsubscribe = controller.onFrame(() => {
      syncState();
    });
    return unsubscribe;
  }, [controller, syncState]);

  const handlePlayPause = useCallback(() => {
    const currentStatus = controller.getStatus();
    if (currentStatus === 'playing') {
      controller.pause();
    } else if (currentStatus === 'ended') {
      if (onRestart) {
        onRestart();
      } else {
        controller.play();
      }
    } else {
      controller.play();
    }
    syncState();
  }, [controller, onRestart, syncState]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const target = parseFloat((e.target as HTMLInputElement).value);
    controller.seek(target);
    syncState();
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSpeed = parseFloat(e.target.value);
    controller.setSpeed(newSpeed);
    syncState();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT')
      ) {
        if (active.getAttribute('data-testid') !== 'scrubber') {
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        controller.seek(Math.max(0, controller.getCurrentTime() - 5));
        syncState();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        controller.seek(Math.min(recording.duration, controller.getCurrentTime() + 5));
        syncState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controller, recording.duration, handlePlayPause, syncState]);

  const duration = recording.duration || 0;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const isEnded = status === 'ended';
  const isPlaying = status === 'playing';

  const playButtonLabel = isPlaying ? 'Pause' : isEnded ? 'Replay' : 'Play';

  return (
    <div
      className={`control-bar ${className}`.trim()}
      data-testid="control-bar"
      role="region"
      aria-label="Playback controls"
    >
      <button
        type="button"
        className="control-btn control-btn-play"
        data-testid="play-pause-button"
        aria-label={playButtonLabel}
        title={playButtonLabel}
        onClick={handlePlayPause}
      >
        {isPlaying ? (
          <Pause size={18} className="control-icon" />
        ) : isEnded ? (
          <RotateCcw size={18} className="control-icon" />
        ) : (
          <Play size={18} className="control-icon" />
        )}
      </button>

      <div className="control-scrubber-container">
        <input
          type="range"
          className="control-scrubber"
          data-testid="scrubber"
          min={0}
          max={duration}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          onInput={handleSeek}
          aria-label="Timeline scrubber"
          style={
            {
              '--progress-percent': `${progressPercent}%`,
            } as React.CSSProperties
          }
        />
      </div>

      <div className="control-time" data-testid="time-display" aria-label="Playback time">
        <span className="control-time-current">{formatTime(currentTime)}</span>
        <span className="control-time-divider"> / </span>
        <span className="control-time-duration">{formatTime(duration)}</span>
      </div>

      <div className="control-speed-wrapper">
        <select
          className="control-speed-select"
          data-testid="speed-select"
          value={speed.toString()}
          onChange={handleSpeedChange}
          aria-label="Playback speed"
        >
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
    </div>
  );
}
