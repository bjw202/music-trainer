# Music Trainer 기술 스택

## 기술 스택 개요

### 프론트엔드 (Frontend)

**핵심 프레임워크**
- React 19: 최신 React with Hooks, Server Components 지원
- TypeScript 5.x: 완전한 타입 안정성
- Vite 6.x: 빠른 빌드 및 개발 서버
- Node.js 20 LTS: 개발 및 빌드 환경

**상태 관리**
- Zustand: 가볍고 효율적한 상태 관리 (Redux 대비 30% 적은 코드)

**스타일링**
- Tailwind CSS 4.x: 유틸리티 기반 CSS
- Dark Theme: Logic Pro, Ableton Live 스타일 다크 테마

**오디오 처리**
- Web Audio API: 브라우저 기본 오디오 API
- wavesurfer.js 7.x: 파형 시각화 라이브러리
- soundtouch-ts: 속도 변경 (Time-Stretch) 라이브러리
- AudioWorklet: 메인 스레드와 분리된 오디오 처리

**테스트**
- Vitest: 극고속 단위/컴포넌트 테스트
- Playwright: E2E 테스트 (실제 브라우저에서 실행)
- React Testing Library: 컴포넌트 테스트

**개발 도구**
- pnpm: 빠르고 디스크 효율적인 패키지 관리자
- ESLint: 코드 품질 검사
- Prettier: 자동 코드 포맷팅

### 백엔드 (Backend) - Phase 3

**웹 프레임워크**
- Python 3.12+: 최신 Python with asyncio 개선
- FastAPI: 비동기 웹 프레임워크 (자동 OpenAPI 문서 생성)
- Uvicorn: ASGI 웹 서버

**오디오 처리**
- Demucs: Meta의 AI 기반 음원 분리 모델
- PyDub: 오디오 파일 처리
- NumPy: 수치 계산

**데이터베이스** (선택)
- PostgreSQL: 작업 이력 및 사용자 데이터 (필요시)
- Redis: 캐싱 및 작업 큐 (선택)

**배포**
- Docker: 컨테이너 기반 배포
- Railway: 클라우드 호스팅 (또는 AWS, Heroku)

### 공통

**버전 관리**
- Git: 소스 코드 관리
- GitHub: 원격 저장소

**메시징 및 API**
- REST API: 프론트엔드-백엔드 통신
- CORS: 크로스 오리진 요청 처리

---

## 프레임워크 선택 근거

### React 19 선택 이유

**장점**
- Web Audio API와의 완벽한 호환성: Refs를 통한 AudioContext 관리
- wavesurfer.js와 soundtouch-ts 라이브러리의 최적 지원
- 커뮤니티 규모 및 생태계: 오디오 플레이어 라이브러리 풍부
- 모바일 반응형 개발 용이

**대안 검토**
- Vue.js: 학습 곡선이 낮지만 오디오 생태계 부족
- Angular: 무거움, 음악 앱에는 오버엔지니어링
- Svelte: 가볍지만 오디오 관련 라이브러리 및 커뮤니티 부족

### Vite 6.x 선택 이유

**장점**
- 번개 같은 개발 서버 시작 (3초 이내)
- HMR(Hot Module Replacement)로 즉시 피드백
- 프로덕션 빌드 최적화 (Rollup 기반)
- 모던 ES Module 네이티브 지원

**대안 검토**
- Create React App: 구식 webpack 기반, 느린 빌드
- Next.js: SSR이 필요 없는 SPA에는 오버스펙

### Zustand 선택 이유

**장점**
- 최소한의 리렌더링: 필요한 상태만 구독 가능
- 오디오 상태(시간, 속도, 피치)와 UI 상태 완전 분리
- Redux 대비 90% 적은 보일러플레이트
- 번들 사이즈 작음 (2KB gzipped)

**예시: 오디오와 UI 상태 분리**
```
오디오 상태 (매 프레임 업데이트)
- 현재 시간: requestAnimationFrame으로 업데이트
- 파형 데이터: Canvas에 직접 렌더링

UI 상태 (필요할 때만 업데이트)
- 재생 중/일시정지: 변경 시에만 리렌더링
- 속도/피치 슬라이더: 사용자 상호작용 시에만 리렌더링
```

이렇게 분리하면 React 리렌더링 오버헤드를 크게 줄일 수 있습니다.

