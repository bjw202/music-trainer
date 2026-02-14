/**
 * AudioEngine - Web Audio API 오디오 재생 엔진
 *
 * 기능:
 * - AudioContext 생명주크 관리
 * - 오디오 버퍼 로딩 및 디코딩
 * - 재생/일시정지/정지 제어
 * - 시간 탐색 (seek)
 * - 볼륨 제어
 * - 속도/피치 변경 (SoundTouch 기반)
 * - 메모리 누수 방지
 *
 * 제약사항:
 * - AudioContext 초기화에는 사용자 제스처 필요
 * - BufferSource는 일회용 (재생마다 새로 생성)
 * - 모든 노드는 사용 후 연결 해제 필수
 */

import { SPEED_PITCH } from '../utils/constants'
import { processBuffer, calculateProcessedDuration } from './worklets/soundtouch-processor'

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

  // 현재 로드된 오디오 버퍼 (원본)
  private buffer: AudioBuffer | null = null

  // 속도/피치 처리된 버퍼
  private processedBuffer: AudioBuffer | null = null

  // 오디오 그래프 노드들
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  // 재생 상태
  private isPlaying: boolean = false
  private startTime: number = 0 // 재생 시작 시간 (context.currentTime)
  private pauseTime: number = 0 // 일시정지 위치 (초, 원본 기준)

  // 속도/피치 상태
  private currentSpeed: number = SPEED_PITCH.DEFAULT_SPEED
  private currentPitch: number = SPEED_PITCH.DEFAULT_PITCH

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
   *
   * Note: AudioContext가 'suspended' 상태여도 초기화는 완료합니다.
   * 실제 resume은 play() 호출 시 사용자 제스처 컨텍스트에서 수행됩니다.
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

      // AudioContext가 suspended 상태면 resume하지 않고 초기화 완료
      // 실제 resume은 play() 호출 시 사용자 제스처 컨텍스트에서 수행
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
  async play(): Promise<void> {
    if (!this.context || !this.buffer) {
      return // 버퍼가 없으면 무시
    }

    // 이미 재생 중이면 무시
    if (this.isPlaying) {
      return
    }

    // AudioContext가 suspended 상태면 비동기로 resume 시도 (블로킹하지 않음)
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {
        console.log('[AudioEngine] Resume failed, will retry on next interaction')
      })
    }

    try {
      // 기존 소스 정리
      this.stopSource()

      // 속도/피치가 기본값이 아니면 처리된 버퍼 사용
      const activeBuffer = this.getActiveBuffer()
      if (!activeBuffer) {
        return
      }

      // 새로운 BufferSource 생성 (일회용)
      this.source = this.context.createBufferSource()
      this.source.buffer = activeBuffer

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

      // 처리된 버퍼에서의 오프셋 계산
      const processedOffset = this.toProcessedTime(this.pauseTime)
      this.startTime = this.context.currentTime - processedOffset
      this.source.start(0, processedOffset)

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
      this.isPlaying = false      // play()의 가드를 통과하기 위해 리셋
      this.stopTimeUpdates()      // 이전 RAF 루프 중지
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
   * 현재 재생 위치 취득 (원본 기준 시간)
   * @returns 현재 위치 (초)
   */
  getCurrentTime(): number {
    if (!this.context || !this.buffer) {
      return 0
    }

    if (this.isPlaying) {
      // 재생 중: 처리된 버퍼 기준 경과 시간을 원본 시간으로 변환
      const processedElapsed = this.context.currentTime - this.startTime
      const originalTime = this.toOriginalTime(processedElapsed)
      return Math.min(originalTime, this.buffer.duration)
    } else {
      // 일시정지/정지: 저장된 위치 반환 (원본 기준)
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
   * 재생 속도 설정
   * @param speed - 재생 속도 (0.5 ~ 2.0)
   */
  setSpeed(speed: number): void {
    if (!this.context || !this.buffer) {
      return
    }

    const clampedSpeed = Math.max(
      SPEED_PITCH.MIN_SPEED,
      Math.min(speed, SPEED_PITCH.MAX_SPEED)
    )

    if (clampedSpeed === this.currentSpeed) {
      return
    }

    // 현재 위치 스냅샷 (원본 기준)
    const currentOriginalTime = this.getCurrentTime()
    const wasPlaying = this.isPlaying

    this.currentSpeed = clampedSpeed
    this.rebuildProcessedBuffer()

    // 위치 복원 후 재시작
    this.pauseTime = currentOriginalTime

    if (wasPlaying) {
      this.stopSource()
      this.isPlaying = false
      this.stopTimeUpdates()
      this.play()
    }
  }

  /**
   * 피치 설정
   * @param pitch - 피치 변경 (반음 단위, -12 ~ +12)
   */
  setPitch(pitch: number): void {
    if (!this.context || !this.buffer) {
      return
    }

    const clampedPitch = Math.max(
      SPEED_PITCH.MIN_PITCH,
      Math.min(pitch, SPEED_PITCH.MAX_PITCH)
    )

    if (clampedPitch === this.currentPitch) {
      return
    }

    // 현재 위치 스냅샷 (원본 기준)
    const currentOriginalTime = this.getCurrentTime()
    const wasPlaying = this.isPlaying

    this.currentPitch = clampedPitch
    this.rebuildProcessedBuffer()

    // 위치 복원 후 재시작
    this.pauseTime = currentOriginalTime

    if (wasPlaying) {
      this.stopSource()
      this.isPlaying = false
      this.stopTimeUpdates()
      this.play()
    }
  }

  /**
   * 현재 속도 반환
   */
  getSpeed(): number {
    return this.currentSpeed
  }

  /**
   * 현재 피치 반환
   */
  getPitch(): number {
    return this.currentPitch
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
    this.processedBuffer = null
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

  /**
   * 활성 버퍼 반환 (처리된 버퍼 또는 원본)
   */
  private getActiveBuffer(): AudioBuffer | null {
    if (this.currentSpeed === 1.0 && this.currentPitch === 0) {
      return this.buffer
    }
    return this.processedBuffer ?? this.buffer
  }

  /**
   * SoundTouch로 처리된 버퍼 재생성
   */
  private rebuildProcessedBuffer(): void {
    if (!this.context || !this.buffer) {
      return
    }

    if (this.currentSpeed === 1.0 && this.currentPitch === 0) {
      this.processedBuffer = null
      return
    }

    this.processedBuffer = processBuffer(
      this.buffer,
      this.currentSpeed,
      this.currentPitch,
      this.context
    )
  }

  /**
   * 원본 시간을 처리된 버퍼 시간으로 변환
   */
  private toProcessedTime(originalTime: number): number {
    if (this.currentSpeed === 1.0 && this.currentPitch === 0) {
      return originalTime
    }
    return originalTime / this.currentSpeed
  }

  /**
   * 처리된 버퍼 시간을 원본 시간으로 변환
   */
  private toOriginalTime(processedTime: number): number {
    if (this.currentSpeed === 1.0 && this.currentPitch === 0) {
      return processedTime
    }
    return processedTime * this.currentSpeed
  }
}
