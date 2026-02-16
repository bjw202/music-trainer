import { useEffect, useState, useCallback } from 'react'
import { YouTubeSection } from '../YouTube'
import { FileSelector } from './FileSelector'
import { useFileLoader } from '../../hooks/useFileLoader'
import { useAudioStore } from '../../stores/audioStore'

interface LoadAudioModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean
  /** 모달 닫기 콜백 */
  onClose: () => void
  /** 오디오 파일 로드 콜백 */
  loadFile: (file: File) => Promise<void>
  /** AudioEngine 준비 상태 */
  isReady: boolean
}

/**
 * 재생 중 새 오디오 파일을 로드하는 모달 컴포넌트
 *
 * YouTube URL 입력, Drag & Drop, 파일 선택을 지원하며
 * 파일 로드 성공 시 자동으로 닫힙니다.
 */
export function LoadAudioModal({
  isOpen,
  onClose,
  loadFile,
  isReady,
}: LoadAudioModalProps) {
  const [prevBuffer, setPrevBuffer] = useState<AudioBuffer | null>(null)
  const buffer = useAudioStore((state) => state.buffer)

  // 모달이 열릴 때 현재 버퍼를 저장
  useEffect(() => {
    if (isOpen) {
      setPrevBuffer(buffer)
    }
  }, [isOpen, buffer])

  // 버퍼가 변경되면 (새 파일 로드 성공) 모달 자동 닫기
  useEffect(() => {
    if (isOpen && buffer !== null && buffer !== prevBuffer) {
      console.log('[LoadAudioModal] Buffer changed, closing modal')
      onClose()
    }
  }, [isOpen, buffer, prevBuffer, onClose])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // body 스크롤 방지
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Backdrop 클릭으로 모달 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // 파일 로더 훅
  const {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleClick,
    fileInputRef,
    error: fileError,
  } = useFileLoader(async (file) => {
    if (!isReady) {
      console.log('[LoadAudioModal] AudioEngine not ready, skipping file load')
      return
    }

    try {
      await loadFile(file)
    } catch (error) {
      console.error('Failed to load file:', error)
    }
  })

  // 모달이 닫혀 있으면 렌더링하지 않음
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      data-testid="load-audio-modal"
    >
      <div
        className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#F5F5F5]">Load New Audio</h2>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors"
            aria-label="Close modal"
            data-testid="modal-close-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* YouTube URL 입력 섹션 */}
        <div className="mb-6">
          <YouTubeSection onFileReady={loadFile} />
        </div>

        {/* 구분선 */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1E1E1E]"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#141414] px-4 text-sm text-[#9CA3AF]">또는</span>
          </div>
        </div>

        {/* Drag & Drop 영역 (소형화) */}
        <div
          className={`
            relative w-full p-8 border-2 border-dashed rounded-xl transition-colors
            bg-[#0A0A0A] flex flex-col items-center justify-center cursor-pointer
            ${
              isDragging
                ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                : 'border-[#2A2A2A] hover:border-[#FF6B35]/50'
            }
            ${fileError ? 'border-[#FF6B6B]' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label="Drag and drop audio file or click to select"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick()
            }
          }}
        >
          <div className="text-center space-y-4">
            {/* Upload icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#FF6B35] to-[#60A5FA] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <p className="text-base font-semibold text-[#F5F5F5]">
                Drop your audio file here
              </p>
              <p className="text-sm text-[#9CA3AF]">
                or click to browse from your computer
              </p>
            </div>

            {/* Browse button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
              className="px-5 py-2 bg-[#FF6B35] text-white rounded-lg font-medium hover:bg-[#FF6B35]/90 transition-colors"
            >
              Browse Files
            </button>

            {/* Format tags */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {['MP3', 'WAV', 'M4A', 'OGG'].map((format) => (
                <span
                  key={format}
                  className="px-2 py-1 bg-[#1A1A1A] text-[#9CA3AF] text-xs font-medium rounded-md"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>

          {fileError && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-sm text-[#FF6B6B]">
              {fileError}
            </p>
          )}
        </div>

        {/* Hidden file input */}
        <FileSelector fileInputRef={fileInputRef} onChange={handleFileSelect} />
      </div>
    </div>
  )
}
