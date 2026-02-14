import type { ApiError } from './types'

/**
 * API 기본 URL 설정
 * 환경변수 VITE_API_BASE_URL에서 가져오며, 기본값은 http://localhost:8000
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const API_PREFIX = '/api/v1'

/**
 * API 요청 에러 클래스
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorType?: string
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/**
 * API 응답 처리 공통 함수
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let errorType: string | undefined

    try {
      const errorData: ApiError = await response.json()
      errorMessage = errorData.detail
      errorType = errorData.error_type
    } catch {
      // JSON 파싱 실패 시 기본 에러 메시지 사용
    }

    throw new ApiRequestError(errorMessage, response.status, errorType)
  }

  return response.json() as Promise<T>
}

/**
 * API 클라이언트
 *
 * 백엔드 API 통신을 위한 HTTP 클라이언트입니다.
 */
export const apiClient = {
  /**
   * GET 요청
   */
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return handleResponse<T>(response)
  },

  /**
   * POST 요청
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * 전체 URL 반환 (다운로드 등에 사용)
   */
  getFullUrl(path: string): string {
    return `${BASE_URL}${API_PREFIX}${path}`
  },
}
