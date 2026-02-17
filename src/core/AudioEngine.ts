/**
 * AudioEngine - Web Audio API 실시간 스트리밍 오디오 재생 엔진
 *
 * SPEC-PERF-001 Fix: soundtouchjs 기반 실시간 스트리밍 아키텍처
 *
 * 아키텍처:
 *   WebAudioBufferSource -> SimpleFilter(SoundTouch) -> ScriptProcessorNode -> GainNode -> AnalyserNode -> Dest
 *   - SimpleFilter가 매 콜백(~4096 샘플)마다 실시간으로 처리
 *   - tempo/pitch 변경이 다음 청크에 즉시 반영
 *   - sourcePosition / sampleRate로 정확한 원본 시간 추적
 *
 * 기능:
 * - AudioContext 생명주기 관리
 * - 오디오 버퍼 로딩 및 디코딩
 * - 재생/일시정지/정지 제어
 * - 시간 탐색 (seek)
 * - 볼륨 제어
 * - 속도/피치 즉시 변경 (SoundTouch 실시간 스트리밍)
 * - 메모리 누수 방지
 *
 * 제약사항:
 * - AudioContext 초기화에는 사용자 제스처 필요
 * - ScriptProcessorNode는 deprecated이나 현재 가장 안정적인 실시간 처리 방법
 */

import { SPEED_PITCH } from '../utils/constants'
import {
  SoundTouch,
  SimpleFilter,
  WebAudioBufferSource,
} from 'soundtouchjs'

export interface AudioEngineEvents {
  /**
   * 시간 업데이트 이벤트
   * @param time - 현재 재생 위치 (초, 원본 기준)
   */
  onTimeUpdate?: (time: number) => void

  /**
   * 재생 완료 이벤트
   */
  onEnded?: () => void
}

// ScriptProcessorNode 버퍼 크기 (4096 샘플 = ~93ms @44.1kHz)
const SCRIPT_BUFFER_SIZE = 4096

export class AudioEngine {
  // AudioContext 인스턴스
  private context: AudioContext | null = null

  // 현재 로드된 오디오 버퍼 (원본)
  private buffer: AudioBuffer | null = null

  // 오디오 그래프 노드
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private scriptNode: ScriptProcessorNode | null = null

  // SoundTouch 실시간 스트리밍 컴포넌트
  private soundtouch: SoundTouch | null = null
  private simpleFilter: SimpleFilter | null = null
  private bufferSource: WebAudioBufferSource | null = null

  // 재생 상태
  private isPlaying: boolean = false
  private pauseTime: number = 0 // 일시정지 위치 (초, 원본 기준)

  // 속도/피치 상태
  private currentSpeed: number = SPEED_PITCH.DEFAULT_SPEED
  private currentPitch: number = SPEED_PITCH.DEFAULT_PITCH

  // 시간 업데이트 루프
  private animationFrameId: number | null = null
  private lastUpdateTime: number = 0

  // 재생 종료 중복 호출 방지
  private endedFired: boolean = false

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
    if (this.context) {
      return
    }

    try {
      this.context = new AudioContext()

      // 오디오 그래프 노드 생성
      this.gainNode = this.context.createGain()
      this.analyserNode = this.context.createAnalyser()

      // 그래프 연결: Gain -> Analyser -> Destination
      this.gainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.context.destination)
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
      // 재생 중이면 정지
      if (this.isPlaying) {
        this.stop()
      }

