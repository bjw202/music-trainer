---
id: SPEC-API-001
type: acceptance
version: 1.0.0
---

# SPEC-API-001: 수락 기준

## 개요

SPEC-API-001의 모든 요구사항에 대한 수락 기준을 Given-When-Then 형식으로 정의한다. 각 모듈별 정상 시나리오, 에러 시나리오, 엣지 케이스를 포함한다.

---

## 모듈 1: 백엔드 서버 인프라

### 시나리오 1.1: FastAPI 서버 시작 및 헬스 체크

```gherkin
Given 백엔드 서버가 정상적으로 시작되었을 때
When GET /api/v1/health 요청을 보내면
Then 응답 상태 코드는 200이어야 한다
And 응답 본문에 status가 "healthy"로 포함되어야 한다
And 응답 본문에 ffmpeg_available이 true로 포함되어야 한다
And 응답 본문에 disk_space_mb가 양수로 포함되어야 한다
And 응답 시간이 200ms 이내여야 한다
```

### 시나리오 1.2: CORS 설정 검증

```gherkin
Given 프론트엔드가 http://localhost:5173에서 실행 중일 때
When Origin: http://localhost:5173 헤더로 OPTIONS /api/v1/health 요청을 보내면
Then 응답에 Access-Control-Allow-Origin: http://localhost:5173 헤더가 포함되어야 한다
And Access-Control-Allow-Methods에 GET, POST가 포함되어야 한다
```

### 시나리오 1.3: 허용되지 않은 Origin 차단

```gherkin
Given CORS가 특정 도메인만 허용하도록 설정되었을 때
When Origin: http://malicious-site.com 헤더로 요청을 보내면
Then CORS 응답 헤더가 포함되지 않아야 한다
```

### 시나리오 1.4: 임시 파일 자동 정리

```gherkin
Given 변환된 MP3 파일이 임시 디렉토리에 1시간 이상 존재할 때
When 파일 정리 백그라운드 태스크가 실행되면
Then 1시간 이상 경과한 파일이 삭제되어야 한다
And 1시간 미만인 파일은 유지되어야 한다
```

### 시나리오 1.5: 디스크 용량 초과 시 강제 정리

```gherkin
Given 임시 디렉토리의 디스크 사용량이 10GB를 초과할 때
When 파일 정리 태스크가 실행되면
Then 가장 오래된 파일부터 삭제하여 사용량을 10GB 이하로 줄여야 한다
```

---

## 모듈 2: YouTube URL 변환 API

### 시나리오 2.1: 유효한 YouTube URL 변환 요청

```gherkin
Given 서버가 정상 운영 중이고 ffmpeg가 사용 가능할 때
When POST /api/v1/youtube/convert에 {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}를 전송하면
Then 응답 상태 코드는 202 (Accepted)여야 한다
And 응답 본문에 task_id가 UUID 형식으로 포함되어야 한다
And 응답 본문에 status가 "processing"이어야 한다
```

### 시나리오 2.2: 단축 URL 지원

```gherkin
Given 서버가 정상 운영 중일 때
When POST /api/v1/youtube/convert에 {"url": "https://youtu.be/dQw4w9WgXcQ"}를 전송하면
Then 응답 상태 코드는 202여야 한다
And task_id가 정상적으로 발급되어야 한다
```

### 시나리오 2.3: 잘못된 URL 형식

```gherkin
Given 서버가 정상 운영 중일 때
When POST /api/v1/youtube/convert에 {"url": "https://example.com/not-youtube"}를 전송하면
Then 응답 상태 코드는 422 (Unprocessable Entity)여야 한다
And 에러 메시지에 "유효한 YouTube URL이 아닙니다"가 포함되어야 한다
```

### 시나리오 2.4: 빈 URL

```gherkin
Given 서버가 정상 운영 중일 때
When POST /api/v1/youtube/convert에 {"url": ""}를 전송하면
Then 응답 상태 코드는 422여야 한다
And URL 필드 검증 에러가 반환되어야 한다
```

### 시나리오 2.5: 존재하지 않는 동영상

```gherkin
Given 서버가 정상 운영 중일 때
When POST /api/v1/youtube/convert에 삭제된 동영상 URL을 전송하면
Then 응답 상태 코드는 404여야 한다
And 에러 메시지에 "동영상을 찾을 수 없습니다"가 포함되어야 한다
```

### 시나리오 2.6: 30분 초과 동영상 거부

```gherkin
Given 서버가 정상 운영 중일 때
When POST /api/v1/youtube/convert에 40분 길이의 동영상 URL을 전송하면
Then 응답 상태 코드는 400 (Bad Request)여야 한다
And 에러 메시지에 "30분 이하의 동영상만 지원합니다"가 포함되어야 한다
```

