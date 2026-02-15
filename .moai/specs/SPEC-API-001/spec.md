---
id: SPEC-API-001
title: Backend Foundation and YouTube Support
version: 1.1.0
status: implemented
priority: high
created: 2026-02-15
tags: backend, fastapi, youtube, yt-dlp, api, frontend-integration
related_specs:
  - SPEC-MVP-001
  - SPEC-UPDATE-001
  - SPEC-PERF-001
---

# SPEC-API-001: 백엔드 기반 구축 및 YouTube 지원

## 개요

Music Trainer 프로젝트의 Phase 3 핵심 기능으로, Python FastAPI 기반 백엔드 서버를 구축하고 YouTube URL에서 MP3 오디오를 추출하여 프론트엔드에 전달하는 전체 파이프라인을 구현한다. 프론트엔드에는 YouTube URL 입력 UI를 추가하여 사용자가 URL을 입력하면 변환 진행률을 확인하고, 완료된 오디오를 자동으로 로드하여 재생할 수 있도록 한다. 또한, 오디오가 재생 중인 상태에서 사용자가 "Load New File" 버튼을 클릭하면 YouTube URL 입력과 파일 Drag & Drop을 모두 지원하는 모달을 통해 새 오디오를 로드할 수 있다.

---

## 환경 (Environment)

### 기술 스택

**백엔드:**
- Python 3.12+
- FastAPI >= 0.129.0
- Uvicorn (ASGI 서버)
- yt-dlp >= 2026.2.4
- ffmpeg (시스템 의존성)
- Pydantic v2 (데이터 검증)

**프론트엔드 (기존):**
- React 19, TypeScript 5.x, Vite 6.x
- Tailwind CSS 4.x, Zustand
- pnpm 패키지 매니저

**인프라:**
- Docker (백엔드 컨테이너화)
- CORS 크로스 오리진 통신

### 외부 의존성

- YouTube 서비스 (동영상 접근)
- ffmpeg 바이너리 (오디오 변환)
- yt-dlp 라이브러리 (YouTube 오디오 추출)

### 제약 사항

- YouTube 서비스 정책 변경에 따른 yt-dlp 호환성 리스크
- 프론트엔드는 현재 SPA (Single Page Application) 구조이며, 백엔드와 REST API로 통신
- 대용량 오디오 파일 처리 시 서버 리소스 제한 고려 필요
- Phase 4 음원 분리(Demucs) 확장을 위한 아키텍처 설계 필수

---

## 가정 (Assumptions)

1. 사용자는 유효한 YouTube URL을 입력한다고 가정하되, 서버에서 URL 검증을 반드시 수행한다.
2. ffmpeg가 백엔드 서버 환경에 사전 설치되어 있다.
3. YouTube 동영상의 오디오 추출은 합법적인 용도(개인 학습)로 사용된다.
4. 프론트엔드-백엔드 간 통신은 동일 네트워크 또는 CORS가 허용된 환경에서 이루어진다.
5. 변환된 MP3 파일은 임시 저장 후 일정 시간 경과 시 자동 삭제된다.
6. Phase 4 Demucs 통합을 고려하여 백엔드 라우트 구조를 확장 가능하게 설계한다.

---

## 요구사항 (Requirements)

### 모듈 1: 백엔드 서버 인프라 (Backend Server Infrastructure)

#### REQ-API-001-01: FastAPI 서버 초기화

시스템은 **항상** FastAPI 기반 REST API 서버를 제공해야 한다.

- 서버는 `/api/v1` 경로 접두사를 사용한다.
- 자동 OpenAPI 문서를 `/docs` 엔드포인트에서 제공한다.
- 구조화된 JSON 로깅을 포함한다.
- 환경별 설정(개발/프로덕션)을 지원한다.

#### REQ-API-001-02: CORS 설정

시스템은 **항상** 프론트엔드 도메인에 대한 CORS를 올바르게 설정해야 한다.

- 개발 환경: `http://localhost:5173` (Vite 기본 포트)
- 프로덕션 환경: 배포 도메인 허용
- 허용 메서드: GET, POST, OPTIONS
- 허용 헤더: Content-Type, Authorization

#### REQ-API-001-03: 헬스 체크 엔드포인트

시스템은 **항상** 서버 상태를 확인할 수 있는 헬스 체크 엔드포인트를 제공해야 한다.

