import { useControlStore } from '../../stores/controlStore'
import { SpeedControl } from './SpeedControl'
import { PitchControl } from './PitchControl'

interface SpeedPitchPanelProps {
  disabled?: boolean
}

/**
 * 속도/피치 패널 컴포넌트
 *
 * SpeedControl과 PitchControl을 래핑하고 리셋 버튼을 제공합니다.
 */
export function SpeedPitchPanel({ disabled = false }: SpeedPitchPanelProps) {
  const speed = useControlStore((state) => state.speed)
  const pitch = useControlStore((state) => state.pitch)
  const setSpeed = useControlStore((state) => state.setSpeed)
  const setPitch = useControlStore((state) => state.setPitch)
  const resetSpeedPitch = useControlStore((state) => state.resetSpeedPitch)

  const isDefault = speed === 1.0 && pitch === 0

  return (
    <div data-testid="speed-pitch-panel" className="space-y-3">
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-4 space-y-3">
        <SpeedControl
          speed={speed}
          onSpeedChange={setSpeed}
          disabled={disabled}
        />
        <PitchControl
          pitch={pitch}
          onPitchChange={setPitch}
          disabled={disabled}
        />
        <div className="flex justify-end">
          <button
            data-testid="speed-pitch-reset"
            onClick={resetSpeedPitch}
            disabled={disabled || isDefault}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
              ${
                disabled || isDefault
                  ? 'bg-[#1E1E1E] text-[#4B5563] cursor-not-allowed'
                  : 'bg-[#1E1E1E] text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#2A2A2A]'
              }
            `}
            aria-label="Reset speed and pitch"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
