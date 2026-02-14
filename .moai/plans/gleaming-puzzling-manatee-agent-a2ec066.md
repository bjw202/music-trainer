# Audio Engine Development Plan
## Domain 1: Audio Engine (core/)

### Current State
- Project: guitar-mp3-trainer-v2
- Phase: Run Phase - MVP Development
- Task: #5 - Audio Engine Development
- Status: Pending (blocked by Task #2 stores, Task #3 utils)
- Mode: Hybrid (TDD for new code, DDD for existing)

### Dependencies
- **Task #2** (stores/): State management for loop points, playback state
- **Task #3** (utils/): Audio utilities, format validation, error handling

### Implementation Plan

#### Phase 1: Project Setup ( prerequisite )
1. Initialize TypeScript project with Vite
2. Install dependencies:
   - wavesurfer.js 7.8.x
   - TypeScript types
   - Testing framework (vitest)

#### Phase 2: Audio Engine Core (AudioEngine.ts)
**TDD Approach - New Code**

**Test Cases:**
1. AudioContext initialization
2. AudioContext lifecycle (create, suspend, resume, close)
3. AudioBuffer creation from ArrayBuffer
4. Memory cleanup (buffer disposal)
5. Format support (MP3, WAV, M4A, OGG)
6. Audio node graph connection
7. Volume control via GainNode
8. Error handling for invalid inputs

**Implementation:**
```typescript
// src/core/AudioEngine.ts
class AudioEngine {
  private audioContext: AudioContext | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private audioBuffer: AudioBuffer | null = null

  // Context management
  createContext(): AudioContext
  suspend(): void
  resume(): void
  close(): void

  // Buffer management
  async loadBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer>
  disposeBuffer(): void

  // Playback
  async play(offset?: number): Promise<void>
  pause(): void
  stop(): void

  // Audio graph
  private connectNodes(): void
  private disconnectNodes(): void

  // Volume
  setVolume(value: number): void
  getVolume(): number

  // Cleanup
  dispose(): void
}
```

#### Phase 3: AB Loop Manager (ABLoopManager.ts)
**DDD Approach - Depends on stores**

**Test Cases:**
1. Loop state management integration
2. A/B point setting and validation
3. Playback position monitoring
4. Loop back trigger on B point reach
5. Loop latency < 50ms verification

**Implementation:**
```typescript
// src/core/ABLoopManager.ts
class ABLoopManager {
  private engine: AudioEngine
  private loopStore: LoopStore
  private isMonitoring: boolean = false
  private checkInterval: number | null = null

  // Loop control
  setLoopPoint(point: 'A' | 'B', time: number): void
  clearLoop(point?: 'A' | 'B'): void
  isLoopActive(): boolean

  // Position monitoring
  startMonitoring(): void
  stopMonitoring(): void
  private checkPosition(): void

  // Integration with store
  private syncWithStore(): void
}
```

#### Phase 4: Waveform Renderer (WaveformRenderer.ts)
**TDD Approach - New Code**

**Test Cases:**
1. wavesurfer.js initialization
2. Waveform rendering from audio data
3. Real-time progress updates
4. 60fps rendering verification
5. Region marking for A/B points
6. Cleanup and disposal

**Implementation:**
```typescript
// src/core/WaveformRenderer.ts
class WaveformRenderer {
  private wavesurfer: WaveSurfer | null = null
  private container: HTMLElement
  private animationFrame: number | null = null

  // Initialization
  constructor(container: HTMLElement, options: WaveSurferOptions)
  async loadAudio(url: string | ArrayBuffer): Promise<void>

  // Rendering
  private renderLoop(): void
  startProgressTracking(): void
  stopProgressTracking(): void

  // Regions
  markRegion(start: number, end: number, color: string): void
  clearRegions(): void

  // Cleanup
  dispose(): void
}
```

### File Structure
```
src/
  core/
    AudioEngine.ts
    ABLoopManager.ts
    WaveformRenderer.ts
    index.ts (exports)
  core/
    __tests__/
      AudioEngine.test.ts
      ABLoopManager.test.ts
      WaveformRenderer.test.ts
```

### Quality Targets
- 85%+ test coverage
- Zero TypeScript errors
- Memory leak prevention
- Loop latency < 50ms
- 60fps rendering

### Integration Points
- Store integration: loopStore for A/B point state
- Frontend integration: React hooks for UI control
