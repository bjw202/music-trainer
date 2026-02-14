interface MuteButtonProps {
  muted: boolean
  onToggle: () => void
  disabled?: boolean
}

/**
 * 음소거 버튼 컴포넌트
 *
 * 음소거 상태를 토글합니다.
 */
export function MuteButton({ muted, onToggle, disabled = false }: MuteButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        w-9 h-9 rounded-lg transition-colors flex items-center justify-center
        ${
          disabled
            ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
            : muted
              ? 'bg-[#1E1E1E] text-[#FF6B6B] hover:bg-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]'
              : 'bg-[#1E1E1E] text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#818CF8]'
        }
      `}
      aria-label={muted ? 'Unmute' : 'Mute'}
      aria-pressed={muted}
    >
      {muted ? (
        // Muted icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
      ) : (
        // Unmuted icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
    </button>
  )
}
