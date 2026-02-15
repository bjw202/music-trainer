import { useEffect, useCallback, useState } from 'react'
import { AppLayout } from '../Layout/AppLayout'
import { Header } from '../Layout/Header'
import { DragDropZone } from '../FileLoader/DragDropZone'
import { FileSelector } from '../FileLoader/FileSelector'
import { LoadAudioModal } from '../FileLoader/LoadAudioModal'
import { Waveform } from '../Waveform/Waveform'
import { PlayButton } from '../Controls/PlayButton'
import { StopButton } from '../Controls/StopButton'
import { TimeDisplay } from '../Controls/TimeDisplay'
import { VolumeSlider } from '../Volume/VolumeSlider'
import { MuteButton } from '../Volume/MuteButton'
import { ABLoopControls } from '../ABLoop/ABLoopControls'
import { ABLoopDisplay } from '../ABLoop/ABLoopDisplay'
import { SpeedPitchPanel } from '../SpeedPitch'
import { YouTubeSection } from '../YouTube'
import { SeparationButton } from '../StemMixer/SeparationButton'
import { SeparationProgress } from '../StemMixer/SeparationProgress'
import { StemMixerPanel } from '../StemMixer/StemMixerPanel'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { usePlayback } from '../../hooks/usePlayback'
import { useSpeedPitch } from '../../hooks/useSpeedPitch'
import { useWaveform } from '../../hooks/useWaveform'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useFileLoader } from '../../hooks/useFileLoader'
import { useSeparation } from '../../hooks/useSeparation'
import { useAudioStore } from '../../stores/audioStore'
import { useControlStore } from '../../stores/controlStore'
import { useLoopStore } from '../../stores/loopStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useStemStore } from '../../stores/stemStore'

/**
 * 메인 플레이어 컴포넌트
 *
 * 모든 컴포넌트를 통합하고 오디오 엔진 생명주크를 관리합니다.
 */
