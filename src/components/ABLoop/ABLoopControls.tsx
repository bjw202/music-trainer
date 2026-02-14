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
    <div className="flex items-center gap-3">
      {/* A 지점 설정 버튼 */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onSetLoopA}
          disabled={disabled}
          className={`
            px-4 py-2 rounded font-mono transition-colors
            ${
              disabled
                ? 'bg-[#2a2a2a] text-[#5a5a5a] cursor-not-allowed'
                : loopA !== null
                  ? 'bg-[#007aff] text-white'
                  : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
            }
          `}
          aria-label="Set loop point A"
          aria-pressed={loopA !== null}
        >
          A
        </button>
        {loopA !== null && (
          <span className="text-xs text-[#a0a0a0] font-mono">
            {formatTime(loopA)}
          </span>
        )}
      </div>

      {/* B 지점 설정 버튼 */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onSetLoopB}
          disabled={disabled}
          className={`
            px-4 py-2 rounded font-mono transition-colors
            ${
              disabled
                ? 'bg-[#2a2a2a] text-[#5a5a5a] cursor-not-allowed'
                : loopB !== null
                  ? 'bg-[#007aff] text-white'
                  : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
            }
          `}
          aria-label="Set loop point B"
          aria-pressed={loopB !== null}
        >
          B
        </button>
        {loopB !== null && (
          <span className="text-xs text-[#a0a0a0] font-mono">
            {formatTime(loopB)}
          </span>
        )}
      </div>

      {/* 루프 토글 버튼 */}
      <button
        onClick={onToggleLoop}
        disabled={disabled || loopA === null || loopB === null}
        className={`
          px-4 py-2 rounded font-mono transition-colors
          ${
            disabled || loopA === null || loopB === null
              ? 'bg-[#2a2a2a] text-[#5a5a5a] cursor-not-allowed'
              : loopEnabled
                ? 'bg-[#34c759] text-white hover:bg-[#34c759]/80'
                : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
          }
        `}
        aria-label="Toggle loop"
        aria-pressed={loopEnabled}
      >
        LOOP
      </button>
    </div>
  )
}
