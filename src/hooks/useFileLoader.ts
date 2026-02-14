import { useState, useCallback, useRef } from 'react'
import { SUPPORTED_AUDIO_FORMATS } from '../utils/constants'

/**
 * 파일 로딩 처리 훅
 *
 * @param onFileSelect - 파일 선택 콜백 함수
 * @returns {Object} - 드래그 상태, 드래그 오버 핸들러, 드롭 핸들러, 파일 선택 핸들러, 에러
 */
export function useFileLoader(onFileSelect: (file: File) => void) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 드래그 오버 핸들러
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  /**
   * 드래그 리브 핸들러
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }, [])

  /**
   * 드롭 핸들러
   */
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragging(false)
      setError(null)

      const files = event.dataTransfer.files
      if (files.length === 0) {
        return
      }

      const file = files[0]
      const validationResult = validateAudioFile(file)

      if (!validationResult.isValid) {
        setError(validationResult.error || 'Invalid file')
        return
      }

      onFileSelect(file)
    },
    [onFileSelect]
  )

  /**
   * 파일 선택 핸들러
   */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault()
      setError(null)

      const files = event.target.files
      if (!files || files.length === 0) {
        return
      }

      const file = files[0]
      const validationResult = validateAudioFile(file)

      if (!validationResult.isValid) {
        setError(validationResult.error || 'Invalid file')
        return
      }

      onFileSelect(file)

      // 파일 입력 리셋 (동일 파일 재선택 가능)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onFileSelect]
  )

  /**
   * 파일 선택 클릭 핸들러
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleClick,
    fileInputRef,
    error,
  }
}

/**
 * 오디오 파일 유효성 검사
 */
function validateAudioFile(file: File): {
  isValid: boolean
  error?: string
} {
  // 파일 크기 검사 (최대 500MB)
  const MAX_FILE_SIZE = 500 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of 500MB`,
    }
  }

  // MIME 타입 검사
  if (!SUPPORTED_AUDIO_FORMATS.includes(file.type as any)) {
    return {
      isValid: false,
      error: `Unsupported file format: ${file.type || 'unknown'}. Supported formats: MP3, WAV, M4A, OGG`,
    }
  }

  return { isValid: true }
}
