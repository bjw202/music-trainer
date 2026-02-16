import { Scissors, SlidersHorizontal } from 'lucide-react'
import { useStemStore } from '../../stores/stemStore'
import { useAudioStore } from '../../stores/audioStore'

/**
 * SeparationButton 컴포넌트 props
 */
export interface SeparationButtonProps {
  /** 클릭 핸들러 */
  onClick: () => void
  /** 비활성화 여부 */
  disabled?: boolean
}

/**
 * SeparationButton 컴포넌트
 *
 * Stem 분리를 시작하거나 Stem Mixer 모드로 전환하는 버튼입니다.
 * - 오디오가 로드되지 않았으면 비활성화
 * - 분리 완료 후 "Open Stem Mixer" 표시
 * - 분리 중일 때 비활성화
 */
export function SeparationButton({ onClick, disabled = false }: SeparationButtonProps) {
  const buffer = useAudioStore((state) => state.buffer)
  const separationStatus = useStemStore((state) => state.separationStatus)

  // 오디오가 로드되지 않았으면 비활성화
  const isDisabled = disabled || !buffer || separationStatus === 'processing' || separationStatus === 'uploading'

  const isCompleted = separationStatus === 'completed'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      data-testid="separate-button"
      className={`
        w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isCompleted
          ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white hover:from-[#7C3AED] hover:to-[#4F46E5]'
          : 'bg-[#2D2D2D] border-2 border-[#FF6B35] text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white'
        }
      `}
      aria-label={isCompleted ? 'Open Stem Mixer' : 'Separate Stems'}
    >
      {isCompleted ? (
        <>
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Open Stem Mixer
        </>
      ) : (
        <>
          <Scissors className="w-4 h-4" aria-hidden="true" />
          Separate Stems
        </>
      )}
    </button>
  )
}
