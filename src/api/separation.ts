import type { StemName } from '../stores/stemStore'

/**
 * 분리 작업 ID와 상태
 */
export interface SeparationTask {
  taskId: string
}

/**
 * 진행률 콜백 타입
 */
export type ProgressCallback = (progress: number, status: string) => void

/**
 * SSE 이벤트 타입
 */
interface SSEEvent {
  progress: number
  status: string
  stage?: string
}

/**
 * Stem 다운로드 응답 타입
 */
export interface StemDownloadResponse {
  stemName: StemName
  arrayBuffer: ArrayBuffer
}

/**
 * 모든 Stem 다운로드 응답 타입
 */
export interface AllStemsDownloadResponse {
  vocals: ArrayBuffer
  drums: ArrayBuffer
  bass: ArrayBuffer
  other: ArrayBuffer
}

/**
 * API 기본 URL
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * 엔드포인트 경로
 */
const ENDPOINTS = {
  SEPARATE: `${API_BASE_URL}/api/v1/separate`,
  PROGRESS: (taskId: string) => `${API_BASE_URL}/api/v1/separate/${taskId}/progress`,
  DOWNLOAD: (taskId: string, stemName: string) =>
    `${API_BASE_URL}/api/v1/separate/${taskId}/stems/${stemName}`,
  DOWNLOAD_ALL: (taskId: string) =>
    `${API_BASE_URL}/api/v1/separate/${taskId}/stems`,
} as const

/**
 * 오디오 파일을 업로드하고 Stem 분리 작업을 시작합니다.
 *
 * @param file - 분리할 오디오 파일
 * @returns 분리 작업 ID
 * @throws Error - 업로드 실패 시
 */
export async function uploadForSeparation(
  file: File
): Promise<SeparationTask> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(ENDPOINTS.SEPARATE, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        detail: 'Unknown error',
      }))
      throw new Error(errorData.detail || 'Failed to upload file for separation')
    }

    const data = await response.json()
    return {
      taskId: data.task_id,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload file for separation')
  }
}

/**
 * SSE를 통해 분리 진행률을 구독합니다.
 *
 * @param taskId - 분리 작업 ID
 * @param onProgress - 진행률 콜백
 * @returns 구독 취소 함수
 */
export function subscribeSeparationProgress(
  taskId: string,
  onProgress: ProgressCallback
): () => void {
  const eventSource = new EventSource(ENDPOINTS.PROGRESS(taskId))

  eventSource.onmessage = (event: MessageEvent) => {
    try {
      const data: SSEEvent = JSON.parse(event.data)
      onProgress(data.progress, data.status || 'Processing...')
    } catch (error) {
      console.error('[subscribeSeparationProgress] Failed to parse SSE event:', error)
    }
  }

  eventSource.onerror = (error) => {
    console.error('[subscribeSeparationProgress] SSE error:', error)
    eventSource.close()
  }

  // 구독 취소 함수 반환
  return () => {
    eventSource.close()
  }
}

/**
 * 특정 Stem을 다운로드합니다.
 *
 * @param taskId - 분리 작업 ID
 * @param stemName - Stem 이름
 * @returns Stem 오디오 데이터 (ArrayBuffer)
 * @throws Error - 다운로드 실패 시
 */
export async function downloadStem(
  taskId: string,
  stemName: StemName
): Promise<ArrayBuffer> {
  try {
    const response = await fetch(ENDPOINTS.DOWNLOAD(taskId, stemName))

    if (!response.ok) {
      throw new Error(`Failed to download stem: ${stemName}`)
    }

    return await response.arrayBuffer()
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to download stem: ${stemName}`)
  }
}

/**
 * 모든 Stem을 다운로드합니다.
 *
 * @param taskId - 분리 작업 ID
 * @returns 모든 Stem 오디오 데이터
 * @throws Error - 다운로드 실패 시
 */
export async function downloadAllStems(
  taskId: string
): Promise<AllStemsDownloadResponse> {
  try {
    const response = await fetch(ENDPOINTS.DOWNLOAD_ALL(taskId))

    if (!response.ok) {
      throw new Error('Failed to download stems')
    }

    // ZIP 파일로 응답받아 압축 해제
    const arrayBuffer = await response.arrayBuffer()

    // JSZip을 사용하여 압축 해제
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)

    const stems: Partial<AllStemsDownloadResponse> = {}

    // 각 stem 파일 추출
    for (const stemName of ['vocals', 'drums', 'bass', 'other'] as StemName[]) {
      const fileName = `${stemName}.wav`
      const file = zip.file(fileName)

      if (!file) {
        throw new Error(`Stem file not found: ${fileName}`)
      }

      stems[stemName] = await file.async('arraybuffer')
    }

    return stems as AllStemsDownloadResponse
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to download stems')
  }
}

/**
 * ArrayBuffer를 AudioBuffer로 디코딩합니다.
 *
 * @param arrayBuffer - 디코딩할 ArrayBuffer
 * @param audioContext - AudioContext 인스턴스
 * @returns 디코딩된 AudioBuffer
 * @throws Error - 디코딩 실패 시
 */
export async function decodeAudioBuffer(
  arrayBuffer: ArrayBuffer,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0))
  } catch (error) {
    throw new Error(`Failed to decode audio buffer: ${error}`)
  }
}

/**
 * 모든 Stem을 다운로드하고 AudioBuffer로 디코딩합니다.
 *
 * @param taskId - 분리 작업 ID
 * @param audioContext - AudioContext 인스턴스
 * @returns 디코딩된 모든 Stem AudioBuffer
 */
export async function downloadAndDecodeAllStems(
  taskId: string,
  audioContext: AudioContext
): Promise<Record<StemName, AudioBuffer>> {
  const stemsData = await downloadAllStems(taskId)

  const decodedStems: Partial<Record<StemName, AudioBuffer>> = {}

  // 병렬로 모든 stem 디코딩
  await Promise.all(
    (Object.keys(stemsData) as StemName[]).map(async (stemName) => {
      decodedStems[stemName] = await decodeAudioBuffer(
        stemsData[stemName],
        audioContext
      )
    })
  )

  return decodedStems as Record<StemName, AudioBuffer>
}
