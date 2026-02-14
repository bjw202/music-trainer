import { useCallback, useEffect } from 'react'
import { AudioEngine } from '../core/AudioEngine'
import { usePlayerStore } from '../stores/playerStore'
import { useAudioStore } from '../stores/audioStore'

/**
 * 오디오 재생 제어 훅
 *
 * @param engine - 오디오 엔진 인스턴스
 * @returns {Object} - 재생 제어 함수들과 상태
 */
export function usePlayback(engine: AudioEngine | null) {
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const duration = usePlayerStore((state) => state.duration)
  const buffer = useAudioStore((state) => state.buffer)

  /**
   * 재생 시작
   * UI 상태는 즉시 업데이트하고, AudioContext resume은 백그라운드에서 처리
   */
  const play = useCallback(async () => {
    if (!engine || !buffer) {
      return
    }

    // UI 상태 먼저 업데이트 (즉각적인 피드백)
    usePlayerStore.getState().play()

    // 오디오 재생 시도
    try {
      await engine.play()
    } catch (error) {
      console.error('[usePlayback] Play error:', error)
      // 에러가 발생해도 UI 상태는 유지 (사용자 경험)
    }
  }, [engine, buffer])

  /**
   * 일시정지
   */
  const pause = useCallback(() => {
    if (!engine || !buffer) {
      return
    }

    engine.pause()
    usePlayerStore.getState().pause()
  }, [engine, buffer])

  /**
   * 정지
   */
  const stop = useCallback(() => {
    if (!engine || !buffer) {
      return
    }

    engine.stop()
    usePlayerStore.getState().stop()
  }, [engine, buffer])

  /**
   * 시간 탐색
   */
  const seek = useCallback(
    (time: number) => {
      if (!engine || !buffer) {
        return
      }

      engine.seek(time)
      usePlayerStore.getState().setCurrentTime(time)
    },
    [engine, buffer]
  )

  /**
   * 재생/일시정지 토글
   */
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (!engine) {
        return
      }

      // 재생 중이면 정지
      if (usePlayerStore.getState().isPlaying) {
        usePlayerStore.getState().stop()
      }
    }
  }, [engine])

  return {
    play,
    pause,
    stop,
    seek,
    togglePlayPause,
    isPlaying,
    currentTime,
    duration,
    canPlay: !!buffer,
  }
}
