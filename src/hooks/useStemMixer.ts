import { useEffect, useRef, useCallback } from 'react'
import { StemMixer } from '../core/StemMixer'
import { useStemStore } from '../stores/stemStore'
import { usePlayerStore } from '../stores/playerStore'
import { useLoopStore } from '../stores/loopStore'
import type { StemName } from '../stores/stemStore'

/**
 * StemMixer 훅 반환 값
 */
export interface UseStemMixerReturn {
  mixer: StemMixer | null
  isReady: boolean
  initialize: () => Promise<void>
  loadStems: (stems: Record<StemName, AudioBuffer>) => Promise<void>
  dispose: () => Promise<void>
}

/**
 * StemMixer 인스턴스 라이프사이클을 관리하는 훅
 *
 * 기능:
 * - StemMixer 인스턴스 생성 및 초기화
 * - stemStore와 동기화
 * - playerStore 재생 상태 동기화
 * - 컴포넌트 언마운트 시 리소스 정리
 */
export function useStemMixer(): UseStemMixerReturn {
  const mixerRef = useRef<StemMixer | null>(null)
  const isReadyRef = useRef(false)

  // Store 상태 구독
  const gains = useStemStore((state) => state.gains)
  const muted = useStemStore((state) => state.muted)
  const solo = useStemStore((state) => state.solo)

  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const stopPlayer = usePlayerStore((state) => state.stop)

  // A-B 루프 상태
  const loopA = useLoopStore((state) => state.loopA)
  const loopB = useLoopStore((state) => state.loopB)
  const loopEnabled = useLoopStore((state) => state.loopEnabled)

  /**
   * StemMixer 초기화
   */
  const initialize = useCallback(async (): Promise<void> => {
    if (mixerRef.current) {
      return
    }

    try {
      const mixer = new StemMixer({
        onTimeUpdate: (time: number) => {
          // A-B 루프 처리
          if (loopEnabled && loopA !== null && loopB !== null) {
            // 루프 영역을 벗어나면 A 지점으로 되돌리기
            if (time >= loopB) {
              mixerRef.current?.seek(loopA)
              setCurrentTime(loopA)
              return
            }
            // 루프 영역보다 앞서있으면 A 지점으로 이동
            if (time < loopA) {
              mixerRef.current?.seek(loopA)
              setCurrentTime(loopA)
              return
            }
          }

          setCurrentTime(time)
        },
        onEnded: () => {
          stopPlayer()
        },
      })

      await mixer.initialize()
      mixerRef.current = mixer
      isReadyRef.current = true
    } catch (error) {
      console.error('[useStemMixer] Failed to initialize:', error)
      throw error
    }
  }, [setCurrentTime, stopPlayer, loopEnabled, loopA, loopB])

  /**
   * Stem AudioBuffers 로드
   */
  const loadStems = useCallback(async (
    stemsData: Record<StemName, AudioBuffer>
  ): Promise<void> => {
    const mixer = mixerRef.current
    if (!mixer) {
      throw new Error('StemMixer not initialized')
    }

    try {
      await mixer.loadStems(stemsData)
      setDuration(mixer.getDuration())
    } catch (error) {
      console.error('[useStemMixer] Failed to load stems:', error)
      throw error
    }
  }, [setDuration])

  /**
   * 리소스 정리
   */
  const dispose = useCallback(async (): Promise<void> => {
    const mixer = mixerRef.current
    if (!mixer) {
      return
    }

    try {
      await mixer.dispose()
      mixerRef.current = null
      isReadyRef.current = false
    } catch (error) {
      console.error('[useStemMixer] Failed to dispose:', error)
    }
  }, [])

  // stemStore 게인 변경 시 StemMixer에 동기화
  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) {
      return
    }

    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      mixer.setStemGain(stemName, gains[stemName])
    }
  }, [gains])

  // stemStore mute 상태 변경 시 StemMixer에 동기화
  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) {
      return
    }

    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      // StemMixer는 내부 상태를 직접 관리하므로 toggle 호출
      if (muted[stemName]) {
        mixer.toggleStemMute(stemName)
      }
    }
  }, [muted])

  // stemStore solo 상태 변경 시 StemMixer에 동기화
  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) {
      return
    }

    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      // StemMixer는 내부 상태를 직접 관리하므로 toggle 호출
      if (solo[stemName]) {
        mixer.toggleStemSolo(stemName)
      }
    }
  }, [solo])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (mixerRef.current) {
        mixerRef.current.dispose().catch(console.error)
      }
    }
  }, [])

  return {
    mixer: mixerRef.current,
    isReady: isReadyRef.current,
    initialize,
    loadStems,
    dispose,
  }
}

/**
 * StemMixer 재생 제어 훅
 *
 * usePlayback과 유사한 인터페이스를 제공하여
 * AudioEngine과 StemMixer 간의 전환을 용이하게 합니다.
 */
export function useStemMixerPlayback(mixer: StemMixer | null) {
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const duration = usePlayerStore((state) => state.duration)
  const stems = useStemStore((state) => state.stems)

  /**
   * 재생 시작
   */
  const play = useCallback(async () => {
    if (!mixer) {
      return
    }

    try {
      await mixer.play()
      usePlayerStore.getState().play()
    } catch (error) {
      console.error('[useStemMixerPlayback] Play error:', error)
    }
  }, [mixer])

  /**
   * 일시정지
   */
  const pause = useCallback(() => {
    if (!mixer) {
      return
    }

    mixer.pause()
    usePlayerStore.getState().pause()
  }, [mixer])

  /**
   * 정지
   */
  const stop = useCallback(() => {
    if (!mixer) {
      return
    }

    mixer.stop()
    usePlayerStore.getState().stop()
  }, [mixer])

  /**
   * 시간 탐색
   */
  const seek = useCallback(
    (time: number) => {
      if (!mixer) {
        return
      }

      mixer.seek(time)
      usePlayerStore.getState().setCurrentTime(time)
    },
    [mixer]
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

  /**
   * Stem이 로드되었는지 확인
   */
  const areStemsLoaded = stems.vocals !== null &&
    stems.drums !== null &&
    stems.bass !== null &&
    stems.other !== null

  return {
    play,
    pause,
    stop,
    seek,
    togglePlayPause,
    isPlaying,
    currentTime,
    duration,
    canPlay: areStemsLoaded,
  }
}
