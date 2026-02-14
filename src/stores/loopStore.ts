import { create } from 'zustand'

/**
 * A-B 루프 상태 관리를 위한 인터페이스
 */
export interface LoopState {
  // A 지점 (초)
  loopA: number | null
  // B 지점 (초)
  loopB: number | null
  // 루프 활성화 여부
  loopEnabled: boolean

  // Actions
  setLoopA: (time: number | null) => void
  setLoopB: (time: number | null) => void
  toggleLoop: () => void
  reset: () => void
}

/**
 * A-B 루프 상태를 관리하는 Zustand 스토어
 */
export const useLoopStore = create<LoopState>((set, get) => ({
  // Initial state
  loopA: null,
  loopB: null,
  loopEnabled: false,

  // Actions
  setLoopA: (time: number | null) =>
    set({
      loopA: time,
    }),

  setLoopB: (time: number | null) =>
    set({
      loopB: time,
    }),

  toggleLoop: () => {
    const { loopA, loopB, loopEnabled } = get()

    // 두 지점이 모두 설정되어 있어야 루프 활성화 가능
    if (loopA !== null && loopB !== null) {
      set({
        loopEnabled: !loopEnabled,
      })
    } else {
      // 지점이 설정되어 있지 않으면 루프 비활성화
      set({
        loopEnabled: false,
      })
    }
  },

  reset: () =>
    set({
      loopA: null,
      loopB: null,
      loopEnabled: false,
    }),
}))

// Export as loopStore for backward compatibility
export const loopStore = useLoopStore
