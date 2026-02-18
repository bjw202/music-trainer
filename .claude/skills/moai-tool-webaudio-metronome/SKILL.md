---
name: moai-tool-webaudio-metronome
description: >
  Web Audio API precise metronome scheduling with Lookahead Scheduler pattern,
  OscillatorNode sample-accurate timing, and Web Worker background timer.
  Use when implementing click track, beat indicator, BPM-synced metronome,
  tempo-aware beat scheduling, or speed/seek/loop synchronization with
  SoundTouch pipeline. Covers drift prevention, background tab support,
  and integration with existing multi-stem audio engine.
license: Apache-2.0
compatibility: Designed for Claude Code
allowed-tools: Read Grep Glob Bash WebFetch WebSearch mcp__context7__resolve-library-id mcp__context7__get-library-docs
user-invocable: false
metadata:
  version: "1.0.0"
  category: "tool"
  status: "active"
  updated: "2026-02-17"
  modularized: "false"
  tags: "metronome, beat scheduling, lookahead scheduler, audio timing, click track, tempo sync, web worker timer, bpm click, beat indicator"
  related-skills: "moai-tool-webaudio-stems, moai-lang-typescript, moai-domain-frontend"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["metronome", "beat scheduling", "lookahead scheduler", "audio timing", "click track", "tempo sync", "web worker timer", "bpm click", "beat indicator"]
  agents: ["expert-frontend", "manager-ddd", "manager-tdd"]
  phases: ["run"]
  languages: ["typescript"]
---

# Web Audio API Precise Metronome Scheduling Guide

Sample-accurate metronome click scheduling using the Lookahead Scheduler pattern, with Web Worker background timer and SoundTouch pipeline synchronization.

## Quick Reference

### Core Concept: The Lookahead Scheduler Pattern

The "Two Clocks" problem: JavaScript `setTimeout` has 4-50ms jitter. At 120 BPM (500ms per beat), 20ms jitter = 4% timing error -- audibly sloppy. Meanwhile, `AudioContext.currentTime` has ~0.02ms precision (sample-accurate).

Chris Wilson's Lookahead Scheduler solves this by separating scheduling from playback:

```
Web Worker setTimeout loop (~25ms interval)
  |
  |-- "tick" message --> Main Thread
                            |
                            |-- Check: any beats due in next 100ms?
                            |     YES --> OscillatorNode.start(exactAudioContextTime)
                            |     NO  --> wait for next tick
```

- `setTimeout` loop runs every ~25ms (`lookaheadInterval`) -- jitter is irrelevant
- Each tick looks ahead 100ms (`scheduleAheadTime`) into the future
- Beats are scheduled using `OscillatorNode.start(preciseTime)` -- sample-accurate
- The scheduling happens well before playback, so setTimeout jitter never affects audio timing

### Click Sound Generation

OscillatorNode approach (no file loading required):

- Downbeat: 880Hz sine, 30ms duration
- Upbeat: 440Hz sine, 30ms duration
- Create a fresh OscillatorNode per click (they are single-use disposable nodes)
- Connect each OscillatorNode to a dedicated `GainNode` for independent metronome volume

```typescript
function scheduleClick(
  ctx: AudioContext,
  time: number,
  frequency: number,
  duration: number,
  destination: GainNode
): void {
  const osc = ctx.createOscillator()
  osc.frequency.value = frequency
  osc.connect(destination)
  osc.start(time)
  osc.stop(time + duration)
  // OscillatorNode auto-disconnects after stop -- no cleanup needed
}
```

### Audio Graph: Separate Path from SoundTouch Pipeline

```
Existing pipeline (stems):
  ScriptProcessorNode -> GainNode(master) -> AnalyserNode -> Destination

Metronome pipeline (clicks):
  OscillatorNode -> GainNode(metronome) -> Destination
```

[HARD] Metronome MUST share the SAME `AudioContext` as the stem pipeline. This is critical for synchronization -- `audioContext.currentTime` is the shared clock.

[HARD] Metronome clicks bypass SoundTouch entirely. Speed/pitch changes affect stems but NOT click sounds. Clicks always play at their natural frequency and timing.

---

## Implementation Guide

### Web Worker Timer (Background Tab Support)

Problem: Chrome throttles background tab `setTimeout` to 1000ms minimum intervals, making the 25ms scheduler loop useless.

