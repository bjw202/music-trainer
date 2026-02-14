/**
 * YouTube 변환 API 응답 타입
 */
export interface ConvertResponse {
  task_id: string
  status: string
  message: string
}

/**
 * SSE 진행률 이벤트 타입
 */
export interface ProgressEvent {
  status: 'downloading' | 'converting' | 'complete' | 'error'
  percent: number
  stage: string
  estimated_remaining?: number
  download_url?: string
  error_type?: string
  message?: string
}

/**
 * 서버 상태 확인 응답 타입
 */
export interface HealthResponse {
  status: string
  ffmpeg_available: boolean
  disk_space_mb: number
  active_conversions: number
}

/**
 * API 에러 응답 타입
 */
export interface ApiError {
  detail: string
  error_type?: string
}
