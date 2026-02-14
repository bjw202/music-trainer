---
id: SPEC-API-001
type: plan
version: 1.0.0
---

# SPEC-API-001: 구현 계획

## 개요

백엔드 서버 구축부터 프론트엔드 통합까지의 전체 구현 계획. 태스크 간 의존성을 고려하여 백엔드 인프라 > API 엔드포인트 > 프론트엔드 UI > 통합 테스트 순서로 진행한다.

---

## 기술 스택 및 버전

### 백엔드

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Python | >= 3.12 | 런타임 |
| FastAPI | >= 0.129.0 | 웹 프레임워크 |
| Uvicorn | >= 0.34.0 | ASGI 서버 |
| yt-dlp | >= 2026.2.4 | YouTube 오디오 추출 |
| Pydantic | >= 2.9 | 데이터 검증 |
| pydantic-settings | >= 2.7 | 환경 설정 관리 |
| python-multipart | >= 0.0.19 | 멀티파트 폼 데이터 |
| sse-starlette | >= 2.2 | SSE 응답 지원 |
| httpx | >= 0.28 | 비동기 HTTP 클라이언트 (테스트) |
| pytest | >= 8.3 | 테스트 프레임워크 |
| pytest-asyncio | >= 0.25 | 비동기 테스트 |

### 프론트엔드 (추가 의존성)

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| 기존 스택 유지 | - | React 19, TypeScript 5.x, Vite 6.x, Zustand |

### 시스템 의존성

| 도구 | 버전 | 용도 |
|------|------|------|
| ffmpeg | >= 6.0 | 오디오 인코딩/디코딩 |
| Docker | >= 24.0 | 컨테이너화 |

---

## 마일스톤

### 최우선 목표: 백엔드 서버 인프라 구축

**태스크 1.1: 프로젝트 초기화**
- `backend/` 디렉토리 구조 생성
- `requirements.txt` 작성 (버전 고정)
- FastAPI 앱 진입점 (`main.py`) 생성
- Pydantic Settings 기반 환경 설정 (`config.py`)
- `.env.example` 파일 생성
- 관련 요구사항: REQ-API-001-01

**태스크 1.2: CORS 및 미들웨어 설정**
- FastAPI CORS 미들웨어 설정
- 요청/응답 로깅 미들웨어
- 에러 핸들러 (전역 예외 처리)
- 관련 요구사항: REQ-API-001-02

**태스크 1.3: 헬스 체크 엔드포인트**
- `GET /api/v1/health` 라우트 구현
- ffmpeg 가용성 확인 로직
- 디스크 여유 공간 확인 로직
- 관련 요구사항: REQ-API-001-03

**태스크 1.4: Dockerfile 작성**
- Python 3.12-slim 기반 이미지
- ffmpeg 설치 포함
- 멀티 스테이지 빌드로 이미지 최적화
- docker-compose.yml (개발 환경용)

**태스크 1.5: 임시 파일 정리 서비스**
- 백그라운드 태스크 기반 파일 정리
- 1시간 경과 파일 자동 삭제
- 디스크 임계치 초과 시 강제 정리
- 관련 요구사항: REQ-API-001-04

### 주요 목표: YouTube 변환 API 구현

의존성: 최우선 목표 완료 필요

**태스크 2.1: URL 검증 유틸리티**
- YouTube URL 정규식 패턴 매칭
- 지원 형식: `youtube.com/watch`, `youtu.be`, `youtube.com/shorts`
- yt-dlp를 통한 동영상 존재 여부 확인
- 단위 테스트 작성
- 관련 요구사항: REQ-API-001-05

**태스크 2.2: YouTube 변환 서비스**
- yt-dlp Python API 래핑 (`youtube_service.py`)
- `run_in_executor`로 비동기 실행
- MP3 192kbps 변환
- 진행률 콜백 구현
- 동영상 길이 제한 (30분) 검증
- 동시 변환 수 제한 (세마포어 5개)
- 관련 요구사항: REQ-API-001-06

**태스크 2.3: 변환 API 엔드포인트**
- `POST /api/v1/youtube/convert` 구현
- `GET /api/v1/youtube/progress/{task_id}` SSE 구현
- `GET /api/v1/youtube/download/{task_id}` 구현
- Pydantic 요청/응답 스키마 정의
- 관련 요구사항: REQ-API-001-07, REQ-API-001-08

