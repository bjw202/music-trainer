/**
 * 파일 객체에서 확장자를 제거한 파일명을 추출합니다
 * @param file - File 객체
 * @returns 확장자가 제거된 파일명
 * @example
 * const file = new File([''], 'song.mp3')
 * getFileName(file) // 'song'
 */
export function getFileName(file: File): string {
  const fileName = file.name
  const lastDotIndex = fileName.lastIndexOf('.')
  // 확장자가 없거나, 파일명이 '.'으로 시작하는 경우 처리
  if (lastDotIndex <= 0) {
    return fileName
  }
  return fileName.substring(0, lastDotIndex)
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환합니다
 * @param file - File 객체
 * @returns 포맷된 파일 크기 문자열 (예: "3.5 MB")
 * @example
 * const file = new File(['x'.repeat(1024 * 1024 * 3)], 'test.mp3')
 * getFileSize(file) // "3 MB"
 */
export function getFileSize(file: File): string {
  const bytes = file.size

  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB'] as const
  const threshold = 1024

  let unitIndex = 0
  let size = bytes

  while (size >= threshold && unitIndex < units.length - 1) {
    size /= threshold
    unitIndex++
  }

  // B 단위는 소수점 없이, 그 외 단위는 소수점 한 자리
  const formattedSize =
    unitIndex === 0 ? Math.floor(size) : size.toFixed(1)

  return `${formattedSize} ${units[unitIndex]}`
}
