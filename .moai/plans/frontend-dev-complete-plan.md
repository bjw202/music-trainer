# Frontend Developer - Complete Implementation Plan

## Status: Plan Mode - Awaiting Approval

---

## Assigned Tasks

| Task | Subject | Priority | Dependencies | Status |
|-------|----------|-----------|--------------|--------|
| #1 | Project Initialization | 1 (do first) | None | Ready to implement |
| #2 | State Management (stores/) | 2 | #1 | Ready after #1 |
| #3 | Utilities (utils/) | 3 | #1 | Ready after #1 |
| #6 | UI Components (components/) | 4 | #4, #5 | Blocked by design, audio |
| #7 | Hooks (hooks/) | 5 | #5, #6 | Blocked by audio, components |

---

## Task #1: Project Initialization

### Requirements
- Vite 6.0.x + React 19.0.0 + TypeScript 5.7.x
- Zustand 5.x (state management)
- wavesurfer.js 7.8.x (waveform visualization)
- Tailwind CSS 4.0.x (styling)
- Vitest 2.1.x (unit tests)
- Playwright 1.48.x (E2E tests)
- React Testing Library 16.x (component tests)
- pnpm 9.x package manager

### Implementation Steps

#### Step 1: Create Vite Project
```bash
pnpm create vite@latest frontend --template react-ts
cd frontend
pnpm install
```

#### Step 2: Install Additional Dependencies
```bash
# State management
pnpm add zustand

# Waveform
pnpm add wavesurfer.js@7.8

# Styling
pnpm add -D tailwindcss @tailwindcss/vite
pnpm exec tailwindcss init

# Testing
pnpm add -D @vitest/ui vitest jsdom
pnpm add -D @playwright/test
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm exec playwright install --with-deps
```

#### Step 3: Configure Vite with Tailwind
```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
      '@/components': '/src/components',
      '@/core': '/src/core',
      '@/stores': '/src/stores',
      '@/hooks': '/src/hooks',
      '@/utils': '/src/utils',
      '@/types': '/src/types',
    },
  },
})
```

