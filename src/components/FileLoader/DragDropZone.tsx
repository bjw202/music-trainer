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
        relative w-full h-[420px] p-12 border-2 border-dashed rounded-[20px] transition-colors
        bg-[#141414] flex flex-col items-center justify-center
        ${
          isDragging
            ? 'border-[#818CF8] bg-[#818CF8]/10'
            : 'border-[#2A2A2A] hover:border-[#818CF8]/50'
        }
        ${error ? 'border-[#FF6B6B]' : ''}
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
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-[#FF6B6B]">
          {error}
        </p>
      )}
    </div>
  )
}
