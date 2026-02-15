import { useCallback, useRef } from 'react'
import { useYoutubeStore } from '../stores/youtubeStore'
import {
  isValidYouTubeUrl,
  convertYouTubeUrl,
  connectProgress,
  getDownloadUrl,
} from '../api/youtube'
import { ApiRequestError } from '../api/client'

/**
 * YouTube 변환 플로우를 오케스트레이션하는 훅
 *
 * youtubeStore와 YouTube API를 연결하여
 * URL 입력 -> 변환 -> SSE 진행률 -> 오디오 로딩 플로우를 관리합니다.
 *
 * @param onFileReady - 변환된 오디오 파일을 AudioEngine에 로드하는 콜백
 */
export function useYouTubeConvert(onFileReady?: (file: File) => Promise<void>) {
  const cleanupRef = useRef<(() => void) | null>(null)

  const url = useYoutubeStore((state) => state.url)
  const status = useYoutubeStore((state) => state.status)
  const progress = useYoutubeStore((state) => state.progress)
  const stage = useYoutubeStore((state) => state.stage)
  const error = useYoutubeStore((state) => state.error)

  /**
   * YouTube URL 변환 시작
   */
  const convertUrl = useCallback(async (inputUrl: string) => {
    // 클라이언트 측 URL 유효성 검사
    if (!isValidYouTubeUrl(inputUrl)) {
      useYoutubeStore.getState().setError('유효한 YouTube URL을 입력해 주세요')
      return
    }

    try {
      // 변환 API 호출
      const response = await convertYouTubeUrl(inputUrl)
      useYoutubeStore.getState().startConversion(response.task_id)

      // SSE 진행률 구독
      const cleanup = connectProgress(
        response.task_id,
        // 진행률 업데이트
        (event) => {
          const stageText =
            event.status === 'downloading' ? '다운로드 중' : '변환 중'
          useYoutubeStore.getState().updateProgress(event.percent, stageText)
        },
        // 변환 완료
        async () => {
          useYoutubeStore.getState().setComplete()
          cleanupRef.current = null

          // 변환된 오디오 파일 다운로드
          try {
            const taskId = useYoutubeStore.getState().taskId
            if (!taskId) return

            // 항상 getDownloadUrl 사용 (SSE의 download_url은 상대 경로)
            const downloadUrl = getDownloadUrl(taskId)

            const audioResponse = await fetch(downloadUrl)
            if (!audioResponse.ok) {
              throw new Error('오디오 파일 다운로드에 실패했습니다')
            }

            const arrayBuffer = await audioResponse.arrayBuffer()
            const fileName = useYoutubeStore.getState().videoTitle ?? 'YouTube Audio'
            const file = new File([arrayBuffer], `${fileName}.mp3`, {
              type: 'audio/mpeg',
            })

            // AudioEngine의 loadFile을 통해 로드 (재생 가능 상태로 설정)
            if (onFileReady) {
              await onFileReady(file)
            }

            // YouTube 스토어 초기화
            useYoutubeStore.getState().reset()
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : '오디오 파일을 로드할 수 없습니다'
            useYoutubeStore.getState().setError(message)
          }
        },
        // 에러
        (errorMessage) => {
          useYoutubeStore.getState().setError(errorMessage)
          cleanupRef.current = null
        }
      )

      cleanupRef.current = cleanup
    } catch (err) {
      let message = '변환 요청에 실패했습니다'

      if (err instanceof ApiRequestError) {
        message = err.message
      } else if (err instanceof Error) {
        message = err.message
      }

      useYoutubeStore.getState().setError(message)
    }
  }, [onFileReady])

  /**
   * 변환 취소
   */
  const cancelConversion = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    useYoutubeStore.getState().reset()
  }, [])

  return {
    url,
    status,
    progress,
    stage,
    error,
    convertUrl,
    cancelConversion,
  }
}
