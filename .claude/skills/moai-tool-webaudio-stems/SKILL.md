---
name: moai-tool-webaudio-stems
description: >
  Web Audio API multi-track stem mixing specialist for synchronized playback
  of 4-6 audio stems with individual volume control. Use when implementing
  stem mixer UI, multi-source audio routing, SoundTouch integration with
  multiple AudioBuffers, or migrating from ScriptProcessorNode to AudioWorklet.
  Covers ChannelMergerNode, GainNode per stem, synchronized seek/loop,
  mute/solo logic, and memory management for multi-buffer playback.
license: Apache-2.0
compatibility: Designed for Claude Code
allowed-tools: Read Grep Glob Bash WebFetch WebSearch mcp__context7__resolve-library-id mcp__context7__get-library-docs
user-invocable: false
metadata:
  version: "1.0.0"
  category: "tool"
  status: "active"
  updated: "2026-02-15"
  modularized: "false"
  tags: "web audio, stem mixer, multi-track, channel merger, soundtouch, audio worklet, stem playback, individual volume"
  related-skills: "moai-lang-typescript, moai-domain-frontend, moai-tool-demucs"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["stem mixer", "multi-track", "web audio", "channel merger", "stem playback", "individual volume", "audio stems", "stem mixing", "ChannelMergerNode", "AudioWorklet"]
  agents: ["expert-frontend"]
  phases: ["run"]
  languages: ["typescript"]
---

# Web Audio API Multi-Track Stem Mixing Guide

Synchronized playback of 4-6 separated audio stems with individual volume control, SoundTouch speed/pitch processing, and Web Audio API routing.

## Quick Reference

### Multi-Track Audio Graph Architecture

```
Stem AudioBuffers (4-6 stereo buffers from Demucs)
  |
  |-- vocals:  WebAudioBufferSource -> GainNode (0~1.0)  --\
  |-- drums:   WebAudioBufferSource -> GainNode (0~1.0)  ---|
  |-- bass:    WebAudioBufferSource -> GainNode (0~1.0)  ---|- summed in onaudioprocess
  |-- guitar:  WebAudioBufferSource -> GainNode (0~1.0)  ---|
  |-- piano:   WebAudioBufferSource -> GainNode (0~1.0)  --/
  |
  v
ScriptProcessorNode (manual sample mixing + SoundTouch)
  |
  v
SimpleFilter(SoundTouch) -- master tempo/pitch
  |
  v
GainNode (master volume) -> AnalyserNode -> Destination
```

Pre-SoundTouch mixing: Stems are mixed BEFORE SoundTouch processing. This ensures a single SoundTouch instance handles tempo/pitch for all stems, guaranteeing perfect synchronization.

### Key Web Audio API Nodes

- `GainNode`: Per-stem volume control (0.0 = mute, 1.0 = full). Use `gain.setTargetAtTime()` for smooth transitions.
- `ChannelMergerNode`: Combines multiple mono inputs into multi-channel output. NOT used here because SoundTouch expects stereo input, not 8+ channel.
- `ScriptProcessorNode`: Manual sample-level processing in `onaudioprocess` callback. Deprecated but stable for SoundTouch integration.
- `AudioWorkletNode`: Modern replacement for ScriptProcessorNode. Runs on audio thread. Use with `@soundtouchjs/audio-worklet`.

### Two Architecture Approaches

Approach A (ScriptProcessorNode - current):
- Read raw samples from each stem's WebAudioBufferSource
- Apply per-stem gain multiplication manually
- Sum mixed samples, feed to SoundTouch SimpleFilter
- Output processed samples via ScriptProcessorNode
- Pros: Compatible with existing AudioEngine, no worklet setup
- Cons: Main thread processing, deprecated API

Approach B (AudioWorklet - future migration):
- Route stems through native GainNodes to ChannelMergerNode
- Feed merged output to SoundTouchWorklet (AudioWorkletNode)
- Output to master GainNode and destination
- Pros: Audio thread processing, modern API, no main thread blocking
- Cons: Requires worklet registration, @soundtouchjs/audio-worklet dependency

### Stem Data Structure

```typescript
interface StemTrack {
  name: string              // "vocals" | "drums" | "bass" | "guitar" | "piano" | "other"
  buffer: AudioBuffer       // Decoded audio buffer from Demucs WAV output
  source: WebAudioBufferSource  // soundtouchjs buffer source wrapper
  gain: number              // 0.0 ~ 1.0 (individual volume)
  muted: boolean            // Mute state
  solo: boolean             // Solo state
}
```

---

## Implementation Guide

### Approach A: ScriptProcessorNode (Current Compatibility)

