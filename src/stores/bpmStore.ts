import { create } from 'zustand'

/**
 * BPM 분석 및 메트로놈 상태 관리를 위한 인터페이스
 */
export interface BpmState {
  // 분석 결과
  bpm: number | null
  beats: number[]
  confidence: number | null
  fileHash: string | null

  // 분석 상태
  isAnalyzing: boolean
  analysisError: string | null

  // 메트로놈 제어
  metronomeEnabled: boolean
  metronomeVolume: number // 0-100

  // 액션
  analyzeBpm: (file: File) => Promise<void>
  toggleMetronome: () => void
  setMetronomeVolume: (volume: number) => void
  reset: () => void
}

/**
 * BPM 분석 API 응답 타입
 */
interface BpmAnalysisResponse {
  bpm: number
  beats: number[]
  confidence: number
  file_hash: string
}

/**
 * 기본 API 베이스 URL
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

/**
 * BPM 분석 및 메트로놈 상태를 관리하는 Zustand 스토어
 */
export const useBpmStore = create<BpmState>((set, _get) => ({
  // Initial state
  bpm: null,
  beats: [],
  confidence: null,
  fileHash: null,
  isAnalyzing: false,
  analysisError: null,
  metronomeEnabled: false,
  metronomeVolume: 50, // 기본값 50%

  // Actions
  analyzeBpm: async (file: File) => {
    // 분석 시작
    set({
      isAnalyzing: true,
      analysisError: null,
    })

    try {
      // FormData 생성
      const formData = new FormData()
      formData.append('file', file)

      // API 호출
      const response = await fetch(`${API_BASE_URL}/bpm/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data: BpmAnalysisResponse = await response.json()

      // 성공 시 결과 저장
      set({
        bpm: data.bpm,
        beats: data.beats,
        confidence: data.confidence,
        fileHash: data.file_hash,
        isAnalyzing: false,
        analysisError: null,
      })
    } catch (error) {
      // 실패 시 에러 저장
      const errorMessage = error instanceof Error ? error.message : 'BPM 분석 실패'
      set({
        isAnalyzing: false,
        analysisError: errorMessage,
      })
      throw error
    }
  },

  toggleMetronome: () => {
    set((state) => ({
      metronomeEnabled: !state.metronomeEnabled,
    }))
  },

  setMetronomeVolume: (volume: number) => {
    // 0-100 범위로 클램핑
    const clampedVolume = Math.max(0, Math.min(100, volume))
    set({
      metronomeVolume: clampedVolume,
    })
  },

  reset: () => {
    set({
      bpm: null,
      beats: [],
      confidence: null,
      fileHash: null,
      isAnalyzing: false,
      analysisError: null,
      metronomeEnabled: false,
      metronomeVolume: 50,
    })
  },
}))

// Export as bpmStore for consistency with other stores
export const bpmStore = useBpmStore
