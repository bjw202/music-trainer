# 모노레포 배포 메커니즘 완벽 가이드

> Vercel과 Railway에서 혼합 구조 모노레포를 충돌 없이 배포하는 원리

---

## 📋 목차

1. [개요](#개요)
2. [핵심 개념: Selective Build Mechanism](#핵심-개념-selective-build-mechanism)
3. [Vercel 빌드 메커니즘](#vercel-빌드-메커니즘)
4. [Railway 빌드 메커니즘](#railway-빌드-메커니즘)
5. [실제 프로젝트 구조 분석](#실제-프로젝트-구조-분석)
6. [.gitignore의 역할](#gitignore의-역할)
7. [빌드 시뮬레이션](#빌드-시뮬레이션)
8. [자주 묻는 질문 (FAQ)](#자주-묻는-질문-faq)
9. [실습 문제](#실습-문제)
10. [참고 자료](#참고-자료)

---

## 개요

### 문제 상황

현재 프로젝트는 다음과 같은 혼합 구조입니다:

```
guitar-mp3-trainer-v2/
├── .claude/           # Claude Code 설정
├── .moai/             # MoAI 설정
├── backend/           # FastAPI 백엔드
│   ├── Dockerfile
│   ├── app/
│   └── requirements.txt
├── src/               # React 프론트엔드
├── package.json       # 프론트엔드 의존성
├── vite.config.ts
└── ...
```

**질문**: 이런 혼합 구조에서 Vercel과 Railway에 GitHub를 통해 배포할 때 에러가 나지 않을까?

**답변**: 에러가 나지 않습니다! 두 플랫폼 모두 **Selective Build Mechanism**을 사용하기 때문입니다.

---

## 핵심 개념: Selective Build Mechanism

### 선택적 빌드란?

전체 레포지토리를 클론하지만, **빌드 및 배포 단계에서는 필요한 부분만 선택적으로 사용**하는 메커니즘입니다.

### 핵심 원리

| 단계 | Vercel | Railway |
|------|--------|---------|
| **1. 클론** | 전체 레포 클론 | 전체 레포 클론 |
| **2. 빌드 감지** | `package.json` 기반 | `Root Directory` 설정 기반 |
| **3. 빌드 수행** | `vite build` (src/ → dist/) | `docker build backend/` |
| **4. 배포** | dist/ 폴더만 CDN 배포 | Docker 컨테이너 실행 |

### 비유

은행 금고에서 필요한 서류만 꺼내는 것과 같습니다:
- 금고 전체를 가져오지만 (클론)
- 필요한 서류만 꺼내고 (빌드 감지)
- 나머지는 그대로 둡니다 (무시)

---

## Vercel 빌드 메커니즘

### 1단계: 레포지토리 클론

```bash
# Vercel이 실행하는 명령 (개념적)
git clone https://github.com/username/guitar-mp3-trainer-v2.git
cd guitar-mp3-trainer-v2
```

이 시점에 전체 폴더가 클론됩니다:
- `.claude/` ✅ 클론됨
- `.moai/` ✅ 클론됨
- `backend/` ✅ 클론됨
- `src/` ✅ 클론됨
- `package.json` ✅ 클론됨

### 2단계: 프론트엔드 감지

Vercel은 **루트 폴더에 `package.json`이 있는지 확인**합니다.

```json
// package.json (루트)
{
  "name": "guitar-mp3-trainer-v2",
  "scripts": {
    "build": "vite build"
  }
}
```

**감지 결과**: "이 프로젝트는 Vite 프론트엔드입니다."

### 3단계: 의존성 설치 및 빌드

```bash
# Vercel이 실행하는 명령
npm install
npm run build
```

이때 `vite build`가 수행됩니다:

```javascript
// vite.config.ts
export default defineConfig({
  root: './',           // 루트 기준
  build: {
    outDir: 'dist'      // 출력 폴더: dist/
  }
})
```

**빌드 결과**:
- `src/` 폴더 읽음 → JavaScript/CSS 번들 생성
- `dist/` 폴더에 정적 파일 출력
- **`.claude/`, `.moai/`, `backend/`는 빌드에 사용되지 않음**

### 4단계: 배포

Vercel은 **`dist/` 폴더만** CDN에 업로드합니다.

```
배포되는 파일:
dist/
├── index.html
├── assets/
│   ├── index-abc123.js
│   └── index-xyz789.css
└── ...

배포되지 않는 파일:
.claude/       ❌ (빌드에 미사용)
.moai/         ❌ (빌드에 미사용)
backend/       ❌ (빌드에 미사용)
src/           ❌ (dist/로 변환됨)
```

### Vercel 빌드 흐름도

```
GitHub Repo (전체 클론)
    ↓
package.json 감지
    ↓
npm run build (vite build)
    ↓
src/ → dist/ 변환
    ↓
dist/ 폴더만 CDN 배포
    ↓
https://your-app.vercel.app
```

---

## Railway 빌드 메커니즘

### 1단계: Root Directory 설정

Railway 대시보드에서 설정:

```
Service Settings
├── Root Directory: backend/
└── ...
```

**의미**: "이 서비스는 `backend/` 폴더만 사용합니다."

### 2단계: 레포지토리 클론

```bash
# Railway가 실행하는 명령 (개념적)
git clone https://github.com/username/guitar-mp3-trainer-v2.git
cd guitar-mp3-trainer-v2
```

전체 레포가 클론되지만, **작업 디렉터리는 `backend/`로 이동**합니다.

### 3단계: Docker 빌드

Railway는 `backend/Dockerfile`을 찾아 실행합니다:

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# backend/ 폴더 내부 파일만 복사
COPY requirements.txt .
COPY app/ ./app/

RUN pip install -r requirements.txt

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**중요**: `COPY` 명령은 **`backend/` 폴더 기준**으로 실행됩니다.

```bash
# 실제 복사되는 경로
backend/requirements.txt   → /app/requirements.txt
backend/app/               → /app/app/
```

**복사되지 않는 파일**:
- `.claude/` ❌ (backend/ 외부)
- `.moai/` ❌ (backend/ 외부)
- `src/` ❌ (backend/ 외부)
- `package.json` ❌ (backend/ 외부)

### 4단계: 컨테이너 실행

```bash
# Railway가 실행하는 명령
docker run -p 8000:8000 <image>
```

**배포 결과**:
- Docker 컨테이너 내부: `/app/` (Python 백엔드만)
- 외부 접근: `https://your-backend.railway.app`

### Railway 빌드 흐름도

```
GitHub Repo (전체 클론)
    ↓
Root Directory: backend/ 설정
    ↓
backend/Dockerfile 실행
    ↓
backend/ 폴더만 Docker 이미지에 포함
    ↓
Docker 컨테이너 배포
    ↓
https://your-backend.railway.app
```

---

## 실제 프로젝트 구조 분석

### 프로젝트 파일 트리

```
guitar-mp3-trainer-v2/
├── .claude/
│   ├── agents/
│   ├── rules/
│   ├── skills/
│   └── settings.json
├── .moai/
│   ├── config/
│   ├── specs/
│   └── project/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       └── ...
├── src/
│   ├── components/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── .gitignore
└── README.md
```

### 각 폴더의 운명

| 폴더/파일 | GitHub 푸시 | Vercel 빌드 사용 | Vercel 배포 | Railway 빌드 사용 | Railway 배포 |
|-----------|------------|-----------------|------------|------------------|-------------|
| `.claude/` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `.moai/` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `backend/` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `src/` | ✅ | ✅ (읽음) | ❌ (dist/로 변환) | ❌ | ❌ |
| `package.json` | ✅ | ✅ (감지) | ❌ | ❌ | ❌ |
| `dist/` (빌드 결과) | ❌ | - | ✅ | ❌ | ❌ |

### 핵심 통찰

1. **GitHub에는 전부 푸시됩니다** (.gitignore 제외)
2. **Vercel은 프론트엔드만 빌드/배포합니다** (src/ → dist/)
3. **Railway는 백엔드만 빌드/배포합니다** (backend/ Dockerfile)
4. **설정 폴더들은 어디에도 배포되지 않습니다** (.claude/, .moai/)

---

## .gitignore의 역할

### .gitignore 주요 패턴

```gitignore
# Line 116-119: MoAI 백업 제외
.moai-backups/
backup-*/

# Line 161-175: Claude Code 설정 (일부 제외)
.claude/agent-memory-local/
.claude/memory/

# Line 179-197: 빌드 아티팩트 제외
dist/
dist-ssr/
*.local
node_modules/
```

### .gitignore가 배포에 미치는 영향

| 항목 | .gitignore 포함 | GitHub 푸시 | Vercel 클론 | Railway 클론 |
|------|----------------|------------|------------|-------------|
| `dist/` | ✅ | ❌ | ❌ | ❌ |
| `node_modules/` | ✅ | ❌ | ❌ (새로 설치) | ❌ |
| `.claude/memory/` | ✅ | ❌ | ❌ | ❌ |
| `.moai/config/` | ❌ | ✅ | ✅ (클론됨, 빌드 미사용) | ✅ (클론됨, 빌드 미사용) |

### 왜 .claude/와 .moai/는 .gitignore에 없나요?

**의도된 설계**입니다:
- 이 폴더들은 **프로젝트 메타데이터**입니다
- 팀원과 공유해야 하는 정보입니다 (에이전트 정의, SPEC 문서 등)
- GitHub에 푸시되어야 합니다

**배포 충돌을 피하는 이유**:
- Vercel: `package.json` 기반 감지 → `.moai/`는 무시됨
- Railway: `backend/` 외부 → Docker 이미지에 포함되지 않음

---

## 빌드 시뮬레이션

### Vercel 빌드 시뮬레이션

로컬에서 Vercel 빌드를 재현해봅시다:

```bash
# 1. 레포 클론 (전체)
git clone https://github.com/username/guitar-mp3-trainer-v2.git
cd guitar-mp3-trainer-v2

# 2. 의존성 설치
npm install

# 3. 빌드 수행
npm run build

# 4. 결과 확인
ls -la dist/
# 출력:
# index.html
# assets/
#   index-abc123.js
#   index-xyz789.css
```

**확인 포인트**:
- `dist/` 폴더 생성됨 ✅
- `.claude/`, `.moai/`, `backend/`는 `dist/`에 포함되지 않음 ✅

### Railway 빌드 시뮬레이션

로컬에서 Railway 빌드를 재현해봅시다:

```bash
# 1. 레포 클론 (전체)
git clone https://github.com/username/guitar-mp3-trainer-v2.git
cd guitar-mp3-trainer-v2

# 2. backend/ 폴더로 이동 (Root Directory 시뮬레이션)
cd backend

# 3. Docker 이미지 빌드
docker build -t backend-test .

# 4. 컨테이너 실행
docker run -p 8000:8000 backend-test

# 5. 컨테이너 내부 확인
docker exec -it <container-id> ls -la /app
# 출력:
# requirements.txt
# app/
#   main.py
#   ...
```

**확인 포인트**:
- `/app/` 폴더에 `backend/` 내용만 포함됨 ✅
- `.claude/`, `.moai/`, `src/`는 컨테이너에 포함되지 않음 ✅

---

## 자주 묻는 질문 (FAQ)

### Q1: .claude/ 폴더가 GitHub에 푸시되는데 배포 시 문제가 없나요?

**A**: 문제 없습니다.
- Vercel: `package.json` 기반 빌드 → `.claude/`는 읽지 않음
- Railway: `backend/` 외부 → Docker 이미지에 포함되지 않음

### Q2: backend/ 폴더가 Vercel 빌드에 영향을 주지 않나요?

**A**: 영향을 주지 않습니다.
- Vite 빌드는 `vite.config.ts`의 `root` 설정을 따릅니다
- `backend/`는 `src/`가 아니므로 빌드 대상이 아닙니다

### Q3: package.json이 루트에 있는데 Railway가 혼동하지 않나요?

**A**: 혼동하지 않습니다.
- Railway는 `Root Directory: backend/` 설정으로 격리됩니다
- `backend/Dockerfile`만 사용하며, 루트의 `package.json`은 무시됩니다

### Q4: dist/ 폴더를 .gitignore에서 제거하면 어떻게 되나요?

**A**: 권장하지 않습니다.
- `dist/`는 빌드 결과물 (자동 생성)
- GitHub에 푸시하면 레포 크기만 증가합니다
- Vercel은 항상 새로 빌드하므로 푸시할 필요 없음

### Q5: 프론트엔드와 백엔드를 하나의 플랫폼에 배포할 수 있나요?

**A**: 가능하지만 권장하지 않습니다.
- Railway에서 Static Site + Backend를 동시 배포 가능
- 하지만 프론트엔드는 CDN 최적화가 중요 → Vercel 추천
- 백엔드는 서버 리소스 관리 필요 → Railway 추천
- **역할 분리**가 성능과 비용 측면에서 유리합니다

### Q6: Vercel에서 backend/ 폴더를 명시적으로 무시해야 하나요?

**A**: 필요 없습니다.
- Vite는 `src/` 폴더만 읽습니다 (vite.config.ts 설정)
- `backend/`는 자동으로 무시됩니다
- 별도 설정 불필요

---

## 실습 문제

### 문제 1: 빌드 흐름 추적

다음 상황에서 각 단계를 설명하세요:

```
1. 개발자가 src/App.tsx를 수정하고 커밋합니다.
2. GitHub에 푸시합니다.
3. Vercel이 자동 배포를 트리거합니다.
```

**질문**: Vercel이 수행하는 단계를 순서대로 나열하세요.

<details>
<summary>정답 보기</summary>

1. GitHub Webhook 수신
2. 레포지토리 클론 (전체)
3. `package.json` 감지 (프론트엔드 프로젝트 확인)
4. `npm install` 실행 (의존성 설치)
5. `npm run build` 실행 (`vite build` → `dist/` 생성)
6. `dist/` 폴더만 CDN에 업로드
7. 배포 완료, URL 반환: `https://your-app.vercel.app`

</details>

### 문제 2: Docker 이미지 내용 예측

다음 Dockerfile이 주어졌을 때:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
COPY app/ ./app/
RUN pip install -r requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**질문**: Railway에서 이 이미지를 빌드할 때 `/app/` 폴더에 포함되는 파일은?

<details>
<summary>정답 보기</summary>

포함되는 파일:
- `/app/requirements.txt` (backend/requirements.txt 복사)
- `/app/app/` (backend/app/ 폴더 복사)
  - `/app/app/main.py`
  - `/app/app/routers/`
  - 기타 backend/app/ 하위 파일들

포함되지 않는 파일:
- `.claude/` (backend/ 외부)
- `.moai/` (backend/ 외부)
- `src/` (backend/ 외부)
- `package.json` (backend/ 외부)
- 루트 폴더의 모든 파일

</details>

### 문제 3: 배포 에러 디버깅

다음 상황에서 문제를 진단하세요:

```
증상: Railway 배포 후 백엔드에서 "ModuleNotFoundError: No module named 'app'" 에러 발생

프로젝트 구조:
backend/
├── Dockerfile
├── requirements.txt
└── src/  (← app/ 대신 src/)
    └── main.py

Dockerfile 내용:
COPY app/ ./app/  (← 문제 지점)
```

**질문**: 에러의 원인과 해결 방법은?

<details>
<summary>정답 보기</summary>

**원인**:
- Dockerfile이 `app/` 폴더를 복사하려 하지만, 실제 폴더명은 `src/`입니다.
- `COPY app/ ./app/` 실행 시 `app/` 폴더를 찾을 수 없어 빈 폴더가 됩니다.

**해결 방법**:

옵션 1: 폴더명 변경
```bash
mv backend/src backend/app
```

옵션 2: Dockerfile 수정
```dockerfile
COPY src/ ./app/
```

옵션 3: CMD 수정 (폴더명 유지)
```dockerfile
COPY src/ ./src/
CMD ["uvicorn", "src.main:app", ...]
```

</details>

---

## 참고 자료

### 공식 문서

- [Vercel Build Configuration](https://vercel.com/docs/build-step)
- [Railway Dockerfile Deployment](https://docs.railway.app/deploy/dockerfiles)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)

### 관련 MoAI 학습 자료

- [Deployment Architecture Guide](./deployment-architecture-guide.md)
- SPEC-MVP-001 구현 문서
- `.moai/project/tech.md` (기술 스택 문서)

### 추가 학습 주제

1. **Monorepo 전략**
   - Turborepo, Nx 같은 모노레포 도구
   - 공유 라이브러리 관리
   - 빌드 캐싱 최적화

2. **CI/CD 심화**
   - GitHub Actions를 통한 자동 배포
   - 환경별 배포 전략 (staging, production)
   - 배포 롤백 전략

3. **Docker 최적화**
   - Multi-stage builds
   - 이미지 크기 최적화
   - 레이어 캐싱 전략

---

## 요약

### 핵심 원리

1. **Vercel과 Railway는 전체 레포를 클론하지만, 빌드 시 선택적으로 사용합니다.**
2. **Vercel**: `package.json` 감지 → `src/` 빌드 → `dist/` 배포
3. **Railway**: `backend/` 격리 → Dockerfile 실행 → Docker 컨테이너 배포
4. **설정 폴더** (`.claude/`, `.moai/`)는 클론되지만 빌드/배포에 포함되지 않습니다.

### 왜 에러가 나지 않는가?

- **빌드 감지 메커니즘**: 각 플랫폼이 자신의 역할에 맞는 파일만 찾습니다.
- **격리된 빌드 환경**: Vercel은 루트, Railway는 `backend/`에서 작업합니다.
- **최종 배포 단계**: 빌드 결과물만 배포되며, 소스 코드는 배포되지 않습니다.

### 실전 적용

이제 다음과 같은 혼합 구조에서도 자신감 있게 배포할 수 있습니다:

```
mixed-project/
├── .claude/
├── .moai/
├── backend/      → Railway
├── frontend/     → Vercel
├── docs/
└── scripts/
```

**핵심**: 각 플랫폼의 빌드 감지 메커니즘을 이해하면, 복잡한 구조도 두렵지 않습니다!

---

**작성일**: 2026-02-16
**버전**: 1.0.0
**태그**: #monorepo #deployment #vercel #railway #docker #vite
