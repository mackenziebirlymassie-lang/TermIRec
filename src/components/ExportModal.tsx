import { useState, useMemo, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { AsciicastRecording } from '../core/types';
import { exportToAnimatedSvg, SvgTheme } from '../core/svg-exporter';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recording: AsciicastRecording | null;
  className?: string;
}

export function ExportModal({
  isOpen,
  onClose,
  recording,
  className = '',
}: ExportModalProps) {
  const [theme, setTheme] = useState<SvgTheme>('dark');
  const [loop, setLoop] = useState<boolean>(true);
  const [windowChrome, setWindowChrome] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(14);
  const [copied, setCopied] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Compute live SVG markup
  const svgContent = useMemo(() => {
    if (!recording) return '';
    try {
      return exportToAnimatedSvg(recording, {
        theme,
        loop,
        windowChrome,
        fontSize,
      });
    } catch (err) {
      console.error('Failed to export animated SVG:', err);
      return '';
    }
  }, [recording, theme, loop, windowChrome, fontSize]);

  if (!isOpen) {
    return null;
  }

  const handleDownload = () => {
    if (!recording || !svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recording.svg';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!recording || !svgContent) return;
    try {
      await navigator.clipboard.writeText(svgContent);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy SVG to clipboard:', err);
    }
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`modal-dialog ${className}`.trim()}
        data-testid="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="export-modal-title" className="modal-title">
            Export Animated SVG
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            data-testid="modal-close"
            aria-label="Close export modal"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-settings">
            <div className="modal-setting-group">
              <label htmlFor="export-theme-select" className="modal-label">
                Color Theme
              </label>
              <select
                id="export-theme-select"
                className="modal-select"
                data-testid="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as SvgTheme)}
              >
                <option value="dark">Dark (Catppuccin)</option>
                <option value="light">Light (Catppuccin Latte)</option>
                <option value="tokyo-night">Tokyo Night</option>
              </select>
            </div>

            <div className="modal-setting-group">
              <label htmlFor="export-font-size" className="modal-label">
                Font Size (px)
              </label>
              <input
                id="export-font-size"
                type="number"
                className="modal-input"
                data-testid="fontsize-input"
                min={8}
                max={32}
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 14)}
              />
            </div>

            <div className="modal-checkboxes">
              <label className="modal-checkbox-label">
                <input
                  type="checkbox"
                  className="modal-checkbox"
                  data-testid="loop-checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                <span>Loop Animation</span>
              </label>

              <label className="modal-checkbox-label">
                <input
                  type="checkbox"
                  className="modal-checkbox"
                  data-testid="chrome-checkbox"
                  checked={windowChrome}
                  onChange={(e) => setWindowChrome(e.target.checked)}
                />
                <span>macOS Window Chrome</span>
              </label>
            </div>
          </div>

          <div className="modal-preview-section">
            <div className="modal-preview-header">
              <span className="modal-preview-label">Live Preview</span>
            </div>
            <div
              className="modal-preview-container"
              data-testid="svg-preview"
            >
              {recording && svgContent ? (
                <div
                  className="modal-preview-svg"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div className="modal-preview-empty">No recording available</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="copy-svg-button"
            onClick={handleCopy}
            disabled={!recording}
            title="Copy SVG to clipboard"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy SVG'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            data-testid="download-svg-button"
            onClick={handleDownload}
            disabled={!recording}
            title="Download SVG file"
          >
            <Download size={16} />
            <span>Download SVG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
