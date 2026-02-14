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
        p-4 rounded-full transition-colors
        ${
          disabled
            ? 'text-[#5a5a5a] cursor-not-allowed'
            : 'text-[#e0e0e0] hover:text-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]'
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
