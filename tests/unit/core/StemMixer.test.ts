import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { StemName } from '../../../src/stores/stemStore'

/**
 * StemMixer 단위 테스트
 *
 * MixerAudioSource.extract()의 position 파라미터 버그 수정 검증 및
 * Solo/Mute/Gain 혼합 로직 테스트.
 *
 * 전략: soundtouchjs 모듈과 Web Audio API를 전부 모킹하여
 * MixerAudioSource를 격리 테스트합니다.
 * SimpleFilter 생성자에서 sourceSound(= MixerAudioSource)를 캡처하여
 * 직접 extract()를 호출합니다.
 */

// --- soundtouchjs 모킹 ---
// SimpleFilter 생성자에서 전달된 MixerAudioSource를 캡처
let capturedMixerSource: any = null
// WebAudioBufferSource 생성 순서 추적 (vocals, drums, bass, other)
let createdWebAudioSources: any[] = []

vi.mock('soundtouchjs', () => {
  // vi.fn()에 function 키워드 사용 (new로 호출 가능하도록)
  const MockSoundTouch = vi.fn(function (this: any) {
    this.tempo = 1
    this.pitchSemitones = 0
  })

  const MockSimpleFilter = vi.fn(function (this: any, sourceSound: any, _pipe: any) {
    // MixerAudioSource 인스턴스 캡처
    capturedMixerSource = sourceSound
    this._sourcePosition = 0
    this.extract = vi.fn(() => 0)
    this.clear = vi.fn()
    // sourcePosition getter/setter 정의
    Object.defineProperty(this, 'sourcePosition', {
      get() { return this._sourcePosition },
      set(val: number) {
        this._sourcePosition = val
        // SimpleFilter.set sourcePosition은 내부적으로 clear()를 호출
        this.clear()
      },
    })
  })

  const MockWebAudioBufferSource = vi.fn(function (this: any, buffer: any) {
    this.buffer = buffer
    this._position = 0
    this.dualChannel = true
    // extract: 각 테스트에서 mockImplementation으로 덮어쓸 수 있음
    this.extract = vi.fn(function (_target: Float32Array, numFrames: number, _position: number) {
      return numFrames
    })
    // position getter/setter 정의
    Object.defineProperty(this, 'position', {
      get() { return this._position },
      set(val: number) { this._position = val },
    })
    createdWebAudioSources.push(this)
  })

  return {
    SoundTouch: MockSoundTouch,
    SimpleFilter: MockSimpleFilter,
    WebAudioBufferSource: MockWebAudioBufferSource,
  }
})

// --- Web Audio API 글로벌 모킹 ---

/** 모킹된 AudioBuffer 생성 헬퍼 */
function createMockAudioBuffer(
  sampleRate = 44100,
  length = 44100,
  numberOfChannels = 2
): AudioBuffer {
  // 각 채널에 대한 Float32Array 생성
  const channelData: Float32Array[] = []
  for (let c = 0; c < numberOfChannels; c++) {
    channelData.push(new Float32Array(length))
  }

  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels,
    getChannelData: vi.fn((channel: number) => channelData[channel]),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer
}

/** 모킹된 GainNode 생성 헬퍼 */
function createMockGainNode(): GainNode {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainNode
}

/** 모킹된 AnalyserNode 생성 헬퍼 */
function createMockAnalyserNode(): AnalyserNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
  } as unknown as AnalyserNode
}

/** 모킹된 ScriptProcessorNode 생성 헬퍼 */
function createMockScriptProcessorNode(): ScriptProcessorNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
    bufferSize: 4096,
  } as unknown as ScriptProcessorNode
}

