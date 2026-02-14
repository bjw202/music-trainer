import { SPEED_PITCH } from '../../utils/constants'

interface SpeedControlProps {
  speed: number
  onSpeedChange: (speed: number) => void
  disabled?: boolean
}

/**
 * 속도 제어 컴포넌트 (+/- 버튼)
 *
 * 0.5x ~ 2.0x 범위, 1% (0.01) 단위로 정밀 조절
 */
export function SpeedControl({
  speed,
  onSpeedChange,
  disabled = false,
}: SpeedControlProps) {
  const decrease = () => {
    const newSpeed = Math.max(
      SPEED_PITCH.MIN_SPEED,
      Math.round((speed - SPEED_PITCH.SPEED_STEP) * 100) / 100
    )
    onSpeedChange(newSpeed)
  }

  const increase = () => {
    const newSpeed = Math.min(
      SPEED_PITCH.MAX_SPEED,
      Math.round((speed + SPEED_PITCH.SPEED_STEP) * 100) / 100
    )
    onSpeedChange(newSpeed)
  }

  const isMin = speed <= SPEED_PITCH.MIN_SPEED
  const isMax = speed >= SPEED_PITCH.MAX_SPEED

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-[#9CA3AF] w-12 shrink-0">
        Speed
      </label>
      <button
        data-testid="speed-decrease"
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
        aria-label="Decrease speed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <div
        data-testid="speed-display"
        className="flex-1 h-9 flex items-center justify-center bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg"
      >
        <span className="text-base font-semibold font-mono text-[#F5F5F5]">
          {speed.toFixed(2)}x
        </span>
      </div>
      <button
        data-testid="speed-increase"
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
        aria-label="Increase speed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  )
}
