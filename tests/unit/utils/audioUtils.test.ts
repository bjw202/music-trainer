import { describe, it, expect } from 'vitest'
import { validateAudioFormat, fileToArrayBuffer } from '@/utils/audioUtils'
import { SUPPORTED_AUDIO_FORMATS } from '@/utils/constants'

describe('validateAudioFormat', () => {
  it('should return true for MP3 files', () => {
    const file = new File([''], 'song.mp3', { type: 'audio/mpeg' })
    expect(validateAudioFormat(file)).toBe(true)
  })

  it('should return true for WAV files', () => {
    const file = new File([''], 'recording.wav', { type: 'audio/wav' })
    expect(validateAudioFormat(file)).toBe(true)
  })

  it('should return true for M4A files', () => {
    const file = new File([''], 'song.m4a', { type: 'audio/mp4' })
    expect(validateAudioFormat(file)).toBe(true)
  })

  it('should return true for OGG files', () => {
    const file = new File([''], 'song.ogg', { type: 'audio/ogg' })
    expect(validateAudioFormat(file)).toBe(true)
  })

  it('should return false for unsupported formats', () => {
    const file = new File([''], 'video.mp4', { type: 'video/mp4' })
    expect(validateAudioFormat(file)).toBe(false)
  })

  it('should return false for files without MIME type', () => {
    const file = new File([''], 'unknown.bin')
    expect(validateAudioFormat(file)).toBe(false)
  })

  it('should return false for text files', () => {
    const file = new File([''], 'text.txt', { type: 'text/plain' })
    expect(validateAudioFormat(file)).toBe(false)
  })

  it('should return false for image files', () => {
    const file = new File([''], 'image.jpg', { type: 'image/jpeg' })
    expect(validateAudioFormat(file)).toBe(false)
  })

  it('should handle case-insensitive MIME types', () => {
    // Note: File constructor normalizes MIME types to lowercase in most browsers
    const file = new File([''], 'song.mp3', { type: 'AUDIO/MPEG' })
    // After normalization, it should match
    expect(validateAudioFormat(file)).toBe(true)
  })

  it('should reject files with empty MIME type', () => {
    const file = new File([''], 'song.mp3', { type: '' })
    expect(validateAudioFormat(file)).toBe(false)
  })
})

describe('fileToArrayBuffer', () => {
  it('should convert File to ArrayBuffer', async () => {
    const content = 'Hello, World!'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const buffer = await fileToArrayBuffer(file)
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('should preserve file content in ArrayBuffer', async () => {
    const content = 'Test content'
    const file = new File([content], 'test.txt', { type: 'text/plain' })
    const buffer = await fileToArrayBuffer(file)
    const decoder = new TextDecoder()
    const decoded = decoder.decode(buffer)
    expect(decoded).toBe(content)
  })

  it('should handle empty file', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' })
    const buffer = await fileToArrayBuffer(file)
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBe(0)
  })

  it('should handle large files', async () => {
    const content = 'x'.repeat(1024 * 100) // 100KB
    const file = new File([content], 'large.txt', { type: 'text/plain' })
    const buffer = await fileToArrayBuffer(file)
    expect(buffer.byteLength).toBe(102400)
  })

  it('should handle binary data', async () => {
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff])
    const file = new File([binaryData], 'binary.bin', { type: 'application/octet-stream' })
    const buffer = await fileToArrayBuffer(file)
    const view = new Uint8Array(buffer)
    expect(view[0]).toBe(0x00)
    expect(view[4]).toBe(0xff)
  })
})
