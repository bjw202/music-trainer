# 배포 아키텍처 완전 가이드

> **작성일**: 2026-02-16
> **주제**: GitHub → Vercel (프론트엔드) + Railway (백엔드) 무료 티어 배포 전략
> **난이도**: 중급
> **예상 학습 시간**: 2-3시간

---

## 목차

1. [배포 아키텍처 개요](#배포-아키텍처-개요)
2. [Phase 1: GitHub 저장소 설정](#phase-1-github-저장소-설정)
3. [Phase 2: Vercel 프론트엔드 배포](#phase-2-vercel-프론트엔드-배포)
4. [Phase 3: Railway 백엔드 배포](#phase-3-railway-백엔드-배포)
5. [Phase 4: 프론트엔드-백엔드 연결](#phase-4-프론트엔드-백엔드-연결)
6. [심화 학습 1: Docker 컨테이너](#심화-학습-1-docker-컨테이너)
7. [심화 학습 2: CORS 동작 원리](#심화-학습-2-cors-동작-원리)
8. [심화 학습 3: 무료 티어 비용 최적화](#심화-학습-3-무료-티어-비용-최적화)
9. [실전 배포 체크리스트](#실전-배포-체크리스트)
10. [연습 문제](#연습-문제)

---

## 배포 아키텍처 개요

### 3개의 독립적인 시스템

프로덕션 배포는 **3개의 독립적인 시스템**을 설정하고 연결하는 과정입니다:

```
┌─────────────────┐
│   GitHub Repo   │  ← 소스 코드 저장소
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌──▼──────┐
│ Vercel │ │ Railway │  ← 호스팅 플랫폼
│(Front) │ │(Backend)│
└────────┘ └─────────┘
```

### 왜 이렇게 분리하는가?

**원칙 1: 관심사의 분리 (Separation of Concerns)**
- 프론트엔드(React): 정적 파일 → CDN 배포 최적화
- 백엔드(FastAPI): 서버 프로세스 → 컴퓨팅 리소스 필요

**원칙 2: 무료 티어 최대 활용**
- Vercel: 프론트엔드 무료 무제한 (대역폭 100GB/월)
- Railway: 백엔드 무료 $5 크레딧/월 (500시간 실행 가능)

**원칙 3: 독립적 확장**
- 프론트엔드 트래픽 증가 → Vercel CDN 자동 확장
- 백엔드 처리 부하 증가 → Railway CPU/메모리 업그레이드

---

## Phase 1: GitHub 저장소 설정

**목표**: 소스 코드를 원격 저장소에 올려 Vercel/Railway가 자동 배포할 수 있게 함

### Step 1.1: GitHub 계정 생성

1. https://github.com 접속
2. "Sign up" 클릭
3. 이메일 인증 완료

### Step 1.2: 로컬 Git 초기화 확인

```bash
# 프로젝트 디렉토리에서 실행
git status
```

출력 예시:
```
On branch main
Changes not staged for commit:
  (많은 수정 파일 목록...)
```

### Step 1.3: GitHub 저장소 생성

1. https://github.com/new 접속
2. Repository name: `guitar-mp3-trainer-v2`
3. Public 또는 Private 선택 (무료 배포는 Public 권장)
4. "Create repository" 클릭

### Step 1.4: 로컬과 GitHub 연결

```bash
# GitHub에서 제공하는 URL 사용
git remote add origin https://github.com/YOUR_USERNAME/guitar-mp3-trainer-v2.git

# 현재 변경사항 커밋
git add .
git commit -m "feat: 프로덕션 배포 준비

- SPEC-UI-001 UI 리디자인 완료
- 키보드 단축키 Q 추가
- 문서 동기화 완료

🗿 MoAI <email@mo.ai.kr>"

# main 브랜치로 푸시
git push -u origin main
```

**검증**: GitHub 저장소 페이지에서 파일들이 업로드되었는지 확인

---

## Phase 2: Vercel 프론트엔드 배포

**목표**: React 앱을 Vercel CDN에 배포하여 전 세계 어디서나 빠르게 접근 가능하게 함

### Step 2.1: Vercel 계정 생성

1. https://vercel.com 접속
2. "Sign Up" → "Continue with GitHub" 선택
3. GitHub 계정으로 로그인 및 권한 승인

### Step 2.2: 프로젝트 Import

1. Vercel 대시보드에서 "Add New..." → "Project" 클릭
2. "Import Git Repository" 섹션에서 `guitar-mp3-trainer-v2` 선택
3. "Import" 클릭

### Step 2.3: 빌드 설정

Vercel이 자동으로 감지:

```
Framework Preset: Vite
Build Command: pnpm build (또는 npm run build)
Output Directory: dist
Install Command: pnpm install (또는 npm install)
```

### Step 2.4: 환경 변수 설정

백엔드 URL은 나중에 설정할 예정이므로, 일단 로컬 주소로 시작:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `http://localhost:8000` |

→ Railway 배포 후 실제 백엔드 URL로 업데이트

### Step 2.5: Deploy

"Deploy" 클릭 → Vercel이 자동으로:

1. GitHub에서 코드 가져오기
2. `pnpm install` 실행
3. `pnpm build` 실행
4. `dist/` 폴더를 CDN에 업로드
5. HTTPS 도메인 자동 생성 (예: `guitar-mp3-trainer-v2.vercel.app`)

**배포 완료 시간**: 약 2-3분

**검증**:
- Vercel 대시보드에서 "Visit" 클릭
- 앱이 로드되는지 확인
- 현재는 백엔드가 없으므로 YouTube 변환/음원 분리는 동작하지 않음 (정상)

---

## Phase 3: Railway 백엔드 배포

**목표**: FastAPI 서버를 Railway에 배포하여 YouTube 변환 및 AI 음원 분리 API 제공

### 왜 GPU가 아닌 CPU인가?

**GPU 비용 문제**:
- GPU 인스턴스: 월 $50-200 (AWS p3.2xlarge 기준)
- CPU 인스턴스: 월 $5-20 (Railway 무료 크레딧으로 충당 가능)

**CPU 처리 성능**:
- Demucs htdemucs 모델: 3분 곡 기준 6-15분 처리 시간 (CPU 4코어)
- GPU 대비 느리지만, 백그라운드 태스크로 처리하면 사용자 경험에 영향 없음
- FastAPI SSE로 실시간 진행률 표시 → 사용자는 기다릴 수 있음

### Step 3.1: Railway 계정 생성

1. https://railway.app 접속
2. "Start a New Project" → "Login with GitHub" 선택
3. GitHub 계정으로 로그인

### Step 3.2: Dockerfile 생성

프로젝트 루트에 `backend/Dockerfile` 생성:

```dockerfile
# Python 3.13 slim 이미지 사용 (경량화)
FROM python:3.13-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (ffmpeg 필수)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY app/ ./app/

# 포트 노출
EXPOSE 8000

# Uvicorn 서버 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 3.3: requirements.txt 확인

`backend/requirements.txt`가 다음을 포함하는지 확인:

```txt
fastapi==0.129.0
uvicorn[standard]
python-multipart
yt-dlp>=2026.2.4
pydub
demucs>=4.0.0
torch>=2.0.0
torchaudio>=2.0.0
torchcodec==0.10.0
numpy
python-dotenv
```

### Step 3.4: Railway 프로젝트 생성

1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. `guitar-mp3-trainer-v2` 저장소 선택
4. "Add variables" 클릭

### Step 3.5: 환경 변수 설정

| Key | Value | 설명 |
|-----|-------|------|
| `PORT` | `8000` | Railway가 자동으로 할당 |
| `CORS_ORIGINS` | `https://guitar-mp3-trainer-v2.vercel.app` | Vercel 프론트엔드 URL |
| `MAX_FILE_SIZE_MB` | `100` | 최대 파일 크기 |
| `TEMP_DIR` | `/tmp/music-trainer` | 임시 파일 디렉토리 |
| `CLEANUP_INTERVAL_MINUTES` | `10` | 임시 파일 정리 주기 |
| `FILE_RETENTION_HOURS` | `1` | 파일 보존 시간 |

### Step 3.6: Root Directory 설정

Railway Settings → "Root Directory" → `backend` 입력

### Step 3.7: Deploy

"Deploy" 클릭 → Railway가 자동으로:

1. Docker 이미지 빌드
2. 컨테이너 실행
3. Public URL 생성 (예: `guitar-mp3-trainer-v2-production.up.railway.app`)

**배포 시간**: 약 5-10분 (Docker 이미지 빌드 포함)

**검증**:

```bash
# Railway URL로 헬스체크
curl https://YOUR_RAILWAY_URL.railway.app/api/v1/health
```

응답:
```json
{"status": "healthy"}
```

---

## Phase 4: 프론트엔드-백엔드 연결

**목표**: Vercel 프론트엔드가 Railway 백엔드 API를 호출할 수 있도록 CORS 및 환경 변수 설정

### Step 4.1: Vercel 환경 변수 업데이트

1. Vercel 대시보드 → 프로젝트 선택 → "Settings" → "Environment Variables"
2. `VITE_API_BASE_URL` 값을 Railway URL로 변경:

```
https://guitar-mp3-trainer-v2-production.up.railway.app
```

3. "Save" 클릭
4. "Deployments" → 최신 배포 → "Redeploy" 클릭

### Step 4.2: Railway CORS 설정 확인

Railway 대시보드 → Variables → `CORS_ORIGINS` 값 확인:

```
https://guitar-mp3-trainer-v2.vercel.app
```

(Vercel 도메인이 정확히 일치해야 함)

### Step 4.3: 통합 테스트

1. **YouTube URL 입력 테스트**:
   - Vercel 앱 열기: https://guitar-mp3-trainer-v2.vercel.app
   - YouTube URL 입력: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - "Convert" 버튼 클릭
   - 진행률 표시 확인
   - MP3 다운로드 및 재생 확인

2. **음원 분리 테스트**:
   - 오디오 파일 로드
   - "Separate Stems" 클릭
   - 진행률 표시 확인 (CPU이므로 5-15분 소요 가능)
   - 스템 믹서 UI 확인

---

## 심화 학습 1: Docker 컨테이너

### Docker가 해결하는 문제

**전통적인 배포 문제**:

```
개발자 로컬 환경:
- Python 3.13
- ffmpeg 6.0
- Ubuntu 22.04
→ "내 컴퓨터에서는 잘 되는데요?"

서버 환경:
- Python 3.11
- ffmpeg 없음
- CentOS 7
→ 배포 실패!
```

**Docker의 해결책**:

```
Docker 이미지 = 전체 환경을 패키징한 스냅샷
- OS + Python + ffmpeg + 코드 + 의존성
→ 어디서나 동일하게 실행
```

### Dockerfile 명령어 심층 분석

#### 1. 베이스 이미지 선택

```dockerfile
FROM python:3.13-slim
```

**의미**: 파이썬 3.13이 설치된 경량화된 Debian Linux 이미지를 기반으로 시작

**왜 slim?**
- `python:3.13` (full): 1GB
- `python:3.13-slim`: 200MB ← 80% 용량 절감
- 빌드 도구를 제외하고 런타임만 포함

#### 2. 작업 디렉토리 설정

```dockerfile
WORKDIR /app
```

**의미**: 컨테이너 내부의 `/app` 디렉토리를 작업 디렉토리로 설정

**이후 모든 명령어는 `/app`에서 실행됨**

#### 3. 시스템 의존성 설치

```dockerfile
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
```

**레이어별 분석**:
- `apt-get update`: 패키지 목록 업데이트
- `apt-get install -y ffmpeg`: ffmpeg 설치 (YouTube 오디오 추출 필수)
- `rm -rf /var/lib/apt/lists/*`: 캐시 삭제로 이미지 크기 감소

**왜 한 줄로?**: Docker는 각 `RUN` 명령어마다 레이어를 생성. 한 줄로 합치면 레이어 수 감소 → 이미지 크기 최적화

#### 4. Python 의존성 복사 및 설치

```dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```

**캐싱 최적화 원리**:

```
Step 1: requirements.txt 복사 (변경 가능성 낮음)
Step 2: pip install (변경 시에만 재실행)
Step 3: 코드 복사 (변경 가능성 높음)

코드 수정 시:
- Step 1, 2는 캐시 사용 (5분 절약)
- Step 3만 재실행
```

**`--no-cache-dir` 플래그**: pip 캐시를 저장하지 않아 이미지 크기 200MB 절감

#### 5. 애플리케이션 코드 복사

```dockerfile
COPY app/ ./app/
```

**왜 마지막에 복사?**: 코드는 자주 변경되므로, 가장 나중에 복사하여 이전 레이어들은 캐시 활용

#### 6. 포트 노출

```dockerfile
EXPOSE 8000
```

**문서화 목적**: 컨테이너가 8000 포트를 사용함을 명시 (실제 포트 바인딩은 런타임에 `-p` 플래그로)

#### 7. 시작 명령어

```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**`0.0.0.0` vs `127.0.0.1` 차이**:
- `127.0.0.1`: 컨테이너 내부에서만 접근 가능 → 외부에서 접근 불가
- `0.0.0.0`: 모든 네트워크 인터페이스에서 수신 → Railway가 외부 접근 가능

### Docker 이미지 빌드 과정

```bash
# Railway가 내부적으로 실행하는 과정
docker build -t guitar-mp3-trainer-backend .

# 실제 진행 과정
Step 1/7 : FROM python:3.13-slim
 ---> Pulling image... (200MB 다운로드)
Step 2/7 : WORKDIR /app
 ---> Running in abc123...
Step 3/7 : RUN apt-get update...
 ---> Running in def456... (ffmpeg 설치)
Step 4/7 : COPY requirements.txt .
 ---> a1b2c3d4 (캐시 가능)
Step 5/7 : RUN pip install...
 ---> Running in ghi789... (5분 소요)
Step 6/7 : COPY app/ ./app/
 ---> e5f6g7h8
Step 7/7 : CMD ["uvicorn"...]
 ---> i9j0k1l2
Successfully built i9j0k1l2
```

### 컨테이너 실행 원리

```bash
# Railway가 실행하는 명령어 (예시)
docker run -d \
  -p 8000:8000 \
  -e CORS_ORIGINS=https://vercel.app \
  -e MAX_FILE_SIZE_MB=100 \
  guitar-mp3-trainer-backend
```

**플래그 설명**:
- `-d`: 백그라운드 실행 (detached mode)
- `-p 8000:8000`: 호스트 8000 포트 → 컨테이너 8000 포트 매핑
- `-e KEY=VALUE`: 환경 변수 주입

---

## 심화 학습 2: CORS 동작 원리

### CORS 에러가 발생하는 이유

**브라우저 Same-Origin Policy**:

```
Origin = Protocol + Domain + Port

예시:
- https://vercel.app:443 (프론트엔드)
- https://railway.app:443 (백엔드)
→ Domain이 다름! → CORS 에러
```

**보안 이유**:

```
악의적인 사이트 (evil.com):
<script>
  fetch('https://yourbank.com/api/transfer', {
    method: 'POST',
    body: JSON.stringify({ to: 'attacker', amount: 1000000 })
  })
</script>

브라우저: "yourbank.com이 evil.com의 요청을 허용했는지 확인 필요"
→ CORS 검사
```

### CORS Preflight Request 흐름

**실제 네트워크 요청 과정**:

```
1. Preflight Request (OPTIONS)
────────────────────────────────────
브라우저 → 백엔드
OPTIONS /api/v1/youtube/convert HTTP/1.1
Host: railway.app
Origin: https://vercel.app
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type

백엔드 → 브라우저 (FastAPI CORS 미들웨어가 자동 응답)
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://vercel.app
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 86400  ← 24시간 캐싱

2. Actual Request (POST)
────────────────────────────────────
브라우저 → 백엔드
POST /api/v1/youtube/convert HTTP/1.1
Host: railway.app
Origin: https://vercel.app
Content-Type: application/json
{"url": "https://youtube.com/..."}

백엔드 → 브라우저
HTTP/1.1 202 Accepted
Access-Control-Allow-Origin: https://vercel.app
{"task_id": "abc123", "status": "processing"}
```

### FastAPI CORS 미들웨어 설정

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://guitar-mp3-trainer-v2.vercel.app",  # 프로덕션
        "http://localhost:5173",                     # 로컬 개발
    ],
    allow_credentials=True,   # 쿠키 포함 요청 허용
    allow_methods=["*"],      # 모든 HTTP 메서드 허용
    allow_headers=["*"],      # 모든 헤더 허용
)
```

**각 옵션 설명**:

| 옵션 | 설명 | 보안 고려사항 |
|------|------|--------------|
| `allow_origins` | 요청을 허용할 도메인 목록 | `["*"]` 사용 금지 (모든 도메인 허용은 보안 위험) |
| `allow_credentials` | 쿠키, Authorization 헤더 포함 요청 허용 | `True` 시 `allow_origins`에 `*` 불가 |
| `allow_methods` | 허용할 HTTP 메서드 | `["GET", "POST"]`로 제한 권장 |
| `allow_headers` | 허용할 요청 헤더 | `["Content-Type"]`로 제한 권장 |

### CORS 디버깅 방법

**Step 1: 브라우저 DevTools 확인**

```
Chrome DevTools → Network 탭
1. OPTIONS 요청 확인
   Status: 204 No Content ✓
   Response Headers:
   - Access-Control-Allow-Origin: https://vercel.app ✓

2. POST 요청 확인
   Status: CORS error ✗
   Console 에러:
   "Access to fetch at 'https://railway.app/api' from origin
    'https://vercel.app' has been blocked by CORS policy"
```

**Step 2: 원인 파악**

```python
# 백엔드 로그 확인
INFO:     127.0.0.1:12345 - "OPTIONS /api/v1/youtube/convert HTTP/1.1" 204
INFO:     Origin header: https://vercel.app
WARNING:  Origin not in allowed origins list!

# 문제: Railway 환경 변수 확인
CORS_ORIGINS=https://guitar-mp3-trainer-v2.vercel.app
             ↑ 하이픈 누락!
```

**Step 3: 수정 및 재배포**

```bash
# Railway 환경 변수 수정
CORS_ORIGINS=https://guitar-mp3-trainer-v2.vercel.app

# 재배포 (Railway가 자동으로 재시작)
```

**Step 4: 검증**

```bash
# curl로 CORS 헤더 확인
curl -H "Origin: https://guitar-mp3-trainer-v2.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://railway.app/api/v1/youtube/convert -v

# 응답 확인
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: https://guitar-mp3-trainer-v2.vercel.app
< Access-Control-Allow-Methods: POST, GET, OPTIONS
```

---

## 심화 학습 3: 무료 티어 비용 최적화

### Vercel 무료 티어 제약

```
제공량:
- 대역폭: 100GB/월
- 빌드 시간: 6000분/월
- 서버리스 함수 실행: 100GB-시간/월

초과 시:
- 자동 과금 시작 ($20/100GB)
- 또는 사이트 일시 중단
```

**최적화 전략 1: 이미지 최적화**

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import imagemin from 'vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    imagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      webp: { quality: 75 }  // WebP로 자동 변환
    })
  ]
})
```

**효과**: 이미지 크기 70% 감소 → 대역폭 70% 절감

**최적화 전략 2: 코드 스플리팅**

```javascript
// src/App.tsx
import { lazy, Suspense } from 'react'

// StemMixer는 사용 시에만 로드
const StemMixerPanel = lazy(() => import('./components/StemMixer/StemMixerPanel'))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      {showStemMixer && <StemMixerPanel />}
    </Suspense>
  )
}
```

**효과**: 초기 번들 크기 40% 감소 → 대역폭 절감 + 로딩 속도 향상

**최적화 전략 3: CDN 캐싱 활용**

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 파일명에 해시 포함 → 캐싱 최적화
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
```

**효과**: 재방문 사용자는 캐시된 파일 사용 → 대역폭 90% 절감

### Railway 무료 티어 제약

```
제공량:
- $5 크레딧/월
- 500 실행 시간/월 (약 20일)
- 512MB RAM, 1 vCPU

비용 계산:
- $0.01/분 (메모리 512MB 기준)
- $5 = 500분 = 8.3시간 연속 실행
```

**최적화 전략 1: Sleep on Idle (자동 절전)**

```python
# backend/app/main.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 로깅
    logger.info("Server started")
    yield
    # 종료 시 정리
    logger.info("Server shutting down")

app = FastAPI(lifespan=lifespan)
```

Railway 설정:
- "Sleep on Idle" 활성화
- 10분간 요청 없으면 자동 절전
- 다음 요청 시 10초 내 자동 재시작

**효과**: 실제 사용 시간만 과금 → $5로 100시간 이상 사용 가능

**최적화 전략 2: Demucs 처리 최적화**

```python
# backend/app/services/separation_service.py
class SeparationService:
    def __init__(self):
        # 모델 로드 캐싱
        self.model = None

    def separate(self, audio_path: str):
        # 첫 요청 시에만 모델 로드 (15초 소요)
        if self.model is None:
            self.model = torch.hub.load('demucs')

        # CPU 최적화: 스레드 제한
        torch.set_num_threads(2)  # 2 vCPU 사용

        # 메모리 최적화: 배치 크기 감소
        return self.model.separate(
            audio_path,
            device='cpu',
            shifts=1,  # 기본값 10 → 1 (메모리 90% 절감)
            overlap=0.25  # 기본값 0.5 → 0.25 (처리 속도 20% 향상)
        )
```

**효과**:
- 메모리 사용: 2GB → 400MB (512MB 한도 내)
- 처리 시간: 15분 → 10분 (shifts 감소)
- 비용: $0.15/곡 → $0.10/곡 (33% 절감)

**최적화 전략 3: 파일 캐싱으로 재처리 방지**

```python
# backend/app/services/cache_service.py
import hashlib
from pathlib import Path

class CacheService:
    def __init__(self):
        self.cache_dir = Path("/tmp/music-trainer/cache")

    def get_cache_key(self, file_path: str) -> str:
        # 파일 해시 계산
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()

    def check_cache(self, cache_key: str) -> bool:
        return (self.cache_dir / cache_key).exists()

    def save_cache(self, cache_key: str, stems: dict):
        cache_path = self.cache_dir / cache_key
        cache_path.mkdir(parents=True, exist_ok=True)

        for stem_name, audio_data in stems.items():
            with open(cache_path / f"{stem_name}.wav", 'wb') as f:
                f.write(audio_data)
```

**효과**:
- 같은 파일 재분리 시: 10분 → 3초 (캐시 반환)
- 비용: $0.10 → $0.001 (99% 절감)

**최적화 전략 4: 비용 모니터링 알림**

```python
# backend/app/middleware/usage_tracking.py
from datetime import datetime, timedelta

class UsageTracker:
    def __init__(self):
        self.monthly_usage = 0
        self.reset_date = datetime.now() + timedelta(days=30)

    async def track_separation(self, duration_minutes: float):
        self.monthly_usage += duration_minutes * 0.01  # $0.01/분

        # 알림 임계값
        if self.monthly_usage > 4.0:  # $4 사용 시 알림
            await send_alert(
                f"Warning: ${self.monthly_usage:.2f} used. "
                f"$1 remaining this month."
            )
```

### 비용 예측 계산기

```python
# 월별 비용 예측
def estimate_monthly_cost(
    daily_conversions: int,      # YouTube 변환 요청 수
    daily_separations: int,       # 음원 분리 요청 수
    avg_song_length_min: float,   # 평균 곡 길이 (분)
):
    # YouTube 변환 비용 (경량 작업)
    conversion_time = daily_conversions * 0.5  # 30초/건
    conversion_cost = conversion_time * 30 * 0.01  # $0.01/분

    # 음원 분리 비용 (무거운 작업)
    separation_time = daily_separations * (avg_song_length_min * 2)  # 곡 길이의 2배
    separation_cost = separation_time * 30 * 0.01

    total_cost = conversion_cost + separation_cost

    return {
        "conversion_cost": conversion_cost,
        "separation_cost": separation_cost,
        "total_cost": total_cost,
        "within_free_tier": total_cost <= 5.0
    }

# 예시
estimate_monthly_cost(
    daily_conversions=10,    # 하루 10건 변환
    daily_separations=5,     # 하루 5건 분리
    avg_song_length_min=4    # 평균 4분 곡
)
# 결과:
# {
#   "conversion_cost": $1.50,
#   "separation_cost": $12.00,  ← 무료 티어 초과!
#   "total_cost": $13.50,
#   "within_free_tier": False
# }
```

**해결책**:
- 무료 티어 유지: 하루 2건 분리로 제한
- 유료 전환: $10/월 플랜 (20건/일 가능)
- 하이브리드: 첫 2건 무료, 이후 유료 ($0.50/건)

---

## 실전 배포 체크리스트

### 배포 전 확인사항

- [ ] GitHub 저장소 생성 및 코드 푸시 완료
- [ ] Vercel 프로젝트 생성 및 환경 변수 설정
- [ ] Railway 프로젝트 생성 및 Dockerfile 작성
- [ ] CORS 설정 (Railway 환경 변수)
- [ ] 프론트엔드-백엔드 URL 연결 확인
- [ ] YouTube 변환 기능 테스트
- [ ] 음원 분리 기능 테스트 (3분 곡으로 시작)
- [ ] 무료 티어 사용량 모니터링 설정

### 배포 후 모니터링

- [ ] Vercel Analytics로 트래픽 확인
- [ ] Railway Metrics로 CPU/메모리 사용량 확인
- [ ] 에러 로그 확인 (Vercel/Railway 대시보드)
- [ ] CORS 에러 발생 여부 확인
- [ ] 월별 비용 추적 ($5 한도 체크)

---

## 연습 문제

### 문제 1: Docker 레이어 최적화

다음 Dockerfile을 최적화하여 이미지 크기를 줄이고 빌드 시간을 단축하세요:

```dockerfile
FROM python:3.13
RUN apt-get update
RUN apt-get install -y ffmpeg
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "app.main:app"]
```

**힌트**:
- slim 이미지 사용
- RUN 명령어 통합
- 캐시 최적화를 위한 COPY 순서 조정
- apt 캐시 정리

<details>
<summary>정답 보기</summary>

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# 시스템 의존성 한 줄로 통합 + 캐시 정리
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 먼저 복사 (캐시 활용)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 코드는 마지막에 복사
COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**개선 사항**:
1. `python:3.13` → `python:3.13-slim` (800MB 절감)
2. RUN 명령어 통합 (레이어 수 감소)
3. apt 캐시 삭제 (50MB 절감)
4. requirements.txt 먼저 복사 (빌드 시간 80% 단축)
5. pip --no-cache-dir (200MB 절감)
</details>

### 문제 2: CORS 에러 디버깅

프론트엔드(https://myapp.vercel.app)에서 백엔드(https://api.railway.app)로 POST 요청 시 다음 에러가 발생합니다:

```
Access to fetch at 'https://api.railway.app/upload' from origin
'https://myapp.vercel.app' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

백엔드 CORS 설정:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp-vercel.app"],  # 문제 있음?
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

**문제를 찾아서 수정하세요.**

<details>
<summary>정답 보기</summary>

**문제**: `allow_origins`의 URL에 하이픈이 잘못되었습니다.

```python
# 잘못된 설정
allow_origins=["https://myapp-vercel.app"]  # 하이픈 위치 오류!

# 올바른 설정
allow_origins=["https://myapp.vercel.app"]  # myapp.vercel.app
```

**디버깅 방법**:
1. Chrome DevTools → Network → OPTIONS 요청 확인
2. Response Headers에 `Access-Control-Allow-Origin` 없음
3. 백엔드 로그에서 "Origin not in allowed origins" 경고 확인
4. Railway 환경 변수 `CORS_ORIGINS` 값 재확인
</details>

### 문제 3: Railway 비용 최적화

현재 월별 Railway 비용이 $12로 무료 티어($5)를 초과하고 있습니다.

**현재 상황**:
- 하루 YouTube 변환: 20건 (각 30초 소요)
- 하루 음원 분리: 8건 (각 4분 곡, 10분 처리 시간)
- Sleep on Idle: 비활성화
- Demucs shifts: 10 (기본값)

**$5 이내로 비용을 줄이는 최적화 전략을 3가지 제시하세요.**

<details>
<summary>정답 보기</summary>

**전략 1: Sleep on Idle 활성화**
```
현재: 24시간 * 30일 = 720시간 = $432/월
최적화 후: 실제 사용 시간 (약 50시간/월) = $30/월

절감: $402/월
```

**전략 2: Demucs shifts 감소**
```python
# shifts=10 → shifts=1
return self.model.separate(
    audio_path,
    device='cpu',
    shifts=1,  # 처리 시간 50% 단축
    overlap=0.25
)

현재: 8건 * 10분 * 30일 = 2400분 = $24/월
최적화 후: 8건 * 5분 * 30일 = 1200분 = $12/월

절감: $12/월
```

**전략 3: 파일 캐싱 구현**
```python
# 중복 요청 50% 캐시 히트 가정
실제 처리: 8건 * 50% = 4건

현재: 8건 * 5분 * 30일 = 1200분 = $12/월
최적화 후: 4건 * 5분 * 30일 = 600분 = $6/월

절감: $6/월
```

**총 절감 효과**:
- 전략 1 + 2 + 3 조합
- 최종 비용: 약 $6/월 (Sleep on Idle 효과 포함)
- 무료 티어 초과분: $1/월 (허용 가능한 수준)
</details>

---

## 핵심 정리

### CI/CD 자동 배포 파이프라인

```
코드 수정 (로컬)
    ↓
git push origin main
    ↓
GitHub (저장소 업데이트)
    ↓
Vercel/Railway 웹훅 감지
    ↓
자동 빌드 및 배포
    ↓
새 버전 배포 완료
```

### 환경 변수 보안

```
.env (로컬 개발)
- VITE_API_BASE_URL=http://localhost:8000
- API_KEY=secret_key_12345  ← 절대 Git에 올리면 안 됨

.gitignore (반드시 포함)
.env
.env.local
.env.production
```

### CORS 원리

```
프론트엔드: https://vercel.app
백엔드:    https://railway.app

브라우저 보안: 다른 도메인 간 요청 차단
해결책: 백엔드에서 명시적으로 허용
```

### CPU 기반 Demucs 최적화

```
처리 시간 예측:
3분 곡:
- GPU: 30초-1분
- CPU: 6-15분

사용자 경험 최적화:
1. SSE 진행률 표시
2. 백그라운드 태스크
3. 파일 해시 기반 캐싱
```

---

## 참고 자료

- [Vercel 공식 문서](https://vercel.com/docs)
- [Railway 공식 문서](https://docs.railway.app)
- [Docker 공식 문서](https://docs.docker.com)
- [FastAPI CORS 가이드](https://fastapi.tiangolo.com/tutorial/cors/)
- [Demucs GitHub](https://github.com/facebookresearch/demucs)

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**다음 학습**: CI/CD 파이프라인 고급, Kubernetes 배포, 모니터링 및 로깅
