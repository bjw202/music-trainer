import { useRef, useEffect, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useAudioStore } from '../stores/audioStore'

interface UseWaveformOptions {
  onSeek?: (time: number) => void
}

/**
 * 웨이브폼 렌더링 훅
 */
export function useWaveform(options: UseWaveformOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveSurferRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)
  const buffer = useAudioStore((state) => state.buffer)
  const { onSeek } = options

  // onSeek을 ref로 저장하여 항상 최신 콜백을 참조
  const onSeekRef = useRef(onSeek)
  useEffect(() => {
    onSeekRef.current = onSeek
  }, [onSeek])

  /**
   * container ref 콜백 - DOM 요소가 마운트될 때 호출됨
   */
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node

    // 이미 초기화된 경우 무시
    if (waveSurferRef.current) {
      return
    }

    // DOM 노드가 없으면 무시
    if (!node) {
      return
    }

    console.log('[useWaveform] Container mounted, initializing WaveSurfer...')

    // Regions 플러그인 생성
    const regions = RegionsPlugin.create()
    regionsRef.current = regions

    const waveSurfer = WaveSurfer.create({
      container: node,
      waveColor: '#4a4a4a',
      progressColor: '#007aff',
      cursorColor: '#007aff',
      barWidth: 2,
      barGap: 1,
      barRadius: 0,
      height: 128,
      normalize: true,
      minPxPerSec: 0,
      hideScrollbar: true,
      autoScroll: false,
      interact: true,
      plugins: [regions],
    })

    // 파형 클릭 시 onSeek 콜백 호출 (ref를 사용하여 항상 최신 콜백 참조)
    waveSurfer.on('interaction', (newTime: number) => {
      console.log('[useWaveform] Interaction at time:', newTime)
      onSeekRef.current?.(newTime)
    })

    waveSurferRef.current = waveSurfer
    console.log('[useWaveform] WaveSurfer initialized successfully')
  }, []) // 의존성 제거 - ref를 사용하므로 재생성 불필요

  /**
   * 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        console.log('[useWaveform] Destroying WaveSurfer')
        waveSurferRef.current.destroy()
        waveSurferRef.current = null
        regionsRef.current = null
      }
    }
  }, [])

  /**
   * 오디오 버퍼 로딩 시 웨이브폼 업데이트
   */
  useEffect(() => {
    const waveSurfer = waveSurferRef.current
    if (!waveSurfer || !buffer) {
      return
    }

    // AudioBuffer를 WAV 형식으로 변환하여 로딩
    const loadWaveform = async () => {
      try {
        const wavBlob = await audioBufferToWav(buffer)
        await waveSurfer.loadBlob(wavBlob)
      } catch (error) {
        console.error('Failed to load waveform:', error)
      }
    }

    loadWaveform()
  }, [buffer])

  /**
   * 현재 시간 설정 (탐색)
   */
  const setCurrentTime = useCallback((time: number) => {
    const waveSurfer = waveSurferRef.current
    if (!waveSurfer) {
      return
    }
    const duration = waveSurfer.getDuration()
    if (duration <= 0) {
      return // 로딩 전 호출 방지
    }
    waveSurfer.seekTo(time / duration)
  }, [])

  /**
   * 루프 영역 설정
   */
  const setLoopRegion = useCallback((loopA: number | null, loopB: number | null, loopEnabled: boolean) => {
    const regions = regionsRef.current
    if (!regions) return

    // 기존 루프 영역 제거
    regions.clearRegions()

    // A와 B가 모두 설정된 경우에만 영역 표시
    if (loopA === null || loopB === null) return

    const start = Math.min(loopA, loopB)
    const end = Math.max(loopA, loopB)

    // 루프 활성화 여부에 따라 색상 변경
    const color = loopEnabled ? 'rgba(129, 140, 248, 0.25)' : 'rgba(129, 140, 248, 0.12)'

    regions.addRegion({
      id: 'ab-loop',
      start,
      end,
      color,
      drag: false,
      resize: false,
    })
  }, [])

  return {
    containerRef,
    setContainerRef,
    setCurrentTime,
    setLoopRegion,
  }
}

/**
 * AudioBuffer를 WAV Blob으로 변환하는 유틸리티 함수
 */
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels
  const length = buffer.length * numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // WAV 헤더 작성
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

  // RIFF identifier
  setUint32(0x46464952) // 'RIFF'
  // file length
  setUint32(length - 8)
  // RIFF type
  setUint32(0x45564157) // 'WAVE'

  // format chunk identifier
  setUint32(0x20746d66) // 'fmt '
  // format chunk length
  setUint32(16)
  // sample format (raw)
  setUint16(1)
  // channel count
  setUint16(numberOfChannels)
  // sample rate
  setUint32(buffer.sampleRate)
  // byte rate (sample rate * block align)
  setUint32(buffer.sampleRate * 2 * numberOfChannels)
  // block align (channel count * bytes per sample)
  setUint16(numberOfChannels * 2)
  // bits per sample
  setUint16(16)

  // data chunk identifier
  setUint32(0x61746164) // 'data'
  // data chunk length
  setUint32(length - pos - 4)

  // 채널 데이터 수집
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  // 인터리브 데이터 작성
  while (offset < buffer.length) {
    for (let i = 0; i < numberOfChannels; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i][offset]))
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      pos += 2
    }
    offset++
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