**태스크 2.4: 보안 및 요율 제한**
- IP 기반 요율 제한 (분당 10회)
- URL 도메인 화이트리스트
- 입력 파라미터 크기 제한
- 타임아웃 설정 (5분)
- 관련 요구사항: REQ-API-001-09

**태스크 2.5: 백엔드 테스트**
- 헬스 체크 API 테스트
- URL 검증 단위 테스트
- YouTube 변환 서비스 테스트 (mocking)
- API 통합 테스트
- pytest + httpx AsyncClient 활용

### 보조 목표: 프론트엔드 YouTube 입력 UI

의존성: 주요 목표의 API 스키마 확정 필요

**태스크 3.1: Pencil MCP UI 디자인**
- YouTubeInput 컴포넌트 디자인 (`.pen` 파일)
- 프로그레스 바 디자인
- 에러 상태 디자인
- 기존 다크 테마(Logic Pro / Ableton 스타일) 일관성 확보
- Pencil MCP 도구를 사용하여 디자인 파일 생성

**태스크 3.2: YouTubeInput 컴포넌트 구현**
- URL 입력 필드 + 변환 버튼
- 입력 검증 (클라이언트 사이드)
- 반응형 디자인
- 관련 요구사항: REQ-API-001-10

**태스크 3.3: 진행률 표시 컴포넌트**
- ProgressBar 컴포넌트
- 단계 표시 (다운로드 / 변환 / 완료)
- 변환 취소 기능
- 관련 요구사항: REQ-API-001-11

**태스크 3.4: 에러 표시 컴포넌트**
- ErrorDisplay 컴포넌트
- 에러 유형별 메시지 분기
- 재시도 버튼
- 관련 요구사항: REQ-API-001-12

### 최종 목표: 프론트엔드-백엔드 통합

의존성: 주요 목표 + 보조 목표 완료 필요

**태스크 4.1: API 클라이언트 모듈**
- `src/api/client.ts` 기본 HTTP 클라이언트
- `src/api/youtube.ts` YouTube API 호출 함수
- `src/api/types.ts` TypeScript 타입 정의
- 환경 변수 기반 베이스 URL 설정
- 관련 요구사항: REQ-API-001-14

**태스크 4.2: SSE 클라이언트 구현**
- EventSource 기반 SSE 연결
- 진행률 이벤트 파싱 및 상태 업데이트
- 자동 재연결 로직 (최대 3회)
- 관련 요구사항: REQ-API-001-15

**태스크 4.3: YouTube 상태 관리 스토어**
- `youtubeStore.ts` Zustand 스토어 생성
- 상태: idle / loading / converting / complete / error
- audioStore와의 연동 (변환 완료 시 자동 로드)
- 관련 요구사항: REQ-API-001-16

**태스크 4.4: 자동 오디오 로드 통합**
- 변환 완료 시 AudioEngine에 오디오 버퍼 자동 로드
- 파형(Waveform) 자동 렌더링
- 재생 준비 상태 전환
- 관련 요구사항: REQ-API-001-13

**태스크 4.5: E2E 통합 테스트**
- YouTube URL 입력 > 변환 > 오디오 로드 전체 흐름 테스트
- 에러 시나리오 테스트
- Playwright E2E 테스트

---

## 기술적 접근 방식

### 백엔드 아키텍처

```
FastAPI Application
  |
  +-- routes/           # 얇은 라우트 계층 (요청 검증, 응답 포맷)
  |     +-- health.py
  |     +-- youtube.py
  |
  +-- services/          # 비즈니스 로직 계층
  |     +-- youtube_service.py    # yt-dlp 래핑, 변환 관리
  |     +-- cleanup_service.py    # 파일 정리
  |
  +-- models/schemas.py  # Pydantic 스키마
  +-- utils/             # 유틸리티
        +-- validators.py
        +-- rate_limiter.py
```

**핵심 설계 원칙:**
- 라우트는 요청 검증과 응답 포맷만 담당 (얇은 계층)
- 비즈니스 로직은 서비스 계층에 집중
- Phase 4 확장을 위해 `routes/` 및 `services/`에 새 파일 추가만으로 기능 확장 가능

### yt-dlp 비동기 실행 패턴

