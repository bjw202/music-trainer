/**
 * MetronomeEngine - Lookahead Scheduler 기반 정밀 메트로놈
 *
 * Chris Wilson의 "A Tale of Two Clocks" 패턴을 구현:
 * - Web Worker에서 25ms 간격으로 tick 메시지 전송
 * - 메인 스레드에서 100ms lookahead 윈도우 내 비트 스케줄링
 * - OscillatorNode로 sample-accurate 클릭 생성
 */

/**
 * 메트로놈 설정 인터페이스
 */
export interface MetronomeConfig {
  audioContext: AudioContext
  clickFrequencyDownbeat?: number // 기본값: 880Hz
  clickFrequencyUpbeat?: number // 기본값: 440Hz
  clickDuration?: number // 기본값: 0.03초
  lookaheadMs?: number // 기본값: 25ms
  scheduleAheadTime?: number // 기본값: 0.1초 (100ms)
  initialVolume?: number // 기본값: 50 (0-100)
}

/**
 * Web Worker 소스 코드 (인라인)
 */
const WORKER_SOURCE = `
const LOOKAHEAD_MS = 25

let timerID = null

self.onmessage = (e) => {
  if (e.data === 'start') {
    const tick = () => {
      self.postMessage('tick')
      timerID = setTimeout(tick, LOOKAHEAD_MS)
    }
    tick()
  } else if (e.data === 'stop') {
    if (timerID !== null) {
      clearTimeout(timerID)
      timerID = null
    }
  }
}
`

/**
 * MetronomeEngine 클래스
 *
 * Lookahead Scheduler 패턴으로 정밀한 메트로놈 클릭을 스케줄링합니다.
 * Web Worker 타이머를 사용하여 백그라운드 탭에서도 정확한 타이밍을 유지합니다.
 */
export class MetronomeEngine {
  private audioContext: AudioContext
  private metronomeGain: GainNode
  private worker: Worker

  // 설정
  private clickFrequencyDownbeat: number
  private clickFrequencyUpbeat: number
  private clickDuration: number
  private scheduleAheadTime: number

  // 상태
  private beats: number[] = []
  private nextBeatIndex = 0
  private currentSpeed = 1.0
  private anchorSourceTime = 0 // 앵커 동기화 시점의 원본 오디오 위치
  private anchorAcTime = 0 // 앵커 동기화 시점의 AudioContext 시간
  private isRunning = false
  private scheduledBeats: Set<number> = new Set()
  private lastSourceTime = -1 // 마지막으로 동기화된 sourceTime (중복 갱신 방지)

  constructor(config: MetronomeConfig) {
    this.audioContext = config.audioContext
    this.clickFrequencyDownbeat = config.clickFrequencyDownbeat ?? 880
    this.clickFrequencyUpbeat = config.clickFrequencyUpbeat ?? 440
    this.clickDuration = config.clickDuration ?? 0.03
    this.scheduleAheadTime = config.scheduleAheadTime ?? 0.1

    // 메트로놈 전용 GainNode 생성 (마스터와 독립)
    this.metronomeGain = this.audioContext.createGain()
    this.metronomeGain.connect(this.audioContext.destination)

    // 초기 볼륨 설정
    const initialVolume = config.initialVolume ?? 50
    this.metronomeGain.gain.value = Math.max(0, Math.min(100, initialVolume)) / 100

    // 인라인 Web Worker 생성
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' })
    this.worker = new Worker(URL.createObjectURL(blob))
    this.worker.onmessage = () => this.scheduleTick()
  }

  /**
   * 비트 타임스탬프 배열을 설정합니다.
   * 타임스탬프는 원본 오디오 시간 기준이어야 합니다.
   */
  setBeats(beats: number[]): void {
    this.beats = beats
    this.nextBeatIndex = 0
    this.scheduledBeats.clear()
  }