- `GET /api/v1/health` 엔드포인트
- 서버 상태, ffmpeg 가용성, 디스크 여유 공간 정보를 반환한다.
- 응답 시간 200ms 이내

#### REQ-API-001-04: 파일 정리 메커니즘

시스템은 **항상** 변환된 임시 파일을 자동으로 정리해야 한다.

- 생성 후 1시간 경과한 임시 파일을 자동 삭제한다.
- 백그라운드 태스크로 주기적으로 정리를 수행한다.
- 디스크 사용량이 임계치(10GB)를 초과하면 가장 오래된 파일부터 삭제한다.

### 모듈 2: YouTube URL 변환 API (YouTube URL Conversion API)

#### REQ-API-001-05: YouTube URL 검증

**WHEN** 사용자가 YouTube URL을 제출하면 **THEN** 서버는 URL 형식과 유효성을 검증해야 한다.

- 지원 형식: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`
- URL 정규식 패턴 매칭으로 형식 검증
- yt-dlp를 통한 동영상 존재 여부 확인
- 비공개/삭제된 동영상에 대한 명확한 에러 메시지 반환

#### REQ-API-001-06: 오디오 추출 및 변환

**WHEN** 유효한 YouTube URL이 검증되면 **THEN** 서버는 yt-dlp + ffmpeg로 MP3 오디오를 추출해야 한다.

- yt-dlp Python API를 `run_in_executor`로 비동기 실행한다.
- MP3 포맷, 192kbps 비트레이트로 추출한다.
- 최대 동영상 길이 제한: 30분
- 추출된 파일을 임시 디렉토리에 저장한다.
- 동시 변환 작업 수 제한: 최대 5개

#### REQ-API-001-07: 변환 진행률 스트리밍

**WHEN** 오디오 변환이 진행 중이면 **THEN** 서버는 SSE(Server-Sent Events)로 진행률을 실시간 전송해야 한다.

- `GET /api/v1/youtube/progress/{task_id}` SSE 엔드포인트
- 진행률 데이터: 퍼센트(%), 현재 단계(다운로드/변환), 예상 남은 시간
- 변환 완료 시 다운로드 URL 포함 이벤트 전송
- 에러 발생 시 에러 이벤트 전송

#### REQ-API-001-08: 오디오 파일 제공

**WHEN** 변환이 완료되면 **THEN** 서버는 변환된 MP3 파일을 다운로드할 수 있는 엔드포인트를 제공해야 한다.

- `GET /api/v1/youtube/download/{task_id}` 엔드포인트
- Content-Type: audio/mpeg 헤더 설정
- StreamingResponse로 대용량 파일 전송
- 파일 만료(1시간) 후 404 반환

#### REQ-API-001-09: 보안 및 요율 제한

시스템은 **항상** 악의적 사용을 방지하기 위한 보안 조치를 적용해야 한다.

- IP 기반 요율 제한: 분당 10회 변환 요청
- URL 화이트리스트 검증 (YouTube 도메인만 허용)
- 입력 파라미터 크기 제한
- 타임아웃: 변환 작업당 최대 5분

### 모듈 3: 프론트엔드 YouTube 입력 UI (Frontend YouTube Input UI)

#### REQ-API-001-10: YouTube URL 입력 컴포넌트

시스템은 **항상** YouTube URL을 입력할 수 있는 직관적인 UI 컴포넌트를 제공해야 한다.

- URL 입력 필드 (placeholder: "YouTube URL을 붙여넣으세요")
- "변환" 버튼
- 기존 다크 테마(Logic Pro / Ableton 스타일)와 일관된 디자인
- UI 디자인은 Pencil MCP 도구를 사용하여 `.pen` 파일로 작성

#### REQ-API-001-11: 변환 진행률 표시

**WHEN** YouTube 변환이 진행 중이면 **THEN** 프론트엔드는 실시간 진행률을 표시해야 한다.

- 프로그레스 바 또는 퍼센트 텍스트 표시
- 현재 단계 표시 (다운로드 중 / 변환 중 / 완료)
- 변환 취소 버튼
- 로딩 애니메이션

#### REQ-API-001-12: 에러 상태 표시

**IF** 변환 과정에서 에러가 발생하면 **THEN** 시스템은 사용자에게 명확한 에러 메시지를 표시해야 한다.

- 에러 유형별 메시지: 잘못된 URL, 네트워크 오류, 서버 오류, 지원되지 않는 동영상
- 재시도 버튼 제공
- 에러 상태에서 UI가 차단되지 않아야 함 (다른 기능 사용 가능)

#### REQ-API-001-13: 변환 완료 후 자동 로드

**WHEN** YouTube 오디오 변환이 완료되면 **THEN** 프론트엔드는 변환된 오디오를 자동으로 로드하고 재생 준비 상태로 전환해야 한다.

- 변환 완료 시 자동으로 오디오 파일 다운로드
- 기존 AudioEngine에 오디오 버퍼 로드
- 파형(Waveform) 렌더링 자동 시작
- 사용자 개입 없이 재생 준비 완료

#### REQ-API-001-17: 재생 중 파일 교체 모달

**WHEN** 오디오가 재생 중인 상태에서 사용자가 "Load New File" 버튼을 클릭하면 **THEN** 시스템은 새 오디오를 로드할 수 있는 모달을 표시해야 한다.

- 모달은 YouTube URL 입력 섹션과 파일 Drag & Drop 영역을 모두 포함한다.
- YouTube URL 입력은 기존 YouTubeSection 컴포넌트를 재사용한다.
- 파일 Drag & Drop은 MP3, WAV, M4A, OGG 형식을 지원한다.
- 파일 브라우저 버튼을 제공한다.
- 기존 다크 테마와 일관된 디자인을 적용한다.

#### REQ-API-001-18: 모달 상호작용

시스템은 **항상** 모달에 대한 표준적인 닫기 상호작용을 지원해야 한다.

- ESC 키로 모달 닫기
- 모달 외부(Backdrop) 클릭으로 닫기
- 닫기(X) 버튼 제공
- 모달 열림 시 body 스크롤 방지

#### REQ-API-001-19: 파일 로드 후 자동 닫기

**WHEN** 모달을 통해 새 오디오 파일이 성공적으로 로드되면 **THEN** 모달은 자동으로 닫히고 새 오디오가 재생 준비 상태로 전환되어야 한다.

- 오디오 버퍼 변경 감지를 통한 자동 닫기
- 새 파일은 기존 AudioEngine.loadFile()을 통해 로드
- 파형(Waveform) 자동 업데이트

### 모듈 4: 프론트엔드-백엔드 통합 (Frontend-Backend Integration)

#### REQ-API-001-14: API 클라이언트 모듈

시스템은 **항상** 백엔드와의 통신을 담당하는 타입 안전한 API 클라이언트를 제공해야 한다.

- Fetch API 기반 HTTP 클라이언트
- TypeScript 타입 정의로 요청/응답 타입 보장
- 베이스 URL 환경 변수 설정 (`VITE_API_BASE_URL`)
- 공통 에러 처리 및 재시도 로직

#### REQ-API-001-15: SSE 클라이언트

**WHEN** 변환 작업이 시작되면 **THEN** 프론트엔드는 EventSource API로 SSE 스트림에 연결하여 진행률을 수신해야 한다.

- EventSource를 통한 SSE 연결
- 진행률 이벤트 수신 및 상태 업데이트
- 연결 끊김 시 자동 재연결 (최대 3회)
- 변환 완료/에러 이벤트 처리

#### REQ-API-001-16: YouTube 상태 관리

시스템은 **항상** YouTube 변환과 관련된 상태를 Zustand 스토어로 관리해야 한다.

- youtubeStore: URL, 변환 상태(idle/loading/converting/complete/error), 진행률, 에러 메시지, 태스크 ID
- 기존 audioStore/playerStore와의 연동
- 변환 완료 시 audioStore에 오디오 데이터 자동 전달

---

## 명세 (Specifications)

### API 엔드포인트 명세

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| GET | `/api/v1/health` | 서버 헬스 체크 | - | `{ status, ffmpeg, disk_space }` |
| POST | `/api/v1/youtube/convert` | YouTube URL 변환 시작 | `{ url: string }` | `{ task_id: string, status: string }` |
| GET | `/api/v1/youtube/progress/{task_id}` | 변환 진행률 (SSE) | - | SSE 스트림 |
| GET | `/api/v1/youtube/download/{task_id}` | 변환된 오디오 다운로드 | - | audio/mpeg 스트림 |

### 디렉토리 구조

```
backend/
  app/
    __init__.py
    main.py                  # FastAPI 앱 진입점, CORS, 라이프사이클
    config.py                # 환경 설정 (Pydantic Settings)
    routes/
      __init__.py
      health.py              # 헬스 체크 라우트
      youtube.py             # YouTube 변환 라우트
    services/
      __init__.py
      youtube_service.py     # yt-dlp 래퍼, 변환 로직
      cleanup_service.py     # 임시 파일 정리
    models/
      __init__.py
      schemas.py             # Pydantic 요청/응답 스키마
    utils/
      __init__.py
      validators.py          # URL 검증 유틸리티
      rate_limiter.py        # 요율 제한
  tests/
    __init__.py
    conftest.py
    test_health.py
    test_youtube_api.py
    test_youtube_service.py
  requirements.txt
  Dockerfile
  .env.example

