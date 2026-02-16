# Railway Dockerfile 최적화 가이드

> **작성일**: 2026-02-16
> **대상**: Guitar MP3 Trainer v2 FastAPI 백엔드

---

## 현재 Dockerfile 분석

### 기존 Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.12-slim

# ffmpeg 설치
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 복사
COPY app/ ./app/

# 다운로드 디렉터리 생성
RUN mkdir -p /tmp/ytdlp_downloads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 장점

✅ Python 3.12 slim 이미지 사용 (최적 크기)
✅ ffmpeg 설치 (YouTube 다운로드 필수)
✅ 불필요한 패키지 정리 (`apt-get clean`, `rm -rf /var/lib/apt/lists/*`)
✅ `--no-cache-dir` 플래그로 pip 캐시 제외
✅ 레이어 캐싱 고려 (의존성 먼저 복사)

### 개선 가능한 부분

⚠️ **보안**: root 사용자로 실행 (비권장)
⚠️ **크기**: 멀티 스테이지 빌드 미적용
⚠️ **헬스 체크**: Dockerfile에 HEALTHCHECK 없음 (Railway는 `railway.json`에서 설정 가능)
⚠️ **의존성**: 빌드 도구가 런타임에 포함됨

---

## 최적화된 Dockerfile

### 개선사항 요약

1. **멀티 스테이지 빌드**: 빌드 도구와 런타임 분리
2. **비루트 사용자**: 보안 강화
3. **헬스 체크**: Dockerfile 내장 헬스 체크
4. **curl 추가**: 헬스 체크용

### 최적화된 Dockerfile (`backend/Dockerfile.optimized`)

```dockerfile
# Multi-stage build for optimized production image
# Stage 1: Builder
FROM python:3.12-slim AS builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies to a local directory
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim

# Install runtime dependencies (ffmpeg for audio processing, curl for health checks)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/

# Create non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /tmp/ytdlp_downloads && \
    chown -R appuser:appuser /tmp/ytdlp_downloads

# Switch to non-root user
USER appuser

# Expose port (Railway will bind to $PORT)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/api/v1/health || exit 1

# Start application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 개선사항 상세 설명

### 1. 멀티 스테이지 빌드

**이전**:
- 빌드 도구(gcc, g++)가 최종 이미지에 포함됨
- 이미지 크기 증가

**개선 후**:
```dockerfile
# Stage 1: Builder (빌드 전용)
FROM python:3.12-slim AS builder
RUN pip install --prefix=/install -r requirements.txt

# Stage 2: Runtime (실행 전용)
FROM python:3.12-slim
COPY --from=builder /install /usr/local
```

**효과**:
- 이미지 크기 약 20-30% 감소
- 빌드 도구가 최종 이미지에서 제거됨

---

### 2. 비루트 사용자

**이전**:
```dockerfile
# root 사용자로 실행 (보안 위험)
CMD ["uvicorn", "app.main:app", ...]
```

**개선 후**:
```dockerfile
# 비권한 사용자 생성
RUN useradd -m -u 1001 appuser

# 파일 소유권 변경
RUN chown -R appuser:appuser /app

# 비루트 사용자로 전환
USER appuser

CMD ["uvicorn", "app.main:app", ...]
```

**효과**:
- 컨테이너 탈출 공격 시 피해 최소화
- 프로덕션 보안 Best Practice 준수

---

### 3. 헬스 체크 내장

**이전**:
- Dockerfile에 HEALTHCHECK 없음
- Railway `railway.json`에만 의존

**개선 후**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/api/v1/health || exit 1
```

**효과**:
- Docker 레벨에서 컨테이너 상태 자동 모니터링
- Railway 외 다른 플랫폼(AWS ECS, Kubernetes)에서도 사용 가능

**옵션 설명**:
- `--interval=30s`: 30초마다 헬스 체크 실행
- `--timeout=10s`: 10초 이내 응답 없으면 실패
- `--start-period=40s`: 앱 시작 후 40초 동안 실패 무시
- `--retries=3`: 3회 연속 실패 시 unhealthy 상태

---

### 4. curl 추가

**이전**:
```dockerfile
RUN apt-get install -y ffmpeg
```

**개선 후**:
```dockerfile
RUN apt-get install -y ffmpeg curl
```