Solution: Run the timer loop inside a Web Worker. Workers are NOT throttled in background tabs.

```typescript
// metronome-worker.ts (inline or separate file)
const LOOKAHEAD_MS = 25

let timerID: ReturnType<typeof setTimeout> | null = null

self.onmessage = (e: MessageEvent) => {
  if (e.data === 'start') {
    const tick = () => {
      self.postMessage('tick')
      timerID = setTimeout(tick, LOOKAHEAD_MS)
    }
    tick()
  } else if (e.data === 'stop') {
    if (timerID !== null) {
      clearTimeout(timerID)
      timerID = null
    }
  }
}
```

[HARD] The Worker posts `tick` messages to the main thread. The main thread creates OscillatorNodes with `AudioContext` time. Workers CANNOT access `AudioContext` directly -- always use `postMessage` for the scheduling bridge.

### Scheduler: Main Thread Side

```typescript
class MetronomeScheduler {
  private worker: Worker
  private audioContext: AudioContext
  private metronomeGain: GainNode
  private beats: number[] = []           // original-time positions (seconds)
  private nextBeatIndex = 0
  private currentSpeed = 1.0
  private currentOriginalTime = 0        // from AudioEngine sourcePosition
  private scheduleAheadTime = 0.1        // seconds
  private isRunning = false
  private scheduledBeats: Set<number> = new Set()  // prevent double-scheduling

  constructor(config: MetronomeConfig) {
    this.audioContext = config.audioContext
    this.metronomeGain = config.audioContext.createGain()
    this.metronomeGain.connect(config.audioContext.destination)

    // Create inline worker (avoids separate file bundling issues)
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' })
    this.worker = new Worker(URL.createObjectURL(blob))
    this.worker.onmessage = () => this.scheduleTick()
  }

  private scheduleTick(): void {
    if (!this.isRunning) return

    const now = this.audioContext.currentTime

    while (this.nextBeatIndex < this.beats.length) {
      const beatOriginalTime = this.beats[this.nextBeatIndex]

      // Convert original time to AudioContext playback time
      const deltaOriginal = beatOriginalTime - this.currentOriginalTime
      const scheduleTime = now + deltaOriginal / this.currentSpeed

      // Beat is in the past -- skip it
      if (scheduleTime < now) {
        this.nextBeatIndex++
        continue
      }

      // Beat is beyond our lookahead window -- stop scheduling for now
      if (scheduleTime > now + this.scheduleAheadTime) break

      // Schedule the click
      if (!this.scheduledBeats.has(this.nextBeatIndex)) {
        const isDownbeat = this.nextBeatIndex % 4 === 0
        scheduleClick(
          this.audioContext,
          scheduleTime,
          isDownbeat ? 880 : 440,
          0.03,
          this.metronomeGain
        )
        this.scheduledBeats.add(this.nextBeatIndex)
      }

      this.nextBeatIndex++
    }
  }
}
```

### Speed Change Synchronization

Beat timestamps are stored in ORIGINAL TIME (same as `simpleFilter.sourcePosition / sampleRate`). Current playback position is also in original time from AudioEngine/StemMixer.

Conversion formula:

```
scheduleTime = audioContext.currentTime + (beatOriginalTime - currentOriginalTime) / currentSpeed
```

[HARD] Speed change requires NO beat recalculation. Only the scheduling time conversion changes because `currentSpeed` is in the denominator. Effective audible BPM = `originalBPM * speed` (display only).

```typescript
  setSpeed(speed: number): void {
    this.currentSpeed = speed
    // No beat array recalculation needed
    // Next scheduleTick() automatically uses new speed for time conversion
  }

  syncToPlaybackTime(currentOriginalTime: number): void {
    this.currentOriginalTime = currentOriginalTime
  }
```

### Event Synchronization

#### Seek

```typescript
  syncSeek(newOriginalTime: number): void {
    this.currentOriginalTime = newOriginalTime
    this.scheduledBeats.clear()  // Clear pending click tracking

    // Binary search for nearest future beat
    let lo = 0, hi = this.beats.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.beats[mid] < newOriginalTime) lo = mid + 1
      else hi = mid
    }
    this.nextBeatIndex = lo
  }
```

[HARD] Always clear `scheduledBeats` on seek. Stale entries prevent legitimate clicks from being scheduled at the new position.

#### Pause and Resume

