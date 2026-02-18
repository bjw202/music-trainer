import {
  SoundTouch,
  SimpleFilter,
  WebAudioBufferSource,
} from 'soundtouchjs'
import type { StemName, StemGains, StemMuted, StemSolo } from '../stores/stemStore'

/**
 * StemMixer 이벤트 핸들러
 */
export interface StemMixerEvents {
  /** 시간 업데이트 이벤트 */
  onTimeUpdate?: (time: number) => void
  /** 재생 완료 이벤트 */
  onEnded?: () => void
}

/**
 * Stem 소스 정보
 */
interface StemSource {
  buffer: AudioBuffer
  source: WebAudioBufferSource | null
  gainNode: GainNode
}

// ScriptProcessorNode 버퍼 크기 (4096 샘플 = ~93ms @44.1kHz)
const SCRIPT_BUFFER_SIZE = 4096

/**
 * StemMixer - 4개 Stem 오디오를 믹싱하는 엔진
 *
 * 아키텍처:
 *   4x WebAudioBufferSource (vocals, drums, bass, other)
 *     -> 개별 GainNode (per-stem volume control)
 *     v
 *   ScriptProcessorNode (onaudioprocess: manual mixing)
 *     v
 *   SimpleFilter(SoundTouch) - master tempo/pitch
 *     v
 *   GainNode (master volume) -> AnalyserNode -> Destination
 *
 * Solo/Mute 로직:
 * - 유효 게인 = solo 활성화 시 해당 스템만 재생, 아니면 mute만 적용
 */
export class StemMixer {
  // AudioContext 인스턴스
  private context: AudioContext | null = null

  // Stem 데이터 (4개 AudioBuffer)
  private stemBuffers: Record<StemName, AudioBuffer | null> = {
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  }

  // Stem 오디오 소스
  private stemSources: Record<StemName, StemSource> = {
    vocals: {
      buffer: null as unknown as AudioBuffer,
      source: null,
      gainNode: null as unknown as GainNode,
    },
    drums: {
      buffer: null as unknown as AudioBuffer,
      source: null,
      gainNode: null as unknown as GainNode,
    },
    bass: {
      buffer: null as unknown as AudioBuffer,
      source: null,
      gainNode: null as unknown as GainNode,
    },
    other: {
      buffer: null as unknown as AudioBuffer,
      source: null,
      gainNode: null as unknown as GainNode,
    },
  }

  // 오디오 그래프 노드
  private masterGainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private scriptNode: ScriptProcessorNode | null = null

  // SoundTouch 실시간 스트리밍 컴포넌트
  private soundtouch: SoundTouch | null = null
  private simpleFilter: SimpleFilter | null = null
  private mixerSource: MixerAudioSource | null = null

  // 믹서 상태
  private gains: StemGains = {
    vocals: 1.0,
    drums: 1.0,
    bass: 1.0,
    other: 1.0,
  }
  private muted: StemMuted = {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  }
  private solo: StemSolo = {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  }

  // 재생 상태
  private isPlaying: boolean = false
  private pauseTime: number = 0 // 일시정지 위치 (초)

  // 속도/피치 상태
  private currentSpeed: number = 1.0
  private currentPitch: number = 0

  // 시간 업데이트 루프
  private animationFrameId: number | null = null
  private lastUpdateTime: number = 0

  // 재생 종료 중복 호출 방지
  private endedFired: boolean = false

  // 이벤트 핸들러
  private readonly events: StemMixerEvents

  constructor(events: StemMixerEvents = {}) {
    this.events = events
  }

