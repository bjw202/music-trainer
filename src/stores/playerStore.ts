import { create } from 'zustand'

/**
 * 재생 상태 관리를 위한 인터페이스
 */
export interface PlayerState {
  // 재생 중 여부
  isPlaying: boolean
  // 일시정지 여부
  isPaused: boolean
  // 정지 여부
  isStopped: boolean
  // 현재 재생 위치 (초)
  currentTime: number
  // 전체 길이 (초)
  duration: number

  // Actions
  play: () => void
  pause: () => void
  stop: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  reset: () => void
}

/**
 * 재생 상태를 관리하는 Zustand 스토어
 */
export const usePlayerStore = create<PlayerState>((set) => ({
  // Initial state
  isPlaying: false,
  isPaused: false,
  isStopped: true,
  currentTime: 0,
  duration: 0,

  // Actions
  play: () =>
    set({
      isPlaying: true,
      isPaused: false,
      isStopped: false,
    }),

  pause: () =>
    set({
      isPlaying: false,
      isPaused: true,
      isStopped: false,
    }),

  stop: () =>
    set({
      isPlaying: false,
      isPaused: false,
      isStopped: true,
      currentTime: 0, // 정지 시 현재 위치 초기화
    }),

  setCurrentTime: (currentTime: number) =>
    set({
      currentTime,
    }),

  setDuration: (duration: number) =>
    set({
      duration,
    }),

  reset: () =>
    set({
      isPlaying: false,
      isPaused: false,
      isStopped: true,
      currentTime: 0,
      duration: 0,
    }),
}))

// Export as playerStore for backward compatibility
export const playerStore = usePlayerStore
