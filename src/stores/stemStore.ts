import { create } from 'zustand'

/**
 * Stem 이름 타입
 */
export type StemName = 'vocals' | 'drums' | 'bass' | 'other'

/**
 * 분리 상태 타입
 */
export type SeparationStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'

/**
 * Stem 데이터 타입
 */
export interface StemData {
  vocals: AudioBuffer | null
  drums: AudioBuffer | null
  bass: AudioBuffer | null
  other: AudioBuffer | null
}

/**
 * Stem 게인 타입
 */
export interface StemGains {
  vocals: number
  drums: number
  bass: number
  other: number
}

/**
 * Stem 음소거 타입
 */
export interface StemMuted {
  vocals: boolean
  drums: boolean
  bass: boolean
  other: boolean
}

/**
 * Stem 솔로 타입
 */
export interface StemSolo {
  vocals: boolean
  drums: boolean
  bass: boolean
  other: boolean
}

/**
 * Stem 분리 및 믹서 상태 관리를 위한 인터페이스
 */
export interface StemState {
  // 분리 상태
  separationStatus: SeparationStatus
  separationProgress: number // 0-100
  taskId: string | null
  errorMessage: string | null

  // Stem 데이터
  stems: StemData

  // 믹서 상태
  gains: StemGains
  muted: StemMuted
  solo: StemSolo

  // 모드
  isStemMode: boolean

  // Actions - 분리
  setSeparationStatus: (status: SeparationStatus) => void
  setSeparationProgress: (progress: number) => void
  setTaskId: (taskId: string | null) => void
  setErrorMessage: (message: string | null) => void

  // Actions - Stem 데이터
  setStem: (stemName: StemName, buffer: AudioBuffer) => void
  setStems: (stems: StemData) => void
  clearStems: () => void

  // Actions - 믹서
  setGain: (stemName: StemName, gain: number) => void
  setGains: (gains: StemGains) => void
  toggleMute: (stemName: StemName) => void
  setMuted: (stemName: StemName, muted: boolean) => void
  toggleSolo: (stemName: StemName) => void
  setSolo: (stemName: StemName, solo: boolean) => void
  resetMixer: () => void

  // Actions - 모드
  setStemMode: (enabled: boolean) => void
  toggleStemMode: () => void

  // Actions - 리셋
  resetSeparation: () => void
  reset: () => void
}

/**
 * Stem 분리 및 믹서 상태를 관리하는 Zustand 스토어
 */
