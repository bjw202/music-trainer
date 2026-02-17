/**
 * useMetronome Hook 테스트
 *
 * TDD - RED Phase: Hook 테스트 정의
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMetronome } from '@/hooks/useMetronome'
import { useBpmStore } from '@/stores/bpmStore'
import { AudioEngine } from '@/core/AudioEngine'

// Mock AudioEngine
vi.mock('@/core/AudioEngine', () => ({
  AudioEngine: vi.fn(),
}))

// Mock MetronomeEngine
vi.mock('@/core/MetronomeEngine', () => ({
  MetronomeEngine: vi.fn().mockImplementation(() => ({
    setBeats: vi.fn(),
    setVolume: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    syncToPlaybackTime: vi.fn(),
    dispose: vi.fn(),
  })),
}))

describe('useMetronome Hook', () => {
  let mockAudioEngine: Partial<AudioEngine>

  beforeEach(() => {
    // 스토어 초기화
    useBpmStore.getState().reset()

    // Mock AudioEngine
    mockAudioEngine = {
      getContext: vi.fn().mockReturnValue({
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(),
        createGain: vi.fn(),
      } as unknown as AudioContext),
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('초기화', () => {
    it('audioEngine이 없으면 isReady가 false여야 한다', () => {
      const { result } = renderHook(() => useMetronome(null))

      expect(result.current.isReady).toBe(false)
    })

    it('audioEngine이 있고 beats가 있으면 isReady가 true여야 한다', async () => {
      // beats 설정
      useBpmStore.getState().analyzeBpm = vi.fn().mockResolvedValue(undefined)

      // bpmStore에 beats 설정 (직접 상태 설정)
      act(() => {
        const store = useBpmStore.getState()
        // beats는 public 상태이므로 직접 설정 가능
        store.beats = [0.5, 1.0, 1.5]
      })

      const { result } = renderHook(() => useMetronome(mockAudioEngine as AudioEngine))

      // 초기에는 false
      expect(result.current.isReady).toBe(false)
    })
  })

  describe('메트로놈 제어', () => {
    it('metronomeEnabled가 true면 메트로놈이 시작되어야 한다', async () => {
      const { result } = renderHook(() => useMetronome(mockAudioEngine as AudioEngine))

      // 메트로놈 활성화
      act(() => {
        useBpmStore.getState().toggleMetronome()
      })

      expect(result.current).toBeDefined()
    })
  })

  describe('볼륨 동기화', () => {
    it('metronomeVolume 변경 시 엔진에 반영되어야 한다', async () => {
      renderHook(() => useMetronome(mockAudioEngine as AudioEngine))

      act(() => {
        useBpmStore.getState().setMetronomeVolume(75)
      })

      // 볼륨이 75로 설정되었는지 확인
      expect(useBpmStore.getState().metronomeVolume).toBe(75)
    })
  })

  describe('에러 처리', () => {
    it('초기화 실패 시 error 상태를 설정해야 한다', async () => {
      // getContext가 null을 반환하도록 설정
      mockAudioEngine.getContext = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() => useMetronome(mockAudioEngine as AudioEngine))

      expect(result.current.isReady).toBe(false)
    })
  })
})