  /**
   * AudioContext 초기화
   * @param audioContext - 외부에서 주입된 AudioContext (없으면 새로 생성)
   */
  async initialize(audioContext?: AudioContext): Promise<void> {
    if (this.context) {
      return
    }

    try {
      this.context = audioContext ?? new AudioContext()
      console.log('[StemMixer] AudioContext sampleRate:', this.context.sampleRate)

      // 오디오 그래프 노드 생성
      this.masterGainNode = this.context.createGain()
      this.analyserNode = this.context.createAnalyser()

      // 그래프 연결: Gain -> Analyser -> Destination
      this.masterGainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.context.destination)
    } catch (error) {
      throw new Error(`Failed to initialize AudioContext: ${error}`)
    }
  }

  /**
   * Stem AudioBuffers 로드
   * 모든 stem이 로드되어야 합니다.
   */
  async loadStems(stems: Record<StemName, AudioBuffer>): Promise<void> {
    if (!this.context) {
      throw new Error('StemMixer not initialized. Call initialize() first.')
    }

    // 모든 stem이 있는지 확인
    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      if (!stems[stemName]) {
        throw new Error(`Missing stem: ${stemName}`)
      }
    }

    // 재생 중이면 정지
    if (this.isPlaying) {
      this.stop()
    }

    // Stem 버퍼 저장
    this.stemBuffers = { ...stems }

    // sampleRate 진단 로그
    console.log('[StemMixer] Stem vocals sampleRate:', stems.vocals.sampleRate)
    console.log('[StemMixer] AudioContext sampleRate:', this.context!.sampleRate)
    if (stems.vocals.sampleRate !== this.context!.sampleRate) {
      console.warn('[StemMixer] sampleRate mismatch detected! Pitch may shift during speed changes.')
    }

    // SoundTouch 파이프라인 구성
    this.setupSoundTouchPipeline()
  }

  /**
   * SoundTouch 실시간 스트리밍 파이프라인 구성
   *
   * MixerAudioSource -> SimpleFilter(SoundTouch) -> ScriptProcessorNode -> GainNode
   */
  private setupSoundTouchPipeline(): void {
    if (!this.context || !this.masterGainNode) {
      return
    }

    // 이전 파이프라인 정리
    this.cleanupPipeline()

    // 모든 stem이 로드되었는지 확인
    if (
      !this.stemBuffers.vocals ||
      !this.stemBuffers.drums ||
      !this.stemBuffers.bass ||
      !this.stemBuffers.other
    ) {
      return
    }

    // Stem 소스 초기화
    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      const buffer = this.stemBuffers[stemName]!
      const source = new WebAudioBufferSource(buffer)

      this.stemSources[stemName] = {
        buffer,
        source,
        gainNode: this.context!.createGain(),
      }
    }

    // MixerAudioSource 생성 (4개 stem을 혼합)
    this.mixerSource = new MixerAudioSource(this.stemSources, {
      getGains: () => this.gains,
      getMuted: () => this.muted,
      getSolo: () => this.solo,
    })

    // SoundTouch 컴포넌트 생성
    this.soundtouch = new SoundTouch()
    this.soundtouch.tempo = this.currentSpeed
    this.soundtouch.pitchSemitones = this.currentPitch

    this.simpleFilter = new SimpleFilter(this.mixerSource, this.soundtouch)

    // ScriptProcessorNode 생성
    this.scriptNode = this.context.createScriptProcessor(
      SCRIPT_BUFFER_SIZE,
      2,
      2
    )

    // 재사용 가능한 샘플 버퍼
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
        // 재생 완료
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
    this.scriptNode.connect(this.masterGainNode)
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
    this.mixerSource = null
    this.soundtouch = null
  }

  /**
   * 재생 시작
   */
  async play(): Promise<void> {
    if (!this.context || !this.simpleFilter) {
      return
    }

    if (this.isPlaying) {
      return
    }

    // AudioContext가 suspended 상태면 resume 시도
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {
        console.log('[StemMixer] Resume failed, will retry on next interaction')
      })
    }

    this.endedFired = false
    this.isPlaying = true
    this.startTimeUpdates()
  }

  /**
   * 일시정지
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
   */
  stop(): void {
    if (!this.context) {
      return
    }

    this.isPlaying = false
    this.pauseTime = 0
    this.stopTimeUpdates()

    // MixerAudioSource 위치 리셋
    if (this.mixerSource) {
      this.mixerSource.position = 0
    }

    // 소스 위치를 처음으로 리셋
    if (this.simpleFilter) {
      this.simpleFilter.sourcePosition = 0
    }

    // 모든 stem 소스 위치 리셋
    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      const source = this.stemSources[stemName]?.source
      if (source) {
        source.position = 0
      }
    }

    this.events.onTimeUpdate?.(0)
  }

  /**
   * 시간 탐색 (seek) - 모든 stem 동기화
   */
  seek(time: number): void {
    if (!this.context || !this.stemBuffers.vocals) {
      return
    }

    // 시간 클램핑
    const clampedTime = Math.max(0, Math.min(time, this.stemBuffers.vocals.duration))
    const samplePosition = Math.floor(clampedTime * this.stemBuffers.vocals.sampleRate)

    // MixerAudioSource 위치 동기화 (extract()에서 this.position으로 stem 위치를 설정하므로 필수)
    if (this.mixerSource) {
      this.mixerSource.position = samplePosition
    }

    // SimpleFilter의 sourcePosition 설정
    if (this.simpleFilter) {
      this.simpleFilter.sourcePosition = samplePosition
    }

    // 모든 stem 소스 위치 동기화
    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      const source = this.stemSources[stemName]?.source
      if (source) {
        source.position = samplePosition
      }
    }

    this.pauseTime = clampedTime
    this.endedFired = false

    if (!this.isPlaying) {
      this.events.onTimeUpdate?.(clampedTime)
    }
  }

  /**
   * 볼륨 설정 (마스터)
   */
  setVolume(value: number): void {
    if (!this.masterGainNode) {
      return
    }

    const clampedValue = Math.max(0, Math.min(value, 1))
    this.masterGainNode.gain.value = clampedValue
  }

  /**
   * Stem 게인 설정
   */
  setStemGain(stemName: StemName, gain: number): void {
    this.gains[stemName] = Math.max(0, Math.min(1, gain))
  }

  /**
   * Stem 음소거 토글
   */
  toggleStemMute(stemName: StemName): void {
    this.muted[stemName] = !this.muted[stemName]
  }

  /**
   * Stem 음소거 직접 설정
   */
  setStemMuted(stemName: StemName, value: boolean): void {
    this.muted[stemName] = value
  }

  /**
   * Stem 솔로 토글
   */
  toggleStemSolo(stemName: StemName): void {
    this.solo[stemName] = !this.solo[stemName]
  }

  /**
   * Stem 솔로 직접 설정
   */
  setStemSolo(stemName: StemName, value: boolean): void {
    this.solo[stemName] = value
  }

  /**
   * 현재 재생 위치 취득
   */
  getCurrentTime(): number {
    if (!this.stemBuffers.vocals || !this.simpleFilter) {
      return 0
    }

    if (this.isPlaying) {
      return Math.min(
        this.simpleFilter.sourcePosition / this.stemBuffers.vocals.sampleRate,
        this.stemBuffers.vocals.duration
      )
    }

    return this.pauseTime
  }

  /**
   * 오디오 전체 길이 취득
   */
  getDuration(): number {
    return this.stemBuffers.vocals?.duration ?? 0
  }

  /**
   * 재생 중 여부 확인
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * 재생 속도 설정
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(0.5, Math.min(speed, 2.0))

    if (clampedSpeed === this.currentSpeed) {
      return
    }

    this.currentSpeed = clampedSpeed

    if (this.soundtouch) {
      this.soundtouch.tempo = clampedSpeed
    }
  }

  /**
   * 피치 설정
   */
  setPitch(pitch: number): void {
    const clampedPitch = Math.max(-12, Math.min(pitch, 12))

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
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    this.stop()
    this.stopTimeUpdates()

    // SoundTouch 파이프라인 정리
    this.cleanupPipeline()

    // 그래프 노드 연결 해제
    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect()
      } catch {
        // 이미 해제됨
      }
      this.masterGainNode = null
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
    this.stemBuffers = {
      vocals: null,
      drums: null,
      bass: null,
      other: null,
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

/**
 * MixerAudioSource - 4개 stem을 혼합하는 WebAudioBufferSource 래퍼
 *
 * soundtouchjs의 WebAudioBufferSource 인터페이스를 구현하여
 * 여러 stem을 혼합한 후 SoundTouch 파이프라인에 전달합니다.
 */
class MixerAudioSource {
  private stemSources: Record<StemName, StemSource>
  private mixerState: {
    getGains: () => StemGains
    getMuted: () => StemMuted
    getSolo: () => StemSolo
  }

  // 소스 위치 (모든 stem 동기화)
  position: number = 0

  // dualChannel 속성 (soundtouchjs 호환성)
  readonly dualChannel: boolean = true

  constructor(
    stemSources: Record<StemName, StemSource>,
    mixerState: {
      getGains: () => StemGains
      getMuted: () => StemMuted
      getSolo: () => StemSolo
    }
  ) {
    this.stemSources = stemSources
    this.mixerState = mixerState
  }

  /**
   * 샘플 속도 반환 (첫 번째 stem의 샘플 레이트 사용)
   */
  get sampleRate(): number {
    const sr = this.stemSources.vocals?.buffer?.sampleRate
    if (!sr) {
      throw new Error('[MixerAudioSource] vocals buffer not loaded - sampleRate unavailable')
    }
    return sr
  }

  /**
   * 채널 수 반환 (스테레오)
   */
  get numberOfChannels(): number {
    return 2
  }

  /**
   * 현재 유효한 게인 계산 (Solo/Mute 로직 적용)
   */
  private getEffectiveGain(stemName: StemName): number {
    const gains = this.mixerState.getGains()
    const muted = this.mixerState.getMuted()
    const solo = this.mixerState.getSolo()

    // 어떤 stem이라도 solo가 활성화되어 있는지 확인
    const hasAnySolo = Object.values(solo).some((s) => s)

    if (hasAnySolo) {
      // Solo 모드: solo가 활성화된 stem만 재생
      return solo[stemName] ? gains[stemName] : 0
    } else {
      // 일반 모드: mute만 적용
      return muted[stemName] ? 0 : gains[stemName]
    }
  }

  /**
   * 샘플 추출 (4개 stem 혼합)
   *
   * soundtouchjs SimpleFilter가 전달하는 position 파라미터를 사용하여
   * 올바른 위치에서 샘플을 추출합니다.
   *
   * @param output - 출력 버퍼 (인터리브된 스테레오)
   * @param samples - 추출할 샘플 수
   * @param position - 읽을 위치 (SimpleFilter에서 전달, optional)
   * @returns 실제 추출한 샘플 수
   */
  extract(output: Float32Array, samples: number, position?: number): number {
    const stems: StemName[] = ['vocals', 'drums', 'bass', 'other']
    let minExtracted = samples

    // 임시 버퍼 (각 stem용)
    const tempBuffer = new Float32Array(samples * 2)
    const mixedBuffer = new Float32Array(samples * 2)

    // SimpleFilter가 전달한 position 사용, 없으면 내부 position 사용
    const readPosition = position !== undefined ? position : this.position

    // 각 stem에서 샘플 추출하고 혼합
    for (const stemName of stems) {
      const stemSource = this.stemSources[stemName]
      if (!stemSource.source) {
        continue
      }

      // 올바른 readPosition을 3번째 인자로 전달하여 WebAudioBufferSource가
      // 올바른 위치에서 읽도록 함
      const extracted = stemSource.source.extract(tempBuffer, samples, readPosition)
      minExtracted = Math.min(minExtracted, extracted)

      // 유효한 게인 계산
      const effectiveGain = this.getEffectiveGain(stemName)

      // 혼합 (accumulated)
      for (let i = 0; i < extracted * 2; i++) {
        mixedBuffer[i] += tempBuffer[i] * effectiveGain
      }
    }

    // 결과를 출력 버퍼에 복사
    for (let i = 0; i < minExtracted * 2; i++) {
      output[i] = mixedBuffer[i]
    }

    // 내부 position도 업데이트 (seek 등에서 참조)
    this.position = readPosition + minExtracted

    return minExtracted
  }
}
