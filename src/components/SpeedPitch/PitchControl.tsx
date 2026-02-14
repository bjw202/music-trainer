interface PitchControlProps {
  pitch: number
  onPitchChange: (pitch: number) => void
  disabled?: boolean
}

/**
 * 피치 슬라이더 컴포넌트
 *
 * -12 ~ +12 반음 범위의 피치를 조절합니다.
 */
export function PitchControl({
  pitch,
  onPitchChange,
  disabled = false,
}: PitchControlProps) {
  const percentage = ((pitch - -12) / (12 - -12)) * 100

  const formatPitch = (value: number): string => {
    if (value > 0) return `+${value}`
    if (value < 0) return `${value}`
    return '0'
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-[#9CA3AF] w-12 shrink-0">
        Pitch
      </label>
      <input
        data-testid="pitch-slider"
        type="range"
        min="-12"
        max="12"
        step="1"
        value={pitch}
        onChange={(e) => onPitchChange(parseInt(e.target.value, 10))}
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
          background: `linear-gradient(to right, #60A5FA 0%, #60A5FA ${percentage}%, #2A2A2A ${percentage}%, #2A2A2A 100%)`,
        }}
        aria-label="Pitch control"
        aria-valuenow={pitch}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuetext={`${formatPitch(pitch)} semitones`}
      />
      <span
        data-testid="pitch-display"
        className="text-sm font-mono text-[#F5F5F5] w-12 text-right shrink-0"
      >
        {formatPitch(pitch)}
      </span>
    </div>
  )
}
