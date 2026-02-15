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

  // 버튼 텍스트 결정
  const getButtonText = (): string => {
    if (separationStatus === 'completed') {
      return 'Open Stem Mixer'
    }
    return 'Separate Stems'
  }

  // 버튼 스타일 결정
  const buttonStyle = separationStatus === 'completed'
    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white hover:from-[#7C3AED] hover:to-[#4F46E5]'
    : 'bg-[#2A2A2A] text-[#F5F5F5] hover:bg-[#3A3A3A]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      data-testid="separate-button"
      className={`
        px-6 py-3 rounded-xl font-medium transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${buttonStyle}
      `}
      aria-label={getButtonText()}
    >
      {getButtonText()}
    </button>
  )
}
