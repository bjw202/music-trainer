import { useEffect, useCallback } from 'react'
import { useControlStore } from '../stores/controlStore'
import { useLoopStore } from '../stores/loopStore'
import { TIME_INTERVALS, KEYBOARD_SHORTCUTS, SPEED_PITCH } from '../utils/constants'

/**
 * 키보드 단축키 처리 훅
 *
 * 키 맵핑:
 * - Space: 재생/일시정지 토글
 * - ArrowLeft: -5초 탐색
 * - ArrowRight: +5초 탐색
 * - I: 루프 A 지점 설정
 * - O: 루프 B 지점 설정
 * - Q: 루프 A 지점으로 이동 (루프 활성화 시에만 동작)
 * - M: 음소거 토글
 * - =/+: 속도 +0.1
 * - -/_: 속도 -0.1
 * - ]: 피치 +1
 * - [: 피치 -1
 * - R: 속도/피치 초기화
 *
 * @param currentTime - 현재 재생 시간 (초)
 * @param duration - 전체 재생 시간 (초)
 * @param canPlay - 재생 가능 여부
 * @param playback - AudioEngine 연동 재생 제어 함수
 */
export function useKeyboardShortcuts(
  currentTime: number,
  duration: number,
  canPlay: boolean,
  playback: {
    togglePlayPause: () => void
    seek: (time: number) => void
  }
) {
  /**
   * 재생/일시정지 토글
   */
  const handlePlayPause = useCallback(() => {
    playback.togglePlayPause()
  }, [playback])

  /**
   * 이전 탐색 (-5초)
   */
  const handleSeekBackward = useCallback(() => {
    if (!canPlay) {
      return
    }

    const newTime = Math.max(0, currentTime - TIME_INTERVALS.SEEK_STEP)
    playback.seek(newTime)
  }, [currentTime, canPlay, playback])

  /**
   * 이후 탐색 (+5초)
   */
  const handleSeekForward = useCallback(() => {
    if (!canPlay) {
      return
    }

    const newTime = Math.min(duration, currentTime + TIME_INTERVALS.SEEK_STEP)
    playback.seek(newTime)
  }, [currentTime, duration, canPlay, playback])

  /**
   * 루프 A 지점 설정
   */
  const handleSetLoopA = useCallback(() => {
    if (!canPlay) {
      return
    }

    useLoopStore.getState().setLoopA(currentTime)
  }, [currentTime, canPlay])

  /**
   * 루프 B 지점 설정
   */
  const handleSetLoopB = useCallback(() => {
    if (!canPlay) {
      return
    }

    useLoopStore.getState().setLoopB(currentTime)
  }, [currentTime, canPlay])

  /**
   * 루프 A 지점으로 이동 (루프 활성화 시에만)
   */
  const handleJumpToA = useCallback(() => {
    const { loopEnabled, loopA } = useLoopStore.getState()

    // 루프가 활성화되어 있고 A 지점이 설정되어 있을 때만 동작
    if (!loopEnabled || loopA === null) {
      return
    }

    playback.seek(loopA)
  }, [playback])

  /**
   * 음소거 토글
   */
  const handleToggleMute = useCallback(() => {
    useControlStore.getState().toggleMute()
  }, [])

  /**
   * 속도 증가 (+0.1)
   */
  const handleSpeedUp = useCallback(() => {
    const { speed, setSpeed } = useControlStore.getState()
    const newSpeed = Math.min(
      SPEED_PITCH.MAX_SPEED,
      Math.round((speed + SPEED_PITCH.SPEED_STEP) * 10) / 10
    )
    setSpeed(newSpeed)
  }, [])

  /**
   * 속도 감소 (-0.1)
   */
  const handleSpeedDown = useCallback(() => {
    const { speed, setSpeed } = useControlStore.getState()
    const newSpeed = Math.max(
      SPEED_PITCH.MIN_SPEED,
      Math.round((speed - SPEED_PITCH.SPEED_STEP) * 10) / 10
    )
    setSpeed(newSpeed)
  }, [])

  /**
   * 피치 증가 (+1 반음)
   */
  const handlePitchUp = useCallback(() => {
    const { pitch, setPitch } = useControlStore.getState()
    const newPitch = Math.min(
      SPEED_PITCH.MAX_PITCH,
      pitch + SPEED_PITCH.PITCH_STEP
    )
    setPitch(newPitch)
  }, [])

  /**
   * 피치 감소 (-1 반음)
   */
  const handlePitchDown = useCallback(() => {
    const { pitch, setPitch } = useControlStore.getState()
    const newPitch = Math.max(
      SPEED_PITCH.MIN_PITCH,
      pitch - SPEED_PITCH.PITCH_STEP
    )
    setPitch(newPitch)
  }, [])

  /**
   * 속도/피치 초기화
   */
  const handleResetSpeedPitch = useCallback(() => {
    useControlStore.getState().resetSpeedPitch()
  }, [])

  /**
   * 키보드 이벤트 리스너
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드 등에서는 동작하지 않도록 함
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

      switch (key) {
        case KEYBOARD_SHORTCUTS.SPACE:
          event.preventDefault()
          handlePlayPause()
          break

        case KEYBOARD_SHORTCUTS.ARROW_LEFT:
          event.preventDefault()
          handleSeekBackward()
          break

        case KEYBOARD_SHORTCUTS.ARROW_RIGHT:
          event.preventDefault()
          handleSeekForward()
          break

        case KEYBOARD_SHORTCUTS.SET_A:
          event.preventDefault()
          handleSetLoopA()
          break

        case KEYBOARD_SHORTCUTS.SET_B:
          event.preventDefault()
          handleSetLoopB()
          break

        case KEYBOARD_SHORTCUTS.JUMP_TO_A:
          event.preventDefault()
          handleJumpToA()
          break

        case KEYBOARD_SHORTCUTS.MUTE:
          event.preventDefault()
          handleToggleMute()
          break

        case KEYBOARD_SHORTCUTS.SPEED_UP:
          event.preventDefault()
          handleSpeedUp()
          break

        case KEYBOARD_SHORTCUTS.SPEED_DOWN:
          event.preventDefault()
          handleSpeedDown()
          break

        case KEYBOARD_SHORTCUTS.PITCH_UP:
          event.preventDefault()
          handlePitchUp()
          break

        case KEYBOARD_SHORTCUTS.PITCH_DOWN:
          event.preventDefault()
          handlePitchDown()
          break

        case KEYBOARD_SHORTCUTS.RESET_SPEED_PITCH:
          event.preventDefault()
          handleResetSpeedPitch()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    handlePlayPause,
    handleSeekBackward,
    handleSeekForward,
    handleSetLoopA,
    handleSetLoopB,
    handleJumpToA,
    handleToggleMute,
    handleSpeedUp,
    handleSpeedDown,
    handlePitchUp,
    handlePitchDown,
    handleResetSpeedPitch,
  ])

  return {
    handlePlayPause,
    handleSeekBackward,
    handleSeekForward,
    handleSetLoopA,
    handleSetLoopB,
    handleJumpToA,
    handleToggleMute,
    handleSpeedUp,
    handleSpeedDown,
    handlePitchUp,
    handlePitchDown,
    handleResetSpeedPitch,
  }
}