  /**
   * 메트로놈 볼륨을 설정합니다 (0-100).
   */
  setVolume(volume: number): void {
    // 0-100을 0.0-1.0으로 변환
    const gainValue = Math.max(0, Math.min(100, volume)) / 100
    // setTargetAtTime으로 부드럽게 전환 (직접 value 대입은 step 불연속 발생)
    this.metronomeGain.gain.setTargetAtTime(gainValue, this.audioContext.currentTime, 0.01)
  }

  /**
   * 메트로놈 재생을 시작합니다.
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.scheduledBeats.clear()
    this.worker.postMessage('start')
  }

  /**
   * 메트로놈 재생을 중단합니다.
   * nextBeatIndex는 보존되어 resume 시 이어서 재생됩니다.
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    this.worker.postMessage('stop')
  }

  /**
   * 현재 재생 위치와 속도를 동기화합니다 (고속 경로).
   * AudioEngine의 onTimeUpdate에서 직접 호출됩니다.
   * scheduledBeats를 초기화하지 않아 이미 스케줄된 비트를 보존합니다.
   *
   * @param sourceTime - 원본 오디오 시간 (초)
   * @param speed - 재생 속도 (0.5-2.0)
   */
  syncToPlaybackTime(sourceTime: number, speed: number): void {
    this.currentSpeed = speed

    // sourceTime이 실제로 변경된 경우에만 앵커 기준점 갱신
    // ScriptProcessorNode 버퍼(~93ms)보다 rAF(~16ms)가 더 자주 호출되므로
    // 동일한 sourceTime에서 anchorAcTime만 갱신되면 오차가 누적됨
    if (sourceTime !== this.lastSourceTime) {
      this.lastSourceTime = sourceTime
      this.anchorSourceTime = sourceTime
      // 동기화 시점의 AudioContext 시간 저장 (앵커 기준점)
      this.anchorAcTime = this.audioContext.currentTime

      // nextBeatIndex만 조정 (scheduledBeats는 보존)
      this._updateNextBeatIndex(sourceTime)
    }
  }

  /**
   * 속도 변경 시 앵커 기준점을 즉시 갱신합니다.
   * AudioEngine의 speedChangeListener에서 호출됩니다.
   *
   * 앵커 기준점을 현재 보간 위치로 재설정하여 속도 변경 직후 스케줄 오차를 방지합니다.
   * 이미 스케줄된 비트는 무효화됩니다.
   *
   * @param newSpeed - 새로운 재생 속도 (0.5-2.0)
   * @param currentSourceTime - 속도 변경 시점의 원본 오디오 위치 (AudioEngine에서 제공)
   */
  onSpeedChange(newSpeed: number, currentSourceTime: number): void {
    // 변경 전 마지막 보간 위치를 새 앵커로 설정
    this.anchorSourceTime = this.getInterpolatedTime()
    this.anchorAcTime = this.audioContext.currentTime
    this.currentSpeed = newSpeed
    // 속도 변경으로 인해 기존 스케줄된 비트들은 잘못된 시간에 설정되었으므로 무효화
    this.scheduledBeats.clear()
    // 새 속도 기준으로 nextBeatIndex 재조정
    this._updateNextBeatIndex(currentSourceTime)
  }

  /**
   * Seek 시 완전 리셋합니다.
   * 탐색(seek), 루프백 등 비연속적 위치 이동 시에만 호출하세요.
   */
  seekTo(sourceTime: number, speed: number): void {
    this.anchorSourceTime = sourceTime
    this.currentSpeed = speed
    this.anchorAcTime = this.audioContext.currentTime

    // seek 시에만 scheduledBeats 초기화
    this.scheduledBeats.clear()
    this._updateNextBeatIndex(sourceTime)
  }

  /**
   * 앵커 기준점에서 선형 보간하여 현재 원본 오디오 위치를 계산합니다.
   * ScriptProcessorNode 버퍼 갱신 주기(~93ms) 사이에도 정확한 위치를 제공합니다.
   *
   * 공식: anchorSourceTime + (audioContext.currentTime - anchorAcTime) * currentSpeed
   */
  private getInterpolatedTime(): number {
    const elapsed = this.audioContext.currentTime - this.anchorAcTime
    return this.anchorSourceTime + elapsed * this.currentSpeed
  }

