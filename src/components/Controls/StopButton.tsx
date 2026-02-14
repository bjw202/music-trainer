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
        w-12 h-12 rounded-xl transition-colors flex items-center justify-center
        ${
          disabled
            ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
            : 'bg-[#1E1E1E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#818CF8]'
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