**대안 검토**
- Redux: 보일러플레이트 많음, 학습 곡선 높음
- Recoil: 페이스북 지원 중단, 불안정성
- Context API: 성능 최적화 부족 (전체 트리 리렌더링)

### Tailwind CSS 4.x 선택 이유

**장점**
- 전문 음악 앱 테마(Logic Pro, Ableton Live) 스타일 구현 용이
- Dark theme 기본 지원: `dark:` prefix로 쉬운 다크/라이트 전환
- 유틸리티 기반: 커스텀 CSS 최소화
- 번들 사이즈 최적화: PurgeCSS로 사용하지 않는 스타일 제거

**다크 테마 예시**
```
Logic Pro 스타일: 어두운 회색(#1a1a1a) + 밝은 텍스트 + 강조색 블루
Ableton Live 스타일: 검정(#000000) + 네온 그린 액센트
```

**대안 검토**
- styled-components: 런타임 오버헤드, CSS-in-JS 복잡성
- CSS Modules: Tailwind 대비 더 많은 커스텀 코드 필요

### Web Audio API + wavesurfer.js 선택 이유

**장점**
- Web Audio API: 브라우저 표준, 추가 다운로드 불필요
- wavesurfer.js: 오픈소스, 최신 버전(7.x) 활발히 유지보수
- 파형 시각화 성능: Canvas 기반으로 매끄러운 렌더링
- 확장성: 플러그인 시스템으로 기능 추가 용이

**대안 검토**
- tone.js: 음악 합성에 최적화, 플레이어로는 과도함
- Howler.js: 플래시 기반 폴백, 이제 필요 없음

### soundtouch-ts 선택 이유

**장점**
- SoundTouch 알고리즘: 수십 년 검증된 시간 신축(Time Stretching) 기술
- 타입스크립트 바인딩: C++ 원본과 동등한 품질
- 속도와 피치 완벽 독립: 한 쪽 변경해도 다른 쪽 유지
- 무시간 지연(Latency Free): 실시간 재생에 최적

**대안 검토**
- Librosa (Python): 백엔드 처리 필요, 레이턴시 증가
- 직접 구현: 개발 시간 6개월 이상, 음질 보장 어려움

### Demucs 선택 이유 (Phase 3)

**장점**
- Meta(Facebook) 개발: 대규모 자금 지원, 지속적 개선
- 최고 성능: 음원 분리 벤치마크에서 최고점
- 지원 악기: 보컬, 드럼, 베이스, 기타, 피아노, 스트링 등 8개 악기
- 오픈소스: 상업 사용 가능

**음질 성능**
- 음원 분리 정확도: 92% (2024년 기준)
- 실시간 성능: 곡 길이의 50% 시간에 처리 가능 (GPU 사용 시)

**대안 검토**
- Spleeter (Deezer): 더 빠름 (4 악기만 지원, 음질 낮음)
- Voxceleb (VoxCeleb): 사람 목소리만 분리 가능
- iZotope RX (상용): 매월 $10+, 웹 API 없음

---

## 오디오 아키텍처

### Web Audio API 신호 체인

음악 트레이너의 핵심은 완벽하게 독립적인 속도/피치/볼륨 제어입니다.

**단일 트랙 오디오 그래프**
```
파일 소스 (File/Blob)
    ↓
[AudioBuffer 로드]
    ↓
BufferSource
    ↓
TimeStretch Worklet (0.5x ~ 2.0x, 피치 유지)
    ↓
PitchShift Worklet (-12 ~ +12 반음, 속도 유지)
    ↓
GainNode (마스터 볼륨)
    ↓
AnalyserNode (파형 데이터 추출)
    ↓
Destination (스피커/헤드폰)
```

**멀티 트랙 오디오 그래프 (Phase 3: 스템 믹서)**
```
분리된 악기별 소스
├─ 보컬 Source
│  └─ GainNode (0~1.0)
├─ 드럼 Source
│  └─ GainNode (0~1.0)
├─ 베이스 Source
│  └─ GainNode (0~1.0)
└─ 기타 Source
   └─ GainNode (0~1.0)
    ↓
ChannelMerger (모든 채널 병합)
    ↓
TimeStretch Worklet (마스터 속도)
    ↓
PitchShift Worklet (마스터 피치)
    ↓
GainNode (마스터 볼륨)
    ↓
AnalyserNode (시각화)
    ↓
Destination
```