yt-dlp는 동기 라이브러리이므로 `asyncio.get_event_loop().run_in_executor()`를 사용하여 FastAPI의 비동기 이벤트 루프를 차단하지 않도록 한다.

### SSE 진행률 스트리밍 패턴

- 변환 작업 시작 시 고유 `task_id` 발급
- 인메모리 딕셔너리로 태스크 상태 관리
- SSE 엔드포인트에서 `asyncio.Queue`를 통해 진행률 이벤트 전달
- 변환 완료/에러 시 큐에 최종 이벤트 삽입 후 스트림 종료

### 프론트엔드 통합 패턴

```
YouTubeInput (UI)
  |
  +-- useYouTubeConvert (Hook)
        |
        +-- youtubeStore (Zustand)
        |     +-- url, status, progress, error, taskId
        |
        +-- API Client
        |     +-- POST /youtube/convert
        |     +-- EventSource /youtube/progress/{taskId}
        |
        +-- audioStore (연동)
              +-- 변환 완료 시 오디오 데이터 전달
```

---

## 리스크 분석

### 높은 리스크

**YouTube/yt-dlp 호환성 변경**
- 영향: YouTube 정책 변경 시 yt-dlp가 작동하지 않을 수 있음
- 대응: yt-dlp 버전을 정기적으로 업데이트, 에러 감지 및 사용자에게 명확한 피드백 제공

**대용량 파일 처리 시 서버 리소스 부족**
- 영향: 긴 동영상(30분) 변환 시 메모리/디스크 부족 가능
- 대응: 동시 변환 수 세마포어 제한(5개), 동영상 길이 제한(30분), 디스크 임계치 모니터링

### 중간 리스크

**CORS 설정 오류**
- 영향: 프론트엔드에서 백엔드 API 호출 실패
- 대응: 개발 환경에서 철저한 CORS 테스트, Preflight 요청 검증

**SSE 연결 안정성**
- 영향: 진행률 스트림 끊김으로 UI 업데이트 실패
- 대응: 클라이언트 자동 재연결 로직, 폴링 폴백 고려

### 낮은 리스크

**ffmpeg 의존성**
- 영향: Docker 이미지에서 ffmpeg 설치 실패
- 대응: 검증된 베이스 이미지 사용, 헬스 체크에서 ffmpeg 가용성 확인

---

## 태스크 의존성 다이어그램

```
태스크 1.1 (프로젝트 초기화)
  |
  +-> 태스크 1.2 (CORS/미들웨어) --> 태스크 1.3 (헬스 체크)
  |                                       |
  +-> 태스크 1.4 (Dockerfile)             |
  |                                       |
  +-> 태스크 1.5 (파일 정리)              |
                                          |
  [최우선 목표 완료] <--------------------+
      |
      v
  태스크 2.1 (URL 검증)
      |
      +-> 태스크 2.2 (변환 서비스) --> 태스크 2.3 (API 엔드포인트)
      |                                   |
      +-> 태스크 2.4 (보안/요율 제한)     |
                                          |
      +-> 태스크 2.5 (백엔드 테스트) <----+
                                          |
  [주요 목표 완료] <---------------------+
      |                                   |
      v                                   v
  태스크 3.1 (Pencil 디자인)         태스크 4.1 (API 클라이언트)
      |                                   |
      +-> 태스크 3.2 (입력 컴포넌트)      +-> 태스크 4.2 (SSE 클라이언트)
      +-> 태스크 3.3 (진행률 표시)        +-> 태스크 4.3 (상태 스토어)
      +-> 태스크 3.4 (에러 표시)          |
                                          v
  [보조 목표 + 최종 목표] ------------> 태스크 4.4 (자동 로드 통합)
                                          |
                                          v
                                    태스크 4.5 (E2E 테스트)
```

---

## 전문가 상담 권장

이 SPEC에는 다음 도메인의 전문 에이전트 상담이 권장된다:

- **expert-backend**: FastAPI 서버 아키텍처, yt-dlp 통합, SSE 구현, 비동기 패턴 설계
- **expert-frontend**: YouTube 입력 UI 컴포넌트, SSE 클라이언트, Zustand 스토어 연동
- **expert-security**: URL 검증, 요율 제한, CORS 보안 설정, 입력 새니타이징
- **design-uiux**: Pencil MCP를 활용한 YouTube 입력 UI 디자인, 다크 테마 일관성
