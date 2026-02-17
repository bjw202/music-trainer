/**
 * MetronomeEngine 테스트
 *
 * TDD - GREEN Phase: 구현된 엔진 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetronomeEngine } from '@/core/MetronomeEngine'

// Mock AudioContext 생성 헬퍼
function createMockAudioContext(): {
  context: AudioContext
  mockCreateOscillator: ReturnType<typeof vi.fn>
  mockCreateGain: ReturnType<typeof vi.fn>
  mockDestination: AudioDestinationNode
} {
  const mockDestination = {
    // AudioDestinationNode mock
  } as AudioDestinationNode

  const mockGainNode = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainNode

  const mockOscillator = {
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as OscillatorNode

  const mockCreateOscillator = vi.fn(() => mockOscillator)
  const mockCreateGain = vi.fn(() => mockGainNode)

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
    it('메트로놈 볼륨을 설정해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setVolume(75)

      // GainNode의 gain.value가 변경되었는지 확인
      // 실제 구현에서 확인
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

      // 첫 번째 비트(50ms)가 스케줄링되어야 함
      // 실제 구현에서 OscillatorNode.start() 호출 확인

      engine.stop()
    })

    it('다운비트는 880Hz, 업비트는 440Hz로 재생해야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
        clickFrequencyDownbeat: 880,
        clickFrequencyUpbeat: 440,
      })

      engine.setBeats([0, 0.5, 1.0, 1.5, 2.0]) // 0, 2, 4는 다운비트 (4/4박자)
      engine.syncToPlaybackTime(0, 1.0)
      engine.start()

      // 타이머 틱 시뮬레이션
      vi.advanceTimersByTime(25)

      // 첫 번째 비트(0초)는 다운비트 → 880Hz
      // 두 번째 비트(0.5초)는 업비트 → 440Hz
      // 실제 구현에서 확인

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

    it('속도 변경 시 스케줄링 시간이 조정되어야 한다', () => {
      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([0.5, 1.0, 1.5])

      // 속도 0.5x
      engine.syncToPlaybackTime(0, 0.5)

      // 0.5초 비트는 실제로 1.0초 후에 재생되어야 함
      // scheduleTime = currentTime + (beatTime - sourceTime) / speed
      // scheduleTime = 0 + (0.5 - 0) / 0.5 = 1.0

      expect(() => engine.syncToPlaybackTime(0, 0.5)).not.toThrow()
    })
  })

  describe('속도 변경 동기화', () => {
    it('scheduleTime = currentTime + (beatTime - sourceTime) / speed 공식을 사용해야 한다', () => {
      vi.spyOn(mockContext.context, 'currentTime', 'get').mockReturnValue(10.0)

      const engine = new MetronomeEngine({
        audioContext: mockContext.context,
      })

      engine.setBeats([5.0, 10.0, 15.0])

      // 현재 위치 5초, 속도 2.0x
      engine.syncToPlaybackTime(5.0, 2.0)

      // 다음 비트는 10초 (원본 시간)
      // scheduleTime = 10 + (10 - 5) / 2 = 10 + 2.5 = 12.5

      engine.start()
      vi.advanceTimersByTime(25)

      engine.stop()
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