### AudioWorklet으로 메인 스레드와 분리

**왜 AudioWorklet을 사용하나?**
- 오디오 콜백이 메인 스레드를 블로킹하지 않음
- 자신의 독립적인 스레드에서 실시간 처리
- 버퍼링 없이 매우 낮은 레이턴시

**TimeStretchWorklet**
- SoundTouch 알고리즘 실행
- 속도 계수(playback rate)만 변경 가능
- 피치는 자동으로 유지됨

**PitchShiftWorklet**
- 피치 변경(세미톤 단위)
- 속도는 자동으로 유지됨

### 더블 버퍼링 전략

**목표**: 속도/피치 변경 중 오디오 끊김 없음

**구현**
1. 현재 재생 중인 버퍼 (Buffer A)
2. 새 속도/피치로 처리할 버퍼 (Buffer B) 준비
3. 재생 위치가 Buffer B로 전환되는 순간 자연스럽게 변경
4. 사용자는 끊김을 감지하지 못함

**코드 흐름**
```
1. 사용자가 속도를 1.0x → 0.8x로 변경
2. 백그라운드에서 0.8x 버퍼 생성 시작
3. 현재 재생 위치 기반으로 동기화된 지점 계산
4. 0.8x 버퍼가 준비되면 자동 전환
5. 사용자는 끊김 없는 속도 변경 경험
```

---

## 성능 최적화

### 1. React 리렌더링 최소화

**Zustand Shallow Equality**
```
Zustand는 상태 변경 감지 시 Shallow Copy 비교
예: 현재 시간 업데이트 (매 프레임)
- 파형 렌더링: Canvas에 직접 렌더링 (React와 무관)
- UI 업데이트: 오디오 시간만 필요한 컴포넌트만 리렌더링

리렌더링 줄임: 60fps 파형 + 필요 시점만 UI 업데이트
```

**Refs를 통한 AudioContext 직접 접근**
```
React 상태로 관리하지 않고 직접 참조
- AudioContext의 상태 변경이 React 리렌더링 유발하지 않음
- Web Audio API 성능 저하 없음
```

### 2. AudioWorklet 멀티 스레드 처리

Web Audio API는 독립적인 오디오 스레드에서 실행:
- 메인 스레드 blocking 없음
- UI 애니메이션 60fps 유지 가능
- 오디오 처리 안정성 보장

### 3. 파형 렌더링 최적화

**Canvas 기반 렌더링**
- wavesurfer.js의 Canvas 렌더러 사용
- 매 프레임 업데이트 (requestAnimationFrame)
- React 상태 관리와 독립적

**배경 워커 (선택)**
- 매우 긴 오디오(2시간+)의 경우 워커 스레드 사용
- 메인 스레드 100% 활용으로 UI 끊김 방지

### 4. 메모리 관리

**오디오 버퍼 수명 관리**
```
파일 로드 → AudioBuffer 생성 → 재생 중 메모리 유지
파일 언로드 → 버퍼 정리 (gc 대기)
```

**Array Pooling (고급)**
```
같은 크기 배열을 재사용하여 GC 압력 감소
예: 파형 분석 데이터 배열
```

---

## 개발 도구

### ESLint + Prettier

**목적**: 코드 품질과 일관성 보장

**설정**
- ESLint: 코드 오류 검사
- Prettier: 자동 포맷팅
- TypeScript ESLint: 타입 관련 규칙

### Vitest

**단위 테스트**
```
예: Zustand 스토어 테스트
- playerStore의 재생/일시정지 상태 전환
- audioStore의 파일 로드 로직
```

**속도**: Jest 대비 100배 빠름 (Vite 기반)

### Playwright

**E2E 테스트**
```
예: 실제 사용자 흐름
1. 파일 드래그 앤 드롭
2. 파형 클릭하여 시크
3. 속도 슬라이더 이동
4. 실제 오디오 출력 검증 (Playwright Audio API)
```

**실제 오디오 재생 검증**
- Playwright는 실제 오디오를 재생
- 마이크 입력으로 오디오 검증 가능
- 음성/음악 톤 분석으로 속도 변경 확인

---

## 배포 전략

### 프론트엔드 - Vercel

