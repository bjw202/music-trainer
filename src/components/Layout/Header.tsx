import { audioStore } from '../../stores/audioStore'

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
    <header className="mb-8 text-center">
      <h1 className="text-4xl font-bold text-[#e0e0e0] mb-2">Music Trainer</h1>
      {fileName && (
        <p className="text-sm text-[#a0a0a0]">Loading: {fileName}</p>
      )}
    </header>
  )
}
