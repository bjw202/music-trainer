import { describe, it, expect } from 'vitest'
import { formatTime } from '@/utils/timeUtils'

describe('formatTime', () => {
  it('should format 0 seconds as "0:00"', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('should format 65 seconds as "1:05"', () => {
    expect(formatTime(65)).toBe('1:05')
  })

  it('should format 3661 seconds as "61:01"', () => {
    expect(formatTime(3661)).toBe('61:01')
  })

  it('should format single digit seconds with leading zero', () => {
    expect(formatTime(5)).toBe('0:05')
  })

  it('should format 59 seconds as "0:59"', () => {
    expect(formatTime(59)).toBe('0:59')
  })

  it('should format 60 seconds as "1:00"', () => {
    expect(formatTime(60)).toBe('1:00')
  })

  it('should format 3599 seconds as "59:59"', () => {
    expect(formatTime(3599)).toBe('59:59')
  })

  it('should format 3600 seconds as "60:00"', () => {
    expect(formatTime(3600)).toBe('60:00')
  })

  it('should handle negative seconds by treating as absolute value', () => {
    expect(formatTime(-5)).toBe('0:05')
  })

  it('should handle decimal seconds by flooring', () => {
    expect(formatTime(65.9)).toBe('1:05')
  })
})
