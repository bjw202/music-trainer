interface WaveformProps {
  containerRef?: React.RefObject<HTMLDivElement | null>
  setContainerRef?: (node: HTMLDivElement | null) => void
  hasAudio: boolean
}

/**
 * 웨이브폼 컴포넌트
 *
 * 오디오 웨이브폼을 렌더링합니다.
 */
export function Waveform({ containerRef, setContainerRef, hasAudio }: WaveformProps) {
  // ref 콜백을 우선 사용 (WaveSurfer 초기화를 위해)
  const refCallback = (node: HTMLDivElement | null) => {
    if (setContainerRef) {
      setContainerRef(node)
    } else if (containerRef && 'current' in containerRef) {
      containerRef.current = node
    }
  }

  return (
    <div
      ref={refCallback}
      data-testid="waveform-container"
      className={`
        w-full h-[140px] rounded-2xl border border-[#1E1E1E] bg-[#141414]
      `}
      role="img"
      aria-label={hasAudio ? 'Audio waveform' : 'No audio loaded'}
    />
  )
}
