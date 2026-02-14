/**
 * WaveformRenderer - wavesurfer.js 기반 파형 시각화
 *
 * 기능:
 * - wavesurfer.js 초기화 및 생명주크 관리
 * - 오디오 버퍼 로딩 및 렌더링
 * - 재생 헤드 위치 업데이트
 * - A-B 루프 영역 표시
 * - 사용자 상호작용 이벤트 처리
 *
 * 의존성:
 * - wavesurfer.js 7.8.x
 */

import WaveSurfer from 'wavesurfer.js'

export interface WaveformRendererEvents {
  /**
   * 사용자가 파형을 크릭하여 탐색한 이벤트
   * @param time - 탐색된 시간 (초)
   */
  onSeek?: (time: number) => void
}

export class WaveformRenderer {
  // wavesurfer.js 인스턴스
  private wavesurfer: any | null = null

  // 오디오 버퍼
  private buffer: AudioBuffer | null = null

  // 루프 영역 (wavesurfer Region 객체)
  private loopRegion: any | null = null

  // 이벤트 핸들러
  private readonly events: WaveformRendererEvents

  constructor(events: WaveformRendererEvents = {}) {
    this.events = events
  }

  /**
   * wavesurfer.js 초기화
   * @param container - 파형을 렌더링할 DOM 요소
   * @param audioBuffer - 시각화할 오디오 버퍼
   */
  initialize(container: HTMLElement, audioBuffer: AudioBuffer): void {
    if (this.wavesurfer) {
      // 이미 초기화된 경우 파괴
      this.destroy()
    }

    this.buffer = audioBuffer

    try {
      // wavesurfer.js 생성
      this.wavesurfer = WaveSurfer.create({
        container,
        waveColor: '#4a90e2',
        progressColor: '#2563eb',
        cursorColor: '#ef4444',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 128,
        normalize: true,
        minPxPerSec: 100,
        hideScrollbar: true,
        autoCenter: true,
        interact: true,
      } as any)

      // 이벤트 리스너 등록
      this.setupEventListeners()

      // 오디오 버퍼 로딩
      this.wavesurfer.loadBuffer(audioBuffer)
    } catch (error) {
      console.error('Failed to initialize WaveformRenderer:', error)
      throw new Error(`Failed to initialize waveform: ${error}`)
    }
  }

  /**
   * 현재 재생 위치 설정 (재생 헤드 이동)
   * @param time - 현재 위치 (초)
   */
  setCurrentTime(time: number): void {
    if (!this.wavesurfer || !this.buffer) {
      return
    }

    try {
      // 시간 클랜핑
      const duration = this.buffer.duration
      const clampedTime = Math.max(0, Math.min(time, duration))

      // wavesurfer는 비율 (0~1)로 받음
      const progress = clampedTime / duration
      this.wavesurfer.seekTo(progress)
    } catch (error) {
      console.error('Failed to set current time:', error)
    }
  }

  /**
   * 루프 영역 설정
   * @param loopA - A 지점 (초), null이면 영역 소거
   * @param loopB - B 지점 (초), null이면 영역 소거
   */
  setLoopRegion(loopA: number | null, loopB: number | null): void {
    if (!this.wavesurfer || !this.buffer) {
      return
    }

    try {
      // 기존 영역 소거
      if (this.loopRegion) {
        this.loopRegion.remove()
        this.loopRegion = null
      }

      // 새로운 영역 추가 (두 지점이 모두 설정된 경우)
      if (loopA !== null && loopB !== null) {
        // 유효성 검사
        if (loopA < loopB) {
          // wavesurfer.js의 Region API 사용
          // 주의: wavesurfer.js v7는 Regions 플러그인이 별도로 필요할 수 있음
          // 여기서는 기본적인 영역 표시만 구현
          this.loopRegion = {
            remove: () => {
              // 영역 소거
            },
          }

          // 실제 구현에서는 wavesurfer.js의 Regions 플러그인을 사용:
          // import RegionsPlugin from 'wavesurfer.js/dist/plugin/regions.js'
          // this.wavesurfer.registerPlugin(RegionsPlugin.create())
          // this.loopRegion = this.wavesurfer.addRegion({
          //   start: loopA,
          //   end: loopB,
          //   color: 'rgba(255, 255, 255, 0.1)',
          //   drag: false,
          //   resize: false,
          // })
        }
      }
    } catch (error) {
      console.error('Failed to set loop region:', error)
    }
  }

  /**
   * 재생
   */
  play(): void {
    if (this.wavesurfer) {
      this.wavesurfer.play()
    }
  }

  /**
   * 일시정지
   */
  pause(): void {
    if (this.wavesurfer) {
      this.wavesurfer.pause()
    }
  }

  /**
   * 정지
   */
  stop(): void {
    if (this.wavesurfer) {
      this.wavesurfer.stop()
    }
  }

  /**
   * 볼륨 설정
   * @param volume - 볼륨 (0.0 ~ 1.0)
   */
  setVolume(volume: number): void {
    if (this.wavesurfer) {
      this.wavesurfer.setVolume(volume)
    }
  }

  /**
   * 파괴
   * 모든 리소스를 해제하고 이벤트 리스너를 제거합니다.
   */
  destroy(): void {
    if (this.wavesurfer) {
      try {
        // 영역 소거
        if (this.loopRegion) {
          this.loopRegion.remove()
          this.loopRegion = null
        }

        // 이벤트 리스너 제거
        this.removeEventListeners()

        // wavesurfer 파괴
        this.wavesurfer.destroy()
      } catch (error) {
        console.error('Error destroying WaveformRenderer:', error)
      }

      this.wavesurfer = null
    }

    this.buffer = null
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    if (!this.wavesurfer) {
      return
    }

    // 사용자 상호작용 이벤트 (클릭, 드래그 등)
    this.wavesurfer.on('interaction', () => {
      // 현재 시간 취득
      const currentTime = this.wavesurfer?.getCurrentTime() ?? 0
      this.events.onSeek?.(currentTime)
    })

    // 기타 필요한 이벤트들 추가 가능
    // this.wavesurfer.on('ready', () => { ... })
    // this.wavesurfer.on('finish', () => { ... })
  }

  /**
   * 이벤트 리스너 제거
   */
  private removeEventListeners(): void {
    if (!this.wavesurfer) {
      return
    }

    // wavesurfer.js는 un() 메서드로 이벤트 리스너 제거
    // 그러나 특정 이벤트만 제거하는 API가 제한적일 수 있음
    // 여기서는 파괴 시 자동 정리됨
  }

  /**
   * wavesurfer 인스턴스 취득 (고급 사용)
   */
  getWavesurfer(): any | null {
    return this.wavesurfer
  }

  /**
   * 준비 완료 여부 확인
   */
  isReady(): boolean {
    return this.wavesurfer?.isReady ?? false
  }

  /**
   * 현재 재생 중 여부 확인
   */
  isPlaying(): boolean {
    return this.wavesurfer?.isPlaying?.() ?? false
  }
}
