import { describe, it, expect } from 'vitest'
import {
  KEYBOARD_SHORTCUTS,
  TIME_INTERVALS,
  SUPPORTED_AUDIO_FORMATS,
  type KeyboardShortcut,
  type AudioFormat
} from '@/utils/constants'

describe('constants', () => {
  describe('KEYBOARD_SHORTCUTS', () => {
    it('should have SPACE shortcut for play/pause', () => {
      expect(KEYBOARD_SHORTCUTS.SPACE).toBe('Space')
    })

    it('should have ARROW_LEFT shortcut for -5 seconds', () => {
      expect(KEYBOARD_SHORTCUTS.ARROW_LEFT).toBe('ArrowLeft')
    })

    it('should have ARROW_RIGHT shortcut for +5 seconds', () => {
      expect(KEYBOARD_SHORTCUTS.ARROW_RIGHT).toBe('ArrowRight')
    })

    it('should have I key for setting A point', () => {
      expect(KEYBOARD_SHORTCUTS.SET_A).toBe('i')
    })

    it('should have O key for setting B point', () => {
      expect(KEYBOARD_SHORTCUTS.SET_B).toBe('o')
    })

    it('should have A key for jumping to A when loop enabled', () => {
      expect(KEYBOARD_SHORTCUTS.JUMP_TO_A).toBe('a')
    })

    it('should have M key for mute', () => {
      expect(KEYBOARD_SHORTCUTS.MUTE).toBe('m')
    })
  })

  describe('TIME_INTERVALS', () => {
    it('should have SEEK_STEP of 5 seconds', () => {
      expect(TIME_INTERVALS.SEEK_STEP).toBe(5)
    })

    it('should have LOOP_LATENCY_TARGET of 50ms', () => {
      expect(TIME_INTERVALS.LOOP_LATENCY_TARGET).toBe(50)
    })
  })

  describe('SUPPORTED_AUDIO_FORMATS', () => {
    it('should include audio/mpeg for MP3', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('audio/mpeg')
    })

    it('should include audio/wav for WAV', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('audio/wav')
    })

    it('should include audio/mp4 for M4A', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('audio/mp4')
    })

    it('should include audio/ogg for OGG', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('audio/ogg')
    })

    it('should have exactly 4 supported formats', () => {
      expect(SUPPORTED_AUDIO_FORMATS.length).toBe(4)
    })
  })
})