      const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0))
      this.buffer = buffer

      // SoundTouch 스트리밍 파이프라인 구성
      this.setupSoundTouchPipeline()

      return buffer
    } catch (error) {
      throw new Error(`Failed to decode audio data: ${error}`)
    }
  }

  /**
   * SoundTouch 실시간 스트리밍 파이프라인 구성
   *
   * WebAudioBufferSource -> SimpleFilter(SoundTouch) -> ScriptProcessorNode -> GainNode
   */
  private setupSoundTouchPipeline(): void {
    if (!this.context || !this.buffer || !this.gainNode) {
      return
    }

    // 이전 파이프라인 정리
    this.cleanupPipeline()

    // SoundTouch 컴포넌트 생성
    this.soundtouch = new SoundTouch()
    this.soundtouch.tempo = this.currentSpeed
    this.soundtouch.pitchSemitones = this.currentPitch

    this.bufferSource = new WebAudioBufferSource(this.buffer)
    this.simpleFilter = new SimpleFilter(this.bufferSource, this.soundtouch)

    // ScriptProcessorNode 생성 (실시간 오디오 콜백)
    this.scriptNode = this.context.createScriptProcessor(
      SCRIPT_BUFFER_SIZE,
      2,
      2
    )

    // 재사용 가능한 샘플 버퍼 (인터리브: [L, R, L, R, ...])
    const samples = new Float32Array(SCRIPT_BUFFER_SIZE * 2)

    this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const left = event.outputBuffer.getChannelData(0)
      const right = event.outputBuffer.getChannelData(1)

      // 일시정지 중이면 무음 출력
      if (!this.isPlaying || !this.simpleFilter) {
        left.fill(0)
        right.fill(0)
        return
      }

      // SimpleFilter에서 처리된 샘플 추출
      const extracted = this.simpleFilter.extract(samples, SCRIPT_BUFFER_SIZE)

      if (extracted === 0) {
        // 더 이상 추출할 샘플 없음 = 재생 완료
        left.fill(0)
        right.fill(0)
        this.handlePlaybackEnded()
        return
      }

      // 디인터리브: [L, R, L, R, ...] -> 좌/우 채널 분리
      for (let i = 0; i < extracted; i++) {
        left[i] = samples[i * 2]
        right[i] = samples[i * 2 + 1]
      }

      // 추출된 샘플이 버퍼 크기보다 작으면 나머지는 무음
      if (extracted < SCRIPT_BUFFER_SIZE) {
        for (let i = extracted; i < SCRIPT_BUFFER_SIZE; i++) {
          left[i] = 0
          right[i] = 0
        }
      }
    }

    // 그래프 연결: ScriptProcessor -> Gain -> Analyser -> Destination
    this.scriptNode.connect(this.gainNode)
  }

  /**
   * 재생 종료 처리
   */
  private handlePlaybackEnded(): void {
    if (!this.isPlaying || this.endedFired) {
      return
    }

    this.endedFired = true
    this.isPlaying = false
    this.pauseTime = 0
    this.stopTimeUpdates()
    this.events.onEnded?.()
  }

  /**
   * SoundTouch 파이프라인 정리
   */
  private cleanupPipeline(): void {
    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect()
      } catch {
        // 이미 해제됨
      }
      this.scriptNode.onaudioprocess = null
      this.scriptNode = null
    }

    this.simpleFilter = null
    this.bufferSource = null
    this.soundtouch = null
  }

  /**
   * 재생 시작
   * ScriptProcessorNode가 이미 연결되어 있으므로 isPlaying 플래그만 활성화
   */
  async play(): Promise<void> {
    if (!this.context || !this.buffer || !this.simpleFilter) {
      return
    }

    if (this.isPlaying) {
      return
    }

    // AudioContext가 suspended 상태면 resume 시도
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {
        console.log('[AudioEngine] Resume failed, will retry on next interaction')
      })
    }

    this.endedFired = false
    this.isPlaying = true
    this.startTimeUpdates()
  }

  /**
   * 일시정지
   * 현재 위치를 유지하며 재생을 멈춤 (ScriptProcessorNode는 무음 출력)
   */
  pause(): void {
    if (!this.isPlaying) {
      return
    }

    this.pauseTime = this.getCurrentTime()
    this.isPlaying = false
    this.stopTimeUpdates()
  }

  /**
   * 정지
   * 재생을 멈추고 위치를 0으로 초기화
   */
  stop(): void {
    if (!this.context) {
      return
    }

    this.isPlaying = false
    this.pauseTime = 0
    this.stopTimeUpdates()

    // 소스 위치를 처음으로 리셋
    if (this.simpleFilter) {
      this.simpleFilter.sourcePosition = 0
    }

    this.events.onTimeUpdate?.(0)
  }

  /**
   * 시간 탐색 (seek)
   * @param time - 이동할 시간 (초, 원본 기준)
   */
  seek(time: number): void {
    if (!this.context || !this.buffer || !this.simpleFilter) {
      return
    }

    // 시간 클램핑
    const clampedTime = Math.max(0, Math.min(time, this.buffer.duration))
    const samplePosition = Math.floor(clampedTime * this.buffer.sampleRate)

    // SimpleFilter의 sourcePosition 설정 (내부 버퍼 초기화 포함)
    this.simpleFilter.sourcePosition = samplePosition
    this.pauseTime = clampedTime
    this.endedFired = false

    if (!this.isPlaying) {
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

    const clampedValue = Math.max(0, Math.min(value, 1))
    this.gainNode.gain.value = clampedValue
  }

  /**
   * 현재 재생 위치 취득 (원본 기준 시간)
   *
   * SimpleFilter.sourcePosition은 원본 오디오에서의 샘플 위치이므로
   * sampleRate로 나누면 정확한 원본 시간을 얻을 수 있습니다.
   *
   * @returns 현재 위치 (초)
   */
  getCurrentTime(): number {
    if (!this.buffer || !this.simpleFilter) {
      return 0
    }

    if (this.isPlaying) {
      return Math.min(
        this.simpleFilter.sourcePosition / this.buffer.sampleRate,
        this.buffer.duration
      )
    }

    return this.pauseTime
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
   * 재생 속도 설정 (즉시 반영)
   * SoundTouch.tempo를 직접 설정하므로 다음 오디오 콜백부터 즉시 적용
   *
   * @param speed - 재생 속도 (0.5 ~ 2.0)
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(
      SPEED_PITCH.MIN_SPEED,
      Math.min(speed, SPEED_PITCH.MAX_SPEED)
    )

    if (clampedSpeed === this.currentSpeed) {
      return
    }

    this.currentSpeed = clampedSpeed

    if (this.soundtouch) {
      this.soundtouch.tempo = clampedSpeed
    }
  }

  /**
   * 피치 설정 (즉시 반영)
   * SoundTouch.pitchSemitones를 직접 설정하므로 다음 오디오 콜백부터 즉시 적용
   *
   * @param pitch - 피치 변경 (반음 단위, -12 ~ +12)
   */
  setPitch(pitch: number): void {
    const clampedPitch = Math.max(
      SPEED_PITCH.MIN_PITCH,
      Math.min(pitch, SPEED_PITCH.MAX_PITCH)
    )

    if (clampedPitch === this.currentPitch) {
      return
    }

    this.currentPitch = clampedPitch

    if (this.soundtouch) {
      this.soundtouch.pitchSemitones = clampedPitch
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
   * AudioContext 반환 (메트로놈 등 외부 모듈에서 사용)
   * @returns AudioContext 인스턴스 또는 null
   */
  getContext(): AudioContext | null {
    return this.context
  }

  /**
   * 리소스 정리
   * 메모리 누수를 방지하기 위해 모든 리소스를 해제합니다.
   */
  async dispose(): Promise<void> {
    this.stop()
    this.stopTimeUpdates()

    // SoundTouch 파이프라인 정리
    this.cleanupPipeline()

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
