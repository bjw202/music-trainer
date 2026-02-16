# Railway 백엔드 배포 가이드

> **작성일**: 2026-02-16
> **대상**: Guitar MP3 Trainer v2 FastAPI 백엔드
> **플랫폼**: Railway (컨테이너 기반 배포)

---

## 목차

1. [사전 준비사항](#사전-준비사항)
2. [Step 1: Railway 계정 생성](#step-1-railway-계정-생성)
3. [Step 2: 새 프로젝트 생성](#step-2-새-프로젝트-생성)
4. [Step 3: GitHub 저장소 연결](#step-3-github-저장소-연결)
5. [Step 4: Root Directory 설정](#step-4-root-directory-설정)
6. [Step 5: 환경 변수 설정](#step-5-환경-변수-설정)
7. [Step 6: 배포 실행](#step-6-배포-실행)
8. [Step 7: 배포 확인](#step-7-배포-확인)
9. [Step 8: Vercel 프론트엔드 연동](#step-8-vercel-프론트엔드-연동)
10. [문제 해결](#문제-해결)
11. [비용 최적화](#비용-최적화)

---

## 사전 준비사항

### 필수 조건

- [x] GitHub 저장소에 백엔드 코드 푸시 완료
- [x] `backend/Dockerfile` 존재 확인
- [x] `backend/requirements.txt` 존재 확인
- [x] `backend/.env.example` 파일 준비 완료

### 로컬 Docker 테스트

배포 전 반드시 로컬에서 Docker 빌드를 테스트하세요:

```bash
# backend 폴더로 이동
cd backend

# Docker 이미지 빌드
docker build -t backend-test .

# 컨테이너 실행 (포트 8000)
docker run -p 8000:8000 \
  -e DOWNLOAD_DIR=/tmp/ytdlp_downloads \
  -e CORS_ORIGINS='["http://localhost:5173"]' \
  backend-test

# 다른 터미널에서 헬스 체크
curl http://localhost:8000/api/v1/health
```

**성공 확인**:
```json
{
  "status": "healthy",
  "ffmpeg_available": true,
  "disk_space_mb": 1234.5,
  "active_conversions": 0
}
```

---

## Step 1: Railway 계정 생성

### 1.1 Railway 가입

1. [Railway 홈페이지](https://railway.app) 접속
2. **"Login"** 클릭
3. **"Login with GitHub"** 선택
4. GitHub 계정으로 로그인 및 권한 승인

### 1.2 무료 크레딧 확인

Railway 무료 티어:
- **$5 무료 크레딧/월** (Trial Plan)
- 크레딧 소진 시 서비스 중지 (자동 결제 없음)
- 추가 사용 시 종량제 요금 ($0.000231/GB-sec)

---

## Step 2: 새 프로젝트 생성

### 2.1 프로젝트 생성

1. Railway 대시보드에서 **"New Project"** 클릭
2. **"Deploy from GitHub repo"** 선택
3. `guitar-mp3-trainer-v2` 저장소 선택
4. **"Deploy Now"** 클릭

### 2.2 프로젝트 이름 변경 (선택사항)

1. 프로젝트 설정 아이콘 (⚙️) 클릭
2. **"Project Name"** → `guitar-mp3-trainer-backend`
3. **"Save"** 클릭

---

## Step 3: GitHub 저장소 연결

### 3.1 저장소 권한 확인

Railway가 GitHub 저장소에 접근할 수 있는지 확인:
- Railway 대시보드에서 저장소 목록 표시 확인
- 보이지 않는다면 GitHub에서 Railway 앱 권한 재승인

### 3.2 자동 배포 설정

Railway는 기본적으로 다음과 같이 자동 배포됩니다:
- **main 브랜치 푸시 시**: 자동 프로덕션 배포
- **PR 생성 시**: 자동 Preview 환경 생성

---

## Step 4: Root Directory 설정

### 4.1 모노레포 설정

**중요**: 현재 프로젝트는 모노레포 구조이므로 **Root Directory를 `backend/`로 설정**해야 합니다.

1. Railway 서비스 클릭
2. **"Settings"** 탭 선택
3. **"Root Directory"** 섹션 찾기
4. 값을 **`backend`**로 입력 (슬래시 없이)
5. **"Save"** 클릭

**설정 후 동작**:
- Railway는 `backend/` 폴더만 빌드 컨텍스트로 사용
- `backend/Dockerfile`을 찾아 실행
- 프론트엔드 코드(`src/`, `package.json` 등)는 무시됨

---

## Step 5: 환경 변수 설정

### 5.1 필수 환경 변수 추가

Railway 서비스 → **"Variables"** 탭에서 다음 변수를 추가하세요:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `PORT` | `8000` | Railway가 자동 할당하는 포트 (기본값 사용 권장) |
| `DOWNLOAD_DIR` | `/tmp/ytdlp_downloads` | YouTube 다운로드 디렉터리 |
| `MAX_DURATION_SECONDS` | `1800` | 최대 다운로드 허용 시간 (30분) |
| `MAX_CONCURRENT_DOWNLOADS` | `5` | 동시 다운로드 제한 |
| `RATE_LIMIT_PER_MINUTE` | `10` | API 호출 제한 (분당) |
| `CORS_ORIGINS` | `["https://guitar-mp3-trainer-v2.vercel.app"]` | Vercel 프론트엔드 도메인 (CORS 허용) |

**주의사항**:
- `CORS_ORIGINS`는 JSON 배열 형식으로 입력해야 합니다
- Vercel 배포 URL이 다르다면 실제 URL로 변경하세요
- 로컬 테스트용으로 `http://localhost:5173`도 추가 가능:
  ```
  ["https://guitar-mp3-trainer-v2.vercel.app", "http://localhost:5173"]
  ```

### 5.2 환경 변수 추가 방법

각 변수마다:
1. **"New Variable"** 클릭
2. **Variable Name** 입력 (예: `DOWNLOAD_DIR`)
3. **Variable Value** 입력 (예: `/tmp/ytdlp_downloads`)
4. **"Add"** 클릭

---

## Step 6: 배포 실행

### 6.1 첫 배포 트리거

환경 변수 설정 후:
1. Railway 서비스 → **"Deployments"** 탭
2. **"Deploy"** 버튼 클릭 (또는 자동 배포 대기)

### 6.2 빌드 로그 확인

**Deploy Logs** 섹션에서 실시간 로그 확인:

```
Step 1/12 : FROM python:3.12-slim
Step 2/12 : RUN apt-get update && apt-get install -y ffmpeg
Step 3/12 : WORKDIR /app
...
Step 12/12 : CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
Successfully built abc123def456
Successfully tagged railway.app/service:latest

Deploying...
✓ Deployment successful
Service available at: https://backend-production-abc123.up.railway.app
```

**배포 시간**: 평균 3-5분 (첫 배포는 더 오래 걸릴 수 있음)

### 6.3 배포 실패 시

**일반적인 원인**:
- Dockerfile 경로 오류 → Root Directory 설정 재확인
- 환경 변수 누락 → Variables 탭에서 필수 변수 확인
- 빌드 타임아웃 → Railway 플랜 업그레이드 필요

---

## Step 7: 배포 확인

### 7.1 서비스 URL 확인

1. Railway 서비스 → **"Settings"** 탭
2. **"Domains"** 섹션에서 자동 생성된 URL 확인:
   ```
   https://backend-production-abc123.up.railway.app
   ```
3. 이 URL을 복사하여 저장하세요 (Vercel 환경 변수에 사용)

### 7.2 헬스 체크 테스트

브라우저 또는 curl로 헬스 엔드포인트 접속:

```bash
curl https://backend-production-abc123.up.railway.app/api/v1/health
```

**예상 응답**:
```json
{
  "status": "healthy",
  "ffmpeg_available": true,
  "disk_space_mb": 5123.4,
  "active_conversions": 0
}
```

### 7.3 API 문서 확인

FastAPI 자동 생성 문서 접속:
```
https://backend-production-abc123.up.railway.app/docs
```

**확인 사항**:
- `/api/v1/health` 엔드포인트 존재
- `/api/v1/youtube/convert` 엔드포인트 존재
- `/api/v1/separation/separate` 엔드포인트 존재
- Swagger UI 정상 로드

---

## Step 8: Vercel 프론트엔드 연동

### 8.1 Vercel 환경 변수 업데이트

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. `guitar-mp3-trainer-v2` 프로젝트 선택
3. **"Settings"** → **"Environment Variables"**
4. `VITE_API_BASE_URL` 찾기
5. **"Edit"** 클릭
6. Value를 Railway URL로 변경:
   ```
   https://backend-production-abc123.up.railway.app
   ```
7. **"Save"** 클릭

### 8.2 Vercel 재배포

환경 변수 변경 후 **반드시 재배포**해야 적용됩니다:

1. **"Deployments"** 탭
2. 최신 배포 선택
3. **"︙"** (점 3개) → **"Redeploy"** 클릭
4. **"Redeploy"** 확인

**재배포 시간**: 약 2-3분

### 8.3 CORS 설정 검증

Railway의 `CORS_ORIGINS` 환경 변수에 Vercel 도메인이 정확히 포함되어 있는지 확인:

```json
["https://guitar-mp3-trainer-v2.vercel.app"]
```

**주의**:
- 프로토콜 포함 (`https://`)
- 마지막 슬래시 없음
- 정확한 도메인 이름

---

## 문제 해결

### 문제 1: 배포 실패 - ModuleNotFoundError

**증상**:
```
ModuleNotFoundError: No module named 'app'
```

**원인**:
- Root Directory 설정 오류
- Dockerfile의 COPY 경로 오류

**해결 방법**:
1. Railway Settings → Root Directory가 `backend`인지 확인
2. `backend/Dockerfile`에서 `COPY app/ ./app/` 라인 확인
3. 재배포

---

### 문제 2: 헬스 체크 실패

**증상**:
```
Health check failed: timeout
```

**원인**:
- 앱이 `0.0.0.0:8000`에서 리슨하지 않음
- 헬스 체크 경로 오류

**해결 방법**:
1. Dockerfile CMD 확인:
   ```dockerfile
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```
2. `railway.json`의 `healthcheckPath` 확인:
   ```json
   "healthcheckPath": "/api/v1/health"
   ```
3. 로그에서 "Uvicorn running on" 메시지 확인

---

### 문제 3: CORS 에러 (프론트엔드에서)

**증상** (Vercel 앱 브라우저 콘솔):
```
Access to fetch at 'https://backend.railway.app/api/v1/youtube/convert'
from origin 'https://guitar-mp3-trainer-v2.vercel.app'
has been blocked by CORS policy
```

**원인**:
- Railway 환경 변수 `CORS_ORIGINS`에 Vercel 도메인 누락
- 도메인 오타 또는 프로토콜 누락

**해결 방법**:
1. Railway → Variables → `CORS_ORIGINS` 확인
2. 정확한 JSON 배열 형식으로 입력:
   ```json
   ["https://guitar-mp3-trainer-v2.vercel.app"]
   ```
3. Railway 서비스 재시작 (자동)
4. Vercel에서 재테스트

---

### 문제 4: CPU 부족 - Demucs 처리 느림

**증상**:
- 음원 분리 처리 시간이 매우 느림 (10분 이상)
- CPU 사용률 100% 지속

**원인**:
- Railway 무료 플랜의 CPU 제한
- Demucs는 CPU 집약적 작업

**해결 방법**:

**임시 해결책**:
1. 처리 시간 제한 늘리기:
   ```
   MAX_DURATION_SECONDS=3600  # 1시간
   ```

**장기 해결책**:
1. Railway 유료 플랜 업그레이드:
   - **Hobby Plan**: $5/월 (더 많은 CPU, 메모리)
   - **Pro Plan**: $20/월 (전용 vCPU, 우선순위 처리)
2. 또는 GPU 지원 플랫폼으로 이전 (Replicate, Modal 등)

---

### 문제 5: 디스크 공간 부족

**증상**:
```
OSError: [Errno 28] No space left on device
```

**원인**:
- `/tmp/ytdlp_downloads` 디렉터리에 파일 누적
- Railway 무료 티어 디스크 제한 (10GB)

**해결 방법**:

**1. 자동 정리 확인**:
- 백엔드는 10분마다 만료된 파일 자동 삭제 (30분 이상 경과)
- 로그에서 "Cleanup background task" 메시지 확인

**2. 수동 정리** (Railway CLI 사용):
```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 컨테이너 접속
railway run bash

# 파일 삭제
rm -rf /tmp/ytdlp_downloads/*
```

**3. 환경 변수 조정**:
```
MAX_CONCURRENT_DOWNLOADS=2  # 동시 처리 수 줄이기
```

---

## 비용 최적화

### Railway 무료 티어 최대 활용

**무료 크레딧**: $5/월

**예상 사용량**:
- CPU: $0.000231/GB-sec
- Memory: $0.000231/GB-sec
- Disk: $0.25/GB/월

**비용 절감 팁**:

1. **CPU 절약**:
   - 사용하지 않는 시간에 서비스 슬립 (자동)
   - 동시 처리 수 제한 (`MAX_CONCURRENT_DOWNLOADS=3`)

2. **메모리 절약**:
   - Demucs 모델 캐싱 비활성화 (환경 변수)
   - 파일 스트리밍 처리 (메모리 적재 최소화)

3. **디스크 절약**:
   - 파일 만료 시간 단축 (15분으로 조정)
   - 정기 정리 주기 단축 (5분마다)

4. **네트워크 절약**:
   - Vercel → Railway 호출 최소화
   - 프론트엔드에서 로컬 오디오 처리 우선

### 비용 모니터링

Railway 대시보드에서:
1. **"Usage"** 탭 클릭
2. **"Estimated Cost"** 확인
3. **"Resource Usage"** 그래프 분석

**경고 설정**:
1. **"Settings"** → **"Usage Alerts"**
2. **"Alert when usage exceeds $X"** 설정 (예: $4)
3. 이메일 알림 활성화

---

## 커스텀 도메인 설정 (선택사항)

### 도메인 연결

자신의 도메인이 있다면 (예: `api.musictrainer.com`):

1. Railway 서비스 → **"Settings"** → **"Domains"**
2. **"Custom Domain"** 입력: `api.musictrainer.com`
3. **"Add"** 클릭

### DNS 설정

Railway가 제공하는 CNAME 레코드를 도메인 등록업체에 추가:

```
Type: CNAME
Name: api
Value: backend-production-abc123.up.railway.app
```

### SSL 인증서

Railway는 Let's Encrypt를 통해 **자동으로 SSL 인증서 발급**:
- 발급 시간: 수 분 ~ 1시간
- 갱신: 자동

---

## 배포 완료 체크리스트

배포 후 다음 항목을 확인하세요:

### 백엔드 단독 기능

- [x] 헬스 체크 정상 (`/api/v1/health`)
- [x] API 문서 접근 가능 (`/docs`)
- [x] ffmpeg 설치 확인 (헬스 체크 응답에서 `ffmpeg_available: true`)
- [x] 디스크 공간 충분 (`disk_space_mb > 1000`)

### Vercel 프론트엔드 연동 후

- [ ] YouTube URL 변환 성공
- [ ] 진행률 표시 (SSE) 정상 동작
- [ ] MP3 다운로드 및 재생
- [ ] AI 음원 분리 (Demucs) 처리 완료
- [ ] 스템 믹서 UI 동작 (Vocals, Drums, Bass, Other)
- [ ] CORS 에러 없음

---

## 자동 배포 워크플로

### Git Push → 자동 배포

**main 브랜치 푸시 시**:
```bash
cd backend
# 코드 수정 후
git add .
git commit -m "feat: 새 API 엔드포인트 추가"
git push origin main
```

**Railway 자동 동작**:
1. GitHub Webhook 감지
2. 코드 클론 (`backend/` Root Directory)
3. Docker 이미지 빌드
4. 컨테이너 실행
5. 헬스 체크 통과 후 트래픽 전환
6. 완료 알림 (Slack 연동 가능)

**배포 시간**: 평균 3-5분

---

## 다음 단계

1. **Vercel 환경 변수 업데이트**: `VITE_API_BASE_URL`을 Railway URL로 변경
2. **통합 테스트**: YouTube 변환 및 음원 분리 전체 플로우 테스트
3. **모니터링 설정**: Railway Logs 확인 및 Sentry 연동 (선택사항)
4. **성능 최적화**: CPU 사용량 모니터링 및 플랜 업그레이드 검토

---

## 참고 자료

- [Railway 공식 문서](https://docs.railway.app)
- [Docker 프로덕션 Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [FastAPI 배포 가이드](https://fastapi.tiangolo.com/deployment/)
- [Demucs 공식 문서](https://github.com/facebookresearch/demucs)

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**다음 업데이트**: Vercel-Railway 통합 테스트 가이드
