import { describe, it, expect, beforeEach } from 'vitest'
import { loopStore } from '@/stores/loopStore'

describe('loopStore', () => {
  beforeEach(() => {
    const { reset } = loopStore.getState()
    reset()
  })

  describe('initial state', () => {
    it('should have null loopA initially', () => {
      const { loopA } = loopStore.getState()
      expect(loopA).toBeNull()
    })

    it('should have null loopB initially', () => {
      const { loopB } = loopStore.getState()
      expect(loopB).toBeNull()
    })

    it('should have loopEnabled false initially', () => {
      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })
  })

  describe('setLoopA', () => {
    it('should set loopA time', () => {
      const { setLoopA } = loopStore.getState()
      setLoopA(30)

      const { loopA } = loopStore.getState()
      expect(loopA).toBe(30)
    })

    it('should handle decimal time values', () => {
      const { setLoopA } = loopStore.getState()
      setLoopA(45.7)

      const { loopA } = loopStore.getState()
      expect(loopA).toBe(45.7)
    })

    it('should handle zero time', () => {
      const { setLoopA } = loopStore.getState()
      setLoopA(0)

      const { loopA } = loopStore.getState()
      expect(loopA).toBe(0)
    })

    it('should allow setting negative time', () => {
      const { setLoopA } = loopStore.getState()
      setLoopA(-5)

      const { loopA } = loopStore.getState()
      expect(loopA).toBe(-5)
    })

    it('should clear existing loopA when setting null', () => {
      const { setLoopA } = loopStore.getState()
      setLoopA(30)
      setLoopA(null as any)

      const { loopA } = loopStore.getState()
      expect(loopA).toBeNull()
    })
  })

  describe('setLoopB', () => {
    it('should set loopB time', () => {
      const { setLoopB } = loopStore.getState()
      setLoopB(60)

      const { loopB } = loopStore.getState()
      expect(loopB).toBe(60)
    })

    it('should handle decimal time values', () => {
      const { setLoopB } = loopStore.getState()
      setLoopB(90.5)

      const { loopB } = loopStore.getState()
      expect(loopB).toBe(90.5)
    })

    it('should handle zero time', () => {
      const { setLoopB } = loopStore.getState()
      setLoopB(0)

      const { loopB } = loopStore.getState()
      expect(loopB).toBe(0)
    })

    it('should allow setting negative time', () => {
      const { setLoopB } = loopStore.getState()
      setLoopB(-10)

      const { loopB } = loopStore.getState()
      expect(loopB).toBe(-10)
    })

    it('should clear existing loopB when setting null', () => {
      const { setLoopB } = loopStore.getState()
      setLoopB(60)
      setLoopB(null as any)

      const { loopB } = loopStore.getState()
      expect(loopB).toBeNull()
    })
  })

  describe('toggleLoop', () => {
    it('should enable loop when disabled', () => {
      const { setLoopA, setLoopB, toggleLoop } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)
      toggleLoop()

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(true)
    })

    it('should disable loop when enabled', () => {
      const { setLoopA, setLoopB, toggleLoop } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)
      toggleLoop()
      toggleLoop()

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })

    it('should not enable loop if only loopA is set', () => {
      const { setLoopA, toggleLoop } = loopStore.getState()
      setLoopA(10)
      toggleLoop()

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })

    it('should not enable loop if only loopB is set', () => {
      const { setLoopB, toggleLoop } = loopStore.getState()
      setLoopB(50)
      toggleLoop()

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })

    it('should not enable loop if neither point is set', () => {
      const { toggleLoop } = loopStore.getState()
      toggleLoop()

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })

    it('should allow toggling off even if only one point is set', () => {
      const { setLoopA, setLoopB, toggleLoop } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)
      toggleLoop()
      setLoopB(null)
      toggleLoop() // should not crash

      const { loopEnabled } = loopStore.getState()
      expect(loopEnabled).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { setLoopA, setLoopB, toggleLoop, reset } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)
      toggleLoop()

      reset()

      const state = loopStore.getState()
      expect(state.loopA).toBeNull()
      expect(state.loopB).toBeNull()
      expect(state.loopEnabled).toBe(false)
    })
  })

  describe('loop interaction', () => {
    it('should allow loopA and loopB to be set independently', () => {
      const { setLoopA, setLoopB } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)

      const { loopA, loopB } = loopStore.getState()
      expect(loopA).toBe(10)
      expect(loopB).toBe(50)
    })

    it('should allow loopB to be set before loopA', () => {
      const { setLoopA, setLoopB } = loopStore.getState()
      setLoopB(50)
      setLoopA(10)

      const { loopA, loopB } = loopStore.getState()
      expect(loopA).toBe(10)
      expect(loopB).toBe(50)
    })

    it('should allow updating loop points after enabling loop', () => {
      const { setLoopA, setLoopB, toggleLoop } = loopStore.getState()
      setLoopA(10)
      setLoopB(50)
      toggleLoop()

      setLoopA(15)
      setLoopB(45)

      const { loopA, loopB } = loopStore.getState()
      expect(loopA).toBe(15)
      expect(loopB).toBe(45)
    })
  })
})
