import { YouTubeInput } from './YouTubeInput'
import { ProgressBar } from './ProgressBar'
import { ErrorDisplay } from './ErrorDisplay'
import { useYouTubeConvert } from '../../hooks/useYouTubeConvert'

interface YouTubeSectionProps {
  /** 변환된 오디오 파일을 AudioEngine에 로드하는 콜백 */
  onFileReady?: (file: File) => Promise<void>
}

/**
 * YouTube 변환 섹션 컨테이너 컴포넌트
 *
 * YouTubeInput, ProgressBar, ErrorDisplay를 조합하여
 * YouTube 변환 상태에 따라 적절한 UI를 조건부 렌더링합니다.
 */
export function YouTubeSection({ onFileReady }: YouTubeSectionProps) {
  const { status, progress, stage, error, convertUrl, cancelConversion } =
    useYouTubeConvert(onFileReady)

  const isConverting = status === 'loading' || status === 'converting'

  return (
    <div className="space-y-3" data-testid="youtube-section">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-1">
        {/* YouTube 아이콘 */}
        <svg
          className="w-4 h-4 text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-100">YouTube</h3>
      </div>

      {/* URL 입력 */}
      <YouTubeInput disabled={isConverting} onConvert={convertUrl} />

      {/* 진행률 표시 (loading 또는 converting 상태) */}
      {isConverting && (
        <ProgressBar
          progress={progress}
          stage={stage}
          onCancel={cancelConversion}
        />
      )}

      {/* 에러 표시 */}
      {status === 'error' && error && (
        <ErrorDisplay
          message={error}
          onRetry={cancelConversion}
        />
      )}
    </div>
  )
}