### 시나리오 2.7: SSE 진행률 스트리밍

```gherkin
Given 변환 작업이 task_id로 시작되었을 때
When GET /api/v1/youtube/progress/{task_id}에 SSE 연결하면
Then Content-Type이 text/event-stream이어야 한다
And 진행률 이벤트가 percent, stage, estimated_remaining 필드를 포함해야 한다
And 변환 완료 시 complete 이벤트에 download_url이 포함되어야 한다
And 스트림이 완료 후 정상적으로 종료되어야 한다
```

### 시나리오 2.8: 변환 중 에러 발생

```gherkin
Given 변환 작업이 진행 중일 때
When 네트워크 오류 또는 yt-dlp 에러가 발생하면
Then SSE 스트림에 error 이벤트가 전송되어야 한다
And 에러 이벤트에 error_type과 message 필드가 포함되어야 한다
And 스트림이 에러 이벤트 후 종료되어야 한다
```

### 시나리오 2.9: 변환된 오디오 다운로드

```gherkin
Given 변환 작업이 완료되었을 때
When GET /api/v1/youtube/download/{task_id}를 요청하면
Then 응답 상태 코드는 200이어야 한다
And Content-Type이 audio/mpeg이어야 한다
And 응답 본문에 유효한 MP3 바이너리 데이터가 포함되어야 한다
```

### 시나리오 2.10: 만료된 파일 다운로드 시도

```gherkin
Given 변환된 파일이 1시간 후 삭제되었을 때
When GET /api/v1/youtube/download/{task_id}를 요청하면
Then 응답 상태 코드는 404여야 한다
And 에러 메시지에 "파일이 만료되었습니다"가 포함되어야 한다
```

### 시나리오 2.11: 요율 제한 초과

```gherkin
Given 동일 IP에서 1분 내에 10회 변환 요청을 보냈을 때
When 11번째 변환 요청을 보내면
Then 응답 상태 코드는 429 (Too Many Requests)여야 한다
And Retry-After 헤더가 포함되어야 한다
```

### 시나리오 2.12: 동시 변환 제한 초과

```gherkin
Given 서버에서 5개의 변환 작업이 동시에 진행 중일 때
When 6번째 변환 요청이 들어오면
Then 응답 상태 코드는 503 (Service Unavailable)이거나 큐에 대기 상태로 전환되어야 한다
And 적절한 메시지로 사용자에게 대기 상태를 알려야 한다
```

---

## 모듈 3: 프론트엔드 YouTube 입력 UI

### 시나리오 3.1: YouTube URL 입력 및 변환 시작

```gherkin
Given 사용자가 Music Trainer 앱에 접속했을 때
When YouTube URL 입력 필드에 유효한 URL을 입력하고 "변환" 버튼을 클릭하면
Then 변환 버튼이 비활성화되어야 한다
And 프로그레스 바가 표시되어야 한다
And 현재 단계가 "다운로드 중"으로 표시되어야 한다
```

### 시나리오 3.2: 빈 URL로 변환 시도

```gherkin
Given YouTube URL 입력 필드가 비어있을 때
When "변환" 버튼을 클릭하면
Then 변환 요청이 서버로 전송되지 않아야 한다
And 입력 필드에 유효성 검사 에러 메시지가 표시되어야 한다
```

### 시나리오 3.3: 진행률 실시간 업데이트

```gherkin
Given 변환 작업이 진행 중일 때
When 서버에서 SSE 진행률 이벤트가 수신되면
Then 프로그레스 바가 수신된 퍼센트로 업데이트되어야 한다
And 현재 단계가 올바르게 표시되어야 한다 (다운로드 중 / 변환 중)
```

### 시나리오 3.4: 변환 완료 후 자동 오디오 로드

```gherkin
Given 변환 작업이 완료되었을 때
When SSE complete 이벤트가 수신되면
Then 변환된 MP3 파일이 자동으로 다운로드되어야 한다
And AudioEngine에 오디오 버퍼가 로드되어야 한다
And 파형(Waveform)이 렌더링되어야 한다
And 재생 버튼이 활성화되어야 한다
And 프로그레스 바가 사라지고 URL 입력 필드가 초기 상태로 복귀해야 한다
```

### 시나리오 3.5: 잘못된 URL 에러 표시

```gherkin
Given 사용자가 YouTube가 아닌 URL을 입력했을 때
When 서버에서 422 에러가 반환되면
Then "유효한 YouTube URL이 아닙니다" 에러 메시지가 표시되어야 한다
And 재시도 버튼이 표시되어야 한다
And 다른 UI 요소(재생, 속도/피치 등)는 정상 작동해야 한다
```

### 시나리오 3.6: 네트워크 타임아웃 에러

