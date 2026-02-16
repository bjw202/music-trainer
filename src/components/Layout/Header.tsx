import { Music, AudioLines } from 'lucide-react'

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
        <div className="w-9 h-9 rounded-lg bg-[#FF6B35] flex items-center justify-center">
          <Music className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-heading font-bold tracking-wide uppercase text-[#F5F5F5]">
          Music Trainer
        </h1>
      </div>
      {fileName && (
        <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2 rounded-lg">
          <AudioLines className="w-4 h-4 text-[#9CA3AF]" aria-hidden="true" />
          <span className="text-sm font-mono text-[#9CA3AF]">{fileName}</span>
        </div>
      )}
    </header>
  )
}
