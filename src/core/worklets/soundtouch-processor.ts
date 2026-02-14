/**
 * SoundTouch AudioWorklet 프로세서
 *
 * soundtouch-ts를 사용하여 실시간 속도/피치 변경을 수행합니다.
 * AudioWorklet에서는 외부 모듈을 직접 import할 수 없으므로,
 * 메인 스레드에서 SoundTouch 인스턴스를 관리하고
 * ScriptProcessorNode 대신 오프라인 버퍼 처리 방식을 사용합니다.
 *
 * 이 모듈은 SoundTouch를 사용한 오프라인 오디오 처리 유틸리티를 제공합니다.
 */

import { SoundTouch } from 'soundtouch-ts'

/**
 * SoundTouch를 사용하여 AudioBuffer를 오프라인으로 처리합니다.
 *
 * @param buffer - 원본 AudioBuffer
 * @param speed - 재생 속도 (0.5 ~ 2.0, 기본값 1.0)
 * @param pitch - 피치 변경 (반음 단위, -12 ~ +12, 기본값 0)
 * @param context - AudioContext (새 버퍼 생성용)
 * @returns 처리된 AudioBuffer
 */
export function processBuffer(
  buffer: AudioBuffer,
  speed: number,
  pitch: number,
  context: AudioContext
): AudioBuffer {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate

  // 바이패스: 속도 1.0, 피치 0이면 원본 반환
  if (speed === 1.0 && pitch === 0) {
    return buffer
  }

  const st = new SoundTouch(sampleRate)
  st.tempo = speed
  st.pitchSemitones = pitch

  // 스테레오 인터리브 형식으로 변환 (SoundTouch 요구사항)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = channels > 1 ? buffer.getChannelData(1) : leftChannel
  const numSamples = buffer.length

  // 인터리브 배열 생성: [L, R, L, R, ...]
  const interleaved = new Float32Array(numSamples * 2)
  for (let i = 0; i < numSamples; i++) {
    interleaved[i * 2] = leftChannel[i]
    interleaved[i * 2 + 1] = rightChannel[i]
  }

  // SoundTouch 입력 버퍼에 샘플 추가
  st.inputBuffer.putSamples(interleaved, 0, numSamples)

  // 처리 실행
  st.process()

  // 출력 수집
  const outputFrames = st.outputBuffer.frameCount
  const outputInterleaved = new Float32Array(outputFrames * 2)
  st.outputBuffer.receiveSamples(outputInterleaved, outputFrames)

  // 새 AudioBuffer 생성
  const outputBuffer = context.createBuffer(
    channels,
    outputFrames,
    sampleRate
  )

  // 디인터리브
  const outLeft = outputBuffer.getChannelData(0)
  for (let i = 0; i < outputFrames; i++) {
    outLeft[i] = outputInterleaved[i * 2]
  }

  if (channels > 1) {
    const outRight = outputBuffer.getChannelData(1)
    for (let i = 0; i < outputFrames; i++) {
      outRight[i] = outputInterleaved[i * 2 + 1]
    }
  }

  return outputBuffer
}

/**
 * 처리된 버퍼의 시간 길이를 계산합니다.
 * 속도가 변경되면 실제 재생 시간이 달라집니다.
 *
 * @param originalDuration - 원본 오디오 길이 (초)
 * @param speed - 재생 속도
 * @returns 처리된 버퍼의 예상 길이 (초)
 */
export function calculateProcessedDuration(
  originalDuration: number,
  speed: number
): number {
  return originalDuration / speed
}
