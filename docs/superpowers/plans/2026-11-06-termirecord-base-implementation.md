# TermiRecord Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Vite + React + TypeScript foundation and the headless terminal recording parser, playback controller, and SVG exporter for TermiRecord.

**Architecture:** Pure TypeScript headless core modules (`types.ts`, `parser.ts`, `terminal-buffer.ts`, `playback.ts`, `svg-exporter.ts`) handle recording data and frame state without React dependencies, paired with a modern React UI shell (`TerminalScreen`, `ControlBar`, `Toolbar`, `ExportModal`) for playback controls, file loading, and export triggers.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Lucide React (or SVG icons).

**Spec:** `docs/superpowers/specs/2026-11-06-termirecord-base-design.md`

## Global Constraints

- **Runtime:** Browser-based, local-first execution with zero external server dependencies.
- **Node Environment:** Windows environment, Node v24+, npm v11+.
- **Language & Types:** Strict TypeScript enabled (`noImplicitAny`, `strictNullChecks`).
- **Separation of Concerns:** Core engine under `src/core/` must never import React or DOM-specific browser globals so it remains headlessly testable in Vitest and portable.

## Review Focus

1. **Malformed or empty lines in `.cast` files:** Blank lines or unexpected characters must be skipped gracefully without crashing the parser.
2. **Out-of-order or negative timestamps:** Timestamps in recording events must be clamped and sorted monotonically.
3. **Seek boundary clamping:** Scrubbing to `< 0` or `> totalDuration` must safely clamp to 0 and total duration.
4. **ANSI escape sequences without reset:** Dangling style codes must not leak across subsequent unrelated cell updates.
5. **Asciicast resize events (`"r"`):** Terminal resize events (`[timestamp, "r", "colsxrows"]`) must resize the grid buffer dimensions correctly during playback.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/index.css`

**Interfaces:**
- Produces: Runnable Vite development server and Vitest test runner.

- [ ] **Step 1: Write base `package.json` with React, Vite, and Vitest dependencies**
  Specify `vite`, `@vitejs/plugin-react`, `typescript`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, and `vitest`.
- [ ] **Step 2: Create TypeScript configurations (`tsconfig.json`, `tsconfig.node.json`) and `vite.config.ts`**
  Configure strict TypeScript compiler options and Vite react plugin with test globals enabled.
- [ ] **Step 3: Create HTML shell (`index.html`), stylesheet (`src/styles/index.css`), and root React component (`src/App.tsx`, `src/main.tsx`)**
  Dark-themed background and modern typography setup.
- [ ] **Step 4: Install dependencies using `npm install`**
  Run: `npm install`
  Expected: Successful dependency installation with exit code 0.
- [ ] **Step 5: Verify build and test runner execution**
  Run: `npx tsc --noEmit`
  Expected: Clean type check with zero errors.

---

### Task 2: Core Types & Asciicast v2 Parser

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/parser.ts`
- Test: `tests/core/parser.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AsciicastHeader {
    version: number;
    width: number;
    height: number;
    timestamp?: number;
    title?: string;
    theme?: { fg?: string; bg?: string; palette?: string };
  }

  export type AsciicastEventType = 'o' | 'i' | 'r'; // output, input, resize

  export interface AsciicastEvent {
    time: number;
    type: AsciicastEventType;
    data: string;
  }

  export interface AsciicastRecording {
    header: AsciicastHeader;
    events: AsciicastEvent[];
    duration: number;
  }

  export function parseAsciicast(content: string): AsciicastRecording;
  ```

- [ ] **Step 1: Write the failing tests in `tests/core/parser.test.ts`**
  Test header parsing, output event collection, duration calculation, and malformed line resilience.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/core/parser.test.ts`
  Expected: FAIL with missing module `parser`.
- [ ] **Step 3: Implement types in `src/core/types.ts` and `parseAsciicast` in `src/core/parser.ts`**
  Split content by newline, parse line 0 as header JSON, parse subsequent lines as event JSON arrays `[time, type, data]`, and calculate total duration.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/core/parser.test.ts`
  Expected: PASS.

---

### Task 3: Terminal Character Grid & Buffer State Machine

**Files:**
- Create: `src/core/terminal-buffer.ts`
- Test: `tests/core/terminal-buffer.test.ts`

**Interfaces:**
- Consumes: `AsciicastHeader` from `src/core/types.ts`
- Produces:
  ```typescript
  export interface CellStyle {
    fg?: string;
    bg?: string;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
  }

  export interface TerminalCell {
    char: string;
    style: CellStyle;
  }

  export class TerminalBuffer {
    cols: number;
    rows: number;
    cursorX: number;
    cursorY: number;
    grid: TerminalCell[][];

    constructor(cols: number, rows: number);
    write(text: string): void;
    resize(cols: number, rows: number): void;
    clear(): void;
    getLines(): string[];
    snapshot(): TerminalCell[][];
  }
  ```

- [ ] **Step 1: Write the failing tests in `tests/core/terminal-buffer.test.ts`**
  Test plain text output, newline/carriage return handling, basic ANSI color SGR codes (`\x1b[31m` red, `\x1b[0m` reset), and screen clearing.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/core/terminal-buffer.test.ts`
  Expected: FAIL with missing module `terminal-buffer`.
- [ ] **Step 3: Implement `TerminalBuffer` in `src/core/terminal-buffer.ts`**
  Maintain 2D character grid with cursor tracking, handle `\r`, `\n`, `\b`, and ANSI SGR escape sequences for colors and formatting.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/core/terminal-buffer.test.ts`
  Expected: PASS.

