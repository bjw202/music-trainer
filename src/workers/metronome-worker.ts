/**
 * Metronome Web Worker
 *
 * 25ms 간격으로 tick 메시지를 메인 스레드로 전송합니다.
 * 백그라운드 탭에서도 Chrome의 setTimeout 쓰로틀링(1000ms)의
 * 영향을 받지 않습니다.
 *
 * 메시지 프로토콜:
 * - 수신: 'start' | 'stop'
 * - 송신: 'tick'
 */

const LOOKAHEAD_MS = 25

let timerID: ReturnType<typeof setTimeout> | null = null

/**
 * 메시지 핸들러
 */
self.onmessage = (e: MessageEvent<string>) => {
  const message = e.data

  if (message === 'start') {
    // 이미 실행 중이면 무시
    if (timerID !== null) return

    const tick = () => {
      self.postMessage('tick')
      timerID = setTimeout(tick, LOOKAHEAD_MS)
    }
    tick()
  } else if (message === 'stop') {
    if (timerID !== null) {
      clearTimeout(timerID)
      timerID = null
    }
  }
}

// TypeScript 워커 타입 선언
export type {}
