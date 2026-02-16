import { useMemo } from 'react'
import { StemTrack } from './StemTrack'
import { useStemStore, StemName } from '../../stores/stemStore'

/**
 * StemMixerPanel 컴포넌트 props
 */
export interface StemMixerPanelProps {
  /** 비활성화 여부 */
  disabled?: boolean
}

/**
 * StemMixerPanel 컴포넌트
 *
 * 4개의 StemTrack을 표시하고 전체 리셋 기능을 제공합니다.
 * Logic Pro 스타일의 다크 테마 디자인입니다.
 */
export function StemMixerPanel({ disabled = false }: StemMixerPanelProps) {
  const gains = useStemStore((state) => state.gains)
  const muted = useStemStore((state) => state.muted)
  const solo = useStemStore((state) => state.solo)
  const setGain = useStemStore((state) => state.setGain)
  const toggleMute = useStemStore((state) => state.toggleMute)
  const toggleSolo = useStemStore((state) => state.toggleSolo)
  const resetMixer = useStemStore((state) => state.resetMixer)

  // Stem 이름 목록
  const stemNames: StemName[] = useMemo(() => ['vocals', 'drums', 'bass', 'other'], [])

  /**
   * 리셋 핸들러
   * 모든 볼륨을 100%로, 음소거/솔로를 해제합니다.
   */
  const handleReset = () => {
    resetMixer()
  }

  /**
   * Reset 버튼 표시 여부 (변경이 있으면 true)
   */
  const hasChanges = useMemo(() => {
    const defaultGain = 1.0
    const defaultMuted = false
    const defaultSolo = false

    return stemNames.some(
      (stemName) =>
        gains[stemName] !== defaultGain ||
        muted[stemName] !== defaultMuted ||
        solo[stemName] !== defaultSolo
    )
  }, [gains, muted, solo, stemNames])

  return (
    <div className="space-y-4" data-testid="stem-mixer-panel">
      {/* 헤더: 리셋 버튼 */}
      <div className="flex items-center justify-end px-2">
        {hasChanges && (
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="
              px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[#2A2A2A] text-[#9CA3AF]
              hover:bg-[#3A3A3A] hover:text-[#F5F5F5]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            aria-label="Reset all mixer settings"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Stem 트랙 목록 */}
      <div className="space-y-2">
        {stemNames.map((stemName) => (
          <StemTrack
            key={stemName}
            stemName={stemName}
            gain={gains[stemName]}
            muted={muted[stemName]}
            solo={solo[stemName]}
            onGainChange={setGain}
            onMuteToggle={toggleMute}
            onSoloToggle={toggleSolo}
            disabled={disabled}
          />
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 px-2 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#6B7280]">M:</span>
          <span className="text-xs text-[#9CA3AF]">Mute</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#6B7280]">S:</span>
          <span className="text-xs text-[#9CA3AF]">Solo</span>
        </div>
      </div>
    </div>
  )
}
