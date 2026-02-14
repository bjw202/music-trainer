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
    <div className="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-[#a0a0a0]"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M3 9v6h4l5 5V4L7 9v6H3zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.03V12zM19 12c0 .82-.68 1.5-1.5 1.5-.82 0-1.5-.68-1.5-1.5.68 0 1.5.67 1.5 1.5z" />
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
          w-24 h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer
          ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-[#3a3a3a]'
          }
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
        [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:bg-[#007aff]
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:hover:scale-110
        [&::-webkit-slider-thumb]:transition-transform
        `}
        aria-label="Volume"
        aria-valuenow={volume}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${volume}%`}
      />
    </div>
  )
}