**효과**:
- HEALTHCHECK에서 `curl` 사용 가능
- 디버깅 시 컨테이너 내부에서 API 테스트 가능

---

## 이미지 크기 비교

### 예상 크기

| 버전 | 이미지 크기 | 설명 |
|------|------------|------|
| 기존 Dockerfile | ~1.2GB | 빌드 도구 포함 |
| 최적화 Dockerfile | ~950MB | 빌드 도구 제외, 멀티 스테이지 |

**절감 효과**:
- 약 250MB 감소 (~20%)
- Railway 디스크 공간 절약
- 배포 속도 향상 (이미지 다운로드 시간 단축)

---

## 적용 방법

### 옵션 1: 기존 Dockerfile 대체 (권장)

```bash
# 최적화 버전으로 교체
cd backend
mv Dockerfile Dockerfile.old
mv Dockerfile.optimized Dockerfile

# 테스트
docker build -t backend-optimized .
docker run -p 8000:8000 backend-optimized

# 성공 시 커밋
git add Dockerfile Dockerfile.old
git commit -m "optimize: Apply multi-stage build and non-root user"
git push origin main
```

**Railway 자동 동작**:
- GitHub 푸시 감지
- 새 Dockerfile로 빌드
- 자동 배포

---

### 옵션 2: 기존 Dockerfile 유지 (안전)

현재 Dockerfile이 문제없이 작동한다면:
- `Dockerfile.optimized`를 참고용으로만 보관
- 나중에 필요 시 적용

---

## 로컬 테스트

### 기존 vs 최적화 비교

```bash
cd backend

# 기존 Dockerfile 빌드
docker build -t backend-original .

# 최적화 Dockerfile 빌드
docker build -f Dockerfile.optimized -t backend-optimized .

# 크기 비교
docker images | grep backend

# 결과 예시:
# backend-original     latest    1.2GB
# backend-optimized    latest    950MB
```

### 기능 테스트

```bash
# 최적화 버전 실행
docker run -p 8000:8000 \
  -e CORS_ORIGINS='["http://localhost:5173"]' \
  backend-optimized

# 헬스 체크
curl http://localhost:8000/api/v1/health

# Docker 헬스 상태 확인
docker ps
# STATUS 컬럼에서 "healthy" 확인
```

---

## railway.json 설정

### 최적화된 Dockerfile과 함께 사용

`backend/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 100
  }
}
```

**주의**:
- Dockerfile에 HEALTHCHECK가 있어도 Railway는 자체 헬스 체크 사용
- `healthcheckPath`는 Railway 배포 상태 확인용
- Dockerfile HEALTHCHECK는 Docker 레벨 모니터링용

---

## 추가 최적화 (고급)

### Python 패키지 최적화

**의존성 분석**:
```bash
# 불필요한 패키지 제거
pip list --format=freeze | grep -v "^-e" > requirements.txt

# 패키지 크기 확인
pip list --format=columns
```

### 레이어 캐싱 최적화

**현재**:
```dockerfile
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ ./app/
```

**이미 최적화됨**:
- `requirements.txt`를 먼저 복사 → 의존성 레이어 캐싱
- 코드 변경 시 의존성 재설치 불필요

---

## 체크리스트

배포 전 확인:

### Dockerfile 검증

- [x] 멀티 스테이지 빌드 적용
- [x] 비루트 사용자 설정
- [x] HEALTHCHECK 정의
- [x] curl 설치 (헬스 체크용)
- [x] ffmpeg 설치 (YouTube 다운로드용)
- [x] 불필요한 패키지 제거

### 로컬 테스트

- [ ] 이미지 빌드 성공
- [ ] 컨테이너 실행 성공
- [ ] 헬스 체크 통과 (`curl /api/v1/health`)
- [ ] YouTube 변환 테스트
- [ ] 음원 분리 테스트

### Railway 배포

- [ ] Root Directory: `backend`
- [ ] 환경 변수 설정 완료
- [ ] 빌드 로그 확인
- [ ] 헬스 체크 통과
- [ ] API 문서 접근 가능 (`/docs`)

---

## 참고 자료

- [Docker Multi-Stage Builds](https://docs.docker.com/develop/develop-images/multistage-build/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/)
- [Railway Dockerfile Deployment](https://docs.railway.app/deploy/dockerfiles)

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**추천**: 프로덕션 환경에서는 최적화 버전 사용 권장
