import { describe, it, expect, beforeEach } from 'vitest'
import { controlStore } from '@/stores/controlStore'

describe('controlStore', () => {
  beforeEach(() => {
    const { reset } = controlStore.getState()
    reset()
  })

  describe('initial state', () => {
    it('should have volume 100 initially', () => {
      const { volume } = controlStore.getState()
      expect(volume).toBe(100)
    })

    it('should not be muted initially', () => {
      const { muted } = controlStore.getState()
      expect(muted).toBe(false)
    })

    it('should have previousVolume 100 initially', () => {
      const { previousVolume } = controlStore.getState()
      expect(previousVolume).toBe(100)
    })
  })

  describe('setVolume', () => {
    it('should set volume', () => {
      const { setVolume } = controlStore.getState()
      setVolume(50)

      const { volume } = controlStore.getState()
      expect(volume).toBe(50)
    })

    it('should clamp volume to minimum 0', () => {
      const { setVolume } = controlStore.getState()
      setVolume(-10)

      const { volume } = controlStore.getState()
      expect(volume).toBe(0)
    })

    it('should clamp volume to maximum 100', () => {
      const { setVolume } = controlStore.getState()
      setVolume(150)

      const { volume } = controlStore.getState()
      expect(volume).toBe(100)
    })

    it('should handle boundary value 0', () => {
      const { setVolume } = controlStore.getState()
      setVolume(0)

      const { volume } = controlStore.getState()
      expect(volume).toBe(0)
    })

    it('should handle boundary value 100', () => {
      const { setVolume } = controlStore.getState()
      setVolume(100)

      const { volume } = controlStore.getState()
      expect(volume).toBe(100)
    })

    it('should handle decimal values', () => {
      const { setVolume } = controlStore.getState()
      setVolume(75.5)

      const { volume } = controlStore.getState()
      expect(volume).toBe(75.5)
    })

    it('should unmute when volume is set above 0', () => {
      const { setVolume, toggleMute } = controlStore.getState()
      toggleMute()
      setVolume(50)

      const { muted } = controlStore.getState()
      expect(muted).toBe(false)
    })
  })

  describe('toggleMute', () => {
    it('should mute when currently unmuted', () => {
      const { toggleMute } = controlStore.getState()
      toggleMute()

      const { muted, volume, previousVolume } = controlStore.getState()
      expect(muted).toBe(true)
      expect(volume).toBe(0)
      expect(previousVolume).toBe(100)
    })

    it('should unmute when currently muted', () => {
      const { toggleMute } = controlStore.getState()
      toggleMute() // mute
      toggleMute() // unmute

      const { muted, volume } = controlStore.getState()
      expect(muted).toBe(false)
      expect(volume).toBe(100)
    })

    it('should restore previous volume when unmuting', () => {
      const { setVolume, toggleMute } = controlStore.getState()
      setVolume(70)
      toggleMute()
      toggleMute()

      const { volume } = controlStore.getState()
      expect(volume).toBe(70)
    })

    it('should restore to 100 if previous volume was 0', () => {
      const { setVolume, toggleMute } = controlStore.getState()
      setVolume(0)
      toggleMute()
      toggleMute()

      const { volume } = controlStore.getState()
      expect(volume).toBe(100)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { setVolume, toggleMute, reset } = controlStore.getState()
      setVolume(50)
      toggleMute()

      reset()

      const state = controlStore.getState()
      expect(state.volume).toBe(100)
      expect(state.muted).toBe(false)
      expect(state.previousVolume).toBe(100)
    })
  })
})
