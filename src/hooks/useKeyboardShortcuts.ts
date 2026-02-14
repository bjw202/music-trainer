import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useControlStore } from '../stores/controlStore'
import { useLoopStore } from '../stores/loopStore'
import { TIME_INTERVALS, KEYBOARD_SHORTCUTS } from '../utils/constants'

/**
 * 키보드 단축키 처리 훅
 *
 * 키 맵핑:
 * - Space: 재생/일시정지 토글
 * - ArrowLeft: -5초 탐색
 * - ArrowRight: +5초 탐색
 * - I: 루프 A 지점 설정
 * - O: 루프 B 지점 설정
 * - A: 루프 A 지점으로 이동 (루프 활성화 시에만 동작)
 * - M: 음소거 토글
 *
 * @param currentTime - 현재 재생 시간 (초)
 * @param duration - 전체 재생 시간 (초)
 * @param canPlay - 재생 가능 여부
 */
export function useKeyboardShortcuts(
  currentTime: number,
  duration: number,
  canPlay: boolean
) {
  /**
   * 재생/일시정지 토글
   */
  const handlePlayPause = useCallback(() => {
    const { isPlaying } = usePlayerStore.getState()
    if (isPlaying) {
      usePlayerStore.getState().pause()
    } else {
      usePlayerStore.getState().play()
    }
  }, [])

  /**
   * 이전 탐색 (-5초)
   */
  const handleSeekBackward = useCallback(() => {
    if (!canPlay) {
      return
    }

    const newTime = Math.max(0, currentTime - TIME_INTERVALS.SEEK_STEP)
    usePlayerStore.getState().setCurrentTime(newTime)
  }, [currentTime, canPlay])

  /**
   * 이후 탐색 (+5초)
   */
  const handleSeekForward = useCallback(() => {
    if (!canPlay) {
      return
    }

    const newTime = Math.min(duration, currentTime + TIME_INTERVALS.SEEK_STEP)
    usePlayerStore.getState().setCurrentTime(newTime)
  }, [currentTime, duration, canPlay])

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

    usePlayerStore.getState().setCurrentTime(loopA)
  }, [])

  /**
   * 음소거 토글
   */
  const handleToggleMute = useCallback(() => {
    useControlStore.getState().toggleMute()
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

      switch (event.key) {
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
  ])

  return {
    handlePlayPause,
    handleSeekBackward,
    handleSeekForward,
    handleSetLoopA,
    handleSetLoopB,
    handleJumpToA,
    handleToggleMute,
  }
}
