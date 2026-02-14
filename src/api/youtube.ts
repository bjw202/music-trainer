import { apiClient } from './client'
import type { ConvertResponse, ProgressEvent } from './types'

/**
 * YouTube URL 유효성 검사 정규식
 */
const YOUTUBE_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:\S*)?$/

/**
 * YouTube URL 유효성 검사
 */
export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url.trim())
}

/**
 * YouTube URL을 MP3로 변환 요청
 *
 * @param url - YouTube 동영상 URL
 * @returns 변환 작업 정보 (task_id, status)
 */
export async function convertYouTubeUrl(url: string): Promise<ConvertResponse> {
  return apiClient.post<ConvertResponse>('/youtube/convert', { url })
}

/**
 * SSE를 통한 변환 진행률 구독
 *
 * @param taskId - 변환 작업 ID
 * @param onProgress - 진행률 업데이트 콜백
 * @param onComplete - 변환 완료 콜백
 * @param onError - 에러 발생 콜백
 * @returns 구독 해제 함수 (EventSource 종료)
 */
export function connectProgress(
  taskId: string,
  onProgress: (event: ProgressEvent) => void,
  onComplete: (event: ProgressEvent) => void,
  onError: (error: string) => void
): () => void {
  const url = apiClient.getFullUrl(`/youtube/progress/${taskId}`)
  let retryCount = 0
  const MAX_RETRIES = 3
  let eventSource: EventSource | null = null

  function connect() {
    eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data)
        retryCount = 0 // 성공적인 메시지 수신 시 재시도 카운트 초기화

        if (data.status === 'complete') {
          onComplete(data)
          cleanup()
        } else if (data.status === 'error') {
          onError(data.message ?? '변환 중 오류가 발생했습니다')
          cleanup()
        } else {
          onProgress(data)
        }
      } catch {
        onError('서버 응답을 처리할 수 없습니다')
        cleanup()
      }
    }

    eventSource.onerror = () => {
      cleanup()

      if (retryCount < MAX_RETRIES) {
        retryCount++
        // 지수 백오프로 재연결 (1초, 2초, 4초)
        const delay = Math.pow(2, retryCount - 1) * 1000
        setTimeout(connect, delay)
      } else {
        onError('서버 연결이 끊어졌습니다. 다시 시도해 주세요.')
      }
    }
  }

  function cleanup() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  connect()

  // 구독 해제 함수 반환
  return cleanup
}

/**
 * 변환 완료된 파일의 다운로드 URL 반환
 *
 * @param taskId - 변환 작업 ID
 * @returns 다운로드 URL
 */
export function getDownloadUrl(taskId: string): string {
  return apiClient.getFullUrl(`/youtube/download/${taskId}`)
}
