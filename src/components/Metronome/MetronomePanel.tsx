/**
 * MetronomePanel 컴포넌트
 *
 * BPM 분석 및 메트로놈 제어 UI
 * Logic Pro 스타일 다크 테마 (#1A1A1A, #FF6B35 accent)
 */

import { useCallback } from 'react'
import { Loader2, Music } from 'lucide-react'
import { useBpmStore } from '@/stores/bpmStore'
import { METRONOME } from '@/utils/constants'

/**
 * MetronomePanel Props
 */
export interface MetronomePanelProps {
  /** 전체 패널 비활성화 여부 */
  disabled: boolean
  /** 분석할 오디오 파일 */
  file: File | null
}

/**
 * 메트로놈 패널 컴포넌트
 */
export function MetronomePanel({ disabled, file }: MetronomePanelProps) {
  // bpmStore 상태 구독
  const bpm = useBpmStore((state) => state.bpm)
  const confidence = useBpmStore((state) => state.confidence)
  const isAnalyzing = useBpmStore((state) => state.isAnalyzing)
  const analysisError = useBpmStore((state) => state.analysisError)
  const metronomeEnabled = useBpmStore((state) => state.metronomeEnabled)
  const metronomeVolume = useBpmStore((state) => state.metronomeVolume)
  const toggleMetronome = useBpmStore((state) => state.toggleMetronome)
  const setMetronomeVolume = useBpmStore((state) => state.setMetronomeVolume)
  const analyzeBpm = useBpmStore((state) => state.analyzeBpm)

  /**
   * BPM 분석 실행
   */
  const handleAnalyze = useCallback(async () => {
    if (!file || isAnalyzing) {
      return
    }

    try {
      await analyzeBpm(file)
    } catch (error) {
      console.error('[MetronomePanel] BPM analysis failed:', error)
    }
  }, [file, isAnalyzing, analyzeBpm])

  /**
   * 볼륨 변경 핸들러
   */
  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10)
      setMetronomeVolume(value)
    },
    [setMetronomeVolume]
  )

  /**
   * BPM 표시값 포맷팅
   */
  const displayBpm = bpm !== null ? Math.round(bpm) : '—'

  /**
   * 신뢰도 표시값 포맷팅
   */
  const displayConfidence = confidence !== null ? `${Math.round(confidence * 100)}%` : null

  return (
    <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-4 space-y-4">
      {/* 헤더: BPM 표시 + 분석 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 큰 BPM 숫자 */}
          <div className="text-4xl font-mono font-bold text-[#F5F5F5] min-w-[80px] text-center">
            {displayBpm}
          </div>
          <div className="text-sm text-[#9CA3AF]">
            <div>BPM</div>
            {displayConfidence && (
              <div className="text-[#6B7280]">신뢰도: {displayConfidence}</div>
            )}
          </div>
        </div>

        {/* 분석 버튼 */}
        <button
          onClick={handleAnalyze}
          disabled={!file || isAnalyzing}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${
              !file || isAnalyzing
                ? 'bg-[#2A2A2A] text-[#6B7280] cursor-not-allowed'
                : 'bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90'
            }
          `}
          aria-label="BPM 분석"
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              분석 중
            </span>
          ) : (
            '분석'
          )}
        </button>
      </div>

      {/* 에러 메시지 */}
      {analysisError && (
        <div className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
          {analysisError}
        </div>
      )}

      {/* 메트로놈 컨트롤 */}
      <div className="flex items-center gap-4">
        {/* 토글 버튼 */}
        <button
          onClick={toggleMetronome}
          disabled={disabled || bpm === null}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors
            ${
              disabled || bpm === null
                ? 'bg-[#2A2A2A] text-[#6B7280] cursor-not-allowed'
                : metronomeEnabled
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-[#2A2A2A] text-[#F5F5F5] hover:bg-[#3A3A3A]'
            }
          `}
          aria-label="메트로놈 토글"
        >
          <Music className="w-4 h-4" />
          {metronomeEnabled ? 'ON' : 'OFF'}
        </button>

        {/* 볼륨 슬라이더 */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-[#6B7280]">볼륨</span>
          <input
            type="range"
            min={METRONOME.MIN_VOLUME}
            max={METRONOME.MAX_VOLUME}
            value={metronomeVolume}
            onChange={handleVolumeChange}
            disabled={disabled || !metronomeEnabled}
            className="
              flex-1 h-1 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-[#FF6B35]
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
            "
            aria-label="메트로놈 볼륨"
          />
          <span className="text-xs text-[#9CA3AF] w-8 text-right">{metronomeVolume}%</span>
        </div>
      </div>
    </div>
  )
}
