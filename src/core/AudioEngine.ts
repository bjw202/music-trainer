/**
 * AudioEngine - Web Audio API 오디오 재생 엔진
 *
 * 기능:
 * - AudioContext 생명주크 관리
 * - 오디오 버퍼 로딩 및 디코딩
 * - 재생/일시정지/정지 제어
 * - 시간 탐색 (seek)
 * - 볼륨 제어
 * - 메모리 누수 방지
 *
 * 제약사항:
 * - AudioContext 초기화에는 사용자 제스처 필요
 * - BufferSource는 일회용 (재생마다 새로 생성)
 * - 모든 노드는 사용 후 연결 해제 필수
 */

export interface AudioEngineEvents {
  /**
   * 시간 업데이트 이벤트
   * @param time - 현재 재생 위치 (초)
   */
  onTimeUpdate?: (time: number) => void

  /**
   * 재생 완료 이벤트
   */
  onEnded?: () => void
}

export class AudioEngine {
  // AudioContext 인스턴스
  private context: AudioContext | null = null

  // 현재 로드된 오디오 버퍼
  private buffer: AudioBuffer | null = null

  // 오디오 그래프 노드들
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  // 재생 상태
  private isPlaying: boolean = false
  private startTime: number = 0 // 재생 시작 시간 (context.currentTime)
  private pauseTime: number = 0 // 일시정지 위치 (초)

  // 시간 업데이트 루프
  private animationFrameId: number | null = null
  private lastUpdateTime: number = 0

  // 이벤트 핸들러
  private readonly events: AudioEngineEvents

  constructor(events: AudioEngineEvents = {}) {
    this.events = events
  }

  /**
   * AudioContext 초기화
   * @throws Error - AudioContext 미지원 시
   */
  async initialize(): Promise<void> {
    // 이미 초기화된 경우 무시
    if (this.context) {
      return
    }

    try {
      // AudioContext 생성
      this.context = new AudioContext()

      // 오디오 그래프 노드들 생성
      this.gainNode = this.context.createGain()
      this.analyserNode = this.context.createAnalyser()

      // 그래프 연결: Gain -> Analyser -> Destination
      if (this.gainNode && this.analyserNode) {
        this.gainNode.connect(this.analyserNode)
      }
      if (this.analyserNode && this.context.destination) {
        this.analyserNode.connect(this.context.destination)
      }

      // AudioContext resume (사용자 제스처 필요)
      if (this.context.state === 'suspended') {
        await this.context.resume()
      }
    } catch (error) {
      throw new Error(`Failed to initialize AudioContext: ${error}`)
    }
  }

