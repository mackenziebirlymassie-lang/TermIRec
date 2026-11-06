# TermiRecord - Web Player & SVG Animator Base Design

**Date:** 2026-11-06  
**Status:** Draft  
**Target:** Project Scaffolding & Initial Architecture  

---

## 1. Intent & Context
TermiRecord is a lightweight, local-first developer utility designed to play terminal session recordings (specifically the standard asciicast format) and export them into clean, animated SVGs and web embeds. The user requested starting small by laying out the initial base and start code for a browser-based web application.

---

## 2. Goals & Non-Goals

### Goals
- Establish a clean, production-grade project base using **Vite**, **React**, and **TypeScript**.
- Architect a clean separation between the **core terminal engine** (headless, framework-agnostic TypeScript) and the **UI layer** (React).
- Define the core abstractions:
  - `AsciicastParser`: Parses `.cast` (v2 JSON lines) records into structured timeline events.
  - `PlaybackController`: Manages playback timing, play/pause, seeking, scrub position, and playback speed.
  - `TerminalBuffer`: Simulates character grid state, cursor position, and ANSI styling.
  - `SvgExporter`: Renders frames or full keyframe-animated SVGs from terminal buffer states.
- Provide a responsive UI shell:
  - Terminal display viewport.
  - Playback control bar (play/pause toggle, timeline scrubber, elapsed/total time, playback speed multiplier).
  - Top toolbar (file drag-and-drop loader, sample recording loader, SVG export trigger).
- Include an out-of-the-box demo recording so the application renders an active recording immediately on launch without requiring initial manual file upload.
- Setup testing foundation with Vitest for engine logic verification.

### Non-Goals (Initial Base)
- Complex PTY multiplexing or live recording within the browser (focus is playback and animated SVG export).
- Cloud backend, database, or telemetry (strictly local-first).
- Asciicast v1 or legacy ttyrec formats (asciicast v2 is the modern industry standard).

### Anti-Goals
- Tightly coupling the terminal emulation or SVG generation to React DOM nodes; the engine must be able to run headlessly.
- Introducing heavy backend or server dependencies.

---

## 3. Constraints
- **Runtime Environment:** Modern browser (Chromium, Firefox, Safari, Edge).
- **Toolchain:** Node.js v24+, npm v11+.
- **Zero-backend:** All parsing, rendering, and SVG generation happen purely client-side.

---

## 4. Approaches Considered

1. **React + TypeScript + Vite (Selected)**
   - *Rationale:* Decouples pure TypeScript domain logic (parsers, timing state machine, SVG generators) from reactive UI controls. Enables rapid creation of accessible controls (sliders, tooltips, modals) while maintaining high performance.
   - *Trade-off:* Minor bundle size addition compared to pure vanilla JS, but negligible for a local web utility.

2. **Vanilla TypeScript + Vite**
   - *Rationale:* Smallest possible bundle and zero external UI dependencies.
   - *Trade-off:* Requires substantial custom boilerplate for stateful UI elements (timeline scrubbing, keyboard navigation, popovers, export dialogs), slowing down feature iteration.

---

## 5. Architectural Blueprint

```
TermiRecord/
├── src/
│   ├── core/                    # Headless engine (zero React dependencies)
│   │   ├── types.ts             # AsciicastHeader, AsciiEvent, TerminalFrame
│   │   ├── parser.ts            # Asciicast v2 JSONL parser
│   │   ├── terminal-buffer.ts   # ANSI parser & text grid state machine
│   │   ├── playback.ts          # Clock, timeline scheduler, seek handler
│   │   └── svg-exporter.ts      # Vector SVG template and frame generator
│   ├── components/              # React UI components
│   │   ├── TerminalScreen.tsx   # Canvas/DOM terminal grid viewer
│   │   ├── ControlBar.tsx       # Timeline scrubber, Play/Pause, Speed, Timestamp
│   │   ├── Toolbar.tsx          # File upload & Export buttons
│   │   └── ExportModal.tsx      # SVG export settings (loop, font, theme)
│   ├── samples/                 # Built-in demo recordings (.cast)
│   │   └── demo.cast.ts
│   ├── styles/                  # Clean modern dark theme & monospace styling
│   ├── App.tsx                  # Main application composition
│   └── main.tsx                 # App mount
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 6. What Is Left to the Builder
- Selection of specific styling approach (Tailwind CSS or clean modular CSS with CSS variables).
- Default terminal theme palette (e.g. Catppuccin, Monokai, or Tokyo Night dark presets).
- Specific ANSI escape sequences to support in the base parser (focusing on colors, bold, reset, clear screen).
