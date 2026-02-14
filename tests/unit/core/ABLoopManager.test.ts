/**
 * AB Loop Manager Unit Tests
 * Characterization tests for loop behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ABLoopManager } from '@/core/ABLoopManager'

describe('ABLoopManager - Characterization Tests', () => {
  let loopManager: ABLoopManager

  beforeEach(() => {
    loopManager = new ABLoopManager()
  })

  describe('setLoopA()', () => {
    it('should set loop A point', () => {
      loopManager.setLoopA(5.0)

      expect(loopManager['loopA']).toBe(5.0)
    })

    it('should accept null to clear A point', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopA(null)

      expect(loopManager['loopA']).toBeNull()
    })

    it('should clamp A point to non-negative', () => {
      loopManager.setLoopA(-5.0)

      expect(loopManager['loopA']).toBe(0)
    })
  })

  describe('setLoopB()', () => {
    it('should set loop B point', () => {
      loopManager.setLoopB(10.0)

      expect(loopManager['loopB']).toBe(10.0)
    })

    it('should accept null to clear B point', () => {
      loopManager.setLoopB(10.0)
      loopManager.setLoopB(null)

      expect(loopManager['loopB']).toBeNull()
    })

    it('should clamp B point to non-negative', () => {
      loopManager.setLoopB(-10.0)

      expect(loopManager['loopB']).toBe(0)
    })
  })

  describe('enableLoop()', () => {
    it('should enable loop when both points are set', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      expect(loopManager['loopEnabled']).toBe(true)
    })

    it('should disable loop', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)
      loopManager.enableLoop(false)

      expect(loopManager['loopEnabled']).toBe(false)
    })

    it('should not enable loop if A point is null', () => {
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      expect(loopManager['loopEnabled']).toBe(false)
    })

    it('should not enable loop if B point is null', () => {
      loopManager.setLoopA(5.0)
      loopManager.enableLoop(true)

      expect(loopManager['loopEnabled']).toBe(false)
    })
  })

  describe('checkAndLoop()', () => {
    it('should return false when loop is disabled', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)

      const shouldLoop = loopManager.checkAndLoop(8.0, () => {})

      expect(shouldLoop).toBe(false)
    })

    it('should return false when current time is before A', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(3.0, () => {})

      expect(shouldLoop).toBe(false)
    })

    it('should return false when current time is before B', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(7.0, () => {})

      expect(shouldLoop).toBe(false)
    })

    it('should return true and trigger callback when time >= B', () => {
      const seekCallback = vi.fn()
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(10.0, seekCallback)

      expect(shouldLoop).toBe(true)
      expect(seekCallback).toHaveBeenCalledWith(5.0)
    })

    it('should handle A > B edge case by disabling loop', () => {
      loopManager.setLoopA(10.0)
      loopManager.setLoopB(5.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(7.0, () => {})

      expect(shouldLoop).toBe(false)
      expect(loopManager['loopEnabled']).toBe(false)
    })

    it('should handle equal A and B by disabling loop', () => {
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(5.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(5.0, () => {})

      expect(shouldLoop).toBe(false)
      expect(loopManager['loopEnabled']).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle very small loop regions', () => {
      const seekCallback = vi.fn()
      loopManager.setLoopA(5.0)
      loopManager.setLoopB(5.01) // 10ms region
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(5.01, seekCallback)

      expect(shouldLoop).toBe(true)
    })

    it('should handle zero as valid loop point', () => {
      const seekCallback = vi.fn()
      loopManager.setLoopA(0)
      loopManager.setLoopB(10.0)
      loopManager.enableLoop(true)

      const shouldLoop = loopManager.checkAndLoop(10.0, seekCallback)

      expect(shouldLoop).toBe(true)
    })
  })
})
