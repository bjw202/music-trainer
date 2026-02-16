import { formatTime } from '../../utils/timeUtils'

interface ABLoopControlsProps {
  loopA: number | null
  loopB: number | null
  loopEnabled: boolean
  onSetLoopA: () => void
  onSetLoopB: () => void
  onToggleLoop: () => void
  disabled?: boolean
}

/**
 * A-B 루프 컨트롤 컴포넌트
 *
 * A 지점, B 지점 설정 및 루프 토글을 제공합니다.
 */
export function ABLoopControls({
  loopA,
  loopB,
  loopEnabled,
  onSetLoopA,
  onSetLoopB,
  onToggleLoop,
  disabled = false,
}: ABLoopControlsProps) {
  return (
    <>
      {/* A 지점 설정 버튼 */}
      <button
        onClick={onSetLoopA}
        disabled={disabled}
        className={`
          p-4 rounded-xl transition-colors flex flex-col items-center gap-2
          ${
            disabled
              ? 'bg-[#141414] text-[#4B5563] cursor-not-allowed border border-[#1E1E1E]'
              : loopA !== null
                ? 'bg-[#141414] text-[#FF6B35] border-2 border-[#FF6B35]'
                : 'bg-[#141414] text-[#9CA3AF] border border-[#1E1E1E] hover:border-[#FF6B35]/50'
          }
        `}
        aria-label="Set loop point A"
        aria-pressed={loopA !== null}
      >
        <span className="text-lg font-bold">A</span>
        {loopA !== null && (
          <span className="text-xs font-mono text-[#6B7280]">
            {formatTime(loopA)}
          </span>
        )}
      </button>

      {/* B 지점 설정 버튼 */}
      <button
        onClick={onSetLoopB}
        disabled={disabled}
        className={`
          p-4 rounded-xl transition-colors flex flex-col items-center gap-2
          ${
            disabled
              ? 'bg-[#141414] text-[#4B5563] cursor-not-allowed border border-[#1E1E1E]'
              : loopB !== null
                ? 'bg-[#141414] text-[#60A5FA] border-2 border-[#60A5FA]'
                : 'bg-[#141414] text-[#9CA3AF] border border-[#1E1E1E] hover:border-[#60A5FA]/50'
          }
        `}
        aria-label="Set loop point B"
        aria-pressed={loopB !== null}
      >
        <span className="text-lg font-bold">B</span>
        {loopB !== null && (
          <span className="text-xs font-mono text-[#6B7280]">
            {formatTime(loopB)}
          </span>
        )}
      </button>

      {/* 루프 토글 버튼 */}
      <button
        onClick={onToggleLoop}
        disabled={disabled || loopA === null || loopB === null}
        className={`
          p-4 rounded-xl transition-colors flex flex-col items-center gap-2
          ${
            disabled || loopA === null || loopB === null
              ? 'bg-[#141414] text-[#4B5563] cursor-not-allowed border border-[#1E1E1E]'
              : loopEnabled
                ? 'bg-[#34D399]/20 text-[#34D399] border-2 border-[#34D399]'
                : 'bg-[#141414] text-[#9CA3AF] border border-[#1E1E1E] hover:border-[#34D399]/50'
          }
        `}
        aria-label="Toggle loop"
        aria-pressed={loopEnabled}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="text-xs font-semibold">
          {loopEnabled ? 'Loop ON' : 'Loop OFF'}
        </span>
      </button>
    </>
  )
}
