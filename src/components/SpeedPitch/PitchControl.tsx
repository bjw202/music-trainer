import { SPEED_PITCH } from '../../utils/constants'

interface PitchControlProps {
  pitch: number
  onPitchChange: (pitch: number) => void
  disabled?: boolean
}

/**
 * 피치 제어 컴포넌트 (+/- 버튼)
 *
 * -12 ~ +12 반음 범위, 1 반음 단위로 조절
 */
export function PitchControl({
  pitch,
  onPitchChange,
  disabled = false,
}: PitchControlProps) {
  const decrease = () => {
    const newPitch = Math.max(
      SPEED_PITCH.MIN_PITCH,
      pitch - SPEED_PITCH.PITCH_STEP
    )
    onPitchChange(newPitch)
  }

  const increase = () => {
    const newPitch = Math.min(
      SPEED_PITCH.MAX_PITCH,
      pitch + SPEED_PITCH.PITCH_STEP
    )
    onPitchChange(newPitch)
  }

  const formatPitch = (value: number): string => {
    if (value > 0) return `+${value}`
    if (value < 0) return `${value}`
    return '0'
  }

  const isMin = pitch <= SPEED_PITCH.MIN_PITCH
  const isMax = pitch >= SPEED_PITCH.MAX_PITCH

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-[#9CA3AF] w-12 shrink-0">
        Pitch
      </label>
      <button
        data-testid="pitch-decrease"
        onClick={decrease}
        disabled={disabled || isMin}
        className={`
          w-9 h-9 flex items-center justify-center rounded-lg transition-colors
          ${
            disabled || isMin
              ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
              : 'bg-[#1E1E1E] text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-[#F5F5F5] active:bg-[#333333]'
          }
        `}
        aria-label="Decrease pitch"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <div
        data-testid="pitch-display"
        className="flex-1 h-9 flex items-center justify-center bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg"
      >
        <span className="text-base font-semibold font-mono text-[#F5F5F5]">
          {formatPitch(pitch)}
        </span>
      </div>
      <button
        data-testid="pitch-increase"
        onClick={increase}
        disabled={disabled || isMax}
        className={`
          w-9 h-9 flex items-center justify-center rounded-lg transition-colors
          ${
            disabled || isMax
              ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
              : 'bg-[#1E1E1E] text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-[#F5F5F5] active:bg-[#333333]'
          }
        `}
        aria-label="Increase pitch"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  )
}
