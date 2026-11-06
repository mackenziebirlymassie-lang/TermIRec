# TermiRecord

> **Terminal Session Player & Animated SVG Generator**  
> A lightweight, local-first web application and standalone headless engine for playing terminal recordings (`asciicast v2`) and exporting them into clean, keyframe-animated vector SVGs and web embeds.

[![Tests](https://img.shields.io/badge/tests-157%20passing-brightgreen.svg)](#test-suite)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](#architecture)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](#architecture)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](#architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Local-First & 100% Private:** Operates entirely in the browser using client-side `FileReader` and pure vector generation. Zero telemetry, cookies, or remote server requests.
- **Asciicast v2 Parser:** Resilient streaming parser for standard `.cast` newline-delimited JSON recordings with automatic timestamp sorting, CRLF normalization, and junk line filtering.
- **Full ANSI & VT100 Buffer Emulation:**
  - 16 standard and bright colors, 256-color palette (color cube & grayscale ramp), and 24-bit TrueColor RGB (`\x1b[38;2;R;G;Bm`).
  - Text formatting: bold, dim, italic, underline, and inverse video.
  - Cursor positioning (`H`, `f`, `A`, `B`, `C`, `D`, `G`, `d`), line clearing (`K`), display clearing (`J`), and save/restore cursor (`s`/`u`, `ESC 7`/`ESC 8`).
- **Interactive Playback Controller:**
  - Dynamic playback rate scaling (`0.5x`, `1x`, `1.5x`, `2x`).
  - Timeline scrubber with real-time frame seeking.
  - Deterministic state reconstruction when scrubbing backwards (automatic buffer reset and re-simulation).
  - Terminal dimension resize event (`"r"`) handling.
- **Animated Vector SVG Exporter:**
  - Generates self-contained standalone vector SVGs using pure CSS `@keyframes`.
  - Configurable themes: **Dark**, **Light**, and **Tokyo Night**.
  - Optional macOS window chrome with traffic light controls.
  - Automatic frame snapshot deduplication to minimize SVG payload size.
  - Instant `.svg` Blob download and clipboard copy actions.
- **Keyboard-First Shortcuts:**
  - `Space`: Play / Pause toggle.
  - `←` / `→`: Seek backward / forward 5 seconds.
  - `Ctrl + E` / `Cmd + E`: Open SVG Export dialog.

---

## Getting Started

### Prerequisites
- Node.js 20+ (recommended v24+)
- npm 10+ (recommended v11+)

### Installation
```bash
git clone https://github.com/mackenziebirlymassie-lang/TermIRec.git
cd TermIRec
npm install
```

### Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The app launches immediately with a bundled demo recording ready to play.

### Production Build
Build optimized production static assets:
```bash
npm run build
```

---

## Test Suite

TermiRecord includes extensive unit and integration tests verifying the parser, terminal buffer state machine, playback timing, and SVG export algorithms.

```bash
# Run all tests via Vitest
npm test

# Run tests in watch mode
npm run test:watch

# Validate TypeScript types
npm run typecheck
```

---

## Architecture

TermiRecord is architected with a strict separation of concerns between its **headless engine** and its **reactive UI layer**:

```
TermiRecord/
├── src/
│   ├── core/                    # Headless engine (zero React or DOM dependencies)
│   │   ├── types.ts             # Asciicast types & event contracts
│   │   ├── parser.ts            # Asciicast v2 JSONL streaming parser
│   │   ├── terminal-buffer.ts   # ANSI grid buffer & VT100 state machine
│   │   ├── playback.ts          # Timeline scheduler & seek reconstructor
│   │   └── svg-exporter.ts      # Vector SVG & CSS keyframe generator
│   ├── components/              # Reactive UI shell (React 19)
│   │   ├── TerminalScreen.tsx   # Monospace terminal viewport & macOS chrome
│   │   ├── ControlBar.tsx       # Timeline slider, speed, & media controls
│   │   ├── Toolbar.tsx          # Branding, file loader, & export triggers
│   │   └── ExportModal.tsx      # Live SVG preview, theme switcher, & download
│   ├── samples/                 # Out-of-the-box demo recording
│   │   └── demo.cast.ts
│   ├── styles/                  # Terminal dark theme tokens & typography
│   ├── App.tsx                  # Root application wiring & rAF tick loop
│   └── main.tsx                 # DOM entry point
└── tests/                       # 157 unit and integration tests
```

---

## License

This project is licensed under the [MIT License](LICENSE).
