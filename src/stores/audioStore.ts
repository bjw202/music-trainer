import { create } from 'zustand'

/**
 * 오디오 파일 및 버퍼 상태 관리를 위한 인터페이스
 */
export interface AudioState {
  // 현재 로드된 파일
  file: File | null
  // 디코딩된 오디오 버퍼
  buffer: AudioBuffer | null
  // 파일명
  fileName: string
  // 오디오 전체 길이 (초)
  duration: number
  // 로딩 중 여부
  isLoading: boolean
  // 에러 메시지
  error: string | null

  // Actions
  setFile: (file: File) => void
  setBuffer: (buffer: AudioBuffer) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

/**
 * 오디오 파일 및 버퍼 상태를 관리하는 Zustand 스토어
 */
export const useAudioStore = create<AudioState>((set) => ({
  // Initial state
  file: null,
  buffer: null,
  fileName: '',
  duration: 0,
  isLoading: false,
  error: null,

  // Actions
  setFile: (file: File) =>
    set({
      file,
      fileName: file.name,
      error: null, // 새 파일 설정 시 에러 초기화
    }),

  setBuffer: (buffer: AudioBuffer) =>
    set({
      buffer,
      duration: buffer.duration,
      isLoading: false, // 버퍼 설정 시 로딩 완료
      error: null, // 버퍼 설정 시 에러 초기화
    }),

  setLoading: (isLoading: boolean) =>
    set({
      isLoading,
      error: isLoading ? null : undefined, // 로딩 시작 시 에러 초기화
    }),

  setError: (error: string | null) =>
    set({
      error,
      isLoading: false, // 에러 발생 시 로딩 중지
    }),

  reset: () =>
    set({
      file: null,
      buffer: null,
      fileName: '',
      duration: 0,
      isLoading: false,
      error: null,
    }),
}))

// Export as audioStore for backward compatibility
export const audioStore = useAudioStore
