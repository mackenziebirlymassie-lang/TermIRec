export function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-group">
          <h1 className="app-title">TermiRecord</h1>
          <p className="app-subtitle">Terminal Recording Player & Animated SVG Generator</p>
        </div>
      </header>
      <main className="app-main">
        <div className="placeholder-card">
          <h2>Ready for Terminal Recordings</h2>
          <p>Drop a <code>.cast</code> file or select a sample recording to begin playback.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
