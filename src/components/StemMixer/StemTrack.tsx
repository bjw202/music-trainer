import React from 'react'
import { Mic, Guitar } from 'lucide-react'
import { StemName, STEM_COLORS, STEM_DISPLAY_NAMES } from '../../stores/stemStore'

/**
 * 커스텀 드럼 아이콘 (lucide에 drum 아이콘 없음)
 */
function DrumIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M2 12h20" />
      <path d="M4 12v4a8 4 0 0 0 16 0v-4" />
      <path d="M4 12V8a8 4 0 0 1 16 0v4" />
      <path d="M8 8v8" />
      <path d="M16 8v8" />
    </svg>
  )
}

/**
 * Stem 아이콘 렌더러
 */
function StemIcon({ stemName, className }: { stemName: StemName; className?: string }) {
  const color = STEM_COLORS[stemName]
  const iconStyle = { color }

  switch (stemName) {
    case 'vocals':
      return <Mic className={className} style={iconStyle} aria-hidden="true" />
    case 'drums':
      return <DrumIcon className={className} style={iconStyle} />
    case 'bass':
    case 'other':
      return <Guitar className={className} style={iconStyle} aria-hidden="true" />
  }
}

/**
 * StemTrack 컴포넌트 props
 */
export interface StemTrackProps {
  /** Stem 이름 */
  stemName: StemName
  /** 현재 게인 (0-1) */
  gain: number
  /** 음소거 상태 */
  muted: boolean
  /** 솔로 상태 */
  solo: boolean
  /** 게인 변경 핸들러 */
  onGainChange: (stemName: StemName, gain: number) => void
  /** 음소거 토글 핸들러 */
  onMuteToggle: (stemName: StemName) => void
  /** 솔로 토글 핸들러 */
  onSoloToggle: (stemName: StemName) => void
  /** 비활성화 여부 */
  disabled?: boolean
}

/**
 * StemTrack 컴포넌트
 *
 * 개별 스템의 볼륨, 음소거, 솔로를 제어합니다.
 */
export function StemTrack({
  stemName,
  gain,
  muted,
  solo,
  onGainChange,
  onMuteToggle,
  onSoloToggle,
  disabled = false,
}: StemTrackProps) {
  const displayName = STEM_DISPLAY_NAMES[stemName]
  const color = STEM_COLORS[stemName]
  const gainPercent = Math.round(gain * 100)

  /**
   * 슬라이더 변경 핸들러
   */
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGain = parseInt(e.target.value, 10) / 100
    onGainChange(stemName, newGain)
  }

  return (
    <div
      data-testid={`stem-track-${stemName}`}
      className={`
        flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]
        transition-all duration-200
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
      style={{
        borderColor: solo ? color : undefined,
        boxShadow: solo ? `0 0 12px ${color}40` : undefined,
      }}
    >
      {/* Stem 아이콘 및 이름 */}
      <div className="flex items-center gap-2 min-w-[80px]">
        <StemIcon stemName={stemName} className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium text-[#F5F5F5]">
          {displayName}
        </span>
      </div>

      {/* 볼륨 슬라이더 */}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={gainPercent}
          onChange={handleSliderChange}
          disabled={disabled}
          data-testid={`stem-volume-${stemName}`}
          className={`
            flex-1 h-1.5 rounded-full appearance-none cursor-pointer
            disabled:cursor-not-allowed disabled:opacity-50
            ${muted ? 'opacity-50' : ''}
          `}
          style={{
            background: `linear-gradient(to right, ${color} ${gainPercent}%, #2A2A2A ${gainPercent}%)`,
          }}
          aria-label={`${displayName} volume`}
        />
        <span data-testid={`stem-volume-display-${stemName}`} className="text-xs font-mono text-[#9CA3AF] w-10 text-right">
          {gainPercent}%
        </span>
      </div>

      {/* Mute 버튼 */}
      <button
        type="button"
        onClick={() => onMuteToggle(stemName)}
        disabled={disabled}
        data-testid={`stem-mute-${stemName}`}
        data-active={muted}
        className={`
          px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
          ${muted
            ? 'bg-[#EF4444] text-white'
            : 'bg-[#2A2A2A] text-[#9CA3AF] hover:bg-[#3A3A3A]'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={`${displayName} mute`}
        aria-pressed={muted}
      >
        M
      </button>

      {/* Solo 버튼 */}
      <button
        type="button"
        onClick={() => onSoloToggle(stemName)}
        disabled={disabled}
        data-testid={`stem-solo-${stemName}`}
        data-active={solo}
        className={`
          px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
          ${solo
            ? 'text-white'
            : 'bg-[#2A2A2A] text-[#9CA3AF] hover:bg-[#3A3A3A]'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        style={{
          backgroundColor: solo ? color : undefined,
        }}
        aria-label={`${displayName} solo`}
        aria-pressed={solo}
      >
        S
      </button>
    </div>
  )
}