---

### Task 4: Playback Controller & Timeline State Machine

**Files:**
- Create: `src/core/playback.ts`
- Test: `tests/core/playback.test.ts`

**Interfaces:**
- Consumes: `AsciicastRecording` from `src/core/types.ts`, `TerminalBuffer` from `src/core/terminal-buffer.ts`
- Produces:
  ```typescript
  export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'ended';

  export class PlaybackController {
    constructor(recording: AsciicastRecording, buffer: TerminalBuffer);
    play(): void;
    pause(): void;
    seek(targetTime: number): void;
    setSpeed(speed: number): void;
    tick(deltaTime: number): void;
    getCurrentTime(): number;
    getStatus(): PlaybackStatus;
    onFrame(callback: () => void): () => void;
  }
  ```

- [ ] **Step 1: Write the failing tests in `tests/core/playback.test.ts`**
  Test play/pause status transitions, chronological event dispatching on `tick()`, seeking backward (re-simulating buffer from start to seek time), seeking forward, and end-of-stream state.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/core/playback.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement `PlaybackController` in `src/core/playback.ts`**
  Manage playback cursor index, time accumulator, speed scaling, frame listener subscriptions, and buffer replay on seek.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/core/playback.test.ts`
  Expected: PASS.

---

### Task 5: Headless Animated SVG Exporter

**Files:**
- Create: `src/core/svg-exporter.ts`
- Test: `tests/core/svg-exporter.test.ts`

**Interfaces:**
- Consumes: `AsciicastRecording` from `src/core/types.ts`, `TerminalBuffer` from `src/core/terminal-buffer.ts`
- Produces:
  ```typescript
  export interface SvgExportOptions {
    theme?: 'dark' | 'light' | 'tokyo-night';
    fontSize?: number;
    fontFamily?: string;
    loop?: boolean;
  }

  export function exportToAnimatedSvg(
    recording: AsciicastRecording,
    options?: SvgExportOptions
  ): string;
  ```

- [ ] **Step 1: Write the failing tests in `tests/core/svg-exporter.test.ts`**
  Verify generated SVG contains valid root `<svg>` tag, terminal window chrome (header buttons), styled monospace `<text>` elements, and CSS keyframe animations representing time-sliced frame steps.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/core/svg-exporter.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement `exportToAnimatedSvg` in `src/core/svg-exporter.ts`**
  Sample recording at event intervals into frame snapshots, build CSS keyframes for visibility toggling, and output clean standalone vector SVG.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/core/svg-exporter.test.ts`
  Expected: PASS.

---

### Task 6: UI Shell & Terminal Canvas Viewport

**Files:**
- Create: `src/components/TerminalScreen.tsx`
- Create: `src/components/Toolbar.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: `TerminalBuffer` from `src/core/terminal-buffer.ts`
- Produces:
  - `<TerminalScreen buffer={buffer} />` rendering the character grid and cursor with macOS/Linux terminal window header styling.
  - `<Toolbar onFileUpload={...} onExportClick={...} />` for file loading and export triggers.

- [ ] **Step 1: Create `src/components/TerminalScreen.tsx`**
  Render terminal header bar (traffic light dots, title) and monospace character grid lines with ANSI color classes.
- [ ] **Step 2: Create `src/components/Toolbar.tsx`**
  Render top header with app branding, recording file input button, sample picker, and SVG export button.
- [ ] **Step 3: Add terminal styles in `src/styles/index.css`**
  Configure font families (JetBrains Mono / monospace fallbacks), terminal frame shadows, and color palette tokens.

---

### Task 7: Playback Control Bar & Scrubber

**Files:**
- Create: `src/components/ControlBar.tsx`
- Create: `src/components/ExportModal.tsx`

**Interfaces:**
- Consumes: `PlaybackController` from `src/core/playback.ts`
- Produces:
  - `<ControlBar controller={controller} recording={recording} />`
  - `<ExportModal isOpen={isOpen} onClose={onClose} recording={recording} />`

- [ ] **Step 1: Implement `ControlBar.tsx`**
  Interactive timeline scrubber `<input type="range">`, Play/Pause button, current time / total duration display (`MM:SS`), and speed dropdown selector (0.5x, 1x, 1.5x, 2x).
- [ ] **Step 2: Implement `ExportModal.tsx`**
  Modal dialog with live SVG preview, theme options, and "Download .svg" action.

---

### Task 8: Bundled Demo & App Integration

**Files:**
- Create: `src/samples/demo.cast.ts`
- Modify: `src/App.tsx`
- Test: `tests/integration/app.test.tsx`

**Interfaces:**
- Produces: Fully interactive web player loaded with a working demo recording upon startup.

- [ ] **Step 1: Create `src/samples/demo.cast.ts`**
  Embed a clean, authentic asciicast v2 recording displaying terminal commands (e.g. `echo "Welcome to TermiRecord"`, building assets, and color test patterns).
- [ ] **Step 2: Wire `App.tsx` with `TerminalScreen`, `ControlBar`, `Toolbar`, and `ExportModal`**
  Connect `requestAnimationFrame` loop to `PlaybackController.tick()`, load demo recording on mount, and handle user `.cast` file drop.
- [ ] **Step 3: Add integration smoke test in `tests/integration/app.test.tsx`**
  Verify app renders terminal view, loads recording, and responds to play/pause interaction.
- [ ] **Step 4: Execute all tests and type check**
  Run: `npx vitest run && npx tsc --noEmit`
  Expected: All test suites PASS and type check succeeds with 0 errors.
