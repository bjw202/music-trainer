interface PlayButtonProps {
  isPlaying: boolean
  onToggle: () => void
  disabled?: boolean
}

/**
 * 재생/일시정지 버튼 컴포넌트
 *
 * 현재 상태에 따라 재생 또는 일시정지 아이콘을 표시합니다.
 */
export function PlayButton({ isPlaying, onToggle, disabled = false }: PlayButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        w-16 h-16 rounded-full transition-colors flex items-center justify-center
        ${
          disabled
            ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
            : 'bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]'
        }
      `}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      aria-pressed={isPlaying}
    >
      {isPlaying ? (
        // Pause icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      ) : (
        // Play icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  )
}
