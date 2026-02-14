import { ReactNode } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

/**
 * 메인 앱 레이아웃 컴포넌트
 *
 * 다크 배경(#1a1a1a)과 중앙 정렬 콘텐츠를 제공합니다.
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center px-10 py-6">
      <div className="w-full max-w-4xl bg-[#141414] border border-[#1E1E1E] rounded-2xl p-8">
        {children}
      </div>
    </div>
  )
}
