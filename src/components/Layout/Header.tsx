interface HeaderProps {
  fileName?: string
}

/**
 * 앱 헤더 컴포넌트
 *
 * 앱 타이틀과 선택적 파일명을 표시합니다.
 */
export function Header({ fileName }: HeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🎵</span>
        <h1 className="text-lg font-bold text-[#F5F5F5]">Music Trainer</h1>
      </div>
      {fileName && (
        <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 text-[#9CA3AF]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <span className="text-sm font-mono text-[#9CA3AF]">{fileName}</span>
        </div>
      )}
    </header>
  )
}
