/**
 * 키보드 단축키 상수
 */
export const KEYBOARD_SHORTCUTS = {
  SPACE: 'Space',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SET_A: 'i',
  SET_B: 'o',
  JUMP_TO_A: 'q',
  MUTE: 'm',
  SPEED_UP: '=',
  SPEED_DOWN: '-',
  PITCH_UP: ']',
  PITCH_DOWN: '[',
  RESET_SPEED_PITCH: 'r',
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

/**
 * 속도/피치 제어 상수
 */
export const SPEED_PITCH = {
  MIN_SPEED: 0.5,
  MAX_SPEED: 2.0,
  SPEED_STEP: 0.01,
  MIN_PITCH: -12,
  MAX_PITCH: 12,
  PITCH_STEP: 1,
  DEFAULT_SPEED: 1.0,
  DEFAULT_PITCH: 0,
} as const
