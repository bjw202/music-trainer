interface DragDropZoneProps {
  isDragging: boolean
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onClick: () => void
  error?: string | null
  children: React.ReactNode
}

/**
 * 드래그 앤 드롭 존 컴포넌트
 *
 * 오디오 파일을 드래그 앤 드롭하거나 클릭하여 선택할 수 있습니다.
 */
export function DragDropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  error,
  children,
}: DragDropZoneProps) {
  return (
    <div
      className={`
        relative w-full p-12 border-2 border-dashed rounded-lg transition-colors
        ${
          isDragging
            ? 'border-[#007aff] bg-[#007aff]/10'
            : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
        }
        ${error ? 'border-[#ff3b30]' : ''}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Drag and drop audio file or click to select"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {children}
      {error && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-sm text-[#ff3b30]">
          {error}
        </p>
      )}
    </div>
  )
}