export const useStemStore = create<StemState>((set) => ({
  // Initial state - 분리
  separationStatus: 'idle',
  separationProgress: 0,
  taskId: null,
  errorMessage: null,

  // Initial state - Stem 데이터
  stems: {
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  },

  // Initial state - 믹서
  gains: {
    vocals: 1.0,
    drums: 1.0,
    bass: 1.0,
    other: 1.0,
  },
  muted: {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  },
  solo: {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  },

  // Initial state - 모드
  isStemMode: false,

  // Actions - 분리
  setSeparationStatus: (separationStatus: SeparationStatus) =>
    set({
      separationStatus,
    }),

  setSeparationProgress: (separationProgress: number) =>
    set({
      separationProgress: Math.max(0, Math.min(100, separationProgress)),
    }),

  setTaskId: (taskId: string | null) =>
    set({
      taskId,
    }),

  setErrorMessage: (errorMessage: string | null) =>
    set({
      errorMessage,
    }),

  // Actions - Stem 데이터
  setStem: (stemName: StemName, buffer: AudioBuffer) =>
    set((state) => ({
      stems: {
        ...state.stems,
        [stemName]: buffer,
      },
    })),

  setStems: (stems: StemData) =>
    set({
      stems,
    }),

  clearStems: () =>
    set({
      stems: {
        vocals: null,
        drums: null,
        bass: null,
        other: null,
      },
    }),

  // Actions - 믹서
  setGain: (stemName: StemName, gain: number) =>
    set((state) => ({
      gains: {
        ...state.gains,
        [stemName]: Math.max(0, Math.min(1, gain)),
      },
    })),

  setGains: (gains: StemGains) =>
    set({
      gains,
    }),

  toggleMute: (stemName: StemName) =>
    set((state) => ({
      muted: {
        ...state.muted,
        [stemName]: !state.muted[stemName],
      },
    })),

  setMuted: (stemName: StemName, muted: boolean) =>
    set((state) => ({
      muted: {
        ...state.muted,
        [stemName]: muted,
      },
    })),

  toggleSolo: (stemName: StemName) =>
    set((state) => ({
      solo: {
        ...state.solo,
        [stemName]: !state.solo[stemName],
      },
    })),

  setSolo: (stemName: StemName, solo: boolean) =>
    set((state) => ({
      solo: {
        ...state.solo,
        [stemName]: solo,
      },
    })),

  resetMixer: () =>
    set({
      gains: {
        vocals: 1.0,
        drums: 1.0,
        bass: 1.0,
        other: 1.0,
      },
      muted: {
        vocals: false,
        drums: false,
        bass: false,
        other: false,
      },
      solo: {
        vocals: false,
        drums: false,
        bass: false,
        other: false,
      },
    }),

  // Actions - 모드
  setStemMode: (isStemMode: boolean) =>
    set({
      isStemMode,
    }),

  toggleStemMode: () =>
    set((state) => ({
      isStemMode: !state.isStemMode,
    })),

  // Actions - 리셋
  resetSeparation: () =>
    set({
      separationStatus: 'idle',
      separationProgress: 0,
      taskId: null,
      errorMessage: null,
    }),

  reset: () =>
    set({
      separationStatus: 'idle',
      separationProgress: 0,
      taskId: null,
      errorMessage: null,
      stems: {
        vocals: null,
        drums: null,
        bass: null,
        other: null,
      },
      gains: {
        vocals: 1.0,
        drums: 1.0,
        bass: 1.0,
        other: 1.0,
      },
      muted: {
        vocals: false,
        drums: false,
        bass: false,
        other: false,
      },
      solo: {
        vocals: false,
        drums: false,
        bass: false,
        other: false,
      },
      isStemMode: false,
    }),
}))

// Export as stemStore for backward compatibility
export const stemStore = useStemStore

// Expose store to window for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__STEM_STORE__ = useStemStore
}

/**
 * 유효한 게인 계산 (Solo/Mute 로직 적용)
 *
 * @param stemName - Stem 이름
 * @param state - Stem 상태
 * @returns 유효한 게인 값 (0-1)
 */
export function getEffectiveGain(
  stemName: StemName,
  state: Pick<StemState, 'gains' | 'muted' | 'solo'>
): number {
  const { gains, muted, solo } = state

  // 어떤 stem이라도 solo가 활성화되어 있는지 확인
  const hasAnySolo = Object.values(solo).some((s) => s)

  if (hasAnySolo) {
    // Solo 모드: solo가 활성화된 stem만 재생
    return solo[stemName] ? gains[stemName] : 0
  } else {
    // 일반 모드: mute만 적용
    return muted[stemName] ? 0 : gains[stemName]
  }
}

/**
 * 모든 stem이 로드되었는지 확인
 *
 * @param stems - Stem 데이터
 * @returns 모든 stem이 로드되었으면 true
 */
export function areAllStemsLoaded(stems: StemData): boolean {
  return (
    stems.vocals !== null &&
    stems.drums !== null &&
    stems.bass !== null &&
    stems.other !== null
  )
}

/**
 * Stem 색상 (UI용)
 */
export const STEM_COLORS: Record<StemName, string> = {
  vocals: '#8B5CF6', // Violet
  drums: '#EF4444', // Red
  bass: '#3B82F6', // Blue
  other: '#10B981', // Emerald
}

/**
 * Stem 표시 이름 (UI용)
 */
export const STEM_DISPLAY_NAMES: Record<StemName, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
}
