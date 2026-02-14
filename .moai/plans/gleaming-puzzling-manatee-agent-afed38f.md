# Frontend Implementation Plan - Music Trainer MVP

## Status: Plan Mode - Awaiting Approval

---

## Current State Analysis

### Project Structure
- **Status**: New project - no source code exists yet
- **Spec**: SPEC-MVP-001 approved
- **Tasks Assigned**: #2 (stores), #3 (utils), #6 (components), #7 (hooks)

### Dependencies
- Task #2 (stores) blocked by #1 (project initialization)
- Task #3 (utils) blocked by #1 (project initialization)
- Task #6 (components) blocked by #4 (design), #5 (audio engine)
- Task #7 (hooks) blocked by #5 (audio engine), #6 (components)

---

## Implementation Strategy

### Phase 1: Foundation (Independent Tasks)

Once Task #1 completes project initialization, I can start with:

#### 1.1 State Management (Task #2) - Zustand Stores

```
src/stores/
├── audioStore.ts      # File state, loading, buffer, metadata
├── playerStore.ts     # Play/pause/stop, currentTime, duration
├── controlStore.ts     # Volume, muted, previousVolume
└── loopStore.ts       # loopA, loopB, loopEnabled
```

**TDD Approach**:
1. Write failing tests for each store
2. Implement store with TypeScript
3. Refactor for clean code

**Test Coverage**: 85%+

#### 1.2 Utilities (Task #3) - Helper Functions

```
src/utils/
├── audioUtils.ts      # Format validation, ArrayBuffer conversion
├── timeUtils.ts       # Seconds -> mm:ss formatting
├── fileUtils.ts       # File handling utilities
└── constants.ts       # Keyboard shortcuts, intervals
```

**TDD Approach**:
1. Write tests for each utility function
2. Implement with pure functions where possible
3. Add edge case handling

**Test Coverage**: 90%+ (pure functions are highly testable)

### Phase 2: Integration (Waiting for Dependencies)

#### 2.1 Custom Hooks (Task #7) - Audio & UI Logic

```
src/hooks/
├── useAudioEngine.ts      # AudioEngine React lifecycle
├── useKeyboardShortcuts.ts # Space, Arrow, I/O, A, M keys
├── usePlayback.ts         # Play/pause/stop logic
├── useWaveform.ts         # Waveform rendering sync
└── useFileLoader.ts      # File loading logic
```