This approach extends the existing `AudioEngine.ts` pattern, keeping SoundTouch's SimpleFilter while adding multi-source stem support.

#### Loading Multiple Stem Buffers

```typescript
interface StemBuffers {
  [stemName: string]: AudioBuffer
}

async function loadStemBuffers(
  context: AudioContext,
  stemUrls: Record<string, string>
): Promise<StemBuffers> {
  // [HARD] Load all stems in parallel for faster initialization
  const entries = Object.entries(stemUrls)
  const results = await Promise.all(
    entries.map(async ([name, url]) => {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)
      return [name, audioBuffer] as const
    })
  )
  return Object.fromEntries(results)
}
```

[HARD] All stem buffers MUST have identical `sampleRate` and `duration`. Demucs outputs stems at the same sample rate and length as the original. If any stem has a different length, pad or truncate to match the shortest.

#### Multi-Source SoundTouch Pipeline

The core pattern: create one `WebAudioBufferSource` per stem, but process all stems manually in a single `onaudioprocess` callback by summing their samples before feeding to SoundTouch.

```typescript
// Per-stem source and gain state
interface StemState {
  source: WebAudioBufferSource
  gain: number      // 0.0 ~ 1.0
  muted: boolean
  solo: boolean
}

class StemMixer {
  private stems: Map<string, StemState> = new Map()
  private soundtouch: SoundTouch
  private scriptNode: ScriptProcessorNode
  private gainNode: GainNode          // Master volume
  private analyserNode: AnalyserNode
  private isPlaying = false
  private hasSolo = false             // Any stem soloed?

  constructor(
    private context: AudioContext,
    stemBuffers: StemBuffers
  ) {
    // Create SoundTouch instance (master speed/pitch)
    this.soundtouch = new SoundTouch()
    this.soundtouch.tempo = 1.0
    this.soundtouch.pitchSemitones = 0

    // Create per-stem sources
    for (const [name, buffer] of Object.entries(stemBuffers)) {
      this.stems.set(name, {
        source: new WebAudioBufferSource(buffer),
        gain: 1.0,
        muted: false,
        solo: false,
      })
    }

    // Create audio graph nodes
    this.gainNode = context.createGain()
    this.analyserNode = context.createAnalyser()
    this.scriptNode = context.createScriptProcessor(4096, 2, 2)

    // Connect: ScriptProcessor -> MasterGain -> Analyser -> Destination
    this.scriptNode.connect(this.gainNode)
    this.gainNode.connect(this.analyserNode)
    this.analyserNode.connect(context.destination)

    this.setupProcessing()
  }
```

#### Manual Sample Mixing in onaudioprocess

```typescript
  private setupProcessing(): void {
    const bufferSize = 4096
    // Temp buffers for each stem extraction
    const tempSamples = new Float32Array(bufferSize * 2)
    // Mixed output buffer
    const mixedSamples = new Float32Array(bufferSize * 2)

    this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const left = event.outputBuffer.getChannelData(0)
      const right = event.outputBuffer.getChannelData(1)

      if (!this.isPlaying) {
        left.fill(0)
        right.fill(0)
        return
      }

      // Clear mixed buffer
      mixedSamples.fill(0)

      let hasAudio = false
      for (const [, stem] of this.stems) {
        // Skip muted stems (respect solo logic)
        const effectiveGain = this.getEffectiveGain(stem)
        if (effectiveGain === 0) continue

        // Extract raw samples from this stem's source
        const extracted = stem.source.extract(tempSamples, bufferSize)
        if (extracted === 0) continue
        hasAudio = true

        // Mix: multiply by gain and sum into mixedSamples
        for (let i = 0; i < extracted * 2; i++) {
          mixedSamples[i] += tempSamples[i] * effectiveGain
        }
      }

      if (!hasAudio) {
        left.fill(0)
        right.fill(0)
        this.handlePlaybackEnded()
        return
      }

      // Feed mixed samples to SoundTouch for tempo/pitch processing
      // SoundTouch processes interleaved stereo [L,R,L,R,...]
      this.soundtouch.putSamples(mixedSamples, bufferSize)

      // Extract processed samples from SoundTouch
      const processed = new Float32Array(bufferSize * 2)
      const received = this.soundtouch.receiveSamples(processed, bufferSize)

      // De-interleave to output channels
      for (let i = 0; i < received; i++) {
        left[i] = processed[i * 2]
        right[i] = processed[i * 2 + 1]
      }
      for (let i = received; i < bufferSize; i++) {
        left[i] = 0
        right[i] = 0
      }
    }
  }
```