src/
  api/
    client.ts                # API 클라이언트 모듈
    youtube.ts               # YouTube API 호출 함수
    types.ts                 # API 타입 정의
  components/
    YouTubeInput/
      YouTubeInput.tsx       # YouTube URL 입력 컴포넌트
      ProgressBar.tsx        # 변환 진행률 바
      ErrorDisplay.tsx       # 에러 표시 컴포넌트
      index.ts
    FileLoader/
      LoadAudioModal.tsx     # 재생 중 새 오디오 로드 모달
  stores/
    youtubeStore.ts          # YouTube 변환 상태 관리
  hooks/
    useYouTubeConvert.ts     # YouTube 변환 훅
```

### 비기능 요구사항

- **성능**: YouTube 오디오 변환 시간 3분 이내 (5분 미만 동영상 기준)
- **가용성**: 서버 가동 시간 99% 이상
- **확장성**: Phase 4 Demucs 음원 분리 라우트 추가가 코드 수정 최소화로 가능
- **보안**: OWASP Top 10 보안 가이드라인 준수

---

## 추적성 (Traceability)

| 요구사항 ID | 모듈 | 관련 파일 | 테스트 |
|------------|------|----------|--------|
| REQ-API-001-01 | 모듈 1 | `backend/app/main.py` | `test_health.py` |
| REQ-API-001-02 | 모듈 1 | `backend/app/main.py` | `test_health.py` |
| REQ-API-001-03 | 모듈 1 | `backend/app/routes/health.py` | `test_health.py` |
| REQ-API-001-04 | 모듈 1 | `backend/app/services/cleanup_service.py` | `test_youtube_service.py` |
| REQ-API-001-05 | 모듈 2 | `backend/app/utils/validators.py` | `test_youtube_api.py` |
| REQ-API-001-06 | 모듈 2 | `backend/app/services/youtube_service.py` | `test_youtube_service.py` |
| REQ-API-001-07 | 모듈 2 | `backend/app/routes/youtube.py` | `test_youtube_api.py` |
| REQ-API-001-08 | 모듈 2 | `backend/app/routes/youtube.py` | `test_youtube_api.py` |
| REQ-API-001-09 | 모듈 2 | `backend/app/utils/rate_limiter.py` | `test_youtube_api.py` |
| REQ-API-001-10 | 모듈 3 | `src/components/YouTubeInput/` | E2E 테스트 |
| REQ-API-001-11 | 모듈 3 | `src/components/YouTubeInput/ProgressBar.tsx` | E2E 테스트 |
| REQ-API-001-12 | 모듈 3 | `src/components/YouTubeInput/ErrorDisplay.tsx` | E2E 테스트 |
| REQ-API-001-13 | 모듈 3 | `src/hooks/useYouTubeConvert.ts` | E2E 테스트 |
| REQ-API-001-14 | 모듈 4 | `src/api/client.ts` | 단위 테스트 |
| REQ-API-001-15 | 모듈 4 | `src/api/youtube.ts` | 단위 테스트 |
| REQ-API-001-16 | 모듈 4 | `src/stores/youtubeStore.ts` | 단위 테스트 |
| REQ-API-001-17 | 모듈 3 | `src/components/FileLoader/LoadAudioModal.tsx` | E2E 테스트 |
| REQ-API-001-18 | 모듈 3 | `src/components/FileLoader/LoadAudioModal.tsx` | E2E 테스트 |
| REQ-API-001-19 | 모듈 3 | `src/components/FileLoader/LoadAudioModal.tsx` | E2E 테스트 |
