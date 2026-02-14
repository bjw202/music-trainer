import { loopStore } from '../../stores/loopStore'

/**
 * A-B 루프 상태 디스플레이 컴포넌트
 *
 * 현재 루프 설정 상태를 시각적으로 표시합니다.
 */
export function ABLoopDisplay() {
  const { loopA, loopB, loopEnabled } = loopStore()

  if (loopA === null || loopB === null) {
    return null
  }

  return (
    <div
      data-testid="loop-display"
      className={`
        px-3 py-1 rounded text-sm font-mono
        ${
          loopEnabled
            ? 'bg-[#34c759]/20 text-[#34c759]'
            : 'bg-[#2a2a2a] text-[#a0a0a0]'
        }
      `}
      aria-label={`Loop from ${loopA}s to ${loopB}s ${loopEnabled ? 'enabled' : 'disabled'}`}
    >
      A-B Loop {loopEnabled ? 'ON' : 'OFF'}
    </div>
  )
}
