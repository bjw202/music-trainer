interface SpeedControlProps {
  speed: number
  onSpeedChange: (speed: number) => void
  disabled?: boolean
}

/**
 * 속도 슬라이더 컴포넌트
 *
 * 0.5x ~ 2.0x 범위의 재생 속도를 조절합니다.
 */
export function SpeedControl({
  speed,
  onSpeedChange,
  disabled = false,
}: SpeedControlProps) {
  const percentage = ((speed - 0.5) / (2.0 - 0.5)) * 100

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-[#9CA3AF] w-12 shrink-0">
        Speed
      </label>
      <input
        data-testid="speed-slider"
        type="range"
        min="0.5"
        max="2.0"
        step="0.1"
        value={speed}
        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={`
          flex-1 h-1.5 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-moz-range-thumb]:appearance-none
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
        `}
        style={{
          background: `linear-gradient(to right, #818CF8 0%, #818CF8 ${percentage}%, #2A2A2A ${percentage}%, #2A2A2A 100%)`,
        }}
        aria-label="Speed control"
        aria-valuenow={speed}
        aria-valuemin={0.5}
        aria-valuemax={2.0}
        aria-valuetext={`${speed.toFixed(1)}x`}
      />
      <span
        data-testid="speed-display"
        className="text-sm font-mono text-[#F5F5F5] w-12 text-right shrink-0"
      >
        {speed.toFixed(1)}x
      </span>
    </div>
  )
}
