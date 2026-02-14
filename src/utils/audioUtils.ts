import { SUPPORTED_AUDIO_FORMATS } from './constants'

/**
 * 파일의 오디오 형식이 지원되는지 확인합니다
 * @param file - 검증할 File 객체
 * @returns 지원되는 형식이면 true, 아니면 false
 * @example
 * const file = new File([''], 'song.mp3', { type: 'audio/mpeg' })
 * validateAudioFormat(file) // true
 */
export function validateAudioFormat(file: File): boolean {
  if (!file.type) {
    return false
  }
  return SUPPORTED_AUDIO_FORMATS.includes(file.type as any)
}

/**
 * File 객체를 ArrayBuffer로 변환합니다
 * @param file - 변환할 File 객체
 * @returns ArrayBuffer로 resolve되는 Promise
 * @example
 * const file = new File(['content'], 'song.mp3')
 * const buffer = await fileToArrayBuffer(file)
 */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('FileReader did not return an ArrayBuffer'))
      }
    }

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`))
    }

    reader.readAsArrayBuffer(file)
  })
}
