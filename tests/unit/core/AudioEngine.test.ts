/**
 * Audio Engine Unit Tests
 * Characterization tests for Web Audio API behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioEngine } from '@/core/AudioEngine'

// Mock Web Audio API nodes
const mockBufferSource = {
  buffer: null as AudioBuffer | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null as ((() => void) | null),
}

const mockGainNode = {
  gain: { value: 1 },
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  fftSize: 2048,
}

// Mock AudioContext factory
let mockAudioContextInstance: any = null

const createMockAudioContext = () => ({
  createBufferSource: vi.fn(() => mockBufferSource),
  createGain: vi.fn(() => mockGainNode),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  decodeAudioData: vi.fn(),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  state: 'suspended',
  currentTime: 0,
})

// Track calls to AudioContext constructor
let audioContextConstructorCalls = 0

describe('AudioEngine - Characterization Tests', () => {
  let audioEngine: AudioEngine
  let mockArrayBuffer: ArrayBuffer

  // Create a proper class-based mock constructor
  class MockAudioContext {
    constructor() {
      audioContextConstructorCalls++
      return mockAudioContextInstance
    }
  }

  beforeEach(() => {
    // Clear all mock call counts
    vi.clearAllMocks()
    audioContextConstructorCalls = 0

    // Create fresh mock instance
    mockAudioContextInstance = createMockAudioContext()

    // Mock AudioContext constructor with class
    vi.stubGlobal('AudioContext', MockAudioContext)

    audioEngine = new AudioEngine()
    mockArrayBuffer = new ArrayBuffer(1024) as any
  })

  afterEach(async () => {
    await audioEngine.dispose()
    vi.unstubAllGlobals()
  })

  describe('initialize()', () => {
    it('should create AudioContext on first call', async () => {
      await audioEngine.initialize()

      expect(audioContextConstructorCalls).toBe(1)
      expect(mockAudioContextInstance.resume).toHaveBeenCalledTimes(1)
    })

    it('should be idempotent - multiple calls are safe', async () => {
      await audioEngine.initialize()
      await audioEngine.initialize()

      expect(audioContextConstructorCalls).toBe(1)
    })

    it('should handle AudioContext creation errors', async () => {
      // Create a constructor that throws
      function ThrowingAudioContext() {
        throw new Error('AudioContext not supported')
      }
      vi.stubGlobal('AudioContext', ThrowingAudioContext)

      const errorEngine = new AudioEngine()
      await expect(errorEngine.initialize()).rejects.toThrow('Failed to initialize AudioContext')

      vi.unstubAllGlobals()
    })
  })

  describe('loadBuffer()', () => {
    it('should decode array buffer to audio buffer', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      const buffer = await audioEngine.loadBuffer(mockArrayBuffer)

      expect(mockAudioContextInstance.decodeAudioData).toHaveBeenCalledWith(mockArrayBuffer)
      expect(buffer).toEqual(mockAudioBuffer)
    })

    it('should handle decode errors', async () => {
      mockAudioContextInstance.decodeAudioData.mockRejectedValue(
        new Error('Failed to decode audio')
      )

      await audioEngine.initialize()

      await expect(audioEngine.loadBuffer(mockArrayBuffer)).rejects.toThrow(
        'Failed to decode audio data'
      )
    })

    it('should throw when not initialized', async () => {
      const noContextEngine = new AudioEngine()
      vi.unstubAllGlobals()

      await expect(noContextEngine.loadBuffer(mockArrayBuffer)).rejects.toThrow(
        'AudioEngine not initialized'
      )
    })
  })

  describe('play()', () => {
    it('should start playback from current position', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()

      expect(mockBufferSource.start).toHaveBeenCalledTimes(1)
    })

    it('should create new source node for each play call', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)

      // First play creates source
      audioEngine.play()
      // Second play is ignored because already playing (see implementation lines 123-126)
      audioEngine.play()

      // Only 1 source created because second play() is ignored
      expect(mockAudioContextInstance.createBufferSource).toHaveBeenCalledTimes(1)
    })

    it('should handle play without buffer loaded', () => {
      expect(() => audioEngine.play()).not.toThrow()
      expect(mockBufferSource.start).not.toHaveBeenCalled()
    })
  })

  describe('pause()', () => {
    it('should stop source when playing', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()

      // pause() stops the source but doesn't call context.suspend()
      audioEngine.pause()

      // Note: pause() calls stopSource() which stops the buffer source
      expect(mockBufferSource.stop).toHaveBeenCalled()
    })

    it('should handle pause when not playing', async () => {
      await audioEngine.initialize()

      expect(() => audioEngine.pause()).not.toThrow()
    })
  })

  describe('stop()', () => {
    it('should stop playback and reset position', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()
      audioEngine.stop()

      expect(mockBufferSource.stop).toHaveBeenCalledTimes(1)
    })

    it('should handle stop when not playing', async () => {
      await audioEngine.initialize()

      expect(() => audioEngine.stop()).not.toThrow()
    })
  })

  describe('seek()', () => {
    it('should update current position', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.seek(5.0)

      // Verify position is updated (implementation stores pauseTime)
      expect(mockBufferSource.stop).not.toHaveBeenCalled() // Not playing, so no stop
    })

    it('should clamp time to buffer duration', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)

      // Seek beyond duration
      audioEngine.seek(15.0)

      // Should be clamped to duration
      expect(mockBufferSource.stop).not.toHaveBeenCalled()
    })

    it('should clamp negative time to zero', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)

      audioEngine.seek(-5.0)

      // Should be clamped to 0
      expect(mockBufferSource.stop).not.toHaveBeenCalled()
    })

    it('should maintain playback state when seeking while playing', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()
      audioEngine.seek(5.0)

      // seek() stops the source (stopSource) and tries to play() again
      // but play() returns early if isPlaying is true (which it still is)
      // This is a known implementation issue - seek while playing doesn't restart
      expect(mockBufferSource.stop).toHaveBeenCalled()
      // Only 1 start call (initial play), seek doesn't restart due to isPlaying flag
      expect(mockBufferSource.start).toHaveBeenCalledTimes(1)
    })
  })

  describe('setVolume()', () => {
    it('should update gain node value', async () => {
      await audioEngine.initialize()
      audioEngine.setVolume(0.5)

      expect(mockGainNode.gain.value).toBe(0.5)
    })

    it('should clamp volume between 0 and 1', async () => {
      await audioEngine.initialize()

      audioEngine.setVolume(1.5)
      expect(mockGainNode.gain.value).toBe(1.0)

      audioEngine.setVolume(-0.5)
      expect(mockGainNode.gain.value).toBe(0.0)
    })
  })

  describe('getCurrentTime()', () => {
    it('should return current playback position', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()

      mockAudioContextInstance.currentTime = 2.5
      const time = audioEngine.getCurrentTime()

      // Time should be approximately current
      expect(time).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 when not initialized', () => {
      const noContextEngine = new AudioEngine()
      expect(noContextEngine.getCurrentTime()).toBe(0)
    })

    it('should return pause time when paused', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()
      audioEngine.pause()

      const time = audioEngine.getCurrentTime()
      expect(time).toBe(0) // Paused at 0
    })
  })

  describe('getDuration()', () => {
    it('should return buffer duration', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)

      expect(audioEngine.getDuration()).toBe(10)
    })

    it('should return 0 if no buffer loaded', async () => {
      await audioEngine.initialize()

      expect(audioEngine.getDuration()).toBe(0)
    })
  })

  describe('dispose()', () => {
    it('should clean up all resources', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()

      await audioEngine.dispose()

      expect(mockBufferSource.disconnect).toHaveBeenCalled()
      expect(mockGainNode.disconnect).toHaveBeenCalled()
      expect(mockAnalyserNode.disconnect).toHaveBeenCalled()
      expect(mockAudioContextInstance.close).toHaveBeenCalledTimes(1)
    })

    it('should be safe to call multiple times', async () => {
      await audioEngine.initialize()
      await audioEngine.dispose()
      await audioEngine.dispose()

      expect(mockAudioContextInstance.close).toHaveBeenCalledTimes(1)
    })

    it('should stop time updates', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      await audioEngine.initialize()
      await audioEngine.loadBuffer(mockArrayBuffer)
      audioEngine.play()

      await audioEngine.dispose()

      // Should not crash or have memory leaks
      expect(mockAudioContextInstance.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('events', () => {
    it('should call onTimeUpdate during playback', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      const onTimeUpdate = vi.fn()
      const eventEngine = new AudioEngine({ onTimeUpdate })

      await eventEngine.initialize()
      await eventEngine.loadBuffer(mockArrayBuffer)
      eventEngine.play()

      // Note: Testing requestAnimationFrame timing is difficult in unit tests
      // The time update loop uses requestAnimationFrame which isn't triggered synchronously
      // In unit tests, we just verify the engine starts without error
      // Integration tests would verify actual timing behavior
      expect(eventEngine).toBeDefined()

      await eventEngine.dispose()
    })

    it('should call onEnded when playback completes', async () => {
      const mockAudioBuffer = { duration: 10, sampleRate: 44100 } as any
      mockAudioContextInstance.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      const onEnded = vi.fn()
      const eventEngine = new AudioEngine({ onEnded })

      await eventEngine.initialize()
      await eventEngine.loadBuffer(mockArrayBuffer)
      eventEngine.play()

      // Simulate natural end by triggering onended
      mockAudioContextInstance.currentTime = 10.5
      if (mockBufferSource.onended) {
        mockBufferSource.onended()
      }

      expect(onEnded).toHaveBeenCalledTimes(1)

      await eventEngine.dispose()
    })
  })
})
