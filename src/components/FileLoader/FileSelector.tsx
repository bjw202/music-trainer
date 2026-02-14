interface FileSelectorProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  accept?: string
}

/**
 * 파일 선택 컴포넌트
 *
 * 숨겨진 파일 입력 엘리먼트를 제공합니다.
 */
export function FileSelector({
  fileInputRef,
  onChange,
  accept = 'audio/*',
}: FileSelectorProps) {
  return (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept}
      onChange={onChange}
      className="hidden"
      aria-label="Select audio file"
      data-testid="file-input"
    />
  )
}
