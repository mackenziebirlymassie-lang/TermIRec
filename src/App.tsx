import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, AlertCircle, X } from 'lucide-react';
import { parseAsciicast } from './core/parser';
import { TerminalBuffer } from './core/terminal-buffer';
import { PlaybackController } from './core/playback';
import { AsciicastRecording } from './core/types';
import { Toolbar } from './components/Toolbar';
import { TerminalScreen } from './components/TerminalScreen';
import { ControlBar } from './components/ControlBar';
import { ExportModal } from './components/ExportModal';
import { DEMO_CAST_STRING } from './samples/demo.cast';

interface AppSession {
  recording: AsciicastRecording;
  buffer: TerminalBuffer;
  controller: PlaybackController;
  fileName: string;
}

function createSession(content: string, fileName: string): AppSession {
  const recording = parseAsciicast(content);
  const buffer = new TerminalBuffer(recording.header.width, recording.header.height);
  const controller = new PlaybackController(recording, buffer);
  controller.seek(0);
  return { recording, buffer, controller, fileName };
}

export function App() {
  const [session, setSession] = useState<AppSession>(() => {
    return createSession(DEMO_CAST_STRING, 'demo.cast');
  });
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFrameTick] = useState<number>(0);

  const dragCounterRef = useRef<number>(0);

  const { recording, buffer, controller, fileName } = session;

  // Subscribe to controller frame notifications to re-render TerminalScreen on buffer updates
  useEffect(() => {
    if (!controller) return;
    const unsubscribe = controller.onFrame(() => {
      setFrameTick((t) => t + 1);
    });
    return unsubscribe;
  }, [controller]);

  // RequestAnimationFrame tick loop driven by controller playback status
  useEffect(() => {
    if (!controller) return;

    let animId: number;
    let lastTime: number | null = null;

    const loop = (timestamp: number) => {
      if (lastTime !== null) {
        const deltaSeconds = (timestamp - lastTime) / 1000;
        if (controller.getStatus() === 'playing') {
          // Safeguard against large deltas from inactive background tabs
          if (deltaSeconds > 0 && deltaSeconds < 1) {
            controller.tick(deltaSeconds);
          }
        }
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [controller]);

  // Prevent default browser drag-over behavior on window
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Global keyboard shortcuts (e.g., Ctrl/Cmd+E for export)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadRecordingContent = useCallback((content: string, name: string) => {
    try {
      const nextSession = createSession(content, name);
      setSession(nextSession);
      setError(null);
    } catch (err) {
      console.error('Failed to load recording:', err);
      setError(err instanceof Error ? err.message : 'Invalid asciicast recording file');
    }
  }, []);

  const handleFileUpload = useCallback(
    (content: string, name: string) => {
      loadRecordingContent(content, name);
    },
    [loadRecordingContent]
  );

  const handleLoadSample = useCallback(() => {
    loadRecordingContent(DEMO_CAST_STRING, 'demo.cast');
  }, [loadRecordingContent]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        loadRecordingContent(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="app-container"
      data-testid="app-root"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar
        fileName={fileName}
        onFileUpload={handleFileUpload}
        onExportClick={() => setIsExportOpen(true)}
        onLoadSample={handleLoadSample}
      />

      <main className="app-main" data-testid="app-main">
        {error && (
          <div className="app-error-banner" data-testid="app-error-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="app-error-close"
              aria-label="Dismiss error"
              onClick={() => setError(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div
          className="terminal-workspace"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: '920px',
          }}
        >
          <TerminalScreen
            buffer={buffer}
            title={recording.header.title || fileName || 'Terminal'}
            theme="dark"
          />

          <ControlBar
            controller={controller}
            recording={recording}
          />
        </div>
      </main>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        recording={recording}
      />

      {isDragging && (
        <div className="drop-overlay" data-testid="drop-overlay">
          <div className="drop-overlay-box">
            <Upload size={44} style={{ color: 'var(--accent)' }} />
            <div className="drop-overlay-title">Drop your .cast recording here</div>
            <div className="drop-overlay-subtitle">Asciicast v2 format supported</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
