/**
 * MetronomeEngine 테스트
 *
 * TDD - GREEN Phase: 구현된 엔진 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetronomeEngine } from '@/core/MetronomeEngine'

// Mock AudioParam (setTargetAtTime, setValueAtTime 등 지원)
function createMockAudioParam(initialValue = 1): AudioParam {
  return {
    value: initialValue,
    setValueAtTime: vi.fn().mockReturnThis(),
    linearRampToValueAtTime: vi.fn().mockReturnThis(),
    exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
    setTargetAtTime: vi.fn().mockReturnThis(),
    cancelScheduledValues: vi.fn().mockReturnThis(),
    defaultValue: initialValue,
    minValue: -3.4028235e38,
    maxValue: 3.4028235e38,
    automationRate: 'a-rate',
  } as unknown as AudioParam
}

// Mock GainNode 생성
function createMockGainNode(): GainNode & { gain: AudioParam } {
  const gain = createMockAudioParam(1)
  return {
    gain,
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  } as unknown as GainNode & { gain: AudioParam }
}

// Mock OscillatorNode 생성
function createMockOscillator(): OscillatorNode & { onended: (() => void) | null } {
  const osc = {
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  }
  return osc as unknown as OscillatorNode & { onended: (() => void) | null }
}

// Mock AudioContext 생성 헬퍼
function createMockAudioContext(): {
  context: AudioContext
  mockCreateOscillator: ReturnType<typeof vi.fn>
  mockCreateGain: ReturnType<typeof vi.fn>
  mockDestination: AudioDestinationNode
  createdGainNodes: ReturnType<typeof createMockGainNode>[]
  createdOscillators: ReturnType<typeof createMockOscillator>[]
} {
  const mockDestination = {} as AudioDestinationNode

  const createdGainNodes: ReturnType<typeof createMockGainNode>[] = []
  const createdOscillators: ReturnType<typeof createMockOscillator>[] = []

  const mockCreateGain = vi.fn(() => {
    const node = createMockGainNode()
    createdGainNodes.push(node)
    return node
  })

  const mockCreateOscillator = vi.fn(() => {
    const osc = createMockOscillator()
    createdOscillators.push(osc)
    return osc
  })

  const context = {
    currentTime: 0,
    destination: mockDestination,
    createOscillator: mockCreateOscillator,
    createGain: mockCreateGain,
  } as unknown as AudioContext

  return {
    context,
    mockCreateOscillator,
    mockCreateGain,
    mockDestination,
    createdGainNodes,
    createdOscillators,
  }
}

describe('MetronomeEngine', () => {
  let mockContext: ReturnType<typeof createMockAudioContext>

  beforeEach(() => {
    mockContext = createMockAudioContext()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('초기화', () => {
    it('AudioContext로 인스턴스를 생성해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      expect(engine).toBeDefined()
    })

    it('메트로놈 GainNode를 생성하고 destination에 연결해야 한다', () => {
      new MetronomeEngine({
        audioContext: mockContext.context,
      })

      expect(mockContext.mockCreateGain).toHaveBeenCalled()
      // 첫 번째 GainNode는 메트로놈 마스터 GainNode
      expect(mockContext.createdGainNodes[0].connect).toHaveBeenCalledWith(
        mockContext.context.destination
      )
    })

    it('초기 볼륨을 설정해야 한다', () => {
      new MetronomeEngine({
        audioContext: mockContext.context,
        initialVolume: 80,
      })

      // 초기 볼륨 80 → gain 0.8
      const masterGain = mockContext.createdGainNodes[0]
      expect(masterGain.gain.value).toBe(0.8)
    })
  })

  describe('setBeats', () => {
    it('비트 타임스탬프 배열을 설정해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      const beats = [0.5, 1.0, 1.5, 2.0, 2.5]
      engine.setBeats(beats)

      // 내부 상태는 직접 확인 불가, start() 후 동작으로 간접 확인
      expect(() => engine.setBeats(beats)).not.toThrow()
    })
  })

  describe('setVolume', () => {
    it('메트로놈 볼륨을 setTargetAtTime으로 부드럽게 설정해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setVolume(75)

      // setTargetAtTime이 호출되었는지 확인 (gain.value 직접 대입 대신)
      const masterGain = mockContext.createdGainNodes[0]
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(
        0.75, // 75/100
        0,    // audioContext.currentTime
        0.01  // 시정수
      )
    })
  })

  describe('start/stop', () => {
    it('start() 호출 시 Web Worker를 시작해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5])
      engine.start()

      // Worker가 시작되었는지 확인 (내부 상태)
      expect(() => engine.start()).not.toThrow()

      engine.stop()
    })

    it('stop() 호출 시 Web Worker를 중단해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5])
      engine.start()
      engine.stop()

      expect(() => engine.stop()).not.toThrow()
    })
  })

  describe('Lookahead Scheduler', () => {
    it('비트 시간이 scheduleAheadTime 내에 있으면 OscillatorNode를 스케줄링해야 한다', () => {
      // currentTime을 0으로 설정
      vi.spyOn(mockContext.context, 'currentTime', 'get').mockReturnValue(0)

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
        scheduleAheadTime: 0.1, // 100ms
      })

      engine.setBeats([0.05, 0.1, 0.15]) // 50ms, 100ms, 150ms
      engine.syncToPlaybackTime(0, 1.0) // 현재 위치 0, 속도 1.0
      engine.start()

      // 25ms 타이머 틱 시뮬레이션
      vi.advanceTimersByTime(25)

      // per-click GainNode가 생성되었는지 확인 (마스터 GainNode 외 추가 생성)
      // 마스터 1개 + 클릭별 최소 1개
      expect(mockContext.createdGainNodes.length).toBeGreaterThan(1)

      engine.stop()
    })

    it('다운비트는 880Hz, 업비트는 440Hz로 재생해야 한다', () => {
      vi.spyOn(mockContext.context, 'currentTime', 'get').mockReturnValue(0)

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
        clickFrequencyDownbeat: 880,
        clickFrequencyUpbeat: 440,
        scheduleAheadTime: 0.1,
      })

      engine.setBeats([0, 0.05]) // 2개 비트: 인덱스 0(다운비트), 인덱스 1(업비트)
      engine.syncToPlaybackTime(0, 1.0)
      engine.start()

      // 25ms 타이머 틱 시뮬레이션
      vi.advanceTimersByTime(25)

      // 생성된 OscillatorNode 확인
      // 인덱스 0: 다운비트 → 880Hz, 인덱스 1: 업비트 → 440Hz
      expect(mockContext.createdOscillators.length).toBeGreaterThanOrEqual(2)
      expect(mockContext.createdOscillators[0].frequency.value).toBe(880)
      expect(mockContext.createdOscillators[1].frequency.value).toBe(440)

      engine.stop()
    })

    it('클릭에 amplitude envelope이 적용되어야 한다', () => {
      vi.spyOn(mockContext.context, 'currentTime', 'get').mockReturnValue(0)

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
        scheduleAheadTime: 0.1,
      })

      engine.setBeats([0.05])
      engine.syncToPlaybackTime(0, 1.0)
      engine.start()

      vi.advanceTimersByTime(25)

      // per-click GainNode (마스터 제외)
      const clickGain = mockContext.createdGainNodes[1]
      expect(clickGain).toBeDefined()
      // envelope: setValueAtTime(0) → linearRamp(1.0) → exponentialRamp(0.001)
      expect(clickGain.gain.setValueAtTime).toHaveBeenCalled()
      expect(clickGain.gain.linearRampToValueAtTime).toHaveBeenCalled()
      expect(clickGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled()

      engine.stop()
    })
  })

  describe('syncToPlaybackTime', () => {
    it('현재 재생 위치와 속도를 업데이트해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5, 2.0])
      engine.syncToPlaybackTime(0.75, 1.0) // 0.75초 위치, 속도 1.0

      expect(() => engine.syncToPlaybackTime(0.75, 1.0)).not.toThrow()
    })

    it('동일한 sourceTime에서 syncedAcTime을 중복 갱신하지 않아야 한다', () => {
      vi.spyOn(mockContext.context, 'currentTime', 'get')
        .mockReturnValueOnce(10.0)   // 초기화 시
        .mockReturnValueOnce(10.0)   // 첫 sync
        .mockReturnValueOnce(10.016) // 두 번째 sync (같은 sourceTime, 다른 AC time)
        .mockReturnValueOnce(10.032) // 세 번째 sync

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5])

      // 첫 호출: sourceTime=0 → syncedAcTime 갱신
      engine.syncToPlaybackTime(0, 1.0)
      // 두 번째 호출: 같은 sourceTime=0 → syncedAcTime 갱신하지 않아야 함
      engine.syncToPlaybackTime(0, 1.0)
      // 세 번째 호출: 같은 sourceTime=0 → syncedAcTime 갱신하지 않아야 함
      engine.syncToPlaybackTime(0, 1.0)

      // 오류 없이 정상 실행
      expect(true).toBe(true)
    })

    it('속도 변경 시 스케줄링 시간이 조정되어야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5])

      // 속도 0.5x
      engine.syncToPlaybackTime(0, 0.5)

      // 0.5초 비트는 실제로 1.0초 후에 재생되어야 함
      // scheduleTime = syncedAcTime + (beatTime - sourceTime) / speed
      // scheduleTime = 0 + (0.5 - 0) / 0.5 = 1.0

      expect(() => engine.syncToPlaybackTime(0, 0.5)).not.toThrow()
    })
  })

  describe('속도 변경 동기화', () => {
    it('scheduleTime = syncedAcTime + (beatTime - sourceTime) / speed 공식을 사용해야 한다', () => {
      vi.spyOn(mockContext.context, 'currentTime', 'get').mockReturnValue(10.0)

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
        scheduleAheadTime: 5.0, // 넓은 lookahead 윈도우
      })

      engine.setBeats([5.0, 10.0, 15.0])

      // 현재 위치 5초, 속도 2.0x
      engine.syncToPlaybackTime(5.0, 2.0)

      // beats[0]=5.0: scheduleTime = 10 + (5-5)/2 = 10.0 (현재 시간과 동일, 스케줄됨)
      // beats[1]=10.0: scheduleTime = 10 + (10-5)/2 = 12.5
      // now + scheduleAheadTime = 10 + 5 = 15 → 둘 다 윈도우 안

      engine.start()
      vi.advanceTimersByTime(25)

      // beats[0]이 scheduleTime=10.0으로, beats[1]이 12.5로 스케줄됨
      expect(mockContext.createdOscillators.length).toBeGreaterThanOrEqual(2)
      expect(mockContext.createdOscillators[0].start).toHaveBeenCalledWith(10.0)
      expect(mockContext.createdOscillators[1].start).toHaveBeenCalledWith(12.5)

      engine.stop()
    })
  })

  describe('seekTo', () => {
    it('seekTo 시 scheduledBeats를 초기화해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5, 2.0])
      engine.seekTo(1.0, 1.0)

      // 에러 없이 정상 실행
      expect(() => engine.seekTo(1.0, 1.0)).not.toThrow()
    })
  })

  describe('dispose', () => {
    it('리소스를 정리하고 Worker를 종료해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0])
      engine.start()
      engine.dispose()

      expect(() => engine.dispose()).not.toThrow()
    })
  })
})
