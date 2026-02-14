import { loopStore } from '../../stores/loopStore'

/**
 * A-B 루프 상태 디스플레이 컴포넌트
 *
 * 현재 루프 설정 상태를 시각적으로 표시합니다.
 */
export function ABLoopDisplay() {
  const { loopA, loopB, loopEnabled } = loopStore()

  if (loopA === null || loopB === null) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] rounded-lg"
        data-testid="loop-display"
      >
        <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
        <span className="text-xs font-medium text-[#6B7280]">Inactive</span>
      </div>
    )
  }

  return (
    <div
      data-testid="loop-display"
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        ${
          loopEnabled
            ? 'bg-[#34D399]/20 text-[#34D399]'
            : 'bg-[#1A1A1A] text-[#6B7280]'
        }
      `}
      aria-label={`Loop from ${loopA}s to ${loopB}s ${loopEnabled ? 'enabled' : 'disabled'}`}
    >
      <div
        className={`w-2 h-2 rounded-full ${loopEnabled ? 'bg-[#34D399]' : 'bg-[#6B7280]'}`}
      />
      <span className="text-xs font-medium">
        {loopEnabled ? 'Active' : 'Inactive'}
      </span>
    </div>
  )
}
