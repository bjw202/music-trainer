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
        p-2 rounded transition-colors
        ${
          disabled
            ? 'text-[#5a5a5a] cursor-not-allowed'
            : muted
              ? 'text-[#ff3b30] hover:text-[#ff3b30]/80 focus:outline-none focus:ring-2 focus:ring-[#ff3b30]'
              : 'text-[#a0a0a0] hover:text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-[#007aff]'
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
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.03V12zM4.27 3L3 4.27l9 9v-4L7 9v6L3 4.27 3 13.73l-3-3L21 21l-3-3-3 3L4.27 21l3-3z" />
        </svg>
      ) : (
        // Unmuted icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M3 9v6h4l5 5V4L7 9v6H3zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.03V12zM19 12c0 .82-.68 1.5-1.5 1.5-.82 0-1.5-.68-1.5-1.5.68 0 1.5.67 1.5 1.5z" />
        </svg>
      )}
    </button>
  )
}
