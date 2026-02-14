import { create } from 'zustand'
import { SPEED_PITCH } from '../utils/constants'

/**
 * 볼륨 및 속도/피치 제어 상태 관리를 위한 인터페이스
 */
export interface ControlState {
  // 마스터 볼륨 (0-100)
  volume: number
  // 음소거 여부
  muted: boolean
  // 이전 볼륨 값 (음소거 해제 시 복원용)
  previousVolume: number
  // 재생 속도 (0.5 ~ 2.0)
  speed: number
  // 피치 변경 (반음 단위, -12 ~ +12)
  pitch: number

  // Actions
  setVolume: (volume: number) => void
  toggleMute: () => void
  setSpeed: (speed: number) => void
  setPitch: (pitch: number) => void
  resetSpeedPitch: () => void
  reset: () => void
}

/**
 * 볼륨 제어 상태를 관리하는 Zustand 스토어
 */
export const useControlStore = create<ControlState>((set, get) => ({
  // Initial state
  volume: 100,
  muted: false,
  previousVolume: 100,
  speed: SPEED_PITCH.DEFAULT_SPEED,
  pitch: SPEED_PITCH.DEFAULT_PITCH,

  // Actions
  setVolume: (volume: number) =>
    set({
      volume: Math.max(0, Math.min(100, volume)), // 0-100 범위 클램핑
      muted: false, // 볼륨 설정 시 음소거 해제
    }),

  toggleMute: () => {
    const { muted, volume, previousVolume } = get()

    if (muted) {
      // 음소거 해제
      set({
        muted: false,
        volume: previousVolume > 0 ? previousVolume : 100, // 이전 볼륨 복원 (0이면 100)
      })
    } else {
      // 음소거
      set({
        muted: true,
        volume: 0,
        previousVolume: volume, // 현재 볼륨 저장
      })
    }
  },

  setSpeed: (speed: number) =>
    set({
      speed: Math.max(SPEED_PITCH.MIN_SPEED, Math.min(SPEED_PITCH.MAX_SPEED, speed)),
    }),

  setPitch: (pitch: number) =>
    set({
      pitch: Math.max(SPEED_PITCH.MIN_PITCH, Math.min(SPEED_PITCH.MAX_PITCH, pitch)),
    }),

  resetSpeedPitch: () =>
    set({
      speed: SPEED_PITCH.DEFAULT_SPEED,
      pitch: SPEED_PITCH.DEFAULT_PITCH,
    }),

  reset: () =>
    set({
      volume: 100,
      muted: false,
      previousVolume: 100,
      speed: SPEED_PITCH.DEFAULT_SPEED,
      pitch: SPEED_PITCH.DEFAULT_PITCH,
    }),
}))

// Export as controlStore for backward compatibility
export const controlStore = useControlStore
