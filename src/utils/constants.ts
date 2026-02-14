/**
 * 키보드 단축키 상수
 */
export const KEYBOARD_SHORTCUTS = {
  SPACE: 'Space',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SET_A: 'i',
  SET_B: 'o',
  JUMP_TO_A: 'a',
  MUTE: 'm',
} as const

export type KeyboardShortcut = typeof KEYBOARD_SHORTCUTS[keyof typeof KEYBOARD_SHORTCUTS]

/**
 * 시간 간격 상수
 */
export const TIME_INTERVALS = {
  SEEK_STEP: 5, // seconds
  LOOP_LATENCY_TARGET: 50, // milliseconds
} as const

/**
 * 지원되는 오디오 형식 목록
 */
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg', // MP3
  'audio/wav', // WAV
  'audio/mp4', // M4A
  'audio/ogg', // OGG
] as const

export type AudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number]