export function Player() {
  const { engine, isReady, error, initialize, loadFile } = useAudioEngine()
  const fileName = useAudioStore((state) => state.fileName)
  const buffer = useAudioStore((state) => state.buffer)
  const file = useAudioStore((state) => state.file)
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

  // Stem 모드 상태
  const isStemMode = useStemStore((state) => state.isStemMode)
  const separationStatus = useStemStore((state) => state.separationStatus)
  const separationProgress = useStemStore((state) => state.separationProgress)
  const separationError = useStemStore((state) => state.errorMessage)
  const setStemMode = useStemStore((state) => state.setStemMode)

  // 모달 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Stem 분리 훅
  const {
    startSeparation,
    retrySeparation,
  } = useSeparation()

  /**
   * Stem 분리 시작 핸들러
   */
  const handleSeparation = useCallback(async () => {
    if (!file) {
      return
    }

    // 이미 완료된 상태면 Stem Mixer 모드로 전환
    if (separationStatus === 'completed') {
      setStemMode(true)
      return
    }

    // 분리 시작
    await startSeparation(file)
  }, [file, separationStatus, startSeparation, setStemMode])

  /**
   * Stem Mixer 모드 종료 핸들러
   */
  const handleExitStemMode = useCallback(() => {
    setStemMode(false)
  }, [setStemMode])

  // 오디오 엔진 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  const playback = usePlayback(engine)
  useSpeedPitch(engine)
  const canPlay = !!buffer && isReady

  // 파형 클릭 시 AudioEngine의 seek 호출
  const handleWaveformSeek = useCallback((time: number) => {
    if (engine) {
      console.log('[Player] Waveform seek to:', time)
      engine.seek(time)
    }
  }, [engine])

  const { setContainerRef, setCurrentTime: setWaveformTime, setLoopRegion } = useWaveform({ onSeek: handleWaveformSeek })

  // 파형 playhead 동기화
  useEffect(() => {
    setWaveformTime(currentTime)
  }, [currentTime, setWaveformTime])

  // 루프 영역 동기화
  useEffect(() => {
    setLoopRegion(loopA, loopB, loopEnabled)
  }, [loopA, loopB, loopEnabled, setLoopRegion])

  // 키보드 단축키
  useKeyboardShortcuts(currentTime, duration, canPlay, playback)

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
    console.log('[Player] onFileSelect called, isReady:', isReady)
    if (!isReady) {
      console.log('[Player] AudioEngine not ready, skipping file load')
      return
    }

    try {
      console.log('[Player] Calling loadFile')
      await loadFile(file)
    } catch (error) {
      console.error('Failed to load file:', error)
    }
  })

  const hasAudio = !!buffer

  return (
    <AppLayout>
      <Header fileName={fileName} />

      {/* YouTube URL 변환 섹션 - 오디오가 로드되지 않았을 때만 표시 */}
      {!hasAudio && (
        <div className="mb-4">
          <YouTubeSection onFileReady={loadFile} />
        </div>
      )}

      {!hasAudio ? (
        <DragDropZone
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          error={fileError || error}
        >
          <div className="text-center space-y-6">
            {/* Upload icon with gradient */}
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#818CF8] to-[#60A5FA] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-white"
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
              <p className="text-lg font-semibold text-[#F5F5F5]">
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
              className="px-6 py-3 bg-[#818CF8] text-white rounded-xl font-medium hover:bg-[#818CF8]/90 transition-colors"
            >
              Browse Files
            </button>

            {/* Format tags */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {['MP3', 'WAV', 'M4A', 'OGG'].map((format) => (
                <span
                  key={format}
                  className="px-3 py-1 bg-[#1A1A1A] text-[#9CA3AF] text-xs font-medium rounded-md"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>
          <FileSelector
            fileInputRef={fileInputRef}
            onChange={handleFileSelect}
          />
        </DragDropZone>
      ) : (
        <div className="space-y-5">
          {/* 웨이브폼 */}
          <Waveform setContainerRef={setContainerRef} hasAudio={hasAudio} />

          {/* Time display row */}
          <div className="flex items-center justify-between px-2">
            <TimeDisplay currentTime={currentTime} duration={duration} isCurrentTime />
            <TimeDisplay currentTime={duration} duration={duration} isCurrentTime={false} />
          </div>

          {/* Main controls card */}
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6">
            <div className="flex items-center justify-center gap-6">
              <StopButton onStop={playback.stop} disabled={!canPlay} />
              <PlayButton
                isPlaying={isPlaying}
                onToggle={playback.togglePlayPause}
                disabled={!canPlay}
              />
            </div>
          </div>

          {/* Volume row */}
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-4">
            <div className="flex items-center justify-center gap-4">
              <VolumeSlider
                volume={volume}
                onVolumeChange={setVolume}
                disabled={!canPlay}
              />
              <span className="text-sm font-mono text-[#9CA3AF] w-12 text-right">
                {volume}%
              </span>
              <MuteButton
                muted={muted}
                onToggle={toggleMute}
                disabled={!canPlay}
              />
            </div>
          </div>

          {/* Speed / Pitch */}
          <div className="space-y-3">
            <div className="flex items-center px-2">
              <h3 className="text-sm font-semibold text-[#F5F5F5]">Speed / Pitch</h3>
            </div>
            <SpeedPitchPanel disabled={!canPlay} />
          </div>

          {/* Stem Mixer Panel - Stem 모드일 때만 표시 */}
          {isStemMode && separationStatus === 'completed' && (
            <div className="space-y-3">
              <StemMixerPanel disabled={!canPlay} />
            </div>
          )}

          {/* A-B Loop section */}
          <div className="space-y-3">
            {/* Label row */}
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-semibold text-[#F5F5F5]">A-B Loop</h3>
              <ABLoopDisplay />
            </div>

            {/* 3-column buttons row */}
            <div className="grid grid-cols-3 gap-3">
              <ABLoopControls
                loopA={loopA}
                loopB={loopB}
                loopEnabled={loopEnabled}
                onSetLoopA={() => setLoopA(currentTime)}
                onSetLoopB={() => setLoopB(currentTime)}
                onToggleLoop={toggleLoop}
                disabled={!canPlay}
              />
            </div>
          </div>

          {/* Stem Separation section */}
          <div className="space-y-3">
            {/* Label row */}
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-semibold text-[#F5F5F5]">Stem Separation</h3>
            </div>

            {/* Separation Button */}
            <div className="flex justify-center">
              <SeparationButton onClick={handleSeparation} />
            </div>

            {/* Progress Display */}
            <SeparationProgress
              status={separationStatus}
              progress={separationProgress}
              errorMessage={separationError}
              onRetry={retrySeparation}
            />
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="text-center">
            <p className="text-xs text-[#6B7280]">
              Space: Play/Pause · ←/→: Seek · =/- : Speed · [/]: Pitch · R: Reset
            </p>
          </div>

          {/* Load New File button */}
          <div className="text-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-[#1E1E1E] text-[#F5F5F5] rounded-xl hover:bg-[#2A2A2A] transition-colors font-medium"
              aria-label="Load new audio file"
            >
              Load New File
            </button>
          </div>

          {/* Stem Mixer Mode Toggle */}
          {separationStatus === 'completed' && (
            <div className="text-center">
              {isStemMode ? (
                <button
                  onClick={handleExitStemMode}
                  className="px-6 py-2 bg-[#2A2A2A] text-[#F5F5F5] rounded-xl hover:bg-[#3A3A3A] transition-colors font-medium"
                  aria-label="Exit stem mixer mode"
                >
                  Exit Stem Mixer
                </button>
              ) : (
                <button
                  onClick={handleSeparation}
                  className="px-6 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white rounded-xl hover:from-[#7C3AED] hover:to-[#4F46E5] transition-all font-medium"
                  aria-label="Enter stem mixer mode"
                >
                  Open Stem Mixer
                </button>
              )}
            </div>
          )}

          {/* Load Audio Modal */}
          <LoadAudioModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            loadFile={loadFile}
            isReady={isReady}
          />
        </div>
      )}
    </AppLayout>
  )
}
