import { describe, it, expect } from 'vitest'
import { getFileName, getFileSize } from '@/utils/fileUtils'

describe('getFileName', () => {
  it('should extract filename without extension for simple filename', () => {
    const file = new File([''], 'song.mp3', { type: 'audio/mpeg' })
    expect(getFileName(file)).toBe('song')
  })

  it('should extract filename without extension for filename with multiple dots', () => {
    const file = new File([''], 'my.song.final.mp3', { type: 'audio/mpeg' })
    expect(getFileName(file)).toBe('my.song.final')
  })

  it('should return filename without extension for WAV files', () => {
    const file = new File([''], 'recording.wav', { type: 'audio/wav' })
    expect(getFileName(file)).toBe('recording')
  })

  it('should return filename as-is if no extension', () => {
    const file = new File([''], 'filename', { type: 'audio/mpeg' })
    expect(getFileName(file)).toBe('filename')
  })

  it('should handle empty filename', () => {
    const file = new File([''], '', { type: 'audio/mpeg' })
    expect(getFileName(file)).toBe('')
  })
})

describe('getFileSize', () => {
  it('should format bytes as "B" for small files', () => {
    const file = new File(['content'], 'small.txt', { type: 'text/plain' })
    const size = getFileSize(file)
    expect(size).toMatch(/^[0-9.]+ B$/)
  })

  it('should format kilobytes as "KB" for medium files', () => {
    const content = 'x'.repeat(1024 * 3) // ~3KB
    const file = new File([content], 'medium.txt', { type: 'text/plain' })
    const size = getFileSize(file)
    expect(size).toMatch(/^[0-9.]+ KB$/)
  })

  it('should format megabytes as "MB" for large files', () => {
    const content = 'x'.repeat(1024 * 1024 * 3) // ~3MB
    const file = new File([content], 'large.txt', { type: 'text/plain' })
    const size = getFileSize(file)
    expect(size).toMatch(/^[0-9.]+ MB$/)
  })

  it('should format gigabytes as "GB" for very large files', () => {
    // Create a Blob with specific size and convert to File
    const blob = new Blob([new ArrayBuffer(1024 * 1024 * 1024 * 2)])
    const file = new File([blob], 'huge.bin')
    const size = getFileSize(file)
    expect(size).toMatch(/^[0-9.]+ GB$/)
  })

  it('should format with one decimal place for KB and above', () => {
    const content = 'x'.repeat(1024 * 1536) // 1.5MB
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const size = getFileSize(file)
    expect(size).toMatch(/^[0-9]+\.[0-9] MB$/)
  })

  it('should format 0 bytes as "0 B"', () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' })
    expect(getFileSize(file)).toBe('0 B')
  })
})
