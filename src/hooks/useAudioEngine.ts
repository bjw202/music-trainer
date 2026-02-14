import { useEffect, useRef, useState, useCallback } from 'react'
import { AudioEngine } from '../core/AudioEngine'
import { useAudioStore } from '../stores/audioStore'
import { usePlayerStore } from '../stores/playerStore'
import { useControlStore } from '../stores/controlStore'
import { useLoopStore } from '../stores/loopStore'

/**
 * 오디오 엔진 생명주크 관리 훅
 *
 * @returns {Object} - 엔진 인스턴스, 준비 상태, 에러, 초기화 함수, 파일 로딩 함수
 */
export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 오디오 엔진 초기화
   */
  const initialize = useCallback(async () => {
    if (engineRef.current) {
      return // 이미 초기화됨
    }

    try {
      const engine = new AudioEngine({
        onTimeUpdate: (time: number) => {
          usePlayerStore.getState().setCurrentTime(time)

          // 루프 처리
          const { loopA, loopB, loopEnabled } = useLoopStore.getState()
          if (loopEnabled && loopA !== null && loopB !== null) {
            if (time >= loopB) {
              engine.seek(loopA)
            }
          }
        },
        onEnded: () => {
          usePlayerStore.getState().stop()
        },
      })

      await engine.initialize()
      engineRef.current = engine
      setIsReady(true)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize audio engine'
      setError(message)
      setIsReady(false)
    }
  }, [])

  /**
   * 오디오 파일 로딩
   */
  const loadFile = useCallback(
    async (file: File) => {
      if (!engineRef.current) {
        throw new Error('AudioEngine not initialized')
      }

      try {
        useAudioStore.getState().setFile(file)
        useAudioStore.getState().setLoading(true)

        const arrayBuffer = await file.arrayBuffer()
        const buffer = await engineRef.current.loadBuffer(arrayBuffer)

        useAudioStore.getState().setBuffer(buffer)
        usePlayerStore.getState().setDuration(buffer.duration)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audio file'
        setError(message)
        useAudioStore.getState().setError(message)
      }
    },
    []
  )

  /**
   * 볼륨 동기화
   */
  useEffect(() => {
    if (!engineRef.current) {
      return
    }

    const { volume, muted } = useControlStore.getState()
    engineRef.current.setVolume(muted ? 0 : volume / 100)
  }, [])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      engineRef.current?.dispose().catch(console.error)
      engineRef.current = null
      setIsReady(false)
    }
  }, [])

  return {
    engine: engineRef.current,
    isReady,
    error,
    initialize,
    loadFile,
  }
}