  /**
   * ArrayBuffer를 AudioBuffer로 디코딩
   * @param arrayBuffer - 디코딩할 ArrayBuffer
   * @returns 디코딩된 AudioBuffer
   * @throws Error - 디코딩 실패 시
   */
  async loadBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.context) {
      throw new Error('AudioEngine not initialized. Call initialize() first.')
    }

    try {
      const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0))
      this.buffer = buffer
      return buffer
    } catch (error) {
      throw new Error(`Failed to decode audio data: ${error}`)
    }
  }

  /**
   * 재생 시작
   * 현재 위치에서 재생을 시작합니다.
   */
  play(): void {
    if (!this.context || !this.buffer) {
      return // 버퍼가 없으면 무시
    }

    // 이미 재생 중이면 무시
    if (this.isPlaying) {
      return
    }

    try {
      // 기존 소스 정리
      this.stopSource()

      // 새로운 BufferSource 생성 (일회용)
      this.source = this.context.createBufferSource()
      this.source.buffer = this.buffer

      // 그래프 연결: Source -> Gain -> Analyser -> Destination
      if (this.gainNode) {
        this.source.connect(this.gainNode)
      }
      this.source.onended = () => {
        // 자연스러운 재생 완료 시에만 이벤트 발생
        if (this.isPlaying && this.getCurrentTime() >= this.getDuration() - 0.1) {
          this.isPlaying = false
          this.stopTimeUpdates()
          this.events.onEnded?.()
        }
      }

      // 현재 위치에서 재생 시작
      const offset = this.pauseTime
      this.startTime = this.context.currentTime - offset
      this.source.start(0, offset)

      this.isPlaying = true
      this.startTimeUpdates()
    } catch (error) {
      console.error('Failed to play audio:', error)
      this.isPlaying = false
      this.stopTimeUpdates()
    }
  }

  /**
   * 일시정지
   * 현재 위치를 유지하며 재생을 멈춥니다.
   */
  pause(): void {
    if (!this.context || !this.isPlaying) {
      return
    }

    try {
      // 현재 위치 저장
      this.pauseTime = this.getCurrentTime()

      // 소스 정지
      this.stopSource()

      this.isPlaying = false
      this.stopTimeUpdates()
    } catch (error) {
      console.error('Failed to pause audio:', error)
    }
  }

  /**
   * 정지
   * 재생을 멈추고 위치를 0으로 초기화합니다.
   */
  stop(): void {
    if (!this.context) {
      return
    }

    try {
      // 소스 정지
      this.stopSource()

      // 위치 초기화
      this.pauseTime = 0
      this.isPlaying = false
      this.stopTimeUpdates()

      // 시간 업데이트 이벤트 발생 (0으로)
      this.events.onTimeUpdate?.(0)
    } catch (error) {
      console.error('Failed to stop audio:', error)
    }
  }

  /**
   * 시간 탐색 (seek)
   * @param time - 이동할 시간 (초)
   */
  seek(time: number): void {
    if (!this.context || !this.buffer) {
      return
    }

    // 시간 클램핑
    const clampedTime = Math.max(0, Math.min(time, this.buffer.duration))

    // 재생 중이면 위치 변경 후 계속 재생
    const wasPlaying = this.isPlaying
    if (wasPlaying) {
      this.stopSource()
    }

    this.pauseTime = clampedTime

    if (wasPlaying) {
      this.play()
    } else {
      // 시간 업데이트 이벤트 발생
      this.events.onTimeUpdate?.(clampedTime)
    }
  }

  /**
   * 볼륨 설정
   * @param value - 볼륨 값 (0.0 ~ 1.0)
   */
  setVolume(value: number): void {
    if (!this.gainNode) {
      return
    }

    // 볼륨 클램핑
    const clampedValue = Math.max(0, Math.min(value, 1))
    this.gainNode.gain.value = clampedValue
  }

  /**
   * 현재 재생 위치 취득
   * @returns 현재 위치 (초)
   */
  getCurrentTime(): number {
    if (!this.context || !this.buffer) {
      return 0
    }

    if (this.isPlaying) {
      // 재생 중: 실시간 계산
      const elapsed = this.context.currentTime - this.startTime
      return Math.min(elapsed, this.buffer.duration)
    } else {
      // 일시정지/정지: 저장된 위치 반환
      return this.pauseTime
    }
  }

  /**
   * 오디오 전체 길이 취득
   * @returns 전체 길이 (초)
   */
  getDuration(): number {
    return this.buffer?.duration ?? 0
  }

  /**
   * 재생 중 여부 확인
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * 리소스 정리
   * 메모리 누수를 방지하기 위해 모든 리소스를 해제합니다.
   */
  async dispose(): Promise<void> {
    // 정지
    this.stop()
    this.stopTimeUpdates()

    // 소스 정리
    this.stopSource()

    // 그래프 노드 연결 해제
    if (this.gainNode) {
      try {
        this.gainNode.disconnect()
      } catch {
        // 이미 해제됨
      }
      this.gainNode = null
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect()
      } catch {
        // 이미 해제됨
      }
      this.analyserNode = null
    }

    // AudioContext 정리
    if (this.context) {
      try {
        await this.context.close()
      } catch {
        // 이미 닫힘
      }
      this.context = null
    }

    // 버퍼 정리
    this.buffer = null
  }

  /**
   * 소스 노드 정리
   */
  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop()
        this.source.disconnect()
        this.source.onended = null
      } catch {
        // 이미 정지됨
      }
      this.source = null
    }
  }

  /**
   * 시간 업데이트 루프 시작
   */
  private startTimeUpdates(): void {
    this.stopTimeUpdates()
    this.lastUpdateTime = performance.now()
    this.updateTime()
  }

  /**
   * 시간 업데이트 루프 중지
   */
  private stopTimeUpdates(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * 시간 업데이트 (requestAnimationFrame 콜백)
   */
  private updateTime = (): void => {
    if (!this.isPlaying) {
      return
    }

    const now = performance.now()
    const delta = now - this.lastUpdateTime

    // 60fps 목표 (약 16ms마다 업데이트)
    if (delta >= 16) {
      const currentTime = this.getCurrentTime()
      this.events.onTimeUpdate?.(currentTime)
      this.lastUpdateTime = now
    }

    this.animationFrameId = requestAnimationFrame(this.updateTime)
  }
}
