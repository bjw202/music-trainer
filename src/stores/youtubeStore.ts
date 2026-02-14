import { create } from 'zustand'

/**
 * YouTube 변환 상태 타입
 */
export type YouTubeStatus = 'idle' | 'loading' | 'converting' | 'complete' | 'error'

/**
 * YouTube 변환 상태 인터페이스
 */
export interface YouTubeState {
  // 상태
  url: string
  status: YouTubeStatus
  progress: number
  stage: string
  taskId: string | null
  error: string | null
  videoTitle: string | null

  // Actions
  setUrl: (url: string) => void
  startConversion: (taskId: string) => void
  updateProgress: (percent: number, stage: string) => void
  setComplete: (title?: string) => void
  setError: (error: string) => void
  reset: () => void
}

/**
 * YouTube 변환 상태를 관리하는 Zustand 스토어
 */
export const useYoutubeStore = create<YouTubeState>((set) => ({
  // Initial state
  url: '',
  status: 'idle',
  progress: 0,
  stage: '',
  taskId: null,
  error: null,
  videoTitle: null,

  // Actions
  setUrl: (url) => set({ url }),

  startConversion: (taskId) =>
    set({
      status: 'loading',
      taskId,
      error: null,
      progress: 0,
      stage: '준비 중...',
    }),

  updateProgress: (percent, stage) =>
    set({
      status: 'converting',
      progress: percent,
      stage,
    }),

  setComplete: (title) =>
    set({
      status: 'complete',
      progress: 100,
      stage: '완료',
      videoTitle: title ?? null,
    }),

  setError: (error) =>
    set({
      status: 'error',
      error,
      progress: 0,
    }),

  reset: () =>
    set({
      url: '',
      status: 'idle',
      progress: 0,
      stage: '',
      taskId: null,
      error: null,
      videoTitle: null,
    }),
}))