/** 글로벌 AudioContext 모킹 설정 */
function setupGlobalAudioContextMock(): void {
  // function 키워드 사용 (new AudioContext() 호출 가능하도록)
  const mockAudioContext = vi.fn(function (this: any) {
    this.state = 'running'
    this.sampleRate = 44100
    this.destination = {}
    this.createGain = vi.fn(() => createMockGainNode())
    this.createAnalyser = vi.fn(() => createMockAnalyserNode())
    this.createScriptProcessor = vi.fn(() => createMockScriptProcessorNode())
    this.resume = vi.fn(() => Promise.resolve())
    this.close = vi.fn(() => Promise.resolve())
  })

  // jsdom에 AudioContext가 없으므로 글로벌에 설정
  ;(globalThis as any).AudioContext = mockAudioContext
  ;(globalThis as any).webkitAudioContext = mockAudioContext
}

describe('StemMixer', () => {
  beforeEach(() => {
    // 캡처 상태 초기화
    capturedMixerSource = null
    createdWebAudioSources = []

    // 글로벌 AudioContext 모킹
    setupGlobalAudioContextMock()

    // requestAnimationFrame / cancelAnimationFrame 모킹
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0)
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  /**
   * StemMixer를 초기화하고 MixerAudioSource를 캡처하는 헬퍼
   * @param stemValues - 각 stem의 extract() 반환값 패턴 (채널당 고정값)
   */
  async function setupMixer(
    stemValues: Record<StemName, number> = {
      vocals: 0.5,
      drums: 0.3,
      bass: 0.2,
      other: 0.1,
    }
  ) {
    // 동적 import (모킹 적용 후)
    const { StemMixer } = await import('../../../src/core/StemMixer')

    const mixer = new StemMixer()
    await mixer.initialize()

    // 테스트용 모킹 AudioBuffer 생성
    const stems: Record<StemName, AudioBuffer> = {
      vocals: createMockAudioBuffer(),
      drums: createMockAudioBuffer(),
      bass: createMockAudioBuffer(),
      other: createMockAudioBuffer(),
    }

    await mixer.loadStems(stems)

    // SimpleFilter 생성자에서 캡처된 MixerAudioSource 확인
    expect(capturedMixerSource).not.toBeNull()

    // 각 stem의 WebAudioBufferSource.extract() 모킹
    // createdWebAudioSources 순서: vocals(0), drums(1), bass(2), other(3)
    const stemNames: StemName[] = ['vocals', 'drums', 'bass', 'other']
    for (let idx = 0; idx < 4; idx++) {
      const value = stemValues[stemNames[idx]]
      createdWebAudioSources[idx].extract.mockImplementation(
        (target: Float32Array, numFrames: number, _position: number) => {
          // 채널 데이터를 인터리브 형식으로 채움 [L, R, L, R, ...]
          for (let i = 0; i < numFrames * 2; i++) {
            target[i] = value
          }
          return numFrames
        }
      )
    }

    return { mixer, stems }
  }

  describe('MixerAudioSource.extract() - position 파라미터 버그 수정', () => {
    it('position 파라미터를 WebAudioBufferSource.extract()에 올바르게 전달해야 한다', async () => {
      await setupMixer()

      const output = new Float32Array(1024 * 2)
      const requestedPosition = 5000

      // position 인자를 명시적으로 전달하여 extract 호출
      capturedMixerSource.extract(output, 1024, requestedPosition)

      // 각 stem의 WebAudioBufferSource.extract()가 올바른 position으로 호출되었는지 검증
      for (let idx = 0; idx < 4; idx++) {
        const source = createdWebAudioSources[idx]
        expect(source.extract).toHaveBeenCalledWith(
          expect.any(Float32Array),
          1024,
          requestedPosition
        )
      }
    })

    it('position 미지정 시 내부 position을 사용해야 한다', async () => {
      await setupMixer()

      // 내부 position을 3000으로 설정
      capturedMixerSource.position = 3000

      const output = new Float32Array(1024 * 2)

      // position 인자 없이 extract 호출 (2개 인자만)
      capturedMixerSource.extract(output, 1024)

      // 내부 position(3000)이 사용되었는지 검증
      for (let idx = 0; idx < 4; idx++) {
        const source = createdWebAudioSources[idx]
        expect(source.extract).toHaveBeenCalledWith(
          expect.any(Float32Array),
          1024,
          3000
        )
      }
    })

    it('extract() 후 내부 position이 readPosition + minExtracted로 업데이트되어야 한다', async () => {
      await setupMixer()

      const output = new Float32Array(1024 * 2)
      const requestedPosition = 5000

      capturedMixerSource.extract(output, 1024, requestedPosition)

      // position = readPosition(5000) + minExtracted(1024) = 6024
      expect(capturedMixerSource.position).toBe(requestedPosition + 1024)
    })

    it('position 미지정 시 연속 호출에서 position이 누적 업데이트되어야 한다', async () => {
      await setupMixer()

      const output = new Float32Array(512 * 2)
      capturedMixerSource.position = 0

      // 첫 번째 호출: position=0, 512 샘플 추출 -> position=512
      capturedMixerSource.extract(output, 512)
      expect(capturedMixerSource.position).toBe(512)

      // 두 번째 호출: position=512, 512 샘플 추출 -> position=1024
      capturedMixerSource.extract(output, 512)
      expect(capturedMixerSource.position).toBe(1024)

      // 세 번째 호출: position=1024, 512 샘플 추출 -> position=1536
      capturedMixerSource.extract(output, 512)
      expect(capturedMixerSource.position).toBe(1536)
    })

    it('서로 다른 position으로 호출하면 각각 올바른 위치에서 추출해야 한다', async () => {
      await setupMixer()

      const output = new Float32Array(256 * 2)

      // position=0으로 호출
      capturedMixerSource.extract(output, 256, 0)
      for (let idx = 0; idx < 4; idx++) {
        expect(createdWebAudioSources[idx].extract).toHaveBeenLastCalledWith(
          expect.any(Float32Array),
          256,
          0
        )
      }

      // position=22050 (0.5초)으로 호출
      capturedMixerSource.extract(output, 256, 22050)
      for (let idx = 0; idx < 4; idx++) {
        expect(createdWebAudioSources[idx].extract).toHaveBeenLastCalledWith(
          expect.any(Float32Array),
          256,
          22050
        )
      }

      // position=44100 (1.0초)으로 호출
      capturedMixerSource.extract(output, 256, 44100)
      for (let idx = 0; idx < 4; idx++) {
        expect(createdWebAudioSources[idx].extract).toHaveBeenLastCalledWith(
          expect.any(Float32Array),
          256,
          44100
        )
      }
    })
  })

  describe('MixerAudioSource - Gain/Mute/Solo 혼합 로직', () => {
    it('모든 stem이 기본 게인(1.0)으로 혼합되어야 한다', async () => {
      const { mixer } = await setupMixer({
        vocals: 0.5,
        drums: 0.3,
        bass: 0.2,
        other: 0.1,
      })

      const output = new Float32Array(4 * 2) // 4 샘플 (8 float 인터리브)

      capturedMixerSource.extract(output, 4, 0)

      // 모든 stem의 합: 0.5 + 0.3 + 0.2 + 0.1 = 1.1
      const expectedSum = 0.5 + 0.3 + 0.2 + 0.1
      for (let i = 0; i < 4 * 2; i++) {
        expect(output[i]).toBeCloseTo(expectedSum, 5)
      }

      mixer.stop()
    })

    it('Mute된 stem은 혼합에서 제외되어야 한다', async () => {
      const { mixer } = await setupMixer({
        vocals: 0.5,
        drums: 0.3,
        bass: 0.2,
        other: 0.1,
      })

      // vocals 음소거
      mixer.setStemMuted('vocals', true)

      const output = new Float32Array(4 * 2)
      capturedMixerSource.extract(output, 4, 0)

      // vocals(0.5) 제외: 0.3 + 0.2 + 0.1 = 0.6
      const expectedSum = 0.3 + 0.2 + 0.1
      for (let i = 0; i < 4 * 2; i++) {
        expect(output[i]).toBeCloseTo(expectedSum, 5)
      }

      mixer.stop()
    })

    it('Solo 활성화 시 해당 stem만 재생되어야 한다', async () => {
      const { mixer } = await setupMixer({
        vocals: 0.5,
        drums: 0.3,
        bass: 0.2,
        other: 0.1,
      })

      // vocals만 Solo
      mixer.setStemSolo('vocals', true)

      const output = new Float32Array(4 * 2)
      capturedMixerSource.extract(output, 4, 0)

      // vocals(0.5)만 재생
      for (let i = 0; i < 4 * 2; i++) {
        expect(output[i]).toBeCloseTo(0.5, 5)
      }

      mixer.stop()
    })

    it('여러 stem이 Solo 활성화되면 해당 stem들만 혼합되어야 한다', async () => {
      const { mixer } = await setupMixer({
        vocals: 0.5,
        drums: 0.3,
        bass: 0.2,
        other: 0.1,
      })

      // vocals + drums Solo
      mixer.setStemSolo('vocals', true)
      mixer.setStemSolo('drums', true)

      const output = new Float32Array(4 * 2)
      capturedMixerSource.extract(output, 4, 0)

      // vocals(0.5) + drums(0.3) = 0.8
      const expectedSum = 0.5 + 0.3
      for (let i = 0; i < 4 * 2; i++) {
        expect(output[i]).toBeCloseTo(expectedSum, 5)
      }

      mixer.stop()
    })

    it('Stem 게인이 혼합에 올바르게 적용되어야 한다', async () => {
      const { mixer } = await setupMixer({
        vocals: 1.0,
        drums: 1.0,
        bass: 1.0,
        other: 1.0,
      })

      // 각 stem에 개별 게인 설정
      mixer.setStemGain('vocals', 0.8)
      mixer.setStemGain('drums', 0.6)
      mixer.setStemGain('bass', 0.4)
      mixer.setStemGain('other', 0.2)

      const output = new Float32Array(4 * 2)
      capturedMixerSource.extract(output, 4, 0)

      // 게인 적용: 1.0*0.8 + 1.0*0.6 + 1.0*0.4 + 1.0*0.2 = 2.0
      const expectedSum = 0.8 + 0.6 + 0.4 + 0.2
      for (let i = 0; i < 4 * 2; i++) {
        expect(output[i]).toBeCloseTo(expectedSum, 5)
      }

      mixer.stop()
    })
  })

  describe('MixerAudioSource - 속성 접근', () => {
    it('dualChannel이 true여야 한다', async () => {
      await setupMixer()
      expect(capturedMixerSource.dualChannel).toBe(true)
    })

    it('sampleRate가 AudioBuffer의 sampleRate를 반환해야 한다', async () => {
      await setupMixer()
      expect(capturedMixerSource.sampleRate).toBe(44100)
    })

    it('numberOfChannels가 2(스테레오)여야 한다', async () => {
      await setupMixer()
      expect(capturedMixerSource.numberOfChannels).toBe(2)
    })
  })

  describe('MixerAudioSource.extract() - 반환값', () => {
    it('모든 stem의 추출 샘플 수 중 최솟값을 반환해야 한다', async () => {
      await setupMixer()

      // drums 소스가 더 적은 샘플만 반환하도록 설정
      createdWebAudioSources[1].extract.mockImplementation(
        (target: Float32Array, _numFrames: number, _position: number) => {
          // 512 샘플만 반환 (요청된 1024보다 적음)
          for (let i = 0; i < 512 * 2; i++) {
            target[i] = 0.3
          }
          return 512
        }
      )

      const output = new Float32Array(1024 * 2)
      const result = capturedMixerSource.extract(output, 1024, 0)

      // 최솟값인 512가 반환되어야 함
      expect(result).toBe(512)
    })
  })
})
