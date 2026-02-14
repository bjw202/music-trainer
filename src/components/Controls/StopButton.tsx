interface StopButtonProps {
  onStop: () => void
  disabled?: boolean
}

/**
 * 정지 버튼 컴포넌트
 *
 * 재생을 정지하고 위치를 0으로 초기화합니다.
 */
export function StopButton({ onStop, disabled = false }: StopButtonProps) {
  return (
    <button
      onClick={onStop}
      disabled={disabled}
      className={`
        p-4 rounded-full transition-colors
        ${
          disabled
            ? 'text-[#5a5a5a] cursor-not-allowed'
            : 'text-[#e0e0e0] hover:text-[#ff3b30] focus:outline-none focus:ring-2 focus:ring-[#ff3b30]'
        }
      `}
      aria-label="Stop"
      data-testid="stop-button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M6 6h12v12H6z" />
      </svg>
    </button>
  )
}
