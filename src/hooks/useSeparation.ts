import { useCallback, useEffect, useRef } from 'react'
import { useStemStore } from '../stores/stemStore'
import { useAudioStore } from '../stores/audioStore'
import {
  uploadForSeparation,
  subscribeSeparationProgress,
  downloadAndDecodeAllStems,
} from '../api/separation'

/**
 * Stem 분리 훅 반환 값
 */
export interface UseSeparationReturn {
  // 상태
  status: import('../stores/stemStore').SeparationStatus
  progress: number
  taskId: string | null
  errorMessage: string | null

  // 작업
  startSeparation: (file: File) => Promise<void>
  cancelSeparation: () => void
  retrySeparation: () => Promise<void>

  // 유틸리티
  isSeparating: boolean
  canSeparate: boolean

  // 디코딩에 사용된 AudioContext 반환 (StemMixer와 동일한 컨텍스트 공유용)
  getAudioContext: () => AudioContext
}

/**
 * Stem 분리 작업을 관리하는 훅
 *
 * 기능:
 * - 파일 업로드
 * - SSE 진행률 구독
 * - Stem 다운로드 및 AudioBuffer 디코딩
 * - 오류 처리 및 재시도
 * - stemStore 상태 업데이트
 */
export function useSeparation(): UseSeparationReturn {
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastFileRef = useRef<File | null>(null)

  // Store 상태
  const separationStatus = useStemStore((state) => state.separationStatus)
  const separationProgress = useStemStore((state) => state.separationProgress)
  const taskId = useStemStore((state) => state.taskId)
  const errorMessage = useStemStore((state) => state.errorMessage)
  const setStems = useStemStore((state) => state.setStems)
  const setSeparationStatus = useStemStore((state) => state.setSeparationStatus)
  const setSeparationProgress = useStemStore((state) => state.setSeparationProgress)
  const setTaskId = useStemStore((state) => state.setTaskId)
  const setErrorMessage = useStemStore((state) => state.setErrorMessage)
  const resetSeparation = useStemStore((state) => state.resetSeparation)

  const buffer = useAudioStore((state) => state.buffer)

  /**
   * AudioContext 생성 (디코딩용)
   */
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  /**
   * 분리 완료 대기
   */
  const waitForCompletion = useCallback(async (_taskId: string): Promise<void> => {
    const maxAttempts = 1800 // 최대 30분 (1초마다 체크, CPU 기반 Demucs 분리 시간 고려)
    let attempts = 0

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        attempts++

        if (attempts >= maxAttempts) {
          clearInterval(interval)
          reject(new Error('Separation timeout'))
          return
        }

        // 진행률 확인 (100%면 완료)
        const currentProgress = useStemStore.getState().separationProgress
        if (currentProgress >= 100) {
          clearInterval(interval)
          resolve()
          return
        }

        // 상태 확인
        const currentStatus = useStemStore.getState().separationStatus
        if (currentStatus === 'failed') {
          clearInterval(interval)
          reject(new Error(useStemStore.getState().errorMessage || 'Separation failed'))
          return
        }
      }, 1000)
    })
  }, [])

  /**
   * Stem 분리 시작
   */
  const startSeparation = useCallback(async (file: File): Promise<void> => {
    try {
      // 이전 구독 취소
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }

      // 상태 초기화
      lastFileRef.current = file
      setSeparationStatus('uploading')
      setSeparationProgress(0)
      setErrorMessage(null)

      // 파일 업로드
      const { taskId: newTaskId } = await uploadForSeparation(file)
      setTaskId(newTaskId)
      setSeparationStatus('processing')

      // 진행률 구독
      unsubscribeRef.current = subscribeSeparationProgress(
        newTaskId,
        (progress, status) => {
          setSeparationProgress(progress)
          console.log(`[useSeparation] Progress: ${progress}% - ${status}`)
        }
      )

      // 완료 대기 (폴링 방식으로 상태 확인)
      await waitForCompletion(newTaskId)

      // Stem 다운로드 및 디코딩
      setSeparationStatus('processing')
      setSeparationProgress(90) // 다운로드 시작

      const audioContext = getAudioContext()
      const stems = await downloadAndDecodeAllStems(newTaskId, audioContext)

      // Store에 stem 저장
      setStems(stems)

      // 완료
      setSeparationProgress(100)
      setSeparationStatus('completed')

      // 구독 취소
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    } catch (error) {
      console.error('[useSeparation] Separation failed:', error)

      // 에러 상태 설정
      setSeparationStatus('failed')
      setErrorMessage(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )

      // 구독 취소
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [
    setSeparationStatus,
    setSeparationProgress,
    setTaskId,
    setErrorMessage,
    setStems,
    getAudioContext,
    waitForCompletion,
  ])

  /**
   * 분리 취소
   */
  const cancelSeparation = useCallback(() => {
    // 구독 취소
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    // 상태 리셋
    resetSeparation()
    lastFileRef.current = null
  }, [resetSeparation])

  /**
   * 분리 재시도
   */
  const retrySeparation = useCallback(async (): Promise<void> => {
    const lastFile = lastFileRef.current
    if (!lastFile) {
      throw new Error('No file to retry')
    }

    await startSeparation(lastFile)
  }, [startSeparation])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
      }
    }
  }, [])

  // 분리 중 여부
  const isSeparating =
    separationStatus === 'uploading' || separationStatus === 'processing'

  // 분리 가능 여부 (오디오가 로드되어 있고 분리 중이 아님)
  const canSeparate = buffer !== null && !isSeparating

  return {
    status: separationStatus,
    progress: separationProgress,
    taskId,
    errorMessage,
    startSeparation,
    cancelSeparation,
    retrySeparation,
    isSeparating,
    canSeparate,
    getAudioContext,
  }
}

/**
 * 분리 상태에 따른 표시 텍스트 반환
 */
export function getSeparationStatusText(
  status: import('../stores/stemStore').SeparationStatus,
  progress: number
): string {
  switch (status) {
    case 'idle':
      return 'Ready to separate stems'
    case 'uploading':
      return 'Uploading audio file...'
    case 'processing':
      return `Separating stems... ${Math.round(progress)}%`
    case 'completed':
      return 'Stem separation complete!'
    case 'failed':
      return 'Separation failed'
    default:
      return ''
  }
}
