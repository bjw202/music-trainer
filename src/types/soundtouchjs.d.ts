/**
 * soundtouchjs 타입 선언
 *
 * 실시간 오디오 속도/피치 변경을 위한 SoundTouch 라이브러리
 * @see https://github.com/cutterbl/SoundTouchJS
 */
declare module 'soundtouchjs' {
  class FifoSampleBuffer {
    frameCount: number
    putSamples(samples: Float32Array, position: number, numFrames: number): void
    receiveSamples(output: Float32Array, numFrames: number): void
    extract(output: Float32Array, position: number, numFrames: number): void
    clear(): void
  }

  export class SoundTouch {
    constructor()
    get inputBuffer(): FifoSampleBuffer
    get outputBuffer(): FifoSampleBuffer
    get rate(): number
    set rate(rate: number)
    get tempo(): number
    set tempo(tempo: number)
    set pitch(pitch: number)
    set pitchOctaves(pitchOctaves: number)
    set pitchSemitones(pitchSemitones: number)
    set tempoChange(tempoChange: number)
    set rateChange(rateChange: number)
    clear(): void
    clone(): SoundTouch
    process(): void
  }

  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer)
    get dualChannel(): boolean
    get position(): number
    set position(value: number)
    extract(
      target: Float32Array,
      numFrames: number,
      position: number
    ): number
  }

  export class SimpleFilter {
    constructor(
      sourceSound: WebAudioBufferSource,
      pipe: SoundTouch,
      callback?: () => void
    )
    get position(): number
    set position(position: number)
    get sourcePosition(): number
    set sourcePosition(sourcePosition: number)
    extract(target: Float32Array, numFrames: number): number
    onEnd(): void
    clear(): void
  }

  export function getWebAudioNode(
    context: AudioContext,
    filter: SimpleFilter,
    sourcePositionCallback?: (position: number) => void,
    bufferSize?: number
  ): ScriptProcessorNode

  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize: number,
      onEnd?: () => void
    )
    get formattedTimePlayed(): string
    get percentagePlayed(): number
    set pitch(pitch: number)
    set pitchSemitones(pitchSemitones: number)
    set tempo(tempo: number)
    get node(): ScriptProcessorNode
    connect(toNode: AudioNode): void
    disconnect(): void
    off(eventName?: string, cb?: EventListener): void
    on(eventName: string, cb: EventListener): void
  }
}