Note: The above shows the SoundTouch `putSamples`/`receiveSamples` pattern. Alternatively, wrap the mixed stem read in a custom source object passed to `SimpleFilter`, similar to how the existing `AudioEngine` uses `SimpleFilter.extract()`. Choose based on your SoundTouch integration style.

#### Effective Gain with Solo/Mute Logic

```typescript
  private getEffectiveGain(stem: StemState): number {
    if (stem.muted) return 0
    if (this.hasSolo && !stem.solo) return 0
    return stem.gain
  }

  setStemGain(stemName: string, gain: number): void {
    const stem = this.stems.get(stemName)
    if (stem) stem.gain = Math.max(0, Math.min(1, gain))
  }

  setStemMuted(stemName: string, muted: boolean): void {
    const stem = this.stems.get(stemName)
    if (stem) stem.muted = muted
  }

  setStemSolo(stemName: string, solo: boolean): void {
    const stem = this.stems.get(stemName)
    if (stem) stem.solo = solo
    this.hasSolo = [...this.stems.values()].some(s => s.solo)
  }
```

[HARD] Solo logic: when ANY stem is soloed, ONLY soloed stems produce audio. When no stems are soloed, all non-muted stems play. Recalculate `hasSolo` on every solo toggle.

#### Synchronized Seek Across All Stems

```typescript
  seek(timeSeconds: number): void {
    if (!this.stems.size) return

    // Get sample rate from first stem
    const firstStem = this.stems.values().next().value
    const sampleRate = firstStem.source.buffer.sampleRate
    const samplePosition = Math.floor(timeSeconds * sampleRate)

    // [HARD] Set ALL stem sourcePositions atomically
    for (const [, stem] of this.stems) {
      stem.source.sourcePosition = samplePosition
    }

    // Clear SoundTouch internal buffers to prevent stale audio
    this.soundtouch.clear()
  }
```

[HARD] After seek, ALWAYS call `soundtouch.clear()` (or recreate the SoundTouch instance). Stale samples in SoundTouch's internal buffer will produce audible glitches at the new position.

[HARD] Set ALL stem `sourcePosition` values in the same synchronous block. Do NOT use async operations or setTimeout between stem position updates -- this causes inter-stem drift.

#### A-B Loop Sync Pattern

```typescript
  private loopStart: number | null = null
  private loopEnd: number | null = null

  setLoop(startSeconds: number, endSeconds: number): void {
    this.loopStart = startSeconds
    this.loopEnd = endSeconds
  }

  clearLoop(): void {
    this.loopStart = null
    this.loopEnd = null
  }

  // Call inside time update loop (requestAnimationFrame)
  private checkLoop(): void {
    if (this.loopStart === null || this.loopEnd === null) return
    const currentTime = this.getCurrentTime()
    if (currentTime >= this.loopEnd) {
      this.seek(this.loopStart)  // Reuses synchronized seek
    }
  }
```

### Approach B: AudioWorklet (Future Migration)

#### @soundtouchjs/audio-worklet Setup

```bash
npm install @soundtouchjs/audio-worklet
```

```typescript
// Register the worklet processor (call once at app startup)
await context.audioWorklet.addModule(
  new URL('@soundtouchjs/audio-worklet/dist/soundtouch-worklet.js', import.meta.url)
)

// Create the SoundTouch AudioWorkletNode
const soundtouchNode = new AudioWorkletNode(context, 'soundtouch-worklet', {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
})

// Control tempo/pitch via AudioParam or MessagePort
soundtouchNode.port.postMessage({ type: 'tempo', value: 1.0 })
soundtouchNode.port.postMessage({ type: 'pitchSemitones', value: 0 })
```

#### AudioWorklet Multi-Source Graph

```typescript
// Native Web Audio API routing (no manual sample mixing needed)
//
// StemGainNode(vocals) --\
// StemGainNode(drums)  ---\
// StemGainNode(bass)   ----+-- merger -- soundtouchNode -- masterGain -- analyser -- dest
// StemGainNode(guitar) ---/
// StemGainNode(piano)  --/

function createWorkletGraph(
  context: AudioContext,
  stemBuffers: StemBuffers,
  soundtouchNode: AudioWorkletNode
): Map<string, { sourceNode: AudioBufferSourceNode; gainNode: GainNode }> {
  const stemNodes = new Map()
  const masterGain = context.createGain()
  const analyser = context.createAnalyser()

  // Connect: soundtouch -> master gain -> analyser -> destination
  soundtouchNode.connect(masterGain)
  masterGain.connect(analyser)
  analyser.connect(context.destination)

  for (const [name, buffer] of Object.entries(stemBuffers)) {
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = false

    const gain = context.createGain()
    gain.gain.value = 1.0

    // Connect: source -> gain -> soundtouch worklet
    source.connect(gain)
    gain.connect(soundtouchNode)

    stemNodes.set(name, { sourceNode: source, gainNode: gain })
  }

  return stemNodes
}
```

