/**
 * useMetronome Hook
 *
 * MetronomeEngine의 생명주기를 관리하고 bpmStore와 연동합니다.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { MetronomeEngine } from '@/core/MetronomeEngine'
import { useBpmStore } from '@/stores/bpmStore'
import type { AudioEngine } from '@/core/AudioEngine'

/**
 * useMetronome Hook 반환 타입
 */
export interface UseMetronomeReturn {
  isReady: boolean
  error: string | null
}

/**
 * 메트로놈 Hook 옵션
 */
export interface UseMetronomeOptions {
  audioEngine: AudioEngine | null
  currentTime?: number
  speed?: number
}

/**
 * 메트로놈 엔진 생명주기를 관리하는 Hook
 *
 * @param audioEngine - AudioEngine 인스턴스
 * @param currentTime - 현재 재생 시간 (초)
 * @param speed - 현재 재생 속도
 * @returns 메트로놈 상태
 */
export function useMetronome(
  audioEngine: AudioEngine | null,
  currentTime?: number,
  speed?: number
): UseMetronomeReturn {
  const metronomeRef = useRef<MetronomeEngine | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // bpmStore 상태 구독
  const beats = useBpmStore((state) => state.beats)
  const metronomeEnabled = useBpmStore((state) => state.metronomeEnabled)
  const metronomeVolume = useBpmStore((state) => state.metronomeVolume)

  /**
   * 메트로놈 엔진 초기화
   */
  const initializeMetronome = useCallback(() => {
    if (!audioEngine) {
      return
    }

    const context = audioEngine.getContext()
    if (!context) {
      setError('AudioContext를 가져올 수 없습니다')
      return
    }

    try {
      // 기존 엔진 정리
      if (metronomeRef.current) {
        metronomeRef.current.dispose()
      }

      // 새 엔진 생성
      metronomeRef.current = new MetronomeEngine({
        audioContext: context,
      })

      setIsReady(true)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : '메트로놈 초기화 실패'
      setError(message)
      setIsReady(false)
    }
  }, [audioEngine])

  // AudioEngine 변경 시 메트로놈 초기화
  useEffect(() => {
    if (!audioEngine) {
      setIsReady(false)
      return
    }

    initializeMetronome()

    return () => {
      if (metronomeRef.current) {
        metronomeRef.current.dispose()
        metronomeRef.current = null
      }
      setIsReady(false)
    }
  }, [audioEngine, initializeMetronome])

  // beats 변경 시 엔진에 설정
  useEffect(() => {
    if (!metronomeRef.current || beats.length === 0) {
      return
    }

    metronomeRef.current.setBeats(beats)
  }, [beats])

  // 볼륨 동기화
  useEffect(() => {
    if (!metronomeRef.current) {
      return
    }

    metronomeRef.current.setVolume(metronomeVolume)
  }, [metronomeVolume])

  // 메트로놈 활성화/비활성화
  useEffect(() => {
    if (!metronomeRef.current) {
      return
    }

    if (metronomeEnabled) {
      metronomeRef.current.start()
    } else {
      metronomeRef.current.stop()
    }
  }, [metronomeEnabled])

  // 재생 위치 동기화
  useEffect(() => {
    if (!metronomeRef.current || currentTime === undefined || speed === undefined) {
      return
    }

    metronomeRef.current.syncToPlaybackTime(currentTime, speed)
  }, [currentTime, speed])

  return {
    isReady,
    error,
  }
}
