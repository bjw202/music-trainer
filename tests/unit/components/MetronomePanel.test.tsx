/**
 * MetronomePanel 컴포넌트 테스트
 *
 * TDD - RED Phase: UI 컴포넌트 테스트 정의
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetronomePanel } from '@/components/Metronome/MetronomePanel'
import { useBpmStore } from '@/stores/bpmStore'

// bpmStore 모킹
vi.mock('@/stores/bpmStore', () => ({
  useBpmStore: vi.fn(),
}))

describe('MetronomePanel', () => {
  const mockToggleMetronome = vi.fn()
  const mockSetMetronomeVolume = vi.fn()
  const mockAnalyzeBpm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        bpm: null,
        beats: [],
        confidence: null,
        isAnalyzing: false,
        analysisError: null,
        metronomeEnabled: false,
        metronomeVolume: 50,
        toggleMetronome: mockToggleMetronome,
        setMetronomeVolume: mockSetMetronomeVolume,
        analyzeBpm: mockAnalyzeBpm,
      }
      return selector(state)
    })
  })

  describe('BPM 표시', () => {
    it('BPM이 없으면 "— — —"을 표시해야 한다', () => {
      render(<MetronomePanel disabled={false} file={null} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('BPM이 있으면 값을 표시해야 한다', () => {
      ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          bpm: 120.0,
          beats: [0.5, 1.0, 1.5],
          confidence: 0.92,
          isAnalyzing: false,
          analysisError: null,
          metronomeEnabled: false,
          metronomeVolume: 50,
          toggleMetronome: mockToggleMetronome,
          setMetronomeVolume: mockSetMetronomeVolume,
          analyzeBpm: mockAnalyzeBpm,
        }
        return selector(state)
      })

      render(<MetronomePanel disabled={false} file={null} />)

      expect(screen.getByText('120')).toBeInTheDocument()
    })
  })

  describe('분석 버튼', () => {
    it('파일이 없으면 분석 버튼이 비활성화되어야 한다', () => {
      render(<MetronomePanel disabled={false} file={null} />)

      const analyzeButton = screen.getByRole('button', { name: /분석/i })
      expect(analyzeButton).toBeDisabled()
    })

    it('파일이 있으면 분석 버튼이 활성화되어야 한다', () => {
      const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
      render(<MetronomePanel disabled={false} file={mockFile} />)

      const analyzeButton = screen.getByRole('button', { name: /분석/i })
      expect(analyzeButton).toBeEnabled()
    })

    it('분석 중이면 스피너를 표시해야 한다', () => {
      ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          bpm: null,
          beats: [],
          confidence: null,
          isAnalyzing: true,
          analysisError: null,
          metronomeEnabled: false,
          metronomeVolume: 50,
          toggleMetronome: mockToggleMetronome,
          setMetronomeVolume: mockSetMetronomeVolume,
          analyzeBpm: mockAnalyzeBpm,
        }
        return selector(state)
      })

      render(<MetronomePanel disabled={false} file={null} />)

      // 스피너 존재 확인 (animate-spin 클래스)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('메트로놈 토글', () => {
    it('토글 버튼을 클릭하면 toggleMetronome이 호출되어야 한다', () => {
      // BPM이 있어야 토글 버튼이 활성화됨
      ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          bpm: 120.0,
          beats: [0.5, 1.0, 1.5],
          confidence: null,
          isAnalyzing: false,
          analysisError: null,
          metronomeEnabled: false,
          metronomeVolume: 50,
          toggleMetronome: mockToggleMetronome,
          setMetronomeVolume: mockSetMetronomeVolume,
          analyzeBpm: mockAnalyzeBpm,
        }
        return selector(state)
      })

      render(<MetronomePanel disabled={false} file={null} />)

      const toggleButton = screen.getByRole('button', { name: /메트로놈/i })
      fireEvent.click(toggleButton)

      expect(mockToggleMetronome).toHaveBeenCalled()
    })

    it('disabled가 true면 토글 버튼이 비활성화되어야 한다', () => {
      render(<MetronomePanel disabled={true} file={null} />)

      const toggleButton = screen.getByRole('button', { name: /메트로놈/i })
      expect(toggleButton).toBeDisabled()
    })
  })

  describe('볼륨 슬라이더', () => {
    it('볼륨 슬라이더가 렌더링되어야 한다', () => {
      render(<MetronomePanel disabled={false} file={null} />)

      const volumeSlider = screen.getByRole('slider')
      expect(volumeSlider).toBeInTheDocument()
    })

    it('볼륨 변경 시 setMetronomeVolume이 호출되어야 한다', () => {
      render(<MetronomePanel disabled={false} file={null} />)

      const volumeSlider = screen.getByRole('slider')
      fireEvent.change(volumeSlider, { target: { value: '75' } })

      expect(mockSetMetronomeVolume).toHaveBeenCalledWith(75)
    })
  })

  describe('신뢰도 표시', () => {
    it('confidence가 있으면 퍼센트로 표시해야 한다', () => {
      ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          bpm: 120.0,
          beats: [0.5, 1.0, 1.5],
          confidence: 0.92,
          isAnalyzing: false,
          analysisError: null,
          metronomeEnabled: false,
          metronomeVolume: 50,
          toggleMetronome: mockToggleMetronome,
          setMetronomeVolume: mockSetMetronomeVolume,
          analyzeBpm: mockAnalyzeBpm,
        }
        return selector(state)
      })

      render(<MetronomePanel disabled={false} file={null} />)

      // "신뢰도: 92%" 텍스트가 포함되어 있는지 확인 (텍스트가 분리되어 있으므로 정규식 사용)
      expect(screen.getByText(/신뢰도:.*92%/)).toBeInTheDocument()
    })
  })

  describe('에러 표시', () => {
    it('에러가 있으면 표시해야 한다', () => {
      ;(useBpmStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
        const state = {
          bpm: null,
          beats: [],
          confidence: null,
          isAnalyzing: false,
          analysisError: 'BPM 분석 실패',
          metronomeEnabled: false,
          metronomeVolume: 50,
          toggleMetronome: mockToggleMetronome,
          setMetronomeVolume: mockSetMetronomeVolume,
          analyzeBpm: mockAnalyzeBpm,
        }
        return selector(state)
      })

      render(<MetronomePanel disabled={false} file={null} />)

      expect(screen.getByText(/BPM 분석 실패/i)).toBeInTheDocument()
    })
  })
})