#### Step 4: Configure Tailwind
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme from SPEC
        primary: '#1a1a1a',
        secondary: '#2a2a2a',
        text: {
          primary: '#e0e0e0',
          secondary: '#a0a0a0',
        },
        accent: {
          blue: '#007aff',
          red: '#ff3b30',
          green: '#34c759',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

#### Step 5: Configure TypeScript
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/core/*": ["./src/core/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/utils/*": ["./src/utils/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### Step 6: Configure Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
})
```

#### Step 7: Configure Playwright
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

#### Step 8: Update package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

#### Step 9: Create Directory Structure
```bash
mkdir -p src/{components,core,stores,hooks,utils,types,test}
mkdir -p tests/{unit,component,e2e}
mkdir -p public/test-audio
```

#### Step 10: Create Base Files
- `src/test/setup.ts` - Test environment setup with @testing-library
- `src/types/index.ts` - Type definitions placeholder
- `src/index.css` - Tailwind imports

### Verification
```bash
pnpm dev      # Verify dev server starts
pnpm build    # Verify production build
pnpm test      # Verify Vitest runs
pnpm test:e2e  # Verify Playwright runs
```

---

## Task #2: State Management (Zustand Stores)

### Prerequisites
- Task #1 complete (project setup)

### TDD Approach (RED-GREEN-REFACTOR)

For each store:
1. **RED**: Write failing tests for all state transitions
2. **GREEN**: Implement store to pass tests
3. **REFACTOR**: Clean up code, add types

### Store Structure

#### 1. audioStore.ts
```typescript
// State
interface AudioStore {
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

**Test Cases**:
- Initial state is null/empty
- setFile updates file and clears error
- setLoading toggles loading state
- setBuffer stores AudioBuffer
- setError stores error message
- clear resets all state

#### 2. playerStore.ts
```typescript
interface PlayerStore {
  status: 'stopped' | 'paused' | 'playing'
  currentTime: number
  duration: number

  setStatus: (status: PlayerStore['status']) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  reset: () => void
}
```

**Test Cases**:
- Initial status is 'stopped'
- Status transitions work correctly
- currentTime updates
- duration updates
- reset returns to initial state

#### 3. controlStore.ts
```typescript
interface ControlStore {
  volume: number        // 0-100
  muted: boolean
  previousVolume: number

  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  toggleMute: () => void
}
```

**Test Cases**:
- Initial volume is 100, muted is false
- setVolume clamps to 0-100 range
- setMuted(true) saves current volume and sets to 0
- setMuted(false) restores previous volume
- toggleMute switches mute state

#### 4. loopStore.ts
```typescript
interface LoopStore {
  loopA: number | null
  loopB: number | null
  loopEnabled: boolean

  setLoopA: (time: number) => void
  setLoopB: (time: number) => void
  setLoopEnabled: (enabled: boolean) => void
  clearLoop: () => void
  hasValidLoop: () => boolean
}
```

**Test Cases**:
- Initial values are null/false
- setLoopA/setLoopB store time values
- setLoopEnabled toggles
- clearLoop resets both points
- hasValidLoop returns true only when both set and enabled

### Test File Structure
```
tests/unit/stores/
  audioStore.test.ts
  playerStore.test.ts
  controlStore.test.ts
  loopStore.test.ts
```

### Implementation Files
```
src/stores/
  audioStore.ts
  playerStore.ts
  controlStore.ts
  loopStore.ts
  index.ts
```

---

## Task #3: Utilities (Helper Functions)

### Prerequisites
- Task #1 complete (project setup)

### TDD Approach (RED-GREEN-REFACTOR)

For each utility:
1. **RED**: Write failing tests for edge cases
2. **GREEN**: Implement pure functions
3. **REFACTOR**: Optimize, document

### Utility Structure

#### 1. audioUtils.ts
```typescript
// Functions
export function validateAudioFormat(file: File): boolean
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer>
export async function decodeAudioData(
  context: AudioContext,
  buffer: ArrayBuffer
): Promise<AudioBuffer>
export function getSupportedFormats(): string[]
```

**Test Cases**:
- validateAudioFormat: MP3/WAV/M4A/OGG return true, others false
- fileToArrayBuffer: resolves with ArrayBuffer
- decodeAudioData: resolves with AudioBuffer
- getSupportedFormats: returns array of MIME types

#### 2. timeUtils.ts
```typescript
export function formatTime(seconds: number): string  // "mm:ss"
export function parseTime(timeString: string): number  // "mm:ss" -> seconds
export function clampTime(time: number, max: number): number
```

**Test Cases**:
- formatTime: 0 -> "0:00", 65 -> "1:05", negative -> "0:00"
- parseTime: "1:05" -> 65, invalid -> 0
- clampTime: values clamped between 0 and max

#### 3. fileUtils.ts
```typescript
export function getFileName(file: File): string
export function getFileExtension(file: File): string
export function formatFileSize(bytes: number): string
```

**Test Cases**:
- getFileName: "song.mp3" -> "song"
- getFileExtension: "song.mp3" -> ".mp3"
- formatFileSize: 1024 -> "1 KB", 1048576 -> "1 MB"

#### 4. constants.ts
```typescript
export const SUPPORTED_FORMATS = [
  'audio/mpeg',    // MP3
  'audio/wav',     // WAV
  'audio/mp4',     // M4A
  'audio/ogg'      // OGG
] as const

export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: 'Space',
  STOP: 'Escape',
  SEEK_BACKWARD: 'ArrowLeft',
  SEEK_FORWARD: 'ArrowRight',
  SET_LOOP_A: 'KeyI',
  SET_LOOP_B: 'KeyO',
  TOGGLE_MUTE: 'KeyM',
  JUMP_TO_A: 'KeyA',
} as const

export const SEEK_INTERVAL = 5  // seconds
export const VOLUME_STEP = 5      // percentage
```

### Test File Structure
```
tests/unit/utils/
  audioUtils.test.ts
  timeUtils.test.ts
  fileUtils.test.ts
```

### Implementation Files
```
src/utils/
  audioUtils.ts
  timeUtils.ts
  fileUtils.ts
  constants.ts
  index.ts
```

---

## Task #6: UI Components

### Prerequisites
- Task #4 complete (design specs from designer)
- Task #5 complete (AudioEngine from backend-dev)

### Approach
- Implement after design specs are available
- Follow Pencil .pen files for layout
- Use Tailwind CSS for styling
- Ensure WCAG 2.1 AA accessibility

### Component Structure
```
src/components/
  layout/
    AppLayout.tsx
    Header.tsx
  fileloader/
    DragDropZone.tsx
    FileSelector.tsx
  waveform/
    Waveform.tsx
  controls/
    PlayButton.tsx
    StopButton.tsx
    TimeDisplay.tsx
  volume/
    VolumeSlider.tsx
    MuteButton.tsx
  abloop/
    ABLoopControls.tsx
    ABLoopDisplay.tsx
  player/
    Player.tsx
```

### Component Test Structure
```
tests/component/
  Player.test.tsx
  Controls.test.tsx
  Waveform.test.tsx
  Volume.test.tsx
  ABLoop.test.tsx
```

---

## Task #7: Custom Hooks

### Prerequisites
- Task #5 complete (AudioEngine API)
- Task #6 complete (components)

### Approach
- Integrate AudioEngine with React lifecycle
- Connect stores to AudioEngine events
- Handle cleanup on unmount

### Hook Structure
```
src/hooks/
  useAudioEngine.ts      // AudioEngine lifecycle
  useKeyboardShortcuts.ts  // Key event handling
  usePlayback.ts         // Play/pause/stop logic
  useWaveform.ts         // WaveSurfer.js integration
  useFileLoader.ts       // File loading logic
```

### Hook Test Structure
```
tests/unit/hooks/
  useAudioEngine.test.ts
  useKeyboardShortcuts.test.ts
  usePlayback.test.ts
```

---

## Implementation Order

1. **Task #1** (Project Initialization) - Do first
2. **Task #2** (State Management) - After #1, use TDD
3. **Task #3** (Utilities) - After #1, use TDD (can parallel with #2)
4. **Task #6** (UI Components) - After #4, #5
5. **Task #7** (Hooks) - After #5, #6

### Blocked Tasks
- **Task #6**: Waiting for designer (Task #4) and backend-dev (Task #5)
- **Task #7**: Waiting for backend-dev (Task #5) and Task #6

---

## Quality Targets

- **Code Coverage**: 85%+ for new code (Task #2, #3)
- **TypeScript**: Zero errors, strict mode
- **Accessibility**: WCAG 2.1 AA compliant
- **Tests**: All tests passing before marking complete

---

## Ready to Execute

Once approved, I will:
1. Start with Task #1 (Project Initialization)
2. Move to Task #2 and #3 in parallel after #1 completes
3. Wait for dependencies before #6 and #7
4. Update task status via TaskUpdate
5. Coordinate with tester for validation
