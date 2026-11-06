import React, { useRef } from 'react';
import { Terminal, Upload, Download, Sparkles } from 'lucide-react';

export interface ToolbarProps {
  onFileUpload: (content: string, filename: string) => void;
  onExportClick: () => void;
  onLoadSample?: () => void;
  fileName?: string;
  className?: string;
}

export function Toolbar({
  onFileUpload,
  onExportClick,
  onLoadSample,
  fileName,
  className = '',
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        onFileUpload(content, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className={`toolbar ${className}`.trim()} data-testid="toolbar">
      <div className="toolbar-brand">
        <div className="toolbar-logo">
          <Terminal size={20} className="toolbar-logo-icon" />
        </div>
        <div className="toolbar-info">
          <span className="toolbar-title">TermiRecord</span>
          {fileName && (
            <span className="toolbar-filename" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      </div>

      <div className="toolbar-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".cast,.json,application/json,text/plain"
          style={{ display: 'none' }}
          data-testid="file-input"
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="btn btn-secondary"
          data-testid="upload-button"
          onClick={handleUploadClick}
          title="Open .cast recording"
        >
          <Upload size={15} />
          <span>Open .cast</span>
        </button>

        {onLoadSample && (
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="sample-button"
            onClick={onLoadSample}
            title="Load demo sample recording"
          >
            <Sparkles size={15} />
            <span>Load Sample</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-primary"
          data-testid="export-button"
          onClick={onExportClick}
          title="Export recording as animated SVG"
        >
          <Download size={15} />
          <span>Export SVG</span>
        </button>
      </div>
    </header>
  );
}

export default Toolbar;