  /**
   * 현재 위치에 따라 다음 비트 인덱스를 업데이트합니다.
   * scheduledBeats는 건드리지 않습니다.
   */
  private _updateNextBeatIndex(currentTime: number): void {
    // 이진 검색으로 currentTime 이후 첫 번째 비트 찾기
    let lo = 0
    let hi = this.beats.length

    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.beats[mid] < currentTime) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }

    this.nextBeatIndex = lo
  }

  /**
   * Lookahead Scheduler의 핵심 메서드.
   * Web Worker의 tick 메시지마다 호출됩니다.
   */
  private scheduleTick(): void {
    if (!this.isRunning) return

    const now = this.audioContext.currentTime
    const interpolatedTime = this.getInterpolatedTime()

    while (this.nextBeatIndex < this.beats.length) {
      const beatOriginalTime = this.beats[this.nextBeatIndex]

      // 보간된 현재 위치 기준으로 비트까지의 원본 시간 델타 계산
      // scheduleTime = now + deltaOriginal / speed
      // 앵커 기준점(anchorAcTime, anchorSourceTime) 대신 보간 위치(now, interpolatedTime)를 사용하여
      // ScriptProcessorNode 버퍼 갱신 지연(~93ms)에 의한 드리프트를 제거
      const deltaOriginal = beatOriginalTime - interpolatedTime
      const scheduleTime = now + deltaOriginal / this.currentSpeed

      // 과거 비트는 건너뛰기
      if (scheduleTime < now) {
        this.nextBeatIndex++
        continue
      }

      // Lookahead 윈도우를 벗어나면 중단
      if (scheduleTime > now + this.scheduleAheadTime) {
        break
      }

      // 중복 스케줄링 방지
      if (!this.scheduledBeats.has(this.nextBeatIndex)) {
        // 다운비트(4박자마다) vs 업비트 구분
        const isDownbeat = this.nextBeatIndex % 4 === 0
        const frequency = isDownbeat ? this.clickFrequencyDownbeat : this.clickFrequencyUpbeat

        this._scheduleClick(scheduleTime, frequency, this.clickDuration)
        this.scheduledBeats.add(this.nextBeatIndex)
      }

      this.nextBeatIndex++
    }
  }

  /**
   * 개별 클릭을 스케줄링합니다.
   * OscillatorNode는 일회용이므로 매번 새로 생성합니다.
   *
   * 진폭 엔벨로프(Chris Wilson 패턴)로 파형 불연속 방지:
   * - 클릭별 GainNode로 급격한 시작/종료 팝 노이즈 제거
   * - setValueAtTime(0) → linearRamp(1.0) → exponentialRamp(0.001) 엔벨로프
   */
  private _scheduleClick(time: number, frequency: number, duration: number): void {
    const osc = this.audioContext.createOscillator()
    osc.frequency.value = frequency

    // 클릭별 GainNode로 진폭 엔벨로프 적용
    const clickGain = this.audioContext.createGain()
    clickGain.gain.setValueAtTime(0, time)
    clickGain.gain.linearRampToValueAtTime(1.0, time + 0.002)
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + duration)

    // 라우팅: OscillatorNode → clickGain → metronomeGain
    osc.connect(clickGain)
    clickGain.connect(this.metronomeGain)

    osc.start(time)
    // 엔벨로프 종료 후 약간 여유를 두고 stop
    osc.stop(time + duration + 0.01)

    // 리소스 정리
    osc.onended = () => {
      osc.disconnect()
      clickGain.disconnect()
    }
  }

  /**
   * 리소스를 정리하고 Worker를 종료합니다.
   */
  dispose(): void {
    this.stop()
    this.worker.terminate()
    this.metronomeGain.disconnect()
    this.beats = []
    this.scheduledBeats.clear()
  }
}