```gherkin
Given 변환 작업 중 네트워크 연결이 끊어졌을 때
When SSE 연결이 끊어지면
Then 자동 재연결을 시도해야 한다 (최대 3회)
And 재연결 실패 시 "네트워크 연결이 불안정합니다" 에러 메시지가 표시되어야 한다
And 재시도 버튼이 제공되어야 한다
```

### 시나리오 3.7: 변환 취소

```gherkin
Given 변환 작업이 진행 중일 때
When 사용자가 "취소" 버튼을 클릭하면
Then SSE 연결이 종료되어야 한다
And UI가 초기 상태(idle)로 복귀해야 한다
And 서버 측 변환 작업이 가능하면 중단되어야 한다
```

### 시나리오 3.8: 지원되지 않는 동영상 (비공개/삭제)

```gherkin
Given 사용자가 비공개 또는 삭제된 YouTube 동영상 URL을 입력했을 때
When 서버에서 404 에러가 반환되면
Then "동영상을 찾을 수 없습니다. URL을 확인해 주세요." 에러 메시지가 표시되어야 한다
And 재시도 버튼이 제공되어야 한다
```

---

## 모듈 4: 프론트엔드-백엔드 통합

### 시나리오 4.1: API 클라이언트 베이스 URL 설정

```gherkin
Given VITE_API_BASE_URL 환경 변수가 "http://localhost:8000"으로 설정되었을 때
When API 클라이언트가 초기화되면
Then 모든 API 요청이 http://localhost:8000/api/v1/ 접두사를 사용해야 한다
```

### 시나리오 4.2: API 에러 공통 처리

```gherkin
Given 백엔드 API에서 500 에러가 반환되었을 때
When API 클라이언트가 응답을 수신하면
Then "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 메시지로 에러가 처리되어야 한다
And 에러가 콘솔에 로깅되어야 한다
```

### 시나리오 4.3: Zustand 상태 전이

```gherkin
Given youtubeStore의 status가 "idle"일 때
When 변환을 시작하면 status가 "loading"으로 전환되어야 한다
And 서버 응답 수신 후 status가 "converting"으로 전환되어야 한다
And 변환 완료 시 status가 "complete"로 전환되어야 한다
And 에러 발생 시 status가 "error"로 전환되어야 한다
```

### 시나리오 4.4: 변환 완료 후 audioStore 연동

```gherkin
Given youtubeStore의 status가 "complete"로 전환되었을 때
When 오디오 파일이 다운로드 완료되면
Then audioStore에 오디오 파일 메타데이터가 설정되어야 한다
And playerStore의 상태가 재생 준비(ready) 상태로 전환되어야 한다
And 파형 컴포넌트가 새 오디오의 파형을 렌더링해야 한다
```

---

## 성능 기준

| 지표 | 기준값 | 측정 방법 |
|------|--------|----------|
| 서버 헬스 체크 응답 시간 | < 200ms | httpx 타이밍 |
| YouTube 변환 시간 (5분 동영상) | < 3분 | 서버 로그 |
| YouTube 변환 시간 (15분 동영상) | < 8분 | 서버 로그 |
| SSE 진행률 업데이트 간격 | < 3초 | 프론트엔드 로그 |
| 변환 완료 후 자동 로드 시간 | < 5초 | E2E 측정 |
| 프론트엔드 API 호출 응답 시간 | < 500ms | 브라우저 DevTools |

---

## 보안 기준

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| URL 화이트리스트 | YouTube 도메인만 허용 | 단위 테스트 |
| IP 요율 제한 | 분당 10회 | 부하 테스트 |
| 입력 새니타이징 | XSS/인젝션 방지 | 보안 테스트 |
| CORS 제한 | 허용된 Origin만 통과 | 통합 테스트 |
| 변환 타임아웃 | 5분 초과 시 자동 종료 | 통합 테스트 |
| 파일 접근 제한 | task_id 없이 파일 접근 불가 | 보안 테스트 |

---

## UI 기준

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| 다크 테마 일관성 | 기존 Logic Pro / Ableton 스타일 유지 | 시각적 검토 + Pencil 디자인 |
| 반응형 디자인 | 모바일(320px) ~ 데스크톱(1920px) | Playwright viewport 테스트 |
| 에러 메시지 가독성 | 사용자 친화적 한국어 메시지 | 사용성 검토 |
| 프로그레스 바 부드러움 | 끊김 없는 애니메이션 | 시각적 검토 |
| 접근성 | 키보드 네비게이션, ARIA 레이블 | 접근성 테스트 |

---

## E2E 통합 테스트 (실제 YouTube URL)

### 시나리오 E2E-1: 실제 YouTube URL로 전체 파이프라인 검증

