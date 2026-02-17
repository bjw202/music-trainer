/**
 * BPM API 클라이언트 테스트
 *
 * TDD - RED Phase: API 클라이언트 테스트 정의
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { analyzeBpm, type BpmAnalysisResponse } from '@/api/bpm'

describe('BPM API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('analyzeBpm', () => {
    it('오디오 파일을 업로드하고 BPM 분석 결과를 반환해야 한다', async () => {
      // Mock response
      const mockResponse: BpmAnalysisResponse = {
        bpm: 120.0,
        beats: [0.5, 1.0, 1.5, 2.0],
        confidence: 0.92,
        file_hash: 'abc123',
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
      const result = await analyzeBpm(file)

      expect(result.bpm).toBe(120.0)
      expect(result.beats).toEqual([0.5, 1.0, 1.5, 2.0])
      expect(result.confidence).toBe(0.92)
      expect(result.file_hash).toBe('abc123')

      // FormData 사용 확인
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bpm/analyze'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      )

      vi.unstubAllGlobals()
    })

    it('API 에러 시 에러를 throw해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'BPM 분석 실패' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })

      await expect(analyzeBpm(file)).rejects.toThrow()

      vi.unstubAllGlobals()
    })

    it('지원하지 않는 파일 형식 시 400 에러를 throw해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: '지원하지 않는 형식입니다' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['text'], 'test.txt', { type: 'text/plain' })

      await expect(analyzeBpm(file)).rejects.toThrow()

      vi.unstubAllGlobals()
    })

    it('파일 크기 초과 시 413 에러를 throw해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: () => Promise.resolve({ detail: '파일이 너무 큽니다' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      // 큰 파일 시뮬레이션 (실제 데이터 없이 이름만 사용)
      const file = new File([''], 'large.mp3', { type: 'audio/mpeg' })
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 })

      await expect(analyzeBpm(file)).rejects.toThrow('파일이 너무 큽니다')

      vi.unstubAllGlobals()
    })
  })
})
