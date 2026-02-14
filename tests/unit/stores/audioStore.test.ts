import { describe, it, expect, beforeEach } from 'vitest'
import { audioStore } from '@/stores/audioStore'

describe('audioStore', () => {
  beforeEach(() => {
    const { reset } = audioStore.getState()
    reset()
  })

  describe('initial state', () => {
    it('should have null file initially', () => {
      const { file } = audioStore.getState()
      expect(file).toBeNull()
    })

    it('should have null buffer initially', () => {
      const { buffer } = audioStore.getState()
      expect(buffer).toBeNull()
    })

    it('should have empty fileName initially', () => {
      const { fileName } = audioStore.getState()
      expect(fileName).toBe('')
    })

    it('should have zero duration initially', () => {
      const { duration } = audioStore.getState()
      expect(duration).toBe(0)
    })

    it('should not be loading initially', () => {
      const { isLoading } = audioStore.getState()
      expect(isLoading).toBe(false)
    })

    it('should have null error initially', () => {
      const { error } = audioStore.getState()
      expect(error).toBeNull()
    })
  })

  describe('setFile', () => {
    it('should set file and update fileName', () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const { setFile } = audioStore.getState()
      setFile(file)

      const state = audioStore.getState()
      expect(state.file).toBe(file)
      expect(state.fileName).toBe('test.mp3')
    })

    it('should clear error when setting new file', () => {
      const { setError, setFile } = audioStore.getState()
      setError('Previous error')
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      setFile(file)

      const { error } = audioStore.getState()
      expect(error).toBeNull()
    })
  })

  describe('setBuffer', () => {
    it('should set buffer and duration', () => {
      const mockBuffer = {
        duration: 120,
        sampleRate: 44100,
        numberOfChannels: 2,
      } as any

      const { setBuffer } = audioStore.getState()
      setBuffer(mockBuffer)

      const state = audioStore.getState()
      expect(state.buffer).toBe(mockBuffer)
      expect(state.duration).toBe(120)
    })

    it('should clear loading state when buffer is set', () => {
      const { setLoading, setBuffer } = audioStore.getState()
      setLoading(true)
      const mockBuffer = { duration: 60 } as any
      setBuffer(mockBuffer)

      const { isLoading } = audioStore.getState()
      expect(isLoading).toBe(false)
    })

    it('should clear error when buffer is set', () => {
      const { setError, setBuffer } = audioStore.getState()
      setError('Load error')
      const mockBuffer = { duration: 60 } as any
      setBuffer(mockBuffer)

      const { error } = audioStore.getState()
      expect(error).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { setLoading } = audioStore.getState()
      setLoading(true)
      expect(audioStore.getState().isLoading).toBe(true)

      setLoading(false)
      expect(audioStore.getState().isLoading).toBe(false)
    })

    it('should clear error when loading starts', () => {
      const { setError, setLoading } = audioStore.getState()
      setError('Previous error')
      setLoading(true)

      const { error } = audioStore.getState()
      expect(error).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const { setError } = audioStore.getState()
      setError('File not supported')
      expect(audioStore.getState().error).toBe('File not supported')
    })

    it('should clear loading state when error is set', () => {
      const { setLoading, setError } = audioStore.getState()
      setLoading(true)
      setError('Load failed')

      expect(audioStore.getState().isLoading).toBe(false)
    })

    it('should allow clearing error with null', () => {
      const { setError } = audioStore.getState()
      setError('Error')
      setError(null)

      expect(audioStore.getState().error).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const file = new File([''], 'test.mp3', { type: 'audio/mpeg' })
      const mockBuffer = { duration: 120 } as any

      const { setFile, setBuffer, setLoading, setError, reset } = audioStore.getState()
      setFile(file)
      setBuffer(mockBuffer)
      setLoading(true)
      setError('Error')

      reset()

      const state = audioStore.getState()
      expect(state.file).toBeNull()
      expect(state.buffer).toBeNull()
      expect(state.fileName).toBe('')
      expect(state.duration).toBe(0)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })
})
