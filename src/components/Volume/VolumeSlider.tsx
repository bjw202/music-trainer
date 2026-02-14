interface VolumeSliderProps {
  volume: number
  onVolumeChange: (volume: number) => void
  disabled?: boolean
}

/**
 * 볼륨 슬라이더 컴포넌트
 *
 * 0-100% 범위의 볼륨을 조절합니다.
 */
export function VolumeSlider({
  volume,
  onVolumeChange,
  disabled = false,
}: VolumeSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-[#818CF8]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
      <input
        data-testid="volume-slider"
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className={`
          w-32 h-1.5 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer
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
          background: `linear-gradient(to right, #818CF8 0%, #818CF8 ${volume}%, #2A2A2A ${volume}%, #2A2A2A 100%)`
        }}
        aria-label="Volume"
        aria-valuenow={volume}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${volume}%`}
      />
    </div>
  )
}
