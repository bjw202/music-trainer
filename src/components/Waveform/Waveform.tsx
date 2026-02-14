interface WaveformProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  hasAudio: boolean
}

/**
 * 웨이브폼 컴포넌트
 *
 * 오디오 웨이브폼을 렌더링합니다.
 */
export function Waveform({ containerRef, hasAudio }: WaveformProps) {
  return (
    <div
      ref={containerRef}
      data-testid="waveform-container"
      className={`
        w-full h-32 rounded-lg mb-6
        ${hasAudio ? 'bg-[#2a2a2a]' : 'bg-[#1a1a1a]'}
      `}
      role="img"
      aria-label={hasAudio ? 'Audio waveform' : 'No audio loaded'}
    />
  )
}