**Dependency**: Requires AudioEngine from backend-dev (Task #5)

#### 2.2 UI Components (Task #6) - React Components

```
src/components/
├── layout/
│   ├── AppLayout.tsx
│   └── Header.tsx
├── fileloader/
│   ├── DragDropZone.tsx
│   └── FileSelector.tsx
├── waveform/
│   └── Waveform.tsx      # wavesurfer.js wrapper
├── controls/
│   ├── PlayButton.tsx
│   ├── StopButton.tsx
│   ├── TimeDisplay.tsx
│   ├── VolumeSlider.tsx
│   └── MuteButton.tsx
├── abloop/
│   ├── ABLoopControls.tsx
│   └── ABLoopDisplay.tsx
└── player/
    └── Player.tsx         # Main container
```

**Dependency**: Requires design specs from designer (Task #4)

---

## Detailed Implementation Plan

### 2. State Management (Zustand) - Task #2

#### audioStore.ts
```typescript
interface AudioStore {
  // State
  file: File | null
  loading: boolean
  buffer: AudioBuffer | null
  metadata: { name: string; duration: number } | null
  error: string | null

  // Actions
  setFile: (file: File | null) => void
  setLoading: (loading: boolean) => void
  setBuffer: (buffer: AudioBuffer | null) => void
  setMetadata: (metadata: AudioStore['metadata']) => void
  setError: (error: string | null) => void
  clear: () => void
}
```

#### playerStore.ts
```typescript
interface PlayerStore {
  // State
  status: 'stopped' | 'paused' | 'playing'
  currentTime: number
  duration: number

  // Actions
  setStatus: (status: PlayerStore['status']) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  reset: () => void
}
```

#### controlStore.ts
```typescript
interface ControlStore {
  // State
  volume: number        // 0-100
  muted: boolean
  previousVolume: number

  // Actions
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  toggleMute: () => void
}
```

#### loopStore.ts
```typescript
interface LoopStore {
  // State
  loopA: number | null
  loopB: number | null
  loopEnabled: boolean

  // Actions
  setLoopA: (time: number) => void
  setLoopB: (time: number) => void
  setLoopEnabled: (enabled: boolean) => void
  clearLoop: () => void
  hasValidLoop: () => boolean
}
```

### 3. Utilities - Task #3

#### audioUtils.ts
- `validateAudioFormat(file: File): boolean` - Check MP3, WAV, M4A, OGG
- `fileToArrayBuffer(file: File): Promise<ArrayBuffer>` - FileReader wrapper
- `decodeAudioData(context: AudioContext, buffer: ArrayBuffer): Promise<AudioBuffer>`
- `getSupportedFormats(): string[]`

#### timeUtils.ts
- `formatTime(seconds: number): string` - Seconds to mm:ss
- `parseTime(timeString: string): number` - mm:ss to seconds
- `clampTime(time: number, max: number): number`

#### fileUtils.ts
- `getFileName(file: File): string` - Extract name without extension
- `getFileExtension(file: File): string`
- `formatFileSize(bytes: number): string`

#### constants.ts
```typescript
export const SUPPORTED_FORMATS = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg']
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: 'Space',
  STOP: 'Escape',
  SEEK_BACKWARD: 'ArrowLeft',
  SEEK_FORWARD: 'ArrowRight',
  SET_LOOP_A: 'KeyI',
  SET_LOOP_B: 'KeyO',
  TOGGLE_MUTE: 'KeyM',
  JUMP_TO_A: 'KeyA',
}
export const SEEK_INTERVAL = 5 // seconds
export const VOLUME_STEP = 5
```

### 7. Custom Hooks - Task #7 (After AudioEngine ready)

#### useAudioEngine.ts
- Initialize AudioContext
- Connect AudioEngine instance
- Handle cleanup on unmount
- Sync with stores

#### useKeyboardShortcuts.ts
- Register global key listeners
- Map keys to actions
- Prevent default for shortcuts
- Handle modifier keys

#### usePlayback.ts
- Play/pause/stop logic
- Time updates (requestAnimationFrame or interval)
- Status sync with playerStore

#### useWaveform.ts
- Initialize WaveSurfer.js
- Sync playback position
- Handle zoom levels
- Render loop regions

#### useFileLoader.ts
- Handle drag-drop
- Process file selection
- Update audioStore
- Error handling

### 6. UI Components - Task #6 (After design specs ready)

#### Component Hierarchy
```
App
└── AppLayout
    ├── Header
    └── Player
        ├── FileLoader
        │   ├── DragDropZone
        │   └── FileSelector
        ├── Waveform
        ├── Controls
        │   ├── PlayButton
        │   ├── StopButton
        │   └── TimeDisplay
        ├── VolumeControls
        │   ├── VolumeSlider
        │   └── MuteButton
        └── ABLoopControls
            ├── ABLoopDisplay
            └── ABLoopControls
```

#### Accessibility Requirements
- All buttons: aria-label, role
- Keyboard navigation: tab, enter, space
- Focus indicators: visible outline
- Screen reader: live regions for time updates
- Touch targets: min 44x44px

---

## Testing Strategy

### Unit Tests (Vitest)
- Store state transitions
- Utility function edge cases
- Custom hook behavior

### Component Tests (React Testing Library)
- User interactions (click, type, drag-drop)
- State changes reflect in UI
- Accessibility attributes

### E2E Tests (Playwright)
- File load workflow
- Playback controls
- A-B loop setting
- Keyboard shortcuts

---

## Questions for Team

1. **Project Setup**: Is Task #1 (project initialization) ready? Need package.json, tsconfig.json, vite.config.ts

2. **Design Specs**: When will Task #4 (designer) provide Pencil .pen files?

3. **AudioEngine Interface**: What API will backend-dev expose for Task #5?

4. **Testing Priority**: Should I implement tests alongside components or after all components?

---

## Project Structure Alignment

Based on `.moai/project/structure.md` and `.moai/project/tech.md`:

### Directory Structure
```
frontend/                    # React SPA (Vite + TypeScript)
├── src/
│   ├── components/           # UI Components (Task #6)
│   ├── core/               # Audio Engine (Task #5 - backend-dev)
│   ├── stores/             # Zustand stores (Task #2)
│   ├── hooks/              # Custom hooks (Task #7)
│   ├── utils/              # Utility functions (Task #3)
│   ├── types/              # TypeScript types
│   ├── App.tsx
│   └── index.tsx
├── public/
│   └── test-audio/        # E2E test audio files
├── tests/
│   ├── unit/              # Vitest unit tests
│   ├── component/         # RTL component tests
│   └── e2e/              # Playwright E2E tests
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

### Task Ownership
- `src/stores/**/*.ts` - Task #2
- `src/utils/**/*.ts` - Task #3
- `src/components/**/*.tsx` - Task #6
- `src/hooks/**/*.ts` - Task #7

---

## Questions for Team Lead

1. **Project Initialization**: Is the `frontend/` directory structure ready? (Task #1)

2. **Design Specs**: When will designer provide Pencil .pen files for UI components? (Task #4)

3. **AudioEngine Interface**: What API will backend-dev expose for AudioEngine? (Task #5)
   - Expected: AudioContext management, play/pause/stop, seek, volume

4. **Testing Priority**: Should tests be written alongside components (TDD) or after implementation?

---

## Next Steps

Once plan is approved and dependencies clear:

1. **Wait for**: Task #1 (project initialization) completion signal
2. **Start with**: Task #2 (stores) using TDD - RED phase
3. **Then**: Task #3 (utils) using TDD - RED phase
4. **Wait for**: Design specs (Task #4) and AudioEngine (Task #5)
5. **Implement**: Task #7 (hooks) - integrate with AudioEngine
6. **Implement**: Task #6 (components) - follow design specs
7. **Coordinate**: With tester for test validation