[HARD] With AudioWorklet approach, seek requires stopping all `AudioBufferSourceNode`s, creating new ones with the correct `offset`, and calling `start()` again. `AudioBufferSourceNode` is single-use -- once stopped, it cannot restart.

#### Migration Checklist: ScriptProcessorNode to AudioWorklet

1. Install `@soundtouchjs/audio-worklet` package
2. Register worklet module via `audioWorklet.addModule()`
3. Replace `ScriptProcessorNode` + manual mixing with native `GainNode` routing
4. Replace `SimpleFilter.extract()` with `AudioWorkletNode` passthrough
5. Update seek logic: recreate `AudioBufferSourceNode` instances on each seek
6. Update speed/pitch control: use `port.postMessage()` instead of direct property
7. Test cross-browser: AudioWorklet supported in Chrome 64+, Firefox 76+, Safari 14.1+
8. Keep ScriptProcessorNode fallback for older browsers if needed

---

## Advanced Implementation

### Synchronization Rules

[HARD] Never modify individual stem `sourcePosition` outside of a synchronized seek call. Individual position changes cause stems to drift apart permanently.

[HARD] When changing speed/pitch, set `soundtouch.tempo`/`pitchSemitones` on the shared SoundTouch instance. Never create per-stem SoundTouch instances -- tempo rounding differences will cause progressive drift between stems.

[HARD] Time tracking must use a single stem's `sourcePosition / sampleRate` as the authoritative time source. Do NOT average positions across stems -- one authoritative source prevents drift accumulation.

### Memory Management

Memory budget for a 5-minute song at 44.1kHz stereo 32-bit float:
- Per stem: ~100MB raw PCM (44100 * 300s * 2ch * 4 bytes)
- After decodeAudioData: browser manages ~50-100MB per stem internally
- Total for 6 stems: ~300-600MB browser memory
- For memory-constrained devices, load stems sequentially and track cumulative usage. Skip remaining stems if budget exceeded.

[HARD] Load stems sequentially (not parallel) if memory is a concern. Parallel `decodeAudioData` calls can spike memory to 2x the final footprint due to concurrent ArrayBuffer + AudioBuffer existence.

### Dispose and Cleanup Pattern

```typescript
  dispose(): void {
    this.isPlaying = false
    // 1. Clear callback BEFORE disconnect (prevents use-after-free)
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null
      try { this.scriptNode.disconnect() } catch { /* already disconnected */ }
    }
    // 2. Clear SoundTouch internal buffers
    this.soundtouch?.clear()
    // 3. Release per-stem sources
    this.stems.clear()
    // 4. Disconnect graph nodes (gainNode, analyserNode)
    // 5. Do NOT close AudioContext if shared -- let parent manage lifecycle
    this.scriptNode = null; this.soundtouch = null
    this.gainNode = null; this.analyserNode = null
  }
```

[HARD] Always set `scriptNode.onaudioprocess = null` BEFORE calling `disconnect()`. The callback can fire during disconnection on some browsers, causing use-after-free errors.

[HARD] Call `soundtouch.clear()` during dispose. SoundTouch holds internal sample buffers that will not be garbage collected until cleared.

### Volume Crossfade and Performance

For Approach A (manual mixing), gain changes take effect on the next `onaudioprocess` callback (~93ms at 4096 buffer size), which is smooth enough for UI sliders. For Approach B (native GainNode), use `gainNode.gain.setTargetAtTime(target, context.currentTime, 0.015)` for glitch-free transitions.

Buffer underrun detection: track time between `onaudioprocess` calls. If the interval exceeds 2x the expected ~93ms, log a warning. Persistent underruns indicate the main thread is overloaded -- consider reducing stem count or migrating to AudioWorklet.

### Browser Compatibility

ScriptProcessorNode: Chrome 14+, Firefox 25+, Safari 6+ (deprecated but universally supported). AudioWorklet: Chrome 64+, Firefox 76+, Safari 14.1+. Feature detection:

```typescript
const supportsWorklet = typeof AudioWorkletNode !== 'undefined'
  && typeof context.audioWorklet?.addModule === 'function'
```

---

## Works Well With

- moai-tool-demucs: Backend stem separation (produces the WAV stems this skill consumes)
- moai-lang-typescript: TypeScript coding standards and patterns
- moai-domain-frontend: React frontend architecture
- moai-library-shadcn: UI components for stem mixer controls (sliders, buttons)
- expert-frontend: Frontend implementation agent
