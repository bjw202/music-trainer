import { describe, it, expect, beforeEach } from 'vitest'
import { playerStore } from '@/stores/playerStore'

describe('playerStore', () => {
  beforeEach(() => {
    const { reset } = playerStore.getState()
    reset()
  })

  describe('initial state', () => {
    it('should not be playing initially', () => {
      const { isPlaying } = playerStore.getState()
      expect(isPlaying).toBe(false)
    })

    it('should not be paused initially', () => {
      const { isPaused } = playerStore.getState()
      expect(isPaused).toBe(false)
    })

    it('should be stopped initially', () => {
      const { isStopped } = playerStore.getState()
      expect(isStopped).toBe(true)
    })

    it('should have zero currentTime initially', () => {
      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(0)
    })

    it('should have zero duration initially', () => {
      const { duration } = playerStore.getState()
      expect(duration).toBe(0)
    })
  })

  describe('play', () => {
    it('should set isPlaying to true', () => {
      const { play } = playerStore.getState()
      play()

      const { isPlaying, isPaused, isStopped } = playerStore.getState()
      expect(isPlaying).toBe(true)
      expect(isPaused).toBe(false)
      expect(isStopped).toBe(false)
    })

    it('should clear paused state when playing', () => {
      const { pause, play } = playerStore.getState()
      pause()
      play()

      const { isPaused } = playerStore.getState()
      expect(isPaused).toBe(false)
    })

    it('should clear stopped state when playing', () => {
      const { stop, play } = playerStore.getState()
      stop()
      play()

      const { isStopped } = playerStore.getState()
      expect(isStopped).toBe(false)
    })
  })

  describe('pause', () => {
    it('should set isPaused to true', () => {
      const { play, pause } = playerStore.getState()
      play()
      pause()

      const { isPlaying, isPaused, isStopped } = playerStore.getState()
      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(true)
      expect(isStopped).toBe(false)
    })

    it('should clear playing state when paused', () => {
      const { play, pause } = playerStore.getState()
      play()
      pause()

      const { isPlaying } = playerStore.getState()
      expect(isPlaying).toBe(false)
    })
  })

  describe('stop', () => {
    it('should set isStopped to true', () => {
      const { play, stop } = playerStore.getState()
      play()
      stop()

      const { isPlaying, isPaused, isStopped } = playerStore.getState()
      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
      expect(isStopped).toBe(true)
    })

    it('should reset currentTime to zero', () => {
      const { setCurrentTime, stop } = playerStore.getState()
      setCurrentTime(50)
      stop()

      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(0)
    })

    it('should clear playing and paused states', () => {
      const { play, pause, stop } = playerStore.getState()
      play()
      pause()
      stop()

      const { isPlaying, isPaused } = playerStore.getState()
      expect(isPlaying).toBe(false)
      expect(isPaused).toBe(false)
    })
  })

  describe('setCurrentTime', () => {
    it('should set currentTime', () => {
      const { setCurrentTime } = playerStore.getState()
      setCurrentTime(30)

      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(30)
    })

    it('should handle decimal time values', () => {
      const { setCurrentTime } = playerStore.getState()
      setCurrentTime(45.7)

      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(45.7)
    })

    it('should handle zero time', () => {
      const { setCurrentTime } = playerStore.getState()
      setCurrentTime(100)
      setCurrentTime(0)

      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(0)
    })

    it('should handle negative time', () => {
      const { setCurrentTime } = playerStore.getState()
      setCurrentTime(-10)

      const { currentTime } = playerStore.getState()
      expect(currentTime).toBe(-10)
    })
  })

  describe('setDuration', () => {
    it('should set duration', () => {
      const { setDuration } = playerStore.getState()
      setDuration(180)

      const { duration } = playerStore.getState()
      expect(duration).toBe(180)
    })

    it('should handle decimal duration values', () => {
      const { setDuration } = playerStore.getState()
      setDuration(120.5)

      const { duration } = playerStore.getState()
      expect(duration).toBe(120.5)
    })

    it('should handle zero duration', () => {
      const { setDuration } = playerStore.getState()
      setDuration(100)
      setDuration(0)

      const { duration } = playerStore.getState()
      expect(duration).toBe(0)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { play, setCurrentTime, setDuration, reset } = playerStore.getState()
      play()
      setCurrentTime(50)
      setDuration(120)

      reset()

      const state = playerStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isPaused).toBe(false)
      expect(state.isStopped).toBe(true)
      expect(state.currentTime).toBe(0)
      expect(state.duration).toBe(0)
    })
  })
})