**자동 배포**
- main 브랜치 push → 자동 배포
- PR 생성 → Preview URL 자동 생성
- 프로덕션 빌드 최적화 (코드 스플리팅, 트리 쉐이킹)

**성능 최적화**
- CDN 캐싱: 글로벌 엣지 서버
- 이미지 최적화: WebP 자동 변환
- 번들 분석: 번들 사이즈 모니터링

### 백엔드 - Docker + Railway (Phase 3)

**Dockerfile**
```
기본 이미지: python:3.12-slim
의존성: FastAPI, Uvicorn, Demucs, PyDub
포트: 8000 (FastAPI)
```

**배포**
- GitHub 연동: 푸시 시 자동 배포
- 환경 변수: .env 파일 관리
- 로그 모니터링: Railway 대시보드

**GPU 가속 (선택)**
- Demucs CPU 처리: 곡 길이의 50% 시간 소요
- GPU 처리: 곡 길이의 10% 시간 소요
- Railway GPU 옵션 또는 AWS EC2 g4dn 인스턴스

---

## 패키지 관리

### pnpm (Node.js)

**이유**
- npm, yarn 대비 3배 빠른 설치 (캐시)
- 디스크 효율성: hard link로 중복 제거
- lock 파일: pnpm-lock.yaml 자동 생성

### pip (Python)

**requirements.txt**
```
fastapi==0.109.0
uvicorn==0.27.0
demucs==4.0.1
pydub==0.25.1
numpy==1.24.3
```

**버전 고정**
- 재현성 보장: 같은 버전으로 배포
- 보안 패치: 정기적 업그레이드

---

## 타입 안정성

### TypeScript Strict Mode

```typescript
// tsconfig.json
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true
```

**효과**
- 런타임 오류 사전 방지
- IDE 자동완성 및 타입 힌트
- 코드 리팩토링 안전성

### Pydantic (Python)

```python
# 타입 검증
class SeparationRequest(BaseModel):
    file_url: str
    format: Literal["mp3", "wav", "flac"]
    model: Literal["htdemucs", "mdx_extra"] = "htdemucs"
```

---

## 보안 고려사항

### CORS (Cross-Origin Resource Sharing)

```
백엔드에서 프론트엔드 도메인 명시
- 개발: http://localhost:3000
- 프로덕션: https://musictrainer.com
```

### 입력 검증

```
FastAPI Pydantic으로 자동 검증
- 파일 크기 제한: 최대 500MB
- 파일 형식 검증: MP3, WAV, FLAC만 허용
```

### 오디오 처리 보안

```
사용자 업로드 파일은 격리된 임시 디렉토리에 저장
- 처리 후 자동 삭제
- 서버 디스크 용량 제한 (최대 100GB)
```

---

## 모니터링 및 로깅

### 프론트엔드

**에러 트래킹**
- Sentry: JavaScript 오류 자동 수집
- 성능 모니터링: Core Web Vitals 추적

### 백엔드

**로깅**
```
FastAPI 미들웨어: 모든 요청/응답 기록
- 요청: 메서드, 경로, 상태 코드, 처리 시간
- 오류: 스택 트레이스, 입력 데이터
```

**성능 모니터링**
```
Demucs 처리 시간 측정
- CPU 사용율: 목표 50~70%
- 메모리 사용: 목표 2~4GB
- 처리 시간: 곡 길이 * 0.1 ~ 0.5
```

---

## 마이그레이션 경로

### Phase 1 → Phase 2

- 속도/피치 제어 추가
- 키보드 단축키 확장
- A-B 루프 개선

### Phase 2 → Phase 3

- FastAPI 백엔드 추가
- Demucs 통합
- 스템 믹서 UI 구현
- 클라우드 저장소 연동 (선택)

---

## 학습 자료 및 참고

**React + TypeScript**
- React 공식 문서: react.dev
- TypeScript 핸드북: typescriptlang.org/handbook

**Web Audio API**
- MDN Web Audio API: developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Web Audio API 명세: w3.org/TR/webaudio/

**음원 분리**
- Demucs 문서: github.com/adefossez/demucs
- STFT 신호 처리: en.wikipedia.org/wiki/Short-time_Fourier_transform

**성능 최적화**
- Web Performance Working Group: www.w3.org/webperf/
- Chrome DevTools: developer.chrome.com/docs/devtools
