/**
 * 초 단위 시간을 mm:ss 형식으로 변환합니다
 * @param seconds - 초 단위 시간 (음수는 절대값으로 처리)
 * @returns mm:ss 형식의 문자열
 * @example
 * formatTime(0) // "0:00"
 * formatTime(65) // "1:05"
 * formatTime(3661) // "61:01"
 */
export function formatTime(seconds: number): string {
  const absSeconds = Math.abs(seconds)
  const totalMinutes = Math.floor(absSeconds / 60)
  const remainingSeconds = Math.floor(absSeconds % 60)
  return `${totalMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
