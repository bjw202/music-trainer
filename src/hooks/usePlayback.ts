import { useCallback, useEffect } from 'react'
import { AudioEngine } from '../core/AudioEngine'
import { StemMixer } from '../core/StemMixer'
import { usePlayerStore } from '../stores/playerStore'
import { useAudioStore } from '../stores/audioStore'
import { useStemStore } from '../stores/stemStore'

/**
 * 오디오 재생 제어 훅
 *
 * @param engine - 오디오 엔진 인스턴스 (AudioEngine 또는 StemMixer)
 * @returns {Object} - 재생 제어 함수들과 상태
 */
export function usePlayback(engine: AudioEngine | StemMixer | null) {
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const duration = usePlayerStore((state) => state.duration)
  const buffer = useAudioStore((state) => state.buffer)

  // Stem 모드 확인
  const isStemMode = useStemStore((state) => state.isStemMode)
  const stems = useStemStore((state) => state.stems)

  // Stem이 로드되었는지 확인
  const areStemsLoaded = stems.vocals !== null &&
    stems.drums !== null &&
    stems.bass !== null &&
    stems.other !== null

  /**
   * 재생 가능 여부 확인
   * - Stem 모드: 모든 stem이 로드되어야 함
   * - 일반 모드: 버퍼가 있어야 함
   */
  const canPlayBuffer = isStemMode ? areStemsLoaded : !!buffer

  /**
   * 재생 시작
   * UI 상태는 즉시 업데이트하고, AudioContext resume은 백그라운드에서 처리
   */
  const play = useCallback(async () => {
    if (!engine) {
      return
    }

    // Stem 모드: stem 확인, 일반 모드: 버퍼 확인
    if (isStemMode && !areStemsLoaded) {
      return
    }
    if (!isStemMode && !buffer) {
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
  }, [engine, buffer, isStemMode, areStemsLoaded])

  /**
   * 일시정지
   */
  const pause = useCallback(() => {
    if (!engine) {
      return
    }

    // Stem 모드: stem 확인, 일반 모드: 버퍼 확인
    if (isStemMode && !areStemsLoaded) {
      return
    }
    if (!isStemMode && !buffer) {
      return
    }

    engine.pause()
    usePlayerStore.getState().pause()
  }, [engine, buffer, isStemMode, areStemsLoaded])

  /**
   * 정지
   */
  const stop = useCallback(() => {
    if (!engine) {
      return
    }

    // Stem 모드: stem 확인, 일반 모드: 버퍼 확인
    if (isStemMode && !areStemsLoaded) {
      return
    }
    if (!isStemMode && !buffer) {
      return
    }

    engine.stop()
    usePlayerStore.getState().stop()
  }, [engine, buffer, isStemMode, areStemsLoaded])

  /**
   * 시간 탐색
   */
  const seek = useCallback(
    (time: number) => {
      if (!engine) {
        return
      }

      // Stem 모드: stem 확인, 일반 모드: 버퍼 확인
      if (isStemMode && !areStemsLoaded) {
        return
      }
      if (!isStemMode && !buffer) {
        return
      }

      engine.seek(time)
      usePlayerStore.getState().setCurrentTime(time)
    },
    [engine, buffer, isStemMode, areStemsLoaded]
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
    canPlay: canPlayBuffer,
  }
}
