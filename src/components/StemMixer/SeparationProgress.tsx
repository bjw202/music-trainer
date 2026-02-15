import React from 'react'
import { SeparationStatus } from '../../stores/stemStore'

/**
 * SeparationProgress 컴포넌트 props
 */
export interface SeparationProgressProps {
  /** 현재 분리 상태 */
  status: SeparationStatus
  /** 진행률 (0-100) */
  progress: number
  /** 에러 메시지 */
  errorMessage: string | null
  /** 취소 핸들러 */
  onCancel?: () => void
  /** 재시도 핸들러 */
  onRetry?: () => void
}

/**
 * 상태별 메시지 맵
 */
const STATUS_MESSAGES: Record<SeparationStatus, string> = {
  idle: '',
  uploading: '파일 업로드 중...',
  processing: '음원 분리 중...',
  completed: '분리 완료!',
  failed: '분리 실패',
}

/**
 * 상태별 아이콘 컴포넌트
 */
function StatusIcon({ status }: { status: SeparationStatus }) {
  switch (status) {
    case 'processing':
    case 'uploading':
      return (
        <svg
          className="w-5 h-5 text-blue-500 animate-spin"
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
      )

    case 'completed':
      return (
        <svg
          className="w-5 h-5 text-green-500"
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
            d="M5 13l4 4L19 7"
          />
        </svg>
      )

    case 'failed':
      return (
        <svg
          className="w-5 h-5 text-red-500"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )

    default:
      return null
  }
}

/**
 * SeparationProgress 컴포넌트
 *
 * 음원 분리 진행률과 상태를 표시합니다.
 *
 * SPEC-STEM-001 REQ-STEM-001:
 * - 분리 작업 진행 시 실시간 진행률을 0%에서 100%까지 표시
 * - 에러 발생 시 메시지 표시 및 재시도 옵션 제공
 */
export function SeparationProgress({
  status,
  progress,
  errorMessage,
  onCancel,
  onRetry,
}: SeparationProgressProps) {
  // 진행 중 상태인지만 표시
  const isActive = status === 'uploading' || status === 'processing'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  if (!isActive && !isCompleted && !isFailed) {
    return null
  }

  const message = STATUS_MESSAGES[status]
  const displayProgress = Math.max(0, Math.min(100, progress))

  return (
    <div
      className="space-y-3 p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]"
      data-testid="separation-progress"
    >
      {/* 헤더: 상태 아이콘 + 메시지 + 진행률 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span className="text-sm font-medium text-[#F5F5F5]">
            {message}
          </span>
        </div>

        <span className="text-sm font-mono text-[#9CA3AF]">
          {Math.round(displayProgress)}%
        </span>
      </div>

      {/* 진행률 바 */}
      {isActive && (
        <div className="w-full h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
            role="progressbar"
            aria-valuenow={displayProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="음원 분리 진행률"
          />
        </div>
      )}

      {/* 에러 메시지 */}
      {isFailed && errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* 완료 메시지 */}
      {isCompleted && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">
            스템 믹서 모드로 전환되었습니다.
          </p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-end gap-2">
        {isActive && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#2A2A2A] transition-colors"
            aria-label="분리 취소"
          >
            취소
          </button>
        )}

        {isFailed && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            aria-label="재시도"
          >
            재시도
          </button>
        )}
      </div>
    </div>
  )
}