```gherkin
Given 백엔드 서버가 실행 중이고 프론트엔드가 http://localhost:5173에서 접속 가능할 때
And ffmpeg가 시스템에 설치되어 있을 때
When Playwright 브라우저에서 앱에 접속한다
And YouTube URL 입력 필드에 실제 URL "https://www.youtube.com/watch?v=dQw4w9WgXcQ"를 입력한다
And "변환" 버튼을 클릭한다
Then 프로그레스 바가 표시되어야 한다
And SSE를 통해 진행률이 0%에서 100%까지 증가해야 한다
And 변환이 완료되면 프로그레스 바가 사라져야 한다
And 파형(Waveform) 캔버스에 오디오 파형이 렌더링되어야 한다
And 재생 버튼이 활성화(enabled) 상태여야 한다
When 재생 버튼을 클릭한다
Then Web Audio API를 통해 오디오가 실제로 재생되어야 한다
And 파형 커서가 재생 위치에 따라 이동해야 한다
And AudioContext의 state가 "running"이어야 한다
When 3초 후 일시정지 버튼을 클릭한다
Then 오디오 재생이 일시정지되어야 한다
And 현재 재생 위치가 0초보다 커야 한다 (실제로 재생되었음을 검증)
```

### 시나리오 E2E-2: 실제 YouTube 단축 URL로 전체 파이프라인 검증

```gherkin
Given 백엔드 서버와 프론트엔드가 정상 실행 중일 때
When YouTube 단축 URL "https://youtu.be/dQw4w9WgXcQ"를 입력하고 변환을 시작한다
Then 시나리오 E2E-1과 동일한 전체 흐름이 성공해야 한다
And 변환된 오디오가 AudioEngine에 로드되어 재생 가능해야 한다
```

### 시나리오 E2E-3: 변환된 오디오에 속도/피치 제어 적용 검증

```gherkin
Given 시나리오 E2E-1이 완료되어 YouTube에서 변환된 오디오가 로드된 상태일 때
When 속도 슬라이더를 0.75로 변경한다
Then 오디오 재생 속도가 변경되어야 한다
And 파형 커서 이동 속도가 느려져야 한다
When 피치 슬라이더를 +3 반음으로 변경한다
Then 오디오 피치가 상승해야 한다
And 재생 위치가 점프하지 않아야 한다
```

### E2E 테스트 구현 요구사항

| 항목 | 요구사항 |
|------|----------|
| 테스트 프레임워크 | Playwright (기존 E2E 테스트와 동일) |
| 실제 URL 사용 | 반드시 실제 YouTube URL로 테스트 (mock 금지) |
| 타임아웃 | 변환 대기 최대 5분 (실제 yt-dlp 변환 시간 고려) |
| 오디오 재생 검증 | AudioContext.state === "running" 확인 |
| 파형 렌더링 검증 | Waveform 캔버스 요소의 렌더링 상태 확인 |
| 재생 위치 검증 | currentTime > 0 확인으로 실제 재생 증명 |
| CI 환경 | ffmpeg + yt-dlp 설치 필요, 네트워크 접근 허용 |
| 테스트 격리 | 각 테스트 후 서버 임시 파일 정리 |

---

## Definition of Done

- [ ] 모든 백엔드 API 엔드포인트가 구현되고 테스트를 통과한다
- [ ] 헬스 체크 엔드포인트가 ffmpeg 가용성과 디스크 공간을 정확히 보고한다
- [ ] YouTube URL 검증이 모든 지원 형식을 처리한다
- [ ] yt-dlp를 통한 오디오 추출이 MP3 192kbps로 정상 동작한다
- [ ] SSE로 변환 진행률이 실시간 전송된다
- [ ] 프론트엔드 YouTubeInput 컴포넌트가 다크 테마에 맞게 구현된다
- [ ] 변환 완료 후 오디오가 자동으로 AudioEngine에 로드된다
- [ ] 파형이 변환된 오디오로 렌더링된다
- [ ] 모든 에러 시나리오에 대한 사용자 친화적 메시지가 표시된다
- [ ] CORS가 올바르게 설정되어 프론트엔드-백엔드 통신이 정상 동작한다
- [ ] IP 기반 요율 제한이 적용된다
- [ ] 임시 파일 자동 정리가 동작한다
- [ ] 백엔드 테스트 커버리지 85% 이상
- [ ] E2E 테스트: 실제 YouTube URL → MP3 변환 → 오디오 로드 → 파형 렌더링 → 실제 재생이 Playwright로 검증된다
- [ ] E2E 테스트: 변환된 오디오에 속도/피치 제어가 정상 동작한다
- [ ] Docker로 백엔드가 컨테이너화된다
- [ ] Phase 4 확장을 위한 아키텍처가 준비된다
