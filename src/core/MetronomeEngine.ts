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
  private currentSourceTime = 0
  private isRunning = false
  private scheduledBeats: Set<number> = new Set()

  constructor(config: MetronomeConfig) {
    this.audioContext = config.audioContext
    this.clickFrequencyDownbeat = config.clickFrequencyDownbeat ?? 880
    this.clickFrequencyUpbeat = config.clickFrequencyUpbeat ?? 440
    this.clickDuration = config.clickDuration ?? 0.03
    this.scheduleAheadTime = config.scheduleAheadTime ?? 0.1

    // 메트로놈 전용 GainNode 생성 (마스터와 독립)
    this.metronomeGain = this.audioContext.createGain()
    this.metronomeGain.connect(this.audioContext.destination)

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
    this.metronomeGain.gain.value = gainValue
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
   * 현재 재생 위치와 속도를 동기화합니다.
   * AudioEngine의 sourcePosition과 speed를 전달받습니다.
   *
   * @param sourceTime - 원본 오디오 시간 (초)
   * @param speed - 재생 속도 (0.5-2.0)
   */
  syncToPlaybackTime(sourceTime: number, speed: number): void {
    this.currentSourceTime = sourceTime
    this.currentSpeed = speed

    // 비트 인덱스 재조정 (이진 검색)
    this._updateNextBeatIndex(sourceTime)
  }

  /**
   * 현재 위치에 따라 다음 비트 인덱스를 업데이트합니다.
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
    this.scheduledBeats.clear()
  }

  /**
   * Lookahead Scheduler의 핵심 메서드.
   * Web Worker의 tick 메시지마다 호출됩니다.
   */
  private scheduleTick(): void {
    if (!this.isRunning) return

    const now = this.audioContext.currentTime

    while (this.nextBeatIndex < this.beats.length) {
      const beatOriginalTime = this.beats[this.nextBeatIndex]

      // 원본 시간을 AudioContext 재생 시간으로 변환
      // scheduleTime = currentTime + (beatTime - sourceTime) / speed
      const deltaOriginal = beatOriginalTime - this.currentSourceTime
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
   */
  private _scheduleClick(time: number, frequency: number, duration: number): void {
    const osc = this.audioContext.createOscillator()
    osc.frequency.value = frequency
    osc.connect(this.metronomeGain)
    osc.start(time)
    osc.stop(time + duration)
    // OscillatorNode는 stop 후 자동으로 disconnect됨
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
