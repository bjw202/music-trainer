/**
 * BPM 분석 API 클라이언트
 *
 * 백엔드 BPM 분석 API와 통신하는 모듈입니다.
 */

/**
 * BPM 분석 응답 타입
 */
export interface BpmAnalysisResponse {
  bpm: number
  beats: number[]
  confidence: number
  file_hash: string
}

/**
 * API 기본 URL
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * 엔드포인트 경로
 */
const ENDPOINTS = {
  ANALYZE: `${API_BASE_URL}/api/v1/bpm/analyze`,
} as const

/**
 * 오디오 파일의 BPM을 분석합니다.
 *
 * @param file - 분석할 오디오 파일
 * @returns BPM 분석 결과
 * @throws Error - 분석 실패 시
 */
export async function analyzeBpm(file: File): Promise<BpmAnalysisResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(ENDPOINTS.ANALYZE, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(errorData.detail || 'BPM 분석 실패')
  }

  return response.json()
}
