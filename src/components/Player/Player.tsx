import { useEffect } from 'react'
import { AppLayout } from '../Layout/AppLayout'
import { Header } from '../Layout/Header'
import { DragDropZone } from '../FileLoader/DragDropZone'
import { FileSelector } from '../FileLoader/FileSelector'
import { Waveform } from '../Waveform/Waveform'
import { PlayButton } from '../Controls/PlayButton'
import { StopButton } from '../Controls/StopButton'
import { TimeDisplay } from '../Controls/TimeDisplay'
import { VolumeSlider } from '../Volume/VolumeSlider'
import { MuteButton } from '../Volume/MuteButton'
import { ABLoopControls } from '../ABLoop/ABLoopControls'
import { ABLoopDisplay } from '../ABLoop/ABLoopDisplay'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { usePlayback } from '../../hooks/usePlayback'
import { useWaveform } from '../../hooks/useWaveform'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useFileLoader } from '../../hooks/useFileLoader'
import { useAudioStore } from '../../stores/audioStore'
import { useControlStore } from '../../stores/controlStore'
import { useLoopStore } from '../../stores/loopStore'
import { usePlayerStore } from '../../stores/playerStore'

/**
 * 메인 플레이어 컴포넌트
 *
 * 모든 컴포넌트를 통합하고 오디오 엔진 생명주크를 관리합니다.
 */
export function Player() {
  const { isReady, error, initialize, loadFile } = useAudioEngine()
  const fileName = useAudioStore((state) => state.fileName)
  const buffer = useAudioStore((state) => state.buffer)
  const volume = useControlStore((state) => state.volume)
  const muted = useControlStore((state) => state.muted)
  const setVolume = useControlStore((state) => state.setVolume)
  const toggleMute = useControlStore((state) => state.toggleMute)
  const loopA = useLoopStore((state) => state.loopA)
  const loopB = useLoopStore((state) => state.loopB)
  const loopEnabled = useLoopStore((state) => state.loopEnabled)
  const setLoopA = useLoopStore((state) => state.setLoopA)
  const setLoopB = useLoopStore((state) => state.setLoopB)
  const toggleLoop = useLoopStore((state) => state.toggleLoop)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const duration = usePlayerStore((state) => state.duration)
  const isPlaying = usePlayerStore((state) => state.isPlaying)

  // 오디오 엔진 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  const playback = usePlayback(null)
  const canPlay = !!buffer && isReady

  const { containerRef } = useWaveform()

  // 키보드 단축키
  useKeyboardShortcuts(currentTime, duration, canPlay)

  // 파일 로딩
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
      return
    }

    try {
      await loadFile(file)
    } catch (error) {
      console.error('Failed to load file:', error)
    }
  })

  const hasAudio = !!buffer

  return (
    <AppLayout>
      <Header fileName={fileName} />

      {!hasAudio ? (
        <DragDropZone
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          error={fileError || error}
        >
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 mx-auto mb-4 text-[#a0a0a0]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3-12 3 7-7m0 0a9 9 0 1118 0 9 9 0 01-18 0"
              />
            </svg>
            <p className="text-lg text-[#e0e0e0] mb-2">
              Drag & Drop Audio File
            </p>
            <p className="text-sm text-[#a0a0a0]">
              or click to select (MP3, WAV, M4A, OGG)
            </p>
          </div>
          <FileSelector
            fileInputRef={fileInputRef}
            onChange={handleFileSelect}
          />
        </DragDropZone>
      ) : (
        <div className="space-y-6">
          {/* 웨이브폼 */}
          <Waveform containerRef={containerRef} hasAudio={hasAudio} />

          {/* 컨트롤 바 */}
          <div className="bg-[#2a2a2a] rounded-lg p-6 space-y-4">
            {/* 메인 컨트롤 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <PlayButton
                  isPlaying={isPlaying}
                  onToggle={playback.togglePlayPause}
                  disabled={!canPlay}
                />
                <StopButton onStop={playback.stop} disabled={!canPlay} />
                <TimeDisplay currentTime={currentTime} duration={duration} />
              </div>

              <div className="flex items-center gap-4">
                <VolumeSlider
                  volume={volume}
                  onVolumeChange={setVolume}
                  disabled={!canPlay}
                />
                <MuteButton
                  muted={muted}
                  onToggle={toggleMute}
                  disabled={!canPlay}
                />
              </div>
            </div>

            {/* A-B 루프 컨트롤 */}
            <div className="flex items-center justify-between">
              <ABLoopControls
                loopA={loopA}
                loopB={loopB}
                loopEnabled={loopEnabled}
                onSetLoopA={() => setLoopA(currentTime)}
                onSetLoopB={() => setLoopB(currentTime)}
                onToggleLoop={toggleLoop}
                disabled={!canPlay}
              />
              <ABLoopDisplay />
            </div>
          </div>

          {/* 새 파일 로딩 버튼 */}
          <div className="text-center">
            <button
              onClick={handleClick}
              className="px-6 py-2 bg-[#2a2a2a] text-[#e0e0e0] rounded hover:bg-[#3a3a3a] transition-colors"
              aria-label="Load new audio file"
            >
              Load New File
            </button>
            <FileSelector
              fileInputRef={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>
        </div>
      )}
    </AppLayout>
  )
}
