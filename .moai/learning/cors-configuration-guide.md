# CORS 설정 완벽 가이드

> **작성일**: 2026-02-16
> **대상**: Guitar MP3 Trainer v2 (Vercel 프론트엔드 + Railway 백엔드)

---

## 목차

1. [CORS란 무엇인가?](#cors란-무엇인가)
2. [현재 프로젝트의 CORS 구조](#현재-프로젝트의-cors-구조)
3. [Railway 백엔드 CORS 설정](#railway-백엔드-cors-설정)
4. [Vercel 프론트엔드 설정](#vercel-프론트엔드-설정)
5. [CORS 에러 디버깅](#cors-에러-디버깅)
6. [보안 Best Practices](#보안-best-practices)
7. [개발 vs 프로덕션 설정](#개발-vs-프로덕션-설정)

---

## CORS란 무엇인가?

### Cross-Origin Resource Sharing (CORS)

**정의**: 다른 도메인에서 실행되는 프론트엔드가 백엔드 API에 접근할 수 있도록 허용하는 보안 메커니즘입니다.

### Origin이란?

Origin = 프로토콜 + 도메인 + 포트

**예시**:
```
https://guitar-mp3-trainer-v2.vercel.app
━━━━━━ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
protocol   domain
```

**같은 Origin**:
- `https://example.com/page1`
- `https://example.com/page2`

**다른 Origin (CORS 필요)**:
- 프론트엔드: `https://guitar-mp3-trainer-v2.vercel.app`
- 백엔드: `https://backend-production-abc123.up.railway.app`

---

## 현재 프로젝트의 CORS 구조

### 배포 아키텍처

```
사용자 브라우저
    ↓
Vercel 프론트엔드
(https://guitar-mp3-trainer-v2.vercel.app)
    ↓
Railway 백엔드 API
(https://backend-production-abc123.up.railway.app)
```

### CORS가 필요한 이유

브라우저의 **Same-Origin Policy**:
- 기본적으로 다른 도메인의 API 호출 차단
- XSS 공격 방지용 보안 정책

**CORS 설정 없이 API 호출 시**:
```javascript
// Vercel 프론트엔드 (https://guitar-mp3-trainer-v2.vercel.app)
fetch("https://backend.railway.app/api/v1/youtube/convert")

// ❌ 브라우저 에러:
// Access blocked by CORS policy
```

**CORS 설정 후**:
```javascript
// ✅ Railway 백엔드가 Vercel 도메인 허용
// 정상 API 호출 가능
```

---

## Railway 백엔드 CORS 설정

### FastAPI CORS 미들웨어 (이미 구현됨)

**파일**: `backend/app/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # 환경 변수에서 로드
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용 (GET, POST, PUT, DELETE 등)
    allow_headers=["*"],  # 모든 헤더 허용
)
```

**설정 로드**: `backend/app/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    class Config:
        env_file = ".env"
```

---

### Railway 환경 변수 설정

Railway 대시보드에서 환경 변수 추가:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `CORS_ORIGINS` | `["https://guitar-mp3-trainer-v2.vercel.app"]` | Vercel 프론트엔드 도메인 |

**정확한 형식**:
```json
["https://guitar-mp3-trainer-v2.vercel.app"]
```

**주의사항**:
- ✅ **JSON 배열 형식** 사용 (`[...]`)
- ✅ **큰따옴표** 사용 (`"..."`)
- ✅ **https 프로토콜** 포함
- ✅ **마지막 슬래시 없음**
- ❌ `https://guitar-mp3-trainer-v2.vercel.app/` (슬래시 있으면 실패)

---

### 개발 환경 + 프로덕션 함께 설정

로컬 테스트도 허용하려면:

```json
[
  "https://guitar-mp3-trainer-v2.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
]
```

**설명**:
- Vercel 프로덕션 도메인
- Vite 개발 서버 (포트 5173)
- Next.js 개발 서버 (포트 3000, 향후 마이그레이션 대비)

---

### 와일드카드 사용 (비권장)

**모든 Origin 허용** (개발 전용):
```json
["*"]
```

**또는 FastAPI 코드에서**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ 프로덕션에서는 절대 사용 금지
    ...
)
```

**위험성**:
- 모든 도메인에서 API 접근 가능
- CSRF 공격, 데이터 유출 위험
- **프로덕션 환경에서는 절대 사용 금지**

---

## Vercel 프론트엔드 설정

### API Base URL 설정

**환경 변수**: `VITE_API_BASE_URL`

Vercel 대시보드 → 프로젝트 → **"Settings"** → **"Environment Variables"**:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_BASE_URL` | `https://backend-production-abc123.up.railway.app` | Production, Preview, Development |

**프론트엔드 코드에서 사용**:

```typescript
// src/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

// src/services/api.ts
const response = await fetch(`${API_BASE_URL}/api/v1/youtube/convert`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url: youtubeUrl }),
})
```

---

### Fetch Options (Credentials)

**With Credentials** (쿠키/인증 포함 시):

```typescript
fetch(url, {
  credentials: "include",  // 쿠키 전송 허용
})
```

**Railway CORS 설정 필요**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,  # 이미 설정됨
    ...
)
```

---

## CORS 에러 디버깅

### 에러 메시지 해석

**브라우저 콘솔 에러**:
```
Access to fetch at 'https://backend.railway.app/api/v1/youtube/convert'
from origin 'https://guitar-mp3-trainer-v2.vercel.app'
has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**원인**:
- Railway 백엔드의 `CORS_ORIGINS`에 Vercel 도메인이 없음
- 또는 도메인 오타

---

### 디버깅 단계별 가이드

#### Step 1: Railway 환경 변수 확인

Railway 대시보드 → 서비스 → **"Variables"** 탭:

```
CORS_ORIGINS = ["https://guitar-mp3-trainer-v2.vercel.app"]
```

**확인 사항**:
- ✅ 변수명 정확: `CORS_ORIGINS` (대문자)
- ✅ JSON 배열 형식
- ✅ 큰따옴표 사용
- ✅ https 프로토콜
- ✅ Vercel URL 정확

---

#### Step 2: Railway 로그 확인

Railway 대시보드 → 서비스 → **"Deployments"** → **"View Logs"**:

```
INFO:     CORS origins: ['https://guitar-mp3-trainer-v2.vercel.app']
INFO:     Application startup complete
```

**만약 다른 값이 출력된다면**:
- 환경 변수 재설정
- Railway 서비스 재시작 (자동)

---

#### Step 3: Preflight 요청 확인

브라우저 DevTools → **"Network"** 탭:

**OPTIONS 요청** (Preflight):
```
Request Method: OPTIONS
Request URL: https://backend.railway.app/api/v1/youtube/convert
```

**응답 헤더 확인**:
```
Access-Control-Allow-Origin: https://guitar-mp3-trainer-v2.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Allow-Credentials: true
```

**만약 헤더가 없다면**:
- FastAPI CORS 미들웨어 설정 확인
- Railway 배포 재확인

---

#### Step 4: 실제 요청 확인

**POST 요청**:
```
Request Method: POST
Request URL: https://backend.railway.app/api/v1/youtube/convert
Origin: https://guitar-mp3-trainer-v2.vercel.app
```

**응답 헤더**:
```
Access-Control-Allow-Origin: https://guitar-mp3-trainer-v2.vercel.app
```

**성공 시**: 200 OK 응답
**실패 시**: CORS 에러

---

### 일반적인 CORS 에러 원인

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| "No Access-Control-Allow-Origin" | Railway `CORS_ORIGINS` 미설정 | 환경 변수 추가 |
| "Origin not allowed" | Vercel URL 오타 | 정확한 URL로 수정 |
| "Credentials not allowed" | `allow_credentials=False` | FastAPI 설정 확인 (이미 true) |
| "Method not allowed" | `allow_methods` 제한 | `["*"]`로 설정 (이미 설정됨) |

---

## 보안 Best Practices

### 1. 명시적 Origin 리스트

**권장** (현재 설정):
```json
["https://guitar-mp3-trainer-v2.vercel.app"]
```

**비권장**:
```json
["*"]  # 모든 도메인 허용 (보안 위험)
```

---

### 2. HTTPS 강제

**프로덕션에서는 HTTPS만 허용**:
```json
[
  "https://guitar-mp3-trainer-v2.vercel.app"
]
```

**HTTP는 개발 환경만**:
```json
[
  "https://guitar-mp3-trainer-v2.vercel.app",
  "http://localhost:5173"
]
```

---

### 3. 환경별 분리

**개발 환경** (로컬):
```bash
# backend/.env
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

**프로덕션 환경** (Railway):
```json
["https://guitar-mp3-trainer-v2.vercel.app"]
```

---

### 4. Credentials 최소화

**쿠키/인증이 필요 없다면**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,  # 보안 강화
    ...
)
```

**현재 프로젝트**: YouTube 변환은 인증 불필요 → `allow_credentials=True`는 과도할 수 있음

**향후 개선**:
- 사용자 인증 추가 시 `allow_credentials=True` 유지
- 인증 없는 API는 `False`로 변경 검토

---

## 개발 vs 프로덕션 설정

### 개발 환경 (로컬)

**백엔드** (`backend/.env`):
```bash
CORS_ORIGINS=["http://localhost:5173"]
PORT=8000
```

**프론트엔드** (`.env.development`):
```bash
VITE_API_BASE_URL=http://localhost:8000
```

**실행**:
```bash
# 백엔드
cd backend
uvicorn app.main:app --reload

# 프론트엔드 (다른 터미널)
npm run dev
```

---

### 프로덕션 환경

**Railway 백엔드**:
```json
CORS_ORIGINS = ["https://guitar-mp3-trainer-v2.vercel.app"]
PORT = 8000
```

**Vercel 프론트엔드**:
```
VITE_API_BASE_URL = https://backend-production-abc123.up.railway.app
```

---

### 통합 테스트

**로컬 프론트엔드 → Railway 백엔드**:

1. Railway `CORS_ORIGINS`에 `http://localhost:5173` 추가:
   ```json
   [
     "https://guitar-mp3-trainer-v2.vercel.app",
     "http://localhost:5173"
   ]
   ```

2. 프론트엔드 `.env.development`:
   ```bash
   VITE_API_BASE_URL=https://backend-production-abc123.up.railway.app
   ```

3. 로컬 프론트엔드 실행:
   ```bash
   npm run dev
   ```

4. YouTube 변환 테스트

---

## 체크리스트

### Railway 백엔드

- [x] FastAPI CORS 미들웨어 설정 완료
- [ ] Railway 환경 변수 `CORS_ORIGINS` 추가
- [ ] Vercel URL 정확히 입력 (https, 슬래시 없음)
- [ ] Railway 서비스 재시작 (자동)
- [ ] 배포 로그에서 CORS origins 확인

### Vercel 프론트엔드

- [ ] 환경 변수 `VITE_API_BASE_URL` 설정
- [ ] Railway 백엔드 URL 정확히 입력
- [ ] Vercel 재배포 (환경 변수 변경 후 필수)
- [ ] 배포 후 브라우저 콘솔 CORS 에러 확인

### 통합 테스트

- [ ] Vercel 앱에서 YouTube URL 변환 시도
- [ ] 브라우저 DevTools → Network 탭 확인
- [ ] OPTIONS 요청 (Preflight) 성공 확인
- [ ] POST 요청 (실제 변환) 성공 확인
- [ ] CORS 에러 없음 확인

---

## 참고 자료

- [MDN CORS 가이드](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [FastAPI CORS 미들웨어](https://fastapi.tiangolo.com/tutorial/cors/)
- [Railway 환경 변수 설정](https://docs.railway.app/develop/variables)
- [Vercel 환경 변수 설정](https://vercel.com/docs/concepts/projects/environment-variables)

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**중요도**: ⭐⭐⭐⭐⭐ (배포 필수 설정)
