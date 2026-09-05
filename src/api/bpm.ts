/**
 * BPM 분석 API 클라이언트
 *
 * 백엔드 BPM 분석 API와 통신하는 모듈입니다.
 */

import { apiClient } from './client'

/**
 * BPM 분석 응답 타입
 */
export interface BpmAnalysisResponse {
  bpm: number
  beats: number[]
  confidence: number
  file_hash: string
  /** 사용된 감지 엔진 ("madmom" | "librosa"). 구버전 백엔드 배포 시차를 견디도록 선택 필드 */
  engine?: string
}

/**
 * 엔드포인트 경로
 *
 * 베이스 URL은 client.ts가 단독으로 소유합니다.
 * 여기서 별도 환경변수를 읽지 마세요 (분기 재발 방지).
 */
const ENDPOINTS = {
  ANALYZE: apiClient.getFullUrl('/bpm/analyze'),
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
