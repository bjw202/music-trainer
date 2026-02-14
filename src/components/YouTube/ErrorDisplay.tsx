interface ErrorDisplayProps {
  /** 에러 메시지 */
  message: string
  /** 다시 시도 콜백 */
  onRetry: () => void
}

/**
 * YouTube 변환 에러 표시 컴포넌트
 *
 * 에러 메시지와 재시도 버튼을 표시합니다.
 */
export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
      role="alert"
      data-testid="youtube-error"
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* 에러 아이콘 */}
        <svg
          className="w-4 h-4 text-red-400 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>

        <span className="text-sm text-red-400 truncate">{message}</span>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-red-400 hover:text-red-300 font-medium whitespace-nowrap transition-colors"
        aria-label="다시 시도"
        data-testid="youtube-retry-button"
      >
        다시 시도
      </button>
    </div>
  )
}
