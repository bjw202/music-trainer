import { useCallback, useEffect } from 'react'
import { AudioEngine } from '../core/AudioEngine'
import { useControlStore } from '../stores/controlStore'
import { SPEED_PITCH } from '../utils/constants'

/**
 * 속도/피치 제어 훅
 *
 * controlStore의 speed/pitch 상태와 AudioEngine을 연결합니다.
 *
 * @param engine - 오디오 엔진 인스턴스
 */
export function useSpeedPitch(engine: AudioEngine | null) {
  const speed = useControlStore((state) => state.speed)
  const pitch = useControlStore((state) => state.pitch)

  // speed 변경 시 엔진에 반영
  useEffect(() => {
    if (!engine) {
      return
    }
    engine.setSpeed(speed)
  }, [engine, speed])

  // pitch 변경 시 엔진에 반영
  useEffect(() => {
    if (!engine) {
      return
    }
    engine.setPitch(pitch)
  }, [engine, pitch])

  const increaseSpeed = useCallback(() => {
    const { speed: currentSpeed, setSpeed } = useControlStore.getState()
    const newSpeed = Math.min(
      SPEED_PITCH.MAX_SPEED,
      Math.round((currentSpeed + SPEED_PITCH.SPEED_STEP) * 10) / 10
    )
    setSpeed(newSpeed)
  }, [])

  const decreaseSpeed = useCallback(() => {
    const { speed: currentSpeed, setSpeed } = useControlStore.getState()
    const newSpeed = Math.max(
      SPEED_PITCH.MIN_SPEED,
      Math.round((currentSpeed - SPEED_PITCH.SPEED_STEP) * 10) / 10
    )
    setSpeed(newSpeed)
  }, [])

  const increasePitch = useCallback(() => {
    const { pitch: currentPitch, setPitch } = useControlStore.getState()
    const newPitch = Math.min(
      SPEED_PITCH.MAX_PITCH,
      currentPitch + SPEED_PITCH.PITCH_STEP
    )
    setPitch(newPitch)
  }, [])

  const decreasePitch = useCallback(() => {
    const { pitch: currentPitch, setPitch } = useControlStore.getState()
    const newPitch = Math.max(
      SPEED_PITCH.MIN_PITCH,
      currentPitch - SPEED_PITCH.PITCH_STEP
    )
    setPitch(newPitch)
  }, [])

  const resetSpeedPitch = useCallback(() => {
    useControlStore.getState().resetSpeedPitch()
  }, [])

  /**
   * 속도 표시 포맷: "X.Xx"
   */
  const formatSpeed = useCallback((value: number): string => {
    return `${value.toFixed(1)}x`
  }, [])

  /**
   * 피치 표시 포맷: "+N" / "-N" / "0"
   */
  const formatPitch = useCallback((value: number): string => {
    if (value > 0) return `+${value}`
    return `${value}`
  }, [])

  return {
    speed,
    pitch,
    increaseSpeed,
    decreaseSpeed,
    increasePitch,
    decreasePitch,
    resetSpeedPitch,
    formatSpeed,
    formatPitch,
  }
}
