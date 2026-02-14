import { useState, useCallback } from 'react'
import { isValidYouTubeUrl } from '../../api/youtube'

interface YouTubeInputProps {
  /** 변환 중 여부 (true일 때 입력 비활성화) */
  disabled: boolean
  /** 변환 시작 콜백 */
  onConvert: (url: string) => void
}

/**
 * YouTube URL 입력 컴포넌트
 *
 * URL 입력 필드와 변환 버튼을 제공합니다.
 * 클라이언트 측 URL 유효성 검사를 수행합니다.
 */
export function YouTubeInput({ disabled, onConvert }: YouTubeInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      const trimmed = inputValue.trim()
      if (!trimmed) {
        setValidationError('URL을 입력해 주세요')
        return
      }

      if (!isValidYouTubeUrl(trimmed)) {
        setValidationError('유효한 YouTube URL을 입력해 주세요')
        return
      }

      setValidationError(null)
      onConvert(trimmed)
    },
    [inputValue, onConvert]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setValidationError(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 키보드 단축키와 충돌 방지: input 내 키 이벤트 전파 차단
      e.stopPropagation()
    },
    []
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="YouTube URL을 입력하세요"
          disabled={disabled}
          className="flex-1 h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-base placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="YouTube URL 입력"
          data-testid="youtube-url-input"
        />
        <button
          type="submit"
          disabled={disabled || !inputValue.trim()}
          className="h-10 px-5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          aria-label="YouTube 변환 시작"
          data-testid="youtube-convert-button"
        >
          변환
        </button>
      </div>

      {validationError && (
        <p className="text-sm text-red-400" role="alert">
          {validationError}
        </p>
      )}
    </form>
  )
}
