interface ProgressBarProps {
  /** 진행률 (0-100) */
  progress: number
  /** 현재 단계 텍스트 */
  stage: string
  /** 취소 콜백 */
  onCancel: () => void
}

/**
 * YouTube 변환 진행률 표시 컴포넌트
 *
 * 수평 진행률 바, 퍼센트 텍스트, 현재 단계, 취소 버튼을 표시합니다.
 */
export function ProgressBar({ progress, stage, onCancel }: ProgressBarProps) {
  return (
    <div className="space-y-3" data-testid="youtube-progress-bar">
      {/* 진행률 바 */}
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="변환 진행률"
        />
      </div>

      {/* 상태 정보 및 취소 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 로딩 스피너 */}
          <svg
            className="w-4 h-4 text-blue-500 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>

          <span className="text-sm text-zinc-300">{stage}</span>
          <span className="text-sm text-zinc-500">{Math.round(progress)}%</span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="변환 취소"
          data-testid="youtube-cancel-button"
        >
          취소
        </button>
      </div>
    </div>
  )
}