```typescript
  stop(): void {
    this.isRunning = false
    this.worker.postMessage('stop')
    // nextBeatIndex is preserved for resume
  }

  start(): void {
    this.isRunning = true
    this.scheduledBeats.clear()
    this.worker.postMessage('start')
  }
```

#### A-B Loop

```typescript
  // Only schedule clicks within [loopA, loopB] range
  private scheduleTick(): void {
    // ... (same as above, with added loop boundary check)
    while (this.nextBeatIndex < this.beats.length) {
      const beatOriginalTime = this.beats[this.nextBeatIndex]

      // If A-B loop active and beat is past loop end, reset
      if (this.loopEnd !== null && beatOriginalTime >= this.loopEnd) {
        // Wait for AudioEngine to loop back -- syncToPlaybackTime will reset
        break
      }

      // ... schedule as normal
    }
  }

  // Called when AudioEngine loops back to loopA
  onLoopReset(loopStartTime: number): void {
    this.syncSeek(loopStartTime)
  }
```

---

## Advanced Implementation

### Drift Prevention

[HARD] NEVER accumulate intervals: `nextBeat += interval` accumulates floating-point error over time.

[HARD] ALWAYS use absolute position: `nextBeat = baseBeatTime + beatCount * interval`. This keeps error constant regardless of how many beats have passed.

The Lookahead Scheduler inherently prevents drift because it re-syncs every 25ms from `sourcePosition`. Even if individual beat calculations had minor float errors, the synchronization with the actual playback position prevents accumulation.

For visual beat indicator compensation, subtract `audioContext.outputLatency` (if available) from the display time to account for audio output pipeline delay.

### Interface Contract

```typescript
interface MetronomeConfig {
  audioContext: AudioContext
  clickFrequencyDownbeat?: number   // default: 880
  clickFrequencyUpbeat?: number     // default: 440
  clickDuration?: number            // default: 0.03 seconds
  lookaheadMs?: number              // default: 25
  scheduleAheadTime?: number        // default: 0.1
}

class MetronomeEngine {
  constructor(config: MetronomeConfig)
  setBeatTimestamps(beats: number[]): void   // original-time positions
  setSpeed(speed: number): void
  setVolume(volume: number): void
  syncToPlaybackTime(currentTime: number): void
  syncSeek(newTime: number): void
  onLoopReset(loopStartTime: number): void
  start(): void
  stop(): void
  isRunning(): boolean
  getCurrentBeatIndex(): number
  dispose(): void
}
```

### Zustand Store Pattern

```typescript
interface BpmState {
  bpm: number | null           // detected BPM from analysis
  beats: number[]              // original-time beat positions
  isAnalyzing: boolean
  metronomeEnabled: boolean
  metronomeVolume: number      // 0.0 ~ 1.0
  // actions
  toggleMetronome: () => void
  setMetronomeVolume: (v: number) => void
  setBpm: (bpm: number) => void
  setBeats: (beats: number[]) => void
  reset: () => void
}
```

### Anti-Patterns (Common Mistakes)

- Using `setInterval` directly for metronome clicks (drifts progressively)
- Creating a separate `AudioContext` for metronome (causes sync issues with stem pipeline)
- Scheduling clicks in the past (`osc.start(time)` where `time < currentTime` plays immediately or silently)
- Not clearing `scheduledBeats` on seek/loop (causes ghost clicks or missing clicks)
- Using `setTimeout` in main thread without Web Worker (broken in background tabs)
- Accumulating beat intervals with floating-point addition instead of absolute calculation
- Trying to reuse an `OscillatorNode` after `stop()` (they are single-use)

### Official Documentation References

- Chris Wilson "A Tale of Two Clocks": https://web.dev/articles/audio-scheduling
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- MDN Advanced Techniques (metronome): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
- IRCAM Timing Tutorial: https://ircam-ismm.github.io/webaudio-tutorials/scheduling/timing-and-scheduling.html
- WAAClock library: https://github.com/sebpiq/WAAClock

---

## Works Well With

- moai-tool-webaudio-stems: Multi-stem audio pipeline (shares AudioContext for synchronization)
- moai-lang-typescript: TypeScript coding standards and patterns
- moai-domain-frontend: React frontend architecture
- moai-library-shadcn: UI components for metronome controls (toggle, volume slider)
- expert-frontend: Frontend implementation agent
