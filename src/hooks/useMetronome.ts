/**
 * useMetronome Hook
 *
 * MetronomeEngine의 생명주기를 관리하고 bpmStore와 연동합니다.
 * AudioEngine의 직접 시간 리스너를 사용하여 React 상태를 거치지 않고 동기화합니다.
 * 음원 재생 상태와 메트로놈을 연동하여, 음원 정지 시 메트로놈도 정지합니다.
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
 * 메트로놈 엔진 생명주기를 관리하는 Hook
 *
 * AudioEngine의 addTimeListener를 통해 React 상태를 거치지 않고
 * 직접 시간 동기화를 수행합니다 (~16ms 지연, React 경로 대비 ~120ms 절약).
 *
 * 음원 재생 상태(play/pause/stop)와 메트로놈이 연동됩니다:
 * - 메트로놈 ON + 음원 재생 중 → 클릭 재생
 * - 메트로놈 ON + 음원 정지 → 클릭 정지 (enabled 상태는 유지)
 *
 * @param audioEngine - AudioEngine 인스턴스
 * @returns 메트로놈 상태
 */
export function useMetronome(
  audioEngine: AudioEngine | null,
): UseMetronomeReturn {
  const metronomeRef = useRef<MetronomeEngine | null>(null)
  const listenerRef = useRef<((time: number, speed: number) => void) | null>(null)
  const seekListenerRef = useRef<((time: number, speed: number) => void) | null>(null)
  const speedListenerRef = useRef<((speed: number, sourceTime: number) => void) | null>(null)
  const playStateListenerRef = useRef<((isPlaying: boolean) => void) | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 음원 재생 상태 추적
  const [audioIsPlaying, setAudioIsPlaying] = useState(false)

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
      // 기존 리스너 해제
      if (listenerRef.current) {
        audioEngine.removeTimeListener(listenerRef.current)
        listenerRef.current = null
      }
      if (seekListenerRef.current) {
        audioEngine.removeSeekListener(seekListenerRef.current)
        seekListenerRef.current = null
      }
      if (speedListenerRef.current) {
        audioEngine.removeSpeedChangeListener(speedListenerRef.current)
        speedListenerRef.current = null
      }
      if (playStateListenerRef.current) {
        audioEngine.removePlayStateListener(playStateListenerRef.current)
        playStateListenerRef.current = null
      }

      // 기존 엔진 정리
      if (metronomeRef.current) {
        metronomeRef.current.dispose()
      }

      // 새 엔진 생성 (초기 볼륨 설정 포함)
      const initialVolume = useBpmStore.getState().metronomeVolume
      metronomeRef.current = new MetronomeEngine({
        audioContext: context,
        initialVolume,
      })

      // AudioEngine에 직접 시간 리스너 등록 (React 상태 우회)
      const timeListener = (time: number, speed: number) => {
        metronomeRef.current?.syncToPlaybackTime(time, speed)
      }
      listenerRef.current = timeListener
      audioEngine.addTimeListener(timeListener)

      // Seek 리스너 등록 (비연속적 위치 이동 시 scheduledBeats 초기화)
      const seekListener = (time: number, speed: number) => {
        metronomeRef.current?.seekTo(time, speed)
      }
      seekListenerRef.current = seekListener
      audioEngine.addSeekListener(seekListener)

      // 속도 변경 리스너 등록 (속도 변경 시 앵커 기준점 즉시 재설정)
      const speedListener = (speed: number, sourceTime: number) => {
        metronomeRef.current?.onSpeedChange(speed, sourceTime)
      }
      speedListenerRef.current = speedListener
      audioEngine.addSpeedChangeListener(speedListener)

      // 재생 상태 변경 리스너 등록 (음원 play/pause/stop 시 메트로놈 연동)
      const playStateListener = (isPlaying: boolean) => {
        setAudioIsPlaying(isPlaying)
      }
      playStateListenerRef.current = playStateListener
      audioEngine.addPlayStateListener(playStateListener)

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
      // 리스너 해제
      if (listenerRef.current && audioEngine) {
        audioEngine.removeTimeListener(listenerRef.current)
        listenerRef.current = null
      }
      if (seekListenerRef.current && audioEngine) {
        audioEngine.removeSeekListener(seekListenerRef.current)
        seekListenerRef.current = null
      }
      if (speedListenerRef.current && audioEngine) {
        audioEngine.removeSpeedChangeListener(speedListenerRef.current)
        speedListenerRef.current = null
      }
      if (playStateListenerRef.current && audioEngine) {
        audioEngine.removePlayStateListener(playStateListenerRef.current)
        playStateListenerRef.current = null
      }
      // 엔진 정리
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

  // 메트로놈 활성화/비활성화 (음원 재생 상태와 연동)
  // 조건: metronomeEnabled && audioIsPlaying 일 때만 재생
  useEffect(() => {
    if (!metronomeRef.current) {
      return
    }

    if (metronomeEnabled && audioIsPlaying) {
      metronomeRef.current.start()
    } else {
      metronomeRef.current.stop()
    }
  }, [metronomeEnabled, audioIsPlaying])

  return {
    isReady,
    error,
  }
}
